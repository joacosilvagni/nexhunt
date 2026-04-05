from fastapi import APIRouter
from pydantic import BaseModel
from nexhunt.config import settings

router = APIRouter(prefix="/api/settings", tags=["settings"])


class SettingsUpdate(BaseModel):
    proxy_port: int | None = None
    ai_api_key: str | None = None
    ai_provider: str | None = None


@router.get("")
async def get_settings():
    """Get current settings."""
    return {
        "proxy_port": settings.proxy_port,
        "ai_provider": settings.ai_provider,
        "ai_api_key_set": bool(settings.ai_api_key),
    }


@router.post("")
async def update_settings(data: SettingsUpdate):
    """Update settings."""
    if data.proxy_port is not None:
        settings.proxy_port = data.proxy_port
    if data.ai_api_key is not None:
        settings.ai_api_key = data.ai_api_key
    if data.ai_provider is not None:
        settings.ai_provider = data.ai_provider
    return {"status": "updated"}
