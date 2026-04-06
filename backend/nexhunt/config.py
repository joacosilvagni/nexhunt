import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Server
    host: str = "127.0.0.1"
    port: int = int(os.environ.get("NEXHUNT_PORT", "17707"))

    # Proxy
    proxy_host: str = "127.0.0.1"
    proxy_port: int = 8080

    # Database
    db_dir: str = os.path.expanduser("~/.nexhunt")

    # AI — Groq (primary, cheap + fast)
    ai_provider: str = "groq"
    ai_model: str = "llama-3.3-70b-versatile"
    ai_groq_key: str = ""

    # AI — fallbacks
    ai_api_key: str = ""           # Anthropic / OpenAI key

    # Screenshots
    screenshots_dir: str = os.path.expanduser("~/.nexhunt/screenshots")

    class Config:
        env_prefix = "NEXHUNT_"


settings = Settings()

# Ensure data directories exist
os.makedirs(settings.db_dir, exist_ok=True)
os.makedirs(os.path.join(settings.db_dir, "projects"), exist_ok=True)
os.makedirs(settings.screenshots_dir, exist_ok=True)
