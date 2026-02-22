import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["messages", "input", "submit", "form", "model"]
  static values = { url: String }

  connect() {
    this.autoResize()
  }

  send(event) {
    event.preventDefault()

    const content = this.inputTarget.value.trim()
    if (!content) return

    if (this.requiresKeyWithout()) {
      this.openKeysPanel()
      return
    }

    this.inputTarget.value = ""
    this.inputTarget.style.height = "auto"
    this.submitTarget.disabled = true

    this.appendMessage("user", content)
    const contentEl = this.appendMessage("assistant", "")

    this.streamResponse(content, contentEl)
  }

  keydown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      this.formTarget.requestSubmit()
    }
  }

  autoResize() {
    const el = this.inputTarget
    el.style.height = "auto"
    el.style.height = Math.min(el.scrollHeight, 192) + "px"
  }

  appendMessage(role, content) {
    const row = document.createElement("div")
    row.className = "py-4"

    const container = document.createElement("div")
    container.className = "max-w-3xl mx-auto px-4 flex gap-4"

    if (role === "assistant") {
      const avatar = document.createElement("div")
      avatar.className = "w-7 h-7 rounded-full bg-black flex items-center justify-center shrink-0 mt-0.5"
      avatar.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="white" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-2h2v2zm0-4h-2V7h2v6zm4 4h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>'
      container.appendChild(avatar)
    }

    const messageDiv = document.createElement("div")
    if (role === "user") {
      messageDiv.className = "ml-auto bg-[#f4f4f4] rounded-2xl px-4 py-2.5 max-w-[85%]"
    } else {
      messageDiv.className = "flex-1 min-w-0"
    }

    const textDiv = document.createElement("div")
    textDiv.className = "text-base leading-7 text-gray-800 whitespace-pre-wrap"
    textDiv.textContent = content

    messageDiv.appendChild(textDiv)
    container.appendChild(messageDiv)
    row.appendChild(container)
    this.messagesTarget.appendChild(row)
    this.scrollToBottom()

    return textDiv
  }

  getSelectedProvider() {
    const option = this.modelTarget.selectedOptions[0]
    if (option && option.parentElement.tagName === "OPTGROUP") {
      return option.parentElement.label.replace(/\s*\(Free\)$/, "")
    }
    return null
  }

  getApiKey() {
    const provider = this.getSelectedProvider()
    if (!provider) return null
    const freeProviders = ["Gemini"]
    if (freeProviders.includes(provider)) return null
    return localStorage.getItem(`apiKey:${provider}`)
  }

  requiresKeyWithout() {
    const provider = this.getSelectedProvider()
    if (!provider) return false
    const freeProviders = ["Gemini"]
    if (freeProviders.includes(provider)) return false
    return !localStorage.getItem(`apiKey:${provider}`)
  }

  openKeysPanel() {
    const details = document.querySelector('[data-controller="api-keys"] details')
    if (details) details.open = true

    const provider = this.getSelectedProvider()
    const inputTarget = provider === "OpenAI" ? "openaiInput" : "mistralInput"
    const input = document.querySelector(`[data-api-keys-target="${inputTarget}"]`)
    if (input) input.focus()
  }

  async streamResponse(content, textEl) {
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content
    const apiKey = this.getApiKey()

    const headers = {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-CSRF-Token": csrfToken
    }
    if (apiKey) {
      headers["X-Api-Key"] = apiKey
    }

    try {
      const response = await fetch(this.urlValue, {
        method: "POST",
        headers,
        body: new URLSearchParams({ content })
      })

      // Handle non-SSE error responses (e.g. 422 for missing API key)
      if (!response.ok) {
        const data = await response.json()
        textEl.textContent = `Error: ${data.error || "Request failed"}`
        this.onDone()
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop()

        for (const line of lines) {
          if (line.startsWith("event: done")) {
            this.onDone()
            return
          }
          if (line.startsWith("event: error")) {
            continue
          }
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.content) {
                textEl.textContent += data.content
                this.scrollToBottom()
              }
              if (data.message) {
                textEl.textContent = `Error: ${data.message}`
                this.onDone()
                return
              }
            } catch (e) {
              // skip malformed JSON
            }
          }
        }
      }

      this.onDone()
    } catch (error) {
      textEl.textContent = `Error: ${error.message}`
      this.onDone()
    }
  }

  onDone() {
    this.submitTarget.disabled = false
    this.inputTarget.focus()
  }

  async changeModel() {
    if (this.requiresKeyWithout()) {
      this.openKeysPanel()
    }

    const modelId = this.modelTarget.value
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content
    const url = this.urlValue.replace(/\/messages$/, "")

    await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-CSRF-Token": csrfToken,
        "Accept": "text/vnd.turbo-stream.html"
      },
      body: new URLSearchParams({ model_id: modelId })
    })
  }

  scrollToBottom() {
    this.messagesTarget.scrollTop = this.messagesTarget.scrollHeight
  }
}
