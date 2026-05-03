import type { MechanicSpec } from './types';

export const galaxyWeavingMechanic: MechanicSpec = {
  id: 'galaxy_weaving',
  tutorial: 'Link distant structure. Every third successful weave folds matter into brighter spirals.',
  onClick: ({ state }) => {
    const woven = (((state?.totalClicks ?? 0) + 1) % 3) === 0;
    return {
      consumed: false,
      gainMultiplier: woven ? 3.5 : 1.1,
      mechanicChargeDelta: woven ? 0.02 : 0.01,
    };
  },
};
