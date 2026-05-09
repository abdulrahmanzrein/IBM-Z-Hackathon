import json
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlencode
from urllib.request import urlopen


OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"


def demo_weather_fallback(reason: str) -> dict:
    return {
        "provider": "Open-Meteo",
        "live": False,
        "fallback_used": True,
        "fallback_reason": reason,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "temperature_f": 78.0,
        "wind_mph": 35.0,
        "wind_direction_deg": 270,
        "wind_gust_mph": 45.0,
        "rainfall_in_hr": 0.75,
    }


def _build_open_meteo_url(latitude: float, longitude: float) -> str:
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "current": ",".join(
            [
                "temperature_2m",
                "wind_speed_10m",
                "wind_direction_10m",
                "wind_gusts_10m",
                "precipitation",
                "rain",
            ]
        ),
        "temperature_unit": "fahrenheit",
        "wind_speed_unit": "mph",
        "precipitation_unit": "inch",
        "timezone": "America/Los_Angeles",
    }
    return f"{OPEN_METEO_URL}?{urlencode(params)}"


def _to_float(value: object, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def fetch_open_meteo_weather(
    *,
    latitude: float,
    longitude: float,
    timeout_seconds: float = 3.0,
    opener: Optional[object] = None,
) -> dict:
    url = _build_open_meteo_url(latitude, longitude)
    open_fn = opener or urlopen

    try:
        # Live weather makes the PRD scenario use real current inputs.
        with open_fn(url, timeout=timeout_seconds) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except Exception as exc:
        return demo_weather_fallback(f"weather_fetch_failed: {exc}")

    current = payload.get("current") or {}
    if not current:
        return demo_weather_fallback("weather_response_missing_current")

    rainfall = max(
        _to_float(current.get("rain")),
        _to_float(current.get("precipitation")),
    )

    return {
        "provider": "Open-Meteo",
        "live": True,
        "fallback_used": False,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "observed_at": current.get("time"),
        "temperature_f": _to_float(current.get("temperature_2m")),
        "wind_mph": _to_float(current.get("wind_speed_10m")),
        "wind_direction_deg": int(_to_float(current.get("wind_direction_10m"))),
        "wind_gust_mph": _to_float(current.get("wind_gusts_10m")),
        "rainfall_in_hr": rainfall,
    }


def apply_demo_weather_floor(weather: dict, scenario_conditions: dict) -> dict:
    effective = dict(weather)
    adjustments = []

    if effective["wind_mph"] < scenario_conditions["wind_mph"]:
        effective["wind_mph"] = float(scenario_conditions["wind_mph"])
        adjustments.append("wind_mph floored to PRD critical scenario")

    if effective["rainfall_in_hr"] <= 0:
        effective["rainfall_in_hr"] = float(scenario_conditions["rainfall_in_hr"])
        adjustments.append("rainfall_in_hr fell back to PRD debris scenario")

    effective["adjustments"] = adjustments
    return effective
