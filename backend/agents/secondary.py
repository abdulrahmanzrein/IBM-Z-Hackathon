def run_debris_flow_agent(attempt: int) -> dict:
    """
    Deterministic demo agent.

    Attempt 1 intentionally hallucinates LOW so the physics validator has the
    visible rejection moment required by the PRD. Retry returns the corrected
    physics-aligned answer.
    """
    if attempt == 1:
        return {
            "agent": "debris_flow_agent",
            "threat_label": "LOW",
            "probability": 0.18,
            "onset_window": "4-6 hours post-rainfall",
            "affected_zones": ["burned slopes above Malibu"],
        }

    return {
        "agent": "debris_flow_agent",
        "threat_label": "HIGH",
        "probability": 0.71,
        "onset_window": "4-6 hours post-rainfall",
        "affected_zones": ["burned slopes above Malibu"],
    }
