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
  Popup,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
  Activity,
  Clock3,
  Home,
  Layers,
  MapPin,
  Navigation,
  Radio,
  Route,
  ShieldCheck,
  TrafficCone,
  TreePine,
  Wind,
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
    next: "Line A failure predicted in 3 min",
    order: "Pre-stage utility + traffic before the corridor fails.",
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
    next: "PCH signal loss spreading downstream",
    order: "Switch load and move officers to PCH intersections.",
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
    next: "Evacuation route compromised",
    order: "Keep evacuees westbound and hold crews outside debris zone.",
  },
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

const communityMarkers = [
  {
    id: "palisades_village",
    name: "Palisades Village",
    homes: "1.8K homes",
    status: "AT RISK",
    position: [34.047, -118.526],
    action: "Early evacuation alerts if Line A cascade reaches PCH.",
  },
  {
    id: "malibu_bluffs",
    name: "Malibu Bluffs",
    homes: "1.1K homes",
    status: "WATCH",
    position: [34.058, -118.686],
    action: "Keep westbound PCH movement open.",
  },
  {
    id: "topanga_edge",
    name: "Topanga Edge",
    homes: "860 homes",
    status: "EXPOSED",
    position: [34.082, -118.604],
    action: "Protect structures along the chaparral fuel edge.",
  },
  {
    id: "pch_corridor",
    name: "PCH Corridor",
    homes: "4.2K exposed",
    status: "EVAC ROUTE",
    position: [34.036, -118.704],
    action: "Manual traffic control if signals lose power.",
  },
];

