import asyncio
import uuid
import logging
from fastapi import APIRouter
from nexhunt.schemas.recon import ReconRequest, HttpxProbeRequest
from nexhunt.adapters.base import get_adapter
from nexhunt.ws.manager import ws_manager

router = APIRouter(prefix="/api/recon", tags=["recon"])
logger = logging.getLogger(__name__)

# ── Screenshot endpoints ────────────────────────────────────────────────────────

from pydantic import BaseModel as _BaseModel

class ScreenshotRequest(_BaseModel):
    url: str

class BulkScreenshotRequest(_BaseModel):
    urls: list[str]


@router.post("/screenshot")
async def take_screenshot(req: ScreenshotRequest):
    """Take a single screenshot of a URL using gowitness."""
    from nexhunt.config import settings as _settings
    job_id = str(uuid.uuid4())
    task = asyncio.create_task(_run_screenshot(job_id, req.url, _settings.screenshots_dir))
    _RECON_JOBS[job_id] = task
    return {"status": "started", "job_id": job_id, "url": req.url}


@router.post("/screenshots-bulk")
async def take_screenshots_bulk(req: BulkScreenshotRequest):
    """Take screenshots of multiple URLs."""
    from nexhunt.config import settings as _settings
    if not req.urls:
        return {"error": "No URLs provided"}
    job_id = str(uuid.uuid4())
    task = asyncio.create_task(_run_screenshots_bulk(job_id, req.urls, _settings.screenshots_dir))
    _RECON_JOBS[job_id] = task
    return {"status": "started", "job_id": job_id, "total": len(req.urls)}


@router.get("/screenshots")
async def list_screenshots():
    """List all taken screenshots."""
    import glob as _glob
    from nexhunt.config import settings as _settings
    files = sorted(
        _glob.glob(f"{_settings.screenshots_dir}/*.jpeg") +
        _glob.glob(f"{_settings.screenshots_dir}/*.jpg") +
        _glob.glob(f"{_settings.screenshots_dir}/*.png"),
        key=lambda f: __import__("os").path.getmtime(f),
        reverse=True,
    )
    return [
        {
            "filename": __import__("os").path.basename(f),
            "url": f"/screenshots/{__import__('os').path.basename(f)}",
            "size": __import__("os").path.getsize(f),
            "mtime": __import__("os").path.getmtime(f),
        }
        for f in files
    ]


async def _run_screenshot(job_id: str, url: str, screenshots_dir: str):
    from nexhunt.adapters.gowitness import GowitnessAdapter
    adapter = GowitnessAdapter()
    if not await adapter.check_installed():
        await ws_manager.broadcast("tool_status", {"tool": "gowitness", "event": "failed", "error": "gowitness not installed"})
        return
    await ws_manager.broadcast("tool_status", {"tool": "gowitness", "event": "started", "job_id": job_id})
    async for result in adapter.run(url, {"screenshots_dir": screenshots_dir}):
        if result.get("_raw"):
            await ws_manager.broadcast("tool_output", {"tool": "gowitness", "line": result["line"]})
        else:
            await ws_manager.broadcast("recon_results", {"tool": "gowitness", "type": "screenshot", "results": [result]})
    await ws_manager.broadcast("tool_status", {"tool": "gowitness", "event": "completed", "job_id": job_id})
    _RECON_JOBS.pop(job_id, None)


async def _run_screenshots_bulk(job_id: str, urls: list[str], screenshots_dir: str):
    from nexhunt.adapters.gowitness import GowitnessAdapter
    adapter = GowitnessAdapter()
    if not await adapter.check_installed():
        await ws_manager.broadcast("tool_status", {"tool": "gowitness", "event": "failed", "error": "gowitness not installed"})
        return
    await ws_manager.broadcast("tool_status", {"tool": "gowitness", "event": "started", "job_id": job_id, "total": len(urls)})
    done = 0
    for url in urls:
        async for result in adapter.run(url, {"screenshots_dir": screenshots_dir}):
            if result.get("_raw"):
                await ws_manager.broadcast("tool_output", {"tool": "gowitness", "line": result["line"]})
            else:
                await ws_manager.broadcast("recon_results", {"tool": "gowitness", "type": "screenshot", "results": [result]})
        done += 1
        await ws_manager.broadcast("tool_status", {"tool": "gowitness", "event": "progress", "done": done, "total": len(urls)})
    await ws_manager.broadcast("tool_status", {"tool": "gowitness", "event": "completed", "job_id": job_id, "total": done})
    _RECON_JOBS.pop(job_id, None)

