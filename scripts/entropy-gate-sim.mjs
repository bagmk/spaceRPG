#!/usr/bin/env node
// Phase 0 circuit experiment — ENTITY_REDESIGN_PROMPT.md
// Compares CURRENT gate (quanta threshold + cosmic time wait) against the
// redesigned ENTROPY gate (single cumulative entropy threshold per stage).
// Goal (CHECKPOINT): show numerically that active play (clicking + fusing)
// accelerates progression under the entropy gate, while it barely matters today.
//
// Engine math is copied from balance-simulator.html so results are comparable.
// Run: node scripts/entropy-gate-sim.mjs

// ---------------------------------------------------------------------------
// Stage data (tuned set from balance-simulator.html DEFAULT_STAGES)
// ---------------------------------------------------------------------------
const STAGES = [
  { id: 1, name: 'Inflation', threshold: 1725, cosmicTimeSec: 1e-32, realPlayTargetSec: 30, mechanic: 'click_basic' },
  { id: 2, name: 'Baryogenesis', threshold: 4.693e7, cosmicTimeSec: 1e-12, realPlayTargetSec: 120, mechanic: 'matter_asymmetry' },
  { id: 3, name: 'Quark-Gluon Plasma', threshold: 1.427e9, cosmicTimeSec: 1e-6, realPlayTargetSec: 300, mechanic: 'click_basic' },
  { id: 4, name: 'Nucleosynthesis', threshold: 1.211e10, cosmicTimeSec: 180, realPlayTargetSec: 360, mechanic: 'fusion_window' },
  { id: 5, name: 'Recombination', threshold: 1.285e11, cosmicTimeSec: 6.8e12, realPlayTargetSec: 540, mechanic: 'recombination' },
  { id: 6, name: 'Cosmic Dark Age', threshold: 6e14, cosmicTimeSec: 3.15e15, realPlayTargetSec: 1800, mechanic: 'dark_age' },
  { id: 7, name: 'First Stars', threshold: 2e16, cosmicTimeSec: 6.3e15, realPlayTargetSec: 3600, mechanic: 'first_stars' },
  { id: 8, name: 'Reionization', threshold: 2e17, cosmicTimeSec: 1.6e16, realPlayTargetSec: 5400, mechanic: 'reionization' },
  { id: 9, name: 'Galaxy Formation', threshold: 1e18, cosmicTimeSec: 3.15e16, realPlayTargetSec: 7200, mechanic: 'galaxy_weaving' },
  { id: 10, name: 'Solar System', threshold: 8e19, cosmicTimeSec: 2.9e17, realPlayTargetSec: 10800, mechanic: 'planet_formation' },
  { id: 11, name: 'Life on Earth', threshold: 2e20, cosmicTimeSec: 4.35e17, realPlayTargetSec: 14400, mechanic: 'life_evolution' },
  { id: 12, name: 'Death of Star', threshold: 6e20, cosmicTimeSec: 5.83e17, realPlayTargetSec: 21600, mechanic: 'red_giant' },
  { id: 13, name: 'Stelliferous End', threshold: 2e21, cosmicTimeSec: 3.15e21, realPlayTargetSec: 36000, mechanic: 'remnant_cooling' },
  { id: 14, name: 'Degenerate Era', threshold: 8e22, cosmicTimeSec: 2.29e34, realPlayTargetSec: 54000, mechanic: 'proton_decay' },
  { id: 15, name: 'Black Hole Era', threshold: 3e23, cosmicTimeSec: 3.89e35, realPlayTargetSec: 86400, mechanic: 'hawking_radiation' },
  { id: 16, name: 'The End', threshold: 1.2e24, cosmicTimeSec: 5.01e37, realPlayTargetSec: 117450, mechanic: 'ending_choice' },
];
// PRODUCTION stage gates (src/game/stages.ts) — used for the CURRENT-gate baseline.
// Quanta thresholds are tiny vs the cosmic-time wait => time gate dominates (the diagnosed flaw).
const CYS = 31_557_600; // COSMIC_YEAR_SECONDS
const PROD_GATES = [
  { threshold: 2_000, cosmicTimeSec: 1e-32 },
  { threshold: 30_000, cosmicTimeSec: 1e-12 },
  { threshold: 400_000, cosmicTimeSec: 1e-6 },
  { threshold: 6_000_000, cosmicTimeSec: 200 },
  { threshold: 8e7, cosmicTimeSec: 300_000 * CYS },
  { threshold: 2e9, cosmicTimeSec: 100_000_000 * CYS },
  { threshold: 2e10, cosmicTimeSec: 200_000_000 * CYS },
  { threshold: 3e11, cosmicTimeSec: 600_000_000 * CYS },
  { threshold: 5e12, cosmicTimeSec: 1_000_000_000 * CYS },
  { threshold: 8e13, cosmicTimeSec: 10_000_000_000 * CYS },
  { threshold: 2e15, cosmicTimeSec: 20_000_000_000 * CYS },
  { threshold: 3e16, cosmicTimeSec: 20_000_000_000 * CYS + CYS },
  { threshold: 5e17, cosmicTimeSec: 100_000_000_000_000 * CYS },
  { threshold: 9e18, cosmicTimeSec: 8e26 * CYS },
  { threshold: 2e20, cosmicTimeSec: 2e28 * CYS },
  { threshold: 4e21, cosmicTimeSec: 2e30 * CYS },
];
const PROD_STAGES = STAGES.map((s, i) => ({ ...s, ...PROD_GATES[i] }));

