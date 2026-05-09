import { useMemo, useState, useEffect } from "react";
import "./App.css";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Polygon,
  Polyline,
  Marker,
  Tooltip,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
  Activity,
  CheckCircle,
  Clock3,
  Flame,
  Home,
  Layers,
  MapPin,
  Navigation,
  Radio,
  Route,
  ShieldCheck,
  TrafficCone,
  TreePine,
  Users,
  Wind,
  XCircle,
  Zap,
} from "lucide-react";

const BASE_URL = "http://localhost:8000";
const steps = [0, 3, 6];

const scenarioByMinute = {
  0: {
    label: "T+0",
    title: "Ignition Watch",
    fireLevel: "ELEVATED",
    power: "OPERATIONAL",
    substation: "OPERATIONAL",
    signals: "OPERATIONAL",
    road: "CLEAR",
    phase: "Prediction",
  },
  3: {
    label: "T+3",
    title: "Line A Failure",
    fireLevel: "CRITICAL",
    power: "FAILED",
    substation: "FAILED",
    signals: "FAILED",
    road: "DEGRADED",
    phase: "Cascade",
  },
  6: {
    label: "T+6",
    title: "Route Blocked",
    fireLevel: "CRITICAL",
    power: "FAILED",
    substation: "FAILED",
    signals: "FAILED",
    road: "BLOCKED",
    phase: "Evacuation",
  },
};

const fallbackAgency = {
  0: [
    { agency: "Fire IC", level: "ELEVATED", action: "Monitor spread near transmission corridor.", note: "Suppression assets staged." },
    { agency: "Utility", level: "NORMAL", action: "Grid stable. Prepare contingency switching.", note: "Substation B available." },
    { agency: "Traffic", level: "NORMAL", action: "Evacuation routes open.", note: "PCH operating normally." },
  ],
  3: [
    { agency: "Fire IC", level: "CRITICAL", action: "Protect Line A. Redirect suppression assets.", note: "Fire perimeter crossed corridor." },
    { agency: "Utility", level: "CRITICAL", action: "Switch load from Malibu Substation immediately.", note: "Downstream grid failure." },
    { agency: "Traffic", level: "HIGH", action: "Prepare officers for signal outage on PCH.", note: "Signals expected to fail." },
  ],
  6: [
    { agency: "Fire IC", level: "CRITICAL", action: "Protect evacuation corridor.", note: "Debris-flow risk HIGH above Malibu." },
    { agency: "Utility", level: "FAILED", action: "Substation offline. Begin backup restoration.", note: "Line A + Substation failed." },
    { agency: "Traffic", level: "CRITICAL", action: "Manual control on PCH. Blockage active.", note: "Road status BLOCKED." },
  ],
};

const fallbackValidator = {
  0: [{ type: "valid", title: "Physics computed", text: "Rothermel initialized. Infrastructure graph operational." }],
  3: [
    { type: "reject", title: "Agent rejected", text: "Debris agent output LOW. USGS M1 calculates P=0.71 HIGH. Forced replan." },
    { type: "valid", title: "Agent validated", text: "Debris flow corrected to HIGH. Agencies updated." },
  ],
  6: [
    { type: "reject", title: "Agent rejected", text: "Debris agent output LOW. USGS M1 calculates P=0.71 HIGH. Forced replan." },
    { type: "valid", title: "Agent validated", text: "Debris flow corrected to HIGH. Agencies updated." },
  ],
};

const GEOJSON_FILES = {
  0: "/geojson/palisades_T0.geojson",
  3: "/geojson/palisades_T15.geojson",
  6: "/geojson/palisades_T30.geojson",
};

