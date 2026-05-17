import { afterEach, describe, expect, it } from 'vitest';
import { loadGame } from '../storage';
import { createInitialGameState } from '../reducer';
import { BIG_CRUNCH_ENTROPY_THRESHOLD_KB } from '../multiverse';

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
    expect(migrated?.purchasedEntities).toEqual([]);
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
});
