import { useMemo, useRef, useState, useEffect } from "react";
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
  PanelRightClose,
  PanelRightOpen,
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
const STREAM_EVENT_TYPES = ["physics_computed", "agent_rejected", "agent_validated", "coordinator_done"];
const FAILURE_TIMES = {
  lineA: 35,
  substation: 42,
  signals: 48,
  route: 60,
  debris: 150,
};
const TICKER_MS = 300;
const FAILURE_PAUSE_MS = 2500;
const FAILURE_NODE_MAP = {
  [FAILURE_TIMES.lineA]: "Power Line",
  [FAILURE_TIMES.substation]: "Utility Station",
  [FAILURE_TIMES.signals]: "Traffic Signals",
  [FAILURE_TIMES.route]: "Evacuation Road",
  [FAILURE_TIMES.debris]: null,
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
    action: "Warn residents early if the power failure reaches the evacuation road.",
  },
  {
    id: "malibu_bluffs",
    name: "Malibu Bluffs",
    homes: "1.1K homes",
    status: "WATCH",
    position: [34.058, -118.686],
    action: "Keep westbound evacuation traffic moving.",
  },
  {
    id: "topanga_edge",
    name: "Topanga Edge",
    homes: "860 homes",
    status: "EXPOSED",
    position: [34.082, -118.604],
    action: "Protect homes along the dry vegetation edge.",
  },
  {
    id: "pch_corridor",
    name: "Coastal Evacuation Road",
    homes: "4,200 exposed",
    status: "EVACUATION ROAD",
    position: [34.036, -118.704],
    action: "Use officers for traffic control if signals lose power.",
  },
];

