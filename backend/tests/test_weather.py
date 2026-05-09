import json

from backend.services.weather import apply_demo_weather_floor, demo_weather_fallback, fetch_open_meteo_weather


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def read(self):
        return json.dumps(self.payload).encode("utf-8")


def test_open_meteo_weather_is_normalized():
    def fake_opener(url, timeout):
        assert "api.open-meteo.com" in url
        return FakeResponse(
            {
                "current": {
                    "time": "2026-05-09T01:00",
                    "temperature_2m": 72.5,
                    "wind_speed_10m": 31.2,
                    "wind_direction_10m": 268,
                    "wind_gusts_10m": 44.1,
                    "precipitation": 0.02,
                    "rain": 0.04,
                }
            }
        )

    result = fetch_open_meteo_weather(latitude=34.045, longitude=-118.744, opener=fake_opener)

    assert result["provider"] == "Open-Meteo"
    assert result["live"] is True
    assert result["fallback_used"] is False
    assert result["wind_mph"] == 31.2
    assert result["wind_direction_deg"] == 268
    assert result["wind_gust_mph"] == 44.1
    assert result["rainfall_in_hr"] == 0.04


def test_open_meteo_failure_uses_demo_fallback():
    def failing_opener(url, timeout):
        raise TimeoutError("network down")

    result = fetch_open_meteo_weather(latitude=34.045, longitude=-118.744, opener=failing_opener)

    assert result["live"] is False
    assert result["fallback_used"] is True
    assert result["wind_mph"] == 35.0
    assert result["rainfall_in_hr"] == 0.75


def test_demo_fallback_has_prd_values():
    result = demo_weather_fallback("test")

    assert result["wind_mph"] == 35.0
    assert result["rainfall_in_hr"] == 0.75


def test_demo_weather_floor_preserves_required_prd_demo():
    weather = {
        "wind_mph": 4.0,
        "rainfall_in_hr": 0.0,
    }
    conditions = {
        "wind_mph": 35,
        "rainfall_in_hr": 0.75,
    }

    result = apply_demo_weather_floor(weather, conditions)

    assert result["wind_mph"] == 35.0
    assert result["rainfall_in_hr"] == 0.75
    assert len(result["adjustments"]) == 2
