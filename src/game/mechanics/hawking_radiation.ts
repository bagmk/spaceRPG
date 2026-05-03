import type { MechanicSpec } from './types';

export const hawkingRadiationMechanic: MechanicSpec = {
  id: 'hawking_radiation',
  tutorial: 'As the black hole shrinks, each emitted quantum matters more than the last.',
  onClick: ({ progress01 }) => ({
    consumed: false,
    gainMultiplier: 1.5 + progress01 * 4,
  }),
};
