import { describe, expect, it } from 'vitest';
import {
  createMoteCluster,
  createParticles,
  createStars,
  createWorld,
  randomBetween,
  resetForStage,
  spawnParticleAtEdge,
} from '../world';
import { STAGES } from '../../game/stages';
import { TUNING } from '../../game/constants';

const stage = STAGES[0];

describe('randomBetween', () => {
  it('returns a value within [min, max]', () => {
    for (let i = 0; i < 50; i += 1) {
      const v = randomBetween(2, 5);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(5);
    }
  });
  it('handles equal bounds', () => {
    expect(randomBetween(3, 3)).toBe(3);
  });
});

describe('createMoteCluster', () => {
  it('initializes with empty motes and starting radius', () => {
    const c = createMoteCluster();
    expect(c.motes).toEqual([]);
    expect(c.nextMoteId).toBe(1);
    expect(c.physicalRadius).toBe(TUNING.MOTE_CLUSTER_MIN_RADIUS);
    expect(c.diskTilt).toBe(TUNING.BLACKHOLE_DISK_TILT);
  });
});

describe('createStars', () => {
  it('returns total count matching sum across STAR_LAYERS', () => {
    const total = TUNING.STAR_LAYERS.reduce((sum, l) => sum + l.count, 0);
    const stars = createStars(800, 600);
    expect(stars.length).toBe(total);
  });
  it('positions stars within bounds', () => {
    const stars = createStars(200, 100);
    stars.forEach((s) => {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(200);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThanOrEqual(100);
    });
  });
});

describe('createParticles', () => {
  it('returns exactly TUNING.AMBIENT_PARTICLE_COUNT particles', () => {
    const ps = createParticles(800, 600, stage);
    expect(ps.length).toBe(TUNING.AMBIENT_PARTICLE_COUNT);
  });
  it('uses colors from the stage palette', () => {
    const ps = createParticles(800, 600, stage);
    ps.forEach((p) => expect(stage.particleColors).toContain(p.color));
  });
});

describe('spawnParticleAtEdge', () => {
  it('moves a particle to the edge ring of the canvas', () => {
    const orig = { x: 0, y: 0, vx: 0, vy: 0, r: 1, color: '#fff', phase: 0, alpha: 1 };
    const W = 400, H = 300;
    const cx = W / 2, cy = H / 2;
    const repositioned = spawnParticleAtEdge(orig, W, H);
    const r = Math.hypot(repositioned.x - cx, repositioned.y - cy);
    const minR = Math.max(W, H) * TUNING.PARTICLE_EDGE_RADIUS_FRAC;
    const maxR = minR + TUNING.PARTICLE_EDGE_VARIANCE;
    expect(r).toBeGreaterThanOrEqual(minR - 1);
    expect(r).toBeLessThanOrEqual(maxR + 1);
  });
});

describe('createWorld', () => {
  it('builds a CanvasWorld with all expected collections initialized', () => {
    const w = createWorld(800, 600, stage);
    expect(w.cluster.motes.length).toBe(0);
    expect(w.flyers).toEqual([]);
    expect(w.bursts).toEqual([]);
    expect(w.rogues).toEqual([]);
    expect(w.rogueCooldown).toBe(TUNING.FIRST_ENCOUNTER_DELAY_MS);
    expect(w.nextId).toBe(1);
    expect(w.stars.length).toBeGreaterThan(0);
    expect(w.particles.length).toBe(TUNING.AMBIENT_PARTICLE_COUNT);
  });
});

describe('resetForStage', () => {
  it('preserves nextId across resets', () => {
    const w = createWorld(800, 600, stage);
    w.nextId = 42;
    const next = resetForStage(w, 800, 600, stage);
    expect(next.nextId).toBe(42);
    expect(next.cluster.motes.length).toBe(0);
  });
});
