import { describe, expect, it } from 'vitest';
import type { EndingId } from '../types';
import { STAGE_ENTITIES, getEntitiesForStage, getPurchasedEntityCount } from '../entities/stageItems';
import { applyEntityModifiers } from '../entities/effects';
import { defaultModifiers } from '../skills/effects';
import { ENTITY_BASE_COST_FACTOR, ENTITY_MAX_COUNT, ENTITY_TIME_MAX_COUNT, ENTITY_COST_ANCHORS, AUTO_STAGE_POWER_BASE } from '../balance';
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

  it('uses standard caps for Auto Power (former time-slot) entities', () => {
    const byRar = (rar: string) =>
      STAGE_ENTITIES.filter((entity) => entity.rarity === rar && entity.effect.type === 'auto_mult');
    expect(byRar('common').length).toBeGreaterThan(0);
    expect(byRar('rare').length).toBeGreaterThan(0);
    expect(byRar('epic').length).toBeGreaterThan(0);
    expect(byRar('common').every((entity) => entity.maxCount === 20)).toBe(true);
    expect(byRar('rare').every((entity) => entity.maxCount === 10)).toBe(true);
    expect(byRar('epic').every((entity) => entity.maxCount === 5)).toBe(true);
  });

  it('keeps non-time rare and epic entities at the standard caps', () => {
    const rareEntities = STAGE_ENTITIES.filter((entity) => entity.rarity === 'rare');
    const epicEntities = STAGE_ENTITIES.filter((entity) => entity.rarity === 'epic');

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

  it('rebalance-scales ALL stages uniformly (stage 1 included — Phase 4-1)', () => {
    // Under the player-stage gear power curve every same-rarity item shares
    // one global scalar, so per-copy spec values must be uniform: the old
    // stage-1 exemption would have made stage-1 gear permanently 4×/10×
    // stronger than everything else.
    const byTypeRarity = (stageId: number, type: string, rarity: string) =>
      getEntitiesForStage(stageId).find((e) => e.effect.type === type && e.rarity === rarity);

    expect(byTypeRarity(1, 'click', 'common')?.effect.value).toBeCloseTo(15 / 4);
    expect(byTypeRarity(2, 'click', 'common')?.effect.value).toBeCloseTo(15 / 4);
    expect(byTypeRarity(2, 'auto', 'common')?.effect.value).toBeCloseTo(0.8 / 10);
    expect(byTypeRarity(2, 'crit', 'common')?.effect.value).toBeCloseTo(0.3 / 4);
  });

  it('per-copy values stay in a tight band across all 16 stages (no stage dominates)', () => {
    // Invariant from the stage-independence design review: for each
    // (rarity × effect type), authored per-copy values must stay within a
    // small band across stages — otherwise one stage's drops strictly
    // dominate under the shared player-stage power curve.
    const bands = new Map<string, { min: number; max: number }>();
    for (const e of STAGE_ENTITIES) {
      if (e.effect.type === 'time' || e.effect.type === 'multiplier') continue;
      const key = `${e.rarity}:${e.effect.type}:${e.effect.isFlat ? 'flat' : 'pct'}`;
      const band = bands.get(key) ?? { min: Infinity, max: -Infinity };
      band.min = Math.min(band.min, e.effect.value);
      band.max = Math.max(band.max, e.effect.value);
      bands.set(key, band);
    }
    for (const [key, band] of bands) {
      // Worst current spread is common:auto at 3.75× (authored 0.8..3.0) —
      // well under one stage's power step (8×), so it can't invert rarity or
      // make one stage's drops dominate. The bound guards against runaways.
      expect(band.max / band.min, `${key} spread ${band.min}..${band.max}`).toBeLessThanOrEqual(4);
    }
  });

  it('uses one-tenth auto scaling from stage six onward', () => {
    const autoOf = (stageId: number, rarity: string) =>
      getEntitiesForStage(stageId).find((e) => e.effect.type === 'auto' && e.rarity === rarity);

    expect(autoOf(5, 'common')?.effect.value).toBeCloseTo(1.5 / 10);
    expect(autoOf(6, 'common')?.effect.value).toBeCloseTo(1.5 / 10);
    expect(autoOf(6, 'rare')?.effect.value).toBeCloseTo(5 / 10);
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

  it('uses Stage 16 rare and epic slots for Auto Power instead of crit', () => {
    const stage16 = getEntitiesForStage(16);
    const rareAndEpic = stage16.filter((entity) => entity.rarity === 'rare' || entity.rarity === 'epic');

    // Structural invariant: the endgame stage's rare/epic slots avoid crit
    // (a capped resource) and keep exactly 2 Auto Power (former time) slots.
    expect(rareAndEpic.some((entity) => entity.effect.type === 'crit')).toBe(false);
    expect(rareAndEpic.filter((entity) => entity.effect.type === 'auto_mult')).toHaveLength(2);
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
    const autoPowerEntity = STAGE_ENTITIES.find((entity) => entity.effect.type === 'auto_mult');

    expect(autoEntity).toBeDefined();
    expect(clickEntity).toBeDefined();
    expect(autoPowerEntity).toBeDefined();

    const mods = defaultModifiers();
    applyEntityModifiers(mods, [
      { entityId: autoEntity?.id ?? '', count: 1, level: 1 },
      { entityId: clickEntity?.id ?? '', count: 1, level: 1 },
      { entityId: autoPowerEntity?.id ?? '', count: 1, level: 1 },
    ], { stageId: 1, gateProgress01: 0 });

    expect(mods.autoRateFlatAdd).toBeGreaterThan(0);
    expect(mods.clickPowerMult).toBeGreaterThan(1);
    expect(mods.autoFlatMult).toBeGreaterThan(1);
  });

  it('keeps flat auto entity gains from being multiplied by existing auto multipliers', () => {
    const sun = getEntitiesForStage(10).find((entity) => entity.name === 'Sun');
    expect(sun).toBeDefined();
    if (!sun) return;

    const baseline = { ...defaultModifiers(), autoRateAdd: 1e9, autoRateMult: 48 };
    const withSun = { ...baseline };
    // Player on the Sun's own stage (10): E = max(9, 9) = 9 — origin parity.
    applyEntityModifiers(withSun, [{ entityId: sun.id, count: 1, level: 1 }], { stageId: 10, gateProgress01: 0 });

    // Auto output anchor: rarity weight within the origin stage times the
    // shared player-anchored growth curve — NOT multiplied by autoRateMult.
    const expectedFlat =
      (sun.baseCost / ENTITY_COST_ANCHORS[10]) *
      ENTITY_COST_ANCHORS[1] *
      Math.pow(AUTO_STAGE_POWER_BASE, 9) *
      (sun.effect.value / 100);
    expect(getAutoRate(withSun) - getAutoRate(baseline)).toBeCloseTo(expectedFlat, 0);
  });
});
