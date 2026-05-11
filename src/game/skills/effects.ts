import type { SkillState } from './types';
import type { PurchasedEntityEntry } from '../entities/types';
import { applyEntityModifiers } from '../entities/effects';
import {
  SKILL_CLICK_POWER_BASE,
  SKILL_AUTO_RATE_BASE,
  SKILL_CROSS_NODE_MULTS,
  SKILL_TOTAL_CROSS_NODE_COUNT,
} from '../balance';

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

export function getActiveModifiers(
  skills: SkillState | undefined,
  ctx: ModifierContext,
  purchasedEntities?: PurchasedEntityEntry[],
): Modifiers {
  const mods = defaultModifiers();

  const clickLevel = skills?.click.level ?? 0;
  const autoLevel = skills?.auto.level ?? 0;

  mods.clickPowerMult = Math.pow(SKILL_CLICK_POWER_BASE, clickLevel);

  mods.autoRateAdd = autoLevel <= 0 ? 0 : Math.pow(SKILL_AUTO_RATE_BASE, autoLevel);

  for (const nodeId of skills?.ownedCrossNodes ?? []) {
    const mult = SKILL_CROSS_NODE_MULTS[nodeId];
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
  if ((skills?.ownedCrossNodes.length ?? 0) >= SKILL_TOTAL_CROSS_NODE_COUNT) {
    mods.clickPowerMult *= 2;
    mods.autoRateMult *= 2;
    mods.apexMult = 2;
    mods.bigBangUnlocked = true;
    mods.eternalReturnUnlocked = true;
  }

  if (purchasedEntities && purchasedEntities.length > 0) {
    applyEntityModifiers(mods, purchasedEntities);
  }

  return mods;
}
