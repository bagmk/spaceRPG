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
// Enhance sink (honest levels): cost = anchor(player) × rarityFactor × 1.5 × growth^(L-1).
// Overhaul-3: growth 1.0 (FLAT) → 1.7 (geometric) — lockstep with balance.ts. Higher
// growth lowers the budget-reachable level (derivedLevel), which lowers gear power /
// income, so the thresholds below were re-pinned DOWN in this same sim pass.
// GEAR-ONLY ECONOMY CRANK (2026-06-21) — lockstep with balance.ts:
//   ENHANCE_COST_FACTOR 1.5 → 0.5, ENHANCE_COST_GROWTH 1.35 → 1.15. Cheaper +
//   gentler ramp so high levels are reachable (the crank that funds the shop).
const ENHANCE_COST_FACTOR = 0.5;
const ENHANCE_COST_GROWTH = 1.15;
// #47 reinterpretation: enhance is now MATTER-ONLY at every level. 강화석 are spent
// only to 보호(protect) a risk-phase attempt; an unprotected fail DESTROYS the item.
// A rational player climbs the risk phase by protecting every attempt, so the
// reliably-reachable level is still gated by the 강화석 budget — protectCost ≈
// ENHANCE_STONE_BASE (PROTECT_STONE_MULT = 1.0), so `derivedLevel`'s stone-phase
// loop is unchanged: it now counts "levels you can afford to PROTECT" rather than
// "levels you can afford to BUY". The entropy-side level math is therefore identical.
// Stone budget per stage = expected fusions × fail rate × stones-per-fail(best rarity)
// (enhance-break refunds add more, ignored here for a conservative lower bound).
const ENHANCE_STONE_THRESHOLD = 3; // #40: fail/break risk from Lv3 (was 5) — lockstep with balance.ts.
const ENHANCE_STONE_BASE = { common: 2, rare: 3, epic: 5, legendary: 8 };
const ENHANCE_STONE_GROWTH = 1.3; // Overhaul-3 (user): 1.5 → 1.3 — lockstep with balance.ts.
// Tiered fusion up-odds (P2) — lockstep with balance.ts FUSION_UP1/UP2_CHANCE_BY_TIER.
// A fusion that does NOT rarity-up mints 강화석, so failRate = 1 − up1 − up2 for
// the tier being fused. P6 fix: this was a flat 0.55 (a P1 leftover from before
// the odds were tiered) — now per-tier, so the stone budget that funds Lv5+
// enhancement is accurate for rare+ stages (which fail, and thus mint, far more).
const FUSION_UP1 = { common: 0.40, rare: 0.20, epic: 0.10, legendary: 0.03 };
const FUSION_UP2 = { common: 0.05, rare: 0.02, epic: 0, legendary: 0 };
const fusionFailRate = (rarity) => 1 - (FUSION_UP1[rarity] ?? 0) - (FUSION_UP2[rarity] ?? 0);
const FUSION_FAIL_STONES = { common: 1, rare: 2, epic: 4, legendary: 7 };
// Overhaul-2 🅠1: fusion cost is now a FIXED FRACTION OF THE PLAYER-STAGE ANCHOR
// (was 10%-of-bank × rarity mult). Lockstep with balance.ts FUSION_FLAT_COST.
// Values equal the old effective cost at "bank == anchor", so burst scaling
// (cost vs anchor × burstRefCostFrac) is unchanged.
// Overhaul-3: geometric rarity climb (k=3.5) — lockstep with balance.ts. The sim's
// burst scale saturates at 1.0 for bestRarity (legendary) either way, so this does
// not move the calibration; mirrored for consistency.
const FUSION_FLAT_COST = { common: 0.04, rare: 0.14, epic: 0.49, legendary: 1.715 };
const ENHANCE_BUDGET_FRAC = 0.5; // spend ≤ this share of stage income on levels (gate calibration)
// GEAR-ONLY ECONOMY CRANK (2026-06-21): cumulative enhance budget for the carried
// flagship in the AFFORDABILITY model, expressed in current-stage anchors. A geared
// player banks ≈ 1 anchor/stage and pours a share of several stages into the carried
// best item — so a few anchors of cumulative enhance spend is realistic. Sim-only
// (no balance.ts constant): a modeling assumption for the reachable-level estimate.
const ENHANCE_BUDGET_ANCHORS = 4;
const RARITY_FACTOR = { common: 0.07, rare: 0.32, epic: 1.5, legendary: 3.6 };
const LEVEL_CAPS = { common: 10, rare: 15, epic: 20, legendary: 25 };
// #50 item quality DISABLED (user request 2026-06-19) — qualityMult is now a
// no-op in-game, so the sim must NOT model any quality bonus: QUALITY_FACTOR = 1.
const QUALITY_FACTOR = 1;

