# Physics Engine Dashboard — Design Spec
**Date:** 2026-05-10
**Status:** Approved

---

## Problem

The physics validation is the core technical differentiator of StormOS — deterministic Rothermel-inspired fire spread feeding a cascade graph — but judges can't see it. It's buried in API response data with no visible representation in the UI.

---

## Goal

Make judges feel the physics running. Show the inputs → engine → outputs calculation that drives every coordinator recommendation, in a format readable in under 5 seconds.

---

## Design

### Placement

Collapsible section in the right sidebar, between the sidebar kicker and the Plan/Sync tabs. Always in the sidebar's visual hierarchy — judges see it as the foundation for the plan below it.

### Collapsed State (default)

Single-line summary:
```
Physics Engine · CRITICAL · 13.7 fpm · Line A: 0 min  ⌄
```
Color-coded accent matching threat level. Chevron toggles expand/collapse.

### Expanded State

Two-column dashboard separated by a labeled center arrow:

**Left — Inputs:**
- Wind: `{wind_mph} mph`
- Slope: `34°`
- Fuel Rate: `2.8 fpm`
- Rainfall: `{rainfall_in_hr} in/hr`

**Center:** `→ Rothermel Engine →`

**Right — Outputs:**
- Spread Rate: `{spread_rate_fpm} fpm`
- Threat: `{threat_level}` (color-coded red/orange/green)
- Time to Line A: `{prediction_window_min} min`
- Debris Risk: `{debris_threat} · {debris_probability * 100}%`

### Before Dispatch

Placeholder state: *"Run dispatch to activate physics engine"* with grayed-out input/output boxes. Clicking it triggers dispatch.

### Color Coding

Border and threat label color driven by `threat_level`:
- `CRITICAL` → red (`#ef4444`)
- `HIGH` / `ELEVATED` → orange (`#f59e0b`)
- `MODERATE` → green (`#65a30d`)

---

## Data Sources

All from existing `apiData` — no backend changes:

| Field | Source |
|-------|--------|
| wind_mph | `apiData.data_sources.weather.effective.wind_mph` |
| rainfall_in_hr | `apiData.data_sources.weather.effective.rainfall_in_hr` |
| spread_rate_fpm | `apiData.physics.spread_rate_fpm` |
| threat_level | `apiData.physics.threat_level` |
| prediction_window_min | `apiData.prediction.prediction_window_min` |
| debris_threat | `apiData.physics.debris_threat` |
| debris_probability | `apiData.physics.debris_probability` |
| slope_deg | Hardcoded: `34` (scenario constant) |
| fuel_base_rate | Hardcoded: `2.8` (scenario constant) |

---

## Implementation

**Files changed:**
- `frontend/src/App.jsx` — add `physicsOpen` state, inline `PhysicsEngine` section in sidebar JSX
- `frontend/src/App.css` — styles for `.physics-engine`, `.physics-io`, `.physics-arrow`, `.physics-row`

**No backend changes.**
