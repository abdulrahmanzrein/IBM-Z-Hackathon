import json
import math
from pathlib import Path
from typing import Any, Iterable, Optional


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_ROOT = PROJECT_ROOT / "data"

TIMESTEP_FIRE_FILES = {
    0: DATA_ROOT / "geojson" / "palisades_T0.geojson",
    3: DATA_ROOT / "geojson" / "palisades_T15.geojson",
    6: DATA_ROOT / "geojson" / "palisades_T30.geojson",
}
INFRASTRUCTURE_FILE = DATA_ROOT / "infrastructure.json"
OSM_INFRASTRUCTURE_FILE = DATA_ROOT / "osm_infrastructure.json"
CROSSING_PROXIMITY_METERS = 500.0


LonLat = tuple[float, float]
Segment = tuple[LonLat, LonLat]


def _read_json(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as file:
        return json.load(file)


def normalize_dependency_graph(infrastructure: dict[str, Any]) -> dict[str, list[str]]:
    """Convert P3 dependent->upstream dependencies into upstream->downstream edges."""
    nodes = infrastructure.get("nodes", {})
    dependencies = infrastructure.get("dependencies", {})
    graph: dict[str, list[str]] = {node_id: [] for node_id in nodes}

    for dependent, upstream_nodes in dependencies.items():
        graph.setdefault(dependent, [])
        for upstream in upstream_nodes:
            graph.setdefault(upstream, [])
            if dependent not in graph[upstream]:
                graph[upstream].append(dependent)

    return graph


def _iter_feature_geometries(geojson: dict[str, Any]) -> Iterable[dict[str, Any]]:
    if geojson.get("type") == "FeatureCollection":
        for feature in geojson.get("features", []):
            geometry = feature.get("geometry")
            if geometry:
                yield geometry
    elif "type" in geojson:
        yield geojson


def _iter_rings(geometry: dict[str, Any]) -> Iterable[list[LonLat]]:
    coordinates = geometry.get("coordinates", [])
    geometry_type = geometry.get("type")

    if geometry_type == "Polygon":
        for ring in coordinates:
            yield [(float(lon), float(lat)) for lon, lat in ring]
    elif geometry_type == "MultiPolygon":
        for polygon in coordinates:
            for ring in polygon:
                yield [(float(lon), float(lat)) for lon, lat in ring]


def _segments_from_ring(ring: list[LonLat]) -> list[Segment]:
    if len(ring) < 2:
        return []
    closed_ring = ring if ring[0] == ring[-1] else [*ring, ring[0]]
    return list(zip(closed_ring, closed_ring[1:]))


def _fire_segments(fire_perimeter: dict[str, Any]) -> list[Segment]:
    segments: list[Segment] = []
    for geometry in _iter_feature_geometries(fire_perimeter):
        for ring in _iter_rings(geometry):
            segments.extend(_segments_from_ring(ring))
    return segments


def _line_segments(coordinates: list[list[float]]) -> list[Segment]:
    points = [(float(lon), float(lat)) for lon, lat in coordinates]
    return list(zip(points, points[1:]))


def _project(point: LonLat, origin_lat: float) -> tuple[float, float]:
    lon, lat = point
    meters_per_deg_lat = 111_320.0
    meters_per_deg_lon = meters_per_deg_lat * math.cos(math.radians(origin_lat))
    return lon * meters_per_deg_lon, lat * meters_per_deg_lat


def _orientation(
    a: tuple[float, float],
    b: tuple[float, float],
    c: tuple[float, float],
) -> float:
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])


def _on_segment(
    a: tuple[float, float],
    b: tuple[float, float],
    c: tuple[float, float],
) -> bool:
    return (
        min(a[0], c[0]) <= b[0] <= max(a[0], c[0])
        and min(a[1], c[1]) <= b[1] <= max(a[1], c[1])
    )


def _segments_intersect(first: Segment, second: Segment, origin_lat: float) -> bool:
    a = _project(first[0], origin_lat)
    b = _project(first[1], origin_lat)
    c = _project(second[0], origin_lat)
    d = _project(second[1], origin_lat)

    o1 = _orientation(a, b, c)
    o2 = _orientation(a, b, d)
    o3 = _orientation(c, d, a)
    o4 = _orientation(c, d, b)
    epsilon = 1e-9

    if o1 * o2 < 0 and o3 * o4 < 0:
        return True
    if abs(o1) <= epsilon and _on_segment(a, c, b):
        return True
    if abs(o2) <= epsilon and _on_segment(a, d, b):
        return True
    if abs(o3) <= epsilon and _on_segment(c, a, d):
        return True
    if abs(o4) <= epsilon and _on_segment(c, b, d):
        return True
    return False