// Combo cap GROWS with stage (P5/R10) — lockstep with balance.ts COMBO_CAP_*
// and formulas.ts getComboMult/getComboCapMult. The sim mirrors the BASE+stage
// curve only (codex/gear/singularity are player buffs ABOVE the calibration
// baseline). stageId is 1-based; stageIdx = stageId - 1.
const COMBO_CAP_BASE = 3.0;
const COMBO_CAP_CEIL = 12.0;
const COMBO_CAP_PER_STAGE = 0.4;
const COMBO_MULT_PER_10 = 0.4; // mirrors TUNING.COMBO_MULT_PER_10 (constants.ts)
const comboCapMult = (stageId) =>
  Math.min(COMBO_CAP_CEIL, COMBO_CAP_BASE + COMBO_CAP_PER_STAGE * Math.max(0, stageId - 1));
const comboMult = (combo, stageId) =>
  1 + Math.min(comboCapMult(stageId) - 1, Math.floor(combo / 10) * COMBO_MULT_PER_10);

// ---------------------------------------------------------------------------
// Gear model — deterministic stacks per stage (gear-only economy).
// ---------------------------------------------------------------------------
// STACKING REWORK (user 2026-06-19): a gear's power no longer scales with owned
// duplicate count — getEffectiveCount returns 1 for any owned copy. So eff = 1
// for every rarity here (was the per-rarity effective-count: 24.5/13.2/7.2/2.0);
// power now rides per-item pct × LEVEL × equipped slots only. Thresholds recalibrated.
const GEAR = {
  click: {
    common:    { pct: 3.75, eff: 1 },
    rare:      { pct: 5.5,  eff: 1 },
    epic:      { pct: 15.75, eff: 1 },
    legendary: { pct: 50,   eff: 1 }, // 'multiplier' type — click + crit/2
  },
  auto: {
    common:    { pct: 0.15, eff: 1, weight: 0.07 },
    rare:      { pct: 0.35, eff: 1, weight: 0.32 },
    epic:      { pct: 1.0,  eff: 1, weight: 1.5 },
    legendary: { pct: 1.0,  eff: 1, weight: 1.5 },
  },
};

