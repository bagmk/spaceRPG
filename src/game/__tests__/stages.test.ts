import { describe, expect, it } from 'vitest';
import { STAGES } from '../stages';

describe('V7 stage pacing', () => {
  it('uses the V7 threshold table with a faster first purchase ramp', () => {
    expect(STAGES[0].realPlayTargetSec).toBe(30);
    expect(STAGES[0].threshold).toBe(10);
    expect(STAGES[1].realPlayTargetSec).toBe(60);
    expect(STAGES[1].threshold).toBe(100);
    expect(STAGES[4].threshold).toBe(100_000);
    expect(STAGES[10].threshold).toBe(1e12);
    expect(STAGES[15].threshold).toBe(1e60);
  });

  it('keeps the full pacing table near the 100-hour target', () => {
    const total = STAGES.reduce((sum, stage) => sum + stage.realPlayTargetSec, 0);
    expect(total).toBe(359_910);
  });
});
