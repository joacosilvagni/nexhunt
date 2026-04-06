import logging
from fastapi import APIRouter
from pydantic import BaseModel
from nexhunt.services.copilot_service import copilot_service

router = APIRouter(prefix="/api/copilot", tags=["copilot"])
logger = logging.getLogger(__name__)


class ChatRequest(BaseModel):
    message: str
    context: dict = {}   # live recon data from the frontend stores


class AnalyzeRequest(BaseModel):
    context: dict = {}


class ReportRequest(BaseModel):
    finding_id: str | None = None
    context: dict = {}


@router.post("/chat")
async def chat(req: ChatRequest):
    """Chat with the AI. Context is merged with DB findings automatically."""
    try:
        response = await copilot_service.chat(req.message, req.context)
        return {"response": response}
    except Exception as e:
        logger.error(f"Copilot chat error: {e}")
        return {"response": f"Error: {e}"}


@router.post("/analyze")
async def analyze(req: AnalyzeRequest):
    """Full auto-analysis: AI reads ALL findings from DB + recon context and produces a full report."""
    try:
        # Merge DB data in the service — just pass live recon context from frontend
        response = await copilot_service.analyze_all()
        return {"response": response}
    except Exception as e:
        logger.error(f"Copilot analyze error: {e}")
        return {"response": f"Error: {e}"}


@router.post("/report")
async def generate_report(req: ReportRequest):
    """Generate professional bug bounty report(s)."""
    try:
        response = await copilot_service.generate_report(req.finding_id)
        return {"response": response}
    except Exception as e:
        logger.error(f"Copilot report error: {e}")
        return {"response": f"Error: {e}"}
