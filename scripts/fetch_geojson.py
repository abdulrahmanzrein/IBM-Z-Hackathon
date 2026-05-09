# P3 owns — downloads 2025 Palisades Fire perimeters from NIFC
# Output: data/geojson/palisades_T0.geojson, T15, T30

import requests, json

NIFC_URL = "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/Active_Fires/FeatureServer/0/query"

def fetch():
    # TODO: query NIFC for 2025 Palisades Fire historical perimeters
    # TODO: split into T+0, T+15, T+30 snapshots
    # TODO: write to data/geojson/
    pass

if __name__ == "__main__":
    fetch()
