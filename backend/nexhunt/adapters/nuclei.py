import json
import os
import tempfile
from typing import AsyncIterator
from nexhunt.adapters.base import ToolAdapter

# Default template path — detected at startup
_DEFAULT_TEMPLATES = os.path.expanduser("~/nuclei-templates")


class NucleiAdapter(ToolAdapter):
    name = "nuclei"
    binary_name = "nuclei"
    result_type = "finding"

    async def run(self, target: str, options: dict) -> AsyncIterator[dict]:
        severity = options.get("severity", "info,low,medium,high,critical")
        tags = options.get("tags", "")
        templates = options.get("templates", "")
        rate_limit = str(options.get("rate_limit", 100))
        timeout = int(options.get("timeout", 600))
        exclude_tags = options.get("exclude_tags", "")
        scan_type = options.get("scan_type", "")

        # Support bulk scanning: if options["targets"] is a list, write to temp file
        targets_list: list[str] = options.get("targets", [])
        targets_file: str | None = None

        cmd = [
            self.binary_name,
            "-jsonl",
            "-no-color",
            "-rl", rate_limit,
            "-duc",    # disable update check
            "-ni",     # no interactsh (no OOB dependency)
        ]

        if targets_list:
            # Write all targets to a temp file and use -l
            fd, targets_file = tempfile.mkstemp(suffix=".txt", prefix="nexhunt_nuclei_")
            try:
                with os.fdopen(fd, "w") as f:
                    f.write("\n".join(targets_list))
            except Exception:
                pass
            cmd.extend(["-l", targets_file])
        else:
            cmd.extend(["-u", target])

        # Template selection: explicit > scan_type preset > default fast set
        if templates:
            cmd.extend(["-t", templates])
        elif scan_type == "cves":
            cmd.extend(["-t", f"{_DEFAULT_TEMPLATES}/http/cves/"])
        elif scan_type == "misconfig":
            cmd.extend(["-t", f"{_DEFAULT_TEMPLATES}/http/misconfiguration/"])
        elif scan_type == "oast":
            cmd.extend(["-tags", "oast"])
        elif scan_type == "exposure":
            cmd.extend(["-t", f"{_DEFAULT_TEMPLATES}/http/exposures/"])
        elif scan_type == "takeover":
            cmd.extend(["-t", f"{_DEFAULT_TEMPLATES}/http/takeovers/"])
        elif scan_type == "default-logins":
            cmd.extend(["-t", f"{_DEFAULT_TEMPLATES}/http/default-logins/"])
        elif scan_type == "ssrf":
            cmd.extend(["-tags", "ssrf,redirect"])
        else:
            # Default: technologies + exposures + misconfiguration (fast, useful)
            cmd.extend([
                "-t", f"{_DEFAULT_TEMPLATES}/http/technologies/",
                "-t", f"{_DEFAULT_TEMPLATES}/http/exposures/",
                "-t", f"{_DEFAULT_TEMPLATES}/http/misconfiguration/",
            ])

        if severity:
            cmd.extend(["-severity", severity])
        if tags:
            cmd.extend(["-tags", tags])
        if exclude_tags:
            cmd.extend(["-etags", exclude_tags])

        try:
            async for line in self._run_subprocess(cmd, timeout=timeout, merge_stderr=True):
                # Pass [INF]/[WRN]/[ERR] lines straight through as raw output
                if line.startswith("[INF]") or line.startswith("[WRN]") or line.startswith("[ERR]") \
                        or line.startswith("[STDERR] [INF]") or line.startswith("[STDERR] [WRN]") \
                        or line.startswith("[STDERR] [ERR]"):
                    clean = line.replace("[STDERR] ", "")
                    yield {"_raw": True, "line": clean}
                    continue

                # Try to parse as JSONL finding
                try:
                    data = json.loads(line)
                    info = data.get("info", {})
                    yield {
                        "_raw": False,
                        "id": None,
                        "title": f"[Nuclei] {info.get('name', 'Unknown')}",
                        "severity": info.get("severity", "info"),
                        "vuln_type": data.get("type", None),
                        "url": data.get("matched-at", target),
                        "parameter": None,
                        "evidence": (data.get("extracted-results") or [None])[0],
                        "description": info.get("description", ""),
                        "tool": "nuclei",
                        "template_id": data.get("template-id"),
                        "status": "new",
                        "notes": None,
                    }
                except (json.JSONDecodeError, KeyError):
                    if line.strip():
                        yield {"_raw": True, "line": line}
        finally:
            # Clean up temp targets file
            if targets_file and os.path.exists(targets_file):
                try:
                    os.unlink(targets_file)
                except OSError:
                    pass
