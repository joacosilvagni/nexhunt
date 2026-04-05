import re
from typing import AsyncIterator
from nexhunt.adapters.base import ToolAdapter


class NmapAdapter(ToolAdapter):
    name = "nmap"
    binary_name = "nmap"
    result_type = "port"

    async def run(self, target: str, options: dict) -> AsyncIterator[dict]:
        ports = options.get("ports", "1-1000")
        cmd = [self.binary_name, "-sV", "--open", "-p", ports, target, "--defeat-rst-ratelimit"]

        current_ip = target
        async for line in self._run_subprocess(cmd, timeout=300):
            # Parse "Nmap scan report for X"
            ip_match = re.match(r"Nmap scan report for (.+)", line)
            if ip_match:
                current_ip = ip_match.group(1).strip()
                continue

            # Parse open port lines: "80/tcp   open  http    Apache httpd 2.4.41"
            port_match = re.match(
                r"(\d+)/(tcp|udp)\s+open\s+(\S+)\s*(.*)", line
            )
            if port_match:
                yield {
                    "ip": current_ip,
                    "port": int(port_match.group(1)),
                    "service": port_match.group(3),
                    "version": port_match.group(4).strip() or None,
                }
