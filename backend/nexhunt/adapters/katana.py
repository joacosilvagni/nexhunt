import json
from typing import AsyncIterator
from nexhunt.adapters.base import ToolAdapter


class KatanaAdapter(ToolAdapter):
    name = "katana"
    binary_name = "katana"
    result_type = "url"

    async def run(self, target: str, options: dict) -> AsyncIterator[dict]:
        depth = str(options.get("depth", 3))
        concurrency = str(options.get("concurrency", 10))
        rate_limit = str(options.get("rate_limit", 150))

        cmd = [
            self.binary_name,
            "-u", target,
            "-jsonl",           # correct flag for this version (not -json)
            "-silent",
            "-no-color",
            "-depth", depth,
            "-concurrency", concurrency,
            "-rate-limit", rate_limit,
            "-or",              # omit raw request/response bodies (much faster)
            "-ob",              # omit response body
        ]

        if options.get("js_crawl", True):
            cmd.append("-jc")

        if options.get("crawl_forms", True):
            cmd.append("-aff")

        if options.get("scope"):
            cmd.extend(["-cs", options["scope"]])

        if options.get("cookie"):
            cmd.extend(["-H", f"Cookie: {options['cookie']}"])

        if options.get("headers"):
            for h in options["headers"].split(","):
                cmd.extend(["-H", h.strip()])

        async for line in self._run_subprocess(cmd, timeout=600):
            try:
                data = json.loads(line)
                endpoint = data.get("request", {}).get("endpoint", "")
                method = data.get("request", {}).get("method", "GET")
                status = data.get("response", {}).get("status_code")
                if not endpoint:
                    continue

                has_params = "?" in endpoint and "=" in endpoint
                is_form = method == "POST"

                yield {
                    "url": endpoint,
                    "method": method,
                    "source": "katana",
                    "status_code": status,
                    "content_type": None,
                    "has_params": has_params,
                    "is_form": is_form,
                }
            except (json.JSONDecodeError, KeyError):
                # fallback: plain URL line
                url = line.strip()
                if url.startswith("http"):
                    yield {
                        "url": url,
                        "method": "GET",
                        "source": "katana",
                        "status_code": None,
                        "content_type": None,
                        "has_params": "?" in url and "=" in url,
                        "is_form": False,
                    }
