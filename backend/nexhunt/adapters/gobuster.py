import re
from typing import AsyncIterator
from nexhunt.adapters.base import ToolAdapter


class GobusterAdapter(ToolAdapter):
    name = "gobuster"
    binary_name = "gobuster"
    result_type = "finding"

    async def run(self, target: str, options: dict) -> AsyncIterator[dict]:
        wordlist = options.get("wordlist", "/usr/share/wordlists/dirb/common.txt")
        cmd = [
            self.binary_name, "dir",
            "-u", target,
            "-w", wordlist,
            "-q", "--no-color"
        ]

        async for line in self._run_subprocess(cmd, timeout=300):
            # Lines like: /admin   (Status: 200) [Size: 1234]
            match = re.match(r"(/\S+)\s+\(Status:\s*(\d+)\)\s+\[Size:\s*(\d+)\]", line)
            if match:
                path, status, size = match.groups()
                yield {
                    "id": None,
                    "title": f"Directory found: {path}",
                    "severity": "info",
                    "vuln_type": "directory-listing",
                    "url": f"{target.rstrip('/')}{path}",
                    "parameter": None,
                    "evidence": f"Status: {status} | Size: {size}",
                    "description": None,
                    "tool": "gobuster",
                    "template_id": None,
                    "status": "new",
                    "notes": None,
                }
