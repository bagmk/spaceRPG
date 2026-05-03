import { describe, expect, it } from 'vitest';
import { STAGES } from '../stages';

describe('V3 stage pacing', () => {
  it('sums real-play targets to 100 hours', () => {
    const total = STAGES.reduce((sum, stage) => sum + stage.realPlayTargetSec, 0);
    expect(total).toBe(360_000);
  });
});
