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

  it('a full same-rarity loadout grants the off-gate matter bonus (click + auto)', () => {
    expect(commons.length).toBeGreaterThanOrEqual(LANE_MATCH_MIN_SLOTS);
    const mods = defaultModifiers();
    applyLaneMatch(mods, commons.slice(0, LANE_MATCH_MIN_SLOTS).map((e) => makeInstance(e.id)));
    expect(mods.clickMatterMult).toBeGreaterThan(1);
    expect(mods.autoMatterMult).toBe(mods.clickMatterMult); // both lanes get the same themed bonus
  });

  it('a loadout smaller than the threshold grants nothing (no early freebie)', () => {
    const mods = defaultModifiers();
    applyLaneMatch(mods, commons.slice(0, LANE_MATCH_MIN_SLOTS - 1).map((e) => makeInstance(e.id)));
    expect(mods.clickMatterMult).toBe(1);
  });
});
