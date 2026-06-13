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
  /** 강화석 minted by a failed (non-rarity-up) fusion (P1). 0 on a rarity-up. */
  stonesEarned: number;
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
