/**
 * Entity drop system (entity redesign Phase 1 — the Collect loop).
 *
 * Clicks, crits and rogue collisions roll for an entity drop from the current
 * stage's pool. Drops land in the inventory and fill the almanac collection
 * grid. All randomness is injected via roll values so reducers stay pure.
 * Tunables live in balance.ts (DROP_*).
 */

import {
  DROP_CHANCE_BASE,
  DROP_CHANCE_COLLISION,
  DROP_CHANCE_CRIT_MULT,
  DROP_COMBO_BIAS_THRESHOLD,
  DROP_CRIT_RARITY_BIAS,
  DROP_CURRENT_STAGE_WEIGHT,
  DROP_RARITY_WEIGHTS,
  RARITY_GATE_RAMP_STAGES,
  RARITY_STAGE_GATES,
  DROP_HOME_AFFINITY_FALLOFF,
  DROP_HOME_AFFINITY_FLOOR,
  ERA_BIAS_STAGES,
  ERA_BIAS_FLOOR,
  ERA_BIAS_SIGMA,
} from '../balance';
import { getEntitiesForStage } from './stageItems';
import { makeInstance } from './instances';
import type { EntityInstance, EntityRarity, StageEntity } from './types';

const RARITY_ORDER: EntityRarity[] = ['common', 'rare', 'epic', 'legendary', 'mythic'];

export interface DropRoll {
  /** 0..1 — decides whether anything drops. */
  roll: number;
  /** 0..1 — decides rarity and which entity within the rarity pool. */
  pickRoll: number;
  /**
   * 0..1 — decides which stage's pool the drop comes from (Phase 4-1 stage
   * independence). Absent → current stage only (legacy callers/tests).
   */
  stageRoll?: number;
}

interface DropContext {
  isCrit?: boolean;
  combo?: number;
}

/** Drop chance for a click with the given context. */
export function getClickDropChance(isCrit: boolean): number {
  return DROP_CHANCE_BASE * (isCrit ? DROP_CHANCE_CRIT_MULT : 1);
}

/** The fixed last stage of the cosmology arc — rarity gates beyond it (mythic's
 *  999 sentinel) mean "never field-drops" (fusion / gacha only). */
const LAST_FIELD_STAGE = 16;

/**
 * The earliest stage at which an entity can actually drop = its home stage,
 * pushed up to its rarity gate if the gate is later (a legendary "born" in an
 * early stage can't drop until RARITY_STAGE_GATES.legendary). Returns `null` for
 * rarities that never field-drop (mythic). This is the single source for the
 * codex "best drop stage S{n}" badge — for the gated set the best stage ≠ the
 * home stage, so a naive `entity.stageId` would be wrong.
 */
export function getBestDropStage(entity: StageEntity): number | null {
  const gate = RARITY_STAGE_GATES[entity.rarity] ?? 1;
  const best = Math.max(entity.stageId, gate);
  return best > LAST_FIELD_STAGE ? null : best;
}

/**
 * Rarity gate ramp: 0 before the gate stage, then a linear climb to full
 * weight over RARITY_GATE_RAMP_STAGES — epics trickle in at stage 7 and are
 * common drops by stage 9.
 */
export function getRarityGateRamp(rarity: EntityRarity, stageId: number): number {
  const gate = RARITY_STAGE_GATES[rarity] ?? 1;
  if (stageId < gate) return 0;
  return Math.min(1, (stageId - gate + 1) / RARITY_GATE_RAMP_STAGES);
}

/**
 * Stage-independent rarity drop SHARE (normalized base weights) — the headline
 * "how rare is each tier" number shown in the codex (R6). Crit/gate bias and
 * stage pooling are excluded so the figure is stable and easy to read. Mythic
 * is 0 here (fusion-only) and dropped from the normalization.
 */
export function getBaseRarityDropShare(): Record<EntityRarity, number> {
  const total = RARITY_ORDER.reduce((sum, r) => sum + DROP_RARITY_WEIGHTS[r], 0);
  const out = {} as Record<EntityRarity, number>;
  for (const r of RARITY_ORDER) out[r] = total > 0 ? DROP_RARITY_WEIGHTS[r] / total : 0;
  return out;
}

/**
 * Per-entity drop share among its own stage's pool: the rarity share divided by
 * how many entities of that rarity live on the same stage. Answers "if a drop
 * lands in this stage's pool, how likely is it THIS entity?" (R6 per-card).
 * Mythic returns 0 (never drops). Time entities don't backfill but still drop
 * on their home stage, so they're counted normally here.
 */
