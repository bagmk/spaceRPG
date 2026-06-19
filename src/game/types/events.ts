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

/** One fused trio's outcome — drives the per-card gacha reveal grid. */
export interface FusionResultCard {
  outputEntityId: string;
  rarityUp: boolean;
  atCap: boolean;
  stonesEarned: number;
}

/** Result of a FUSE_ENTITIES action — drives the forge reveal UI. */
export interface FusionEvent {
  id: number;
  outputEntityId: string;
  rarityUp: boolean;
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
  /** Per-trio outcomes for the gacha reveal grid (1 entry for a single fuse). */
  cards: FusionResultCard[];
}

/** Outcome of a 강화 attempt — drives the reveal flash. #47: 'down' (level-down)
 *  is gone; a failed unprotected attempt now 'break's (destroy + 강화석 refund). */
export type EnhanceOutcome = 'up' | 'break' | 'protected';

export interface EnhanceEvent {
  id: number;
  entityId: string;
  outcome: EnhanceOutcome;
  /** The stack's level AFTER the attempt. */
  level: number;
  /** Matter handed back this attempt (#40 payout) — shown on the inline indicator. */
  payout?: number;
  /** #47: 강화석 minted when a failed unprotected attempt destroys a copy (0 otherwise). */
  stonesEarned?: number;
}

/** #43 gacha pull — drives the single-card reveal in the shop's Nebula Boxes board. */
export interface GachaEvent {
  id: number;
  /** The rolled entity (look up details via findEntityById). */
  entityId: string;
  /** Quality score [0,1] of the pulled copy (#50) — gold border when in the tail. */
  quality: number;
  /** Which box tier was opened (for the "다시 뽑기" retry). */
  boxId: string;
}

/** A claimed milestone/era-record (#42) — drives the slot-machine matter rollup. */
export interface QuestClaimEvent {
  id: number;
  questId: string;
  /** Matter granted (the number that rolls up like a slot machine). */
  matter: number;
  /** 강화석 granted (flat). */
  stones: number;
}
