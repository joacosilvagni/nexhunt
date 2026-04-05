"""
Proxy engine: runs mitmdump as a subprocess with a custom addon.
The addon (mitm_addon.py) POSTs each flow to /api/proxy/flow, which
broadcasts it via WebSocket and saves it to SQLite.
"""
import asyncio
import logging
import os
from pathlib import Path

from nexhunt.proxy.cert_manager import get_cert_path

logger = logging.getLogger(__name__)

_ADDON_PATH = Path(__file__).parent / "mitm_addon.py"


class ProxyEngine:
    def __init__(self):
        self.port: int = 8080
        self.running: bool = False
        self._proc: asyncio.subprocess.Process | None = None
        self._intercept_flag = [False]

    async def start(self, port: int = 8080):
        if self.running:
            logger.info("Proxy already running")
            return

        self.port = port

        env = {**os.environ, "NEXHUNT_PORT": "17707"}

        self._proc = await asyncio.create_subprocess_exec(
            "mitmdump",
            "-s", str(_ADDON_PATH),
            "--listen-host", "127.0.0.1",
            "--listen-port", str(self.port),
            "--ssl-insecure",
            "--quiet",
            env=env,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.PIPE,
        )

        self.running = True
        logger.info(f"Proxy started (mitmdump pid={self._proc.pid}) on 127.0.0.1:{self.port}")

        asyncio.create_task(self._watch_stderr())

        from nexhunt.ws.manager import ws_manager
        await ws_manager.broadcast("tool_status", {
            "tool": "proxy", "event": "started", "port": self.port
        })

    async def _watch_stderr(self):
        """Log mitmdump stderr output and detect unexpected exits."""
        if not self._proc or not self._proc.stderr:
            return
        async for raw in self._proc.stderr:
            line = raw.decode(errors="replace").rstrip()
            if line:
                logger.debug(f"[mitmdump] {line}")
        # stderr closed → process ended
        if self.running:
            self.running = False
            logger.warning("mitmdump exited unexpectedly")
            from nexhunt.ws.manager import ws_manager
            await ws_manager.broadcast("tool_status", {
                "tool": "proxy", "event": "stopped"
            })

    async def stop(self):
        if not self.running:
            return
        self.running = False
        if self._proc and self._proc.returncode is None:
            self._proc.terminate()
            try:
                await asyncio.wait_for(self._proc.wait(), timeout=5)
            except asyncio.TimeoutError:
                self._proc.kill()
        logger.info("Proxy stopped")
        from nexhunt.ws.manager import ws_manager
        await ws_manager.broadcast("tool_status", {
            "tool": "proxy", "event": "stopped"
        })

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
