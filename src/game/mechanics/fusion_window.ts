import type { MechanicSpec } from './types';

export const fusionWindowMechanic: MechanicSpec = {
  id: 'fusion_window',
  tutorial: 'The fusion window is brief. Click inside the green band for a heavy payout.',
  onClick: ({ now, state }) => {
    const phase = ((now - (state?.stageStartedAt ?? now)) % 3000) / 3000;
    const inWindow = phase >= 0.7 && phase <= 0.9;
    return {
      consumed: false,
      gainMultiplier: inWindow ? 5 : 0.5,
      note: inWindow ? 'The furnace holds.' : undefined,
    };
  },
};
