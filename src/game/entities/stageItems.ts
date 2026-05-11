/**
 * Stage entity definitions.
 *
 * Costs are calibrated from the stage threshold and rarity so the data stays
 * readable while balance knobs remain in one place.
 */

import type { EndingId } from '../types';
import type { EntityEffectType, EntityGlyph, EntityRarity, EntityVisual, PurchasedEntityEntry, StageEntity } from './types';

type StageId = keyof typeof STAGE_THRESHOLDS;

interface EntitySpec {
  name: string;
  formula: string;
  description: string;
  rarity: EntityRarity;
  effect: {
    type: EntityEffectType;
    value: number;
    isFlat?: boolean;
  };
  endingId?: EndingId;
  aliases?: string[];
}

const STAGE_THRESHOLDS = {
  1: 1_725,
  2: 3_800,
  3: 52_000,
  4: 750_000,
  5: 1.1e7,
  6: 1.6e8,
  7: 2.4e9,
  8: 3.7e10,
  9: 6e11,
  10: 1e13,
  11: 1.8e14,
  12: 3.5e15,
  13: 6.5e16,
  14: 1.3e18,
  15: 2.7e19,
  16: 5.6e20,
} as const;

const STAGE_ACCENTS: Record<StageId, string> = {
  1: '#ff6b3d',
  2: '#ff8a47',
  3: '#ff6a45',
  4: '#ffb45a',
  5: '#63b7ff',
  6: '#4e6188',
  7: '#eef3ff',
  8: '#9bd9ff',
  9: '#6d8fff',
  10: '#f7c86e',
  11: '#68d8a4',
  12: '#ff633f',
  13: '#8a90a8',
  14: '#8e69c9',
  15: '#857299',
  16: '#b0b5c7',
};

// Budget targets (total cost to max all items vs stage threshold):
// S1 (4C): ~20×T  S2 (4C+4R): ~28×T  S3 (4C+4R+4E): ~36×T
// S4-15 (4C+4R+4E+2L): ~38×T  S16 (4C+3R+2E+5L): ~36×T
const BASE_COST_FACTORS: Record<EntityRarity, number> = {
  common: 0.07,
  rare: 0.08,
  epic: 0.25,
  legendary: 1.2,
};

const COST_SCALING: Record<EntityRarity, number> = {
  common: 1.12,
  rare: 1.18,
  epic: 1.28,
  legendary: 1.55,
};

const MAX_COUNTS: Record<EntityRarity, number> = {
  common: 20,
  rare: 10,
  epic: 5,
  legendary: 2,
};

const RARITY_SIZE: Record<EntityRarity, EntityVisual['size']> = {
  common: 'tiny',
  rare: 'small',
  epic: 'medium',
  legendary: 'large',
};

// Color tint blended with the stage accent — gives each rarity a distinct hue feel
const RARITY_TINT: Record<EntityRarity, { hex: string; amount: number }> = {
  common:    { hex: '#888888', amount: 0.08 }, // slight grey muting
  rare:      { hex: '#44aaff', amount: 0.16 }, // cool blue shift
  epic:      { hex: '#cc44ff', amount: 0.26 }, // vivid purple
  legendary: { hex: '#ffcc22', amount: 0.36 }, // warm gold
};

// Non-flat effect values are scaled up by rarity so legendary/epic feel impactful
const RARITY_EFFECT_SCALE: Record<EntityRarity, number> = {
  common:    1.0,
  rare:      1.0,
  epic:      1.8,
  legendary: 3.0,
};

function blendHex(base: string, tint: string, t: number): string {
  const r1 = parseInt(base.slice(1, 3), 16);
  const g1 = parseInt(base.slice(3, 5), 16);
  const b1 = parseInt(base.slice(5, 7), 16);
  const r2 = parseInt(tint.slice(1, 3), 16);
  const g2 = parseInt(tint.slice(3, 5), 16);
  const b2 = parseInt(tint.slice(5, 7), 16);
  return (
    '#' +
    Math.round(r1 * (1 - t) + r2 * t).toString(16).padStart(2, '0') +
    Math.round(g1 * (1 - t) + g2 * t).toString(16).padStart(2, '0') +
    Math.round(b1 * (1 - t) + b2 * t).toString(16).padStart(2, '0')
  );
}

function item(
  name: string,
  formula: string,
  description: string,
  rarity: EntityRarity,
  type: EntityEffectType,
  value: number,
  isFlat = false,
  endingId?: EndingId,
): EntitySpec {
  return {
    name,
    formula,
    description,
    rarity,
    effect: {
      type,
      value,
      ...(isFlat ? { isFlat: true } : {}),
    },
    ...(endingId ? { endingId } : {}),
  };
}

function withAliases(spec: EntitySpec, aliases: string[]): EntitySpec {
  return { ...spec, aliases };
}

function slugify(value: string): string {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return slug || 'entity';
}

function motionFor(rarity: EntityRarity, index: number): EntityVisual['motion'] {
  if (rarity === 'common') return 'orbit';
  if (rarity === 'rare') return index % 2 === 0 ? 'orbit' : 'drift';
  if (rarity === 'epic') return index % 2 === 0 ? 'spin' : 'pulse';
  return 'float';
}

