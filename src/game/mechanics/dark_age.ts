import type { MechanicSpec } from './types';

export const darkAgeMechanic: MechanicSpec = {
  id: 'dark_age',
  tutorial: 'This is a quiet age. Clicks barely matter. The universe advances mostly on its own.',
  onClick: () => ({
    consumed: false,
    gainMultiplier: 0.01,
  }),
};
