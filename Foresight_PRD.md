# Foresight
## Wildfire Cascade Incident Commander
**IBM Z × UNSA Sheridan Hackathon 2026 — Product Requirements Document**

---

| Field | Detail |
|-------|--------|
| Hackathon | IBM Z × UNSA Sheridan 2026 (Virtual, May 8–11) |
| Disaster scope | Wildfire only. One scenario, executed completely. |
| Location | Pacific Palisades & Malibu, Los Angeles, CA (2025 Palisades Fire) |
| Core innovation | Forward prediction of wildfire infrastructure cascades, with physics validation blocking AI recommendations unless they match deterministic fire, grid, traffic, and debris-flow ground truth. |
| Cascade chain | Fire burns power line → substation fails → traffic signals go dark → PCH blocks → residents cannot evacuate |
| Agencies coordinated | Fire Incident Command + Utility Operator + Traffic Management |
| Real data | 2025 Palisades Fire GeoJSON (NIFC) + OSM infrastructure + Open-Meteo weather |
| Required AI stack | Featherless open-weight models for specialist agents + IBM watsonx.ai Granite for coordinator |
| Team split | P1: Frontend + Map · P2: Backend + Physics + Agent Pipeline · P3: Scenario Data + Integration + Demo |
| Build window | 36 hours |
| SDGs | SDG 11.5 (reduce disaster deaths), SDG 13.1 (climate resilience), SDG 9.1 (resilient infrastructure) |
| Judging weights | Innovation 25% · Technical 25% · Impact/SDG 25% · Usability 15% · Presentation 10% |

---

## 1. What Foresight Is

> **Foresight is a multi-agent AI system that predicts when a wildfire will trigger an infrastructure cascade, validates every AI recommendation against deterministic physics, and delivers coordinated tactical instructions to three agency commanders before the cascade blocks evacuation.**

Foresight is best understood as a **cascade intelligence layer for wildfire Emergency Operations Centers (EOCs)**. It is not a fire detection tool, an evacuation alert platform, a public wildfire app, or a replacement for incident commanders. Existing tools — Pano AI, Watch Duty, Genasys, Technosylva — cover parts of those jobs.

Foresight answers the question none of them answer:

> At the current wind, slope, and fire perimeter, which power line fails next, what fails downstream, how long until evacuation access collapses, and what do three agency commanders need to do before that window closes?

The product wedge is narrow on purpose:

> **Genasys helps communicate who should evacuate. Technosylva helps predict fire behavior. Foresight predicts when the fire breaks the infrastructure people need to evacuate — then synchronizes Fire, Utility, and Traffic from one physics-validated incident graph.**

### The Documented Gap

| Source | Finding |
|--------|---------|
| McChrystal Group after-action report (Sept 2025) | January 2025 Palisades Fire response hampered by outdated policies, inconsistent practices, and communications vulnerabilities across agencies. |
| Malibu after-action report | Genasys Protect — the most widely deployed wildfire tool — created confusion because zone changes were not coordinated across agencies. |
| AECOM engineering report (Feb 2026) | Pacific Palisades still out of evacuation compliance. $664M proposed to underground power lines because 57% of electric service points were destroyed by the cascade. |

### What Foresight Does Not Claim

| Not Claiming | Why |
|--------------|-----|
| Not replacing Genasys, Watch Duty, Technosylva, Pano AI, or dispatchers | Foresight should plug into the EOC workflow as a decision-support layer, not compete as a full emergency-management suite. |
| Not a certified operational fire-spread model | The demo uses PRD-calibrated deterministic physics inspired by published models. It proves the validation pattern and cascade workflow. |
| Not a public evacuation alert system | Foresight produces agency recommendations; official public warnings still come from authorized emergency managers. |
| Not fully live Palisades 2025 recreation | The demo uses historical fire geometry, public infrastructure data, and live/current weather where available. |

---

## 2. The Cascade — This Is the Product

Foresight focuses on the failure chain that makes a wildfire become a multi-agency infrastructure emergency. The fire burns power lines. Power lines kill substations. Substations kill traffic signals. Traffic signals block PCH. People cannot get out. That chain can unfold in minutes and crosses separate agency systems with no guaranteed shared picture of what is about to happen.

