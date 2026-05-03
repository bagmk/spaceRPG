import type { MechanicSpec } from './types';

export const recombinationMechanic: MechanicSpec = {
  id: 'recombination',
  tutorial: 'Capture electrons until the fog clears and the first clean light escapes.',
  onClick: ({ state, stage }) => {
    const nextCharge = (state?.mechanicCharge ?? 0) + 0.04;
    const clearsFog = !state?.mechanicTriggered && nextCharge >= 0.7;
    return {
      consumed: false,
      gainMultiplier: 1.25,
      mechanicChargeDelta: 0.04,
      trigger: clearsFog,
      quantaDelta: clearsFog ? stage.threshold * 3 : 0,
      note: clearsFog ? 'The fog clears.' : undefined,
    };
  },
};
