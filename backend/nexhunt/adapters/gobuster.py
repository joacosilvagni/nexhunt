import re
from typing import AsyncIterator
from nexhunt.adapters.base import ToolAdapter

DEFAULT_WORDLIST = "/usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt"
FALLBACK_WORDLIST = "/usr/share/wordlists/dirb/common.txt"


class GobusterAdapter(ToolAdapter):
    name = "gobuster"
    binary_name = "gobuster"
    result_type = "finding"

    async def run(self, target: str, options: dict) -> AsyncIterator[dict]:
        import os
        wordlist = options.get("wordlist", "")
        if not wordlist or not os.path.exists(wordlist):
            wordlist = DEFAULT_WORDLIST if os.path.exists(DEFAULT_WORDLIST) else FALLBACK_WORDLIST

        threads = str(options.get("threads", 20))
        extensions = options.get("extensions", "")

        cmd = [
            self.binary_name, "dir",
            "-u", target,
            "-w", wordlist,
            "-t", threads,
            "--no-color",
            "--no-progress",
            "--no-error",
            "--quiet",
        ]

        # Status code filter: blacklist 404 by default, let everything else through
        # User can override by setting match_codes option
        match_codes = options.get("match_codes", "")
        if match_codes:
            cmd.extend(["-s", match_codes])

        exclude_len = options.get("exclude_length", "")
        if exclude_len:
            cmd.extend(["--exclude-length", exclude_len])

        if extensions:
            cmd.extend(["-x", extensions])

        # Gobuster output format:
        # /admin                (Status: 200) [Size: 3495, Words: 425, Lines: 68, Duration: 1ms]
        pattern = re.compile(r"^(/[^\s(]*)\s+\(Status:\s*(\d+)\)\s+\[Size:\s*(\d+)")

        async for line in self._run_subprocess(cmd, timeout=1800):
            line = line.strip()
            if not line:
                continue

            match = pattern.match(line)
            if not match:
                continue

            path, status, size = match.groups()
            status_int = int(status)

            if status_int in (200, 204):
                severity = "low"
            else:
                severity = "info"

            yield {
                "id": None,
                "title": f"[Gobuster] {path} ({status})",
                "severity": severity,
                "vuln_type": "directory-listing",
                "url": f"{target.rstrip('/')}{path}",
                "parameter": None,
                "evidence": f"Status: {status} | Size: {size} bytes",
                "description": "Path discovered via directory brute-force",
                "tool": "gobuster",
                "template_id": None,
                "status": "new",
                "notes": None,
            }