const lineA = [[34.079, -118.656], [34.079, -118.642], [34.079, -118.63]];
const substation = [34.072, -118.638];
const signalA = [34.0368, -118.6814];
const signalB = [34.0412, -118.7023];
const roadFocus = [34.044, -118.72];
const debrisZone = [[34.086, -118.54], [34.098, -118.515], [34.083, -118.49], [34.066, -118.505]];
const operationalLayers = [
  {
    id: "fuel",
    label: "Heavy Chaparral Fuel",
    shortLabel: "Vegetation",
    risk: "HIGH",
    Icon: TreePine,
    color: "#15803d",
    fill: "#22c55e",
    positions: [[34.092, -118.662], [34.111, -118.612], [34.102, -118.562], [34.074, -118.57], [34.062, -118.626]],
    detail: "Dense canyon fuel increases flame length and spotting potential.",
    action: "Assign structure-defense resources along the fuel edge.",
  },
  {
    id: "ember",
    label: "Wind-Driven Ember Corridor",
    shortLabel: "Embers",
    risk: "CRITICAL",
    Icon: Wind,
    color: "#b45309",
    fill: "#f59e0b",
    positions: [[34.088, -118.644], [34.094, -118.61], [34.072, -118.548], [34.052, -118.558], [34.064, -118.62]],
    detail: "Santa Ana wind alignment can carry embers ahead of the front.",
    action: "Warn crews before spot fires appear near the corridor.",
  },
  {
    id: "evac",
    label: "Evacuation Control Area",
    shortLabel: "Evac Zone",
    risk: "AT_RISK",
    Icon: Navigation,
    color: "#0369a1",
    fill: "#0ea5e9",
    positions: [[34.059, -118.735], [34.065, -118.668], [34.043, -118.632], [34.021, -118.694], [34.03, -118.765]],
    detail: "Traffic management needs manual control before signal failure.",
    action: "Keep westbound PCH moving; block re-entry at failed signals.",
  },
  {
    id: "homes",
    label: "Structure Exposure Cluster",
    shortLabel: "Homes",
    risk: "CRITICAL",
    Icon: Home,
    color: "#be123c",
    fill: "#fb7185",
    positions: [[34.074, -118.705], [34.083, -118.673], [34.064, -118.648], [34.047, -118.676], [34.053, -118.714]],
    detail: "Neighborhood exposure rises when PCH becomes the only passable route.",
    action: "Prioritize evacuation alerts for the 4,200 exposed residents.",
  },
  {
    id: "staging",
    label: "Responder Staging Area",
    shortLabel: "Staging",
    risk: "READY",
    Icon: ShieldCheck,
    color: "#4338ca",
    fill: "#818cf8",
    positions: [[34.038, -118.747], [34.045, -118.727], [34.033, -118.712], [34.021, -118.73], [34.026, -118.752]],
    detail: "Safe staging west of the main cascade path.",
    action: "Stage fire, utility, and traffic teams outside the failure chain.",
  },
];
const cascadeLinks = [
  [lineA[2], substation],
  [substation, signalA],
  [substation, signalB],
  [signalA, roadFocus],
  [signalB, roadFocus],
];

function lc(level) {
  if (!level) return "green";
  const l = level.toUpperCase();
  if (l === "OPERATIONAL" || l === "CLEAR" || l === "NORMAL") return "green";
  if (l === "ELEVATED" || l === "HIGH" || l === "DEGRADED" || l === "AT_RISK") return "orange";
  return "red";
}

function markerIcon(kind, status) {
  return L.divIcon({
    className: "",
    html: `<div class="asset-pin asset-${kind} asset-${lc(status)}"><span>${kind === "substation" ? "S" : kind === "signal" ? "!" : "4.2K"}</span></div>`,
    iconSize: kind === "exposure" ? [54, 34] : [34, 34],
    iconAnchor: kind === "exposure" ? [27, 17] : [17, 17],
  });
}

function parseAgencies(apiData) {
  const agencies = apiData?.agents?.coordinator?.agencies;
  if (!agencies) return null;
  const map = { fire_incident_command: "Fire IC", utility_operator: "Utility", traffic_management: "Traffic" };
  return Object.entries(agencies).map(([key, val]) => {
    const text = (val.notifications || []).join(" ").toUpperCase();
    const level = text.includes("CRITICAL") || text.includes("FAILED") || text.includes("BLOCKED")
      ? "CRITICAL"
      : text.includes("HIGH") || text.includes("DEGRADED")
        ? "HIGH"
        : text.includes("ELEVATED")
          ? "ELEVATED"
          : "NORMAL";
    return { agency: map[key] || key, level, action: val.recommendation, note: (val.notifications || []).join(" · ") };
  });
}

function parseEvents(apiData) {
  if (!apiData) return null;
  return apiData.events
    .filter((e) => e.type === "agent_rejected" || e.type === "agent_validated")
    .map((e) => ({
      type: e.type === "agent_rejected" ? "reject" : "valid",
      title: e.type === "agent_rejected" ? "Agent rejected" : "Agent validated",
      text: e.type === "agent_rejected" ? e.violation : `${e.agent} approved.`,
    }));
}

