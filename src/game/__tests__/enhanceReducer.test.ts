import { describe, expect, it } from 'vitest';
import { gameReducer, createInitialGameState } from '../reducer';
import { getEntitiesForStage } from '../entities/stageItems';
import { applyEntityModifiers } from '../entities/effects';
import { defaultModifiers } from '../skills/effects';
import type { GameState } from '../types';

const stage1 = getEntitiesForStage(1);
const clickEntity = stage1.find((e) => e.effect.type === 'click')!;

/**
 * Regression for the "강화해도 숫자가 안 바뀜" report (2026-06-28). The user saw the
 * enhance LEVEL rise (Lv.2 → Lv.3) while the popup % stayed at the Lv.2 value. The
 * detail card reads the live equipped copy by instanceId and multiplies the shown %
 * by getLevelMult(level), so a frozen chip can only happen if the enhanced level is
 * NOT written back to that copy. These pin that it IS:
 *   • the targeted instanceId levels up IN PLACE (same copy, not a spare),
 *   • lastEnhanceEvent.level === the new inventory level (no "event says 3, copy stays 2"),
 *   • the leveled copy yields a strictly stronger applied effect (the display's source).
 * If all pass, a still-frozen chip on device is a stale client build, not a logic bug.
 */
describe('ENHANCE_ENTITY — the targeted copy levels up in place (P6)', () => {
  it('stone path (Lv2→3, forced success): the SAME instanceId rises; event matches inventory', () => {
    const state: GameState = {
      ...createInitialGameState(0),
      enhanceStones: 9999,
      inventory: [{ entityId: clickEntity.id, instanceId: 'eq', count: 1, level: 2 }],
    };
    const next = gameReducer(state, {
      type: 'ENHANCE_ENTITY',
      instanceId: 'eq',
      useSpecial: false, // force the 강화석 path even with no spares
      failRoll: 0.99, // >= fail chance → guaranteed success
    });
    const eq = next.inventory.find((e) => e.instanceId === 'eq');
    expect(eq?.level).toBe(3); // leveled IN PLACE
    expect(eq?.instanceId).toBe('eq'); // still the same copy the slot points to
    expect(next.lastEnhanceEvent?.outcome).toBe('up');
    expect(next.lastEnhanceEvent?.prevLevel).toBe(2);
    expect(next.lastEnhanceEvent?.level).toBe(3); // event AGREES with the inventory copy
  });

  it('copy path (Lv2→3, forced success): consumes the spares and levels the anchor copy', () => {
    const state: GameState = {
      ...createInitialGameState(0),
      inventory: [
        { entityId: clickEntity.id, instanceId: 'eq', count: 1, level: 2 },
        { entityId: clickEntity.id, instanceId: 's1', count: 1, level: 1 },
        { entityId: clickEntity.id, instanceId: 's2', count: 1, level: 1 },
        { entityId: clickEntity.id, instanceId: 's3', count: 1, level: 1 },
      ],
    };
    const next = gameReducer(state, { type: 'ENHANCE_ENTITY', instanceId: 'eq', failRoll: 0.99 });
    const eq = next.inventory.find((e) => e.instanceId === 'eq');
    expect(eq?.level).toBe(3);
    // the 3 spare copies were consumed as fodder → only the anchor remains
    expect(next.inventory.filter((e) => e.entityId === clickEntity.id)).toHaveLength(1);
  });

  it('legacy entityId slot: enhance levels the FIRST owned copy — the one the card shows — not the highest-level one', () => {
    // The frozen-chip bug: when a slot still holds an entityId (legacy/unmigrated), the
    // detail card + live modifiers both resolve it to the FIRST owned copy, but the
    // enhance fallback used to pick the HIGHEST-level copy → it leveled a copy the card
    // never displays, so the shown % stayed frozen while the event reported a higher level.
    const state: GameState = {
      ...createInitialGameState(0),
      enhanceStones: 9999,
      inventory: [
        { entityId: clickEntity.id, instanceId: 'shown', count: 1, level: 2 }, // first → displayed
        { entityId: clickEntity.id, instanceId: 'strong', count: 1, level: 5 }, // highest level
      ],
      equippedSlots: [clickEntity.id], // legacy: slot holds the ENTITY id, not an instanceId
    };
    const next = gameReducer(state, {
      type: 'ENHANCE_ENTITY',
      instanceId: clickEntity.id, // the slot value (an entityId) is what the button passes
      useSpecial: false,
      failRoll: 0.99,
    });
    expect(next.inventory.find((e) => e.instanceId === 'shown')?.level).toBe(3); // the displayed copy leveled
    expect(next.inventory.find((e) => e.instanceId === 'strong')?.level).toBe(5); // highest-level copy untouched
  });

  it('the leveled copy yields a strictly stronger applied effect (the value the UI shows)', () => {
    const lv2 = defaultModifiers();
    const lv3 = defaultModifiers();
    applyEntityModifiers(lv2, [{ entityId: clickEntity.id, count: 1, level: 2 }], { stageId: 1, gateProgress01: 0 });
    applyEntityModifiers(lv3, [{ entityId: clickEntity.id, count: 1, level: 3 }], { stageId: 1, gateProgress01: 0 });
    expect(lv3.clickPowerMult).toBeGreaterThan(lv2.clickPowerMult);
  });
});
