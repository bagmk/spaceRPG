import type { MechanicSpec } from './types';

export const redGiantMechanic: MechanicSpec = {
  id: 'red_giant',
  tutorial: 'The star expands. Rapid clicks can launch a final diaspora before the engulfing light arrives.',
  onClick: ({ state }) => {
    const rescued = !state?.mechanicTriggered && (state?.combo ?? 0) >= 12;
    return {
      consumed: false,
      gainMultiplier: 1.1,
      trigger: rescued,
      entropyDelta: rescued ? 75 : 0,
      note: rescued ? 'A diaspora escapes.' : undefined,
    };
  },
};