# Background job registry
_RECON_JOBS: dict[str, asyncio.Task] = {}


async def _run_recon_background(job_id: str, tool_name: str, target: str, options: dict):
    """Run a recon tool in a background task, independent of HTTP connection lifecycle."""
    adapter = get_adapter(tool_name)
    if not adapter:
        await ws_manager.broadcast("tool_status", {
            "tool": tool_name, "event": "failed", "job_id": job_id,
            "error": f"Adapter for '{tool_name}' not found",
        })
        return

    if not await adapter.check_installed():
        await ws_manager.broadcast("tool_status", {
            "tool": tool_name, "event": "failed", "job_id": job_id,
            "error": f"'{tool_name}' is not installed",
        })
        return

    await ws_manager.broadcast("tool_status", {
        "tool": tool_name, "event": "started", "job_id": job_id,
    })

    results = []
    try:
        async for result in adapter.run(target, options):
            if result.get("_raw"):
                await ws_manager.broadcast("tool_output", {
                    "tool": tool_name, "line": result["line"],
                })
                continue
            results.append(result)
            await ws_manager.broadcast("recon_results", {
                "tool": tool_name,
                "type": adapter.result_type,
                "results": [result],
            })
    except asyncio.CancelledError:
        logger.info(f"Recon job {job_id} ({tool_name}) was cancelled")
        await ws_manager.broadcast("tool_status", {
            "tool": tool_name, "event": "cancelled", "job_id": job_id,
        })
        return
    except Exception as e:
        logger.error(f"Recon error [{tool_name}]: {e}")
        await ws_manager.broadcast("tool_status", {
            "tool": tool_name, "event": "failed", "job_id": job_id, "error": str(e),
        })
        return
    finally:
        _RECON_JOBS.pop(job_id, None)

    await ws_manager.broadcast("tool_status", {
        "tool": tool_name, "event": "completed", "job_id": job_id, "result_count": len(results),
    })
    logger.info(f"[{tool_name}] completed — {len(results)} results")


def _start_recon(tool_name: str, target: str, options: dict) -> dict:
    job_id = str(uuid.uuid4())
    task = asyncio.create_task(
        _run_recon_background(job_id, tool_name, target, options)
    )
    _RECON_JOBS[job_id] = task
    return {"status": "started", "job_id": job_id, "tool": tool_name, "target": target}


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/subfinder")
async def run_subfinder(req: ReconRequest):
    return _start_recon("subfinder", req.target, req.options)


@router.post("/amass")
async def run_amass(req: ReconRequest):
    return _start_recon("amass", req.target, req.options)


@router.post("/httpx")
async def run_httpx(req: ReconRequest):
    return _start_recon("httpx", req.target, req.options)


@router.post("/httpx-probe")
async def run_httpx_probe(req: HttpxProbeRequest):
    """Probe a list of discovered subdomains with httpx to find live hosts."""
    if not req.targets:
        return {"error": "No targets provided"}

    job_id = str(uuid.uuid4())
    options = {**req.options, "targets": req.targets}

    async def _probe_background():
        adapter = get_adapter("httpx")
        if not adapter or not await adapter.check_installed():
            await ws_manager.broadcast("tool_status", {"tool": "httpx-probe", "event": "failed", "error": "httpx not installed"})
            return

        await ws_manager.broadcast("tool_status", {
            "tool": "httpx-probe", "event": "started", "total": len(req.targets),
        })
        results = []
        try:
            async for result in adapter.run("", options):
                results.append(result)
                await ws_manager.broadcast("recon_results", {
                    "tool": "httpx", "type": "live_host", "results": [result],
                })
        except Exception as e:
            logger.error(f"httpx-probe error: {e}")
            await ws_manager.broadcast("tool_status", {"tool": "httpx-probe", "event": "failed", "error": str(e)})
            return
        finally:
            _RECON_JOBS.pop(job_id, None)

        await ws_manager.broadcast("tool_status", {
            "tool": "httpx-probe", "event": "completed", "result_count": len(results),
        })

    task = asyncio.create_task(_probe_background())
    _RECON_JOBS[job_id] = task
    return {"status": "started", "job_id": job_id, "tool": "httpx-probe", "targets": len(req.targets)}


