from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.agents.cascade import run_cascade_agent
from backend.agents.coordinator import run_coordinator_agent
from backend.agents.hazard import run_hazard_agent
from backend.agents.secondary import run_debris_flow_agent
from backend.physics.cascade import compute_cascade
from backend.physics.debris import compute_debris_physics
from backend.physics.fire import compute_fire_physics
from backend.services.weather import apply_demo_weather_floor, fetch_open_meteo_weather
from backend.validator import MAX_RETRIES, make_event, validate_debris_agent


app = FastAPI(title="StormOS Backend")

# Allow local frontend dev servers to call this API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# PRD demo scenario values for the Palisades cascade.
DEMO_SCENARIO = {
    "scenario_id": "palisades_2025",
    "timestep": 15,
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


@app.get("/")
async def root() -> dict:
    return {"service": "StormOS Backend", "status": "online"}


@app.get("/health")
async def health() -> dict:
    return {"status": "healthy"}


@app.post("/dispatch/wildfire/1")
async def dispatch_wildfire() -> dict:
    conditions = DEMO_SCENARIO["conditions"]
    location = DEMO_SCENARIO["location"]
    weather = fetch_open_meteo_weather(
        latitude=location["latitude"],
        longitude=location["longitude"],
    )
    effective_weather = apply_demo_weather_floor(weather, conditions)

    # Run deterministic physics before any agent output.
    fire_physics = compute_fire_physics(
        slope_deg=conditions["slope_deg"],
        wind_mph=effective_weather["wind_mph"],
        fuel_base_rate_fpm=conditions["fuel_base_rate_fpm"],
    )
    cascade_physics = compute_cascade(
        fire_crosses_line_a=conditions["fire_crosses_line_a"],
    )
    debris_physics = compute_debris_physics(
        slope_deg=conditions["slope_deg"],
        burn_severity=conditions["burn_severity"],
        rainfall_in_hr=effective_weather["rainfall_in_hr"],
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
    debris_agent_output = None
    for attempt in range(1, MAX_RETRIES + 2):
        debris_agent_output = run_debris_flow_agent(attempt)
        validation = validate_debris_agent(debris_physics, debris_agent_output, attempt)
        events.append(validation["event"])
        if validation["valid"]:
            break

    # Build agency-facing outputs after validation.
    hazard_output = run_hazard_agent(fire_physics)
    cascade_output = run_cascade_agent(cascade_physics)
    coordinator_output = run_coordinator_agent()
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
        "timestep": DEMO_SCENARIO["timestep"],
        "location": DEMO_SCENARIO["location"],
        "physics": {
            "threat_level": fire_physics["threat_level"],
            "spread_rate_fpm": fire_physics["spread_rate_fpm"],
            "debris_probability": debris_physics["debris_probability"],
            "debris_threat": debris_physics["debris_threat"],
        },
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
                "provider": "NIFC historical GeoJSON",
                "mode": "planned",
            },
            "infrastructure": {
                "provider": "OpenStreetMap",
                "mode": "planned",
            },
            "physics": ["Rothermel-inspired spread", "deterministic graph", "USGS M1-style debris flow"],
        },
        "events": events,
    }
