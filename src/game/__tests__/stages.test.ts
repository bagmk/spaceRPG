import { describe, expect, it } from 'vitest';
import { STAGES } from '../stages';

describe('V7 stage pacing', () => {
  it('uses the current rebalanced carry-quanta threshold ramp', () => {
    expect(STAGES[0].realPlayTargetSec).toBe(30);
    expect(STAGES[0].threshold).toBe(1_725);
    expect(STAGES[1].realPlayTargetSec).toBe(120);
    expect(STAGES[1].threshold).toBe(28_000);
    expect(STAGES[4].threshold).toBe(8e7);
    expect(STAGES[5].threshold).toBe(1.2e9);
    expect(STAGES[8].threshold).toBe(4.5e12);
    expect(STAGES[10].threshold).toBe(1.3e15);
    expect(STAGES[15].threshold).toBe(3.5e21);
  });

  it('keeps the full pacing table near the 100-hour target', () => {
    const total = STAGES.reduce((sum, stage) => sum + stage.realPlayTargetSec, 0);
    expect(total).toBe(360_000);
  });
});