export function getEntityDropShare(entity: StageEntity): number {
  if (entity.rarity === 'mythic') return 0;
  const share = getBaseRarityDropShare()[entity.rarity] ?? 0;
  const sameRarityCount = getEntitiesForStage(entity.stageId).filter(
    (e) => e.rarity === entity.rarity,
  ).length;
  return sameRarityCount > 0 ? share / sameRarityCount : 0;
}

function getRarityWeights(stageId: number, context: DropContext): Record<EntityRarity, number> {
  const biased =
    context.isCrit === true || (context.combo ?? 0) >= DROP_COMBO_BIAS_THRESHOLD;
  const bias = biased ? DROP_CRIT_RARITY_BIAS : 1;
  return {
    common: DROP_RARITY_WEIGHTS.common * getRarityGateRamp('common', stageId),
    rare: DROP_RARITY_WEIGHTS.rare * bias * getRarityGateRamp('rare', stageId),
    epic: DROP_RARITY_WEIGHTS.epic * bias * getRarityGateRamp('epic', stageId),
    legendary: DROP_RARITY_WEIGHTS.legendary * bias * getRarityGateRamp('legendary', stageId),
    mythic: 0, // never drops — Mythic is fusion-only (legendary-3)
  };
}

function pickRarity(pick01: number, weights: Record<EntityRarity, number>): EntityRarity {
  const total = RARITY_ORDER.reduce((sum, r) => sum + weights[r], 0);
  let cursor = pick01 * total;
  for (const rarity of RARITY_ORDER) {
    cursor -= weights[rarity];
    if (cursor < 0) return rarity;
  }
  return 'common';
}

/**
 * Pick which stage's pool a drop (or fusion output) comes from (Phase 4-1
 * stage independence): DROP_CURRENT_STAGE_WEIGHT of rolls stay on the current
 * stage; the rest backfill past stages weighted by (uncollected codex entries
 * + 1) × P6 recency affinity, so collection holes pull drops toward themselves
 * but nearer stages are favored (see DROP_HOME_AFFINITY_* in balance.ts). The
 * `s < playerStageId` loop bound is the hard directional gate — affinity only
 * re-weights existing candidates, it never lets a future stage drop.
 */
export function pickDropStage(
  playerStageId: number,
  stageRoll: number,
  almanacCollected: Record<number, string[]>,
): number {
  if (playerStageId <= 1 || stageRoll < DROP_CURRENT_STAGE_WEIGHT) return playerStageId;
  // Spread the remaining roll over past stages 1..playerStage-1.
  const weights: number[] = [];
  let total = 0;
  for (let s = 1; s < playerStageId; s++) {
    const collected = almanacCollected[s]?.length ?? 0;
    const uncollected = Math.max(0, getEntitiesForStage(s).length - collected);
    // P6 recency affinity: nearer past stages weigh more (toward 1.0), distant
    // ones decay toward DROP_HOME_AFFINITY_FLOOR but never to 0 — so collection
    // holes still pull, just dampened by distance.
    const affinity = DROP_HOME_AFFINITY_FLOOR
      + (1 - DROP_HOME_AFFINITY_FLOOR) * Math.pow(DROP_HOME_AFFINITY_FALLOFF, playerStageId - s - 1);
    const w = (uncollected + 1) * affinity;
    weights.push(w);
    total += w;
  }
  if (total <= 0) return playerStageId;
  const within = (stageRoll - DROP_CURRENT_STAGE_WEIGHT) / (1 - DROP_CURRENT_STAGE_WEIGHT);
  let cursor = Math.min(0.999999, Math.max(0, within)) * total;
  for (let s = 1; s < playerStageId; s++) {
    cursor -= weights[s - 1];
    if (cursor < 0) return s;
  }
  return playerStageId;
}

/**
 * Pick an entity of the target rarity from a stage pool, falling back down the
 * rarity ladder when the pool lacks that rarity. Shared by drops and fusion.
 * `excludeTime` removes time-type entities (past-stage pools — the cosmic
 * clock is stage-relative, so old time gear must not backfill).
 */
