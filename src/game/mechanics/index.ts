import { civilizationMechanic } from './civilization';
import { clickBasicMechanic } from './click_basic';
import { darkAgeMechanic } from './dark_age';
import { endingChoiceMechanic } from './ending_choice';
import { firstStarsMechanic } from './first_stars';
import { fusionWindowMechanic } from './fusion_window';
import { galaxyWeavingMechanic } from './galaxy_weaving';
import { hawkingRadiationMechanic } from './hawking_radiation';
import { lifeEvolutionMechanic } from './life_evolution';
import { matterAsymmetryMechanic } from './matter_asymmetry';
import { planetFormationMechanic } from './planet_formation';
import { protonDecayMechanic } from './proton_decay';
import { recombinationMechanic } from './recombination';
import { redGiantMechanic } from './red_giant';
import { reionizationMechanic } from './reionization';
import { remnantCoolingMechanic } from './remnant_cooling';
import type { StageMechanicId } from '../types';
import type { MechanicSpec } from './types';

export const MECHANICS: Record<StageMechanicId, MechanicSpec> = {
  click_basic: clickBasicMechanic,
  matter_asymmetry: matterAsymmetryMechanic,
  fusion_window: fusionWindowMechanic,
  recombination: recombinationMechanic,
  dark_age: darkAgeMechanic,
  first_stars: firstStarsMechanic,
  reionization: reionizationMechanic,
  galaxy_weaving: galaxyWeavingMechanic,
  planet_formation: planetFormationMechanic,
  life_evolution: lifeEvolutionMechanic,
  civilization: civilizationMechanic,
  red_giant: redGiantMechanic,
  remnant_cooling: remnantCoolingMechanic,
  proton_decay: protonDecayMechanic,
  hawking_radiation: hawkingRadiationMechanic,
  ending_choice: endingChoiceMechanic,
};

export function getMechanic(stageMechanicId: StageMechanicId): MechanicSpec {
  return MECHANICS[stageMechanicId];
}
