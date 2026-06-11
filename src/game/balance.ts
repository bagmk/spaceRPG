/**
 * Centralised balance / tunable values.
 *
 * Single source of truth for numbers you might want to adjust without scanning
 * the codebase. Components and game logic should read from BALANCE instead of
 * defining their own constants.
 *
 *   import { BALANCE } from './balance';
 *   const cost = threshold * BALANCE.entity.baseCostFactor[rarity];
 *
 * Tweak this file and the change applies everywhere.
 */

import type { EntityRarity, EntityVisual } from './entities/types';

// ── Entity / shop tuning ──────────────────────────────────────────────────────

/** Cost anchor per stage — used to derive entity baseCost (anchor × baseCostFactor). */
export const ENTITY_COST_ANCHORS = {
  1: 1_725,
  2: 3_800,
  3: 52_000,
  4: 750_000,
  5: 1.1e7,
  6: 1.6e8,
  7: 2.4e9,
  8: 3.7e10,
  9: 6e11,
  10: 1e13,
  11: 1.8e14,
  12: 3.5e15,
  13: 6.5e16,
  14: 1.3e18,
  15: 2.7e19,
  16: 5.6e20,
} as const;

// Color accent per stage — used to tint each stage's entity icons.
export const ENTITY_STAGE_ACCENT: Record<number, string> = {
  1: '#ff6b3d',
  2: '#ff8a47',
  3: '#ff6a45',
  4: '#ffb45a',
  5: '#63b7ff',
  6: '#4e6188',
  7: '#eef3ff',
  8: '#9bd9ff',
  9: '#6d8fff',
  10: '#f7c86e',
  11: '#68d8a4',
  12: '#ff633f',
  13: '#8a90a8',
  14: '#8e69c9',
  15: '#857299',
  16: '#b0b5c7',
};

// Starting prices are anchored to each stage threshold, then tuned by rarity.
export const ENTITY_BASE_COST_FACTOR: Record<EntityRarity, number> = {
  common: 0.07,
  rare: 0.32,
  epic: 1.5,
  legendary: 3.6,
};

export const ENTITY_COST_SCALING: Record<EntityRarity, number> = {
  common: 1.12,
  rare: 1.18,
  epic: 1.28,
  legendary: 1.55,
};

export const ENTITY_MAX_COUNT: Record<EntityRarity, number> = {
  common: 20,
  rare: 10,
  epic: 5,
  legendary: 1,
};

export const ENTITY_TIME_MAX_COUNT: Partial<Record<EntityRarity, number>> = {
  common: 20,
  rare: 10,
  epic: 5,
};

export const ENTITY_RARITY_SIZE: Record<EntityRarity, EntityVisual['size']> = {
  common: 'tiny',
  rare: 'small',
  epic: 'medium',
  legendary: 'large',
};

// Color tint blended with the stage accent — gives each rarity a distinct hue feel
export const ENTITY_RARITY_TINT: Record<EntityRarity, { hex: string; amount: number }> = {
  common:    { hex: '#888888', amount: 0.08 },
  rare:      { hex: '#44aaff', amount: 0.16 },
  epic:      { hex: '#cc44ff', amount: 0.26 },
  legendary: { hex: '#ffcc22', amount: 0.36 },
};

// Non-flat effect values are scaled up by rarity so legendary/epic feel impactful.
// Multiplier effects skip this scaling (they compound multiplicatively across stages).
export const ENTITY_RARITY_EFFECT_SCALE: Record<EntityRarity, number> = {
  common:    1.0,
  rare:      1.0,
  epic:      1.8,
  legendary: 3.0,
};

// ── Skill tree tuning ────────────────────────────────────────────────────────

