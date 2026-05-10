# StormOS Canada
## Live Wildfire Cascade Triage for Emergency Operations
**IBM Z x UNSA Sheridan Hackathon 2026 - Product Requirements Document**

---

| Field | Detail |
|-------|--------|
| Hackathon | IBM Z x UNSA Sheridan 2026 |
| Disaster scope | Wildfire only, expanded from one fixed scenario to live Canadian wildfire incidents |
| Product thesis | Rank active wildfires by which one is most likely to trigger the next infrastructure or evacuation failure |
| Primary user | Provincial wildfire operations, municipal EOCs, dispatch supervisors, fire incident command, utility operators, traffic/transportation coordinators, evacuation planners |
| Core innovation | Live data -> physics forecast -> infrastructure cascade graph -> AI specialist agents -> deterministic validator -> coordinated responder tasks |
| Real data | Esri Canada / CWFIS active fires, ECCC weather, NRCan elevation/slope, CWFIS fire danger, OSM/critical infrastructure |
| Required AI stack | Featherless open-weight specialist agents + IBM watsonx.ai Granite coordinator |
| Team split | P1: responder-first frontend and map. P2: backend, physics, agents, validator. P3: live data adapters and scenario integration |
| SDGs | SDG 11.5 disaster deaths, SDG 13.1 climate resilience, SDG 9.1 resilient infrastructure |

---

## 1. One-Sentence Pitch

> **StormOS Canada is a live wildfire coordination system that scans active Canadian fires, predicts which one may break critical infrastructure next, validates AI recommendations against real weather and terrain physics, and gives every responding department the same action plan before evacuation routes fail.**

StormOS is not another fire map. Fire maps answer:

```text
Where is the fire?
```

StormOS answers:

```text
Which active fire is about to break something people need to survive?
Who owns the next action?
How long do they have?
Why should they trust the recommendation?
```

The government-grade version is a **national wildfire cascade triage layer**. It ingests live active fires, enriches each fire with weather, slope, fuel/fire danger, roads, power, communities, and critical services, then ranks incidents by operational urgency.

---

## 2. Problem

Wildfire response fails when each department sees a different part of the emergency.

Fire command sees flame spread. Utilities see grid risk. Traffic sees evacuation congestion. Emergency managers see exposed communities. These systems often update separately, and by the time every group agrees on the situation, the next failure may already be happening.

The hard problem is not only predicting fire behavior. It is predicting the **chain reaction**:

```text
Fire spreads
  -> power line, substation, highway, bridge, community, hospital, or shelter is threatened
    -> evacuation capacity drops
      -> response time shrinks
        -> multiple departments need synchronized action
```

StormOS exists to surface that chain before it completes.

---

## 3. What Changed From The Original Palisades PRD

| Old Scope | New Scope |
|-----------|-----------|
| One Palisades/PCH demo scenario | Live Canadian active wildfire incidents |
| Historical GeoJSON + curated assets | Public live feeds plus real enrichment APIs |
| One cascade chain | Dynamic cascade graph per selected fire |
| Demo asks "what happens to PCH?" | Product asks "which active fire needs coordinated action first?" |
| Static map focus | Ranked national incident inbox plus deep-dive command map |
| Hardcoded intervention timeline | 1h, 2h, and 3h forecast based on live wind, terrain, and nearby assets |

The Palisades scenario remains useful as a backup demo and explanatory story, but the primary product scope is now live Canadian wildfire triage.

---

## 4. Live Data Sources

StormOS must run on real public data wherever possible. Every derived recommendation must preserve source metadata so the UI can show why the system believes it.

