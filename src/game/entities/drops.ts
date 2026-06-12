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
} from '../balance';
import { getEntitiesForStage } from './stageItems';
import type { EntityInstance, EntityRarity, StageEntity } from './types';

const RARITY_ORDER: EntityRarity[] = ['common', 'rare', 'epic', 'legendary'];

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

function getRarityWeights(stageId: number, context: DropContext): Record<EntityRarity, number> {
  const biased =
    context.isCrit === true || (context.combo ?? 0) >= DROP_COMBO_BIAS_THRESHOLD;
  const bias = biased ? DROP_CRIT_RARITY_BIAS : 1;
  return {
    common: DROP_RARITY_WEIGHTS.common * getRarityGateRamp('common', stageId),
    rare: DROP_RARITY_WEIGHTS.rare * bias * getRarityGateRamp('rare', stageId),
    epic: DROP_RARITY_WEIGHTS.epic * bias * getRarityGateRamp('epic', stageId),
    legendary: DROP_RARITY_WEIGHTS.legendary * bias * getRarityGateRamp('legendary', stageId),
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
 * + 1), so collection holes pull drops toward themselves.
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
    const w = uncollected + 1;
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
  const index = Math.floor(((pick01 * 9973) % 1) * candidates.length);
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
): StageEntity | null {
  if (rolls.roll >= chance) return null;
  const rarity = pickRarity(rolls.pickRoll, getRarityWeights(playerStageId, context));
  const poolStageId =
    rolls.stageRoll !== undefined
      ? pickDropStage(playerStageId, rolls.stageRoll, almanacCollected)
      : playerStageId;
  return pickEntityByRarity(poolStageId, rarity, rolls.pickRoll, poolStageId !== playerStageId);
}

/** Collision drops use a flat, higher chance. */
export function getCollisionDropChance(): number {
  return DROP_CHANCE_COLLISION;
}

/** Add one copy of an entity to the inventory (immutable). */
export function addToInventory(inventory: EntityInstance[], entityId: string): EntityInstance[] {
  const existing = inventory.find((e) => e.entityId === entityId);
  if (existing) {
    return inventory.map((e) => (e.entityId === entityId ? { ...e, count: e.count + 1 } : e));
  }
  return [...inventory, { entityId, count: 1, level: 1 }];
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
