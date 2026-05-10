from backend.agents.cascade import run_cascade_agent
from backend.agents.coordinator import run_coordinator_agent
from backend.agents.hazard import run_hazard_agent
from backend.agents.secondary import run_debris_flow_agent
from backend.physics.cascade import compute_cascade
from backend.physics.debris import compute_debris_physics
from backend.physics.fire import compute_fire_physics
from backend.services.featherless import run_featherless_json_agent
from backend.services.scenario_loader import load_scenario
from backend.services.weather import apply_demo_weather_floor, fetch_open_meteo_weather
from backend.services.watsonx import run_watsonx_json_coordinator
from backend.validator import MAX_RETRIES, make_event, validate_debris_agent


# PRD demo scenario values for the Palisades cascade.
DEMO_SCENARIO = {
    "scenario_id": "palisades_2025",
    "default_timestep": 3,
    "location": {
        "name": "Pacific Palisades & Malibu, Los Angeles, CA",
        "latitude": 34.045,
        "longitude": -118.744,
    },
    "conditions": {
        "slope_deg": 34,
        "wind_mph": 35,
        "fuel_base_rate_fpm": 2.8,
        "burn_severity": 0.78,
        "rainfall_in_hr": 0.75,
        "fire_crosses_line_a": True,
    },
}


TIMESTEP_STATE = {
    0: {
        "label": "T+0 ignition",
        "fire_crosses_line_a": False,
        "debris_active": False,
        "run_validator_demo": False,
    },
    3: {
        "label": "T+3 cascade failure",
        "fire_crosses_line_a": True,
        "debris_active": True,
        "run_validator_demo": True,
    },
    6: {
        "label": "T+6 secondary hazard",
        "fire_crosses_line_a": True,
        "debris_active": True,
        "run_validator_demo": True,
    },
}


def supported_timesteps() -> tuple[int, ...]:
    return tuple(TIMESTEP_STATE.keys())


def build_prediction(timestep: int) -> dict:
    if timestep == 0:
        return {
            "prediction_window_min": 12,
            "next_failure": "transmission_line_A",
            "status": "predicted",
            "cascade_if_unmitigated": [
                "substation_malibu FAILED",
                "signal_PCH_1 FAILED",
                "signal_PCH_2 FAILED",
                "road_PCH BLOCKED",
            ],
            "preventive_actions": {
                "fire_incident_command": "Protect Transmission Line A now.",
                "utility_operator": "Switch load to Substation B.",
                "traffic_management": "Deploy officers to PCH signals.",
            },
        }

    if timestep == 3:
        return {
            "prediction_window_min": 0,
            "next_failure": "transmission_line_A",
            "status": "cascade_in_progress",
            "cascade_if_unmitigated": [
                "substation_malibu FAILED",
                "signal_PCH_1 FAILED",
                "signal_PCH_2 FAILED",
                "road_PCH BLOCKED",
            ],
            "preventive_actions": {
                "fire_incident_command": "Protect exposed evacuation corridor.",
                "utility_operator": "Complete emergency switching to Substation B.",
                "traffic_management": "Deploy officers to blocked PCH intersections.",
            },
        }

    return {
        "prediction_window_min": 0,
        "next_failure": "debris_flow_zone_malibu",
        "status": "secondary_hazard_active",
        "cascade_if_unmitigated": [
            "road_PCH BLOCKED",
            "debris_flow_zone_malibu HIGH",
        ],
        "preventive_actions": {
            "fire_incident_command": "Pre-position crews outside debris-flow zone.",
            "utility_operator": "Keep repair crews clear of burned slopes.",
            "traffic_management": "Maintain PCH closure and reroute evacuees.",
        },
    }


