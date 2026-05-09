def run_coordinator_agent() -> dict:
    # Three agencies get one concise tactical recommendation each.
    return {
        "priority": "P1",
        "agencies": {
            "fire_incident_command": {
                "recommendation": "Protect Transmission Line A before flank crosses.",
                "notifications": [
                    "Threat is CRITICAL",
                    "Line A in fire path",
                    "Debris risk HIGH",
                ],
            },
            "utility_operator": {
                "recommendation": "Begin emergency switching to Substation B.",
                "notifications": [
                    "Line A FAILED",
                    "Malibu Substation FAILED",
                    "Downstream signals dark",
                ],
            },
            "traffic_management": {
                "recommendation": "Deploy manual officers to PCH intersections now.",
                "notifications": [
                    "PCH signals FAILED",
                    "Route status BLOCKED",
                    "Evacuation window 12 min",
                ],
            },
        },
    }
