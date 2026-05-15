import { describe, expect, it } from 'vitest';
import type { EndingId } from '../types';
import { STAGE_ENTITIES, getEntitiesForStage, getPurchasedEntityCount } from '../entities/stageItems';
import { applyEntityModifiers } from '../entities/effects';
import { defaultModifiers } from '../skills/effects';
import { ENTITY_BASE_COST_FACTOR, ENTITY_MAX_COUNT, ENTITY_TIME_MAX_COUNT, LEGACY_TIME_ENTITY_EFFECT_FACTOR } from '../balance';
import { getAutoRate } from '../formulas';

const STAGE_IDS = Array.from({ length: 16 }, (_, index) => index + 1);
const ENDING_IDS: EndingId[] = ['heat_death', 'big_rip', 'big_crunch', 'vacuum_decay', 'bounce'];

describe('stage entity definitions', () => {
  it('defines the correct entity count per stage', () => {
    // S1=3, S2=8, S3=12, S4-16=14
    expect(getEntitiesForStage(1).length).toBe(3);
    expect(getEntitiesForStage(2).length).toBe(8);
    expect(getEntitiesForStage(3).length).toBe(12);
    for (const stageId of STAGE_IDS.filter((id) => id >= 4)) {
      expect(getEntitiesForStage(stageId).length).toBe(14);
    }
  });

  it('uses unique ids across all entities', () => {
    const ids = STAGE_ENTITIES.map((entity) => entity.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps every base cost positive', () => {
    for (const entity of STAGE_ENTITIES) {
      expect(entity.baseCost).toBeGreaterThan(0);
    }
  });

  it('keeps every cost scaling at or above one', () => {
    for (const entity of STAGE_ENTITIES) {
      expect(entity.costScaling).toBeGreaterThanOrEqual(1);
    }
  });

  it('keeps every max count positive', () => {
    for (const entity of STAGE_ENTITIES) {
      expect(entity.maxCount).toBeGreaterThan(0);
    }
  });

  it('uses the tuned rarity caps and starting prices', () => {
    expect(ENTITY_MAX_COUNT.rare).toBe(10);
    expect(ENTITY_MAX_COUNT.epic).toBe(5);
    expect(ENTITY_MAX_COUNT.legendary).toBe(1);
    expect(ENTITY_TIME_MAX_COUNT.common).toBe(20);
    expect(ENTITY_TIME_MAX_COUNT.rare).toBe(10);
    expect(ENTITY_TIME_MAX_COUNT.epic).toBe(5);
    expect(ENTITY_BASE_COST_FACTOR.rare).toBeCloseTo(0.32);
    expect(ENTITY_BASE_COST_FACTOR.epic).toBeCloseTo(1.5);
    expect(ENTITY_BASE_COST_FACTOR.legendary).toBeCloseTo(3.6);
  });

  it('uses the requested caps for time-speed entities', () => {
    const commonTimeEntities = STAGE_ENTITIES.filter((entity) => entity.rarity === 'common' && entity.effect.type === 'time');
    const rareTimeEntities = STAGE_ENTITIES.filter((entity) => entity.rarity === 'rare' && entity.effect.type === 'time');
    const epicTimeEntities = STAGE_ENTITIES.filter((entity) => entity.rarity === 'epic' && entity.effect.type === 'time');

    expect(commonTimeEntities.length).toBeGreaterThan(0);
    expect(rareTimeEntities.length).toBeGreaterThan(0);
    expect(epicTimeEntities.length).toBeGreaterThan(0);
    expect(commonTimeEntities.every((entity) => entity.maxCount === 20)).toBe(true);
    expect(rareTimeEntities.every((entity) => entity.maxCount === 10)).toBe(true);
    expect(epicTimeEntities.every((entity) => entity.maxCount === 5)).toBe(true);
  });

  it('keeps non-time rare and epic entities at the standard caps', () => {
    const rareEntities = STAGE_ENTITIES.filter((entity) => entity.rarity === 'rare' && entity.effect.type !== 'time');
    const epicEntities = STAGE_ENTITIES.filter((entity) => entity.rarity === 'epic' && entity.effect.type !== 'time');

    expect(rareEntities.length).toBeGreaterThan(0);
    expect(epicEntities.length).toBeGreaterThan(0);
    expect(rareEntities.every((entity) => entity.maxCount === 10)).toBe(true);
    expect(epicEntities.every((entity) => entity.maxCount === 5)).toBe(true);
  });

  it('keeps every legendary entity at one purchase max', () => {
    const legendaryEntities = STAGE_ENTITIES.filter((entity) => entity.rarity === 'legendary');

    expect(legendaryEntities.length).toBeGreaterThan(0);
    expect(legendaryEntities.every((entity) => entity.maxCount === 1)).toBe(true);
    expect(getPurchasedEntityCount([{ entityId: legendaryEntities[0].id, count: 2 }], legendaryEntities[0])).toBe(1);
  });

  it('rebalance-scales stage two and later entity effects', () => {
    const stage1Click = getEntitiesForStage(1).find((entity) => entity.name === 'False Vacuum Bubble');
    const stage2Click = getEntitiesForStage(2).find((entity) => entity.name === 'Down Quark');
    const stage2Auto = getEntitiesForStage(2).find((entity) => entity.name === 'Up Quark');
    const stage2Crit = getEntitiesForStage(2).find((entity) => entity.name === 'Electron');

    expect(stage1Click?.effect.value).toBeCloseTo(15);
    expect(stage2Click?.effect.value).toBeCloseTo(15 / 4);
    expect(stage2Auto?.effect.value).toBeCloseTo(0.8 / 10);
    expect(stage2Crit?.effect.value).toBeCloseTo(0.3 / 4);
  });

  it('uses one-tenth auto scaling from stage six onward', () => {
    const stage5Auto = getEntitiesForStage(5).find((entity) => entity.name === 'Hydrogen Atom');
    const stage6CommonAuto = getEntitiesForStage(6).find((entity) => entity.name === 'Cold Hydrogen');
    const stage6RareAuto = getEntitiesForStage(6).find((entity) => entity.name === 'Molecular Hydrogen');

    expect(stage5Auto?.effect.value).toBeCloseTo(1.5 / 10);
    expect(stage6CommonAuto?.effect.value).toBeCloseTo(1.5 / 10);
    expect(stage6RareAuto?.effect.value).toBeCloseTo(5 / 10);
  });

  it('gives stages 4-16 at least two legendary entities', () => {
    for (const stageId of STAGE_IDS.filter((id) => id >= 4)) {
      const legendaries = getEntitiesForStage(stageId).filter((e) => e.rarity === 'legendary');
      expect(legendaries.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('defines exactly one ending-specific Stage 16 entity per ending', () => {
    const stage16EndingEntities = getEntitiesForStage(16).filter((entity) => entity.endingId);

    expect(stage16EndingEntities).toHaveLength(ENDING_IDS.length);
    for (const endingId of ENDING_IDS) {
      expect(stage16EndingEntities.filter((entity) => entity.endingId === endingId)).toHaveLength(1);
    }
  });

  it('uses Stage 16 rare and epic slots for time speed instead of crit', () => {
    const stage16 = getEntitiesForStage(16);
    const rareAndEpic = stage16.filter((entity) => entity.rarity === 'rare' || entity.rarity === 'epic');

    expect(stage16.find((entity) => entity.name === 'Max Entropy')?.effect.type).toBe('time');
    expect(stage16.find((entity) => entity.name === 'Quantum Fluctuation Final')?.effect.type).toBe('time');
    expect(rareAndEpic.some((entity) => entity.effect.type === 'crit')).toBe(false);
    expect(rareAndEpic.filter((entity) => entity.effect.type === 'time')).toHaveLength(2);
  });

  it('keeps every effect value positive', () => {
    for (const entity of STAGE_ENTITIES) {
      expect(entity.effect.value).toBeGreaterThan(0);
    }
  });

  it('uses the replacement economy axes instead of direct entropy upgrades', () => {
    for (const entity of STAGE_ENTITIES) {
      expect(entity.effect.type).not.toBe('entropy');
    }
  });

  it('keeps every formula non-empty', () => {
    for (const entity of STAGE_ENTITIES) {
      expect(entity.formula.trim().length).toBeGreaterThan(0);
    }
  });

  it('uses hex-like visual colors for every entity', () => {
    for (const entity of STAGE_ENTITIES) {
      expect(entity.visual.color.startsWith('#')).toBe(true);
    }
  });

  it('assigns an animated glyph family to every entity', () => {
    for (const entity of STAGE_ENTITIES) {
      expect(entity.visual.glyph.length).toBeGreaterThan(0);
    }
  });

  it('turns entity purchases into active gameplay modifiers', () => {
    const autoEntity = STAGE_ENTITIES.find((entity) => entity.effect.type === 'auto');
    const clickEntity = STAGE_ENTITIES.find((entity) => entity.effect.type === 'click');
    const timeEntity = STAGE_ENTITIES.find((entity) => entity.effect.type === 'time');

    expect(autoEntity).toBeDefined();
    expect(clickEntity).toBeDefined();
    expect(timeEntity).toBeDefined();

    const mods = defaultModifiers();
    applyEntityModifiers(mods, [
      { entityId: autoEntity?.id ?? '', count: 1 },
      { entityId: clickEntity?.id ?? '', count: 1 },
      { entityId: timeEntity?.id ?? '', count: 1 },
    ]);

    expect(mods.autoRateFlatAdd).toBeGreaterThan(0);
    expect(mods.clickPowerMult).toBeGreaterThan(1);
    expect(mods.timeMultMult).toBeGreaterThan(1);
  });

  it('applies previous-stage time entities as weaker legacy bonuses', () => {
    const timeEntity = getEntitiesForStage(5).find((entity) => entity.effect.type === 'time');
    expect(timeEntity).toBeDefined();
    if (!timeEntity) return;

    const currentStageMods = defaultModifiers();
    applyEntityModifiers(currentStageMods, [{ entityId: timeEntity.id, count: 1 }], timeEntity.stageId);

    const laterStageMods = defaultModifiers();
    applyEntityModifiers(laterStageMods, [{ entityId: timeEntity.id, count: 1 }], timeEntity.stageId + 1);

    expect(currentStageMods.timeMultMult).toBeCloseTo(1 + timeEntity.effect.value / 100);
    expect(laterStageMods.timeMultMult).toBeCloseTo(
      1 + (timeEntity.effect.value * LEGACY_TIME_ENTITY_EFFECT_FACTOR) / 100,
    );
    expect(laterStageMods.timeMultMult).toBeLessThan(currentStageMods.timeMultMult);
  });

  it('keeps flat auto entity gains from being multiplied by existing auto multipliers', () => {
    const sun = getEntitiesForStage(10).find((entity) => entity.name === 'Sun');
    expect(sun).toBeDefined();
    if (!sun) return;

    const baseline = { ...defaultModifiers(), autoRateAdd: 1e9, autoRateMult: 48 };
    const withSun = { ...baseline };
    applyEntityModifiers(withSun, [{ entityId: sun.id, count: 1 }]);

    expect(getAutoRate(withSun) - getAutoRate(baseline)).toBeCloseTo(525e6, 0);
  });
});
