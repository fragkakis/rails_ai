class MessagesController < ApplicationController
  include ActionController::Live

  def create
    @conversation = Conversation.find(params[:conversation_id])
    content = params[:content]

    # Save user message
    @conversation.messages.create!(role: "user", content: content)

    if @conversation.title.blank?
      @conversation.update!(title: content.truncate(50))
    end

    response.headers["Content-Type"] = "text/event-stream"
    response.headers["Cache-Control"] = "no-cache"
    response.headers["X-Accel-Buffering"] = "no"

    assistant_content = +""

    begin
      chat = RubyLLM.chat(model: @conversation.model_id)

      # Load prior messages (all except the last user message we just created)
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
    rescue => e
      response.stream.write("event: error\ndata: #{{ message: e.message }.to_json}\n\n")
    ensure
      response.stream.close
    end
  end
end