const CROSS_MULTS = {
  5: { click: 1.4, auto: 1.4, crit: 1.15, time: 1.25 }, 10: { click: 1.8, auto: 1.8, crit: 1.3, time: 1.6 },
  15: { click: 2.4, auto: 2.4, crit: 1.5, time: 2.1 }, 20: { click: 3.2, auto: 3.2, crit: 1.75, time: 2.8 },
  25: { click: 4.4, auto: 4.4, crit: 2.05, time: 3.6 }, 30: { click: 6, auto: 6, crit: 2.5, time: 5 },
};
const CROSS_SP = { 5: 1, 10: 1, 15: 2, 20: 2, 25: 3, 30: 3 };
const STAGE_LEVEL_TARGETS = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 29, 29, 29, 29, 29, 30];
const SP_ON_ADVANCE = [1, 1, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 5, 5, 6];
const MECHANIC_CLICK_BOOST = {
  matter_asymmetry: 1.2, fusion_window: 1.3, recombination: 1.2, reionization: 1.4,
  galaxy_weaving: 1.3, planet_formation: 1.2, life_evolution: 1.5, red_giant: 1.5,
  remnant_cooling: 1.0, proton_decay: 2.4, hawking_radiation: 3.5, ending_choice: 1.0,
  click_basic: 1.0, dark_age: 1.0, first_stars: 1.0,
};

const BASE_CFG = {
  skillCostBase: { click: 3, auto: 3, crit: 3, time: 3 },
  clickPowerPerLevel: 2, autoRatePerLevel: 2,
  critChancePerLevel: 0.015, critMultBase: 1.5, critMultPerLevel: 0.5, critChanceCap: 0.5,
  timeFillBase: 10, comboMultMax: 8.0, comboMultPer10: 0.4, sustainedCombo: 100,
  purchaseBudgetFraction: 1, maxSkillLevel: 50, maxTimeSkillLevel: 40,
  maxHoursPerStage: 1000,
};

// Entropy-gate model knobs (Phase 0 proposal — to be tuned)
const ENTROPY_CFG = {
  wClick: 0.5,        // entropy per quanta earned by clicking (= today's ENTROPY_MATTER_RATE)
  wAuto: 0.25,        // entropy per quanta earned by auto (2x per-quanta active bias; clicking already out-earns auto)
  fusionValueSec: 30, // one fusion burst == this many seconds of current matter-entropy income
  fusionCostFrac: 0.10, // each fusion consumes this fraction of the quanta bank (sink)
};

