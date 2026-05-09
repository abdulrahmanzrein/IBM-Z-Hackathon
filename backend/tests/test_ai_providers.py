import json

from backend.services.featherless import run_featherless_json_agent
from backend.services.llm_json import parse_json_object
from backend.services.watsonx import run_watsonx_json_coordinator


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def read(self):
        return json.dumps(self.payload).encode("utf-8")


def test_parse_json_object_handles_code_fence():
    parsed = parse_json_object('```json\n{"priority": "P1"}\n```')

    assert parsed == {"priority": "P1"}


def test_featherless_missing_key_uses_fallback(monkeypatch):
    monkeypatch.delenv("FEATHERLESS_API_KEY", raising=False)
    fallback = {"agent": "hazard_agent", "threat_level": "CRITICAL"}

    output, status = run_featherless_json_agent(
        agent_name="hazard_agent",
        system_prompt="Return JSON.",
        payload={"x": 1},
        fallback_output=fallback,
    )

    assert output == fallback
    assert status["provider"] == "Featherless"
    assert status["fallback_used"] is True


def test_featherless_success_parses_json(monkeypatch):
    monkeypatch.setenv("FEATHERLESS_API_KEY", "test-key")

    def fake_opener(request, timeout):
        return FakeResponse(
            {
                "choices": [
                    {
                        "message": {
                            "content": '{"agent": "hazard_agent", "threat_level": "CRITICAL"}'
                        }
                    }
                ]
            }
        )

    output, status = run_featherless_json_agent(
        agent_name="hazard_agent",
        system_prompt="Return JSON.",
        payload={"x": 1},
        fallback_output={"agent": "hazard_agent"},
        opener=fake_opener,
    )

    assert output["threat_level"] == "CRITICAL"
    assert status["fallback_used"] is False


def test_watsonx_missing_project_uses_fallback(monkeypatch):
    monkeypatch.delenv("WATSONX_PROJECT_ID", raising=False)
    fallback = {"priority": "P1", "agencies": {}}

    output, status = run_watsonx_json_coordinator(
        payload={"x": 1},
        fallback_output=fallback,
    )

    assert output == fallback
    assert status["provider"] == "IBM watsonx.ai Granite"
    assert status["fallback_used"] is True