/** clickPowerMult = 2^level — change exponent base here. */
export const SKILL_CLICK_POWER_BASE = 2;
/** autoRateAdd = base^level — change exponent base here. */
export const SKILL_AUTO_RATE_BASE = 2;
/** Cosmic-time gauge speed multiplier per Aeon Drive level. */
export const SKILL_TIME_RATE_BASE = 1.8;
/** Hard lower bound for any stage's time-gauge duration after all boosts. */
export const TIME_MIN_STAGE_SECONDS = 12;
/** Previous-stage time entities keep a weaker legacy effect in later stages. */
export const LEGACY_TIME_ENTITY_EFFECT_FACTOR = 0.4;
/**
 * Global output multipliers. The entropy-gate thresholds (Phase 0 sim) were
 * calibrated WITHOUT the old 1/3 click / 0.5 auto debuffs, so these now sit at
 * 1 — clicks/auto land at the strength the pacing model expects.
 */
export const CLICK_OUTPUT_MULTIPLIER = 1;
export const AUTO_OUTPUT_MULTIPLIER = 1;
/** Fully upgraded Stage 4+ time gauges should settle around 3-4 minutes. */
export const TIME_MAXED_STAGE_SECONDS = 210;
/** Fastest a fresh Stage 4+ can feel before buying that stage's time entities. */
export const TIME_STAGE_ENTRY_MIN_SECONDS = 360;
/** Fresh-stage minimum time grows by this much per stage until current time entities are upgraded. */
export const TIME_STAGE_ENTRY_MIN_GROWTH = 2.5;
/** Unupgraded time-gauge duration by stage. Stage 7+ grows geometrically from Stage 6. */
export const TIME_STAGE_BASE_SECONDS: Record<number, number> = {
  1: 180,
  2: 180,
  3: 180,
  4: 1_800,
  5: 10_800,
  6: 86_400,
};
export const TIME_STAGE_GROWTH_AFTER_STAGE_6 = 6;

/**
 * Exponential base for entropy growth per stage.
 * Each stage multiplies auto-tick entropy by Math.pow(base, stageIdx).
 * 1.0 = flat rate across all stages; 2.0 ≈ 32,768x at stage 16 vs stage 1.
 * Pushes late-game entropy into TB territory for satisfying progression.
 */
export const ENTROPY_STAGE_GROWTH_BASE = 2.0;

// ── Entropy gate (entity redesign D1) ────────────────────────────────────────
// Stage advancement gate: cumulative entropy >= ENTROPY_THRESHOLDS[stageId].
// Calibrated by scripts/entropy-gate-sim.mjs so the reference profile
// (cps 3, activeFraction 0.5, fusion every 90s) lands on each stage's
// realPlayTargetSec. Re-run the sim after touching entropy weights below.

export const ENTROPY_THRESHOLDS: Record<number, number> = {
  1: 1.058e2,
  2: 1.142e6,
  3: 4.662e7,
  4: 1.408e9,
  5: 1.411e10,
  6: 3.922e11,
  7: 3.704e12,
  8: 1.443e14,
  9: 8.936e14,
  10: 8.543e15,
  11: 1.243e17,
  12: 4.774e17,
  13: 8.702e17,
  14: 2.283e18,
  15: 5.58e18,
  16: 4.5e19,
};

/** Entropy gained per quanta earned by clicking (active play drives progress). */
export const ENTROPY_W_CLICK = 0.5;
/** Entropy gained per quanta earned by auto income (half the click weight). */
export const ENTROPY_W_AUTO = 0.25;
/** One fusion burst is worth this many seconds of current entropy income (Phase 3). */
export const ENTROPY_FUSION_VALUE_SEC = 30;
/** Each fusion consumes this fraction of the quanta bank (Phase 3 sink). */
export const ENTROPY_FUSION_COST_FRAC = 0.1;

// ── Entity drops (entity redesign Phase 1 — collect loop) ───────────────────

