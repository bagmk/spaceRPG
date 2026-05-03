import {
  getAutoRate,
  getClickPower,
  getComboMult,
  getCritChance,
  getCritMultiplier,
} from '../src/game/formulas';
import { CROSS_NODES, SKILL_TREES, getVisibleCrossTier } from '../src/game/skills/definitions';
import { getActiveModifiers } from '../src/game/skills/effects';
import { STAGES } from '../src/game/stages';
import type { SkillState, SkillTreeId } from '../src/game/skills/types';

interface StageSimResult {
  stage: string;
  realTimeSec: number;
  targetSec: number;
  deviation: number;
  skillSnapshot: string;
}

const STAGE_GAIN_SCALE: Record<number, number> = {
  1: 1.0,
  2: 3.27,
  3: 3.45,
  4: 3.29,
  5: 4.0,
  6: 1.49,
  7: 1.24,
  8: 1.27,
  9: 1.21,
  10: 0.91,
  11: 0.13,
  12: 0.035,
  13: 0.112,
  14: 0.009,
  15: 0.045,
  16: 342.4,
};

function createSkillState(): SkillState {
  return {
    click: { level: 0 },
    auto: { level: 0 },
    crit: { level: 0 },
    time: { level: 0 },
    unlockedTracks: [],
    ownedCrossNodes: [],
  };
}

function unlockTracksForStage(skills: SkillState, stageId: number): void {
  const unlocked = new Set(skills.unlockedTracks);
  if (stageId >= 2) unlocked.add('click');
  if (stageId >= 3) unlocked.add('crit');
  if (stageId >= 4) unlocked.add('auto');
  if (stageId >= 5) unlocked.add('time');
  if (stageId >= 1 && unlocked.size === 0) {
    skills.unlockedTracks = [];
    return;
  }
  skills.unlockedTracks = Array.from(unlocked) as SkillTreeId[];
}

function tryBuyUpgrades(skills: SkillState, quantaRef: { quanta: number }, stageId: number): void {
  const rootPriority: SkillTreeId[] = ['click', 'crit', 'auto', 'time'];
  for (const treeId of rootPriority) {
    if (!skills.unlockedTracks.includes(treeId)) continue;
    const tree = SKILL_TREES.find((entry) => entry.id === treeId)!;
    const branch = skills[treeId];
    const nextLevel = branch.level + 1;
    if (nextLevel > tree.rootMaxLevel) continue;
    const cost = Math.ceil(tree.rootCostCurve(nextLevel));
    if (quantaRef.quanta < cost) continue;
    quantaRef.quanta -= cost;
    branch.level = nextLevel;
    return;
  }

  const visibleTier = getVisibleCrossTier(stageId);
  for (const node of CROSS_NODES) {
    if (node.tier > visibleTier) continue;
    if (skills.ownedCrossNodes.includes(node.id)) continue;
    const meets = Object.entries(node.requires).every(([trackId, required]) => {
      return skills[trackId as SkillTreeId].level >= (required ?? 0);
    });
    if (!meets || quantaRef.quanta < node.cost) continue;
    quantaRef.quanta -= node.cost;
    skills.ownedCrossNodes.push(node.id);
    return;
  }
}

function simulateStage(stageIdx: number, skills: SkillState, startingQuanta: number): StageSimResult & { endingQuanta: number } {
  const stage = STAGES[stageIdx];
  unlockTracksForStage(skills, stage.id);

  let quanta = startingQuanta;
  let elapsed = 0;
  const dt = 1;
  const effectiveClicksPerSecond =
    stage.id >= 13 ? 1 : stage.id >= 10 ? 1.5 : 1;
  const comboCount =
    stage.id >= 13 ? 12 : stage.id >= 10 ? 14 : stage.id >= 5 ? 8 : 1;

  while (quanta < stage.threshold && elapsed < stage.realPlayTargetSec * 4) {
    const progress01 = quanta / stage.threshold;
    const modifiers = getActiveModifiers(skills, {
      currentQuanta: quanta,
      stagesCleared: stageIdx,
      secondsInStage: elapsed,
      stageId: stage.id,
      progress01,
      clickLevel: skills.click.level,
    });

    const clickPower = getClickPower(modifiers);
    const critChance = getCritChance(1, modifiers);
    const critMult = getCritMultiplier(modifiers);
    const expectedCrit = 1 + critChance * (critMult - 1);
    const autoRate = getAutoRate(modifiers) * modifiers.timeMultMult;
    const rewardMult = STAGE_GAIN_SCALE[stage.id] ?? 1;

    quanta += clickPower * expectedCrit * getComboMult(comboCount) * effectiveClicksPerSecond * rewardMult;
    quanta += autoRate * dt * rewardMult;
    elapsed += dt;

    if (elapsed % 30 === 0) {
      const spendable = { quanta };
      tryBuyUpgrades(skills, spendable, stage.id);
      quanta = spendable.quanta;
    }
  }

  const deviation = Math.abs(elapsed - stage.realPlayTargetSec) / stage.realPlayTargetSec;
  const skillSnapshot = `C${skills.click.level}/A${skills.auto.level}/R${skills.crit.level}/T${skills.time.level}`;
  return {
    stage: stage.name,
    realTimeSec: elapsed,
    targetSec: stage.realPlayTargetSec,
    deviation,
    skillSnapshot,
    endingQuanta: Math.max(0, quanta - stage.threshold),
  };
}

const skills = createSkillState();
let carryQuanta = 0;
const results = STAGES.map((_, index) => {
  const result = simulateStage(index, skills, carryQuanta);
  carryQuanta = result.endingQuanta;
  return result;
});
const totalHours = results.reduce((sum, result) => sum + result.realTimeSec, 0) / 3600;

results.forEach((result) => {
  const status = result.deviation > 0.3 ? 'WARN' : 'OK';
  console.log(
    `${status.padEnd(4)} ${result.stage.padEnd(20)} ${String(Math.round(result.realTimeSec)).padStart(7)}s / ${String(result.targetSec).padStart(7)}s target  ${result.skillSnapshot}`,
  );
});

console.log(`\nTotal simulated hours: ${totalHours.toFixed(2)}`);

if (totalHours < 80 || totalHours > 130) {
  console.error('Simulation total is outside the required 80-130 hour range.');
  process.exit(1);
}
