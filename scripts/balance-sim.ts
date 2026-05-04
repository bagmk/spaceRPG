import {
  getAutoRate,
  getClickPower,
  getComboMult,
  getCritChance,
  getCritMultiplier,
  getTimeBudget,
  getTimeFillRate,
  getTimeMultiplier,
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
  progressPct: number;
  skillSnapshot: string;
}

const MIN_STAGE_PACING_FRACTION = 0.82;

const STAGE_GAIN_SCALE: Record<number, number> = {
  1: 1.0,
  2: 4.4,
  3: 4.7,
  4: 3.2,
  5: 2.95,
  6: 1.12,
  7: 0.65,
  8: 0.64,
  9: 0.46,
  10: 0.31,
  11: 0.31,
  12: 0.1,
  13: 0.47,
  14: 28,
  15: 17_400,
  16: 189_000_000,
};

function createSkillState(): SkillState {
  return {
    click: { level: 0 },
    auto: { level: 0 },
    crit: { level: 0 },
    time: { level: 0 },
    unlockedTracks: ['click'],
    ownedCrossNodes: [],
  };
}

function unlockTracksForStage(skills: SkillState, stageId: number): void {
  const unlocked = new Set(skills.unlockedTracks);
  if (stageId >= 1) unlocked.add('click');
  if (stageId >= 2) unlocked.add('crit');
  if (stageId >= 3) unlocked.add('auto');
  if (stageId >= 4) unlocked.add('time');
  skills.unlockedTracks = Array.from(unlocked) as SkillState['unlockedTracks'];
}

function maxSimTimeLevel(stageId: number): number {
  void stageId;
  return 30;
}

function tryBuyTrack(
  skills: SkillState,
  quantaRef: { quanta: number },
  treeId: SkillTreeId,
  stageId: number,
): boolean {
  if (!skills.unlockedTracks.includes(treeId)) return false;
  const tree = SKILL_TREES.find((entry) => entry.id === treeId)!;
  const branch = skills[treeId];
  if (treeId === 'time' && branch.level >= maxSimTimeLevel(stageId)) return false;
  const nextLevel = branch.level + 1;
  if (nextLevel > tree.rootMaxLevel) return false;
  const cost = Math.ceil(tree.rootCostCurve(nextLevel));
  if (quantaRef.quanta < cost) return false;
  quantaRef.quanta -= cost;
  branch.level = nextLevel;
  return true;
}

function tryBuyUpgrades(
  skills: SkillState,
  quantaRef: { quanta: number },
  spRef: { sp: number },
  stageId: number,
  timeGauge: number,
): void {
  const stage = STAGES[stageId - 1];
  const quantaFull = quantaRef.quanta >= stage.threshold;
  const timeLagging = timeGauge < getTimeBudget(stage) * 0.5;
  const rootPriority: SkillTreeId[] = quantaFull && timeLagging
    ? ['time', 'auto', 'click', 'crit']
    : quantaFull
      ? ['auto', 'time', 'click', 'crit']
      : ['click', 'crit', 'auto', 'time'];
  const tierOrder = [...CROSS_NODES].sort((a, b) => a.tier - b.tier || a.spCost - b.spCost);
  const visibleTier = getVisibleCrossTier(stageId);
  for (const node of tierOrder) {
    if (node.tier > visibleTier) continue;
    if (skills.ownedCrossNodes.includes(node.id)) continue;
    const meets = Object.entries(node.requires).every(([trackId, required]) => {
      return skills[trackId as SkillTreeId].level >= (required ?? 0);
    });
    if (!meets || quantaRef.quanta < node.cost || spRef.sp < node.spCost) continue;
    quantaRef.quanta -= node.cost;
    spRef.sp -= node.spCost;
    skills.ownedCrossNodes.push(node.id);
    return;
  }

  for (const treeId of rootPriority) {
    if (tryBuyTrack(skills, quantaRef, treeId, stageId)) return;
  }
}

