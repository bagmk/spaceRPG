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

import type { EntityRarity, EntityVisual, EntityEffectType } from './entities/types';

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
  // Stage 17 is a NON-PLAYABLE bucket: it holds the Mythic fusion-only pool.
  // It is never a `state.stageIdx` (STAGES has 16 entries) so it never appears
  // in the shop/canvas; it exists only so mythic entities have a home id-space
  // and a cost anchor. Continues the late-game ~20× geometric step.
  17: 1.2e22,
} as const;

/**
 * Fixed, STAGE-INDEPENDENT base for FUSION pricing (Overhaul-2 follow-up).
 * Fusing a given rarity costs the SAME at stage 1 and stage 16 — fusion is a
 * minor, availability-gated sink, so a flat cheap price is fine and removes the
 * per-stage inflation. Anchored to the stage-1 value. (Enhance pricing is
 * handled separately: it anchors to the ITEM's own baseCost — see getEnhanceCost
 * — which is likewise player-stage-invariant but keeps late-game pacing intact,
 * since a flat enhance base would trivialise late upgrades.)
 */
export const FUSION_ENHANCE_COST_BASE: number = ENTITY_COST_ANCHORS[1];

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
  17: '#ff5db5', // Mythic bucket — pink to match ENTITY_RARITY_TINT.mythic.
};

// Starting prices are anchored to each stage threshold, then tuned by rarity.
export const ENTITY_BASE_COST_FACTOR: Record<EntityRarity, number> = {
  common: 0.07,
  rare: 0.32,
  epic: 1.5,
  legendary: 3.6,
  mythic: 8.0,
};

export const ENTITY_COST_SCALING: Record<EntityRarity, number> = {
  common: 1.12,
  rare: 1.18,
  epic: 1.28,
  legendary: 1.55,
  mythic: 1.8,
};

export const ENTITY_MAX_COUNT: Record<EntityRarity, number> = {
  common: 20,
  rare: 10,
  epic: 5,
  legendary: 1,
  mythic: 1,
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
  mythic: 'large',
};

// Color tint blended with the stage accent — gives each rarity a distinct hue feel
export const ENTITY_RARITY_TINT: Record<EntityRarity, { hex: string; amount: number }> = {
  common:    { hex: '#888888', amount: 0.08 },
  rare:      { hex: '#44aaff', amount: 0.16 },
  epic:      { hex: '#cc44ff', amount: 0.26 },
  legendary: { hex: '#ffcc22', amount: 0.36 },
  mythic:    { hex: '#ff5db5', amount: 0.5 },
};