function glyphFor(stageId: StageId, spec: EntitySpec): EntityGlyph {
  const name = spec.name.toLowerCase();
  const formula = spec.formula.toLowerCase();

  if (spec.endingId === 'bounce') return 'bounce';
  if (spec.endingId === 'big_crunch') return 'singularity';
  if (spec.endingId === 'big_rip') return 'wave';
  if (spec.endingId === 'heat_death') return 'entropy';
  if (spec.endingId === 'vacuum_decay') return 'quantum';

  if (name.includes('black hole') || name.includes(' bh') || name.includes('bh ') || formula.includes('⚫')) {
    return 'black_hole';
  }
  if (name.includes('supernova') || name.includes('nova') || name.includes('flash') || name.includes('eruption')) {
    return 'supernova';
  }
  if (
    name.includes('white dwarf') ||
    name.includes('brown dwarf') ||
    name.includes('black dwarf') ||
    name.includes('neutron star') ||
    name.includes('magnetar') ||
    name.includes('pulsar') ||
    name.includes('remnant') ||
    name.includes('graveyard')
  ) {
    return 'remnant';
  }
  if (name.includes('star') || name.includes('sun') || name.includes('fusion') || name.includes('carbon') || name.includes('oxygen')) {
    return 'star';
  }
  if (
    name.includes('galaxy') ||
    name.includes('galactic') ||
    name.includes('spiral') ||
    name.includes('quasar') ||
    name.includes('cosmic web') ||
    name.includes('cluster') ||
    name.includes('agn')
  ) {
    return 'galaxy';
  }
  if (name.includes('satellite') || name.includes('probe') || name.includes('lander') || name.includes('ark')) return 'planet';
  if (name.includes('telescope') || name.includes('observatory')) return 'radiation';
  if (
    name.includes('planet') ||
    name.includes('moon') ||
    name.includes('asteroid') ||
    name.includes('comet') ||
    name.includes('disk') ||
    name.includes('core') ||
    name.includes('zone')
  ) {
    return 'planet';
  }
  if (name.includes('water') || formula.includes('h₂o')) return 'water';
  if (name.includes('dna')) return 'dna';
  if (name.includes('neuron') || name.includes('brain')) return 'neuron';
  if (name.includes('cell') || name.includes('eukaryote') || name.includes('prokaryote') || name.includes('membrane')) {
    return 'cell';
  }
  if (
    name.includes('life') ||
    name.includes('amino') ||
    name.includes('rna') ||
    name.includes('photosynthesis') ||
    name.includes('fish') ||
    name.includes('plant') ||
    name.includes('sapiens') ||
    stageId === 11
  ) {
    return 'life';
  }
  if (name.includes('atom') || name.includes('positronium')) return 'atom';
  if (name.includes('molecule') || name.includes('molecular') || name.includes('hydrogen cloud')) return 'molecule';
  if (
    name.includes('proton') ||
    name.includes('neutron') ||
    name.includes('deuterium') ||
    name.includes('tritium') ||
    name.includes('helium') ||
    name.includes('lithium') ||
    name.includes('beryllium') ||
    name.includes('baryon') ||
    name.includes('pion')
  ) {
    return 'nucleus';
  }
  if (name.includes('plasma') || name.includes('qgp')) return 'plasma';
  if (name.includes('photon') || name.includes('gamma') || name.includes('radiation') || name.includes('cmb')) return 'radiation';
  if (name.includes('cloud') || name.includes('gas') || name.includes('nebula') || name.includes('envelope')) return 'cloud';
  if (name.includes('halo') || name.includes('dark matter') || name.includes('clump') || name.includes('filament')) return 'halo';
  if (name.includes('void') || name.includes('darkness') || name.includes('vacuum') || name.includes('de sitter')) return 'void';
  if (
    name.includes('entropy') ||
    name.includes('decay') ||
    name.includes('annihilation') ||
    name.includes('washout') ||
    name.includes('equilibrium')
  ) {
    return 'entropy';
  }
  if (name.includes('quark') || name.includes('color charge') || name.includes('flux tube')) return 'quark';
  if (name.includes('electron') || name.includes('positron') || name.includes('neutrino') || name.includes('muon')) return 'lepton';
  if (name.includes('gluon') || name.includes('boson') || name.includes('higgs') || name.includes('graviton')) return 'boson';
  if (
    name.includes('wave') ||
    name.includes('oscillation') ||
    name.includes('front') ||
    name.includes('signal') ||
    name.includes('string') ||
    name.includes('slingshot')
  ) {
    return 'wave';
  }
  if (
    name.includes('field') ||
    name.includes('symmetry') ||
    name.includes('monopole') ||
    name.includes('wormhole') ||
    name.includes('limit') ||
    name.includes('surface')
  ) {
    return 'field';
  }
  if (name.includes('antiquark') || name.includes('antimatter')) return 'antiparticle';
  if (stageId <= 3 || name.includes('quantum') || name.includes('fluctuation')) return 'quantum';

  return 'particle';
}

