#!/usr/bin/env node
// Entropy-gate pacing simulator — Phase 4-2 (gear-only economy, no skill tree).
//
// The skill tree is removed (it has been unreachable UI since the Entity Lab
// landed); gear is the only growth besides prestige. Power model:
//   E = (stage - 1) + gateProgress01 (shared exponent, Phase 4-1)
//   click % effects × STAGE_POWER_BASE^E (2.0), rift auto × AUTO_BASE^E (8)
//   clicks × CLICK_OUTPUT_MULTIPLIER (re-anchored: no more 2^level skill base)
//   crit from gear substats (critMult gear capped) + combo
//   fusion burst × min(1, costPaid / (anchor × 0.1))
//   enhance levels DERIVED from spending ≤50% of stage income (honest sink)
//
// Calibration: per stage, binary-search the entropy span so the reference
// profile crosses it in exactly realPlayTargetSec under real gate dynamics.
// Then verify the design invariants across profiles.
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

// Effective click multipliers of the stage mechanics (aligned to real onClick behavior).
const MECHANIC_CLICK_BOOST = {
  matter_asymmetry: 1.2, fusion_window: 1.3, recombination: 1.2, reionization: 1.4,
  galaxy_weaving: 1.3, planet_formation: 1.2, life_evolution: 1.5, red_giant: 1.5,
  remnant_cooling: 1.0, proton_decay: 2.4, hawking_radiation: 3.5, ending_choice: 1.0,
  click_basic: 1.0, dark_age: 1.0, first_stars: 1.0,
};

// ---------------------------------------------------------------------------
// Balance knobs (Phase 4-2 — these are the values to write into balance.ts)
// ---------------------------------------------------------------------------
// FIXED-EFFECT OVERHAUL (P0): per-stage scaling neutralised to 1.0 (lockstep
// with balance.ts). Item effect == printed base%; growth comes from levels.
const STAGE_POWER_BASE = 1.0;
const AUTO_STAGE_POWER_BASE = 1.0;
const ANCHOR1 = 1725;
const ENTITY_COST_ANCHORS = [0, 1725, 3800, 52000, 750000, 1.1e7, 1.6e8, 2.4e9, 3.7e10, 6e11, 1e13, 1.8e14, 3.5e15, 6.5e16, 1.3e18, 2.7e19, 5.6e20];
// Re-anchored entropy weights: without the 2^level skill click base, raw click
// income shrinks vs auto — keep active play dominant via the gate weights.
const ENTROPY_CFG = { wClick: 0.6, wAuto: 0.04, fusionValueSec: 30, fusionCostFrac: 0.10, burstRefCostFrac: 0.10 };
// Click output re-anchor (skill 2^N base removed).
const CLICK_OUTPUT_MULTIPLIER = 15;
// Crit (gear-only): chance from substats + combo; mult bounded.
const CRIT_MULT_GEAR_CAP = 5;
const CRIT_MAX = 0.5;
const RARITY_GATES = { common: 1, rare: 3, epic: 7, legendary: 12 };
const GATE_RAMP = 3;
// Enhance sink (honest levels): cost = anchor(player) × rarityFactor × 1.5 × 1.9^(L-1)
const ENHANCE_COST_FACTOR = 1.5;
const ENHANCE_COST_GROWTH = 2.2;
// P1 강화석: Lv1→5 matter, Lv5+ stones (minted by failed fusions). The stone
// budget per stage = expected fusions × fail rate × stones-per-fail(best rarity).
const ENHANCE_STONE_THRESHOLD = 5;
const ENHANCE_STONE_BASE = { common: 2, rare: 3, epic: 5, legendary: 8 };
const ENHANCE_STONE_GROWTH = 1.5;
const SIM_FUSION_FAIL_RATE = 0.55; // ≈ 1 − (UP1+UP2) at the flat P1 odds
const FUSION_FAIL_STONES = { common: 1, rare: 2, epic: 4, legendary: 7 };
const ENHANCE_BUDGET_FRAC = 0.5; // spend ≤ this share of stage income on levels
const RARITY_FACTOR = { common: 0.07, rare: 0.32, epic: 1.5, legendary: 3.6 };
const LEVEL_CAPS = { common: 10, rare: 15, epic: 20, legendary: 25 };

