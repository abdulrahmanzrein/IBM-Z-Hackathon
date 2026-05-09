import requests
import json
import os

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data")

# Bounding box covering Pacific Palisades and Malibu along PCH
# south, west, north, east
BBOX = "33.95,-118.90,34.15,-118.45"

QUERY = f"""
[out:json][timeout:30];
(
  way["power"="line"]({BBOX});
  node["power"="substation"]({BBOX});
  way["power"="substation"]({BBOX});
  node["highway"="traffic_signals"]({BBOX});
  way["name"="Pacific Coast Highway"]({BBOX});
);
out geom;
"""

def fetch_osm():
    print("Querying OpenStreetMap for Pacific Palisades + Malibu infrastructure...")
    headers = {"User-Agent": "StormOS-Hackathon/1.0", "Content-Type": "application/x-www-form-urlencoded"}
    r = requests.post(OVERPASS_URL, data={"data": QUERY}, headers=headers, timeout=60)
    r.raise_for_status()
    return r.json()

def parse(data):
    power_lines = []
    substations = []
    traffic_signals = []
    pch_roads = []

    for el in data.get("elements", []):
        tags = el.get("tags", {})

        if el["type"] == "way" and tags.get("power") == "line":
            coords = [[n["lon"], n["lat"]] for n in el.get("geometry", [])]
            power_lines.append({"id": el["id"], "coordinates": coords})

        elif tags.get("power") == "substation":
            if el["type"] == "node":
                substations.append({"id": el["id"], "lat": el["lat"], "lon": el["lon"], "name": tags.get("name", "")})

        elif el["type"] == "node" and tags.get("highway") == "traffic_signals":
            traffic_signals.append({"id": el["id"], "lat": el["lat"], "lon": el["lon"]})

        elif el["type"] == "way" and tags.get("name") == "Pacific Coast Highway":
            coords = [[n["lon"], n["lat"]] for n in el.get("geometry", [])]
            pch_roads.append({"id": el["id"], "coordinates": coords})

    return {
        "power_lines": power_lines,
        "substations": substations,
        "traffic_signals": traffic_signals,
        "pch_roads": pch_roads
    }

def save(parsed):
    path = os.path.join(OUT_DIR, "osm_infrastructure.json")
    with open(path, "w") as f:
        json.dump(parsed, f, indent=2)
    print(f"Saved osm_infrastructure.json")
    print(f"  Power lines:     {len(parsed['power_lines'])}")
    print(f"  Substations:     {len(parsed['substations'])}")
    print(f"  Traffic signals: {len(parsed['traffic_signals'])}")
    print(f"  PCH road ways:   {len(parsed['pch_roads'])}")

def fetch():
    data = fetch_osm()
    parsed = parse(data)
    save(parsed)
    print("Done. Use osm_infrastructure.json to update infrastructure.json with real coordinates.")

if __name__ == "__main__":
    fetch()
