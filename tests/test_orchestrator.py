# P3 owns — tests orchestrator routing with mock agent responses (no P2 needed)

import pytest

MOCK_AGENT_RESPONSE = {
    "disaster_type": "wildfire",
    "timestep": 0,
    "physics": {
        "threat_level": "CRITICAL",
        "spread_rate_fpm": 120,
        "debris_probability": 0.71
    },
    "cascade_status": {
        "transmission_line_A": "FAILED",
        "substation_malibu": "FAILED",
        "signal_PCH_1": "FAILED",
        "signal_PCH_2": "FAILED",
        "road_PCH": "BLOCKED"
    },
    "evacuation_routes": { "road_PCH": "BLOCKED" },
    "agents": {},
    "events": []
}

def test_cascade_propagation():
    # if Line A is FAILED, everything downstream must be FAILED
    cascade = MOCK_AGENT_RESPONSE["cascade_status"]
    assert cascade["substation_malibu"] == "FAILED"
    assert cascade["signal_PCH_1"] == "FAILED"
    assert cascade["signal_PCH_2"] == "FAILED"
    assert cascade["road_PCH"] == "BLOCKED"

def test_output_contract_shape():
    r = MOCK_AGENT_RESPONSE
    assert "disaster_type" in r
    assert "physics" in r
    assert "cascade_status" in r
    assert "evacuation_routes" in r
    assert "events" in r
