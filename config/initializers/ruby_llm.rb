RubyLLM.configure do |config|
  config.openai_api_key = ENV["SPR_AI_OPENAI_API_KEY"]
  config.mistral_api_key = ENV["MISTRAL_API_KEY"]
end
