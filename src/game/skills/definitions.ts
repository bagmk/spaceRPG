import type { CrossNodeDef, SkillTreeDef, SkillTreeId } from './types';

const TRACK_BASE_COST: Record<SkillTreeId, number> = {
  click: 40,
  auto: 70,
  crit: 110,
  time: 180,
};

export function trackLevelCost(trackId: SkillTreeId, level: number): number {
  return Math.floor(TRACK_BASE_COST[trackId] * Math.pow(1.95, level));
}

export const SKILL_TREES: SkillTreeDef[] = [
  {
    id: 'click',
    label: 'Stellar Forge',
    description: 'Each click strikes harder.',
    color: '#ff6a45',
    unlockStageId: 2,
    rootMaxLevel: 30,
    rootCostCurve: (level) => trackLevelCost('click', level),
    milestones: {
      1: { name: 'Spark', desc: 'Click yields 1.' },
      5: { name: 'Quark Bond', desc: 'Click emits 2 motes.' },
      10: { name: 'Gluon Lattice', desc: 'Click emits 3 motes; +20 % power.' },
      15: { name: 'Plasma Strike', desc: 'Combo timeout +200 ms.' },
      20: { name: 'Stellar Forge', desc: 'Click emits 4 motes.' },
      25: { name: 'Supernova Hammer', desc: 'Click emits 5 motes; every 7th click is a guaranteed crit.' },
      30: { name: 'Quasar Cannon', desc: 'Click emits 6 motes; click VFX 2× scale.' },
    },
  },
  {
    id: 'auto',
    label: 'Cosmic Web',
    description: 'The universe gathers itself.',
    color: '#6d8fff',
    unlockStageId: 4,
    rootMaxLevel: 30,
    rootCostCurve: (level) => trackLevelCost('auto', level),
    milestones: {
      1: { name: 'Filament Spin', desc: 'Auto rate 1/s.' },
      5: { name: 'Cold Drift', desc: '+30 % auto rate.' },
      10: { name: 'Dark Flow', desc: '+30 % auto rate.' },
      15: { name: 'Web Loom', desc: 'Auto contributes to combo.' },
      20: { name: 'Cosmic Web', desc: '+50 % auto rate.' },
      25: { name: 'Universal Pulse', desc: 'Auto runs through condense and cinematics.' },
      30: { name: 'Eternal Drift', desc: '+100 % auto rate.' },
    },
  },
  {
    id: 'crit',
    label: 'Quantum Lens',
    description: 'Probability bends to your stare.',
    color: '#9966cc',
    unlockStageId: 3,
    rootMaxLevel: 30,
    rootCostCurve: (level) => trackLevelCost('crit', level),
    milestones: {
      1: { name: "Observer's Eye", desc: 'Base crit chance 5 %, ×3 multiplier.' },
      5: { name: 'Wave Collapse', desc: '+5 % crit chance.' },
      10: { name: 'Heisenberg Lens', desc: 'Crit damage variance becomes [×0.5, ×2.0].' },
      15: { name: 'Probability Sieve', desc: '+10 % crit chance.' },
      20: { name: 'Quantum Lens', desc: 'Crit multiplier ×5.' },
      25: { name: 'Many Worlds', desc: 'Encounter cap raises to 10 % of threshold.' },
      30: { name: 'Eigenvalue Strike', desc: 'Crit chance cap 80 %; multiplier ×8.' },
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
      1: { name: 'Tick Tock', desc: 'Time × 1.05.' },
      5: { name: 'Cosmic Pulse', desc: 'Time × 1.30.' },
      10: { name: 'Time Dilation', desc: 'Time × 1.80.' },
      15: { name: 'Temporal Flow', desc: 'Time × 2.50.' },
      20: { name: 'Aeon Drive', desc: 'Time × 4.00.' },
      25: { name: 'Eternity Engine', desc: 'Time × 7.00.' },
      30: { name: 'Cosmic Clock', desc: 'Time × 12.00.' },
    },
  },
];

