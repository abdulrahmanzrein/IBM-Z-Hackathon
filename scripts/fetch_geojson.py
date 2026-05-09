import requests
import json
import os

NIFC_URL = "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Interagency_Perimeters/FeatureServer/0/query"
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "geojson")

def fetch_final_perimeter():
    # The 2025 Palisades Fire — NIFC only stores the final perimeter (23,448 acres)
    params = {
        "where": "attr_IncidentName = 'Palisades' AND poly_GISAcres > 20000",
        "outFields": "attr_IncidentName,poly_PolygonDateTime,poly_GISAcres",
        "f": "geojson"
    }
    r = requests.get(NIFC_URL, params=params, timeout=30)
    r.raise_for_status()
    return r.json()

def get_centroid(coords):
    lons = [c[0] for c in coords]
    lats = [c[1] for c in coords]
    return sum(lons) / len(lons), sum(lats) / len(lats)

def scale_polygon(feature, scale):
    """Scale a polygon toward its centroid by scale factor (0.0–1.0)."""
    geometry = feature["geometry"]
    scaled = json.loads(json.dumps(feature))

    if geometry["type"] == "Polygon":
        rings = geometry["coordinates"]
    elif geometry["type"] == "MultiPolygon":
        rings = [ring for poly in geometry["coordinates"] for ring in poly]
    else:
        return feature

    all_coords = [c for ring in rings for c in ring]
    cx, cy = get_centroid(all_coords)

    def scale_ring(ring):
        return [[cx + (c[0] - cx) * scale, cy + (c[1] - cy) * scale] for c in ring]

    if geometry["type"] == "Polygon":
        scaled["geometry"]["coordinates"] = [scale_ring(r) for r in geometry["coordinates"]]
    elif geometry["type"] == "MultiPolygon":
        scaled["geometry"]["coordinates"] = [
            [scale_ring(r) for r in poly] for poly in geometry["coordinates"]
        ]
    return scaled

def save(geojson, filename):
    path = os.path.join(OUT_DIR, filename)
    with open(path, "w") as f:
        json.dump(geojson, f, indent=2)
    print(f"Saved {filename} ({len(geojson.get('features', []))} features)")

def wrap_feature(feature):
    return {"type": "FeatureCollection", "features": [feature]}

def fetch():
    print("Fetching 2025 Palisades Fire perimeter from NIFC...")
    data = fetch_final_perimeter()
    features = data.get("features", [])

    if not features:
        print("No perimeter found — check NIFC query")
        return

    final = features[0]
    print(f"Got final perimeter — {final['properties'].get('poly_GISAcres', '?')} acres")

    # T+0: 25% of final size — fire just started
    save(wrap_feature(scale_polygon(final, 0.25)), "palisades_T0.geojson")

    # T+15: 60% of final size — fire crosses Line A
    save(wrap_feature(scale_polygon(final, 0.60)), "palisades_T15.geojson")

    # T+30: full real perimeter — PCH blocked, 23,448 acres
    save(wrap_feature(final), "palisades_T30.geojson")

    print("Done. All three timesteps saved to data/geojson/")

if __name__ == "__main__":
    fetch()
