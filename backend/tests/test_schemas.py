from fastapi.testclient import TestClient

from backend.main import app
from backend.schemas import DispatchResponse


def test_dispatch_response_matches_schema():
    response = TestClient(app).post("/dispatch/wildfire/1?timestep=3")

    assert response.status_code == 200
    parsed = DispatchResponse.model_validate(response.json())
    assert parsed.disaster_type == "wildfire"
    assert parsed.timestep == 3
    assert parsed.prediction.status == "cascade_in_progress"
    assert parsed.physics.threat_level == "CRITICAL"
    assert parsed.events[1].type == "agent_rejected"
