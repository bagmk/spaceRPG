import { describe, expect, it } from 'vitest';
import { gameReducer, createInitialGameState } from '../reducer';
import { getEntitiesForStage } from '../entities/stageItems';
import { isCrewId } from '../crew/roster';
import { getEquipCategory, getEquippedInstances } from '../entities/effects';
import { getEntityCost } from '../entities/types';

function ownedState(entityId: string, count = 1) {
  return {
    ...createInitialGameState(0),
    inventory: [{ entityId, count, level: 1 }],
  };
}

describe('equip system (Phase 2)', () => {
  // Click-category entity — auto/time entities route to the rift slots instead.
  const entity = getEntitiesForStage(1).find((e) => getEquipCategory(e) === 'click')!;
  const riftEntity = getEntitiesForStage(1).find((e) => getEquipCategory(e) === 'rift')!;

  it('equips an owned entity into slot 0', () => {
    const next = gameReducer(ownedState(entity.id), { type: 'EQUIP_ENTITY', entityId: entity.id });
    expect(next.equippedSlots).toEqual([entity.id]);
  });

  it('rejects equipping an unowned entity', () => {
    // OVERHAUL5: stage-1 clicks are mostly JOINED starter crew (equippable by id),
    // so the unowned-reject case needs a NON-crew, un-joined entity.
    const nonCrew = getEntitiesForStage(10).find((e) => getEquipCategory(e) === 'click' && !isCrewId(e.id))!;
    const state = createInitialGameState(0);
    const next = gameReducer(state, { type: 'EQUIP_ENTITY', entityId: nonCrew.id });
    expect(next.equippedSlots).toEqual([]);
  });

  it('rejects equipping into a locked slot', () => {
    const state = ownedState(entity.id); // unlockedSlotCount = 1
    const next = gameReducer(state, { type: 'EQUIP_ENTITY', entityId: entity.id, slot: 1 });
    expect(next.equippedSlots).toEqual([]);
  });

  it('replaces the occupant when equipping into an occupied slot', () => {
    const other = getEntitiesForStage(1).filter((e) => getEquipCategory(e) === 'click')[1];
    const state = {
      ...createInitialGameState(0),
      inventory: [
        { entityId: entity.id, count: 1, level: 1 },
        { entityId: other.id, count: 1, level: 1 },
      ],
      equippedSlots: [entity.id],
    };
    const next = gameReducer(state, { type: 'EQUIP_ENTITY', entityId: other.id, slot: 0 });
    expect(next.equippedSlots).toEqual([other.id]);
  });

  it('unequips a slot', () => {
    const state = { ...ownedState(entity.id), equippedSlots: [entity.id] };
    const next = gameReducer(state, { type: 'UNEQUIP_ENTITY', slot: 0 });
    expect(next.equippedSlots).toEqual([]);
  });

  it('getEquippedInstances resolves slots to inventory stacks and drops stale ids', () => {
    const inventory = [{ entityId: entity.id, count: 3, level: 1 }];
    expect(getEquippedInstances(inventory, [entity.id])).toEqual(inventory);
    expect(getEquippedInstances(inventory, ['nonexistent_id'])).toEqual([]);
    expect(getEquippedInstances([], [entity.id])).toEqual([]);
    expect(getEquippedInstances(inventory, [''])).toEqual([]);
  });

  it('PRESTIGE resets equipped slots with the run', () => {
    const state = { ...ownedState(entity.id), equippedSlots: [entity.id] };
    const next = gameReducer(state, { type: 'PRESTIGE', now: 1000 });
    expect(next.equippedSlots).toEqual([]);
  });

  // #44 hexagon center / wild slot
  it('blocks the wild slot before its unlock stage, allows it after', () => {
    const early = ownedState(entity.id); // stage 1 (stageIdx 0)
    expect(gameReducer(early, { type: 'EQUIP_ENTITY', entityId: entity.id, wild: true }).wildSlot).toBe('');
    const late = { ...ownedState(entity.id), stageIdx: 8 }; // stage 9 = HEX_WILD_UNLOCK_STAGE
    const eq = gameReducer(late, { type: 'EQUIP_ENTITY', entityId: entity.id, wild: true });
    expect(eq.wildSlot).toBe(entity.id);
    expect(gameReducer(eq, { type: 'UNEQUIP_ENTITY', slot: 0, target: 'wild' }).wildSlot).toBe('');
  });

  it('the wild slot cannot duplicate an id already in a click/rift slot', () => {
    const state = { ...ownedState(entity.id), stageIdx: 8, equippedSlots: [entity.id] };
    expect(gameReducer(state, { type: 'EQUIP_ENTITY', entityId: entity.id, wild: true }).wildSlot).toBe('');
  });

  it('routes auto/time entities to the rift slots automatically', () => {
    const state = ownedState(riftEntity.id);
    const next = gameReducer(state, { type: 'EQUIP_ENTITY', entityId: riftEntity.id });
    expect(next.riftSlots).toEqual([riftEntity.id]);
    expect(next.equippedSlots).toEqual([]);

    const unequipped = gameReducer(next, { type: 'UNEQUIP_ENTITY', slot: 0, target: 'rift' });
    expect(unequipped.riftSlots).toEqual([]);
  });

  it('rift gear effects apply through the combined equipped instances', () => {
    const state = {
      ...ownedState(riftEntity.id),
      riftSlots: [riftEntity.id],
    };
    const combined = getEquippedInstances(state.inventory, [...state.equippedSlots, ...state.riftSlots]);
    expect(combined).toEqual(state.inventory);
  });

  it('equip changes click output for a click-type entity (CHECKPOINT)', () => {
    const clickEntity = getEntitiesForStage(1).find((c) => c.effect.type === 'click');
    expect(clickEntity).toBeDefined();
    if (!clickEntity) return;

    const funded = { ...createInitialGameState(0), quanta: getEntityCost(clickEntity, 0, 1) * 10 };
    const purchased = gameReducer(funded, { type: 'PURCHASE_ENTITY', entityId: clickEntity.id });
    const equipped = gameReducer(purchased, { type: 'EQUIP_ENTITY', entityId: clickEntity.id });

    const click = (s: typeof equipped) =>
      gameReducer(s, { type: 'CLICK', now: 1000, randomValue: 1, x: 0, y: 0 }).lastClickEvent?.gained ?? 0;

    expect(click(equipped)).toBeGreaterThan(click(purchased));
  });
});
