import { describe, expect, it } from 'vitest';
import { STAGE_ENTITIES, getEntitiesForStage, findEntityById } from '../entities/stageItems';
import { getEquipCategory } from '../entities/types';
import { getFamily } from '../entities/families';
import { CODEX_SETS, getSubsetMembers, collectedIdSet, isSubsetComplete } from '../entities/codexSets';
import { getActiveModifiers } from '../skills/effects';
import type { EntityEffectType } from '../entities/types';

/**
 * Identity pass guard. The effect reassignment is a within-row permutation:
 * it preserves the entity set, IDs, and per-stage effect/category balance, and
 * only fixes name↔effect coherence. These tests lock that in.
 */
describe('identity pass: structure preserved', () => {
  it('keeps the full entity set (205) and stable IDs', () => {
    expect(STAGE_ENTITIES.length).toBe(205);
    // Legacy name-derived ids still resolve (kept as aliases after decoupling).
    expect(findEntityById('s13_07_pulsar')).toBeDefined();
    expect(findEntityById('s10_01_sun')).toBeDefined();
    expect(findEntityById('s11_01_earth_formation')).toBeDefined();
  });

  it('canonical ids are position-only (decoupled from name) so renames never change an id', () => {
    for (const e of STAGE_ENTITIES) {
      expect(e.id).toMatch(/^s\d+_\d+$/);
    }
    // The legacy name-derived id is preserved as an alias for save back-compat.
    const pulsar = findEntityById('s13_07_pulsar');
    expect(pulsar?.id).toBe('s13_07');
    expect(pulsar?.aliases).toContain('s13_07_pulsar');
  });

  it('preserves the per-stage category balance (rift vs click counts)', () => {
    // Snapshot captured before the identity pass — the permutation must not move it.
    const expected: Record<number, { click: number; rift: number }> = {
      1: { click: 2, rift: 1 }, 2: { click: 4, rift: 4 }, 3: { click: 6, rift: 6 },
      4: { click: 8, rift: 6 }, 5: { click: 8, rift: 6 }, 6: { click: 8, rift: 6 },
      7: { click: 8, rift: 6 }, 8: { click: 8, rift: 6 }, 9: { click: 8, rift: 6 },
      10: { click: 8, rift: 6 }, 11: { click: 8, rift: 6 }, 12: { click: 8, rift: 6 },
      13: { click: 8, rift: 6 }, 14: { click: 8, rift: 6 }, 15: { click: 8, rift: 6 },
      16: { click: 8, rift: 6 },
    };
    for (let s = 1; s <= 16; s++) {
      const pool = getEntitiesForStage(s);
      const click = pool.filter((e) => getEquipCategory(e) === 'click').length;
      const rift = pool.filter((e) => getEquipCategory(e) === 'rift').length;
      expect({ s, click, rift }).toEqual({ s, ...expected[s] });
    }
  });

  it('preserves the per-stage effect-type multiset (balance untouched)', () => {
    for (let s = 1; s <= 16; s++) {
      const pool = getEntitiesForStage(s);
      const counts: Record<string, number> = {};
      for (const e of pool) counts[e.effect.type] = (counts[e.effect.type] ?? 0) + 1;
      // Stages 4-15: 3 auto, 3 click, 3 crit, 3 auto_mult, 2 multiplier (time replaced by Auto Power).
      if (s >= 4 && s <= 15) {
        expect(counts).toEqual({ auto: 3, click: 3, crit: 3, auto_mult: 3, multiplier: 2 });
      }
    }
  });

  it('keeps every effect value positive after the permutation', () => {
    for (const e of STAGE_ENTITIES) expect(e.effect.value).toBeGreaterThan(0);
  });
});

describe('identity pass: name↔effect coherence', () => {
  // The family (glyph) defines the intended gameplay role. After the pass,
  // marquee families land on their identity effect.
  const effectOf = (id: string): EntityEffectType | undefined => findEntityById(id)?.effect.type;

  it('Pulsar drives Auto (rotating neutron star = auto burst)', () => {
    expect(getEquipCategory(findEntityById('s13_07_pulsar')!)).toBe('rift');
    expect(effectOf('s13_07_pulsar')).toBe('auto');
  });

  it('Supernova-family items are explosive crit, not steady auto', () => {
    const supernovae = STAGE_ENTITIES.filter(
      (e) => e.visual.glyph === 'supernova' && e.rarity !== 'legendary',
    );
    expect(supernovae.length).toBeGreaterThan(0);
    // Every non-legendary supernova item should be crit (explosive identity).
    for (const e of supernovae) expect(e.effect.type).toBe('crit');
  });

  it('Quark family leans to click — most items are rapid hits', () => {
    const quarks = STAGE_ENTITIES.filter((e) => e.visual.glyph === 'quark' && e.rarity !== 'legendary');
    expect(quarks.length).toBeGreaterThan(0);
    // Row structure forces a couple of off-theme exceptions; the majority lands
    // on click (the quark identity).
    const click = quarks.filter((e) => e.effect.type === 'click').length;
    expect(click / quarks.length).toBeGreaterThanOrEqual(0.6);
    expect(effectOf('s3_01_free_quark')).toBe('click');
  });

  it('Dark Matter (halo) family leans to auto/power — most items, never crit', () => {
    const halos = STAGE_ENTITIES.filter((e) => e.visual.glyph === 'halo' && e.rarity !== 'legendary');
    expect(halos.length).toBeGreaterThan(0);
    // No halo item is crit (a click-combat stat alien to dark matter).
    expect(halos.some((e) => e.effect.type === 'crit')).toBe(false);
    const slow = halos.filter((e) => e.effect.type === 'auto_mult' || e.effect.type === 'auto').length;
    expect(slow / halos.length).toBeGreaterThanOrEqual(0.7);
  });

  it('every glyph family resolves to a named identity', () => {
    const glyphs = new Set(STAGE_ENTITIES.map((e) => e.visual.glyph));
    for (const g of glyphs) {
      const fam = getFamily(g);
      expect(fam.label.en.length).toBeGreaterThan(0);
      expect(fam.label.ko.length).toBeGreaterThan(0);
      expect(fam.role.en.length).toBeGreaterThan(0);
    }
  });
});

