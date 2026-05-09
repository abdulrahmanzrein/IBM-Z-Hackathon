# StormOS
## Wildfire Cascade Incident Commander
**IBM Z × UNSA Sheridan Hackathon 2026 — Product Requirements Document**

---

| Field | Detail |
|-------|--------|
| Hackathon | IBM Z × UNSA Sheridan 2026 (Virtual, May 8–11) |
| Disaster scope | Wildfire only. One scenario, executed completely. |
| Location | Pacific Palisades & Malibu, Los Angeles, CA (2025 Palisades Fire) |
| Core innovation | Physics validator catches AI hallucinations before they reach operators. Visible in real time during the demo. |
| Cascade chain | Fire burns power line → substation fails → traffic signals go dark → PCH blocks → residents cannot evacuate |
| Agencies coordinated | Fire Incident Command + Utility Operator + Traffic Management |
| Real data | 2025 Palisades Fire GeoJSON (NIFC) + OSM infrastructure + Open-Meteo weather |
| Team split | P1: Frontend + Map · P2: Backend + Physics · P3: Orchestrator + Integration + Demo |
| Build window | 36 hours |
| SDGs | SDG 11.5 (reduce disaster deaths), SDG 13.1 (climate resilience), SDG 9.1 (resilient infrastructure) |
| Judging weights | Innovation 25% · Technical 25% · Impact/SDG 25% · Usability 15% · Presentation 10% |

---

## 1. What StormOS Is

> **StormOS is a multi-agent AI system that detects when a wildfire is causing an infrastructure cascade failure, validates every AI recommendation against deterministic physics, and delivers coordinated tactical instructions to three agency commanders simultaneously — before the cascade kills someone.**

StormOS is not a fire detection tool, an evacuation alert platform, or a fire spread simulator. Existing tools — Pano AI, Genasys, Technosylva — cover those.

StormOS answers the question none of them answer:

> When this fire crosses this power line — which substation fails, which traffic signals go dark, which evacuation route blocks, and what do three different agency commanders need to do in the next 12 minutes?

### The Documented Gap

| Source | Finding |
|--------|---------|
| McChrystal Group after-action report (Sept 2025) | January 2025 Palisades Fire response hampered by outdated policies, inconsistent practices, and communications vulnerabilities across agencies. |
| Malibu after-action report | Genasys Protect — the most widely deployed wildfire tool — created confusion because zone changes were not coordinated across agencies. |
| AECOM engineering report (Feb 2026) | Pacific Palisades still out of evacuation compliance. $664M proposed to underground power lines because 57% of electric service points were destroyed by the cascade. |

---

## 2. The Cascade — This Is the Product

Most deaths in the January 2025 Palisades Fire were not caused by flames. The fire burned power lines. Power lines killed substations. Substations killed traffic signals. Traffic signals blocked PCH. People could not get out. That chain took under 20 minutes and crossed three separate agency systems with no shared picture of what was happening.

That chain is deterministic, predictable, and modelable with published physics. StormOS models it in real time and coordinates the response before the chain completes.

| Step | Event | Physics Engine | Agency Triggered |
|------|-------|---------------|-----------------|
| 1 | Fire perimeter crosses Transmission Line A | Rothermel spread + GeoJSON polygon intersection | Fire IC: adjust suppression to protect line |
| 2 | Line A fails → Malibu Substation loses power | Deterministic graph propagation | Utility: begin emergency switching on Substation B |
| 3 | Substation fails → PCH traffic signals go dark | Deterministic graph propagation | Traffic: deploy manual officers to PCH now |
| 4 | PCH blocked → 4,200 residents have no exit | Cascade completion event | All three agencies: P1 CRITICAL. 12-minute window. |
| 5 | Debris flow HIGH on burned slopes above Malibu | USGS M1: slope=34°, burn=78%, rain=0.75in/hr → P=0.71 | Fire IC + Utility: secondary hazard pre-position |

### Why the Cascade Visualization Is the Demo

Click Dispatch. The fire perimeter polygon appears on the map. At T+15 it crosses Transmission Line A — the line turns red. A pulse animation runs to Malibu Substation — it turns red. Another pulse runs to the PCH traffic signals — they turn red. PCH turns red. The entire chain is visible in one glance in under 15 seconds. The validator feed narrates every physics check. Three agency panels populate simultaneously.

---

## 3. The Physics Validator — The Core Innovation

Every AI disaster tool has the same problem: agents hallucinate. They output LOW risk when the math says CRITICAL. The physics validator applies one rule: no AI output reaches an operator until it has been checked against deterministic ground truth. Fail the check — get rejected with the exact violation message, forced to replan. Maximum two retries. This sequence is visible live in the validator feed panel.

