import json
from typing import AsyncIterator
from nexhunt.adapters.base import ToolAdapter


class HttpxAdapter(ToolAdapter):
    name = "httpx"
    binary_name = "httpx"
    result_type = "url"

    async def run(self, target: str, options: dict) -> AsyncIterator[dict]:
        cmd = [
            self.binary_name,
            "-u", target,
            "-json", "-silent",
            "-follow-redirects",
            "-title", "-tech-detect", "-status-code"
        ]

        async for line in self._run_subprocess(cmd):
            try:
                data = json.loads(line)
                yield {
                    "url": data.get("url", ""),
                    "source": "httpx",
                    "status_code": data.get("status-code"),
                    "content_type": data.get("content-type"),
                    "title": data.get("title"),
                    "technologies": data.get("technologies", []),
                }
            except (json.JSONDecodeError, KeyError):
                continue
