import { useState, useEffect, useCallback, useRef } from "react";

/* ─────────────────────────────────────────────
   DESIGN SYSTEM
   Palette: crisp white + deep navy + vivid accents
   Typography: Playfair Display (headings) + DM Sans (body)
───────────────────────────────────────────── */
const C = {
  bg: "#F7F8FC",
  surface: "#FFFFFF",
  navy: "#0F1B35",
  navyMid: "#1E3A5F",
  slate: "#4A5568",
  muted: "#718096",
  border: "#E2E8F0",
  borderDark: "#CBD5E0",
  green: "#1A8A5A",
  greenBg: "#EBF8F1",
  greenBorder: "#A8D5BE",
  amber: "#B45309",
  amberBg: "#FFFBEB",
  amberBorder: "#F6D860",
  red: "#B91C1C",
  redBg: "#FEF2F2",
  redBorder: "#FECACA",
  blue: "#1D4ED8",
  blueBg: "#EFF6FF",
  blueBorder: "#BFDBFE",
  accent: "#2563EB",
  accentLight: "#DBEAFE",
};

const PHASE_META = {
  briefing: { color: C.blue,  bg: C.blueBg,  border: C.blueBorder,  label: "BRIEFING"    },
  early:    { color: C.green, bg: C.greenBg, border: C.greenBorder, label: "EARLY PHASE" },
  mid:      { color: C.amber, bg: C.amberBg, border: C.amberBorder, label: "MID PHASE"   },
  late:     { color: C.red,   bg: C.redBg,   border: C.redBorder,   label: "LATE PHASE"  },
};

const ROUNDS_META = [
  { round: 0, title: "Initial Briefing",            subtitle: "Study the situation carefully before any decisions.",        phase: "briefing" },
  { round: 1, title: "The First Surge",              subtitle: "CS-101 & CS-102 confirmed. DS-301 propulsion window opens.", phase: "early"    },
  { round: 2, title: "Capacity Crunch Begins",       subtitle: "CS-102 avionics defect detected. Hiring decision point.",   phase: "early"    },
  { round: 3, title: "The Government Audit",         subtitle: "GR-201 compliance check. DS-301 status revealed.",          phase: "mid"      },
  { round: 4, title: "Peak Concurrency Crisis",      subtitle: "Three missions active simultaneously. Maximum conflict.",    phase: "mid"      },
  { round: 5, title: "Delayed Consequences Arrive",  subtitle: "GR-201 launches. DS-301 readiness determined.",             phase: "mid"      },
  { round: 6, title: "Deep-Space Launch & Recovery", subtitle: "DS-301 launches. CS-105 bonus mission revealed.",           phase: "late"     },
  { round: 7, title: "Consolidation & Efficiency",   subtitle: "Lean benefits active. CS-103/104 final assembly.",          phase: "late"     },
  { round: 8, title: "Final Reckoning",              subtitle: "Last launches. All KPIs finalized. Simulation ends.",       phase: "late"     },
];

const MISSIONS_INFO = {
  "CS-101": { type: "CS", label: "Commercial Satellite", complexity: "Medium",    hours: 80,  quality: "Standard"       },
  "CS-102": { type: "CS", label: "Commercial Satellite", complexity: "Medium",    hours: 80,  quality: "Standard"       },
  "GR-201": { type: "GR", label: "Government Research",  complexity: "High",      hours: 100, quality: "High"           },
  "DS-301": { type: "DS", label: "Deep-Space Cargo",     complexity: "Very High", hours: 130, quality: "Critical"       },
  "CS-103": { type: "CS", label: "Commercial Satellite", complexity: "Medium",    hours: 80,  quality: "Standard"       },
  "CS-104": { type: "CS", label: "Commercial Satellite", complexity: "Medium",    hours: 80,  quality: "Standard"       },
  "CS-105": { type: "CS", label: "BONUS Mission",        complexity: "Medium",    hours: 80,  quality: "Standard"       },
};

const TYPE_COLORS = {
  CS: { text: "#1D4ED8", bg: "#DBEAFE", border: "#93C5FD" },
  GR: { text: "#92400E", bg: "#FEF3C7", border: "#FCD34D" },
  DS: { text: "#991B1B", bg: "#FEE2E2", border: "#FCA5A5" },
};

/* ─── SIMULATION ENGINE ─── */
const INIT = {
  round: 0,
  phase: "landing",
  engineerCapacity: 240,
  workforce: 20,
  hiredRound: null,
  cashBudget: 18,
  reserve: 12,
  reputation: 75,
  fatigueIndex: 0,
  totalSpent: 0,
  missions: {
    "CS-101": { status: "pending", targetRound: 2, launched: false, success: null },
    "CS-102": { status: "pending", targetRound: 2, launched: false, success: null },
    "GR-201": { status: "pending", targetRound: 4, launched: false, success: null, accepted: false },
    "DS-301": { status: "pending", targetRound: 6, launched: false, success: null },
    "CS-103": { status: "future",  targetRound: 7, launched: false, success: null, accepted: false },
    "CS-104": { status: "future",  targetRound: 8, launched: false, success: null },
    "CS-105": { status: "future",  targetRound: 8, launched: false, success: null, accepted: false },
  },
  inventory: {
    propulsion: { ordered: false, orderRound: null, arrivalRound: null },
    tiles:      { ordered: false, orderRound: null, arrivalRound: null },
    telemetry:  { ordered: false, orderRound: null, arrivalRound: null },
  },
  quality: { preventionSpend: 0, appraisalSpend: 0, internalFailure: 0, externalFailure: 0 },
  lean: [],
  tierBUsed: false,
  gr201Accepted: false,
  cs103Accel: false,
  cs105Accepted: false,
  ds301PropOrdered: false,
  ds301TelOrdered: false,
  kpis: { onTime: 100, launchSuccess: 100, budgetUtil: 0, capUtil: 0, inventoryTurn: 4.2, wasteIndex: 35, failureProb: 5 },
  repHistory: [75],
  eventLog: [],
  finalScore: null,
};