const operationalLayers = [
  {
    id: "fuel",
    label: "Heavy Chaparral Fuel",
    shortLabel: "Fuel",
    risk: "HIGH",
    Icon: TreePine,
    color: "#166534",
    fill: "#22c55e",
    positions: [[34.092, -118.662], [34.111, -118.612], [34.102, -118.562], [34.074, -118.57], [34.062, -118.626]],
    detail: "Dense canyon fuel increases flame length and spotting potential.",
    action: "Assign structure-defense resources along this fuel edge.",
  },
  {
    id: "ember",
    label: "Wind-Driven Ember Corridor",
    shortLabel: "Wind",
    risk: "CRITICAL",
    Icon: Wind,
    color: "#b45309",
    fill: "#f59e0b",
    positions: [[34.088, -118.644], [34.094, -118.61], [34.072, -118.548], [34.052, -118.558], [34.064, -118.62]],
    detail: "Wind alignment can carry embers ahead of the active front.",
    action: "Warn crews before spot fires appear near the corridor.",
  },
  {
    id: "evac",
    label: "Evacuation Control Area",
    shortLabel: "Evac",
    risk: "AT RISK",
    Icon: Navigation,
    color: "#0369a1",
    fill: "#0ea5e9",
    positions: [[34.059, -118.735], [34.065, -118.668], [34.043, -118.632], [34.021, -118.694], [34.03, -118.765]],
    detail: "Traffic management needs manual control before signal failure.",
    action: "Keep westbound PCH moving and block re-entry.",
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
    shortLabel: "Stage",
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
  const l = level.toUpperCase().replace(" ", "_");
  if (l === "OPERATIONAL" || l === "CLEAR" || l === "NORMAL" || l === "READY") return "green";
  if (l === "ELEVATED" || l === "HIGH" || l === "DEGRADED" || l === "AT_RISK" || l === "WATCH" || l === "EXPOSED" || l === "EVAC_ROUTE") return "orange";
  return "red";
}

function markerIcon(kind, status) {
  const label = kind === "substation" ? "S" : kind === "signal" ? "!" : "4.2K";
  return L.divIcon({
    className: "",
    html: `<div class="asset-pin asset-${kind} asset-${lc(status)}"><span>${label}</span></div>`,
    iconSize: kind === "exposure" ? [58, 34] : [34, 34],
    iconAnchor: kind === "exposure" ? [29, 17] : [17, 17],
  });
}

function communityIcon(status) {
  return L.divIcon({
    className: "",
    html: `
      <div class="community-marker community-${lc(status)}">
        <div class="roof-grid">
          <i></i><i></i><i></i><i></i><i></i><i></i>
        </div>
      </div>
    `,
    iconSize: [42, 34],
    iconAnchor: [21, 17],
  });
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
  const windMph = apiData?.data_sources?.weather?.effective?.wind_mph ?? 35;
  const rainInHr = apiData?.data_sources?.weather?.effective?.rainfall_in_hr ?? (minute ? 0.75 : 0);
  const trigger = apiData?.data_sources?.scenario?.trigger_source || (minute >= 3 ? "geometry_intersection" : "827m to Line A");
  const nextFailure = apiData?.prediction?.next_failure?.replaceAll("_", " ") || state.next;
  const dispatchSummary = apiData?.agents?.coordinator?.dispatch_summary || state.order;

  const cascadeNodes = [
    { label: "Line A", status: apiData?.cascade_status?.transmission_line_A || state.power, Icon: Zap },
    { label: "Substation", status: utilityStatus, Icon: Activity },
    { label: "PCH Signals", status: apiData?.cascade_status?.signal_PCH_1 || state.signals, Icon: TrafficCone },
    { label: "PCH Route", status: routeStatus, Icon: Route },
  ];

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
      <MapContainer center={[34.067, -118.63]} zoom={12} zoomControl className="map">
        <TileLayer
          attribution='Terrain &copy; Esri'
          className="hillshade-layer"
          opacity={0.72}
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}"
          zIndex={1}
        />
        <TileLayer
          attribution='Topographic map &copy; Esri, HERE, Garmin, OpenStreetMap contributors'
          className="topo-layer"
          opacity={0.88}
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"
          zIndex={2}
        />

        {communityMarkers.map((community) => (
          <Marker key={community.id} position={community.position} icon={communityIcon(community.status)}>
            <Tooltip permanent direction="right" className="community-label">
              <span>{community.name}</span>
              <strong>{community.homes}</strong>
            </Tooltip>
            <Popup className="incident-popup">
              <strong>{community.name}</strong>
              <span>{community.status} - {community.homes}</span>
              <em>{community.action}</em>
            </Popup>
          </Marker>
        ))}

        {operationalLayers.map((layer) => visibleLayers[layer.id] && (
          <Polygon
            key={layer.id}
            positions={layer.positions}
            pathOptions={{
              className: `ops-polygon ops-${layer.id}`,
              color: layer.color,
              fillColor: layer.fill,
              fillOpacity: layer.id === "staging" ? 0.18 : 0.28,
              opacity: 0.95,
              weight: 2,
              dashArray: layer.id === "evac" || layer.id === "staging" ? "8 6" : "",
            }}
          >
            <Tooltip sticky className="quiet-tooltip">
              <span>{layer.label}</span>
              <strong>{layer.risk}</strong>
            </Tooltip>
            <Popup className="incident-popup">
              <strong>{layer.label}</strong>
              <span>{layer.detail}</span>
              <em>{layer.action}</em>
            </Popup>
          </Polygon>
        ))}

        {fireGeoJSON && (
          <>
            <Polygon positions={fireGeoJSON} pathOptions={{ className: "fire-halo", color: "#dc2626", fillOpacity: 0, weight: 12 }} />
            <Polygon positions={fireGeoJSON} pathOptions={{ className: "fire-front", color: "#991b1b", fillColor: "#f97316", fillOpacity: 0.44, weight: 2 }}>
              <Tooltip sticky className="quiet-tooltip">
                <span>Fire perimeter</span>
                <strong>{fireLevel}</strong>
              </Tooltip>
              <Popup className="incident-popup">
                <strong>Active Fire Perimeter</strong>
                <span>Wind {windMph.toFixed(0)} mph. Trigger: {trigger.replaceAll("_", " ")}.</span>
                <em>{state.order}</em>
              </Popup>
            </Polygon>
          </>
        )}

        {osmData?.pch_segments?.map((seg, i) => (
          <Polyline key={`pch-casing-${i}`} positions={seg} pathOptions={{ color: "#020617", weight: 13, opacity: 0.62 }} />
        ))}
        {osmData?.pch_segments?.map((seg, i) => (
          <Polyline key={`pch-active-${i}`} positions={seg} pathOptions={{ color: colors.road, weight: 5, opacity: 0.92 }} />
        ))}

        {osmData?.all_power_lines?.slice(1).map((pl, i) => (
          <Polyline key={`pl-${i}`} positions={pl.coordinates} pathOptions={{ color: "#475569", weight: 1, opacity: 0.18, dashArray: "5 5" }} />
        ))}

        {cascadeLinks.map((link, i) => (
          <Polyline
            key={`cascade-link-${i}`}
            positions={link}
            pathOptions={{
              className: minute >= 3 ? "cascade-link cascade-live" : "cascade-link",
              color: minute >= 3 ? "#ef4444" : "#0ea5e9",
              weight: 3,
              opacity: minute >= 3 ? 0.95 : 0.58,
              dashArray: "7 9",
            }}
          />
        ))}

        <Polyline positions={lineA} pathOptions={{ color: "#020617", weight: 11, opacity: 0.92 }} />
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
          <Tooltip permanent direction="top" className="map-label label-line">
            <span>Line A</span>
            <strong>{apiData?.cascade_status?.transmission_line_A || state.power}</strong>
          </Tooltip>
          <Popup className="incident-popup">
            <strong>Transmission Line A</strong>
            <span>{nextFailure}</span>
            <em>Responder action: protect corridor and switch load before downstream failure.</em>
          </Popup>
        </Polyline>

        <Marker position={substation} icon={markerIcon("substation", utilityStatus)}>
          <Tooltip>Malibu Substation - {utilityStatus}</Tooltip>
          <Popup className="incident-popup">
            <strong>Malibu Substation</strong>
            <span>Status: {utilityStatus}. Depends on Line A.</span>
            <em>Utility: switch to backup feed when Line A is threatened.</em>
          </Popup>
        </Marker>

        {osmData?.pch_signals?.map((s, i) => (
          <Marker key={`sig-${i}`} position={[s.lat, s.lon]} icon={markerIcon("signal", state.signals)}>
            <Tooltip>PCH Signal - {state.signals}</Tooltip>
            <Popup className="incident-popup">
              <strong>PCH Traffic Signal</strong>
              <span>Status: {apiData?.cascade_status?.signal_PCH_1 || state.signals}.</span>
              <em>Traffic: prepare manual control before grid failure.</em>
            </Popup>
          </Marker>
        ))}

        <Marker position={[34.052, -118.675]} icon={markerIcon("exposure", routeStatus)}>
          <Tooltip>4,200 residents exposed if PCH blocks</Tooltip>
          <Popup className="incident-popup">
            <strong>Population Exposure</strong>
            <span>Residents become harder to move if PCH blocks.</span>
            <em>Evacuation: prioritize alerts inside the exposure cluster.</em>
          </Popup>
        </Marker>

        {showDebris && (
          <Polygon positions={debrisZone} pathOptions={{ className: "debris-zone", color: "#92400e", fillColor: "#f59e0b", fillOpacity: 0.34, weight: 2 }}>
            <Tooltip sticky className="quiet-tooltip">
              <span>Debris-flow zone</span>
              <strong>HIGH</strong>
            </Tooltip>
            <Popup className="incident-popup">
              <strong>Post-Fire Debris Flow Zone</strong>
              <span>Rain {rainInHr.toFixed(2)} in/hr with burned slopes above Malibu.</span>
              <em>Keep responders and evacuees outside this polygon.</em>
            </Popup>
          </Polygon>
        )}
      </MapContainer>

      <div className="map-vignette" />

      <header className="command-bar">
        <div className="brand-lockup">
          <span className="status-dot" />
          <div>
            <strong>StormOS</strong>
            <span><MapPin size={12} /> Palisades / PCH</span>
          </div>
        </div>

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

        <button className="dispatch-btn" onClick={dispatch} disabled={loading}>
          <Radio size={16} />
          {loading ? "Running" : apiData ? "Refresh Dispatch" : "Run Dispatch"}
        </button>
      </header>

      <aside className="layer-rail">
        <div className="rail-title">
          <Layers size={15} />
          <span>Layers</span>
        </div>
        {operationalLayers.map(({ id, shortLabel, Icon, risk }) => (
          <button
            key={id}
            className={visibleLayers[id] ? "layer-chip active" : "layer-chip"}
            onClick={() => setVisibleLayers((current) => ({ ...current, [id]: !current[id] }))}
            title={`${shortLabel}: ${risk}`}
          >
            <Icon size={16} />
            <span>{shortLabel}</span>
          </button>
        ))}
      </aside>

      <section className="map-alert">
        <div className={`severity-badge severity-${lc(fireLevel)}`}>{state.label} / {fireLevel}</div>
        <strong>{nextFailure}</strong>
        <span>{dispatchSummary}</span>
        <div className="decision-facts">
          <span><Wind size={13} /> {windMph.toFixed(0)} mph</span>
          <span><Clock3 size={13} /> {state.phase}</span>
          <span><Route size={13} /> {routeStatus}</span>
        </div>
      </section>

      <section className="cascade-strip">
        {cascadeNodes.map(({ label, status, Icon }, i) => (
          <div key={label} className="cascade-node-wrap">
            <div className={`cascade-node node-${lc(status)}`}>
              <Icon size={15} />
              <span>{label}</span>
              <strong>{status}</strong>
            </div>
            {i < cascadeNodes.length - 1 && <div className={minute >= 3 ? "node-arrow active" : "node-arrow"} />}
          </div>
        ))}
      </section>
    </div>
  );
}
