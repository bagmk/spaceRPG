import { describe, expect, it } from 'vitest';
import { gameReducer, createInitialGameState } from '../reducer';
import { CODEX_SETS } from '../entities/codexSets';
import { STAGE_ENTITIES } from '../entities/stageItems';

/** All member ids of a subset (matched against the canonical roster). */
function subsetMemberIds(setId: string, subsetId: string): string[] {
  const set = CODEX_SETS.find((s) => s.id === setId)!;
  const sub = set.subsets.find((s) => s.id === subsetId)!;
  return STAGE_ENTITIES.filter((e) =>
    (sub.match.entityIds?.includes(e.id)) ||
    (sub.match.glyphs?.includes(e.visual.glyph)) ||
    (sub.match.stageIds?.includes(e.stageId)),
  ).map((e) => e.id);
}

/** Build an almanacCollected record that fully completes the given subsets. */
function collectAll(ids: string[]): Record<number, string[]> {
  const byStage: Record<number, string[]> = {};
  for (const id of ids) {
    const e = STAGE_ENTITIES.find((x) => x.id === id)!;
    (byStage[e.stageId] ??= []).push(id);
  }
  return byStage;
}

describe('Persona L: codex-claim celebration event (mirrors lastDropEvent)', () => {
  it('claiming a complete subset sets lastCodexClaimEvent with the subset id', () => {
    // standard_model/quarks is a multi-subset set, so completing just quarks
    // does NOT complete the whole set → isFullSet must be false.
    const quarkIds = subsetMemberIds('standard_model', 'quarks');
    const state = {
      ...createInitialGameState(0),
      almanacCollected: collectAll(quarkIds),
      claimedCodexSubsetIds: [],
    };
    const next = gameReducer(state, { type: 'CLAIM_CODEX_SUBSET', subsetId: 'quarks' });

    expect(next.claimedCodexSubsetIds).toContain('quarks');
    expect(next.lastCodexClaimEvent).not.toBeNull();
    expect(next.lastCodexClaimEvent?.subsetId).toBe('quarks');
    expect(next.lastCodexClaimEvent?.isFullSet).toBe(false); // set has 5 subsets

    // CLEAR keyed by the event id removes it (mirrors CLEAR_DROP_EVENT).
    const cleared = gameReducer(next, { type: 'CLEAR_CODEX_CLAIM_EVENT', id: next.lastCodexClaimEvent!.id });
    expect(cleared.lastCodexClaimEvent).toBeNull();
    // A stale id is a no-op.
    const stale = gameReducer(next, { type: 'CLEAR_CODEX_CLAIM_EVENT', id: next.lastCodexClaimEvent!.id + 999 });
    expect(stale.lastCodexClaimEvent).not.toBeNull();
  });

  it('completing the LAST subset of a set flags isFullSet', () => {
    // genesis has a single subset (first_light) → claiming it completes the set.
    const ids = subsetMemberIds('genesis', 'first_light');
    const state = {
      ...createInitialGameState(0),
      almanacCollected: collectAll(ids),
      claimedCodexSubsetIds: [],
    };
    const next = gameReducer(state, { type: 'CLAIM_CODEX_SUBSET', subsetId: 'first_light' });
    expect(next.lastCodexClaimEvent?.subsetId).toBe('first_light');
    expect(next.lastCodexClaimEvent?.isFullSet).toBe(true);
  });

  it('claiming the final remaining subset of a multi-subset set flags isFullSet', () => {
    // standard_model: pre-claim 4 of its 5 subsets, collect every member, then
    // claiming the 5th (antimatter) closes the set → isFullSet true.
    const sm = CODEX_SETS.find((s) => s.id === 'standard_model')!;
    const allIds = sm.subsets.flatMap((sub) => subsetMemberIds('standard_model', sub.id));
    const last = sm.subsets[sm.subsets.length - 1].id;
    const preClaimed = sm.subsets.slice(0, -1).map((sub) => sub.id);
    const state = {
      ...createInitialGameState(0),
      almanacCollected: collectAll([...new Set(allIds)]),
      claimedCodexSubsetIds: preClaimed,
    };
    const next = gameReducer(state, { type: 'CLAIM_CODEX_SUBSET', subsetId: last });
    expect(next.lastCodexClaimEvent?.subsetId).toBe(last);
    expect(next.lastCodexClaimEvent?.isFullSet).toBe(true);
  });

  it('claiming an incomplete subset is a no-op (no event)', () => {
    const state = { ...createInitialGameState(0), almanacCollected: {}, claimedCodexSubsetIds: [] };
    const next = gameReducer(state, { type: 'CLAIM_CODEX_SUBSET', subsetId: 'quarks' });
    expect(next.lastCodexClaimEvent).toBeNull();
    expect(next.claimedCodexSubsetIds).toEqual([]);
  });
});
