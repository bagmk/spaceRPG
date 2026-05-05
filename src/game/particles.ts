export const STAGE_PARTICLES: Record<number, string[]> = {
  1: ['Spacetime', 'Vacuum', 'Quantum Foam', 'Inflaton'],
  2: ['Quark', 'Antiquark', 'Gluon', 'Lepton', 'Photon'],
  3: ['Up Quark', 'Down Quark', 'Strange Quark', 'Gluon', 'Photon', 'Neutrino'],
  4: ['Proton', 'Neutron', 'Hydrogen-1', 'Helium-4', 'Lithium-7', 'Deuterium'],
  5: ['Electron', 'Photon (CMB)', 'Hydrogen', 'Helium'],
  6: ['Hydrogen', 'Dark Matter', 'Cold Dust'],
  7: ['H₂', 'Pop III Star', 'Stellar Wind', 'Carbon', 'Oxygen', 'Iron'],
  8: ['UV Photon', 'Ionized H', 'Quasar Beam'],
  9: ['Galaxy', 'Halo', 'Filament', 'Quasar'],
  10: ['Asteroid', 'Dust', 'Planetesimal', 'Moon', 'Earth', 'Mars'],
  11: ['Water', 'RNA', 'Cell', 'Multicellular', 'Mammal', 'Civilization'],
  12: ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'],
  13: ['White Dwarf', 'Neutron Star', 'Iron Star'],
  14: ['Decaying Proton', 'Iron Atom', 'Quantum Tunnel'],
  15: ['Hawking Quantum', 'Photon Pair', 'Information'],
  16: ['Vacuum Fluctuation', 'Boltzmann Brain', 'Final Photon'],
};

type SolarPhase =
  | 'pre_stellar'
  | 't_tauri'
  | 'planetesimals'
  | 'inner_planets'
  | 'outer_planets'
  | 'late_bombardment'
  | 'stable'
  | 'first_water'
  | 'civ_preview';

const STAGE_10_PHASE_POOLS: Record<SolarPhase, string[]> = {
  pre_stellar: ['Dust', 'Gas', 'Hydrogen'],
  t_tauri: ['Photon', 'Solar Wind'],
  planetesimals: ['Planetesimal', 'Asteroid', 'Rock'],
  inner_planets: ['Mercury', 'Venus', 'Earth', 'Mars'],
  outer_planets: ['Jupiter', 'Saturn', 'Uranus', 'Neptune'],
  late_bombardment: ['Meteor', 'Comet', 'Lava'],
  stable: ['Orbit', 'Asteroid Belt', 'Pluto'],
  first_water: ['Water', 'Atmosphere', 'Ocean'],
  civ_preview: ['City Light', 'Civilization', 'Smoke'],
};

function getSolarPhase(progress01: number): SolarPhase {
  if (progress01 < 0.1) return 'pre_stellar';
  if (progress01 < 0.25) return 't_tauri';
  if (progress01 < 0.4) return 'planetesimals';
  if (progress01 < 0.55) return 'inner_planets';
  if (progress01 < 0.7) return 'outer_planets';
  if (progress01 < 0.8) return 'late_bombardment';
  if (progress01 < 0.9) return 'stable';
  if (progress01 < 0.95) return 'first_water';
  return 'civ_preview';
}

