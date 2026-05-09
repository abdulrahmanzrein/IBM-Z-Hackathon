from collections import deque
from typing import Literal, Optional


NodeStatus = Literal["OPERATIONAL", "FAILED", "AT_RISK"]
RouteStatus = Literal["CLEAR", "DEGRADED", "BLOCKED"]


DEFAULT_DEPENDENCY_GRAPH = {
    # Power failure chain from the PRD.
    "transmission_line_A": ["substation_malibu"],
    "substation_malibu": ["signal_PCH_1", "signal_PCH_2"],
    "signal_PCH_1": ["road_PCH"],
    "signal_PCH_2": ["road_PCH"],
    "road_PCH": [],
}


def propagate_failures(
    failed_roots: list[str],
    dependency_graph: Optional[dict[str, list[str]]] = None,
) -> dict[str, NodeStatus]:
    graph = dependency_graph or DEFAULT_DEPENDENCY_GRAPH
    statuses: dict[str, NodeStatus] = {node: "OPERATIONAL" for node in graph}
    queue = deque(failed_roots)

    # Walk downstream and fail every dependent node.
    while queue:
        node = queue.popleft()
        if node not in statuses:
            statuses[node] = "FAILED"
        elif statuses[node] == "FAILED":
            continue
        else:
            statuses[node] = "FAILED"

        for downstream in graph.get(node, []):
            queue.append(downstream)

    return statuses


def route_status_from_cascade(cascade_status: dict[str, NodeStatus]) -> dict[str, RouteStatus]:
    road_failed = cascade_status.get("road_PCH") == "FAILED"
    signal_failed = (
        cascade_status.get("signal_PCH_1") == "FAILED"
        or cascade_status.get("signal_PCH_2") == "FAILED"
    )

    if road_failed:
        return {"road_PCH": "BLOCKED"}
    if signal_failed:
        return {"road_PCH": "DEGRADED"}
    return {"road_PCH": "CLEAR"}


def compute_cascade(fire_crosses_line_a: bool) -> dict:
    # Fire crossing Line A starts the cascade.
    failed_roots = ["transmission_line_A"] if fire_crosses_line_a else []
    cascade_status = propagate_failures(failed_roots)
    return {
        "cascade_status": cascade_status,
        "evacuation_routes": route_status_from_cascade(cascade_status),
        "rule": "If node A is FAILED, every downstream node in the dependency graph is FAILED.",
    }
