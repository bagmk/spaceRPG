import type { MechanicSpec } from './types';

export const firstStarsMechanic: MechanicSpec = {
  id: 'first_stars',
  tutorial: 'Keep a handful of massive stars alive. A dense star field multiplies active gain.',
  onClick: ({ state }) => ({
    consumed: false,
    gainMultiplier: 1.2 + Math.min(2.8, (state?.mechanicCharge ?? 0) * 0.2),
    mechanicChargeDelta: 0.2,
  }),
  onTick: ({ state }) => ({
    mechanicChargeDelta: (state?.mechanicCharge ?? 0) > 0 ? -0.0004 : 0,
  }),
};