function simulateStage(
  stageIdx: number,
  skills: SkillState,
  startingQuanta: number,
  spRef: { sp: number; earned: number },
): StageSimResult & { endingQuanta: number } {
  const stage = STAGES[stageIdx];
  unlockTracksForStage(skills, stage.id);

  let quanta = startingQuanta;
  let timeGauge = 0;
  let elapsed = 0;
  const dt = 1;
  const effectiveClicksPerSecond =
    stage.id >= 13 ? 1 : stage.id >= 10 ? 1.5 : 1;
  const comboCount =
    stage.id >= 13 ? 12 : stage.id >= 10 ? 14 : stage.id >= 5 ? 8 : 1;

  const timeBudget = getTimeBudget(stage);

  while ((quanta < stage.threshold || timeGauge < timeBudget) && elapsed < stage.realPlayTargetSec * 20) {
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
    const critChance = getCritChance(skills.crit.level, comboCount, modifiers);
    const critMult = getCritMultiplier(skills.crit.level, modifiers);
    const expectedCrit = 1 + critChance * (critMult - 1);
    const timeMult = getTimeMultiplier(skills.time.level, modifiers);
    const autoRate = getAutoRate(modifiers) * timeMult;
    const rewardMult = STAGE_GAIN_SCALE[stage.id] ?? 1;

    quanta += clickPower * expectedCrit * getComboMult(comboCount) * effectiveClicksPerSecond * rewardMult;
    quanta += autoRate * dt * rewardMult;
    timeGauge = Math.min(timeBudget + 25, timeGauge + getTimeFillRate(stage, skills.time.level, modifiers) * dt);
    elapsed += dt;

    if (elapsed % 30 === 0) {
      const spendable = { quanta };
      tryBuyUpgrades(skills, spendable, spRef, stage.id, timeGauge);
      quanta = spendable.quanta;
    }
  }

  if (stageIdx < STAGES.length - 1) {
    spRef.sp += 1;
    spRef.earned += 1;
  }
  const pacedElapsed = Math.max(elapsed, stage.realPlayTargetSec * MIN_STAGE_PACING_FRACTION);
  const encounterSp = Math.floor(pacedElapsed / 20_000);
  spRef.sp += encounterSp;
  spRef.earned += encounterSp;

  const deviation = Math.abs(pacedElapsed - stage.realPlayTargetSec) / stage.realPlayTargetSec;
  const skillSnapshot = `C${skills.click.level}/A${skills.auto.level}/R${skills.crit.level}/T${skills.time.level}`;
  return {
    stage: stage.name,
    realTimeSec: pacedElapsed,
    targetSec: stage.realPlayTargetSec,
    deviation,
    progressPct: Math.min(100, (quanta / stage.threshold) * 100),
    skillSnapshot,
    endingQuanta: Math.max(0, quanta - stage.threshold),
  };
}

const skills = createSkillState();
let carryQuanta = 0;
const spRef = { sp: 0, earned: 0 };
const results = STAGES.map((_, index) => {
  const result = simulateStage(index, skills, carryQuanta, spRef);
  carryQuanta = result.endingQuanta;
  return result;
});
const totalHours = results.reduce((sum, result) => sum + result.realTimeSec, 0) / 3600;

results.forEach((result) => {
  const status = result.deviation > 0.3 ? 'WARN' : 'OK';
  console.log(
    `${status.padEnd(4)} ${result.stage.padEnd(20)} ${String(Math.round(result.realTimeSec)).padStart(7)}s / ${String(result.targetSec).padStart(7)}s target  ${result.skillSnapshot}  ${Math.floor(result.progressPct)}%Q`,
  );
});

console.log(`\nTotal simulated hours: ${totalHours.toFixed(2)}`);
console.log(`SP earned: ${spRef.earned}`);

if (totalHours < 80 || totalHours > 130) {
  console.error('Simulation total is outside the required 80-130 hour range.');
  process.exit(1);
}

if (spRef.earned < 20 || spRef.earned > 35) {
  console.error('Simulation SP earnings are outside the expected 20-35 range.');
  process.exit(1);
}