export function pickEntityByRarity(
  stageId: number,
  rarity: EntityRarity,
  pick01: number,
  excludeTime = false,
  eraBias?: number,
): StageEntity | null {
  let pool = getEntitiesForStage(stageId);
  if (excludeTime) pool = pool.filter((e) => e.effect.type !== 'time');
  if (pool.length === 0) return null;
  const rarityIdx = RARITY_ORDER.indexOf(rarity);
  let candidates: StageEntity[] = [];
  for (let i = rarityIdx; i >= 0; i--) {
    candidates = pool.filter((e) => e.rarity === RARITY_ORDER[i]);
    if (candidates.length > 0) break;
  }
  if (candidates.length === 0) candidates = pool;
  // Re-spread the roll so one 0..1 value covers both rarity and index decisions.
  const spread = (pick01 * 9973) % 1;
  // Era-ordered bias (Stage 11): candidates are in evolutionary order within the rarity tier;
  // weight each by a gaussian centred on the gate progress (0..1), so low progress favours the
  // EARLIEST era entity of the rolled rarity (Earth/Moon/Ocean) and near-full progress the LATEST
  // (City Lights/Satellite). FLOOR keeps every era reachable. Rarity weights stay untouched.
  if (eraBias !== undefined && candidates.length > 1 && ERA_BIAS_STAGES.includes(stageId)) {
    const n = candidates.length;
    const twoSigmaSq = 2 * ERA_BIAS_SIGMA * ERA_BIAS_SIGMA;
    let total = 0;
    const weights = candidates.map((_, i) => {
      const d = i / (n - 1) - eraBias;
      const w = ERA_BIAS_FLOOR + Math.exp(-(d * d) / twoSigmaSq);
      total += w;
      return w;
    });
    let acc = spread * total;
    for (let i = 0; i < n; i++) {
      acc -= weights[i];
      if (acc < 0) return candidates[i];
    }
    return candidates[n - 1];
  }
  const index = Math.floor(spread * candidates.length);
  return candidates[Math.min(index, candidates.length - 1)];
}

/**
 * Roll an entity drop. Returns null when nothing drops. `chance` is the
 * pre-computed drop probability (click vs collision differ). Rarity gates and
 * weights always follow the PLAYER's stage; the pool stage comes from
 * rolls.stageRoll (current stage when absent).
 */
export function rollEntityDrop(
  playerStageId: number,
  chance: number,
  rolls: DropRoll,
  context: DropContext = {},
  almanacCollected: Record<number, string[]> = {},
  gateProgress?: number,
): StageEntity | null {
  if (rolls.roll >= chance) return null;
  const rarity = pickRarity(rolls.pickRoll, getRarityWeights(playerStageId, context));
  const poolStageId =
    rolls.stageRoll !== undefined
      ? pickDropStage(playerStageId, rolls.stageRoll, almanacCollected)
      : playerStageId;
  const isHomeStage = poolStageId === playerStageId;
  // Era-bias only applies to a CURRENT-stage drop (the gate progress is the player's own stage);
  // past-stage backfills pass undefined → uniform within-rarity pick.
  return pickEntityByRarity(poolStageId, rarity, rolls.pickRoll, !isHomeStage, isHomeStage ? gateProgress : undefined);
}

/** Collision drops use a flat, higher chance. */
export function getCollisionDropChance(): number {
  return DROP_CHANCE_COLLISION;
}

/**
 * Add one copy of an entity to the inventory (immutable). #50: `quality` is the
 * fresh roll for this copy; a stack keeps its BEST specimen (max), so acquiring
 * more copies can only improve the stack's quality (and never downgrades it).
 * Omitted (e.g. tests) → quality is left untouched / neutral.
 */
export function addToInventory(
  inventory: EntityInstance[],
  entityId: string,
  quality?: number,
): EntityInstance[] {
  // P6: every acquired copy is its OWN flat entry (instanceId, level 1, count 1).
  // No stacking — per-copy level/placement is the whole point of the v25 model.
  // Overhaul-4 P1: this is the UNCAPPED grant/mint path — it intentionally ignores
  // maxCount (which gates only buy-for-collection in handlePurchaseEntity). Drops,
  // gacha, fusion output AND the duplicate-collection copy-token mint all flow through
  // here, so a maxCount=1 legendary can still accumulate the spare copies its leveling
  // needs. Never re-introduce a maxCount check here.
  return [...inventory, makeInstance(entityId, quality !== undefined ? { quality } : {})];
}

/** Record an entity in the almanac collection grid (immutable, idempotent). */
export function addToAlmanac(
  almanacCollected: Record<number, string[]>,
  stageId: number,
  entityId: string,
): Record<number, string[]> {
  const collected = almanacCollected[stageId] ?? [];
  if (collected.includes(entityId)) return almanacCollected;
  return { ...almanacCollected, [stageId]: [...collected, entityId] };
}

/**
 * Persona #10: was this drop a genuinely NEW discovery — i.e. the entity wasn't
 * already recorded in the almanac for its stage? Drives the floating "발견!"
 * reveal toast. The check mirrors addToAlmanac's idempotency guard (same
 * stage→ids lookup) so "new" means "addToAlmanac will actually grow the grid".
 */
export function isNewDiscovery(
  almanacCollected: Record<number, string[]>,
  stageId: number,
  entityId: string,
): boolean {
  return !(almanacCollected[stageId] ?? []).includes(entityId);
}
