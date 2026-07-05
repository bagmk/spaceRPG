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
    // v33 (OVERHAUL5): the legacy inventory then converts to CARDS (neither id is
    // crew) under the CANONICAL id — normalization survives the conversion.
    expect(migrated?.inventory).toEqual([]);
    expect(migrated?.cardInventory['s13_07']).toBe(3); // count-3 stack → 3 cards
    expect(migrated?.cardInventory['s13_07_pulsar']).toBeUndefined();
    expect(migrated?.cardInventory['s10_01']).toBe(1);
    expect(migrated?.almanacCollected[13]).toEqual(['s13_07']);
    expect(migrated?.almanacCollected[10]).toEqual(['s10_01']);
    // Non-crew slot ids clear (cards can't be equipped — only crew can).
    expect(migrated?.equippedSlots[0]).toBe('');
    expect(migrated?.riftSlots[0]).toBe('');
  });

  it('v33 converts legacy inventory to CREW (tier = static rarity, max level kept) + cards + stone refund', () => {
    // @ts-expect-error test bootstrap
    global.window = {};
    // @ts-expect-error test bootstrap
    global.localStorage = localStorageMock;
    const base = createInitialGameState(100);
    localStorageMock.setItem(
      'cosmic_coalescence_save_v7',
      JSON.stringify({
        ...base,
        version: 32,
        stageIdx: 1, // stage 2 → stage-1/2 crew auto-join silently
        enhanceStones: 5,
        inventory: [
          { instanceId: 'i1', entityId: 's1_02', count: 1, level: 4 }, // crew (False Vacuum Bubble), best copy
          { instanceId: 'i2', entityId: 's1_02', count: 1, level: 3 }, // spare → 1 card + 2 stones
          { instanceId: 'i3', entityId: 's1_00', count: 1, level: 1 }, // not crew → card
        ],
        equippedSlots: ['i1'],
        riftSlots: ['i3'],
        wildSlot: '',
      }),
    );

    const migrated = loadGame();
    // Owned crew copy: joined at its STATIC rarity with the best copy's level.
    expect(migrated?.crew['s1_02']?.level).toBe(4);
    expect(migrated?.crew['s1_02']?.tier).toBe('common');
    // Spare crew copy → 1 card of the crew id + (level−1) stone refund.
    expect(migrated?.cardInventory['s1_02']).toBe(1);
    expect(migrated?.enhanceStones).toBe(5 + 2);
    // Non-crew copy → card; inventory empties.
    expect(migrated?.cardInventory['s1_00']).toBe(1);
    expect(migrated?.inventory).toEqual([]);
    // Slots: instanceId of a joined crew remaps to the crew id; card slots clear.
    expect(migrated?.equippedSlots[0]).toBe('s1_02');
    expect(migrated?.riftSlots[0]).toBe('');
    // Stage-1 crew whose join beat already passed auto-join silently at common.
    expect(migrated?.crew['s1_01']).toEqual({ tier: 'common', level: 1 });
    expect(migrated?.pendingCrewJoinIds).toEqual([]);
  });

  it('#50 v23 per-item quality round-trips; pre-v23 entries stay neutral (undefined)', () => {
    // @ts-expect-error test bootstrap
    global.window = {};
    // @ts-expect-error test bootstrap
    global.localStorage = localStorageMock;
    const base = createInitialGameState(100);
    localStorageMock.setItem(
      'cosmic_coalescence_save_v7',
      JSON.stringify({
        ...base,
        version: 23,
        inventory: [
          { entityId: 's13_07', count: 2, level: 3, quality: 0.91 }, // a gold-tail specimen
          { entityId: 's10_01', count: 1, level: 1 },                 // pre-quality / legacy entry
        ],
        almanacCollected: { 13: ['s13_07'], 10: ['s10_01'] },
      }),
    );

    const migrated = loadGame();
    // v33 (OVERHAUL5): per-copy quality retires with the per-copy inventory — the
    // copies convert to countable CARDS with no loss of count (quality was already
    // a ×1 no-op in the power model). The load must not choke on the field.
    expect(migrated?.inventory).toEqual([]);
    expect(migrated?.cardInventory['s13_07']).toBe(2);
    expect(migrated?.cardInventory['s10_01']).toBe(1);
  });

  it('#44 v24 wildSlot round-trips; pre-v24 saves default it to empty', () => {
    // @ts-expect-error test bootstrap
    global.window = {};
    // @ts-expect-error test bootstrap
    global.localStorage = localStorageMock;
    const base = createInitialGameState(100);
    // A pre-v24 save (no wildSlot field) → defaults to ''.
    localStorageMock.setItem('cosmic_coalescence_save_v7', JSON.stringify({ ...base, version: 23, equippedSlots: ['s1_00'] }));
    expect(loadGame()?.wildSlot).toBe('');
    // A v24 save round-trips the wild slot — v33 remaps the owned copy to its
    // CREW id (s10_02 = Dust Grain is crew), which stays equipped in the wild slot.
    localStorageMock.setItem(
      'cosmic_coalescence_save_v7',
      JSON.stringify({ ...base, version: 24, wildSlot: 's10_02', inventory: [{ entityId: 's10_02', count: 1, level: 1 }] }),
    );
    const m = loadGame();
    expect(m?.wildSlot).toBe('s10_02');
    expect(m?.crew['s10_02']?.tier).toBe('common');
  });

  it('P7 v32: pre-v32 saves default echoSpent/fusionsSinceMythic to 0 + backfill resonance_core/echoFocus', () => {
    // @ts-expect-error test bootstrap
    global.window = {};
    // @ts-expect-error test bootstrap
    global.localStorage = localStorageMock;
    const base = createInitialGameState(100);
    // A pre-v32 save: prestigeUpgrades has the OLD 6 keys (no resonance_core/echoFocus),
    // and the two new top-level ints are absent entirely.
    const oldUpgrades = {
      time_warp: 1, matter_forge: 2, critical_core: 0, auto_engine: 3,
      entropy_echo: 1, condensation_core: 4,
    };
    localStorageMock.setItem(
      'cosmic_coalescence_save_v7',
      JSON.stringify({ ...base, version: 31, prestigeUpgrades: oldUpgrades, echoSpent: undefined, fusionsSinceMythic: undefined }),
    );
    const m = loadGame();
    expect(m?.echoSpent).toBe(0);
    expect(m?.fusionsSinceMythic).toBe(0);
    // the new sub-keys are backfilled UNDER the saved object (old levels preserved)
    expect(m?.prestigeUpgrades.condensation_core).toBe(4); // old key survives
    expect(m?.prestigeUpgrades.resonance_core).toBe(0);    // new sub-key defaulted
    expect(m?.prestigeUpgrades.echoFocus).toBe(50);        // new sub-key defaulted to balanced
  });

  it('P7 v32: a v32 save round-trips echoSpent + fusionsSinceMythic + resonance_core', () => {
    // @ts-expect-error test bootstrap
    global.window = {};
    // @ts-expect-error test bootstrap
    global.localStorage = localStorageMock;
    const base = createInitialGameState(100);
    localStorageMock.setItem(
      'cosmic_coalescence_save_v7',
      JSON.stringify({
        ...base,
        version: 32,
        echoSpent: 137,
        fusionsSinceMythic: 22,
        prestigeUpgrades: { ...base.prestigeUpgrades, resonance_core: 9, echoFocus: 70 },
      }),
    );
    const m = loadGame();
    expect(m?.echoSpent).toBe(137);
    expect(m?.fusionsSinceMythic).toBe(22);
    expect(m?.prestigeUpgrades.resonance_core).toBe(9);
    expect(m?.prestigeUpgrades.echoFocus).toBe(70);
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
    // P6 bounds the runaway count when exploding to flat copies; v33 then converts
    // the copies to CREW + spare CARDS — both crew ids, so each joins once and the
    // spares land as bounded card counts (never 1e9).
    expect(migrated!.inventory).toEqual([]);
    expect(migrated!.crew['s1_01']?.level).toBeLessThanOrEqual(25); // rarity level cap held
    expect(migrated!.cardInventory['s1_01'] ?? 0).toBeLessThanOrEqual(20 * 1000); // bounded
    expect(migrated!.crew['s1_02']?.level).toBe(1);
    expect(migrated!.cardInventory['s1_02']).toBe(2); // 3 copies → 1 joined + 2 cards
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

  it('v19 seeds enhanceStones=0 for existing saves and preserves it for v19', () => {
    // @ts-expect-error test bootstrap
    global.window = {};
    // @ts-expect-error test bootstrap
    global.localStorage = localStorageMock;
    const base = createInitialGameState(100);
    localStorageMock.setItem('cosmic_coalescence_save_v7', JSON.stringify({ ...base, version: 18 }));
    expect(loadGame()!.enhanceStones).toBe(0); // veteran: no retroactive stones
    localStorageMock.setItem('cosmic_coalescence_save_v7', JSON.stringify({ ...base, version: 19, enhanceStones: 42 }));
    expect(loadGame()!.enhanceStones).toBe(42); // genuine v19 keeps its balance
  });

  it('v30 seeds enhanceProtectCharges=0 for pre-v30 saves and round-trips it for v30', () => {
    // @ts-expect-error test bootstrap
    global.window = {};
    // @ts-expect-error test bootstrap
    global.localStorage = localStorageMock;
    const base = createInitialGameState(100);
    // A pre-v30 save has no enhanceProtectCharges field → defaults to 0 (consumable is new).
    localStorageMock.setItem('cosmic_coalescence_save_v7', JSON.stringify({ ...base, version: 29, enhanceProtectCharges: 7 }));
    expect(loadGame()!.enhanceProtectCharges).toBe(0); // veteran: brand-new field, not retroactive
    // A genuine v30 save keeps its purchased charges.
    localStorageMock.setItem('cosmic_coalescence_save_v7', JSON.stringify({ ...base, version: 30, enhanceProtectCharges: 7 }));
    expect(loadGame()!.enhanceProtectCharges).toBe(7);
    // A corrupt (negative) value clamps to 0.
    localStorageMock.setItem('cosmic_coalescence_save_v7', JSON.stringify({ ...base, version: 30, enhanceProtectCharges: -5 }));
    expect(loadGame()!.enhanceProtectCharges).toBe(0);
  });

  it('v31 seeds condenseBurstThisStage=0 for pre-v31 saves and preserves it for v31', () => {
    // @ts-expect-error test bootstrap
    global.window = {};
    // @ts-expect-error test bootstrap
    global.localStorage = localStorageMock;
    const base = createInitialGameState(100);
    // A pre-v31 save (no condenseBurstThisStage field) loads with the 분사 cap fresh at 0.
    const { condenseBurstThisStage: _drop, ...preV31 } = base;
    void _drop;
    localStorageMock.setItem('cosmic_coalescence_save_v7', JSON.stringify({ ...preV31, version: 30 }));
    expect(loadGame()!.condenseBurstThisStage).toBe(0);
    // A genuine v31 save keeps its in-progress 분사 contribution (mirrors the v22 counters).
    localStorageMock.setItem('cosmic_coalescence_save_v7', JSON.stringify({ ...base, version: 31, condenseBurstThisStage: 1234 }));
    expect(loadGame()!.condenseBurstThisStage).toBe(1234);
    // A corrupt (negative) value clamps to 0.
    localStorageMock.setItem('cosmic_coalescence_save_v7', JSON.stringify({ ...base, version: 31, condenseBurstThisStage: -9 }));
    expect(loadGame()!.condenseBurstThisStage).toBe(0);
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
    // purchasedEntities → inventory → v33 crew conversion: s1_01 is CREW, so the
    // count-3 stack becomes a joined crew (best copy) + 2 spare cards.
    expect(migrated!.inventory).toEqual([]);
    expect(migrated!.crew[entity.id]).toEqual({ tier: entity.rarity, level: 1 });
    expect(migrated!.cardInventory[entity.id]).toBe(2);
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
    // v33: s1_01 is CREW — the count-2 stack (best level 4) joins as the crew at
    // level 4; the spare becomes a card. Investment preserved through conversion.
    expect(migrated!.inventory).toEqual([]);
    expect(migrated!.crew[entity.id]?.level).toBe(4);
    expect(migrated!.cardInventory[entity.id]).toBe(1);
    // v17 remap: the v16 stage-1 gate maps EXACTLY onto the new stage-1 gate
    // (piecewise remap preserves gate progress).
    expect(migrated?.entropy).toBeCloseTo(STAGES[0].entropyThreshold, 6);
    // The equipped slot resolves THROUGH the copy to the crew id itself.
    expect(migrated!.equippedSlots[0]).toBe(entity.id);
    expect(migrated?.unlockedSlotCount).toBe(2);
    expect(migrated?.almanacCollected[1]).toContain(entity.id);
  });

  it('P6→v33: a v25 flat save converts — the BEST copy becomes the crew level, the spare a card', () => {
    // @ts-expect-error test bootstrap
    global.window = {};
    // @ts-expect-error test bootstrap
    global.localStorage = localStorageMock;
    const ent = getEntitiesForStage(1)[0];
    const base = createInitialGameState(100);
    localStorageMock.setItem(
      'cosmic_coalescence_save_v7',
      JSON.stringify({
        ...base,
        version: 25,
        inventory: [
          { entityId: ent.id, instanceId: 'inst-A', count: 1, level: 5 },
          { entityId: ent.id, instanceId: 'inst-B', count: 1, level: 3 },
        ],
        equippedSlots: ['inst-A'], // the Lv5 copy is worn; the Lv3 spare is not
        unlockedSlotCount: 1,
      }),
    );
    const m = loadGame();
    // The Lv5 copy's investment lands on the crew; the Lv3 spare converts to
    // 1 card + 2 refund stones ((level−1) per spare) — nothing is lost silently.
    expect(m!.inventory).toEqual([]);
    expect(m!.crew[ent.id]?.level).toBe(5);
    expect(m!.cardInventory[ent.id]).toBe(1);
    expect(m!.enhanceStones).toBe(2);
    // The worn slot follows the copy to its crew id.
    expect(m!.equippedSlots).toContain(ent.id);
  });
});
