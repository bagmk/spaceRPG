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
    inflatonEchoSec: 0,
    dilation: false,
    eternalReturnUnlocked: false,
  };
}

function getTrackLevelAutoRate(level: number): number {
  if (level <= 0) {
    return 0;
  }
  let rate = Math.pow(1.6, level - 1);
  if (level >= 5) rate *= 1.3;
  if (level >= 10) rate *= 1.3;
  if (level >= 20) rate *= 1.5;
  if (level >= 30) rate *= 2;
  return rate;
}

function getTrackLevelTimeMultiplier(level: number): number {
  if (level <= 0) return 1;
  if (level >= 30) return 12;
  if (level >= 25) return 7;
  if (level >= 20) return 4;
  if (level >= 15) return 2.5;
  if (level >= 10) return 1.8;
  if (level >= 5) return 1.3;
  return 1.05;
}

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
  const critLevel = skills.crit.level;
  const timeLevel = skills.time.level;

  mods.clickPowerMult = Math.pow(1.6, clickLevel);
  if (clickLevel >= 10) mods.clickPowerMult *= 1.2;
  mods.clickEmissionCount =
    1 +
    (clickLevel >= 5 ? 1 : 0) +
    (clickLevel >= 10 ? 1 : 0) +
    (clickLevel >= 20 ? 1 : 0) +
    (clickLevel >= 25 ? 1 : 0) +
    (clickLevel >= 30 ? 1 : 0);
  if (clickLevel >= 15) {
    mods.comboTimeoutMs += 200;
  }
  if (clickLevel >= 25) {
    mods.pairProductionPeriod = 7;
  }
  if (clickLevel >= 30) {
    mods.clickVfxScale = 2;
  }

  mods.autoRateAdd = getTrackLevelAutoRate(autoLevel);
  mods.darkEnergyAuto = autoLevel >= 15;
  mods.eternalEngine = autoLevel >= 25;

  if (critLevel >= 1) {
    mods.critChanceAdd += 0.05;
    mods.critMultMult = 1;
  }
  mods.critChanceAdd += critLevel * 0.01;
  if (critLevel >= 5) mods.critChanceAdd += 0.05;
  if (critLevel >= 15) mods.critChanceAdd += 0.1;
  let critMultiplier = 3 + critLevel * 0.2;
  if (critLevel >= 20) critMultiplier = Math.max(critMultiplier, 5);
  if (critLevel >= 30) {
    critMultiplier = 8;
    mods.critChanceCapAdd = 0.3;
  }
  mods.critMultMult = critMultiplier / 3;
  mods.heisenberg = critLevel >= 10;
  mods.waveCollapse = critLevel >= 5;
  mods.manyWorldsCapMult = critLevel >= 25 ? 2 : 1;

  mods.timeMultMult = getTrackLevelTimeMultiplier(timeLevel);

  for (const nodeId of skills.ownedCrossNodes) {
    switch (nodeId) {
      case 'echoing_click':
        mods.echoClickChance = 0.18;
        break;
      case 'wave_capture':
        mods.waveCollapse = true;
        break;
      case 'inflaton_echo':
        mods.inflatonEchoSec = 5;
        break;
      case 'pair_production':
        mods.pairProductionPeriod = 7;
        break;
      case 'heisenberg':
        mods.heisenberg = true;
        break;
      case 'dilation':
        mods.dilation = true;
        break;
      case 'filament':
        mods.filamentExp = 1.2;
        break;
      case 'big_bang_click':
        mods.bigBangUnlocked = true;
        break;
      case 'web_of_all':
        mods.webOfAll = true;
        break;
      case 'eternal_return':
        mods.eternalReturnUnlocked = true;
        break;
      case 'cosmos_primal':
        mods.clickPowerMult *= 10;
        mods.autoRateAdd *= 10;
        mods.critMultMult *= 10;
        mods.timeMultMult *= 10;
        mods.clickVfxScale *= 2;
        break;
      default:
        break;
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

  return mods;
}