// ---------------------------------------------------------------------------
// Shared engine (ported from balance-simulator.html)
// ---------------------------------------------------------------------------
const POWER_LEVEL_COSTS_AFTER_30 = [
  1e15, 5e15, 2e16, 8e16, 3e17, 1e18, 4e18, 1.6e19, 6e19, 2e20,
  8e20, 3e21, 1e22, 3e22, 1e23, 3e23, 1e24, 3e24, 1e25, 3e25,
];
const TIME_LEVEL_COSTS = [
  1, 5, 25, 125, 750, 5e3, 4e4, 3e5, 2e6, 1e7,
  1e15, 5e15, 1e20, 3e20, 8e20, 2e21, 5e21, 1e22, 1.2e22, 1.4e22,
  1.6e22, 1.8e22, 2e22, 2.2e22, 2.5e22, 3e22, 3.6e22, 4.4e22,
  5.5e22, 7e22, 5e24, 1e25, 2e25, 4e25, 8e25, 1.6e26,
  3.2e26, 6.4e26, 1.28e27, 2.56e27,
];

function createSkills() { return { click: 0, auto: 0, crit: 0, time: 0, crossNodes: new Set(), sp: 0 }; }

function computeMods(sk) {
  let clickMult = Math.pow(BASE_CFG.clickPowerPerLevel, sk.click);
  let autoAdd = sk.auto > 0 ? Math.pow(BASE_CFG.autoRatePerLevel, sk.auto) : 0;
  let autoMult = 1, critMultMult = 1;
  for (const node of sk.crossNodes) {
    const tier = parseInt(node.split('lv')[1]);
    const track = node.split('_')[0];
    const m = CROSS_MULTS[tier][track];
    if (track === 'click') clickMult *= m;
    else if (track === 'auto') autoMult *= m;
    else if (track === 'crit') critMultMult *= m;
  }
  return { clickMult, autoAdd, autoMult, critMultMult };
}
const clickPower = (m) => Math.max(1, m.clickMult);
const autoRate = (m) => Math.max(0, m.autoAdd * m.autoMult);
const critChance = (L, combo) => Math.min(BASE_CFG.critChanceCap, L * BASE_CFG.critChancePerLevel + combo * 0.003);
const critMultiplier = (L, m) => (BASE_CFG.critMultBase + L * BASE_CFG.critMultPerLevel) * m.critMultMult;
const comboMult = (combo) => 1 + Math.min(BASE_CFG.comboMultMax - 1, Math.floor(combo / 10) * BASE_CFG.comboMultPer10);
const timeFillRate = (L) => Math.pow(BASE_CFG.timeFillBase, L);

function trackCost(t, L) {
  if (t === 'time') return TIME_LEVEL_COSTS[Math.max(0, L - 1)] ?? TIME_LEVEL_COSTS[TIME_LEVEL_COSTS.length - 1];
  if (L > 30) return POWER_LEVEL_COSTS_AFTER_30[Math.max(0, L - 31)] ?? POWER_LEVEL_COSTS_AFTER_30[POWER_LEVEL_COSTS_AFTER_30.length - 1];
  return Math.floor(Math.pow(BASE_CFG.skillCostBase[t], Math.max(0, L - 1)));
}
function trackUnlocked(track, stageIdx, entropyMode) {
  const stageId = stageIdx + 1;
  if (track === 'time') return !entropyMode && stageId >= 5; // time track absorbed in redesign (D3)
  if (track === 'click') return true;
  if (track === 'auto') return stageId >= 3;
  if (track === 'crit') return stageId >= 4;
  return false;
}
// Greedy cross-node buy + balanced-targets level buy (simulator's default strategy),
// except 'current' mode uses time_priority order (the known dominant meta).
function tryOnePurchase(sk, quanta, stageIdx, entropyMode) {
  const tracks = ['click', 'auto', 'crit', 'time'];
  for (const tier of [5, 10, 15, 20, 25, 30]) {
    for (const track of tracks) {
      const id = `${track}_lv${tier}`;
      if (sk.crossNodes.has(id)) continue;
      if (sk[track] < tier || !trackUnlocked(track, stageIdx, entropyMode)) continue;
      if (sk.sp < CROSS_SP[tier]) continue;
      sk.sp -= CROSS_SP[tier]; sk.crossNodes.add(id);
      return { bought: true, quanta };
    }
  }
  const target = Math.min(BASE_CFG.maxSkillLevel, STAGE_LEVEL_TARGETS[stageIdx] ?? BASE_CFG.maxSkillLevel);
  const order = entropyMode
    ? tracks.filter((t) => trackUnlocked(t, stageIdx, true)).sort((a, b) => (sk[a] >= target) - (sk[b] >= target) || sk[a] - sk[b] || trackCost(a, sk[a] + 1) - trackCost(b, sk[b] + 1))
    : ['time', 'click', 'auto', 'crit'];
  for (const track of order) {
    if (!trackUnlocked(track, stageIdx, entropyMode)) continue;
    const maxL = track === 'time' ? BASE_CFG.maxTimeSkillLevel : BASE_CFG.maxSkillLevel;
    if (sk[track] >= maxL) continue;
    if (entropyMode && sk[track] >= target) continue;
    const cost = trackCost(track, sk[track] + 1);
    if (cost > quanta) continue;
    sk[track] += 1;
    return { bought: true, quanta: quanta - cost };
  }
  return { bought: false, quanta };
}

