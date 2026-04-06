"""
AI Copilot service — powered by Groq (llama-3.3-70b-versatile).
Falls back to Claude or OpenAI if configured.
Automatically pulls full session context from the database on every call.
"""
import logging
from nexhunt.config import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are NexHunt AI Copilot, an elite bug bounty hunter and penetration tester built into a security research platform.

You have deep expertise in:
- Web application security (XSS, SQLi, SSRF, IDOR, XXE, RCE, LFI, SSTI, Open Redirect, CORS, OAuth flaws)
- Bug bounty methodologies (HackerOne, Bugcrowd, Intigriti, Synack)
- Recon techniques: subdomain enumeration, tech fingerprinting, attack surface mapping
- Exploitation: PoC development, chained attacks, bypass techniques
- Tools: Nuclei, Burp Suite, ffuf, sqlmap, amass, httpx, gowitness, dalfox, nmap
- Report writing: CVSS scoring, impact analysis, professional disclosure format

When given session data (findings, subdomains, live hosts, ports), think like a senior pentester:
1. Identify the most impactful vulnerabilities and their bounty potential
2. Spot attack chains (e.g., SSRF → internal access → RCE)
3. Flag likely false positives with reasoning
4. Suggest specific follow-up tests with exact commands/payloads
5. Prioritize by real exploitability, not just severity label

