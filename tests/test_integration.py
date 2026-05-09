# P3 owns — integration tests against P2's live backend (run after hour 20)
# Requires P2's backend running at localhost:8000

import pytest, requests

BASE_URL = "http://localhost:8000"

def test_dispatch_returns_valid_contract():
    r = requests.post(f"{BASE_URL}/dispatch/wildfire/1")
    assert r.status_code == 200
    data = r.json()
    assert data["disaster_type"] == "wildfire"
    assert "cascade_status" in data
    assert "events" in data

def test_validator_rejects_debris_flow():
    # Demo inputs — validator must catch LOW and force replan to HIGH
    r = requests.post(f"{BASE_URL}/dispatch/wildfire/1")
    events = r.json()["events"]
    rejections = [e for e in events if e["type"] == "agent_rejected" and e["agent"] == "secondary"]
    assert len(rejections) >= 1, "Validator must reject debris flow agent at least once"

def test_all_agency_panels_populated():
    r = requests.post(f"{BASE_URL}/dispatch/wildfire/1")
    coordinator = r.json()["agents"].get("coordinator", {})
    assert "fire_ic" in coordinator
    assert "utility" in coordinator
    assert "traffic" in coordinator
