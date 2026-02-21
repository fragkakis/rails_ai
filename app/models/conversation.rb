class Conversation < ApplicationRecord
  MODELS = {
    "Mistral" => [
      { id: "mistral-large-latest", name: "Mistral Large" },
      { id: "mistral-small-latest", name: "Mistral Small" }
    ],
    "OpenAI" => [
      { id: "gpt-4o", name: "GPT-4o" },
      { id: "gpt-4o-mini", name: "GPT-4o Mini" }
    ]
  }.freeze

  has_many :messages, dependent: :destroy

  validates :model_id, presence: true

  scope :ordered, -> { order(updated_at: :desc) }
end
