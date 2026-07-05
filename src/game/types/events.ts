/** UI event types emitted by the game engine to drive React animations. */

import type { RogueTypeKey } from './canvas';
import type { EntityRarity } from '../entities/types';

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
 *  is gone; a failed unprotected attempt either 'break's (destroy + 강화석 refund) or,
 *  for the larger fraction of fails, is 'fail' (유지 — kept at level, no level gained). */
export type EnhanceOutcome = 'up' | 'break' | 'protected' | 'fail';

export interface EnhanceEvent {
  id: number;
  entityId: string;
  /** P6: the specific copy enhanced — lets the result popup recompute its stat. */
  instanceId?: string;
  outcome: EnhanceOutcome;
  /** The stack's level AFTER the attempt. */
  level: number;
  /** The level BEFORE the attempt — drives the before→after stat readout on success. */
  prevLevel?: number;
  /** Matter handed back this attempt (#40 payout) — shown on the inline indicator. */
  payout?: number;
  /** #47: 강화석 minted when a failed unprotected attempt destroys a copy (0 otherwise). */
  stonesEarned?: number;
  /** P7b: spare copies merged in this enhance (the copy-collection mechanic). */
  mergedCount?: number;
}

/** One entity in a gacha haul. */
export interface GachaPullItem {
  entityId: string;
  /** Quality score [0,1] of the pulled copy (#50) — gold border when in the tail. */
  quality: number;
}
/** #43 gacha pull — A7 (user): a box yields a HAUL of 3-4 entities + 강화석,
 *  revealed as a multi-card grid in the shop's Nebula Boxes board. */
export interface GachaEvent {
  id: number;
  items: GachaPullItem[];
  /** 강화석 granted alongside the items. */
  stonesEarned: number;
  /** Which box tier was opened (for the "다시 뽑기" retry). */
  boxId: string;
}

/**
 * A genuinely NEW entity (not previously in the almanac) just dropped into the
 * inventory — drives the floating "Discovered!" reveal toast (persona #10).
 * Transient like the other Floating/reveal events: never persisted, dropped by
 * the save whitelist, cleared by CLEAR_DROP_EVENT. Mirrors GachaEvent (a reveal
 * event keyed by a monotonic eventId).
 */
export interface FloatingDropEvent {
  id: number;
  entityId: string;
  /** Pool stage the copy came from — resolves glyph/name via findEntityById. */
  stageId: number;
  rarity: EntityRarity;
}

/**
 * A codex sub-collection was just CLAIMED — drives the "collection complete!"
 * celebration (the collection-peak moment). `isFullSet` is true when this claim
 * completed its parent set (every sibling subset now claimed): the bigger
 * milestone gets a fuller-screen celebration. Transient like the other reveal
 * events: never persisted, dropped by the save whitelist, cleared by
 * CLEAR_CODEX_CLAIM_EVENT. Mirrors FloatingDropEvent (a reveal keyed by eventId).
 */
export interface CodexClaimEvent {
  id: number;
  /** The claimed subset's bare id (e.g. 'quarks') — resolves label/reward via CODEX_SETS. */
  subsetId: string;
  /** Whether this claim completed every subset of its parent set. */
  isFullSet: boolean;
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

/** OVERHAUL5: one promotion-altar attempt's outcome (drives the 승급 reveal). */
export interface CrewPromoteEvent {
  id: number;
  crewId: string;
  fromTier: string;
  toTier: string;
  success: boolean;
  cardsSpent: number;
  stonesSpent: number;
  /** True when the shared mythic pity floor forced this success. */
  pity?: boolean;
}
