import type { MechanicSpec } from './types';

export const protonDecayMechanic: MechanicSpec = {
  id: 'proton_decay',
  tutorial: 'Clicks force the next unlikely decay instead of waiting for impossible spans.',
  onClick: ({ state }) => {
    const decay = (((state?.totalClicks ?? 0) + 1) % 5) === 0;
    return {
      consumed: false,
      gainMultiplier: decay ? 8 : 1,
      forceCrit: decay,
    };
  },
};
