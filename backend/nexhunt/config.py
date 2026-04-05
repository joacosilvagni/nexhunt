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

    # AI
    ai_provider: str = "claude"  # "claude" or "openai"
    ai_api_key: str = ""
    ai_model: str = "claude-sonnet-4-20250514"

    class Config:
        env_prefix = "NEXHUNT_"


settings = Settings()

# Ensure data directory exists
os.makedirs(settings.db_dir, exist_ok=True)
os.makedirs(os.path.join(settings.db_dir, "projects"), exist_ok=True)
