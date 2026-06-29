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

  it('P7 Resonance Core: off-gate only, geometric, focus-split preserves total power', () => {
    const reso = Math.pow(1.03, 10); // RESONANCE_CORE_RATE=0.03, Lv10
    const base = getActiveModifiers(CTX, [], createDefaultPrestigeUpgrades());

    // Balanced focus (50) → both wallet mults × reso^1; gate levers untouched.
    const bal = getActiveModifiers(CTX, [], { ...createDefaultPrestigeUpgrades(), resonance_core: 10, echoFocus: 50 });
    expect(bal.clickMatterMult).toBeCloseTo(base.clickMatterMult * reso, 6);
    expect(bal.autoMatterMult).toBeCloseTo(base.autoMatterMult * reso, 6);
    expect(bal.clickPowerMult).toBe(base.clickPowerMult);
    expect(bal.autoRateMult).toBe(base.autoRateMult);
    expect(bal.critMultMult).toBe(base.critMultMult);

    // All-click focus (100) → click × reso^2, auto × reso^0; all-auto (0) → mirror.
    const allClick = getActiveModifiers(CTX, [], { ...createDefaultPrestigeUpgrades(), resonance_core: 10, echoFocus: 100 });
    expect(allClick.clickMatterMult).toBeCloseTo(base.clickMatterMult * reso * reso, 6);
    expect(allClick.autoMatterMult).toBeCloseTo(base.autoMatterMult, 6);
    const allAuto = getActiveModifiers(CTX, [], { ...createDefaultPrestigeUpgrades(), resonance_core: 10, echoFocus: 0 });
    expect(allAuto.autoMatterMult).toBeCloseTo(base.autoMatterMult * reso * reso, 6);
    expect(allAuto.clickMatterMult).toBeCloseTo(base.clickMatterMult, 6);

    // GEOMETRIC-MEAN-PRESERVING: sqrt(click·auto) wallet power is identical at every focus.
    const gm = (m: { clickMatterMult: number; autoMatterMult: number }) => Math.sqrt(m.clickMatterMult * m.autoMatterMult);
    expect(gm(allClick)).toBeCloseTo(gm(bal), 6);
    expect(gm(allAuto)).toBeCloseTo(gm(bal), 6);
  });

  it('codex completion rewards still apply', () => {
    const stage1Ids = getEntitiesForStage(1).map((e) => e.id);
    const base = getActiveModifiers(CTX, [], undefined, {});
    const earned = getActiveModifiers(CTX, [], undefined, { 1: stage1Ids });
    expect(earned.dropChanceMult).toBeGreaterThan(base.dropChanceMult);
  });
});