const comboMult = (combo) => 1 + Math.min(7, Math.floor(combo / 10) * 0.4);

// ---------------------------------------------------------------------------
// Gear model — deterministic stacks per stage (gear-only economy).
// ---------------------------------------------------------------------------
const GEAR = {
  click: {
    common:    { pct: 3.75, eff: 24.5 },
    rare:      { pct: 5.5,  eff: 13.2 },
    epic:      { pct: 15.75, eff: 7.2 },
    legendary: { pct: 50,   eff: 2.0 }, // 'multiplier' type — click + crit/2
  },
  auto: {
    common:    { pct: 0.15, eff: 24.5, weight: 0.07 },
    rare:      { pct: 0.35, eff: 13.2, weight: 0.32 },
    epic:      { pct: 1.0,  eff: 7.2,  weight: 1.5 },
    legendary: { pct: 1.0,  eff: 7.2,  weight: 1.5 },
  },
};

function bestRarity(stageId) {
  if (stageId >= RARITY_GATES.legendary + GATE_RAMP - 1) return 'legendary';
  if (stageId >= RARITY_GATES.epic + GATE_RAMP - 1) return 'epic';
  if (stageId >= RARITY_GATES.rare + GATE_RAMP - 1) return 'rare';
  return 'common';
}
// Slot 2 at stage 4 (EQUIP_SLOT_UNLOCKS); slot 3 at 30 almanac entries ≈ stage 6.
const clickSlots = (s) => 1 + (s >= 4 ? 1 : 0) + (s >= 6 ? 1 : 0);
const riftSlots = (s) => 1 + (s >= 6 ? 1 : 0) + (s >= 11 ? 1 : 0);

/**
 * Stage-aware gear maturity (cold-start honest):
 * - Stages 1-2: a fresh run has NO inventory — stacks ramp from 0 over the
 *   stage (drops fill them; drop pacing is fast at 14-item pools).
 * - Tier-boundary stages (first stage where a new rarity is the best pick:
 *   5/9/14): carried gear keeps a 0.6 floor while the new tier fills.
 * - Interior stages: full carry from the previous stage (≈1.0 maturity).
 */
function maturity(stageId, p) {
  if (stageId <= 2) return Math.min(1, 0.15 + 0.85 * Math.min(1, p * 1.5));
  const tierBoundary =
    stageId === RARITY_GATES.rare + GATE_RAMP - 1 ||
    stageId === RARITY_GATES.epic + GATE_RAMP - 1 ||
    stageId === RARITY_GATES.legendary + GATE_RAMP - 1;
  if (tierBoundary) return 0.6 + 0.4 * Math.min(1, p * 2);
  return 1;
}

/**
 * Honest enhance levels: highest level whose CUMULATIVE cost fits within
 * ENHANCE_BUDGET_FRAC of the stage's expected income (≈ stage cost anchor
 * scale — quanta income tracks the anchor by construction of the curve).
 */
function derivedLevel(stageId, rarity, stoneBudget = 0) {
  const budget = ENTITY_COST_ANCHORS[stageId] * ENHANCE_BUDGET_FRAC;
  const base = ENTITY_COST_ANCHORS[stageId] * RARITY_FACTOR[rarity] * ENHANCE_COST_FACTOR;
  let total = 0;
  let level = 1;
  // Matter phase: levels up to the stone threshold (or the budget runs out).
  while (level < Math.min(ENHANCE_STONE_THRESHOLD, LEVEL_CAPS[rarity])) {
    const next = base * Math.pow(ENHANCE_COST_GROWTH, level - 1);
    if (total + next > budget) return level;
    total += next;
    level += 1;
  }
  // Stone phase: levels funded by 강화석 from fusion fails (P1).
  let stoneTotal = 0;
  while (level < LEVEL_CAPS[rarity]) {
    const over = level - ENHANCE_STONE_THRESHOLD;
    const nextStone = ENHANCE_STONE_BASE[rarity] * Math.pow(ENHANCE_STONE_GROWTH, over);
    if (stoneTotal + nextStone > stoneBudget) break;
    stoneTotal += nextStone;
    level += 1;
  }
  return level;
}
const levelMult = (level) => 1 + Math.max(0, level - 1) * 0.6;

