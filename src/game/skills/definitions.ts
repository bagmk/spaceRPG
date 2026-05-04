import type { CrossNodeDef, SkillTreeDef, SkillTreeId } from './types';

export function trackLevelCost(trackId: SkillTreeId, level: number): number {
  const targetLevel = Math.max(1, Math.floor(level));
  const growthBase = trackId === 'time' ? 10 : 2;
  return Math.floor(Math.pow(growthBase, targetLevel - 1));
}

export const SKILL_TREES: SkillTreeDef[] = [
  {
    id: 'click',
    label: 'Stellar Forge',
    description: 'Each click strikes harder.',
    color: '#ff6a45',
    unlockStageId: 1,
    rootMaxLevel: Number.MAX_SAFE_INTEGER,
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
    unlockStageId: 2,
    rootMaxLevel: Number.MAX_SAFE_INTEGER,
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
    unlockStageId: 2,
    rootMaxLevel: Number.MAX_SAFE_INTEGER,
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
    unlockStageId: 2,
    rootMaxLevel: Number.MAX_SAFE_INTEGER,
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
  10: 2,
  15: 4,
  20: 8,
  25: 16,
  30: 32,
};

const CROSS_MULT_LABELS: Record<SkillTreeId, Record<(typeof CROSS_TIERS)[number], string>> = {
  click: {
    5: 'Click power x2.',
    10: 'Click power x5.',
    15: 'Click power x10.',
    20: 'Click power x25.',
    25: 'Click power x100.',
    30: 'Click power x1000.',
  },
  auto: {
    5: 'Auto rate x2.',
    10: 'Auto rate x5.',
    15: 'Auto rate x10.',
    20: 'Auto rate x25.',
    25: 'Auto rate x100.',
    30: 'Auto rate x1000.',
  },
  crit: {
    5: 'Crit multiplier x1.5.',
    10: 'Crit multiplier x2.',
    15: 'Crit multiplier x3.',
    20: 'Crit multiplier x5.',
    25: 'Crit multiplier x8.',
    30: 'Crit multiplier x12.',
  },
  time: {
    5: 'Time flow x2.',
    10: 'Time flow x5.',
    15: 'Time flow x10.',
    20: 'Time flow x25.',
    25: 'Time flow x100.',
    30: 'Time flow x1000.',
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
