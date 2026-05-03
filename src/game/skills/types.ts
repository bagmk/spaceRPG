export type SkillTreeId = 'click' | 'auto' | 'crit' | 'time';
export type SkillTier = 15 | 20 | 25 | 30;

export interface SkillTrackState {
  level: number;
}

export interface SkillTrackMilestone {
  name: string;
  desc: string;
}

export interface SkillTreeDef {
  id: SkillTreeId;
  label: string;
  description: string;
  color: string;
  unlockStageId: number;
  rootCostCurve: (level: number) => number;
  rootMaxLevel: number;
  milestones: Partial<Record<number, SkillTrackMilestone>>;
}

export interface CrossNodeDef {
  id: string;
  tier: SkillTier;
  label: string;
  description: string;
  cost: number;
  costCurrency: 'quanta';
  requires: Partial<Record<SkillTreeId, number>>;
  unlockStageId: number;
}

export interface SkillState {
  click: SkillTrackState;
  auto: SkillTrackState;
  crit: SkillTrackState;
  time: SkillTrackState;
  unlockedTracks: SkillTreeId[];
  ownedCrossNodes: string[];
}