function gearClickMult(stageId, p, stoneBudget = 0) {
  const E = (stageId - 1) + p;
  const g = Math.pow(STAGE_POWER_BASE, E);
  const r = bestRarity(stageId);
  const q = GEAR.click[r];
  const lvl = levelMult(derivedLevel(stageId, r, stoneBudget));
  const stack = (q.pct * q.eff * lvl * maturity(stageId, p) * g) / 100;
  return Math.pow(1 + stack, clickSlots(stageId));
}
function gearAutoFlat(stageId, p, stoneBudget = 0) {
  const E = (stageId - 1) + p;
  const g = Math.pow(AUTO_STAGE_POWER_BASE, E);
  const r = bestRarity(stageId);
  const q = GEAR.auto[r];
  const lvl = levelMult(derivedLevel(stageId, r, stoneBudget));
  const perSlot = q.weight * ANCHOR1 * g * (q.pct * q.eff * lvl * maturity(stageId, p)) / 100;
  const autoPowerMult = stageId >= 6 ? 1.5 : 1; // one rift slot holds Auto Power late
  return perSlot * riftSlots(stageId) * autoPowerMult;
}
/** Expected 강화석 a profile banks during a stage (drives stone-phase levels). */
function stoneBudgetFor(stage, profile) {
  if (!profile.fusionIntervalSec || profile.activeFraction <= 0) return 0;
  const fusions = (stage.realPlayTargetSec * profile.activeFraction) / profile.fusionIntervalSec;
  return fusions * SIM_FUSION_FAIL_RATE * FUSION_FAIL_STONES[bestRarity(stage.id)];
}

/**
 * Gear-only crit: substat crit chance (rare+ click gear) + combo; crit mult
 * bounded by CRIT_MULT_GEAR_CAP. `critGear` 0..1 scales how crit-focused the
 * loadout is (median 0.5 for calibration; 0 / 1 for the spread invariant).
 */
function critFactor(stageId, combo, critGear = 0.5, stoneBudget = 0) {
  const r = bestRarity(stageId);
  const statCount = { common: 0, rare: 1, epic: 2, legendary: 3 }[r];
  const rarityScale = { common: 0, rare: 1, epic: 1.5, legendary: 2.2 }[r];
  const lvl = levelMult(derivedLevel(stageId, r, stoneBudget));
  // critChance substat: base 0.4% × rarityScale × lvl per stat; assume critGear
  // share of (slots × statCount) stats are crit-flavored.
  const chanceAdd = 0.004 * rarityScale * lvl * clickSlots(stageId) * statCount * critGear;
  const chance = Math.min(CRIT_MAX, chanceAdd + combo * 0.003);
  // critMult substat: base 4% × rarityScale × lvl per stat (scales=false now).
  const multAdd = 0.04 * rarityScale * lvl * clickSlots(stageId) * statCount * critGear;
  const critMult = 1.5 * Math.min(CRIT_MULT_GEAR_CAP, 1 + multAdd);
  return 1 + chance * (critMult - 1);
}

