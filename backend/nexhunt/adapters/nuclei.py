import json
from typing import AsyncIterator
from nexhunt.adapters.base import ToolAdapter


class NucleiAdapter(ToolAdapter):
    name = "nuclei"
    binary_name = "nuclei"
    result_type = "finding"

    async def run(self, target: str, options: dict) -> AsyncIterator[dict]:
        severity = options.get("severity", "critical,high,medium")
        cmd = [
            self.binary_name,
            "-u", target,
            "-jsonl", "-silent",
            "-severity", severity,
            "-no-color"
        ]
        if options.get("templates"):
            cmd.extend(["-t", options["templates"]])

        async for line in self._run_subprocess(cmd, timeout=600):
            try:
                data = json.loads(line)
                yield {
                    "id": None,
                    "title": data.get("info", {}).get("name", "Unknown"),
                    "severity": data.get("info", {}).get("severity", "info"),
                    "vuln_type": data.get("type", None),
                    "url": data.get("matched-at", target),
                    "parameter": None,
                    "evidence": data.get("extracted-results", [None])[0],
                    "description": data.get("info", {}).get("description"),
                    "tool": "nuclei",
                    "template_id": data.get("template-id"),
                    "status": "new",
                    "notes": None,
                }
            except (json.JSONDecodeError, KeyError):
                continue