describe('codex thematic sets', () => {
  it('every set has subsets and every subset has at least one member', () => {
    for (const set of CODEX_SETS) {
      expect(set.subsets.length).toBeGreaterThan(0);
      for (const sub of set.subsets) {
        const members = getSubsetMembers(sub, STAGE_ENTITIES);
        expect(members.length).toBeGreaterThan(0);
      }
    }
  });

  it('Genesis "first_light" subset is exactly the stage-1 entities', () => {
    const genesis = CODEX_SETS.find((s) => s.id === 'genesis')!;
    const firstLight = genesis.subsets.find((s) => s.id === 'first_light')!;
    const members = getSubsetMembers(firstLight, STAGE_ENTITIES);
    const stage1 = STAGE_ENTITIES.filter((e) => e.stageId === 1);
    expect(new Set(members.map((m) => m.id))).toEqual(new Set(stage1.map((e) => e.id)));
    expect(members.length).toBeGreaterThan(0);
  });

  it('subset completion is deterministic: collecting every member completes it', () => {
    const genesis = CODEX_SETS.find((s) => s.id === 'genesis')!;
    const firstLight = genesis.subsets.find((s) => s.id === 'first_light')!;
    const members = getSubsetMembers(firstLight, STAGE_ENTITIES);

    const partial = collectedIdSet({ 1: members.slice(0, -1).map((m) => m.id) });
    expect(isSubsetComplete(firstLight, partial, STAGE_ENTITIES)).toBe(false);

    const full = collectedIdSet({ 1: members.map((m) => m.id) });
    expect(isSubsetComplete(firstLight, full, STAGE_ENTITIES)).toBe(true);
  });

  it('Standard Model subsets are curated to a real roster (all ids resolve, fills renamed)', () => {
    const sm = CODEX_SETS.find((s) => s.id === 'standard_model')!;
    for (const sub of sm.subsets) {
      // Curated subsets are explicit-id rosters; every id must resolve.
      expect(sub.match.entityIds && sub.match.entityIds.length).toBeTruthy();
      for (const id of sub.match.entityIds!) expect(findEntityById(id)).toBeDefined();
    }
    const quarks = sm.subsets.find((s) => s.id === 'quarks')!;
    expect(getSubsetMembers(quarks, STAGE_ENTITIES).map((e) => e.name)).toEqual([
      'Up Quark', 'Down Quark', 'Strange Quark', 'Charm Quark', 'Bottom Quark', 'Top Quark',
    ]);
    // The four gap-fill renames landed and kept their old ids as aliases.
    expect(findEntityById('s3_10')?.name).toBe('Top Quark');
    expect(findEntityById('s3_10_top_quark_decay')?.id).toBe('s3_10');
    expect(findEntityById('s2_04')?.name).toBe('Electron Neutrino');
    expect(findEntityById('s4_04')?.name).toBe('Photon');
    expect(findEntityById('s4_11')?.name).toBe('Muon Neutrino');
  });

  it('completing the Genesis set applies its dropRate reward through getActiveModifiers', () => {
    const stage1Ids = STAGE_ENTITIES.filter((e) => e.stageId === 1).map((e) => e.id);
    const ctx = { stagesCleared: 0, currentQuanta: 0, secondsInStage: 0, stageId: 1, progress01: 0, clickLevel: 0 };

    const base = getActiveModifiers(undefined, ctx, [], undefined, {});
    const earned = getActiveModifiers(undefined, ctx, [], undefined, { 1: stage1Ids });

    // Genesis "first_light" subset (+6% drop) and the set reward (+8% drop) both fire.
    expect(earned.dropChanceMult).toBeGreaterThan(base.dropChanceMult);
    expect(earned.dropChanceMult).toBeCloseTo(base.dropChanceMult * 1.06 * 1.08, 6);
  });
});