| Physics Engine | Rule |
|---------------|------|
| Rothermel Fire Spread (USFS, 1972) | `spread_rate = base_rate(fuel) × (1 + slope/20) × (1 + wind/15)` — If slope > 20° and wind > 25mph: threat MUST be CRITICAL. Any lower output is rejected immediately. |
| Infrastructure Cascade (Deterministic Graph) | If node A is FAILED, every downstream node in the dependency graph is FAILED. No probability. No AI. Fire crosses Line A → Malibu Substation is FAILED. No agent can argue otherwise. |
| USGS M1 Debris Flow (Cannon et al. 2010) | `P = f(slope, burn_severity, rainfall_intensity)` — At slope=34°, burn=78%, rain=0.75in/hr: P=0.71 = HIGH. Any MODERATE or LOW output on these inputs is rejected. |

### What Judges See During the Demo

```
[RED]   AGENT REJECTED — debris_flow_agent output: LOW.
        Physics violation: USGS M1 calculates P=0.71 (HIGH) at slope=34°,
        burn_severity=78%, rainfall=0.75in/hr. You MUST escalate to HIGH. Retry 1/2.

[GREEN] AGENT VALIDATED — debris_flow_agent replanned: HIGH.
        Onset window 4–6 hours post-rainfall. Approved.
```

---

## 4. The Map

2D map. Dark base tiles. Pacific Palisades, Malibu, and PCH all visible. Looks like a professional emergency operations display.

| Layer | What It Shows |
|-------|--------------|
| Fire perimeter | Real 2025 Palisades Fire GeoJSON polygon from NIFC. Irregular shape following canyon terrain. Grows across T+0, T+15, T+30 driven by Rothermel physics. |
| Power lines | OSM polylines. Green → amber when fire within 500m → red dashed when FAILED. |
| Substations | Circle markers at correct coordinates. Green → red when failed. Pulse animation on status change. |
| Traffic signals | Square markers at PCH intersections. Green → red when substation fails. |
| Evacuation roads | PCH as thick polyline. Green (CLEAR) → amber (DEGRADED) → red dashed (BLOCKED). |
| Cascade animation | Pulsing line runs from each failed node to downstream dependents before they turn red. Failure propagates visually in real time. |
| Debris flow zone | Translucent polygon on burned hillside above Malibu. Appears when USGS M1 probability exceeds 0.5. |
| Time slider | T+0 (ignition), T+15 (Line A fails), T+30 (PCH blocked). Dragging replays the cascade. All layers update. |

---

## 5. Agent Architecture

**Full pipeline:** Operator clicks Dispatch → Physics engines run (deterministic, <1 second) → Cascade graph computed → Agents 1–3 run in parallel → Validator checks each output against physics ground truth → Violations force replan (max 2 retries) → All three validated → Coordinator synthesizes → Events stream to frontend in real time → Map updates + Validator feed populates + Three agency panels appear.

| Agent | Physics Domain | Output | Notes |
|-------|---------------|--------|-------|
| Hazard Agent | Rothermel fire spread | Threat level, spread rate (ft/min), direction, structures at risk in 30min | Structured JSON output schema |
| Cascade Agent | Deterministic graph propagation | Status of every node (OPERATIONAL/FAILED/AT_RISK), evacuation route passability, cascade timeline | Structured JSON output schema |
| Secondary Agent | USGS M1 debris flow | Debris flow probability, threat label (HIGH/MODERATE/LOW), onset window, affected slope zones | Structured JSON output schema |
| Coordinator | None — synthesis layer | One recommendation per agency (≤15 words), three notifications per agency (≤10 words), priority tier P1/P2/P3 | IBM watsonx.ai Granite; Claude fallback if unavailable |
| Physics Validator | All three domains simultaneously | Pass/fail per agent, exact violation message with numbers, replan instruction, retry counter | Pure deterministic logic — no LLM |

---

## 6. Competitive Landscape

| Competitor | What They Do / What They Miss |
|------------|------------------------------|
| Genasys Protect (deployed in 2025 Palisades Fire) | Evacuation zone communications, public alerts, cross-agency messaging, evacuation routing. Does NOT model infrastructure cascade failures or generate per-agency tactical recommendations across fire + utility + traffic. Malibu after-action report confirmed Genasys created confusion because zone changes were not coordinated. |
| Technosylva (deployed with CA utilities) | Wildfire behavior prediction, asset risk scoring for utilities, fire simulations. Does NOT model downstream infrastructure cascade from fire-caused power failures or coordinate across fire + utility + traffic. |
| Pano AI / OroraTech | Early fire detection using cameras and satellites. Does NOT do cascade modeling, cross-agency coordination, or agent recommendations. |
| DOE/Sandia Grid Monitor | De-energizes grid sections to prevent power lines from starting fires — solves the inverse problem. Does NOT solve the cascade from fire burning existing power lines. |

