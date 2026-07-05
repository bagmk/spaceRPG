import { describe, expect, it } from 'vitest';
import { gameReducer, createInitialGameState } from '../reducer';
import { CREW_ROSTER, CREW_BY_ID, isCrewId, crewJoiningAtOrBefore } from '../crew/roster';
import { getCrewTierView } from '../crew/tierView';
import { findEntityById } from '../entities/stageItems';
import {
  CREW_PROMOTE_CARD_COST,
  CREW_PROMOTE_STONE_COST,
  CREW_CARD_ERA_WINDOW,
  CREW_PROMOTE_MYTHIC_PITY,
  CREW_TIER_BASE_VALUE,
} from '../balance';
import type { GameState } from '../types';

const S1_CREW = CREW_ROSTER.filter((c) => c.joinStage === 1).map((c) => c.id);

/** Cards from the crew's own era window, enough for one promotion attempt. */
function fundCards(state: GameState, crewId: string, count: number): GameState {
  const def = CREW_BY_ID.get(crewId)!;
  // The crew's own source entity always sits inside its era window.
  return { ...state, cardInventory: { ...state.cardInventory, [crewId]: count } };
}

describe('OVERHAUL5 crew roster', () => {
  it('has exactly 50 unique crew, every stage 1-16 introduces at least 2', () => {
    expect(CREW_ROSTER).toHaveLength(50);
    expect(new Set(CREW_ROSTER.map((c) => c.id)).size).toBe(50);
    for (let s = 1; s <= 16; s++) {
      expect(CREW_ROSTER.filter((c) => c.joinStage === s).length).toBeGreaterThanOrEqual(2);
    }
    // Every crew id resolves to a REAL entity (position-locked ids).
    for (const c of CREW_ROSTER) expect(findEntityById(c.id), c.id).toBeDefined();
  });

  it('a fresh game starts with the stage-1 trio joined + their join beats queued', () => {
    const state = createInitialGameState(0);
    for (const id of S1_CREW) expect(state.crew[id]).toEqual({ tier: 'common', level: 1 });
    expect(state.pendingCrewJoinIds).toEqual(S1_CREW);
    // DISMISS pops FIFO.
    const next = gameReducer(state, { type: 'DISMISS_CREW_JOIN' });
    expect(next.pendingCrewJoinIds).toEqual(S1_CREW.slice(1));
  });

  it('ADMIN_NEXT_STAGE joins the new stage\'s crew with dialogue beats', () => {
    const state = { ...createInitialGameState(0), pendingCrewJoinIds: [] };
    const next = gameReducer(state, { type: 'ADMIN_NEXT_STAGE', now: 1000 });
    const stage2Crew = CREW_ROSTER.filter((c) => c.joinStage === 2).map((c) => c.id);
    for (const id of stage2Crew) expect(next.crew[id]).toEqual({ tier: 'common', level: 1 });
    expect(next.pendingCrewJoinIds).toEqual(stage2Crew);
  });
});

describe('OVERHAUL5 promotion altar (승급 제단)', () => {
  const crewId = S1_CREW[0];

  it('promotes common→rare on a successful roll, consuming cards + stones', () => {
    let state = fundCards(createInitialGameState(0), crewId, CREW_PROMOTE_CARD_COST.common);
    state = { ...state, enhanceStones: CREW_PROMOTE_STONE_COST.common };
    const next = gameReducer(state, { type: 'PROMOTE_CREW', crewId, successRoll: 0 }); // 0 < 0.85
    expect(next.crew[crewId].tier).toBe('rare');
    expect(next.cardInventory[crewId]).toBeUndefined(); // 8 cards consumed
    expect(next.enhanceStones).toBe(0);
    expect(next.lastCrewPromoteEvent?.success).toBe(true);
    expect(next.lastCrewPromoteEvent?.toTier).toBe('rare');
  });

  it('a failed attempt consumes cards, refunds half the stones, crew survives at tier', () => {
    let state = fundCards(createInitialGameState(0), crewId, CREW_PROMOTE_CARD_COST.common);
    state = { ...state, enhanceStones: CREW_PROMOTE_STONE_COST.common };
    const next = gameReducer(state, { type: 'PROMOTE_CREW', crewId, successRoll: 0.99 }); // ≥ 0.85
    expect(next.crew[crewId].tier).toBe('common'); // survives, not destroyed
    expect(next.cardInventory[crewId]).toBeUndefined(); // cards still consumed
    // Half the stone cost refunded (ceil of the spend).
    expect(next.enhanceStones).toBe(CREW_PROMOTE_STONE_COST.common - Math.ceil(CREW_PROMOTE_STONE_COST.common * 0.5));
    expect(next.lastCrewPromoteEvent?.success).toBe(false);
  });

  it('refuses without enough era-window cards or stones', () => {
    const state = { ...createInitialGameState(0), enhanceStones: 999 };
    expect(gameReducer(state, { type: 'PROMOTE_CREW', crewId, successRoll: 0 }).crew[crewId].tier).toBe('common');
    let funded = fundCards(createInitialGameState(0), crewId, 999);
    funded = { ...funded, enhanceStones: 0 };
    expect(gameReducer(funded, { type: 'PROMOTE_CREW', crewId, successRoll: 0 }).crew[crewId].tier).toBe('common');
  });

  it('mythic step: pity forces success at the shared counter floor and resets it', () => {
    let state = fundCards(createInitialGameState(0), crewId, CREW_PROMOTE_CARD_COST.legendary);
    state = {
      ...state,
      enhanceStones: 999,
      crew: { ...state.crew, [crewId]: { tier: 'legendary', level: 1 } },
      fusionsSinceMythic: CREW_PROMOTE_MYTHIC_PITY, // at the floor
    };
    const next = gameReducer(state, { type: 'PROMOTE_CREW', crewId, successRoll: 0.99 }); // roll would fail
    expect(next.crew[crewId].tier).toBe('mythic'); // pity forced it
    expect(next.fusionsSinceMythic).toBe(0); // counter resets on a mythic
    expect(next.lastCrewPromoteEvent?.pity).toBe(true);
  });

  it('mythic-step failures advance the shared pity counter', () => {
    let state = fundCards(createInitialGameState(0), crewId, CREW_PROMOTE_CARD_COST.legendary);
    state = {
      ...state,
      enhanceStones: 999,
      crew: { ...state.crew, [crewId]: { tier: 'legendary', level: 1 } },
      fusionsSinceMythic: 3,
    };
    const next = gameReducer(state, { type: 'PROMOTE_CREW', crewId, successRoll: 0.99 });
    expect(next.crew[crewId].tier).toBe('legendary');
    expect(next.fusionsSinceMythic).toBe(4);
  });

  it('era window: far-stage cards do NOT fund an early crew promotion', () => {
    const farCardId = 's13_07'; // stage 13 ≫ joinStage 1 ± window
    let state = createInitialGameState(0);
    state = {
      ...state,
      enhanceStones: 999,
      cardInventory: { [farCardId]: 999 },
    };
    const next = gameReducer(state, { type: 'PROMOTE_CREW', crewId, successRoll: 0 });
    expect(next.crew[crewId].tier).toBe('common'); // not funded
    expect(next.cardInventory[farCardId]).toBe(999); // untouched
  });
});

