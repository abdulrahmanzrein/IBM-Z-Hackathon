import json
import os
from typing import Optional
from urllib.request import Request, urlopen

from backend.services.llm_json import parse_json_object


FEATHERLESS_CHAT_URL = "https://api.featherless.ai/v1/chat/completions"
DEFAULT_FEATHERLESS_MODEL = "Qwen/Qwen2.5-7B-Instruct"


def _status(*, model: str, fallback_used: bool, reason: str = "") -> dict:
    return {
        "provider": "Featherless",
        "model": model,
        "fallback_used": fallback_used,
        "reason": reason,
    }


def run_featherless_json_agent(
    *,
    agent_name: str,
    system_prompt: str,
    payload: dict,
    fallback_output: dict,
    model: Optional[str] = None,
    opener: Optional[object] = None,
) -> tuple[dict, dict]:
    api_key = os.getenv("FEATHERLESS_API_KEY")
    selected_model = model or os.getenv("FEATHERLESS_MODEL", DEFAULT_FEATHERLESS_MODEL)

    if not api_key:
        return fallback_output, _status(
            model=selected_model,
            fallback_used=True,
            reason="FEATHERLESS_API_KEY not configured",
        )

    body = {
        "model": selected_model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": (
                    f"Agent: {agent_name}\n"
                    "Return only valid JSON matching the fallback schema.\n"
                    f"Inputs:\n{json.dumps(payload, sort_keys=True)}\n"
                    f"Fallback schema example:\n{json.dumps(fallback_output, sort_keys=True)}"
                ),
            },
        ],
        "temperature": 0.1,
        "max_tokens": 500,
    }
    request = Request(
        FEATHERLESS_CHAT_URL,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/abdulrahmanzrein/IBM-Z-Hackathon",
            "X-Title": "StormOS",
        },
        method="POST",
    )

    open_fn = opener or urlopen
    try:
        with open_fn(request, timeout=8) as response:
            response_payload = json.loads(response.read().decode("utf-8"))
        content = response_payload["choices"][0]["message"]["content"]
        output = parse_json_object(content)
    except Exception as exc:
        return fallback_output, _status(
            model=selected_model,
            fallback_used=True,
            reason=f"Featherless call failed: {exc}",
        )

    output.setdefault("agent", fallback_output.get("agent", agent_name))
    return output, _status(model=selected_model, fallback_used=False)
