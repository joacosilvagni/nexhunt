import json
from typing import AsyncIterator
from nexhunt.adapters.base import ToolAdapter


class DalfoxAdapter(ToolAdapter):
    name = "dalfox"
    binary_name = "dalfox"
    result_type = "finding"

    async def run(self, target: str, options: dict) -> AsyncIterator[dict]:
        cmd = [
            self.binary_name, "url", target,
            "--no-color", "--format", "json"
        ]

        async for line in self._run_subprocess(cmd, timeout=300):
            yield line  # Raw output for terminal

            try:
                data = json.loads(line)
                if data.get("type") == "POC":
                    yield {
                        "id": None,
                        "title": f"XSS found: {data.get('param', '')}",
                        "severity": "high",
                        "vuln_type": "xss",
                        "url": target,
                        "parameter": data.get("param"),
                        "evidence": data.get("poc", ""),
                        "description": "Cross-Site Scripting vulnerability",
                        "tool": "dalfox",
                        "template_id": None,
                        "status": "new",
                        "notes": None,
                    }
            except (json.JSONDecodeError, KeyError):
                pass
