import pytest
import asyncio
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from orchestrator.router import propagate_cascade, load_infrastructure
from orchestrator.event_stream import get_log, clear

# --- Mock agents ---

async def mock_hazard_agent(inputs, violation):
    return {
        "threat_level": "CRITICAL",
        "spread_rate_fpm": 120,
        "structures_at_risk": 4200
    }

async def mock_cascade_agent(inputs, violation):
    return {
        "cascade_status": inputs["cascade_status"],
        "evacuation_route_passable": False
    }

async def mock_secondary_agent(inputs, violation):
    if violation:
        return {"debris_probability": 0.71, "threat_label": "HIGH", "onset_window": "4-6 hours", "affected_zones": ["Malibu hillside"]}
    return {"debris_probability": 0.2, "threat_label": "LOW", "onset_window": "unknown", "affected_zones": []}

async def mock_coordinator(hazard, cascade, secondary):
    return {
        "fire_ic": "Pre-position tankers at Malibu Canyon Road",
        "utility": "Begin emergency switching on Substation B",
        "traffic": "Deploy manual officers to PCH before signals fail"
    }

# --- Mock validators ---

def mock_hazard_validator(output, inputs):
    return True, None

def mock_cascade_validator(output, inputs):
    return True, None

def mock_secondary_validator(output, inputs):
    # Reject if agent output is LOW — physics says HIGH on demo inputs
    if output.get("threat_label") == "LOW":
        return False, "Physics violation: USGS M1 calculates P=0.71 (HIGH) at slope=34°, burn_severity=78%, rainfall=0.75in/hr. You MUST escalate to HIGH."
    return True, None

# --- Tests ---

def test_cascade_propagation_from_line_a():
    graph = load_infrastructure()
    statuses = propagate_cascade(graph, "transmission_line_A")
    assert statuses["substation_malibu"] == "FAILED"
    assert statuses["signal_PCH_1"] == "FAILED"
    assert statuses["signal_PCH_2"] == "FAILED"
    assert statuses["road_PCH"] == "BLOCKED"

def test_cascade_propagation_line_a_is_failed():
    graph = load_infrastructure()
    statuses = propagate_cascade(graph, "transmission_line_A")
    assert statuses["transmission_line_A"] == "FAILED"

def test_no_cascade_at_T0():
    graph = load_infrastructure()
    statuses = {
        node: ("CLEAR" if graph["nodes"][node]["type"] == "evacuation_route" else "OPERATIONAL")
        for node in graph["nodes"]
    }
    assert statuses["transmission_line_A"] == "OPERATIONAL"
    assert statuses["substation_malibu"] == "OPERATIONAL"
    assert statuses["road_PCH"] == "CLEAR"

def test_output_contract_shape():
    from orchestrator.router import dispatch

    scenario = {"timestep": 15, "weather": {"wind_speed": 35, "slope": 34}, "fire_perimeter": {}}
    agents = {"hazard": mock_hazard_agent, "cascade": mock_cascade_agent, "secondary": mock_secondary_agent}
    validators = {"hazard": mock_hazard_validator, "cascade": mock_cascade_validator, "secondary": mock_secondary_validator}

    result = asyncio.run(dispatch(scenario, agents, validators, mock_coordinator))

    assert result["disaster_type"] == "wildfire"
    assert result["timestep"] == 15
    assert "threat_level" in result["physics"]
    assert "spread_rate_fpm" in result["physics"]
    assert "debris_probability" in result["physics"]
    assert "cascade_status" in result
    assert "evacuation_routes" in result
    assert "agents" in result
    assert "events" in result

def test_events_populated_after_dispatch():
    from orchestrator.router import dispatch

    scenario = {"timestep": 15, "weather": {"wind_speed": 35, "slope": 34}, "fire_perimeter": {}}
    agents = {"hazard": mock_hazard_agent, "cascade": mock_cascade_agent, "secondary": mock_secondary_agent}
    validators = {"hazard": mock_hazard_validator, "cascade": mock_cascade_validator, "secondary": mock_secondary_validator}

    result = asyncio.run(dispatch(scenario, agents, validators, mock_coordinator))
    assert len(result["events"]) > 0

def test_road_PCH_blocked_at_T15():
    from orchestrator.router import dispatch

    scenario = {"timestep": 15, "weather": {}, "fire_perimeter": {}}
    agents = {"hazard": mock_hazard_agent, "cascade": mock_cascade_agent, "secondary": mock_secondary_agent}
    validators = {"hazard": mock_hazard_validator, "cascade": mock_cascade_validator, "secondary": mock_secondary_validator}

    result = asyncio.run(dispatch(scenario, agents, validators, mock_coordinator))
    assert result["cascade_status"]["road_PCH"] == "BLOCKED"
    assert result["evacuation_routes"]["road_PCH"] == "BLOCKED"

def test_road_PCH_clear_at_T0():
    from orchestrator.router import dispatch

    scenario = {"timestep": 0, "weather": {}, "fire_perimeter": {}}
    agents = {"hazard": mock_hazard_agent, "cascade": mock_cascade_agent, "secondary": mock_secondary_agent}
    validators = {"hazard": mock_hazard_validator, "cascade": mock_cascade_validator, "secondary": mock_secondary_validator}

    result = asyncio.run(dispatch(scenario, agents, validators, mock_coordinator))
    assert result["evacuation_routes"]["road_PCH"] == "CLEAR"
