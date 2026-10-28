"""Backend-only configuration."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    frontend_origin: str = "http://127.0.0.1:3002"
    database_url: str
    ai_provider: str = "huggingface"
    hugging_face_token: str = ""
    hugging_face_model: str = "Qwen/Qwen3-4B-Instruct-2507"
    hugging_face_api_url: str = "https://router.huggingface.co/v1/chat/completions"
    ollama_model: str = "llama3.1:8b"
    ollama_api_url: str = "http://127.0.0.1:11434/api/chat"
    session_secret: str = "change-this-before-production"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