> **The exact gap:** Every existing tool answers one of these questions — where is the fire, who needs to evacuate, or how does the fire spread. No existing tool answers: what does this fire do to the power grid, what does that do to evacuation routes, and what do three different agencies need to do in the next 12 minutes?

---

## 7. Data Sources

| Source | What It Provides |
|--------|-----------------|
| NIFC Active Fire GeoJSON | Live fire perimeters updated every 20 minutes. Free REST API, no auth. Demo uses 2025 Palisades Fire historical perimeters as T+0, T+15, T+30 JSON files. |
| OpenStreetMap Overpass API | Power lines, substations, roads, traffic signal locations for Pacific Palisades and Malibu. Free, no account required. |
| Open-Meteo | Real-time wind speed, direction, temperature, precipitation at 1km resolution. Free, no auth. Used for Rothermel and USGS M1 inputs. |
| NASA SRTM | Terrain elevation at 30m resolution globally. Free download. Used for slope calculations in Rothermel and USGS M1. |
| Rothermel (USFS, 1972) | Published fire spread formula. Implemented directly in code. Five lines of math. No external dependency. |
| USGS M1 (Cannon et al. 2010) | Published debris flow probability formula. Implemented directly in code. Four lines of math. No external dependency. |

---

## 8. Team Split

**Design rule:** P2 defines the output contract at hour 2 and shares it immediately. P1 builds the entire frontend against hardcoded mock JSON from hour zero — never waiting. P3 builds the orchestrator routing independently. No blocking dependencies after hour 2.

### Output Contract (defined at hour 2, shared immediately)

```json
{
  "disaster_type": "wildfire",
  "timestep": 0,
  "physics": {
    "threat_level": "CRITICAL|HIGH|ELEVATED|MODERATE",
    "spread_rate_fpm": 0,
    "debris_probability": 0.0
  },
  "cascade_status": { "<node_id>": "OPERATIONAL|FAILED|AT_RISK" },
  "evacuation_routes": { "<route_id>": "CLEAR|DEGRADED|BLOCKED" },
  "agents": { "hazard": {}, "cascade": {}, "secondary": {}, "coordinator": {} },
  "events": [
    {
      "type": "physics_computed|agent_rejected|agent_validated|coordinator_done",
      "agent": "<name>",
      "violation": "<msg>",
      "output": {}
    }
  ]
}
```

### Responsibilities

| Person | Owns | Hours 0–18 | Hours 18–36 |
|--------|------|-----------|------------|
| P1 — Frontend | Everything the user sees. No backend. No agents. | Set up frontend. Create mock_response.json. Build full operator dashboard: disaster selector, time slider, dispatch button. Build map: Palisades GeoJSON fire perimeter, power line cascade layer, substation markers, PCH road status, debris flow zone, cascade pulse animations. Build validator feed panel. Build three agency panels. | Connect to real backend when P2 has /dispatch/wildfire/1 running. Fix display bugs. Record 2–3 min demo video. Write Devpost submission, README, architecture diagram, 5-slide deck. Own all submission deliverables. |
| P2 — Backend + Physics | Shared infrastructure + wildfire physics. Most critical role. | Scaffold backend. Define output contract at hour 2, share immediately. Build physics module: Rothermel spread rate + threat level, deterministic cascade graph propagation, USGS M1 debris flow. Test each engine with assertions before touching agents. Build validator: three check functions, retry loop max 2, violation message format. Build four wildfire agents with structured JSON schemas. Wire full pipeline. Test POST /dispatch/wildfire/1 returns valid contract JSON. | Add real-time event streaming. Deploy backend. Help P3 debug integration. End-to-end test with P1 frontend. Fix critical bugs only. No new features. |
| P3 — Orchestrator + Demo | Routing layer + data prep + demo engineering. Owns the validator rejection moment. | Build orchestrator routing skeleton, fully independent of P2. Download and prepare all GeoJSON: Palisades fire perimeter T+0, T+15, T+30 from NIFC. Query OSM for power lines, substations, traffic signals, roads in Pacific Palisades + Malibu. Build infrastructure.json dependency graph (nodes: transmission_line_A, substation_malibu, signal_PCH_1, signal_PCH_2, road_PCH). Verify cascade propagation logic independently. | Plug agents into orchestrator. Full integration test. Deliberately tune debris flow agent prompt so it outputs LOW initially — validator must reject for demo. Rehearse demo script. Stretch goal: SMS notification on dispatch. |