That chain is deterministic, predictable, and modelable with published physics. Foresight models it forward in time, identifies the next likely infrastructure failure, calculates the unmitigated downstream cascade, and coordinates agency action before the chain completes.

| Step | Prediction / Event | Physics Engine | Agency Triggered |
|------|--------------------|---------------|-----------------|
| 1 | Fire projected to cross Transmission Line A within the action window | Rothermel spread + GeoJSON polygon intersection | Fire IC: protect line before contact |
| 2 | If Line A fails, Malibu Substation will lose upstream power | Deterministic graph propagation | Utility: begin emergency switching on Substation B before outage |
| 3 | If substation fails, PCH traffic signals will go dark | Deterministic graph propagation | Traffic: deploy manual officers before signal loss |
| 4 | If signals fail, PCH evacuation route becomes BLOCKED for 4,200 residents | Cascade completion event | All three agencies: P1 CRITICAL. 12-minute intervention window. |
| 5 | Debris flow risk becomes HIGH on burned slopes above Malibu | USGS M1: slope=34°, burn=78%, rain=0.75in/hr → P=0.71 | Fire IC + Utility: pre-position for secondary hazard |

### Prediction Output

Foresight should expose the forward prediction explicitly in the API and UI:

```json
{
  "prediction_window_min": 12,
  "next_failure": "transmission_line_A",
  "cascade_if_unmitigated": [
    "substation_malibu FAILED",
    "signal_PCH_1 FAILED",
    "signal_PCH_2 FAILED",
    "road_PCH BLOCKED"
  ],
  "preventive_actions": {
    "fire_incident_command": "Protect Transmission Line A now.",
    "utility_operator": "Switch load to Substation B.",
    "traffic_management": "Deploy officers to PCH signals."
  }
}
```

### Frontend Cascade State Timeline

This table is the UI contract for the map. P1 should be able to build the cascade animation directly from it.

| Object | T+0: Predicted / Pre-Failure | T+15: Cascade Starts | T+30: Secondary Hazard |
|--------|------------------------------|----------------------|------------------------|
| Fire perimeter | Ignition/initial polygon visible in hills above PCH | Expanded polygon intersects Transmission Line A | Expanded perimeter remains visible |
| Prediction window | `Line A failure in 12 min if unmitigated` | `Cascade in progress` | `Secondary debris hazard active` |
| Transmission Line A | `AT_RISK`, amber, highlighted as next failure | `FAILED`, red dashed line | `FAILED`, red dashed line |
| Malibu Substation | `OPERATIONAL`, green circle | `FAILED`, red pulsing circle | `FAILED`, red circle |
| PCH Signal 1 | `OPERATIONAL`, green square | `FAILED`, red square | `FAILED`, red square |
| PCH Signal 2 | `OPERATIONAL`, green square | `FAILED`, red square | `FAILED`, red square |
| PCH evacuation route | `CLEAR`, green route | `BLOCKED`, red dashed route | `BLOCKED`, red dashed route |
| Residents affected | `4,200 exposed if PCH blocks` warning label | `4,200 residents with no clear exit` | Exposure label remains visible |
| Debris-flow zone | Hidden | Hidden or low-opacity forecast | Visible translucent HIGH-risk polygon |
| Agency panels | Preventive actions, priority `P2` | Emergency actions, priority `P1` | P1 updates include debris-flow hazard |

### Causal Dependency Graph

The map should visually communicate this dependency chain, not just color independent objects:

```txt
Fire perimeter projected path
  -> Transmission Line A
    -> Malibu Substation
      -> PCH Signal 1
      -> PCH Signal 2
        -> PCH evacuation route
          -> 4,200 residents exposed
```

If only one visual animation is polished, polish this sequence: fire approaches line, line flashes, pulse moves to substation, pulse moves to signals, PCH turns blocked, resident exposure label appears.

### Why the Cascade Visualization Is the Demo

