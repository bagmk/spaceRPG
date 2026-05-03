import { describe, it, expect } from 'vitest';
import { STAGES } from '../stages';

describe('cluster modes', () => {
  it('stages expose 16 clusterMode values', () => {
    const modes = STAGES.map((s) => s.clusterMode);
    expect(modes).toHaveLength(16);
    expect(modes).toMatchInlineSnapshot(`
      [
        "inflation",
        "baryogenesis",
        "qgPlasma",
        "nucleosynthesis",
        "recombination",
        "darkAge",
        "firstStars",
        "reionization",
        "galaxy",
        "planetary",
        "lifeSurface",
        "redGiant",
        "remnant",
        "degenerate",
        "blackHole",
        "heatDeath",
      ]
    `);
  });
});
