import logging
from fastapi import APIRouter
from pydantic import BaseModel
from nexhunt.services.copilot_service import copilot_service

router = APIRouter(prefix="/api/copilot", tags=["copilot"])
logger = logging.getLogger(__name__)


class ChatRequest(BaseModel):
    message: str
    context: dict = {}


@router.post("/chat")
async def chat(req: ChatRequest):
    """Send a message to the AI copilot."""
    try:
        response = await copilot_service.chat(req.message, req.context)
        return {"response": response}
    except Exception as e:
        logger.error(f"Copilot error: {e}")
        return {"response": f"Error: {e}\n\nMake sure your API key is configured in Settings."}