def build_replay() -> list[dict]:
    base_actions = {
        "fire": "Send crew to defend Line A.",
        "utility": "Switch Malibu Substation to backup power.",
        "traffic": "Stage officers at PCH signals.",
        "evac": "Send early warning to exposed homes.",
    }

    def task(owner: str, status: str, action: str) -> dict:
        return {"owner": owner, "status": status, "action": action}

    def tasks(*, fire: str, utility: str, traffic: str, evac: str) -> dict:
        return {
            "fire": task("Fire IC", fire, base_actions["fire"]),
            "utility": task("Utility", utility, base_actions["utility"]),
            "traffic": task("Traffic", traffic, base_actions["traffic"]),
            "evac": task("Evacuation", evac, base_actions["evac"]),
        }

    def asset_status(*, line: str, substation: str, signals: str, road: str, debris: str = "MONITOR") -> dict:
        return {
            "transmission_line_A": line,
            "substation_malibu": substation,
            "signal_PCH_1": signals,
            "signal_PCH_2": signals,
            "road_PCH": road,
            "debris_flow_zone_malibu": debris,
        }

    return [
        {
            "minute": 0,
            "label": "T+0 Predict",
            "event": "Physics flags Line A as the first failure risk.",
            "selected_asset": "lineA",
            "asset_status": asset_status(line="OPERATIONAL", substation="OPERATIONAL", signals="OPERATIONAL", road="CLEAR"),
            "route_status": "CLEAR",
            "tasks": tasks(fire="ASSIGNED", utility="STAGED", traffic="STAGED", evac="READY"),
        },
        {
            "minute": 35,
            "label": "T+35 Line A",
            "event": "Line A fails. Utility cascade starts.",
            "selected_asset": "lineA",
            "asset_status": asset_status(line="FAILED", substation="AT_RISK", signals="OPERATIONAL", road="CLEAR"),
            "route_status": "CLEAR",
            "tasks": tasks(fire="ACKNOWLEDGED", utility="SWITCHING", traffic="STAGED", evac="ALERTING"),
        },
        {
            "minute": 42,
            "label": "T+42 Substation",
            "event": "Substation fails. PCH signals are next.",
            "selected_asset": "substation",
            "asset_status": asset_status(line="FAILED", substation="FAILED", signals="AT_RISK", road="CLEAR"),
            "route_status": "CLEAR",
            "tasks": tasks(fire="HOLDING", utility="SWITCHING", traffic="EN ROUTE", evac="ALERTING"),
        },
        {
            "minute": 48,
            "label": "T+48 Signals",
            "event": "Signals fail. Traffic must take manual control.",
            "selected_asset": "pch",
            "asset_status": asset_status(line="FAILED", substation="FAILED", signals="FAILED", road="DEGRADED"),
            "route_status": "DEGRADED",
            "tasks": tasks(fire="HOLDING", utility="RESTORING", traffic="MANUAL CTRL", evac="ALERTING"),
        },
        {
            "minute": 60,
            "label": "T+60 PCH blocked",
            "event": "PCH blocks. Evacuation must reroute 4.2K residents.",
            "selected_asset": "homes",
            "asset_status": asset_status(line="FAILED", substation="FAILED", signals="FAILED", road="BLOCKED"),
            "route_status": "BLOCKED",
            "tasks": tasks(fire="HOLDING", utility="RESTORING", traffic="MANUAL CTRL", evac="REROUTING"),
        },
        {
            "minute": 150,
            "label": "T+150 Debris",
            "event": "Rain creates debris-flow danger on burned slopes.",
            "selected_asset": "debris",
            "asset_status": asset_status(line="FAILED", substation="FAILED", signals="FAILED", road="BLOCKED", debris="HIGH"),
            "route_status": "BLOCKED",
            "tasks": tasks(fire="REPOSITION", utility="STAND CLEAR", traffic="REROUTING", evac="REROUTING"),
        },
    ]


