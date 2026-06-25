import { describe, expect, it } from 'vitest';
import { createInitialGameState, gameReducer } from '../reducer';
import { getQuest, isPastQuestClaimable, pastQuestProgress } from '../quests';

// Stage-revisit: clicking (or absorbing a comet) while VIEWING a past stage should drop
// from THAT stage's pool, so the player can revisit earlier eras to fill their codex.
describe('stage-revisit drops', () => {
  const click = (viewedStageId: number | undefined) =>
    gameReducer(
      { ...createInitialGameState(0), stageIdx: 7 }, // current = stage 8
      {
        type: 'CLICK',
        now: 1000,
        randomValue: 0.99, // not a crit
        x: 0,
        y: 0,
        dropRoll: 0, // 0 < drop chance → always drops
        dropPickRoll: 0.5,
        dropStageRoll: 0, // < DROP_CURRENT_STAGE_WEIGHT → the drop's "home" stage
        viewedStageId,
      },
    );

  it('clicking while viewing a PAST stage drops from that stage', () => {
    // Fresh state ⇒ everything undiscovered ⇒ the drop is a NEW discovery whose stageId we can read.
    expect(click(5).lastDropEvent?.stageId).toBe(5);
  });

  it('clicking with no past-stage view drops from the CURRENT stage', () => {
    expect(click(undefined).lastDropEvent?.stageId).toBe(8);
  });

  it('a viewedStageId that is not actually a past stage is ignored (uses current)', () => {
    expect(click(8).lastDropEvent?.stageId).toBe(8); // 8 == current, not < current
  });
});

// The codex/archive quest of a past stage reads the PERSISTENT almanac, so revisiting to
// collect that era's entities keeps filling it — it can be finished after leaving. Other
// tracks (clicks/fusions/…) reset per stage and stay frozen at their leave-time snapshot.
describe('stage-revisit quests', () => {
  it('a past-stage codex quest fills LIVE as you revisit-collect (ignores a low frozen snapshot)', () => {
    const quest = getQuest('m.2.archive.0');
    expect(quest).toBeTruthy();
    if (!quest) return;
    const collected = Array.from({ length: quest.target }, (_, i) => `s2_${String(i + 1).padStart(2, '0')}`);
    const state = {
      ...createInitialGameState(0),
      stageIdx: 4, // current = stage 5, viewing past stage 2
      almanacCollected: { 2: collected },
      stageQuestProgress: { 2: { 'm.2.archive.0': 0 } }, // left stage 2 with it unfilled
      completedQuestIds: [],
    };
    expect(pastQuestProgress(quest, state)).toBe(quest.target);
    expect(isPastQuestClaimable(quest, state)).toBe(true);
  });

  it('a non-archive past quest stays on its frozen snapshot (not re-earnable by revisiting)', () => {
    const quest = getQuest('m.2.pulse.0');
    expect(quest).toBeTruthy();
    if (!quest) return;
    const state = {
      ...createInitialGameState(0),
      stageIdx: 4,
      stageQuestProgress: { 2: { 'm.2.pulse.0': 3 } }, // frozen; no live stage-2 click counter exists
      completedQuestIds: [],
    };
    expect(pastQuestProgress(quest, state)).toBe(3);
  });
});