// ---------------------------------------------------------------------------
// CURRENT mode: quanta threshold AND cosmic clock (faithful port)
// ---------------------------------------------------------------------------
function simulateStageCurrent(stageIdx, sk, carry, profile) {
  const stage = PROD_STAGES[stageIdx];
  let quanta = carry;
  let cosmicClock = stageIdx === 0 ? 1e-34 : PROD_STAGES[stageIdx - 1].cosmicTimeSec;
  let elapsed = 0, safety = 0;
  const combo = profile.combo ?? 0;
  const stageMaxSec = BASE_CFG.maxHoursPerStage * 3600;
  while (elapsed < stageMaxSec && safety++ < 100000) {
    const mods = computeMods(sk);
    const cp = clickPower(mods) * (MECHANIC_CLICK_BOOST[stage.mechanic] ?? 1);
    const eCrit = 1 + critChance(sk.crit, combo) * (critMultiplier(sk.crit, mods) - 1);
    const clickG = profile.cps * cp * eCrit * comboMult(combo) * profile.activeFraction;
    const totalG = clickG + autoRate(mods);
    const tRate = timeFillRate(sk.time);
    const remQ = Math.max(0, stage.threshold - quanta);
    const remT = Math.max(0, stage.cosmicTimeSec - cosmicClock);
    const tQ = remQ > 0 ? (totalG > 0 ? remQ / totalG : Infinity) : 0;
    const tT = remT > 0 ? (tRate > 0 ? remT / tRate : Infinity) : 0;
    if (tQ === 0 && tT === 0) break;
    const nearest = Math.max(0.5, Math.min(Math.max(tQ, tT) / 8, 600));
    const dt = Math.min(nearest, Math.max(0.5, Math.min(tQ || Infinity, tT || Infinity)));
    if (!Number.isFinite(dt)) { elapsed = stageMaxSec; break; }
    quanta += totalG * dt; cosmicClock += tRate * dt; elapsed += dt;
    let bought = true;
    while (bought) ({ bought, quanta } = tryOnePurchase(sk, quanta, stageIdx, false));
  }
  if (stageIdx < STAGES.length - 1) sk.sp += SP_ON_ADVANCE[stageIdx] ?? 1;
  const done = quanta >= stage.threshold && cosmicClock >= stage.cosmicTimeSec;
  return { elapsed: done ? elapsed : stageMaxSec, carry: quanta, infeasible: !done };
}

