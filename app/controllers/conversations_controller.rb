class ConversationsController < ApplicationController
  def index
    @conversations = Conversation.for_session(current_session_id).ordered
    @conversation = Conversation.for_session(current_session_id).find(params[:id]) if params[:id]
    @messages = @conversation.messages.order(:created_at) if @conversation
  end

  def show
    @conversations = Conversation.for_session(current_session_id).ordered
    @conversation = Conversation.for_session(current_session_id).find(params[:id])
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
    conversation = Conversation.for_session(current_session_id).find(params[:id])
    conversation.update!(model_id: params[:model_id])

    redirect_to conversation_path(conversation)
  end

  def destroy
    Conversation.for_session(current_session_id).find(params[:id]).destroy
    redirect_to root_path
  end
end
