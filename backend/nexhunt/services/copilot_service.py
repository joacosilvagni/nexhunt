"""
AI Copilot service. Supports Claude (Anthropic) and OpenAI.
Sends context about the current session along with the user message.
"""
import logging
from nexhunt.config import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are NexHunt AI Copilot, an expert bug bounty hunting assistant.
You help security researchers analyze findings, prioritize vulnerabilities, suggest next steps,
and generate professional bug bounty reports.

Your role is ADVISORY only - you analyze data and suggest actions, but the user decides what to execute.

When analyzing findings:
- Prioritize by real-world impact and bounty potential
- Suggest specific exploitation steps for verified vulnerabilities
- Flag false positives based on context
- Recommend follow-up tests

When generating reports:
- Follow standard bug bounty report format (Title, Severity, Description, Steps to Reproduce, Impact, Remediation)
- Be precise and professional
- Include proof-of-concept where applicable

Always be concise, technical, and actionable."""


class CopilotService:
    async def chat(self, message: str, context: dict = {}) -> str:
        """Send a message to the AI and return the response."""
        if not settings.ai_api_key:
            return (
                "No API key configured. Go to Settings and add your API key.\n\n"
                "Supported providers:\n"
                "- Claude (Anthropic): Get key at console.anthropic.com\n"
                "- OpenAI: Get key at platform.openai.com"
            )

        if settings.ai_provider == "claude":
            return await self._chat_claude(message, context)
        elif settings.ai_provider == "openai":
            return await self._chat_openai(message, context)
        else:
            return f"Unknown AI provider: {settings.ai_provider}"

    async def _chat_claude(self, message: str, context: dict) -> str:
        try:
            import anthropic
            client = anthropic.AsyncAnthropic(api_key=settings.ai_api_key)

            # Build context string
            ctx_str = self._build_context_string(context)
            full_message = f"{ctx_str}\n\n{message}" if ctx_str else message

            response = await client.messages.create(
                model=settings.ai_model,
                max_tokens=2048,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": full_message}]
            )
            return response.content[0].text
        except Exception as e:
            logger.error(f"Claude API error: {e}")
            return f"Claude API error: {e}"

    async def _chat_openai(self, message: str, context: dict) -> str:
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=settings.ai_api_key)

            ctx_str = self._build_context_string(context)
            full_message = f"{ctx_str}\n\n{message}" if ctx_str else message

            response = await client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": full_message}
                ],
                max_tokens=2048
            )
            return response.choices[0].message.content or ""
        except Exception as e:
            logger.error(f"OpenAI API error: {e}")
            return f"OpenAI API error: {e}"

    def _build_context_string(self, context: dict) -> str:
        """Build a context string from session data."""
        parts = []

        if context.get("findings"):
            findings = context["findings"]
            parts.append(f"## Current Findings ({len(findings)} total)")
            for f in findings[:20]:  # Limit to 20
                parts.append(f"- [{f.get('severity', 'info').upper()}] {f.get('title', 'Unknown')} - {f.get('url', '')}")

        if context.get("subdomains"):
            subs = context["subdomains"]
            parts.append(f"\n## Discovered Subdomains ({len(subs)})")
            parts.append(", ".join(s.get("subdomain", "") for s in subs[:30]))

        if context.get("target"):
            parts.insert(0, f"## Target: {context['target']}\n")

        return "\n".join(parts)


copilot_service = CopilotService()
