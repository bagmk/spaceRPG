import type { CrossNodeDef, SkillTreeDef, SkillTreeId } from './types';

export const SKILL_MAX_LEVEL = 30;

const TRACK_COST_BASE: Record<SkillTreeId, number> = {
  click: 3,
  auto: 3,
  crit: 3,
  time: 5.25,
};

const SP_REWARD_BY_CLEARED_STAGE = [1, 1, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 5, 5, 6] as const;

export function trackLevelCost(trackId: SkillTreeId, level: number): number {
  const targetLevel = Math.max(1, Math.floor(level));
  const growthBase = TRACK_COST_BASE[trackId];
  return Math.floor(Math.pow(growthBase, targetLevel - 1));
}

export function getSkillPointsForStageAdvance(clearedStageId: number): number {
  if (clearedStageId < 1 || clearedStageId > SP_REWARD_BY_CLEARED_STAGE.length) {
    return 0;
  }
  return SP_REWARD_BY_CLEARED_STAGE[clearedStageId - 1];
}

export const SKILL_TREES: SkillTreeDef[] = [
  {
    id: 'click',
    label: 'Stellar Forge',
    description: 'Each click strikes harder.',
    color: '#ff6a45',
    unlockStageId: 2,
    rootMaxLevel: SKILL_MAX_LEVEL,
    rootCostCurve: (level) => trackLevelCost('click', level),
    milestones: {
      1: { name: 'Spark', desc: 'Click yields 10.' },
      5: { name: 'Quark Bond', desc: 'Unlocks an SP node slot.' },
      10: { name: 'Gluon Lattice', desc: 'Unlocks an SP node slot.' },
      15: { name: 'Plasma Strike', desc: 'Unlocks an SP node slot.' },
      20: { name: 'Stellar Forge', desc: 'Unlocks an SP node slot.' },
      25: { name: 'Supernova Hammer', desc: 'Unlocks an SP node slot.' },
      30: { name: 'Quasar Cannon', desc: 'Unlocks an SP node slot.' },
    },
  },
  {
    id: 'auto',
    label: 'Cosmic Web',
    description: 'The universe gathers itself.',
    color: '#6d8fff',
    unlockStageId: 3,
    rootMaxLevel: SKILL_MAX_LEVEL,
    rootCostCurve: (level) => trackLevelCost('auto', level),
    milestones: {
      1: { name: 'Filament Spin', desc: 'Auto rate 10/s.' },
      5: { name: 'Cold Drift', desc: 'Unlocks an SP node slot.' },
      10: { name: 'Dark Flow', desc: 'Unlocks an SP node slot.' },
      15: { name: 'Web Loom', desc: 'Unlocks an SP node slot.' },
      20: { name: 'Cosmic Web', desc: 'Unlocks an SP node slot.' },
      25: { name: 'Universal Pulse', desc: 'Unlocks an SP node slot.' },
      30: { name: 'Eternal Drift', desc: 'Unlocks an SP node slot.' },
    },
  },
  {
    id: 'crit',
    label: 'Quantum Lens',
    description: 'Probability bends to your stare.',
    color: '#9966cc',
    unlockStageId: 4,
    rootMaxLevel: SKILL_MAX_LEVEL,
    rootCostCurve: (level) => trackLevelCost('crit', level),
    milestones: {
      1: { name: "Observer's Eye", desc: 'Crit chance starts growing at 1.5 % per level.' },
      5: { name: 'Wave Collapse', desc: 'Unlocks an SP node slot.' },
      10: { name: 'Heisenberg Lens', desc: 'Unlocks an SP node slot.' },
      15: { name: 'Probability Sieve', desc: 'Unlocks an SP node slot.' },
      20: { name: 'Quantum Lens', desc: 'Unlocks an SP node slot.' },
      25: { name: 'Many Worlds', desc: 'Unlocks an SP node slot.' },
      30: { name: 'Eigenvalue Strike', desc: 'Unlocks an SP node slot.' },
    },
  },
  {
    id: 'time',
    label: 'Aeon Drive',
    description: 'Bend the rate of cosmic time.',
    color: '#ffb84d',
    unlockStageId: 5,
    rootMaxLevel: 30,
    rootCostCurve: (level) => trackLevelCost('time', level),
    milestones: {
      1: { name: 'Tick Tock', desc: 'Cosmic time compresses by 10× per level.' },
      5: { name: 'Cosmic Pulse', desc: 'Unlocks an SP node slot.' },
      10: { name: 'Time Dilation', desc: 'Unlocks an SP node slot.' },
      15: { name: 'Temporal Flow', desc: 'Unlocks an SP node slot.' },
      20: { name: 'Aeon Drive', desc: 'Unlocks an SP node slot.' },
      25: { name: 'Eternity Engine', desc: 'Unlocks an SP node slot.' },
      30: { name: 'Cosmic Clock', desc: 'Unlocks an SP node slot.' },
    },
  },
];

const CROSS_TIERS = [5, 10, 15, 20, 25, 30] as const;

const CROSS_SP_COST: Record<(typeof CROSS_TIERS)[number], number> = {
  5: 1,
  10: 1,
  15: 2,
  20: 2,
  25: 3,
  30: 3,
};

const CROSS_MULT_LABELS: Record<SkillTreeId, Record<(typeof CROSS_TIERS)[number], string>> = {
  click: {
    5: 'Click power ×1.4.',
    10: 'Click power ×1.8.',
    15: 'Click power ×2.4.',
    20: 'Click power ×3.2.',
    25: 'Click power ×4.4.',
    30: 'Click power ×6.',
  },
  auto: {
    5: 'Auto rate ×1.4.',
    10: 'Auto rate ×1.8.',
    15: 'Auto rate ×2.4.',
    20: 'Auto rate ×3.2.',
    25: 'Auto rate ×4.4.',
    30: 'Auto rate ×6.',
  },
  crit: {
    5: 'Crit multiplier ×1.15.',
    10: 'Crit multiplier ×1.3.',
    15: 'Crit multiplier ×1.5.',
    20: 'Crit multiplier ×1.75.',
    25: 'Crit multiplier ×2.05.',
    30: 'Crit multiplier ×2.5.',
  },
  time: {
    5: 'Time flow ×1.25.',
    10: 'Time flow ×1.6.',
    15: 'Time flow ×2.1.',
    20: 'Time flow ×2.8.',
    25: 'Time flow ×3.6.',
    30: 'Time flow ×5.',
  },
};

export const CROSS_NODES: CrossNodeDef[] = SKILL_TREES.flatMap((tree) =>
  CROSS_TIERS.map((tier) => ({
    id: `${tree.id}_lv${tier}`,
    tier,
    label: `${tree.label} Lv ${tier}`,
    description: CROSS_MULT_LABELS[tree.id][tier],
    cost: 0,
    spCost: CROSS_SP_COST[tier],
    costCurrency: 'quanta',
    requires: { [tree.id]: tier },
    unlockStageId: 1,
  })),
);

export function findTree(treeId: SkillTreeId): SkillTreeDef | undefined {
  return SKILL_TREES.find((tree) => tree.id === treeId);
}

export function findNode(nodeId: string): CrossNodeDef | undefined {
  return CROSS_NODES.find((node) => node.id === nodeId);
}

// All cross-node tiers are visible regardless of stage; unlock is level-based only.
export function getVisibleCrossTier(_stageId: number): 0 | 5 | 10 | 15 | 20 | 25 | 30 {
  return 30;
}
