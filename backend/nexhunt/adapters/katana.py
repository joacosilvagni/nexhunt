import json
from typing import AsyncIterator
from nexhunt.adapters.base import ToolAdapter


class KatanaAdapter(ToolAdapter):
    name = "katana"
    binary_name = "katana"
    result_type = "url"

    async def run(self, target: str, options: dict) -> AsyncIterator[dict]:
        depth = options.get("depth", 3)
        cmd = [
            self.binary_name,
            "-u", target,
            "-json", "-silent",
            "-depth", str(depth),
            "-no-color"
        ]

        async for line in self._run_subprocess(cmd):
            try:
                data = json.loads(line)
                yield {
                    "url": data.get("request", {}).get("endpoint", ""),
                    "source": "katana",
                    "status_code": data.get("response", {}).get("status_code"),
                    "content_type": None,
                }
            except (json.JSONDecodeError, KeyError):
                # katana might also output plain URLs
                url = line.strip()
                if url.startswith("http"):
                    yield {"url": url, "source": "katana", "status_code": None, "content_type": None}
