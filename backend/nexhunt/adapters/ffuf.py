import json
from typing import AsyncIterator
from nexhunt.adapters.base import ToolAdapter


class FfufAdapter(ToolAdapter):
    name = "ffuf"
    binary_name = "ffuf"
    result_type = "finding"

    async def run(self, target: str, options: dict) -> AsyncIterator[dict]:
        wordlist = options.get("wordlist", "/usr/share/wordlists/dirb/common.txt")
        # Target must have FUZZ keyword; add it if not present
        fuzz_target = target if "FUZZ" in target else f"{target.rstrip('/')}/FUZZ"

        cmd = [
            self.binary_name,
            "-u", fuzz_target,
            "-w", wordlist,
            "-json", "-noninteractive",
            "-mc", "200,201,204,301,302,307,401,403",
        ]

        buffer = []
        in_results = False

        async for line in self._run_subprocess(cmd, timeout=600):
            buffer.append(line)

        # ffuf outputs one big JSON at the end
        full_output = "".join(buffer)
        try:
            data = json.loads(full_output)
            for result in data.get("results", []):
                yield {
                    "id": None,
                    "title": f"Directory found: /{result.get('input', {}).get('FUZZ', '')}",
                    "severity": "info",
                    "vuln_type": "directory-listing",
                    "url": result.get("url", ""),
                    "parameter": None,
                    "evidence": f"Status: {result.get('status')} | Length: {result.get('length')}",
                    "description": None,
                    "tool": "ffuf",
                    "template_id": None,
                    "status": "new",
                    "notes": None,
                }
        except (json.JSONDecodeError, KeyError):
            pass