| Source | Provides | MVP Use |
|--------|----------|---------|
| Esri Canada Active Wildfires in Canada | Active fire points with agency, fire name, latitude, longitude, start date, hectares, stage of control, response type | National live fire inbox and fire selection |
| NRCan / CWFIS | Canadian Wildland Fire Information System fire activity, fire danger, Fire Weather Index, Fire M3/hotspot products | Fire danger context and source credibility |
| ECCC MSC GeoMet | Weather observations and forecasts, wind speed, wind direction, gusts, precipitation, temperature, humidity | Live weather inputs for spread direction and risk |
| NRCan Elevation API / CDEM | Elevation data for terrain | Slope and aspect around selected fire |
| OpenStreetMap / Overpass | Roads, highways, power lines, substations, hospitals, shelters, schools, waterways | Nearby asset and evacuation-route detection |
| Statistics Canada / open population layers | Population and community exposure | Exposure scoring and resident impact labels |
| Featherless AI | Specialist reasoning for hazard, cascade, and secondary hazard agents | Domain-specific structured JSON outputs |
| IBM watsonx.ai Granite | Final cross-agency coordinator | Responder-facing common operating plan |

Known active fire fields from Esri Canada layer:

```text
Agency
Fire_Name
Latitude
Longitude
Start_Date
Hectares__Ha_
Stage_of_Control
Time_Zone
response_type
ObjectId
```

Example stage values should be normalized:

| Raw Value | Meaning | StormOS Meaning |
|-----------|---------|-----------------|
| UC | Uncontrolled | High urgency |
| BH | Being held | Monitor / moderate urgency |
| OC | Out of control, if present in source variants | High urgency |
| EX / OUT | Extinguished / out | Hide or deprioritize |

### Source Links

| Source | URL |
|--------|-----|
| Esri Canada wildfire hub | `https://climate.esri.ca/pages/wildfire` |
| Esri Canada active wildfire FeatureServer | `https://services.arcgis.com/wjcPoefzjpzCgffS/arcgis/rest/services/activefires/FeatureServer` |
| NRCan / CWFIS current wildland fire activity | `https://natural-resources.canada.ca/forests-forestry/wildland-fires/current-wildland-fire-activity-cwfis` |
| ECCC MSC GeoMet API | `https://api.weather.gc.ca/` |
| NRCan Elevation API | `https://natural-resources.canada.ca/science-data/data-analysis/geospatial-data-tools-services/elevation-api` |
| OpenStreetMap Overpass API | `https://overpass-api.de/api/interpreter` |

### Unit Normalization

Canadian source data is usually metric. StormOS normalizes every live input before physics or agents run.

| Input | Source Unit | Internal Unit | UI Display |
|-------|-------------|---------------|------------|
| Wind speed | km/h or m/s | mph and m/s | km/h plus mph in evidence panel |
| Gust speed | km/h or m/s | mph and m/s | km/h |
| Rainfall | mm/hr | in/hr and mm/hr | mm/hr |
| Fire size | hectares | hectares | hectares |
| Distance | metres | metres | km / m |
| Slope | degrees or derived from elevation | degrees | degrees |

The validator checks normalized internal values. The UI shows source units and freshness so responders can audit the recommendation.

---

## 5. Core User Workflow

### Step 1: Live Fire Inbox

The first screen ranks active Canadian fires by cascade risk.

```text
1. 2025_AB_SWF-085 - Cascade Risk 94 - Uncontrolled - 138,581 ha
2. 2025_AB_SWF-092 - Cascade Risk 88 - Uncontrolled - 88,302 ha
3. 2025_AB_PWF-044 - Evacuation Risk 81 - Uncontrolled - 52,289 ha
```

Each row must show:

```text
Fire name
Province/agency
Stage of control
Size
Nearest exposed asset
Next predicted failure
ETA
Confidence
Data freshness
```

### Step 2: Select Fire

Clicking a fire opens the command map centered on the live incident. StormOS loads:

```text
Active fire point or perimeter
Current and forecast wind
Slope and aspect
Fire danger/fuel context
Nearby roads, power assets, communities, hospitals, shelters
Evacuation corridors
```

### Step 3: Run Dispatch

StormOS runs the full prediction and agent pipeline:

```text
Live data intake
  -> physics forecast
    -> exposure/cascade graph
      -> Featherless specialist agents
        -> deterministic validator
          -> IBM watsonx coordinator
            -> responder tasks + map overlays
```

### Step 4: Responder Action

The UI answers four questions immediately:

```text
What will fail next?
When?
Who owns it?
What should they do now?
```

---

## 6. Prediction Pipeline

### 6.1 Fire Spread Approximation

