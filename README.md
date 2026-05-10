# StormOS

**AI that stops wildfire cascades before they become disasters.**

StormOS is a multi-agent emergency response coordination platform built for the **IBM Z × UNSA Sheridan Hackathon 2026**.

It models wildfire-driven infrastructure cascade failures in real time, validates AI recommendations against deterministic physics, and delivers coordinated emergency actions across multiple agencies before the cascade escalates.

---

## Inspiration

The January 2025 Pacific Palisades wildfire exposed a dangerous gap in emergency response: people often do not die from the wildfire itself, but from the cascading infrastructure failures that follow.

A wildfire can:

- damage power lines
- trigger substation outages
- disable traffic signals
- block evacuation routes
- create secondary hazards like debris flows

These failures happen across agencies that traditionally operate in silos.

We asked:

> **What if emergency responders could see the full cascade before it happens—with AI recommendations they can actually trust?**

That became StormOS.

---

## What StormOS Does

StormOS simulates and coordinates wildfire infrastructure emergencies in real time.

For our Pacific Palisades demo scenario, StormOS predicts a cascade where:

🔥 Fire threatens transmission infrastructure  
⚡ Power infrastructure fails  
🚦 Traffic signals lose power  
🛣️ Evacuation routes become blocked  
⛰️ Secondary hazards (debris flow) emerge

StormOS combines specialized AI agents with deterministic validation to ensure recommendations remain trustworthy.

Instead of blindly trusting LLM outputs, StormOS verifies them against known physical models.

---

## Core Features

- Multi-agent emergency response coordination
- Interactive wildfire cascade simulation dashboard
- Physics validator to catch AI hallucinations
- Infrastructure dependency graph modeling
- Real-time validator event feed
- Agency-specific tactical recommendations
- Timeline-based disaster replay simulation
- Geospatial emergency visualization

---

## Architecture

### Frontend

Built with:

- React
- JavaScript
- Vite
- Tailwind CSS
- Leaflet / React-Leaflet

Frontend capabilities:

- interactive geospatial emergency dashboard
- wildfire progression visualization
- time slider replay simulation
- agency coordination panels
- validator event feed
- infrastructure cascade visualization

---

### Backend

Python orchestration backend implementing:

- `POST /dispatch/wildfire/1`
- Rothermel-inspired wildfire threat physics
- deterministic infrastructure cascade propagation
- USGS M1-style debris flow probability
- validator rejection / retry logic
- three-agency coordinated recommendations

---

### AI Layer

StormOS uses a hybrid multi-agent AI architecture:

**Featherless AI**
- hazard specialist agent
- cascade infrastructure agent
- secondary hazard agent

**IBM watsonx.ai + Granite**
- coordinator reasoning
- cross-agency recommendation synthesis

---

### Physics Validation

StormOS validates AI recommendations using deterministic models:

- **Rothermel wildfire spread modeling**
- **Infrastructure dependency graph propagation**
- **USGS debris flow probability modeling**

If an AI recommendation violates physical constraints:

- recommendation is rejected
- violation is logged
- agent is forced to replan

This makes StormOS safer and more explainable for emergency decision-making.

---

## Tech Stack

- Python
- React
- JavaScript
- Vite
- Tailwind CSS
- Leaflet
- React-Leaflet
- Featherless AI API
- IBM watsonx.ai API
- IBM Granite
- OpenStreetMap
- Open-Meteo API
- NIFC wildfire GeoJSON
- NASA SRTM terrain data
- REST APIs
- Git
- GitHub

---

## Run Locally

### Backend

Install dependencies:

```bash
cd backend
python3 -m pip install -r requirements.txt
cd ..
```

Run server:

```bash
python3 -m uvicorn backend.main:app --reload
```

Test endpoint:

```bash
curl -X POST http://localhost:8000/dispatch/wildfire/1
```

Run tests:

```bash
PYTHONPYCACHEPREFIX=/private/tmp/stormos_pycache python3 -m pytest backend/tests
```

---

### Frontend

Install dependencies:

```bash
cd frontend
npm install
```

Run dev server:

```bash
npm run dev
```

Frontend will be available at:

```bash
http://localhost:5173
```

---

## Environment Variables

The backend runs with deterministic fallbacks by default.

Optional live AI provider configuration:

```bash
export FEATHERLESS_API_KEY=...
export FEATHERLESS_MODEL=Qwen/Qwen2.5-7B-Instruct

export WATSONX_API_KEY=...
export WATSONX_PROJECT_ID=...
export WATSONX_MODEL_ID=ibm/granite-3-8b-instruct
export WATSONX_URL=https://us-south.ml.cloud.ibm.com
```

Optional:

```bash
export WATSONX_BEARER_TOKEN=...
```

---

## Challenges

Key technical challenges included:

- integrating deterministic validation with LLM outputs
- synchronizing backend simulation with frontend visualization
- modeling infrastructure cascades clearly enough for real-time decision support
- designing a believable emergency operations dashboard within hackathon constraints
- building trustworthy AI for high-stakes emergency response

---

## Accomplishments

We are especially proud of:

**Physics-validated AI recommendations**  
AI outputs are checked before reaching operators.

**Cross-agency coordination**  
Fire response, utilities, and traffic are unified in one system.

**Clear simulation storytelling**  
The infrastructure cascade is immediately understandable.

---

## UN SDG Alignment

StormOS supports:

**SDG 11 — Sustainable Cities and Communities**  
Reducing disaster-related deaths through improved emergency coordination.

**SDG 13 — Climate Action**  
Strengthening resilience against climate-driven wildfire disasters.

**SDG 9 — Industry, Innovation and Infrastructure**  
Protecting critical infrastructure through intelligent response systems.

---

## Future Roadmap

Planned future expansion:

- real-time live incident ingestion
- flooding / hurricane / earthquake scenarios
- predictive evacuation optimization
- emergency notification integrations
- deeper GIS infrastructure modeling
- collaboration tools for incident commanders

---

## Vision

StormOS aims to become a trusted operating system for disaster coordination:

**transparent AI, physics-validated recommendations, actionable emergency intelligence—when every minute matters.**
