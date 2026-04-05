"""
Proxy engine: runs mitmproxy DumpMaster in a background thread.
The addon captures flows and pushes them to the FastAPI WebSocket hub.
"""
import asyncio
import logging
import threading
from nexhunt.proxy.cert_manager import get_cert_path

logger = logging.getLogger(__name__)


class ProxyEngine:
    def __init__(self):
        self.port: int = 8080
        self.running: bool = False
        self._master = None
        self._thread: threading.Thread | None = None
        self._intercept_flag = [False]  # mutable list for toggling inside addon (must be before property use)
        self._db_queue: asyncio.Queue | None = None
        self._fastapi_loop: asyncio.AbstractEventLoop | None = None

    async def start(self, port: int = 8080):
        if self.running:
            logger.info("Proxy already running")
            return

        self.port = port
        self._fastapi_loop = asyncio.get_event_loop()
        self._db_queue = asyncio.Queue(maxsize=1000)

        # Import mitmproxy lazily to avoid startup delay
        try:
            from mitmproxy.options import Options
            from mitmproxy.tools.dump import DumpMaster
            from nexhunt.proxy.addon import NexHuntAddon
            from nexhunt.ws.manager import ws_manager
        except ImportError as e:
            logger.error(f"mitmproxy not installed: {e}")
            raise

        opts = Options(
            listen_host="127.0.0.1",
            listen_port=self.port,
            ssl_insecure=True,  # Accept self-signed upstream certs
        )

        self._master = DumpMaster(opts, with_termlog=False, with_dumper=False)
        addon = NexHuntAddon(
            ws_manager=ws_manager,
            db_queue=self._db_queue,
            fastapi_loop=self._fastapi_loop,
            intercept_flag=self._intercept_flag
        )
        self._master.addons.add(addon)

        # Start mitmproxy in its own thread with its own event loop
        self._thread = threading.Thread(target=self._run_master, daemon=True, name="mitmproxy")
        self._thread.start()
        self.running = True

        # Start DB persistence worker
        asyncio.create_task(self._db_worker())

        logger.info(f"Proxy started on 127.0.0.1:{self.port}")

        # Notify frontend
        from nexhunt.ws.manager import ws_manager
        await ws_manager.broadcast("tool_status", {"tool": "proxy", "event": "started", "port": self.port})

    def _run_master(self):
        """Run mitmproxy in a separate thread with its own event loop."""
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(self._master.run())
        except Exception as e:
            logger.error(f"mitmproxy error: {e}")
        finally:
            loop.close()

    async def _db_worker(self):
        """Consume the DB queue and persist flows to SQLite."""
        from nexhunt.database import DefaultSession
        from nexhunt.models.http_flow import HttpFlow
        import json as json_module

        while self.running:
            try:
                flow_data = await asyncio.wait_for(self._db_queue.get(), timeout=1.0)
                async with DefaultSession() as session:
                    flow = HttpFlow(
                        id=flow_data["id"],
                        request_method=flow_data["request_method"],
                        request_url=flow_data["request_url"],
                        request_host=flow_data["request_host"],
                        request_port=flow_data["request_port"],
                        request_path=flow_data["request_path"],
                        request_headers=json_module.dumps(flow_data["request_headers"]),
                        request_body=flow_data["request_body"].encode() if flow_data.get("request_body") else None,
                        response_status=flow_data["response_status"],
                        response_headers=json_module.dumps(flow_data["response_headers"]),
                        response_body=flow_data["response_body"].encode() if flow_data.get("response_body") else None,
                        content_type=flow_data.get("content_type"),
                        response_length=flow_data["response_length"],
                        duration_ms=flow_data["duration_ms"],
                        is_intercepted=flow_data["is_intercepted"],
                        tags=json_module.dumps(flow_data["tags"]),
                    )
                    session.add(flow)
                    await session.commit()
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.error(f"DB worker error: {e}")

    async def stop(self):
        if not self.running:
            return
        self.running = False
        if self._master:
            self._master.shutdown()
        logger.info("Proxy stopped")

        from nexhunt.ws.manager import ws_manager
        await ws_manager.broadcast("tool_status", {"tool": "proxy", "event": "stopped"})

    def get_cert_path(self) -> str | None:
        return get_cert_path()

    @property
    def intercept_enabled(self) -> bool:
        return self._intercept_flag[0]

    @intercept_enabled.setter
    def intercept_enabled(self, value: bool):
        self._intercept_flag[0] = value


# Global singleton
proxy_engine = ProxyEngine()