const operationalLayers = [
  {
    id: "fuel",
    label: "Dense Dry Vegetation",
    shortLabel: "Vegetation",
    risk: "HIGH",
    Icon: TreePine,
    color: "#166534",
    fill: "#22c55e",
    positions: [[34.092, -118.662], [34.111, -118.612], [34.102, -118.562], [34.074, -118.57], [34.062, -118.626]],
    detail: "Dry canyon vegetation can make the fire move faster toward homes and power lines.",
    action: "Place fire crews along this vegetation edge before the fire reaches infrastructure.",
  },
  {
    id: "ember",
    label: "Wind Push Zone",
    shortLabel: "Wind",
    risk: "CRITICAL",
    Icon: Wind,
    color: "#b45309",
    fill: "#f59e0b",
    positions: [[34.088, -118.644], [34.094, -118.61], [34.072, -118.548], [34.052, -118.558], [34.064, -118.62]],
    detail: "Wind can push flames and embers ahead of the visible fire edge.",
    action: "Warn crews where the fire may jump ahead next.",
  },
  {
    id: "evac",
    label: "Evacuation Traffic Area",
    shortLabel: "Evacuation",
    risk: "AT RISK",
    Icon: Navigation,
    color: "#0369a1",
    fill: "#0ea5e9",
    positions: [[34.059, -118.735], [34.065, -118.668], [34.043, -118.632], [34.021, -118.694], [34.03, -118.765]],
    detail: "Traffic teams need to control intersections before signal power fails.",
    action: "Keep evacuation traffic moving west and block re-entry.",
  },
  {
    id: "homes",
    label: "Homes at Risk",
    shortLabel: "Homes",
    risk: "CRITICAL",
    Icon: Home,
    color: "#be123c",
    fill: "#fb7185",
    positions: [[34.074, -118.705], [34.083, -118.673], [34.064, -118.648], [34.047, -118.676], [34.053, -118.714]],
    detail: "These homes become harder to evacuate if the road slows down.",
    action: "Send early evacuation alerts to the 4,200 exposed residents.",
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
    detail: "A safer area for crews before the power and traffic failures spread.",
    action: "Stage fire, utility, and traffic teams outside the failure path.",
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
    label: "Fire Command",
    asset: "power line / fire edge",
    channel: "Command",
    Icon: Flame,
  },
  utility: {
    label: "Utility",
    asset: "Malibu utility station",
    channel: "Utility Ops",
    Icon: Zap,
  },
  traffic: {
    label: "Traffic",
    asset: "coastal evacuation road",
    channel: "Traffic Ops",
    Icon: TrafficCone,
  },
  evac: {
    label: "Evacuation",
    asset: "4,200 homes",
    channel: "Evac Branch",
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
    { at: FAILURE_TIMES.lineA, label: `Main power line may fail in ${FAILURE_TIMES.lineA - minute} min` },
    { at: FAILURE_TIMES.substation, label: `Utility station may lose feed in ${FAILURE_TIMES.substation - minute} min` },
    { at: FAILURE_TIMES.signals, label: `Evacuation-road signals may lose power in ${FAILURE_TIMES.signals - minute} min` },
    { at: FAILURE_TIMES.route, label: `Evacuation road may slow in ${FAILURE_TIMES.route - minute} min` },
    { at: FAILURE_TIMES.debris, label: `Burned-slope washout risk in ${FAILURE_TIMES.debris - minute} min` },
  ].find((event) => minute < event.at);

  return {
    label: `T+${minute}m`,
    title: debrisActive ? "Burned Slope Hazard" : routeBlocked ? "Evacuation Road Slowed" : lineFailed ? "Failure Chain Active" : "Fire Moving Toward Power",
    fireLevel: minute < 20 ? "ELEVATED" : "CRITICAL",
    power: lineFailed ? "FAILED" : "OPERATIONAL",
    substation: substationFailed ? "FAILED" : "OPERATIONAL",
    signals: signalsFailed ? "FAILED" : "OPERATIONAL",
    road: routeBlocked ? "BLOCKED" : signalsFailed ? "DEGRADED" : "CLEAR",
    phase: debrisActive ? "After-fire hazard" : lineFailed ? "Failure chain" : "Prediction",
    next: nextEvent ? nextEvent.label : "Consequence management active",
    order: debrisActive
      ? "Keep responders away from burned slopes and move evacuees around washout zones."
      : routeBlocked
        ? "Keep officers on intersections so evacuees can keep moving west."
        : lineFailed
          ? "Finish backup power switching and send officers before traffic signals fail."
          : "Move Fire, Utility, and Traffic teams before the main power line fails.",
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
    if (minute >= FAILURE_TIMES.route) return "OFFICERS CONTROL";
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
  if (l === "ELEVATED" || l === "HIGH" || l === "DEGRADED" || l === "AT_RISK" || l === "WATCH" || l === "EXPOSED" || l === "EVAC_ROUTE" || l === "EVACUATION_ROAD") return "orange";
  return "red";
}

function markerIcon(kind, status) {
  const label = kind === "substation" ? "UTIL" : kind === "traffic" ? "ROAD" : "HOMES";
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

function formatClock(index) {
  return `14:${String(4 + index).padStart(2, "0")}`;
}

function formatAgentMessage(event, index, state, departmentAssignments) {
  const output = event.output || {};
  const fire = output.fire || {};
  const cascade = output.cascade || {};
  const debris = output.debris || {};

  if (event.type === "physics_computed") {
    return {
      id: `${event.type}-${index}`,
      time: formatClock(index),
      severity: "verified",
      from: "Physics",
      to: "Validator",
      action: "Checked fire spread, the main power line, the evacuation road, and burned-slope risk.",
      evidence: `${fire.threat_level || state.fireLevel} fire risk. Evacuation road is ${cascade.evacuation_routes?.road_PCH || state.road}.`,
    };
  }

  if (event.type === "agent_rejected") {
    return {
      id: `${event.type}-${index}-${event.retry || 0}`,
      time: formatClock(index),
      severity: "critical",
      from: "Validator",
      to: "AI Agents",
      action: "Rejected an unsafe answer and forced the agents to use verified physics.",
      evidence: event.violation ? "The AI answer contradicted the fire model." : "The AI answer did not match the verified threat.",
    };
  }

  if (event.type === "agent_validated") {
    return {
      id: `${event.type}-${index}`,
      time: formatClock(index),
      severity: "verified",
      from: "Validator",
      to: "Coordinator",
      action: "Approved the corrected threat so the coordinator can build one shared plan.",
      evidence: `${output.threat_label || debris.debris_threat || "Aligned"} threat is now consistent with physics.`,
    };
  }

  const taskSummary = departmentAssignments.map(({ label, action }) => `${label}: ${action}`).join(" ");

  return {
    id: `${event.type}-${index}`,
    time: formatClock(index),
    severity: "dispatch",
    from: "Coordinator",
    to: "All Stations",
    action: output.dispatch_summary || "Issued one plan so every station acts on the same threat.",
    evidence: taskSummary,
  };
}

function taskStatus(id, minute, liveEvents) {
  const coordinatorDone = liveEvents.some((event) => event.type === "coordinator_done");
  const physicsDone = liveEvents.some((event) => event.type === "physics_computed");

  if (coordinatorDone) {
    if (id === "fire") return "ACKNOWLEDGED";
    if (id === "utility") return minute >= FAILURE_TIMES.lineA ? "SWITCHING" : "STAGED";
    if (id === "traffic") return minute >= FAILURE_TIMES.signals ? "OFFICERS CONTROL" : "STAGED";
    return minute >= FAILURE_TIMES.route ? "REROUTING" : "ALERTING";
  }

  if (physicsDone) return id === "evac" ? "READY" : "ASSIGNED";
  return departmentStatus(id, minute);
}

function taskDue(id, minute) {
  if (id === "fire") return minute < FAILURE_TIMES.lineA ? `before ${FAILURE_TIMES.lineA - minute}m` : "now";
  if (id === "utility") return minute < FAILURE_TIMES.substation ? `before ${FAILURE_TIMES.substation - minute}m` : "now";
  if (id === "traffic") return minute < FAILURE_TIMES.signals ? `before ${FAILURE_TIMES.signals - minute}m` : "now";
  return minute < FAILURE_TIMES.route ? `before ${FAILURE_TIMES.route - minute}m` : "now";
}

function consequenceStatusLabel(status) {
  if (status === "FAILED" || status === "BLOCKED") return "Immediate action";
  if (status === "DEGRADED" || status === "CRITICAL") return "Watch closely";
  return "Prevent failure";
}

function readableTrigger(trigger) {
  if (!trigger) return "fire is moving toward the power-line area";
  const normalized = String(trigger).replaceAll("_", " ").toLowerCase();
  if (normalized.includes("geometry intersection")) return "fire edge reached the power-line area";
  if (normalized.includes("line a")) return "fire is moving toward the main power line";
  return normalized;
}

function buildAssetConsequences({
  state,
  minute,
  windMph,
  rainInHr,
  trigger,
  routeStatus,
  selectedAssignment,
}) {
  return {
    fire: {
      label: "Fire Perimeter",
      status: state.fireLevel,
      owner: "Fire Command",
      department: "fire",
      headline: "The fire is moving toward the main power line.",
      action: selectedAssignment?.id === "fire" ? selectedAssignment.action : "Keep the fire away from the main power line.",
      chain: [
        "Fire moves toward the power line",
        "Power line can fail",
        "Evacuation traffic can slow",
      ],
      evidence: [`Wind ${windMph.toFixed(0)} mph`, `Why ${readableTrigger(trigger)}`, `T+${minute}m forecast`],
    },
    lineA: {
      label: "Main Power Line",
      status: state.power,
      owner: "Fire Command + Utility",
      department: "fire",
      headline: "If this power line fails, the whole failure chain starts.",
      action: "Keep fire away from the power line. Utility prepares backup switching.",
      chain: [
        "Power line fails",
        "Utility station loses feed",
        "Traffic signals lose power",
        "Evacuation road slows",
      ],
      evidence: [`Failure window ${taskDue("fire", minute)}`, `Power ${state.power}`, `Fire threat ${state.fireLevel}`],
    },
    substation: {
      label: "Malibu Utility Station",
      status: state.substation,
      owner: "Utility",
      department: "utility",
      headline: "This station helps power the evacuation-road signals.",
      action: "Switch Malibu load to backup. Warn Traffic before signals lose power.",
      chain: [
        "Power line fails",
        "Utility station loses feed",
        "Traffic signals lose power",
        "Officers must control intersections",
      ],
      evidence: [`Utility station ${state.substation}`, `Switching ${taskDue("utility", minute)}`, "Depends on the main power line"],
    },
    pch: {
      label: "Coastal Evacuation Road",
      status: routeStatus,
      owner: "Traffic",
      department: "traffic",
      headline: "This is the main road residents use to leave.",
      action: "Put officers on key intersections before signals lose power.",
      chain: [
        "Signals degrade",
        "Officers take control",
        "Evacuation flow slows",
        "4,200 residents need routing",
      ],
      evidence: [`Route ${routeStatus}`, `Signals ${state.signals}`, `Traffic action ${taskDue("traffic", minute)}`],
    },
    homes: {
      label: "Exposed Homes",
      status: routeStatus === "BLOCKED" ? "CRITICAL" : "AT RISK",
      owner: "Evacuation",
      department: "evac",
      headline: "These homes depend on the evacuation road staying open.",
      action: "Warn residents before the road slows or blocks.",
      chain: [
        "Power feed fails",
        "Traffic controls degrade",
        "Exit time increases",
        "Homes need early warning",
      ],
      evidence: ["4,200 exposed", `Road ${routeStatus}`, `Evacuation action ${taskDue("evac", minute)}`],
    },
    debris: {
      label: "Burned-Slope Washout Zone",
      status: state.debrisActive ? "HIGH" : "MONITOR",
      owner: "Fire Command + Traffic",
      department: "traffic",
      headline: "Rain can push mud and ash from burned slopes onto roads.",
      action: "Keep crews and evacuees out of this washout area.",
      chain: [
        "Fire burns slope",
        "Rain moves mud and ash",
        "Staging becomes unsafe",
        "Traffic reroutes",
      ],
      evidence: [`Rain ${rainInHr.toFixed(2)} in/hr`, "Slope 34 deg", "Burn severity 78%"],
    },
  };
}

function stationBrief(id, minute, action) {
  const briefs = {
    fire: {
      target: "Keep fire away from the main power line.",
      reason: "That power line starts the failure chain.",
      miss: "The utility station and traffic signals can fail next.",
      asset: "Main power-line area",
    },
    utility: {
      target: "Switch Malibu load to backup.",
      reason: "The utility station feeds evacuation-road signals.",
      miss: "Signals lose power during evacuation.",
      asset: "Malibu utility station",
    },
    traffic: {
      target: "Put officers at evacuation-road signals.",
      reason: "Manual control keeps evacuation moving.",
      miss: "The road slows and blocks response access.",
      asset: "Evacuation-road intersections",
    },
    evac: {
      target: "Warn exposed homes early.",
      reason: "Residents need time before the road slows.",
      miss: "Evacuation starts after route capacity drops.",
      asset: "4,200 homes",
    },
  };
  const brief = briefs[id];
  return {
    ...brief,
    action,
    urgency: taskDue(id, minute),
  };
}


export default function App() {
  const [minute, setMinute] = useState(0);
  const [apiData, setApiData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [liveEvents, setLiveEvents] = useState([]);
  const [playing, setPlaying] = useState(false);
  const [pausedForFailure, setPausedForFailure] = useState(false);
  const [flashingNode, setFlashingNode] = useState(null);
  const [selectedAssetId, setSelectedAssetId] = useState("lineA");
  const [selectedDepartment, setSelectedDepartment] = useState("fire");
  const [activeOpsTab, setActiveOpsTab] = useState("plan");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [fireKeyframes, setFireKeyframes] = useState([]);
  const [osmData, setOsmData] = useState(null);
  const streamRef = useRef(null);
  const tickerRef = useRef(null);
  const [visibleLayers, setVisibleLayers] = useState({
    fuel: true,
    ember: true,
    evac: true,
    homes: true,
    staging: false,
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
    return () => {
      streamRef.current?.close();
      if (tickerRef.current) clearInterval(tickerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!playing || pausedForFailure) return;
    tickerRef.current = setInterval(() => {
      setMinute((prev) => {
        if (prev >= INCIDENT_DURATION_MIN) {
          setPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, TICKER_MS);
    return () => clearInterval(tickerRef.current);
  }, [playing, pausedForFailure]);

  useEffect(() => {
    if (!playing) return;
    const nodeLabel = FAILURE_NODE_MAP[minute];
    if (!(minute in FAILURE_NODE_MAP)) return;
    const startPause = setTimeout(() => {
      setPausedForFailure(true);
      if (nodeLabel) setFlashingNode(nodeLabel);
    }, 0);
    const endPause = setTimeout(() => {
      setFlashingNode(null);
      setPausedForFailure(false);
    }, FAILURE_PAUSE_MS);
    return () => {
      clearTimeout(startPause);
      clearTimeout(endPause);
    };
  }, [minute, playing]);

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
  const trigger = apiData?.data_sources?.scenario?.trigger_source || (minute >= FAILURE_TIMES.lineA ? "geometry_intersection" : "approaching main power line");
  const nextFailure = state.next;
  const nextFailureOwner = minute < FAILURE_TIMES.lineA
    ? "Fire Command + Utility"
    : minute < FAILURE_TIMES.substation
      ? "Utility"
      : minute < FAILURE_TIMES.signals
        ? "Traffic"
        : minute < FAILURE_TIMES.route
          ? "Traffic + Evacuation"
          : "All Stations";

  const cascadeNodes = [
    { label: "Power Line", status: state.power, Icon: Zap },
    { label: "Utility Station", status: utilityStatus, Icon: Activity },
    { label: "Traffic Signals", status: state.signals, Icon: TrafficCone },
    { label: "Evacuation Road", status: routeStatus, Icon: Route },
  ];

  const coordinatorAgencies = apiData?.agents?.coordinator?.agencies || {};
  const departmentAssignments = [
    {
      id: "fire",
      action: coordinatorAgencies.fire_incident_command?.recommendation || "Send crews to keep fire away from the main power line.",
    },
    {
      id: "utility",
      action: coordinatorAgencies.utility_operator?.recommendation || "Switch the Malibu utility station to backup power.",
    },
    {
      id: "traffic",
      action: coordinatorAgencies.traffic_management?.recommendation || "Stage officers at evacuation-road traffic signals.",
    },
    {
      id: "evac",
      action: minute >= FAILURE_TIMES.route ? "Reroute evacuees around the slowed road." : "Send early warning to exposed homes.",
    },
  ].map((item) => ({
    ...item,
    ...departmentMeta[item.id],
    status: taskStatus(item.id, minute, liveEvents),
    due: taskDue(item.id, minute),
    brief: stationBrief(item.id, minute, item.action),
  }));

  const agentMessages = liveEvents.length
    ? liveEvents.map((event, index) => formatAgentMessage(event, index, state, departmentAssignments))
    : [
        {
          id: "standby-comms",
          time: "14:04",
          severity: "verified",
          from: "Physics",
          to: "Hazard Agent",
          action: "Checks wind, slope, fire perimeter, and distance to the main power line.",
          evidence: `${windMph.toFixed(0)} mph wind. ${nextFailure}`,
        },
        {
          id: "standby-cascade",
          time: "14:05",
          severity: "dispatch",
          from: "Failure Chain Agent",
          to: "Validator",
          action: "Links power-line failure to the utility station, traffic signals, and evacuation flow.",
          evidence: "No station task is released until this chain is validated.",
        },
        {
          id: "standby-validator",
          time: "14:06",
          severity: "critical",
          from: "Validator",
          to: "AI Agents",
          action: "Blocks any plan that ignores how one failure causes the next.",
          evidence: "AI must match the fire model, road status, and each station owner.",
        },
        {
          id: "standby-coordinator",
          time: "14:07",
          severity: "dispatch",
          from: "Coordinator",
          to: "All Stations",
          action: "Routes one task per station after validation.",
          evidence: "Fire, Utility, Traffic, and Evacuation see the same plan.",
        },
      ];
  const selectedAssignment = departmentAssignments.find((dept) => dept.id === selectedDepartment);
  const assetConsequences = buildAssetConsequences({
    state,
    minute,
    windMph,
    rainInHr,
    trigger,
    routeStatus,
    selectedAssignment,
  });
  const selectedAsset = assetConsequences[selectedAssetId] || assetConsequences.lineA;
  const selectedAssetDepartment = departmentMeta[selectedAsset.department];
  const selectedDepartmentBrief = departmentAssignments.find((dept) => dept.id === selectedDepartment)?.brief;
  const sourceChips = [
    { label: "Wind", value: apiData ? "live if available" : `${windMph.toFixed(0)} mph demo` },
    { label: "Physics", value: readableTrigger(trigger) },
    { label: "AI", value: streaming || liveEvents.length ? "drafting station tasks" : "waiting for dispatch" },
    { label: "Validator", value: liveEvents.some((event) => event.type === "agent_validated") ? "physics check passed" : "ready to block unsafe tasks" },
    { label: "Plan", value: apiData ? "shared plan issued" : "baseline plan visible" },
  ];
  const agentPipeline = [
    {
      label: "Physics",
      from: "Live inputs",
      to: "Hazard Agent",
      detail: "Computes fire spread, wind push, power-line timing, and road status.",
      output: nextFailure,
      active: Boolean(liveEvents.find((event) => event.type === "physics_computed")),
    },
    {
      label: "Specialist Agents",
      from: "Hazard, Failure, After-fire",
      to: "Validator",
      detail: "Drafts what may fail next and which stations must move.",
      output: "Draft station tasks",
      active: liveEvents.some((event) => event.type === "agent_rejected" || event.type === "agent_validated"),
    },
    {
      label: "Validator",
      from: "AI draft",
      to: "Coordinator",
      detail: "Rejects anything that contradicts the fire model or road dependency.",
      output: liveEvents.some((event) => event.type === "agent_validated") ? "Validated" : "Checking draft",
      active: liveEvents.some((event) => event.type === "agent_rejected" || event.type === "agent_validated"),
    },
    {
      label: "Coordinator",
      from: "Validated risk",
      to: "Stations",
      detail: "Turns one validated threat into owned tasks and deadlines.",
      output: apiData ? "Plan issued" : "Awaiting dispatch",
      active: liveEvents.some((event) => event.type === "coordinator_done"),
    },
  ];

  const selectAsset = (assetId) => {
    const asset = assetConsequences[assetId] || assetConsequences.lineA;
    setSelectedAssetId(assetId);
    setSelectedDepartment(asset.department);
  };

  const closeLiveStream = () => {
    streamRef.current?.close();
    streamRef.current = null;
    setStreaming(false);
  };

  const pauseTicker = () => {
    if (tickerRef.current) clearInterval(tickerRef.current);
    tickerRef.current = null;
    setPlaying(false);
    setPausedForFailure(false);
    setFlashingNode(null);
  };

  const startTicker = () => setPlaying(true);

  const resetTicker = () => {
    pauseTicker();
    setMinute(0);
    setSelectedAssetId("lineA");
    setSelectedDepartment("fire");
  };

  const dispatch = async () => {
    setLoading(true);
    setActiveOpsTab("sync");
    closeLiveStream();
    setLiveEvents([]);
    try {
      const r = await fetch(`${BASE_URL}/dispatch/wildfire/1?timestep=${backendTimestepForMinute(minute)}`, { method: "POST" });
      if (r.ok) {
        const data = await r.json();
        setApiData(data);

        const stream = new EventSource(`${BASE_URL}/dispatch/wildfire/1/events?timestep=${backendTimestepForMinute(minute)}&delay_seconds=0.55`);
        streamRef.current = stream;
        setStreaming(true);

        STREAM_EVENT_TYPES.forEach((eventType) => {
          stream.addEventListener(eventType, (message) => {
            const event = JSON.parse(message.data);
            setLiveEvents((current) => [...current, event]);
            if (event.type === "coordinator_done") {
              stream.close();
              streamRef.current = null;
              setStreaming(false);
            }
          });
        });

        stream.onerror = () => {
          stream.close();
          streamRef.current = null;
          setStreaming(false);
        };
      }
    } finally {
      setLoading(false);
    }
  };

  const updateMinute = (value) => {
    closeLiveStream();
    pauseTicker();
    setMinute(value);
    setApiData(null);
    setLiveEvents([]);
  };

  return (
    <div className={`shell${sidebarOpen ? "" : " sidebar-collapsed"}`}>
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
          <Marker
            key={community.id}
            position={community.position}
            icon={communityIcon(community.status)}
            eventHandlers={{ click: () => selectAsset("homes") }}
          >
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
            eventHandlers={{
              click: () => selectAsset(layer.id === "homes" ? "homes" : layer.id === "evac" ? "pch" : layer.id === "fuel" || layer.id === "ember" ? "fire" : "lineA"),
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
              <Tooltip permanent direction="center" className="assignment-label">Fire command task area</Tooltip>
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
            <Polygon
              positions={fireGeoJSON}
              pathOptions={{ className: "fire-front", color: "#991b1b", fillColor: "#f97316", fillOpacity: 0.44, weight: 2 }}
              eventHandlers={{ click: () => selectAsset("fire") }}
            >
              <Tooltip sticky className="quiet-tooltip">
                <span>Fire perimeter</span>
                <strong>{fireLevel}</strong>
              </Tooltip>
              <Popup className="incident-popup">
                <strong>Active Fire Perimeter</strong>
                <span>Wind {windMph.toFixed(0)} mph. Why this matters: {readableTrigger(trigger)}.</span>
                <em>{state.order}</em>
              </Popup>
            </Polygon>
          </>
        )}

        {osmData?.pch_segments?.map((seg, i) => (
          <Polyline key={`pch-casing-${i}`} positions={seg} pathOptions={{ color: "#2f2d26", weight: 13, opacity: 0.62 }} />
        ))}
        {osmData?.pch_segments?.map((seg, i) => (
          <Polyline
            key={`pch-active-${i}`}
            positions={seg}
            pathOptions={{ color: colors.road, weight: 5, opacity: 0.92 }}
            eventHandlers={{ click: () => selectAsset("pch") }}
          />
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
          eventHandlers={{ click: () => selectAsset("lineA") }}
        >
          <Tooltip permanent direction="top" className="map-label label-line">
            <span>Power line</span>
            <strong>{state.power}</strong>
          </Tooltip>
          <Popup className="incident-popup">
            <strong>Main Power Line</strong>
            <span>{nextFailure}</span>
            <em>Responder action: protect the power-line area and switch load before the next failure.</em>
          </Popup>
        </Polyline>

        <Marker position={substation} icon={markerIcon("substation", utilityStatus)} eventHandlers={{ click: () => selectAsset("substation") }}>
          <Tooltip>Malibu utility station - {utilityStatus}</Tooltip>
          <Popup className="incident-popup">
            <strong>Malibu Utility Station</strong>
            <span>Status: {utilityStatus}. Depends on the main power line.</span>
            <em>Utility: switch to backup feed when the power line is threatened.</em>
          </Popup>
        </Marker>

        <Marker position={roadFocus} icon={markerIcon("traffic", routeStatus)} eventHandlers={{ click: () => selectAsset("pch") }}>
          <Tooltip>Evacuation-road traffic control - {routeStatus}</Tooltip>
          <Popup className="incident-popup">
            <strong>Evacuation-Road Traffic Control</strong>
            <span>Signals are summarized into one evacuation-road control point.</span>
            <em>Traffic: deploy manual control here if utility failure slows evacuation.</em>
          </Popup>
        </Marker>

        <Marker position={[34.052, -118.675]} icon={markerIcon("exposure", routeStatus)} eventHandlers={{ click: () => selectAsset("homes") }}>
          <Tooltip>4,200 residents exposed if the evacuation road slows</Tooltip>
          <Popup className="incident-popup">
            <strong>Population Exposure</strong>
            <span>Residents become harder to move if the evacuation road slows.</span>
            <em>Evacuation: prioritize alerts inside the exposure cluster.</em>
          </Popup>
        </Marker>

        {showDebris && (
          <Polygon
            positions={debrisZone}
            pathOptions={{ className: "debris-zone", color: "#92400e", fillColor: "#f59e0b", fillOpacity: 0.34, weight: 2 }}
            eventHandlers={{ click: () => selectAsset("debris") }}
          >
            <Tooltip sticky className="quiet-tooltip">
              <span>Burned-slope washout zone</span>
              <strong>HIGH</strong>
            </Tooltip>
            <Popup className="incident-popup">
              <strong>Burned-Slope Washout Zone</strong>
              <span>Rain {rainInHr.toFixed(2)} in/hr with burned slopes above Malibu.</span>
              <em>Keep responders and evacuees outside this polygon.</em>
            </Popup>
          </Polygon>
        )}
      </MapContainer>

      <div className="map-vignette" />

      <section className="map-alert incident-snapshot" aria-label="Current incident summary">
        <span>Responder Snapshot</span>
        <strong>{nextFailure}</strong>
        <p>{state.order}</p>
        <div className="snapshot-grid">
          <b>Owner <em>{nextFailureOwner}</em></b>
          <b>Route <em>{routeStatus}</em></b>
          <b>Power <em>{state.power}</em></b>
        </div>
      </section>

      <header className="command-bar">
        <div className="brand-lockup">
          <span className="status-dot" />
          <div className="brand-copy">
            <strong>Foresight</strong>
            <span><MapPin size={12} /> Palisades evacuation area</span>
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
            <span>Power line {FAILURE_TIMES.lineA}m</span>
            <span>Road slowdown {FAILURE_TIMES.route}m</span>
            <span>3h</span>
          </div>
        </div>

        <div className="dispatch-cluster">
          <button className="dispatch-btn" onClick={dispatch} disabled={loading}>
            <Radio size={16} />
            {loading ? "Starting" : streaming ? "Agents Talking" : apiData ? "Refresh Live" : "Run Live Dispatch"}
          </button>
          <div className="replay-controls">
            <button type="button" onClick={playing || pausedForFailure ? pauseTicker : startTicker}>
              {playing || pausedForFailure ? "Pause" : "Play"}
            </button>
            <button type="button" onClick={resetTicker}>Reset</button>
          </div>
        </div>
      </header>

      <aside className="layer-rail">
        <div className="rail-title" data-tooltip="Map layers: toggle operational overlays on the incident map.">
          <Layers size={15} />
          <span>Layers</span>
        </div>
        {operationalLayers.map(({ id, shortLabel, label, Icon, risk, detail, action }) => (
          <button
            key={id}
            className={visibleLayers[id] ? "layer-chip active" : "layer-chip"}
            onClick={() => setVisibleLayers((current) => ({ ...current, [id]: !current[id] }))}
            aria-label={`${label}. ${risk}. ${detail} ${action}`}
            data-tooltip={`${label} (${risk}): ${detail}`}
          >
            <Icon size={16} />
            <span>{shortLabel}</span>
          </button>
        ))}
      </aside>

      <motion.aside
        className="consequence-panel"
        data-sidebar="sidebar"
        data-side="right"
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: sidebarOpen ? 1 : 0, x: sidebarOpen ? 0 : "100%" }}
        transition={{ duration: 0.22 }}
        aria-label="Operations sidebar"
        aria-hidden={!sidebarOpen}
      >
        <div className="sidebar-kicker">
          <span>{selectedAssetDepartment?.label || "Incident"}</span>
          <b>{state.label}</b>
        </div>
        <div className="asset-panel-top">
          <span className={`severity-badge severity-${lc(selectedAsset.status)}`}>{consequenceStatusLabel(selectedAsset.status)}</span>
          <button type="button" onClick={() => selectAsset("lineA")} aria-label="Reset selected asset">Power line</button>
        </div>
        <strong>{selectedAsset.label}</strong>
        <p>{selectedAsset.headline}</p>
        <div className="decision-facts">
          <span><Wind size={13} /> {windMph.toFixed(0)} mph</span>
          <span><Clock3 size={13} /> {state.phase}</span>
          <span><Route size={13} /> {routeStatus}</span>
        </div>
        <div className="asset-facts">
          <span>Owner <b>{selectedAsset.owner}</b></span>
          <span>Status <b>{selectedAsset.status}</b></span>
        </div>
        <section className="sidebar-section" aria-label="Station command briefs">
          <span>Station Command Briefs</span>
          <div className="sidebar-department-list">
            {departmentAssignments.map(({ id, label, status, due, Icon, brief }) => (
              <button
                key={id}
                className={`department-pill sidebar-department-pill department-${id}${selectedDepartment === id ? " active" : ""}`}
                onClick={() => {
                  setSelectedDepartment(id);
                  if (id === "fire") selectAsset("lineA");
                  if (id === "utility") selectAsset("substation");
                  if (id === "traffic") selectAsset("pch");
                  if (id === "evac") selectAsset("homes");
                }}
                title={`${brief.target} ${brief.reason}`}
              >
                <Icon size={15} />
                <span>{label}</span>
                <em>{status}</em>
                <small>{due === "now" ? "Due now" : `Due ${due}`}</small>
                <strong>{brief.target}</strong>
                <p>{brief.reason}</p>
              </button>
            ))}
          </div>
        </section>
        <div className="asset-action">
          <span>Do this now</span>
          <b>{selectedAsset.action}</b>
        </div>
        {selectedDepartmentBrief && (
          <div className="missed-window">
            <span>If missed</span>
            <b>{selectedDepartmentBrief.miss}</b>
          </div>
        )}
        <ol className="asset-chain">
          {selectedAsset.chain.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <div className="asset-evidence">
          {selectedAsset.evidence.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
        <Tabs.Root className="sidebar-tabs" value={activeOpsTab} onValueChange={setActiveOpsTab}>
          <Tabs.List className="ops-tab-list" aria-label="Responder operating details">
            <Tabs.Trigger className="ops-tab-trigger" value="plan">Plan</Tabs.Trigger>
            <Tabs.Trigger className="ops-tab-trigger" value="sync">Sync</Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content className="sidebar-tab-content" value="plan">
            <span>Shared Plan</span>
            <strong>{apiData?.agents?.coordinator?.incident_objective || "Keep the evacuation road open by stopping the power failure chain early."}</strong>
            {selectedAssignment && (
              <p><b>{selectedAssignment.label}</b>{selectedAssignment.brief.target} {selectedAssignment.action}</p>
            )}
            <div className="source-strip" aria-label="Data and model sources">
              {sourceChips.map((chip) => (
                <span key={chip.label}><b>{chip.label}</b>{chip.value}</span>
              ))}
            </div>
          </Tabs.Content>
          <Tabs.Content className="sidebar-tab-content" value="sync">
            <span>Agent Routing</span>
            <div className="agent-routing-summary">
              <b>Current routing decision</b>
              <strong>{nextFailure}</strong>
              <em>{state.order}</em>
            </div>
            <div className="agent-pipeline" aria-label="Agent coordination pipeline">
              {agentPipeline.map((step, index) => (
                <div key={step.label} className={step.active ? "pipeline-step active" : "pipeline-step"}>
                  <b>{index + 1}</b>
                  <span>{step.label}</span>
                  <small>{step.from} to {step.to}</small>
                  <em>{step.detail}</em>
                  <strong>{step.output}</strong>
                </div>
              ))}
            </div>
            <div className="station-routing-board" aria-label="Responder routing board">
              {departmentAssignments.map(({ id, label, status, due, brief }) => (
                <article key={id} className={`station-route station-route-${id}`}>
                  <span>{label}</span>
                  <b>{status}</b>
                  <strong>{brief.target}</strong>
                  <em>{due === "now" ? "Route now" : `Route before ${due.replace("before ", "")}`}</em>
                </article>
              ))}
            </div>
            <div className="agent-comms" aria-label="Agent coordination messages">
              {agentMessages.map((message) => (
                <article className={`agent-message message-${message.severity}`} key={message.id}>
                  <b>{message.time}</b>
                  <div className="message-copy">
                    <div className="message-route">
                      <strong>{message.from}</strong>
                      <span>to</span>
                      <strong>{message.to}</strong>
                    </div>
                    <em>{message.action}</em>
                    <p>{message.evidence}</p>
                  </div>
                </article>
              ))}
            </div>
          </Tabs.Content>
        </Tabs.Root>
      </motion.aside>

      <button
        type="button"
        className="sidebar-toggle"
        onClick={() => setSidebarOpen((open) => !open)}
        aria-label={sidebarOpen ? "Close operations sidebar" : "Open operations sidebar"}
        aria-expanded={sidebarOpen}
        title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
      >
        {sidebarOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
      </button>

      <section className="cascade-strip">
        {cascadeNodes.map(({ label, status, Icon }, i) => (
          <div key={label} className="cascade-node-wrap">
            <button
              type="button"
              className={`cascade-node node-${lc(status)}${flashingNode === label ? " flashing" : ""}`}
              onClick={() => selectAsset(label === "Power Line" ? "lineA" : label === "Utility Station" ? "substation" : "pch")}
            >
              <Icon size={15} />
              <span>{label}</span>
              <strong>{status}</strong>
            </button>
            {i < cascadeNodes.length - 1 && <div className={minute >= FAILURE_TIMES.lineA ? "node-arrow active" : "node-arrow"} />}
          </div>
        ))}
      </section>
    </div>
  );
}
