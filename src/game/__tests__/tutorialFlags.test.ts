import { describe, expect, it } from 'vitest';
import { gameReducer, createInitialGameState } from '../reducer';

/**
 * Onboarding SPARKLE flags (S2 equip/fuse + S3 enhance). The in-panel sparkle is
 * driven by selectTutorialHighlight off these free-form tutorialFlags; the reducers
 * SET them on the real action so advancement tracks actual play, not UI state. These
 * pin the writes. No save-schema bump — they live in the existing tutorialFlags map.
 *
 * The three targets are the stage-1 commons every player owns by S2 (positional ids):
 *   s1_01 = 양자 요동 (click), s1_02 = 거짓 진공 거품 (auto→rift), s1_03 = 인플라톤 폭주 (crit).
 */
describe('tutorial sparkle flags — equip (S2)', () => {
  it('equipping 거짓 진공 거품 (s1_02) sets equip-spark-vacuum-done (and first-equip-done)', () => {
    const state = {
      ...createInitialGameState(0),
      stageIdx: 1, // stage 2
      inventory: [{ entityId: 's1_02', instanceId: 'i-vac', count: 1, level: 1 }],
    };
    const next = gameReducer(state, { type: 'EQUIP_ENTITY', entityId: 's1_02' });
    // s1_02 is auto → routes to a rift slot
    // OVERHAUL5: s1_02 is a JOINED crew — it equips by its own id (unique copy).
    expect(next.riftSlots).toContain('s1_02');
    expect(next.tutorialFlags['equip-spark-vacuum-done']).toBe(true);
    expect(next.tutorialFlags['first-equip-done']).toBe(true);
    expect(next.tutorialFlags['equip-spark-quantum-done']).toBeUndefined();
  });

  it('equipping 양자 요동 (s1_01) sets equip-spark-quantum-done', () => {
    const state = {
      ...createInitialGameState(0),
      stageIdx: 1,
      inventory: [{ entityId: 's1_01', instanceId: 'i-q', count: 1, level: 1 }],
    };
    const next = gameReducer(state, { type: 'EQUIP_ENTITY', entityId: 's1_01' });
    // OVERHAUL5: s1_01 is a JOINED crew — it equips by its own id.
    expect(next.equippedSlots).toContain('s1_01');
    expect(next.tutorialFlags['equip-spark-quantum-done']).toBe(true);
    expect(next.tutorialFlags['equip-spark-vacuum-done']).toBeUndefined();
  });

  it('equipping an unrelated item sets first-equip-done but no spark flag', () => {
    const state = {
      ...createInitialGameState(0),
      stageIdx: 1,
      inventory: [{ entityId: 's1_03', instanceId: 'i-o', count: 1, level: 1 }],
    };
    const next = gameReducer(state, { type: 'EQUIP_ENTITY', entityId: 's1_03' });
    expect(next.tutorialFlags['first-equip-done']).toBe(true);
    expect(next.tutorialFlags['equip-spark-vacuum-done']).toBeUndefined();
    expect(next.tutorialFlags['equip-spark-quantum-done']).toBeUndefined();
  });
});

describe('tutorial sparkle flags — fuse (S2)', () => {
  it('fusing three 인플라톤 폭주 (s1_03) sets fuse-spark-done', () => {
    const state = {
      ...createInitialGameState(0),
      stageIdx: 1,
      quanta: 1e9,
      inventory: [{ entityId: 's1_03', count: 3, level: 1 }],
    };
    const next = gameReducer(state, {
      type: 'FUSE_ENTITIES', inputEntityIds: ['s1_03', 's1_03', 's1_03'], rarityRoll: 0.99, pickRoll: 0.1,
    });
    expect(next.lastFusionEvent).not.toBeNull();
    expect(next.tutorialFlags['fuse-spark-done']).toBe(true);
  });

  it('a fusion that does NOT consume s1_03 leaves fuse-spark-done unset', () => {
    const state = {
      ...createInitialGameState(0),
      stageIdx: 1,
      quanta: 1e9,
      inventory: [{ entityId: 's1_01', count: 3, level: 1 }],
    };
    const next = gameReducer(state, {
      type: 'FUSE_ENTITIES', inputEntityIds: ['s1_01', 's1_01', 's1_01'], rarityRoll: 0.99, pickRoll: 0.1,
    });
    expect(next.lastFusionEvent).not.toBeNull();
    expect(next.tutorialFlags['fuse-spark-done']).toBeUndefined();
  });
});

describe('tutorial sparkle flags — enhance (S3)', () => {
  it('enhancing an equipped copy sets enhance-spark-done', () => {
    // Lv1 → Lv2 is the guaranteed band (need(1) = 3 spare copies). Anchor is equipped.
    const state = {
      ...createInitialGameState(0),
      stageIdx: 2, // stage 3
      inventory: [
        { entityId: 's1_01', instanceId: 'i-anchor', count: 1, level: 1 },
        { entityId: 's1_01', instanceId: 'i-f1', count: 1, level: 1 },
        { entityId: 's1_01', instanceId: 'i-f2', count: 1, level: 1 },
        { entityId: 's1_01', instanceId: 'i-f3', count: 1, level: 1 },
      ],
      equippedSlots: ['i-anchor'],
    };
    const next = gameReducer(state, {
      type: 'ENHANCE_ENTITY', instanceId: 'i-anchor', failRoll: 0.99, breakRoll: 0.99, destroyRoll: 0.99,
    });
    // the anchor leveled up (merge consumed the 3 spares) and the flag is set
    expect(next.lastEnhanceEvent?.outcome).toBe('up');
    expect(next.tutorialFlags['enhance-spark-done']).toBe(true);
  });
});
