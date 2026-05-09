from backend.agents.orchestrator import execute_wildfire_dispatch, supported_timesteps


def test_supported_timesteps_match_prd_replay():
    assert supported_timesteps() == (0, 15, 30)


def test_orchestrator_returns_dispatch_contract_shape():
    result = execute_wildfire_dispatch(15)

    assert result["disaster_type"] == "wildfire"
    assert result["timestep"] == 15
    assert result["physics"]["threat_level"] == "CRITICAL"
    assert result["events"][1]["type"] == "agent_rejected"