function runRound(state, dec) {
  const s = JSON.parse(JSON.stringify(state));
  const round = s.round + 1;
  s.round = round;
  const evts = [];
  let repDelta = 0;
  let spent = 2.0;

  const {
    inspHours = 20, prevBudget = 15, overtime = 0,
    allocCS = 80, allocGR = 0, allocDS = 0,
    orderProp = false, orderTiles = false, orderTel = false,
    acceptGR = false, acceptCS103 = false, acceptCS105 = false,
    useB = false, hire = false, lean = null,
    scrapTiles = true, rest = false, liquidate = false,
  } = dec;

  if (useB) s.tierBUsed = true;
  if (round === 1 && acceptGR)    { s.gr201Accepted = true; s.missions["GR-201"].accepted = true; }
  if (round === 4 && acceptCS103) { s.cs103Accel    = true; s.missions["CS-103"].accepted = true; }
  if (round === 6 && acceptCS105) { s.cs105Accepted = true; s.missions["CS-105"].accepted = true; }

  if (hire && !s.hiredRound) {
    s.hiredRound = round; s.reserve -= 0.2;
    evts.push({ type: "info", msg: "New engineers hired. Available Round " + (round + 2) + ". Cost: $200K." });
  }
  if (s.hiredRound && round >= s.hiredRound + 2 && s.workforce === 20) {
    s.workforce = 23; s.engineerCapacity = 276;
    evts.push({ type: "success", msg: "New engineers onboarded! Capacity: 276 hrs/month." });
  }

  if (round === 1 && orderProp) {
    s.ds301PropOrdered = true;
    s.inventory.propulsion = { ordered: true, orderRound: 1, arrivalRound: 3 };
    evts.push({ type: "info", msg: "Propulsion Module ordered. Arrives Round 3." });
  }
  if (round <= 2 && orderTiles) {
    s.inventory.tiles = { ordered: true, orderRound: round, arrivalRound: round + 1 };
    evts.push({ type: "info", msg: "Thermal Tiles ordered. Arrives Round " + (round + 1) + "." });
  }
  if (round === 3 && orderTel) {
    s.ds301TelOrdered = true;
    s.inventory.telemetry = { ordered: true, orderRound: 3, arrivalRound: 4 };
    evts.push({ type: "info", msg: "Telemetry Array ordered. Arrives Round 4." });
  }

  if (lean && !s.lean.find(l => l.type === lean)) {
    s.lean.push({ type: lean, startRound: round, benefitRound: round + 2 });
    s.reserve -= 0.3;
    evts.push({ type: "info", msg: "Lean '" + lean + "' started. Benefits in Round " + (round + 2) + "." });
  }
  const activeLean = s.lean.filter(l => l.benefitRound <= round).length;
  const leanBonus = activeLean * 8;

  if (overtime > 15) s.fatigueIndex = Math.min(100, s.fatigueIndex + Math.round((overtime - 15) * 1.5));
  if (rest) { s.fatigueIndex = Math.max(0, s.fatigueIndex - 30); evts.push({ type: "info", msg: "Rest applied. Fatigue −30." }); }

  const prevCost = prevBudget * 0.02;
  const apprCost = inspHours * 0.01;
  const otHours  = Math.floor(s.engineerCapacity * overtime / 100);
  spent += prevCost + apprCost + otHours * 0.015;

  s.quality.preventionSpend += prevCost;
  s.quality.appraisalSpend  += apprCost;

  const cumPrevRatio = (s.quality.preventionSpend + s.quality.appraisalSpend) > 0
    ? (s.quality.preventionSpend / (s.quality.preventionSpend + s.quality.appraisalSpend)) * 100 : 0;

  const effectiveCap = s.engineerCapacity + otHours;
  const totalAlloc = allocCS + allocGR + allocDS;
  const capUtil = Math.min(110, Math.round((totalAlloc / effectiveCap) * 100));

  /* Round Events */
  if (round === 1) {
    evts.push({ type: "warning", msg: "Supply disruption: Airframe delayed 1 week." });
    evts.push({ type: "warning", msg: "Engineer on approved leave for 2 weeks." });
    if (!orderProp) evts.push({ type: "danger", msg: "⚠ Propulsion NOT ordered — DS-301 delivery at risk!" });
    const cs101ok = inspHours >= 20 && capUtil < 95;
    s.missions["CS-101"].launched = true;
    s.missions["CS-101"].success  = cs101ok;
    s.missions["CS-101"].status   = cs101ok ? "success" : "failed";
    repDelta += cs101ok ? 5 : -5;
    evts.push(cs101ok
      ? { type: "success", msg: "CS-101 launched on schedule. +5 Reputation." }
      : { type: "danger",  msg: "CS-101 missed window! −5 Reputation." });
  }
  if (round === 2) {
    evts.push({ type: "warning", msg: "CS-102 avionics defect — rework: 30 engineer hours." });
    const rwork = useB ? 0.5 : 0.8;
    spent += rwork; s.quality.internalFailure += rwork;
    if (useB) evts.push({ type: "warning", msg: "Tier B used for rework. 20% defect rate seeded." });
    const cs102ok = Math.random() > (useB ? 0.25 : 0.12);
    s.missions["CS-102"].launched = true;
    s.missions["CS-102"].success  = cs102ok;
    s.missions["CS-102"].status   = cs102ok ? "success" : "failed";
    repDelta += cs102ok ? 3 : -8;
    if (!cs102ok) { s.quality.externalFailure += 2.0; spent += 2.0; }
    evts.push(cs102ok
      ? { type: "success", msg: "CS-102 launched after rework. +3 Reputation." }
      : { type: "danger",  msg: "CS-102 launch failure! +$2M external cost. −8 Reputation." });
  }
  if (round === 3) {
    if (s.gr201Accepted) {
      if (cumPrevRatio < 12) {
        evts.push({ type: "danger", msg: "AUDIT FAILED — Prevention <12%. GR-201 on hold. −8 Rep." });
        repDelta -= 8; spent += 1.5;
      } else {
        evts.push({ type: "success", msg: "Government audit PASSED. GR-201 cleared. +2 Rep." });
        repDelta += 2;
      }
    }
    if (s.ds301PropOrdered) evts.push({ type: "success", msg: "Propulsion Module arrived on schedule." });
    else evts.push({ type: "danger", msg: "⚠ Propulsion still 4 wks out — expedite at $1.5M." });
    evts.push({ type: "warning", msg: "Senior engineer sick 2 weeks — −15% specialized capacity." });
    s.kpis.wasteIndex = Math.max(12, 40 - leanBonus - (inspHours > 25 ? 4 : 0) + (s.fatigueIndex > 30 ? 5 : 0));
    evts.push({ type: "info", msg: "Waste Index: " + s.kpis.wasteIndex + "% (benchmark: <25%)" });
    if (!orderTel) evts.push({ type: "warning", msg: "⚠ Telemetry not ordered — DS-301 delay risk rising." });
  }
  if (round === 4) {
    if (s.inventory.tiles.ordered) {
      evts.push({ type: "danger", msg: "Supplier: 15% defect rate in Thermal Tile batch!" });
      if (scrapTiles) { spent += 0.8; evts.push({ type: "warning", msg: "Tiles scrapped & re-ordered. +$0.8M, 3-wk delay." }); }
      else { s.kpis.failureProb += 15; evts.push({ type: "warning", msg: "Defective tiles kept — DS-301 failure +15%." }); }
    }
    if (s.cs103Accel) {
      if (capUtil > 90) { repDelta -= 3; s.quality.internalFailure += 1.0; evts.push({ type: "danger", msg: "⚠ CS-103 accepted but overloaded! GR-201 at risk." }); }
      else { s.reserve += 2.0; evts.push({ type: "success", msg: "CS-103 acceleration — +$2M revenue." }); }
    }
    if (capUtil > 95) {
      evts.push({ type: "danger", msg: "OVERLOAD! Error rate doubled for one mission." });
      s.kpis.failureProb += 10; s.fatigueIndex = Math.min(100, s.fatigueIndex + 15);
    }
  }
  if (round === 5) {
    if (s.gr201Accepted) {
      const gr201ok = s.quality.preventionSpend >= 2.5 && cumPrevRatio >= 12 && !s.tierBUsed;
      s.missions["GR-201"].launched = true;
      s.missions["GR-201"].success  = gr201ok;
      s.missions["GR-201"].status   = gr201ok ? "success" : "anomaly";
      repDelta += gr201ok ? 10 : -6;
      if (!gr201ok) { s.quality.externalFailure += 3.0; spent += 3.0; }
      evts.push(gr201ok
        ? { type: "success", msg: "GR-201 LAUNCH SUCCESS! Prevention investment paid off. +10 Rep." }
        : { type: "danger",  msg: "GR-201 anomaly — in-flight correction. +$3M cost. −6 Rep." });
    }
    if (s.fatigueIndex > 40) {
      evts.push({ type: "danger", msg: "Fatigue event: DS-301 documentation error. Rework +$0.5M." });
      spent += 0.5; s.quality.internalFailure += 0.5;
    }
    const ds301ready = s.ds301PropOrdered && s.ds301TelOrdered && s.inventory.tiles.ordered;
    evts.push(ds301ready
      ? { type: "success", msg: "DS-301 components on track for Round 6 launch." }
      : { type: "danger",  msg: "⚠ DS-301 component gaps — launch window at risk." });
  }
  if (round === 6) {
    const factors = [s.ds301PropOrdered, s.ds301TelOrdered, s.inventory.tiles.ordered, s.fatigueIndex < 50, cumPrevRatio >= 12];
    const score   = factors.filter(Boolean).length / 5 - (s.tierBUsed ? 0.25 : 0);
    const ds301ok = Math.random() < (score + 0.15);
    s.missions["DS-301"].launched = true;
    s.missions["DS-301"].success  = ds301ok;
    s.missions["DS-301"].status   = ds301ok ? "success" : "failed";
    repDelta += ds301ok ? 15 : -20;
    if (!ds301ok) { s.quality.externalFailure += 5.0; spent += 5.0; }
    evts.push(ds301ok
      ? { type: "success", msg: "DS-301 DEEP-SPACE SUCCESS! 5 years of planning realized. +15 Rep." }
      : { type: "danger",  msg: "DS-301 LAUNCH FAILURE — critical event. −20 Rep. +$5M external." });
    if (s.tierBUsed) { spent += 1.0; evts.push({ type: "danger", msg: "Tier B Avionics RECALL. +$1M unplanned cost." }); }
    evts.push({ type: "info", msg: "BONUS MISSION CS-105 offered — $4M net if delivered Round 8." });
    if (s.cs105Accepted) {
      if (s.reputation + repDelta > 60 && capUtil < 90) { s.reserve += 4.0; evts.push({ type: "success", msg: "CS-105 accepted — +$4M revenue potential." }); }
      else evts.push({ type: "warning", msg: "CS-105 accepted but constraints may limit bonus." });
    }
  }
  if (round === 7) {
    if (s.missions["CS-103"].accepted) {
      const cs103ok = Math.random() > 0.15;
      s.missions["CS-103"].launched = true;
      s.missions["CS-103"].success  = cs103ok;
      s.missions["CS-103"].status   = cs103ok ? "success" : "failed";
      repDelta += cs103ok ? 4 : -5;
      evts.push(cs103ok ? { type: "success", msg: "CS-103 launched. +4 Rep." } : { type: "danger", msg: "CS-103 anomaly. −5 Rep." });
    }
    const certHrs = s.quality.preventionSpend > 2.0 ? 2 : 15;
    evts.push({ type: "info", msg: "CS-104 quality cert: " + certHrs + " hrs" + (certHrs === 15 ? " (poor records — reconstruction needed)." : " (excellent records).") });
    if (liquidate) { s.reserve += 0.5; evts.push({ type: "info", msg: "Inventory liquidated. +$500K recovered." }); }
  }
  if (round === 8) {
    const cs104ok = Math.random() > 0.12;
    s.missions["CS-104"].launched = true; s.missions["CS-104"].success = cs104ok; s.missions["CS-104"].status = cs104ok ? "success" : "failed";
    repDelta += cs104ok ? 4 : -5;
    evts.push(cs104ok ? { type: "success", msg: "CS-104 launched. +4 Rep." } : { type: "danger", msg: "CS-104 failure. −5 Rep." });
    if (s.cs105Accepted) {
      const cs105ok = s.reputation > 65 && capUtil < 95;
      s.missions["CS-105"].launched = true; s.missions["CS-105"].success = cs105ok; s.missions["CS-105"].status = cs105ok ? "success" : "failed";
      repDelta += cs105ok ? 6 : -10;
      evts.push(cs105ok ? { type: "success", msg: "CS-105 BONUS launched! +6 Rep." } : { type: "danger", msg: "CS-105 failed. −10 Rep." });
    }
  }

  s.reputation = Math.max(0, Math.min(100, s.reputation + repDelta));
  s.repHistory.push(s.reputation);
  s.totalSpent += spent;
  s.reserve -= spent;

  const launched  = Object.values(s.missions).filter(m => m.launched);
  const successes = launched.filter(m => m.success === true);
  s.kpis.onTime        = launched.length ? Math.round(successes.length / launched.length * 100) : 100;
  s.kpis.launchSuccess = s.kpis.onTime;
  s.kpis.budgetUtil    = Math.min(120, Math.round(spent / s.cashBudget * 100));
  s.kpis.capUtil       = capUtil;
  s.kpis.inventoryTurn = 4.2;
  s.kpis.wasteIndex    = Math.max(10, (s.kpis.wasteIndex || 35) - leanBonus + (s.fatigueIndex > 30 ? 3 : 0));
  s.kpis.failureProb   = Math.max(0, Math.min(100, (s.kpis.failureProb || 5) + (s.tierBUsed ? 3 : 0) + (s.fatigueIndex > 40 ? 4 : 0) - (inspHours > 25 ? 2 : 0)));

  s.eventLog = [...s.eventLog, { round, events: evts }];

  if (round === 8) {
    const failCost = s.quality.internalFailure + s.quality.externalFailure;
    const coqScore = s.quality.preventionSpend > 0 ? Math.max(0, 100 - Math.round(failCost / (s.quality.preventionSpend + 0.1) * 100)) : 20;
    s.finalScore = Math.round(
      0.20 * s.kpis.onTime + 0.20 * s.kpis.launchSuccess +
      0.15 * Math.max(0, 100 - s.kpis.budgetUtil) + 0.20 * s.reputation +
      0.10 * Math.min(100, s.kpis.inventoryTurn * 12.5) + 0.15 * coqScore +
      (s.kpis.wasteIndex < 20 ? 5 : 0) + (successes.length < launched.length ? -10 : 0)
    );
    s.phase = "final";
  }

  return s;
}

