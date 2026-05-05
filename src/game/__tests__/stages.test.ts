import { describe, expect, it } from 'vitest';
import { STAGES } from '../stages';

describe('V7 stage pacing', () => {
  it('uses the V8 threshold table with a rebalanced ramp', () => {
    expect(STAGES[0].realPlayTargetSec).toBe(30);
    expect(STAGES[0].threshold).toBe(1_725);
    expect(STAGES[1].realPlayTargetSec).toBe(120);
    expect(STAGES[1].threshold).toBe(4.693e7);
    expect(STAGES[4].threshold).toBe(1.285e11);
    expect(STAGES[10].threshold).toBe(3.407e17);
    expect(STAGES[15].threshold).toBe(9.131e20);
  });

  it('keeps the full pacing table near the 100-hour target', () => {
    const total = STAGES.reduce((sum, stage) => sum + stage.realPlayTargetSec, 0);
    expect(total).toBe(360_000);
  });
});
