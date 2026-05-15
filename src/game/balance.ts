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
/** Global output debuffs for slower overall pacing. */
export const CLICK_OUTPUT_MULTIPLIER = 1 / 3;
export const AUTO_OUTPUT_MULTIPLIER = 0.5;
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
export const INTRO_GENESIS_MS = 2600;
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
} as const;
