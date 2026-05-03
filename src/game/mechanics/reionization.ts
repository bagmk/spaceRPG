import type { MechanicSpec } from './types';

export const reionizationMechanic: MechanicSpec = {
  id: 'reionization',
  tutorial: 'Sweep ionizing fronts across the haze. Clearing more of the field strengthens passive gain.',
  onClick: ({ state }) => ({
    consumed: false,
    gainMultiplier: 1 + (state?.mechanicCharge ?? 0) * 0.8,
    mechanicChargeDelta: (state?.mechanicCharge ?? 0) < 0.9 ? 0.03 : 0.005,
  }),
};
