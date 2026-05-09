def run_hazard_agent(fire_physics: dict) -> dict:
    # Agent output is currently deterministic for the PRD baseline.
    return {
        "agent": "hazard_agent",
        "threat_level": fire_physics["threat_level"],
        "spread_rate_fpm": fire_physics["spread_rate_fpm"],
        "direction": "southwest toward Pacific Coast Highway",
        "structures_at_risk_30min": 4200,
    }