MVP uses a transparent Rothermel-inspired approximation:

```text
spread_rate_fpm = fuel_base_rate_fpm * (1 + slope_deg / 20) * (1 + wind_mph / 15)
```

This is not a certified operational fire simulator. It is an explainable short-horizon hazard model used to validate AI output and demonstrate the architecture. Later versions can swap in Canadian FBP/FWI-based models or agency fire-spread services.

Inputs:

```text
fuel_base_rate_fpm
slope_deg
wind_mph
wind_direction_deg
aspect_deg
stage_of_control
fire_size_hectares
fire_danger
```

Outputs:

```text
spread_rate_fpm
dominant_spread_direction
1h / 2h / 3h spread cone
threat_level
confidence
```

### 6.2 Time-To-Impact

For each nearby asset:

```text
distance_to_asset_m
spread_rate_m_per_min
alignment_factor = wind/slope direction alignment with asset bearing
time_to_impact_min = distance_to_asset_m / adjusted_spread_rate_m_per_min
```

The MVP can use simple geometry:

```text
If asset intersects spread cone within 3 hours:
  mark asset AT_RISK
  calculate ETA
```

### 6.3 Cascade Graph

StormOS builds a dependency graph around each selected incident:

```text
Fire
  -> road / highway / bridge
  -> power line / substation
  -> traffic control / evacuation corridor
  -> community / hospital / shelter
  -> response staging area
```

Graph rules:

```text
If road segment is threatened, evacuation route becomes DEGRADED.
If road segment is blocked, downstream communities lose primary exit.
If power asset is threatened, dependent traffic/shelter/utility assets become AT_RISK.
If active fire threatens a hospital/shelter/community within ETA window, evacuation branch receives P1 task.
```

### 6.4 Cascade Risk Score

Each active fire receives a 0-100 score:

```text
cascade_risk =
  fire_control_weight
  + fire_size_weight
  + wind_speed_weight
  + wind_alignment_weight
  + slope_weight
  + fire_danger_weight
  + exposed_population_weight
  + critical_asset_weight
  + time_to_impact_weight
```

MVP scoring:

| Factor | Example Weight |
|--------|----------------|
| Uncontrolled fire | +20 |
| Size above 10,000 ha | +10 |
| Wind above 25 mph | +15 |
| Wind aligned with asset | +15 |
| Slope above 20 deg | +10 |
| Primary road within 3h cone | +15 |
| Power/substation within 3h cone | +10 |
| Community/hospital/shelter exposed | +15 |
| ETA under 90 minutes | +20 |

Clamp final score to 100.

---

## 7. Agent Architecture

StormOS agents are not allowed to invent facts. They reason over a shared incident context produced by deterministic data and physics services.

| Agent | Provider | Input | Output | Validation |
|-------|----------|-------|--------|------------|
| Weather Agent | Deterministic service + optional Featherless summary | ECCC wind, gust, precipitation, humidity | Weather risk summary and confidence | Must match numeric weather values |
| Terrain Agent | Deterministic service | NRCan elevation, slope, aspect | Slope/aspect risk summary | Must match calculated slope/aspect |
| Hazard Agent | Featherless | Fire, weather, slope, fire danger | Spread concern, threat label, likely direction | Must match physics threat and spread cone |
| Cascade Agent | Featherless | Nearby assets and dependency graph | Next infrastructure failure and downstream chain | Must match deterministic graph |
| Secondary Agent | Featherless | Burn area, slope, rain | Debris/smoke/secondary hazard note | Must match threshold rules |
| Physics Validator | Deterministic Python | All agent outputs and ground truth | Pass/fail, violation, retry instruction | No LLM |
| Coordinator | IBM watsonx.ai Granite | Validated specialist outputs | One common operating plan and station tasks | Must cite validated inputs |

### Required Provider Use

| Provider | Required Role |
|----------|---------------|
| Featherless AI | Specialist agents: Hazard, Cascade, Secondary. Current working model: `Qwen/Qwen2.5-1.5B-Instruct` |
| IBM watsonx.ai Granite | Final Coordinator. Requires valid IBM project access. Deterministic fallback allowed only if permissions fail during demo |
| Deterministic Python | Physics, validator, fallback outputs, data-source normalization |