def _point_to_segment_distance_m(
    point: LonLat,
    segment: Segment,
    origin_lat: float,
) -> float:
    px, py = _project(point, origin_lat)
    ax, ay = _project(segment[0], origin_lat)
    bx, by = _project(segment[1], origin_lat)
    dx = bx - ax
    dy = by - ay

    if dx == 0 and dy == 0:
        return math.hypot(px - ax, py - ay)

    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    nearest_x = ax + t * dx
    nearest_y = ay + t * dy
    return math.hypot(px - nearest_x, py - nearest_y)


def _segment_distance_m(first: Segment, second: Segment, origin_lat: float) -> float:
    if _segments_intersect(first, second, origin_lat):
        return 0.0
    return min(
        _point_to_segment_distance_m(first[0], second, origin_lat),
        _point_to_segment_distance_m(first[1], second, origin_lat),
        _point_to_segment_distance_m(second[0], first, origin_lat),
        _point_to_segment_distance_m(second[1], first, origin_lat),
    )


def _origin_latitude(segments: list[Segment]) -> float:
    latitudes = [point[1] for segment in segments for point in segment]
    return sum(latitudes) / len(latitudes) if latitudes else 34.045


def _fire_line_distance_m(fire_segments: list[Segment], line_segments: list[Segment]) -> Optional[float]:
    if not fire_segments or not line_segments:
        return None

    origin_lat = _origin_latitude([*fire_segments, *line_segments])
    return min(
        _segment_distance_m(fire_segment, line_segment, origin_lat)
        for fire_segment in fire_segments
        for line_segment in line_segments
    )


def _osm_counts(path: Path) -> dict[str, int]:
    if not path.exists():
        return {}
    raw = _read_json(path)
    return {key: len(value) for key, value in raw.items() if isinstance(value, list)}


def _crossing_status(timestep: int, distance_m: Optional[float]) -> tuple[bool, str]:
    if distance_m == 0:
        return True, "geometry_intersection"
    if distance_m is not None and distance_m <= CROSSING_PROXIMITY_METERS:
        return True, f"geometry_proximity_{int(CROSSING_PROXIMITY_METERS)}m"
    if timestep >= 3:
        return True, "prd_timeline_fallback_no_geometry_crossing"
    return False, "geometry_no_crossing"


def load_scenario(timestep: int) -> dict[str, Any]:
    fire_path = TIMESTEP_FIRE_FILES[timestep]
    fire_perimeter = _read_json(fire_path)
    infrastructure = _read_json(INFRASTRUCTURE_FILE)
    dependency_graph = normalize_dependency_graph(infrastructure)
    line_coordinates = infrastructure["nodes"]["transmission_line_A"]["coordinates"]
    distance_m = _fire_line_distance_m(
        fire_segments=_fire_segments(fire_perimeter),
        line_segments=_line_segments(line_coordinates),
    )
    fire_crosses_line_a, trigger_source = _crossing_status(timestep, distance_m)

    return {
        "scenario_id": "palisades_2025",
        "fire_perimeter": fire_perimeter,
        "infrastructure": infrastructure,
        "dependency_graph": dependency_graph,
        "fire_crosses_line_a": fire_crosses_line_a,
        "trigger_source": trigger_source,
        "fire_line_distance_m": round(distance_m, 1) if distance_m is not None else None,
        "data_sources": {
            "fire_perimeter_file": str(fire_path.relative_to(PROJECT_ROOT)),
            "infrastructure_file": str(INFRASTRUCTURE_FILE.relative_to(PROJECT_ROOT)),
            "osm_file": str(OSM_INFRASTRUCTURE_FILE.relative_to(PROJECT_ROOT)),
            "osm_counts": _osm_counts(OSM_INFRASTRUCTURE_FILE),
            "dependency_direction": "normalized_from_dependent_to_upstream",
            "crossing_proximity_threshold_m": CROSSING_PROXIMITY_METERS,
        },
    }
