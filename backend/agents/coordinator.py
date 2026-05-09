def run_coordinator_agent(timestep: int) -> dict:
    # Three agencies get one concise tactical recommendation each.
    if timestep == 0:
        return {
            "priority": "P2",
            "agencies": {
                "fire_incident_command": {
                    "recommendation": "Monitor flank approaching Transmission Line A.",
                    "notifications": [
                        "Threat is CRITICAL",
                        "Line A operational",
                        "PCH route clear",
                    ],
                },
                "utility_operator": {
                    "recommendation": "Stage switching crew near Substation B.",
                    "notifications": [
                        "Line A operational",
                        "Substation operational",
                        "Prepare backup feed",
                    ],
                },
                "traffic_management": {
                    "recommendation": "Pre-stage officers near PCH intersections.",
                    "notifications": [
                        "PCH signals operational",
                        "Route status CLEAR",
                        "Watch evacuation volume",
                    ],
                },
            },
        }

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
