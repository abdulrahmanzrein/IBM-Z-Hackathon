import asyncio
import json
import os
from orchestrator.event_stream import emit, get_log, clear

INFRASTRUCTURE_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "infrastructure.json")

def load_infrastructure():
    with open(INFRASTRUCTURE_PATH) as f:
        return json.load(f)

def propagate_cascade(graph, failed_node):
    """Walk the dependency graph and mark all downstream nodes as FAILED."""
    statuses = {node: graph["nodes"][node]["status"] for node in graph["nodes"]}
    statuses[failed_node] = "FAILED"

    changed = True
    while changed:
        changed = False
        for node, deps in graph["dependencies"].items():
            if any(statuses.get(d) == "FAILED" for d in deps):
                if statuses[node] != "FAILED":
                    statuses[node] = "FAILED"
                    changed = True

    for node in statuses:
        if graph["nodes"][node]["type"] == "evacuation_route" and statuses[node] == "FAILED":
            statuses[node] = "BLOCKED"

    return statuses

async def run_agent(agent_fn, inputs, validator_fn, agent_name):
    """Run an agent, validate output, retry up to 2 times if rejected.

    Returns the validated output, or the last output if all retries fail.
    Emits agent_validated, agent_rejected, or agent_max_retries events.
    """
    violation = None
    output = None
    for attempt in range(3):
        output = await agent_fn(inputs, violation)
        valid, violation_msg = validator_fn(output, inputs)

        if valid:
            emit("agent_validated", agent_name, output)
            return output
        else:
            violation = violation_msg
            emit("agent_rejected", agent_name, output, violation=violation_msg)

    emit("agent_max_retries", agent_name, output, violation=violation)
    return output

async def dispatch(scenario: dict, agents: dict, validators: dict, coordinator_fn) -> dict:
    """
    Main dispatch pipeline.

    scenario: { "timestep": int, "weather": {...}, "fire_perimeter": {...} }
    agents:   { "hazard": fn, "cascade": fn, "secondary": fn }
    validators: { "hazard": fn, "cascade": fn, "secondary": fn }
    coordinator_fn: fn that takes all three agent outputs and returns per-agency recommendations
    """
    clear()
    emit("physics_computed", "router", scenario)

    graph = load_infrastructure()

    # Determine which node fails based on timestep
    cascade_status = {}
    evacuation_routes = {}

    if scenario["timestep"] >= 15:
        cascade_status = propagate_cascade(graph, "transmission_line_A")
        evacuation_routes = {
            node: cascade_status[node]
            for node in cascade_status
            if graph["nodes"][node]["type"] == "evacuation_route"
        }
    else:
        cascade_status = {
            node: ("CLEAR" if graph["nodes"][node]["type"] == "evacuation_route" else "OPERATIONAL")
            for node in graph["nodes"]
        }
        evacuation_routes = {"road_PCH": "CLEAR"}

    inputs = {**scenario, "cascade_status": cascade_status}

    # Run all three agents in parallel
    hazard_out, cascade_out, secondary_out = await asyncio.gather(
        run_agent(agents["hazard"],    inputs, validators["hazard"],    "hazard"),
        run_agent(agents["cascade"],   inputs, validators["cascade"],   "cascade"),
        run_agent(agents["secondary"], inputs, validators["secondary"], "secondary"),
    )

    coordinator_out = await coordinator_fn(hazard_out, cascade_out, secondary_out)
    emit("coordinator_done", "coordinator", coordinator_out)

    return {
        "disaster_type": "wildfire",
        "timestep": scenario["timestep"],
        "physics": {
            "threat_level": hazard_out.get("threat_level"),
            "spread_rate_fpm": hazard_out.get("spread_rate_fpm"),
            "debris_probability": secondary_out.get("debris_probability")
        },
        "cascade_status": cascade_status,
        "evacuation_routes": evacuation_routes,
        "agents": {
            "hazard": hazard_out,
            "cascade": cascade_out,
            "secondary": secondary_out,
            "coordinator": coordinator_out
        },
        "events": get_log()
    }