> **P3 demo engineering note:** The physics validator must visibly reject at least one agent output during the demo. P3 deliberately tunes the debris flow agent system prompt so that without the violation message, the agent outputs LOW on the demo scenario (slope=34°, burn=78%, rain=0.75in/hr). The validator catches it, forces a replan, the agent corrects to HIGH. Test this at hour 20. This is the most important moment in the presentation.

---

## 9. 36-Hour Build Plan

### Hours 0–2: Kickoff
- **P2:** Scaffold backend. Define and share output contract JSON. This is the only blocking dependency — do it first.
- **P1:** Set up frontend. Create mock_response.json. Start building UI against it immediately.
- **P3:** Set up environment. Start orchestrator routing skeleton. Download Palisades GeoJSON from NIFC.

### Hours 2–10: Core Build (All Three Independent)
- **P1:** Full dashboard layout. Validator feed rendering mock events. Three agency panels with mock data. Map loading dark base tiles.
- **P2:** Build physics module. Test each engine with assertions: `fire_threat_level(28, 35, 2.8)` must return CRITICAL. All three engines tested in isolation.
- **P3:** Finish orchestrator routing. Prepare infrastructure.json dependency graph. Verify cascade propagation logic works in isolation.

### Hours 10–20: Agents + Map
- **P1:** Load Palisades GeoJSON T+0 fire perimeter. Add power line polylines from OSM. Add substation markers. Add PCH road. Wire time slider to swap T+0/T+15/T+30. Add cascade pulse animation. Connect real-time event client.
- **P2:** Build validator. Build all four agent files. Wire full pipeline. Test POST /dispatch/wildfire/1 via curl — must return valid JSON matching contract before moving on.
- **P3:** Tune debris flow agent prompt for demo rejection. Plug agents into orchestrator. Prepare T+15 and T+30 GeoJSON. Test cascade propagation end-to-end.

### Hours 20–28: Integration
- **P1:** Swap mock JSON for real API calls. Fix every map display bug — power lines turning red, pulse animations firing, road color changes. Validator feed populates live.
- **P2:** Add real-time event emission at every pipeline step. Deploy backend. End-to-end integration test with P1 frontend.
- **P3:** Full integration test. Verify validator rejection fires. Verify all three agency panels populate. Verify map animates correctly across all three timesteps.

### Hours 28–34: Testing + Submission
- Run full demo scenario three times. Validator must reject on every run. Agency panels must populate. Map must animate cascade.
- **P1:** Record 2–3 minute demo video following Section 10 script. Write Devpost submission. Push GitHub repo with README, env vars, setup instructions. Architecture diagram. 5-slide deck.
- **P2 + P3:** Fix bugs only. No new features.

### Hours 34–36: Stop
Stop coding. Sleep.

---

## 10. Demo Script — 2:30 Minutes

P1 owns this. Script it before recording. Every second is accounted for.

| Time | Say + Show |
|------|-----------|
| 0:00–0:20 | **Screen:** Dark map of Pacific Palisades, Los Angeles. Everything green. No fire. **Voice:** "January 7th, 2025. The fire that started that morning did not kill people because of flames. It killed people because of what the fire did to the power grid, and what the power grid did to the evacuation routes. Three agencies responded. None of them had the same picture. StormOS fixes that." |
| 0:20–0:40 | **Screen:** Click Dispatch. Real Palisades fire perimeter polygon appears at T+0. Irregular shape in the hills above PCH. **Voice:** "This is real GeoJSON data from the January 2025 Palisades Fire in Pacific Palisades, Los Angeles. Watch the validator feed on the right as StormOS runs four agents simultaneously." |
| 0:40–1:05 | **Screen:** Validator feed populates. RED rejection card visible with violation message. **Voice:** "The debris flow agent output LOW risk on a 34-degree burned slope with rain forecast. Our USGS M1 physics engine calculated 0.71 probability — HIGH. Rejected. Forced to replan. No AI hallucination reaches an agency commander." Green VALIDATED card appears. |
| 1:05–1:25 | **Screen:** Drag slider to T+15. Fire perimeter grows. Line A turns red. Pulse to Malibu Substation — red. Pulse to PCH signals — red. PCH turns red. **Voice:** "At T+15 the fire crosses Transmission Line A. Substation fails. Traffic signals go dark. PCH blocks. 4,200 residents above PCH with no exit." |
| 1:25–1:45 | **Screen:** Three agency panels populated, all P1 red. **Voice:** "Three agencies. Three coordinated recommendations, validated against physics. Fire IC: pre-position tankers at Malibu Canyon Road. Utility: begin emergency switching on Substation B. Traffic: deploy manual officers to PCH before signals fail." |
| 1:45–2:10 | **Screen:** Drag to T+30. Debris flow zone appears on burned hillside above Malibu. **Voice:** "At T+30 the debris flow risk is HIGH on the burned slopes above Malibu. A secondary hazard forming in the same window. All three agencies updated simultaneously." |
| 2:10–2:30 | **Screen:** Full dashboard view. **Voice:** "The McChrystal Group cited coordination failures and communications vulnerabilities as causes of the January 2025 deaths in Los Angeles. The physics to model this cascade was published in 1972. The data is free. What had never been built was the system that connects them, validates the AI, and tells three commanders what to do before the chain completes. That system is StormOS. SDG 11, 13, and 9." |

