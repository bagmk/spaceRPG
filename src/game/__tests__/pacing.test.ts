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
    expect(BIG_RIP_ENTROPY_KB).toBeCloseTo(2.2 * ENTROPY_THRESHOLDS[9], 6);
    expect(PRESTIGE_COST_BASE_KB).toBeCloseTo(0.5 * ENTROPY_THRESHOLDS[8], 6);
    // Big Rip sits between the stage-9 and stage-10 gates (as designed).
    expect(BIG_RIP_ENTROPY_KB).toBeGreaterThan(ENTROPY_THRESHOLDS[9]);
    expect(BIG_RIP_ENTROPY_KB).toBeLessThan(ENTROPY_THRESHOLDS[10]);
  });
});

describe('gear power curve sanity', () => {
  const P = (stageId: number) => ({ stageId, gateProgress01: 0 });

  it('one player stage multiplies % gear power by STAGE_POWER_BASE', () => {
    expect(getGearPowerMult(P(6), 1) / getGearPowerMult(P(5), 1)).toBeCloseTo(STAGE_POWER_BASE, 6);
  });

  it('three click slots roughly match auto growth per stage (8×)', () => {
    // Three multiplicative click slots ≈ STAGE_POWER_BASE^3 per stage.
    expect(Math.pow(STAGE_POWER_BASE, 3)).toBeCloseTo(AUTO_STAGE_POWER_BASE, 6);
  });
});

describe('offline entropy floor (Phase 4-4 idle floor)', () => {
  it('is a positive fraction (idle builds make some offline progress)', () => {
    expect(OFFLINE_ENTROPY_FLOOR_FRAC).toBeGreaterThan(0);
    expect(OFFLINE_ENTROPY_FLOOR_FRAC).toBeLessThan(0.5); // modest — never trivializes a stage
  });
});
