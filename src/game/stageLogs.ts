export interface StageLog {
  stageId: number;
  progress: number; // 0–100
  title: string;
  message: string;
}

export const STAGE_LOGS: StageLog[] = [
  // Stage 1 — Inflation
  { stageId: 1, progress: 0, title: 'Inflation Begins', message: 'Space itself begins an almost impossible expansion.' },
  { stageId: 1, progress: 10, title: 'A Tiny Universe', message: 'Everything visible is still packed into a microscopic state.' },
  { stageId: 1, progress: 25, title: 'Expansion Surge', message: 'Distances stretch before matter has time to organize.' },
  { stageId: 1, progress: 50, title: 'Quantum Seeds', message: 'Tiny fluctuations are stretched into the first hints of cosmic structure.' },
  { stageId: 1, progress: 75, title: 'Cooling Begins', message: 'The young universe expands, thins, and starts to cool.' },
  { stageId: 1, progress: 90, title: 'Inflation Settles', message: 'The violent expansion slows into a universe ready to evolve.' },
  { stageId: 1, progress: 100, title: 'Inflation Complete', message: 'The universe has grown enough for particles and fields to matter.' },

  // Stage 2 — Baryogenesis
  { stageId: 2, progress: 0, title: 'Matter Takes the Stage', message: 'Matter and antimatter emerge in a nearly perfect balance.' },
  { stageId: 2, progress: 10, title: 'Symmetry Holds', message: 'For every particle, an opposite partner appears.' },
  { stageId: 2, progress: 25, title: 'Annihilation', message: 'Matter and antimatter collide, turning mass back into radiation.' },
  { stageId: 2, progress: 50, title: 'A Small Imbalance', message: 'A tiny excess of matter survives the annihilation.' },
  { stageId: 2, progress: 75, title: 'Matter Remains', message: 'Almost everything vanished, but the leftover matter will become everything we know.' },
  { stageId: 2, progress: 90, title: 'The Bias Is Set', message: 'The universe now has enough matter to build future structure.' },
  { stageId: 2, progress: 100, title: 'Matter Wins', message: 'The first great filter is passed: something remains instead of nothing.' },

  // Stage 3 — Quark-Gluon Plasma
  { stageId: 3, progress: 0, title: 'Particle Soup', message: 'The universe is too hot for protons or neutrons to hold together.' },
  { stageId: 3, progress: 10, title: 'Free Quarks', message: 'Quarks and gluons move through an extremely hot, dense plasma.' },
  { stageId: 3, progress: 25, title: 'No Atoms Yet', message: 'Matter exists, but it is still too energetic to form stable structures.' },
  { stageId: 3, progress: 50, title: 'Cooling Plasma', message: 'Expansion lowers the temperature enough for particles to begin pairing.' },
  { stageId: 3, progress: 75, title: 'Confinement Nears', message: 'Quarks begin losing their freedom as the universe cools.' },
  { stageId: 3, progress: 90, title: 'Hadron Formation', message: 'The first stable protons and neutrons are about to appear.' },
  { stageId: 3, progress: 100, title: 'Plasma Condensed', message: 'The universe leaves the quark-gluon sea behind.' },

  // Stage 4 — Nucleosynthesis
  { stageId: 4, progress: 0, title: 'Nuclei Begin', message: 'Protons and neutrons start joining into the first atomic nuclei.' },
  { stageId: 4, progress: 10, title: 'Hydrogen Dominates', message: 'Simple hydrogen nuclei fill most of the young universe.' },
  { stageId: 4, progress: 25, title: 'Helium Forms', message: 'Some particles fuse into helium, the second great ingredient of stars.' },
  { stageId: 4, progress: 50, title: 'Light Elements', message: 'A small amount of deuterium, helium, and lithium joins the mix.' },
  { stageId: 4, progress: 75, title: 'Fusion Window Closing', message: 'The universe cools too quickly for heavier elements to form here.' },
  { stageId: 4, progress: 90, title: 'Primordial Recipe', message: 'The early chemical inventory is nearly fixed.' },
  { stageId: 4, progress: 100, title: 'First Nuclei Complete', message: 'Hydrogen and helium wait in the dark for the first stars.' },

  // Stage 5 — Recombination
  { stageId: 5, progress: 0, title: 'Opaque Universe', message: 'Light is trapped in a hot fog of charged particles.' },
  { stageId: 5, progress: 10, title: 'Electrons Slow', message: 'Cooling allows electrons to approach atomic nuclei.' },
  { stageId: 5, progress: 25, title: 'Atoms Form', message: 'Electrons bind to nuclei, creating the first neutral atoms.' },
  { stageId: 5, progress: 50, title: 'Light Escapes', message: 'Photons can finally travel freely across space.' },
  { stageId: 5, progress: 75, title: 'The Universe Clears', message: 'The cosmic fog fades into a faint background glow.' },
  { stageId: 5, progress: 90, title: 'Afterglow', message: 'The released light becomes the oldest visible signal in the universe.' },
  { stageId: 5, progress: 100, title: 'Darkness Falls', message: 'The universe is transparent now, but no stars exist yet.' },

  // Stage 6 — Cosmic Dark Age
  { stageId: 6, progress: 0, title: 'Cosmic Dark Age', message: 'The universe is clear, cold, and almost completely dark.' },
  { stageId: 6, progress: 10, title: 'No Stars Yet', message: 'Hydrogen and helium drift through space without a source of light.' },
  { stageId: 6, progress: 25, title: 'Gravity Begins Its Work', message: 'Tiny density differences slowly pull gas into darker regions.' },
  { stageId: 6, progress: 50, title: 'Clouds Gather', message: 'Invisible halos and gas clouds begin shaping the future cosmic web.' },
  { stageId: 6, progress: 75, title: 'Collapse Deepens', message: 'The densest clouds grow heavy enough to prepare for ignition.' },
  { stageId: 6, progress: 90, title: 'First Cores', message: 'The first star-forming cores begin to warm inside the darkness.' },
  { stageId: 6, progress: 100, title: 'The First Light Approaches', message: 'The dark age is about to end.' },

  // Stage 7 — First Stars
  { stageId: 7, progress: 0, title: 'First Stars', message: 'Gravity compresses primordial gas until the first stars can ignite.' },
  { stageId: 7, progress: 10, title: 'Dense Primordial Clouds', message: 'Hydrogen gathers into massive, unstable clouds.' },
  { stageId: 7, progress: 25, title: 'Ignition', message: 'The first stars ignite, ending millions of years of darkness.' },
  { stageId: 7, progress: 50, title: 'Massive and Brief', message: 'These early stars burn intensely and live fast.' },
  { stageId: 7, progress: 75, title: 'First Heavy Elements', message: 'Inside the first stars, heavier elements begin to form.' },
  { stageId: 7, progress: 90, title: 'Radiation Fronts', message: 'Starlight pushes into the surrounding gas.' },
  { stageId: 7, progress: 100, title: 'The Universe Lights Up', message: 'The first stars prepare the universe for galaxies.' },

  // Stage 8 — Reionization
  { stageId: 8, progress: 0, title: 'Reionization Begins', message: 'Energetic starlight starts changing the gas between galaxies.' },
  { stageId: 8, progress: 10, title: 'Ionized Bubbles', message: 'Light carves glowing bubbles around the first stars.' },
  { stageId: 8, progress: 25, title: 'Growing Cavities', message: 'Ionized regions expand into the neutral hydrogen fog.' },
  { stageId: 8, progress: 50, title: 'Bubbles Overlap', message: 'Separate regions of light begin connecting across space.' },
  { stageId: 8, progress: 75, title: 'The Fog Breaks', message: 'The universe becomes increasingly transparent to ultraviolet light.' },
  { stageId: 8, progress: 90, title: 'Cosmic Web Revealed', message: 'The large-scale structure of the universe becomes easier to see.' },
  { stageId: 8, progress: 100, title: 'Reionization Complete', message: 'The universe has entered a long era of stars and galaxies.' },

  // Stage 9 — Galaxy Formation
  { stageId: 9, progress: 0, title: 'Galaxies Begin', message: 'Stars, gas, and dark matter gather into the first galactic systems.' },
  { stageId: 9, progress: 10, title: 'Proto-Galaxies', message: 'Small stellar groups merge into larger structures.' },
  { stageId: 9, progress: 25, title: 'Galactic Cores', message: 'Dense centers form as matter falls inward.' },
  { stageId: 9, progress: 50, title: 'Arms and Halos', message: 'Rotation and gravity sculpt disks, arms, and halos.' },
  { stageId: 9, progress: 75, title: 'Cosmic Cities', message: 'Galaxies become the major homes of stars, gas, and future planets.' },
  { stageId: 9, progress: 90, title: 'A Local Neighborhood', message: 'One galaxy becomes the stage for a future solar system.' },
  { stageId: 9, progress: 100, title: 'A Star-Forming Region', message: 'Inside a galaxy, a cloud begins collapsing toward a new star.' },

  // Stage 10 — Solar System
  { stageId: 10, progress: 0, title: 'Solar System Formation', message: 'A quiet cloud inside the galaxy begins to collapse.' },
  { stageId: 10, progress: 8, title: 'Proto-Sun', message: 'Gas falls inward and the young Sun begins to glow.' },
  { stageId: 10, progress: 16, title: 'Accretion Disk', message: 'Dust and gas flatten into a rotating disk around the newborn Sun.' },
  { stageId: 10, progress: 24, title: 'Planetesimals', message: 'Tiny grains collide, stick, and grow into the seeds of planets.' },
  { stageId: 10, progress: 32, title: 'Mercury Forms', message: 'A small rocky world takes shape close to the Sun.' },
  { stageId: 10, progress: 40, title: 'Venus Forms', message: 'A dense inner planet gathers under the young Sun\'s heat.' },
  { stageId: 10, progress: 48, title: 'Proto-Earth', message: 'Earth begins as a molten rocky body, scarred by impacts.' },
  { stageId: 10, progress: 58, title: 'Mars Forms', message: 'A smaller red world stabilizes beyond Earth\'s orbit.' },
  { stageId: 10, progress: 66, title: 'Jupiter Forms', message: 'The largest planet gathers gas and reshapes the young system.' },
  { stageId: 10, progress: 74, title: 'Saturn Forms', message: 'A second gas giant appears, wrapped in a growing ring system.' },
  { stageId: 10, progress: 80, title: 'Uranus Forms', message: 'An icy giant settles into the outer system.' },
  { stageId: 10, progress: 86, title: 'Neptune Forms', message: 'A distant blue world takes its place far from the Sun.' },
  { stageId: 10, progress: 91, title: 'Outer Debris', message: 'Icy fragments and distant small worlds mark the edge of the system.' },
  { stageId: 10, progress: 95, title: 'Orbits Stabilize', message: 'The young planets settle into long, repeating paths.' },
  { stageId: 10, progress: 100, title: 'A Solar System', message: 'The stage is set for one small world to change.' },

  // Stage 11 — Life on Earth
  { stageId: 11, progress: 0, title: 'Molten Earth', message: 'Earth begins as a violent world of rock, impact, and lava.' },
  { stageId: 11, progress: 10, title: 'Steam World', message: 'Heat, vapor, and early atmosphere wrap the young planet.' },
  { stageId: 11, progress: 20, title: 'First Oceans', message: 'As the surface cools, water begins collecting into oceans.' },
  { stageId: 11, progress: 32, title: 'Continents Rise', message: 'Land breaks through the oceans and reshapes the planet\'s face.' },
  { stageId: 11, progress: 45, title: 'Life Spreads', message: 'Green begins to spread across the land and seas.' },
  { stageId: 11, progress: 58, title: 'A Living Planet', message: 'Clouds, oceans, land, and life create a changing blue world.' },
  { stageId: 11, progress: 72, title: 'Civilization', message: 'Tiny lights appear on the night side of Earth.' },
  { stageId: 11, progress: 82, title: 'Space Age', message: 'Earth reaches beyond its atmosphere with satellites and stations.' },
  { stageId: 11, progress: 90, title: 'Orbital Industry', message: 'Structures grow around the planet, collecting energy and extending civilization.' },
  { stageId: 11, progress: 97, title: 'Peak Earth', message: 'A bright world turns below a web of machines, lights, and clouds.' },
  { stageId: 11, progress: 100, title: 'A Brief Golden Age', message: 'For a moment, the universe learns to look back at itself.' },

  // Stage 12 — Death of Star
  { stageId: 12, progress: 0, title: 'The Sun Ages', message: 'The mature solar system enters the final life of its star.' },
  { stageId: 12, progress: 10, title: 'Solar Brightening', message: 'The Sun grows hotter and brighter, stressing the inner worlds.' },
  { stageId: 12, progress: 20, title: 'Red Giant Begins', message: 'The Sun swells outward as its outer layers expand.' },
  { stageId: 12, progress: 32, title: 'Mercury Lost', message: 'The innermost planet disappears into the expanding Sun.' },
  { stageId: 12, progress: 40, title: 'Venus Lost', message: 'Venus is swallowed by the growing red giant.' },
  { stageId: 12, progress: 48, title: 'Earth Burns', message: 'Earth\'s oceans boil away and the night lights go dark.' },
  { stageId: 12, progress: 56, title: 'Earth Lost', message: 'The world that carried life is consumed by its star.' },
  { stageId: 12, progress: 66, title: 'Mars Scorched', message: 'The inner system collapses into heat and debris.' },
  { stageId: 12, progress: 74, title: 'Outer Worlds Stripped', message: 'The giant planets are battered by the dying Sun\'s expansion.' },
  { stageId: 12, progress: 82, title: 'Megastructures Fail', message: 'The machines around the solar system break apart in the red light.' },
  { stageId: 12, progress: 90, title: 'Envelope Ejection', message: 'The Sun sheds its outer layers into a glowing nebula.' },
  { stageId: 12, progress: 96, title: 'White Dwarf', message: 'A small hot remnant remains where the Sun once ruled.' },
  { stageId: 12, progress: 100, title: 'After the Sun', message: 'The solar system is gone, leaving only a fading stellar ember.' },

  // Stage 13 — Stelliferous End
  { stageId: 13, progress: 0, title: 'The Long Stellar Era', message: 'For ages, stars continue to burn across the universe.' },
  { stageId: 13, progress: 10, title: 'Star Formation Slows', message: 'Gas becomes harder to gather into new stars.' },
  { stageId: 13, progress: 25, title: 'Bright Stars Fade First', message: 'The largest and bluest stars vanish from the sky.' },
  { stageId: 13, progress: 50, title: 'Old Stars Remain', message: 'Small, dim stars become the last steady lights of the universe.' },
  { stageId: 13, progress: 75, title: 'The Last Red Dwarfs', message: 'The smallest stars burn slowly, then finally exhaust their fuel.' },
  { stageId: 13, progress: 90, title: 'No New Dawn', message: 'The universe no longer has enough fuel to keep making stars.' },
  { stageId: 13, progress: 100, title: 'Starlight Ends', message: 'The age of shining stars gives way to the age of remnants.' },

  // Stage 14 — Degenerate Era
  { stageId: 14, progress: 0, title: 'Degenerate Era', message: 'The stars are gone. Their remnants drift through a colder universe.' },
  { stageId: 14, progress: 10, title: 'White Dwarfs Cool', message: 'Once-bright stellar cores slowly fade toward darkness.' },
  { stageId: 14, progress: 25, title: 'Dead Systems Drift', message: 'Frozen worlds and stellar remnants wander through empty space.' },
  { stageId: 14, progress: 50, title: 'Galaxies Loosen', message: 'Without new stars, old structures slowly scatter and thin out.' },
  { stageId: 14, progress: 65, title: 'Matter Decays', message: 'Across unimaginable time, ordinary structures lose their meaning.' },
  { stageId: 14, progress: 75, title: 'Black Dwarfs', message: 'Former white dwarfs become cold, dark relics.' },
  { stageId: 14, progress: 90, title: 'Black Holes Remain', message: 'The most persistent objects are now the black holes.' },
  { stageId: 14, progress: 100, title: 'Only the Deepest Wells', message: 'Gravity\'s darkest survivors inherit the universe.' },

  // Stage 15 — Black Hole Era
  { stageId: 15, progress: 0, title: 'Black Hole Era', message: 'Almost everything that once shone has vanished or fallen into darkness.' },
  { stageId: 15, progress: 10, title: 'Dark Survivors', message: 'Black holes remain as the last massive landmarks.' },
  { stageId: 15, progress: 25, title: 'Slow Spirals', message: 'Some black holes drift together over impossible timescales.' },
  { stageId: 15, progress: 40, title: 'Merger', message: 'Two black holes become one, sending ripples through spacetime.' },
  { stageId: 15, progress: 58, title: 'Fewer, Larger', message: 'The number of black holes falls while their average mass grows.' },
  { stageId: 15, progress: 75, title: 'Lonely Horizons', message: 'Only isolated giants remain in the dark.' },
  { stageId: 15, progress: 88, title: 'Hawking Radiation', message: 'Even black holes are not perfectly eternal.' },
  { stageId: 15, progress: 96, title: 'Final Evaporation', message: 'The last dark horizons begin to shrink into faint radiation.' },
  { stageId: 15, progress: 100, title: 'Black Holes End', message: 'The deepest objects in the universe finally disappear.' },

  // Stage 16 — The End
  { stageId: 16, progress: 0, title: 'The Dark Era', message: 'The last black hole prepares to vanish.' },
  { stageId: 16, progress: 10, title: 'Final Flash', message: 'A final burst of radiation fades into empty space.' },
  { stageId: 16, progress: 25, title: 'No Bound Structures', message: 'No stars, no planets, no galaxies remain.' },
  { stageId: 16, progress: 40, title: 'Rare Particles', message: 'Only sparse particles and faint radiation drift through the dark.' },
  { stageId: 16, progress: 60, title: 'Distances Lose Meaning', message: 'Everything is too far apart to gather again.' },
  { stageId: 16, progress: 75, title: 'Memory Echo', message: 'For an instant, the shapes of galaxies and worlds seem to return.' },
  { stageId: 16, progress: 88, title: 'Almost Nothing', message: 'The universe is cold, dilute, and nearly silent.' },
  { stageId: 16, progress: 100, title: 'The End', message: 'The universe does not end with fire, but with distance, silence, and forgetting.' },
];

export function getLogsForStage(stageId: number): StageLog[] {
  return STAGE_LOGS.filter((l) => l.stageId === stageId);
}