The UI must show provider status:

```text
Featherless: live / fallback
watsonx: live / fallback
Weather: live / fallback
Terrain: live / fallback
```

No hidden fake data. If a source falls back, label it.

---

## 8. Responder-First UI Requirements

The UI must feel like a tool a responder could open tomorrow.

### Layout

```text
80% map
10% live fire ranked list
10% selected incident command panel
```

No landing page. No marketing hero. No cluttered card wall.

### Map Layers

| Layer | Required Behavior |
|-------|-------------------|
| Active fires | Live points from Canada active fire feed, sized by hectares, colored by stage of control |
| Selected fire | Strong outline, current status, data freshness |
| Wind | Direction arrow and wind-speed badge; optional streamlines later |
| Spread cone | 1h, 2h, 3h projected cone based on wind/slope |
| Terrain | Hillshade/topographic base plus slope risk overlay near selected fire |
| Roads/evacuation | Primary routes highlighted, route status CLEAR/DEGRADED/BLOCKED |
| Power/infrastructure | Power lines, substations, hospitals, shelters, communities when nearby |
| Impact labels | Only show ETA, owner, and action. Avoid clutter |

### Right Command Panel

Must show only:

```text
NEXT FAILURE
ETA
OWNER
DO THIS NOW
WHY WE TRUST IT
```

Example:

```text
NEXT FAILURE
Highway 35 evacuation corridor

ETA
74 minutes

OWNER
Traffic + Evacuation

DO THIS NOW
Stage officers at north and south control points.

WHY WE TRUST IT
Uncontrolled fire. Wind 31 mph from WSW. Slope 26 deg. Route intersects 2h cone.
```

### Agent Comms

Agents must appear as a readable operational conversation:

```text
Weather -> Physics: Wind 31 mph WSW verified.
Terrain -> Physics: East slope 26 deg, aligned with spread.
Physics -> Validator: Highway 35 intersects 2h cone.
Validator -> Cascade Agent: Output accepted.
Coordinator -> Traffic: Stage officers before corridor degrades.
Coordinator -> Evacuation: Send early warning to exposed community.
```

### Accessibility

| Requirement | Why |
|-------------|-----|
| Large readable text | Dispatch environments are stressful |
| Color plus text status | Do not rely on color alone |
| Minimal panels | Map must remain primary |
| High contrast | Outdoor / emergency display readability |
| Keyboard-accessible controls | Operational accessibility |
| No clipped words | Every instruction must be complete |

---

## 9. Backend API Contract

### `GET /fires/canada/live`

Returns ranked active fires.

```json
{
  "source": "Esri Canada Active Wildfires",
  "fetched_at": "2026-05-10T00:00:00Z",
  "fires": [
    {
      "id": "2025_AB_SWF-085-2025",
      "agency": "AB",
      "name": "2025_AB_SWF-085-2025",
      "latitude": 56.789,
      "longitude": -113.8376,
      "hectares": 138581,
      "stage_of_control": "UC",
      "response_type": "FUL",
      "cascade_risk": 94,
      "next_failure": "Highway evacuation corridor",
      "eta_min": 74,
      "confidence": 0.82
    }
  ]
}
```

### `POST /dispatch/wildfire/{fire_id}`

Runs the full StormOS pipeline for one live fire.

