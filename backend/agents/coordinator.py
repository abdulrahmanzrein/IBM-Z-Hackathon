def run_coordinator_agent(timestep: int) -> dict:
    # Final responder-facing synthesis. watsonx uses this exact schema as guardrail.
    if timestep == 0:
        return {
            "priority": "P2",
            "incident_objective": "Prevent the first infrastructure failure before evacuation slows.",
            "dispatch_summary": "Act now: defend Line A and pre-stage traffic control while PCH is clear.",
            "decision_window_min": 12,
            "confidence": 0.88,
            "map_focus": [
                "transmission_line_A",
                "PCH_evacuation_corridor",
                "structure_exposure_cluster",
            ],
            "agencies": {
                "fire_incident_command": {
                    "recommendation": "Defend Line A before fire reaches the corridor.",
                    "notifications": [
                        "Threat is CRITICAL",
                        "Line A operational",
                        "PCH route clear",
                    ],
                    "map_target": "transmission_line_A",
                    "why": "Line A is the first failure that can trigger the full cascade.",
                },
                "utility_operator": {
                    "recommendation": "Prepare backup feed switching for Malibu load.",
                    "notifications": [
                        "Line A operational",
                        "Substation operational",
                        "Prepare backup feed",
                    ],
                    "map_target": "substation_malibu",
                    "why": "Backup switching prevents signal outages if Line A fails.",
                },
                "traffic_management": {
                    "recommendation": "Pre-stage officers near PCH intersections.",
                    "notifications": [
                        "PCH signals operational",
                        "Route status CLEAR",
                        "Watch evacuation volume",
                    ],
                    "map_target": "PCH_signal_cluster",
                    "why": "Manual control preserves evacuation flow during power loss.",
                },
            },
        }

    if timestep == 3:
        return {
            "priority": "P1",
            "incident_objective": "Contain the active utility-to-traffic cascade before PCH blocks.",
            "dispatch_summary": "Line A has failed: switch load, control PCH signals, and protect exposed homes.",
            "decision_window_min": 3,
            "confidence": 0.93,
            "map_focus": [
                "transmission_line_A",
                "substation_malibu",
                "PCH_signal_cluster",
                "PCH_evacuation_corridor",
            ],
            "agencies": {
                "fire_incident_command": {
                    "recommendation": "Protect homes and hold the utility corridor.",
                    "notifications": [
                        "Threat is CRITICAL",
                        "Line A FAILED",
                        "Homes exposed",
                    ],
                    "map_target": "structure_exposure_cluster",
                    "why": "Suppression buys time for evacuation before PCH degrades.",
                },
                "utility_operator": {
                    "recommendation": "Complete emergency switching to Substation B.",
                    "notifications": [
                        "Line A FAILED",
                        "Malibu Substation FAILED",
                        "Signals at risk",
                    ],
                    "map_target": "substation_malibu",
                    "why": "Traffic signals depend on downstream utility recovery.",
                },
                "traffic_management": {
                    "recommendation": "Deploy officers to PCH signalized intersections.",
                    "notifications": [
                        "Signals failing",
                        "Route status DEGRADED",
                        "Evacuation window closing",
                    ],
                    "map_target": "PCH_evacuation_corridor",
                    "why": "Manual control keeps evacuation moving after signal failure.",
                },
            },
        }

    return {
        "priority": "P1",
        "incident_objective": "Protect life safety after evacuation infrastructure is compromised.",
        "dispatch_summary": "PCH is blocked: route evacuees westbound and keep responders out of debris-flow zones.",
        "decision_window_min": 0,
        "confidence": 0.94,
        "map_focus": [
            "PCH_evacuation_corridor",
            "debris_flow_zone_malibu",
            "responder_staging_area",
        ],
        "agencies": {
            "fire_incident_command": {
                "recommendation": "Hold crews outside the debris-flow polygon.",
                "notifications": [
                    "Threat is CRITICAL",
                    "PCH route BLOCKED",
                    "Debris risk HIGH",
                ],
                "map_target": "debris_flow_zone_malibu",
                "why": "Secondary hazards now threaten responders and evacuees.",
            },
            "utility_operator": {
                "recommendation": "Restore from backup feed after cascade isolation.",
                "notifications": [
                    "Line A FAILED",
                    "Malibu Substation FAILED",
                    "Downstream signals dark",
                ],
                "map_target": "substation_malibu",
                "why": "Restoration work must avoid the fire and debris-flow corridors.",
            },
            "traffic_management": {
                "recommendation": "Maintain PCH closure and reroute evacuees westbound.",
                "notifications": [
                    "PCH signals FAILED",
                    "Route status BLOCKED",
                    "Use alternate control points",
                ],
                "map_target": "PCH_evacuation_corridor",
                "why": "The main route is compromised and needs active traffic control.",
            },
        },
    }
