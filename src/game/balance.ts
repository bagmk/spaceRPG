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

// ── Output anchors (Phase 4-2: gear-only economy) ───────────────────────────

/** Hard lower bound for any stage's time-gauge duration after all boosts. */
export const TIME_MIN_STAGE_SECONDS = 12;
/**
 * Previous-stage time entities keep a weaker legacy effect in later stages.
 * NOTE (Phase 4-1 carve-out): time entities are deliberately the ONE
 * stage-coupled effect type — the cosmic-clock normalization machinery is
 * inherently stage-relative. They are excluded from past-stage drop/fusion
 * pools and their count contribution hard-caps at ENTITY_TIME_MAX_COUNT
 * (no soft-cap tail; getCosmicTimeFillRate ceilings the fill rate anyway).
 */
export const LEGACY_TIME_ENTITY_EFFECT_FACTOR = 0.4;
/**
 * Global output multipliers. CLICK re-anchored ×15 in Phase 4-2: the skill
 * tree's 2^level click base is gone (tree removed — it had been unreachable
 * UI since the Entity Lab), so raw clicks need a flat anchor to stay relevant
 * against rift auto. Thresholds are calibrated WITH these values
 * (scripts/entropy-gate-sim.mjs) — change them together.
 */
export const CLICK_OUTPUT_MULTIPLIER = 15;
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
// Recalibrated for Phase 4-2 (GEAR-ONLY economy — skill tree removed): gear
// 2.0^E click ×CLICK_OUTPUT_MULTIPLIER / 8^E auto, gear-substat crit (capped),
// cost-scaled fusion burst, honest enhance levels. scripts/entropy-gate-sim.mjs
// pins the reference profile (cps 3, af 0.5, fusion 90s) to realPlayTargetSec
// via per-stage span binary search. Re-run the sim after touching the gear
// curve, output multipliers, or entropy weights — the v16 ladder is FROZEN in
// storage/migrate.ts for the v17 save remap; never edit that copy.

export const ENTROPY_THRESHOLDS: Record<number, number> = {
  // P0 fixed-effect recalibration (scripts/entropy-gate-sim.mjs, base^E=1.0,
  // level mult 0.6, enhance growth 2.2) — re-derived so progression comes from
  // investment, not auto-scaling. Re-run the sim + repaste on any income change.
  1: 4.118e3,
  2: 2.406e4,
  3: 8.756e4,
  4: 3.664e5,
  5: 5.390e5,
  6: 1.746e6,
  7: 4.157e6,
  8: 9.208e6,
  9: 1.441e7,
  10: 2.321e7,
  11: 3.796e7,
  12: 6.008e7,
  13: 8.507e7,
  14: 1.505e8,
  15: 3.325e8,
  16: 4.060e8,
};

// ── Threshold-relative meta constants (Phase 4-2) ───────────────────────────
// Expressed relative to ENTROPY_THRESHOLDS so future recalibrations cannot
// desync them from the pacing ladder (they were absolute before v17).

/** Big Crunch eligibility: reach this entropy before leaving stage 3 (≈ mid-gate). */
export const BIG_CRUNCH_ENTROPY_KB = 0.5 * ENTROPY_THRESHOLDS[3];
/** Big Rip eligibility: grind to this entropy (between the stage 9 and 10 gates).
 *  P0: multiplier 2.2→1.3 — the fixed-effect threshold ladder is far flatter
 *  (T[10]/T[9] ≈ 1.6×), so 1.3× keeps Big Rip sitting between the two gates. */
export const BIG_RIP_ENTROPY_KB = 1.3 * ENTROPY_THRESHOLDS[9];
/** Prestige upgrade costs: level i costs base × growth^i (Lv1 affordable ≈ stage 8). */
export const PRESTIGE_COST_BASE_KB = 0.5 * ENTROPY_THRESHOLDS[8];
export const PRESTIGE_COST_GROWTH = 5;
/** Gear-driven crit multiplier is bounded (substats stack across slots). */
export const CRIT_MULT_GEAR_CAP = 5;

// ── Prestige carry + codex meta bonus (Phase 4-3) ───────────────────────────

/**
 * Max stack count carried across prestige per carried item (D2: highest-tier
 * item carry). The item keeps its LEVEL but its power is stripped to the
 * player's stage (carried flag in getGearPowerExponent) — a head start, never
 * an origin-stage cudgel that would collapse the entropy gate.
 */
export const PRESTIGE_CARRY_COUNT_CAP = 1;
/**
 * Offline entropy floor (Phase 4-4 idle floor): even a player with zero auto
 * income (e.g. a click-only build with no rift gear equipped) makes a little
 * gate progress while away. Floor = this fraction of the current stage's gate
 * SPAN per FULL offline cap, scaled by away-time and the offline multiplier,
 * applied as max() against the auto-based offline entropy (a floor, never a
 * bonus — geared players' auto income dwarfs it and is unchanged).
 */
