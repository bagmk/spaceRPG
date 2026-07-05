import { describe, expect, it } from 'vitest';
import { gameReducer, createInitialGameState } from '../reducer';
import { CREW_ROSTER, CREW_BY_ID, isCrewId, crewJoiningAtOrBefore, crewFormAt } from '../crew/roster';
import { getCrewTierView } from '../crew/tierView';
import { findEntityById } from '../entities/stageItems';
import {
  CREW_PROMOTE_CARD_COST,
  CREW_PROMOTE_STONE_COST,
  CREW_PROMOTE_MYTHIC_PITY,
  CREW_TIER_BASE_VALUE,
  CREW_TIER_ORDER,
} from '../balance';
import type { GameState } from '../types';

const S1_LINES = CREW_ROSTER.filter((c) => c.joinStage === 1).map((c) => c.id);
const BARYON = 's1_01'; // 바리온 대서사: 양자 요동 → 업 쿼크 → 양성자 → 태양 → 중성자별

function fundCards(state: GameState, crewId: string, count: number): GameState {
  // The line's own T1 entity always sits inside its era window.
  return { ...state, cardInventory: { ...state.cardInventory, [crewId]: count } };
}

describe('OVERHAUL5 v2 evolution roster', () => {
  it('has exactly 12 lines, each with 5 causally-ordered forms', () => {
    expect(CREW_ROSTER).toHaveLength(12);
    expect(new Set(CREW_ROSTER.map((c) => c.id)).size).toBe(12);
    for (const def of CREW_ROSTER) {
      expect(def.forms).toHaveLength(5);
      expect(def.forms[0].entityId).toBe(def.id); // T1 form IS the line id
      // Real forms resolve to real entities; invented forms carry their own names.
      for (const f of def.forms) {
        if (f.entityId) expect(findEntityById(f.entityId), `${def.id}:${f.entityId}`).toBeDefined();
        else { expect(f.nameEn).toBeTruthy(); expect(f.nameKo).toBeTruthy(); }
      }
      // 개연성: form home stages never move BACKWARD in cosmic history.
      for (let i = 1; i < def.forms.length; i++) {
        expect(def.forms[i].stage, `${def.id} form ${i}`).toBeGreaterThanOrEqual(def.forms[i - 1].stage);
      }
      // The T1 form is available the moment the line joins.
      expect(def.forms[0].stage).toBeLessThanOrEqual(def.joinStage);
    }
  });

  it('a fresh game starts with the stage-1 lines joined + their join beats queued', () => {
    const state = createInitialGameState(0);
    for (const id of S1_LINES) expect(state.crew[id]).toEqual({ tier: 'common', level: 1 });
    expect(state.pendingCrewJoinIds).toEqual(S1_LINES);
    const next = gameReducer(state, { type: 'DISMISS_CREW_JOIN' });
    expect(next.pendingCrewJoinIds).toEqual(S1_LINES.slice(1));
  });

  it('isCrewId is line-ids only (a FORM entity like the Sun is not a line)', () => {
    expect(isCrewId(BARYON)).toBe(true);
    expect(isCrewId('s10_01')).toBe(false); // Sun = 바리온 라인의 T4 FORM, not a line id
    expect(crewJoiningAtOrBefore(1).map((c) => c.id)).toEqual(S1_LINES);
    expect(crewJoiningAtOrBefore(16)).toHaveLength(12);
  });
});

