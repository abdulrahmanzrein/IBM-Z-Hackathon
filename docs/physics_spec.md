# Foresight Physics Spec

This document defines the deterministic checks used by the P2 backend. The goal is not to claim an operational wildfire simulator. The goal is to create a testable physics truth layer that AI agents cannot contradict during the Palisades cascade demo.

## Design Rules

- Physics runs before any AI output.
- AI output can add narrative and recommendations, but cannot override physics.
- Every validator rejection must include the numbers that caused the rejection.
- Demo formulas are PRD-calibrated and intentionally small enough to audit during judging.

## Units

| Field | Unit | Source |
|-------|------|--------|
| `slope_deg` | degrees | Scenario / terrain prep |
| `wind_mph` | miles per hour | Open-Meteo live value or PRD fallback |
| `fuel_base_rate_fpm` | feet per minute | Scenario constant |
| `burn_severity` | 0.0-1.0 ratio | Scenario / burn severity prep |
| `rainfall_in_hr` | inches per hour | Open-Meteo live value or PRD fallback |

## Fire Spread

File: `backend/physics/fire.py`

Formula:

```txt
spread_rate_fpm = fuel_base_rate_fpm * (1 + slope_deg / 20) * (1 + wind_mph / 15)
```

Threat classification:

```txt
if slope_deg > 20 and wind_mph > 25:
    CRITICAL
elif spread_rate_fpm >= 25:
    HIGH
elif spread_rate_fpm >= 12:
    ELEVATED
else:
    MODERATE
```

PRD demo input:

```txt
slope_deg = 34
wind_mph = 35
fuel_base_rate_fpm = 2.8
spread_rate_fpm = 25.2
threat_level = CRITICAL
```

Validator rule:

```txt
If slope > 20 degrees and wind > 25 mph, any AI fire threat below CRITICAL is invalid.
```

## Infrastructure Cascade

File: `backend/physics/cascade.py`

Dependency graph:

```txt
transmission_line_A
  -> substation_malibu
    -> signal_PCH_1
      -> road_PCH
    -> signal_PCH_2
      -> road_PCH
```

Propagation rule:

```txt
If a node is FAILED, every downstream dependent node is FAILED.
```

Route classification:

```txt
road_PCH FAILED -> BLOCKED
any PCH signal FAILED -> DEGRADED
otherwise -> CLEAR
```

PRD demo state:

```txt
T+0: fire_crosses_line_a = false -> road_PCH CLEAR
T+15: fire_crosses_line_a = true -> road_PCH BLOCKED
T+30: cascade remains failed -> road_PCH BLOCKED
```

Validator rule:

```txt
No agent may mark a downstream node operational if an upstream dependency is failed.
```

## Debris Flow

File: `backend/physics/debris.py`

Formula:

```txt
slope_component = min(slope_deg / 40, 1.0) * 0.30
burn_component = min(burn_severity, 1.0) * 0.30
rain_component = min(rainfall_in_hr / 1.0, 1.0) * 0.30
base_component = 0.0005

probability = round(
    slope_component + burn_component + rain_component + base_component,
    2
)
```

Threat classification:

```txt
if probability >= 0.50:
    HIGH
elif probability >= 0.25:
    MODERATE
else:
    LOW
```

PRD demo input:

```txt
slope_deg = 34
burn_severity = 0.78
rainfall_in_hr = 0.75
probability = 0.71
debris_threat = HIGH
```

Validator rule:

```txt
If debris probability is 0.50 or higher, any AI debris threat below HIGH is invalid.
```

Demo rejection:

```txt
Attempt 1: debris_flow_agent says LOW -> rejected
Attempt 2: debris_flow_agent says HIGH -> accepted
```

## Weather Handling

File: `backend/services/weather.py`

Foresight fetches current weather from Open-Meteo when network access is available. The backend normalizes:

- `temperature_f`
- `wind_mph`
- `wind_direction_deg`
- `wind_gust_mph`
- `rainfall_in_hr`

If Open-Meteo fails, the backend uses PRD fallback values:

```txt
wind_mph = 35
rainfall_in_hr = 0.75
temperature_f = 78
wind_direction_deg = 270
wind_gust_mph = 45
```

For demo stability, Foresight also applies an effective-weather floor:

```txt
wind_mph below 35 -> use 35 for PRD critical scenario
rainfall_in_hr <= 0 during debris-active timesteps -> use 0.75
```

The API returns both observed weather and effective weather in `data_sources.weather`.

## What Is Simplified

- Fire spread is Rothermel-inspired, not a full fuel-model implementation.
- Debris flow is USGS M1-style and calibrated to the PRD demo point.
- Cascade graph is deterministic and binary; it does not model restoration, partial load, or probability.
- Fire-to-line failure is currently timestep-driven until P3 scenario geometry is integrated.
- AI providers do not create physics truth; they only produce structured recommendations checked by the validator.

## Test Coverage

Run:

```bash
PYTHONPYCACHEPREFIX=/private/tmp/foresight_pycache python3 -m pytest backend/tests
```

Key tests:

| Test File | What It Proves |
|-----------|----------------|
| `backend/tests/test_physics_and_validator.py` | Fire threat, cascade propagation, debris probability, validator rejection/approval |
| `backend/tests/test_weather.py` | Open-Meteo normalization, fallback values, effective-weather floor |
| `backend/tests/test_dispatch_endpoint.py` | T+0/T+15/T+30 endpoint behavior and SSE event stream |
| `backend/tests/test_schemas.py` | API response matches Pydantic contract |
| `backend/tests/test_ai_providers.py` | Featherless/watsonx wrappers preserve deterministic fallback behavior |