/** Chance an entity drops on a regular click. */
export const DROP_CHANCE_BASE = 0.04;
/** Drop chance multiplier when the click crits. */
export const DROP_CHANCE_CRIT_MULT = 3;
/** Chance an entity drops on a rogue collision reward. */
export const DROP_CHANCE_COLLISION = 0.35;
/** Base rarity weights for a drop roll (relative, need not sum to 1). */
export const DROP_RARITY_WEIGHTS: Record<EntityRarity, number> = {
  common: 80,
  rare: 16,
  epic: 3.5,
  legendary: 0.5,
};
/** Crit multiplies rare/epic/legendary weights by this factor. */
export const DROP_CRIT_RARITY_BIAS = 2;
/** Combo at/above this threshold also applies the rarity bias. */
export const DROP_COMBO_BIAS_THRESHOLD = 100;

// ── Fusion / gacha (entity redesign Phase 3) ─────────────────────────────────

/** Copies consumed per fusion (all inputs must share one rarity). */
export const FUSION_INPUT_COUNT = 3;
/** Chance the output is one rarity above the inputs. */
export const FUSION_UP1_CHANCE = 0.4;
/** Chance the output is two rarities above the inputs (rolled within up window). */
export const FUSION_UP2_CHANCE = 0.05;
/** D4 pity: after this many consecutive non-upgrades, the next fusion guarantees +1 rarity. */
export const FUSION_PITY_THRESHOLD = 5;
/**
 * Entropy burst per fusion ≈ ENTROPY_FUSION_VALUE_SEC seconds of entropy income
 * at the reference click rate. Keeps fusion's progression share near the
 * Phase 0 sim (29–43% for active players).
 */
export const FUSION_REF_CPS = 3;

/** Each entity level above 1 adds this fraction to the entity's effect. */
export const ENTITY_LEVEL_EFFECT_BONUS = 0.25;

// ── Equip slots + set bonuses (entity redesign Phase 3) ─────────────────────

/** Click-gear slot unlock conditions. Slot 1 is always available. */
export const EQUIP_SLOT_UNLOCKS: { slot: number; minStageId?: number; minAlmanacCount?: number }[] = [
  { slot: 2, minStageId: 4 },
  { slot: 3, minAlmanacCount: 30 },
];

/** Rift (auto-gear) slot unlock conditions. Slot 1 is always available. */
export const RIFT_SLOT_UNLOCKS: { slot: number; minStageId?: number; minAlmanacCount?: number }[] = [
  { slot: 2, minStageId: 6 },
  { slot: 3, minAlmanacCount: 60 },
];

/** Set bonus by number of equipped entities sharing a setKey (glyph family). */
export const SET_BONUS: Record<number, { clickAutoMult: number; critChanceAdd: number }> = {
  2: { clickAutoMult: 1.25, critChanceAdd: 0 },
  3: { clickAutoMult: 1.6, critChanceAdd: 0.05 },
};

export const SKILL_CROSS_NODE_MULTS: Record<string, number> = {
  click_lv5: 1.4,
  click_lv10: 1.8,
  click_lv15: 2.4,
  click_lv20: 3.2,
  click_lv25: 4.4,
  click_lv30: 6,
  auto_lv5: 1.4,
  auto_lv10: 1.8,
  auto_lv15: 2.4,
  auto_lv20: 3.2,
  auto_lv25: 4.4,
  auto_lv30: 6,
  crit_lv5: 1.15,
  crit_lv10: 1.3,
  crit_lv15: 1.5,
  crit_lv20: 1.75,
  crit_lv25: 2.05,
  crit_lv30: 2.5,
  time_lv5: 1.25,
  time_lv10: 1.6,
  time_lv15: 2.1,
  time_lv20: 2.8,
  time_lv25: 3.6,
  time_lv30: 5,
};

export const SKILL_TOTAL_CROSS_NODE_COUNT = 24;

// ── Intro / Big Bang timing ──────────────────────────────────────────────────