export const CROSS_NODES: CrossNodeDef[] = [
  {
    id: 'echoing_click',
    tier: 15,
    label: 'Echoing Click',
    description: 'Click has 18 % chance to fire twice.',
    cost: 50_000,
    costCurrency: 'quanta',
    requires: { click: 15, time: 10 },
    unlockStageId: 7,
  },
  {
    id: 'wave_capture',
    tier: 15,
    label: 'Wave Capture',
    description: 'Auto ticks may also crit.',
    cost: 50_000,
    costCurrency: 'quanta',
    requires: { crit: 15, auto: 10 },
    unlockStageId: 7,
  },
  {
    id: 'inflaton_echo',
    tier: 15,
    label: 'Inflaton Echo',
    description: 'First 5 s of each stage runs at time × 3.',
    cost: 50_000,
    costCurrency: 'quanta',
    requires: { time: 15, click: 10 },
    unlockStageId: 7,
  },
  {
    id: 'pair_production',
    tier: 20,
    label: 'Pair Production',
    description: 'Every 7th click is a guaranteed crit.',
    cost: 5_000_000,
    costCurrency: 'quanta',
    requires: { click: 20, crit: 15 },
    unlockStageId: 11,
  },
  {
    id: 'heisenberg',
    tier: 20,
    label: 'Heisenberg',
    description: 'Crit damage rolls in [×0.5, ×2.0].',
    cost: 5_000_000,
    costCurrency: 'quanta',
    requires: { crit: 20, time: 15 },
    unlockStageId: 11,
  },
  {
    id: 'dilation',
    tier: 20,
    label: 'Dilation',
    description: 'At 80–100 % threshold, time slows but rewards surge.',
    cost: 5_000_000,
    costCurrency: 'quanta',
    requires: { time: 20, auto: 15 },
    unlockStageId: 11,
  },
  {
    id: 'filament',
    tier: 20,
    label: 'Filament Network',
    description: 'Auto rate gains stagesCleared^1.2 multiplier.',
    cost: 5_000_000,
    costCurrency: 'quanta',
    requires: { auto: 20, click: 15 },
    unlockStageId: 11,
  },
  {
    id: 'big_bang_click',
    tier: 25,
    label: 'Big Bang Click',
    description: 'Once per stage: a click gains sqrt(totalClicks) × clickPower.',
    cost: 500_000_000,
    costCurrency: 'quanta',
    requires: { click: 25, crit: 25 },
    unlockStageId: 14,
  },
  {
    id: 'web_of_all',
    tier: 25,
    label: 'Web of All',
    description: 'Auto rate gains a multiplier equal to clickLevel².',
    cost: 500_000_000,
    costCurrency: 'quanta',
    requires: { auto: 25, click: 25 },
    unlockStageId: 14,
  },
  {
    id: 'eternal_return',
    tier: 25,
    label: 'Eternal Return',
    description: 'Once per run: rewind to the previous stage and re-clear it.',
    cost: 500_000_000,
    costCurrency: 'quanta',
    requires: { time: 25, auto: 25 },
    unlockStageId: 14,
  },
  {
    id: 'cosmos_primal',
    tier: 30,
    label: 'Cosmos Primal',
    description: 'All effects ×10.',
    cost: 1_000_000_000_000,
    costCurrency: 'quanta',
    requires: { click: 30, auto: 30, crit: 30, time: 30 },
    unlockStageId: 15,
  },
];

export function findTree(treeId: SkillTreeId): SkillTreeDef | undefined {
  return SKILL_TREES.find((tree) => tree.id === treeId);
}

export function findNode(nodeId: string): CrossNodeDef | undefined {
  return CROSS_NODES.find((node) => node.id === nodeId);
}

export function getVisibleCrossTier(stageId: number): 0 | 15 | 20 | 25 | 30 {
  if (stageId >= 15) return 30;
  if (stageId >= 14) return 25;
  if (stageId >= 11) return 20;
  if (stageId >= 7) return 15;
  return 0;
}
