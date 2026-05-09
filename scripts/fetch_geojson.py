import requests
import json
import os

NIFC_URL = "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Interagency_Perimeters/FeatureServer/0/query"
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "geojson")

def fetch_perimeters():
    params = {
        "where": "IncidentName LIKE '%PALISADES%' AND EXTRACT(YEAR FROM PerimeterDateTime) = 2025",
        "outFields": "IncidentName,PerimeterDateTime,GISAcres",
        "orderByFields": "PerimeterDateTime ASC",
        "f": "geojson"
    }
    r = requests.get(NIFC_URL, params=params, timeout=30)
    r.raise_for_status()
    return r.json()

def save(geojson, filename):
    path = os.path.join(OUT_DIR, filename)
    with open(path, "w") as f:
        json.dump(geojson, f, indent=2)
    print(f"Saved {filename} ({len(geojson.get('features', []))} features)")

def wrap_feature(feature):
    return {"type": "FeatureCollection", "features": [feature]}

def fetch():
    print("Fetching Palisades Fire perimeters from NIFC...")
    data = fetch_perimeters()
    features = data.get("features", [])

    if not features:
        print("No perimeters found — check NIFC query or fire name spelling")
        return

    print(f"Found {len(features)} perimeter snapshots")

    # T+0: earliest perimeter (ignition)
    save(wrap_feature(features[0]), "palisades_T0.geojson")

    # T+15: middle snapshot (Line A fails) — use midpoint or second available
    mid = len(features) // 2
    save(wrap_feature(features[mid]), "palisades_T15.geojson")

    # T+30: latest perimeter (PCH blocked)
    save(wrap_feature(features[-1]), "palisades_T30.geojson")

    print("Done. All three timesteps saved to data/geojson/")

if __name__ == "__main__":
    fetch()
