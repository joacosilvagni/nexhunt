import re
from typing import AsyncIterator
from nexhunt.adapters.base import ToolAdapter


class DirsearchAdapter(ToolAdapter):
    name = "dirsearch"
    binary_name = "dirsearch"
    result_type = "finding"

    async def run(self, target: str, options: dict) -> AsyncIterator[dict]:
        cmd = [
            self.binary_name,
            "-u", target,
            "--no-color", "-q",
            "-e", "php,asp,aspx,jsp,html,js,txt,json,xml,bak"
        ]

        async for line in self._run_subprocess(cmd, timeout=300):
            # Lines like:  200  1234B  /admin/
            match = re.match(r"\s+(\d{3})\s+[\d.]+\w+\s+(/\S+)", line)
            if match:
                status, path = match.groups()
                yield {
                    "id": None,
                    "title": f"Path found: {path}",
                    "severity": "info",
                    "vuln_type": "directory-listing",
                    "url": f"{target.rstrip('/')}{path}",
                    "parameter": None,
                    "evidence": f"Status: {status}",
                    "description": None,
                    "tool": "dirsearch",
                    "template_id": None,
                    "status": "new",
                    "notes": None,
                }
