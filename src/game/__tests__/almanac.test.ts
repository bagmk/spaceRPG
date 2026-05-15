import { describe, expect, it } from 'vitest';
import { ALMANAC } from '../almanac';
import { STAGES } from '../stages';
import { stageName } from '../../i18n';

describe('almanac era info', () => {
  it('populates cosmic era fields for every stage', () => {
    STAGES.forEach((stage) => {
      const era = ALMANAC[stage.id]?.cosmicEra;
      expect(era?.timeRange.en.length).toBeGreaterThan(0);
      expect(era?.timeRange.ko.length).toBeGreaterThan(0);
      expect(era?.temperature.en.length).toBeGreaterThan(0);
      expect(era?.temperature.ko.length).toBeGreaterThan(0);
      expect(era?.keyParticles.en.length).toBeGreaterThan(0);
      expect(era?.keyParticles.ko.length).toBeGreaterThan(0);
      expect(era?.keyEvents.en.length).toBeGreaterThan(0);
      expect(era?.keyEvents.ko.length).toBeGreaterThan(0);
      expect(era?.realWorldScale.en.length).toBeGreaterThan(0);
      expect(era?.realWorldScale.ko.length).toBeGreaterThan(0);
    });
  });

  it('keeps HUD stage titles aligned with info titles', () => {
    STAGES.forEach((stage) => {
      expect(ALMANAC[stage.id]?.title.en).toBe(stageName('en', stage.id, stage.name));
      expect(ALMANAC[stage.id]?.title.ko).toBe(stageName('ko', stage.id, stage.name));
    });
  });
});