Click Dispatch. The fire perimeter polygon appears on the map. At T+0, Foresight predicts the fire will hit Transmission Line A inside the intervention window and shows the unmitigated cascade before it happens. At T+15 it crosses Transmission Line A — the line turns red. A pulse animation runs to Malibu Substation — it turns red. Another pulse runs to the PCH traffic signals — they turn red. PCH turns red. The product moment is that Fire, Utility, and Traffic were warned before this visible failure chain completed.

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
| Prediction window | Countdown showing minutes until next projected infrastructure failure if no mitigation occurs. |
| Power lines | OSM polylines. Green → amber when fire within 500m → red dashed when FAILED. |
| Substations | Circle markers at correct coordinates. Green → red when failed. Pulse animation on status change. |
| Traffic signals | Square markers at PCH intersections. Green → red when substation fails. |
| Evacuation roads | PCH as thick polyline. Green (CLEAR) → amber (DEGRADED) → red dashed (BLOCKED). |
| Cascade animation | Pulsing line runs from each failed node to downstream dependents before they turn red. Failure propagates visually in real time. |
| Debris flow zone | Translucent polygon on burned hillside above Malibu. Appears when USGS M1 probability exceeds 0.5. |
| Time slider | T+0 (ignition), T+15 (Line A fails), T+30 (PCH blocked). Dragging replays the cascade. All layers update. |

---

## 5. Agent Architecture

**Full pipeline:** Operator clicks Dispatch → Physics engines run (deterministic, <1 second) → Cascade graph computed → Featherless specialist agents run in parallel → Validator checks each output against physics ground truth → Violations force replan (max 2 retries) → All specialist outputs validated → IBM watsonx.ai Granite Coordinator synthesizes → Events stream to frontend in real time → Map updates + Validator feed populates + Three agency panels appear.

| Agent | Model Provider | Physics Domain | Output | Notes |
|-------|----------------|---------------|--------|-------|
| Hazard Agent | Featherless open-weight LLM | Rothermel fire spread | Threat level, spread rate (ft/min), direction, structures at risk in 30min | Structured JSON output schema. Deterministic fallback if API unavailable. |
| Cascade Agent | Featherless open-weight LLM | Deterministic graph propagation | Status of every node (OPERATIONAL/FAILED/AT_RISK), evacuation route passability, cascade timeline | Structured JSON output schema. Must not override graph truth. |
| Secondary Agent | Featherless open-weight LLM | USGS M1 debris flow | Debris flow probability, threat label (HIGH/MODERATE/LOW), onset window, affected slope zones | Deliberately outputs LOW on first demo attempt so validator rejects, then replans HIGH. |
| Coordinator | IBM watsonx.ai Granite | None — synthesis layer | One recommendation per agency (≤15 words), three notifications per agency (≤10 words), priority tier P1/P2/P3 | Final cross-agency synthesis layer. Deterministic fallback if watsonx unavailable. |
| Physics Validator | No LLM | All three domains simultaneously | Pass/fail per agent, exact violation message with numbers, replan instruction, retry counter | Pure deterministic Python logic. No AI output reaches operators until validated. |

### Required AI Provider Strategy

Foresight must visibly use both required track technologies without weakening the safety story:

| Provider | Used For | Why |
|----------|----------|-----|
| Featherless AI | Hazard, Cascade, and Secondary specialist agents | Gives Foresight open-weight, serverless specialist reasoning for each technical domain. |
| IBM watsonx.ai Granite | Coordinator agent | Produces the final cross-agency command recommendations and aligns with the IBM Z hackathon track. |
| Deterministic Python | Physics engines and validator | Establishes ground truth. This layer never calls an LLM. |

Fallback rule: if Featherless or watsonx is unavailable during the demo, deterministic fallback agents return the same structured schema and the UI labels the fallback status in `data_sources.ai_stack`. The validator remains active either way.

---

## 6. Competitive Landscape

| Competitor | What They Do / What They Miss |
|------------|------------------------------|
| Genasys Protect | Evacuation zones, public alerts, emergency communications, and coordination workflows. Strong product; Foresight should complement it by predicting infrastructure cascades that change what agencies must do before alerts go out. |
| Technosylva | Wildfire behavior prediction, asset risk scoring, fire simulations, utility wildfire operations. Strong science platform; Foresight is narrower: fire-caused downstream dependencies from power to traffic to evacuation passability. |
| Pano AI / OroraTech | Early fire detection using cameras, satellites, and verification workflows. Foresight starts after detection: what does this fire do to infrastructure dependencies? |
| Watch Duty | Public wildfire information and alerts, human-vetted updates, fire maps, wind, evacuation info. Foresight is not public-facing; it is commander-facing cascade decision support. |
| DOE/Sandia Grid Monitor | De-energizes grid sections to prevent power lines from starting fires — solves the inverse problem. Foresight solves the cascade from fire damaging existing power infrastructure. |

