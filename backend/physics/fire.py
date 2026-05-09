from typing import Literal


ThreatLevel = Literal["CRITICAL", "HIGH", "ELEVATED", "MODERATE"]


def calculate_spread_rate_fpm(fuel_base_rate_fpm: float, slope_deg: float, wind_mph: float) -> float:
    """PRD Rothermel-inspired spread rule for the demo scenario."""
    spread_rate = fuel_base_rate_fpm * (1 + slope_deg / 20) * (1 + wind_mph / 15)
    return round(spread_rate, 2)


def classify_fire_threat(slope_deg: float, wind_mph: float, spread_rate_fpm: float) -> ThreatLevel:
    if slope_deg > 20 and wind_mph > 25:
        return "CRITICAL"
    if spread_rate_fpm >= 25:
        return "HIGH"
    if spread_rate_fpm >= 12:
        return "ELEVATED"
    return "MODERATE"


def compute_fire_physics(
    *,
    slope_deg: float,
    wind_mph: float,
    fuel_base_rate_fpm: float,
) -> dict:
    spread_rate_fpm = calculate_spread_rate_fpm(fuel_base_rate_fpm, slope_deg, wind_mph)
    threat_level = classify_fire_threat(slope_deg, wind_mph, spread_rate_fpm)
    return {
        "threat_level": threat_level,
        "spread_rate_fpm": spread_rate_fpm,
        "inputs": {
            "slope_deg": slope_deg,
            "wind_mph": wind_mph,
            "fuel_base_rate_fpm": fuel_base_rate_fpm,
        },
        "rule": "If slope > 20° and wind > 25mph, threat MUST be CRITICAL.",
    }
