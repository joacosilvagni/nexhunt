from fastapi import APIRouter
from pydantic import BaseModel
from nexhunt.config import settings

router = APIRouter(prefix="/api/settings", tags=["settings"])


class SettingsUpdate(BaseModel):
    proxy_port: int | None = None
    ai_provider: str | None = None
    ai_model: str | None = None
    ai_groq_key: str | None = None
    ai_api_key: str | None = None   # Claude / OpenAI fallback


@router.get("")
async def get_settings():
    return {
        "proxy_port": settings.proxy_port,
        "ai_provider": settings.ai_provider,
        "ai_model": settings.ai_model,
        "ai_groq_key_set": bool(settings.ai_groq_key),
        "ai_groq_key": settings.ai_groq_key,   # returned so UI can pre-fill
        "ai_api_key_set": bool(settings.ai_api_key),
    }


@router.post("")
async def update_settings(data: SettingsUpdate):
    if data.proxy_port is not None:
        settings.proxy_port = data.proxy_port
    if data.ai_provider is not None:
        settings.ai_provider = data.ai_provider
    if data.ai_model is not None:
        settings.ai_model = data.ai_model
    if data.ai_groq_key is not None:
        settings.ai_groq_key = data.ai_groq_key
    if data.ai_api_key is not None:
        settings.ai_api_key = data.ai_api_key
    return {"status": "updated"}