// ---------------------------------------------------------------------------
// ENTROPY mode: single cumulative entropy gate (redesign D1/D3)
// ---------------------------------------------------------------------------
// calibrateTo: if set, ignore gate and run for exactly that many seconds,
// returning the cumulative entropy reached (used to derive thresholds).
function simulateStageEntropy(stageIdx, sk, state, profile, thresholds, calibrateTo) {
  const stage = STAGES[stageIdx];
  let { quanta, entropy } = state;
  let elapsed = 0, safety = 0, activeClock = 0, nextFusionAt = profile.fusionIntervalSec || Infinity;
  const src = { click: 0, auto: 0, fusion: 0 };
  const combo = profile.combo ?? 0;
  const stageMaxSec = BASE_CFG.maxHoursPerStage * 3600;
  const gate = calibrateTo ?? null;
  while (safety++ < 400000) {
    if (gate === null && entropy >= thresholds[stageIdx]) break;
    if (gate !== null && elapsed >= gate) break;
    if (elapsed >= stageMaxSec) break;
    const mods = computeMods(sk);
    const cp = clickPower(mods) * (MECHANIC_CLICK_BOOST[stage.mechanic] ?? 1);
    const eCrit = 1 + critChance(sk.crit, combo) * (critMultiplier(sk.crit, mods) - 1);
    const clickG = profile.cps * cp * eCrit * comboMult(combo) * profile.activeFraction;
    const autoG = autoRate(mods);
    const eRate = clickG * ENTROPY_CFG.wClick + autoG * ENTROPY_CFG.wAuto;
    // dt: do not skip fusion ticks; approach the gate smoothly
    let dt = 30;
    if (gate === null && eRate > 0) dt = Math.min(dt, Math.max(0.5, (thresholds[stageIdx] - entropy) / eRate / 8));
    if (gate !== null) dt = Math.min(dt, gate - elapsed);
    if (profile.fusionIntervalSec && profile.activeFraction > 0) {
      const dtToFusion = (nextFusionAt - activeClock) / profile.activeFraction;
      if (dtToFusion > 0) dt = Math.min(dt, Math.max(0.5, dtToFusion));
    }
    dt = Math.max(0.25, dt);
    quanta += (clickG + autoG) * dt;
    entropy += eRate * dt;
    src.click += clickG * ENTROPY_CFG.wClick * dt;
    src.auto += autoG * ENTROPY_CFG.wAuto * dt;
    elapsed += dt;
    activeClock += profile.activeFraction * dt;
    if (profile.fusionIntervalSec && activeClock >= nextFusionAt) {
      // Fusion: spend quanta, gain an entropy burst worth fusionValueSec of grinding
      const burst = ENTROPY_CFG.fusionValueSec * Math.max(eRate, 1e-9);
      entropy += burst; src.fusion += burst;
      quanta *= 1 - ENTROPY_CFG.fusionCostFrac;
      nextFusionAt += profile.fusionIntervalSec;
    }
    let bought = true;
    while (bought) ({ bought, quanta } = tryOnePurchase(sk, quanta, stageIdx, true));
  }
  if (stageIdx < STAGES.length - 1) sk.sp += SP_ON_ADVANCE[stageIdx] ?? 1;
  const infeasible = gate === null && entropy < thresholds[stageIdx];
  return { elapsed: infeasible ? stageMaxSec : elapsed, state: { quanta, entropy }, src, infeasible };
}

function runEntropy(profile, thresholds, calibrate = false) {
  const sk = createSkills();
  let state = { quanta: 0, entropy: 0 };
  const perStage = [], srcTotal = { click: 0, auto: 0, fusion: 0 };
  const out = [];
  for (let i = 0; i < STAGES.length; i++) {
    const r = simulateStageEntropy(i, sk, state, profile, thresholds, calibrate ? STAGES[i].realPlayTargetSec : null);
    state = r.state;
    perStage.push(r.elapsed);
    for (const k of Object.keys(srcTotal)) srcTotal[k] += r.src[k];
    if (calibrate) out.push(state.entropy);
    if (r.infeasible && !calibrate) return { total: Infinity, perStage, srcTotal, infeasibleAt: i + 1 };
  }
  return { total: perStage.reduce((a, b) => a + b, 0), perStage, srcTotal, thresholds: out };
}

function runCurrent(profile) {
  const sk = createSkills();
  let carry = 0;
  const perStage = [];
  for (let i = 0; i < STAGES.length; i++) {
    const r = simulateStageCurrent(i, sk, carry, profile);
    carry = r.carry;
    perStage.push(r.elapsed);
    if (r.infeasible) return { total: Infinity, perStage, infeasibleAt: i + 1 };
  }
  return { total: perStage.reduce((a, b) => a + b, 0), perStage };
}

