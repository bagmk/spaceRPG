import { describe, expect, it } from 'vitest';
import {
  addToAlmanac,
  addToInventory,
  getClickDropChance,
  getCollisionDropChance,
  getBaseRarityDropShare,
  getEntityDropShare,
  isNewDiscovery,
  rollEntityDrop,
} from '../entities/drops';
import {
  DROP_CHANCE_BASE,
  DROP_CHANCE_COLLISION,
  DROP_CHANCE_CRIT_MULT,
} from '../balance';
import { getEntitiesForStage, STAGE_ENTITIES } from '../entities/stageItems';
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

  it('P6 flat: addToInventory adds a separate level-1 copy with its own instanceId', () => {
    const inv1 = addToInventory([], 'e1');
    expect(inv1).toHaveLength(1);
    expect(inv1[0]).toMatchObject({ entityId: 'e1', count: 1, level: 1 });
    expect(inv1[0].instanceId).toBeTruthy();
    const inv2 = addToInventory(inv1, 'e1');
    expect(inv2).toHaveLength(2);
    expect(inv2.every((e) => e.entityId === 'e1' && e.count === 1 && e.level === 1)).toBe(true);
    expect(new Set(inv2.map((e) => e.instanceId)).size).toBe(2); // distinct copies
  });

  // Overhaul-4 P1: copy-mint / grant must be UNCAPPED. maxCount (legendary/mythic = 1)
  // gates only the buy-for-collection path (handlePurchaseEntity); the duplicate-
  // collection enhance + its matter/강화석 copy-token mint route through addToInventory,
  // which must keep granting copies past maxCount so high-rarity leveling is possible.
  it('P1: addToInventory grants copies of a maxCount=1 legendary beyond its cap (mint is uncapped)', () => {
    const legendary = STAGE_ENTITIES.find((e) => e.rarity === 'legendary' && e.maxCount === 1);
    expect(legendary, 'a maxCount=1 legendary exists').toBeTruthy();
    let inv = addToInventory([], legendary!.id);
    inv = addToInventory(inv, legendary!.id);
    inv = addToInventory(inv, legendary!.id);
    const copies = inv.filter((e) => e.entityId === legendary!.id);
    expect(copies).toHaveLength(3); // 3 copies despite maxCount 1
    expect(new Set(copies.map((e) => e.instanceId)).size).toBe(3);
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

  it('isNewDiscovery mirrors addToAlmanac (true only when the id is not yet collected)', () => {
    expect(isNewDiscovery({}, 1, 'e1')).toBe(true);
    expect(isNewDiscovery({ 1: ['e1'] }, 1, 'e1')).toBe(false);
    expect(isNewDiscovery({ 1: ['e1'] }, 1, 'e2')).toBe(true);
    expect(isNewDiscovery({ 1: ['e1'] }, 2, 'e1')).toBe(true); // stage-scoped
  });

  it('persona #10: a NEW-discovery drop fires lastDropEvent; CLEAR_DROP_EVENT clears it', () => {
    const state = createInitialGameState(0);
    const next = gameReducer(state, {
      type: 'CLICK', now: 1000, randomValue: 1, x: 0, y: 0, dropRoll: 0, dropPickRoll: 0.1,
    });
    const dropped = next.inventory[0];
    expect(next.lastDropEvent).not.toBeNull();
    expect(next.lastDropEvent?.entityId).toBe(dropped.entityId);
    expect(next.lastDropEvent?.stageId).toBe(1);
    expect(next.lastDropEvent?.rarity).toBeTruthy();
    // The CLEAR action keyed by the event id removes it (mirrors CLEAR_GACHA_EVENT).
    const cleared = gameReducer(next, { type: 'CLEAR_DROP_EVENT', id: next.lastDropEvent!.id });
    expect(cleared.lastDropEvent).toBeNull();
    // A stale id is a no-op.
    const stale = gameReducer(next, { type: 'CLEAR_DROP_EVENT', id: next.lastDropEvent!.id + 999 });
    expect(stale.lastDropEvent).not.toBeNull();
  });

  it('persona #10: a REPEAT drop (already in the almanac) does NOT fire lastDropEvent', () => {
    const first = gameReducer(createInitialGameState(0), {
      type: 'CLICK', now: 1000, randomValue: 1, x: 0, y: 0, dropRoll: 0, dropPickRoll: 0.1,
    });
    // Same deterministic roll → same entity, now already collected → no new reveal.
    const second = gameReducer({ ...first, lastDropEvent: null }, {
      type: 'CLICK', now: 2000, randomValue: 1, x: 0, y: 0, dropRoll: 0, dropPickRoll: 0.1,
    });
    expect(second.inventory.length).toBe(2); // a second copy still drops
    expect(second.lastDropEvent).toBeNull(); // but no NEW-discovery reveal
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

  it('PRESTIGE preserves the almanac (bonuses) but RESETS the inventory (S, 2026-06-24)', () => {
    const entity = getEntitiesForStage(1)[0];
    const state = {
      ...createInitialGameState(0),
      inventory: [{ entityId: entity.id, count: 2, level: 1 }],
      almanacCollected: { 1: [entity.id] },
    };
    const next = gameReducer(state, { type: 'PRESTIGE', now: 1000 });
    // Almanac/codex bonuses survive ("들고가는 건 보너스만"); the INVENTORY resets — items
    // do NOT carry across the big bang, nothing is flagged `carried`.
    expect(next.almanacCollected[1]).toContain(entity.id);
    expect(next.inventory.every((e) => !e.carried)).toBe(true);
    expect(next.inventory.some((e) => e.entityId === entity.id)).toBe(false);
    expect(next.equippedSlots).toEqual([]);
  });
});

describe('codex drop-rate display (R6)', () => {
  it('base rarity share is normalized, descending, and zero for mythic', () => {
    const share = getBaseRarityDropShare();
    const sum = share.common + share.rare + share.epic + share.legendary + share.mythic;
    expect(sum).toBeCloseTo(1, 6);
    expect(share.common).toBeGreaterThan(share.rare);
    expect(share.rare).toBeGreaterThan(share.epic);
    expect(share.epic).toBeGreaterThan(share.legendary);
    expect(share.mythic).toBe(0);
  });

  it('per-entity share = rarity share ÷ same-rarity count on its stage', () => {
    const stage = 4; // 10C:5R:4E:2L after P3 padding
    const share = getBaseRarityDropShare();
    const common = getEntitiesForStage(stage).find((e) => e.rarity === 'common')!;
    const legendary = getEntitiesForStage(stage).find((e) => e.rarity === 'legendary')!;
    expect(getEntityDropShare(common)).toBeCloseTo(share.common / 10, 6);
    expect(getEntityDropShare(legendary)).toBeCloseTo(share.legendary / 2, 6);
    // Rarer tiers yield a strictly smaller per-card chance.
    expect(getEntityDropShare(common)).toBeGreaterThan(getEntityDropShare(legendary));
  });

  it('mythic entities never drop (per-card share 0)', () => {
    const mythic = getEntitiesForStage(17)[0];
    expect(mythic.rarity).toBe('mythic');
    expect(getEntityDropShare(mythic)).toBe(0);
  });
});
