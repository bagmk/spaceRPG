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
// This is the GENTLER scale used for the % effect types OTHER than click —
// auto_mult, crit-mult, entropy — which compound or are bounded, so they don't
// take the steep click ladder. (Plain AUTO is FLAT-typed and already ~10×/tier via
// the rarity-scaled baseCost anchor; see getAutoOutputAnchor — it skips this scale.)
export const ENTITY_RARITY_EFFECT_SCALE: Record<EntityRarity, number> = {
  common:    1.0,
  rare:      1.0,
  epic:      1.8,
  legendary: 3.0,
  mythic:    5.0,
};

// RARITY STEEPENING (PO 2026-06-23 "커먼→레어 10배↑→에픽 10배↑…, 모든 스탯이 바뀌어야"):
// CLICK gets its OWN, much steeper per-rarity scale so a higher-rarity click item is
// DECISIVELY stronger. Combined with the uniform base click values (common 15 / rare 22 /
// epic 35) and the click stageEffectScale (0.25 for the rebalanced common/rare/epic;
// 1.0 for legendary/mythic), this yields a printed click ladder of
//   common 3.75 → rare 11.0 → epic 33.25  (≈3× per tier, vs the old 1.47×/2.86×).
// CLICK power is EXPONENTIAL in equipped slots — clickPowerMult = (1 + value·level/100)^slots —
// so a literal 10×/tier on the VALUE would explode legendary into millions×. 3×/tier on the
// printed value is the steepest the entropy-gate sim (scripts/entropy-gate-sim.mjs) tolerates
// while every invariant stays green; it already delivers a large, level-amplified power jump
// per tier. legendary/mythic (no in-stage click item; mythic-bucket base 18–20) continue the
// climb. The sim's GEAR.click table mirrors the resulting printed values; thresholds re-pinned.
export const ENTITY_RARITY_CLICK_SCALE: Record<EntityRarity, number> = {
  common:    1.0,
  rare:      2.0,
  epic:      3.8,
  legendary: 2.9, // legendary/mythic skip the 0.25 click stageEffectScale (sesFor=1),
  mythic:    16.0, // so their scalar is lower yet the printed value keeps climbing.
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
 *
 * GEAR-ONLY ECONOMY CRANK (2026-06-21): 6 → 2. The per-slot multiplicative cliff
 * was too steep once ENHANCE_MATTER_LEVEL_GROWTH × ENHANCE_RARITY_GROWTH make the
 * per-level matter term geometric — at 6 a 3-slot maxed click loadout blew past
 * "수십배" into ×millions. 2 keeps the per-LEVEL growth doing the heavy lifting
 * (the geo term reaches tens of × at reachable levels) while taming the slot-count
 * multiply so the click path and the (now-fixed) auto path stay the same order of
 * magnitude. Still off-gate matter only — no re-sim needed for THIS knob.
 */
export const CLICK_GEAR_MATTER_BOOST = 3;
/**
 * GEAR-ONLY ECONOMY CRANK (2026-06-21): single scale knob on the now-fixed,
 * player-stage-anchored auto FLAT income (getAutoOutputAnchor). The raw
 * player-anchor contribution would let one rift slot earn an anchor's worth of
 * matter in seconds (the anchor ladder is ~15–20×/stage, so anchoring per-second
 * to it is far too rich). This scale pulls auto income down so a maxed rift
 * loadout affords the stage anchor in the ~30–90 min target band — comparable to
 * the click path's burst economy — while still TRACKING the shop ladder (the bug
 * fix: income now grows with the stage instead of being pinned to S1). Calibrated
 * with scripts/entropy-gate-sim.mjs (affordability assertions). Feeds entropy only
 * via the tiny wAuto weight, so thresholds are re-pinned in lockstep.
 *
 * Calibrated so the SLOWEST realistic case — arriving at a stage with only the
 * first rift slot + rare gear (slot 2 gates at S7) — affords that stage's anchor
 * in ~40–50 min (in the 30–90 min target). Later stages with 2–3 leveled
 * epic/legendary rift slots afford much faster (the intended maxed-loadout power
 * fantasy). AUTO is the stage-scaling economy path; CLICK power is stage-flat by
 * design (getClickPower), so click feeds entropy/burst, not late shop affordability.
 *
 * LANE RECONVERGENCE (2026-06-24): 0.16 → 2.4e-5. The old wallet flat-add multiplied
 * the anchor by the per-effect `value` (auto ~0.15–1.0, click ~11–33) × the GEOMETRIC
 * enhance level term — so each lane's matter/sec exploded ~hundreds of × past the shop
 * anchor (auto afforded the S16 anchor in <1 s, click in ~0 s) AND the two lanes
 * diverged by 1.6–6.3 orders depending on loadout. The wallet flat-add is now decoupled
 * from the volatile per-effect value: it rides the item anchor × WALLET_RARITY_WEIGHT ×
 * a GENTLE linear level term (WALLET_LEVEL_BONUS) — see getWalletAnchorFlat. This scale
 * is re-tuned to that new structure so a maxed rift loadout affords the stage anchor in
 * the ~25–75 min band at every checkpoint, and click/auto stay within ~0.6 orders.
 */
export const AUTO_GEAR_INCOME_SCALE = 2.4e-5;
/**
 * Auto WALLET contribution FLOOR per equipped rift item — makes early items visibly move
 * 오토 속도 (their item-anchored value is tiny at low stages). 2026-06-23 FIX (user "글루온
 * (레어) 2/초 < 업쿼크(커먼) 2.3/초 — 웃기는 방향"): a FLAT floor lifted BOTH common AND rare
 * to the same ~1.0 at low stages, flattening the rarity order. Now RARITY-SCALED ~10×/tier
 * so a rarer item always floors higher (레어 ≥ 10× 커먼). Off-gate (gate reads
 * autoEntropyFlatAdd) → sim-neutral; only binds at low stages where the natural value is
 * below the floor (higher stages keep their larger natural value).
 *
 * AUTO-WALLET FELT-LEVELING (2026-06-24, user "융합의 창 강화해도 500/초 → 500/초"): the epic/
 * legendary/mythic floors were the SECOND cause of the bug. Legendaries/epics appear as early
 * as stage 4 (Fusion Window, Lithium-7), whose HOME-stage natural /s (≈54 / ≈40) sat FAR below
 * the old 500/50 floors — so the floor swallowed the item's real value AND every enhance level
 * until the level boost finally climbed 10× past it. That contradicts the floor's own intent
 * ("only binds at low stages"). The epic/legendary/mythic floors are lowered to sit BELOW the
 * earliest home-stage natural value of their rarity, so a leveled rift item's /s moves from Lv1.
 * Common→rare keep the 10× step (the original 글루온-vs-업쿼크 fix); epic+ uses a gentler step
 * because the earliest epic and legendary items have near-equal home-stage values (both stage 4),
 * so a strict 10×/tier floor cannot sit below both. Sim-neutral (afford checkpoints use high
 * stages/levels where natural ≫ floor).
 */
export const AUTO_WALLET_MIN_PER_ITEM: Record<EntityRarity, number> = {
  common: 0.5,
  rare: 5,
  epic: 25,
  legendary: 40,
  mythic: 300,
};
/**
 * Overhaul-4 (user: "클릭은 당연히 오토보다 더 높게"): click gear gets its OWN
 * item-anchored WALLET (clickMatterFlatAdd), mirroring the auto split, so a click PER
 * TAP out-earns auto PER SECOND. Set so click stays the same ORDER as auto (the lane
 * reconvergence target) while the per-tap combo×crit factor + the on-screen geometric
 * clickMatterMult keep click the more EXPLOSIVE feel.
 *
 * LANE RECONVERGENCE (2026-06-24): 0.5 → 6.0e-6. Same restructure as
 * AUTO_GEAR_INCOME_SCALE — the wallet now rides anchor × WALLET_RARITY_WEIGHT × gentle
 * level (getWalletAnchorFlat), not anchor × per-effect-value × geometric level. The
 * click flat-add is additionally multiplied by comboCrit per tap (handleClick), so it
 * does NOT need to sit above the auto scale to out-earn auto; both scales are picked so
 * |log10(autoMps/clickMps)| ≤ ~0.6 across S5/9/12/16. Off-gate (entropy rides the TAME
 * `gained`), so no entropy-gate re-pin — the sim's affordability block confirms it.
 */
export const CLICK_GEAR_INCOME_SCALE = 6.0e-6;
/**
 * LANE RECONVERGENCE (2026-06-24) — wallet rarity ranking, shared by BOTH the click and
 * auto wallet flat-adds (getWalletAnchorFlat). Replaces using the per-effect `value` as
 * the wallet multiplier: effect values are wildly asymmetric between lanes (auto 0.15–1.0,
 * click 11–33) and jump ~3×/rarity, which (a) made the two lanes diverge by orders and
 * (b) made afford-time shrink ~40× from S5→S16 (busting any ≥10 min floor). This gentle
 * ~1.5×/tier table is the ONLY rarity term in the wallet, so a rarer item earns a bit
 * more but afford-time stays in a tight band across stages (≈4× S5→S16). The effect
 * `value` still drives the on-gate entropy income + the on-screen click/auto numbers;
 * only the off-gate WALLET affordability is decoupled from it.
 */
export const WALLET_RARITY_WEIGHT: Record<EntityRarity, number> = {
  common: 1,
  rare: 1.5,
  epic: 2.2,
  legendary: 3.0,
  mythic: 4.0,
};
/**
 * LANE RECONVERGENCE (2026-06-24) — per-level growth of the WALLET flat-add (linear,
 * gentle). The wallet affordability must NOT ride the steep geometric enhance term
 * (ENHANCE_MATTER_LEVEL_GROWTH ^ level), which alone inflated income ~280× by legendary
 * Lv22 and busted the afford window. Enhancing still climbs the wallet (a leveled item
 * affords faster) but gently — 1 + (level-1) × this — so the maxed-loadout afford-time
 * stays in [10 min, 2 h]. The GEOMETRIC term remains on clickMatterMult (the visible
 * per-tap power fantasy) and on the entropy-side linear levelMult (unchanged).
 */
export const WALLET_LEVEL_BONUS = 0.05;
/**
 * AUTO-WALLET FELT-LEVELING (2026-06-24, user playtest "융합의 창 강화해도 500/초 → 500/초"):
 * the CLICK side already feels enhancement through the geometric clickMatterMult (1.2^lvl)
 * applied PER TAP, so leveling a click item visibly explodes. The AUTO wallet had only the
 * gentle shared WALLET_LEVEL_BONUS (+5%/level, LINEAR), so a level-up moved the /s readout
 * by ~5% — and worse, the AUTO_WALLET_MIN_PER_ITEM floor swallowed even that, so a leveled
 * legendary auto item showed the SAME /s as Lv1 (the reported 500/초 → 500/초 bug).
 *
 * Fix: the AUTO wallet gets its OWN mild-GEOMETRIC level term — getAutoWalletLevelBoost =
 * (1 + WALLET_AUTO_LEVEL_GROWTH)^(level-1) — layered ON TOP of getWalletAnchorFlat, mirroring
 * the click side's geometric felt-leveling. So leveling a rift item now obviously climbs the
 * /s readout (and quickly clears the floor). This term is applied ONLY to the auto/auto_mult
 * WALLET (autoRateFlatAdd); the CLICK wallet keeps the gentle linear term, so the click afford
 * lane — the BINDING geared-floor in the sim — is untouched. The auto lane is the SLOWER lane
 * at every checkpoint, so steepening it only pulls auto TOWARD click (tightening lane
 * convergence) and never makes the geared best path trivial. The entropy gate reads the TAME
 * autoEntropyFlatAdd (NOT this), so the gate calibration is completely undisturbed.
 *
 * Growth is kept MILD so the maxed-loadout (legendary Lv22) auto income stays the same ORDER
 * as click (lane convergence ≤1.5 orders) and the auto afford path stays ≥ the geared floor —
 * verified by scripts/entropy-gate-sim.mjs (the geared-best floor was re-pinned 10→5 min to
 * make room, still firmly "not seconds"). Worked example (Fusion Window, S4 legendary, value
 * 12): natural /s ≈ anchor(750k)×AUTO_GEAR_INCOME_SCALE(2.4e-5)×WALLET_RARITY_WEIGHT.lege(3)
 * = 54/s. OLD behaviour: the floor was 500/s so Lv1 AND Lv5 both clamped to 500 (the reported
 * 500/초 → 500/초 freeze). NOW the legendary floor is 40 (< 54), so the readout shows the real
 * value and CLIMBS every level: Lv1 ≈ 54 → Lv5 ≈ 54×1.20(linear)×1.06^4(geo) ≈ 82 → Lv10 ≈
 * 54×1.45×1.06^9 ≈ 132 → Lv15 ≈ 54×1.70×1.06^14 ≈ 207 → Lv22 ≈ 54×2.05×1.06^21 ≈ 376 (≈7×).
 */
export const WALLET_AUTO_LEVEL_GROWTH = 0.06;
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
  // GEAR-DRIVEN ECONOMY recalibration (2026-06-22, scripts/entropy-gate-sim.mjs,
  // reference pinned to realPlayTargetSec, ALL INVARIANTS PASS). Re-pinned after the
  // crit substat bump (critChance 0.4→1.2, critMult 4→6) — crit feeds click income so
  // it lifts the gate, shifting the ladder up ≤ ~12%. The auto WALLET income is
  // item-anchored (decoupled from the gate via the tame autoEntropyFlatAdd channel),
  // so #6 does NOT enter this calibration. Re-run the sim after touching gear curve /
  // slots / costs / level / count / crit and re-paste; the v16 ladder stays FROZEN in
  // storage/migrate.ts.
  // RARITY STEEPENING re-pin (2026-06-23, scripts/entropy-gate-sim.mjs): steeper CLICK
  // (ENTITY_RARITY_CLICK_SCALE, GEAR.click 3.75/11.0/33.25) + steeper SUBSTATS
  // (SECONDARY_RARITY_SCALE 0.6/1.3/2.8/6.0) lift the gate (click + crit feed it), so the
  // reference profile is re-pinned to realPlayTargetSec and these are the freshly-printed
  // thresholds. ALL invariants pass (crit spread 2.76×, casual/hardcore 140.8×). The v16
  // ladder stays FROZEN in storage/migrate.ts.
  // ENHANCE-RISK + MATTER PROTECTION re-pin (2026-06-24, scripts/entropy-gate-sim.mjs):
  // RISK is back (user "실패·파괴 부활 + 보호 아이템") — enhancing can FAIL from Lv3 up, and
  // protection is now a MATTER-bought consumable (인과 닻, ENHANCE_PROTECT_MATTER_FRAC ×
  // anchor/charge) instead of free 강화석.
  // MID-GAME GATE RESTORE (2026-06-24, user playtest "스테이지 7부터 너무 쉽게 차 / 스6에 클릭위력
  // 15K"): the aba4fcf re-pin modeled protection as a MANDATORY full-price every-attempt matter
  // tax that HALVED the matter-reachable risk-phase level (sim collapsed it to rare Lv6 / epic
  // Lv4 / legendary Lv3), so the reference gear looked weak and the mid-game gates pinned far
  // DOWN (S7 8.87e5, S8 1.92e6 — biggest aba4fcf cuts ×0.54 / ×0.45). But the ACTUAL gear is
  // STRONG, so those low gates trivialised the mid-game. Diagnosis: protection is OPTIONAL
  // insurance, not a level-halving tax — the dominant risk-phase gate is the 강화석 (fusion-
  // minted) budget you can spend on PROTECTing climbs (= the pre-aba4fcf stone-purchase loop),
  // and the matter side only pays a SOFTENED slice (PROTECT_BUDGET_IMPACT = 0 in the sim). The
  // sim's derivedLevel now restores the pre-aba4fcf reachability (rare→Lv8/9, epic→Lv11-17,
  // legendary→Lv19-22 at the checkpoints) → stronger reference gear → the ladder re-pins back
  // UP to (≈) the pre-aba4fcf values, HARDER as the user wants. The in-game enhance MECHANIC
  // is UNCHANGED (sim-only model knob). These are the freshly-printed calibrated spans; ALL
  // invariants pass (worst 1.00×, crit spread 2.77×, casual/hardcore 141.2×). The #3 auto-
  // wallet felt-leveling change is OFF-GATE (autoEntropyFlatAdd tame path), so it does NOT
  // enter this calibration. v16 ladder stays FROZEN in storage/migrate.ts.
  1: 1.479e3,
  2: 9.526e3,
  3: 2.969e4,
  4: 6.421e4,
  5: 1.580e5,
  6: 5.611e5,
  7: 1.646e6,
  8: 4.262e6,
  9: 6.218e6,
  10: 9.154e6,
  11: 1.403e7,
  12: 2.138e7,
  13: 2.963e7,
  14: 9.342e7,
  15: 2.602e8,
  16: 3.254e8,
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

// ── Condensation Core: the ENDLESS off-gate prestige sink ───────────────────
// Hardcore players cap out the 5 entropy-bought prestige upgrades (Lv5) and the
// 6 wired Singularity nodes, then prestige has nothing left to spend on. The
// Condensation Core is an UNCAPPED upgrade bought with condensedMass at a
// geometric rising cost. Each level grants a small PERMANENT OFF-GATE wallet
// boost (clickMatterMult + autoMatterMult), so it makes the player richer/better
// geared but NEVER feeds the entropy gate (which rides the tame clickPower×combo
// ×crit + tame auto). The entropy-gate sim doesn't read these levers, so endless
// stacking can't move the calibrated pacing.
//
// +CONDENSATION_CORE_BOOST_PER_LEVEL per level to BOTH wallet income mults — small
// so it's a long grind, not a spike. Cost = base × growth^level (level is current
// owned count). condensedMass is whole-number scaled; base 50 lands the first
// level after the early wired nodes (quark_foam 10 … free_combo 25), growth 1.6
// keeps every next level a meaningful but reachable reach.
export const CONDENSATION_CORE_BOOST_PER_LEVEL = 0.02; // +2% wallet income / level (off-gate)
export const CONDENSATION_CORE_COST_BASE = 50;
export const CONDENSATION_CORE_COST_GROWTH = 1.6;

// ── Codex meta bonus (Phase 4-3) ────────────────────────────────────────────
// (Panel #7 A: prestige item-carry was removed — prestige resets the inventory;
//  only bonuses carry. PRESTIGE_CARRY_COUNT_CAP + computeCarriedInventory deleted.)
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
export const CODEX_REWARD_MULT = 2.0; // Overhaul-4: completing collections should feel rewarding (was 1.5 → bigger payoff; label==applied stays in sync).

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

/**
 * Overhaul-4 P6: recency affinity for the BACKFILL distribution (the past-stage
 * spread, NOT the current-stage share above). The backfill weight is
 * `(uncollected + 1) × affinity(distance)` where distance = playerStage − s, and
 * `affinity(d) = FLOOR + (1 − FLOOR) × FALLOFF^(d−1)` (1.0 at the nearest past
 * stage, decaying toward FLOOR for distant ones). This favors gear from stages
 * NEAR the player (higher anchor / more economy-relevant) while the FLOOR keeps
 * every old stage dropping for collection. The hard directional gate is still the
 * `s < playerStage` loop bound in pickDropStage — affinity only re-weights, never
 * unlocks a future stage. Pure distribution tuning: no save bump, and total drop
 * rate / DROP_CURRENT_STAGE_WEIGHT are unchanged, so the entropy gate is unaffected.
 */
export const DROP_HOME_AFFINITY_FALLOFF = 0.8;
export const DROP_HOME_AFFINITY_FLOOR = 0.25;

/**
 * Era-ordered within-rarity drop bias (Stage 11 "Life on Earth"). Entities sit in
 * evolutionary order within a stage (array position = era), so as the entropy gate
 * fills (progress 0→1) the drop should track the timeline: early progress favours the
 * EARLIEST entity of whatever rarity rolled (Earth/Moon/Ocean), near-full progress the
 * LATEST (City Lights/Satellite/Spacefaring). This only re-weights the WITHIN-rarity
 * pick — rarity weights and total drop rate are untouched, so the entropy gate / sim
 * are unaffected (the sim has no per-entity-pick model). A gaussian centred on progress
 * with FLOOR keeping every era reachable. ERA_BIAS_STAGES gates which stages use it.
 */
export const ERA_BIAS_STAGES: readonly number[] = [11];
export const ERA_BIAS_FLOOR = 0.18;
export const ERA_BIAS_SIGMA = 0.32;

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
// Overhaul-3: a GEOMETRIC rarity climb (k=3.5, base 0.04) so legendary/mythic
// fusions are a real sink instead of the old near-flat ~2.5× step. Cost =
// ENTITY_COST_ANCHORS[playerStage] × this fraction (getFusionQuantaCost now
// re-anchors to the player stage), so as a fraction of one current-era item:
// common 4% · rare 14% · epic 49% · legendary 172% · mythic 600%. PACING-SAFE:
// the entropy burst's burstCostScale saturates at 1.0 for everything above
// common and is then span-capped (FUSION_BURST_SPAN_CAP), and burstRefCost stays
// stage-1-anchored — so steeper cost does NOT inflate the burst.
// RARITY STEEPENING (user 2026-06-23 "융합비용 커먼→레어, 레어→에픽 갈 때 적어도 100배는
// 올려야지"): each tier now costs ~100× the previous (was ~3.5×/tier — fusing epics barely
// cost more than commons). The bank scales with stage, so a higher-rarity fusion becomes
// affordable a few stages after its items appear — a meaningful per-tier matter investment.
// Off-gate in the sim: the burst saturates at 1 (costPaid ≫ anchor×burstRefCostFrac at every
// tier) and burstRefCost stays stage-1-anchored, so steeper cost is a SINK change, not pacing.
export const FUSION_FLAT_COST: Record<EntityRarity, number> = {
  common: 0.04, rare: 4, epic: 400, legendary: 40000, mythic: 4000000,
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
 * Overhaul-3 pacing fix: the fusion entropy burst rides the player's LIVE
 * (enhancement-inflated) click power and is otherwise uncapped — and batch-fuse
 * sums up to FUSION_BATCH_MAX_TRIOS bursts in one action. At a leveled late-game
 * loadout one fuse (or one batch) delivered most of a whole stage's entropy span,
 * which is why progression "jumped" a full stage per forge action. Mirror the
 * comet cap (COLLISION_ENTROPY_SPAN_CAP): clamp EACH fuse's burst to this fraction
 * of the current stage's entropy span, and the WHOLE batch to the aggregate cap.
 */
export const FUSION_BURST_SPAN_CAP = 0.02;        // one fuse ≤ 2% of the stage span
export const FUSION_BATCH_BURST_SPAN_CAP = 0.10;  // a full batch ≤ 10% of the stage span

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

/** First enhance costs this multiple of the item's base cost. GEAR-ONLY ECONOMY
 *  CRANK (2026-06-21): 1.5 → 0.5. Enhance cost rides the item's baseCost, which
 *  is anchored to the SAME ENTITY_COST_ANCHORS ladder the shop prices ride — so a
 *  high-multiple first level made the early enhance levels nearly as dear as the
 *  shop item itself, walling the very crank that's supposed to fund the shop.
 *  0.5 makes a meaningful enhanced loadout reachable so the gear path actually
 *  out-earns base farming. Re-pinned via scripts/entropy-gate-sim.mjs. */
export const ENHANCE_COST_FACTOR = 0.5;
/** Each further level multiplies the enhance cost by this. Overhaul-3: 1.0 (flat)
 *  → 1.7 (geometric). Per-level matter cost = baseCost × 1.5 × 1.7^(level-1), so
 *  Lv1→2 = 1.5×base, cumulative-to-Lv10 ≈ 322×base, to-Lv20 ≈ 9,400×base. Since
 *  the entropy-feeding effect grows only LINEARLY per level (ENTITY_LEVEL_EFFECT_
 *  BONUS=0.85) and the matter-power channel ~1.3^level, cost (1.7×) outruns power
 *  → marginal cost-per-power RISES: high levels are a real escalating spend. This
 *  lowers the budget-reachable level, so ENTROPY_THRESHOLDS were re-pinned via the
 *  sim in lockstep (ENHANCE_COST_GROWTH mirrored at scripts/entropy-gate-sim.mjs).
 *  Overhaul-3 (user 2026-06-19): 1.7 felt too steep → 1.35 (gentler ramp; cum-to-
 *  Lv10 ≈ 27×base, to-Lv20 ≈ 109×base — still escalating but affordable).
 *  GEAR-ONLY ECONOMY CRANK (2026-06-21): 1.35 → 1.15 — the geometric per-level
 *  POWER (ENHANCE_MATTER_LEVEL_GROWTH × ENHANCE_RARITY_GROWTH, ~1.25–2.0/level)
 *  now outpaces a 1.35 cost ramp only briefly, so high levels stayed unreachable
 *  in practice. 1.15 (cum-to-Lv10 ≈ 10×base, to-Lv20 ≈ 47×base at FACTOR 0.5)
 *  keeps the ramp escalating but lets the player actually CLIMB into the "수십배"
 *  band the crank is meant to deliver. Re-pinned via scripts/entropy-gate-sim.mjs. */
export const ENHANCE_COST_GROWTH = 1.15;
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

/**
 * Overhaul-4 P7b — duplicate-collection enhance: you level gear by MERGING spare
 * copies, not by spending matter. Copies to go from level L → L+1:
 *   need(L) = ENH_DUP_BASE + ENH_DUP_STEP·(L−1)  →  3, 5, 7, 9, …
 * Total copies to reach level L from Lv1:  cumNeed(L) = L² − 1.
 * (Pure curve here; the reducer + save-v27 switch + the 물질/강화석 copy-token cost
 *  + the entropy-gate re-pin land in the coupled P7b implementation phase.)
 */
export const ENH_DUP_BASE = 3;
export const ENH_DUP_STEP = 2;

// #8 (user): the copy-token BUY is removed ("카드 사는건 안 됨"). Leveling is COPIES
// (free merge) when you have spares, else the 강화석 escape valve (getEnhanceStoneCost,
// reusing ENHANCE_STONE_BASE/GROWTH below) — so 강화석 stays a live sink.

// ── 강화 risk phase (#47) — every enhance costs MATTER ONLY. From this level up
//    an attempt can FAIL; a failed UNPROTECTED attempt DESTROYS one copy and mints
//    a RANDOM amount of 강화석 (no level-down). 강화석 is spent ONLY by 보호(protect),
//    which negates the loss. So 강화석 is purely a "insurance / break refund"
//    currency, minted by failed fusions AND failed enhances. ──
/** Enhancing FROM this level and up can FAIL — #40 lowered 5→3 so risk bites
 *  early (Lv1→3 are safe matter levels; Lv3+ risk losing the item). */
export const ENHANCE_STONE_THRESHOLD = 3;
/** Base 강화석 cost unit, by rarity — now ONLY the anchor for the 보호 cost
 *  (getEnhanceProtectStoneCost) AND the break-refund scale. Normal enhance is
 *  matter-only, so this is never charged for a plain attempt. */
export const ENHANCE_STONE_BASE: Record<EntityRarity, number> = { common: 2, rare: 3, epic: 5, legendary: 8, mythic: 12 };
/** Each further stone-phase level multiplies the 보호(protect) stone cost by this.
 *  Overhaul-3: 1.0 (flat) → 1.5 (geometric) so insuring the high, risky levels
 *  ramps up too — mirrored in scripts/entropy-gate-sim.mjs (drives the stone-phase
 *  reachable level → income → re-pinned thresholds). Overhaul-3 (user): 1.5 → 1.3. */
export const ENHANCE_STONE_GROWTH = 1.3;
/** Fraction of invested stones refunded when a stack is consumed by fusion. */
export const ENHANCE_STONE_REFUND_RATE = 0.5;
/** A failed fusion (no rarity-up) mints this many 강화석, by the input tier. */
export const FUSION_FAIL_STONES_BY_TIER: Record<EntityRarity, number> = { common: 1, rare: 2, epic: 4, legendary: 7, mythic: 10 };
/** Enhance fail chance at the threshold level (stone phase only). #40: 0.15→0.25
 *  so "강화가 안 터진다" stops being true — failure is a real, felt risk. */
export const ENHANCE_FAIL_BASE = 0.25;
/** Fail chance added per level above the threshold. #40: 0.04→0.06 (steeper ramp). */
export const ENHANCE_FAIL_PER_LEVEL = 0.06;
/** Fail chance ceiling. */
export const ENHANCE_FAIL_MAX = 0.55;
/** #47: a failed UNPROTECTED enhance destroys one copy and mints a RANDOM amount
 *  of 강화석 in [min, max] by rarity (losing a high-rarity item refunds more, so
 *  the loss is softened). The granted count is the only thing shown on the card. */
export const ENHANCE_BREAK_STONE_MIN: Record<EntityRarity, number> = { common: 1, rare: 2, epic: 3, legendary: 5, mythic: 8 };
export const ENHANCE_BREAK_STONE_MAX: Record<EntityRarity, number> = { common: 4, rare: 7, epic: 11, legendary: 16, mythic: 24 };
/** Legacy: protection used to cost 강화석 (this × the level's stone cost). SUPERSEDED
 *  by the matter-bought protection CONSUMABLE below (user decision "강화 보호용 사는거"):
 *  protection is now a named item bought with 물질 in the shop, tracked as
 *  enhanceProtectCharges, and one charge is consumed to absorb a failed attempt.
 *  Kept only so the sim's protect-cost proxy (≈ a 강화석 unit) still pins the gate. */
export const ENHANCE_PROTECT_STONE_MULT = 1.0;

// ── 강화 보호 CONSUMABLE (user: "강화 보호용 사는거 + 그 아이템으로 강화 실패시 안터지게") ──
//    A named protection item bought with 물질(matter) in the shop. When the player
//    toggles "보호 사용" ON and holds ≥1 charge, a FAILED risk-phase enhance consumes
//    ONE charge and the item SURVIVES (no level gain, no destroy) instead of being
//    destroyed. Persisted as enhanceProtectCharges (save v30).
/** Display name of the protection consumable (bilingual, NO mixed-language). */
export const ENHANCE_PROTECT_ITEM_NAME = { en: 'Causal Anchor', ko: '인과 닻' } as const;
/** Matter price of ONE protection charge = ENTITY_COST_ANCHORS[playerStage] × this.
 *  Priced a BIT HIGH per the user — protection should feel like a real, deliberate
 *  outlay (one charge ≈ a whole common shop item's matter cost, 0.10×anchor), so the
 *  player weighs insuring a risky attempt vs just re-farming the copy. */
export const ENHANCE_PROTECT_MATTER_FRAC = 0.75;
/** Protection bundles offered for matter in the shop (mirrors STONE_BUNDLES). The bigger
 *  bundles carry a bulk discount (protectBulkDiscount): 5 −8%, 10 −15%, 25 −25%. */
export const PROTECT_BUNDLES: number[] = [1, 5, 10, 25];
/**
 * Geometric per-level growth for the MATTER-ONLY click multiplier (#40). Each
 * click-gear level multiplies its clickMatterMult contribution by this — so
 * enhancing a click item "진짜 세진다" (geometric, not the tame linear curve).
 * Applied in the decoupled matter channel AND (GEAR-ONLY ECONOMY CRANK 2026-06-21)
 * the now-fixed auto channel, so it never feeds the entropy gate and needs no
 * re-sim FOR THE MATTER MAGNITUDE itself. The entropy-side level term stays linear.
 *
 * CRANK (2026-06-21): 1.3 → 1.20. The cheaper, gentler enhance-cost crank
 * (ENHANCE_COST_FACTOR 0.5 / GROWTH 1.15) makes HIGH levels reachable (epic ~Lv15,
 * legendary ~Lv22), so a steep geo base would explode the matter/auto income many
 * orders past the shop anchor (sim verified). 1.20 keeps the per-level "수십배"
 * climb landing in the "tens-to-low-hundreds ×" band AT the reachable level for
 * each rarity (geoBase = this × ENHANCE_RARITY_GROWTH) while keeping a maxed
 * loadout's income comparable to — not millions of × past — the shop anchor.
 */
export const ENHANCE_MATTER_LEVEL_GROWTH = 1.3;

/**
 * Per-rarity multiplier ON the geometric enhance-power base (GEAR-ONLY ECONOMY
 * CRANK 2026-06-21). Higher rarities level STEEPER: the effective per-level
 * growth for the matter AND auto channels is
 *   geoBase = ENHANCE_MATTER_LEVEL_GROWTH × ENHANCE_RARITY_GROWTH[rarity].
 * So per-level power growth is common 1.20× · rare 1.236× · epic 1.272× ·
 * legendary 1.308× · mythic 1.344×. NOTE: the user's first-pass suggestion was a
 * steeper ladder (1.0/1.12/1.26/1.42/1.58); that was tamed here because the cost
 * crank makes legendary reach ~Lv22, where the steeper ladder gave ×171,000 per
 * item — many orders past the shop anchor (the affordability window blows out).
 * This gentler ladder still makes each rarity hit the "수십배" band at ITS
 * reachable level — common Lv10 ≈ ×5, epic Lv15 ≈ ×29, legendary Lv22 ≈ ×281 —
 * AND keeps "higher rarity = steeper" (RG strictly increasing). Decoupled from
 * the entropy gate (matter + flat-auto only); the sim models it for affordability.
 */
export const ENHANCE_RARITY_GROWTH: Record<EntityRarity, number> = {
  common: 1.0,
  rare: 1.03,
  epic: 1.06,
  legendary: 1.09,
  mythic: 1.12,
};
/** Matter handed back on a successful enhance, as a fraction of the matter cost
 *  (#40 — every attempt should feel rewarding, not purely a sink). */
export const ENHANCE_MATTER_PAYOUT_SUCCESS = 0.25;
/** Consolation matter on a FAILED enhance, as a fraction of the matter cost. */
export const ENHANCE_MATTER_PAYOUT_FAIL = 0.5;
/** At-cap duplicate fusion output refunds this fraction of the output's base cost. */
export const FUSION_CAP_DUP_REFUND_FRAC = 0.5;
/** When all fusion inputs share a glyph family, the output stays in that family this often. */
export const FUSION_FAMILY_BIAS = 0.6;

// ── #50 ITEM QUALITY (가우시언 테일) ───────────────────────────────────────────
// Every acquired copy rolls a gaussian quality score in [0,1] (mean ~0.5, rare
// tail). A stack keeps its BEST roll. quality multiplies the item's primary
// effect AND its scaling substats by `1 + quality*QUALITY_MAX_BONUS`; the top
// tail earns a subtle GOLD card border. Deterministic per-id substats stay; this
// is the ONLY per-copy variation, so two copies of the same item can differ.
/** Top-quality (score 1.0) item is this much stronger than a 0.0 roll. */
export const QUALITY_MAX_BONUS = 0.25;
/** quality ≥ this → "tail" item: gold border + the strongest rolls. ~top 3% (≈1.8σ). */
export const QUALITY_TAIL_THRESHOLD = 0.8;
/** Quality the sim assumes for the FARMED, equipped gear it models (stacks keep
 *  the max roll, so equipped gear trends high). Drives the gate recalibration. */
export const QUALITY_SIM_EQUIPPED = 0.65;
/** Quality stamped on pre-v23 inventory at migration — neutral-average, so old
 *  gear is neither nerfed nor instantly gold (tail threshold is far above this). */
export const QUALITY_MIGRATION_DEFAULT = 0.5;

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
  // GEAR-DRIVEN ECONOMY (2026-06-22, user "치명타 확률 왜캐 낮냐 / 팍팍 성장"): crit was
  // the outlier-low substat (0.4%/stat → barely felt vs the combo-driven crit). Bumped
  // ×3 so crit GEAR is a real build choice, and critMult base 4→6 so big crits arrive
  // sooner (still bounded by CRIT_MULT_GEAR_CAP). Mirrored in entropy-gate-sim.mjs +
  // ENTROPY_THRESHOLDS re-pinned (crit feeds click income → the gate).
  critChance: { base: 1.2, scales: false }, // +% crit chance (capped resource)
  critMult: { base: 6, scales: false },     // +% crit multiplier (bounded — see CRIT_MULT_GEAR_CAP)
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
// Clean, intuitive GEOMETRIC shapes (the user asked for 동그라미/별표/세모 over busy
// emoji) — each effect type is one colored shape, explained by the trait legend
// in the equip/fusion screens. Distinct shape AND color so they read at a glance.
export const EFFECT_TRAIT: Record<EntityEffectType, { icon: string; accent: string }> = {
  click:      { icon: '●', accent: '#7fd8ff' }, // circle — click power %
  auto:       { icon: '■', accent: '#6ee7a0' }, // square — flat auto rate (/s)
  crit:       { icon: '★', accent: '#ff9a5b' }, // star — crit chance / crit mult
  auto_mult:  { icon: '▣', accent: '#9be86e' }, // nested square — auto power % (was ◆, which collided with the 강화석 currency glyph; ▣ ties to ■ auto)
  multiplier: { icon: '✚', accent: '#c79bff' }, // plus — all-source %
  combo_cap:  { icon: '▲', accent: '#7fe0d8' }, // triangle — combo cap +
  time:       { icon: '◇', accent: '#8fb6ff' }, // (legacy) time rate
  entropy:    { icon: '✶', accent: '#b388ff' }, // (legacy) encounter bonus
};

/** Trait icon per secondary (substat) type — same vocabulary as EFFECT_TRAIT. */
// Overhaul-3 A6 (user): substats that are the SAME stat as a primary trait now
// reuse that primary's icon so a stat reads as ONE concept everywhere — critChance
// → ★ (= crit primary), autoPct → ■ (= auto primary), clickPct → ● (= click
// primary). The legend (EntityPanel SUBSTAT_LEGEND) drops these three so each
// stat is listed exactly once.
export const SUBSTAT_TRAIT: Record<SecondaryStatType, string> = {
  critChance:  '★',
  critMult:    '✶',
  comboCap:    '🔗',
  entropyGain: '🌀',
  dropRate:    '🎁',
  fusionBurst: '⚗',
  autoPct:     '■',
  clickPct:    '●',
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

/** Secondary magnitudes scale with rarity on top of the per-stat base.
 *  RARITY STEEPENING (PO 2026-06-23): steepened from {0.6,1,1.5,2.2,3} (~1.5×/tier)
 *  to ~2.15×/tier so a higher-rarity item's SUBSTATS visibly jump too ("모든 스탯이
 *  바뀌어야"). The UNCAPPED substats (autoPct, dropRate, entropyGain, fusionBurst,
 *  offlineEff, comboCap) genuinely scale ~2.15×/tier; the CRIT substats (critChance /
 *  critMult) are bounded by CRIT_MULT_GEAR_CAP + the in-game crit-chance cap, so they
 *  saturate rather than explode. That cap is also why this can't be a literal 10×/tier:
 *  crit substats FEED the entropy gate (click income), and the sim's best-crit-vs-no-crit
 *  ≤3× invariant breaks past ~2.15×/tier. This is the steepest the sim still passes (crit
 *  spread 2.76× < 3×). Mirrored in scripts/entropy-gate-sim.mjs critFactor; thresholds re-pinned. */
export const SECONDARY_RARITY_SCALE: Record<EntityRarity, number> = {
  common: 0.6,
  rare: 1.3,
  epic: 2.8,
  legendary: 6.0,
  mythic: 12.6,
};

// ── Feature unlock gating (Overhaul-2 🅠7 — staged onboarding) ───────────────
// S1 teaches click/entropy/item/codex + quests; S2 unlocks equip/auto/fusion;
// S3 unlocks the shop + enhancement. Stage ids are 1-based (state.stageIdx + 1).
export const EQUIP_UNLOCK_STAGE_ID = 2;
export const FUSION_UNLOCK_STAGE_ID = 2;
export const ENHANCE_UNLOCK_STAGE_ID = 3;
/** Stage at which the shop unlocks (1-based). boosts.ts re-exports the predicate. */
export const SHOP_UNLOCK_STAGE_ID = 3;

// ── Shop economy (#43 redesign) ─────────────────────────────────────────────
/**
 * Matter packs (USD IAP): each grants matter as a FRACTION of the player's
 * current STAGE anchor (ENTITY_COST_ANCHORS), by pack index (SHOP_PACK_MATTER_FRAC)
 * — so a pack stays stage-relevant WITHOUT coupling to click/auto output (#43).
 */
export interface MatterPackSpec { id: string; priceUSD: number; }
export const MATTER_PACKS: MatterPackSpec[] = [
  { id: 'pack_1', priceUSD: 0.99 },
  { id: 'pack_2', priceUSD: 1.99 },
  { id: 'pack_3', priceUSD: 4.99 },
  { id: 'pack_4', priceUSD: 9.99 },
  { id: 'pack_5', priceUSD: 19.99 },
  { id: 'pack_6', priceUSD: 49.99 },
];
/** Matter granted by each USD pack = ENTITY_COST_ANCHORS[stage] × this[packIndex]. */
export const SHOP_PACK_MATTER_FRAC: number[] = [0.5, 1.1, 3, 6.5, 14, 37];
/** 강화석 bundles offered for matter. */
export const STONE_BUNDLES: number[] = [1, 10, 100];

// #43 PRICING: every shop matter (⚛) cost = ENTITY_COST_ANCHORS[clampStage(stage)]
// × a fraction, scaled GEOMETRICALLY by rarity/rank — NEVER from click/auto output.
// So prices differ per stage (the anchor ladder is ~15-20×/stage) and per rarity,
// and you must advance to afford higher tiers. Helpers live in src/game/shop/pricing.ts.
/** Matter price of a shop item = anchor × this[rarity] × SHOP_RANK_STEP^rank. */
export const SHOP_RARITY_PRICE_FRAC: Record<EntityRarity, number> = { common: 0.10, rare: 0.45, epic: 1.6, legendary: 4.5, mythic: 12 };
/** Geometric premium per rank step (rarity index + gacha-box rank). */
export const SHOP_RANK_STEP = 1.35;
/** Rank index per rarity — the geometric exponent base for shop pricing. */
export const SHOP_RARITY_RANK: Record<EntityRarity, number> = { common: 0, rare: 1, epic: 2, legendary: 3, mythic: 4 };
/** Matter price of one 강화석 = anchor × this. (Overhaul-4: 0.18 → 0.14, slightly cheaper diamonds per user.) */
export const SHOP_STONE_PRICE_FRAC = 0.14;
/** Daily-refresh matter cost = anchor × this[refreshCount] (clamped), escalating. */
export const SHOP_REFRESH_FRAC: number[] = [0.05, 0.15, 0.4, 1.0];

/**
 * Daily attendance (출석체크, v27): a repeating 7-day check-in. One claim per local
 * day; the cycle day = `attendanceStreak % 7`, so after day 7 it loops (a reward
 * every day forever), with day 7 the gift. Matter is granted as `matterAnchorMult ×
 * ENTITY_COST_ANCHORS[playerStage]` so it stays stage-relevant; 강화석 is flat. These
 * are occasional login bonuses (NOT continuous income), so the gear-only economy +
 * entropy gate are unaffected.
 */
export const ATTENDANCE_REWARDS: { matterAnchorMult: number; stones: number; gachaBoxId?: string }[] = [
  { matterAnchorMult: 0.6, stones: 0 },                  // Day 1 — stage-relative matter
  { matterAnchorMult: 1.0, stones: 0 },                  // Day 2 — stage-relative matter
  { matterAnchorMult: 0, stones: 20 },                   // Day 3 — 강화석(다이아)
  { matterAnchorMult: 0, stones: 30 },                   // Day 4
  { matterAnchorMult: 0, stones: 45 },                   // Day 5
  { matterAnchorMult: 0, stones: 60 },                   // Day 6
  { matterAnchorMult: 0, stones: 0, gachaBoxId: 'box_bright' }, // Day 7 — a free 찬란한 성운 box
];

/** Daily shop: entity offers/day, rarity by weighted odds (gate-clamped by stage). */
export const DAILY_SHOP_SLOTS = 6; // Overhaul-4: tighter, cleaner daily grid (2×3) per user.
export const DAILY_SHOP_RARITY_WEIGHTS: Record<EntityRarity, number> = {
  common: 52, rare: 30, epic: 14, legendary: 4, mythic: 0,
};
/** Daily roster pool draws from the most recent this-many stages (recency bias). */
export const DAILY_ROSTER_LOOKBACK = 4;

/** 뽑기 상자 (gacha) — a MATTER sink: buy a box, roll a random entity by its odds
 *  table (gate-clamped to RARITY_STAGE_GATES), apply the #50 quality roll, reveal.
 *  Price = ENTITY_COST_ANCHORS[clampStage(stage)] × priceFrac (negative-EV sink). */
export interface GachaBoxSpec { id: string; priceFrac: number; rank: number; odds: Record<EntityRarity, number>; }
export const GACHA_BOXES: GachaBoxSpec[] = [
  { id: 'box_faint',  priceFrac: 0.6,  rank: 0, odds: { common: 60, rare: 30, epic: 9,  legendary: 1,  mythic: 0 } },
  { id: 'box_bright', priceFrac: 3.0,  rank: 1, odds: { common: 25, rare: 42, epic: 25, legendary: 7,  mythic: 1 } },
  { id: 'box_prime',  priceFrac: 12.0, rank: 2, odds: { common: 0,  rare: 30, epic: 45, legendary: 20, mythic: 4 } },
];
// A7 (user): a box gives a HAUL — this many entities (top tier gets +1) + 강화석.
export const GACHA_ITEMS_BASE = 3;
export const GACHA_TOP_RANK_BONUS_ITEM = 1; // rank ≥ 2 yields one extra entity
export const GACHA_STONES_BY_RANK: Record<number, number> = { 0: 3, 1: 6, 2: 12 };
export function gachaItemCount(rank: number): number {
  return GACHA_ITEMS_BASE + (rank >= 2 ? GACHA_TOP_RANK_BONUS_ITEM : 0);
}

// C-P2 (audit): daily check-in reward — an escalating 강화석 grant that re-hooks
// returning players. The streak only continues on CONSECUTIVE calendar days
// (a gap resets it to 1); reward grows with streak up to a cap.
export const DAILY_CHECKIN_STONES_BASE = 2;
export const DAILY_CHECKIN_STONES_PER_STREAK = 1;
export const DAILY_CHECKIN_STREAK_CAP = 7;
export function dailyCheckInStones(streakDays: number): number {
  const s = Math.max(1, Math.floor(streakDays));
  return DAILY_CHECKIN_STONES_BASE + Math.min(s - 1, DAILY_CHECKIN_STREAK_CAP - 1) * DAILY_CHECKIN_STONES_PER_STREAK;
}

// ── #44 HEXAGON BINGO set bonuses ───────────────────────────────────────────
// 7 equip slots in a hexagon: 0-2 = click (outer), 3-5 = rift (outer), 6 = wild
// (center). A LINE of 3 completes when all 3 are filled and share an equip
// FAMILY (getEquipSetKey); on the 3 center lines the wild (slot 6) is a joker —
// it must be filled but its family is ignored, the two outer endpoints must match.
// Each completed line feeds an OFF-GATE multiplier for its lane (click →
// clickMatterMult only, auto → flat-auto only), so the bonus is strong but never
// touches the entropy gate (NO re-sim). Ring order 0,1,2,3,4,5 → arcs of 3.
export type HexLineKind = 'center' | 'pureClick' | 'pureRift' | 'mixedClick' | 'mixedRift';
export const HEX_BINGO_LINES: { slots: [number, number, number]; kind: HexLineKind }[] = [
  { slots: [0, 6, 3], kind: 'center' },
  { slots: [1, 6, 4], kind: 'center' },
  { slots: [2, 6, 5], kind: 'center' },
  { slots: [0, 1, 2], kind: 'pureClick' },
  { slots: [3, 4, 5], kind: 'pureRift' },
  { slots: [1, 2, 3], kind: 'mixedClick' }, // 1,2 click + 3 rift → majority click
  { slots: [5, 0, 1], kind: 'mixedClick' }, // 0,1 click + 5 rift → majority click
  { slots: [2, 3, 4], kind: 'mixedRift' },  // 3,4 rift + 2 click → majority rift
  { slots: [4, 5, 0], kind: 'mixedRift' },  // 4,5 rift + 0 click → majority rift
];
/** Hexagon slot CENTER positions as % of the board box (0-100). Indices 0-5 are
 *  the outer ring in adjacency order (0,1,2,3,4,5 → ring edges 0-1…5-0), index 6
 *  is the center/wild. Opposite pairs 0-3 / 1-4 / 2-5 are true diameters through
 *  the center, so the 3 'center' bingo lines draw straight across. Pointy-top
 *  hexagon (points at top/bottom), inset so cards fit. Drives BOTH the SVG link
 *  layer (edges + spokes) and absolute slot placement on the equip board. */
export const HEX_NODE_XY: [number, number][] = [
  [80, 32.5], // 0 upper-right  (click)
  [80, 67.5], // 1 lower-right  (click)
  [50, 85],   // 2 bottom       (click)
  [20, 67.5], // 3 lower-left   (rift)
  [20, 32.5], // 4 upper-left   (rift)
  [50, 15],   // 5 top          (rift)
  [50, 50],   // 6 center       (wild)
];
/** The 6 hexagon ring edges (outer perimeter) + 6 spokes (center→each vertex),
 *  as [a,b] node-index pairs — the always-drawn structural links. */
export const HEX_LINK_EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], // ring
  [6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [6, 5], // spokes
];
/** Per completed line, the bonus it adds to its lane's sum (strong / 매콤, off-gate). */
export const HEX_LINE_BONUS = 0.5;
/** Pure-lane arcs (all-click or all-rift) count this many line-units (double). */
export const HEX_PURE_LINE_MULT = 2;
/** Creative "color harmony" kicker: a completed line whose items also share a
 *  RARITY adds this to its lane (same-family is the base; same-rarity is a treat). */
export const HEX_HARMONY_BONUS = 0.3;
/** Bonus SUM per lane is capped here → lane multiplier maxes at 1 + this. */
export const HEX_BONUS_CAP = 5;
/** Stage at which the 7th (center/wild) slot unlocks. */
// Wild center slot — moved 9→6 (user: the 3rd click slot ALSO unlocks at stage 9, so two
// hex slots opened at once; staggering the wild to stage 6 makes the progression less flat).
export const HEX_WILD_UNLOCK_STAGE = 6;

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
