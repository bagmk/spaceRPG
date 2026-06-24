import { describe, expect, it } from 'vitest';
import { getActiveModifiers, defaultModifiers } from '../skills/effects';
import { getClickPower } from '../formulas';
import { CLICK_OUTPUT_MULTIPLIER } from '../balance';
import { getEntitiesForStage } from '../entities/stageItems';
import { createDefaultPrestigeUpgrades } from '../prestige';

const CTX = { stageId: 1, gateProgress01: 0 };

describe('gear-only modifiers (Phase 4-2 — no skill tree)', () => {
  it('bare context yields baseline modifiers (power comes from gear alone)', () => {
    const mods = getActiveModifiers(CTX);
    expect(mods.clickPowerMult).toBe(1);
    expect(mods.autoRateAdd).toBe(0);
    expect(mods.critMultMult).toBe(1);
  });

  it('click power is re-anchored by CLICK_OUTPUT_MULTIPLIER', () => {
    expect(getClickPower(defaultModifiers())).toBe(1 + (1 - 1) * CLICK_OUTPUT_MULTIPLIER);
    const boosted = { ...defaultModifiers(), clickPowerMult: 2 };
    expect(getClickPower(boosted)).toBe(1 + (2 - 1) * CLICK_OUTPUT_MULTIPLIER);
  });

  it('equipped gear raises click power through the modifiers', () => {
    const clickEntity = getEntitiesForStage(1).find((e) => e.effect.type === 'click')!;
    const mods = getActiveModifiers(CTX, [{ entityId: clickEntity.id, count: 1, level: 1 }]);
    expect(mods.clickPowerMult).toBeGreaterThan(1);
  });

  it('prestige multipliers still apply on top of gear', () => {
    const upgrades = { ...createDefaultPrestigeUpgrades(), matter_forge: 2 };
    const mods = getActiveModifiers(CTX, [], upgrades);
    expect(mods.clickPowerMult).toBeCloseTo(Math.pow(1.5, 2), 6);
  });

  it('Condensation Core boosts ONLY the off-gate wallet mults, never a gate lever', () => {
    const base = getActiveModifiers(CTX, [], createDefaultPrestigeUpgrades());
    const lv10 = getActiveModifiers(CTX, [], { ...createDefaultPrestigeUpgrades(), condensation_core: 10 });
    // +2%/level → Lv10 = ×1.20 on BOTH wallet income mults (off-gate).
    expect(lv10.clickMatterMult).toBeCloseTo(base.clickMatterMult * 1.2, 6);
    expect(lv10.autoMatterMult).toBeCloseTo(base.autoMatterMult * 1.2, 6);
    // GATE levers (clickPower/auto/crit/comboCap) MUST be untouched — these feed
    // the calibrated entropy gate. If any of these move, the boost leaked.
    expect(lv10.clickPowerMult).toBe(base.clickPowerMult);
    expect(lv10.autoRateMult).toBe(base.autoRateMult);
    expect(lv10.critMultMult).toBe(base.critMultMult);
    expect(lv10.comboCapAdd).toBe(base.comboCapAdd);
  });

  it('codex completion rewards still apply', () => {
    const stage1Ids = getEntitiesForStage(1).map((e) => e.id);
    const base = getActiveModifiers(CTX, [], undefined, {});
    const earned = getActiveModifiers(CTX, [], undefined, { 1: stage1Ids });
    expect(earned.dropChanceMult).toBeGreaterThan(base.dropChanceMult);
  });
});
