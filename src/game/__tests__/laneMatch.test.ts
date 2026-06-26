import { describe, expect, it } from 'vitest';
import { applyLaneMatch } from '../entities/effects';
import { defaultModifiers } from '../skills/effects';
import { makeInstance } from '../entities/instances';
import { getEntitiesForStage } from '../entities/stageItems';
import { LANE_MATCH_MIN_SLOTS } from '../balance';

// LANE / full-loadout match (user "전부 같은 등급 → ×100"): a big OFF-GATE matter multiplier when a
// substantial (≥ LANE_MATCH_MIN_SLOTS) equipped loadout is fully themed (same rarity / glyph).
describe('lane / full-loadout match bonus', () => {
  const commons = getEntitiesForStage(4).filter((e) => e.rarity === 'common');
  const rares = getEntitiesForStage(4).filter((e) => e.rarity === 'rare');

  it('a full same-rarity loadout grants the off-gate matter bonus', () => {
    expect(commons.length).toBeGreaterThanOrEqual(LANE_MATCH_MIN_SLOTS);
    const mods = defaultModifiers();
    applyLaneMatch(mods, commons.slice(0, LANE_MATCH_MIN_SLOTS).map((e) => makeInstance(e.id)));
    expect(mods.clickMatterMult).toBeGreaterThan(1);
    expect(mods.autoMatterMult).toBeGreaterThan(1);
  });

  it('a loadout smaller than the threshold grants nothing (no early freebie)', () => {
    const mods = defaultModifiers();
    applyLaneMatch(mods, commons.slice(0, 2).map((e) => makeInstance(e.id)));
    expect(mods.clickMatterMult).toBe(1);
  });

  it('a mixed-rarity loadout grants nothing (must be fully themed)', () => {
    const mixed = [...commons.slice(0, 3), ...rares.slice(0, 2)];
    expect(mixed.length).toBeGreaterThanOrEqual(LANE_MATCH_MIN_SLOTS);
    const mods = defaultModifiers();
    applyLaneMatch(mods, mixed.map((e) => makeInstance(e.id)));
    expect(mods.clickMatterMult).toBe(1);
  });
});
