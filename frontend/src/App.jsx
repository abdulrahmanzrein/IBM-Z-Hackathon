import { useMemo, useState, useEffect } from "react";
import "./App.css";
import L from "leaflet";
import {
  MapContainer, TileLayer, Polygon, Polyline,
  Marker, Tooltip,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Flame, Zap, TrafficCone, CheckCircle, XCircle } from "lucide-react";

const BASE_URL = "http://localhost:8000";
const steps = [0, 15, 30];

const scenarioByHour = {
  0:  { label:"T+0",  title:"Ignition",        fireLevel:"ELEVATED", power:"OPERATIONAL", substation:"OPERATIONAL", signals:"OPERATIONAL", road:"CLEAR" },
  15: { label:"T+15", title:"Line A Failure",   fireLevel:"CRITICAL",  power:"FAILED",      substation:"FAILED",      signals:"FAILED",      road:"DEGRADED" },
  30: { label:"T+30", title:"Cascade Complete", fireLevel:"CRITICAL",  power:"FAILED",      substation:"FAILED",      signals:"FAILED",      road:"BLOCKED" },
};

const fallbackAgency = {
  0:  [{ agency:"Fire IC", level:"ELEVATED", action:"Monitor spread near transmission corridor.", note:"Suppression assets staged." },
       { agency:"Utility", level:"NORMAL",   action:"Grid stable. Prepare contingency switching.", note:"Substation B available." },
       { agency:"Traffic", level:"NORMAL",   action:"Evacuation routes open.", note:"PCH operating normally." }],
  15: [{ agency:"Fire IC", level:"CRITICAL", action:"Protect Line A. Redirect suppression assets.", note:"Fire perimeter crossed corridor." },
       { agency:"Utility", level:"CRITICAL", action:"Switch load from Malibu Substation immediately.", note:"Downstream grid failure." },
       { agency:"Traffic", level:"HIGH",     action:"Prepare officers for signal outage on PCH.", note:"Signals expected to fail." }],
  30: [{ agency:"Fire IC", level:"CRITICAL", action:"Protect evacuation corridor.", note:"Debris-flow risk HIGH above Malibu." },
       { agency:"Utility", level:"FAILED",   action:"Substation offline. Begin backup restoration.", note:"Line A + Substation failed." },
       { agency:"Traffic", level:"CRITICAL", action:"Manual control on PCH. Blockage active.", note:"Road status BLOCKED." }],
};

const fallbackValidator = {
  0:  [{ type:"valid",  title:"Physics computed", text:"Rothermel initialized. Infrastructure graph operational." }],
  15: [{ type:"reject", title:"Agent rejected",   text:"Debris agent output LOW. USGS M1 calculates P=0.71 HIGH. Forced replan." },
       { type:"valid",  title:"Agent validated",  text:"Debris flow corrected to HIGH. Agencies updated." }],
  30: [{ type:"reject", title:"Agent rejected",   text:"Debris agent output LOW. USGS M1 calculates P=0.71 HIGH. Forced replan." },
       { type:"valid",  title:"Agent validated",  text:"Debris flow corrected to HIGH. Agencies updated." }],
};

const GEOJSON_FILES = { 0: "/geojson/palisades_T0.geojson", 15: "/geojson/palisades_T15.geojson", 30: "/geojson/palisades_T30.geojson" };

// All coordinates from infrastructure.json — converted from [lon,lat] to Leaflet [lat,lon]
const powerLine           = [[34.0430,-118.7298],[34.0320,-118.7150],[34.0210,-118.6980]];
const cascadeToSubstation = [[34.0210,-118.6980],[34.0195,-118.6950]];
const cascadeToSignal1    = [[34.0195,-118.6950],[34.0368,-118.6814]];
const cascadeToSignal2    = [[34.0195,-118.6950],[34.0412,-118.7023]];
const pchRoad             = [[34.0280,-118.6500],[34.0368,-118.6814],[34.0412,-118.7023],[34.0490,-118.7500],[34.0560,-118.8200]];
const debrisZone          = [[34.086,-118.54],[34.098,-118.515],[34.083,-118.49],[34.066,-118.505]];
const trafficSignals      = [[34.0368,-118.6814],[34.0412,-118.7023]];

function lc(level) {
  if (!level) return "green";
  const l = level.toUpperCase();
  if (l==="OPERATIONAL"||l==="CLEAR"||l==="NORMAL") return "green";
  if (l==="ELEVATED"||l==="HIGH"||l==="DEGRADED"||l==="AT_RISK") return "orange";
  return "red";
}

