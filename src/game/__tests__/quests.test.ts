import { describe, expect, it } from 'vitest';
import { gameReducer, createInitialGameState } from '../reducer';
import { getQuest, getQuestProgress } from '../quests';
import { migrateToCurrent, createSaveSnapshot } from '../storage';
import { getEntitiesForStage } from '../entities/stageItems';

describe('🅠5 quests', () => {
  it('a new game offers the stage-1 milestone steps (fusion track locked)', () => {
    const state = createInitialGameState(0);
    expect(state.activeQuests).toContain('m.1.pulse.0');
    expect(state.activeQuests).toContain('m.1.archive.0');
    // forge (fusion) is gated to stage 2+, so it is not offered in stage 1.
    expect(state.activeQuests).not.toContain('m.1.forge.0');
    expect(state.completedQuestIds).toEqual([]);
  });

  it('milestone progress derives from per-stage state (clicks this stage)', () => {
    const m = getQuest('m.1.pulse.0')!;
    expect(getQuestProgress(m, { ...createInitialGameState(0), totalClicks: 0, stageClicksAtStageStart: 0 })).toBe(0);
    const half = Math.floor(m.target / 2);
    expect(getQuestProgress(m, { ...createInitialGameState(0), totalClicks: half, stageClicksAtStageStart: 0 })).toBe(half);
    // clamps at the target.
    expect(getQuestProgress(m, { ...createInitialGameState(0), totalClicks: m.target * 9, stageClicksAtStageStart: 0 })).toBe(m.target);
  });

  it('CLAIM_QUEST grants the reward, completes the step, and offers the next tier', () => {
    const m = getQuest('m.1.pulse.0')!;
    const state = { ...createInitialGameState(0), totalClicks: m.target, stageClicksAtStageStart: 0, quanta: 0 };
    expect(getQuestProgress(m, state)).toBe(m.target);
    const claimed = gameReducer(state, { type: 'CLAIM_QUEST', questId: 'm.1.pulse.0' });
    expect(claimed.completedQuestIds).toContain('m.1.pulse.0');
    expect(claimed.activeQuests).not.toContain('m.1.pulse.0');
    expect(claimed.activeQuests).toContain('m.1.pulse.1'); // next tier becomes active
    expect(claimed.quanta).toBeGreaterThan(0);
  });

  it('claiming a not-yet-met quest is a no-op', () => {
    const state = { ...createInitialGameState(0), almanacCollected: {} };
    expect(getQuestProgress(getQuest('absorb_10')!, state)).toBeLessThan(10);
    const after = gameReducer(state, { type: 'CLAIM_QUEST', questId: 'absorb_10' });
    expect(after).toBe(state);
  });

  it('fusing increments the per-stage fusion counter (forge milestone metric)', () => {
    const common = getEntitiesForStage(1).filter((e) => e.rarity === 'common')[0];
    const base = {
      ...createInitialGameState(0),
      stageIdx: 2, // stage 3
      quanta: 1e9,
      inventory: [{ entityId: common.id, count: 3, level: 1 }],
    };
    const after = gameReducer(base, {
      type: 'FUSE_ENTITIES', inputEntityIds: [common.id, common.id, common.id], rarityRoll: 0.99, pickRoll: 0.1, stageRoll: 0.1,
    });
    expect(after.fusionsThisStage).toBe(1);
  });

  it('per-stage milestone counters reset on stage advance', () => {
    const base = { ...createInitialGameState(0), stageIdx: 2, fusionsThisStage: 5, cometsThisStage: 3, comboThisStage: 80 };
    const advanced = gameReducer(base, { type: 'ADMIN_NEXT_STAGE', now: 1000 });
    expect(advanced.fusionsThisStage).toBe(0);
    expect(advanced.cometsThisStage).toBe(0);
    expect(advanced.comboThisStage).toBe(0);
  });

  it('prestige keeps completedQuestIds but resets activeQuests', () => {
    const state = { ...createInitialGameState(0), completedQuestIds: ['comet_50'], activeQuests: ['absorb_10'] };
    const after = gameReducer(state, { type: 'PRESTIGE', now: 1000 });
    expect(after.completedQuestIds).toContain('comet_50'); // survives
    expect(after.activeQuests).not.toContain('comet_50');   // completed → not re-offered
    expect(after.activeQuests.length).toBeGreaterThan(0);    // fresh stage-1 set
  });

  it('a v19 save migrates to v20 with a seeded quest set', () => {
    const snapshot = createSaveSnapshot(createInitialGameState(0));
    const v19 = { ...snapshot, version: 19 } as Record<string, unknown>;
    delete v19.activeQuests;
    delete v19.completedQuestIds;
    const migrated = migrateToCurrent(v19);
    expect(migrated).not.toBeNull();
    expect(migrated!.activeQuests.length).toBeGreaterThan(0);
    expect(migrated!.completedQuestIds).toEqual([]);
  });

  it('a v22 save round-trips claimed milestones + per-stage counters through migration', () => {
    const base = {
      ...createInitialGameState(0),
      stageIdx: 2, // stage 3
      activeQuests: ['m.3.pulse.0', 'm.3.forge.0', 'm.3.comet.0'],
      completedQuestIds: ['m.1.pulse.0', 'm.1.archive.0', 'm.2.forge.0', 'm.3.expanse.0'],
      fusionsThisStage: 4,
      cometsThisStage: 2,
      comboThisStage: 55,
    };
    const snapshot = createSaveSnapshot(base);
    expect(snapshot.version).toBe(22);
    const migrated = migrateToCurrent(snapshot);
    expect(migrated).not.toBeNull();
    // claimed milestones are once-only and must survive a load verbatim.
    expect(migrated!.completedQuestIds).toEqual(['m.1.pulse.0', 'm.1.archive.0', 'm.2.forge.0', 'm.3.expanse.0']);
    // per-stage counters survive (a returning player keeps their progress).
    expect(migrated!.fusionsThisStage).toBe(4);
    expect(migrated!.cometsThisStage).toBe(2);
    expect(migrated!.comboThisStage).toBe(55);
    // active set still resolves to current-stage milestones.
    expect(migrated!.activeQuests.length).toBeGreaterThan(0);
  });
});
