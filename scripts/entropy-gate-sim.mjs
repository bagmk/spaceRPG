#!/usr/bin/env node
// Entropy-gate pacing simulator — Phase 4-1 (stage-independent gear power).
//
// Models the post-redesign economy: skill tracks (still present until Phase
// 4-2) PLUS equipped gear whose power rides the SHARED player-stage exponent
//   E = (stage - 1) + gateProgress01
//   click % effects × STAGE_POWER_BASE^E (2.0), rift auto × AUTO_BASE^E (8)
// and the new fusion burst rule (burst × min(1, costPaid / (anchor × 0.1))).
//
// Calibration: per stage, binary-search the entropy span so the reference
// profile crosses it in exactly realPlayTargetSec under REAL gate dynamics
// (income rises ×8 across the gate window — the search absorbs the
// exponential feedback exactly). Then re-run all profiles against the
// thresholds and assert the design invariants.
//
// Run: node scripts/entropy-gate-sim.mjs

// ---------------------------------------------------------------------------
// Stage data (design targets)
// ---------------------------------------------------------------------------
const STAGES = [
  { id: 1, name: 'Inflation', realPlayTargetSec: 30, mechanic: 'click_basic' },
  { id: 2, name: 'Baryogenesis', realPlayTargetSec: 120, mechanic: 'matter_asymmetry' },
  { id: 3, name: 'Quark-Gluon Plasma', realPlayTargetSec: 300, mechanic: 'click_basic' },
  { id: 4, name: 'Nucleosynthesis', realPlayTargetSec: 360, mechanic: 'fusion_window' },
  { id: 5, name: 'Recombination', realPlayTargetSec: 540, mechanic: 'recombination' },
  { id: 6, name: 'Cosmic Dark Age', realPlayTargetSec: 1800, mechanic: 'dark_age' },
  { id: 7, name: 'First Stars', realPlayTargetSec: 3600, mechanic: 'first_stars' },
  { id: 8, name: 'Reionization', realPlayTargetSec: 5400, mechanic: 'reionization' },
  { id: 9, name: 'Galaxy Formation', realPlayTargetSec: 7200, mechanic: 'galaxy_weaving' },
  { id: 10, name: 'Solar System', realPlayTargetSec: 10800, mechanic: 'planet_formation' },
  { id: 11, name: 'Life on Earth', realPlayTargetSec: 14400, mechanic: 'life_evolution' },
  { id: 12, name: 'Death of Star', realPlayTargetSec: 21600, mechanic: 'red_giant' },
  { id: 13, name: 'Stelliferous End', realPlayTargetSec: 36000, mechanic: 'remnant_cooling' },
  { id: 14, name: 'Degenerate Era', realPlayTargetSec: 54000, mechanic: 'proton_decay' },
  { id: 15, name: 'Black Hole Era', realPlayTargetSec: 86400, mechanic: 'hawking_radiation' },
  { id: 16, name: 'The End', realPlayTargetSec: 117450, mechanic: 'ending_choice' },
];

const MECHANIC_CLICK_BOOST = {
  matter_asymmetry: 1.2, fusion_window: 1.3, recombination: 1.2, reionization: 1.4,
  galaxy_weaving: 1.3, planet_formation: 1.2, life_evolution: 1.5, red_giant: 1.5,
  remnant_cooling: 1.0, proton_decay: 2.4, hawking_radiation: 3.5, ending_choice: 1.0,
  click_basic: 1.0, dark_age: 1.0, first_stars: 1.0,
};

// ---------------------------------------------------------------------------
// Balance constants (mirror src/game/balance.ts — keep in sync)
// ---------------------------------------------------------------------------
const STAGE_POWER_BASE = 2.0;
const AUTO_STAGE_POWER_BASE = 8;
const ANCHOR1 = 1725;
const ENTITY_COST_ANCHORS = [0, 1725, 3800, 52000, 750000, 1.1e7, 1.6e8, 2.4e9, 3.7e10, 6e11, 1e13, 1.8e14, 3.5e15, 6.5e16, 1.3e18, 2.7e19, 5.6e20];
const ENTROPY_CFG = { wClick: 0.5, wAuto: 0.25, fusionValueSec: 30, fusionCostFrac: 0.10, burstRefCostFrac: 0.10 };
const RARITY_GATES = { common: 1, rare: 3, epic: 7, legendary: 12 };
const GATE_RAMP = 3; // stages from gate to full drop weight

