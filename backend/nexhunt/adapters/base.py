"""
Abstract base class for all external tool adapters.
Each adapter wraps one CLI tool, runs it as a subprocess,
parses its output, and yields normalized result dicts.
"""
import asyncio
import shutil
import logging
from abc import ABC, abstractmethod
from asyncio import StreamReader
from typing import AsyncIterator

logger = logging.getLogger(__name__)


class ToolAdapter(ABC):
    name: str = ""
    binary_name: str = ""
    result_type: str = "generic"  # subdomain | url | port | finding | output

    def __init__(self):
        self._proc: asyncio.subprocess.Process | None = None

    @abstractmethod
    async def run(self, target: str, options: dict) -> AsyncIterator[dict]:
        """Yield normalized result dicts as they arrive."""
        ...

    async def check_installed(self) -> bool:
        """Check if the tool binary exists in PATH."""
        return shutil.which(self.binary_name) is not None

    async def get_version(self) -> str | None:
        """Try to get the tool version string."""
        if not await self.check_installed():
            return None
        try:
            proc = await asyncio.create_subprocess_exec(
                self.binary_name, "--version",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=5)
            output = (stdout or stderr).decode().strip()
            # Return first line
            return output.split("\n")[0][:50] if output else None
        except Exception:
            return None

    async def cancel(self):
        """Kill the running subprocess."""
        if self._proc and self._proc.returncode is None:
            try:
                self._proc.terminate()
                await asyncio.sleep(0.5)
                if self._proc.returncode is None:
                    self._proc.kill()
            except ProcessLookupError:
                pass

    async def _run_subprocess(self, cmd: list[str], timeout: int = 300) -> AsyncIterator[str]:
        """Run a command, yield stdout lines as they arrive."""
        logger.debug(f"Running: {' '.join(cmd)}")
        try:
            self._proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            assert self._proc.stdout is not None

            async def read_lines(stream: StreamReader) -> AsyncIterator[str]:
                while True:
                    line = await stream.readline()
                    if not line:
                        break
                    yield line.decode("utf-8", errors="replace").strip()

            async for line in read_lines(self._proc.stdout):
                if line:
                    yield line

            await asyncio.wait_for(self._proc.wait(), timeout=timeout)
        except asyncio.TimeoutError:
            await self.cancel()
            logger.warning(f"{self.binary_name} timed out after {timeout}s")
        except FileNotFoundError:
            logger.error(f"{self.binary_name} not found in PATH")
        except Exception as e:
            logger.error(f"Subprocess error for {self.binary_name}: {e}")
        finally:
            self._proc = None


# ── Registry ──────────────────────────────────────────────────────────────────

def _build_registry() -> dict[str, ToolAdapter]:
    from nexhunt.adapters.subfinder import SubfinderAdapter
    from nexhunt.adapters.amass import AmassAdapter
    from nexhunt.adapters.httpx_adapter import HttpxAdapter
    from nexhunt.adapters.nmap import NmapAdapter
    from nexhunt.adapters.waybackurls import WaybackurlsAdapter
    from nexhunt.adapters.gau import GauAdapter
    from nexhunt.adapters.katana import KatanaAdapter
    from nexhunt.adapters.paramspider import ParamspiderAdapter
    from nexhunt.adapters.arjun import ArjunAdapter
    from nexhunt.adapters.nuclei import NucleiAdapter
    from nexhunt.adapters.ffuf import FfufAdapter
    from nexhunt.adapters.nikto import NiktoAdapter
    from nexhunt.adapters.gobuster import GobusterAdapter
    from nexhunt.adapters.dirsearch import DirsearchAdapter
    from nexhunt.adapters.sqlmap import SqlmapAdapter
    from nexhunt.adapters.dalfox import DalfoxAdapter
    from nexhunt.adapters.xsstrike import XsstrikeAdapter
    from nexhunt.adapters.commix import CommixAdapter

    adapters = [
        SubfinderAdapter(), AmassAdapter(), HttpxAdapter(), NmapAdapter(),
        WaybackurlsAdapter(), GauAdapter(), KatanaAdapter(),
        ParamspiderAdapter(), ArjunAdapter(),
        NucleiAdapter(), FfufAdapter(), NiktoAdapter(), GobusterAdapter(), DirsearchAdapter(),
        SqlmapAdapter(), DalfoxAdapter(), XsstrikeAdapter(), CommixAdapter(),
    ]
    return {a.name: a for a in adapters}


ADAPTERS: dict[str, ToolAdapter] = {}


def get_adapter(name: str) -> ToolAdapter | None:
    global ADAPTERS
    if not ADAPTERS:
        ADAPTERS = _build_registry()
    return ADAPTERS.get(name)