describe('OVERHAUL5 v2 evolution altar (진화 제단)', () => {
  it('evolves T1→T2 on a successful roll once the next form era is reached', () => {
    let state = fundCards(createInitialGameState(0), BARYON, CREW_PROMOTE_CARD_COST.common);
    state = { ...state, stageIdx: 1, enhanceStones: CREW_PROMOTE_STONE_COST.common }; // stage 2 = 업 쿼크 era
    const next = gameReducer(state, { type: 'PROMOTE_CREW', crewId: BARYON, successRoll: 0 });
    expect(next.crew[BARYON].tier).toBe('rare');
    expect(next.cardInventory[BARYON]).toBeUndefined();
    expect(next.lastCrewPromoteEvent?.success).toBe(true);
  });

  it('ERA LOCK: the same evolution is refused before the next form home stage', () => {
    let state = fundCards(createInitialGameState(0), BARYON, 999);
    state = { ...state, stageIdx: 0, enhanceStones: 999 }; // stage 1 — 업 쿼크(S2) not yet reached
    const next = gameReducer(state, { type: 'PROMOTE_CREW', crewId: BARYON, successRoll: 0 });
    expect(next.crew[BARYON].tier).toBe('common'); // locked
    expect(next.cardInventory[BARYON]).toBe(999);  // nothing consumed
    expect(next.enhanceStones).toBe(999);
  });

  it('a failed attempt consumes cards, refunds half the stones, the crew is unharmed', () => {
    let state = fundCards(createInitialGameState(0), BARYON, CREW_PROMOTE_CARD_COST.common);
    state = { ...state, stageIdx: 1, enhanceStones: CREW_PROMOTE_STONE_COST.common };
    const next = gameReducer(state, { type: 'PROMOTE_CREW', crewId: BARYON, successRoll: 0.99 });
    expect(next.crew[BARYON].tier).toBe('common');
    expect(next.cardInventory[BARYON]).toBeUndefined();
    expect(next.enhanceStones).toBe(CREW_PROMOTE_STONE_COST.common - Math.ceil(CREW_PROMOTE_STONE_COST.common * 0.5));
    expect(next.lastCrewPromoteEvent?.success).toBe(false);
  });

  it('final step: pity forces the evolution at the shared counter floor and resets it', () => {
    let state = fundCards(createInitialGameState(0), BARYON, CREW_PROMOTE_CARD_COST.legendary);
    state = {
      ...state,
      stageIdx: 11, // stage 12 — 중성자별 era reached
      enhanceStones: 999,
      crew: { ...state.crew, [BARYON]: { tier: 'legendary', level: 1 } },
      fusionsSinceMythic: CREW_PROMOTE_MYTHIC_PITY,
    };
    const next = gameReducer(state, { type: 'PROMOTE_CREW', crewId: BARYON, successRoll: 0.99 });
    expect(next.crew[BARYON].tier).toBe('mythic'); // 중성자별!
    expect(next.fusionsSinceMythic).toBe(0);
    expect(next.lastCrewPromoteEvent?.pity).toBe(true);
  });

  it('final-step failures advance the shared pity counter', () => {
    let state = fundCards(createInitialGameState(0), BARYON, CREW_PROMOTE_CARD_COST.legendary);
    state = {
      ...state,
      stageIdx: 11,
      enhanceStones: 999,
      crew: { ...state.crew, [BARYON]: { tier: 'legendary', level: 1 } },
      fusionsSinceMythic: 3,
    };
    const next = gameReducer(state, { type: 'PROMOTE_CREW', crewId: BARYON, successRoll: 0.99 });
    expect(next.crew[BARYON].tier).toBe('legendary');
    expect(next.fusionsSinceMythic).toBe(4);
  });

  it('era window: far-stage cards do NOT fund an early evolution', () => {
    let state = createInitialGameState(0);
    state = { ...state, stageIdx: 1, enhanceStones: 999, cardInventory: { s13_07: 999 } };
    const next = gameReducer(state, { type: 'PROMOTE_CREW', crewId: BARYON, successRoll: 0 });
    expect(next.crew[BARYON].tier).toBe('common');
    expect(next.cardInventory['s13_07']).toBe(999);
  });
});