```json
{
  "disaster_type": "wildfire",
  "scenario_id": "canada_live",
  "fire_id": "2025_AB_SWF-085-2025",
  "location": {
    "name": "2025_AB_SWF-085-2025",
    "latitude": 56.789,
    "longitude": -113.8376
  },
  "live_inputs": {
    "active_fire": {},
    "weather": {},
    "terrain": {},
    "nearby_assets": []
  },
  "physics": {
    "threat_level": "CRITICAL",
    "spread_rate_fpm": 25.2,
    "dominant_direction_deg": 82,
    "slope_deg": 26,
    "wind_mph": 31
  },
  "prediction": {
    "prediction_window_min": 180,
    "next_failure": "highway_corridor_35",
    "eta_min": 74,
    "cascade_if_unmitigated": [
      "highway_corridor_35 DEGRADED",
      "community_primary_exit AT_RISK",
      "evacuation_capacity REDUCED"
    ],
    "preventive_actions": {
      "fire_incident_command": "Hold east flank before highway corridor.",
      "traffic_management": "Stage officers at control points.",
      "evacuation_branch": "Warn exposed community now.",
      "utility_operator": "Check power assets inside spread cone."
    }
  },
  "agents": {
    "hazard": {},
    "cascade": {},
    "secondary": {},
    "coordinator": {}
  },
  "data_sources": {
    "weather": {"provider": "ECCC MSC GeoMet", "fallback_used": false},
    "terrain": {"provider": "NRCan Elevation API", "fallback_used": false},
    "active_fire": {"provider": "Esri Canada / CWFIS", "fallback_used": false},
    "ai_stack": {}
  },
  "events": []
}
```

### `GET /dispatch/wildfire/{fire_id}/events`

Streams agent comms and validation events in real time.

---

## 10. MVP Build Plan

### Phase 1: Live Fire Intake

Goal: replace the single hardcoded scenario selector with real Canadian fires.

Deliverables:

```text
backend/services/canada_fires.py
GET /fires/canada/live
fire normalization model
ranked list in frontend
```

Acceptance:

```text
App loads real active fires from public ArcGIS service.
Each fire has name, agency, hectares, stage, lat/lon, data source.
UI shows ranked list with no fake fire names.
```

### Phase 2: Weather + Terrain Enrichment

Goal: every selected fire gets live operational context.

Deliverables:

```text
backend/services/eccc_weather.py
backend/services/terrain.py
wind speed/direction/gust/rain
slope/aspect sample around selected fire
fallback labels if API fails
```

Acceptance:

```text
Selected fire panel shows wind, direction, rainfall, slope, aspect, and source freshness.
No hidden fallback values.
```

### Phase 3: Real Asset Detection

Goal: find what the fire can break.

Deliverables:

```text
OpenStreetMap query around selected fire
roads, highways, power lines, substations, hospitals, shelters, communities
nearest asset list
asset distance and bearing
```

Acceptance:

```text
For each selected fire, UI can show top 5 exposed assets and the most likely next failure.
```

### Phase 4: 1h / 2h / 3h Spread Cone

Goal: show forward prediction, not just a point on a map.

Deliverables:

```text
spread cone geometry
time-to-impact calculation
intersection with assets
timeline slider from now to 3h
```

Acceptance:

```text
Dragging timeline changes spread cone and affected assets.
At least one real Canadian fire produces a meaningful exposed-route or exposed-community case.
```

### Phase 5: Agent Pipeline Grounded In Real Inputs

Goal: agents coordinate from real source data.

Deliverables:

```text
Featherless Hazard Agent uses live weather/terrain/fire context
Featherless Cascade Agent uses real asset graph
Validator checks every agent claim against numeric inputs
watsonx Coordinator produces station tasks
Agent Comms panel shows source -> target messages
```

Acceptance:

```text
AI provider status is visible.
Featherless specialist agents run live when keys work.
watsonx runs live when project permissions are fixed.
Fallback is clearly labeled if triggered.
```

### Phase 6: Government-Grade UI Polish

Goal: make the product feel operational.

Deliverables:

```text
map-first layout
ranked live-fire inbox
right-side command panel
minimal department task strip
clear agent comms
data-source badges
high-contrast accessible design
```

Acceptance:

```text
Responder can understand the next failure, owner, action, and evidence in under 10 seconds.
No clipped text.
No card clutter.
No unlabeled fake data.
```

---

## 11. Team Responsibilities

| Person | Owns | Current Priority |
|--------|------|------------------|
| P1 - Frontend | Map-first responder UI, live fire inbox, command panel, timeline, accessibility, demo recording | Replace clutter with live national incident workflow |
| P2 - Backend / Physics / Agents | API contracts, physics, validator, Featherless/watsonx wrappers, event streaming, provider status | Build live Canadian pipeline and keep physics testable |
| P3 - Data / Integration | Canadian data feeds, OSM assets, terrain/weather integration, scenario selection, demo validation | Make real data reliable and select best live demo fire |