/* ─── CSS INJECTION ─── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'DM Sans',sans-serif;background:#F7F8FC;}
input[type=range]{-webkit-appearance:none;width:100%;height:6px;border-radius:3px;outline:none;background:#E2E8F0;cursor:pointer;}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:50%;background:#2563EB;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,0.25);}
input[type=radio]{accent-color:#2563EB;width:16px;height:16px;cursor:pointer;}
@keyframes fadeUp{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}
@keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
@keyframes popIn{from{opacity:0;transform:scale(0.95);}to{opacity:1;transform:scale(1);}}
.fu{animation:fadeUp 0.45s ease both;}
.fu1{animation:fadeUp 0.45s 0.08s ease both;}
.fu2{animation:fadeUp 0.45s 0.16s ease both;}
.fu3{animation:fadeUp 0.45s 0.24s ease both;}
.fi{animation:fadeIn 0.3s ease both;}
.pop{animation:popIn 0.35s ease both;}
.lift{transition:transform 0.18s,box-shadow 0.18s;}
.lift:hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(15,27,53,0.12)!important;}
::-webkit-scrollbar{width:5px;}
::-webkit-scrollbar-thumb{background:#CBD5E0;border-radius:3px;}
`;

/* ─── PRIMITIVES ─── */
const Card = ({ children, style, cls = "" }) => (
  <div className={"lift " + cls} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, boxShadow: "0 2px 8px rgba(15,27,53,0.06)", ...style }}>
    {children}
  </div>
);

const SLabel = ({ children }) => (
  <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: 1.8, textTransform: "uppercase", fontFamily: "'DM Sans',sans-serif", marginBottom: 10 }}>{children}</p>
);

const Chip = ({ type }) => {
  const t = TYPE_COLORS[type] || TYPE_COLORS.CS;
  return <span style={{ fontSize: 10, fontWeight: 800, color: t.text, background: t.bg, border: `1px solid ${t.border}`, padding: "2px 7px", borderRadius: 4, letterSpacing: 0.5 }}>{type}</span>;
};

const Tag = ({ children, color, bg, border }) => (
  <span style={{ fontSize: 11, fontWeight: 600, color, background: bg, border: `1px solid ${border}`, padding: "3px 10px", borderRadius: 20, letterSpacing: 0.5 }}>{children}</span>
);

const KPIGauge = ({ label, value, unit = "%", color, sublabel, small = false }) => {
  const c = color || (value >= 80 ? C.green : value >= 60 ? C.amber : C.red);
  const pct = Math.min(100, Math.max(0, typeof value === "number" ? value : 0));
  return (
    <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, padding: small ? "14px 16px" : "18px 20px", boxShadow: "0 1px 4px rgba(15,27,53,0.04)" }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: small ? 24 : 30, fontWeight: 700, color: c, lineHeight: 1, fontFamily: "'DM Sans',sans-serif" }}>
        {typeof value === "number" ? (value % 1 === 0 ? value : value.toFixed(1)) : value}{unit}
      </p>
      <div style={{ marginTop: 8, height: 4, background: "#F1F5F9", borderRadius: 2 }}>
        <div style={{ width: pct + "%", height: "100%", background: c, borderRadius: 2, transition: "width 0.6s ease" }} />
      </div>
      {sublabel && <p style={{ marginTop: 4, fontSize: 11, color: C.muted }}>{sublabel}</p>}
    </div>
  );
};

const Toggle = ({ label, value, onChange, hint, danger }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "12px 0", borderBottom: "1px solid #F1F5F9" }}>
    <div style={{ flex: 1, marginRight: 16 }}>
      <p style={{ fontSize: 14, fontWeight: 500, color: danger && value ? C.red : C.navy, lineHeight: 1.4 }}>{label}</p>
      {hint && <p style={{ fontSize: 12, color: C.muted, marginTop: 3, lineHeight: 1.5 }}>{hint}</p>}
    </div>
    <button onClick={() => onChange(!value)} style={{
      width: 46, height: 26, borderRadius: 13, border: "none", cursor: "pointer", flexShrink: 0,
      background: value ? (danger ? C.red : C.accent) : "#CBD5E0",
      position: "relative", transition: "background 0.2s",
    }}>
      <div style={{ position: "absolute", width: 20, height: 20, borderRadius: "50%", background: "#fff", top: 3, left: value ? 23 : 3, transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }} />
    </button>
  </div>
);

const Slider = ({ label, value, onChange, min, max, step = 5, unit = "%", hint, warnAt }) => {
  const warn = warnAt !== undefined && value > warnAt;
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ padding: "12px 0", borderBottom: "1px solid #F1F5F9" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 500, color: C.navy }}>{label}</p>
          {hint && <p style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{hint}</p>}
        </div>
        <span style={{ fontSize: 18, fontWeight: 700, color: warn ? C.red : C.accent, minWidth: 64, textAlign: "right" }}>{value}{unit}</span>
      </div>
      <div style={{ position: "relative", height: 22, display: "flex", alignItems: "center" }}>
        <div style={{ position: "absolute", left: 0, right: 0, height: 6, background: "#E2E8F0", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ width: pct + "%", height: "100%", background: warn ? C.red : C.accent, transition: "width 0.1s" }} />
        </div>
        <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(+e.target.value)}
          style={{ position: "absolute", left: 0, right: 0, opacity: 0, height: 22, cursor: "pointer" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
        <span style={{ fontSize: 10, color: C.muted }}>{min}{unit}</span>
        <span style={{ fontSize: 10, color: C.muted }}>{max}{unit}</span>
      </div>
      {warn && <p style={{ marginTop: 4, fontSize: 11, color: C.red, fontWeight: 600 }}>⚠ Warning threshold exceeded</p>}
    </div>
  );
};

