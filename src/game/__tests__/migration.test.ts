import { afterEach, describe, expect, it } from 'vitest';
import { loadGame } from '../storage';
import { validateV5 } from '../storage/migrate';
import { createInitialGameState } from '../reducer';
import { STAGES } from '../stages';
import { getEntitiesForStage } from '../entities/stageItems';
import { BIG_CRUNCH_ENTROPY_THRESHOLD_KB } from '../multiverse';
import type { SaveState } from '../types';

const storage = new Map<string, string>();

const localStorageMock = {
  getItem(key: string) {
    return storage.get(key) ?? null;
  },
  setItem(key: string, value: string) {
    storage.set(key, value);
  },
  removeItem(key: string) {
    storage.delete(key);
  },
};

describe('save migration', () => {
  afterEach(() => {
    storage.clear();
    // @ts-expect-error test cleanup
    delete global.window;
    // @ts-expect-error test cleanup
    delete global.localStorage;
  });

  it('migrates a v1 save into the v2 runtime schema', () => {
    // @ts-expect-error test bootstrap
    global.window = {};
    // @ts-expect-error test bootstrap
    global.localStorage = localStorageMock;
    localStorageMock.setItem(
      'cosmic_coalescence_save_v1',
      JSON.stringify({
        version: 1,
        stageIdx: 2,
        quanta: 123,
        clickLevel: 4,
        autoLevel: 5,
        critLevel: 1,
        entropy: 99,
        totalClicks: 7,
        collisions: 2,
        universeCount: 1,
        cumulativeBoost: 0,
        runStartTime: 10,
        totalTimePlayed: 20,
        pendingCondenseStageIdx: null,
        pendingCondenseEntropy: 0,
        completedRun: false,
      }),
    );

    const migrated = loadGame();
    expect(migrated?.stageIdx).toBe(2);
    expect(migrated?.condensedMass).toBe(0);
    expect(migrated?.echoes).toBe(0);
    expect(migrated?.endingsCompleted).toEqual([]);
    expect(migrated?.timeGauge).toBe(0);
    expect(migrated?.shopBoosts).toEqual([]);
    expect(migrated?.hasOfflineStorageUpgrade).toBe(false);
    expect(migrated?.hasSeenCashShopTutorial).toBe(false);
    expect(migrated?.totalShopSpentUSD).toBe(0);
  });

  it('migrates a v5 save into v7 with stage-gated tracks reconstructed', () => {
    // @ts-expect-error test bootstrap
    global.window = {};
    // @ts-expect-error test bootstrap
    global.localStorage = localStorageMock;
    localStorageMock.setItem(
      'cosmic_coalescence_save_v5',
      JSON.stringify({
        version: 5,
        ...createInitialGameState(100),
        stageIdx: 6,
        skills: {
          ...createInitialGameState(100).skills,
          unlockedTracks: ['click'],
        },
      }),
    );

    const migrated = loadGame();
    expect(migrated?.stageIdx).toBe(6);
    expect(migrated?.skills.unlockedTracks).toEqual(['click', 'crit', 'auto', 'time']);
  });

  it('resets purchasedEntities when migrating a v8 save to v9 (entity IDs changed)', () => {
    // @ts-expect-error test bootstrap
    global.window = {};
    // @ts-expect-error test bootstrap
    global.localStorage = localStorageMock;
    localStorageMock.setItem(
      'cosmic_coalescence_save_v7',
      JSON.stringify({
        version: 8,
        ...createInitialGameState(100),
        purchasedEntities: [
          { entityId: 's1_0_quantum_fluctuation', count: 5 },
          { entityId: 's1_1_false_vacuum_bubble', count: 3 },
        ],
      }),
    );

    const migrated = loadGame();
    expect(migrated?.inventory).toEqual([]);
  });

  it('discards legacy cross-node IDs when loading a v6 save', () => {
    // @ts-expect-error test bootstrap
    global.window = {};
    // @ts-expect-error test bootstrap
    global.localStorage = localStorageMock;
    localStorageMock.setItem(
      'cosmic_coalescence_save_v6',
      JSON.stringify({
        version: 6,
        ...createInitialGameState(100),
        skills: {
          ...createInitialGameState(100).skills,
          ownedCrossNodes: ['echoing_click', 'inflaton_echo'],
        },
      }),
    );

    const migrated = loadGame();
    expect(migrated?.skills.ownedCrossNodes).toEqual([]);
  });

  it('reconstructs legacy ending flags with the simplified ending rules', () => {
    // @ts-expect-error test bootstrap
    global.window = {};
    // @ts-expect-error test bootstrap
    global.localStorage = localStorageMock;
    localStorageMock.setItem(
      'cosmic_coalescence_save_v7',
      JSON.stringify({
        version: 10,
        ...createInitialGameState(100),
        stageIdx: 3,
        entropy: BIG_CRUNCH_ENTROPY_THRESHOLD_KB,
        endingProgressFlags: {
          ...createInitialGameState(100).endingProgressFlags,
          bigCrunchEligible: true,
        },
      }),
    );

    const migrated = loadGame();
    expect(migrated?.endingProgressFlags.bigCrunchEligible).toBe(false);
  });

  it('repairs saves with Infinity in quanta', () => {
    const corrupted = {
      ...createInitialGameState(100),
      quanta: Infinity,
      entropy: NaN,
    } as Partial<SaveState>;
    const repaired = validateV5(corrupted);
    expect(repaired?.quanta).toBe(0);
    expect(repaired?.entropy).toBe(0);
  });

  it('migrates a v13 save: purchasedEntities → inventory + almanac seed + entropy clamp', () => {
    // @ts-expect-error test bootstrap
    global.window = {};
    // @ts-expect-error test bootstrap
    global.localStorage = localStorageMock;
    const stageIdx = 5;
    const entity = getEntitiesForStage(1)[0];
    const base = { ...createInitialGameState(100) } as Record<string, unknown>;
    delete base.inventory;
    delete base.equippedSlots;
    delete base.unlockedSlotCount;
    delete base.almanacCollected;
    localStorageMock.setItem(
      'cosmic_coalescence_save_v7',
      JSON.stringify({
        ...base,
        version: 13,
        stageIdx,
        // Old flat-rate entropy — orders of magnitude above the new thresholds.
        entropy: 1e18,
        peakEntropy: 2e18,
        purchasedEntities: [{ entityId: entity.id, count: 3 }],
      }),
    );

    const migrated = loadGame();
    expect(migrated).not.toBeNull();
    // purchasedEntities → inventory with level 1
    expect(migrated?.inventory).toEqual([{ entityId: entity.id, count: 3, level: 1 }]);
    // almanac seeded from owned entities
    expect(migrated?.almanacCollected[entity.stageId]).toContain(entity.id);
    // new equip fields get defaults
    expect(migrated?.equippedSlots).toEqual([]);
    expect(migrated?.unlockedSlotCount).toBe(1);
    // entropy clamped into the stage's gate window — no instant stage skips
    const floor = STAGES[stageIdx - 1].entropyThreshold;
    const gate = STAGES[stageIdx].entropyThreshold;
    expect(migrated!.entropy).toBeGreaterThanOrEqual(floor);
    expect(migrated!.entropy).toBeLessThan(gate);
    // peakEntropy rebased to the new scale
    expect(migrated!.peakEntropy).toBe(migrated!.entropy);
  });

  it('raises pre-v14 entropy to the stage gate floor when below it', () => {
    // @ts-expect-error test bootstrap
    global.window = {};
    // @ts-expect-error test bootstrap
    global.localStorage = localStorageMock;
    const stageIdx = 3;
    const base = { ...createInitialGameState(100) } as Record<string, unknown>;
    delete base.inventory;
    delete base.equippedSlots;
    delete base.unlockedSlotCount;
    delete base.almanacCollected;
    localStorageMock.setItem(
      'cosmic_coalescence_save_v7',
      JSON.stringify({ ...base, version: 13, stageIdx, entropy: 0, purchasedEntities: [] }),
    );

    const migrated = loadGame();
    expect(migrated!.entropy).toBe(STAGES[stageIdx - 1].entropyThreshold);
  });

  it('passes a v14 save through without clamping entropy', () => {
    // @ts-expect-error test bootstrap
    global.window = {};
    // @ts-expect-error test bootstrap
    global.localStorage = localStorageMock;
    const entity = getEntitiesForStage(1)[0];
    const save = {
      ...createInitialGameState(100),
      version: 14,
      stageIdx: 0,
      entropy: STAGES[0].entropyThreshold * 2,
      inventory: [{ entityId: entity.id, count: 2, level: 4 }],
      almanacCollected: { 1: [entity.id] },
      equippedSlots: [entity.id],
      unlockedSlotCount: 2,
    };
    localStorageMock.setItem('cosmic_coalescence_save_v7', JSON.stringify(save));

    const migrated = loadGame();
    expect(migrated?.inventory).toEqual([{ entityId: entity.id, count: 2, level: 4 }]);
    expect(migrated?.entropy).toBe(STAGES[0].entropyThreshold * 2);
    expect(migrated?.equippedSlots).toEqual([entity.id]);
    expect(migrated?.unlockedSlotCount).toBe(2);
    expect(migrated?.almanacCollected[1]).toContain(entity.id);
  });
});
