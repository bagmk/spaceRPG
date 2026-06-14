import {
  getAutoRate,
  getClickPower,
  getComboMult,
  getCritMultiplier,
  getProgress,
  getTimeGaugeForCosmicClock,
  getCosmicTimeFillRate,
} from '../src/game/formulas';
import { CROSS_NODES, SKILL_TREES, getSkillPointsForStageAdvance } from '../src/game/skills/definitions';
import { getActiveModifiers } from '../src/game/skills/effects';
import { STAGES } from '../src/game/stages';
import { getStageStartCosmicTime } from '../src/game/timeFlow';
import type { SkillState, SkillTreeId } from '../src/game/skills/types';

const CLICKS_PER_SEC = 10;
const EXPECTED_CRIT_CHANCE = 0.5;
const DT_SEC = 0.1;
const MAX_STAGE_MULT = 8;

const ROOT_BUY_ORDER: SkillTreeId[] = ['click', 'auto', 'crit', 'time'];
const TRACK_ORDER_WEIGHT: Record<SkillTreeId, number> = {
  click: 0,
  auto: 1,
  crit: 2,
  time: 3,
};
const CROSS_BUY_ORDER = [...CROSS_NODES].sort((a, b) => {
  const aTrack = Object.keys(a.requires)[0] as SkillTreeId;
  const bTrack = Object.keys(b.requires)[0] as SkillTreeId;
  return a.tier - b.tier || TRACK_ORDER_WEIGHT[aTrack] - TRACK_ORDER_WEIGHT[bTrack];
});

interface StageResult {
  stageId: number;
  name: string;
  elapsedSec: number;
  targetSec: number;
  qReadyAt: number | null;
  tReadyAt: number | null;
  bottleneck: 'quanta' | 'time' | 'both' | 'timeout';
  quanta: number;
  timeGauge: number;
  skills: string;
  nodes: number;
  sp: number;
}

function createSkills(): SkillState {
  return {
    click: { level: 0 },
    auto: { level: 0 },
    crit: { level: 0 },
    time: { level: 0 },
    unlockedTracks: ['click'],
    ownedCrossNodes: [],
  };
}

function unlockTracks(skills: SkillState, stageId: number): void {
  const unlocked = new Set(skills.unlockedTracks);
  if (stageId >= 1) unlocked.add('click');
  if (stageId >= 3) unlocked.add('auto');
  if (stageId >= 4) unlocked.add('crit');
  if (stageId >= 5) unlocked.add('time');
  skills.unlockedTracks = Array.from(unlocked) as SkillState['unlockedTracks'];
}

function buyCrossNodes(skills: SkillState, spRef: { value: number }): boolean {
  for (const node of CROSS_BUY_ORDER) {
    if (skills.ownedCrossNodes.includes(node.id)) continue;
    if (spRef.value < node.spCost) continue;
    const meets = Object.entries(node.requires).every(([trackId, required]) => {
      return skills[trackId as SkillTreeId].level >= (required ?? 0);
    });
    if (!meets) continue;
    skills.ownedCrossNodes.push(node.id);
    spRef.value -= node.spCost;
    return true;
  }
  return false;
}

function buyRootLevel(skills: SkillState, quantaRef: { value: number }): boolean {
  let best: { treeId: SkillTreeId; cost: number; order: number } | null = null;

  ROOT_BUY_ORDER.forEach((treeId, order) => {
    if (!skills.unlockedTracks.includes(treeId)) return;
    const tree = SKILL_TREES.find((candidate) => candidate.id === treeId);
    if (!tree) return;
    const nextLevel = skills[treeId].level + 1;
    if (nextLevel > tree.rootMaxLevel) return;
    const cost = Math.ceil(tree.rootCostCurve(nextLevel));
    if (quantaRef.value < cost) return;
    if (!best || cost < best.cost || (cost === best.cost && order < best.order)) {
      best = { treeId, cost, order };
    }
  });

  if (!best) return false;
  quantaRef.value -= best.cost;
  skills[best.treeId].level += 1;
  return true;
}

function spendAvailable(skills: SkillState, quantaRef: { value: number }, spRef: { value: number }): void {
  let guard = 0;
  while (guard < 256) {
    guard += 1;
    const boughtNode = buyCrossNodes(skills, spRef);
    const boughtRoot = buyRootLevel(skills, quantaRef);
    if (!boughtNode && !boughtRoot) break;
  }
}

function skillSnapshot(skills: SkillState): string {
  return `C${skills.click.level}/A${skills.auto.level}/R${skills.crit.level}/T${skills.time.level}`;
}

