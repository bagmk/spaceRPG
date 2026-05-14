import { describe, expect, it } from 'vitest';
import type { EndingId } from '../types';
import { STAGE_ENTITIES, getEntitiesForStage } from '../entities/stageItems';
import { applyEntityModifiers } from '../entities/effects';
import { defaultModifiers } from '../skills/effects';
import { ENTITY_BASE_COST_FACTOR, ENTITY_MAX_COUNT } from '../balance';

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
    expect(ENTITY_BASE_COST_FACTOR.rare).toBeCloseTo(0.32);
    expect(ENTITY_BASE_COST_FACTOR.epic).toBeCloseTo(0.5);
    expect(ENTITY_BASE_COST_FACTOR.legendary).toBeCloseTo(3.6);
  });

  it('caps all rare entities at ten and all epic entities at five', () => {
    const rareEntities = STAGE_ENTITIES.filter((entity) => entity.rarity === 'rare');
    const epicEntities = STAGE_ENTITIES.filter((entity) => entity.rarity === 'epic');

    expect(rareEntities.length).toBeGreaterThan(0);
    expect(epicEntities.length).toBeGreaterThan(0);
    expect(rareEntities.every((entity) => entity.maxCount === 10)).toBe(true);
    expect(epicEntities.every((entity) => entity.maxCount === 5)).toBe(true);
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

    expect(mods.autoRateAdd).toBeGreaterThan(0);
    expect(mods.clickPowerMult).toBeGreaterThan(1);
    expect(mods.timeMultMult).toBeGreaterThan(1);
  });
});
