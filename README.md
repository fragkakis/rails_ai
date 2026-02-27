# Rails AI Chat

A ChatGPT-style chat interface built with Rails 8 and the [ruby_llm](https://github.com/crmne/ruby_llm) gem. Supports multiple LLM providers with real-time streaming responses.

## Features

- **Real-time streaming** — Server-Sent Events (SSE) for token-by-token response streaming
- **Multiple LLM providers** — Gemini (free tier), OpenAI, and Mistral
- **Bring Your Own Key (BYOK)** — OpenAI and Mistral keys are stored in browser localStorage and sent per-request (never persisted server-side)
- **Session-based isolation** — Each browser session gets its own conversation history, no authentication required
- **Model switching** — Change models mid-conversation from the input area
- **Markdown rendering** — Assistant responses are rendered as rich markdown (headings, code blocks, lists, etc.)
- **Dark mode** — Automatic detection of system preference with dark/light theme support
- **Copy to clipboard** — One-click copying of assistant messages
- **Retry messages** — Regenerate the last assistant response
- **Abort streaming** — Cancel an in-progress response at any time
- **Async chat titles** — Conversation titles are generated automatically in the background
- **Mobile friendly** — Responsive master-detail layout

## Tech Stack

- Ruby 3.3, Rails 8, SQLite
- Hotwire (Turbo + Stimulus)
- Tailwind CSS v4
- Propshaft, importmap-rails

## Getting Started

### Prerequisites

- Ruby 3.3+
- A Gemini API key (free tier)

### Setup

```bash
git clone <repo-url>
cd rails_ai
bundle install
bin/rails db:setup
```

Create a `.env` file in the project root:

```
GEMINI_API_KEY=your_gemini_api_key_here
```

### Run

```bash
bin/dev
```

This starts the Rails server and Tailwind CSS watcher via foreman.

## Architecture

- **Master-detail layout** — Sidebar with conversation list + main chat area, both always visible
- **SSE streaming** — `MessagesController#create` uses `ActionController::Live` to stream LLM responses. The client reads via `fetch` + `ReadableStream` (not EventSource) to allow POST requests
- **Stimulus controllers** — `chat_controller.js` handles streaming and model switching; `api_keys_controller.js` manages BYOK key storage
- **Session isolation** — Conversations scoped by `session[:visitor_id]`, assigned in `ApplicationController`

## Acknowledgements

This software was made possible using open source software, so credits to the contributors of all the libraries in the [Gemfile](https://github.com/fragkakis/railschat/blob/main/Gemfile). Special thanks to the contributors of [Ruby on Rails](https://rubyonrails.org/), [Kamal](https://kamal-deploy.org/) and [Ruby LLM](https://rubyllm.com/).
