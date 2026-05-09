from backend.services.scenario_loader import load_scenario, normalize_dependency_graph


def test_normalizes_p3_dependencies_into_forward_cascade_graph():
    infrastructure = {
        "nodes": {
            "transmission_line_A": {},
            "substation_malibu": {},
            "signal_PCH_1": {},
            "road_PCH": {},
        },
        "dependencies": {
            "substation_malibu": ["transmission_line_A"],
            "signal_PCH_1": ["substation_malibu"],
            "road_PCH": ["signal_PCH_1"],
        },
    }

    graph = normalize_dependency_graph(infrastructure)

    assert graph["transmission_line_A"] == ["substation_malibu"]
    assert graph["substation_malibu"] == ["signal_PCH_1"]
    assert graph["signal_PCH_1"] == ["road_PCH"]
    assert graph["road_PCH"] == []


def test_loads_t0_as_predicted_not_failed():
    scenario = load_scenario(0)

    assert scenario["fire_crosses_line_a"] is False
    assert scenario["trigger_source"] == "geometry_no_crossing"
    assert scenario["data_sources"]["fire_perimeter_file"].endswith("palisades_T0.geojson")


def test_loads_t15_with_prd_trigger_fallback_until_geometry_is_adjusted():
    scenario = load_scenario(15)

    assert scenario["fire_crosses_line_a"] is True
    assert scenario["trigger_source"] == "prd_timeline_fallback_no_geometry_crossing"
    assert scenario["fire_line_distance_m"] > 500
    assert scenario["dependency_graph"]["transmission_line_A"] == ["substation_malibu"]
    assert set(scenario["dependency_graph"]["substation_malibu"]) == {"signal_PCH_1", "signal_PCH_2"}


def test_loads_osm_counts_for_frontend_provenance():
    scenario = load_scenario(30)

    assert scenario["data_sources"]["osm_counts"]["power_lines"] > 0
    assert scenario["data_sources"]["osm_counts"]["traffic_signals"] > 0
    assert scenario["data_sources"]["dependency_direction"] == "normalized_from_dependent_to_upstream"