describe('OVERHAUL5 crew power (tier view)', () => {
  it('a promoted crew reads its TIER bucket value, not its static rarity value', () => {
    const crewId = S1_CREW[0];
    const entity = findEntityById(crewId)!;
    const view = getCrewTierView(entity, 'epic');
    expect(view.rarity).toBe('epic');
    const bucket = CREW_TIER_BASE_VALUE[entity.effect.type];
    if (bucket) expect(view.effect.value).toBe(bucket.epic);
    // Identity fields untouched (codex/almanac keys, substat seed).
    expect(view.id).toBe(entity.id);
    expect(view.stageId).toBe(entity.stageId);
  });

  it('equipping a joined crew boosts click output vs gearless', () => {
    const clickCrew = CREW_ROSTER.find((c) => {
      const e = findEntityById(c.id);
      return c.joinStage === 1 && e?.effect.type === 'click';
    })!;
    const base = createInitialGameState(0);
    const baseline = gameReducer(base, { type: 'CLICK', now: 1000, randomValue: 1, x: 0, y: 0 });
    const equipped = gameReducer(base, { type: 'EQUIP_ENTITY', entityId: clickCrew.id });
    expect(equipped.equippedSlots).toContain(clickCrew.id);
    const boosted = gameReducer(equipped, { type: 'CLICK', now: 1000, randomValue: 1, x: 0, y: 0 });
    expect(boosted.lastClickEvent?.gained).toBeGreaterThan(baseline.lastClickEvent?.gained ?? 0);
  });

  it('crew survive prestige with tier + level intact', () => {
    const crewId = S1_CREW[0];
    let state = createInitialGameState(0);
    state = {
      ...state,
      crew: { ...state.crew, [crewId]: { tier: 'epic', level: 7 } },
      cardInventory: { s1_04: 5 },
      completedRun: true,
      lastEndingId: 'heat_death',
    };
    const next = gameReducer(state, { type: 'PRESTIGE', now: 1000 });
    expect(next.crew[crewId]).toEqual({ tier: 'epic', level: 7 }); // THE anchor
    expect(next.cardInventory).toEqual({ s1_04: 5 }); // cards carry too
    expect(next.pendingCrewJoinIds).toEqual([]); // no double-greeting
  });
});

describe('OVERHAUL5 crew enhance (강화, card-fueled)', () => {
  const crewId = S1_CREW[0];

  it('guaranteed band: own-entity cards merge into levels', () => {
    let state = createInitialGameState(0);
    state = { ...state, cardInventory: { [crewId]: 3 } }; // need(1) = ENH_DUP_BASE = 3 cards for Lv1→2
    const next = gameReducer(state, { type: 'ENHANCE_ENTITY', instanceId: crewId, useSpecial: false });
    expect(next.crew[crewId].level).toBeGreaterThanOrEqual(2);
    expect(next.cardInventory[crewId]).toBeUndefined(); // fodder consumed
    expect(next.lastEnhanceEvent?.outcome).toBe('up');
  });

  it('a crew enhance fail keeps the level (crew are never destroyed)', () => {
    let state = createInitialGameState(0);
    state = {
      ...state,
      enhanceStones: 999,
      crew: { ...state.crew, [crewId]: { tier: 'epic', level: 5 } }, // risky band
    };
    const next = gameReducer(state, { type: 'ENHANCE_ENTITY', instanceId: crewId, failRoll: 0, useSpecial: false });
    expect(next.crew[crewId].level).toBe(5); // held
    expect(next.crew[crewId]).toBeDefined(); // never destroyed
    expect(next.lastEnhanceEvent?.outcome).toBe('fail');
  });
});

describe('OVERHAUL5 misc', () => {
  it('isCrewId + crewJoiningAtOrBefore behave', () => {
    expect(isCrewId(S1_CREW[0])).toBe(true);
    expect(isCrewId('s10_01')).toBe(false); // Sun is a card, not crew
    expect(crewJoiningAtOrBefore(1).map((c) => c.id)).toEqual(S1_CREW);
    expect(crewJoiningAtOrBefore(16)).toHaveLength(50);
  });
});