// ---------------------------------------------------------------------------
// Skill engine (unchanged from Phase 0 — skills survive until Phase 4-2)
// ---------------------------------------------------------------------------
const CROSS_MULTS = {
  5: { click: 1.4, auto: 1.4, crit: 1.15, time: 1.25 }, 10: { click: 1.8, auto: 1.8, crit: 1.3, time: 1.6 },
  15: { click: 2.4, auto: 2.4, crit: 1.5, time: 2.1 }, 20: { click: 3.2, auto: 3.2, crit: 1.75, time: 2.8 },
  25: { click: 4.4, auto: 4.4, crit: 2.05, time: 3.6 }, 30: { click: 6, auto: 6, crit: 2.5, time: 5 },
};
const CROSS_SP = { 5: 1, 10: 1, 15: 2, 20: 2, 25: 3, 30: 3 };
const STAGE_LEVEL_TARGETS = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 29, 29, 29, 29, 29, 30];
const SP_ON_ADVANCE = [1, 1, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 5, 5, 6];
const BASE_CFG = {
  skillCostBase: { click: 3, auto: 3, crit: 3 },
  clickPowerPerLevel: 2, autoRatePerLevel: 2,
  critChancePerLevel: 0.015, critMultBase: 1.5, critMultPerLevel: 0.5, critChanceCap: 0.5,
  comboMultMax: 8.0, comboMultPer10: 0.4,
  maxSkillLevel: 50, maxHoursPerStage: 1000,
};
const POWER_LEVEL_COSTS_AFTER_30 = [
  1e15, 5e15, 2e16, 8e16, 3e17, 1e18, 4e18, 1.6e19, 6e19, 2e20,
  8e20, 3e21, 1e22, 3e22, 1e23, 3e23, 1e24, 3e24, 1e25, 3e25,
];

function createSkills() { return { click: 0, auto: 0, crit: 0, crossNodes: new Set(), sp: 0 }; }

function computeSkillMods(sk) {
  let clickMult = Math.pow(BASE_CFG.clickPowerPerLevel, sk.click);
  let autoAdd = sk.auto > 0 ? Math.pow(BASE_CFG.autoRatePerLevel, sk.auto) : 0;
  let autoMult = 1, critMultMult = 1;
  for (const node of sk.crossNodes) {
    const tier = parseInt(node.split('lv')[1]);
    const track = node.split('_')[0];
    const m = CROSS_MULTS[tier]?.[track];
    if (!m) continue;
    if (track === 'click') clickMult *= m;
    else if (track === 'auto') autoMult *= m;
    else if (track === 'crit') critMultMult *= m;
  }
  return { clickMult, autoAdd, autoMult, critMultMult };
}
const critChance = (L, combo) => Math.min(BASE_CFG.critChanceCap, L * BASE_CFG.critChancePerLevel + combo * 0.003);
const critMultiplier = (L, m) => (BASE_CFG.critMultBase + L * BASE_CFG.critMultPerLevel) * m.critMultMult;
const comboMult = (combo) => 1 + Math.min(BASE_CFG.comboMultMax - 1, Math.floor(combo / 10) * BASE_CFG.comboMultPer10);

function trackCost(t, L) {
  if (L > 30) return POWER_LEVEL_COSTS_AFTER_30[Math.max(0, L - 31)] ?? POWER_LEVEL_COSTS_AFTER_30.at(-1);
  return Math.floor(Math.pow(BASE_CFG.skillCostBase[t], Math.max(0, L - 1)));
}
function trackUnlocked(track, stageIdx) {
  const stageId = stageIdx + 1;
  if (track === 'click') return true;
  if (track === 'auto') return stageId >= 3;
  if (track === 'crit') return stageId >= 4;
  return false;
}
function tryOnePurchase(sk, quanta, stageIdx) {
  const tracks = ['click', 'auto', 'crit'];
  for (const tier of [5, 10, 15, 20, 25, 30]) {
    for (const track of tracks) {
      const id = `${track}_lv${tier}`;
      if (sk.crossNodes.has(id)) continue;
      if (sk[track] < tier || !trackUnlocked(track, stageIdx)) continue;
      if (sk.sp < CROSS_SP[tier]) continue;
      sk.sp -= CROSS_SP[tier]; sk.crossNodes.add(id);
      return { bought: true, quanta };
    }
  }
  const target = Math.min(BASE_CFG.maxSkillLevel, STAGE_LEVEL_TARGETS[stageIdx] ?? BASE_CFG.maxSkillLevel);
  const order = tracks.filter((t) => trackUnlocked(t, stageIdx))
    .sort((a, b) => (sk[a] >= target) - (sk[b] >= target) || sk[a] - sk[b] || trackCost(a, sk[a] + 1) - trackCost(b, sk[b] + 1));
  for (const track of order) {
    if (sk[track] >= target) continue;
    const cost = trackCost(track, sk[track] + 1);
    if (cost > quanta) continue;
    sk[track] += 1;
    return { bought: true, quanta: quanta - cost };
  }
  return { bought: false, quanta };
}

