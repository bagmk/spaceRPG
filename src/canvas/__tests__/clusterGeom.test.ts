import { describe, expect, it } from 'vitest';
import {
  capWorldCollections,
  getBlackHoleRadius,
  getClusterTargetRadius,
  getCosmicStageProgress,
  getEffectiveMaxMass,
  getHawkingPhotonColor,
  getMoteRadius,
} from '../clusterGeom';
import { createWorld } from '../world';
import { STAGES } from '../../game/stages';
import { TUNING } from '../../game/constants';

describe('getMoteRadius', () => {
  it('monotonically increases with mass', () => {
    const r1 = getMoteRadius(1);
    const r5 = getMoteRadius(5);
    const r25 = getMoteRadius(25);
    expect(r5).toBeGreaterThan(r1);
    expect(r25).toBeGreaterThan(r5);
  });
  it('uses base radius at mass=0', () => {
    expect(getMoteRadius(0)).toBe(TUNING.MOTE_BASE_RADIUS);
  });
});

describe('getEffectiveMaxMass', () => {
  it('returns 12 at progress 0', () => {
    expect(getEffectiveMaxMass(0)).toBe(12);
  });
  it('returns 112 at progress 1', () => {
    expect(getEffectiveMaxMass(1)).toBe(112);
  });
});

describe('getCosmicStageProgress', () => {
  it('returns 0 when clock is at or before stage start', () => {
    expect(getCosmicStageProgress(STAGES[0], 0)).toBe(0);
  });
  it('returns 1 when clock is at stage end', () => {
    const stage = STAGES[2]; // QGP
    expect(getCosmicStageProgress(stage, stage.cosmicTimeSec)).toBe(1);
  });
  it('returns intermediate value between bounds', () => {
    const stage = STAGES[2];
    const prev = STAGES[1].cosmicTimeSec;
    const mid = Math.sqrt(prev * stage.cosmicTimeSec); // log midpoint
    const p = getCosmicStageProgress(stage, mid);
    expect(p).toBeGreaterThan(0.4);
    expect(p).toBeLessThan(0.6);
  });
});

describe('getClusterTargetRadius', () => {
  it('respects clusterMode-specific caps', () => {
    const stage = STAGES[0]; // inflation
    const r = getClusterTargetRadius(stage, 10000, 1);
    expect(r).toBeLessThanOrEqual(TUNING.MOTE_CLUSTER_MAX_RADIUS);
  });
});

describe('getBlackHoleRadius', () => {
  it('shrinks as progress approaches 1', () => {
    const big = getBlackHoleRadius(800, 600, 0);
    const small = getBlackHoleRadius(800, 600, 0.99);
    expect(small).toBeLessThan(big);
  });
});

describe('getHawkingPhotonColor', () => {
  it('returns distinct colors per progress bucket', () => {
    expect(getHawkingPhotonColor(0.1)).toBe('#bba3ff');
    expect(getHawkingPhotonColor(0.6)).toBe('#ffd8a0');
    expect(getHawkingPhotonColor(0.9)).toBe('#fff7db');
  });
});

describe('capWorldCollections', () => {
  it('caps bursts/flyers/wakeTrails/shockwaves to TUNING max', () => {
    const w = createWorld(800, 600, STAGES[0]);
    w.bursts = Array.from({ length: TUNING.BURST_MAX + 50 }, () => ({
      x: 0, y: 0, vx: 0, vy: 0, turn: 0, r: 1, life: 1, color: '#fff',
    }));
    capWorldCollections(w);
    expect(w.bursts.length).toBe(TUNING.BURST_MAX);
  });
});
