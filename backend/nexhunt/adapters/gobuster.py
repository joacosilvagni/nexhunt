import re
from typing import AsyncIterator
from nexhunt.adapters.base import ToolAdapter

DEFAULT_WORDLIST = "/usr/share/dirbuster/wordlists/directory-list-2.3-medium.txt"


class GobusterAdapter(ToolAdapter):
    name = "gobuster"
    binary_name = "gobuster"
    result_type = "finding"

    async def run(self, target: str, options: dict) -> AsyncIterator[dict]:
        wordlist = options.get("wordlist", DEFAULT_WORDLIST)
        threads = str(options.get("threads", 20))
        extensions = options.get("extensions", "")

        # Status codes to show (only interesting ones — skip redirects and auth errors unless overridden)
        match_codes = options.get("match_codes", "200,204,301,302,307,401,403")
        # Codes to exclude from findings (but gobuster still finds them — filtered in scanner.py)
        # Default: user sees 200/204 only as findings; all discovered paths shown in raw output

        cmd = [
            self.binary_name, "dir",
            "-u", target,
            "-w", wordlist,
            "-t", threads,
            "-s", match_codes,
            "--no-color",
            "--no-progress",
            "--no-error",
        ]

        if extensions:
            cmd.extend(["-x", extensions])

        exclude_len = options.get("exclude_length", "")
        if exclude_len:
            cmd.extend(["--exclude-length", exclude_len])

        # Gobuster v3.6+ result lines look like:
        # /admin                (Status: 200) [Size: 3495, Words: 425, Lines: 68, Duration: 1ms]
        # docs                  (Status: 200) [Size: 1010]   ← no leading slash in some versions
        pattern = re.compile(r"^(/?[^\s(]+)\s+\(Status:\s*(\d+)\)\s+\[Size:\s*(\d+)")

        async for line in self._run_subprocess(cmd, timeout=1800):
            line = line.strip()
            if not line:
                continue

            match = pattern.match(line)
            if match:
                path, status, size = match.groups()
                if not path.startswith("/"):
                    path = "/" + path
                status_int = int(status)

                if status_int in (200, 204):
                    severity = "low"
                elif status_int in (401, 403):
                    severity = "info"
                elif status_int in (301, 302, 307, 308):
                    severity = "info"
                else:
                    severity = "info"

                yield {
                    "id": None,
                    "title": f"[Gobuster] {path} ({status})",
                    "severity": severity,
                    "vuln_type": "directory-listing",
                    "url": f"{target.rstrip('/')}{path}",
                    "parameter": None,
                    "evidence": f"Status: {status} | Size: {size}",
                    "description": f"Path found via directory brute-force",
                    "tool": "gobuster",
                    "template_id": None,
                    "status": "new",
                    "notes": None,
                }