function stage(stageId: StageId, specs: EntitySpec[]): StageEntity[] {
  const threshold = STAGE_THRESHOLDS[stageId];
  const color = STAGE_ACCENTS[stageId];

  return specs.map((spec, index) => {
    const tint = RARITY_TINT[spec.rarity];
    const entityColor = blendHex(color, tint.hex, tint.amount);
    // Multiplier effects are NOT scaled up by rarity — they compound multiplicatively across stages.
    // Auto, click, crit, and time effects get rarity scaling to make higher rarities feel impactful.
    const effectScale = spec.effect.isFlat || spec.effect.type === 'multiplier' ? 1 : RARITY_EFFECT_SCALE[spec.rarity];
    return {
      id: `s${stageId}_${String(index + 1).padStart(2, '0')}_${slugify(spec.name)}`,
      stageId,
      name: spec.name,
      formula: spec.formula,
      description: spec.description,
      rarity: spec.rarity,
      baseCost: Math.ceil(threshold * BASE_COST_FACTORS[spec.rarity]),
      costScaling: COST_SCALING[spec.rarity],
      maxCount: MAX_COUNTS[spec.rarity],
      effect: { ...spec.effect, value: spec.effect.value * effectScale },
      visual: {
        symbol: spec.formula,
        glyph: glyphFor(stageId, spec),
        color: entityColor,
        glowColor: entityColor,
        size: RARITY_SIZE[spec.rarity],
        motion: motionFor(spec.rarity, index),
      },
      ...(spec.endingId ? { endingId: spec.endingId } : {}),
      ...(spec.aliases ? { aliases: spec.aliases } : {}),
    };
  });
}

