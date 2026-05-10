def run_hazard_agent(fire_physics: dict, timestep: int = 0) -> dict:
    # Keep this fallback responder-facing so the demo still works without keys.
    threat_level = fire_physics["threat_level"]
    spread_rate = fire_physics["spread_rate_fpm"]
    eta_line_a = max(0, 3 - timestep)

    return {
        "agent": "hazard_agent",
        "role": "Fire behavior and exposure specialist",
        "finding": "Wind and slope are pushing the active flank toward the utility corridor.",
        "threat_level": threat_level,
        "confidence": 0.91,
        "spread_rate_fpm": spread_rate,
        "direction": "southwest toward Pacific Coast Highway",
        "time_horizon_min": 30,
        "trigger": "slope > 20 degrees and wind > 25 mph",
        "affected_assets": [
            "transmission_line_A",
            "structure_exposure_cluster",
            "PCH_evacuation_corridor",
        ],
        "map_annotations": [
            {
                "id": "fire_front",
                "label": f"Fire front {threat_level}",
                "severity": threat_level,
                "message": "Active perimeter is aligned with wind and canyon fuel.",
            },
            {
                "id": "line_a_exposure",
                "label": f"Line A ETA {eta_line_a} min",
                "severity": "CRITICAL" if eta_line_a == 0 else "HIGH",
                "message": "Protect this corridor before the cascade reaches traffic systems.",
            },
        ],
        "recommended_actions": [
            {
                "agency": "fire_incident_command",
                "action": "Move suppression resources to the Line A corridor.",
                "why": "Utility failure will trigger downstream evacuation impacts.",
            },
            {
                "agency": "evacuation_branch",
                "action": "Warn exposed neighborhoods before PCH slows.",
                "why": "4,200 residents are inside the structure exposure cluster.",
            },
        ],
        "structures_at_risk_30min": 4200,
    }
