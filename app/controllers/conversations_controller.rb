class ConversationsController < ApplicationController
  def index
    @conversations = Conversation.ordered
    @conversation = Conversation.find(params[:id]) if params[:id]
    @messages = @conversation.messages.order(:created_at) if @conversation
  end

  def show
    @conversations = Conversation.ordered
    @conversation = Conversation.find(params[:id])
    @messages = @conversation.messages.order(:created_at)
    render :index
  end

  def create
    @conversation = Conversation.create!(model_id: params[:model_id])
    redirect_to conversation_path(@conversation)
  end

  def update
    conversation = Conversation.find(params[:id])
    conversation.update!(model_id: params[:model_id])
    redirect_to conversation_path(conversation)
  end

  def destroy
    Conversation.find(params[:id]).destroy
    redirect_to root_path
  end
end
