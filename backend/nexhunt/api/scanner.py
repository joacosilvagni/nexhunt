import logging
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from nexhunt.database import get_session
from nexhunt.models.finding import Finding
from nexhunt.schemas.scanner import ScanRequest, FindingUpdate
from nexhunt.adapters.base import get_adapter
from nexhunt.ws.manager import ws_manager

router = APIRouter(prefix="/api/scanner", tags=["scanner"])
logger = logging.getLogger(__name__)


async def _run_scan_tool(tool_name: str, target: str, options: dict = {}):
    """Run a scanning tool and stream results via WebSocket."""
    adapter = get_adapter(tool_name)
    if not adapter:
        return {"error": f"Tool '{tool_name}' not found"}

    if not await adapter.check_installed():
        return {"error": f"Tool '{tool_name}' is not installed"}

    await ws_manager.broadcast("tool_status", {"tool": tool_name, "event": "started"})

    findings = []
    try:
        async for result in adapter.run(target, options):
            findings.append(result)
            await ws_manager.broadcast("findings", result)
    except Exception as e:
        logger.error(f"Error running {tool_name}: {e}")
        await ws_manager.broadcast("tool_status", {"tool": tool_name, "event": "failed", "error": str(e)})
        return {"error": str(e)}

    await ws_manager.broadcast("tool_status", {"tool": tool_name, "event": "completed", "count": len(findings)})
    return {"tool": tool_name, "findings": findings, "count": len(findings)}


@router.post("/nuclei")
async def run_nuclei(req: ScanRequest):
    return await _run_scan_tool("nuclei", req.target, req.options)


@router.post("/ffuf")
async def run_ffuf(req: ScanRequest):
    return await _run_scan_tool("ffuf", req.target, req.options)


@router.post("/nikto")
async def run_nikto(req: ScanRequest):
    return await _run_scan_tool("nikto", req.target, req.options)


@router.post("/gobuster")
async def run_gobuster(req: ScanRequest):
    return await _run_scan_tool("gobuster", req.target, req.options)


@router.post("/dirsearch")
async def run_dirsearch(req: ScanRequest):
    return await _run_scan_tool("dirsearch", req.target, req.options)


@router.get("/findings")
async def get_findings(session: AsyncSession = Depends(get_session)):
    """Get all findings."""
    result = await session.execute(select(Finding).order_by(Finding.created_at.desc()))
    findings = result.scalars().all()
    return [
        {
            "id": f.id,
            "title": f.title,
            "severity": f.severity,
            "vuln_type": f.vuln_type,
            "url": f.url,
            "parameter": f.parameter,
            "evidence": f.evidence,
            "tool": f.tool,
            "status": f.status,
            "notes": f.notes,
            "created_at": f.created_at.isoformat() if f.created_at else None
        }
        for f in findings
    ]


@router.put("/findings/{finding_id}")
async def update_finding(
    finding_id: str,
    data: FindingUpdate,
    session: AsyncSession = Depends(get_session)
):
    """Update a finding's status or notes."""
    result = await session.execute(select(Finding).where(Finding.id == finding_id))
    finding = result.scalar_one_or_none()
    if not finding:
        return {"error": "Finding not found"}

    if data.status:
        finding.status = data.status
    if data.notes is not None:
        finding.notes = data.notes

    await session.commit()
    return {"status": "updated"}
