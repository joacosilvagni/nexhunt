from typing import AsyncIterator
from nexhunt.adapters.base import ToolAdapter


class SqlmapAdapter(ToolAdapter):
    name = "sqlmap"
    binary_name = "sqlmap"
    result_type = "finding"

    async def run(self, target: str, options: dict) -> AsyncIterator[dict]:
        cmd = [
            self.binary_name,
            "-u", target,
            "--batch",           # Non-interactive
            "--level", "3",
            "--risk", "2",
            "--output-dir", "/tmp/sqlmap_nexhunt",
            "--no-logging"
        ]
        if options.get("forms"):
            cmd.append("--forms")
        if options.get("crawl"):
            cmd.extend(["--crawl", "2"])

        found_injectable = False
        current_param = None

        async for line in self._run_subprocess(cmd, timeout=600):
            # Yield raw output for the terminal display
            yield line  # Raw line for output display

            # Also detect injections
            if "is vulnerable" in line.lower() or "injected" in line.lower():
                found_injectable = True
            if "parameter:" in line.lower():
                current_param = line.split(":")[-1].strip()
