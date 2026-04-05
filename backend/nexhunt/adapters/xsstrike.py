from typing import AsyncIterator
from nexhunt.adapters.base import ToolAdapter


class XsstrikeAdapter(ToolAdapter):
    name = "xsstrike"
    binary_name = "python3"
    result_type = "finding"

    async def run(self, target: str, options: dict) -> AsyncIterator[dict]:
        cmd = ["python3", "-m", "xsstrike", "-u", target, "--skip-dom"]

        async for line in self._run_subprocess(cmd, timeout=300):
            yield line  # Raw output

            lower = line.lower()
            if "xss" in lower and ("found" in lower or "vulnerable" in lower):
                yield {
                    "id": None,
                    "title": "XSS vulnerability found",
                    "severity": "high",
                    "vuln_type": "xss",
                    "url": target,
                    "parameter": None,
                    "evidence": line.strip(),
                    "description": "Cross-Site Scripting - XSStrike",
                    "tool": "xsstrike",
                    "template_id": None,
                    "status": "new",
                    "notes": None,
                }