export const OFFLINE_ENTROPY_FLOOR_FRAC = 0.05;
/**
 * Codex completion multiplies the prestige condensedMass reward:
 * ×(1 + collected/total × CODEX_MASS_BONUS). 1.0 → ×1.5 at 50% codex, ×2.0 at
 * 100%. condensedMass is spent only in the Singularity tree (never the entropy
 * gate), so this rewards collection without touching stage pacing. Distinct
 * from the live codex set/subset stat modifiers (applyCollectionRewards).
 */
export const CODEX_MASS_BONUS = 1.0;

/** Entropy gained per quanta earned by clicking (active play drives progress). */
export const ENTROPY_W_CLICK = 0.6;
/**
 * Entropy gained per quanta earned by auto income. Re-anchored 0.25 → 0.04 in
 * Phase 4-2: without the skill click base, rift auto (8^E) would dominate the
 * gate — auto still earns full QUANTA (the economy engine), it just pushes
 * the progression gate ~15× slower than clicking. Sim invariants: active
 * share ≥ 50% every stage; idle ≥ 4× slower than reference but never walled.
 */
export const ENTROPY_W_AUTO = 0.04;
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
/**
 * Drop/fusion-output stage pool (Phase 4-1 stage independence): this fraction
 * of rolls stays on the current stage; the rest backfills past stages
 * weighted by (uncollected codex entries + 1) so collection holes fill
 * naturally. Time-type entities never appear in past-stage pools — the
 * cosmic-clock machinery is stage-relative (see LEGACY_TIME_ENTITY_EFFECT_FACTOR).
 */
export const DROP_CURRENT_STAGE_WEIGHT = 0.6;

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
/**
 * Fusion entropy burst scales by min(1, costPaid / (current stage cost anchor
 * × this fraction)) — a flat player-stage reference price. Closes the
 * bank-then-burst-dump exploit: fusion cost is 10% of the bank, so spending
 * the bank first used to make chained late bursts nearly free.
 */
export const FUSION_BURST_REF_COST_FRAC = 0.1;

/**
 * Each entity level above 1 adds this fraction to the entity's effect.
 * Raised to 0.6 in the fixed-effect overhaul (P0): with the per-stage gear
 * curve neutralised, ENHANCEMENT is the main growth lever, so each level must
 * pull more weight (a player carries a build forward by levelling it, not by
 * the item auto-scaling with their stage).
 */
export const ENTITY_LEVEL_EFFECT_BONUS = 0.6;

// ── Item progression (gear power curve + rarity gates) ──────────────────────

/**
 * Gear power curve (Phase 4-1 stage independence): % effects (click /
 * crit-mult / multiplier / entropy) and `scales` substats ride base^E with a
 * SHARED exponent E = max(playerStage - 1 + gateProgress01, itemStage - 1).
 * The exponent follows the PLAYER's progression, not the item's origin
 * stage — any stage's gear stays viable forever; differentiation comes from
 * rarity, effect type, family sets, levels and substats. The fractional
 * gateProgress01 term gives in-stage acceleration (power rises ×base across
 * each stage's entropy-gate window, continuous across condense since
 * (s-1)+1 = ((s+1)-1)+0). The max(…, itemStage-1) clamp makes migration a
 * strict buff and future-proofs prestige-persistent inventories. 2.0 makes
 * three multiplicative click slots grow ≈2³ = 8×/stage — parity with auto's
 * 8×/stage. Flat chance-type stats (crit chance, combo cap) do NOT scale.
 */
// FIXED-EFFECT OVERHAUL (P0): the per-stage auto-scaling is NEUTRALISED to 1.0.
// An item's effect is now exactly its printed base% — it does NOT grow with the
// player's stage. base^E collapses to 1 at every stage, so label == applied.
// Per-era growth is re-supplied by enhancement levels, higher-rarity drops,
// codex-keyed sets, fusion and combo — never by silent stage scaling.
export const STAGE_POWER_BASE = 1.0;
/** Rift/auto anchor growth — also neutralised to 1.0 (see STAGE_POWER_BASE). */
export const AUTO_STAGE_POWER_BASE = 1.0;

/** Stage at which each rarity starts dropping and selling. Fusion crafts one tier above. */
export const RARITY_STAGE_GATES: Record<EntityRarity, number> = {
  common: 1,
  rare: 3,
  epic: 7,
  legendary: 12,
};
/** Drop weight ramps from ~0 to full over this many stages after a gate opens. */
export const RARITY_GATE_RAMP_STAGES = 3;

// ── Enhancement (강화소) ─────────────────────────────────────────────────────

/** First enhance costs this multiple of the item's base cost. */
export const ENHANCE_COST_FACTOR = 1.5;
/** Each further level multiplies the enhance cost by this (raised in P0 — levels
 *  now give 0.6/level so costs must climb faster to stay the pacing throttle). */
