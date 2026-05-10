# Cinematic Timeline — Design Spec
**Date:** 2026-05-10
**Status:** Approved

---

## Problem

The existing autoplay jumps between 6 fixed replay steps (0→35→42→48→60→150 min) at 1.4s each. The fire perimeter teleports between positions instead of spreading. The pacing is too fast to narrate and feels mechanical.

---

## Goal

Make the timeline feel like a real wildfire unfolding in front of the judges. The fire spreads continuously and visibly. Failure moments pause and flash dramatically. The presenter can grab the slider at any point to dig in or fast-forward.

---

## Design

### Continuous Minute Ticker

Replace the 6-step replay interval with a smooth ticker:

- `setInterval` every **300ms** increments `minute` by 1
- All map rendering (fire perimeter, line colors, cascade nodes, sidebar state) already derives from `minute` via `deriveIncidentState()` — no changes to that logic
- Fire keyframe interpolation (`interpolateRings`) runs every render, so the perimeter grows visibly frame by frame
- Full run: 0→180 min = ~54 seconds of movement

### Failure Pauses

When `minute` ticks to exactly a `FAILURE_TIME`, the ticker pauses for **2.5 seconds**:

| Minute | Event | Pause |
|--------|-------|-------|
| 35 | Transmission Line A fails | 2.5s |
| 42 | Malibu Substation fails | 2.5s |
| 48 | PCH Signals fail | 2.5s |
| 60 | PCH Route blocked | 2.5s |
| 150 | Debris-flow risk active | 2.5s |

During each pause, the cascade strip node that just failed gets a **red pulse animation** (CSS keyframe flash). This draws the judge's eye to the failure without the presenter needing to point.

Total story: ~54s movement + ~12.5s pauses = **~67 seconds end to end.**

### Controls

- **Play** — starts ticker from current `minute`
- **Pause** — stops ticker, holds current `minute`
- **Reset** — stops ticker, sets `minute` to 0
- **Slider drag** — pauses autoplay while dragging, resumes on release
- **"Run Live Dispatch"** — unchanged; fetches from watsonx/Featherless independently of the ticker

### Removed

- `replaySteps` state and `replayIndex` — no longer needed
- `replayRunning` → renamed to `playing` for clarity
- `startReplay()`, `toggleReplay()`, `applyReplayStep()` — replaced by `startTicker()`, `pauseTicker()`, `resetTicker()`
- `replayRef` interval at 1.4s — replaced by ticker interval at 300ms

### State Changes

| Old | New |
|-----|-----|
| `replayRunning: bool` | `playing: bool` |
| `replaySteps: array` | removed |
| `replayIndex: number` | removed |
| `replayRef` (1.4s interval) | `tickerRef` (300ms interval) |

---

## Visual Effect — Failure Flash

A CSS keyframe animation applied to the cascade strip node on failure:

```css
@keyframes failure-flash {
  0%   { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.8); }
  50%  { box-shadow: 0 0 0 12px rgba(239, 68, 68, 0); }
  100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
}
```

Applied for the 2.5s pause duration, then removed.

---

## What Does NOT Change

- Fire keyframe interpolation logic (`interpolateRings`, `resampleRing`, `lerp`)
- `deriveIncidentState(minute)` — all cascade state derives from this unchanged
- Backend API (`/dispatch/wildfire/1`) and watsonx coordinator
- Map layers, sidebar, asset consequence panel
- Agent comms / Sync tab
- `FAILURE_TIMES` constants

---

## Files Changed

- `frontend/src/App.jsx` — ticker logic, state cleanup, failure flash trigger
- `frontend/src/App.css` — `@keyframes failure-flash` animation
