import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["openaiInput", "mistralInput", "openaiStatus", "mistralStatus"]

  connect() {
    this.loadKeys()
  }

  loadKeys() {
    const openaiKey = localStorage.getItem("apiKey:OpenAI")
    const mistralKey = localStorage.getItem("apiKey:Mistral")

    if (openaiKey) this.openaiInputTarget.value = openaiKey
    if (mistralKey) this.mistralInputTarget.value = mistralKey

    this.updateStatus("openai", !!openaiKey)
    this.updateStatus("mistral", !!mistralKey)
  }

  saveOpenai() {
    const key = this.openaiInputTarget.value.trim()
    if (key) {
      localStorage.setItem("apiKey:OpenAI", key)
      this.updateStatus("openai", true)
    }
  }

  clearOpenai() {
    localStorage.removeItem("apiKey:OpenAI")
    this.openaiInputTarget.value = ""
    this.updateStatus("openai", false)
  }

  saveMistral() {
    const key = this.mistralInputTarget.value.trim()
    if (key) {
      localStorage.setItem("apiKey:Mistral", key)
      this.updateStatus("mistral", true)
    }
  }

  clearMistral() {
    localStorage.removeItem("apiKey:Mistral")
    this.mistralInputTarget.value = ""
    this.updateStatus("mistral", false)
  }

  updateStatus(provider, isSet) {
    const target = provider === "openai" ? this.openaiStatusTarget : this.mistralStatusTarget
    if (isSet) {
      target.textContent = "Key set"
      target.className = "text-xs text-green-600 font-medium"
    } else {
      target.textContent = "Not set"
      target.className = "text-xs text-gray-400"
    }
  }
}
