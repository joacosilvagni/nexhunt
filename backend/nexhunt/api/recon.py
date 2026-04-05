import asyncio
import logging
from fastapi import APIRouter
from nexhunt.schemas.recon import ReconRequest
from nexhunt.adapters.base import get_adapter
from nexhunt.ws.manager import ws_manager

router = APIRouter(prefix="/api/recon", tags=["recon"])
logger = logging.getLogger(__name__)


async def _run_recon_tool(tool_name: str, target: str, options: dict = {}):
    """Run a recon tool and stream results via WebSocket."""
    adapter = get_adapter(tool_name)
    if not adapter:
        return {"error": f"Tool '{tool_name}' not found"}

    if not await adapter.check_installed():
        return {"error": f"Tool '{tool_name}' is not installed"}

    results = []
    try:
        async for result in adapter.run(target, options):
            results.append(result)
            await ws_manager.broadcast("recon_results", {
                "tool": tool_name,
                "type": adapter.result_type,
                "results": [result]
            })
    except Exception as e:
        logger.error(f"Error running {tool_name}: {e}")
        return {"error": str(e)}

    await ws_manager.broadcast("tool_status", {
        "tool": tool_name,
        "event": "completed",
        "result_count": len(results)
    })

    return {"tool": tool_name, "results": results, "count": len(results)}


@router.post("/subfinder")
async def run_subfinder(req: ReconRequest):
    return await _run_recon_tool("subfinder", req.target, req.options)


@router.post("/amass")
async def run_amass(req: ReconRequest):
    return await _run_recon_tool("amass", req.target, req.options)


@router.post("/httpx")
async def run_httpx(req: ReconRequest):
    return await _run_recon_tool("httpx", req.target, req.options)


@router.post("/nmap")
async def run_nmap(req: ReconRequest):
    return await _run_recon_tool("nmap", req.target, req.options)


@router.post("/waybackurls")
async def run_waybackurls(req: ReconRequest):
    return await _run_recon_tool("waybackurls", req.target, req.options)


@router.post("/gau")
async def run_gau(req: ReconRequest):
    return await _run_recon_tool("gau", req.target, req.options)


@router.post("/katana")
async def run_katana(req: ReconRequest):
    return await _run_recon_tool("katana", req.target, req.options)


@router.post("/paramspider")
async def run_paramspider(req: ReconRequest):
    return await _run_recon_tool("paramspider", req.target, req.options)


@router.post("/arjun")
async def run_arjun(req: ReconRequest):
    return await _run_recon_tool("arjun", req.target, req.options)


@router.post("/full")
async def run_full_recon(req: ReconRequest):
    """Run a full recon workflow: subdomains -> httpx -> urls."""
    await ws_manager.broadcast("tool_status", {"tool": "full_recon", "event": "started"})

    # Step 1: Subdomain enumeration
    sub_result = await _run_recon_tool("subfinder", req.target)
    subdomains = [r.get("subdomain", "") for r in sub_result.get("results", [])]

    # Step 2: HTTP probing on found subdomains
    if subdomains:
        for sub in subdomains[:50]:  # Limit to first 50
            await _run_recon_tool("httpx", sub)

    # Step 3: URL discovery
    await _run_recon_tool("waybackurls", req.target)
    await _run_recon_tool("gau", req.target)

    await ws_manager.broadcast("tool_status", {"tool": "full_recon", "event": "completed"})
    return {"status": "completed", "subdomains_found": len(subdomains)}
