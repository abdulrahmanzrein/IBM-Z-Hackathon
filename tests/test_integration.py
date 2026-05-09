import pytest
import requests

# Run this file only after P2's backend is live
# Command: pytest tests/test_integration.py -v

BASE_URL = "http://localhost:8000"

def test_backend_is_reachable():
    try:
        r = requests.post(f"{BASE_URL}/dispatch/wildfire/1", timeout=5)
        assert r.status_code in (200, 422)
    except requests.ConnectionError:
        pytest.fail("Backend is not running — start P2's server first")

def test_dispatch_returns_200():
    r = requests.post(f"{BASE_URL}/dispatch/wildfire/1", timeout=15)
    assert r.status_code == 200

def test_output_contract_shape():
    r = requests.post(f"{BASE_URL}/dispatch/wildfire/1", timeout=15)
    data = r.json()
    assert data["disaster_type"] == "wildfire"
    assert "timestep" in data
    assert "physics" in data
    assert "cascade_status" in data
    assert "evacuation_routes" in data
    assert "agents" in data
    assert "events" in data

def test_physics_fields_present():
    r = requests.post(f"{BASE_URL}/dispatch/wildfire/1", timeout=15)
    physics = r.json()["physics"]
    assert "threat_level" in physics
    assert "spread_rate_fpm" in physics
    assert "debris_probability" in physics
    assert physics["threat_level"] in ["CRITICAL", "HIGH", "ELEVATED", "MODERATE"]

def test_cascade_chain_at_T15():
    r = requests.post(f"{BASE_URL}/dispatch/wildfire/1", timeout=15)
    cascade = r.json()["cascade_status"]
    assert cascade["transmission_line_A"] == "FAILED"
    assert cascade["substation_malibu"] == "FAILED"
    assert cascade["signal_PCH_1"] == "FAILED"
    assert cascade["signal_PCH_2"] == "FAILED"
    assert cascade["road_PCH"] == "FAILED"

def test_evacuation_route_blocked():
    r = requests.post(f"{BASE_URL}/dispatch/wildfire/1", timeout=15)
    routes = r.json()["evacuation_routes"]
    assert routes["road_PCH"] == "BLOCKED"

def test_validator_rejects_debris_flow_agent():
    r = requests.post(f"{BASE_URL}/dispatch/wildfire/1", timeout=15)
    events = r.json()["events"]
    rejections = [e for e in events if e["type"] == "agent_rejected" and e["agent"] == "debris_flow_agent"]
    assert len(rejections) >= 1, "Validator must reject debris flow agent — key demo moment"

def test_validator_eventually_approves_debris_flow():
    r = requests.post(f"{BASE_URL}/dispatch/wildfire/1", timeout=15)
    events = r.json()["events"]
    validated = [e for e in events if e["type"] == "agent_validated" and e["agent"] == "debris_flow_agent"]
    assert len(validated) >= 1, "Debris flow agent must replan and get approved"

def test_all_three_agency_panels_populated():
    r = requests.post(f"{BASE_URL}/dispatch/wildfire/1", timeout=15)
    coordinator = r.json()["agents"]["coordinator"]
    agencies = coordinator["agencies"]
    assert "fire_incident_command" in agencies
    assert "utility_operator" in agencies
    assert "traffic_management" in agencies
    for name in ("fire_incident_command", "utility_operator", "traffic_management"):
        assert "recommendation" in agencies[name]
        assert "notifications" in agencies[name]

def test_events_include_rejection_before_validation():
    r = requests.post(f"{BASE_URL}/dispatch/wildfire/1", timeout=15)
    events = r.json()["events"]
    debris_events = [(i, e) for i, e in enumerate(events) if e["agent"] == "debris_flow_agent"]
    types = [e["type"] for _, e in debris_events]
    assert "agent_rejected" in types
    assert "agent_validated" in types
    rejected_idx = next(i for i, e in debris_events if e["type"] == "agent_rejected")
    validated_idx = next(i for i, e in debris_events if e["type"] == "agent_validated")
    assert rejected_idx < validated_idx, "Rejection must come before validation"
