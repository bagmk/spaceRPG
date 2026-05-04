import { describe, expect, it } from 'vitest';
import { ALMANAC } from '../almanac';
import { STAGES } from '../stages';

describe('almanac era info', () => {
  it('populates cosmic era fields for every stage', () => {
    STAGES.forEach((stage) => {
      const era = ALMANAC[stage.id]?.cosmicEra;
      expect(era?.timeRange.length).toBeGreaterThan(0);
      expect(era?.temperature.length).toBeGreaterThan(0);
      expect(era?.keyParticles.length).toBeGreaterThan(0);
      expect(era?.keyEvents.length).toBeGreaterThan(0);
      expect(era?.realWorldScale.length).toBeGreaterThan(0);
    });
  });
});