export const ENHANCE_COST_GROWTH = 2.2;
/** Level caps by rarity (levels come from enhancement AND fusion duplicates). */
export const ENHANCE_LEVEL_CAPS: Record<EntityRarity, number> = {
  common: 10,
  rare: 15,
  epic: 20,
  legendary: 25,
};
/** Fraction of a consumed stack's invested enhance quanta refunded on fusion. */
export const ENHANCE_REFUND_RATE = 0.6;
/** At-cap duplicate fusion output refunds this fraction of the output's base cost. */
export const FUSION_CAP_DUP_REFUND_FRAC = 0.5;
/** When all fusion inputs share a glyph family, the output stays in that family this often. */
export const FUSION_FAMILY_BIAS = 0.6;

// ── Secondary stats (A안 — deterministic per-entity composite stats) ────────

export type SecondaryStatType =
  | 'critChance'
  | 'critMult'
  | 'comboCap'
  | 'entropyGain'
  | 'dropRate'
  | 'fusionBurst'
  | 'autoPct'
  | 'clickPct'
  | 'offlineEff';

/**
 * Base magnitudes at stage 1 / level 1 before the rarity multiplier.
 * `scales` stats ride STAGE_POWER_BASE; capped/flat resources do not.
 */
export const SECONDARY_STAT_DEFS: Record<SecondaryStatType, { base: number; scales: boolean }> = {
  critChance: { base: 0.4, scales: false }, // +% crit chance (capped resource)
  critMult: { base: 4, scales: false },     // +% crit multiplier (bounded — see CRIT_MULT_GEAR_CAP)
  comboCap: { base: 0.5, scales: false },   // flat combo cap add
  entropyGain: { base: 3, scales: false },  // +% entropy from all play income
  dropRate: { base: 5, scales: false },     // +% drop chance
  fusionBurst: { base: 6, scales: false },  // +% fusion entropy burst
  autoPct: { base: 4, scales: true },       // +% auto rate
  clickPct: { base: 3, scales: true },      // +% click power
  offlineEff: { base: 5, scales: false },   // +% offline income efficiency
};

/**
 * Category-pure substat pools (장비 이원화): click gear never rolls auto
 * stats and rift gear never rolls click stats, so card stats, page stats and
 * the math all stay in one lane per category.
 */
export const SECONDARY_STAT_POOLS: Record<'click' | 'rift', SecondaryStatType[]> = {
  click: ['critChance', 'critMult', 'comboCap', 'entropyGain', 'dropRate', 'fusionBurst', 'clickPct'],
  rift: ['autoPct', 'entropyGain', 'dropRate', 'fusionBurst', 'offlineEff'],
};

/** How many secondary stats each rarity carries (deterministic from entity id). */
export const SECONDARY_RARITY_COUNT: Record<EntityRarity, number> = {
  common: 0,
  rare: 1,
  epic: 2,
  legendary: 3,
};

/** Secondary magnitudes scale with rarity on top of the per-stat base. */
export const SECONDARY_RARITY_SCALE: Record<EntityRarity, number> = {
  common: 0,
  rare: 1,
  epic: 1.5,
  legendary: 2.2,
};

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
  output: {
    timeMinStageSeconds: TIME_MIN_STAGE_SECONDS,
    legacyTimeEntityEffectFactor: LEGACY_TIME_ENTITY_EFFECT_FACTOR,
    clickOutputMultiplier: CLICK_OUTPUT_MULTIPLIER,
    autoOutputMultiplier: AUTO_OUTPUT_MULTIPLIER,
    timeMaxedStageSeconds: TIME_MAXED_STAGE_SECONDS,
    timeStageEntryMinSeconds: TIME_STAGE_ENTRY_MIN_SECONDS,
    timeStageEntryMinGrowth: TIME_STAGE_ENTRY_MIN_GROWTH,
    timeStageBaseSeconds: TIME_STAGE_BASE_SECONDS,
    timeStageGrowthAfterStage6: TIME_STAGE_GROWTH_AFTER_STAGE_6,
  },
  meta: {
    bigCrunchEntropyKb: BIG_CRUNCH_ENTROPY_KB,
    bigRipEntropyKb: BIG_RIP_ENTROPY_KB,
    prestigeCostBaseKb: PRESTIGE_COST_BASE_KB,
    prestigeCostGrowth: PRESTIGE_COST_GROWTH,
    critMultGearCap: CRIT_MULT_GEAR_CAP,
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
    currentStageWeight: DROP_CURRENT_STAGE_WEIGHT,
  },
  fusion: {
    inputCount: FUSION_INPUT_COUNT,
    up1Chance: FUSION_UP1_CHANCE,
    up2Chance: FUSION_UP2_CHANCE,
    pityThreshold: FUSION_PITY_THRESHOLD,
    refCps: FUSION_REF_CPS,
    valueSec: ENTROPY_FUSION_VALUE_SEC,
    costFrac: ENTROPY_FUSION_COST_FRAC,
    burstRefCostFrac: FUSION_BURST_REF_COST_FRAC,
    levelEffectBonus: ENTITY_LEVEL_EFFECT_BONUS,
  },
  equip: {
    slotUnlocks: EQUIP_SLOT_UNLOCKS,
    riftSlotUnlocks: RIFT_SLOT_UNLOCKS,
    setBonus: SET_BONUS,
  },
} as const;