function simulateStage(
  stageIdx: number,
  skills: SkillState,
  quantaStart: number,
  spRef: { value: number },
): StageResult {
  const stage = STAGES[stageIdx];
  unlockTracks(skills, stage.id);

  let quanta = quantaStart;
  let cosmicClockSec = getStageStartCosmicTime(stageIdx);
  let combo = 0;
  let elapsedSec = 0;
  let qReadyAt: number | null = quanta >= stage.threshold ? 0 : null;
  let tReadyAt: number | null = cosmicClockSec >= stage.cosmicTimeSec ? 0 : null;
  const maxElapsed = stage.realPlayTargetSec * MAX_STAGE_MULT;

  const quantaAfterInitialSpend = { value: quanta };
  spendAvailable(skills, quantaAfterInitialSpend, spRef);
  quanta = quantaAfterInitialSpend.value;

  while ((quanta < stage.threshold || cosmicClockSec < stage.cosmicTimeSec) && elapsedSec < maxElapsed) {
    const progress01 = getProgress(quanta, stage.threshold);
    const modifiers = getActiveModifiers(skills, {
      currentQuanta: quanta,
      stagesCleared: stageIdx,
      secondsInStage: elapsedSec,
      stageId: stage.id,
      progress01,
      clickLevel: skills.click.level,
    });

    const clickPower = getClickPower(modifiers);
    const critMult = getCritMultiplier(skills.crit.level, modifiers);
    const expectedCrit = stage.id > 2 ? 1 + EXPECTED_CRIT_CHANCE * (critMult - 1) : 1;
    const clickGain = Array.from({ length: Math.round(CLICKS_PER_SEC * DT_SEC) }).reduce((sum) => {
      combo += 1;
      return sum + clickPower * getComboMult(combo) * expectedCrit;
    }, 0);
    const autoGain = getAutoRate(modifiers) * DT_SEC;
    const timeGain = getCosmicTimeFillRate(skills.time.level, modifiers) * DT_SEC;

    quanta += clickGain + autoGain;
    cosmicClockSec += timeGain;
    elapsedSec += DT_SEC;

    const spendable = { value: quanta };
    spendAvailable(skills, spendable, spRef);
    quanta = spendable.value;

    if (qReadyAt === null && quanta >= stage.threshold) qReadyAt = elapsedSec;
    if (tReadyAt === null && cosmicClockSec >= stage.cosmicTimeSec) tReadyAt = elapsedSec;
  }

  const qDone = quanta >= stage.threshold;
  const tDone = cosmicClockSec >= stage.cosmicTimeSec;
  let bottleneck: StageResult['bottleneck'] = 'timeout';
  if (qDone && tDone) {
    if (qReadyAt !== null && tReadyAt !== null && Math.abs(qReadyAt - tReadyAt) <= stage.realPlayTargetSec * 0.1) {
      bottleneck = 'both';
    } else {
      bottleneck = (qReadyAt ?? 0) > (tReadyAt ?? 0) ? 'quanta' : 'time';
    }
  }

  if (stageIdx < STAGES.length - 1) {
    spRef.value += getSkillPointsForStageAdvance(stage.id);
  }

  return {
    stageId: stage.id,
    name: stage.name,
    elapsedSec,
    targetSec: stage.realPlayTargetSec,
    qReadyAt,
    tReadyAt,
    bottleneck,
    quanta,
    timeGauge: getTimeGaugeForCosmicClock(stageIdx, cosmicClockSec),
    skills: skillSnapshot(skills),
    nodes: skills.ownedCrossNodes.length,
    sp: spRef.value,
  };
}

const skills = createSkills();
const spRef = { value: 0 };
let quanta = 0;

const results = STAGES.map((_, index) => {
  const result = simulateStage(index, skills, quanta, spRef);
  quanta = result.quanta;
  return result;
});

let total = 0;
for (const result of results) {
  total += result.elapsedSec;
  const devPct = ((result.elapsedSec - result.targetSec) / result.targetSec) * 100;
  const qAt = result.qReadyAt === null ? ' -- ' : `${Math.round(result.qReadyAt)}s`.padStart(5);
  const tAt = result.tReadyAt === null ? ' -- ' : `${Math.round(result.tReadyAt)}s`.padStart(5);
  const logQ = result.quanta > 0 ? Math.log10(result.quanta).toFixed(1) : '-inf';
  console.log(
    `${String(result.stageId).padStart(2)} ${result.name.padEnd(20)} ${Math.round(result.elapsedSec)
      .toString()
      .padStart(7)}s / ${String(result.targetSec).padStart(7)}s ${devPct
      .toFixed(1)
      .padStart(7)}%  Q@${qAt} T@${tAt} ${result.bottleneck.padEnd(7)} ${result.skills} SP${result.sp} N${result.nodes} logQ=${logQ}`,
  );
}

console.log(`\nTotal: ${(total / 3600).toFixed(2)}h`);
