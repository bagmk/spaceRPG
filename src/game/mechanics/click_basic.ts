import type { MechanicSpec } from './types';

export const clickBasicMechanic: MechanicSpec = {
  id: 'click_basic',
  tutorial: 'Clicks accelerate the field. Inflation leaves expanding rings in its wake.',
  onClick: () => ({ consumed: false }),
};