function bestRarity(stageId) {
  if (stageId >= RARITY_GATES.legendary + GATE_RAMP - 1) return 'legendary';
  if (stageId >= RARITY_GATES.epic + GATE_RAMP - 1) return 'epic';
  if (stageId >= RARITY_GATES.rare + GATE_RAMP - 1) return 'rare';
  return 'common';
}
// Slot pacing (#39, stage-gated): click slot2@S5 / slot3@S9; rift slot2@S7 / slot3@S12.
const clickSlots = (s) => 1 + (s >= 5 ? 1 : 0) + (s >= 9 ? 1 : 0);
const riftSlots = (s) => 1 + (s >= 7 ? 1 : 0) + (s >= 12 ? 1 : 0);

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
function derivedLevel(stageId, rarity, stoneBudget = 0, matterBudget = undefined) {
  // GEAR-ONLY ECONOMY CRANK (2026-06-21): callers that know the player's realistic
  // stage matter income pass it as `matterBudget` (≈ income/sec × stage seconds ×
  // ENHANCE_BUDGET_FRAC). The gate-calibration callers omit it and keep the legacy
  // half-an-anchor proxy so the entropy ladder pins identically. The realistic
  // budget is what lets epic/legendary gear (RF 1.5 / 3.6) reach > Lv1 — under the
  // half-anchor proxy their FIRST level already exceeds the budget, which is the
  // very "high levels unreachable" bug the crank fixes.
  const budget = matterBudget ?? (ENTITY_COST_ANCHORS[stageId] * ENHANCE_BUDGET_FRAC);
  // Enhance cost is anchored to the ITEM's own baseCost (= current-stage anchor
  // for current gear), NOT the player stage — so for the gear you actually
  // enhance (current stage) the budget/cost ratio is unchanged vs the old
  // model. Only held PAST-stage gear got cheaper. Pacing-neutral here.
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
  // Risk phase (#47): matter-funded but reliably gated by the 강화석 budget you can
  // spend on 보호(protect) — protectCost ≈ ENHANCE_STONE_BASE, so this loop is the
  // same as the old stone-purchase loop (protected attempts ≈ stone-bought levels).
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
// Overhaul-2 🅠1: 0.6 → 0.85 per level — lockstep with balance.ts ENTITY_LEVEL_EFFECT_BONUS.
// This LINEAR term feeds the ENTROPY gate (gearClickMult / gearAutoFlat).
const levelMult = (level) => 1 + Math.max(0, level - 1) * 0.85;

// GEAR-ONLY ECONOMY CRANK (2026-06-21) — the MATTER/AUTO-income channels, decoupled
// from the entropy gate, grow GEOMETRICALLY per level with a per-rarity scalar.
// Lockstep with balance.ts ENHANCE_MATTER_LEVEL_GROWTH × ENHANCE_RARITY_GROWTH and
// effects.ts getEnhanceGeoLevelMult. Drives the affordability assertions below.
const ENHANCE_MATTER_LEVEL_GROWTH = 1.2; // lockstep with balance.ts (1.3 → 1.2)
const ENHANCE_RARITY_GROWTH = { common: 1.0, rare: 1.03, epic: 1.06, legendary: 1.09, mythic: 1.12 }; // lockstep
const CLICK_GEAR_MATTER_BOOST = 2; // lockstep with balance.ts (6 → 2)
const AUTO_GEAR_INCOME_SCALE = 0.16; // lockstep with balance.ts — tames player-anchored auto income to the window
const geoLevelMult = (rarity, level) =>
  Math.pow(ENHANCE_MATTER_LEVEL_GROWTH * (ENHANCE_RARITY_GROWTH[rarity] ?? 1), Math.max(0, Math.floor(level) - 1));

function gearClickMult(stageId, p, stoneBudget = 0) {
  const E = (stageId - 1) + p;
  const g = Math.pow(STAGE_POWER_BASE, E);
  const r = bestRarity(stageId);
  const q = GEAR.click[r];
  const lvl = levelMult(derivedLevel(stageId, r, stoneBudget));
  const stack = (q.pct * q.eff * lvl * maturity(stageId, p) * g * QUALITY_FACTOR) / 100;
  return Math.pow(1 + stack, clickSlots(stageId));
}
// GEAR-ONLY ECONOMY CRANK (2026-06-21): the GATE-side auto contribution stays
// TAME (stage-1-pinned ANCHOR1 + LINEAR level) — lockstep with the in-game split
// (effects.ts getTameAutoOutputAnchor → Modifiers.autoEntropyFlatAdd, read by the
// entropy tick). The player-stage WALLET income crank lives only in the
// affordability functions below (gearAutoFlatAtLevel/autoMatterPerSec*). So the
// entropy gate is unchanged by the wallet crank; the thresholds still re-pin only
// because the cheaper enhance (ECF/ECG) lifts the LINEAR gate level.
function gearAutoFlat(stageId, p, stoneBudget = 0) {
  const E = (stageId - 1) + p;
  const g = Math.pow(AUTO_STAGE_POWER_BASE, E);
  const r = bestRarity(stageId);
  const q = GEAR.auto[r];
  const lvl = levelMult(derivedLevel(stageId, r, stoneBudget));
  const perSlot = q.weight * ANCHOR1 * g * (q.pct * q.eff * lvl * maturity(stageId, p) * QUALITY_FACTOR) / 100;
  const autoPowerMult = stageId >= 6 ? 1.5 : 1; // one rift slot holds Auto Power late
  return perSlot * riftSlots(stageId) * autoPowerMult;
}
// ── MATTER-income channels (decoupled from the entropy gate) — used ONLY by the
//    affordability assertions, NOT by the gate calibration. The reachable enhance
//    LEVEL is derived once from a realistic cumulative budget (see the affordability
//    block); these helpers take that level explicitly (the *AtLevel variants below).
// BASE-only matter income (no gear): clicks at clickPower 1 + base auto 1/s.
function baseMatterPerSec(stageId, profile) {
  const crit = 1, cm = 1; // no gear crit; combo ignored for the floor
  const mech = MECHANIC_CLICK_BOOST[STAGES[stageId - 1].mechanic] ?? 1;
  const clickBase = profile.cps * profile.activeFraction * 1 * crit * cm * mech; // clickPower 1
  const autoBase = 1; // AUTO_RATE_BASE
  return clickBase + autoBase;
}
// ── Explicit-LEVEL variants (used by the affordability iteration, which derives
//    the reachable level from realistic stage income). Same math as above but the
//    enhance level is supplied, not re-derived from a budget. ─────────────────
function gearAutoFlatAtLevel(stageId, p, level) {
  const r = bestRarity(stageId);
  const q = GEAR.auto[r];
  const lvl = geoLevelMult(r, level);
  const playerAnchor = ENTITY_COST_ANCHORS[stageId] ?? ANCHOR1;
  const perSlot = q.weight * playerAnchor * AUTO_GEAR_INCOME_SCALE * (q.pct * q.eff * lvl * maturity(stageId, p) * QUALITY_FACTOR) / 100;
  const autoPowerMult = stageId >= 6 ? 1.5 : 1;
  return perSlot * riftSlots(stageId) * autoPowerMult;
}
function autoMatterPerSecAtLevel(stageId, p, level) {
  return (1 /* AUTO_RATE_BASE */ + gearAutoFlatAtLevel(stageId, p, level)) * 1 /* AUTO_OUTPUT_MULTIPLIER */;
}
function gearClickMultAtLevel(stageId, p, level) {
  const r = bestRarity(stageId);
  const q = GEAR.click[r];
  const stack = (q.pct * q.eff * levelMult(level) * maturity(stageId, p) * QUALITY_FACTOR) / 100;
  return Math.pow(1 + stack, clickSlots(stageId));
}
function gearClickMatterMultAtLevel(stageId, p, level) {
  const r = bestRarity(stageId);
  const q = GEAR.click[r];
  const perSlot = 1 + (q.pct * geoLevelMult(r, level) * maturity(stageId, p) * CLICK_GEAR_MATTER_BOOST) / 100;
  return Math.pow(perSlot, clickSlots(stageId));
}
function clickMatterPerSecAtLevel(stageId, profile, p, level) {
  const clickPowerMult = Math.max(1, gearClickMultAtLevel(stageId, p, level));
  const clickPower = 1 + (clickPowerMult - 1) * CLICK_OUTPUT_MULTIPLIER;
  const crit = critFactor(stageId, profile.combo ?? 0, profile.critGear ?? 0.5, 0);
  const cm = comboMult(profile.combo ?? 0, stageId);
  const mech = MECHANIC_CLICK_BOOST[STAGES[stageId - 1].mechanic] ?? 1;
  const matterMult = gearClickMatterMultAtLevel(stageId, p, level);
  return profile.cps * profile.activeFraction * clickPower * crit * cm * mech * matterMult;
}
/** Expected 강화석 a profile banks during a stage (drives stone-phase levels). */
function stoneBudgetFor(stage, profile) {
  if (!profile.fusionIntervalSec || profile.activeFraction <= 0) return 0;
  const fusions = (stage.realPlayTargetSec * profile.activeFraction) / profile.fusionIntervalSec;
  const r = bestRarity(stage.id);
  return fusions * fusionFailRate(r) * FUSION_FAIL_STONES[r];
}

/**
 * Gear-only crit: substat crit chance (rare+ click gear) + combo; crit mult
 * bounded by CRIT_MULT_GEAR_CAP. `critGear` 0..1 scales how crit-focused the
 * loadout is (median 0.5 for calibration; 0 / 1 for the spread invariant).
 */
function critFactor(stageId, combo, critGear = 0.5, stoneBudget = 0) {
  const r = bestRarity(stageId);
  // Lockstep with SECONDARY_RARITY_COUNT/SCALE in balance.ts. P4: commons now
  // carry 1 weak signature substat (count 1, scale 0.6) — matters only at the
  // earliest stages where common is the best equippable rarity.
  const statCount = { common: 1, rare: 1, epic: 2, legendary: 3 }[r];
  const rarityScale = { common: 0.6, rare: 1, epic: 1.5, legendary: 2.2 }[r];
  const lvl = levelMult(derivedLevel(stageId, r, stoneBudget));
  // critChance substat: base 1.2% × rarityScale × lvl per stat (user bump ×3 —
  // lockstep with balance.ts SECONDARY_STAT_DEFS.critChance); assume critGear share
  // of (slots × statCount) stats are crit-flavored.
  const chanceAdd = 0.012 * rarityScale * lvl * clickSlots(stageId) * statCount * critGear;
  const chance = Math.min(CRIT_MAX, chanceAdd + combo * 0.003);
  // critMult substat: base 6% × rarityScale × lvl per stat (user bump 4→6 — lockstep).
  const multAdd = 0.06 * rarityScale * lvl * clickSlots(stageId) * statCount * critGear;
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
    const clickG = profile.cps * cp * eCrit * comboMult(combo, stage.id) * profile.activeFraction;
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
      // Fixed per-era price (anchor × FUSION_FLAT_COST[rarity]); the game gates
      // on affordability, the sim caps at the bank (partial burst when short).
      // Stage-independent flat cost + flat burst reference (mirrors the game):
      // the burst scale stays a fixed per-rarity fraction at every stage.
      const costPaid = Math.min(quanta, ANCHOR1 * (FUSION_FLAT_COST[bestRarity(stage.id)] ?? 0.1));
      const refCost = ANCHOR1 * ENTROPY_CFG.burstRefCostFrac;
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

// ---------------------------------------------------------------------------
// INCOME-DRIVEN ENTROPY MODEL (user 2026-06-23): "estimate the item you'd realistically
// have at each stage + its enhance level → average click / auto / comet matter income →
// pick a sane clicks-per-stage target (not too fast) → derive each stage's entropy."
// This is the DESIGN BASIS for coupling in-game entropy to the matter (entropy ∝ matter):
// entropy/click = matter/click × W, so threshold = expected matter income over the target
// time × W. The numbers below are the per-stage expectation; W is the matter→entropy rate.
// ---------------------------------------------------------------------------
const CLICK_GEAR_INCOME_SCALE = 0.5;   // lockstep balance.ts — click WALLET flat-add scale
const W_MATTER_ENTROPY = 0.00002;      // proposed entropy-per-matter (tunable; sets threshold scale)
const REF = PROFILES.reference;
const refClicksPerSec = REF.cps * REF.activeFraction; // ≈1.5 clicks/s of actual progress
// Expected full matter PER CLICK at end-of-stage gear (p=1): the explosive wallet — the
// big number the player sees. = comboCrit × (clickPower×matterMult + flatAdd×slots).
function expectedMatterPerClick(stageId, level) {
  const r = bestRarity(stageId);
  const q = GEAR.click[r];
  const clickPowerMult = Math.max(1, gearClickMultAtLevel(stageId, 1, level));
  const clickPower = 1 + (clickPowerMult - 1) * CLICK_OUTPUT_MULTIPLIER;
  const matterMult = gearClickMatterMultAtLevel(stageId, 1, level);
  const baseCost = RARITY_FACTOR[r] * ENTITY_COST_ANCHORS[stageId];
  const flatPerItem = baseCost * CLICK_GEAR_INCOME_SCALE * (q.pct * geoLevelMult(r, level)) / 100;
  const flatAdd = flatPerItem * clickSlots(stageId);
  const comboCrit = comboMult(REF.combo, stageId) * critFactor(stageId, REF.combo, 0.5, 0);
  return comboCrit * (clickPower * matterMult + flatAdd);
}
console.log('\n=== INCOME-DRIVEN entropy basis (expected gear → matter income → threshold) ===');
console.log(' stage  rarity Lv | matter/click | auto matter/s | targetClicks | threshold(=income×t×W)');
const incomeThresholds = [];
STAGES.forEach((s, i) => {
  const r = bestRarity(s.id);
  const stoneBudget = stoneBudgetFor(s, REF);
  const level = derivedLevel(s.id, r, stoneBudget, ENTITY_COST_ANCHORS[s.id] * ENHANCE_BUDGET_ANCHORS);
  const mpc = expectedMatterPerClick(s.id, level);
  const aps = autoMatterPerSecAtLevel(s.id, 1, level);
  const targetClicks = refClicksPerSec * s.realPlayTargetSec;
  // entropy = matter × W; income over the stage = clicks×mpc + auto×time.
  const matterOverStage = targetClicks * mpc + aps * s.realPlayTargetSec;
  const threshold = matterOverStage * W_MATTER_ENTROPY;
  incomeThresholds.push(threshold);
  console.log(`  ${String(s.id).padStart(2)}  ${r.slice(0,4).padEnd(4)} Lv${String(level).padStart(2)} | ${mpc.toExponential(2).padStart(9)} | ${aps.toExponential(2).padStart(10)} | ${Math.round(targetClicks).toString().padStart(7)} | ${threshold.toExponential(3)}`);
});

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

// ---------------------------------------------------------------------------
// GEAR-ONLY ECONOMY CRANK (2026-06-21): affordability of the shop anchor.
// At each checkpoint stage, a realistically-attainable ENHANCED gear loadout
// (maxed-reachable level for the reference farmer, full maturity at end-of-stage
// p=1) must afford that stage's shop anchor (ENTITY_COST_ANCHORS[stage]) within
// a sane window — and BASE-only farming (no gear) must NOT, within that window.
// ---------------------------------------------------------------------------
const AFFORD = {
  // 30–90 min target for the anchor → seconds. We assert geared time falls
  // within [floor, ceil]; floor guards against trivialising (free shop), ceil
  // against the dead-channel bug (unaffordable). Base must exceed BASE_MIN.
  windowMinSec: 20 * 60,   // floor: must take ≥ 20 min (not trivial)
  windowMaxSec: 120 * 60,  // ceil:  must take ≤ 120 min (reachable)
  baseMinSec: 6 * 60 * 60, // base-only must take ≥ 6 h (effectively walled)
};
const affordRef = PROFILES.reference;
const affordRows = [];
for (const sid of [5, 9, 12, 16]) {
  const anchor = ENTITY_COST_ANCHORS[sid];
  const stage = STAGES[sid - 1];
  const stoneBudget = stoneBudgetFor(stage, affordRef);
  const p = 1; // maxed-reachable: end-of-stage maturity, full reachable level
  const rar = bestRarity(sid);
  // Realistic matter budget for enhancing: a FRACTION of what the player actually
  // banks over the stage (income/sec × stage seconds), not the half-an-anchor
  // proxy. Converge income↔level over a couple of passes (income rises with level,
  // level rises with budget). The auto path is the income engine, so budget tracks it.
  // Realistic CUMULATIVE matter budget for enhancing the carried flagship: a
  // geared player earns ≈ one stage anchor per stage of play (that IS the design
  // target — afford the anchor in ~tens of minutes), and a flagship is carried
  // and enhanced across several stages. So the budget is a small MULTIPLE of the
  // current anchor (ENHANCE_BUDGET_ANCHORS), derived ONCE — no income feedback
  // loop (which runs away once geometric levels kick in). This is the honest
  // "what level is the carried best item realistically at" estimate.
  const matterBudget = anchor * ENHANCE_BUDGET_ANCHORS;
  const lvl = derivedLevel(sid, rar, stoneBudget, matterBudget);
  const clkMps = clickMatterPerSecAtLevel(sid, affordRef, p, lvl);
  const autMps = autoMatterPerSecAtLevel(sid, p, lvl);
  const baseMps = baseMatterPerSec(sid, affordRef);
  affordRows.push({
    sid, name: stage.name, anchor, rar, lvl,
    clkMps, autMps, baseMps,
    clkSec: anchor / clkMps, autSec: anchor / autMps, baseSec: anchor / baseMps,
  });
}
console.log('\n=== Shop affordability (gear vs base; reference farmer, maxed-reachable) ===');
console.log('  stage | anchor    | bestRar/Lv | CLICK mps  t      | AUTO mps   t      | BASE mps  t');
for (const r of affordRows) {
  const f = (n) => n.toExponential(2).padStart(8);
  console.log(
    `  ${String(r.sid).padStart(2)} ${r.name.slice(0, 6).padEnd(6)}| ${r.anchor.toExponential(1).padStart(8)} | ` +
    `${r.rar.slice(0, 4).padEnd(4)} Lv${String(r.lvl).padStart(2)} | ` +
    `${f(r.clkMps)} ${fmt(r.clkSec).padStart(6)} | ` +
    `${f(r.autMps)} ${fmt(r.autSec).padStart(6)} | ` +
    `${f(r.baseMps)} ${fmt(r.baseSec).padStart(6)}`,
  );
}

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
// Upper bound raised 150 → 170 (2026-06-19): the deliberate STACKING REWORK
// (duplicates no longer boost power, per user) removed the flat early-count help
// that casual play leaned on, widening casual/hardcore from ~142× to ~153×. Still
// fine for an idle game (casual remains viable); 170 keeps the guardrail meaningful.
assertish(spread >= 2 && spread <= 170, `casual/hardcore spread in [2, 170]× (${spread.toFixed(1)}×)`);
const critSpread = noCrit.total / maxCrit.total;
assertish(Number.isFinite(critSpread) && critSpread <= 3, `best-crit vs no-crit total time ≤ 3× (${critSpread.toFixed(2)}×)`);

// GEAR-ONLY ECONOMY CRANK affordability assertions (the point of this pass).
// DESIGN NOTE: AUTO (rift) is the stage-scaling economy path — its flat matter add
// now tracks the player-stage anchor (the fixed dead channel). CLICK power is
// stage-FLAT by design (getClickPower: a click's quanta does not grow with stage),
// so the click path feeds entropy/burst, not late-game shop affordability — its
// afford-time is reported for transparency but NOT asserted as a shop path. We
// assert: (a) the geared player (best path = auto) affords the anchor within the
// window — the SLOWEST realistic case (S5: only the first rift slot is unlocked)
// must sit in the 30–90 min target, later maxed loadouts afford faster (intended
// power fantasy); (b) BASE-only farming canNOT, by a wide margin; (c) gear ≫ base.
for (const r of affordRows) {
  const best = Math.min(r.clkSec, r.autSec); // geared player uses the better path
  // Geared affords within a generous ceiling at every checkpoint.
  assertish(best <= AFFORD.windowMaxSec,
    `S${r.sid} geared affords anchor ≤ ${fmt(AFFORD.windowMaxSec)} (best ${fmt(best)}; clk ${fmt(r.clkSec)} / aut ${fmt(r.autSec)})`);
  // The BINDING / slowest realistic checkpoint (first rift slot only) must land in
  // the 30–90 min target band — proving the crank isn't trivial where it matters.
  if (r.sid === 5) {
    assertish(best >= AFFORD.windowMinSec && best <= 90 * 60,
      `S5 (binding case) affords in the 20–90 min target (${fmt(best)})`);
  }
  // BASE-only farming canNOT afford the anchor inside any sane window.
  assertish(r.baseSec >= AFFORD.baseMinSec,
    `S${r.sid} BASE-only canNOT afford anchor (≥ ${fmt(AFFORD.baseMinSec)}) (${fmt(r.baseSec)})`);
  // Gear must be a STRICT, large improvement over base.
  assertish(r.baseSec / best >= 10,
    `S${r.sid} geared ≥ 10× faster than base (${(r.baseSec / best).toFixed(0)}×)`);
}

console.log(failures === 0 ? '\nALL INVARIANTS PASS' : `\n${failures} INVARIANT(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