// ---------------------------------------------------------------------------
// Entropy simulation (gear-only)
// ---------------------------------------------------------------------------
function simulateStageEntropy(stageIdx, state, profile, thresholds, calibrateTo) {
  const stage = STAGES[stageIdx];
  let { quanta, entropy } = state;
  const floor = stageIdx === 0 ? 0 : thresholds[stageIdx - 1];
  let elapsed = 0, safety = 0, activeClock = 0, nextFusionAt = profile.fusionIntervalSec || Infinity;
  const src = { click: 0, auto: 0, fusion: 0 };
  const combo = profile.combo ?? 0;
  const stageMaxSec = calibrateTo ?? 1000 * 3600;
  const stoneBudget = stoneBudgetFor(stage, profile); // P1: funds Lv5+ levels
  while (safety++ < 400000) {
    if (entropy >= thresholds[stageIdx]) break;
    if (elapsed >= stageMaxSec) break;
    const p = Math.min(1, Math.max(0, (entropy - floor) / Math.max(1e-9, thresholds[stageIdx] - floor)));
    const cp = Math.max(1, gearClickMult(stage.id, p, stoneBudget)) * CLICK_OUTPUT_MULTIPLIER * (MECHANIC_CLICK_BOOST[stage.mechanic] ?? 1);
    const eCrit = critFactor(stage.id, combo, profile.critGear ?? 0.5, stoneBudget);
    const clickG = profile.cps * cp * eCrit * comboMult(combo) * profile.activeFraction;
    const autoG = gearAutoFlat(stage.id, p, stoneBudget);
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
      const costPaid = quanta * ENTROPY_CFG.fusionCostFrac;
      const refCost = ENTITY_COST_ANCHORS[stage.id] * ENTROPY_CFG.burstRefCostFrac;
      const scale = refCost > 0 ? Math.min(1, costPaid / refCost) : 1;
      const burst = ENTROPY_CFG.fusionValueSec * Math.max(eRate, 1e-9) * scale;
      entropy += burst; src.fusion += burst;
      quanta -= costPaid;
      nextFusionAt += profile.fusionIntervalSec;
    }
    // Enhance sink: levels are derived (paid implicitly); also drain a share of
    // income so the bank doesn't balloon (purchases/enhance spending).
    quanta = Math.max(0, quanta - (clickG + autoG) * dt * 0.3);
  }
  const infeasible = entropy < thresholds[stageIdx];
  return { elapsed, state: { quanta, entropy }, src, infeasible };
}

function runEntropy(profile, thresholds) {
  let state = { quanta: 0, entropy: 0 };
  const perStage = [], srcTotal = { click: 0, auto: 0, fusion: 0 };
  const perStageSrc = [];
  for (let i = 0; i < STAGES.length; i++) {
    const r = simulateStageEntropy(i, state, profile, thresholds);
    state = r.state;
    perStage.push(r.elapsed);
    perStageSrc.push(r.src);
    for (const k of Object.keys(srcTotal)) srcTotal[k] += r.src[k];
    if (r.infeasible) return { total: Infinity, perStage, perStageSrc, srcTotal, infeasibleAt: i + 1 };
  }
  return { total: perStage.reduce((a, b) => a + b, 0), perStage, perStageSrc, srcTotal };
}

