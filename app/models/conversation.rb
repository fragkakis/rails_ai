class Conversation < ApplicationRecord
  MODELS = {
    "Gemini" => [
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" }
    ],
    "Mistral" => [
      { id: "mistral-large-latest", name: "Mistral Large" },
      { id: "mistral-small-latest", name: "Mistral Small" }
    ],
    "OpenAI" => [
      { id: "gpt-4o", name: "GPT-4o" },
      { id: "gpt-4o-mini", name: "GPT-4o Mini" }
    ]
  }.freeze

  FREE_PROVIDERS = %w[Gemini].freeze

  PROVIDER_CONFIG_KEYS = {
    "OpenAI" => :openai_api_key,
    "Mistral" => :mistral_api_key
  }.freeze

  has_many :messages, dependent: :destroy

  validates :model_id, presence: true

  scope :ordered, -> { order(updated_at: :desc) }
  scope :for_session, ->(sid) { where(session_id: sid) }

  def provider_name
    MODELS.each do |provider, models|
      return provider if models.any? { |m| m[:id] == model_id }
    end
    nil
  end

  def requires_api_key?
    !FREE_PROVIDERS.include?(provider_name)
  end
end
