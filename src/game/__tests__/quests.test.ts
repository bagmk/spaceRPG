import { describe, expect, it } from 'vitest';
import { gameReducer, createInitialGameState } from '../reducer';
import { getQuest, getQuestProgress } from '../quests';
import { migrateToCurrent, createSaveSnapshot } from '../storage';
import { getEntitiesForStage } from '../entities/stageItems';

describe('🅠5 quests', () => {
  it('a new game offers the stage-1-eligible quests', () => {
    const state = createInitialGameState(0);
    expect(state.activeQuests).toContain('comet_50');
    expect(state.activeQuests).toContain('absorb_10');
    expect(state.activeQuests).toContain('combo_100');
    // stage-14+ quests are not offered yet.
    expect(state.activeQuests).not.toContain('stage_16');
    expect(state.completedQuestIds).toEqual([]);
  });

  it('comet quest progress derives from the persisted collisions count', () => {
    const quest = getQuest('comet_50')!;
    expect(getQuestProgress(quest, { ...createInitialGameState(0), collisions: 0 })).toBe(0);
    expect(getQuestProgress(quest, { ...createInitialGameState(0), collisions: 30 })).toBe(30);
    // clamps at the target.
    expect(getQuestProgress(quest, { ...createInitialGameState(0), collisions: 999 })).toBe(50);
  });

  it('CLAIM_QUEST grants the reward, completes the quest, and refreshes the set', () => {
    const state = { ...createInitialGameState(0), collisions: 50, quanta: 0 };
    expect(getQuestProgress(getQuest('comet_50')!, state)).toBe(50);
    const claimed = gameReducer(state, { type: 'CLAIM_QUEST', questId: 'comet_50' });
    expect(claimed.completedQuestIds).toContain('comet_50');
    expect(claimed.activeQuests).not.toContain('comet_50');
    expect(claimed.quanta).toBeGreaterThan(0); // matterAnchorFrac 0.5 × anchor[1]
  });

  it('claiming a not-yet-met quest is a no-op', () => {
    const state = { ...createInitialGameState(0), almanacCollected: {} };
    expect(getQuestProgress(getQuest('absorb_10')!, state)).toBeLessThan(10);
    const after = gameReducer(state, { type: 'CLAIM_QUEST', questId: 'absorb_10' });
    expect(after).toBe(state);
  });

  it('fusing advances the fuse-track quest counter', () => {
    // fuse_3 is offered from stage 3; put it active and fuse once.
    const common = getEntitiesForStage(1).filter((e) => e.rarity === 'common')[0];
    const base = {
      ...createInitialGameState(0),
      stageIdx: 2, // stage 3
      activeQuests: ['fuse_3'],
      quanta: 1e9,
      inventory: [{ entityId: common.id, count: 3, level: 1 }],
    };
    const after = gameReducer(base, {
      type: 'FUSE_ENTITIES', inputEntityIds: [common.id, common.id, common.id], rarityRoll: 0.99, pickRoll: 0.1, stageRoll: 0.1,
    });
    expect(after.questProgress.fuse_3).toBe(1);
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
});