function calibrateThresholds(profile) {
  const thresholds = new Array(STAGES.length).fill(Infinity);
  let state = { quanta: 0, entropy: 0 };
  for (let i = 0; i < STAGES.length; i++) {
    const target = STAGES[i].realPlayTargetSec;
    const floor = i === 0 ? 0 : thresholds[i - 1];
    let hi = 1;
    const trySpan = (span) => {
      thresholds[i] = floor + span;
      return simulateStageEntropy(i, { ...state }, profile, thresholds, target * 50);
    };
    while (trySpan(hi).elapsed < target && hi < 1e60) hi *= 4;
    let lo = hi / 4;
    for (let iter = 0; iter < 40; iter++) {
      const mid = Math.sqrt(lo * hi);
      if (trySpan(mid).elapsed < target) lo = mid; else hi = mid;
    }
    const span = Math.sqrt(lo * hi);
    thresholds[i] = floor + span;
    state = trySpan(span).state;
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
console.log('=== Calibrated ENTROPY_THRESHOLDS (gear-only, reference pinned to realPlayTargetSec) ===');
STAGES.forEach((s, i) => console.log(`  ${String(s.id).padStart(2)}: ${thresholds[i].toExponential(3)},  // ${s.name} — target ${fmt(s.realPlayTargetSec)}`));

console.log('\n=== Profiles vs calibrated thresholds ===');
const results = {};
for (const [name, p] of Object.entries(PROFILES)) {
  const r = runEntropy(p, thresholds);
  results[name] = r;
  const tot = r.srcTotal.click + r.srcTotal.auto + r.srcTotal.fusion;
  const share = tot > 0 ? ['click', 'auto', 'fusion'].map((k) => `${((r.srcTotal[k] / tot) * 100).toFixed(0)}%`).join('/') : '-';
  console.log(`${name.padEnd(10)} | ${fmt(r.total).padStart(7)}${r.infeasibleAt ? ` (stuck@${r.infeasibleAt})` : ''} | click/auto/fusion ${share}`);
}

// Crit spread: best-crit vs no-crit loadout (reference otherwise).
const noCrit = runEntropy({ ...PROFILES.reference, critGear: 0 }, thresholds);
const maxCrit = runEntropy({ ...PROFILES.reference, critGear: 1 }, thresholds);

// Threshold-relative meta constants (write into balance.ts).
const BIG_CRUNCH_KB = 0.5 * thresholds[2];   // reachable mid-stage-3 (as v16)
const BIG_RIP_KB = 1.3 * thresholds[8];      // between st9/st10 gates (flat P0 ladder)
console.log('\n=== Threshold-relative meta constants ===');
console.log(`BIG_CRUNCH_ENTROPY_KB = ${BIG_CRUNCH_KB.toExponential(3)} (0.5 × T[3])`);
console.log(`BIG_RIP_ENTROPY_KB    = ${BIG_RIP_KB.toExponential(3)} (1.3 × T[9])`);
// Prestige costs: anchored so Lv1 ≈ first affordable at stage 8 (as v16), ×~5/level.
const PRESTIGE_BASE = thresholds[7] * 0.5;
console.log(`PRESTIGE_COSTS_KB     = [${[0, 1, 2, 3, 4].map((i) => (PRESTIGE_BASE * Math.pow(5, i)).toExponential(2)).join(', ')}] (0.5 × T[8] × 5^level)`);
console.log(`endgame eyeball: entropy@16 = ${thresholds[15].toExponential(2)}, mass reward ≈ entropy^0.4 = ${Math.pow(thresholds[15], 0.4).toExponential(2)}`);

// Invariants
let failures = 0;
const assertish = (ok, msg) => { if (!ok) { failures++; console.log(`  ✗ ${msg}`); } else console.log(`  ✓ ${msg}`); };
console.log('\n=== Invariants ===');
const ref = results.reference;
let worst = 0;
ref.perStage.forEach((t, i) => { worst = Math.max(worst, t / STAGES[i].realPlayTargetSec, STAGES[i].realPlayTargetSec / t); });
assertish(worst <= 1.5, `reference within 1.5× of target at every stage (worst ${worst.toFixed(2)}×)`);
let minActiveShare = 1;
ref.perStageSrc.forEach((s) => {
  const tot = s.click + s.auto + s.fusion;
  if (tot > 0) minActiveShare = Math.min(minActiveShare, (s.click + s.fusion) / tot);
});
assertish(minActiveShare >= 0.5, `active (click+fusion) entropy share ≥ 50% every stage (min ${(minActiveShare * 100).toFixed(0)}%)`);
// Idle viability + active-play premium: the game's own backlog wants idle
// progression HELPED (offline entropy floor, 4-4), not hard-walled — walling
// idle would require crushing wAuto until rift gear stops mattering at all.
// So: idle must reach stage 12+, and active play must pay ≥4× time savings.
const idleReach = results.idle.infeasibleAt ?? STAGES.length + 1;
assertish(idleReach >= 12, `idle reaches stage ≥ 12 (reaches ${idleReach})`);
const idlePremium = results.idle.total / results.reference.total;
assertish(!Number.isFinite(results.idle.total) || idlePremium >= 4,
  `active play pays: idle ≥ 4× slower than reference (${Number.isFinite(idlePremium) ? idlePremium.toFixed(1) : 'INF'}×)`);
const spread = results.casual.total / results.hardcore.total;
assertish(spread >= 2 && spread <= 150, `casual/hardcore spread in [2, 150]× (${spread.toFixed(1)}×) — 4-4 compresses`);
const critSpread = noCrit.total / maxCrit.total;
assertish(Number.isFinite(critSpread) && critSpread <= 3, `best-crit vs no-crit total time ≤ 3× (${critSpread.toFixed(2)}×)`);

console.log(failures === 0 ? '\nALL INVARIANTS PASS' : `\n${failures} INVARIANT(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
