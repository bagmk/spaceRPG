import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../reducer';
import { createSaveSnapshot, migrateToCurrent } from '../storage';
import { STAGE_ENTITIES } from '../entities/stageItems';
import type { EntityInstance } from '../entities/types';
import type { GameState } from '../types';

/**
 * Save round-trip safety (Overhaul-4 prerequisite). Two failure modes the design
 * workflow proved are silently fatal:
 *  1. version-not-in-branch → migrateToCurrent returns null (load failure).
 *  2. inventory wipe — convertEntityModelV14 used `.every(isEntityInstance)`, so ONE
 *     malformed copy discarded the WHOLE inventory. Now it `.filter()`s the bad entry.
 * These tests pin both so future per-copy fields (lock, etc.) can't regress them.
 */
const ids = STAGE_ENTITIES.slice(0, 3).map((e) => e.id);

function stateWith(inv: EntityInstance[]): GameState {
  return { ...createInitialGameState(0), inventory: inv };
}

function diskRoundTrip(state: GameState): ReturnType<typeof migrateToCurrent> {
  const snap = createSaveSnapshot(state);
  const onDisk = JSON.parse(JSON.stringify(snap)); // simulate localStorage write+read
  return migrateToCurrent(onDisk);
}

describe('save round-trip — snapshot → migrateToCurrent', () => {
  const inv: EntityInstance[] = [
    { entityId: ids[0], instanceId: 'i1', count: 1, level: 5 },
    { entityId: ids[1], instanceId: 'i2', count: 1, level: 3, quality: 0.9 },
    { entityId: ids[2], instanceId: 'i3', count: 1, level: 1 },
  ];

  it('preserves inventory length + per-copy levels + quality (current version is in-branch)', () => {
    const restored = diskRoundTrip(stateWith(inv));
    expect(restored, 'current-version save must migrate, not return null').not.toBeNull();
    expect(restored!.inventory.length).toBe(3);
    const byId = new Map(restored!.inventory.map((e) => [e.instanceId, e]));
    expect(byId.get('i1')?.level).toBe(5);
    expect(byId.get('i2')?.level).toBe(3);
    expect(byId.get('i2')?.quality).toBeCloseTo(0.9);
  });

  it('is idempotent — migrating an already-current save twice is stable', () => {
    const once = diskRoundTrip(stateWith(inv));
    const twice = diskRoundTrip({ ...stateWith(inv), inventory: once!.inventory });
    expect(twice!.inventory.length).toBe(once!.inventory.length);
    const a = once!.inventory.map((e) => `${e.entityId}:${e.level}`).sort();
    const b = twice!.inventory.map((e) => `${e.entityId}:${e.level}`).sort();
    expect(b).toEqual(a);
  });

  it('drops a single corrupt copy instead of wiping the whole inventory (wipe guard)', () => {
    const snap = createSaveSnapshot(stateWith(inv));
    const onDisk = JSON.parse(JSON.stringify(snap)) as { inventory: unknown[] };
    // Inject a malformed copy (entityId not a string) — the kind a future unknown
    // per-copy field could produce against a stale isEntityInstance guard.
    onDisk.inventory.push({ entityId: 123, count: 1, level: 2 });
    const restored = migrateToCurrent(onDisk as never);
    expect(restored).not.toBeNull();
    // The 3 valid copies survive; only the corrupt one is dropped (not all 3 wiped).
    expect(restored!.inventory.length).toBe(3);
  });

  it('an empty inventory round-trips as empty (not rebuilt from legacy)', () => {
    const restored = diskRoundTrip(stateWith([]));
    expect(restored).not.toBeNull();
    expect(restored!.inventory.length).toBe(0);
  });
});