const EventBadge = ({ e }) => {
  const MAP = {
    success: { bg: C.greenBg, border: C.greenBorder, icon: "✓", col: C.green },
    danger:  { bg: C.redBg,   border: C.redBorder,   icon: "✗", col: C.red   },
    warning: { bg: C.amberBg, border: C.amberBorder, icon: "⚠", col: C.amber },
    info:    { bg: C.blueBg,  border: C.blueBorder,  icon: "ℹ", col: C.blue  },
  };
  const s = MAP[e.type] || MAP.info;
  return (
    <div style={{ display: "flex", gap: 10, background: s.bg, border: `1px solid ${s.border}`, borderRadius: 10, padding: "10px 14px", marginBottom: 8 }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: s.col, flexShrink: 0, marginTop: 1 }}>{s.icon}</span>
      <p style={{ fontSize: 13, color: C.navy, lineHeight: 1.65, fontWeight: 400 }}>{e.msg}</p>
    </div>
  );
};

/* ─── DECISION PANEL ─── */
function Decisions({ round, state, dec, setDec }) {
  const set = (k, v) => setDec(p => ({ ...p, [k]: v }));
  const common = <>
    <Slider label="Inspection Hours" value={dec.inspHours ?? 20} onChange={v => set("inspHours", v)} min={5} max={50} step={5} unit=" hrs" hint="More inspection = fewer launch defects" />
    <Slider label="Prevention Budget" value={dec.prevBudget ?? 15} onChange={v => set("prevBudget", v)} min={5} max={40} step={5} unit="%" hint="Audit threshold: 12%. Under-invest now = crisis later." warnAt={12} />
    <Slider label="Overtime Authorization" value={dec.overtime ?? 0} onChange={v => set("overtime", v)} min={0} max={40} step={5} unit="%" hint=">15% accumulates fatigue. >40% causes quality micro-failures." warnAt={15} />
    <Slider label="CS Mission Hours" value={dec.allocCS ?? 80} onChange={v => set("allocCS", v)} min={20} max={180} step={10} unit=" hrs" hint="Engineer hours for Commercial Satellite missions" />
  </>;

  if (round === 0) return (
    <div>
      <div style={{ background: C.blueBg, border: `1px solid ${C.blueBorder}`, borderRadius: 12, padding: 18, marginBottom: 4 }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: C.blue, marginBottom: 8 }}>📋 Round 0 — Briefing Only</p>
        <p style={{ fontSize: 13, color: C.navyMid, lineHeight: 1.75 }}>No decisions required. Use this round to study the starting conditions and plan your Round 1 strategy.</p>
      </div>
      {[
        ["🚀 DS-301 Propulsion: 8-week lead time", "Order in Round 1 — the only window for on-time delivery."],
        ["📋 GR-201 needs 30% more inspection hours", "Plan capacity before accepting the government contract."],
        ["💰 Tier B supplier: 25% cheaper, 20% defect rate", "Calculate expected cost of failures before choosing."],
        ["⚡ 240 engineer hours/month maximum", "Three concurrent missions will exceed this by Round 4."],
      ].map(([q, a]) => (
        <div key={q} style={{ display: "flex", gap: 14, padding: "12px 0", borderBottom: "1px solid #F1F5F9" }}>
          <div style={{ width: 24, height: 24, borderRadius: "50%", background: C.accentLight, color: C.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>?</div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>{q}</p>
            <p style={{ fontSize: 12, color: C.slate, marginTop: 3, lineHeight: 1.5 }}>{a}</p>
          </div>
        </div>
      ))}
    </div>
  );

  if (round === 1) return <div>{common}
    <Slider label="DS Pre-planning Hours" value={dec.allocDS ?? 0} onChange={v => set("allocDS", v)} min={0} max={80} step={10} unit=" hrs" hint="Early DS-301 engineering work" />
    <Toggle label="🚀 Order DS-301 Propulsion Module NOW" value={dec.orderProp ?? false} onChange={v => set("orderProp", v)} hint="8-week lead time — this is your only on-time window. Missing it is the #1 source of late-phase crisis." />
    <Toggle label="📋 Accept GR-201 Government Contract" value={dec.acceptGR ?? false} onChange={v => set("acceptGR", v)} hint="High margin but adds Round 3 audit load and 30% more inspection hours" />
    <Toggle label="💰 Use Tier B Avionics (25% cheaper)" value={dec.useB ?? false} onChange={v => set("useB", v)} hint="20% defect rate. Guaranteed recall event in Round 6 if used." danger />
  </div>;

  if (round === 2) return <div>{common}
    <Toggle label="👷 Hire Engineers ($200K, ready Round 4)" value={dec.hire ?? false} onChange={v => set("hire", v)} hint="2-round onboarding lag — plan for Round 4 peak concurrency" />
    <Toggle label="📦 Order Thermal Tiles (3-week lead)" value={dec.orderTiles ?? false} onChange={v => set("orderTiles", v)} hint="Order now to avoid Round 4 defect crisis with no buffer" />
    <Toggle label="💰 Use Tier B for CS-102 Rework" value={dec.useB ?? false} onChange={v => set("useB", v)} hint="Faster fix but compounds defect seeding for future rounds" danger />
  </div>;

  if (round === 3) return <div>{common}
    <Slider label="GR Mission Hours" value={dec.allocGR ?? 30} onChange={v => set("allocGR", v)} min={0} max={120} step={10} unit=" hrs" hint="Government missions need 30% more hours than CS" />
    <Toggle label="🔭 Order Telemetry Array (5-week lead)" value={dec.orderTel ?? false} onChange={v => set("orderTel", v)} hint="⚠ CRITICAL — last window for on-time DS-301. Missing this = guaranteed delay." danger />
    <Toggle label="📦 Order Thermal Tiles (if missed R2)" value={dec.orderTiles ?? false} onChange={v => set("orderTiles", v)} hint="Risky but recoverable if ordered this round" />
  </div>;

  if (round === 4) return <div>{common}
    <Slider label="GR Mission Hours" value={dec.allocGR ?? 60} onChange={v => set("allocGR", v)} min={20} max={130} step={10} unit=" hrs" hint="GR-201 requires maximum quality — do not cut" />
    <Slider label="DS Mission Hours" value={dec.allocDS ?? 60} onChange={v => set("allocDS", v)} min={20} max={130} step={10} unit=" hrs" hint="DS-301 mid-production — needs sustained allocation" />
    <Toggle label="⚡ Accept CS-103 Acceleration (+$2M bonus)" value={dec.acceptCS103 ?? false} onChange={v => set("acceptCS103", v)} hint="Requires 40 extra hours — model your capacity before accepting!" />
    <Toggle label="🗑️ Scrap Defective Thermal Tile Batch" value={dec.scrapTiles ?? true} onChange={v => set("scrapTiles", v)} hint="Safe choice. Keeping defective tiles adds +15% DS-301 failure probability." />
  </div>;

  if (round === 5) return <div>{common}
    <Slider label="DS Mission Hours" value={dec.allocDS ?? 80} onChange={v => set("allocDS", v)} min={20} max={150} step={10} unit=" hrs" hint="DS-301 ramp-up — critical path to Round 6 launch" />
    <Toggle label="😴 Mandatory Rest (−30 fatigue, −20 hrs)" value={dec.rest ?? false} onChange={v => set("rest", v)} hint={`Current fatigue: ${state.fatigueIndex}%. Over 40% triggers quality micro-failures next round.`} />
    <div style={{ padding: "12px 0", borderBottom: "1px solid #F1F5F9" }}>
      <p style={{ fontSize: 14, fontWeight: 600, color: C.navy, marginBottom: 10 }}>🏭 Lean Initiative (benefit appears Round 7)</p>
      {["5S Assembly Bay", "Standardized Work Procedures", "Visual Management Board"].map(opt => (
        <label key={opt} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, cursor: "pointer" }}>
          <input type="radio" name="lean5" checked={dec.lean === opt} onChange={() => set("lean", opt)} />
          <span style={{ fontSize: 13, color: C.navy }}>{opt}</span>
        </label>
      ))}
      <p style={{ fontSize: 11, color: C.muted }}>Each initiative reduces Waste Index by ~8%</p>
    </div>
  </div>;

  if (round === 6) return <div>{common}
    <Slider label="DS Mission Hours (final push)" value={dec.allocDS ?? 90} onChange={v => set("allocDS", v)} min={40} max={160} step={10} unit=" hrs" />
    <Toggle label="🌟 Accept CS-105 Bonus Mission (+$4M)" value={dec.acceptCS105 ?? false} onChange={v => set("acceptCS105", v)} hint="Requires spare capacity AND reputation >60 to earn bonus" />
    <Toggle label="🗑️ Scrap Defective Tiles" value={dec.scrapTiles ?? true} onChange={v => set("scrapTiles", v)} hint="Affects DS-301 success probability directly" />
  </div>;

  if (round === 7) return <div>{common}
    <Slider label="CS-103/104 Hours" value={dec.allocCS ?? 100} onChange={v => set("allocCS", v)} min={40} max={170} step={10} unit=" hrs" />
    <div style={{ padding: "12px 0", borderBottom: "1px solid #F1F5F9" }}>
      <p style={{ fontSize: 14, fontWeight: 600, color: C.navy, marginBottom: 10 }}>🏭 Second Lean Initiative</p>
      {["Kanban Inventory System", "Error-Proofing Final Check"].map(opt => (
        <label key={opt} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, cursor: "pointer" }}>
          <input type="radio" name="lean7" checked={dec.lean === opt} onChange={() => set("lean", opt)} />
          <span style={{ fontSize: 13, color: C.navy }}>{opt}</span>
        </label>
      ))}
    </div>
    <Toggle label="📦 Liquidate Excess Inventory (+$500K)" value={dec.liquidate ?? false} onChange={v => set("liquidate", v)} hint="Recovers holding costs. Eliminates buffer stock." />
    <Toggle label="😴 Mandatory Rest Period" value={dec.rest ?? false} onChange={v => set("rest", v)} hint={`Fatigue: ${state.fatigueIndex}%. Still affects launch success probability.`} />
  </div>;

  if (round === 8) return <div>{common}
    <Slider label="CS-104/105 Final Hours" value={dec.allocCS ?? 120} onChange={v => set("allocCS", v)} min={40} max={200} step={10} unit=" hrs" />
    <div style={{ marginTop: 8, background: C.amberBg, border: `1px solid ${C.amberBorder}`, borderRadius: 12, padding: 16 }}>
      <p style={{ fontSize: 14, fontWeight: 700, color: C.amber, marginBottom: 6 }}>⚠ Final Round</p>
      <p style={{ fontSize: 13, color: C.navy, lineHeight: 1.65 }}>All contracts locked. No overtime limit, but fatigue still affects launch success. Execute with precision.</p>
    </div>
  </div>;

  return null;
}

