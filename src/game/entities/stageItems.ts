/**
 * Stage entity definitions.
 *
 * Costs are calibrated from the stage threshold and rarity so the data stays
 * readable while balance knobs remain in one place.
 */

import type { EndingId } from '../types';
import type { EntityEffectType, EntityGlyph, EntityRarity, EntityVisual, StageEntity } from './types';

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
}

const STAGE_THRESHOLDS = {
  1: 1725,
  2: 4.7e7,
  3: 1.4e9,
  4: 1.2e10,
  5: 1.3e11,
  6: 6e14,
  7: 2e16,
  8: 2e17,
  9: 1e18,
  10: 8e19,
  11: 2e20,
  12: 6e20,
  13: 2e21,
  14: 8e22,
  15: 3e23,
  16: 1.2e24,
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

const BASE_COST_FACTORS: Record<EntityRarity, number> = {
  common: 0.03,
  rare: 0.1,
  epic: 0.3,
  legendary: 0.8,
};

const COST_SCALING: Record<EntityRarity, number> = {
  common: 1.12,
  rare: 1.18,
  epic: 1.25,
  legendary: 1.35,
};

const MAX_COUNTS: Record<EntityRarity, number> = {
  common: 20,
  rare: 10,
  epic: 5,
  legendary: 1,
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
    };
  });
}

