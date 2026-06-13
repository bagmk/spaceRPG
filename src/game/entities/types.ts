/** Stage Entity system — replaces the skill tree. */

import { ENTITY_BASE_COST_FACTOR, ENTITY_COST_ANCHORS } from '../balance';
import type { EndingId } from '../types';

export type EntityRarity = 'common' | 'rare' | 'epic' | 'legendary';

export type EntityGlyph =
  | 'quantum'
  | 'field'
  | 'wave'
  | 'particle'
  | 'antiparticle'
  | 'quark'
  | 'meson'        // NEW: pion/kaon — quark-antiquark pair
  | 'lepton'
  | 'boson'
  | 'nucleus'
  | 'atom'
  | 'molecule'
  | 'plasma'
  | 'radiation'
  | 'cloud'
  | 'accretion'    // NEW: directional gas inflow
  | 'envelope'     // NEW: bloated stellar envelope (red giant)
  | 'nebula'       // NEW: planetary nebula — color-rich bipolar lobes
  | 'halo'
  | 'star'
  | 'supernova'
  | 'remnant'
  | 'crystal'      // NEW: diamond/iron star — frozen lattice
  | 'black_hole'
  | 'galaxy'
  | 'planet'
  | 'water'
  | 'life'
  | 'cell'
  | 'dna'
  | 'neuron'
  | 'entropy'
  | 'void'
  | 'singularity'
  | 'bounce';

export type EntityEffectType =
  | 'auto'        // auto-rate flat economy gain
  | 'auto_mult'   // Auto Power — % multiplier on entity flat-auto (rift gear)
  | 'click'       // click power percentage multiplier
  | 'crit'        // crit chance flat add
  | 'time'        // DEPRECATED cosmic time multiplier — no entity uses it (entropy gate replaced it)
  | 'entropy'     // legacy; avoid for new Entity Lab data
  | 'combo_cap'   // combo cap flat add
  | 'multiplier'; // all-source quanta multiplier

export interface EntityEffect {
  type: EntityEffectType;
  value: number;     // percentage — e.g. 5 means +5%
  isFlat?: boolean;  // if true, value is flat add (used for crit, combo_cap)
}

export interface EntityVisual {
  symbol: string;    // shown in canvas — 'H₂O', 'p⁺', 'γ'
  glyph: EntityGlyph; // animated UI icon family
  color: string;     // main hex color
  glowColor: string; // glow/trail hex color
  size: 'tiny' | 'small' | 'medium' | 'large';
  motion: 'orbit' | 'drift' | 'pulse' | 'spin' | 'float';
}

export interface StageEntity {
  id: string;
  stageId: number;      // 1-16
  name: string;
  nameKo?: string;
  formula: string;      // short label: 'H₂O', 'p⁺'
  description: string;  // max ~60 chars — mobile readable
  descriptionKo?: string;
  rarity: EntityRarity;
  baseCost: number;
  costScaling: number;  // multiplier per purchase, e.g. 1.15
  maxCount: number;     // 0 = unlimited
  effect: EntityEffect;
  visual: EntityVisual;
  endingId?: EndingId;  // optional Stage 16 ending-specific unlock
  aliases?: string[];   // legacy IDs preserved when entity fantasy changes
}

/**
 * Legacy serialised shape (save version <= 13).
 * Kept for migration only — runtime state uses EntityInstance.
 */
export interface PurchasedEntityEntry {
  entityId: string;
  count: number;
}

/** What gets serialised in SaveState (v14+): owned entity stacks. */
export interface EntityInstance {
  entityId: string;
  count: number;
  /** Upgrade level — duplicates feed level-ups (Phase 3 fusion sink). Starts at 1. */
  level: number;
  /** Cumulative quanta spent enhancing this stack — partially refunded on fusion. */
  invested?: number;
  /**
   * Carried across prestige (Phase 4-3 D2). Carried items keep their level but
   * NOT their origin-stage power: getGearPowerExponent drops the itemStage
   * clamp so the exponent follows the player's stage only — a head start, not
   * an entropy-gate-collapsing cudgel.
   */
  carried?: boolean;
}

/**
 * Gear category (장비 이원화): auto/time entities power the spatial rift;
 * everything else (click/crit/multiplier/...) is click gear.
 * Lives here (dependency-free) so substats/effects can both use it.
 */
export type EquipCategory = 'click' | 'rift';

export function getEquipCategory(entity: StageEntity): EquipCategory {
  const t = entity.effect.type;
  return t === 'auto' || t === 'auto_mult' || t === 'time' ? 'rift' : 'click';
}

/**
 * Player-anchored base cost (Phase 4-1): while the player is on (or before)
 * the item's origin stage the price is the authored baseCost; past-stage
 * items are re-priced at the player's current cost anchor. Under the
 * player-stage power curve a stage-1 legendary performs like a stage-16 one,
 * so origin pricing would be a 15-orders-of-magnitude arbitrage.
 */
export function getPlayerAnchoredBaseCost(entity: StageEntity, playerStageId: number): number {
  const playerAnchor = ENTITY_COST_ANCHORS[playerStageId as keyof typeof ENTITY_COST_ANCHORS];
  if (playerAnchor === undefined || entity.stageId >= playerStageId) return entity.baseCost;
  return Math.max(entity.baseCost, Math.ceil(playerAnchor * ENTITY_BASE_COST_FACTOR[entity.rarity]));
}

/** Cost of the next purchase given current count, at the player's anchor. */
export function getEntityCost(entity: StageEntity, count: number, playerStageId: number): number {
  return Math.ceil(getPlayerAnchoredBaseCost(entity, playerStageId) * Math.pow(entity.costScaling, count));
}
