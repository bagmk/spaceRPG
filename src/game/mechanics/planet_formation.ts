import type { MechanicSpec } from './types';

export const planetFormationMechanic: MechanicSpec = {
  id: 'planet_formation',
  tutorial: 'Drag planetesimals into stable orbits. The habitable band rewards careful rhythm.',
  onClick: ({ state }) => {
    const band = Math.abs((((state?.totalClicks ?? 0) + 1) % 10) - 5) <= 1;
    return {
      consumed: false,
      gainMultiplier: band ? 2.2 : 1,
      mechanicChargeDelta: band ? 0.025 : 0.01,
      note: band ? 'A stable orbit holds.' : undefined,
    };
  },
};
