def run_cascade_agent(cascade_physics: dict, timestep: int) -> dict:
    if timestep == 0:
        timeline = [
            "T+0 fire perimeter visible",
            "Transmission Line A operational",
            "Malibu Substation operational",
            "PCH evacuation route clear",
        ]
    else:
        timeline = [
            "T+15 fire crosses Transmission Line A",
            "T+16 Malibu Substation loses upstream power",
            "T+17 PCH traffic signals go dark",
            "T+20 PCH evacuation route blocks",
        ]

    return {
        "agent": "cascade_agent",
        "node_status": cascade_physics["cascade_status"],
        "evacuation_routes": cascade_physics["evacuation_routes"],
        "cascade_timeline": timeline,
    }
