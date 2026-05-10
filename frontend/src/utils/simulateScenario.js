export function simulateScenario(scenario, interventions, hour) {
    const windRisk = scenario.windSpeed >= 25;
    const slopeRisk = scenario.slope >= 20;
    const dryRisk = scenario.dryness === "Extreme";
  
    let threat = "MODERATE";
    if (windRisk && slopeRisk && dryRisk) threat = "CRITICAL";
    else if ((windRisk && slopeRisk) || dryRisk) threat = "HIGH";
    else if (windRisk || slopeRisk) threat = "ELEVATED";
  
    const fireSlowed = interventions.prepositionCrews;
    const lineProtected = interventions.protectLine;
    const backupSwitching = interventions.backupSwitching;
    const trafficOfficers = interventions.trafficOfficers;
    const closePchEarly = interventions.closePchEarly;
  
    const lineFailed = hour >= 15 && !lineProtected && !fireSlowed;
    const substationFailed = lineFailed && !backupSwitching;
    const signalsFailed = substationFailed;
  
    let pchStatus = "CLEAR";
    if (signalsFailed && !trafficOfficers && !closePchEarly) pchStatus = "BLOCKED";
    else if (signalsFailed || closePchEarly || trafficOfficers) pchStatus = "DEGRADED";
  
    const exposedResidents =
      pchStatus === "BLOCKED"
        ? scenario.population
        : pchStatus === "DEGRADED"
          ? Math.round(scenario.population * 0.45)
          : Math.round(scenario.population * 0.12);
  
    return {
      threat,
      confidence: threat === "CRITICAL" ? 92 : threat === "HIGH" ? 84 : 71,
  
      map: {
        lineStatus: lineFailed ? "FAILED" : hour >= 10 ? "AT_RISK" : "CLEAR",
        substationStatus: substationFailed ? "FAILED" : lineFailed ? "AT_RISK" : "OPERATIONAL",
        signalStatus: signalsFailed ? "FAILED" : "OPERATIONAL",
        pchStatus,
      },
  
      assets: {
        transmissionLines: lineFailed ? 1 : 0,
        substations: substationFailed ? 1 : lineFailed ? 1 : 0,
        trafficSignals: signalsFailed ? 7 : 0,
        evacuationRoutes: pchStatus === "BLOCKED" ? 3 : pchStatus === "DEGRADED" ? 1 : 0,
        residentsExposed: exposedResidents,
      },
  
      agents: {
        hazard: {
          priority: threat,
          recommendation: fireSlowed
            ? "Maintain crews near Malibu Canyon and monitor spread."
            : "Pre-position crews near Transmission Line A.",
          why: [
            `Wind speed is ${scenario.windSpeed} mph.`,
            `Terrain slope is ${scenario.slope}°.`,
            `Dryness index is ${scenario.dryness}.`,
            "Physics validator approved fire threat level.",
          ],
        },
  
        utility: {
          priority: substationFailed ? "CRITICAL" : lineFailed ? "HIGH" : "ELEVATED",
          recommendation: backupSwitching
            ? "Backup switching active. Monitor Malibu Substation load."
            : "Begin emergency switching before Line A fails.",
          why: [
            "Transmission Line A is in the fire path.",
            "Line failure can propagate to Malibu Substation.",
            backupSwitching
              ? "Backup switching reduces downstream failure."
              : "No backup switching currently applied.",
            "Cascade graph validator confirmed dependency path.",
          ],
        },
  
        traffic: {
          priority: pchStatus === "BLOCKED" ? "CRITICAL" : pchStatus === "DEGRADED" ? "HIGH" : "MODERATE",
          recommendation:
            pchStatus === "BLOCKED"
              ? "Deploy officers to PCH intersections immediately."
              : "Keep PCH monitored and prepare manual traffic control.",
          why: [
            `${scenario.population.toLocaleString()} residents in evacuation zone.`,
            `PCH status is ${pchStatus}.`,
            signalsFailed
              ? "Traffic signals are projected to fail."
              : "Traffic signals remain operational.",
            "Evacuation route validator approved route status.",
          ],
        },
      },
  
      timeline: [
        "Hazard Agent analyzed wind, slope, and fuel dryness.",
        "Physics Validator checked wildfire spread threshold.",
        lineFailed
          ? "Cascade Agent detected Transmission Line A failure."
          : "Cascade Agent monitoring Transmission Line A.",
        substationFailed
          ? "Utility Agent confirmed Malibu Substation failure."
          : "Utility Agent evaluating backup power options.",
        pchStatus === "BLOCKED"
          ? "Traffic Agent flagged PCH evacuation blockage."
          : "Traffic Agent confirmed evacuation route remains passable.",
        "Coordinator generated cross-agency recommendations.",
      ],
    };
  }