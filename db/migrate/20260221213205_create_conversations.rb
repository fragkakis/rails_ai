class CreateConversations < ActiveRecord::Migration[8.0]
  def change
    create_table :conversations do |t|
      t.string :title
      t.string :model_id, null: false

      t.timestamps
    end
  end
end