> **The exact gap:** Existing tools answer where the fire is, how it may spread, who may need to evacuate, or how to communicate alerts. Foresight answers: what does this fire do to the power grid, what does that do to evacuation routes, and what do Fire, Utility, and Traffic need to do from one shared validated cascade timeline?

---

## 7. Data Sources

| Source | What It Provides |
|--------|-----------------|
| NIFC Active Fire GeoJSON | Live fire perimeters updated every 20 minutes. Free REST API, no auth. Demo uses 2025 Palisades Fire historical perimeters as T+0, T+15, T+30 JSON files. |
| OpenStreetMap Overpass API | Power lines, substations, roads, traffic signal locations for Pacific Palisades and Malibu. Free, no account required. |
| Open-Meteo | Real-time wind speed, direction, temperature, precipitation at 1km resolution. Free, no auth. Used for Rothermel and USGS M1 inputs. |
| Featherless AI | Serverless open-weight LLM inference for Hazard, Cascade, and Secondary specialist agents. |
| IBM watsonx.ai Granite | Foundation model used for final cross-agency Coordinator synthesis. |
| NASA SRTM | Terrain elevation at 30m resolution globally. Free download. Used for slope calculations in Rothermel and USGS M1. |
| Rothermel (USFS, 1972) | Published fire spread formula. Implemented directly in code. Five lines of math. No external dependency. |
| USGS M1 (Cannon et al. 2010) | Published debris flow probability formula. Implemented directly in code. Four lines of math. No external dependency. |

---

## 8. Team Split

**Design rule:** P2 defines the output contract at hour 2 and shares it immediately. P1 builds the entire frontend against hardcoded mock JSON from hour zero — never waiting. P3 prepares scenario data independently against the same contract. No blocking dependencies after hour 2.

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
  "prediction": {
    "prediction_window_min": 12,
    "next_failure": "<node_id>",
    "cascade_if_unmitigated": ["<node_id> FAILED"],
    "preventive_actions": {
      "fire_incident_command": "<action>",
      "utility_operator": "<action>",
      "traffic_management": "<action>"
    }
  },
  "cascade_status": { "<node_id>": "OPERATIONAL|FAILED|AT_RISK" },
  "evacuation_routes": { "<route_id>": "CLEAR|DEGRADED|BLOCKED" },
  "agents": { "hazard": {}, "cascade": {}, "secondary": {}, "coordinator": {} },
  "data_sources": {
    "ai_stack": {
      "hazard_agent": "Featherless",
      "cascade_agent": "Featherless",
      "secondary_agent": "Featherless",
      "coordinator": "IBM watsonx.ai Granite",
      "validator": "Deterministic Python"
    }
  },
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
| P2 — Backend + Physics + Agent Pipeline | Shared backend execution pipeline, physics, validator, API contract, AI provider wrappers. Most critical role. | Scaffold backend. Define output contract at hour 2, share immediately. Build physics module: Rothermel spread rate + threat level, deterministic cascade graph propagation, USGS M1 debris flow. Test each engine with assertions before touching agents. Build validator: three check functions, retry loop max 2, violation message format. Build Featherless specialist agent wrappers and IBM watsonx Granite coordinator wrapper with deterministic fallbacks. Wire backend orchestrator pipeline. Test POST /dispatch/wildfire/1 returns valid contract JSON. | Add real-time event streaming. Add scenario-file loader and geometry hooks when P3 hands off data. Deploy backend. Help P3 debug integration. End-to-end test with P1 frontend. Fix critical bugs only. No new features. |
| P3 — Scenario Data + Integration + Demo | Scenario pack, real data prep, integration checks, and demo engineering. Owns the validator rejection moment. | Download and prepare all GeoJSON: Palisades fire perimeter T+0, T+15, T+30 from NIFC. Query OSM for power lines, substations, traffic signals, roads in Pacific Palisades + Malibu. Build `infrastructure.json`, `dependency_graph.json`, and `metadata.json` for `palisades_2025`. Verify the scenario pack independently against P2's contract. | Hand scenario pack to P2 for backend loading. Full integration test. Deliberately tune debris flow agent prompt/config so it outputs LOW initially — validator must reject for demo. Rehearse demo script. Stretch goal: SMS notification on dispatch. |

