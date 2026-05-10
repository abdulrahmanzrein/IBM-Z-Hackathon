# StormOS Frontend

StormOS is the frontend operator dashboard for the **IBM Z × UNSA Sheridan Hackathon 2026** project.

This interface simulates a professional emergency operations dashboard for wildfire infrastructure cascade response, helping operators visualize cascading failures across utilities, transportation, evacuation routes, and emergency coordination.

---

## Overview

StormOS models a wildfire-driven infrastructure cascade scenario based on the **2025 Pacific Palisades wildfire**.

The frontend provides a real-time command dashboard experience where operators can:

- Monitor wildfire progression on an interactive map
- Visualize infrastructure failures (power lines, substations, traffic systems)
- Track cascade progression through time
- Review operational alerts
- Coordinate multiple responding agencies
- Preview forward incident progression using timeline simulation

This frontend is optimized for the hackathon demo experience.

---

## Core Features

### Interactive Incident Map

Built with **Leaflet**, the map provides:

- wildfire perimeter visualization
- transmission power line overlays
- substations
- traffic intersections
- evacuation route monitoring
- debris flow hazard zones
- community markers
- asset markers
- operational overlays

---

### Incident Timeline Simulation

Interactive timeline control allowing operators to simulate incident progression:

- **T+0m** → ignition state
- **T+35m** → transmission line risk
- **T+60m** → PCH traffic failure
- future cascade progression support

Features:

- gradient threat timeline
- draggable simulation slider
- dynamic state updates
- forward prediction visualization

---

### Agency Coordination Dashboard

Multi-agency command coordination panel for:

- Fire Operations
- Utility Operations
- Traffic Control
- Evacuation Management

Each department panel includes:

- current mission state
- threat priority
- operational recommendation
- quick action advancement

---

### Alert System

Operational alert panel with:

- severity indicators
- risk summaries
- incident facts
- decision support context

Severity levels:

- Green → Stable
- Orange → Elevated
- Red → Critical

---

### Layer Controls

Toggle operational layers on/off:

- wildfire perimeter
- infrastructure grid
- evacuation overlays
- hazard zones
- operational markers

---

## Tech Stack

Frontend stack:

- React
- Vite
- Leaflet
- React Leaflet
- Tailwind CSS (if applicable)
- shadcn/ui (if installed)
- Lucide React

---

## Project Structure

```bash
frontend/
├── src/
│   ├── App.jsx
│   ├── App.css
│   ├── components/
│   ├── assets/
│   └── utils/
├── public/
├── package.json
└── README.md
```

---

## Installation

Clone repository:

```bash
git clone https://github.com/abdulrahmanzrein/IBM-Z-Hackathon.git
```

Move into frontend:

```bash
cd IBM-Z-Hackathon/frontend
```

Install dependencies:

```bash
<<<<<<< HEAD
export FEATHERLESS_API_KEY=...
export FEATHERLESS_MODEL=Qwen/Qwen2.5-1.5B-Instruct
export FEATHERLESS_TIMEOUT_SECONDS=45

export WATSONX_API_KEY=...
export WATSONX_PROJECT_ID=...
export WATSONX_MODEL_ID=ibm/granite-3-8b-instruct
export WATSONX_URL=https://us-south.ml.cloud.ibm.com
=======
npm install
>>>>>>> origin/frontend/ui
```

Run development server:

```bash
npm run dev
```

Open:

```bash
http://localhost:5173
```

---

## Branch

Frontend development branch:

```bash
frontend/ui
```

Switch to branch:

```bash
git checkout frontend/ui
```

Pull latest changes:

```bash
git pull origin frontend/ui
```

---

## Demo Focus

This frontend is designed specifically for hackathon demonstration impact.

Key demo moments:

- wildfire ignition visualization
- infrastructure cascade propagation
- traffic disruption simulation
- multi-agency coordination view
- forward timeline prediction

Design goals:

- professional emergency operations feel
- visually understandable in seconds
- demo-friendly interactions
- clear decision support UX

---

## Notes

Current implementation prioritizes:

- polished frontend demo experience
- scenario-based simulation
- visual storytelling
- operational dashboard realism

Backend integration and real-time event streaming may evolve independently.

---

## Team

IBM Z × UNSA Sheridan Hackathon 2026
StormOS Team