def execute_wildfire_dispatch(timestep: int) -> dict:
    timestep_state = TIMESTEP_STATE[timestep]
    scenario = load_scenario(timestep)
    conditions = DEMO_SCENARIO["conditions"]
    location = DEMO_SCENARIO["location"]
    weather = fetch_open_meteo_weather(
        latitude=location["latitude"],
        longitude=location["longitude"],
    )
    effective_weather = apply_demo_weather_floor(weather, conditions)
    rainfall_for_physics = effective_weather["rainfall_in_hr"] if timestep_state["debris_active"] else 0.0

    # Run deterministic physics before any agent output.
    fire_physics = compute_fire_physics(
        slope_deg=conditions["slope_deg"],
        wind_mph=effective_weather["wind_mph"],
        fuel_base_rate_fpm=conditions["fuel_base_rate_fpm"],
    )
    cascade_physics = compute_cascade(
        fire_crosses_line_a=scenario["fire_crosses_line_a"],
        dependency_graph=scenario["dependency_graph"],
    )
    debris_physics = compute_debris_physics(
        slope_deg=conditions["slope_deg"],
        burn_severity=conditions["burn_severity"],
        rainfall_in_hr=rainfall_for_physics,
    )

    # Frontend renders these events in the validator feed.
    events = [
        make_event(
            event_type="physics_computed",
            agent="physics_validator",
            output={
                "fire": fire_physics,
                "cascade": cascade_physics,
                "debris": debris_physics,
            },
        )
    ]

    # Retry until the agent matches physics, max 2 retries.
    ai_stack = {
        "validator": {
            "provider": "Deterministic Python",
            "model": "physics_validator",
            "fallback_used": False,
            "reason": "",
        }
    }
    if timestep_state["run_validator_demo"]:
        debris_agent_output = None
        for attempt in range(1, MAX_RETRIES + 2):
            fallback_debris_output = run_debris_flow_agent(attempt)
            debris_agent_output, secondary_status = run_featherless_json_agent(
                agent_name="secondary_agent",
                system_prompt=(
                    "You are Foresight Secondary Agent, a post-fire debris-flow "
                    "specialist for dispatch. Use the provided USGS M1 physics. "
                    "Return JSON only and include role, finding, threat_label, "
                    "probability, confidence, trigger, onset_window, affected_zones, "
                    "map_annotations, and recommended_actions. Never contradict the "
                    "physics values unless this is attempt 1 of the validator demo."
                ),
                payload={"debris_physics": debris_physics, "attempt": attempt},
                fallback_output=fallback_debris_output,
            )
            ai_stack["secondary_agent"] = secondary_status
            validation = validate_debris_agent(debris_physics, debris_agent_output, attempt)
            events.append(validation["event"])
            if validation["valid"]:
                break
    else:
        debris_agent_output = {
            "agent": "debris_flow_agent",
            "role": "Secondary hazard specialist",
            "finding": "Post-fire debris-flow risk is inactive at ignition time.",
            "threat_label": debris_physics["debris_threat"],
            "probability": debris_physics["debris_probability"],
            "confidence": 0.86,
            "trigger": "secondary hazard inactive until rainfall affects burned slopes",
            "onset_window": "not active at T+0",
            "affected_zones": [],
            "map_annotations": [],
            "recommended_actions": [
                {
                    "agency": "fire_incident_command",
                    "action": "Monitor burned slopes after fire spread.",
                    "why": "Debris-flow risk becomes relevant after rainfall.",
                }
            ],
        }
        ai_stack["secondary_agent"] = {
            "provider": "Featherless",
            "model": "not_called_at_t0",
            "fallback_used": True,
            "reason": "secondary hazard inactive at T+0",
        }

    # Build agency-facing outputs after validation.
    fallback_hazard_output = run_hazard_agent(fire_physics, timestep)
    hazard_output, hazard_status = run_featherless_json_agent(
        agent_name="hazard_agent",
        system_prompt=(
            "You are Foresight Hazard Agent, a fire behavior and exposure specialist "
            "for incident command. Use the provided fire physics and return JSON "
            "only with role, finding, threat_level, confidence, spread_rate_fpm, "
            "direction, time_horizon_min, trigger, affected_assets, map_annotations, "
            "recommended_actions, and structures_at_risk_30min. Never contradict "
            "the deterministic fire physics."
        ),
        payload={"fire_physics": fire_physics, "timestep": timestep},
        fallback_output=fallback_hazard_output,
    )
    ai_stack["hazard_agent"] = hazard_status

    fallback_cascade_output = run_cascade_agent(cascade_physics, timestep)
    cascade_output, cascade_status = run_featherless_json_agent(
        agent_name="cascade_agent",
        system_prompt=(
            "You are Foresight Cascade Agent, an infrastructure dependency specialist. "
            "Never contradict deterministic graph status. Return JSON only with role, "
            "finding, confidence, trigger, next_failure, node_status, evacuation_routes, "
            "dependency_chain, cascade_timeline, map_annotations, and recommended_actions."
        ),
        payload={"cascade_physics": cascade_physics, "timestep": timestep},
        fallback_output=fallback_cascade_output,
    )
    ai_stack["cascade_agent"] = cascade_status

    fallback_coordinator_output = run_coordinator_agent(timestep)
    coordinator_output, coordinator_status = run_watsonx_json_coordinator(
        payload={
            "fire_physics": fire_physics,
            "cascade_physics": cascade_physics,
            "debris_physics": debris_physics,
            "hazard": hazard_output,
            "cascade": cascade_output,
            "secondary": debris_agent_output,
            "timestep": timestep,
            "scenario": {
                "trigger_source": scenario["trigger_source"],
                "fire_line_distance_m": scenario["fire_line_distance_m"],
                "dependency_graph": scenario["dependency_graph"],
            },
        },
        fallback_output=fallback_coordinator_output,
    )
    ai_stack["coordinator"] = coordinator_status
    events.append(
        make_event(
            event_type="coordinator_done",
            agent="coordinator",
            output=coordinator_output,
        )
    )

    # Shared contract consumed by P1 frontend.
    return {
        "disaster_type": "wildfire",
        "scenario_id": DEMO_SCENARIO["scenario_id"],
        "timestep": timestep,
        "timestep_label": timestep_state["label"],
        "location": DEMO_SCENARIO["location"],
        "physics": {
            "threat_level": fire_physics["threat_level"],
            "spread_rate_fpm": fire_physics["spread_rate_fpm"],
            "debris_probability": debris_physics["debris_probability"],
            "debris_threat": debris_physics["debris_threat"],
        },
        "prediction": build_prediction(timestep),
        "cascade_status": cascade_physics["cascade_status"],
        "evacuation_routes": cascade_physics["evacuation_routes"],
        "agents": {
            "hazard": hazard_output,
            "cascade": cascade_output,
            "secondary": debris_agent_output,
            "coordinator": coordinator_output,
        },
        "data_sources": {
            "weather": {
                **weather,
                "effective": {
                    "wind_mph": effective_weather["wind_mph"],
                    "rainfall_in_hr": effective_weather["rainfall_in_hr"],
                    "adjustments": effective_weather["adjustments"],
                },
                "fallback_values": {
                    "wind_mph": conditions["wind_mph"],
                    "rainfall_in_hr": conditions["rainfall_in_hr"],
                },
            },
            "fire_perimeter": {
                "provider": "P3 Palisades GeoJSON",
                "mode": "loaded",
            },
            "infrastructure": {
                "provider": "P3 OSM + curated critical infrastructure",
                "mode": "loaded",
            },
            "scenario": {
                **scenario["data_sources"],
                "fire_crosses_line_a": scenario["fire_crosses_line_a"],
                "trigger_source": scenario["trigger_source"],
                "fire_line_distance_m": scenario["fire_line_distance_m"],
                "dependency_graph": scenario["dependency_graph"],
                "cascade_sequence": scenario["infrastructure"].get("cascade_sequence", []),
            },
            "ai_stack": ai_stack,
            "physics": ["Rothermel-inspired spread", "deterministic graph", "USGS M1-style debris flow"],
        },
        "events": events,
        "replay": build_replay(),
    }
