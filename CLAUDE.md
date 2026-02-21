# Rails AI Chat

ChatGPT clone built on Rails 8 with ruby_llm gem. Single-user, no auth.

## Architecture

- **Master-detail layout**: Sidebar (conversation list) + main area (chat). Both always visible. `ConversationsController#show` renders the `index` template with `@conversation` set.
- **SSE streaming**: `MessagesController#create` uses `ActionController::Live` to stream LLM responses as SSE events. The client reads via `fetch` + `ReadableStream` (not EventSource) to allow POST.
- **Stimulus**: `chat_controller.js` handles form submission, SSE parsing, and DOM updates for streaming messages.

## Key Files

- `app/models/conversation.rb` — `MODELS` constant defines available LLM models (Mistral, OpenAI)
- `app/controllers/messages_controller.rb` — SSE streaming endpoint
- `app/javascript/controllers/chat_controller.js` — Client-side streaming
- `config/initializers/ruby_llm.rb` — LLM API key configuration

## ruby_llm Usage

- `RubyLLM.chat(model: model_id)` to create a chat
- `chat.add_message(role: :user/:assistant, content: ...)` to load history
- `chat.ask(content) { |chunk| chunk.content }` to stream responses
- Do NOT use `with_history` — it doesn't exist. Use `add_message` in a loop.

## Stack

- Rails 8, Ruby 3.3, SQLite, Propshaft, importmap-rails
- Tailwind CSS v4 (via tailwindcss-rails gem, builds from `app/assets/tailwind/application.css`)
- Hotwire (Turbo + Stimulus)
- ruby_llm gem for LLM integration

## Environment Variables

- `SPR_AI_OPENAI_API_KEY` — OpenAI API key (note: custom env var name)
- `MISTRAL_API_KEY` — Mistral API key
- Set in `.env` file (loaded by foreman via `bin/dev`)

## Commands

- `bin/dev` — Start app (Rails + Tailwind watcher via foreman)
- `bin/rails tailwindcss:build` — One-off Tailwind build
