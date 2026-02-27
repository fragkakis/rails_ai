class MessagesController < ApplicationController
  include ActionController::Live

  def create
    @conversation = Conversation.for_session(current_session_id).find_by!(uuid: params[:conversation_id])
    content = params[:content]

    # Save user message
    @conversation.messages.create!(role: "user", content: content)

    if @conversation.title.blank?
      @conversation.update!(title: content.truncate(50))
    end

    # Check for API key before starting SSE stream
    api_key = check_api_key
    return unless api_key != false

    set_sse_headers

    chat = build_chat(@conversation, api_key)
    stream_llm_response(content, chat)
  end

  def retry
    @conversation = Conversation.for_session(current_session_id).find_by!(uuid: params[:conversation_id])

    last_user_msg = @conversation.messages.where(role: "user").order(:created_at).last
    unless last_user_msg
      render json: { error: "No user message to retry" }, status: :unprocessable_entity
      return
    end

    # Delete last assistant message if it exists
    last_assistant = @conversation.messages.where(role: "assistant").order(:created_at).last
    last_assistant&.destroy

    # Check for API key before starting SSE stream
    api_key = check_api_key
    return unless api_key != false

    set_sse_headers

    chat = build_chat(@conversation, api_key)
    stream_llm_response(last_user_msg.content, chat)
  end

  private

  def check_api_key
    if @conversation.requires_api_key?
      api_key = request.headers["X-Api-Key"]
      if api_key.blank?
        render json: { error: "API key required. Add your #{@conversation.provider_name} key in the API Keys panel." }, status: :unprocessable_entity
        return false
      end
      api_key
    else
      nil
    end
  end

  def set_sse_headers
    response.headers["Content-Type"] = "text/event-stream"
    response.headers["Cache-Control"] = "no-cache"
    response.headers["X-Accel-Buffering"] = "no"
  end

  def stream_llm_response(content, chat)
    assistant_content = +""

    begin
      # Load prior messages (all except the last user message — ask() will send it)
      prior_messages = @conversation.messages.order(:created_at).to_a
      prior_messages.pop # remove the last user message — ask() will send it

      prior_messages.each do |m|
        chat.add_message(role: m.role.to_sym, content: m.content)
      end

      chat.ask(content) do |chunk|
        text = chunk.content
        next if text.nil?

        assistant_content << text
        response.stream.write("data: #{{ content: text }.to_json}\n\n")
      end

      @conversation.messages.create!(role: "assistant", content: assistant_content)
      response.stream.write("event: done\ndata: {}\n\n")
    rescue ActionController::Live::ClientDisconnected
      # Client aborted — save partial response
      if assistant_content.present?
        @conversation.messages.create!(role: "assistant", content: assistant_content)
      end
    rescue => e
      begin
        response.stream.write("event: error\ndata: #{{ message: e.message }.to_json}\n\n")
      rescue ActionController::Live::ClientDisconnected
        # Client already gone during error reporting — save what we have
        if assistant_content.present?
          @conversation.messages.create!(role: "assistant", content: assistant_content)
        end
      end
    ensure
      response.stream.close
    end
  end

  def build_chat(conversation, api_key = nil)
    model = conversation.model_id

    if conversation.requires_api_key? && api_key.present?
      config_key = Conversation::PROVIDER_CONFIG_KEYS[conversation.provider_name]
      RubyLLM.context { |c| c.send(:"#{config_key}=", api_key) }.chat(model: model)
    else
      RubyLLM.chat(model: model)
    end
  end
end
