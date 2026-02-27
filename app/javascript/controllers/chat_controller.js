import { Controller } from "@hotwired/stimulus"
import { marked } from "marked"
import DOMPurify from "dompurify"

marked.setOptions({
  breaks: true,
  gfm: true,
  highlight: null
})

function balanceCodeFences(text) {
  const lines = text.split('\n')
  const fenceRegex = /^(`{3,})(.*)$/

  // Identify all fence marker lines
  const markers = []
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(fenceRegex)
    if (m) {
      markers.push({
        index: i,
        len: m[1].length,
        suffix: m[2],
        isBare: m[2].trim() === ''
      })
    }
  }

  // Pair fences using a stack (simulating intended nesting)
  const stack = []
  const pairs = []
  for (const fm of markers) {
    if (stack.length > 0 && fm.isBare && fm.len >= stack[stack.length - 1].len) {
      pairs.push({ open: stack.pop(), close: fm })
    } else {
      stack.push(fm)
    }
  }

  // Close any remaining unclosed fences (handles streaming)
  while (stack.length > 0) {
    const opener = stack.pop()
    const closeIndex = lines.length
    lines.push('`'.repeat(opener.len))
    pairs.push({
      open: opener,
      close: { index: closeIndex, len: opener.len, suffix: '', isBare: true }
    })
  }

  // Fix nested pairs by increasing outer fence backtick counts
  let changed = true
  while (changed) {
    changed = false
    for (const outer of pairs) {
      let maxInnerLen = 0
      for (const inner of pairs) {
        if (inner !== outer &&
            inner.open.index > outer.open.index &&
            inner.close.index < outer.close.index) {
          maxInnerLen = Math.max(maxInnerLen, inner.open.len, inner.close.len)
        }
      }
      if (maxInnerLen > 0 && outer.open.len <= maxInnerLen) {
        const newLen = maxInnerLen + 1
        const newBackticks = '`'.repeat(newLen)
        lines[outer.open.index] = newBackticks + outer.open.suffix
        lines[outer.close.index] = newBackticks
        outer.open.len = newLen
        outer.close.len = newLen
        changed = true
      }
    }
  }

  return lines.join('\n')
}

function stripOuterMarkdownFence(text) {
  const match = text.match(/^([\s\S]*?\n?)```(?:markdown|md)\n([\s\S]*)$/)
  if (match) {
    const before = match[1].trim()
    let inner = match[2]
    inner = inner.replace(/\n```\s*$/, '')
    return before ? before + '\n\n' + inner : inner
  }
  return text
}

function renderMarkdown(text) {
  const raw = marked.parse(balanceCodeFences(stripOuterMarkdownFence(text)))
  return DOMPurify.sanitize(raw)
}

export default class extends Controller {
  static targets = ["messages", "input", "submit", "form", "model", "stop"]
  static values = { url: String, retryUrl: String, generateTitleUrl: String, conversationUuid: String }

  connect() {
    this.autoResize()
    this.renderExistingMessages()
    this.updateRetryButtonVisibility()
    this.sendInitialContent()
  }

  renderExistingMessages() {
    this.messagesTarget.querySelectorAll('[data-role="assistant"]').forEach(el => {
      const raw = el.textContent
      if (raw.trim()) {
        el.innerHTML = renderMarkdown(raw)
      }
    })
  }

  sendInitialContent() {
    const url = new URL(window.location)
    const content = url.searchParams.get("content")
    if (!content) return

    // Clean up the URL
    url.searchParams.delete("content")
    window.history.replaceState({}, "", url)

    this.updateRetryButtonVisibility(true)
    this.appendMessage("user", content)
    const contentEl = this.appendMessage("assistant", "")
    this.submitTarget.disabled = true
    this.submitTarget.classList.add("hidden")
    this.stopTarget.classList.remove("hidden")
    this.maybeGenerateTitle(content)
    this.streamResponse(content, contentEl)
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
    this.submitTarget.classList.add("hidden")
    this.stopTarget.classList.remove("hidden")

    this.updateRetryButtonVisibility(true)
    this.appendMessage("user", content)
    const contentEl = this.appendMessage("assistant", "")

    this.maybeGenerateTitle(content)
    this.streamResponse(content, contentEl)
  }

  retry(event) {
    if (this.abortController) return

    if (this.requiresKeyWithout()) {
      this.openKeysPanel()
      return
    }

    // Find the last assistant message row and its content element
    const allAssistantEls = this.messagesTarget.querySelectorAll('[data-role="assistant"]')
    if (allAssistantEls.length === 0) return

    const lastAssistantEl = allAssistantEls[allAssistantEls.length - 1]
    lastAssistantEl.innerHTML = ""

    // Hide retry button, show stop button
    this.updateRetryButtonVisibility(true)
    this.submitTarget.disabled = true
    this.submitTarget.classList.add("hidden")
    this.stopTarget.classList.remove("hidden")

    this.streamResponse(null, lastAssistantEl, { isRetry: true })
  }

  async copy(event) {
    const btn = event.currentTarget
    const messageDiv = btn.closest(".flex-1")?.querySelector('[data-role="assistant"]')
    if (!messageDiv) return

    const text = messageDiv.innerText
    await navigator.clipboard.writeText(text)

    const originalHTML = btn.innerHTML
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
    setTimeout(() => { btn.innerHTML = originalHTML }, 2000)
  }

