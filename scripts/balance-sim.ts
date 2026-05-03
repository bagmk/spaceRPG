import {
  getAutoCost,
  getAutoRate,
  getClickCost,
  getClickPower,
  getComboMult,
  getCritChance,
  getCritCost,
  getCritMultiplier,
} from '../src/game/formulas';
import { STAGES } from '../src/game/stages';

interface StageSimResult {
  stage: string;
  realTimeSec: number;
  clicksUsed: number;
  finalAutoLevel: number;
  finalClickLevel: number;
  finalCritLevel: number;
  targetSec: number;
  deviation: number;
}

function simulateStage(stageIdx: number): StageSimResult {
  const stage = STAGES[stageIdx];
  let quanta = 0;
  let clickLevel = 0;
  let autoLevel = 0;
  let critLevel = 0;
  let combo = 0;
  let clicksUsed = 0;
  let realTimeSec = 0;
  const dt = 0.9;

  while (quanta < stage.threshold && realTimeSec < stage.realPlayTargetSec * 3) {
    let purchased = true;
    while (purchased) {
      purchased = false;
      const autoCost = getAutoCost(stage, autoLevel);
      const clickCost = getClickCost(stage, clickLevel);
      const critCost = getCritCost(stage, critLevel);
      if (quanta >= autoCost) {
        quanta -= autoCost;
        autoLevel += 1;
        purchased = true;
        continue;
      }
      if (quanta >= clickCost) {
        quanta -= clickCost;
        clickLevel += 1;
        purchased = true;
        continue;
      }
      if (quanta >= critCost) {
        quanta -= critCost;
        critLevel += 1;
        purchased = true;
      }
    }

    combo = dt <= 0.7 ? combo + 1 : 1;
    clicksUsed += 1;
    const clickPower = getClickPower(stage, clickLevel, 0);
    const comboMult = getComboMult(combo);
    const critChance = getCritChance(combo);
    const critMult = getCritMultiplier(critLevel);
    const expectedCritMult = 1 + critChance * (critMult - 1);
    quanta += clickPower * comboMult * expectedCritMult;
    quanta += getAutoRate(stage, autoLevel, 0) * dt;
    realTimeSec += dt;
  }

  const deviation = Math.abs(realTimeSec - stage.realPlayTargetSec) / stage.realPlayTargetSec;
  return {
    stage: stage.name,
    realTimeSec,
    clicksUsed,
    finalAutoLevel: autoLevel,
    finalClickLevel: clickLevel,
    finalCritLevel: critLevel,
    targetSec: stage.realPlayTargetSec,
    deviation,
  };
}

const results = STAGES.map((_, index) => simulateStage(index));
const failed = results.filter((result) => result.deviation > 0.5);

results.forEach((result) => {
  const status = result.deviation > 0.5 ? 'FAIL' : 'OK';
  console.log(
    `${status.padEnd(4)} ${result.stage.padEnd(20)} ${result.realTimeSec
      .toFixed(1)
      .padStart(7)}s / ${String(result.targetSec).padStart(4)}s target  clicks=${String(
      result.clicksUsed,
    ).padStart(5)}  auto=${String(result.finalAutoLevel).padStart(3)}  click=${String(
      result.finalClickLevel,
    ).padStart(3)}  crit=${String(result.finalCritLevel).padStart(3)}`,
  );
});

if (failed.length > 0) {
  console.error(`\nSimulation failed for ${failed.length} stage(s).`);
  process.exit(1);
}

console.log('\nAll stages are within ±50% of their target duration.');