export const STAGE_ENTITIES: StageEntity[] = [
  ...stage(1, [
    item('Quantum Fluctuation', 'δE', 'Vacuum ripple that seeds structure.', 'common', 'auto', 0.5),
    item('False Vacuum Bubble', '⊙', 'Unstable vacuum pocket before release.', 'common', 'click', 0.8),
    item('Virtual Photon Pair', 'γγ̄', 'Transient photons borrowed from vacuum.', 'common', 'auto', 0.8),
    item('Inflation Wave', '∿', 'Expansion wave stretching every scale.', 'common', 'auto', 1.2),
    item('Zero-Point Energy', 'ℏω', 'Ground-state energy waiting to be tapped.', 'common', 'auto', 1.5),
    item('Spacetime Foam', '⁂', 'Planck-scale geometry bubbling briefly.', 'rare', 'crit', 1, true),
    item('Inflaton Field', 'φ', 'Scalar field driving cosmic inflation.', 'rare', 'auto', 3),
    item('Higgs Ocean', 'H', 'Mass-giving field filling early space.', 'rare', 'multiplier', 2),
    item('Topological Defect', '⊣', 'Frozen field kink storing dense energy.', 'rare', 'time', 2),
    item('Symmetry Breaking', '⚡', 'Unified forces split into distinct laws.', 'rare', 'multiplier', 3),
    item('Graviton', '𝐆', 'Hypothetical carrier of gravity.', 'epic', 'click', 5),
    item('Cosmic String', '═', 'One-dimensional relic of extreme tension.', 'epic', 'auto', 6),
    item('Domain Wall', '▬', 'Boundary between unlike vacuum states.', 'epic', 'time', 5),
    item('Bubble Nucleation', '◉', 'A new vacuum bubble begins to grow.', 'epic', 'time', 0.5),
    item('Monopole', '⊛', 'Theoretical particle with one magnetic pole.', 'epic', 'auto', 8),
    item('Micro Wormhole', '∞', 'Tiny shortcut through quantum geometry.', 'epic', 'multiplier', 5),
    item('Supersymmetric Partner', 'S̃', 'A mirrored partner for known particles.', 'legendary', 'multiplier', 10),
    item('Grand Unified Echo', 'GUT', 'Trace of forces once being unified.', 'legendary', 'multiplier', 15),
  ]),
  ...stage(2, [
    item('Up Quark', 'u', 'Light quark used twice in every proton.', 'common', 'click', 0.8),
    item('Down Quark', 'd', 'Light quark shared by protons and neutrons.', 'common', 'click', 0.8),
    item('Electron', 'e⁻', 'Stable lepton carrying negative charge.', 'common', 'auto', 1),
    item('Neutrino', 'ν', 'Nearly massless lepton crossing matter.', 'common', 'auto', 1.5),
    item('Antiquark', 'ū', 'Quark antimatter waiting to annihilate.', 'common', 'time', 1),
    item('Gluon', 'g', 'Color-force carrier binding quarks.', 'rare', 'auto', 2),
    item('Strange Quark', 's', 'Second-generation quark with strangeness.', 'rare', 'click', 2.5),
    item('W Boson', 'W±', 'Weak-force carrier for flavor changes.', 'rare', 'multiplier', 2),
    item('Muon', 'μ', 'Heavy electron cousin with a short life.', 'rare', 'click', 3),
    item('Positron Burst', 'e⁺', 'Antielectrons flashing into radiation.', 'rare', 'time', 3),
    item('First Proton', 'p⁺', 'Stable baryon that lets matter persist.', 'epic', 'multiplier', 4),
    item('CP Violation Pocket', 'CP̸', 'Tiny bias favoring matter over antimatter.', 'epic', 'auto', 6),
    item('Color Charge Triplet', 'rgb', 'All three QCD color charges balanced.', 'epic', 'click', 6),
    item('QGP Pocket', 'QGP', 'Hot relic of quarks and gluons unbound.', 'epic', 'auto', 8),
    item('Baryon Asymmetry', 'Δb', 'One-in-a-billion matter surplus survives.', 'legendary', 'multiplier', 12),
    item('Electroweak Remnant', 'EW', 'Memory of electromagnetism and weak unity.', 'legendary', 'multiplier', 15),
  ]),
  ...stage(3, [
    item('Free Quark', 'q', 'Quark moving before confinement takes hold.', 'common', 'auto', 1),
    item('Gluon Plasma', 'gg', 'Dense bath of color-force carriers.', 'common', 'auto', 1.5),
    item('Pion', 'π', 'Light meson mediating residual strong force.', 'common', 'auto', 1.5),
    item('Charm Quark', 'c', 'Heavy quark from the second generation.', 'rare', 'click', 2),
    item('Bottom Quark', 'b', 'Massive quark that quickly decays.', 'rare', 'click', 3),
    item('Kaon', 'K', 'Strange meson with useful decay channels.', 'rare', 'time', 2),
    item('Jet Stream', '→', 'High-energy quark spray through plasma.', 'rare', 'click', 3),
    item('Plasma Vortex', '⟳', 'Swirling hot droplet of QCD matter.', 'rare', 'auto', 4),
    item('Color Flux Tube', '≡', 'Elastic color field linking quarks.', 'epic', 'multiplier', 4),
    item('Top Quark Decay', 't→', 'Heaviest quark vanishes almost instantly.', 'epic', 'time', 5),
    item('QCD Phase Boundary', '─', 'Threshold where strong matter changes phase.', 'epic', 'multiplier', 5),
    item('Confinement Onset', '⊂⊃', 'Quarks begin locking inside hadrons.', 'legendary', 'multiplier', 6),
    item('Strongly Coupled Droplet', '◈', 'Nearly perfect fluid of quark plasma.', 'legendary', 'multiplier', 12),
  ]),
  ...stage(4, [
    item('Proton', 'p⁺', 'Hydrogen nucleus and common cosmic matter.', 'common', 'auto', 1),
    item('Neutron', 'n', 'Neutral baryon that soon decays alone.', 'common', 'click', 1),
    item('Deuterium', 'D', 'Hydrogen-2 seed for light nuclei.', 'common', 'auto', 1.5),
    item('Fusion Reaction', '⊕', 'Proton and neutron fuse with gamma light.', 'common', 'auto', 2),
    item('Gamma Ray', 'γ', 'High-energy photon from nuclear reactions.', 'common', 'time', 1.5),
    item('Tritium', 'T', 'Radioactive hydrogen-3 isotope.', 'rare', 'time', 2),
    item('Helium-3', '³He', 'Light helium isotope in fusion chains.', 'rare', 'auto', 2),
    item('Helium-4', '⁴He', 'Stable helium core of primordial abundance.', 'rare', 'multiplier', 3),
    item('Beryllium-7', '⁷Be', 'Unstable path toward lithium-7.', 'rare', 'auto', 3),
    item('Lithium-7', '⁷Li', 'Heaviest common product of big bang fusion.', 'epic', 'click', 5),
    item('Neutrino Freeze-out', 'ν✕', 'Neutrinos stop tracking the hot plasma.', 'epic', 'multiplier', 4),
    item('Neutron-Proton Ratio', 'n/p', 'Ratio that fixes primordial element yields.', 'epic', 'multiplier', 6),
    item('Primordial Fireball', '☀', 'Hot nuclear furnace of the young universe.', 'legendary', 'auto', 8),
    item('BBN Completion', '★', 'Light-element synthesis reaches freeze-out.', 'legendary', 'multiplier', 15),
  ]),
  ...stage(5, [
    item('Hydrogen Atom', 'H', 'Proton captures electron and becomes neutral.', 'common', 'auto', 1.5),
    item('Helium Atom', 'He', 'Helium nucleus captures its electrons.', 'common', 'auto', 1),
    item('Free Electron', 'e⁻', 'Last stray charges before neutral gas wins.', 'common', 'click', 1.2),
    item('CMB Photon', '🌡γ', 'Light released from the last-scattering fog.', 'common', 'auto', 2),
    item('Hydrogen Cloud', 'H₂', 'Neutral hydrogen gathering into gas clouds.', 'rare', 'auto', 3),
    item('Photon Decoupling', 'γ↗', 'Light separates from matter and streams free.', 'rare', 'click', 4),
    item('Plasma to Gas', '∽', 'Ionized plasma cools into transparent gas.', 'rare', 'multiplier', 3),
    item('Last Scattering Surface', '═', 'Shell where CMB photons last bounced.', 'epic', 'multiplier', 5),
    item('Baryon Acoustic Oscillation', '◌', 'Frozen sound waves seed large structure.', 'epic', 'auto', 6),
    item('Dark Matter Halo', '○', 'Invisible gravity well shaping future stars.', 'epic', 'auto', 8),
    item('Density Perturbation', 'δρ', 'Tiny overdensity that can collapse later.', 'legendary', 'click', 7),
    item('CMB Anisotropy', '≈', 'Minute temperature contrast in relic light.', 'legendary', 'multiplier', 12),
  ]),
  ...stage(6, [
    item('Cold Hydrogen', 'H°', 'Neutral hydrogen drifting without starlight.', 'common', 'auto', 1),
    item('Dark Matter Filament', '╌', 'Invisible scaffold for cosmic structure.', 'common', 'auto', 2),
    item('21cm Signal', '₂₁', 'Hydrogen spin-flip line from dark gas.', 'common', 'click', 2),
    item('Cold Gas Cloud', '≋', 'Cooling gas cloud starting to contract.', 'rare', 'auto', 3),
    item('Dark Matter Clump', '●', 'Dense dark matter knot deepening gravity.', 'rare', 'multiplier', 2),
    item('Molecular Hydrogen', 'H₂', 'Cooling molecule that enables first stars.', 'rare', 'auto', 6),
    item('Protogalactic Cloud', '○', 'Large gas reservoir on the way to a galaxy.', 'epic', 'auto', 5),
    item('Dark Energy Background', 'Λ', 'Vacuum energy quietly stretching space.', 'epic', 'multiplier', 6),
    item('Mini Halo', '⊙', 'Small dark halo that can cradle a star.', 'epic', 'auto', 8),
    item('Gravitational Collapse', '↓↓', 'Gravity overcomes pressure and ignites fate.', 'legendary', 'multiplier', 15),
  ]),
  ...stage(7, [
    item('Protostar', '⊙', 'Contracting gas sphere before fusion.', 'common', 'auto', 1.5),
    item('Main Sequence Star', '★', 'Stable star burning hydrogen in its core.', 'common', 'auto', 2),
    item('UV Photon', 'UV', 'Energetic light that ionizes nearby gas.', 'common', 'time', 1.5),
    item('Hydrogen Fusion', 'H→He', 'Hydrogen nuclei fuse into helium.', 'rare', 'auto', 3),
    item('Stellar Wind', '~~→', 'Particle stream blown from a hot star.', 'rare', 'click', 3),
    item('Carbon-first', 'C', 'Triple-alpha fusion makes the first carbon.', 'rare', 'multiplier', 3),
    item('Oxygen', 'O', 'Helium capture on carbon makes oxygen.', 'rare', 'auto', 4),
    item('Pop III Cluster', '✦✦✦', 'First metal-free stars gathered together.', 'epic', 'auto', 6),
    item('Supernova Precursor', '⚠★', 'Massive star nearing explosive collapse.', 'epic', 'time', 5),
    item('HII Region', 'HII', 'Ionized hydrogen nebula around hot stars.', 'epic', 'auto', 7),
    item('First Heavy Elements', 'Fe', 'Stellar cores forge elements up to iron.', 'epic', 'multiplier', 6),
    item('Pop III Supernova', '☆→', 'First stars seed space with heavy elements.', 'legendary', 'multiplier', 15),
    item('Pair Instability SN', '✸', 'Giant star destroyed by pair creation.', 'legendary', 'time', 8),
  ]),
  ...stage(8, [
    item('Ionizing Photon', 'hν', 'Photon energetic enough to strip hydrogen.', 'common', 'auto', 2),
    item('Ionized Hydrogen', 'H⁺', 'Hydrogen atom missing its electron again.', 'common', 'click', 1.5),
    item('HII Bubble', '○⁺', 'Expanding ionized pocket around young stars.', 'common', 'auto', 2.5),
    item('Quasar', '⬟', 'Bright accreting black hole ionizes gas.', 'rare', 'auto', 5),
    item('Lyman Break', 'λ', 'Spectral dropout marking distant galaxies.', 'rare', 'click', 3),
    item('Ionization Front', '→→→', 'Boundary where neutral gas becomes plasma.', 'rare', 'auto', 4),
    item('Early Galaxy', '🌀', 'Young galaxy pouring out ionizing light.', 'epic', 'auto', 6),
    item('Intergalactic Medium', 'IGM', 'Thin gas between galaxies tracks ionization.', 'epic', 'multiplier', 5),
    item('Reionization Complete', '✓', 'Most cosmic hydrogen is ionized again.', 'legendary', 'multiplier', 12),
  ]),
  ...stage(9, [
    item('Dwarf Galaxy', '🌀', 'Small galaxy holding millions of stars.', 'common', 'auto', 2),
    item('Spiral Arm', '⤵', 'Star-forming lane in a rotating disk.', 'common', 'auto', 2.5),
    item('Dark Matter Halo', '○', 'Massive dark scaffold around a galaxy.', 'rare', 'auto', 4),
    item('Supermassive BH', '⚫', 'Central black hole shaping galactic cores.', 'rare', 'multiplier', 4),
    item('Galaxy Merger', '⊗', 'Colliding galaxies stir gas and stars.', 'rare', 'time', 4),
    item('Active Galactic Nucleus', 'AGN', 'Accreting core outshines the host galaxy.', 'epic', 'auto', 7),
    item('Cosmic Web Node', '✦', 'Junction where filaments feed galaxies.', 'epic', 'multiplier', 6),
    item('Galaxy Cluster', '⊞', 'Gravitational city of many galaxies.', 'epic', 'auto', 9),
    item('Gravitational Lens', '⊃⊂', 'Mass bends light into arcs and rings.', 'legendary', 'click', 8),
    item('Cosmic Void', '□', 'Huge underdense region between filaments.', 'legendary', 'multiplier', 15),
  ]),
  ...stage(10, [
    item('Dust Grain', '·', 'Silicate speck that starts planet growth.', 'common', 'auto', 1),
    item('Planetesimal', '○', 'Kilometer-scale body built from dust.', 'common', 'auto', 2),
    item('Water Ice', 'H₂O', 'Frozen water carried by comets and disks.', 'common', 'auto', 2),
    item('Comet', '☄', 'Icy body delivering volatiles inward.', 'common', 'time', 2),
    item('Iron Core', 'Fe', 'Metal-rich center of a differentiated world.', 'rare', 'click', 3),
    item('Rocky Planet', '🪨', 'Silicate planet with a solid surface.', 'rare', 'auto', 4),
    item('Gas Giant', '♃', 'Huge hydrogen-helium planet with deep gravity.', 'rare', 'auto', 5),
    item('Moon', '☽', 'Satellite stabilizing rotation and tides.', 'rare', 'click', 3),
    item('Asteroid Belt', '⋯', 'Leftover planetesimals that never merged.', 'rare', 'auto', 3),
    item('Accretion Disk', '⊚', 'Rotating disk that builds planets.', 'epic', 'auto', 6),
    item('Magnetic Field', '⇌', 'Planetary shield against stellar wind.', 'epic', 'multiplier', 5),
    item('Liquid Water', 'H₂O·', 'Stable surface solvent for chemistry.', 'epic', 'multiplier', 6),
    item('Goldilocks Zone', '🌡', 'Orbital band where water can remain liquid.', 'epic', 'multiplier', 8),
    item('Sun', '☀', 'G-type main sequence star at system center.', 'legendary', 'multiplier', 20),
  ]),
  ...stage(11, [
    item('Amino Acid', 'NH₂', 'Organic building block for proteins.', 'common', 'auto', 2),
    item('RNA Molecule', 'RNA', 'Self-copying molecule and early catalyst.', 'common', 'auto', 2.5),
    item('Lipid Membrane', '◯', 'Boundary that separates inside from outside.', 'common', 'click', 2),
    item('DNA Helix', '⌇', 'Durable molecule for genetic memory.', 'rare', 'auto', 4),
    item('Prokaryote', '〇', 'Simple cell without a nucleus.', 'rare', 'auto', 3),
    item('Photosynthesis', '☀→O₂', 'Light-driven chemistry releases oxygen.', 'rare', 'auto', 5),
    item('Eukaryote', '⊙', 'Complex cell with internal compartments.', 'rare', 'multiplier', 3),
    item('Multicellular Life', '⋮', 'Cells specialize and cooperate as bodies.', 'epic', 'auto', 6),
    item('Cambrian Explosion', '✳', 'Rapid burst of complex body plans.', 'epic', 'time', 6),
    item('Fish', '≋', 'Early vertebrate life in ancient oceans.', 'epic', 'auto', 7),
    item('Plant', '🌿', 'Land photosynthesizer reshaping air.', 'epic', 'auto', 8),
    item('Neuron', '⚡', 'Signal cell enabling fast information flow.', 'epic', 'crit', 3, true),
    item('Homo Sapiens', '👁', 'A species able to model the universe.', 'legendary', 'multiplier', 20),
  ]),
  ...stage(12, [
    item('Helium Flash', '⚡He', 'Runaway helium fusion in a dense core.', 'common', 'time', 2),
    item('Red Giant Envelope', '🔴', 'Outer layers swell across inner orbits.', 'common', 'auto', 2),
    item('Stellar Wind AGB', '~~~→', 'Late-stage star sheds mass into space.', 'common', 'click', 2),
    item('Carbon-O Core', 'C/O', 'Compact carbon-oxygen stellar remnant.', 'common', 'click', 3),
    item('Carbon Ash', 'C·', 'Fusion residue left in the cooling core.', 'common', 'auto', 2.5),
    item('Oxygen Shell', 'O-sh', 'Burning shell around the spent core.', 'rare', 'auto', 3),
    item('Planetary Nebula', 'PN', 'Glowing shell cast off by a dying star.', 'rare', 'auto', 4),
    item('White Dwarf', 'WD', 'Electron pressure supports a stellar core.', 'rare', 'multiplier', 4),
    item('Degenerate Electron', 'e°', 'Crowded electrons resist compression.', 'rare', 'multiplier', 3),
    item('Crystallizing Core', '💎', 'Cooling carbon lattice freezes inside.', 'rare', 'auto', 4),
    item('Nova Eruption', 'NOVA', 'Accreted hydrogen flashes on a white dwarf.', 'epic', 'time', 5),
    item('Mass Transfer', '→→', 'Binary companion feeds the remnant.', 'epic', 'auto', 6),
    item('Neutron Star', 'NS', 'Collapsed core held by neutron pressure.', 'epic', 'auto', 7),
    item('Chandrasekhar Limit', '1.4M', 'White dwarf mass ceiling before collapse.', 'epic', 'time', 6),
    item('Magnetar', '⊛M', 'Neutron star with extreme magnetic fields.', 'epic', 'crit', 5, true),
    item('Gravitational Wave', '◌~', 'Ripples from compact remnant motion.', 'epic', 'multiplier', 5),
    item('Type Ia Supernova', 'SNIa', 'White dwarf disruption used as a candle.', 'legendary', 'multiplier', 18),
    item('Core Collapse SN', 'SNII', 'Massive core implodes and rebounds.', 'legendary', 'multiplier', 15),
  ]),
  ...stage(13, [
    item('Cooling White Dwarf', 'WD↓', 'White dwarf fades over immense time.', 'common', 'auto', 2),
    item('Brown Dwarf', '🟫', 'Failed star cooling without fusion.', 'common', 'auto', 1.5),
    item('Cold Gas Remnant', '~H', 'Unused gas left after star formation ends.', 'common', 'auto', 2),
    item('Stellar Graveyard', '⬜', 'Remnants replace living stars.', 'common', 'auto', 4),
    item('Pulsar', '⊛~', 'Rotating neutron star beams radio pulses.', 'rare', 'click', 4),
    item('Gravitational Slingshot', '↗', 'Close encounter ejects stars from galaxies.', 'rare', 'click', 3),
    item('Galaxy Halo Dispersal', '○○', 'Old stars drift into galactic halos.', 'rare', 'auto', 4),
    item('Black Dwarf', '●°', 'Future cold white dwarf with no shine.', 'rare', 'multiplier', 4),
    item('Macro Particle Condensation', 'M●', 'Matter slowly rearranges through tunneling.', 'epic', 'multiplier', 5),
    item('Iron Star', 'Fe★', 'Far-future star matter trends toward iron.', 'epic', 'auto', 8),
    item('Stellar Mass BH', '⚫', 'Black hole formed from a collapsed star.', 'epic', 'multiplier', 6),
    item('Binary BH Merger', '⚫⚫', 'Two black holes combine and ring spacetime.', 'epic', 'time', 6),
    item('Supermassive BH', '⚫³', 'Galactic-core black hole outlasts stars.', 'legendary', 'auto', 9),
    item('Last Red Dwarf', '🔴✦', 'The final small star exhausts its fuel.', 'legendary', 'multiplier', 20),
    item('Bose-Nova', 'BN', 'Condensate collapse releases stored energy.', 'legendary', 'time', 7),
    item('Total Darkness', '░', 'Starlight ends and remnants dominate.', 'legendary', 'multiplier', 18),
  ]),
  ...stage(14, [
    item('Proton Decay', 'p→', 'Hypothetical decay dissolves baryonic matter.', 'common', 'time', 3),
    item('Decay Positron', 'e⁺', 'Antielectron emitted by baryon decay.', 'common', 'auto', 2),
    item('Decay Neutrino', 'ν', 'Ghostly decay product escaping freely.', 'common', 'auto', 2),
    item('Pion Decay', 'π⁰', 'Neutral pion quickly becomes two photons.', 'common', 'time', 2),
    item('Diamond Star', '💎★', 'Crystallized carbon remnant in the dark.', 'rare', 'auto', 4),
    item('Quantum Tunneling', '⇢', 'Particles cross barriers by probability.', 'rare', 'crit', 4, true),
    item('GW Echo', '◌·', 'Faint memory of ancient mergers.', 'rare', 'auto', 3),
    item('Relic Neutrino Background', 'νBG', 'Big-bang neutrinos cooled almost still.', 'rare', 'auto', 3),
    item('Positronium Atom', 'Ps', 'Electron and positron briefly orbit.', 'epic', 'multiplier', 6),
    item('Positronium Decay', 'Ps→γ', 'Positronium vanishes into gamma photons.', 'epic', 'time', 6),
    item('Dark Matter Annihilation', 'DM⊕', 'Dark matter candidates erase each other.', 'epic', 'time', 7),
    item('BH Domination', '⚫>', 'Black holes hold most remaining mass-energy.', 'epic', 'multiplier', 7),
    item('GUT Monopole Decay', 'M→', 'Ancient monopoles finally destabilize.', 'epic', 'auto', 7),
    item('Subatomic Void', '∅', 'Atomic structure has dissolved away.', 'legendary', 'multiplier', 20),
    item('Last Baryon', 'p_last', 'Final proton waits out its decay clock.', 'legendary', 'multiplier', 22),
    item('Baryon Washout', 'B=0', 'Baryon number trends to nothing.', 'legendary', 'auto', 8),
  ]),
  ...stage(15, [
    item('Hawking Photon', 'Hγ', 'Radiation escapes from horizon physics.', 'common', 'auto', 3),
    item('Virtual Particle Pair', '±ℏ', 'Vacuum pair split by a black hole.', 'common', 'click', 2),
    item('Event Horizon', 'EH', 'Boundary from which light cannot return.', 'common', 'multiplier', 3),
    item('Ergosphere', 'Erg', 'Rotating zone where energy can be mined.', 'rare', 'click', 4),
    item('Penrose Process', 'Ω→', 'Spin energy extracted from a black hole.', 'rare', 'click', 5),
    item('BH Entropy', 'S=A/4', 'Black hole entropy scales with area.', 'rare', 'time', 5),
    item('Stellar BH Evaporation', '⚫→', 'Stellar black hole slowly radiates away.', 'rare', 'time', 5),
    item('BH Merger Wave', '⚫+⚫', 'Black hole merger shakes spacetime.', 'epic', 'multiplier', 6),
    item('Information Paradox', '?⚫', 'Puzzle of whether information survives.', 'epic', 'crit', 6, true),
    item('Firewall', '🔥EH', 'Speculative high-energy horizon barrier.', 'epic', 'time', 7),
    item('Supermassive Evaporation', '⚫⚫→', 'Largest black holes finally evaporate.', 'epic', 'auto', 9),
    item('Last Black Hole', '⚫_', 'Final horizon prepares its last emission.', 'epic', 'auto', 10),
    item('Planck Remnant', 'ℓP', 'Possible tiny residue after evaporation.', 'epic', 'multiplier', 8),
    item('Final Evaporation Flash', '☀→∅', 'Last burst as the final black hole ends.', 'legendary', 'multiplier', 25),
    item('Photon Desert', 'γ···', 'Only thin radiation crosses empty space.', 'legendary', 'multiplier', 20),
  ]),
  ...stage(16, [
    item('Lone Photon', 'γ', 'A single photon travels without scattering.', 'common', 'click', 2),
    item('Relic Electron', 'e⁻∞', 'An electron with no nearby partner left.', 'common', 'auto', 2),
    item('Relic Positron', 'e⁺∞', 'A positron lost in ever-expanding space.', 'common', 'auto', 2),
    item('Cosmic Background Photon', 'CBG', 'All light fades into background radiation.', 'rare', 'auto', 3),
    item('Relic Neutrino', 'ν∞', 'Cold neutrino drifting near rest.', 'rare', 'auto', 3),
    item('Thermal Equilibrium', 'ΔT→0', 'Temperature differences disappear.', 'rare', 'multiplier', 4),
    item('Max Entropy', 'S_max', 'No free energy remains to do work.', 'rare', 'multiplier', 4),
    item('Poincare Recurrence', '∮', 'Finite states may repeat after vast time.', 'epic', 'time', 2),
    item('Quantum Fluctuation Final', 'δE∞', 'Even empty space can still fluctuate.', 'epic', 'crit', 6, true),
    item('De Sitter Vacuum', 'Λ∞', 'Dark-energy space remains as matter fades.', 'epic', 'multiplier', 8),
    item('Final Quantum State', '|Ψ⟩', 'Last wavefunction describing the cosmos.', 'epic', 'time', 8),
    item('Boltzmann Brain', '👁∞', 'A random observer fluctuation in deep time.', 'legendary', 'crit', 8, true),
    item('Thermal Death', 'ΔS=0', 'Maximum entropy leaves no process to run.', 'legendary', 'time', 2, false, 'heat_death'),
    item('Dark Energy Spike', 'Λ↑', 'Accelerating expansion tears structure apart.', 'legendary', 'click', 25, false, 'big_rip'),
    item('Gravitational Singularity', 'ρ→∞', 'All density returns toward one point.', 'legendary', 'auto', 25, false, 'big_crunch'),
    item('True Vacuum Bubble', '◉→', 'A lower-energy vacuum rewrites physics.', 'legendary', 'multiplier', 25, false, 'vacuum_decay'),
    item('Quantum Bounce', '⟳', 'Collapse rebounds into a new expansion.', 'legendary', 'multiplier', 20, false, 'bounce'),
  ]),
];

export function getEntitiesForStage(stageId: number): StageEntity[] {
  return STAGE_ENTITIES.filter((e) => e.stageId === stageId);
}
