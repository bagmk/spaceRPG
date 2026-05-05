import type { MechanicSpec } from './types';

export const matterAsymmetryMechanic: MechanicSpec = {
  id: 'matter_asymmetry',
  tutorial: 'One in a billion survives. Every ninth click reveals a modest matter surplus.',
  onClick: ({ state, stage }) => {
    void stage;
    const rareMatter = (((state?.totalClicks ?? 0) + 1) % 9) === 0;
    return {
      consumed: false,
      gainMultiplier: rareMatter ? 2.8 : 1,
      note: rareMatter ? 'A matter surplus slips past annihilation.' : undefined,
    };
  },
};