// ---------------------------------------------------------------------------
// Gear model (Phase 4-1) — deterministic steady-state stacks per stage.
// Drops accrue from play; the player equips the best available rarity. Stack
// quality = per-copy% × soft-capped effective count × level multiplier.
// effCount steady state ≈ maxCount + sqrt(maxCount) (stacks roughly double
// the cap over a stage); levels from the fusion dup-sink + enhancement.
// ---------------------------------------------------------------------------
const GEAR = {
  // value%/copy (post-rebalance authored medians) and stack parameters.
  click: {
    common:    { pct: 3.75, eff: 24.5, lvl: 2.0 },
    rare:      { pct: 5.5,  eff: 13.2, lvl: 2.5 },
    epic:      { pct: 15.75, eff: 7.2, lvl: 3.0 },
    legendary: { pct: 50,   eff: 2.0,  lvl: 4.0 }, // 'multiplier' type — click + crit/2
  },
  auto: { // rarityWeight = ENTITY_BASE_COST_FACTOR
    common:    { pct: 0.15, eff: 24.5, lvl: 2.0, weight: 0.07 },
    rare:      { pct: 0.35, eff: 13.2, lvl: 2.5, weight: 0.32 },
    epic:      { pct: 1.0,  eff: 7.2,  lvl: 3.0, weight: 1.5 },
    legendary: { pct: 1.0,  eff: 7.2,  lvl: 3.0, weight: 1.5 }, // legendaries are multiplier-type; rift keeps epics
  },
};

// Best fully-ramped rarity available at a stage (gate + ramp).
function bestRarity(stageId) {
  if (stageId >= RARITY_GATES.legendary + GATE_RAMP - 1) return 'legendary';
  if (stageId >= RARITY_GATES.epic + GATE_RAMP - 1) return 'epic';
  if (stageId >= RARITY_GATES.rare + GATE_RAMP - 1) return 'rare';
  return 'common';
}
const clickSlots = (s) => 1 + (s >= 4 ? 1 : 0) + (s >= 8 ? 1 : 0);
const riftSlots = (s) => 1 + (s >= 6 ? 1 : 0) + (s >= 11 ? 1 : 0);

// Gear maturity within a stage: stacks for the CURRENT stage's tier fill over
// ~half the stage; carried gear from earlier stages keeps the floor at ~60%.
const maturity = (p) => 0.6 + 0.4 * Math.min(1, p * 2);

function gearClickMult(stageId, p) {
  const E = (stageId - 1) + p;
  const g = Math.pow(STAGE_POWER_BASE, E);
  const q = GEAR.click[bestRarity(stageId)];
  const stack = (q.pct * q.eff * q.lvl * maturity(p) * g) / 100;
  return Math.pow(1 + stack, clickSlots(stageId));
}
function gearAutoFlat(stageId, p) {
  const E = (stageId - 1) + p;
  const g = Math.pow(AUTO_STAGE_POWER_BASE, E);
  const q = GEAR.auto[bestRarity(stageId)];
  const perSlot = q.weight * ANCHOR1 * g * (q.pct * q.eff * q.lvl * maturity(p)) / 100;
  // One rift slot tends to hold an Auto Power (auto_mult) stack late: ~×1.5.
  const autoPowerMult = stageId >= 6 ? 1.5 : 1;
  return perSlot * riftSlots(stageId) * autoPowerMult;
}