function parseAgencies(apiData) {
  const agencies = apiData?.agents?.coordinator?.agencies;
  if (!agencies) return null;
  const map = { fire_incident_command:"Fire IC", utility_operator:"Utility", traffic_management:"Traffic" };
  return Object.entries(agencies).map(([key, val]) => {
    const text = (val.notifications||[]).join(" ").toUpperCase();
    const level = text.includes("CRITICAL")||text.includes("FAILED")||text.includes("BLOCKED") ? "CRITICAL"
      : text.includes("HIGH")||text.includes("DEGRADED") ? "HIGH"
      : text.includes("ELEVATED") ? "ELEVATED" : "NORMAL";
    return { agency: map[key]||key, level, action: val.recommendation, note: (val.notifications||[]).join(" · ") };
  });
}

function parseEvents(apiData) {
  if (!apiData) return null;
  return apiData.events
    .filter(e => e.type==="agent_rejected"||e.type==="agent_validated")
    .map(e => ({
      type: e.type==="agent_rejected" ? "reject" : "valid",
      title: e.type==="agent_rejected" ? "Agent rejected" : "Agent validated",
      text: e.type==="agent_rejected" ? e.violation : `${e.agent} approved.`,
    }));
}

export default function App() {
  const [hour, setHour]               = useState(0);
  const [apiData, setApiData]         = useState(null);
  const [loading, setLoading]         = useState(false);
  const [fireGeoJSON, setFireGeoJSON] = useState(null);
  const [osmData, setOsmData]         = useState(null);

  useEffect(() => {
    fetch("/osm_map.json").then(r => r.json()).then(setOsmData).catch(() => {});
  }, []);

  useEffect(() => {
    setFireGeoJSON(null);
    fetch(GEOJSON_FILES[hour])
      .then(r => r.json())
      .then(data => {
        try {
          const feature = data.features[0];
          const geom = feature.geometry;
          const ring = geom.type === "Polygon"
            ? geom.coordinates[0]
            : geom.coordinates[0][0];
          setFireGeoJSON(ring.map(([lon, lat]) => [lat, lon]));
        } catch { setFireGeoJSON(null); }
      })
      .catch(() => {});
  }, [hour]);

  const state = scenarioByHour[hour];

  const colors = useMemo(() => {
    const c = apiData?.cascade_status;
    const r = apiData?.evacuation_routes;
    return {
      power:      c ? (c.transmission_line_A==="FAILED" ? "#ef4444":"#22c55e") : (hour>=15?"#ef4444":"#22c55e"),
      substation: c ? (c.substation_malibu  ==="FAILED" ? "#ef4444":"#22c55e") : (hour>=15?"#ef4444":"#22c55e"),
      signals:    c ? (c.signal_PCH_1       ==="FAILED" ? "#ef4444":"#22c55e") : (hour>=15?"#ef4444":"#22c55e"),
      road: r ? (r.road_PCH==="BLOCKED"?"#ef4444":r.road_PCH==="DEGRADED"?"#f97316":"#22c55e")
              : (hour>=30?"#ef4444":hour>=15?"#f97316":"#22c55e"),
    };
  }, [hour, apiData]);

  const powerFailed   = colors.power==="#ef4444";
  const showDebris    = apiData ? apiData.physics?.debris_threat==="HIGH" : hour>=30;
  const fireLevel     = apiData?.physics?.threat_level || state.fireLevel;
  const utilityStatus = apiData?.cascade_status?.substation_malibu || state.substation;
  const routeStatus   = apiData?.evacuation_routes?.road_PCH || state.road;
  const validatorEvts = parseEvents(apiData)   || fallbackValidator[hour];
  const agencyActions = parseAgencies(apiData) || fallbackAgency[hour];

  const dispatch = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BASE_URL}/dispatch/wildfire/1?timestep=${hour}`, { method:"POST" });
      if (r.ok) setApiData(await r.json());
    } finally { setLoading(false); }
  };

  return (
    <div className="shell">
      <MapContainer center={[34.04,-118.68]} zoom={13} zoomControl={false} className="map">
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {fireGeoJSON && (
          <Polygon positions={fireGeoJSON}
            pathOptions={{ color:"#dc2626", fillColor:"#f97316", fillOpacity:0.35, weight:2 }} />
        )}

        {/* Real PCH road from OSM */}
        {osmData?.pch_segments?.map((seg, i) => (
          <Polyline key={i} positions={seg}
            pathOptions={{color:"#334155", weight:10, opacity:1}} />
        ))}
        {osmData?.pch_segments?.map((seg, i) => (
          <Polyline key={`pch-${i}`} positions={seg}
            pathOptions={{color:colors.road, weight:6, opacity:0.9}} />
        ))}

        {/* Real background power lines from OSM (subtle) */}
        {osmData?.all_power_lines?.map((pl, i) => (
          <Polyline key={`pl-${i}`} positions={pl.coordinates}
            pathOptions={{color:"#78716c", weight:1, opacity:0.4, dashArray:"6 4"}} />
        ))}

        {/* Transmission Line A — highlighted */}
        {osmData?.transmission_line_A && (
          <Polyline positions={osmData.transmission_line_A.coordinates}
            pathOptions={{color: powerFailed ? "#ef4444" : "#fbbf24", weight:4, dashArray:"12 6", opacity:1}}>
            <Tooltip sticky>Transmission Line A · {apiData?.cascade_status?.transmission_line_A||state.power}</Tooltip>
          </Polyline>
        )}

        {/* Substation marker */}
        <Marker position={[34.055,-118.695]} icon={L.divIcon({
          className: "",
          html: `<div style="width:28px;height:28px;background:${colors.substation};border:2px solid #0f172a;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.6);">⚡</div>`,
          iconSize: [28,28], iconAnchor: [14,14],
        })}>
          <Tooltip>Malibu Substation · {utilityStatus}</Tooltip>
        </Marker>

        {/* Real PCH traffic signals from OSM */}
        {osmData?.pch_signals?.map((s, i) => (
          <Marker key={`sig-${i}`} position={[s.lat, s.lon]} icon={L.divIcon({
            className: "",
            html: `<div style="width:10px;height:10px;background:${colors.signals};border:1.5px solid #0f172a;border-radius:2px;box-shadow:0 1px 3px rgba(0,0,0,0.5);"></div>`,
            iconSize: [10,10], iconAnchor: [5,5],
          })}>
            <Tooltip>PCH Signal · {state.signals}</Tooltip>
          </Marker>
        ))}

        {showDebris && (
          <Polygon positions={debrisZone} pathOptions={{color:"#f97316",fillColor:"#f97316",fillOpacity:0.22,weight:2}}>
            <Tooltip sticky>Debris flow zone · HIGH</Tooltip>
          </Polygon>
        )}
      </MapContainer>

      {/* ── TOP LEFT: Title + Utility + Dispatch stacked ── */}
      <div className="ov ov-tl">
        <div className="card title-card">
          <p className="eyebrow">StormOS</p>
          <p className="title-main">Wildfire Cascade<br/>Incident Commander</p>
          <p className="title-sub">{state.label} · {state.title}</p>
          {apiData && <span className="live">● LIVE</span>}
        </div>
        <div className="card" style={{marginTop:6}}>
          <div className="card-row"><Zap size={12}/><span className="card-label">Malibu Substation</span></div>
          <span className={`badge badge-${lc(utilityStatus)}`}>{utilityStatus}</span>
        </div>
        <div className="card" style={{marginTop:6}}>
          <div className="card-row"><TrafficCone size={12}/><span className="card-label">PCH Route</span></div>
          <span className={`badge badge-${lc(routeStatus)}`}>{routeStatus}</span>
        </div>
        <button className="btn" onClick={dispatch} disabled={loading}>
          {loading ? "Dispatching…" : "Dispatch"}
        </button>
      </div>

      {/* ── TOP CENTER: Fire Threat ── */}
      <div className="ov ov-tc">
        <div className={`threat threat-${lc(fireLevel)}`}>
          <Flame size={12}/><span>Fire Threat: {fireLevel}</span>
        </div>
      </div>

      {/* ── RIGHT: Physics Validator ── */}
      <div className="ov ov-mr">
        <div className="card panel-card">
          <p className="panel-title">Physics Validator {apiData && <span className="live">● LIVE</span>}</p>
          <div className="feed">
            {validatorEvts.map((ev,i) => (
              <div key={i} className={`feed-item feed-${ev.type}`}>
                <div className="feed-top">
                  {ev.type==="reject"
                    ? <XCircle size={12} color="#ef4444"/>
                    : <CheckCircle size={12} color="#22c55e"/>}
                  <strong>{ev.title}</strong>
                </div>
                <p>{ev.text}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="card panel-card" style={{marginTop:8}}>
          <p className="panel-title">Agency Actions {apiData && <span className="live">● LIVE</span>}</p>
          <div className="feed">
            {agencyActions.map(item => (
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
        </div>
      </div>

      {/* ── BOTTOM LEFT: Legend ── */}
      <div className="ov ov-bl">
        <div className="card legend">
          <span className="leg-row"><i className="dot" style={{background:"#22c55e"}}/> Operational</span>
          <span className="leg-row"><i className="dot" style={{background:"#f97316"}}/> At Risk</span>
          <span className="leg-row"><i className="dot" style={{background:"#ef4444"}}/> Failed</span>
        </div>
      </div>

      {/* ── BOTTOM CENTER: Slider ── */}
      <div className="ov ov-bc">
        <div className="card slider-card">
          <div className="slider-labels"><span>T+0</span><span>T+15</span><span>T+30</span></div>
          <input type="range" min="0" max="2" step="1" className="slider"
            value={steps.indexOf(hour)}
            onChange={e => { setHour(steps[Number(e.target.value)]); setApiData(null); }}
          />
        </div>
      </div>
    </div>
  );
}