// Item counts per stage: S1=3C, S2=4C+4R, S3=4C+4R+4E, S4-15=4C+4R+4E+2L, S16=4C+3R+2E+5L(endings)
// Effect distribution: each C/R/E group has 1 auto + 1 click + 1 crit + 1 time; L = multiplier only
// Stage 1 exception: 3 commons only (auto/click/crit), no time
export const STAGE_ENTITIES: StageEntity[] = [
  // ── Stage 1: Inflation (3 common: auto/click/crit) ─────────────────────────
  ...stage(1, [
    item('Quantum Fluctuation', 'δE',  'Vacuum energy ripple that seeds all future structure.',   'common', 'auto',  1.0),
    item('False Vacuum Bubble', '⊙',   'Unstable vacuum pocket releasing its pent-up energy.',   'common', 'click', 7.5),
    item('Inflaton Surge',      'φ̈',  'Spike in the inflaton field amplifying burst power.',     'common', 'crit',  0.5, true),
  ]),

  // ── Stage 2: Baryogenesis (4C + 4R) ────────────────────────────────────────
  ...stage(2, [
    item('Up Quark',            'u',   'Light quark appearing twice in every proton.',            'common', 'auto',  0.8),
    item('Down Quark',          'd',   'Light quark shared by protons and neutrons.',             'common', 'click', 7.5),
    item('Electron',            'e⁻',  'Stable lepton that will orbit every future atom.',        'common', 'crit',  0.3, true),
    item('Neutrino',            'ν',   'Nearly massless lepton crossing matter undisturbed.',     'common', 'time',  5.0),
    item('Gluon',               'g',   'Color-force carrier binding quarks inside hadrons.',      'rare',   'auto',  2.0),
    item('Strange Quark',       's',   'Second-generation quark carrying strangeness.',           'rare',   'click', 10.0),
    item('W Boson',             'W±',  'Weak-force carrier enabling quark flavor changes.',       'rare',   'crit',  0.5, true),
    item('CP Violation Pocket', 'CP̸', 'Tiny asymmetry that lets matter outlast antimatter.',    'rare',   'time',  8.0),
  ]),

  // ── Stage 3: Quark-Gluon Plasma (4C + 4R + 4E) ─────────────────────────────
  ...stage(3, [
    item('Free Quark',         'q',    'Quark still unconfined in the hot plasma sea.',           'common', 'auto',  1.0),
    item('Gluon Plasma',       'gg',   'Dense bath of unbound color-force carriers.',             'common', 'click', 7.5),
    item('Pion',               'π',    'Light meson mediating the residual strong force.',        'common', 'crit',  0.4, true),
    item('Muon',               'μ',    'Heavy electron cousin briefly abundant in the plasma.',   'common', 'time',  1.5),
    item('Plasma Vortex',      '⟳',   'Swirling hot droplet of near-perfect QCD fluid.',        'rare',   'auto',  3.0),
    item('Charm Quark',        'c',    'Heavy second-generation quark in the plasma.',            'rare',   'click', 10.0),
    item('Kaon',               'K',    'Strange meson associated with CP-violation channels.',    'rare',   'crit',  0.6, true),
    item('Bottom Quark',       'b',    'Massive quark that seeds flavor oscillations.',           'rare',   'time',  2.0),
    item('Color Flux Tube',    '≡',    'Elastic color-field string linking confined quarks.',     'epic',   'auto',  4.0),
    item('Top Quark Decay',    't→',   'Heaviest quark — vanishes almost the instant it forms.', 'epic',   'click', 17.0),
    item('QCD Phase Boundary', '─',    'Threshold where strongly-coupled matter changes phase.',  'epic',   'crit',  1.2, true),
    item('Confinement Onset',  '⊂⊃',  'Quarks begin locking permanently inside hadrons.',       'epic',   'time',  3.0),
  ]),

  // ── Stage 4: Nucleosynthesis (4C + 4R + 4E + 2L) ───────────────────────────
  ...stage(4, [
    item('Proton',               'p⁺',  'Stable baryon that anchors all future hydrogen.',        'common', 'auto',  1.0),
    item('Neutron',              'n',   'Neutral baryon that fuses into light nuclei.',            'common', 'click', 7.5),
    item('Deuterium',            'D',   'Hydrogen-2, the first stable bridge in fusion chains.',  'common', 'crit',  0.4, true),
    item('Gamma Ray',            'γ',   'High-energy photon released by each fusion step.',       'common', 'time',  1.5),
    item('Tritium',              'T',   'Radioactive hydrogen-3 feeding helium synthesis.',       'rare',   'auto',  2.0),
    item('Helium-3',             '³He', 'Light helium isotope in the proton-proton chain.',       'rare',   'click', 10.0),
    item('Beryllium-7',          '⁷Be', 'Unstable stepping-stone toward lithium-7.',              'rare',   'crit',  0.6, true),
    item('Helium-4',             '⁴He', 'Stable helium locking in primordial element ratios.',    'rare',   'time',  2.0),
    item('Primordial Fireball',  '☀',   'Roiling nuclear furnace of the infant universe.',        'epic',   'auto',  8.0),
    item('Lithium-7',            '⁷Li', 'Heaviest nucleus forged in the big-bang furnace.',       'epic',   'click', 17.0),
    item('Neutrino Freeze-out',  'ν✕',  'Neutrinos stop exchanging with the cooling plasma.',     'epic',   'crit',  1.5, true),
    item('Neutron-Proton Ratio', 'n/p', 'The 1:7 ratio that fixes primordial element yields.',    'epic',   'time',  4.0),
    item('BBN Completion',       '★',   'Light-element synthesis locks in, never to repeat.',     'legendary', 'multiplier', 50.0),
    item('Fusion Window',        '⊕',   'Three-minute window that decides all atomic history.',   'legendary', 'multiplier', 50.0),
  ]),

  // ── Stage 5: Recombination (4C + 4R + 4E + 2L) ─────────────────────────────
  ...stage(5, [
    item('Hydrogen Atom',             'H',    'Proton captures electron and becomes neutral.',         'common', 'auto',  1.5),
    item('Free Electron',             'e⁻',   'Last stray charge before the neutral gas era.',        'common', 'click', 7.5),
    item('Helium Atom',               'He',   'Helium nucleus pulls in both electrons.',              'common', 'crit',  0.4, true),
    item('CMB Photon',                'γ_r',  'Light set free as the fog of plasma clears.',          'common', 'time',  2.0),
    item('Hydrogen Cloud',            'H₂',   'Neutral hydrogen gathering into the first clouds.',    'rare',   'auto',  3.0),
    item('Photon Decoupling',         'γ↗',   'Light separates from matter and streams freely.',      'rare',   'click', 10.0),
    item('Baryon Acoustic Oscillation','◌',   'Frozen sound waves seeding all large structure.',      'rare',   'crit',  0.8, true),
    item('Plasma to Gas',             '∽',    'Ionized plasma cools into transparent neutral gas.',   'rare',   'time',  2.0),
    item('Dark Matter Halo',          '○',    'Invisible gravity well shaping where galaxies form.',  'epic',   'auto',  6.0),
    item('Density Perturbation',      'δρ',   'Tiny overdensity seeding the first structures.',       'epic',   'click', 17.0),
    item('Last Scattering Surface',   '═',    'Shell from which CMB photons last scattered.',         'epic',   'crit',  2.0, true),
    item('CMB Anisotropy',            '≈',    'Minute temperature contrast imprinted in relic light.','epic',   'time',  4.0),
    item('Cosmic Transparency',       'γ∞',   'The universe finally becomes transparent to light.',   'legendary', 'multiplier', 50.0),
    item('Structure Seed',            'δ₀',   'Primordial perturbation that grows into every galaxy.','legendary', 'multiplier', 50.0),
  ]),

  // ── Stage 6: Cosmic Dark Age (4C + 4R + 4E + 2L) ───────────────────────────
  ...stage(6, [
    item('Cold Hydrogen',         'H°',   'Neutral hydrogen drifting in starless darkness.',        'common', 'auto',  1.5),
    item('21cm Signal',           '₂₁',   'Hydrogen spin-flip line tracing the cold dark gas.',    'common', 'click', 7.5),
    item('Dark Matter Filament',  '╌',    'Invisible scaffold along which gas slowly flows.',       'common', 'crit',  0.4, true),
    item('Cold Gas Cloud',        '≋',    'Cooling cloud beginning its long collapse inward.',      'common', 'time',  2.0),
    item('Molecular Hydrogen',    'H₂*',  'Cooling molecule that lets gas shed heat and collapse.', 'rare',   'auto',  5.0),
    item('Protogalactic Cloud',   '○',    'Large gas reservoir on its way to becoming a galaxy.',  'rare',   'click', 10.0),
    item('Dark Matter Clump',     '●',    'Dense dark knot deepening the local gravity well.',      'rare',   'crit',  0.8, true),
    item('Gravitational Potential','Φ_g', 'Deepening well drawing gas into future star cradles.',  'rare',   'time',  3.0),
    item('Mini Halo',             '⊙',    'Small dark halo dense enough to cradle a first star.',  'epic',   'auto',  8.0),
    item('Baryonic Streaming',    'v_bs', 'Supersonic gas flow that delays the first stars.',      'epic',   'click', 17.0),
    item('Dark Energy Background','Λ',    'Vacuum energy quietly accelerating the expansion.',     'epic',   'crit',  2.0, true),
    item('Silk Damping',          'λ_d',  'Small-scale fluctuations erased by photon diffusion.',  'epic',   'time',  4.0),
    item('Gravitational Collapse','↓↓',   'Gravity finally overcomes pressure and ignites fate.',  'legendary', 'multiplier', 50.0),
    item('First Cosmic Dawn Seed','∘',    'The seed that will end darkness when it finally ignites.','legendary','multiplier',50.0),
  ]),

  // ── Stage 7: First Stars (4C + 4R + 4E + 2L) ───────────────────────────────
  ...stage(7, [
    item('Protostar',           '⊙',    'Contracting gas sphere heating toward ignition.',         'common', 'auto',  1.5),
    item('UV Photon',           'UV',   'Energetic photon that strips electrons from hydrogen.',   'common', 'click', 7.5),
    item('Main Sequence Star',  '★',    'Stable hydrogen-burning star in its long quiet phase.',  'common', 'crit',  0.5, true),
    item('Hydrogen Fusion',     'H→He', 'Four protons fuse into one helium in the stellar core.', 'common', 'time',  2.0),
    item('Oxygen',              'O',    'Helium capture on carbon produces oxygen.',               'rare',   'auto',  4.0),
    item('Stellar Wind',        '~~→',  'Particle stream blown outward from a hot stellar surface.','rare',  'click', 10.0),
    item('HII Region',          'HII',  'Cloud of ionized hydrogen glowing around hot stars.',    'rare',   'crit',  0.8, true),
    item('Carbon First',        'C',    'Triple-alpha marks the dawn of carbon chemistry.',        'rare',   'time',  3.0),
    item('Pop III Cluster',     '✦✦✦',  'Metal-free stars born together in the first generation.','epic',   'auto',  6.0),
    item('First Heavy Elements','Fe',   'Stellar cores forge elements beyond helium up to iron.', 'epic',   'click', 17.0),
    item('Stellar Feedback',    '⟲',   'Energy from stars reshaping the surrounding gas cloud.',  'epic',   'crit',  2.0, true),
    item('Supernova Precursor', '⚠★',  'Massive star nearing explosive gravitational collapse.',  'epic',   'time',  4.0),
    item('Pop III Supernova',   '☆→',  'First stars explode, seeding space with heavy elements.','legendary','multiplier',50.0),
    item('Pair Instability SN', '✸',   'Giant star destroyed entirely by gamma-pair creation.',   'legendary','multiplier',50.0),
  ]),

  // ── Stage 8: Reionization (4C + 4R + 4E + 2L) ──────────────────────────────
  ...stage(8, [
    item('Ionizing Photon',    'hν',    'Photon energetic enough to strip a hydrogen electron.',   'common', 'auto',  2.0),
    item('Ionized Hydrogen',   'H⁺',   'Hydrogen stripped of its electron by UV starlight.',      'common', 'click', 7.5),
    item('HII Bubble',         '○⁺',   'Expanding sphere of ionized gas around young stars.',     'common', 'crit',  0.5, true),
    item('Lyman Break',        'λ',    'Spectral dropout marking the edge of an HII region.',     'common', 'time',  2.0),
    item('Quasar',             '⬟',    'Blazing accreting black hole punching ionization far.',   'rare',   'auto',  5.0),
    item('Early Galaxy',       '🌀',   'Young galaxy pouring out a torrent of ionizing light.',  'rare',   'click', 10.0),
    item('Ionization Front',   '→→→',  'Boundary advancing through neutral gas like wildfire.',   'rare',   'crit',  0.8, true),
    item('X-Ray Background',   'Xγ',   'Hard X-ray photons pre-heating gas ahead of the front.', 'rare',   'time',  3.0),
    item('Metagalactic UV',    '⟿',   'Pervasive ultraviolet background keeping gas ionized.',   'epic',   'auto',  7.0),
    item('Bubble Merger',      '◎',    'Adjacent ionized regions merge into a transparent ocean.','epic',   'click', 17.0),
    item('Gunn-Peterson Trough','GP',  'Absence of neutral hydrogen confirming full reionization.','epic',  'crit',  2.0, true),
    item('Intergalactic Medium','IGM',  'Thin gas tracking the ionization state between galaxies.','epic',  'time',  4.0),
    item('Reionization Complete','✓',  'Most cosmic hydrogen is ionized — the universe clears.',  'legendary','multiplier',50.0),
    item('Epoch of Reionization','EoR','The great cosmic clearing that ended the dark ages.',     'legendary','multiplier',50.0),
  ]),

  // ── Stage 9: Galaxy Formation (4C + 4R + 4E + 2L) ──────────────────────────
  ...stage(9, [
    item('Dwarf Galaxy',          '🌀',  'Small galaxy holding millions of young stars.',           'common', 'auto',  2.0),
    item('Gas Accretion',         '↘',  'Cold gas stream flowing onto the galactic disk.',         'common', 'click', 7.5),
    item('Spiral Arm',            '⤵',  'Density wave seeding star formation along the disk.',     'common', 'crit',  0.5, true),
    item('Star Formation Cloud',  '★+', 'Molecular cloud collapsing into a new stellar cluster.',  'common', 'time',  2.0),
    item('Dark Matter Halo',      '○',  'Massive dark scaffold shaping the galactic potential.',   'rare',   'auto',  4.0),
    item('Galaxy Merger',         '⊗',  'Colliding galaxies stirring gas and triggering starbursts.','rare', 'click', 10.0),
    item('Galaxy Cluster',        '⊞',  'Gravitational city of hundreds of galaxies.',             'rare',   'crit',  0.8, true),
    item('Supermassive BH',       '⚫', 'Central black hole co-evolving with its host galaxy.',    'rare',   'time',  3.0),
    item('Active Galactic Nucleus','AGN','Accreting core outshining the entire host galaxy.',      'epic',   'auto',  7.0),
    item('Gravitational Lens',    '⊃⊂', 'Mass bending background light into arcs and rings.',     'epic',   'click', 17.0),
    item('Filamentary Structure', '⌇',  'Thread of dark matter and gas connecting galaxy nodes.',  'epic',   'crit',  2.0, true),
    item('Cosmic Web Node',       '✦',  'Filament junction at the heart of the large-scale web.',  'epic',   'time',  5.0),
    item('Cosmic Void',           '□',  'Vast underdense region spanning hundreds of megaparsecs.','legendary','multiplier',50.0),
    item('Large Scale Structure', 'LSS','The full web of filaments, nodes, and voids revealed.',   'legendary','multiplier',50.0),
  ]),

  // ── Stage 10: Solar System (4C + 4R + 4E + 2L) ─────────────────────────────
  ...stage(10, [
    item('Dust Grain',       '·',     'Silicate speck that begins the long road to planets.',     'common', 'auto',  1.5),
    item('Iron Core',        'Fe',    'Metal-rich center of a differentiated rocky world.',       'common', 'click', 7.5),
    item('Planetesimal',     '○',     'Kilometer-scale body built from countless dust grains.',   'common', 'crit',  0.4, true),
    item('Water Ice',        'H₂O',   'Frozen water delivered across the disk by comets.',        'common', 'time',  2.0),
    item('Rocky Planet',     '🪨',   'Silicate planet with a stable solid surface.',             'rare',   'auto',  4.0),
    item('Comet',            '☄',    'Icy body delivering volatiles and organics inward.',       'rare',   'click', 10.0),
    item('Asteroid Belt',    '⋯',    'Ring of leftover planetesimals that never merged.',        'rare',   'crit',  0.8, true),
    item('Gas Giant',        '♃',    'Hydrogen-helium giant whose gravity shapes the system.',   'rare',   'time',  2.0),
    item('Moon',             '☽',    'Satellite that stabilizes axial tilt and drives tides.',   'epic',   'auto',  6.0),
    item('Liquid Water',     'H₂O·', 'Stable surface solvent enabling complex chemistry.',       'epic',   'click', 17.0),
    item('Magnetic Field',   '⇌',    'Planetary shield deflecting harmful stellar wind.',        'epic',   'crit',  2.0, true),
    item('Goldilocks Zone',  '🌡',   'Orbital band where surface water stays liquid.',           'epic',   'time',  5.0),
    item('Sun',              '☀',    'G-type star whose steady glow powers an entire biosphere.','legendary','multiplier',50.0),
    item('Habitable World',  '⊕',    'A world where all the conditions for life align.',         'legendary','multiplier',50.0),
  ]),

  // ── Stage 11: Life on Earth (4C + 4R + 4E + 2L) ────────────────────────────
  ...stage(11, [
    item('Moon',              '🌕',     'Giant-impact debris that stabilized Earth\'s axial tilt.', 'common', 'auto',  2.0),
    item('Lipid Membrane',    '◯',     'Boundary separating inside chemistry from outside.',     'common', 'click', 7.5),
    item('RNA Molecule',      'RNA',    'Self-copying molecule that also acts as a catalyst.',    'common', 'crit',  0.5, true),
    item('DNA Helix',         '⌇',     'Durable double-helix carrying genetic memory forward.',  'common', 'time',  2.0),
    item('Prokaryote',        '〇',    'Simple cell without a nucleus, first true living thing.', 'rare',   'auto',  3.0),
    item('Photosynthesis',    '☀→O₂', 'Light-driven chemistry releasing oxygen into the air.',  'rare',   'click', 10.0),
    item('Cambrian Explosion','✳',     'Rapid burst of novel body plans in ancient seas.',       'rare',   'crit',  1.0, true),
    item('Eukaryote',         '⊙',     'Complex cell with internal organelles and a nucleus.',   'rare',   'time',  2.0),
    item('Multicellular Life','⋮',     'Cells specializing and cooperating as a single body.',   'epic',   'auto',  6.0),
    withAliases(
      item('Artificial Satellite','🛰',  'First machines orbit Earth and map the living planet.',  'epic',   'click', 17.0),
      ['s11_10_fish'],
    ),
    item('Neuron',            '⚡',    'Signal cell enabling rapid information processing.',     'epic',   'crit',  2.0, true),
    withAliases(
      item('Deep Space Probe',   'VGR',  'A tiny craft carrying Earth beyond the planets.',        'epic',   'time',  5.0),
      ['s11_12_plant'],
    ),
    withAliases(
      item('Homo Sapiens',       '🧬',   'A species that turns biology into culture and machines.', 'legendary','multiplier',50.0),
      ['s11_13_intelligence'],
    ),
    withAliases(
      item('Space Telescope',    '🔭',   'A clear eye above the atmosphere looking back in time.', 'legendary','multiplier',50.0),
      ['s11_14_homo_sapiens'],
    ),
  ]),

  // ── Stage 12: Death of Star (4C + 4R + 4E + 2L) ────────────────────────────
  ...stage(12, [
    item('Red Giant Envelope', '🔴',   'Outer stellar layers swelling past the inner planets.',   'common', 'auto',  2.0),
    item('Stellar Wind AGB',   '~~~→', 'Late-stage star shedding its outer mass into space.',    'common', 'click', 7.5),
    item('Carbon-O Core',      'C/O',  'Compact carbon-oxygen core left by spent fusion.',        'common', 'crit',  0.5, true),
    item('Helium Flash',       '⚡He', 'Runaway helium ignition in the compressed stellar core.', 'common', 'time',  2.0),
    item('Planetary Nebula',   'PN',   'Glowing gas shell cast off by a dying solar-type star.',  'rare',   'auto',  4.0),
    item('Mass Transfer',      '→→',   'Binary companion steadily feeding the stellar remnant.',  'rare',   'click', 10.0),
    item('Degenerate Electron','e°',   'Crowded electrons obeying Pauli exclusion to resist.',   'rare',   'crit',  0.8, true),
    item('White Dwarf',        'WD',   'Electron-pressure-supported remnant cooling over eons.',  'rare',   'time',  3.0),
    item('Neutron Star',       'NS',   'Collapsed core dense as an atomic nucleus across miles.', 'epic',   'auto',  7.0),
    item('Nova Eruption',      'NOVA', 'Accreted hydrogen flash on a white dwarf surface.',       'epic',   'click', 17.0),
    item('Magnetar',           '⊛M',  'Neutron star with the strongest magnetic fields known.',  'epic',   'crit',  2.5, true),
    item('Gravitational Wave', '◌~',   'Spacetime ripples from accelerating compact remnants.',   'epic',   'time',  5.0),
    item('Type Ia Supernova',  'SNIa', 'White dwarf detonation used as a cosmic distance candle.','legendary','multiplier',50.0),
    item('Core Collapse SN',   'SNII', 'Massive stellar core implodes and rebounds outward.',     'legendary','multiplier',50.0),
  ]),

  // ── Stage 13: Stelliferous End (4C + 4R + 4E + 2L) ─────────────────────────
  ...stage(13, [
    item('Brown Dwarf',          '🟫',  'Failed star glowing only from gravitational collapse.',  'common', 'auto',  1.5),
    item('Cold Gas Remnant',     '~H',  'Unused interstellar gas as star formation winds down.',  'common', 'click', 7.5),
    item('Cooling White Dwarf',  'WD↓', 'White dwarf slowly fading over trillions of years.',    'common', 'crit',  0.4, true),
    item('Stellar Graveyard',    '⬜',  'Remnants outnumbering living stars across the galaxy.',  'common', 'time',  3.0),
    item('Galaxy Halo Dispersal','○○', 'Ancient stars drifting into the galactic outer halo.',    'rare',   'auto',  4.0),
    item('Gravitational Slingshot','↗', 'Close encounter launching stars out of their galaxy.',   'rare',   'click', 10.0),
    item('Pulsar',               '⊛~', 'Rotating neutron star sweeping radio beams across space.','rare',   'crit',  1.0, true),
    item('Black Dwarf',          '●°', 'Future cold remnant when white dwarfs finally go dark.',  'rare',   'time',  3.0),
    item('Iron Star',            'Fe★','Far-future matter trends toward iron via slow tunneling.', 'epic',   'auto',  8.0),
    item('Binary BH Merger',     '⚫⚫','Two black holes spiraling together — ringing spacetime.', 'epic',   'click', 17.0),
    item('Supermassive BH',      '⚫³','Galactic-core black hole that outlasts all the stars.',   'epic',   'crit',  3.0, true),
    item('Stellar Mass BH',      '⚫', 'Black hole left behind by a collapsed massive star.',     'epic',   'time',  5.0),
    item('Last Red Dwarf',       '🔴✦','The final small star exhausting its hydrogen supply.',    'legendary','multiplier',50.0),
    item('Total Darkness',       '░',  'Starlight ends; only remnants remain in the galaxy.',     'legendary','multiplier',50.0),
  ]),

  // ── Stage 14: Degenerate Era (4C + 4R + 4E + 2L) ───────────────────────────
  ...stage(14, [
    item('Decay Positron',            'e⁺',  'Antielectron emitted by decaying baryons.',              'common', 'auto',  2.0),
    item('Pion Decay',                'π⁰',  'Neutral pion instantly converting to two photons.',      'common', 'click', 7.5),
    item('Decay Neutrino',            'ν',   'Ghostly decay product escaping freely into space.',       'common', 'crit',  0.4, true),
    item('Proton Decay',              'p→',  'Hypothetical slow dissolution of all baryonic matter.',   'common', 'time',  2.0),
    item('Diamond Star',              '💎★', 'Crystallized carbon remnant glowing in deep dark.',      'rare',   'auto',  4.0),
    item('GW Echo',                   '◌·',  'Faint gravitational-wave memory of ancient mergers.',    'rare',   'click', 10.0),
    item('Quantum Tunneling',         '⇢',   'Particles crossing barriers by probability alone.',      'rare',   'crit',  1.5, true),
    item('Relic Neutrino Background', 'νBG', 'Big-bang neutrinos cooled almost to rest.',              'rare',   'time',  3.0),
    item('GUT Monopole Decay',        'M→',  'Ancient magnetic monopoles finally destabilizing.',       'epic',   'auto',  7.0),
    item('Positronium Atom',          'Ps',  'Electron and positron briefly orbiting each other.',     'epic',   'click', 17.0),
    item('Dark Matter Annihilation',  'DM⊕', 'Dark matter candidates finally erasing each other.',    'epic',   'crit',  3.0, true),
    item('BH Domination',             '⚫>', 'Black holes now hold most remaining mass-energy.',       'epic',   'time',  5.0),
    item('Last Baryon',               'p_∞', 'Final proton waiting out its immense decay clock.',     'legendary','multiplier',50.0),
    item('Baryon Washout',            'B=0', 'Baryon number dwindles to zero across the cosmos.',      'legendary','multiplier',50.0),
  ]),

  // ── Stage 15: Black Hole Era (4C + 4R + 4E + 2L) ───────────────────────────
  ...stage(15, [
    item('Hawking Photon',         'Hγ',    'Radiation slowly escaping from the event horizon.',      'common', 'auto',  3.0),
    item('Virtual Particle Pair',  '±ℏ',   'Vacuum pair split apart by the black hole gradient.',    'common', 'click', 7.5),
    item('Ergosphere',             'Erg',   'Rotating frame-drag zone where energy can be mined.',    'common', 'crit',  0.6, true),
    item('Event Horizon',          'EH',    'Boundary in time from which nothing can escape.',        'common', 'time',  2.0),
    item('Penrose Process',        'Ω→',   'Extracting rotational energy from a spinning BH.',       'rare',   'auto',  5.0),
    item('BH Merger Wave',         '⚫+⚫', 'Black hole inspiral shaking the last geometry.',        'rare',   'click', 10.0),
    item('BH Entropy',             'S=A/4','Horizon area determining every internal state.',          'rare',   'crit',  1.5, true),
    item('Stellar BH Evaporation', '⚫→',  'Smaller black holes slowly radiating themselves away.',  'rare',   'time',  4.0),
    item('Supermassive Evaporation','⚫⚫→','Largest black holes finally completing their fadeout.',  'epic',   'auto',  9.0),
    item('Firewall',               '🔥EH', 'High-energy barrier hypothesis at the event horizon.',   'epic',   'click', 17.0),
    item('Information Paradox',    '?⚫',  'Does information survive the final evaporation?',        'epic',   'crit',  3.0, true),
    item('Planck Remnant',         'ℓP',   'Possible Planck-scale residue after full evaporation.',  'epic',   'time',  6.0),
    item('Final Evaporation Flash','☀→∅', 'Last burst of light as the final black hole ends.',      'legendary','multiplier',50.0),
    item('Last Black Hole',        '⚫_',  'The very last horizon preparing its ultimate emission.', 'legendary','multiplier',50.0),
  ]),

  // ── Stage 16: The End (4C + 3R + 2E + 5L endings) ──────────────────────────
  ...stage(16, [
    item('Relic Electron',           'e⁻∞',  'An electron with no partner remaining anywhere.',        'common', 'auto',  2.0),
    item('Lone Photon',              'γ',     'A single photon crossing space that will never scatter.','common', 'click', 7.5),
    item('Relic Positron',           'e⁺∞',  'A positron adrift in ever-expanding emptiness.',         'common', 'crit',  0.5, true),
    item('Relic Neutrino',           'ν∞',   'Cold neutrino drifting at near-rest through eternity.',  'common', 'time',  2.0),
    item('Cosmic Background Photon', 'CBG',  'All remaining light fading into background noise.',      'rare',   'auto',  3.0),
    item('Thermal Equilibrium',      'ΔT→0', 'Temperature differences vanish everywhere at once.',    'rare',   'click', 10.0),
    item('Max Entropy',              'S_max','No free energy remains to run any physical process.',    'rare',   'crit',  1.5, true),
    item('De Sitter Vacuum',         'Λ∞',   'Dark-energy space persists as all matter fades away.',  'epic',   'auto',  8.0),
    item('Quantum Fluctuation Final','δE∞',  'Even empty space can still fluctuate, just barely.',    'epic',   'crit',  3.0, true),
    // Ending legendaries — each aligned to one universe fate (all multiplier)
    item('Thermal Death',            'ΔS=0', 'Maximum entropy reached; no process can ever run.',     'legendary','multiplier',50.0, false, 'heat_death'),
    item('Dark Energy Spike',        'Λ↑',   'Accelerating expansion tears apart every structure.',   'legendary','multiplier',50.0, false, 'big_rip'),
    item('Gravitational Singularity','ρ→∞',  'All density returns toward a single point.',            'legendary','multiplier',50.0, false, 'big_crunch'),
    item('True Vacuum Bubble',       '◉→',   'A lower-energy vacuum expands and rewrites physics.',   'legendary','multiplier',50.0, false, 'vacuum_decay'),
    item('Quantum Bounce',           '⟳',   'Collapse rebounds into an entirely new expansion.',     'legendary','multiplier',50.0, false, 'bounce'),
  ]),
];

export function getEntitiesForStage(stageId: number): StageEntity[] {
  return STAGE_ENTITIES.filter((e) => e.stageId === stageId);
}

export function entityMatchesId(entity: StageEntity, entityId: string): boolean {
  return entity.id === entityId || entity.aliases?.includes(entityId) === true;
}

export function findEntityById(entityId: string, stageId?: number): StageEntity | undefined {
  return STAGE_ENTITIES.find((entity) => {
    if (stageId !== undefined && entity.stageId !== stageId) return false;
    return entityMatchesId(entity, entityId);
  });
}

export function getPurchasedEntityCount(
  purchasedEntities: PurchasedEntityEntry[],
  entity: StageEntity,
): number {
  return purchasedEntities.reduce(
    (sum, entry) => (entityMatchesId(entity, entry.entityId) ? sum + entry.count : sum),
    0,
  );
}
