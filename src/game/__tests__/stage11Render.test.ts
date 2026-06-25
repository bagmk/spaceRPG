import { describe, it, expect } from 'vitest';
import { S11 } from '../../canvas/drawEntities';
import { findEntityById, getEntitiesForStage } from '../entities/stageItems';

// Chronic-bug guard: the Stage-11 (Life on Earth) center body is drawn by keying a
// hardcoded id map (S11) against owned entities. It silently rendered NOTHING for
// months because the map held name-slug ids (s11_01_earth_formation) while the
// canonical ids became position-only (s11_01) at the v15 id-decoupling, and no test
// asserted the map stayed valid. These tests fail the moment the map drifts again.
describe('Stage 11 render-id map (chronic-bug guard)', () => {
  it('every S11.* id resolves to a real stage-11 entity', () => {
    const stage11Ids = new Set(getEntitiesForStage(11).map((e) => e.id));
    for (const [key, id] of Object.entries(S11)) {
      expect(findEntityById(id, 11), `S11.${key} = '${id}' must resolve to a stage-11 entity`).toBeTruthy();
      expect(stage11Ids.has(id)).toBe(true);
    }
  });

  it('S11 ids are canonical position-only form (s11_NN), never name-slugs', () => {
    for (const [key, id] of Object.entries(S11)) {
      expect(id, `S11.${key}`).toMatch(/^s11_\d{2}$/);
    }
  });
});
