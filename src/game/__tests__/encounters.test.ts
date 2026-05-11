import { describe, expect, it } from 'vitest';
import { formatEncounterDistance } from '../encounters';

describe('encounter distance labels', () => {
  it('uses the exact stage scale for reionization instead of capping at 1000 ly', () => {
    expect(formatEncounterDistance(8, 50)).toBe('1,000 ly');
    expect(formatEncounterDistance(8, 125)).toBe('2,500 ly');
    expect(formatEncounterDistance(8, 125)).not.toContain('+');
  });

  it('keeps small fractional distances readable', () => {
    expect(formatEncounterDistance(12, 25)).toBe('0.5 AU');
  });
});