> **P3 demo engineering note:** The physics validator must visibly reject at least one agent output during the demo. P3 deliberately tunes the debris flow agent system prompt so that without the violation message, the agent outputs LOW on the demo scenario (slope=34°, burn=78%, rain=0.75in/hr). The validator catches it, forces a replan, the agent corrects to HIGH. Test this at hour 20. This is the most important moment in the presentation.

---

## 9. 36-Hour Build Plan

### Hours 0–2: Kickoff
- **P2:** Scaffold backend. Define and share output contract JSON. This is the only blocking dependency — do it first.
- **P1:** Set up frontend. Create mock_response.json. Start building UI against it immediately.
- **P3:** Set up environment. Start scenario pack folder. Download Palisades GeoJSON from NIFC.

### Hours 2–10: Core Build (All Three Independent)
- **P1:** Full dashboard layout. Validator feed rendering mock events. Three agency panels with mock data. Map loading dark base tiles.
- **P2:** Build physics module. Test each engine with assertions: `fire_threat_level(28, 35, 2.8)` must return CRITICAL. All three engines tested in isolation.
- **P3:** Prepare `infrastructure.json`, `dependency_graph.json`, and `metadata.json`. Verify scenario files match P2's node IDs.

### Hours 10–20: Agents + Map
- **P1:** Load Palisades GeoJSON T+0 fire perimeter. Add power line polylines from OSM. Add substation markers. Add PCH road. Wire time slider to swap T+0/T+15/T+30. Add cascade pulse animation. Connect real-time event client.
- **P2:** Build validator. Build Featherless wrappers for Hazard, Cascade, and Secondary agents. Build IBM watsonx.ai Granite wrapper for Coordinator. Keep deterministic fallbacks. Wire full pipeline. Test POST /dispatch/wildfire/1 via curl — must return valid JSON matching contract before moving on.
- **P3:** Tune Featherless debris flow agent prompt/config for demo rejection. Hand off T+15 and T+30 GeoJSON. Test cascade propagation end-to-end with P2.

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
| 0:00–0:20 | **Screen:** Dark map of Pacific Palisades, Los Angeles. Everything green. No fire. **Voice:** "January 7th, 2025. The danger was not only the flame front. It was the cascade: fire into power, power into traffic signals, traffic into evacuation failure. Foresight predicts that chain before it completes." |
| 0:20–0:40 | **Screen:** Click Dispatch. Real Palisades fire perimeter polygon appears at T+0. Prediction window appears: Line A failure in 12 minutes if unmitigated. **Voice:** "This is real GeoJSON data from the January 2025 Palisades Fire. At T+0, Foresight predicts the next infrastructure failure and shows what breaks downstream before it happens." |
| 0:40–1:05 | **Screen:** Validator feed populates. RED rejection card visible with violation message. **Voice:** "Our Featherless debris flow agent output LOW risk on a 34-degree burned slope with rain forecast. Our USGS M1 physics engine calculated 0.71 probability — HIGH. Rejected. Forced to replan. No AI hallucination reaches an agency commander." Green VALIDATED card appears. |
| 1:05–1:25 | **Screen:** Drag slider to T+15. Fire perimeter grows. Line A turns red. Pulse to Malibu Substation — red. Pulse to PCH signals — red. PCH turns red. **Voice:** "At T+15 the predicted cascade begins: Transmission Line A fails, the substation fails, traffic signals go dark, and PCH blocks. The point is not that Foresight saw this after it happened. It warned every agency before the chain completed." |
| 1:25–1:45 | **Screen:** Three agency panels populated, all P1 red. **Voice:** "IBM watsonx Granite synthesizes the validated specialist outputs into preventive actions. Fire IC: protect Line A. Utility: switch Substation B. Traffic: deploy officers to PCH before signals fail." |
| 1:45–2:10 | **Screen:** Drag to T+30. Debris flow zone appears on burned hillside above Malibu. **Voice:** "At T+30 the debris flow risk is HIGH on the burned slopes above Malibu. A secondary hazard forming in the same window. All three agencies updated simultaneously." |
| 2:10–2:30 | **Screen:** Full dashboard view. **Voice:** "After-action reviews called out communications vulnerabilities and the need for integrated tools. Existing systems detect fires, predict spread, and send alerts. Foresight fills the missing layer: a physics-validated forward cascade graph that tells three agencies what must happen before evacuation infrastructure fails. SDG 11, 13, and 9." |