// ---------------------------------------------------------------------------
// Entropy simulation
// ---------------------------------------------------------------------------
function simulateStageEntropy(stageIdx, sk, state, profile, thresholds, calibrateTo) {
  const stage = STAGES[stageIdx];
  let { quanta, entropy } = state;
  const floor = stageIdx === 0 ? 0 : thresholds[stageIdx - 1];
  let elapsed = 0, safety = 0, activeClock = 0, nextFusionAt = profile.fusionIntervalSec || Infinity;
  const src = { click: 0, auto: 0, fusion: 0 };
  const combo = profile.combo ?? 0;
  const stageMaxSec = calibrateTo ?? BASE_CFG.maxHoursPerStage * 3600;
  while (safety++ < 400000) {
    if (entropy >= thresholds[stageIdx]) break;
    if (elapsed >= stageMaxSec) break;
    // Gate progress: real entropy progress against the stage threshold.
    const p = Math.min(1, Math.max(0, (entropy - floor) / Math.max(1e-9, thresholds[stageIdx] - floor)));
    const mods = computeSkillMods(sk);
    const cp = Math.max(1, mods.clickMult) * gearClickMult(stage.id, p) * (MECHANIC_CLICK_BOOST[stage.mechanic] ?? 1);
    const eCrit = 1 + critChance(sk.crit, combo) * (critMultiplier(sk.crit, mods) - 1);
    const clickG = profile.cps * cp * eCrit * comboMult(combo) * profile.activeFraction;
    const autoG = Math.max(0, mods.autoAdd * mods.autoMult) + gearAutoFlat(stage.id, p);
    const eRate = clickG * ENTROPY_CFG.wClick + autoG * ENTROPY_CFG.wAuto;
    let dt = 30;
    if (eRate > 0) dt = Math.min(dt, Math.max(0.5, (thresholds[stageIdx] - entropy) / eRate / 8));
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
      // Phase 4-1 burst rule: scaled by cost paid vs the player-stage reference.
      const costPaid = quanta * ENTROPY_CFG.fusionCostFrac;
      const refCost = ENTITY_COST_ANCHORS[stage.id] * ENTROPY_CFG.burstRefCostFrac;
      const scale = refCost > 0 ? Math.min(1, costPaid / refCost) : 1;
      const burst = ENTROPY_CFG.fusionValueSec * Math.max(eRate, 1e-9) * scale;
      entropy += burst; src.fusion += burst;
      quanta -= costPaid;
      nextFusionAt += profile.fusionIntervalSec;
    }
    let bought = true;
    while (bought) ({ bought, quanta } = tryOnePurchase(sk, quanta, stageIdx));
  }
  if (stageIdx < STAGES.length - 1) sk.sp += SP_ON_ADVANCE[stageIdx] ?? 1;
  const infeasible = entropy < thresholds[stageIdx];
  return { elapsed, state: { quanta, entropy }, src, infeasible };
}

function runEntropy(profile, thresholds) {
  const sk = createSkills();
  let state = { quanta: 0, entropy: 0 };
  const perStage = [], srcTotal = { click: 0, auto: 0, fusion: 0 };
  const perStageSrc = [];
  for (let i = 0; i < STAGES.length; i++) {
    const r = simulateStageEntropy(i, sk, state, profile, thresholds);
    state = r.state;
    perStage.push(r.elapsed);
    perStageSrc.push(r.src);
    for (const k of Object.keys(srcTotal)) srcTotal[k] += r.src[k];
    if (r.infeasible) return { total: Infinity, perStage, perStageSrc, srcTotal, infeasibleAt: i + 1 };
  }
  return { total: perStage.reduce((a, b) => a + b, 0), perStage, perStageSrc, srcTotal };
}

// Per-stage span binary search: find thresholds so the reference profile
// crosses each stage in exactly realPlayTargetSec under real gate dynamics.
// State (skills/quanta/entropy) carries across stages from the accepted run.
function calibrateThresholds(profile) {
  const thresholds = new Array(STAGES.length).fill(Infinity);
  const sk = createSkills();
  let state = { quanta: 0, entropy: 0 };
  for (let i = 0; i < STAGES.length; i++) {
    const target = STAGES[i].realPlayTargetSec;
    const floor = i === 0 ? 0 : thresholds[i - 1];
    let lo = 1e-6, hi = 1; // span bounds, grown geometrically until too slow
    const trySpan = (span) => {
      thresholds[i] = floor + span;
      const skCopy = { ...sk, crossNodes: new Set(sk.crossNodes) };
      const r = simulateStageEntropy(i, skCopy, { ...state }, profile, thresholds, target * 50);
      return { r, skCopy };
    };
    while (trySpan(hi).r.elapsed < target && hi < 1e60) hi *= 4;
    lo = hi / 4;
    for (let iter = 0; iter < 40; iter++) {
      const mid = Math.sqrt(lo * hi); // geometric midpoint (spans are exponential)
      if (trySpan(mid).r.elapsed < target) lo = mid; else hi = mid;
    }
    const span = Math.sqrt(lo * hi);
    thresholds[i] = floor + span;
    const accepted = trySpan(span);
    state = accepted.r.state;
    sk.click = accepted.skCopy.click; sk.auto = accepted.skCopy.auto; sk.crit = accepted.skCopy.crit;
    sk.sp = accepted.skCopy.sp; sk.crossNodes = accepted.skCopy.crossNodes;
  }
  return thresholds;
}

