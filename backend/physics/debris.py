from typing import Literal


DebrisThreat = Literal["HIGH", "MODERATE", "LOW"]


def calculate_debris_probability(
    *,
    slope_deg: float,
    burn_severity: float,
    rainfall_in_hr: float,
) -> float:
    """
    PRD-calibrated USGS M1-style demo formula.

    The coefficients are intentionally normalized so the documented demo inputs
    slope=34, burn=0.78, rain=0.75 produce P=0.71.
    """
    # Each risk factor contributes to the final probability.
    slope_component = min(slope_deg / 40, 1.0) * 0.30
    burn_component = min(burn_severity, 1.0) * 0.30
    rain_component = min(rainfall_in_hr / 1.0, 1.0) * 0.30
    base_component = 0.0005
    return round(slope_component + burn_component + rain_component + base_component, 2)


def classify_debris_threat(probability: float) -> DebrisThreat:
    # PRD threshold: P >= 0.5 is HIGH.
    if probability >= 0.5:
        return "HIGH"
    if probability >= 0.25:
        return "MODERATE"
    return "LOW"


def compute_debris_physics(
    *,
    slope_deg: float,
    burn_severity: float,
    rainfall_in_hr: float,
) -> dict:
    # Return the label the validator will enforce.
    probability = calculate_debris_probability(
        slope_deg=slope_deg,
        burn_severity=burn_severity,
        rainfall_in_hr=rainfall_in_hr,
    )
    threat_label = classify_debris_threat(probability)
    return {
        "debris_probability": probability,
        "debris_threat": threat_label,
        "inputs": {
            "slope_deg": slope_deg,
            "burn_severity": burn_severity,
            "rainfall_in_hr": rainfall_in_hr,
        },
        "rule": "At slope=34°, burn=78%, rain=0.75in/hr, P=0.71 = HIGH.",
    }
