def run_cascade_agent(cascade_physics: dict, timestep: int) -> dict:
    status = cascade_physics["cascade_status"]
    routes = cascade_physics["evacuation_routes"]
    if timestep == 0:
        timeline = [
            "T+0 fire perimeter visible",
            "T+3 predicted Line A failure if unmitigated",
            "T+4 predicted Malibu Substation outage",
            "T+5 predicted PCH signal failure",
            "T+6 predicted PCH evacuation degradation",
        ]
        finding = "No infrastructure has failed yet, but the dependency chain is exposed."
        trigger = "fire perimeter approaching Transmission Line A"
        next_failure = "transmission_line_A"
        confidence = 0.87
    else:
        timeline = [
            "T+3 fire crosses Transmission Line A",
            "T+4 Malibu Substation loses upstream power",
            "T+5 PCH traffic signals go dark",
            "T+6 PCH evacuation route blocks",
        ]
        finding = "The utility-to-traffic cascade is active and evacuation capacity is dropping."
        trigger = "fire perimeter intersects Transmission Line A"
        next_failure = "road_PCH" if timestep >= 6 else "PCH_signal_failure"
        confidence = 0.94

    if timestep == 0:
        map_annotations = [
            {
                "id": "cascade_preview",
                "label": "Cascade preview",
                "severity": "HIGH",
                "message": "Line A is the first preventable failure in the chain.",
            },
            {
                "id": "pch_route",
                "label": "PCH clear",
                "severity": "NORMAL",
                "message": "Pre-stage traffic control while the route is still open.",
            },
        ]
    else:
        map_annotations = [
            {
                "id": "transmission_line_A",
                "label": f"Line A {status['transmission_line_A']}",
                "severity": status["transmission_line_A"],
                "message": "Primary upstream utility asset in the cascade.",
            },
            {
                "id": "road_PCH",
                "label": f"PCH {routes['road_PCH']}",
                "severity": routes["road_PCH"],
                "message": "Traffic operations must replace failed signal control.",
            },
        ]

    return {
        "agent": "cascade_agent",
        "role": "Infrastructure dependency specialist",
        "finding": finding,
        "confidence": confidence,
        "trigger": trigger,
        "next_failure": next_failure,
        "node_status": status,
        "evacuation_routes": routes,
        "dependency_chain": [
            "transmission_line_A",
            "substation_malibu",
            "signal_PCH_1",
            "signal_PCH_2",
            "road_PCH",
        ],
        "cascade_timeline": timeline,
        "map_annotations": map_annotations,
        "recommended_actions": [
            {
                "agency": "utility_operator",
                "action": "Switch Malibu load to backup feed before signal loss.",
                "why": "Signals depend on the substation behind Line A.",
            },
            {
                "agency": "traffic_management",
                "action": "Send officers to PCH signals before they fail.",
                "why": "Manual control preserves evacuation flow when power drops.",
            },
        ],
    }
