class ConversationsController < ApplicationController
  def index
    @conversations = Conversation.for_session(current_session_id).ordered
    @conversation = Conversation.for_session(current_session_id).find_by!(uuid: params[:id]) if params[:id]
    @messages = @conversation.messages.order(:created_at) if @conversation
  end

  def show
    @conversations = Conversation.for_session(current_session_id).ordered
    @conversation = Conversation.for_session(current_session_id).find_by!(uuid: params[:id])
    @messages = @conversation.messages.order(:created_at)
    render :index
  end

  def create
    @conversation = Conversation.create!(model_id: params[:model_id], session_id: current_session_id)
    if params[:content].present?
      redirect_to conversation_path(@conversation, content: params[:content])
    else
      redirect_to conversation_path(@conversation)
    end
  end

  def update
    conversation = Conversation.for_session(current_session_id).find_by!(uuid: params[:id])
    conversation.update!(model_id: params[:model_id])

    redirect_to conversation_path(conversation)
  end

  def generate_title
    conversation = Conversation.for_session(current_session_id).find_by!(uuid: params[:id])
    content = params[:content].to_s.truncate(500)

    chat = RubyLLM.chat(model: "gemini-2.5-flash")
    response = chat.ask("Generate a concise title (max 6 words) for a conversation that starts with this message. Return only the title, no quotes or punctuation.\n\nMessage: #{content}")
    title = response.content.strip.truncate(100)

    conversation.update!(title: title)
    render json: { title: title }
  rescue => e
    render json: { error: e.message }, status: :unprocessable_entity
  end

  def destroy
    Conversation.for_session(current_session_id).find_by!(uuid: params[:id]).destroy
    redirect_to root_path
  end
end
