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
    assert "agent_rejected" not in [event["type"] for event in data["events"]]


def test_dispatch_t15_runs_validator_rejection():
    response = client.post("/dispatch/wildfire/1?timestep=15")

    assert response.status_code == 200
    data = response.json()
    assert data["timestep"] == 15
    assert data["prediction"]["status"] == "cascade_in_progress"
    assert "road_PCH BLOCKED" in data["prediction"]["cascade_if_unmitigated"]
    assert data["cascade_status"]["transmission_line_A"] == "FAILED"
    assert data["evacuation_routes"]["road_PCH"] == "BLOCKED"
    assert [event["type"] for event in data["events"]] == [
        "physics_computed",
        "agent_rejected",
        "agent_validated",
        "coordinator_done",
    ]


def test_dispatch_t30_keeps_cascade_failed_and_debris_high():
    response = client.post("/dispatch/wildfire/1?timestep=30")

    assert response.status_code == 200
    data = response.json()
    assert data["timestep"] == 30
    assert data["prediction"]["next_failure"] == "debris_flow_zone_malibu"
    assert data["prediction"]["status"] == "secondary_hazard_active"
    assert data["cascade_status"]["substation_malibu"] == "FAILED"
    assert data["physics"]["debris_threat"] == "HIGH"


def test_dispatch_rejects_invalid_timestep():
    response = client.post("/dispatch/wildfire/1?timestep=7")

    assert response.status_code == 400


def test_dispatch_events_streams_validator_sequence():
    with client.stream("GET", "/dispatch/wildfire/1/events?timestep=15&delay_seconds=0") as response:
        body = response.read().decode("utf-8")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert "event: physics_computed" in body
    assert "event: agent_rejected" in body
    assert "event: agent_validated" in body
    assert "event: coordinator_done" in body
