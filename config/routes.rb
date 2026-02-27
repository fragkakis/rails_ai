Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check
  get "about" => "about#show"

  root "conversations#index"

  resources :conversations, only: [ :show, :create, :destroy, :update ] do
    resources :messages, only: [ :create ] do
      collection do
        post :retry
      end
    end
  end
end
