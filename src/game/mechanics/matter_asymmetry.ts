import type { MechanicSpec } from './types';

export const matterAsymmetryMechanic: MechanicSpec = {
  id: 'matter_asymmetry',
  tutorial: 'One in a billion survives. Every ninth click reveals a rare matter surplus.',
  onClick: ({ state, stage }) => {
    const rareMatter = (((state?.totalClicks ?? 0) + 1) % 9) === 0;
    return {
      consumed: false,
      gainMultiplier: rareMatter ? 100 : 0.85,
      forceCrit: rareMatter,
      gainFlat: rareMatter ? stage.threshold * 0.01 : 0,
      note: rareMatter ? 'A matter surplus slips past annihilation.' : undefined,
    };
  },
};
