import json
import os
import tempfile
from typing import AsyncIterator
from nexhunt.adapters.base import ToolAdapter


class HttpxAdapter(ToolAdapter):
    name = "httpx"
    binary_name = "httpx"
    result_type = "url"

    async def run(self, target: str, options: dict) -> AsyncIterator[dict]:
        # Support batch probing from a list of targets (e.g. found subdomains)
        targets_list = options.get("targets", [])

        tmpfile = None
        try:
            if targets_list:
                # Write all targets to a temp file and use -l flag
                fd, tmpfile = tempfile.mkstemp(suffix=".txt", prefix="httpx_")
                with os.fdopen(fd, "w") as f:
                    f.write("\n".join(targets_list))
                cmd = [
                    self.binary_name,
                    "-l", tmpfile,
                    "-json", "-silent",
                    "-follow-redirects",
                    "-title",
                    "-tech-detect",
                    "-status-code",
                    "-ip",
                ]
            else:
                cmd = [
                    self.binary_name,
                    "-u", target,
                    "-json", "-silent",
                    "-follow-redirects",
                    "-title",
                    "-tech-detect",
                    "-status-code",
                    "-ip",
                ]

            if options.get("threads"):
                cmd.extend(["-threads", str(options["threads"])])

            async for line in self._run_subprocess(cmd, timeout=300):
                try:
                    data = json.loads(line)
                    yield {
                        "url": data.get("url", ""),
                        "host": data.get("host", ""),
                        "source": "httpx",
                        "status_code": data.get("status-code"),
                        "content_type": data.get("content-type", ""),
                        "title": data.get("title", ""),
                        "technologies": data.get("technologies", []),
                        "ip": data.get("host", ""),
                        "alive": True,
                    }
                except (json.JSONDecodeError, KeyError):
                    continue
        finally:
            if tmpfile and os.path.exists(tmpfile):
                os.unlink(tmpfile)
