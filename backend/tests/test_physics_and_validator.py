from backend.agents.secondary import run_debris_flow_agent
from backend.physics.cascade import compute_cascade
from backend.physics.debris import compute_debris_physics
from backend.physics.fire import compute_fire_physics
from backend.validator import validate_debris_agent


def test_fire_threat_is_critical_for_prd_conditions():
    result = compute_fire_physics(slope_deg=34, wind_mph=35, fuel_base_rate_fpm=2.8)

    assert result["threat_level"] == "CRITICAL"


def test_cascade_propagates_line_failure_to_pch_blockage():
    result = compute_cascade(fire_crosses_line_a=True)

    assert result["cascade_status"]["transmission_line_A"] == "FAILED"
    assert result["cascade_status"]["substation_malibu"] == "FAILED"
    assert result["cascade_status"]["signal_PCH_1"] == "FAILED"
    assert result["cascade_status"]["signal_PCH_2"] == "FAILED"
    assert result["evacuation_routes"]["road_PCH"] == "BLOCKED"


def test_debris_probability_matches_prd_demo_value():
    result = compute_debris_physics(slope_deg=34, burn_severity=0.78, rainfall_in_hr=0.75)

    assert result["debris_probability"] == 0.71
    assert result["debris_threat"] == "HIGH"


def test_validator_rejects_low_debris_output_then_accepts_high():
    debris_physics = compute_debris_physics(slope_deg=34, burn_severity=0.78, rainfall_in_hr=0.75)

    first = validate_debris_agent(debris_physics, run_debris_flow_agent(1), attempt=1)
    second = validate_debris_agent(debris_physics, run_debris_flow_agent(2), attempt=2)

    assert first["valid"] is False
    assert first["event"]["type"] == "agent_rejected"
    assert "P=0.71 (HIGH)" in first["event"]["violation"]
    assert second["valid"] is True
    assert second["event"]["type"] == "agent_validated"
