import { describe, expect, it } from 'vitest';
import { gameReducer, createInitialGameState } from '../reducer';
import { getQuest, getQuestProgress } from '../quests';
import { getStageMilestoneActiveIds } from '../milestones';
import { migrateToCurrent, createSaveSnapshot, SAVE_SCHEMA_VERSION } from '../storage';
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
    const m = getQuest('m.1.pulse.0')!; // active stage-1 click milestone
    const state = { ...createInitialGameState(0), totalClicks: 0, stageClicksAtStageStart: 0 };
    expect(getQuestProgress(m, state)).toBeLessThan(m.target);
    const after = gameReducer(state, { type: 'CLAIM_QUEST', questId: 'm.1.pulse.0' });
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

  it('leaving a stage (ADVANCE_STAGE) snapshots its active quests progress, capped at target', () => {
    // Stage 2 (stageIdx 1). forge target is 6; set partial (3) and full (6) progress
    // across the active set, then advance and read the frozen snapshot for stage 2.
    const forge = getQuest('m.2.forge.0')!;
    const base = {
      ...createInitialGameState(0),
      stageIdx: 1,
      activeQuests: getStageMilestoneActiveIds(2, []),
      fusionsThisStage: forge.target, // forge fully met → snapshot should equal target
      cometsThisStage: 3,             // comet target 28 → snapshot 3 (partial)
      pendingCondenseStageIdx: 1,     // required for ADVANCE_STAGE to fire
    };
    const advanced = gameReducer(base, { type: 'ADVANCE_STAGE', now: 1000 });
    expect(advanced.stageIdx).toBe(2); // moved to stage 3
    const snap2 = advanced.stageQuestProgress[2];
    expect(snap2).toBeDefined();
    expect(snap2['m.2.forge.0']).toBe(forge.target); // capped at target
    expect(snap2['m.2.comet.0']).toBe(3);            // partial frozen
    // the per-stage counters themselves reset on entry.
    expect(advanced.fusionsThisStage).toBe(0);
    expect(advanced.cometsThisStage).toBe(0);
  });

  it('a past completed-but-unclaimed quest is claimable from its snapshot, once', () => {
    const forge = getQuest('m.2.forge.0')!;
    const state = {
      ...createInitialGameState(0),
      stageIdx: 3, // player has moved on to stage 4
      quanta: 0,
      // forge from stage 2 hit its target but was never claimed before leaving.
      stageQuestProgress: { 2: { 'm.2.forge.0': forge.target } },
      activeQuests: getStageMilestoneActiveIds(4, []), // forge is NOT in the live set
      completedQuestIds: [],
    };
    const claimed = gameReducer(state, { type: 'CLAIM_QUEST', questId: 'm.2.forge.0' });
    expect(claimed.completedQuestIds).toContain('m.2.forge.0');
    expect(claimed.quanta).toBeGreaterThan(0); // reward granted at the current stage anchor
    expect(claimed.lastQuestClaimEvent?.questId).toBe('m.2.forge.0');
    // claiming it again is a no-op (guarded on completedQuestIds → no double-grant).
    const again = gameReducer(claimed, { type: 'CLAIM_QUEST', questId: 'm.2.forge.0' });
    expect(again).toBe(claimed);
  });

  it('a past quest whose snapshot did NOT meet the target is not claimable', () => {
    const forge = getQuest('m.2.forge.0')!;
    const state = {
      ...createInitialGameState(0),
      stageIdx: 3,
      stageQuestProgress: { 2: { 'm.2.forge.0': forge.target - 1 } }, // short of target
      activeQuests: getStageMilestoneActiveIds(4, []),
    };
    const after = gameReducer(state, { type: 'CLAIM_QUEST', questId: 'm.2.forge.0' });
    expect(after).toBe(state);
  });

  it('a pre-v29 save loads with stageQuestProgress defaulting to {}', () => {
    const snapshot = createSaveSnapshot(createInitialGameState(0));
    const v28 = { ...snapshot, version: 28 } as Record<string, unknown>;
    delete v28.stageQuestProgress;
    const migrated = migrateToCurrent(v28);
    expect(migrated).not.toBeNull();
    expect(migrated!.stageQuestProgress).toEqual({});
  });

  it('a v29 save round-trips stageQuestProgress through migration', () => {
    const base = {
      ...createInitialGameState(0),
      stageIdx: 3,
      stageQuestProgress: { 2: { 'm.2.forge.0': 6, 'm.2.comet.0': 3 }, 1: { 'm.1.pulse.0': 80 } },
    };
    const snapshot = createSaveSnapshot(base);
    expect(snapshot.version).toBe(SAVE_SCHEMA_VERSION);
    const migrated = migrateToCurrent(snapshot);
    expect(migrated).not.toBeNull();
    expect(migrated!.stageQuestProgress).toEqual({
      1: { 'm.1.pulse.0': 80 },
      2: { 'm.2.forge.0': 6, 'm.2.comet.0': 3 },
    });
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
    expect(snapshot.version).toBe(SAVE_SCHEMA_VERSION);
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
