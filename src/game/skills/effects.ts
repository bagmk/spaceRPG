import type { SkillState } from './types';

export interface ModifierContext {
  currentQuanta?: number;
  stagesCleared?: number;
  secondsInStage?: number;
  stageId?: number;
  progress01?: number;
  clickLevel?: number;
}

export interface Modifiers {
  clickPowerMult: number;
  clickPowerAdd: number;
  clickEmissionCount: number;
  clickVfxScale: number;
  autoRateMult: number;
  autoRateAdd: number;
  critChanceAdd: number;
  critChanceCapAdd: number;
  critMultMult: number;
  comboTimeoutMs: number;
  comboCapAdd: number;
  timeMultMult: number;
  echoClickChance: number;
  pairProductionPeriod: number;
  bigBangUnlocked: boolean;
  hawkingEcho: boolean;
  darkEnergyAuto: boolean;
  filamentExp: number;
  eternalEngine: boolean;
  webOfAll: boolean;
  heisenberg: boolean;
  waveCollapse: boolean;
  manyWorldsCapMult: number;
  encounterBonusMult: number;
  apexMult: number;
  inflatonEchoSec: number;
  dilation: boolean;
  eternalReturnUnlocked: boolean;
}

export function defaultModifiers(): Modifiers {
  return {
    clickPowerMult: 1,
    clickPowerAdd: 0,
    clickEmissionCount: 1,
    clickVfxScale: 1,
    autoRateMult: 1,
    autoRateAdd: 0,
    critChanceAdd: 0,
    critChanceCapAdd: 0,
    critMultMult: 1,
    comboTimeoutMs: 700,
    comboCapAdd: 0,
    timeMultMult: 1,
    echoClickChance: 0,
    pairProductionPeriod: 0,
    bigBangUnlocked: false,
    hawkingEcho: false,
    darkEnergyAuto: false,
    filamentExp: 0,
    eternalEngine: false,
    webOfAll: false,
    heisenberg: false,
    waveCollapse: false,
    manyWorldsCapMult: 1,
    encounterBonusMult: 1,
    apexMult: 1,
    inflatonEchoSec: 0,
    dilation: false,
    eternalReturnUnlocked: false,
  };
}

const CROSS_NODE_MULTS: Record<string, number> = {
  click_lv5: 1.4,
  click_lv10: 1.8,
  click_lv15: 2.4,
  click_lv20: 3.2,
  click_lv25: 4.4,
  click_lv30: 6,
  auto_lv5: 1.4,
  auto_lv10: 1.8,
  auto_lv15: 2.4,
  auto_lv20: 3.2,
  auto_lv25: 4.4,
  auto_lv30: 6,
  crit_lv5: 1.15,
  crit_lv10: 1.3,
  crit_lv15: 1.5,
  crit_lv20: 1.75,
  crit_lv25: 2.05,
  crit_lv30: 2.5,
  time_lv5: 1.25,
  time_lv10: 1.6,
  time_lv15: 2.1,
  time_lv20: 2.8,
  time_lv25: 3.6,
  time_lv30: 5,
};

const TOTAL_CROSS_NODE_COUNT = 24;

export function getActiveModifiers(
  skills: SkillState | undefined,
  ctx: ModifierContext,
): Modifiers {
  const mods = defaultModifiers();
  if (!skills) {
    return mods;
  }

  const clickLevel = skills.click.level;
  const autoLevel = skills.auto.level;

  mods.clickPowerMult = Math.pow(2, clickLevel);

  mods.autoRateAdd = autoLevel <= 0 ? 0 : Math.pow(2, autoLevel);

  for (const nodeId of skills.ownedCrossNodes) {
    const mult = CROSS_NODE_MULTS[nodeId];
    if (!mult) {
      continue;
    }
    if (nodeId.startsWith('click_')) {
      mods.clickPowerMult *= mult;
    } else if (nodeId.startsWith('auto_')) {
      mods.autoRateMult *= mult;
    } else if (nodeId.startsWith('crit_')) {
      mods.critMultMult *= mult;
    } else if (nodeId.startsWith('time_')) {
      mods.timeMultMult *= mult;
    }
  }

  if (mods.filamentExp > 0) {
    mods.autoRateMult *= Math.pow(1 + Math.max(0, ctx.stagesCleared ?? 0), mods.filamentExp);
  }
  if (mods.webOfAll) {
    const effectiveClickLevel = ctx.clickLevel ?? clickLevel;
    mods.autoRateMult *= Math.max(1, effectiveClickLevel * effectiveClickLevel);
  }
  if (mods.inflatonEchoSec > 0 && (ctx.secondsInStage ?? Number.POSITIVE_INFINITY) <= mods.inflatonEchoSec) {
    mods.timeMultMult *= 3;
  }
  if (mods.dilation && (ctx.progress01 ?? 0) >= 0.8) {
    mods.timeMultMult *= 0.5;
    mods.clickPowerMult *= 4;
    mods.autoRateMult *= 4;
  }
  if (skills.ownedCrossNodes.length >= TOTAL_CROSS_NODE_COUNT) {
    mods.clickPowerMult *= 2;
    mods.autoRateMult *= 2;
    mods.apexMult = 2;
    mods.bigBangUnlocked = true;
    mods.eternalReturnUnlocked = true;
  }

  return mods;
}
