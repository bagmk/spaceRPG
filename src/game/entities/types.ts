/** Stage Entity system — replaces the skill tree. */

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

/** Cost of the next purchase given current count. */
export function getEntityCost(entity: StageEntity, count: number): number {
  return Math.ceil(entity.baseCost * Math.pow(entity.costScaling, count));
}