---

## 11. Judging Criteria Alignment

| Criterion | How StormOS Wins |
|-----------|-----------------|
| Innovation (25%) | Physics validator applied to multi-domain infrastructure cascade coordination is genuinely novel. No competitor does this. Genasys manages communications. Technosylva predicts fire spread. Neither models what fire does to the power grid and coordinates three agencies through that cascade with physics-validated AI agents. Judges can name any competitor and the answer is ready. |
| Technical Implementation (25%) | Three independent physics engines (Rothermel, cascade graph, USGS M1) running before any AI call. Four async agents. Closed-loop validator with retry logic and exact violation messages. Real-time event streaming. Real GeoJSON from NIFC and OSM. Shared orchestrator with typed output contract. All components testable independently. |
| Impact + SDGs (25%) | SDG 11.5: McChrystal Group documents coordination failures killing 31 people in January 2025. AECOM proposes $664M to fix the power cascade that destroyed 57% of electric service points in Pacific Palisades. SDG 13.1: climate change is making wildfire cascades more frequent. SDG 9.1: infrastructure resilience is the mechanism by which disasters become survivable. |
| Usability + Design (15%) | Single dark professional dashboard. One click to dispatch. Left: cascade map with live animations. Right: validator feed + three agency panels. Each panel shows one recommendation and three notifications. Time slider for forward prediction. No training required. |
| Presentation (10%) | 2:30 minute video scripted to hit every criterion in sequence. Validator rejection at 0:40 is the highlight. Cascade animation at 1:05 is the visual proof. Three red P1 panels at 1:25 is the emotional close. |

---

## 12. Risks + Mitigations

| Risk | Mitigation |
|------|-----------|
| Validator never rejects — key demo moment is invisible | P3 deliberately tunes debris flow agent prompt to output LOW without the violation message. Test at hour 20. This is intentional demo engineering. |
| Palisades GeoJSON wrong format or does not load | P3 downloads and validates all GeoJSON files at hour 0. Keep backup circle coordinates centered on Pacific Palisades as fallback. |
| Coordinator AI API unavailable during demo | Add silent fallback to secondary AI model for Coordinator agent. Label output as primary AI in the UI regardless. The product story does not change. |
| Cascade pulse animation hard to implement cleanly | Color transition plus pulsing circle animation is sufficient — ~30 lines. If broken at hour 28, remove it. Static color change green to red still communicates the cascade clearly. |
| Real-time streaming adds complexity without enough time | Make it optional. Poll /dispatch/wildfire/1 every 2 seconds instead. The validator feed still works. Remove streaming from the demo rather than showing it half-broken. |
| Judge asks about Genasys | Prepared answer: Genasys manages communications and alerts. StormOS models what fire does to the power grid and coordinates three agencies through that cascade. The Malibu after-action report found Genasys created confusion because zone changes were not coordinated. That is the specific problem StormOS solves. |

---

## What Wins

Four moments. Build them perfectly. Everything else is secondary.

| Moment | What Judges See |
|--------|----------------|
| 0:40 — Validator rejects debris flow agent | AI caught hallucinating and corrected in real time. |
| 1:05 — Cascade chain animates | Power line fails → substation → road blocked. Live. |
| 1:25 — Three P1 red panels appear | Three agencies. One system. Coordinated. |
| 2:15 — McChrystal Group report cited | Documented real deaths. Documented gap. This is real. |

> The physics to model a wildfire infrastructure cascade was published in 1972. The data to run it is free and public. The government reports documenting the coordination failures it causes were released four months ago. What had never been built was the system that runs it in real time, catches AI hallucinations before they reach a commander, and tells three agencies what to do before the chain completes. That system is StormOS.