/** Time the "Let there be light" line is held before the big bang flash (ms). */
export const INTRO_GENESIS_MS = 3600;
/** Duration of the big-bang → game-screen transition (ms). */
export const INTRO_BIG_BANG_TO_GAME_MS = 760;

// ── Convenience namespace ────────────────────────────────────────────────────

export const BALANCE = {
  entity: {
    costAnchor: ENTITY_COST_ANCHORS,
    stageAccent: ENTITY_STAGE_ACCENT,
    baseCostFactor: ENTITY_BASE_COST_FACTOR,
    costScaling: ENTITY_COST_SCALING,
    maxCount: ENTITY_MAX_COUNT,
    timeMaxCount: ENTITY_TIME_MAX_COUNT,
    raritySize: ENTITY_RARITY_SIZE,
    rarityTint: ENTITY_RARITY_TINT,
    rarityEffectScale: ENTITY_RARITY_EFFECT_SCALE,
  },
  skill: {
    clickPowerBase: SKILL_CLICK_POWER_BASE,
    autoRateBase: SKILL_AUTO_RATE_BASE,
    timeRateBase: SKILL_TIME_RATE_BASE,
    timeMinStageSeconds: TIME_MIN_STAGE_SECONDS,
    legacyTimeEntityEffectFactor: LEGACY_TIME_ENTITY_EFFECT_FACTOR,
    clickOutputMultiplier: CLICK_OUTPUT_MULTIPLIER,
    autoOutputMultiplier: AUTO_OUTPUT_MULTIPLIER,
    timeMaxedStageSeconds: TIME_MAXED_STAGE_SECONDS,
    timeStageEntryMinSeconds: TIME_STAGE_ENTRY_MIN_SECONDS,
    timeStageEntryMinGrowth: TIME_STAGE_ENTRY_MIN_GROWTH,
    timeStageBaseSeconds: TIME_STAGE_BASE_SECONDS,
    timeStageGrowthAfterStage6: TIME_STAGE_GROWTH_AFTER_STAGE_6,
    crossNodeMults: SKILL_CROSS_NODE_MULTS,
    totalCrossNodeCount: SKILL_TOTAL_CROSS_NODE_COUNT,
  },
  intro: {
    genesisMs: INTRO_GENESIS_MS,
    bigBangToGameMs: INTRO_BIG_BANG_TO_GAME_MS,
  },
  entropy: {
    stageGrowthBase: ENTROPY_STAGE_GROWTH_BASE,
    thresholds: ENTROPY_THRESHOLDS,
    wClick: ENTROPY_W_CLICK,
    wAuto: ENTROPY_W_AUTO,
    fusionValueSec: ENTROPY_FUSION_VALUE_SEC,
    fusionCostFrac: ENTROPY_FUSION_COST_FRAC,
  },
  drop: {
    chanceBase: DROP_CHANCE_BASE,
    chanceCritMult: DROP_CHANCE_CRIT_MULT,
    chanceCollision: DROP_CHANCE_COLLISION,
    rarityWeights: DROP_RARITY_WEIGHTS,
    critRarityBias: DROP_CRIT_RARITY_BIAS,
    comboBiasThreshold: DROP_COMBO_BIAS_THRESHOLD,
  },
  fusion: {
    inputCount: FUSION_INPUT_COUNT,
    up1Chance: FUSION_UP1_CHANCE,
    up2Chance: FUSION_UP2_CHANCE,
    pityThreshold: FUSION_PITY_THRESHOLD,
    refCps: FUSION_REF_CPS,
    valueSec: ENTROPY_FUSION_VALUE_SEC,
    costFrac: ENTROPY_FUSION_COST_FRAC,
    levelEffectBonus: ENTITY_LEVEL_EFFECT_BONUS,
  },
  equip: {
    slotUnlocks: EQUIP_SLOT_UNLOCKS,
    riftSlotUnlocks: RIFT_SLOT_UNLOCKS,
    setBonus: SET_BONUS,
  },
} as const;
