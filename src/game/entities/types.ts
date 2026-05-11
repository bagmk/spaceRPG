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
  | 'lepton'
  | 'boson'
  | 'nucleus'
  | 'atom'
  | 'molecule'
  | 'plasma'
  | 'radiation'
  | 'cloud'
  | 'halo'
  | 'star'
  | 'supernova'
  | 'remnant'
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
  | 'click'       // click power flat economy gain
  | 'crit'        // crit chance flat add
  | 'time'        // cosmic time multiplier
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
  formula: string;      // short label: 'H₂O', 'p⁺'
  description: string;  // max ~60 chars — mobile readable
  rarity: EntityRarity;
  baseCost: number;
  costScaling: number;  // multiplier per purchase, e.g. 1.15
  maxCount: number;     // 0 = unlimited
  effect: EntityEffect;
  visual: EntityVisual;
  endingId?: EndingId;  // optional Stage 16 ending-specific unlock
  aliases?: string[];   // legacy IDs preserved when entity fantasy changes
}

/** What gets serialised in SaveState. */
export interface PurchasedEntityEntry {
  entityId: string;
  count: number;
}

/** Cost of the next purchase given current count. */
export function getEntityCost(entity: StageEntity, count: number): number {
  return Math.floor(entity.baseCost * Math.pow(entity.costScaling, count));
}