P2 remains responsible for correctness. P3 can own data files and provider URLs, but P2 must define the normalized schema and validator contract.

---

## 12. Demo Script

### 0:00-0:20: Real Canada Fire Inbox

Show the app loading active Canadian fires.

Voice:

```text
This is not a static demo. StormOS is reading live Canadian wildfire data and ranking active incidents by cascade risk.
```

### 0:20-0:45: Select Highest-Risk Fire

Click the top fire.

Voice:

```text
This fire is uncontrolled, large, and currently aligned with wind and terrain. StormOS pulls live weather, terrain slope, and nearby infrastructure.
```

### 0:45-1:15: Prediction Moment

Show 1h/2h/3h spread cone intersecting a route or asset.

Voice:

```text
The system is not just showing where the fire is. It predicts what it may break next and how long responders have to act.
```

### 1:15-1:45: Agent Validation

Show Agent Comms and provider badges.

Voice:

```text
Featherless specialist agents reason over hazard and cascade risk, but the validator blocks any claim that contradicts live wind, slope, or graph physics.
```

### 1:45-2:15: Coordinated Plan

Show station tasks.

Voice:

```text
IBM watsonx coordinates the validated outputs into one operating plan: Fire, Utility, Traffic, and Evacuation each know what to do now.
```

### 2:15-2:30: Close

Voice:

```text
Existing tools show fires. StormOS shows the next failure and synchronizes the response before that failure becomes an evacuation crisis.
```

---

## 13. Judging Criteria Alignment

| Criterion | How StormOS Canada Wins |
|-----------|-------------------------|
| Innovation | Turns live wildfire feeds into forward infrastructure cascade prediction, not just situational awareness |
| Technical Implementation | Public live data adapters, weather/terrain enrichment, physics forecast, cascade graph, AI agents, validator, event stream |
| Impact / SDGs | Directly targets disaster deaths, climate adaptation, and infrastructure resilience |
| Usability | Responder-first map, ranked incident inbox, four-question command panel, readable agent comms |
| Presentation | Judges see live Canadian fires, real weather/slope inputs, and a coordinated action plan |

---

## 14. Risks And Mitigations

| Risk | Mitigation |
|------|------------|
| Live fire feed has missing fields | Normalize defensively. Show unknown values. Keep Palisades backup scenario |
| Weather or terrain API fails | Use deterministic fallback with visible `fallback_used=true` badge |
| No active fire has an obvious infrastructure exposure during judging | Preselect a real high-risk fire from the live feed before recording. Keep cached sample response |
| OSM asset query is sparse in remote areas | Include roads, communities, power, hospitals, shelters. If power data missing, route/community exposure still carries demo |
| Featherless latency | Use confirmed working `Qwen/Qwen2.5-1.5B-Instruct`, timeout 45 seconds, deterministic fallback labeled |
| watsonx permissions fail | Use deterministic coordinator fallback and show `fallback_used=true`; fix IBM project membership before final demo |
| UI becomes cluttered | Keep map primary. Only show next failure, ETA, owner, action, evidence |
| Judges ask if fire model is certified | Say no. MVP uses explainable physics-inspired validation; architecture can swap in agency-grade FBP/FWI models |

---

## 15. Definition Of Done

StormOS Canada is demo-ready when:

```text
Live Canadian active fires load.
At least one real fire can be selected.
Selected fire shows live/fresh weather and terrain context.
Map shows 1h/2h/3h spread cone.
System identifies a next threatened route, asset, or community.
Featherless specialist agents run live or visibly fallback.
watsonx coordinator runs live or visibly fallback.
Validator events appear in Agent Comms.
Responder panel gives one clear action per department.
No UI text is clipped.
No source data is secretly fake.
```

---

## 16. Final Product Statement

> **StormOS Canada gives emergency operations teams a live, physics-validated view of which wildfire is about to become an infrastructure failure. It ranks active fires, predicts the next asset or evacuation route at risk, validates AI recommendations against real wind and terrain, and gives Fire, Utility, Traffic, and Evacuation one shared plan before the failure happens.**
