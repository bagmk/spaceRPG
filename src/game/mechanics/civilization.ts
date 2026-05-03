import type { MechanicSpec } from './types';

export const civilizationMechanic: MechanicSpec = {
  id: 'civilization',
  tutorial: 'Everything familiar fits inside a brief bright flicker.',
  onClick: () => ({
    consumed: false,
    gainMultiplier: 4,
    trigger: true,
  }),
};
