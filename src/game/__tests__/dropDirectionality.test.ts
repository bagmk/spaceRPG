import { describe, expect, it } from 'vitest';
import { rollEntityDrop, getBestDropStage } from '../entities/drops';
import { generateDailyShop } from '../shop/daily';
import { findEntityById, STAGE_ENTITIES } from '../entities/stageItems';
import { GACHA_BOXES, RARITY_STAGE_GATES } from '../balance';
import { createInitialGameState, gameReducer } from '../reducer';
import type { GameState } from '../types';

/**
 * The DIRECTIONAL INVARIANT (user-requested, Overhaul-4): early-stage items may drop
 * (and sell, and pull) at LATER stages, but a LATER-stage item must NEVER appear while
 * the player is at an EARLIER stage. This holds structurally because all three
 * acquisition paths route stage selection through pickDropStage(P, …) (≤ P) and then
 * pickEntityByRarity(poolStage) (a single-stage pool). This file pins that so a future
 * affinity/shop change can't silently break it.
 */
const MAX_STAGE = Math.max(...STAGE_ENTITIES.map((e) => e.stageId));
const STEPS = 25;

describe('directional invariant — nothing from a future stage leaks early', () => {
  it('DROP: every rolled entity has 1 ≤ stageId ≤ playerStage (never a future stage)', () => {
    for (let P = 1; P <= MAX_STAGE; P++) {
      for (let i = 0; i < STEPS; i++) {
        for (let j = 0; j < STEPS; j++) {
          const e = rollEntityDrop(P, 1, { roll: 0, pickRoll: i / STEPS, stageRoll: j / STEPS });
          if (!e) continue;
          expect(e.stageId).toBeGreaterThanOrEqual(1);
          expect(e.stageId).toBeLessThanOrEqual(P);
        }
      }
    }
  });

  it('SHOP (daily): every offered entity is from a stage ≤ playerStage', () => {
    for (let P = 1; P <= MAX_STAGE; P++) {
      for (let rc = 0; rc < 4; rc++) {
        const offers = generateDailyShop(`2026-06-${10 + (P % 18)}`, rc, P);
        for (const o of offers) {
          const e = findEntityById(o.entityId);
          expect(e, `offer ${o.entityId} resolves`).toBeTruthy();
          expect(e!.stageId).toBeLessThanOrEqual(P);
        }
      }
    }
  });

  it('GACHA: every pulled entity is from a stage ≤ playerStage', () => {
    for (const P of [3, 6, 10, 14]) {
      const base = createInitialGameState(0);
      const state: GameState = { ...base, stageIdx: P - 1, quanta: 1e15 };
      const boxId = GACHA_BOXES[GACHA_BOXES.length - 1].id; // richest odds → most rarity spread
      for (let i = 0; i < 20; i++) {
        const rolls = Array.from({ length: 5 }, (_, k) => ({
          rarityRoll: ((i * 5 + k) % STEPS) / STEPS,
          stageRoll: ((i * 7 + k) % STEPS) / STEPS,
          pickRoll: ((i * 11 + k) % STEPS) / STEPS,
          q1: 0.5,
          q2: 0.5,
        }));
        const next = gameReducer(state, { type: 'OPEN_GACHA_BOX', boxId, rolls, stoneRoll: 0.5 });
        for (const inst of next.inventory) {
          const e = findEntityById(inst.entityId);
          if (e) expect(e.stageId).toBeLessThanOrEqual(P);
        }
      }
    }
  });

  it('BACKWARD-REACH: a stage-1 entity is still reachable as a drop at the final stage', () => {
    let reached = false;
    for (let j = 0; j < 200 && !reached; j++) {
      for (let i = 0; i < STEPS && !reached; i++) {
        const e = rollEntityDrop(MAX_STAGE, 1, { roll: 0, pickRoll: i / STEPS, stageRoll: j / 200 });
        if (e && e.stageId === 1) reached = true;
      }
    }
    expect(reached, 'early items must still backfill at late stages').toBe(true);
  });

  it('no roster entity is authored beyond the max stage (no S17+ to leak)', () => {
    for (const e of STAGE_ENTITIES) {
      expect(e.stageId).toBeGreaterThanOrEqual(1);
      expect(e.stageId).toBeLessThanOrEqual(MAX_STAGE);
    }
  });
});

describe('getBestDropStage — codex "best drop S{n}" badge source', () => {
  it('is max(home stage, rarity gate) when field-droppable, null when never (mythic)', () => {
    for (const e of STAGE_ENTITIES) {
      const best = getBestDropStage(e);
      const gate = RARITY_STAGE_GATES[e.rarity] ?? 1;
      const want = Math.max(e.stageId, gate);
      if (want > MAX_STAGE) {
        expect(best).toBeNull(); // never field-drops (gate sentinel) → no drop stage
      } else {
        expect(best).toBe(want);
        expect(best).toBeGreaterThanOrEqual(e.stageId); // never earlier than home
        expect(best).toBeGreaterThanOrEqual(gate);      // never before its rarity gate
        expect(best!).toBeLessThanOrEqual(MAX_STAGE);
      }
    }
  });

  it('pushes gated early-born high rarities to their gate (best ≠ home for the gated set)', () => {
    const gated = STAGE_ENTITIES.filter((e) => { const b = getBestDropStage(e); return b !== null && b > e.stageId; });
    // every such entity is a rarity whose gate sits past its home stage
    for (const e of gated) expect(RARITY_STAGE_GATES[e.rarity]).toBeGreaterThan(e.stageId);
    // a best-≠-home set must exist (the badge would be pointless otherwise)
    expect(gated.length).toBeGreaterThan(0);
  });

  it('mythic entities never field-drop → getBestDropStage is null', () => {
    const mythics = STAGE_ENTITIES.filter((e) => e.rarity === 'mythic');
    for (const e of mythics) expect(getBestDropStage(e)).toBeNull();
  });
});
