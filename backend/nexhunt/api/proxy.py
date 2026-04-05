import json
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from nexhunt.database import get_session
from nexhunt.models.http_flow import HttpFlow
from nexhunt.schemas.proxy import ProxySettings, InterceptToggle, RepeaterRequest
from nexhunt.proxy.engine import proxy_engine

router = APIRouter(prefix="/api/proxy", tags=["proxy"])


@router.post("/start")
async def start_proxy():
    """Start the intercepting proxy."""
    await proxy_engine.start()
    return {"status": "started", "port": proxy_engine.port}


@router.post("/stop")
async def stop_proxy():
    """Stop the intercepting proxy."""
    await proxy_engine.stop()
    return {"status": "stopped"}


@router.get("/status")
async def proxy_status():
    """Get proxy status."""
    return {
        "running": proxy_engine.running,
        "port": proxy_engine.port,
        "intercept_enabled": proxy_engine.intercept_enabled
    }


@router.get("/history")
async def get_history(
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=1000),
    host: str | None = None,
    method: str | None = None,
    status_code: int | None = None,
    search: str | None = None,
    session: AsyncSession = Depends(get_session)
):
    """Get paginated HTTP history."""
    query = select(HttpFlow).order_by(desc(HttpFlow.timestamp))

    if host:
        query = query.where(HttpFlow.request_host.contains(host))
    if method:
        query = query.where(HttpFlow.request_method == method)
    if status_code:
        query = query.where(HttpFlow.response_status == status_code)
    if search:
        query = query.where(HttpFlow.request_url.contains(search))

    query = query.offset((page - 1) * limit).limit(limit)
    result = await session.execute(query)
    flows = result.scalars().all()

    return [_flow_to_dict(f) for f in flows]


@router.get("/flow/{flow_id}")
async def get_flow(flow_id: str, session: AsyncSession = Depends(get_session)):
    """Get full details of a specific flow."""
    result = await session.execute(select(HttpFlow).where(HttpFlow.id == flow_id))
    flow = result.scalar_one_or_none()
    if not flow:
        return {"error": "Flow not found"}
    return _flow_to_dict(flow, include_bodies=True)


@router.post("/intercept/toggle")
async def toggle_intercept(data: InterceptToggle):
    """Toggle intercept mode."""
    proxy_engine.intercept_enabled = data.enabled
    return {"intercept_enabled": data.enabled}


@router.post("/repeater")
async def repeater_send(req: RepeaterRequest):
    """Send a request via the repeater."""
    import httpx
    async with httpx.AsyncClient(verify=False) as client:
        response = await client.request(
            method=req.method,
            url=req.url,
            headers=req.headers,
            content=req.body
        )
        return {
            "status": response.status_code,
            "headers": dict(response.headers),
            "body": response.text[:10000],  # Limit response size
            "duration_ms": response.elapsed.total_seconds() * 1000
        }


@router.get("/cert")
async def download_cert():
    """Download CA certificate for HTTPS interception."""
    from fastapi.responses import FileResponse
    cert_path = proxy_engine.get_cert_path()
    if cert_path:
        return FileResponse(cert_path, filename="nexhunt-ca-cert.pem")
    return {"error": "Certificate not found. Start the proxy first."}


def _flow_to_dict(flow: HttpFlow, include_bodies: bool = False) -> dict:
    d = {
        "id": flow.id,
        "request_method": flow.request_method,
        "request_url": flow.request_url,
        "request_host": flow.request_host,
        "request_port": flow.request_port,
        "request_path": flow.request_path,
        "request_headers": json.loads(flow.request_headers) if flow.request_headers else {},
        "response_status": flow.response_status,
        "response_headers": json.loads(flow.response_headers) if flow.response_headers else {},
        "content_type": flow.content_type,
        "response_length": flow.response_length,
        "duration_ms": flow.duration_ms,
        "is_intercepted": flow.is_intercepted,
        "timestamp": flow.timestamp.isoformat() if flow.timestamp else None,
        "tags": json.loads(flow.tags) if flow.tags else [],
    }
    if include_bodies:
        d["request_body"] = flow.request_body.decode("utf-8", errors="replace") if flow.request_body else None
        d["response_body"] = flow.response_body.decode("utf-8", errors="replace") if flow.response_body else None
    return d