// ---------------------------------------------------------------------------
// Calibrate + verify
// ---------------------------------------------------------------------------
const fmt = (s) => !Number.isFinite(s) ? 'INF' : s < 60 ? `${s.toFixed(0)}s` : s < 3600 ? `${(s / 60).toFixed(1)}m` : `${(s / 3600).toFixed(1)}h`;
const PROFILES = {
  reference: { cps: 3, activeFraction: 0.5, fusionIntervalSec: 90, combo: 80 },
  idle: { cps: 0.5, activeFraction: 0.1, fusionIntervalSec: 0, combo: 0 },
  casual: { cps: 2, activeFraction: 0.3, fusionIntervalSec: 120, combo: 40 },
  active: { cps: 8, activeFraction: 0.8, fusionIntervalSec: 60, combo: 150 },
  hardcore: { cps: 15, activeFraction: 1.0, fusionIntervalSec: 40, combo: 250 },
};

const thresholds = calibrateThresholds(PROFILES.reference);
console.log('=== Calibrated ENTROPY_THRESHOLDS (reference pinned to realPlayTargetSec) ===');
STAGES.forEach((s, i) => console.log(`  ${String(s.id).padStart(2)}: ${thresholds[i].toExponential(3)},  // ${s.name} — target ${fmt(s.realPlayTargetSec)}`));

console.log('\n=== Profiles vs calibrated thresholds (REAL gate progress) ===');
console.log('profile    | total | entropy src click/auto/fusion');
const results = {};
for (const [name, p] of Object.entries(PROFILES)) {
  const r = runEntropy(p, thresholds);
  results[name] = r;
  const tot = r.srcTotal.click + r.srcTotal.auto + r.srcTotal.fusion;
  const share = tot > 0 ? ['click', 'auto', 'fusion'].map((k) => `${((r.srcTotal[k] / tot) * 100).toFixed(0)}%`).join('/') : '-';
  console.log(`${name.padEnd(10)} | ${fmt(r.total).padStart(7)}${r.infeasibleAt ? ` (stuck@${r.infeasibleAt})` : ''} | ${share}`);
}

// Assertions (design invariants from the Phase 4-1 review)
let failures = 0;
const assertish = (ok, msg) => { if (!ok) { failures++; console.log(`  ✗ ${msg}`); } else console.log(`  ✓ ${msg}`); };
console.log('\n=== Invariants ===');
// 1. Reference profile lands near target at every stage (self-consistency of
//    the calibration fixed point — real gate progress vs time-proportional).
const ref = results.reference;
let worst = 0;
ref.perStage.forEach((t, i) => { worst = Math.max(worst, t / STAGES[i].realPlayTargetSec, STAGES[i].realPlayTargetSec / t); });
assertish(worst <= 1.5, `reference within 1.5× of target at every stage (worst ${worst.toFixed(2)}×)`);
// 2. Active play dominates: click+fusion share ≥ 50% for the reference at
//    every stage (the entropy gate must reward active play).
let minActiveShare = 1;
ref.perStageSrc.forEach((s) => {
  const tot = s.click + s.auto + s.fusion;
  if (tot > 0) minActiveShare = Math.min(minActiveShare, (s.click + s.fusion) / tot);
});
assertish(minActiveShare >= 0.5, `active (click+fusion) entropy share ≥ 50% every stage (min ${(minActiveShare * 100).toFixed(0)}%)`);
// 3. Idle floor parity: the pre-redesign economy stalled idle at stage 14;
//    Phase 4-1 must not regress below stage 12 (the proper idle floor is a
//    Phase 4-4 work item — offline entropy floor).
const idleReach = results.idle.infeasibleAt ?? STAGES.length + 1;
assertish(idleReach >= 12, `idle reaches stage ≥ 12 before stalling (reaches ${idleReach})`);
// 4. Casual/hardcore spread bounded near current (~123×); compression is a
//    Phase 4-4 lever (wClick:wAuto, fusionValueSec, late cost wall).
const spread = results.casual.total / results.hardcore.total;
assertish(spread >= 2 && spread <= 150, `casual/hardcore spread in [2, 150]× (${spread.toFixed(1)}×) — 4-4 compresses`);

console.log(failures === 0 ? '\nALL INVARIANTS PASS' : `\n${failures} INVARIANT(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
