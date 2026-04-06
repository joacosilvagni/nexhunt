import os
import glob
import time
from typing import AsyncIterator
from nexhunt.adapters.base import ToolAdapter
from nexhunt.config import settings


class GowitnessAdapter(ToolAdapter):
    name = "gowitness"
    binary_name = "gowitness"
    result_type = "screenshot"

    async def run(self, target: str, options: dict) -> AsyncIterator[dict]:
        screenshots_dir = options.get("screenshots_dir", settings.screenshots_dir)
        os.makedirs(screenshots_dir, exist_ok=True)

        # Snapshot files before scan to detect newly created screenshot
        before = set(glob.glob(os.path.join(screenshots_dir, "*.jpeg")) +
                     glob.glob(os.path.join(screenshots_dir, "*.jpg")) +
                     glob.glob(os.path.join(screenshots_dir, "*.png")))

        cmd = [
            self.binary_name, "scan", "single",
            "--url", target,
            "--screenshot-path", screenshots_dir,
            "--screenshot-format", "jpeg",
            "--delay", "2",
            "--chrome-path", "/usr/bin/chromium",
            "-q",
        ]

        async for line in self._run_subprocess(cmd, timeout=45):
            if line.strip():
                yield {"_raw": True, "line": line}

        # Find newly created screenshot
        after = set(glob.glob(os.path.join(screenshots_dir, "*.jpeg")) +
                    glob.glob(os.path.join(screenshots_dir, "*.jpg")) +
                    glob.glob(os.path.join(screenshots_dir, "*.png")))
        new_files = after - before

        if new_files:
            screenshot_path = max(new_files, key=os.path.getmtime)
            filename = os.path.basename(screenshot_path)
            yield {
                "_raw": False,
                "url": target,
                "path": screenshot_path,
                "filename": filename,
                "screenshot_url": f"/screenshots/{filename}",
            }
        else:
            yield {"_raw": True, "line": f"[gowitness] No screenshot produced for {target}"}
