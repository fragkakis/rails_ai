# Rails AI Chat

ChatGPT clone built on Rails 8 with ruby_llm gem. Multi-user via session isolation, no auth.

## Architecture

- **Master-detail layout**: Sidebar (conversation list) + main area (chat). Both always visible. `ConversationsController#show` renders the `index` template with `@conversation` set.
- **SSE streaming**: `MessagesController#create` uses `ActionController::Live` to stream LLM responses as SSE events. The client reads via `fetch` + `ReadableStream` (not EventSource) to allow POST.
- **Stimulus**: `chat_controller.js` handles form submission, SSE parsing, DOM updates for streaming messages, and model switching. `api_keys_controller.js` manages BYOK key storage in localStorage.
- **Model selector**: Embedded in the message input area (below textarea, left side). Uses a `<select>` directly in the chat form (no nested form). Model changes are sent via `chat#changeModel` Stimulus action as a PATCH to `ConversationsController#update`. The input area bottom bar uses inline styles for flex layout (Tailwind v4 flex utilities had issues in this context).
- **Hybrid deployment (Free + BYOK)**: Gemini models use a server-side API key (free tier). OpenAI/Mistral require users to bring their own API keys (stored in browser localStorage, sent per-request via `X-Api-Key` header, never persisted server-side).
- **Session isolation**: Each browser session gets a unique `session[:visitor_id]`. Conversations are scoped to the session via `session_id` column. Different browsers/incognito windows see separate conversation lists.

## Key Files

- `app/models/conversation.rb` — `MODELS` constant defines available LLM models (Gemini, Mistral, OpenAI). `FREE_PROVIDERS`, `PROVIDER_CONFIG_KEYS`, `provider_name`, `requires_api_key?` for BYOK logic.
- `app/controllers/application_controller.rb` — Session ID assignment (`ensure_session_id`, `current_session_id`)
- `app/controllers/conversations_controller.rb` — CRUD + model switching, all queries scoped by session
- `app/controllers/messages_controller.rb` — SSE streaming endpoint, BYOK key handling via `X-Api-Key` header and `RubyLLM.context`
- `app/javascript/controllers/chat_controller.js` — Client-side streaming, model switching, input auto-resize, sends API key from localStorage
- `app/javascript/controllers/api_keys_controller.js` — localStorage key management UI (save/clear/status per provider)
- `app/views/conversations/index.html.erb` — Main layout (sidebar + chat + input area with model selector + API keys panel)
- `config/initializers/ruby_llm.rb` — Gemini-only server-side LLM config

## ruby_llm Usage

- `RubyLLM.chat(model: model_id)` to create a chat (uses global config, for free providers)
- `RubyLLM.context { |c| c.openai_api_key = key }.chat(model:)` for BYOK providers (per-request config override)
- `chat.add_message(role: :user/:assistant, content: ...)` to load history
- `chat.ask(content) { |chunk| chunk.content }` to stream responses
- Do NOT use `with_history` — it doesn't exist. Use `add_message` in a loop.

## Stack

- Rails 8, Ruby 3.3, SQLite, Propshaft, importmap-rails
- Tailwind CSS v4 (via tailwindcss-rails gem, builds from `app/assets/tailwind/application.css`)
- Hotwire (Turbo + Stimulus)
- ruby_llm gem for LLM integration

## Gotchas

- **Tailwind v4 flex utilities**: Some flex utility combos (e.g. `flex justify-between` on inner divs) don't always apply correctly in this setup. Use inline styles as a workaround when Tailwind classes aren't working.
- **No nested forms**: HTML doesn't allow `<form>` inside `<form>`. When adding controls inside the chat input form, use Stimulus actions + `fetch()` instead of nested `form_with` helpers.
- **API keys in headers**: BYOK keys are sent via `X-Api-Key` header. They are filtered from Rails logs via `config.filter_parameters`. Keys never touch the database.

## Environment Variables

- `GEMINI_API_KEY` — Gemini API key (server-side, free tier)
- Set in `.env` file (loaded by foreman via `bin/dev`)

## Commands

- `bin/dev` — Start app (Rails + Tailwind watcher via foreman)
- `bin/rails tailwindcss:build` — One-off Tailwind build
