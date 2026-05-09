import { useMemo, useState } from "react";
import "./App.css";
import {
  MapContainer,
  TileLayer,
  Polygon,
  Polyline,
  CircleMarker,
  Rectangle,
  Tooltip,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

const steps = [0, 15, 30];

const scenarioByHour = {
  0: {
    label: "T+0",
    title: "Ignition / Monitoring",
    fireLevel: "ELEVATED",
    power: "OPERATIONAL",
    substation: "OPERATIONAL",
    signals: "OPERATIONAL",
    road: "CLEAR",
  },
  15: {
    label: "T+15",
    title: "Power Line Failure",
    fireLevel: "CRITICAL",
    power: "FAILED",
    substation: "FAILED",
    signals: "FAILED",
    road: "DEGRADED",
  },
  30: {
    label: "T+30",
    title: "Cascade Complete",
    fireLevel: "CRITICAL",
    power: "FAILED",
    substation: "FAILED",
    signals: "FAILED",
    road: "BLOCKED",
  },
};

const agencyActions = {
  0: [
    {
      agency: "Fire IC",
      level: "ELEVATED",
      action: "Monitor spread near transmission corridor.",
      note: "Suppression assets staged near Malibu Canyon.",
    },
    {
      agency: "Utility",
      level: "NORMAL",
      action: "Grid stable. Prepare contingency switching.",
      note: "Substation B remains available.",
    },
    {
      agency: "Traffic",
      level: "NORMAL",
      action: "Evacuation routes open.",
      note: "PCH operating normally.",
    },
  ],
  15: [
    {
      agency: "Fire IC",
      level: "CRITICAL",
      action: "Protect Line A. Redirect suppression assets.",
      note: "Fire perimeter crossed transmission corridor.",
    },
    {
      agency: "Utility",
      level: "CRITICAL",
      action: "Switch load from Malibu Substation immediately.",
      note: "Downstream grid failure detected.",
    },
    {
      agency: "Traffic",
      level: "HIGH",
      action: "Prepare officers for signal outage on PCH.",
      note: "Traffic signals expected to fail.",
    },
  ],
  30: [
    {
      agency: "Fire IC",
      level: "CRITICAL",
      action: "Protect evacuation corridor from secondary spread.",
      note: "Debris-flow risk now HIGH above Malibu.",
    },
    {
      agency: "Utility",
      level: "FAILED",
      action: "Substation offline. Begin backup restoration.",
      note: "Line A and Malibu Substation failed.",
    },
    {
      agency: "Traffic",
      level: "CRITICAL",
      action: "Manual control on PCH. Evacuation blockage active.",
      note: "Road status changed to BLOCKED.",
    },
  ],
};

const validatorEvents = {
  0: [
    {
      type: "valid",
      title: "Physics computed",
      text: "Rothermel spread model initialized. Infrastructure graph operational.",
    },
  ],
  15: [
    {
      type: "valid",
      title: "Cascade validated",
      text: "Fire crossed Line A → Malibu Substation FAILED → PCH signals AT RISK.",
    },
  ],
  30: [
    {
      type: "reject",
      title: "Agent rejected",
      text: "Debris agent output LOW. USGS M1 calculates P=0.71 HIGH. Forced replan.",
    },
    {
      type: "valid",
      title: "Agent validated",
      text: "Debris flow corrected to HIGH. Agencies updated simultaneously.",
    },
  ],
};

const firePolygons = {
  0: [
    [34.097, -118.56],
    [34.105, -118.535],
    [34.092, -118.512],
    [34.078, -118.527],
    [34.082, -118.555],
  ],
  15: [
    [34.105, -118.575],
    [34.116, -118.538],
    [34.1, -118.49],
    [34.073, -118.503],
    [34.064, -118.545],
    [34.083, -118.57],
  ],
  30: [
    [34.116, -118.59],
    [34.13, -118.535],
    [34.112, -118.465],
    [34.068, -118.475],
    [34.045, -118.535],
    [34.077, -118.59],
  ],
};

const powerLine = [
  [34.095, -118.575],
  [34.085, -118.535],
  [34.075, -118.505],
  [34.066, -118.48],
];

const cascadeLineToSubstation = [
  [34.066, -118.48],
  [34.055, -118.465],
];

const cascadeLineToSignals = [
  [34.055, -118.465],
  [34.038, -118.482],
];

const pchRoad = [
  [34.028, -118.62],
  [34.033, -118.57],
  [34.036, -118.525],
  [34.038, -118.482],
  [34.034, -118.44],
];

const debrisZone = [
  [34.086, -118.54],
  [34.098, -118.515],
  [34.083, -118.49],
  [34.066, -118.505],
];

const trafficSignals = [
  [34.038, -118.482],
  [34.035, -118.51],
];

function levelClass(level) {
  if (level === "NORMAL" || level === "OPERATIONAL" || level === "CLEAR") return "green";
  if (level === "ELEVATED" || level === "HIGH" || level === "DEGRADED") return "orange";
  return "red";
}

function App() {
  const [hour, setHour] = useState(0);
  const state = scenarioByHour[hour];

  const mapColors = useMemo(() => {
    return {
      power: hour >= 15 ? "#ef4444" : "#22c55e",
      substation: hour >= 15 ? "#ef4444" : "#22c55e",
      signals: hour >= 15 ? "#ef4444" : "#22c55e",
      road: hour >= 30 ? "#ef4444" : hour >= 15 ? "#f97316" : "#22c55e",
    };
  }, [hour]);

  return (
    <main className="app">
      <header className="topbar">
        <div>
          <p className="eyebrow">StormOS</p>
          <h1>Wildfire Cascade Incident Commander</h1>
          <p className="subtitle">
            Fire impact forecast across power, traffic, and evacuation infrastructure.
          </p>
        </div>

        <button className="dispatchButton">Dispatch Scenario</button>
      </header>

      <section className="statusGrid">
        <div className={`statusCard ${levelClass(state.fireLevel)}`}>
          <span>Fire Threat</span>
          <strong>{state.fireLevel}</strong>
        </div>
        <div className={`statusCard ${levelClass(state.power)}`}>
          <span>Power Line A</span>
          <strong>{state.power}</strong>
        </div>
        <div className={`statusCard ${levelClass(state.substation)}`}>
          <span>Malibu Substation</span>
          <strong>{state.substation}</strong>
        </div>
        <div className={`statusCard ${levelClass(state.road)}`}>
          <span>PCH Evacuation Route</span>
          <strong>{state.road}</strong>
        </div>
      </section>

      <section className="contentGrid">
        <div className="mapPanel">
          <div className="panelHeader">
            <div>
              <h2>Infrastructure Impact Map</h2>
              <p>{state.label} · {state.title}</p>
            </div>
            <div className="legend">
              <span><i className="dot greenDot" /> Operational</span>
              <span><i className="dot orangeDot" /> At Risk</span>
              <span><i className="dot redDot" /> Failed</span>
            </div>
          </div>

          <MapContainer
            center={[34.066, -118.515]}
            zoom={12}
            zoomControl={true}
            className="map"
          >
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <Polygon
              positions={firePolygons[hour]}
              pathOptions={{
                color: "#dc2626",
                fillColor: "#f97316",
                fillOpacity: 0.32,
                weight: 2,
              }}
            >
              <Tooltip sticky>Fire perimeter {state.label}</Tooltip>
            </Polygon>

            <Polyline
              positions={powerLine}
              pathOptions={{
                color: mapColors.power,
                weight: 5,
                dashArray: hour >= 15 ? "10 8" : undefined,
              }}
            >
              <Tooltip sticky>Transmission Line A · {state.power}</Tooltip>
            </Polyline>

            {hour >= 15 && (
              <>
                <Polyline
                  positions={cascadeLineToSubstation}
                  pathOptions={{ color: "#ef4444", weight: 3, dashArray: "4 10" }}
                  className="pulseLine"
                />
                <Polyline
                  positions={cascadeLineToSignals}
                  pathOptions={{ color: "#ef4444", weight: 3, dashArray: "4 10" }}
                  className="pulseLine"
                />
              </>
            )}

            <CircleMarker
              center={[34.055, -118.465]}
              radius={10}
              pathOptions={{
                color: "#111827",
                fillColor: mapColors.substation,
                fillOpacity: 1,
                weight: 2,
              }}
            >
              <Tooltip sticky>Malibu Substation · {state.substation}</Tooltip>
            </CircleMarker>

            {trafficSignals.map((signal, index) => (
              <Rectangle
                key={index}
                bounds={[
                  [signal[0] - 0.002, signal[1] - 0.002],
                  [signal[0] + 0.002, signal[1] + 0.002],
                ]}
                pathOptions={{
                  color: "#111827",
                  fillColor: mapColors.signals,
                  fillOpacity: 1,
                  weight: 2,
                }}
              >
                <Tooltip sticky>PCH Signal {index + 1} · {state.signals}</Tooltip>
              </Rectangle>
            ))}

            <Polyline
              positions={pchRoad}
              pathOptions={{
                color: mapColors.road,
                weight: 8,
                dashArray: hour >= 30 ? "12 10" : undefined,
              }}
            >
              <Tooltip sticky>PCH Evacuation Route · {state.road}</Tooltip>
            </Polyline>

            {hour >= 30 && (
              <Polygon
                positions={debrisZone}
                pathOptions={{
                  color: "#f97316",
                  fillColor: "#f97316",
                  fillOpacity: 0.22,
                  weight: 2,
                }}
              >
                <Tooltip sticky>Debris flow zone · HIGH</Tooltip>
              </Polygon>
            )}
          </MapContainer>

          <div className="timeline">
            <div className="timelineTop">
              <strong>Forward prediction</strong>
              <span>{state.label}</span>
            </div>

            <input
              type="range"
              min="0"
              max="2"
              step="1"
              value={steps.indexOf(hour)}
              onChange={(e) => setHour(steps[Number(e.target.value)])}
            />

            <div className="ticks">
              <span>T+0</span>
              <span>T+15</span>
              <span>T+30</span>
            </div>
          </div>
        </div>

        <aside className="sidePanel">
          <section className="validatorPanel">
            <h2>Physics Validator</h2>
            <div className="feed">
              {validatorEvents[hour].map((event, index) => (
                <article key={index} className={`feedCard ${event.type}`}>
                  <strong>{event.title}</strong>
                  <p>{event.text}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="agencyPanel">
            <h2>Agency Actions</h2>
            <div className="agencyList">
              {agencyActions[hour].map((item) => (
                <article key={item.agency} className={`agencyCard ${levelClass(item.level)}`}>
                  <div className="agencyTop">
                    <strong>{item.agency}</strong>
                    <span>{item.level}</span>
                  </div>
                  <p>{item.action}</p>
                  <small>{item.note}</small>
                </article>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}

export default App;