export const PARTICLE_DEFINITIONS: Record<string, string> = {
  Spacetime: 'The fabric that lets distance and time exist at all.',
  Vacuum: 'Not empty nothingness, but a restless quantum field.',
  'Quantum Foam': 'Tiny fluctuations in the earliest universe.',
  Inflaton: 'The hypothetical field that drove cosmic inflation.',
  Quark: 'A fundamental particle that helps build protons and neutrons.',
  Antiquark: 'The antimatter partner of a quark.',
  Gluon: 'The force carrier that binds quarks together.',
  Lepton: 'A lightweight particle family that includes the electron.',
  Photon: 'A particle of light.',
  'Up Quark': 'One of the light quarks found inside protons.',
  'Down Quark': 'A light quark that teams up with up quarks in matter.',
  'Strange Quark': 'A heavier quark common in extreme energies.',
  Neutrino: 'A ghostly particle that barely interacts with matter.',
  Proton: 'A positively charged particle in atomic nuclei.',
  Neutron: 'A neutral particle in atomic nuclei.',
  'Hydrogen-1': 'Ordinary hydrogen, the universe’s most common atom.',
  'Helium-4': 'A major relic of the Big Bang, common across the cosmos.',
  'Lithium-7': 'A rare light element formed in early nucleosynthesis.',
  Deuterium: 'Heavy hydrogen with one proton and one neutron.',
  Electron: 'The particle that orbits atomic nuclei.',
  'Photon (CMB)': 'Ancient light released when the universe first became transparent.',
  Hydrogen: 'The simplest and most abundant element in the universe.',
  Helium: 'The second-most common element, forged early.',
  'Dark Matter': 'Invisible mass inferred from its gravitational pull.',
  'Cold Dust': 'Fine material drifting through the dark ages of space.',
  'H₂': 'A hydrogen molecule, the cold fuel of star birth.',
  'Pop III Star': 'One of the first stars, massive and short-lived.',
  'Stellar Wind': 'Fast streams of particles blown from a star.',
  Carbon: 'A heavy element forged inside stars.',
  Oxygen: 'A life-friendly element created in stellar cores.',
  Iron: 'A heavy stellar ash that marks the end of easy fusion.',
  'UV Photon': 'Energetic light that can ionize hydrogen.',
  'Ionized H': 'Hydrogen stripped of its electron.',
  'Quasar Beam': 'Radiation from matter falling into a supermassive black hole.',
  Galaxy: 'A vast system of stars, gas, dust, and dark matter.',
  Halo: 'A galaxy’s extended dark-matter envelope.',
  Filament: 'A thread in the large-scale cosmic web.',
  Quasar: 'An intensely bright galactic core powered by a black hole.',
  Asteroid: 'A rocky body orbiting a star.',
  Dust: 'Fine solid grains that help build planets.',
  Planetesimal: 'A young building block of planets.',
  Moon: 'A natural satellite orbiting a planet.',
  Earth: 'A rocky world with liquid water and life.',
  Mars: 'A cold, dusty world beyond Earth.',
  Water: 'A molecule essential to life as we know it.',
  RNA: 'A molecule that can store information and catalyze reactions.',
  Cell: 'The basic structural unit of life.',
  Multicellular: 'Life made of many cooperating cells.',
  Mammal: 'A warm-blooded vertebrate with hair and milk.',
  Civilization: 'Organized intelligent life shaping a world.',
  Mercury: 'The innermost planet of the solar system.',
  Venus: 'A hot, cloud-wrapped neighbor of Earth.',
  Jupiter: 'The largest planet in the solar system.',
  Saturn: 'A gas giant famous for its rings.',
  Uranus: 'An ice giant tilted on its side.',
  Neptune: 'A deep blue ice giant in the outer solar system.',
  Pluto: 'A distant dwarf world once counted as a planet.',
  'White Dwarf': 'A dense stellar remnant left after a Sun-like star dies.',
  'Neutron Star': 'A collapsed stellar core of extreme density.',
  'Iron Star': 'A far-future remnant imagined after immense cooling.',
  'Decaying Proton': 'A proton imagined to vanish in the deep future.',
  'Iron Atom': 'Matter lingering in the degenerate era.',
  'Quantum Tunnel': 'A probability-driven leap through a barrier.',
  'Hawking Quantum': 'Radiation emitted by an evaporating black hole.',
  'Photon Pair': 'Two linked photons emerging from energetic processes.',
  Information: 'The trace of order carried through physical change.',
  'Vacuum Fluctuation': 'A fleeting quantum event in seemingly empty space.',
  'Boltzmann Brain': 'A hypothetical mind arising from random fluctuation.',
  'Final Photon': 'A last whisper of light in a dying cosmos.',
  Gas: 'Diffuse material in the young solar nebula.',
  'Solar Wind': 'Charged particles streaming from a young star.',
  Rock: 'Solid material gathering into larger bodies.',
  Meteor: 'A bright incoming fragment crossing a planet’s sky.',
  Comet: 'An icy body carrying volatile material through orbit.',
  Lava: 'Molten rock exposed by heavy impacts.',
  Orbit: 'A stable path around a central mass.',
  'Asteroid Belt': 'A ring of leftover rocky bodies between Mars and Jupiter.',
  Atmosphere: 'A layer of gas held around a world by gravity.',
  Ocean: 'A broad body of liquid water on a planetary surface.',
  'City Light': 'A tiny artificial glow on the night side of a world.',
  Smoke: 'A fragile sign of chemistry, fire, and activity.',
};

