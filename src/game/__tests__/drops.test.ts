import { describe, expect, it } from 'vitest';
import {
  addToAlmanac,
  addToInventory,
  getClickDropChance,
  getCollisionDropChance,
  rollEntityDrop,
} from '../entities/drops';
import {
  DROP_CHANCE_BASE,
  DROP_CHANCE_COLLISION,
  DROP_CHANCE_CRIT_MULT,
} from '../balance';
import { getEntitiesForStage } from '../entities/stageItems';
import { gameReducer, createInitialGameState } from '../reducer';

describe('entity drops', () => {
  it('drops nothing when the roll misses the chance window', () => {
    const result = rollEntityDrop(1, getClickDropChance(false), { roll: 0.99, pickRoll: 0.5 });
    expect(result).toBeNull();
  });

  it('drops a stage entity when the roll hits', () => {
    const result = rollEntityDrop(1, getClickDropChance(false), { roll: 0, pickRoll: 0.1 });
    expect(result).not.toBeNull();
    expect(result?.stageId).toBe(1);
  });

  it('crit raises the drop chance', () => {
    expect(getClickDropChance(true)).toBeCloseTo(DROP_CHANCE_BASE * DROP_CHANCE_CRIT_MULT);
    expect(getCollisionDropChance()).toBe(DROP_CHANCE_COLLISION);
  });

  it('falls back down the rarity ladder when the stage pool lacks a rarity', () => {
    // pickRoll near 1 lands on legendary in the weight table; every stage
    // must still return something owned by that stage.
    for (let stageId = 1; stageId <= 16; stageId++) {
      const result = rollEntityDrop(stageId, 1, { roll: 0, pickRoll: 0.9999 });
      expect(result).not.toBeNull();
      expect(result?.stageId).toBe(stageId);
    }
  });

  it('addToInventory stacks counts and starts new stacks at level 1', () => {
    const inv1 = addToInventory([], 'e1');
    expect(inv1).toEqual([{ entityId: 'e1', count: 1, level: 1 }]);
    const inv2 = addToInventory(inv1, 'e1');
    expect(inv2).toEqual([{ entityId: 'e1', count: 2, level: 1 }]);
  });

  it('addToAlmanac is idempotent per entity', () => {
    const a1 = addToAlmanac({}, 1, 'e1');
    const a2 = addToAlmanac(a1, 1, 'e1');
    expect(a2[1]).toEqual(['e1']);
    const a3 = addToAlmanac(a2, 1, 'e2');
    expect(a3[1]).toEqual(['e1', 'e2']);
  });

  it('CLICK with a hitting drop roll fills inventory and almanac', () => {
    const state = createInitialGameState(0);
    const next = gameReducer(state, {
      type: 'CLICK',
      now: 1000,
      randomValue: 1, // no crit
      x: 0,
      y: 0,
      dropRoll: 0,
      dropPickRoll: 0.1,
    });
    expect(next.inventory.length).toBe(1);
    const dropped = next.inventory[0];
    expect(next.almanacCollected[1]).toContain(dropped.entityId);
    expect(next.lastClickEvent?.droppedEntityId).toBe(dropped.entityId);
  });

  it('CLICK without drop rolls never drops (test/mechanic clicks)', () => {
    const state = createInitialGameState(0);
    const next = gameReducer(state, {
      type: 'CLICK',
      now: 1000,
      randomValue: 1,
      x: 0,
      y: 0,
    });
    expect(next.inventory).toEqual([]);
  });

  it('PURCHASE_ENTITY records the entity in the almanac', () => {
    const entity = getEntitiesForStage(1)[0];
    const state = { ...createInitialGameState(0), quanta: 1e12 };
    const next = gameReducer(state, { type: 'PURCHASE_ENTITY', entityId: entity.id });
    expect(next.inventory.find((e) => e.entityId === entity.id)?.count).toBe(1);
    expect(next.almanacCollected[entity.stageId]).toContain(entity.id);
  });

  it('PRESTIGE preserves the almanac and carries the best gear (D2, Phase 4-3)', () => {
    const entity = getEntitiesForStage(1)[0];
    const state = {
      ...createInitialGameState(0),
      inventory: [{ entityId: entity.id, count: 2, level: 1 }],
      almanacCollected: { 1: [entity.id] },
    };
    const next = gameReducer(state, { type: 'PRESTIGE', now: 1000 });
    // Almanac survives; the best item of its category carries (power stripped),
    // equip slots reset.
    expect(next.almanacCollected[1]).toContain(entity.id);
    expect(next.inventory.some((e) => e.carried === true)).toBe(true);
    expect(next.equippedSlots).toEqual([]);
  });
});
