import type { MechanicSpec } from './types';

export const endingChoiceMechanic: MechanicSpec = {
  id: 'ending_choice',
  tutorial: 'At the final threshold, choose how the universe resolves its last uncertainty.',
  onClick: () => ({ consumed: false }),
};
