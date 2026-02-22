class ApplicationController < ActionController::Base
  # Only allow modern browsers supporting webp images, web push, badges, import maps, CSS nesting, and CSS :has.
  allow_browser versions: :modern

  before_action :ensure_session_id

  private

  def ensure_session_id
    session[:visitor_id] ||= SecureRandom.hex(16)
  end

  def current_session_id
    session[:visitor_id]
  end
  helper_method :current_session_id
end
