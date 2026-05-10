/** Legacy save format interfaces for migration. Not exported outside storage/. */

import type { EndingId, SingularityUnlockId, SaveState, ShopBoost, LegacyShopBoosts } from '../types';
import type { SkillState } from '../skills/types';

export interface SaveStateV1 {
  version: 1;
  stageIdx: number;
  quanta: number;
  clickLevel: number;
  autoLevel: number;
  critLevel?: number;
  entropy: number;
  totalClicks: number;
  collisions: number;
  universeCount: number;
  cumulativeBoost: number;
  runStartTime: number;
  totalTimePlayed: number;
  pendingCondenseStageIdx: number | null;
  pendingCondenseEntropy: number;
  completedRun: boolean;
}

export interface SaveStateV2 extends Omit<SaveStateV1, 'version' | 'critLevel'> {
  version: 2;
  critLevel: number;
  condensedMass: number;
  echoes: number;
  singularityUnlocks: SingularityUnlockId[];
  endingsCompleted: EndingId[];
  lastEndingId: EndingId | null;
  selectedEndingId: EndingId | null;
  lastSaveAt: number;
  stageStartedAt: number;
  cosmicClockSec: number;
  mechanicCharge: number;
  mechanicStep: number;
  mechanicTriggered: boolean;
}

export interface SaveStateV3 extends Omit<SaveStateV2, 'version'> {
  version: 3;
  skills: SkillState;
  skillPoints: number;
  tutorialDone: boolean;
}

export interface SaveStateV4 extends Omit<SaveStateV3, 'version'> {
  version: 4;
  cosmicHoursThisRun: number;
  dailyCheckIns: import('../types').DailyCheckInState;
}

export interface SaveStateV5Legacy extends Omit<SaveState, 'version' | 'shopBoosts'> {
  version: 5;
  shopBoosts: LegacyShopBoosts;
}

export interface SaveStateV6Legacy extends Omit<SaveState, 'version' | 'shopBoosts'> {
  version: 6;
  shopBoosts: LegacyShopBoosts | ShopBoost[];
}