describe('OVERHAUL5 v2 evolution identity (tier view)', () => {
  it('the view swaps the DISPLAY identity to the current form (양자 요동 → 태양 → 중성자별)', () => {
    const t1 = findEntityById(BARYON)!;
    expect(getCrewTierView(t1, 'common').name).toBe('Quantum Fluctuation');
    expect(getCrewTierView(t1, 'legendary').name).toBe('Sun');
    expect(getCrewTierView(t1, 'mythic').name).toBe('Neutron Star');
    // Identity KEYS never change — save slots/codex/substat seeds stay stable.
    expect(getCrewTierView(t1, 'mythic').id).toBe(BARYON);
    expect(getCrewTierView(t1, 'mythic').stageId).toBe(t1.stageId);
  });

  it('an INVENTED form (가이아) renders its own name/formula', () => {
    const t1 = findEntityById('s10_04')!; // 얼음과 물 라인
    const v = getCrewTierView(t1, 'mythic');
    expect(v.name).toBe('Gaia');
    expect(v.nameKo).toBe('가이아');
    expect(v.formula).toBe('⊕');
  });

  it('power reads the LINE effect type at the tier bucket (mechanics ≠ display)', () => {
    const def = CREW_BY_ID.get(BARYON)!;
    const t1 = findEntityById(BARYON)!;
    const v = getCrewTierView(t1, 'epic');
    expect(v.effect.type).toBe(def.effectType);
    const bucket = CREW_TIER_BASE_VALUE[def.effectType];
    if (bucket) expect(v.effect.value).toBe(bucket.epic);
  });

  it('equipping a joined line boosts click output vs gearless', () => {
    const base = createInitialGameState(0);
    const baseline = gameReducer(base, { type: 'CLICK', now: 1000, randomValue: 1, x: 0, y: 0 });
    const equipped = gameReducer(base, { type: 'EQUIP_ENTITY', entityId: BARYON });
    expect(equipped.equippedSlots).toContain(BARYON);
    const boosted = gameReducer(equipped, { type: 'CLICK', now: 1000, randomValue: 1, x: 0, y: 0 });
    expect(boosted.lastClickEvent?.gained).toBeGreaterThan(baseline.lastClickEvent?.gained ?? 0);
  });

  it('crew survive prestige with tier + level intact', () => {
    let state = createInitialGameState(0);
    state = {
      ...state,
      crew: { ...state.crew, [BARYON]: { tier: 'epic', level: 7 } },
      cardInventory: { s1_02: 5 },
      completedRun: true,
      lastEndingId: 'heat_death',
    };
    const next = gameReducer(state, { type: 'PRESTIGE', now: 1000 });
    expect(next.crew[BARYON]).toEqual({ tier: 'epic', level: 7 });
    expect(next.cardInventory).toEqual({ s1_02: 5 });
    expect(next.pendingCrewJoinIds).toEqual([]);
  });
});

describe('OVERHAUL5 v2 crew enhance (강화, card-fueled)', () => {
  it('guaranteed band: own-entity cards merge into levels', () => {
    let state = createInitialGameState(0);
    state = { ...state, cardInventory: { [BARYON]: 3 } }; // need(1) = 3 cards for Lv1→2
    const next = gameReducer(state, { type: 'ENHANCE_ENTITY', instanceId: BARYON, useSpecial: false });
    expect(next.crew[BARYON].level).toBeGreaterThanOrEqual(2);
    expect(next.cardInventory[BARYON]).toBeUndefined();
    expect(next.lastEnhanceEvent?.outcome).toBe('up');
  });

  it('a crew enhance fail keeps the level (crew are never destroyed)', () => {
    let state = createInitialGameState(0);
    state = {
      ...state,
      enhanceStones: 999,
      crew: { ...state.crew, [BARYON]: { tier: 'epic', level: 5 } },
    };
    const next = gameReducer(state, { type: 'ENHANCE_ENTITY', instanceId: BARYON, failRoll: 0, useSpecial: false });
    expect(next.crew[BARYON].level).toBe(5);
    expect(next.lastEnhanceEvent?.outcome).toBe('fail');
  });
});

describe('OVERHAUL5 v2 roster reconcile (50-crew v1 saves)', () => {
  it('ADMIN_NEXT_STAGE joins new lines with dialogue beats; stages without lines add none', () => {
    const state = { ...createInitialGameState(0), pendingCrewJoinIds: [] };
    const s2 = gameReducer(state, { type: 'ADMIN_NEXT_STAGE', now: 1000 });
    const stage2Lines = CREW_ROSTER.filter((c) => c.joinStage === 2).map((c) => c.id);
    expect(s2.pendingCrewJoinIds).toEqual(stage2Lines); // 원소 연금술
    const s3 = gameReducer({ ...s2, pendingCrewJoinIds: [] }, { type: 'ADMIN_NEXT_STAGE', now: 2000 });
    expect(s3.pendingCrewJoinIds).toEqual([]); // no line joins at stage 3
  });

  it('CREW_TIER_ORDER + crewFormAt clamp sanely', () => {
    const def = CREW_BY_ID.get(BARYON)!;
    expect(crewFormAt(def, -1).entityId).toBe(BARYON);
    expect(crewFormAt(def, 99).entityId).toBe('s12_09');
    expect(CREW_TIER_ORDER).toHaveLength(5);
  });
});
