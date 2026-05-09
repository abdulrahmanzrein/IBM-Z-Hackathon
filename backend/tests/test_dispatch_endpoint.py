from fastapi.testclient import TestClient

from backend.main import app


client = TestClient(app)


def test_dispatch_t0_keeps_cascade_clear():
    response = client.post("/dispatch/wildfire/1?timestep=0")

    assert response.status_code == 200
    data = response.json()
    assert data["timestep"] == 0
    assert data["prediction"]["prediction_window_min"] == 12
    assert data["prediction"]["next_failure"] == "transmission_line_A"
    assert data["prediction"]["status"] == "predicted"
    assert data["cascade_status"]["transmission_line_A"] == "OPERATIONAL"
    assert data["evacuation_routes"]["road_PCH"] == "CLEAR"
    assert data["data_sources"]["scenario"]["trigger_source"] == "geometry_no_crossing"
    assert "agent_rejected" not in [event["type"] for event in data["events"]]


def test_dispatch_t3_runs_validator_rejection():
    response = client.post("/dispatch/wildfire/1?timestep=3")

    assert response.status_code == 200
    data = response.json()
    assert data["timestep"] == 3
    assert data["prediction"]["status"] == "cascade_in_progress"
    assert "road_PCH BLOCKED" in data["prediction"]["cascade_if_unmitigated"]
    assert data["cascade_status"]["transmission_line_A"] == "FAILED"
    assert data["evacuation_routes"]["road_PCH"] == "BLOCKED"
    assert data["data_sources"]["scenario"]["fire_perimeter_file"].endswith("palisades_T15.geojson")
    assert data["data_sources"]["scenario"]["trigger_source"] == "geometry_intersection"
    assert [event["type"] for event in data["events"]] == [
        "physics_computed",
        "agent_rejected",
        "agent_validated",
        "coordinator_done",
    ]
    assert data["agents"]["hazard"]["role"] == "Fire behavior and exposure specialist"
    assert data["agents"]["hazard"]["recommended_actions"][0]["agency"] == "fire_incident_command"
    assert data["agents"]["cascade"]["dependency_chain"][0] == "transmission_line_A"
    assert data["agents"]["coordinator"]["dispatch_summary"]


def test_dispatch_t6_keeps_cascade_failed_and_debris_high():
    response = client.post("/dispatch/wildfire/1?timestep=6")

    assert response.status_code == 200
    data = response.json()
    assert data["timestep"] == 6
    assert data["prediction"]["next_failure"] == "debris_flow_zone_malibu"
    assert data["prediction"]["status"] == "secondary_hazard_active"
    assert data["cascade_status"]["substation_malibu"] == "FAILED"
    assert data["physics"]["debris_threat"] == "HIGH"
    assert data["agents"]["secondary"]["confidence"] >= 0.8
    assert data["agents"]["coordinator"]["agencies"]["traffic_management"]["map_target"] == "PCH_evacuation_corridor"


def test_dispatch_rejects_invalid_timestep():
    response = client.post("/dispatch/wildfire/1?timestep=7")

    assert response.status_code == 400


def test_dispatch_events_streams_validator_sequence():
    with client.stream("GET", "/dispatch/wildfire/1/events?timestep=3&delay_seconds=0") as response:
        body = response.read().decode("utf-8")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert "event: physics_computed" in body
    assert "event: agent_rejected" in body
    assert "event: agent_validated" in body
    assert "event: coordinator_done" in body
