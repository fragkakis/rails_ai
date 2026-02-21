class Message < ApplicationRecord
  belongs_to :conversation, touch: true

  validates :role, inclusion: { in: %w[user assistant] }
end
