import { useMemo, useState, useEffect } from "react";
import "./App.css";
import L from "leaflet";
import * as Tabs from "@radix-ui/react-tabs";
import { motion } from "framer-motion";
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
  Wind,
  Zap,
} from "lucide-react";

const BASE_URL = "http://localhost:8000";
const INCIDENT_DURATION_MIN = 180;
const FAILURE_TIMES = {
  lineA: 35,
  substation: 42,
  signals: 48,
  route: 60,
  debris: 150,
};

const FIRE_KEYFRAMES = [
  { minute: 0, file: "/geojson/palisades_T0.geojson" },
  { minute: 90, file: "/geojson/palisades_T15.geojson" },
  { minute: 180, file: "/geojson/palisades_T30.geojson" },
];

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

const departmentMeta = {
  fire: {
    label: "Fire IC",
    asset: "Line A / fuel edge",
    Icon: Flame,
  },
  utility: {
    label: "Utility",
    asset: "Malibu Substation",
    Icon: Zap,
  },
  traffic: {
    label: "Traffic",
    asset: "PCH corridor",
    Icon: TrafficCone,
  },
  evac: {
    label: "Evacuation",
    asset: "4.2K homes",
    Icon: Home,
  },
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function resampleRing(points, count = 150) {
  if (!points?.length) return [];
  return Array.from({ length: count }, (_, index) => {
    const sourceIndex = Math.round((index / (count - 1)) * (points.length - 1));
    return points[sourceIndex];
  });
}

function interpolateRings(startRing, endRing, progress) {
  const start = resampleRing(startRing);
  const end = resampleRing(endRing);
  return start.map((point, index) => [
    lerp(point[0], end[index][0], progress),
    lerp(point[1], end[index][1], progress),
  ]);
}

function backendTimestepForMinute(minute) {
  if (minute >= FAILURE_TIMES.debris) return 6;
  if (minute >= FAILURE_TIMES.lineA) return 3;
  return 0;
}

function deriveIncidentState(minute) {
  const lineFailed = minute >= FAILURE_TIMES.lineA;
  const substationFailed = minute >= FAILURE_TIMES.substation;
  const signalsFailed = minute >= FAILURE_TIMES.signals;
  const routeBlocked = minute >= FAILURE_TIMES.route;
  const debrisActive = minute >= FAILURE_TIMES.debris;
  const nextEvent = [
    { at: FAILURE_TIMES.lineA, label: `Line A failure in ${FAILURE_TIMES.lineA - minute} min` },
    { at: FAILURE_TIMES.substation, label: `Substation failure in ${FAILURE_TIMES.substation - minute} min` },
    { at: FAILURE_TIMES.signals, label: `PCH signal loss in ${FAILURE_TIMES.signals - minute} min` },
    { at: FAILURE_TIMES.route, label: `PCH blockage in ${FAILURE_TIMES.route - minute} min` },
    { at: FAILURE_TIMES.debris, label: `Debris-flow risk in ${FAILURE_TIMES.debris - minute} min` },
  ].find((event) => minute < event.at);

  return {
    label: `T+${minute}m`,
    title: debrisActive ? "Secondary Hazard" : routeBlocked ? "Route Blocked" : lineFailed ? "Cascade Active" : "Ignition Watch",
    fireLevel: minute < 20 ? "ELEVATED" : "CRITICAL",
    power: lineFailed ? "FAILED" : "OPERATIONAL",
    substation: substationFailed ? "FAILED" : "OPERATIONAL",
    signals: signalsFailed ? "FAILED" : "OPERATIONAL",
    road: routeBlocked ? "BLOCKED" : signalsFailed ? "DEGRADED" : "CLEAR",
    phase: debrisActive ? "Secondary" : lineFailed ? "Cascade" : "Prediction",
    next: nextEvent ? nextEvent.label : "Consequence management active",
    order: debrisActive
      ? "Keep responders outside debris-flow zones and reroute evacuees."
      : routeBlocked
        ? "Maintain manual traffic control and keep evacuees moving west."
        : lineFailed
          ? "Complete utility switching and deploy traffic control before PCH degrades."
          : "Pre-stage Fire, Utility, and Traffic before Line A fails.",
    debrisActive,
  };
}

function departmentStatus(id, minute) {
  if (id === "fire") {
    if (minute >= FAILURE_TIMES.route) return "HOLDING";
    if (minute >= FAILURE_TIMES.lineA) return "ACKNOWLEDGED";
    return "ASSIGNED";
  }
  if (id === "utility") {
    if (minute >= FAILURE_TIMES.route) return "RESTORING";
    if (minute >= FAILURE_TIMES.lineA) return "SWITCHING";
    return "STAGED";
  }
  if (id === "traffic") {
    if (minute >= FAILURE_TIMES.route) return "MANUAL CTRL";
    if (minute >= FAILURE_TIMES.signals) return "EN ROUTE";
    return "STAGED";
  }
  if (minute >= FAILURE_TIMES.route) return "REROUTING";
  if (minute >= FAILURE_TIMES.lineA) return "ALERTING";
  return "READY";
}

function lc(level) {
  if (!level) return "green";
  const l = level.toUpperCase().replace(" ", "_");
  if (l === "OPERATIONAL" || l === "CLEAR" || l === "NORMAL" || l === "READY") return "green";
  if (l === "ELEVATED" || l === "HIGH" || l === "DEGRADED" || l === "AT_RISK" || l === "WATCH" || l === "EXPOSED" || l === "EVAC_ROUTE") return "orange";
  return "red";
}

function markerIcon(kind, status) {
  const label = kind === "substation" ? "S" : kind === "traffic" ? "PCH" : "4.2K";
  return L.divIcon({
    className: "",
    html: `<div class="asset-pin asset-${kind} asset-${lc(status)}"><span>${label}</span></div>`,
    iconSize: kind === "exposure" || kind === "traffic" ? [58, 34] : [34, 34],
    iconAnchor: kind === "exposure" || kind === "traffic" ? [29, 17] : [17, 17],
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

const AGENCY_KEY = {
  fire: "fire_incident_command",
  utility: "utility_operator",
  traffic: "traffic_management",
};

const ACK_POSITIONS = {
  fire_incident_command: [34.080, -118.645],
  utility_operator: [34.073, -118.634],
  traffic_management: [34.046, -118.718],
};

function ackMapIcon(status) {
  const accepted = status === "ACCEPTED";
  return L.divIcon({
    className: "",
    html: `<div class="ack-map-pin ${accepted ? "ack-map-accepted" : "ack-map-denied"}">${accepted ? "✓" : "✗"}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

export default function App() {
  const [minute, setMinute] = useState(0);
  const [apiData, setApiData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState("fire");
  const [fireKeyframes, setFireKeyframes] = useState([]);
  const [osmData, setOsmData] = useState(null);
  const [acknowledgments, setAcknowledgments] = useState({});
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
    Promise.all(
      FIRE_KEYFRAMES.map((keyframe) => (
        fetch(keyframe.file)
          .then((r) => r.json())
          .then((data) => {
            const feature = data.features[0];
            const geom = feature.geometry;
            const ring = geom.type === "Polygon" ? geom.coordinates[0] : geom.coordinates[0][0];
            return { ...keyframe, ring: ring.map(([lon, lat]) => [lat, lon]) };
          })
      ))
    ).then(setFireKeyframes).catch(() => setFireKeyframes([]));
  }, []);

  useEffect(() => {
    if (!apiData) {
      setAcknowledgments({});
      return;
    }
    const interval = setInterval(async () => {
      try {
        const r = await fetch(`${BASE_URL}/acknowledgments`);
        if (r.ok) setAcknowledgments(await r.json());
      } catch {}
    }, 2000);
    return () => clearInterval(interval);
  }, [apiData]);

  const state = deriveIncidentState(minute);
  const fireGeoJSON = useMemo(() => {
    if (fireKeyframes.length < 2) return null;
    const sorted = [...fireKeyframes].sort((a, b) => a.minute - b.minute);
    const next = sorted.find((keyframe) => minute <= keyframe.minute) || sorted.at(-1);
    const previous = [...sorted].reverse().find((keyframe) => minute >= keyframe.minute) || sorted[0];
    if (next.minute === previous.minute) return previous.ring;
    const progress = clamp((minute - previous.minute) / (next.minute - previous.minute), 0, 1);
    return interpolateRings(previous.ring, next.ring, progress);
  }, [fireKeyframes, minute]);

  const colors = useMemo(() => {
    return {
      power: state.power === "FAILED" ? "#ef4444" : "#65a30d",
      substation: state.substation === "FAILED" ? "#ef4444" : "#65a30d",
      signals: state.signals === "FAILED" ? "#ef4444" : "#65a30d",
      road: state.road === "BLOCKED" ? "#ef4444" : state.road === "DEGRADED" ? "#f59e0b" : "#65a30d",
    };
  }, [state.power, state.substation, state.signals, state.road]);

  const powerFailed = colors.power === "#ef4444";
  const showDebris = state.debrisActive;
  const fireLevel = state.fireLevel;
  const utilityStatus = state.substation;
  const routeStatus = state.road;
  const windMph = apiData?.data_sources?.weather?.effective?.wind_mph ?? 35;
  const rainInHr = apiData?.data_sources?.weather?.effective?.rainfall_in_hr ?? (minute ? 0.75 : 0);
  const trigger = apiData?.data_sources?.scenario?.trigger_source || (minute >= FAILURE_TIMES.lineA ? "geometry_intersection" : "approaching Line A");
  const nextFailure = state.next;
  const dispatchSummary = apiData?.agents?.coordinator?.dispatch_summary || state.order;

  const cascadeNodes = [
    { label: "Line A", status: state.power, Icon: Zap },
    { label: "Substation", status: utilityStatus, Icon: Activity },
    { label: "PCH Signals", status: state.signals, Icon: TrafficCone },
    { label: "PCH Route", status: routeStatus, Icon: Route },
  ];

  const coordinatorAgencies = apiData?.agents?.coordinator?.agencies || {};
  const departmentAssignments = [
    {
      id: "fire",
      action: coordinatorAgencies.fire_incident_command?.recommendation || "Defend Line A before the fire reaches the corridor.",
    },
    {
      id: "utility",
      action: coordinatorAgencies.utility_operator?.recommendation || "Prepare backup feed switching for Malibu load.",
    },
    {
      id: "traffic",
      action: coordinatorAgencies.traffic_management?.recommendation || "Pre-stage officers for PCH traffic control.",
    },
    {
      id: "evac",
      action: minute >= 6 ? "Reroute evacuees away from blocked PCH." : "Alert exposed neighborhoods before PCH slows.",
    },
  ].map((item) => ({
    ...item,
    ...departmentMeta[item.id],
    status: departmentStatus(item.id, minute),
  }));

  const incidentLog = [
    `${state.label} shared plan issued to Fire, Utility, Traffic, Evac`,
    `${departmentMeta.fire.label} ${departmentStatus("fire", minute).toLowerCase()} Line A task`,
    `${departmentMeta.utility.label} ${departmentStatus("utility", minute).toLowerCase()} substation task`,
    `${departmentMeta.traffic.label} ${departmentStatus("traffic", minute).toLowerCase()} PCH task`,
  ];
  const selectedAssignment = departmentAssignments.find((dept) => dept.id === selectedDepartment);

  const dispatch = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BASE_URL}/dispatch/wildfire/1?timestep=${backendTimestepForMinute(minute)}`, { method: "POST" });
      if (r.ok) setApiData(await r.json());
    } finally {
      setLoading(false);
    }
  };

  const updateMinute = (value) => {
    setMinute(value);
    setApiData(null);
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

        {selectedDepartment === "fire" && (
          <>
            <Polyline positions={lineA} pathOptions={{ className: "assignment-focus assignment-fire", color: "#dc2626", weight: 10, opacity: 0.42 }} />
            <Polygon positions={operationalLayers.find((layer) => layer.id === "fuel").positions} pathOptions={{ className: "assignment-area assignment-fire", color: "#dc2626", fillColor: "#ef4444", fillOpacity: 0.16, weight: 3, dashArray: "10 8" }}>
              <Tooltip permanent direction="center" className="assignment-label">Fire IC task area</Tooltip>
            </Polygon>
          </>
        )}

        {selectedDepartment === "utility" && (
          <Marker position={substation} icon={markerIcon("substation", "HIGH")}>
            <Tooltip permanent direction="right" className="assignment-label">Utility switching task</Tooltip>
          </Marker>
        )}

        {selectedDepartment === "traffic" && osmData?.pch_segments?.map((seg, i) => (
          <Polyline key={`traffic-focus-${i}`} positions={seg} pathOptions={{ className: "assignment-focus assignment-traffic", color: "#f59e0b", weight: 9, opacity: 0.34 }} />
        ))}

        {selectedDepartment === "evac" && (
          <Polygon positions={operationalLayers.find((layer) => layer.id === "homes").positions} pathOptions={{ className: "assignment-area assignment-evac", color: "#a855f7", fillColor: "#c084fc", fillOpacity: 0.18, weight: 3, dashArray: "10 8" }}>
            <Tooltip permanent direction="center" className="assignment-label">Evacuation alert zone</Tooltip>
          </Polygon>
        )}

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
          <Polyline key={`pch-casing-${i}`} positions={seg} pathOptions={{ color: "#2f2d26", weight: 13, opacity: 0.62 }} />
        ))}
        {osmData?.pch_segments?.map((seg, i) => (
          <Polyline key={`pch-active-${i}`} positions={seg} pathOptions={{ color: colors.road, weight: 5, opacity: 0.92 }} />
        ))}

        {osmData?.all_power_lines?.slice(1).map((pl, i) => (
          <Polyline key={`pl-${i}`} positions={pl.coordinates} pathOptions={{ color: "#6b5f49", weight: 1, opacity: 0.18, dashArray: "5 5" }} />
        ))}

        {cascadeLinks.map((link, i) => (
          <Polyline
            key={`cascade-link-${i}`}
            positions={link}
            pathOptions={{
              className: minute >= FAILURE_TIMES.lineA ? "cascade-link cascade-live" : "cascade-link",
              color: minute >= FAILURE_TIMES.lineA ? "#ef4444" : "#14b8a6",
              weight: 3,
              opacity: minute >= FAILURE_TIMES.lineA ? 0.95 : 0.58,
              dashArray: "7 9",
            }}
          />
        ))}

        <Polyline positions={lineA} pathOptions={{ color: "#2f2d26", weight: 11, opacity: 0.92 }} />
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
            <strong>{state.power}</strong>
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

        <Marker position={roadFocus} icon={markerIcon("traffic", routeStatus)}>
          <Tooltip>PCH traffic control - {routeStatus}</Tooltip>
          <Popup className="incident-popup">
            <strong>PCH Traffic Control</strong>
            <span>Signals are summarized into one evacuation corridor control point.</span>
            <em>Traffic: deploy manual control here if utility failure slows evacuation.</em>
          </Popup>
        </Marker>

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

        {Object.entries(ACK_POSITIONS).map(([agency, pos]) => {
          const ack = acknowledgments[agency];
          if (!ack || ack === "PENDING") return null;
          return (
            <Marker key={`ack-${agency}`} position={pos} icon={ackMapIcon(ack)}>
              <Tooltip>{agency.replace(/_/g, " ")}: {ack}</Tooltip>
            </Marker>
          );
        })}
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

        <div className="timeline-bar time-slider-panel">
          <div className="slider-readout">
            <span>Incident Time</span>
            <strong>{state.label}</strong>
            <em>{state.phase}</em>
          </div>
          <input
            className="incident-slider"
            type="range"
            min="0"
            max={INCIDENT_DURATION_MIN}
            step="1"
            value={minute}
            onChange={(event) => updateMinute(Number(event.target.value))}
            aria-label="Incident time in minutes"
          />
          <div className="slider-ticks">
            <span>0m</span>
            <span>Line A {FAILURE_TIMES.lineA}m</span>
            <span>PCH {FAILURE_TIMES.route}m</span>
            <span>3h</span>
          </div>
        </div>

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

      <motion.section
        className="map-alert"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
      >
        <div className={`severity-badge severity-${lc(fireLevel)}`}>{state.label} / {fireLevel}</div>
        <strong>{nextFailure}</strong>
        <span>{dispatchSummary}</span>
        <div className="decision-facts">
          <span><Wind size={13} /> {windMph.toFixed(0)} mph</span>
          <span><Clock3 size={13} /> {state.phase}</span>
          <span><Route size={13} /> {routeStatus}</span>
        </div>
      </motion.section>

      <motion.section
        className="coordination-layer"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24 }}
      >
        <div className="department-strip">
          {departmentAssignments.map(({ id, label, asset, status, action, Icon }) => {
            const ack = acknowledgments[AGENCY_KEY[id]];
            return (
              <button
                key={id}
                className={`department-pill department-${id}${selectedDepartment === id ? " active" : ""}`}
                onClick={() => setSelectedDepartment(id)}
                title={action}
              >
                <Icon size={15} />
                <span>{label}</span>
                <strong>{status}</strong>
                <em>{asset}</em>
                {ack && (
                  <span className={`ack-badge ack-${ack.toLowerCase()}`}>
                    {ack === "ACCEPTED" ? "✓" : ack === "DENIED" ? "✗" : "•••"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <Tabs.Root className="ops-tabs" defaultValue="plan">
          <Tabs.List className="ops-tab-list" aria-label="Responder operating details">
            <Tabs.Trigger className="ops-tab-trigger" value="plan">Plan</Tabs.Trigger>
            <Tabs.Trigger className="ops-tab-trigger" value="sync">Sync</Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content className="ops-tab-content" value="plan">
            <span>Common Operating Plan</span>
            <strong>{apiData?.agents?.coordinator?.incident_objective || "Keep PCH evacuation open while departments act on the same plan."}</strong>
            {selectedAssignment && (
              <p><b>{selectedAssignment.label}</b>{selectedAssignment.action}</p>
            )}
          </Tabs.Content>
          <Tabs.Content className="ops-tab-content" value="sync">
            <span>Live Sync</span>
            {incidentLog.map((entry, index) => (
              <p key={entry}><b>14:{String(4 + index).padStart(2, "0")}</b>{entry}</p>
            ))}
          </Tabs.Content>
        </Tabs.Root>
      </motion.section>

      <section className="cascade-strip">
        {cascadeNodes.map(({ label, status, Icon }, i) => (
          <div key={label} className="cascade-node-wrap">
            <div className={`cascade-node node-${lc(status)}`}>
              <Icon size={15} />
              <span>{label}</span>
              <strong>{status}</strong>
            </div>
            {i < cascadeNodes.length - 1 && <div className={minute >= FAILURE_TIMES.lineA ? "node-arrow active" : "node-arrow"} />}
          </div>
        ))}
      </section>
    </div>
  );
}
