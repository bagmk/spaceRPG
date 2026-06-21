import { describe, expect, it } from 'vitest';
import { createInitialGameState, gameReducer } from '../reducer';
import { isFavoriteEntity } from '../reducers/entities';
import { createSaveSnapshot, migrateToCurrent } from '../storage';

/**
 * Overhaul-4 P2 — ★ favorite (save v26). Favorited entity ids are protected from
 * Fuse-All (the drawAllTrios filter in EntityPanel skips them) and persist across
 * reload. Here we pin the reducer toggle + persistence (the fuse-all skip is a pure
 * `favoriteEntityIds.includes` filter in the component).
 */
describe('★ favorite (v26)', () => {
  it('TOGGLE_FAVORITE adds then removes an entity id', () => {
    const s0 = createInitialGameState(0);
    expect(s0.favoriteEntityIds).toEqual([]);
    const s1 = gameReducer(s0, { type: 'TOGGLE_FAVORITE', entityId: 'abc' });
    expect(s1.favoriteEntityIds).toEqual(['abc']);
    expect(isFavoriteEntity(s1, 'abc')).toBe(true);
    const s2 = gameReducer(s1, { type: 'TOGGLE_FAVORITE', entityId: 'abc' });
    expect(s2.favoriteEntityIds).toEqual([]);
    expect(isFavoriteEntity(s2, 'abc')).toBe(false);
  });

  it('favoriteEntityIds survive a save round-trip (v26 whitelist + snapshot)', () => {
    const state = { ...createInitialGameState(0), favoriteEntityIds: ['x', 'y'] };
    const snap = createSaveSnapshot(state);
    expect(snap.version).toBe(26);
    const restored = migrateToCurrent(JSON.parse(JSON.stringify(snap)));
    expect(restored).not.toBeNull();
    expect(restored!.favoriteEntityIds.sort()).toEqual(['x', 'y']);
  });

  it('a pre-v26 save (no favoriteEntityIds) loads with an empty favorites list', () => {
    const state = createInitialGameState(0);
    const snap = createSaveSnapshot(state) as unknown as Record<string, unknown>;
    delete snap.favoriteEntityIds; // simulate a v25 save
    snap.version = 25;
    const restored = migrateToCurrent(snap as never);
    expect(restored).not.toBeNull();
    expect(restored!.favoriteEntityIds).toEqual([]);
  });
});
