require "test_helper"
require "ostruct"

class MessagesControllerTest < ActionDispatch::IntegrationTest
  SESSION_ID = "session_abc123"

  setup do
    ApplicationController.any_instance.stubs(:current_session_id).returns(SESSION_ID)
    ApplicationController.any_instance.stubs(:ensure_session_id)
    @conversation = conversations(:gemini_chat)
  end

  test "client disconnect saves partial assistant message" do
    fake_chat = mock("chat")
    fake_chat.stubs(:add_message)

    # Yield one chunk then raise ClientDisconnected (bubbles out through ask's block)
    fake_chat.stubs(:ask).with("Hello")
      .yields(OpenStruct.new(content: "Hello "))
      .raises(ActionController::Live::ClientDisconnected)

    RubyLLM.stubs(:chat).returns(fake_chat)

    assert_difference -> { @conversation.messages.count }, 2 do # user + partial assistant
      post conversation_messages_path(@conversation),
        params: { content: "Hello" },
        headers: { "Content-Type" => "application/x-www-form-urlencoded" }
    end

    assistant_msg = @conversation.messages.where(role: "assistant").last
    assert assistant_msg.present?, "Expected a partial assistant message to be saved"
    assert_includes assistant_msg.content, "Hello "
  end

  test "client disconnect with no chunks does not save empty message" do
    fake_chat = mock("chat")
    fake_chat.stubs(:add_message)

    # Raise before yielding any chunks — assistant_content stays empty, nothing saved
    fake_chat.stubs(:ask).with("Hello")
      .raises(ActionController::Live::ClientDisconnected)

    RubyLLM.stubs(:chat).returns(fake_chat)

    # Only user message should be created (no empty assistant message)
    assert_no_difference -> { @conversation.messages.where(role: "assistant").count } do
      assert_difference -> { @conversation.messages.count }, 1 do
        post conversation_messages_path(@conversation),
          params: { content: "Hello" },
          headers: { "Content-Type" => "application/x-www-form-urlencoded" }
      end
    end
  end

  # --- Retry tests ---

  test "retry deletes last assistant message and streams new response" do
    fake_chat = mock("chat")
    fake_chat.stubs(:add_message)
    fake_chat.stubs(:ask).with("Hello, how are you?")
      .yields(OpenStruct.new(content: "New response"))

    RubyLLM.stubs(:chat).returns(fake_chat)

    old_assistant_message = messages(:gemini_assistant_msg)
    old_assistant_id = old_assistant_message.id

    post retry_conversation_messages_path(@conversation),
      headers: { "Content-Type" => "application/x-www-form-urlencoded" }

    # Old assistant message should be destroyed
    assert_not Message.exists?(old_assistant_id), "Expected old assistant message to be destroyed"

    # New assistant message should be created
    new_assistant_message = @conversation.messages.where(role: "assistant").last
    assert new_assistant_message.present?, "Expected a new assistant message"
    assert_equal "New response", new_assistant_message.content
  end

  test "retry returns 422 when no user message exists" do
    # Create a conversation with no messages
    conversation = Conversation.create!(model_id: "gemini-2.5-flash", session_id: SESSION_ID)

    post retry_conversation_messages_path(conversation),
      headers: { "Content-Type" => "application/x-www-form-urlencoded" }

    assert_response :unprocessable_entity
  end

  test "retry with client disconnect saves partial response" do
    fake_chat = mock("chat")
    fake_chat.stubs(:add_message)
    fake_chat.stubs(:ask).with("Hello, how are you?")
      .yields(OpenStruct.new(content: "Partial "))
      .raises(ActionController::Live::ClientDisconnected)

    RubyLLM.stubs(:chat).returns(fake_chat)

    old_assistant_message = messages(:gemini_assistant_msg)
    old_assistant_id = old_assistant_message.id

    post retry_conversation_messages_path(@conversation),
      headers: { "Content-Type" => "application/x-www-form-urlencoded" }

    # Old assistant message should be destroyed
    assert_not Message.exists?(old_assistant_id)

    # Partial new assistant message should be saved
    new_assistant_message = @conversation.messages.where(role: "assistant").last
    assert old_assistant_message.present?, "Expected a partial assistant message to be saved"
    assert_equal "Partial ", new_assistant_message.content
  end

  test "retry for BYOK provider without API key returns 422" do
    openai_conversation = conversations(:openai_chat)

    post retry_conversation_messages_path(openai_conversation),
      headers: { "Content-Type" => "application/x-www-form-urlencoded" }

    assert_response :unprocessable_entity
  end

  test "retry cannot access another session's conversation" do
    other_conversation = conversations(:other_session_chat)

    post retry_conversation_messages_path(other_conversation),
      headers: { "Content-Type" => "application/x-www-form-urlencoded" }

    assert_response :not_found
  end
end