// Non-flat effect values are scaled up by rarity so legendary/epic feel impactful.
// Multiplier effects skip this scaling (they compound multiplicatively across stages).
export const ENTITY_RARITY_EFFECT_SCALE: Record<EntityRarity, number> = {
  common:    1.0,
  rare:      1.0,
  epic:      1.8,
  legendary: 3.0,
  mythic:    5.0,
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
/**
 * MATTER-ONLY explosive click multiplier strength (Overhaul-3 #39). Each
 * equipped click item folds `1 + (value·count·level · gearPower · this)/100`
 * into Modifiers.clickMatterMult, which scales ONLY the matter a click awards —
 * never the entropy income. So a full click loadout feels like 500×500 (a fresh
 * common ≈ ×1.9, a maxed one ≈ ×30, three maxed ≈ ×30k+) while the entropy gate
 * stays exactly as calibrated — NO re-sim, no pacing change. Tune freely: this
 * is pure power fantasy / matter abundance, decoupled from progression pacing.
 */
export const CLICK_GEAR_MATTER_BOOST = 6;
/**
 * Base passive auto income (matter/sec) with NO gear equipped — so auto-speed
 * upgrades always have a base to scale and the early game isn't dead before the
 * first rift item drops. Tiny vs every stage threshold, so pacing is unaffected.
 * Seeded into getAutoRate's autoRateAdd term so autoRateMult (Auto Engine /
 * auto-speed) multiplies it.
 */
export const AUTO_RATE_BASE = 1;
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
// Recalibrated for the fixed-effect economy (P0 removed per-stage gear scaling —
// STAGE_POWER_BASE/AUTO_STAGE_POWER_BASE = 1.0): item effects are rarity/level
// based (×CLICK_OUTPUT_MULTIPLIER for clicks), gear-substat crit (capped),
// cost-scaled fusion burst, honest enhance levels. scripts/entropy-gate-sim.mjs
// pins the reference profile (cps 3, af 0.5, fusion 90s) to realPlayTargetSec
// via per-stage span binary search. Re-run the sim after touching the gear
// curve, output multipliers, or entropy weights — the v16 ladder is FROZEN in
// storage/migrate.ts for the v17 save remap; never edit that copy.

export const ENTROPY_THRESHOLDS: Record<number, number> = {
  // Overhaul-2 (🅠1) recalibration: stronger per-level effect (0.85) + FLAT
  // enhance/stone/fusion costs let players power up faster, so the ladder is
  // re-derived (scripts/entropy-gate-sim.mjs, reference pinned to target) and
  // rises — most in the early-mid stages where cheap levelling bites hardest.
  // Re-run the sim after touching the gear curve / costs / level bonus and
  // re-paste; the v16 ladder stays FROZEN in storage/migrate.ts for the remap.
  1: 4.430e3,
  2: 2.867e4,
  3: 1.212e5,
  4: 9.332e5,
  5: 1.146e6,
  6: 2.692e6,
  7: 5.778e6,
  8: 1.225e7,
  9: 1.744e7,
  10: 2.625e7,
  11: 4.100e7,
  12: 6.312e7,
  13: 8.810e7,
  14: 1.535e8,
  15: 3.355e8,
  16: 4.090e8,
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
 * ×(1 + collected/total × CODEX_MASS_BONUS). Overhaul-2 (🅠1): 1.0 → 2.0, so
 * ×2.0 at 50% codex, ×3.0 at 100% — collection pays off harder to reward the
 * (now rarer) high-rarity grind. condensedMass is spent only in the Singularity
 * tree (never the entropy gate), so this rewards collection without touching
 * stage pacing. Distinct from the live codex set/subset stat modifiers
 * (applyCollectionRewards).
 */
export const CODEX_MASS_BONUS = 2.0;

/**
 * Global multiplier on every codex completion reward % (Overhaul-2 🅠1). One
 * central knob so the collection payoff can be tuned without editing ~35 inline
 * reward values in codexSets.ts. Applied (rounded) at BOTH the modifier site
 * (applyCodexReward) and the label sites (codexRewardLabel / shortReward) so the
 * shown bonus always equals the applied bonus (label == applied). Set/subset
 * bonuses still trigger only on full completion (locked decision unchanged).
 */
export const CODEX_REWARD_MULT = 1.5;

/** Entropy gained per quanta earned by clicking (active play drives progress). */
export const ENTROPY_W_CLICK = 0.6;
/**
 * Entropy gained per quanta earned by auto income. Re-anchored 0.25 → 0.04 in
 * Phase 4-2: without the skill click base, rift auto would dominate the
 * gate — auto still earns full QUANTA (the economy engine), it just pushes
 * the progression gate ~15× slower than clicking. Sim invariants: active
 * share ≥ 50% every stage; idle ≥ 4× slower than reference but never walled.
 */
export const ENTROPY_W_AUTO = 0.04;
/** One fusion burst is worth this many seconds of current entropy income (Phase 3). */
export const ENTROPY_FUSION_VALUE_SEC = 30;
/** Each fusion consumes this fraction of the quanta bank (Phase 3 sink). */
export const ENTROPY_FUSION_COST_FRAC = 0.1;
/**
 * Per-collision (comet) entropy reward CAP, as a fraction of the CURRENT stage's
 * entropy-gate span (Overhaul-2 🅠1). The legacy comet entropy was scaled off
 * the MATTER threshold (stage.threshold, up to 4e21) while the entropy gate
 * maxes at ~4e8 — so one late comet could dump ~10^11× the whole ladder. Capping
 * to a fraction of the live entropy span keeps a comet a satisfying-but-bounded
 * burst (≤ a few % of a stage), never 2–3 stages. Keyed by rogue tier.
 */
export const COLLISION_ENTROPY_SPAN_CAP: Record<'massive' | 'major' | 'minor', number> = {
  massive: 0.06,
  major: 0.03,
  minor: 0.012,
};

// ── Entity drops (entity redesign Phase 1 — collect loop) ───────────────────

/** Chance an entity drops on a regular click. */
export const DROP_CHANCE_BASE = 0.04;
/** Drop chance multiplier when the click crits. */
export const DROP_CHANCE_CRIT_MULT = 3;
/** Chance an entity drops on a rogue collision reward. */
export const DROP_CHANCE_COLLISION = 0.35;
/**
 * Base rarity weights for a drop roll (relative, need not sum to 1).
 * Overhaul-2 (🅠1): steepened to 90/9/0.9/0.1 — high-rarity DROPS are now rare
 * enough that fusion (not the drop table) is the intended path to epic/legendary
 * gear. Mythic stays drop-impossible (fusion-only). Compensated by the stronger
 * per-level effect (ENTITY_LEVEL_EFFECT_BONUS) + CODEX_MASS_BONUS bump.
 */
export const DROP_RARITY_WEIGHTS: Record<EntityRarity, number> = {
  common: 90,
  rare: 9,
  epic: 0.9,
  legendary: 0.1,
  mythic: 0,
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
/** 🅠4: max trios a single batch-fuse consumes in one action. */
export const FUSION_BATCH_MAX_TRIOS = 30;
// P2: rarity-up odds DECREASE per input tier — the higher you climb, the rarer
// the jump (the gamble's tension). Keyed by the INPUT rarity. legendary→mythic
// is set in P2b (the Mythic tier); 0 here keeps legendary inputs no-up for now.
export const FUSION_UP1_CHANCE_BY_TIER: Record<EntityRarity, number> = {
  common: 0.40, rare: 0.20, epic: 0.10, legendary: 0.03, mythic: 0,
};
/** Double-jump chance, by input tier (only when +2 is reachable). */
export const FUSION_UP2_CHANCE_BY_TIER: Record<EntityRarity, number> = {
  common: 0.05, rare: 0.02, epic: 0, legendary: 0, mythic: 0,
};
/** Combined up-chance ceiling (with bonuses) so fusion never becomes a sure thing. */
export const FUSION_UP_CHANCE_CAP = 0.65;
/**
 * Fusion matter cost as a FRACTION OF THE PLAYER-STAGE COST ANCHOR (Overhaul-2
 * 🅠1). Replaces the old 10%-of-bank model, which ballooned as the bank grew
 * (a chained-fusion session felt punishingly expensive). Now a fusion is a
 * fixed-price action per era: cost = ENTITY_COST_ANCHORS[playerStage] × this.
 * Cheap for common, steep from rare up. Values equal the old effective cost at
 * "bank == anchor" (0.1 × the previous rarity mult), so burst scaling — which
 * compares cost against ENTITY_COST_ANCHORS × FUSION_BURST_REF_COST_FRAC — is
 * unchanged. The player must AFFORD the full cost (no bank-cap discount).
 */
export const FUSION_FLAT_COST: Record<EntityRarity, number> = {
  common: 0.04, rare: 0.10, epic: 0.25, legendary: 0.60, mythic: 1.2,
};
// P2b bonuses (R9): fusing 3 of the SAME entity, or 3 from the same codex category.
export const FUSION_SAME_ENTITY_UP_BONUS = 0.10;       // +10% rarity-up chance
export const FUSION_SAME_ENTITY_FAIL_STONE_BONUS = 1;  // +1 강화석 on a failed same-entity fuse
export const FUSION_SAME_SUBSET_BURST_MULT = 1.5;      // entropy burst ×1.5 when all 3 share a codex subset
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
 * Overhaul-2 (🅠1): 0.6 → 0.85. With enhance costs now FLAT per level (growth
 * 1.0), levelling is cheap, so each level pulls harder to keep enhancement the
 * dominant growth lever (locked decision: power STRONG). Re-calibrated against
 * ENTROPY_THRESHOLDS via scripts/entropy-gate-sim.mjs (levelMult mirrors this).
 */
export const ENTITY_LEVEL_EFFECT_BONUS = 0.85;

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
// codex-keyed sets, fusion and combo — never by silent stage scaling. Click
// gear additionally drives the matter-only CLICK_GEAR_MATTER_BOOST multiplier
// (#39), which is decoupled from this curve and from the entropy gate.
export const STAGE_POWER_BASE = 1.0;
/** Rift/auto anchor growth — also neutralised to 1.0 (see STAGE_POWER_BASE). */
export const AUTO_STAGE_POWER_BASE = 1.0;

/** Stage at which each rarity starts dropping and selling. Fusion crafts one tier above. */
export const RARITY_STAGE_GATES: Record<EntityRarity, number> = {
  common: 1,
  rare: 3,
  epic: 7,
  legendary: 12,
  mythic: 999,
};
/** Drop weight ramps from ~0 to full over this many stages after a gate opens. */
export const RARITY_GATE_RAMP_STAGES = 3;

// ── Enhancement (강화소) ─────────────────────────────────────────────────────

/** First enhance costs this multiple of the item's base cost. */
export const ENHANCE_COST_FACTOR = 1.5;
/** Each further level multiplies the enhance cost by this. Overhaul-2 (🅠1):
 *  2.2 → 1.0 (FLAT — every matter-phase level costs the same anchor×1.5). Locked
 *  decision: costs fully fixed; pacing is held by re-tuned ENTROPY_THRESHOLDS. */
export const ENHANCE_COST_GROWTH = 1.0;
/** Level caps by rarity (levels come from enhancement AND fusion duplicates). */
export const ENHANCE_LEVEL_CAPS: Record<EntityRarity, number> = {
  common: 10,
  rare: 15,
  epic: 20,
  legendary: 25,
  mythic: 30,
};
/** Fraction of a consumed stack's invested enhance quanta refunded on fusion. */
export const ENHANCE_REFUND_RATE = 0.6;

// ── 강화석 (enhance stones, P1) — the Lv5+ enhancement currency, minted by
//    failed fusions. Levels 1→5 still cost matter; 5→cap cost stones + carry
//    failure risk (운빨 존망: mostly level-down, destroy only near the cap). ──
/** Enhancing FROM this level and up costs 강화석 instead of matter (1→5 are matter). */
export const ENHANCE_STONE_THRESHOLD = 5;
/** Stones for the first stone-phase level (the 5→6 step), by rarity. */
export const ENHANCE_STONE_BASE: Record<EntityRarity, number> = { common: 2, rare: 3, epic: 5, legendary: 8, mythic: 12 };
/** Each further stone-phase level multiplies the stone cost by this. Overhaul-2
 *  (🅠1): 1.5 → 1.0 (FLAT — every stone-phase level costs ENHANCE_STONE_BASE). */
export const ENHANCE_STONE_GROWTH = 1.0;
/** Fraction of invested stones refunded when a stack is consumed by fusion. */
export const ENHANCE_STONE_REFUND_RATE = 0.5;
/** A failed fusion (no rarity-up) mints this many 강화석, by the input tier. */
export const FUSION_FAIL_STONES_BY_TIER: Record<EntityRarity, number> = { common: 1, rare: 2, epic: 4, legendary: 7, mythic: 10 };
/** Enhance fail chance at the threshold level (stone phase only). */
export const ENHANCE_FAIL_BASE = 0.15;
/** Fail chance added per level above the threshold. */
export const ENHANCE_FAIL_PER_LEVEL = 0.04;
/** Fail chance ceiling. */
export const ENHANCE_FAIL_MAX = 0.55;
/** Destruction is only possible within this many levels of the rarity cap. */
export const ENHANCE_DESTROY_WINDOW_FROM_CAP = 3;
/** Of failures inside the destroy window, this fraction destroy a copy (else level-down). */
export const ENHANCE_DESTROY_CHANCE_ON_FAIL = 0.25;
/** Protection ("보호 강화") costs this × the level's stone cost EXTRA; a failed
 *  protected attempt loses no level and destroys nothing (stones still spent). */
export const ENHANCE_PROTECT_STONE_MULT = 1.0;
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
 * Trait icon + accent per effect type (readability: at-a-glance "what does this
 * item DO"). Shown as a corner badge on every item card and as the leading
 * glyph of the spec-chip in the expanded card. Icons are intentionally distinct
 * so click/auto/crit/etc. read instantly without parsing the description.
 */
export const EFFECT_TRAIT: Record<EntityEffectType, { icon: string; accent: string }> = {
  click:      { icon: '🖱', accent: '#7fd8ff' }, // click power %
  crit:       { icon: '✷',  accent: '#ff9a5b' }, // crit chance / crit mult
  auto:       { icon: '⚙',  accent: '#6ee7a0' }, // flat auto rate (/s)
  auto_mult:  { icon: '⚡',  accent: '#9be86e' }, // auto power %
  multiplier: { icon: '✦',  accent: '#c79bff' }, // all-source %
  time:       { icon: '⏱',  accent: '#8fb6ff' }, // (legacy) time rate
  combo_cap:  { icon: '🔗', accent: '#7fe0d8' }, // combo cap +
  entropy:    { icon: '🌀', accent: '#b388ff' }, // (legacy) encounter bonus
};

/** Trait icon per secondary (substat) type — same vocabulary as EFFECT_TRAIT. */
export const SUBSTAT_TRAIT: Record<SecondaryStatType, string> = {
  critChance:  '✷',
  critMult:    '✶',
  comboCap:    '🔗',
  entropyGain: '🌀',
  dropRate:    '🎁',
  fusionBurst: '⚗',
  autoPct:     '⚙',
  clickPct:    '🖱',
  offlineEff:  '🌙',
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

/**
 * How many secondary stats each rarity carries (deterministic from entity id).
 * P4 (spec variety, R7): commons now carry ONE weak "signature" specialty so no
 * two same-primary commons read identically — the first stat is the item's
 * specialty (특기), the rest are weak minors. 주력(effect) + 약한 보조(these).
 */
export const SECONDARY_RARITY_COUNT: Record<EntityRarity, number> = {
  common: 1,
  rare: 1,
  epic: 2,
  legendary: 3,
  mythic: 3,
};

/** Secondary magnitudes scale with rarity on top of the per-stat base. */
export const SECONDARY_RARITY_SCALE: Record<EntityRarity, number> = {
  common: 0.6,
  rare: 1,
  epic: 1.5,
  legendary: 2.2,
  mythic: 3.0,
};

// ── Feature unlock gating (Overhaul-2 🅠7 — staged onboarding) ───────────────
// S1 teaches click/entropy/item/codex + quests; S2 unlocks equip/auto/fusion;
// S3 unlocks the shop + enhancement. Stage ids are 1-based (state.stageIdx + 1).
export const EQUIP_UNLOCK_STAGE_ID = 2;
export const FUSION_UNLOCK_STAGE_ID = 2;
export const ENHANCE_UNLOCK_STAGE_ID = 3;
/** Stage at which the shop unlocks (1-based). boosts.ts re-exports the predicate. */
export const SHOP_UNLOCK_STAGE_ID = 3;

// ── Shop economy (Overhaul-2 cash-shop rework) ──────────────────────────────
/**
 * Matter packs (USD IAP): each grants matter scaled to the player's CURRENT
 * output so a pack stays relevant at every stage. Payout = (clickPower +
 * autoRate) × payoutMult; bigger packs cost more USD but give more matter per
 * dollar (bulk discount). Priced/credited in the reducer from a state snapshot.
 */
export interface MatterPackSpec { id: string; priceUSD: number; payoutMult: number; }
export const MATTER_PACKS: MatterPackSpec[] = [
  { id: 'pack_1', priceUSD: 0.99,  payoutMult: 10_000 },
  { id: 'pack_2', priceUSD: 1.99,  payoutMult: 22_000 },
  { id: 'pack_3', priceUSD: 4.99,  payoutMult: 60_000 },
  { id: 'pack_4', priceUSD: 9.99,  payoutMult: 130_000 },
  { id: 'pack_5', priceUSD: 19.99, payoutMult: 280_000 },
  { id: 'pack_6', priceUSD: 49.99, payoutMult: 750_000 },
];
/** Matter price of one 강화석 = (clickPower + autoRate) × this (≈ seconds of income). */
export const STONE_MATTER_COST_SECONDS = 300;
/** 강화석 bundles offered for matter. */
export const STONE_BUNDLES: number[] = [1, 10, 100];

/** Daily shop: 8 entity offers/day, rarity by weighted odds, matter-priced. */
export const DAILY_SHOP_SLOTS = 8;
export const DAILY_SHOP_RARITY_WEIGHTS: Record<EntityRarity, number> = {
  common: 52, rare: 30, epic: 14, legendary: 4, mythic: 0,
};
/** Matter price of a daily offer = (clickPower + autoRate) × this, by rarity. */
export const DAILY_SHOP_PRICE_SECONDS: Record<EntityRarity, number> = {
  common: 60, rare: 240, epic: 900, legendary: 3000, mythic: 9000,
};
/** Daily refresh costs (clickPower+autoRate) × this, escalating per refresh that day. */
export const DAILY_SHOP_REFRESH_SECONDS: number[] = [120, 360, 900, 2400];

// ── Stage milestones (Overhaul-2: per-stage "Achievement Tracks") ───────────
/**
 * Each stage offers ~10 claimable milestone STEPS across parallel TRACKS; each
 * track is an ascending tier ladder (I/II/III). Steps are derived from
 * per-stage state (see milestones.ts) and feed the existing quest pipeline.
 * Count tracks scale their thresholds with stage length (realPlayTargetSec);
 * gate/collect/combo tracks use fixed thresholds (already stage-appropriate).
 */
export type MilestoneMetric =
  | 'clicksThisStage' | 'fusionsThisStage' | 'collectThisStage'
  | 'gateProgress01' | 'cometsThisStage' | 'comboThisStage';
export type MilestoneTrack = 'pulse' | 'forge' | 'archive' | 'expanse' | 'comet' | 'combo';
export interface MilestoneTrackSpec {
  track: MilestoneTrack;
  metric: MilestoneMetric;
  /** Per-tier thresholds at the BASE stage (stage 1). */
  baseTiers: number[];
  /** Matter reward per tier = ENTITY_COST_ANCHORS[playerStage] × frac. */
  rewardFrac: number[];
  /** Optional 강화석 per tier. */
  stoneTiers?: number[];
  /** Earliest stage id this track appears (fusion is locked in stage 1). */
  minStageId?: number;
  /** Count tracks scale thresholds with stage length; fixed tracks do not. */
  scaled: boolean;
}
export const MILESTONE_TRACKS: MilestoneTrackSpec[] = [
  { track: 'pulse',   metric: 'clicksThisStage',  baseTiers: [120, 450, 1200], rewardFrac: [0.15, 0.3, 0.6], scaled: true },
  { track: 'forge',   metric: 'fusionsThisStage', baseTiers: [3, 12],          rewardFrac: [0.3, 0.7], stoneTiers: [2, 6], minStageId: 2, scaled: true },
  { track: 'archive', metric: 'collectThisStage', baseTiers: [4, 9],           rewardFrac: [0.25, 0.55], stoneTiers: [0, 4], scaled: false },
  // expanse thresholds are gate-fill PERCENTAGES (gateProgress01 ∈ [0,100]).
  { track: 'expanse', metric: 'gateProgress01',   baseTiers: [40, 85],         rewardFrac: [0.35, 0.8], stoneTiers: [0, 5], scaled: false },
  { track: 'comet',   metric: 'cometsThisStage',  baseTiers: [15],             rewardFrac: [0.4], scaled: true },
  { track: 'combo',   metric: 'comboThisStage',   baseTiers: [120],            rewardFrac: [0.4], scaled: false },
];
/** Count-track stage scaling = min(MAX, (realPlayTargetSec[stage]/realPlayTargetSec[1]) ^ SOFTENING). */
export const MILESTONE_COUNT_SOFTENING = 0.45;
/**
 * Cap on the count-track scale multiplier. Late eras run 30s→117450s of target
 * time (~3915×); even softened that is ~95×, which would make a "click N times"
 * milestone demand >100k clicks. Clamp so the hardest stages plateau at a
 * stretch-but-sane multiple of the stage-1 base instead of exploding.
 */
export const MILESTONE_MAX_SCALE = 6;

// ── Equip slots + set bonuses (entity redesign Phase 3) ─────────────────────

/** Click-gear slot unlock conditions. Slot 1 is always available. */
// Slots unlock by STAGE, spread out (#39): with multiplicative click matter, each
// extra click slot multiplies hard, so the 2nd/3rd slots are real milestones —
// not handed out by mid-stage-3 (the old minAlmanacCount:30 gate). (Reworked by
// the hexagon model in a later phase; kept stage-gated until then.)
export const EQUIP_SLOT_UNLOCKS: { slot: number; minStageId?: number; minAlmanacCount?: number }[] = [
  { slot: 2, minStageId: 5 },
  { slot: 3, minStageId: 9 },
];

/** Rift (auto-gear) slot unlock conditions. Slot 1 is always available. */
export const RIFT_SLOT_UNLOCKS: { slot: number; minStageId?: number; minAlmanacCount?: number }[] = [
  { slot: 2, minStageId: 7 },
  { slot: 3, minStageId: 12 },
];

/** Set bonus by number of equipped entities sharing a codex CATEGORY (P5/R8). */
export const SET_BONUS: Record<number, { clickAutoMult: number; critChanceAdd: number }> = {
  2: { clickAutoMult: 1.25, critChanceAdd: 0 },
  3: { clickAutoMult: 1.6, critChanceAdd: 0.05 },
};

// ── Combo cap growth (P5, R10) ───────────────────────────────────────────────
// The combo MULTIPLIER cap starts low and GROWS with progression (a stage of
// its own). Effective cap = min(CEIL, BASE + perStage·stageIdx + codex + gear +
// singularity). Early game caps around BASE; by the late stages it reaches the
// former flat 8 and beyond. getComboMult (formulas.ts) + getComboCapBonus
// (reducers/helpers.ts) consume these; the sim mirrors the BASE+stage curve.
/** Starting combo multiplier cap (was a flat 8.0 from stage 1). */
export const COMBO_CAP_BASE = 3.0;
/** Absolute ceiling so stacked bonuses can't run the cap away. */
export const COMBO_CAP_CEIL = 12.0;
/** Combo cap gained per stage cleared (0-based stageIdx). 0.4 → ≈8 by stage 13. */
export const COMBO_CAP_PER_STAGE = 0.4;
/** Max combo cap from a fully-completed codex (scales with completion fraction). */
export const COMBO_CAP_CODEX_MAX = 2.0;
/** Combo cap from the free_combo singularity unlock. */
export const COMBO_CAP_SINGULARITY = 2.0;

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
    up1ChanceByTier: FUSION_UP1_CHANCE_BY_TIER,
    up2ChanceByTier: FUSION_UP2_CHANCE_BY_TIER,
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
