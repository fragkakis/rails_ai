import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["input"]

  send(event) {
    const content = this.inputTarget.value.trim()
    if (!content) {
      event.preventDefault()
    }
    // Otherwise, let the form submit normally to create a conversation with content
  }

  keydown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      this.element.requestSubmit()
    }
  }

  autoResize() {
    const el = this.inputTarget
    el.style.height = "auto"
    el.style.height = Math.min(el.scrollHeight, 192) + "px"
  }
}
