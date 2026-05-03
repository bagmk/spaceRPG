import { getLifeStep } from '../formulas';
import type { MechanicSpec } from './types';

export const lifeEvolutionMechanic: MechanicSpec = {
  id: 'life_evolution',
  tutorial: 'The clock lingers over deep evolution, then races through the final flicker of minds.',
  onClick: ({ progress01 }) => ({
    consumed: false,
    gainMultiplier: progress01 < 0.8 ? 1.4 : 2.5,
    mechanicStep: getLifeStep(progress01),
    trigger: progress01 >= 0.99,
  }),
};
