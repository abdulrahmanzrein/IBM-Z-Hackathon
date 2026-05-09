from typing import Optional


MAX_RETRIES = 2


def make_event(
    *,
    event_type: str,
    agent: str,
    output: Optional[dict] = None,
    violation: str = "",
    retry: Optional[int] = None,
) -> dict:
    event = {
        "type": event_type,
        "agent": agent,
        "violation": violation,
        "output": output or {},
    }
    if retry is not None:
        event["retry"] = retry
    return event


def validate_debris_agent(debris_physics: dict, agent_output: dict, attempt: int) -> dict:
    expected = debris_physics["debris_threat"]
    actual = agent_output.get("threat_label")

    if actual != expected:
        inputs = debris_physics["inputs"]
        violation = (
            "Physics violation: USGS M1 calculates "
            f"P={debris_physics['debris_probability']} ({expected}) at "
            f"slope={inputs['slope_deg']}°, "
            f"burn_severity={int(inputs['burn_severity'] * 100)}%, "
            f"rainfall={inputs['rainfall_in_hr']}in/hr. "
            f"You MUST escalate to {expected}. Retry {attempt}/{MAX_RETRIES}."
        )
        return {
            "valid": False,
            "event": make_event(
                event_type="agent_rejected",
                agent="debris_flow_agent",
                output=agent_output,
                violation=violation,
                retry=attempt,
            ),
        }

    return {
        "valid": True,
        "event": make_event(
            event_type="agent_validated",
            agent="debris_flow_agent",
            output=agent_output,
        ),
    }
