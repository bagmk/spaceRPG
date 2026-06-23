import { describe, expect, it } from 'vitest';
import { createInitialGameState, gameReducer } from '../reducer';
import { createSaveSnapshot, migrateToCurrent } from '../storage';
import { STAGE_ENTITIES } from '../entities/stageItems';
import { CODEX_SETS, getSubsetMembers } from '../entities/codexSets';

/**
 * Codex click-to-activate (save v28, user #2). A complete codex SUBSET grants no bonus
 * until its completion is CLAIMED (CLAIM_CODEX_SUBSET) — the reward-application gating
 * is pinned in identity.test; here we pin the reducer + persistence.
 */
describe('codex claim-to-activate (v28)', () => {
  // Genesis "first_light" subset = all stage-1 entities.
  const firstLight = CODEX_SETS.find((s) => s.id === 'genesis')!.subsets.find((s) => s.id === 'first_light')!;
  const members = getSubsetMembers(firstLight, STAGE_ENTITIES).map((e) => e.id);

  it('CLAIM_CODEX_SUBSET activates a COMPLETE subset; idempotent; no-op when incomplete', () => {
    const complete = { ...createInitialGameState(0), almanacCollected: { 1: members } };
    const claimed = gameReducer(complete, { type: 'CLAIM_CODEX_SUBSET', subsetId: 'first_light' });
    expect(claimed.claimedCodexSubsetIds).toContain('first_light');
    // claiming again is a no-op (no dupes)
    const again = gameReducer(claimed, { type: 'CLAIM_CODEX_SUBSET', subsetId: 'first_light' });
    expect(again.claimedCodexSubsetIds).toEqual(claimed.claimedCodexSubsetIds);
    // an INCOMPLETE subset can't be claimed (empty almanac → not complete)
    const noop = gameReducer(createInitialGameState(0), { type: 'CLAIM_CODEX_SUBSET', subsetId: 'first_light' });
    expect(noop.claimedCodexSubsetIds).toEqual([]);
  });

  it('claimedCodexSubsetIds survive a save round-trip; a pre-v28 save loads empty', () => {
    const state = { ...createInitialGameState(0), claimedCodexSubsetIds: ['first_light'] };
    const restored = migrateToCurrent(JSON.parse(JSON.stringify(createSaveSnapshot(state))));
    expect(restored!.claimedCodexSubsetIds).toEqual(['first_light']);
    // pre-v28: no field → [] (complete subsets become claimable, not auto-granted)
    const old = createSaveSnapshot(createInitialGameState(0)) as unknown as Record<string, unknown>;
    delete old.claimedCodexSubsetIds;
    old.version = 27;
    expect(migrateToCurrent(old as never)!.claimedCodexSubsetIds).toEqual([]);
  });
});
