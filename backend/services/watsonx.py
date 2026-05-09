import json
import os
from typing import Optional
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from backend.services.llm_json import parse_json_object


DEFAULT_WATSONX_URL = "https://us-south.ml.cloud.ibm.com"
DEFAULT_WATSONX_MODEL = "ibm/granite-3-8b-instruct"
WATSONX_VERSION = "2024-10-08"
IBM_IAM_TOKEN_URL = "https://iam.cloud.ibm.com/identity/token"


def _status(*, model: str, fallback_used: bool, reason: str = "") -> dict:
    return {
        "provider": "IBM watsonx.ai Granite",
        "model": model,
        "fallback_used": fallback_used,
        "reason": reason,
    }


def _get_bearer_token(opener: Optional[object] = None) -> tuple[Optional[str], str]:
    direct_token = os.getenv("WATSONX_BEARER_TOKEN")
    if direct_token:
        return direct_token, ""

    api_key = os.getenv("WATSONX_API_KEY")
    if not api_key:
        return None, "WATSONX_BEARER_TOKEN or WATSONX_API_KEY not configured"

    data = urlencode(
        {
            "grant_type": "urn:ibm:params:oauth:grant-type:apikey",
            "apikey": api_key,
        }
    ).encode("utf-8")
    request = Request(
        IBM_IAM_TOKEN_URL,
        data=data,
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
        },
        method="POST",
    )

    open_fn = opener or urlopen
    try:
        with open_fn(request, timeout=8) as response:
            payload = json.loads(response.read().decode("utf-8"))
        return payload.get("access_token"), ""
    except Exception as exc:
        return None, f"IBM IAM token fetch failed: {exc}"


def _extract_message_content(payload: dict) -> str:
    if "choices" in payload:
        return payload["choices"][0]["message"]["content"]
    if "results" in payload:
        return payload["results"][0].get("generated_text", "")
    raise KeyError("watsonx response missing choices/results")


def run_watsonx_json_coordinator(
    *,
    payload: dict,
    fallback_output: dict,
    model: Optional[str] = None,
    opener: Optional[object] = None,
) -> tuple[dict, dict]:
    selected_model = model or os.getenv("WATSONX_MODEL_ID", DEFAULT_WATSONX_MODEL)
    project_id = os.getenv("WATSONX_PROJECT_ID")
    if not project_id:
        return fallback_output, _status(
            model=selected_model,
            fallback_used=True,
            reason="WATSONX_PROJECT_ID not configured",
        )

    token, token_error = _get_bearer_token(opener=opener)
    if not token:
        return fallback_output, _status(
            model=selected_model,
            fallback_used=True,
            reason=token_error,
        )

    base_url = os.getenv("WATSONX_URL", DEFAULT_WATSONX_URL).rstrip("/")
    url = f"{base_url}/ml/v1/text/chat?version={WATSONX_VERSION}"
    body = {
        "model_id": selected_model,
        "project_id": project_id,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are the StormOS Coordinator. Return only valid JSON with "
                    "priority and agencies fields. Keep recommendations concise."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Inputs:\n{json.dumps(payload, sort_keys=True)}\n"
                    f"Fallback schema example:\n{json.dumps(fallback_output, sort_keys=True)}"
                ),
            },
        ],
        "parameters": {
            "temperature": 0.1,
            "max_new_tokens": 600,
        },
    }
    request = Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )

    open_fn = opener or urlopen
    try:
        with open_fn(request, timeout=10) as response:
            response_payload = json.loads(response.read().decode("utf-8"))
        output = parse_json_object(_extract_message_content(response_payload))
    except Exception as exc:
        return fallback_output, _status(
            model=selected_model,
            fallback_used=True,
            reason=f"watsonx call failed: {exc}",
        )

    return output, _status(model=selected_model, fallback_used=False)
