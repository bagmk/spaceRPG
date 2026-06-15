/** UI event types emitted by the game engine to drive React animations. */

import type { RogueTypeKey } from './canvas';

export interface FloatingClickEvent {
  id: number;
  x: number;
  y: number;
  gained: number;
  isCrit: boolean;
  combo: number;
  comboMult: number;
  particleName: string;
  particleDefinition?: string;
  entropyGained: number;
  /** Entity that dropped on this click (look up details via findEntityById). */
  droppedEntityId?: string;
}

/**
 * Throttled (~1/sec) passive auto-income tick for the primary equipped rift
 * entity (🅠3). Drives the "+N/s · <entity>" floating text. Transient — never
 * persisted (dropped by the save whitelist, like the other Floating*Events).
 */
export interface FloatingAutoIncomeEvent {
  id: number;
  /** Per-second auto matter gained (display amount). */
  gained: number;
  /** Primary equipped rift entity id — resolve name/glyph via findEntityById. */
  entityId: string;
  /** Emission timestamp; handleTick uses it to throttle to ~1/sec. */
  t: number;
}

export interface FloatingCollisionEvent {
  id: number;
  x: number;
  y: number;
  bonus: number;
  entropyGained: number;
  name: string;
  tier: RogueTypeKey;
  /** Entity that dropped on this collision (look up details via findEntityById). */
  droppedEntityId?: string;
}

export interface EncounterEvent {
  id: number;
  name: string;
  color: string;
}

/** Result of a FUSE_ENTITIES action — drives the forge reveal UI. */
export interface FusionEvent {
  id: number;
  outputEntityId: string;
  rarityUp: boolean;
  /** Output hit max count and fed a level-up instead (duplicate sink). */
  leveledUp: boolean;
  entropyBurst: number;
  /** Quanta returned: enhance-investment refund + at-cap duplicate payout. */
  refund: number;
  /** Output was already at max count AND max level — refunded instead. */
  atCap: boolean;
  /** 강화석 minted by a failed (non-rarity-up) fusion (P1). 0 on a rarity-up.
   *  For a batch this is the TOTAL minted across all fusions. */
  stonesEarned: number;
  /** 🅠4: how many fusions this event represents (1 for a single fuse). */
  batchCount: number;
  /** 🅠4: rarity-up successes in the batch (1/0 for a single fuse). */
  successCount: number;
  /** 🅠4: non-rarity-up failures in the batch (0/1 for a single fuse). */
  failCount: number;
}

/** Outcome of a 강화 attempt — drives the reveal flash (P1). */
export type EnhanceOutcome = 'up' | 'down' | 'break' | 'protected';

export interface EnhanceEvent {
  id: number;
  entityId: string;
  outcome: EnhanceOutcome;
  /** The stack's level AFTER the attempt. */
  level: number;
}
