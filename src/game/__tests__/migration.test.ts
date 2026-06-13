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
    // v17 compensation: 10 legacy skill levels (4+5+1) → +1 condensed mass.
    expect(migrated?.condensedMass).toBe(1);
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
          click: { level: 0 }, auto: { level: 0 }, crit: { level: 0 }, time: { level: 0 },
          unlockedTracks: ['click'],
          ownedCrossNodes: [],
        },
      }),
    );

    const migrated = loadGame();
    expect(migrated?.stageIdx).toBe(6);
    // v17: skills are stripped after migration (skill tree removed).
    expect((migrated as Record<string, unknown>).skills).toBeUndefined();
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

  it('v15 normalizes legacy name-derived entity ids to canonical position-only ids', () => {
    // @ts-expect-error test bootstrap
    global.window = {};
    // @ts-expect-error test bootstrap
    global.localStorage = localStorageMock;
    const base = createInitialGameState(100);
    localStorageMock.setItem(
      'cosmic_coalescence_save_v7',
      JSON.stringify({
        ...base,
        version: 14,
        inventory: [
          { entityId: 's13_07_pulsar', count: 3, level: 2 },
          { entityId: 's10_01_sun', count: 1, level: 1 },
        ],
        almanacCollected: { 13: ['s13_07_pulsar'], 10: ['s10_01_sun'] },
        equippedSlots: ['s10_01_sun'],
        riftSlots: ['s13_07_pulsar'],
      }),
    );

    const migrated = loadGame();
    // Name-derived ids (aliases) collapse to their canonical position-only id.
    expect(migrated?.inventory.find((e) => e.entityId === 's13_07')).toMatchObject({ count: 3, level: 2 });
    expect(migrated?.inventory.some((e) => e.entityId === 's13_07_pulsar')).toBe(false);
    expect(migrated?.almanacCollected[13]).toEqual(['s13_07']);
    expect(migrated?.almanacCollected[10]).toEqual(['s10_01']);
    expect(migrated?.equippedSlots).toContain('s10_01');
    expect(migrated?.riftSlots).toContain('s13_07');
  });

  it('v16 resets the offline window once and clamps corrupt inventory entries', () => {
    // @ts-expect-error test bootstrap
    global.window = {};
    // @ts-expect-error test bootstrap
    global.localStorage = localStorageMock;
    const base = createInitialGameState(100);
    const staleSaveAt = Date.now() - 86_400_000; // 1 day ago
    localStorageMock.setItem(
      'cosmic_coalescence_save_v7',
      JSON.stringify({
        ...base,
        version: 15,
        lastSaveAt: staleSaveAt,
        inventory: [
          { entityId: 's1_01', count: 1e9, level: 99 }, // runaway count, over-cap level
          { entityId: 's1_02', count: 3, level: 1 },
        ],
      }),
    );

    const migrated = loadGame();
    // Offline window reset: the gear power rebuff must not pay a retroactive windfall.
    expect(migrated!.lastSaveAt).toBeGreaterThan(staleSaveAt + 86_000_000);
    const corrupt = migrated!.inventory.find((e) => e.entityId === 's1_01')!;
    expect(corrupt.count).toBeLessThanOrEqual(20 * 1000); // maxCount × 1000 ceiling
    expect(corrupt.level).toBeLessThanOrEqual(25); // rarity level cap
    expect(migrated!.inventory.find((e) => e.entityId === 's1_02')?.count).toBe(3);
  });

  it('v17 derives the crit flag and pays compensation from legacy skills, then strips them', () => {
    // @ts-expect-error test bootstrap
    global.window = {};
    // @ts-expect-error test bootstrap
    global.localStorage = localStorageMock;
    const base = createInitialGameState(100);
    localStorageMock.setItem(
      'cosmic_coalescence_save_v7',
      JSON.stringify({
        ...base,
        version: 16,
        skillPoints: 3,
        skills: {
          click: { level: 20 }, auto: { level: 15 }, crit: { level: 5 }, time: { level: 0 },
          unlockedTracks: ['click', 'crit', 'auto', 'time'],
          ownedCrossNodes: ['click_lv5', 'crit_lv5'],
        },
      }),
    );

    const migrated = loadGame()!;
    // Crit upgrades existed → vacuum decay's flag must survive the strip.
    expect(migrated.endingProgressFlags.criticalUpgradedThisUniverse).toBe(true);
    // Compensation: (20+15+5+0 + 2×2) / 10 = 4.4 → +4 condensed mass.
    expect(migrated.condensedMass).toBe(4);
    expect((migrated as Record<string, unknown>).skills).toBeUndefined();
    expect((migrated as Record<string, unknown>).skillPoints).toBeUndefined();
  });

  it('v17 scales above-final-gate entropy surplus proportionally (no clamp)', () => {
    // @ts-expect-error test bootstrap
    global.window = {};
    // @ts-expect-error test bootstrap
    global.localStorage = localStorageMock;
    const base = createInitialGameState(100);
    const V16_FINAL = 1.005e35;
    localStorageMock.setItem(
      'cosmic_coalescence_save_v7',
      JSON.stringify({ ...base, version: 16, stageIdx: 15, entropy: V16_FINAL * 2 }),
    );
    const migrated = loadGame()!;
    // Surplus above the final gate scales by NEW_T[16]/V16_T[16] — banked
    // prestige entropy and big-rip grinding survive proportionally.
    expect(migrated.entropy).toBeCloseTo(STAGES[15].entropyThreshold * 2, 4);
  });

  it('v18 seeds codex/hint fields for existing saves (no NEW flood, no intro replay)', () => {
    // @ts-expect-error test bootstrap
    global.window = {};
    // @ts-expect-error test bootstrap
    global.localStorage = localStorageMock;
    const base = createInitialGameState(100);
    localStorageMock.setItem(
      'cosmic_coalescence_save_v7',
      JSON.stringify({
        ...base,
        version: 17,
        almanacCollected: { 1: ['s1_01', 's1_02'], 2: ['s2_01'] },
      }),
    );
    const migrated = loadGame()!;
    // Veteran: everything already collected is marked seen, intro hints skipped.
    expect([...migrated.codexSeenIds].sort()).toEqual(['s1_01', 's1_02', 's2_01']);
    expect([...migrated.seenPanelHints].sort()).toEqual(['codex', 'equip', 'fuse']);
  });

  it('v18 preserves explicit codex/hint fields (no re-seed on every load)', () => {
    // @ts-expect-error test bootstrap
    global.window = {};
    // @ts-expect-error test bootstrap
    global.localStorage = localStorageMock;
    const base = createInitialGameState(100);
    localStorageMock.setItem(
      'cosmic_coalescence_save_v7',
      JSON.stringify({
        ...base,
        version: 18,
        almanacCollected: { 1: ['s1_01', 's1_02'] },
        codexSeenIds: ['s1_01'],
        seenPanelHints: ['codex'],
      }),
    );
    const migrated = loadGame()!;
    // A genuine v18 save keeps its own progress (s1_02 stays NEW; equip/fuse
    // hints still pending) instead of being re-seeded as a veteran.
    expect(migrated.codexSeenIds).toEqual(['s1_01']);
    expect(migrated.seenPanelHints).toEqual(['codex']);
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
          click: { level: 0 }, auto: { level: 0 }, crit: { level: 0 }, time: { level: 0 },
          unlockedTracks: ['click'],
          ownedCrossNodes: ['echoing_click', 'inflaton_echo'],
        },
      }),
    );

    const migrated = loadGame();
    expect(migrated).not.toBeNull();
    // v17: skills are stripped after migration (cross nodes are gone with them).
    expect((migrated as Record<string, unknown>).skills).toBeUndefined();
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
      // v16-ladder value: exactly the v16 stage-1 gate (frozen at 1.995e3).
      entropy: 1.995e3,
      inventory: [{ entityId: entity.id, count: 2, level: 4 }],
      almanacCollected: { 1: [entity.id] },
      equippedSlots: [entity.id],
      unlockedSlotCount: 2,
    };
    localStorageMock.setItem('cosmic_coalescence_save_v7', JSON.stringify(save));

    const migrated = loadGame();
    expect(migrated?.inventory).toEqual([{ entityId: entity.id, count: 2, level: 4 }]);
    // v17 remap: the v16 stage-1 gate maps EXACTLY onto the new stage-1 gate
    // (piecewise remap preserves gate progress).
    expect(migrated?.entropy).toBeCloseTo(STAGES[0].entropyThreshold, 6);
    expect(migrated?.equippedSlots).toEqual([entity.id]);
    expect(migrated?.unlockedSlotCount).toBe(2);
    expect(migrated?.almanacCollected[1]).toContain(entity.id);
  });
});
