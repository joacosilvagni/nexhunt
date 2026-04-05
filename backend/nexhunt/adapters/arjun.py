import json
from typing import AsyncIterator
from nexhunt.adapters.base import ToolAdapter


class ArjunAdapter(ToolAdapter):
    name = "arjun"
    binary_name = "arjun"
    result_type = "url"

    async def run(self, target: str, options: dict) -> AsyncIterator[dict]:
        cmd = [self.binary_name, "-u", target, "--stable", "-oJ", "/tmp/arjun_out.json"]

        async for line in self._run_subprocess(cmd):
            # arjun outputs params to a JSON file; try to parse inline output
            if "param" in line.lower() and "found" in line.lower():
                yield {
                    "url": target,
                    "source": "arjun",
                    "status_code": None,
                    "content_type": None,
                    "note": line.strip(),
                }