**Response formatting rules:**
- Use markdown: ## for sections, **bold** for critical info, `code` for commands/payloads
- Use code blocks (```) for multi-line commands, HTTP requests, or payloads
- Keep responses concise but complete — bullet points over long paragraphs
- Always end analysis with concrete "Next Steps" section

**Bug bounty report format when asked:**
```
## [Vulnerability Type] in [Feature/Endpoint]
**Severity:** Critical/High/Medium/Low
**CVSS:** X.X (AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H)

### Description
[Technical explanation]

### Steps to Reproduce
1. [Step]
2. [Step]

### Impact
[What an attacker can do with this]

### Remediation
[How to fix it]

### References
- CWE-XXX
- https://...
```"""


class CopilotService:
    async def chat(self, message: str, context: dict = {}) -> str:
        """Send a message with full auto-context to the AI."""
        ctx_str = await self._build_full_context(context)
        full_message = f"{ctx_str}\n\n---\n\n{message}" if ctx_str else message

        if settings.ai_provider == "groq" and settings.ai_groq_key:
            return await self._chat_groq(full_message)
        elif settings.ai_provider == "claude" and settings.ai_api_key:
            return await self._chat_claude(full_message)
        elif settings.ai_provider == "openai" and settings.ai_api_key:
            return await self._chat_openai(full_message)
        else:
            return (
                "⚠️ No AI API key configured.\n\n"
                "Go to **Settings → AI Copilot** and add your Groq API key.\n\n"
                "Get a free key at: https://console.groq.com"
            )

    async def analyze_all(self) -> str:
        """Full auto-analysis: pull everything from DB and ask for comprehensive analysis."""
        ctx = await self._build_full_context({})
        if not ctx:
            return "No data to analyze yet. Run some recon and scans first."

        prompt = (
            f"{ctx}\n\n---\n\n"
            "Perform a comprehensive security analysis of the session data above. Structure your response as:\n\n"
            "## Executive Summary\n"
            "## Critical & High Findings (prioritized by bounty potential)\n"
            "## Attack Surface Assessment\n"
            "## Detected Technologies & Known Vulnerabilities\n"
            "## Recommended Attack Vectors (with specific commands)\n"
            "## Immediate Next Steps\n\n"
            "Be specific, technical, and actionable. Include exact nuclei templates, tool commands, or payloads where relevant."
        )
        return await self._dispatch(prompt)

    async def generate_report(self, finding_id: str | None = None) -> str:
        """Generate a professional bug bounty report for a finding (or all critical/high)."""
        ctx = await self._build_full_context({})
        if finding_id:
            prompt = f"{ctx}\n\n---\n\nGenerate a professional bug bounty report for finding ID: {finding_id}. Use the standard format with CVSS score, steps to reproduce, impact, and remediation."
        else:
            prompt = f"{ctx}\n\n---\n\nGenerate professional bug bounty reports for all critical and high severity findings. For each finding, include: severity, CVSS, description, steps to reproduce, impact, and remediation."
        return await self._dispatch(prompt)

    async def _dispatch(self, message: str) -> str:
        if settings.ai_provider == "groq" and settings.ai_groq_key:
            return await self._chat_groq(message)
        elif settings.ai_provider == "claude" and settings.ai_api_key:
            return await self._chat_claude(message)
        elif settings.ai_provider == "openai" and settings.ai_api_key:
            return await self._chat_openai(message)
        return "No AI provider configured."

    async def _chat_groq(self, message: str) -> str:
        """Call Groq via OpenAI-compatible API."""
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(
                api_key=settings.ai_groq_key,
                base_url="https://api.groq.com/openai/v1",
            )
            resp = await client.chat.completions.create(
                model=settings.ai_model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": message},
                ],
                max_tokens=4096,
                temperature=0.3,
            )
            return resp.choices[0].message.content or ""
        except Exception as e:
            logger.error(f"Groq error: {e}")
            return f"Groq API error: {e}"

    async def _chat_claude(self, message: str) -> str:
        try:
            import anthropic
            client = anthropic.AsyncAnthropic(api_key=settings.ai_api_key)
            resp = await client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=4096,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": message}],
            )
            return resp.content[0].text
        except Exception as e:
            logger.error(f"Claude error: {e}")
            return f"Claude API error: {e}"

    async def _chat_openai(self, message: str) -> str:
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=settings.ai_api_key)
            resp = await client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": message},
                ],
                max_tokens=4096,
            )
            return resp.choices[0].message.content or ""
        except Exception as e:
            logger.error(f"OpenAI error: {e}")
            return f"OpenAI API error: {e}"

    async def _build_full_context(self, user_context: dict) -> str:
        """Pull ALL session data: findings from DB + recon from frontend context."""
        parts: list[str] = []

        # ── Active target ──────────────────────────────────────────────────────
        if user_context.get("target"):
            parts.append(f"## Active Target\n{user_context['target']}")

        # ── Findings from DB (full history) ───────────────────────────────────
        try:
            from nexhunt.database import DefaultSession
            from nexhunt.models.finding import Finding
            from sqlalchemy import select

            async with DefaultSession() as session:
                result = await session.execute(
                    select(Finding).order_by(Finding.created_at.desc()).limit(150)
                )
                db_findings = result.scalars().all()

            if db_findings:
                by_sev: dict[str, list] = {}
                for f in db_findings:
                    by_sev.setdefault(f.severity or "info", []).append(f)

                counts = {s: len(v) for s, v in by_sev.items()}
                summary = ", ".join(f"{s.upper()}: {c}" for s, c in counts.items())
                parts.append(f"\n## Security Findings ({len(db_findings)} total — {summary})")

                for sev in ["critical", "high", "medium", "low", "info"]:
                    if sev not in by_sev:
                        continue
                    parts.append(f"\n### {sev.upper()} ({len(by_sev[sev])})")
                    for f in by_sev[sev][:15]:
                        line = f"- **{f.title}**"
                        if f.url:
                            line += f" | `{f.url}`"
                        if f.tool:
                            line += f" | tool: {f.tool}"
                        if f.template_id:
                            line += f" | template: {f.template_id}"
                        parts.append(line)
                        if f.description:
                            parts.append(f"  > {f.description[:180]}")
                        if f.evidence:
                            parts.append(f"  > Evidence: `{str(f.evidence)[:120]}`")
        except Exception as e:
            logger.warning(f"Could not fetch findings from DB: {e}")

        # ── Live hosts (from frontend context) ────────────────────────────────
        if user_context.get("live_hosts"):
            hosts = user_context["live_hosts"]
            parts.append(f"\n## Live Hosts ({len(hosts)})")
            for h in hosts[:40]:
                url = h.get("url", "")
                sc = h.get("status_code", "?")
                techs = ", ".join(h.get("technologies", [])[:6])
                title = h.get("title", "")
                line = f"- `{url}` [{sc}]"
                if title:
                    line += f" — {title}"
                if techs:
                    line += f" — *{techs}*"
                parts.append(line)

        # ── Subdomains ─────────────────────────────────────────────────────────
        if user_context.get("subdomains"):
            subs = user_context["subdomains"]
            parts.append(f"\n## Subdomains ({len(subs)})")
            parts.append(", ".join(f"`{s.get('subdomain', '')}`" for s in subs[:60]))

        # ── Open ports ────────────────────────────────────────────────────────
        if user_context.get("ports"):
            ports = user_context["ports"]
            parts.append(f"\n## Open Ports ({len(ports)})")
            for p in ports[:30]:
                svc = p.get("service", "")
                ver = p.get("version", "")
                parts.append(f"- `{p.get('ip', '')}:{p.get('port', '')}` {svc} {ver}".strip())

        # ── Discovered URLs ───────────────────────────────────────────────────
        if user_context.get("urls"):
            urls = user_context["urls"]
            parts.append(f"\n## Discovered URLs ({len(urls)} total, showing 20)")
            for u in urls[:20]:
                parts.append(f"- `{u.get('url', '')}`")

        return "\n".join(parts)


copilot_service = CopilotService()
