from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


NodeStatus = Literal["OPERATIONAL", "FAILED", "AT_RISK"]
RouteStatus = Literal["CLEAR", "DEGRADED", "BLOCKED"]
ThreatLevel = Literal["CRITICAL", "HIGH", "ELEVATED", "MODERATE"]
DebrisThreat = Literal["HIGH", "MODERATE", "LOW"]


class Location(BaseModel):
    name: str
    latitude: float
    longitude: float


class PhysicsSummary(BaseModel):
    threat_level: ThreatLevel
    spread_rate_fpm: float
    debris_probability: float
    debris_threat: DebrisThreat


class PredictionSummary(BaseModel):
    prediction_window_min: int
    next_failure: str
    status: str
    cascade_if_unmitigated: list[str]
    preventive_actions: dict[str, str]


class EffectiveWeather(BaseModel):
    wind_mph: float
    rainfall_in_hr: float
    adjustments: list[str] = Field(default_factory=list)


class WeatherSource(BaseModel):
    provider: str
    live: bool
    fallback_used: bool
    fetched_at: str
    temperature_f: float
    wind_mph: float
    wind_direction_deg: int
    wind_gust_mph: float
    rainfall_in_hr: float
    effective: EffectiveWeather
    fallback_values: dict[str, float]
    observed_at: Optional[str] = None
    fallback_reason: Optional[str] = None


class NamedSource(BaseModel):
    provider: str
    mode: str


class AIProviderStatus(BaseModel):
    provider: str
    model: str
    fallback_used: bool
    reason: str = ""


class DataSources(BaseModel):
    weather: WeatherSource
    fire_perimeter: NamedSource
    infrastructure: NamedSource
    ai_stack: dict[str, AIProviderStatus]
    physics: list[str]


class AgentEvent(BaseModel):
    type: Literal["physics_computed", "agent_rejected", "agent_validated", "coordinator_done"]
    agent: str
    violation: str = ""
    output: dict[str, Any] = Field(default_factory=dict)
    retry: Optional[int] = None


class DispatchResponse(BaseModel):
    disaster_type: Literal["wildfire"]
    scenario_id: str
    timestep: Literal[0, 15, 30]
    timestep_label: str
    location: Location
    physics: PhysicsSummary
    prediction: PredictionSummary
    cascade_status: dict[str, NodeStatus]
    evacuation_routes: dict[str, RouteStatus]
    agents: dict[str, dict[str, Any]]
    data_sources: DataSources
    events: list[AgentEvent]
