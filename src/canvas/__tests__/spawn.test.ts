import { describe, expect, it } from 'vitest';
import {
  addMoteToCluster,
  createBaseMote,
  createBurstSet,
  createCurvedFlyer,
  createShockwave,
  enrichExistingMote,
  pickRogueType,
  pickStageColor,
  spawnAutoMote,
  spawnMotesAtClick,
} from '../spawn';
import { createMoteCluster } from '../world';
import { STAGES } from '../../game/stages';
import { ROGUE_TYPES, TUNING } from '../../game/constants';

const stage = STAGES[0];

describe('pickRogueType', () => {
  it('always returns a valid rogue key', () => {
    const valid = new Set(Object.keys(ROGUE_TYPES));
    for (let i = 0; i < 200; i += 1) {
      expect(valid.has(pickRogueType())).toBe(true);
    }
  });
});

describe('pickStageColor', () => {
  it('returns a color from the stage palette or the accent fallback', () => {
    for (let i = 0; i < 20; i += 1) {
      const c = pickStageColor(stage);
      expect([...stage.particleColors, stage.accent]).toContain(c);
    }
  });
});

describe('createShockwave', () => {
  it('captures all optional knobs', () => {
    const sw = createShockwave('#abc', 10, 20, 100, 500, 2);
    expect(sw.color).toBe('#abc');
    expect(sw.x).toBe(10);
    expect(sw.y).toBe(20);
    expect(sw.maxRadius).toBe(100);
    expect(sw.lifeMs).toBe(500);
    expect(sw.lineWidth).toBe(2);
    expect(typeof sw.startedAt).toBe('number');
  });
});

describe('createBurstSet', () => {
  it('returns exactly `count` bursts with non-zero velocities', () => {
    const bs = createBurstSet(0, 0, 12, '#fff', 4);
    expect(bs.length).toBe(12);
    bs.forEach((b) => expect(Math.hypot(b.vx, b.vy)).toBeGreaterThan(0));
  });
});

describe('createCurvedFlyer', () => {
  it('starts at the origin and has a control point off the straight line', () => {
    const f = createCurvedFlyer(0, 0, 100, 0, true, 3);
    expect(f.x).toBe(0);
    expect(f.y).toBe(0);
    expect(f.targetX).toBe(100);
    expect(f.targetY).toBe(0);
    expect(f.auto).toBe(true);
    expect(f.spriteId).toBe(3);
    expect(Math.abs(f.controlY)).toBeGreaterThan(0); // bowed off the line
  });
});

describe('createBaseMote', () => {
  it('assigns a fresh id and advances nextMoteId', () => {
    const c = createMoteCluster();
    const m1 = createBaseMote(c, stage, 0, 0, 0, 0, 0);
    const m2 = createBaseMote(c, stage, 0, 0, 0, 0, 0);
    expect(m1.id).toBe(1);
    expect(m2.id).toBe(2);
    expect(c.nextMoteId).toBe(3);
  });
});

describe('addMoteToCluster', () => {
  it('appends until MOTE_MAX then enriches', () => {
    const c = createMoteCluster();
    for (let i = 0; i < TUNING.MOTE_MAX; i += 1) {
      addMoteToCluster(c, stage, createBaseMote(c, stage, i, 0, 0, 0, 0), 1000);
    }
    expect(c.motes.length).toBe(TUNING.MOTE_MAX);
    const lengthBefore = c.motes.length;
    addMoteToCluster(c, stage, createBaseMote(c, stage, 999, 999, 0, 0, 0), 1000);
    expect(c.motes.length).toBe(lengthBefore); // didn't grow — enriched
  });
});

describe('enrichExistingMote', () => {
  it('seeds first mote when cluster is empty', () => {
    const c = createMoteCluster();
    const m = createBaseMote(c, stage, 5, 6, 0, 0, 0);
    enrichExistingMote(c, stage, m, 1000);
    expect(c.motes.length).toBe(1);
    expect(c.motes[0].x).toBe(5);
  });
  it('caps merged mass at maxMassCap', () => {
    const c = createMoteCluster();
    const seed = createBaseMote(c, stage, 0, 0, 0, 0, 0);
    seed.mass = 50;
    c.motes.push(seed);
    const incoming = createBaseMote(c, stage, 1, 1, 0, 0, 0);
    incoming.mass = 500;
    enrichExistingMote(c, stage, incoming, 100);
    expect(c.motes[0].mass).toBeLessThanOrEqual(100);
  });
});

describe('spawnMotesAtClick (non-special clusterMode)', () => {
  it('adds at least 1 mote per click on inflation stage', () => {
    const c = createMoteCluster();
    spawnMotesAtClick(c, stage, 100, 100, 200, 200, 400, 400, false, 1, 100, 0);
    expect(c.motes.length).toBeGreaterThan(0);
  });
});

describe('spawnAutoMote', () => {
  it('adds 1 mote per call on default cluster mode', () => {
    const c = createMoteCluster();
    spawnAutoMote(c, stage, 200, 200, 100, 0);
    expect(c.motes.length).toBe(1);
  });
});