---

## 11. Judging Criteria Alignment

| Criterion | How Foresight Wins |
|-----------|-----------------|
| Innovation (25%) | Forward cascade prediction plus physics validation is the wedge. Genasys manages communications. Technosylva predicts fire behavior. Pano detects fires. Watch Duty informs the public. Foresight models what fire will do to power, what power failure will do to traffic, and what three agencies must do before the evacuation route fails. |
| Technical Implementation (25%) | Three independent physics engines (Rothermel, cascade graph, USGS M1) running before any AI call. Featherless specialist agents. IBM watsonx.ai Granite coordinator. Closed-loop validator with retry logic and exact violation messages. Real-time event streaming. Real GeoJSON from NIFC and OSM. Shared orchestrator with typed output contract. All components testable independently. |
| Impact + SDGs (25%) | SDG 11.5: McChrystal Group documents coordination failures killing 31 people in January 2025. AECOM proposes $664M to fix the power cascade that destroyed 57% of electric service points in Pacific Palisades. SDG 13.1: climate change is making wildfire cascades more frequent. SDG 9.1: infrastructure resilience is the mechanism by which disasters become survivable. |
| Usability + Design (15%) | Single dark professional dashboard. One click to dispatch. Left: cascade map with prediction countdown and live animations. Right: validator feed + three agency panels. Each panel shows one preventive recommendation and three notifications. Time slider for forward prediction. No training required. |
| Presentation (10%) | 2:30 minute video scripted to hit every criterion in sequence. Validator rejection at 0:40 is the highlight. Cascade animation at 1:05 is the visual proof. Three red P1 panels at 1:25 is the emotional close. |

---

## 12. Risks + Mitigations

| Risk | Mitigation |
|------|-----------|
| Validator never rejects — key demo moment is invisible | P3 deliberately tunes debris flow agent prompt to output LOW without the violation message. Test at hour 20. This is intentional demo engineering. |
| Palisades GeoJSON wrong format or does not load | P3 downloads and validates all GeoJSON files at hour 0. Keep backup circle coordinates centered on Pacific Palisades as fallback. |
| Featherless API unavailable during demo | Deterministic specialist-agent fallback returns the same structured JSON schema. UI shows fallback status in a small data-source badge. Validator still runs. |
| IBM watsonx.ai API unavailable during demo | Deterministic Coordinator fallback returns the same three-agency schema. UI shows fallback status in a small data-source badge. The product story does not change. |
| Cascade pulse animation hard to implement cleanly | Color transition plus pulsing circle animation is sufficient — ~30 lines. If broken at hour 28, remove it. Static color change green to red still communicates the cascade clearly. |
| Real-time streaming adds complexity without enough time | Make it optional. Poll /dispatch/wildfire/1 every 2 seconds instead. The validator feed still works. Remove streaming from the demo rather than showing it half-broken. |
| Judge asks about Genasys | Prepared answer: Genasys is a strong communications and alerting platform. Foresight is not trying to replace it. Foresight predicts infrastructure cascade consequences that can feed better agency coordination and downstream alert decisions. |

---

## What Wins

Four moments. Build them perfectly. Everything else is secondary.

| Moment | What Judges See |
|--------|----------------|
| 0:40 — Validator rejects debris flow agent | AI caught hallucinating and corrected in real time. |
| 1:05 — Predicted cascade chain animates | Power line fails → substation → road blocked, matching the forecast shown before failure. |
| 1:25 — Three P1 red panels appear | Three agencies receive preventive actions from one shared prediction. |
| 2:15 — McChrystal Group report cited | Documented real deaths. Documented gap. This is real. |

> The physics to model a wildfire infrastructure cascade was published in 1972. The data to run it is free and public. The government reports documenting the coordination failures it causes were released four months ago. What had never been built was the system that runs it in real time, catches AI hallucinations before they reach a commander, and tells three agencies what to do before the chain completes. That system is Foresight.