export function pickParticleName(stageId: number, progress01 = 0): string {
  const pool =
    stageId === 10
      ? STAGE_10_PHASE_POOLS[getSolarPhase(progress01)]
      : STAGE_PARTICLES[stageId] ?? STAGE_PARTICLES[1];
  return pool[Math.floor(Math.random() * pool.length)] ?? 'Particle';
}

const ENTROPY_WEIGHT_GROUPS: Array<{ names: string[]; weight: number }> = [
  {
    weight: 1,
    names: [
      'Vacuum',
      'Photon',
      'Gluon',
      'Lepton',
      'Neutrino',
      'Dust',
      'Gas',
      'Rock',
      'Orbit',
    ],
  },
  {
    weight: 2,
    names: [
      'Spacetime',
      'Quantum Foam',
      'Inflaton',
      'Quark',
      'Antiquark',
      'Up Quark',
      'Down Quark',
      'Strange Quark',
      'Electron',
      'UV Photon',
      'Photon (CMB)',
      'Hawking Quantum',
      'Photon Pair',
      'Final Photon',
      'Vacuum Fluctuation',
    ],
  },
  {
    weight: 3,
    names: [
      'Proton',
      'Neutron',
      'Hydrogen-1',
      'Helium-4',
      'Lithium-7',
      'Deuterium',
      'Hydrogen',
      'Helium',
      'H₂',
      'Ionized H',
      'Carbon',
      'Oxygen',
      'Iron',
      'Iron Atom',
      'Decaying Proton',
      'Quantum Tunnel',
    ],
  },
  {
    weight: 5,
    names: [
      'Dark Matter',
      'Cold Dust',
      'Stellar Wind',
      'Quasar Beam',
      'Halo',
      'Filament',
      'Solar Wind',
      'Meteor',
      'Comet',
      'Lava',
      'Atmosphere',
      'Ocean',
    ],
  },
  {
    weight: 8,
    names: [
      'Pop III Star',
      'Galaxy',
      'Quasar',
      'Asteroid',
      'Planetesimal',
      'Moon',
      'Mercury',
      'Venus',
      'Earth',
      'Mars',
      'Jupiter',
      'Saturn',
      'Uranus',
      'Neptune',
      'Pluto',
      'Asteroid Belt',
      'White Dwarf',
      'Neutron Star',
      'Iron Star',
      'Information',
    ],
  },
  {
    weight: 13,
    names: [
      'Water',
      'RNA',
      'Cell',
      'Multicellular',
      'Mammal',
      'Civilization',
      'City Light',
      'Smoke',
      'Boltzmann Brain',
    ],
  },
];

export function getParticleEntropyBonus(stageId: number, particleName: string, isCrit = false): number {
  const group = ENTROPY_WEIGHT_GROUPS.find((entry) => entry.names.includes(particleName));
  const particleWeight = group?.weight ?? 1;
  const stageWeight = Math.max(1, Math.ceil(stageId / 5));
  const critWeight = isCrit ? 2 : 1;
  return Math.ceil(particleWeight * stageWeight * critWeight);
}