/* ─── LANDING PAGE ─── */
function Landing({ onStart }) {
  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      {/* Hero */}
      <div style={{ background: C.navy, overflow: "hidden", position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(ellipse at 15% 60%, rgba(37,99,235,0.35) 0%, transparent 55%), radial-gradient(ellipse at 85% 15%, rgba(29,78,216,0.2) 0%, transparent 50%)" }} />
        <div style={{ position: "absolute", inset: 0, opacity: 0.04, backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,255,255,1) 39px, rgba(255,255,255,1) 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(255,255,255,1) 39px, rgba(255,255,255,1) 40px)" }} />
        <div style={{ maxWidth: 1040, margin: "0 auto", padding: "80px 32px 72px", position: "relative" }}>
          <div className="fu" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(37,99,235,0.28)", border: "1px solid rgba(96,165,250,0.4)", borderRadius: 24, padding: "6px 18px", marginBottom: 24 }}>
            <span style={{ fontSize: 15 }}>🚀</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#93C5FD", letterSpacing: 2 }}>MBA OPERATIONS MANAGEMENT · OM-II</span>
          </div>
          <h1 className="fu1" style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(40px, 7vw, 72px)", fontWeight: 900, color: "#FFFFFF", lineHeight: 1.05, marginBottom: 22 }}>
            SpaceTime<br />Aerospace
          </h1>
          <p className="fu2" style={{ fontSize: 18, color: "#94A3B8", lineHeight: 1.75, maxWidth: 560, marginBottom: 40, fontWeight: 300 }}>
            A 9-round MBA operations simulation. Manage three simultaneous mission types. Discover that every early decision has a delayed consequence.
          </p>
          <div className="fu3" style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={onStart} className="lift" style={{
              background: "#2563EB", color: "#fff", border: "none", borderRadius: 12,
              padding: "16px 38px", fontSize: 16, fontWeight: 700, cursor: "pointer",
              boxShadow: "0 4px 24px rgba(37,99,235,0.55)", letterSpacing: 0.3,
            }}>Begin Simulation →</button>
            <p style={{ fontSize: 13, color: "#64748B" }}>⏱ ~60–90 min per round · 9 rounds total</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E2E8F0" }}>
        <div style={{ maxWidth: 1040, margin: "0 auto", padding: "0 32px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
          {[["9", "Rounds"], ["7", "Active Missions"], ["8", "KPI Metrics"], ["∞", "Possible Outcomes"]].map(([n, l], i) => (
            <div key={i} className="fu" style={{ padding: "26px 0", borderRight: i < 3 ? "1px solid #E2E8F0" : "none", textAlign: "center" }}>
              <p style={{ fontFamily: "'Playfair Display',serif", fontSize: 40, fontWeight: 900, color: C.accent }}>{n}</p>
              <p style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 1.5, marginTop: 4 }}>{l}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "60px 32px" }}>
        {/* Mission types */}
        <SLabel>Mission Portfolio</SLabel>
        <h2 className="fu" style={{ fontFamily: "'Playfair Display',serif", fontSize: 30, fontWeight: 700, color: C.navy, marginBottom: 26, lineHeight: 1.25 }}>Three simultaneous mission types.<br />Zero single strategy that optimizes all three.</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 60 }}>
          {[
            { type: "CS", title: "Commercial Satellite", desc: "High volume, tight launch windows, steep delay penalties. Tests scheduling and capacity discipline across concurrent missions." },
            { type: "GR", title: "Government Research",  desc: "Maximum reliability required. Safety audits enforce prevention spend thresholds. A single failure has permanent reputational cost." },
            { type: "DS", title: "Deep-Space Cargo",     desc: "Custom BOM with 8-week lead times that cannot be rushed. The ultimate test of MRP discipline — decisions made in Round 1 determine success in Round 6." },
          ].map(m => {
            const tc = TYPE_COLORS[m.type];
            return (
              <div key={m.type} className="lift fu" style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 16, padding: 24, boxShadow: "0 2px 8px rgba(15,27,53,0.05)" }}>
                <div style={{ display: "inline-block", background: tc.bg, border: `1px solid ${tc.border}`, borderRadius: 8, padding: "4px 12px", marginBottom: 14 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: tc.text, letterSpacing: 1.5 }}>{m.type}</span>
                </div>
                <p style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 700, color: C.navy, marginBottom: 10 }}>{m.title}</p>
                <p style={{ fontSize: 13, color: C.slate, lineHeight: 1.7 }}>{m.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Two-col section */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, marginBottom: 60 }}>
          <div>
            <SLabel>Core Learning Philosophy</SLabel>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, fontWeight: 700, color: C.navy, marginBottom: 20, lineHeight: 1.3 }}>You learn by experiencing consequences — not by being told.</h2>
            {[
              ["⚡", "Local optimization always damages another KPI"],
              ["⏱", "Problems surface 2–3 rounds after the decision"],
              ["📉", "Efficiency, reliability, cost & speed can't all be maximized"],
              ["🔥", "Firefighting in Round 5 is expensive — the fire was lit in Round 1"],
            ].map(([icon, text]) => (
              <div key={text} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "12px 0", borderBottom: "1px solid #F1F5F9" }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
                <p style={{ fontSize: 14, color: C.navyMid, lineHeight: 1.6, fontWeight: 400 }}>{text}</p>
              </div>
            ))}
          </div>
          <div style={{ background: C.navy, borderRadius: 18, padding: 28 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#60A5FA", letterSpacing: 2, textTransform: "uppercase", marginBottom: 18 }}>8 KPIs — All Interconnected</p>
            {[
              ["Mission On-Time Rate",   "Capacity + inventory + quality decisions"],
              ["Launch Success Rate",    "Testing time + inspection level"],
              ["Budget Utilization",     "Overtime + suppliers + rework costs"],
              ["Capacity Utilization",   "Too high = fatigue errors; too low = waste"],
              ["Inventory Turnover",     "Excess holding cost vs. stockout risk"],
              ["Cost of Quality",        "Prevention spend vs. failure costs"],
              ["Waste Index",            "Non-value-adding activities %"],
              ["Reputation Score",       "Cumulative — never resets between rounds"],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                <p style={{ fontSize: 13, color: "#E2E8F0", fontWeight: 500 }}>{k}</p>
                <p style={{ fontSize: 11, color: "#60A5FA", textAlign: "right", maxWidth: 160, lineHeight: 1.4 }}>{v}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div style={{ background: C.accent, borderRadius: 20, padding: "40px 48px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 20 }}>
          <div>
            <p style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, fontWeight: 700, color: "#fff", marginBottom: 6 }}>Ready to make your first decision?</p>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.78)", lineHeight: 1.6 }}>Round 0 is a briefing round. Study carefully — your Round 1 choices cast long shadows.</p>
          </div>
          <button onClick={onStart} className="lift" style={{
            background: "#fff", color: C.accent, border: "none", borderRadius: 12,
            padding: "16px 34px", fontSize: 15, fontWeight: 700, cursor: "pointer",
            boxShadow: "0 4px 16px rgba(0,0,0,0.15)", whiteSpace: "nowrap",
          }}>Launch Simulation →</button>
        </div>
      </div>
    </div>
  );
}

/* ─── FINAL SCREEN ─── */
function Final({ state, onRestart }) {
  const sc = state.finalScore || 0;
  const grade = sc >= 85 ? "A" : sc >= 75 ? "B" : sc >= 65 ? "C" : sc >= 55 ? "D" : "F";
  const GM = { A: [C.green, C.greenBg, C.greenBorder], B: [C.blue, C.blueBg, C.blueBorder], C: [C.amber, C.amberBg, C.amberBorder], D: ["#EA580C","#FFF7ED","#FED7AA"], F: [C.red, C.redBg, C.redBorder] };
  const [gc, gb, gbr] = GM[grade];
  const launched = Object.entries(state.missions).filter(([, m]) => m.launched);
  const failCost = state.quality.internalFailure + state.quality.externalFailure;

  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      <div style={{ background: C.navy, padding: "48px 32px 0" }}>
        <div style={{ maxWidth: 940, margin: "0 auto" }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#60A5FA", letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>Simulation Complete — Round 8 of 8</p>
          <div style={{ display: "flex", gap: 24, alignItems: "flex-end", paddingBottom: 36 }}>
            <div style={{ background: gb, border: `3px solid ${gc}`, borderRadius: 16, width: 100, height: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <p style={{ fontFamily: "'Playfair Display',serif", fontSize: 56, fontWeight: 900, color: gc, lineHeight: 1 }}>{grade}</p>
            </div>
            <div style={{ paddingBottom: 8 }}>
              <p style={{ fontFamily: "'Playfair Display',serif", fontSize: 52, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{sc}<span style={{ fontSize: 22, color: "#94A3B8" }}>/100</span></p>
              <p style={{ fontSize: 14, color: "#94A3B8", marginTop: 4 }}>Final Operations Score — SpaceTime Aerospace</p>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 940, margin: "0 auto", padding: "32px 32px 64px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
          <KPIGauge label="On-Time Rate"   value={state.kpis.onTime} />
          <KPIGauge label="Launch Success" value={state.kpis.launchSuccess} />
          <KPIGauge label="Reputation"     value={state.reputation} />
          <KPIGauge label="Waste Index"    value={state.kpis.wasteIndex} color={state.kpis.wasteIndex < 20 ? C.green : state.kpis.wasteIndex < 35 ? C.amber : C.red} sublabel="Lower is better" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
          <Card style={{ padding: 22 }}>
            <SLabel>Mission Outcomes</SLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {launched.map(([id, m]) => (
                <div key={id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", background: m.success ? C.greenBg : m.status === "anomaly" ? C.amberBg : C.redBg, border: `1px solid ${m.success ? C.greenBorder : m.status === "anomaly" ? C.amberBorder : C.redBorder}`, borderRadius: 9 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Chip type={MISSIONS_INFO[id]?.type || "CS"} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>{id}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 800, color: m.success ? C.green : m.status === "anomaly" ? C.amber : C.red }}>
                    {m.status === "anomaly" ? "ANOMALY ⚠" : m.success ? "SUCCESS ✓" : "FAILED ✗"}
                  </span>
                </div>
              ))}
            </div>
          </Card>
          <Card style={{ padding: 22 }}>
            <SLabel>Cost of Quality</SLabel>
            {[
              { l: "Prevention Costs",    v: state.quality.preventionSpend,  good: true  },
              { l: "Appraisal Costs",     v: state.quality.appraisalSpend,   good: true  },
              { l: "Internal Failure",    v: state.quality.internalFailure,  good: false },
              { l: "External Failure",    v: state.quality.externalFailure,  good: false },
            ].map(r => (
              <div key={r.l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #F1F5F9" }}>
                <p style={{ fontSize: 13, color: C.slate }}>{r.l}</p>
                <p style={{ fontSize: 15, fontWeight: 700, color: r.good ? C.blue : C.red }}>${r.v.toFixed(2)}M</p>
              </div>
            ))}
            <div style={{ marginTop: 14, padding: "10px 12px", background: failCost > state.quality.preventionSpend * 3 ? C.redBg : C.greenBg, border: `1px solid ${failCost > state.quality.preventionSpend * 3 ? C.redBorder : C.greenBorder}`, borderRadius: 8 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: failCost > state.quality.preventionSpend * 3 ? C.red : C.green }}>
                {failCost > state.quality.preventionSpend * 3
                  ? "⚠ Failure costs exceeded prevention spend 3×. Invest earlier next run."
                  : "✓ Good prevention ratio. Quality discipline compounded over 8 rounds."}
              </p>
            </div>
          </Card>
        </div>

        <div style={{ background: C.navy, borderRadius: 16, padding: 28, marginBottom: 28 }}>
          <p style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 700, color: "#fff", marginBottom: 12 }}>Key Lesson</p>
          <p style={{ fontSize: 14, color: "#CBD5E1", lineHeight: 1.85, fontWeight: 300 }}>
            {sc >= 75
              ? "Strong performance. Early planning discipline compounded into late-phase advantages. Ordering the Propulsion Module in Round 1, maintaining prevention spend, and controlling fatigue created a cascade that ran in your favor across 8 rounds."
              : "Most of your Rounds 5–8 firefighting costs trace back to decisions in Rounds 1–2. The DS-301 Propulsion order window, the 12% prevention threshold, and the Tier B supplier choice each have consequence chains that extend 3–4 rounds. Run it again with this knowledge — the difference is dramatic."}
          </p>
        </div>

        <div style={{ textAlign: "center" }}>
          <button onClick={onRestart} className="lift" style={{
            background: C.accent, color: "#fff", border: "none", borderRadius: 12,
            padding: "16px 40px", fontSize: 15, fontWeight: 700, cursor: "pointer",
            boxShadow: "0 4px 16px rgba(37,99,235,0.3)",
          }}>↺ Run Simulation Again</button>
        </div>
      </div>
    </div>
  );
}

/* ─── MAIN APP ─── */
export default function App() {
  const [state, setState] = useState({ ...INIT });
  const [dec, setDec]     = useState({});
  const [tab, setTab]     = useState("dashboard");
  const [busy, setBusy]   = useState(false);
  const topRef            = useRef(null);

  const rm = ROUNDS_META[Math.min(state.round, 8)];
  const pm = PHASE_META[rm.phase] || PHASE_META.briefing;
  const latestEvts = state.eventLog.length ? state.eventLog[state.eventLog.length - 1].events : [];

  const liveCapUtil = (() => {
    const alloc = (dec.allocCS || 80) + (dec.allocGR || 0) + (dec.allocDS || 0);
    const cap   = state.engineerCapacity + Math.floor(state.engineerCapacity * (dec.overtime || 0) / 100);
    return Math.min(110, Math.round(alloc / cap * 100));
  })();

  const advance = useCallback(() => {
    if (busy || state.round >= 8) return;
    setBusy(true);
    setTimeout(() => {
      const next = runRound(state, dec);
      setState(next);
      setDec({});
      setTab("events");
      setBusy(false);
    }, 700);
  }, [state, dec, busy]);

  if (state.phase === "landing") return <><style>{CSS}</style><Landing onStart={() => setState(s => ({ ...s, phase: "playing" }))} /></>;
  if (state.phase === "final")   return <><style>{CSS}</style><Final state={state} onRestart={() => { setState({ ...INIT }); setDec({}); setTab("dashboard"); }} /></>;

  const TABS = [
    { id: "dashboard", label: "Dashboard" },
    { id: "decisions", label: state.round === 0 ? "Briefing" : "Decisions" },
    { id: "missions",  label: "Missions"  },
    { id: "events",    label: "Events" + (latestEvts.length ? ` (${latestEvts.length})` : "") },
  ];

  return (
    <>
      <style>{CSS}</style>
      <div ref={topRef} style={{ minHeight: "100vh", background: C.bg }}>

        {/* ── TOP BAR ── */}
        <div style={{ background: C.navy, position: "sticky", top: 0, zIndex: 200 }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0 8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 22 }}>🚀</span>
                <div>
                  <p style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 700, color: "#fff", letterSpacing: 0.3 }}>SpaceTime Aerospace</p>
                  <p style={{ fontSize: 10, color: "#60A5FA", letterSpacing: 1.8, textTransform: "uppercase", fontWeight: 700 }}>Operations Simulation</p>
                </div>
              </div>
              <div style={{ display: "flex", gap: 24 }}>
                {[
                  { l: "Reputation",  v: state.reputation,     c: state.reputation > 70 ? "#4ADE80" : state.reputation > 50 ? "#FBBF24" : "#F87171" },
                  { l: "Reserve",     v: "$" + state.reserve.toFixed(1) + "M", c: state.reserve > 5 ? "#60A5FA" : "#F87171" },
                  { l: "Fatigue",     v: state.fatigueIndex + "%", c: state.fatigueIndex < 20 ? "#4ADE80" : state.fatigueIndex < 40 ? "#FBBF24" : "#F87171" },
                ].map(item => (
                  <div key={item.l} style={{ textAlign: "right" }}>
                    <p style={{ fontSize: 9, color: "#94A3B8", letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700 }}>{item.l}</p>
                    <p style={{ fontSize: 20, fontWeight: 700, color: item.c, lineHeight: 1 }}>{item.v}</p>
                  </div>
                ))}
              </div>
            </div>
            {/* Progress */}
            <div style={{ display: "flex", gap: 3, marginBottom: 5 }}>
              {ROUNDS_META.map((_, i) => (
                <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, transition: "background 0.4s", background: i < state.round ? pm.color : i === state.round ? pm.color + "99" : "rgba(255,255,255,0.14)" }} />
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 1 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: pm.color }}>Round {state.round} of 8 — {rm.title}</p>
              <span style={{ fontSize: 9, fontWeight: 800, color: pm.color, background: pm.color + "22", border: `1px solid ${pm.color}44`, borderRadius: 20, padding: "2px 10px", letterSpacing: 1.5 }}>{pm.label}</span>
            </div>
            {/* Tabs */}
            <div style={{ display: "flex" }}>
              {TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  padding: "9px 18px", background: "none", border: "none", cursor: "pointer",
                  fontSize: 13, fontWeight: tab === t.id ? 700 : 400,
                  color: tab === t.id ? "#fff" : "#64748B",
                  borderBottom: tab === t.id ? `2px solid ${pm.color}` : "2px solid transparent",
                  transition: "all 0.15s",
                }}>{t.label}</button>
              ))}
            </div>
          </div>
        </div>

        {/* ── CONTENT ── */}
        <div className="fi" style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px" }}>

          {/* DASHBOARD */}
          {tab === "dashboard" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 12 }}>
                <div className="fu"><KPIGauge label="On-Time Rate"   value={state.kpis.onTime}        sublabel="Target: >90%" /></div>
                <div className="fu1"><KPIGauge label="Launch Success" value={state.kpis.launchSuccess} sublabel="Target: >95%" /></div>
                <div className="fu2"><KPIGauge label="Budget Used"    value={state.kpis.budgetUtil} color={state.kpis.budgetUtil < 90 ? C.green : state.kpis.budgetUtil < 110 ? C.amber : C.red} sublabel={"$" + state.totalSpent.toFixed(1) + "M spent"} /></div>
                <div className="fu3"><KPIGauge label="Reputation"     value={state.reputation}          sublabel="Carries forward" /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
                <div className="fu"><KPIGauge label="Capacity Util." value={state.kpis.capUtil} color={state.kpis.capUtil > 95 ? C.red : state.kpis.capUtil > 85 ? C.amber : C.green} sublabel="Target: 75–90%" /></div>
                <div className="fu1"><KPIGauge label="Inventory Turn" value={state.kpis.inventoryTurn} unit="x" sublabel="Target: >3.5x" /></div>
                <div className="fu2"><KPIGauge label="Waste Index"    value={state.kpis.wasteIndex} color={state.kpis.wasteIndex < 25 ? C.green : state.kpis.wasteIndex < 35 ? C.amber : C.red} sublabel="Target: <25%" /></div>
                <div className="fu3"><KPIGauge label="Fatigue Index"  value={state.fatigueIndex} color={state.fatigueIndex < 20 ? C.green : state.fatigueIndex < 40 ? C.amber : C.red} sublabel=">40% triggers failures" /></div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
                <Card style={{ padding: 20 }}>
                  <SLabel>Reputation Trend</SLabel>
                  <svg width="100%" height="90" viewBox="0 0 380 90" preserveAspectRatio="none" style={{ display: "block" }}>
                    <defs>
                      <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={state.reputation > 70 ? C.green : C.amber} stopOpacity="0.2" />
                        <stop offset="100%" stopColor={state.reputation > 70 ? C.green : C.amber} stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {state.repHistory.length > 1 && (() => {
                      const h = state.repHistory;
                      const col = state.reputation > 70 ? C.green : state.reputation > 50 ? C.amber : C.red;
                      const pts = h.map((v, i) => `${(i / (h.length - 1)) * 380},${90 - v * 0.9}`).join(" ");
                      return <>
                        <polyline points={pts} fill="none" stroke={col} strokeWidth="2.5" strokeLinejoin="round" />
                        <polyline points={`0,90 ${pts} 380,90`} fill="url(#rg)" />
                        {h.map((v, i) => <circle key={i} cx={(i / (h.length - 1)) * 380} cy={90 - v * 0.9} r={4} fill={col} />)}
                      </>;
                    })()}
                  </svg>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                    <span style={{ fontSize: 11, color: C.muted }}>Start: 75</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: state.reputation > 70 ? C.green : C.amber }}>Now: {state.reputation}</span>
                  </div>
                </Card>
                <Card style={{ padding: 20 }}>
                  <SLabel>DS-301 Component Pipeline</SLabel>
                  {[
                    { name: "Propulsion Module", inv: state.inventory.propulsion, lead: "8 wks", key: "propulsion" },
                    { name: "Thermal Tiles",     inv: state.inventory.tiles,     lead: "3 wks", key: "tiles"      },
                    { name: "Telemetry Array",   inv: state.inventory.telemetry, lead: "5 wks", key: "telemetry"  },
                  ].map(c => (
                    <div key={c.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid #F1F5F9" }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>{c.name}</p>
                        <p style={{ fontSize: 11, color: C.muted }}>Lead time: {c.lead}</p>
                      </div>
                      {c.inv.ordered
                        ? <Tag color={C.green} bg={C.greenBg} border={C.greenBorder}>R{c.inv.orderRound}→R{c.inv.arrivalRound} ✓</Tag>
                        : <Tag color={C.red}   bg={C.redBg}   border={C.redBorder}>Not ordered</Tag>}
                    </div>
                  ))}
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
                    <p style={{ fontSize: 12, color: C.slate }}>Tier B Supplier Used</p>
                    <p style={{ fontSize: 12, fontWeight: 700, color: state.tierBUsed ? C.red : C.green }}>{state.tierBUsed ? "Yes ⚠" : "No"}</p>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                    <p style={{ fontSize: 12, color: C.slate }}>Lean Initiatives Active</p>
                    <p style={{ fontSize: 12, fontWeight: 700, color: C.blue }}>{state.lean.length}</p>
                  </div>
                </Card>
              </div>

              {/* Scenario highlight */}
              <div style={{ marginTop: 18, background: pm.bg, border: `1px solid ${pm.border}`, borderRadius: 14, padding: "18px 22px", display: "flex", gap: 16, alignItems: "center" }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: pm.color + "1A", border: `1px solid ${pm.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                  {rm.phase === "briefing" ? "📋" : rm.phase === "early" ? "🟢" : rm.phase === "mid" ? "🟡" : "🔴"}
                </div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 800, color: pm.color, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 2 }}>Round {state.round} · {pm.label}</p>
                  <p style={{ fontSize: 16, fontWeight: 700, color: C.navy, marginBottom: 2 }}>{rm.title}</p>
                  <p style={{ fontSize: 13, color: C.slate }}>{rm.subtitle}</p>
                </div>
              </div>
            </div>
          )}

          {/* DECISIONS */}
          {tab === "decisions" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20 }}>
              <div>
                <div style={{ marginBottom: 18 }}>
                  <p style={{ fontSize: 10, fontWeight: 800, color: pm.color, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Round {state.round} Decisions · {pm.label}</p>
                  <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, fontWeight: 700, color: C.navy, marginBottom: 4 }}>{rm.title}</h2>
                  <p style={{ fontSize: 13, color: C.muted }}>{rm.subtitle}</p>
                </div>
                <Card style={{ padding: "4px 20px 18px" }}>
                  <Decisions round={state.round} state={state} dec={dec} setDec={setDec} />
                </Card>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <Card style={{ padding: 18 }}>
                  <SLabel>Live Capacity</SLabel>
                  {[
                    ["Available",  state.engineerCapacity + " hrs", C.blue],
                    ["Overtime+",  "+" + Math.floor(state.engineerCapacity * (dec.overtime || 0) / 100) + " hrs", (dec.overtime || 0) > 15 ? C.amber : C.green],
                    ["CS Alloc.",  (dec.allocCS || 80) + " hrs", null],
                    ["GR Alloc.",  (dec.allocGR || 0) + " hrs",  null],
                    ["DS Alloc.",  (dec.allocDS || 0) + " hrs",  null],
                  ].map(([l, v, c]) => (
                    <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #F8FAFC" }}>
                      <span style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>{l}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: c || C.navy }}>{v}</span>
                    </div>
                  ))}
                  <div style={{ marginTop: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                      <span style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>Utilization</span>
                      <span style={{ fontSize: 15, fontWeight: 800, color: liveCapUtil > 95 ? C.red : liveCapUtil > 85 ? C.amber : C.green }}>{liveCapUtil}%</span>
                    </div>
                    <div style={{ height: 8, background: "#F1F5F9", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: Math.min(100, liveCapUtil) + "%", height: "100%", background: liveCapUtil > 95 ? C.red : liveCapUtil > 85 ? C.amber : C.green, transition: "width 0.3s, background 0.3s", borderRadius: 4 }} />
                    </div>
                    {liveCapUtil > 95 && <p style={{ fontSize: 11, color: C.red, marginTop: 4, fontWeight: 600 }}>⚠ Overload — reduce allocation</p>}
                  </div>
                </Card>
                <Card style={{ padding: 18 }}>
                  <SLabel>Quality Budget</SLabel>
                  {[
                    { l: "Prevention Ratio",  v: (dec.prevBudget || 15) + "%",    alert: (dec.prevBudget || 15) < 12 },
                    { l: "Inspection Hours",  v: (dec.inspHours  || 20) + " hrs", alert: false },
                    { l: "Cumul. Prevention", v: "$" + state.quality.preventionSpend.toFixed(2) + "M", alert: false },
                    { l: "Failure Costs",     v: "$" + (state.quality.internalFailure + state.quality.externalFailure).toFixed(2) + "M", alert: (state.quality.internalFailure + state.quality.externalFailure) > 1 },
                  ].map(r => (
                    <div key={r.l} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #F8FAFC" }}>
                      <span style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>{r.l}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: r.alert ? C.red : C.navy }}>{r.v}</span>
                    </div>
                  ))}
                  {(dec.prevBudget || 15) < 12 && (
                    <div style={{ marginTop: 10, background: C.redBg, border: `1px solid ${C.redBorder}`, borderRadius: 8, padding: "8px 10px" }}>
                      <p style={{ fontSize: 11, color: C.red, fontWeight: 700 }}>⚠ Below 12% — GR-201 audit will fail</p>
                    </div>
                  )}
                </Card>
              </div>
            </div>
          )}

          {/* MISSIONS */}
          {tab === "missions" && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <SLabel>Mission Portfolio</SLabel>
                <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, fontWeight: 700, color: C.navy }}>All 7 Missions — Current Status</h2>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
                {Object.entries(state.missions).map(([id, m]) => {
                  const info = MISSIONS_INFO[id];
                  const STATUS = {
                    success: { c: C.green, bg: C.greenBg, b: C.greenBorder, icon: "✓", l: "SUCCESS"  },
                    failed:  { c: C.red,   bg: C.redBg,   b: C.redBorder,   icon: "✗", l: "FAILED"   },
                    anomaly: { c: C.amber, bg: C.amberBg, b: C.amberBorder, icon: "⚠", l: "ANOMALY"  },
                    pending: { c: C.blue,  bg: C.blueBg,  b: C.blueBorder,  icon: "◷", l: "ACTIVE"   },
                    future:  { c: C.muted, bg: C.bg,      b: C.border,      icon: "○", l: "UPCOMING" },
                  };
                  const st = STATUS[m.status] || STATUS.future;
                  return (
                    <div key={id} className="lift" style={{ background: st.bg, border: `1px solid ${st.b}`, borderRadius: 14, padding: 18 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Chip type={info.type} />
                          <p style={{ fontSize: 16, fontWeight: 700, color: C.navy }}>{id}</p>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", border: `1px solid ${st.b}`, borderRadius: 8, padding: "4px 10px" }}>
                          <span style={{ fontSize: 13, color: st.c, fontWeight: 800 }}>{st.icon}</span>
                          <span style={{ fontSize: 11, fontWeight: 800, color: st.c, letterSpacing: 0.5 }}>{st.l}</span>
                        </div>
                      </div>
                      <p style={{ fontSize: 12, color: C.slate, marginBottom: 12 }}>{info.label}</p>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                        {[["Target Round", "Round " + m.targetRound], ["Complexity", info.complexity], ["Eng. Hours", info.hours + " hrs"], ["Quality Req.", info.quality]].map(([k, v]) => (
                          <div key={k} style={{ background: "rgba(255,255,255,0.7)", borderRadius: 8, padding: "7px 10px" }}>
                            <p style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{k}</p>
                            <p style={{ fontSize: 12, color: C.navy, fontWeight: 600, marginTop: 2 }}>{v}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* EVENTS */}
          {tab === "events" && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <SLabel>Event Log</SLabel>
                <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, fontWeight: 700, color: C.navy }}>Round-by-Round History</h2>
              </div>
              {state.eventLog.length === 0 ? (
                <Card style={{ padding: 56, textAlign: "center" }}>
                  <p style={{ fontSize: 36, marginBottom: 12 }}>📋</p>
                  <p style={{ fontSize: 17, fontWeight: 700, color: C.navy, marginBottom: 6 }}>No events yet</p>
                  <p style={{ fontSize: 13, color: C.muted }}>Advance to Round 1 to begin the simulation.</p>
                </Card>
              ) : (
                [...state.eventLog].reverse().map(({ round: r, events: evts }) => {
                  const m2 = ROUNDS_META[r] || ROUNDS_META[8];
                  const p2 = PHASE_META[m2.phase] || PHASE_META.early;
                  return (
                    <div key={r} style={{ marginBottom: 26 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                        <div style={{ height: 1, flex: 1, background: C.border }} />
                        <span style={{ fontSize: 10, fontWeight: 800, color: p2.color, letterSpacing: 1.5, textTransform: "uppercase", background: p2.bg, border: `1px solid ${p2.border}`, borderRadius: 20, padding: "4px 14px" }}>Round {r} — {m2.title}</span>
                        <div style={{ height: 1, flex: 1, background: C.border }} />
                      </div>
                      {evts.map((e, i) => <EventBadge key={i} e={e} />)}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* ── BOTTOM BAR ── */}
        <div style={{ borderTop: "1px solid #E2E8F0", background: "#fff", position: "sticky", bottom: 0, zIndex: 100, boxShadow: "0 -4px 20px rgba(15,27,53,0.07)" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", padding: "13px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 1.5 }}>Current Round</p>
                <p style={{ fontSize: 15, fontWeight: 700, color: C.navy }}>{rm.title}</p>
              </div>
              {state.round > 0 && (
                <div style={{ display: "flex", gap: 16, borderLeft: "1px solid #E2E8F0", paddingLeft: 20 }}>
                  {[["Rep.", state.reputation, state.reputation > 70 ? C.green : C.amber], ["Fatigue", state.fatigueIndex + "%", state.fatigueIndex < 30 ? C.green : C.red]].map(([l, v, c]) => (
                    <div key={l}>
                      <p style={{ fontSize: 9, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 1.5 }}>{l}</p>
                      <p style={{ fontSize: 16, fontWeight: 800, color: c }}>{v}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <p style={{ fontSize: 12, color: C.muted, maxWidth: 240, textAlign: "right", lineHeight: 1.5 }}>
                {state.round === 0 ? "Review the briefing, then advance when ready." : `Configure decisions, then advance to Round ${state.round + 1}.`}
              </p>
              <button onClick={advance} disabled={busy} className={busy ? "" : "lift"} style={{
                background: busy ? "#E2E8F0" : pm.color,
                color: busy ? C.muted : "#fff",
                border: "none", borderRadius: 12, padding: "13px 26px",
                fontSize: 14, fontWeight: 700, cursor: busy ? "wait" : "pointer",
                boxShadow: busy ? "none" : `0 4px 16px ${pm.color}55`,
                minWidth: 196, transition: "all 0.2s", letterSpacing: 0.3,
              }}>
                {busy ? "Processing…" : state.round === 0 ? "▶ Begin Round 1" : `▶ Advance to Round ${state.round + 1}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
