import { describe, expect, it } from 'vitest';
import {
  ENTROPY_THRESHOLDS,
  BIG_CRUNCH_ENTROPY_KB,
  BIG_RIP_ENTROPY_KB,
  PRESTIGE_COST_BASE_KB,
  STAGE_POWER_BASE,
  AUTO_STAGE_POWER_BASE,
  OFFLINE_ENTROPY_FLOOR_FRAC,
} from '../balance';
import { getGearPowerMult } from '../entities/substats';
import { STAGES } from '../stages';

/**
 * Pacing regression guard (Phase 4-4): locks the gear-only calibration so a
 * future balance edit can't silently break the entropy-gate ladder or the
 * threshold-relative meta constants. Re-run scripts/entropy-gate-sim.mjs and
 * paste new thresholds if these need to change on purpose.
 */
describe('entropy-gate pacing ladder', () => {
  it('thresholds are defined and strictly increasing across all 16 stages', () => {
    for (let s = 1; s <= 16; s++) {
      expect(ENTROPY_THRESHOLDS[s], `threshold ${s}`).toBeGreaterThan(0);
      if (s > 1) {
        expect(ENTROPY_THRESHOLDS[s], `threshold ${s} > ${s - 1}`).toBeGreaterThan(ENTROPY_THRESHOLDS[s - 1]);
      }
    }
  });

  it('the runtime stage table mirrors the threshold ladder', () => {
    for (const stage of STAGES) {
      expect(stage.entropyThreshold).toBe(ENTROPY_THRESHOLDS[stage.id]);
    }
  });

  it('meta constants stay anchored to the ladder (no absolute drift)', () => {
    expect(BIG_CRUNCH_ENTROPY_KB).toBeCloseTo(0.5 * ENTROPY_THRESHOLDS[3], 6);
    expect(BIG_RIP_ENTROPY_KB).toBeCloseTo(1.3 * ENTROPY_THRESHOLDS[9], 6);
    expect(PRESTIGE_COST_BASE_KB).toBeCloseTo(0.5 * ENTROPY_THRESHOLDS[8], 6);
    // Big Rip sits between the stage-9 and stage-10 gates (as designed).
    expect(BIG_RIP_ENTROPY_KB).toBeGreaterThan(ENTROPY_THRESHOLDS[9]);
    expect(BIG_RIP_ENTROPY_KB).toBeLessThan(ENTROPY_THRESHOLDS[10]);
  });
});

describe('fixed-effect gear power (P0: no per-stage scaling)', () => {
  const P = (stageId: number) => ({ stageId, gateProgress01: 0 });

  it('the scaling bases are neutralised to 1.0', () => {
    expect(STAGE_POWER_BASE).toBe(1.0);
    expect(AUTO_STAGE_POWER_BASE).toBe(1.0);
  });

  it('gear power is identically 1.0 at every stage (label == applied)', () => {
    for (let s = 1; s <= 16; s++) {
      expect(getGearPowerMult(P(s), 1)).toBeCloseTo(1.0, 9);
    }
    // And in-stage gate progress no longer changes it either.
    expect(getGearPowerMult({ stageId: 8, gateProgress01: 0.9 }, 1)).toBeCloseTo(1.0, 9);
  });
});

describe('offline entropy floor (Phase 4-4 idle floor)', () => {
  it('is a positive fraction (idle builds make some offline progress)', () => {
    expect(OFFLINE_ENTROPY_FLOOR_FRAC).toBeGreaterThan(0);
    expect(OFFLINE_ENTROPY_FLOOR_FRAC).toBeLessThan(0.5); // modest — never trivializes a stage
  });
});