// ---------------------------------------------------------------------------
// Experiment
// ---------------------------------------------------------------------------
const fmt = (s) => !Number.isFinite(s) ? 'INF' : s < 60 ? `${s.toFixed(0)}s` : s < 3600 ? `${(s / 60).toFixed(1)}m` : `${(s / 3600).toFixed(1)}h`;
const PROFILES = {
  reference: { cps: 3, activeFraction: 0.5, fusionIntervalSec: 90, combo: 80 },   // calibration target == design pacing
  idle: { cps: 0.5, activeFraction: 0.1, fusionIntervalSec: 0, combo: 0 },
  casual: { cps: 2, activeFraction: 0.3, fusionIntervalSec: 120, combo: 40 },
  active: { cps: 8, activeFraction: 0.8, fusionIntervalSec: 60, combo: 150 },
  hardcore: { cps: 15, activeFraction: 1.0, fusionIntervalSec: 40, combo: 250 },
};

// 1) Calibrate entropy thresholds so the reference profile lands exactly on design pacing
const cal = runEntropy(PROFILES.reference, null, true);
const thresholds = cal.thresholds;
console.log('=== Calibrated entropyThreshold per stage (cumulative, reference profile pinned to realPlayTargetSec) ===');
STAGES.forEach((s, i) => console.log(`stage ${String(s.id).padStart(2)} ${s.name.padEnd(20)} target ${fmt(s.realPlayTargetSec).padStart(7)}  entropyThreshold ${thresholds[i].toExponential(3)}`));

// 2) Compare profiles under both gates
console.log('\n=== Total time to finish all 16 stages ===');
console.log('profile    | CURRENT gate | ENTROPY gate | entropy src click/auto/fusion');
for (const [name, p] of Object.entries(PROFILES)) {
  const cur = runCurrent(p);
  const ent = runEntropy(p, thresholds);
  const tot = ent.srcTotal.click + ent.srcTotal.auto + ent.srcTotal.fusion;
  const share = tot > 0 ? ['click', 'auto', 'fusion'].map((k) => `${((ent.srcTotal[k] / tot) * 100).toFixed(0)}%`).join('/') : '-';
  console.log(`${name.padEnd(10)} | ${fmt(cur.total).padStart(12)}${cur.infeasibleAt ? ` (stuck@${cur.infeasibleAt})` : ''} | ${fmt(ent.total).padStart(12)}${ent.infeasibleAt ? ` (stuck@${ent.infeasibleAt})` : ''} | ${share}`);
}

// 3) CHECKPOINT A — pure CPS sensitivity (reproduces the BALANCE_ANALYSIS 1.5% experiment):
// identical profiles except cps 0.5 vs 20; no fusion, af fixed. If clicking is coupled to
// progression, total time must drop a lot; today it barely moves.
console.log('\n=== CHECKPOINT A — CPS sensitivity (cps 0.5 -> 20, af 0.5, no fusion) ===');
const slow = { cps: 0.5, activeFraction: 0.5, fusionIntervalSec: 0, combo: 80 };
const fast = { cps: 20, activeFraction: 0.5, fusionIntervalSec: 0, combo: 80 };
const curSlow = runCurrent(slow).total, curFast = runCurrent(fast).total;
const entSlow = runEntropy(slow, thresholds).total, entFast = runEntropy(fast, thresholds).total;
const pct = (a, b) => Number.isFinite(a) && Number.isFinite(b) ? `${(((a - b) / a) * 100).toFixed(1)}% faster` : 'n/a';
console.log(`CURRENT gate: ${fmt(curSlow)} -> ${fmt(curFast)}  (${pct(curSlow, curFast)})`);
console.log(`ENTROPY gate: ${fmt(entSlow)} -> ${fmt(entFast)}  (${pct(entSlow, entFast)})`);

// 4) CHECKPOINT B — agency spread across casual/active/hardcore (finite profiles)
const ratio = (a, b) => Number.isFinite(a) && Number.isFinite(b) ? `${(a / b).toFixed(1)}x` : 'n/a';
const curCas = runCurrent(PROFILES.casual).total, curHard = runCurrent(PROFILES.hardcore).total;
const entCas = runEntropy(PROFILES.casual, thresholds).total, entHard = runEntropy(PROFILES.hardcore, thresholds).total;
console.log('\n=== CHECKPOINT B — casual/hardcore spread ===');
console.log(`CURRENT gate: ${ratio(curCas, curHard)}   ENTROPY gate: ${ratio(entCas, entHard)}`);
