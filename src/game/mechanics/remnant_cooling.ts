import type { MechanicSpec } from './types';

export const remnantCoolingMechanic: MechanicSpec = {
  id: 'remnant_cooling',
  tutorial: 'Residual heat is finite. Clicks drain each remnant faster, then hand progress back to auto.',
  onClick: ({ state }) => ({
    consumed: false,
    gainMultiplier: Math.max(0.45, 1.8 - (state?.mechanicCharge ?? 0)),
    mechanicChargeDelta: 0.01,
  }),
};
