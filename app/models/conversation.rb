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

  before_validation { self.uuid = SecureRandom.uuid if uuid.blank? }

  validates :model_id, presence: true
  validates :uuid, presence: true, uniqueness: true

  def to_param
    uuid
  end

  scope :ordered, -> { order(updated_at: :desc) }
  scope :for_session, ->(sid) { where(session_id: sid) }

  def provider_name
    MODELS.each do |provider, models|
      return provider if models.any? { |m| m[:id] == model_id }
    end
    nil
  end

  def requires_api_key?
    provider = provider_name
    return false if provider.nil?
    !FREE_PROVIDERS.include?(provider)
  end
end
