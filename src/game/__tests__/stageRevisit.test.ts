import { describe, expect, it } from 'vitest';
import { createInitialGameState, gameReducer } from '../reducer';

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
