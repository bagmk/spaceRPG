import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  serializeSave,
  deserializeSave,
  pushBackupRing,
  listBackupRing,
  restoreBackupRing,
  createSaveSnapshot,
  SAVE_SCHEMA_VERSION,
  SAVE_BACKUP_RING_KEY,
  SAVE_BACKUP_RING_SIZE,
} from '../storage';
import { createInitialGameState } from '../reducer';

const storage = new Map<string, string>();
const localStorageMock = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => { storage.set(k, v); },
  removeItem: (k: string) => { storage.delete(k); },
};

describe('C-P2 save export / import + backup ring', () => {
  beforeEach(() => {
    // @ts-expect-error test bootstrap
    global.window = {};
    // @ts-expect-error test bootstrap
    global.localStorage = localStorageMock;
  });
  afterEach(() => {
    storage.clear();
    // @ts-expect-error cleanup
    delete global.window;
    // @ts-expect-error cleanup
    delete global.localStorage;
  });

  it('round-trips export → import, preserving key fields at the current schema', () => {
    const state = createInitialGameState(1000);
    state.quanta = 4242;
    state.stageIdx = 3;
    state.entropy = 1.23e6;
    const code = serializeSave(state);
    expect(code.startsWith('CCSAVE1.')).toBe(true);
    const restored = deserializeSave(code);
    expect(restored).not.toBeNull();
    expect(restored!.quanta).toBe(4242);
    expect(restored!.stageIdx).toBe(3);
    // migrateToCurrent always lands at the v25 flat-instance shape.
    expect(restored!.inventory.every((e) => e.count === 1 && !!e.instanceId)).toBe(true);
  });

  it('imports a v24 count-stack save and explodes it to flat v25 copies', () => {
    const base = createInitialGameState(100);
    const v24 = {
      ...createSaveSnapshot(base),
      version: 24,
      inventory: [{ entityId: 's13_07', count: 3, level: 2 }],
      equippedSlots: ['s13_07'],
      wildSlot: '',
      riftSlots: [],
    };
    // v24 save is ASCII-only, so base64 of the UTF-8 bytes == Buffer base64.
    const code = `CCSAVE1.${Buffer.from(JSON.stringify(v24), 'utf-8').toString('base64')}`;
    const restored = deserializeSave(code);
    expect(restored).not.toBeNull();
    const copies = restored!.inventory.filter((e) => e.entityId === 's13_07');
    expect(copies).toHaveLength(3);
    expect(copies.every((e) => e.count === 1 && !!e.instanceId)).toBe(true);
    expect(Math.max(...copies.map((e) => e.level))).toBe(2); // one copy keeps the stack level
    // the equip slot is remapped from an entityId → a real instanceId
    expect(restored!.inventory.some((e) => e.instanceId === restored!.equippedSlots[0])).toBe(true);
  });

  it('handles non-ASCII (Korean) payloads through the UTF-8 codec', () => {
    const state = createInitialGameState(1);
    // stash a unicode marker somewhere round-tripped verbatim
    state.completedQuestIds = ['시대-기록-✦'];
    const restored = deserializeSave(serializeSave(state));
    expect(restored).not.toBeNull();
    expect(restored!.completedQuestIds).toContain('시대-기록-✦');
  });

  it('also accepts a raw JSON paste (no envelope)', () => {
    const snap = createSaveSnapshot(createInitialGameState(7));
    const restored = deserializeSave(JSON.stringify(snap));
    expect(restored).not.toBeNull();
    expect(restored!.quanta).toBe(snap.quanta);
  });

  it('fails soft on garbage / empty / non-save input', () => {
    expect(deserializeSave('')).toBeNull();
    expect(deserializeSave('not a save')).toBeNull();
    expect(deserializeSave('CCSAVE1.@@@notbase64@@@')).toBeNull();
    expect(deserializeSave('{"foo":1}')).toBeNull(); // valid JSON, no numeric version
    expect(deserializeSave('{ broken json')).toBeNull();
  });

  it('keeps at most N newest ring entries, newest last, and migrates a restore', () => {
    const snap = createSaveSnapshot(createInitialGameState(1));
    for (let i = 0; i < SAVE_BACKUP_RING_SIZE + 3; i++) {
      pushBackupRing({ ...snap, quanta: i }); // vary so entries aren't deduped
    }
    const ring = listBackupRing();
    expect(ring.length).toBe(SAVE_BACKUP_RING_SIZE);
    expect(ring[ring.length - 1].v).toBe(SAVE_SCHEMA_VERSION);
    expect(JSON.parse(ring[ring.length - 1].data).quanta).toBe(SAVE_BACKUP_RING_SIZE + 2); // newest kept
    expect(JSON.parse(ring[0].data).quanta).toBe(3); // oldest survivors after eviction
    expect(restoreBackupRing(ring[ring.length - 1])).not.toBeNull();
  });

  it('dedupes an identical consecutive ring push', () => {
    const snap = createSaveSnapshot(createInitialGameState(1));
    pushBackupRing(snap);
    pushBackupRing(snap);
    expect(listBackupRing().length).toBe(1);
    expect(storage.has(SAVE_BACKUP_RING_KEY)).toBe(true);
  });
});
