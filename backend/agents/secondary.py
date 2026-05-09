def run_debris_flow_agent(attempt: int) -> dict:
    """
    Deterministic demo agent.

    Attempt 1 intentionally hallucinates LOW so the physics validator has the
    visible rejection moment required by the PRD. Retry returns the corrected
    physics-aligned answer.
    """
    # First try is intentionally wrong for the demo rejection.
    if attempt == 1:
        return {
            "agent": "debris_flow_agent",
            "role": "Secondary hazard specialist",
            "finding": "Initial model underestimates post-fire debris-flow risk.",
            "threat_label": "LOW",
            "probability": 0.18,
            "confidence": 0.42,
            "trigger": "burned slope plus rainfall threshold",
            "onset_window": "4-6 hours post-rainfall",
            "affected_zones": ["burned slopes above Malibu"],
            "map_annotations": [
                {
                    "id": "debris_flow_zone_malibu",
                    "label": "Debris flow LOW",
                    "severity": "LOW",
                    "message": "This intentionally conflicts with USGS M1 physics for validator demo.",
                }
            ],
            "recommended_actions": [
                {
                    "agency": "fire_incident_command",
                    "action": "Monitor burned slopes after rainfall.",
                    "why": "Initial output says low risk, pending validator review.",
                }
            ],
        }

    return {
        "agent": "debris_flow_agent",
        "role": "Secondary hazard specialist",
        "finding": "Burned slopes above Malibu have high debris-flow probability after rainfall.",
        "threat_label": "HIGH",
        "probability": 0.71,
        "confidence": 0.89,
        "trigger": "slope 34 degrees, burn severity 78 percent, rainfall 0.75 in/hr",
        "onset_window": "4-6 hours post-rainfall",
        "affected_zones": ["burned slopes above Malibu"],
        "map_annotations": [
            {
                "id": "debris_flow_zone_malibu",
                "label": "Debris flow HIGH",
                "severity": "HIGH",
                "message": "Keep crews and evacuees out of burned slope drainage paths.",
            }
        ],
        "recommended_actions": [
            {
                "agency": "fire_incident_command",
                "action": "Hold crews outside the debris-flow polygon.",
                "why": "Post-fire slope failure risk is high after rainfall.",
            },
            {
                "agency": "traffic_management",
                "action": "Maintain PCH closure near debris runout areas.",
                "why": "Secondary hazard can block evacuation and responder access.",
            },
        ],
    }
