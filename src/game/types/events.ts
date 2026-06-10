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