@router.post("/nmap")
async def run_nmap(req: ReconRequest):
    return _start_recon("nmap", req.target, req.options)


@router.post("/waybackurls")
async def run_waybackurls(req: ReconRequest):
    return _start_recon("waybackurls", req.target, req.options)


@router.post("/gau")
async def run_gau(req: ReconRequest):
    return _start_recon("gau", req.target, req.options)


@router.post("/katana")
async def run_katana(req: ReconRequest):
    return _start_recon("katana", req.target, req.options)


@router.post("/paramspider")
async def run_paramspider(req: ReconRequest):
    return _start_recon("paramspider", req.target, req.options)


@router.post("/arjun")
async def run_arjun(req: ReconRequest):
    return _start_recon("arjun", req.target, req.options)


@router.post("/full")
async def run_full_recon(req: ReconRequest):
    """Start a full recon pipeline in the background."""
    job_id = str(uuid.uuid4())

    async def _full_pipeline():
        await ws_manager.broadcast("tool_status", {"tool": "full_recon", "event": "started"})

        # Step 1: Subfinder + Amass in parallel
        subfinder_results: list = []
        amass_results: list = []

        async def _collect(tool_name: str, out: list):
            adapter = get_adapter(tool_name)
            if adapter and await adapter.check_installed():
                await ws_manager.broadcast("tool_status", {"tool": tool_name, "event": "started"})
                async for r in adapter.run(req.target, {}):
                    out.append(r)
                    await ws_manager.broadcast("recon_results", {"tool": tool_name, "type": "subdomain", "results": [r]})
                await ws_manager.broadcast("tool_status", {"tool": tool_name, "event": "completed", "result_count": len(out)})

        await asyncio.gather(
            _collect("subfinder", subfinder_results),
            _collect("amass", amass_results),
            return_exceptions=True,
        )

        # Deduplicate subdomains
        seen = set()
        subdomains = []
        for r in subfinder_results + amass_results:
            sub = r.get("subdomain", "")
            if sub and sub not in seen:
                seen.add(sub)
                subdomains.append(sub)

        # Step 2: httpx probe on all found subdomains
        if subdomains:
            httpx = get_adapter("httpx")
            if httpx and await httpx.check_installed():
                await ws_manager.broadcast("tool_status", {"tool": "httpx-probe", "event": "started", "total": len(subdomains)})
                live_count = 0
                try:
                    async for result in httpx.run("", {"targets": subdomains}):
                        live_count += 1
                        await ws_manager.broadcast("recon_results", {"tool": "httpx", "type": "live_host", "results": [result]})
                except Exception as e:
                    logger.error(f"httpx probe error in full recon: {e}")
                await ws_manager.broadcast("tool_status", {"tool": "httpx-probe", "event": "completed", "result_count": live_count})

        # Step 3: URL discovery in parallel
        await asyncio.gather(
            _collect("waybackurls", []),
            _collect("gau", []),
            return_exceptions=True,
        )

        await ws_manager.broadcast("tool_status", {"tool": "full_recon", "event": "completed"})
        _RECON_JOBS.pop(job_id, None)

    task = asyncio.create_task(_full_pipeline())
    _RECON_JOBS[job_id] = task
    return {"status": "started", "job_id": job_id, "tool": "full_recon"}
