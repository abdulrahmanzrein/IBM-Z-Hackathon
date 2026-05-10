from backend.agents.orchestrator import build_prediction, execute_wildfire_dispatch, supported_timesteps


def test_supported_timesteps_match_prd_replay():
    assert supported_timesteps() == (0, 3, 6)


def test_orchestrator_returns_dispatch_contract_shape():
    result = execute_wildfire_dispatch(3)

    assert result["disaster_type"] == "wildfire"
    assert result["timestep"] == 3
    assert result["prediction"]["status"] == "cascade_in_progress"
    assert result["physics"]["threat_level"] == "CRITICAL"
    assert result["events"][1]["type"] == "agent_rejected"


def test_prediction_exposes_preventive_actions():
    prediction = build_prediction(0)

    assert prediction["prediction_window_min"] == 12
    assert prediction["next_failure"] == "transmission_line_A"
    assert prediction["preventive_actions"]["traffic_management"] == "Deploy officers to PCH signals."