  stop() {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
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
    container.className = "max-w-3xl mx-auto px-3 md:px-4 flex gap-3 md:gap-4"

    if (role === "assistant") {
      const avatar = document.createElement("div")
      avatar.className = "w-7 h-7 rounded-full bg-black flex items-center justify-center shrink-0 mt-0.5"
      avatar.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="white" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-2h2v2zm0-4h-2V7h2v6zm4 4h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>'
      container.appendChild(avatar)
    }

    const messageDiv = document.createElement("div")
    if (role === "user") {
      messageDiv.className = "ml-auto bg-[#f4f4f4] dark:bg-gray-700 rounded-2xl px-4 py-2.5 max-w-[85%]"
    } else {
      messageDiv.className = "flex-1 min-w-0"
    }

    const textDiv = document.createElement("div")
    textDiv.setAttribute("data-role", role)
    if (role === "user") {
      textDiv.className = "text-base leading-7 text-gray-800 dark:text-gray-100 whitespace-pre-wrap"
      textDiv.textContent = content
    } else {
      textDiv.className = "text-base leading-7 text-gray-800 dark:text-gray-100 markdown-body"
      if (content) {
        textDiv.innerHTML = renderMarkdown(content)
      }
    }

    messageDiv.appendChild(textDiv)

    if (role === "assistant") {
      const btnGroup = document.createElement("div")
      btnGroup.className = "flex gap-1 mt-1"

      const copyBtn = document.createElement("button")
      copyBtn.setAttribute("data-copy-button", "")
      copyBtn.setAttribute("data-action", "click->chat#copy")
      copyBtn.className = "hidden text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition"
      copyBtn.title = "Copy to clipboard"
      copyBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
      btnGroup.appendChild(copyBtn)

      const retryBtn = document.createElement("button")
      retryBtn.setAttribute("data-retry-button", "")
      retryBtn.setAttribute("data-action", "click->chat#retry")
      retryBtn.className = "hidden text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition"
      retryBtn.title = "Regenerate response"
      retryBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M1 4v6h6M23 20v-6h-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      btnGroup.appendChild(retryBtn)

      messageDiv.appendChild(btnGroup)
    }

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
    requestAnimationFrame(() => {
      const input = document.querySelector(`[data-api-keys-target="${inputTarget}"]`)
      if (input) {
        input.scrollIntoView({ behavior: "smooth", block: "center" })
        input.focus()
      }
    })
  }

  async streamResponse(content, textEl, options = {}) {
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content
    const apiKey = this.getApiKey()

    const headers = {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-CSRF-Token": csrfToken
    }
    if (apiKey) {
      headers["X-Api-Key"] = apiKey
    }

    let rawMarkdown = ""

    this.abortController = new AbortController()

    const url = options.isRetry ? this.retryUrlValue : this.urlValue
    const body = options.isRetry ? "" : new URLSearchParams({ content })

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body,
        signal: this.abortController.signal
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
                rawMarkdown += data.content
                textEl.innerHTML = renderMarkdown(rawMarkdown)
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
      if (error.name === "AbortError") {
        this.onDone()
        return
      }
      textEl.textContent = `Error: ${error.message}`
      this.onDone()
    }
  }

  onDone() {
    this.submitTarget.disabled = false
    this.submitTarget.classList.remove("hidden")
    this.stopTarget.classList.add("hidden")
    this.abortController = null
    this.inputTarget.focus()
    this.updateRetryButtonVisibility()
  }

  updateRetryButtonVisibility(hideAll = false) {
    const retryButtons = this.messagesTarget.querySelectorAll("[data-retry-button]")
    retryButtons.forEach(btn => btn.classList.add("hidden"))

    const copyButtons = this.messagesTarget.querySelectorAll("[data-copy-button]")

    if (hideAll) {
      copyButtons.forEach(btn => btn.classList.add("hidden"))
    } else {
      copyButtons.forEach(btn => btn.classList.remove("hidden"))
      if (retryButtons.length > 0) {
        retryButtons[retryButtons.length - 1].classList.remove("hidden")
      }
    }
  }

  maybeGenerateTitle(content) {
    if (!this.hasGenerateTitleUrlValue || !this.generateTitleUrlValue) return

    const url = this.generateTitleUrlValue
    // Clear the value so it only fires once
    this.generateTitleUrlValue = ""

    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content

    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-CSRF-Token": csrfToken
      },
      body: new URLSearchParams({ content })
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!data?.title) return

        // Update sidebar link
        const sidebarLink = document.querySelector(`[data-conversation-id="${this.conversationUuidValue}"]`)
        if (sidebarLink) sidebarLink.textContent = data.title

        // Update mobile header
        const mobileTitle = document.querySelector("[data-mobile-title]")
        if (mobileTitle) mobileTitle.textContent = data.title
      })
      .catch(() => {
        // Title generation failed silently — truncated fallback remains
      })
  }

  changeModel(event) {
    event.stopPropagation()

    if (this.requiresKeyWithout()) {
      this.openKeysPanel()
      return
    }

    const modelId = this.modelTarget.value
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content
    const conversationUuid = this.conversationUuidValue

    fetch(`/conversations/${conversationUuid}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-CSRF-Token": csrfToken,
        "Accept": "application/json"
      },
      body: new URLSearchParams({ model_id: modelId })
    })
  }

  scrollToBottom() {
    this.messagesTarget.scrollTop = this.messagesTarget.scrollHeight
  }
}