export default function App() {
  const [minute, setMinute] = useState(0);
  const [apiData, setApiData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fireGeoJSON, setFireGeoJSON] = useState(null);
  const [osmData, setOsmData] = useState(null);
  const [visibleLayers, setVisibleLayers] = useState({
    fuel: true,
    ember: true,
    evac: true,
    homes: true,
    staging: true,
  });

  useEffect(() => {
    fetch("/osm_map.json").then((r) => r.json()).then(setOsmData).catch(() => {});
  }, []);

  useEffect(() => {
    fetch(GEOJSON_FILES[minute])
      .then((r) => r.json())
      .then((data) => {
        try {
          const feature = data.features[0];
          const geom = feature.geometry;
          const ring = geom.type === "Polygon" ? geom.coordinates[0] : geom.coordinates[0][0];
          setFireGeoJSON(ring.map(([lon, lat]) => [lat, lon]));
        } catch {
          setFireGeoJSON(null);
        }
      })
      .catch(() => {});
  }, [minute]);

  const state = scenarioByMinute[minute];
  const colors = useMemo(() => {
    const c = apiData?.cascade_status;
    const r = apiData?.evacuation_routes;
    return {
      power: c ? (c.transmission_line_A === "FAILED" ? "#ef4444" : "#16a34a") : (minute >= 3 ? "#ef4444" : "#16a34a"),
      substation: c ? (c.substation_malibu === "FAILED" ? "#ef4444" : "#16a34a") : (minute >= 3 ? "#ef4444" : "#16a34a"),
      signals: c ? (c.signal_PCH_1 === "FAILED" ? "#ef4444" : "#16a34a") : (minute >= 3 ? "#ef4444" : "#16a34a"),
      road: r ? (r.road_PCH === "BLOCKED" ? "#ef4444" : r.road_PCH === "DEGRADED" ? "#f59e0b" : "#16a34a")
        : (minute >= 6 ? "#ef4444" : minute >= 3 ? "#f59e0b" : "#16a34a"),
    };
  }, [minute, apiData]);

  const powerFailed = colors.power === "#ef4444";
  const showDebris = apiData ? apiData.physics?.debris_threat === "HIGH" : minute >= 6;
  const fireLevel = apiData?.physics?.threat_level || state.fireLevel;
  const utilityStatus = apiData?.cascade_status?.substation_malibu || state.substation;
  const routeStatus = apiData?.evacuation_routes?.road_PCH || state.road;
  const validatorEvts = parseEvents(apiData) || fallbackValidator[minute];
  const agencyActions = parseAgencies(apiData) || fallbackAgency[minute];
  const windMph = apiData?.data_sources?.weather?.effective?.wind_mph ?? 35;
  const rainInHr = apiData?.data_sources?.weather?.effective?.rainfall_in_hr ?? (minute ? 0.75 : 0);
  const trigger = apiData?.data_sources?.scenario?.trigger_source || (minute >= 3 ? "geometry_intersection" : "827m to Line A");

  const cascadeNodes = [
    { label: "Line A", status: apiData?.cascade_status?.transmission_line_A || state.power, Icon: Zap },
    { label: "Substation", status: utilityStatus, Icon: Activity },
    { label: "PCH Signals", status: apiData?.cascade_status?.signal_PCH_1 || state.signals, Icon: TrafficCone },
    { label: "PCH Route", status: routeStatus, Icon: Route },
  ];
  const responderPriorities = useMemo(() => {
    if (minute === 0) {
      return [
        "Protect Line A before the fire reaches the corridor.",
        "Pre-stage manual traffic control at PCH signals.",
        "Notify Utility to prepare backup feed switching.",
      ];
    }
    if (minute === 3) {
      return [
        "Switch load away from Malibu Substation immediately.",
        "Move evacuation traffic through PCH before blockage.",
        "Watch ember corridor for spot fires east of the front.",
      ];
    }
    return [
      "Keep responders outside the debris-flow polygon.",
      "Maintain PCH closure and route evacuees westbound.",
      "Prioritize exposed homes inside the structure cluster.",
    ];
  }, [minute]);

  const dispatch = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BASE_URL}/dispatch/wildfire/1?timestep=${minute}`, { method: "POST" });
      if (r.ok) setApiData(await r.json());
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="shell">
      <MapContainer center={[34.074, -118.615]} zoom={12} zoomControl className="map">
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        {operationalLayers.map((layer) => visibleLayers[layer.id] && (
          <Polygon
            key={layer.id}
            positions={layer.positions}
            pathOptions={{
              className: `ops-polygon ops-${layer.id}`,
              color: layer.color,
              fillColor: layer.fill,
              fillOpacity: layer.id === "staging" ? 0.2 : 0.24,
              opacity: 0.92,
              weight: 2,
              dashArray: layer.id === "evac" || layer.id === "staging" ? "8 6" : "",
            }}
          >
            <Tooltip sticky>
              {layer.label} · {layer.risk}<br />
              {layer.detail}
            </Tooltip>
          </Polygon>
        ))}

        {fireGeoJSON && (
          <>
            <Polygon positions={fireGeoJSON} pathOptions={{ className: "fire-halo", color: "#dc2626", fillOpacity: 0, weight: 10 }} />
            <Polygon positions={fireGeoJSON} pathOptions={{ className: "fire-front", color: "#991b1b", fillColor: "#f97316", fillOpacity: 0.42, weight: 2 }} />
          </>
        )}

        {osmData?.pch_segments?.map((seg, i) => (
          <Polyline key={`pch-casing-${i}`} positions={seg} pathOptions={{ color: "#111827", weight: 12, opacity: 0.54 }} />
        ))}
        {osmData?.pch_segments?.map((seg, i) => (
          <Polyline key={`pch-active-${i}`} positions={seg} pathOptions={{ color: colors.road, weight: 5, opacity: 0.86 }} />
        ))}

        {osmData?.all_power_lines?.slice(1).map((pl, i) => (
          <Polyline key={`pl-${i}`} positions={pl.coordinates} pathOptions={{ color: "#64748b", weight: 1, opacity: 0.22, dashArray: "5 5" }} />
        ))}

        {cascadeLinks.map((link, i) => (
          <Polyline
            key={`cascade-link-${i}`}
            positions={link}
            pathOptions={{
              className: minute >= 3 ? "cascade-link cascade-live" : "cascade-link",
              color: minute >= 3 ? "#ef4444" : "#0ea5e9",
              weight: 3,
              opacity: minute >= 3 ? 0.92 : 0.5,
              dashArray: "7 9",
            }}
          />
        ))}

        <Polyline positions={lineA} pathOptions={{ color: "#111827", weight: 9, opacity: 0.9 }} />
        <Polyline
          positions={lineA}
          pathOptions={{
            className: powerFailed ? "line-critical" : "line-watch",
            color: powerFailed ? "#ef4444" : "#f59e0b",
            weight: 5,
            dashArray: "12 7",
            opacity: 1,
          }}
        >
          <Tooltip sticky>Transmission Line A · {apiData?.cascade_status?.transmission_line_A || state.power}</Tooltip>
        </Polyline>

        <Marker position={substation} icon={markerIcon("substation", utilityStatus)}>
          <Tooltip>Malibu Substation · {utilityStatus}</Tooltip>
        </Marker>

        {osmData?.pch_signals?.map((s, i) => (
          <Marker key={`sig-${i}`} position={[s.lat, s.lon]} icon={markerIcon("signal", state.signals)}>
            <Tooltip>PCH Signal · {state.signals}</Tooltip>
          </Marker>
        ))}

        <Marker position={[34.052, -118.675]} icon={markerIcon("exposure", routeStatus)}>
          <Tooltip>Residents exposed if PCH blocks · 4,200</Tooltip>
        </Marker>

        {showDebris && (
          <Polygon positions={debrisZone} pathOptions={{ className: "debris-zone", color: "#92400e", fillColor: "#f59e0b", fillOpacity: 0.32, weight: 2 }}>
            <Tooltip sticky>Debris flow zone · HIGH</Tooltip>
          </Polygon>
        )}
      </MapContainer>

      <div className="map-vignette" />

      <aside className="left-dock">
        <section className="hero-panel">
          <div className="brand-row">
            <span className="status-dot" />
            <span>StormOS Command</span>
          </div>
          <h1>Palisades Cascade</h1>
          <p className="hero-copy">Forward prediction for fire, utility, and traffic teams before evacuation infrastructure fails.</p>
          <div className="hero-meta">
            <span><MapPin size={13} /> Malibu/PCH</span>
            <span><Clock3 size={13} /> {state.label}</span>
          </div>
        </section>

        <section className="status-grid">
          <div className={`mini-card mini-${lc(fireLevel)}`}>
            <Flame size={16} />
            <span>Fire</span>
            <strong>{fireLevel}</strong>
          </div>
          <div className={`mini-card mini-${lc(utilityStatus)}`}>
            <Zap size={16} />
            <span>Grid</span>
            <strong>{utilityStatus}</strong>
          </div>
          <div className={`mini-card mini-${lc(routeStatus)}`}>
            <Route size={16} />
            <span>PCH</span>
            <strong>{routeStatus}</strong>
          </div>
          <div className="mini-card mini-blue">
            <Users size={16} />
            <span>Exposure</span>
            <strong>4.2K</strong>
          </div>
        </section>

        <section className="data-panel">
          <div>
            <span>Wind</span>
            <strong>{windMph.toFixed(0)} mph</strong>
          </div>
          <div>
            <span>Rain</span>
            <strong>{rainInHr.toFixed(2)} in/hr</strong>
          </div>
          <div>
            <span>Trigger</span>
            <strong>{trigger.replaceAll("_", " ")}</strong>
          </div>
        </section>

        <section className="layer-panel">
          <div className="section-heading">
            <Layers size={14} />
            <span>Responder Layers</span>
          </div>
          <div className="layer-grid">
            {operationalLayers.map(({ id, shortLabel, Icon, risk }) => (
              <button
                key={id}
                className={visibleLayers[id] ? "layer-chip active" : "layer-chip"}
                onClick={() => setVisibleLayers((current) => ({ ...current, [id]: !current[id] }))}
              >
                <Icon size={13} />
                <span>{shortLabel}</span>
                <strong>{risk}</strong>
              </button>
            ))}
          </div>
        </section>

        <button className="dispatch-btn" onClick={dispatch} disabled={loading}>
          <Radio size={16} />
          {loading ? "Dispatching" : apiData ? "Run Again" : "Dispatch Agencies"}
        </button>
      </aside>

      <nav className="timeline-bar">
        {steps.map((step) => (
          <button
            key={step}
            className={step === minute ? "time-step active" : "time-step"}
            onClick={() => { setMinute(step); setApiData(null); }}
          >
            <span>{scenarioByMinute[step].label}</span>
            <strong>{scenarioByMinute[step].phase}</strong>
          </button>
        ))}
      </nav>

      <aside className="right-dock">
        <section className="panel priority-panel">
          <div className="panel-heading">
            <span>Responder Priorities</span>
            <strong>{state.label}</strong>
          </div>
          <ol className="priority-list">
            {responderPriorities.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </section>

        <section className="panel intel-panel">
          <div className="panel-heading">
            <span>Map Intelligence</span>
            <strong>{operationalLayers.filter((layer) => visibleLayers[layer.id]).length} Layers</strong>
          </div>
          <div className="intel-list">
            {operationalLayers.filter((layer) => visibleLayers[layer.id]).map(({ id, label, risk, action, Icon }) => (
              <div key={id} className={`intel-row intel-${id}`}>
                <Icon size={15} />
                <div>
                  <strong>{label}</strong>
                  <span>{action}</span>
                </div>
                <em>{risk}</em>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <span>Physics Validator</span>
            {apiData && <strong>LIVE</strong>}
          </div>
          <div className="feed">
            {validatorEvts.map((ev, i) => (
              <div key={i} className={`feed-item feed-${ev.type}`}>
                <div className="feed-top">
                  {ev.type === "reject" ? <XCircle size={14} /> : <CheckCircle size={14} />}
                  <strong>{ev.title}</strong>
                </div>
                <p>{ev.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="panel agency-panel">
          <div className="panel-heading">
            <span>Agency Actions</span>
            <strong>{state.phase}</strong>
          </div>
          <div className="feed">
            {agencyActions.map((item) => (
              <div key={item.agency} className={`feed-item agency-${lc(item.level)}`}>
                <div className="feed-top">
                  <strong>{item.agency}</strong>
                  <span className={`badge badge-${lc(item.level)}`}>{item.level}</span>
                </div>
                <p>{item.action}</p>
                <small>{item.note}</small>
              </div>
            ))}
          </div>
        </section>
      </aside>

      <section className="cascade-strip">
        {cascadeNodes.map(({ label, status, Icon }, i) => (
          <div key={label} className="cascade-node-wrap">
            <div className={`cascade-node node-${lc(status)}`}>
              <Icon size={16} />
              <span>{label}</span>
              <strong>{status}</strong>
            </div>
            {i < cascadeNodes.length - 1 && <div className={minute >= 3 ? "node-arrow active" : "node-arrow"} />}
          </div>
        ))}
      </section>

      <div className="legend-pill">
        <span><i className="dot green" /> Operational</span>
        <span><i className="dot orange" /> At Risk</span>
        <span><i className="dot red" /> Failed</span>
      </div>
    </div>
  );
}
