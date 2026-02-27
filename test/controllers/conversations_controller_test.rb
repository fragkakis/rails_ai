require "test_helper"

class ConversationsControllerTest < ActionDispatch::IntegrationTest
  SESSION_ID = "session_abc123"

  setup do
    ApplicationController.any_instance.stubs(:current_session_id).returns(SESSION_ID)
    ApplicationController.any_instance.stubs(:ensure_session_id)
  end

  test "index renders successfully" do
    get root_path
    assert_response :success
  end

  test "index assigns conversations for current session only" do
    get root_path
    conversations = @controller.instance_variable_get(:@conversations)
    assert_includes conversations, conversations(:gemini_chat)
    assert_includes conversations, conversations(:openai_chat)
    assert_not_includes conversations, conversations(:other_session_chat)
  end

  test "index does not assign @conversation when no id param" do
    get root_path
    assert_nil @controller.instance_variable_get(:@conversation)
  end

  test "show assigns the requested conversation" do
    conversation = conversations(:gemini_chat)
    get conversation_path(conversation)
    assert_response :success
    assert_equal conversation, @controller.instance_variable_get(:@conversation)
  end

  test "show assigns messages ordered by created_at" do
    conversation = conversations(:gemini_chat)
    get conversation_path(conversation)
    assert_equal conversation.messages.order(:created_at).to_a, @controller.instance_variable_get(:@messages)
  end

  test "show returns 404 for a conversation belonging to a different session" do
    other = conversations(:other_session_chat)
    get conversation_path(other)
    assert_response :not_found
  end

  test "update changes model_id via JSON" do
    conversation = conversations(:gemini_chat)
    patch conversation_path(conversation),
      params: { model_id: "gpt-4o" },
      headers: { "Accept" => "application/json" }

    assert_response :success
    json = JSON.parse(response.body)
    assert_equal "gpt-4o", json["model_id"]
    assert_equal "gpt-4o", conversation.reload.model_id
  end

  test "update changes model_id via HTML and redirects" do
    conversation = conversations(:gemini_chat)
    patch conversation_path(conversation),
      params: { model_id: "gpt-4o" }

    assert_redirected_to conversation_path(conversation)
    assert_equal "gpt-4o", conversation.reload.model_id
  end

  test "update returns 404 for a conversation belonging to a different session" do
    other = conversations(:other_session_chat)
    patch conversation_path(other),
      params: { model_id: "gpt-4o" },
      headers: { "Accept" => "application/json" }

    assert_response :not_found
  end
end
