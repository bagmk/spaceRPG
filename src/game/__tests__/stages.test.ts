import { describe, expect, it } from 'vitest';
import { STAGES } from '../stages';

describe('V7 stage pacing', () => {
  it('uses the rounded matter threshold ramp', () => {
    expect(STAGES[0].realPlayTargetSec).toBe(30);
    expect(STAGES[0].threshold).toBe(2_000);
    expect(STAGES[1].realPlayTargetSec).toBe(120);
    expect(STAGES[1].threshold).toBe(30_000);
    expect(STAGES[2].threshold).toBe(400_000);
    expect(STAGES[4].threshold).toBe(8e7);
    expect(STAGES[5].threshold).toBe(2e9);
    expect(STAGES[7].threshold).toBe(3e11);
    expect(STAGES[8].threshold).toBe(5e12);
    expect(STAGES[9].threshold).toBe(8e13);
    expect(STAGES[10].threshold).toBe(2e15);
    expect(STAGES[15].threshold).toBe(4e21);
  });

  it('keeps the full pacing table near the 100-hour target', () => {
    const total = STAGES.reduce((sum, stage) => sum + stage.realPlayTargetSec, 0);
    expect(total).toBe(360_000);
  });
});
