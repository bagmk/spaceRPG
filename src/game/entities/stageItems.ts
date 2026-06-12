/**
 * Stage entity definitions.
 *
 * Costs are calibrated from the stage threshold and rarity so the data stays
 * readable while balance knobs remain in one place.
 */

import type { EndingId } from '../types';
import type { Lang } from '../../i18n';
import type { EntityEffectType, EntityGlyph, EntityRarity, EntityVisual, PurchasedEntityEntry, StageEntity } from './types';
import {
  ENTITY_COST_ANCHORS,
  ENTITY_STAGE_ACCENT,
  ENTITY_BASE_COST_FACTOR,
  ENTITY_COST_SCALING,
  ENTITY_MAX_COUNT,
  ENTITY_TIME_MAX_COUNT,
  LEGACY_TIME_ENTITY_EFFECT_FACTOR,
  ENTITY_RARITY_SIZE,
  ENTITY_RARITY_TINT,
  ENTITY_RARITY_EFFECT_SCALE,
} from '../balance';

type StageId = keyof typeof ENTITY_COST_ANCHORS;
const REBALANCED_EFFECT_RARITIES = new Set<EntityRarity>(['common', 'rare', 'epic']);

interface EntitySpec {
  name: string;
  nameKo?: string;
  formula: string;
  description: string;
  descriptionKo?: string;
  rarity: EntityRarity;
  effect: {
    type: EntityEffectType;
    value: number;
    isFlat?: boolean;
  };
  endingId?: EndingId;
  aliases?: string[];
}

/** Translate a localized entity field, falling back to English. */
export function entityName(entity: StageEntity, lang: Lang): string {
  return lang === 'ko' && entity.nameKo ? entity.nameKo : entity.name;
}

export function entityDescription(entity: StageEntity, lang: Lang): string {
  return lang === 'ko' && entity.descriptionKo ? entity.descriptionKo : entity.description;
}

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

/**
 * Rotate a hex color's hue by N degrees while keeping saturation and lightness.
 * Used so multiple entities sharing the same glyph in the same stage feel
 * related (same family) yet visually distinct (slight tonal variation).
 */
function rotateHexHue(hex: string, degrees: number): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  h = (h + degrees + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r2 = 0, g2 = 0, b2 = 0;
  if (h < 60) { r2 = c; g2 = x; }
  else if (h < 120) { r2 = x; g2 = c; }
  else if (h < 180) { g2 = c; b2 = x; }
  else if (h < 240) { g2 = x; b2 = c; }
  else if (h < 300) { r2 = x; b2 = c; }
  else { r2 = c; b2 = x; }
  const toHex = (v: number) =>
    Math.max(0, Math.min(255, Math.round((v + m) * 255))).toString(16).padStart(2, '0');
  return '#' + toHex(r2) + toHex(g2) + toHex(b2);
}

/**
 * Predefined hue offsets used to differentiate same-glyph entities within a stage.
 * Slot 0 = no shift (lead entity); subsequent slots gently shift left/right
 * around the stage's anchor color so duplicates feel like a family.
 */
const GLYPH_DUPE_HUE_OFFSETS: readonly number[] = [0, 14, -14, 24, -24, 34, -8, 8, 20, -20];

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

function glyphForLegacy(stageId: StageId, spec: EntitySpec): EntityGlyph {
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
  if (name.includes('inflaton') || name.includes('surge')) return 'field';
  if (name.includes('fluctuation') || name.includes('quantum')) return 'quantum';
  if (stageId <= 3) return 'quantum';

  return 'particle';
}

/**
 * Exact-name glyph overrides for entities where keyword matching would yield
 * a shape that conflicts with the entity's intent or description.
 * Edits here take priority over the keyword cascade in glyphForRefined.
 */
const ENTITY_GLYPH_OVERRIDES: Record<string, EntityGlyph> = {
  // --- 🔴 Direct shape↔description mismatches ---
  'Cold Hydrogen':         'atom',      // 단원자 중성 수소 (분자가 아님)
  'Stellar Wind':          'wave',      // 입자류 흐름 (정적 가스 구름이 아님)
  'Ionized Hydrogen':      'plasma',    // 전자를 잃은 핵 (원자가 아님)
  'Bubble Merger':         'plasma',    // 이온화 영역들의 합병 (원자가 아님)
  'Cold Gas Remnant':      'cloud',     // 식어버린 가스 (별 시체가 아님)
  'Pion Decay':            'radiation', // 파이온이 두 광자로 변환되는 과정

  // --- 🟡 Tighter shape↔description matches ---
  'Cosmic Transparency':   'void',      // 빛이 자유로워진 결과의 "투명함"
  'First Cosmic Dawn Seed':'cloud',     // 아직 점화 전 단계 — 가스 구름
  'Oxygen':                'atom',      // 원소 자체는 원자
  // Periodic-table elements (renamed): pin 'atom' so the rename doesn't drop the
  // name-inferred glyph. Without these, Hydrogen→particle, Helium→nucleus,
  // Carbon→star (keyword fall-through), shifting their visual + set-bonus key.
  'Carbon':                'atom',      // (renamed from Carbon First)
  'Hydrogen':              'atom',      // (renamed from Hydrogen Atom)
  'Helium':                'atom',      // (renamed from Helium Atom)
  'Iron':                  'atom',      // (renamed from First Heavy Elements)
  'Stellar Feedback':      'wave',      // 별이 주변에 미치는 흐름·방출
  'Star Formation Cloud':  'cloud',     // 아직 별이 되기 전 구름
  'Proton Decay':          'entropy',   // 사라지는 과정 강조
  'Baryon Washout':        'entropy',   // "0으로 시들어 간다"
  'Firewall':              'plasma',    // 고에너지 장벽
  'Dark Energy Spike':     'wave',      // 시공간을 갈가리 찢는 동적 사건

  // --- 🆕 Use new dedicated glyphs to break up cloud / remnant overlap ---
  'Pion':                  'meson',     // 쿼크-반쿼크 쌍 (전용 glyph)
  'Kaon':                  'meson',     // 같은 이유
  'Hydrogen Cloud':        'molecule',  // H₂ 분자 구름 (분자가 본질)
  'Protogalactic Cloud':   'halo',      // 미래 은하의 헤일로 모체
  'Gas Accretion':         'accretion', // 방향성 가스 유입 (전용 glyph)
  'Intergalactic Medium':  'halo',      // 우주 거미줄을 따라 분포하는 희박 매질
  'Red Giant Envelope':    'envelope',  // 부푼 항성 외피 (전용 glyph)
  'Stellar Wind AGB':      'wave',      // 외피 방출 흐름
  'Planetary Nebula':      'nebula',    // 색채 있는 양극 로브 (전용 glyph)
  'Diamond Star':          'crystal',   // 결정화 격자 (전용 glyph)
  'Iron Star':             'crystal',   // 양자 터널링으로 철 격자로 수렴

  // --- Standard Model gap-fills (late disposable entities repurposed) ---
  'Tau':                   'lepton',    // 3세대 하전 경입자 (from Relic Electron)
  'Tau Neutrino':          'lepton',    // 3세대 중성미자 (from Relic Neutrino)
  'Z Boson':               'boson',     // 중성 약력 게이지 보손 (from GUT Monopole Decay)
  'Higgs Boson':           'boson',     // 힉스 장의 스칼라 (from Quantum Tunneling)
};

/**
 * Refined glyph picker for stages 2-9 and 12-16.
 * Uses word-boundary matching to avoid substring traps like "ark" inside
 * "quark"/"dark" or "agn" inside "magnetic", and adds many keywords that the
 * legacy picker was missing (dwarf, event horizon, penrose, firewall,
 * ergosphere, dark energy, virtual particle, etc.).
 */
function glyphForRefined(stageId: StageId, spec: EntitySpec): EntityGlyph {
  // Explicit overrides win over keyword matching.
  const override = ENTITY_GLYPH_OVERRIDES[spec.name];
  if (override) return override;

  const name = spec.name.toLowerCase();
  const formula = spec.formula.toLowerCase();
  const hasWord = (w: string) => new RegExp(`\\b${w}\\b`, 'i').test(spec.name);
  const has = (s: string) => name.includes(s);

  // --- Ending-specific overrides (Stage 16) ---
  if (spec.endingId === 'bounce') return 'bounce';
  if (spec.endingId === 'big_crunch') return 'singularity';
  if (spec.endingId === 'big_rip') return 'wave';
  if (spec.endingId === 'heat_death') return 'entropy';
  if (spec.endingId === 'vacuum_decay') return 'quantum';

  // --- Singularity / Bounce ---
  if (has('singularity')) return 'singularity';
  if (has('quantum bounce') || has('bounce')) return 'bounce';

  // --- Black holes & their immediate phenomena ---
  if (
    has('black hole') ||
    hasWord('bh') ||
    formula.includes('⚫') ||
    has('event horizon') ||
    has('penrose') ||
    has('firewall') ||
    has('ergosphere') ||
    has('information paradox') ||
    has('bh entropy') ||
    has('bh domination') ||
    has('bh merger') ||
    has('bh evaporation') ||
    has('supermassive evaporation')
  ) {
    return 'black_hole';
  }

  // --- Supernovae / Novae (before remnant so Helium Flash, Type Ia SN, Nova all hit here) ---
  if (
    has('supernova') ||
    hasWord('sn') ||
    has('nova') ||
    has('helium flash') ||
    has('eruption') ||
    has('evaporation flash') ||
    has('precursor')
  ) {
    return 'supernova';
  }

  // --- Galaxies (before remnant so "Dwarf Galaxy" beats "dwarf") ---
  // Use word-boundary for 'galactic' to avoid "metagalactic" → galaxy.
  // Use word-boundary for 'agn' to avoid "magnetic"/"magnetar" → galaxy.
  if (
    has('galaxy') ||
    hasWord('galactic') ||
    has('quasar') ||
    has('spiral arm') ||
    hasWord('agn') ||
    has('cluster') ||
    has('cosmic web') ||
    has('large scale')
  ) {
    return 'galaxy';
  }

  // --- Stellar remnants (dwarf, neutron star, magnetar, pulsar, planck remnant, iron/diamond star) ---
  if (
    has('white dwarf') ||
    has('brown dwarf') ||
    has('black dwarf') ||
    has('red dwarf') ||
    hasWord('dwarf') ||
    has('neutron star') ||
    has('magnetar') ||
    has('pulsar') ||
    has('remnant') ||
    has('graveyard') ||
    has('iron star') ||
    has('diamond star') ||
    has('planck remnant')
  ) {
    return 'remnant';
  }

  // --- Halos & filaments (before any 'dark' fall-through so dark matter is correctly halo) ---
  if (has('dark matter') || has('halo') || has('filament')) {
    return 'halo';
  }

  // --- Void / vacuum / dark energy / heat death (special: thermal death routes to entropy) ---
  if (
    has('thermal death') ||
    has('thermal equilibrium')
  ) {
    return 'entropy';
  }
  if (
    has('void') ||
    has('darkness') ||
    has('vacuum') ||
    has('de sitter') ||
    has('dark energy')
  ) {
    return 'void';
  }

  // --- Stars (after galaxy/remnant so dwarf-galaxy and white-dwarf go to their right places) ---
  if (
    has('protostar') ||
    has('main sequence star') ||
    has('star formation') ||
    has('cosmic dawn') ||
    has('fusion') ||
    has('carbon') ||
    has('oxygen') ||
    has('stellar feedback') ||
    name === 'sun' ||
    (has('star') && !has('starlight'))
  ) {
    return 'star';
  }

  // --- Quarks (now safe: 'ark' inside 'quark' no longer triggers planet/ark) ---
  if (has('antiquark')) return 'antiparticle';
  if (has('quark') || has('color charge') || has('flux tube')) return 'quark';

  // --- Antimatter ---
  if (has('antimatter')) return 'antiparticle';

  // --- Spacecraft → planet (interstellar ark uses word-boundary 'ark') ---
  if (
    has('satellite') ||
    has('probe') ||
    has('lander') ||
    hasWord('ark')
  ) {
    return 'planet';
  }
  if (has('telescope') || has('observatory')) return 'radiation';

  // --- Planets and Solar System bodies (NO 'core'/'zone'/'disk' which previously mismatched) ---
  if (
    has('planetary nebula')
  ) {
    return 'cloud';
  }
  if (
    has('planet') ||
    has('moon') ||
    has('asteroid') ||
    has('comet') ||
    has('planetesimal') ||
    has('rocky') ||
    has('gas giant') ||
    has('goldilocks') ||
    has('habitable')
  ) {
    return 'planet';
  }

  // --- Water / ocean ---
  if (has('water') || has('ocean') || formula.includes('h₂o')) return 'water';

  // --- Biology ---
  if (hasWord('dna') || hasWord('rna')) return 'dna';
  if (has('neuron') || has('brain')) return 'neuron';
  if (has('cell') || has('eukaryote') || has('prokaryote') || has('membrane') || has('photosynthesis')) {
    return 'cell';
  }
  if (has('life') || has('amino') || has('fish') || has('plant') || has('sapiens') || has('cambrian')) {
    return 'life';
  }

  // --- Plasma (before cloud so "Plasma to Gas" stays plasma, not cloud) ---
  if (has('plasma') || has('qgp') || has('fireball') || hasWord('hii')) return 'plasma';

  // --- Clouds & gas (placed before atom/molecule so envelope/nebula stay cloud) ---
  if (
    has('cloud') ||
    has(' gas') ||
    has('nebula') ||
    has('envelope') ||
    has('atmosphere') ||
    has('intergalactic medium') ||
    has('stellar wind') ||
    has('gas accretion') ||
    has('cold gas')
  ) {
    return 'cloud';
  }

  // --- Atoms (positronium, ionized hydrogen, HII bubble, bubble merger) ---
  if (
    has('positronium') ||
    has('ionized hydrogen') ||
    has('bubble') ||
    has('hydrogen atom') ||
    has('helium atom') ||
    has('atom')
  ) {
    return 'atom';
  }

  // --- Molecules ---
  if (has('molecule') || has('molecular') || has('hydrogen cloud') || has('cold hydrogen')) {
    return 'molecule';
  }

  // --- Waves / oscillations (before nucleus so Baryon Acoustic Oscillation is wave) ---
  if (
    has('wave') ||
    has('oscillation') ||
    has('signal') ||
    has('echo') ||
    has('slingshot') ||
    has('front') ||
    has('damping') ||
    has('mass transfer') ||
    has('perturbation') ||
    has('streaming') ||
    has('break') ||
    has('trough')
  ) {
    return 'wave';
  }

  // --- Nuclei ---
  if (
    has('proton') ||
    has('neutron') ||
    has('deuterium') ||
    has('tritium') ||
    has('helium') ||
    has('lithium') ||
    has('beryllium') ||
    has('baryon') ||
    has('pion') ||
    has('kaon') ||
    has('first heavy elements') ||
    has('first nuclei') ||
    has('iron') ||
    has('nuclei') ||
    has('nucleus') ||
    hasWord('bbn')
  ) {
    return 'nucleus';
  }

  // --- Radiation / photons ---
  if (
    has('photon') ||
    has('gamma') ||
    has('radiation') ||
    has('cmb') ||
    hasWord('uv') ||
    has('x-ray') ||
    has('lyman') ||
    has('ionizing') ||
    has('metagalactic') ||
    has('cosmic background') ||
    has('transparency')
  ) {
    return 'radiation';
  }

  // --- Entropy / decay / annihilation / equilibrium ---
  if (
    has('entropy') ||
    has('annihilation') ||
    has('washout') ||
    has('equilibrium')
  ) {
    return 'entropy';
  }

  // --- Leptons ---
  if (has('electron') || has('positron') || has('neutrino') || has('muon')) return 'lepton';

  // --- Bosons ---
  if (has('gluon') || has('boson') || has('higgs') || has('graviton') || has('monopole')) return 'boson';

  // --- Fields ---
  if (
    has('field') ||
    has('symmetry') ||
    has('wormhole') ||
    has('limit') ||
    has('surface') ||
    has('cp violation') ||
    has('phase boundary') ||
    has('confinement') ||
    has('inflaton') ||
    has('potential') ||
    has('last scattering') ||
    has(' seed') ||
    has('collapse') ||
    has('reionization complete') ||
    has('epoch of reionization') ||
    has('gravitational lens')
  ) {
    return 'field';
  }

  // --- Quantum / fluctuations / tunneling / virtual particles ---
  if (
    has('quantum') ||
    has('fluctuation') ||
    has('tunneling') ||
    has('virtual particle')
  ) {
    return 'quantum';
  }

  // --- Decay catch-all (after all specific cases above) ---
  if (has('decay')) return 'entropy';

  if (stageId <= 3) return 'quantum';
  return 'particle';
}

/** Dispatch glyph picking by stage. Stages 1, 10, 11 use the original behavior. */
function glyphFor(stageId: StageId, spec: EntitySpec): EntityGlyph {
  if (stageId === 1 || stageId === 10 || stageId === 11) {
    return glyphForLegacy(stageId, spec);
  }
  return glyphForRefined(stageId, spec);
}

function stageEffectScale(_stageId: StageId, spec: EntitySpec): number {
  // Applies to ALL stages including stage 1 (Phase 4-1): under the
  // player-stage gear power curve every same-rarity item shares one global
  // scalar, so a stage-1 exemption would make stage-1 gear permanently 4×/10×
  // stronger per copy than everything else. Per-rarity values must stay in
  // one flat band across stages (guarded by a test).
  if (!REBALANCED_EFFECT_RARITIES.has(spec.rarity)) return 1;
  if (spec.effect.type === 'auto') return 0.1;
  return 0.25;
}

function maxCountForSpec(spec: EntitySpec): number {
  if (spec.effect.type === 'time') {
    return ENTITY_TIME_MAX_COUNT[spec.rarity] ?? ENTITY_MAX_COUNT[spec.rarity];
  }
  return ENTITY_MAX_COUNT[spec.rarity];
}

function stage(stageId: StageId, specs: EntitySpec[]): StageEntity[] {
  const threshold = ENTITY_COST_ANCHORS[stageId];
  const color = ENTITY_STAGE_ACCENT[stageId];

  // Pre-compute each spec's glyph so we can detect within-stage duplicates and
  // give same-glyph entities a slight hue shift (still in the stage palette).
  const glyphs = specs.map((spec) => glyphFor(stageId, spec));
  const glyphSeenCount: Record<string, number> = {};
  const glyphSlot: number[] = specs.map((_, i) => {
    const g = glyphs[i];
    const slot = glyphSeenCount[g] ?? 0;
    glyphSeenCount[g] = slot + 1;
    return slot;
  });

  return specs.map((spec, index) => {
    const tint = ENTITY_RARITY_TINT[spec.rarity];
    let entityColor = blendHex(color, tint.hex, tint.amount);
    // Apply hue shift if this is not the first entity using its glyph in the stage.
    const slot = glyphSlot[index];
    if (slot > 0) {
      const offset = GLYPH_DUPE_HUE_OFFSETS[slot % GLYPH_DUPE_HUE_OFFSETS.length];
      if (offset !== 0) entityColor = rotateHexHue(entityColor, offset);
    }
    // Multiplier effects are NOT scaled up by rarity — they compound multiplicatively across stages.
    // Auto, click, crit, and time effects get rarity scaling to make higher rarities feel impactful.
    const effectScale = spec.effect.isFlat || spec.effect.type === 'multiplier' ? 1 : ENTITY_RARITY_EFFECT_SCALE[spec.rarity];
    // Auto-populate Korean translations from lookup table when not already on the spec.
    const ko = ENTITY_KO_TRANSLATIONS[spec.name];
    const nameKo = spec.nameKo ?? ko?.name;
    const descriptionKo = spec.descriptionKo ?? ko?.description;
    const maxCount = maxCountForSpec(spec);
    const scaledEffectValue = spec.effect.value * effectScale * stageEffectScale(stageId, spec);
    // Canonical id is position-only (s{stage}_{pos}) so renaming an entity never
    // changes its id — the id is decoupled from the (mutable) name. The old
    // name-derived id is kept as an alias so pre-decoupling saves still resolve;
    // loadGame normalizes any stored id to this canonical form on load.
    const position = String(index + 1).padStart(2, '0');
    const id = `s${stageId}_${position}`;
    const legacyNameId = `s${stageId}_${position}_${slugify(spec.name)}`;
    const aliases = Array.from(new Set([legacyNameId, ...(spec.aliases ?? [])]));
    return {
      id,
      stageId,
      name: spec.name,
      ...(nameKo ? { nameKo } : {}),
      formula: spec.formula,
      description: spec.description,
      ...(descriptionKo ? { descriptionKo } : {}),
      rarity: spec.rarity,
      baseCost: Math.ceil(threshold * ENTITY_BASE_COST_FACTOR[spec.rarity]),
      costScaling: ENTITY_COST_SCALING[spec.rarity],
      maxCount,
      effect: { ...spec.effect, value: scaledEffectValue },
      visual: {
        symbol: spec.formula,
        glyph: glyphs[index],
        color: entityColor,
        glowColor: entityColor,
        size: ENTITY_RARITY_SIZE[spec.rarity],
        motion: motionFor(spec.rarity, index),
      },
      ...(spec.endingId ? { endingId: spec.endingId } : {}),
      aliases,
    };
  });
}

/**
 * Korean translations keyed by entity English name.
 * Keeps the bulky `item(...)` calls below readable while still feeding KO copy
 * through the central `stage()` builder.
 */
const ENTITY_KO_TRANSLATIONS: Record<string, { name: string; description: string }> = {
  // Stage 1
  'Quantum Fluctuation':    { name: '양자 요동',        description: '모든 미래 구조를 잉태할 진공 에너지의 잔물결.' },
  'False Vacuum Bubble':    { name: '거짓 진공 거품',   description: '응축된 에너지를 토해내는 불안정한 진공 주머니.' },
  'Inflaton Surge':         { name: '인플라톤 폭주',    description: '폭발력을 증폭시키는 인플라톤 장의 급등.' },

  // Stage 2
  'Up Quark':               { name: '업 쿼크',          description: '모든 양성자에 두 번씩 등장하는 가벼운 쿼크.' },
  'Down Quark':             { name: '다운 쿼크',        description: '양성자와 중성자가 공유하는 가벼운 쿼크.' },
  'Electron':               { name: '전자',             description: '모든 미래 원자를 돌게 될 안정한 경입자.' },
  'Electron Neutrino':      { name: '전자 중성미자',    description: '질량이 거의 없이 물질을 그대로 통과하는 전자형 중성미자.' },
  'Gluon':                  { name: '글루온',           description: '쿼크를 강입자 속에 묶는 색력 매개입자.' },
  'Strange Quark':          { name: '스트레인지 쿼크',  description: '기묘도를 지닌 2세대 쿼크.' },
  'W Boson':                { name: 'W 보손',           description: '쿼크의 향(flavor)을 바꾸는 약력 매개입자.' },
  'CP Violation Pocket':    { name: 'CP 비대칭 영역',   description: '물질이 반물질보다 살아남게 하는 미세한 비대칭.' },

  // Stage 3
  'Free Quark':             { name: '자유 쿼크',        description: '뜨거운 플라스마 바다에서 아직 갇히지 않은 쿼크.' },
  'Gluon Plasma':           { name: '글루온 플라스마',  description: '풀려난 색력 매개입자의 밀집 욕조.' },
  'Pion':                   { name: '파이온',           description: '잔여 강력을 매개하는 가벼운 중간자.' },
  'Muon':                   { name: '뮤온',             description: '플라스마에 잠깐 가득했던 무거운 전자의 사촌.' },
  'Plasma Vortex':          { name: '플라스마 소용돌이',description: '거의 완벽한 QCD 유체의 휘몰아치는 액적.' },
  'Charm Quark':            { name: '참 쿼크',          description: '플라스마 속의 무거운 2세대 쿼크.' },
  'Kaon':                   { name: '케이온',           description: 'CP 위반 채널과 얽힌 기묘 중간자.' },
  'Bottom Quark':           { name: '바텀 쿼크',        description: '향 진동(oscillation)을 일으키는 무거운 쿼크.' },
  'Color Flux Tube':        { name: '색 자속 끈',       description: '갇힌 쿼크를 잇는 탄성 색장 끈.' },
  'Top Quark':              { name: '탑 쿼크',          description: '모든 쿼크 중 가장 무겁고 — 강입자로 묶이기도 전에 붕괴한다.' },
  'QCD Phase Boundary':     { name: 'QCD 상경계',       description: '강결합 물질의 상이 바뀌는 임계선.' },
  'Confinement Onset':      { name: '갇힘 개시',        description: '쿼크가 영구히 강입자 속에 갇히기 시작한다.' },

  // Stage 4
  'Proton':                 { name: '양성자',           description: '모든 미래 수소를 떠받치는 안정한 중입자.' },
  'Neutron':                { name: '중성자',           description: '가벼운 핵으로 융합해 들어가는 중성 중입자.' },
  'Deuterium':              { name: '중수소',           description: '핵융합 사슬의 첫 안정한 다리, 수소-2.' },
  'Photon':                 { name: '광자',             description: '전자기력을 매개하는 질량 없는 빛의 양자 — 모든 융합 단계에서 방출된다.' },
  'Tritium':                { name: '삼중수소',         description: '헬륨 합성을 떠받치는 방사성 수소-3.' },
  'Helium-3':               { name: '헬륨-3',           description: '양성자-양성자 사슬의 가벼운 헬륨 동위원소.' },
  'Beryllium-7':            { name: '베릴륨-7',         description: '리튬-7로 가는 불안정한 디딤돌.' },
  'Helium-4':               { name: '헬륨-4',           description: '원시 원소 비율을 고정하는 안정한 헬륨.' },
  'Primordial Fireball':    { name: '원시 화구',        description: '갓 태어난 우주의 들끓는 핵 화로.' },
  'Lithium-7':              { name: '리튬-7',           description: '빅뱅 화로에서 만들어진 가장 무거운 핵.' },
  'Muon Neutrino':          { name: '뮤온 중성미자',    description: '식어가는 경입자 플라스마에서 질량 아래로 분리되는 뮤온형 중성미자.' },
  'Neutron-Proton Ratio':   { name: '중성자/양성자 비', description: '원시 원소 비율을 결정짓는 1:7의 비율.' },
  'BBN Completion':         { name: '빅뱅 핵합성 완료', description: '가벼운 원소 합성이 영원히 고정된다.' },
  'Fusion Window':          { name: '융합의 창',        description: '원자 역사 전체를 결정짓는 3분의 창.' },

  // Stage 5
  'Hydrogen':               { name: '수소',             description: '1번 원소 — 양성자가 전자를 붙잡아 최초의 중성 원자가 탄생한다.' },
  'Free Electron':          { name: '자유 전자',        description: '중성 기체 시대 직전의 마지막 떠도는 전하.' },
  'Helium':                 { name: '헬륨',             description: '2번 원소 — 헬륨 핵이 전자 두 개를 모두 끌어들여 중성이 된다.' },
  'CMB Photon':             { name: 'CMB 광자',         description: '플라스마 안개가 걷히며 풀려난 빛.' },
  'Hydrogen Cloud':         { name: '수소 구름',        description: '최초의 구름으로 모이는 중성 수소.' },
  'Photon Decoupling':      { name: '광자 분리',        description: '빛이 물질에서 떨어져 자유롭게 흐른다.' },
  'Baryon Acoustic Oscillation': { name: '바리온 음향 진동', description: '모든 대규모 구조를 잉태한 얼어붙은 음파.' },
  'Plasma to Gas':          { name: '플라스마→기체',    description: '이온화 플라스마가 식어 투명한 중성 기체가 된다.' },
  'Dark Matter Halo':       { name: '암흑물질 헤일로',  description: '은하 형성 위치를 정하는 보이지 않는 중력 우물.' },
  'Massive Dark Halo':      { name: '거대 암흑 헤일로', description: '은하 퍼텐셜을 빚는 거대한 암흑 골격.' },
  'Density Perturbation':   { name: '밀도 요동',        description: '최초 구조의 씨앗이 되는 미세한 과밀.' },
  'Last Scattering Surface':{ name: '최후 산란면',      description: 'CMB 광자가 마지막으로 산란된 껍질.' },
  'CMB Anisotropy':         { name: 'CMB 비등방성',     description: '잔광 빛에 새겨진 미세한 온도 대비.' },
  'Cosmic Transparency':    { name: '우주의 투명화',    description: '우주가 마침내 빛에 투명해진다.' },
  'Structure Seed':         { name: '구조 씨앗',        description: '모든 은하로 자라날 원시 요동.' },

  // Stage 6
  'Cold Hydrogen':          { name: '차가운 수소',      description: '별빛 없는 어둠 속을 떠도는 중성 수소.' },
  '21cm Signal':            { name: '21cm 신호',        description: '차가운 암흑 가스를 추적하는 수소 스핀 전이선.' },
  'Dark Matter Filament':   { name: '암흑물질 필라멘트',description: '가스가 천천히 흐르는 보이지 않는 발판.' },
  'Cold Gas Cloud':         { name: '차가운 가스 구름', description: '식어가며 안쪽으로 긴 붕괴를 시작하는 구름.' },
  'Molecular Hydrogen':     { name: '분자 수소',        description: '가스가 열을 식혀 붕괴할 수 있게 해주는 분자.' },
  'Protogalactic Cloud':    { name: '원시 은하 구름',   description: '은하가 될 길 위의 거대한 가스 저장소.' },
  'Dark Matter Clump':      { name: '암흑물질 덩어리',  description: '국소 중력 우물을 깊게 만드는 밀집된 암흑 매듭.' },
  'Gravitational Potential':{ name: '중력 퍼텐셜',      description: '미래 별의 요람으로 가스를 끌어들이는 깊은 우물.' },
  'Mini Halo':              { name: '미니 헤일로',      description: '최초의 별을 품을 만큼 밀집된 작은 암흑 헤일로.' },
  'Baryonic Streaming':     { name: '바리온 스트리밍',  description: '최초 별을 지연시키는 초음속 가스 흐름.' },
  'Dark Energy Background': { name: '암흑에너지 배경',  description: '팽창을 조용히 가속하는 진공 에너지.' },
  'Silk Damping':           { name: '실크 감쇠',        description: '광자 확산으로 지워지는 소규모 요동.' },
  'Gravitational Collapse': { name: '중력 붕괴',        description: '중력이 마침내 압력을 이기고 운명을 점화한다.' },
  'First Cosmic Dawn Seed': { name: '우주여명의 씨앗',  description: '점화되면 어둠을 끝낼 마지막 씨앗.' },

  // Stage 7
  'Protostar':              { name: '원시별',           description: '점화를 향해 수축하며 가열되는 가스 구체.' },
  'UV Photon':              { name: '자외선 광자',      description: '수소에서 전자를 뜯어내는 고에너지 광자.' },
  'Main Sequence Star':     { name: '주계열성',         description: '긴 평온기를 보내는 안정한 수소 연소 별.' },
  'Hydrogen Fusion':        { name: '수소 융합',        description: '항성 핵에서 양성자 네 개가 헬륨 하나로 융합된다.' },
  'Oxygen':                 { name: '산소',             description: '탄소 위에 헬륨이 포획되어 산소가 만들어진다.' },
  'Stellar Wind':           { name: '항성풍',           description: '뜨거운 항성 표면에서 불어 나오는 입자류.' },
  'HII Region':             { name: 'HII 영역',         description: '뜨거운 별 주위에 빛나는 이온화 수소 구름.' },
  'Carbon':                 { name: '탄소',             description: '6번 원소 — 삼중알파 반응이 탄소를 단조하며 화학의 새벽을 연다.' },
  'Pop III Cluster':        { name: '종족 III 성단',    description: '1세대로 함께 태어난 금속이 없는 별 무리.' },
  'Iron':                   { name: '철',               description: '26번 원소 — 항성 핵이 헬륨 너머 가장 안정한 핵인 철까지 원소를 단조한다.' },
  'Stellar Feedback':       { name: '항성 피드백',      description: '주위 가스 구름을 다시 빚는 별의 에너지.' },
  'Supernova Precursor':    { name: '초신성 전조',      description: '폭발적 중력 붕괴를 앞둔 거대 별.' },
  'Pop III Supernova':      { name: '종족 III 초신성',  description: '최초의 별이 폭발하며 우주에 중원소를 뿌린다.' },
  'Pair Instability SN':    { name: '쌍 불안정 초신성', description: '감마 쌍생성으로 완전히 파괴되는 거대 별.' },

  // Stage 8
  'Ionizing Photon':        { name: '이온화 광자',      description: '수소 전자를 떼어낼 만큼 강한 광자.' },
  'Ionized Hydrogen':       { name: '이온화 수소',      description: '자외선 별빛에 전자를 빼앗긴 수소.' },
  'HII Bubble':             { name: 'HII 거품',         description: '어린 별 주위로 팽창하는 이온화 가스 구.' },
  'Lyman Break':            { name: '라이먼 단절',      description: 'HII 영역의 경계를 표시하는 스펙트럼 단절.' },
  'Quasar':                 { name: '퀘이사',           description: '강착하는 블랙홀이 이온화를 멀리까지 뚫는다.' },
  'Early Galaxy':           { name: '초기 은하',        description: '이온화 빛을 폭포처럼 쏟아내는 어린 은하.' },
  'Ionization Front':       { name: '이온화 전선',      description: '중성 가스를 들불처럼 가로지르는 경계면.' },
  'X-Ray Background':       { name: 'X선 배경',         description: '전선 앞 가스를 미리 가열하는 단단한 X선.' },
  'Metagalactic UV':        { name: '메타은하 UV',      description: '가스를 계속 이온화하는 범우주적 자외선 배경.' },
  'Bubble Merger':          { name: '거품 융합',        description: '인접한 이온화 영역이 합쳐져 투명한 바다가 된다.' },
  'Gunn-Peterson Trough':   { name: '건-피터슨 골',     description: '완전 재이온화를 확증하는 중성 수소의 부재.' },
  'Intergalactic Medium':   { name: '은하간 매질',      description: '은하 사이 이온화 상태를 추적하는 희박한 가스.' },
  'Reionization Complete':  { name: '재이온화 완료',    description: '대부분의 우주 수소가 이온화되어 우주가 맑아진다.' },
  'Epoch of Reionization':  { name: '재이온화 시기',    description: '암흑기를 마감한 위대한 우주의 정화.' },

  // Stage 9
  'Dwarf Galaxy':           { name: '왜소은하',         description: '수백만의 어린 별을 품은 작은 은하.' },
  'Gas Accretion':          { name: '가스 강착',        description: '은하 원반으로 흘러드는 차가운 가스 줄기.' },
  'Spiral Arm':             { name: '나선팔',           description: '원반 따라 별 형성을 잉태하는 밀도파.' },
  'Star Formation Cloud':   { name: '별 형성 구름',     description: '새 항성단으로 붕괴하는 분자 구름.' },
  'Galaxy Merger':          { name: '은하 충돌',        description: '가스를 휘저어 폭발적 별형성을 일으키는 은하 충돌.' },
  'Galaxy Cluster':         { name: '은하단',           description: '수백 개 은하의 중력 도시.' },
  'Supermassive BH':        { name: '초대질량 블랙홀', description: '숙주 은하와 함께 진화하는 중심 블랙홀.' },
  'Relic Supermassive BH':  { name: '잔존 초대질량 블랙홀', description: '모든 별보다 오래 살아남는 은하 핵의 블랙홀.' },
  'Active Galactic Nucleus':{ name: '활동성 은하핵',    description: '숙주 은하 전체보다 밝은 강착 중심.' },
  'Gravitational Lens':     { name: '중력 렌즈',        description: '배경 빛을 호와 고리로 휘는 질량.' },
  'Filamentary Structure':  { name: '필라멘트 구조',    description: '은하 마디를 잇는 암흑물질과 가스의 실.' },
  'Cosmic Web Node':        { name: '우주 거미줄 마디', description: '대규모 거미줄의 심장에 있는 필라멘트 교차점.' },
  'Cosmic Void':            { name: '우주 보이드',      description: '수백 메가파섹에 걸친 거대한 저밀도 영역.' },
  'Large Scale Structure':  { name: '대규모 구조',      description: '필라멘트·마디·보이드로 짜인 우주의 거미줄 전체.' },

  // Stage 10
  'Dust Grain':             { name: '먼지 알갱이',      description: '행성으로 가는 긴 여정을 시작하는 규산염 입자.' },
  'Iron Core':              { name: '철 핵',            description: '분화한 암석 행성의 금속이 풍부한 중심.' },
  'Planetesimal':           { name: '미행성',           description: '무수한 먼지가 모여 만든 킬로미터 크기 천체.' },
  'Water Ice':              { name: '얼음물',           description: '혜성이 원반 전역에 운반한 얼어붙은 물.' },
  'Rocky Planet':           { name: '암석 행성',        description: '안정한 고체 표면을 가진 규산염 행성.' },
  'Comet':                  { name: '혜성',             description: '휘발성 물질과 유기물을 안쪽으로 옮기는 얼음 천체.' },
  'Asteroid Belt':          { name: '소행성대',         description: '결국 합쳐지지 못한 미행성들의 고리.' },
  'Gas Giant':              { name: '가스 행성',        description: '계의 모양을 결정하는 수소-헬륨 거대 행성.' },
  'Moon':                   { name: '위성',             description: '자전축을 안정시키고 조석을 일으키는 위성.' },
  'Liquid Water':           { name: '액체 물',          description: '복잡한 화학을 가능케 하는 안정한 표면 용매.' },
  'Magnetic Field':         { name: '자기장',           description: '해로운 항성풍을 막아주는 행성 방패.' },
  'Goldilocks Zone':        { name: '골디락스 영역',    description: '표면의 물이 액체로 머무는 궤도 구역.' },
  'Sun':                    { name: '태양',             description: '붕괴하는 성운에서 가장 먼저 태어나는 중심 별.' },
  'Protoplanetary Disk':    { name: '원시행성 원반',    description: '먼지와 가스가 빙글빙글 돌며 세상을 빚어내는 거대한 요람.' },
  'Habitable World':        { name: '생명 가능 행성',   description: '생명을 위한 모든 조건이 맞아떨어진 세계.' },

  // Stage 11 — Earth formation → Life → Civilization
  'Molten Crust':           { name: '용암 지각',        description: '냉각되는 마그마가 최초의 암석 표면을 만든다.' },
  'Earth Formation':        { name: '지구 형성',        description: '먼지와 돌덩어리가 충돌·합체하며 점점 둥근 행성을 빚어낸다.' },
  'First Ocean':            { name: '최초의 바다',      description: '수증기가 응결해 젊은 지구를 덮는 광활한 바다가 된다.' },
  'Atmosphere':             { name: '대기',             description: '화산 가스가 행성을 보호하는 담요를 형성한다.' },
  'Moon Formation':         { name: '달 형성',          description: '거대 충돌의 잔해가 모여 달이 된다.' },
  'Prokaryote':             { name: '원핵생물',         description: '최초의 단순한 세포 — 생명이 심해에서 시작된다.' },
  'Photosynthesis':         { name: '광합성',           description: '남세균이 대기를 산소로 채운다.' },
  'Cambrian Explosion':     { name: '캄브리아 대폭발',  description: '고대 바다에서 복잡한 몸체 설계가 폭발적으로 등장한다.' },
  'Continents Rise':        { name: '대륙의 융기',      description: '지각판이 수면 위로 땅을 밀어 올린다.' },
  'Neuron':                 { name: '뉴런',             description: '신경 세포가 생각하는 네트워크를 엮는다.' },
  'Homo Sapiens':           { name: '호모 사피엔스',    description: '언어와 불로 세상을 바꾸는 도구 제작자.' },
  'City Lights':            { name: '도시의 불빛',      description: '문명이 행성의 밤을 밝힌다.' },
  'Artificial Satellite':   { name: '인공위성',         description: '기계가 지구를 돌며 살아있는 행성을 측량한다.' },
  'Spacefaring Humanity':   { name: '우주 항해 인류',   description: '행성에서 태어난 종이 여러 세계의 문명이 된다.' },
  'Interstellar Ark':       { name: '성간 방주',        description: '지구의 생명 기록을 고향 별 너머로 실어 나른다.' },

  // Stage 12
  'Red Giant Envelope':     { name: '적색거성 외피',    description: '내행성을 삼킬 만큼 부풀어 오른 항성 외층.' },
  'Stellar Wind AGB':       { name: 'AGB 항성풍',       description: '말기에 외피 질량을 우주로 흩뿌리는 별.' },
  'Carbon-O Core':          { name: '탄소-산소 핵',     description: '핵융합이 끝난 뒤 남은 작고 단단한 탄소-산소 핵.' },
  'Helium Flash':           { name: '헬륨 섬광',        description: '압축된 항성 핵에서 헬륨이 폭주 점화한다.' },
  'Planetary Nebula':       { name: '행성상 성운',      description: '죽어가는 태양형 별이 벗어 던진 빛나는 가스 껍질.' },
  'Mass Transfer':          { name: '질량 이동',        description: '쌍성 동반성이 항성 잔해에 물질을 꾸준히 공급한다.' },
  'Degenerate Electron':    { name: '축퇴 전자',        description: '파울리 배타 원리로 압력을 버티는 빽빽한 전자.' },
  'White Dwarf':            { name: '백색왜성',         description: '전자 압력으로 버티며 영겁을 식어가는 잔해.' },
  'Neutron Star':           { name: '중성자별',         description: '수 km 안에 핵 밀도가 응축된 붕괴한 핵.' },
  'Nova Eruption':          { name: '신성 폭발',        description: '백색왜성 표면에서 강착된 수소가 섬광을 일으킨다.' },
  'Magnetar':               { name: '마그네타',         description: '알려진 가장 강한 자기장을 가진 중성자별.' },
  'Gravitational Wave':     { name: '중력파',           description: '가속하는 치밀 잔해가 만드는 시공간의 잔물결.' },
  'Type Ia Supernova':      { name: 'Ia형 초신성',      description: '거리 표준으로 쓰이는 백색왜성의 폭발.' },
  'Core Collapse SN':       { name: '핵붕괴 초신성',    description: '거대 별 핵이 함몰한 뒤 바깥으로 튕겨 나간다.' },

  // Stage 13
  'Brown Dwarf':            { name: '갈색왜성',         description: '중력 수축의 열만으로 희미하게 빛나는 실패한 별.' },
  'Cold Gas Remnant':       { name: '차가운 가스 잔재', description: '별 형성이 식어가며 남은 성간 가스.' },
  'Cooling White Dwarf':    { name: '식어가는 백색왜성',description: '수조 년에 걸쳐 천천히 어두워지는 백색왜성.' },
  'Stellar Graveyard':      { name: '항성의 묘지',      description: '살아 있는 별보다 잔해가 더 많아진 은하.' },
  'Galaxy Halo Dispersal':  { name: '은하 헤일로 흩어짐',description: '고대 별들이 은하 외곽 헤일로로 흩어져 간다.' },
  'Gravitational Slingshot':{ name: '중력 새총',        description: '근접 통과로 은하 밖으로 별을 날려 보내는 사건.' },
  'Pulsar':                 { name: '펄사',             description: '전파 빔을 휘두르며 회전하는 중성자별.' },
  'Black Dwarf':            { name: '흑색왜성',         description: '언젠가 백색왜성이 모두 식어 어두워졌을 때 남을 잔해.' },
  'Iron Star':              { name: '철 별',            description: '먼 미래에 양자 터널링으로 철로 수렴해 가는 물질.' },
  'Binary BH Merger':       { name: '쌍 블랙홀 병합',   description: '두 블랙홀이 나선 융합하며 시공간을 울린다.' },
  'Stellar Mass BH':        { name: '항성질량 블랙홀',  description: '거대 별이 붕괴해 남긴 블랙홀.' },
  'Last Red Dwarf':         { name: '마지막 적색왜성',  description: '수소 공급을 다 써가는 마지막 작은 별.' },
  'Total Darkness':         { name: '완전한 어둠',      description: '별빛이 끝나고 은하에는 잔해만 남는다.' },

  // Stage 14
  'Decay Positron':         { name: '붕괴 양전자',      description: '붕괴하는 중입자가 방출하는 반전자.' },
  'Pion Decay':             { name: '파이온 붕괴',      description: '중성 파이온이 두 개의 광자로 즉시 변환된다.' },
  'Decay Neutrino':         { name: '붕괴 중성미자',    description: '우주로 자유롭게 빠져나가는 유령 같은 붕괴 부산물.' },
  'Proton Decay':           { name: '양성자 붕괴',      description: '모든 바리온 물질의 가설적 느린 분해.' },
  'Diamond Star':           { name: '다이아몬드 별',    description: '깊은 어둠 속에서 결정화한 탄소 잔해가 빛난다.' },
  'GW Echo':                { name: '중력파 메아리',    description: '고대 병합의 희미한 중력파 기억.' },
  'Higgs Boson':            { name: '힉스 보손',        description: '대칭 깨짐을 통해 입자에 질량을 부여하는 힉스 장의 스칼라 들뜸.' },
  'Relic Neutrino Background':{ name: '잔존 중성미자 배경',description: '거의 정지 상태로 식어버린 빅뱅 중성미자.' },
  'Z Boson':                { name: 'Z 보손',           description: '약한 상호작용을 매개하는 전기적으로 중성인 게이지 보손 — W의 짝.' },
  'Positronium Atom':       { name: '포지트로늄',       description: '전자와 양전자가 잠시 서로를 도는 원자.' },
  'Dark Matter Annihilation':{ name: '암흑물질 소멸',   description: '암흑물질 후보들이 마침내 서로를 지운다.' },
  'BH Domination':          { name: '블랙홀 지배기',    description: '블랙홀이 남은 질량-에너지의 대부분을 차지한다.' },
  'Last Baryon':            { name: '마지막 바리온',    description: '거대한 붕괴 시계를 기다리는 마지막 양성자.' },
  'Baryon Washout':         { name: '바리온 소진',      description: '우주 전역에서 바리온 수가 0으로 시들어 간다.' },

  // Stage 15
  'Hawking Photon':         { name: '호킹 광자',        description: '사건의 지평선에서 천천히 빠져나오는 복사.' },
  'Virtual Particle Pair':  { name: '가상 입자쌍',      description: '블랙홀의 기울기에 의해 갈라지는 진공 쌍.' },
  'Ergosphere':             { name: '에르고권',         description: '에너지를 채굴할 수 있는 회전 끌림 영역.' },
  'Event Horizon':          { name: '사건의 지평선',    description: '아무것도 빠져나올 수 없는 시간의 경계.' },
  'Penrose Process':        { name: '펜로즈 과정',      description: '회전 블랙홀에서 회전 에너지를 추출한다.' },
  'BH Merger Wave':         { name: '블랙홀 병합파',    description: '블랙홀 나선 융합이 마지막 기하를 흔든다.' },
  'BH Entropy':             { name: '블랙홀 엔트로피',  description: '지평선 면적이 모든 내부 상태를 결정한다.' },
  'Stellar BH Evaporation': { name: '항성 블랙홀 증발', description: '작은 블랙홀이 천천히 스스로를 복사로 흩뜨린다.' },
  'Supermassive Evaporation':{ name: '초대질량 증발',   description: '가장 큰 블랙홀이 마침내 사그라들어 사라진다.' },
  'Firewall':               { name: '파이어월',         description: '사건의 지평선에 있다는 가설적 고에너지 장벽.' },
  'Information Paradox':    { name: '정보 역설',        description: '최후의 증발에서 정보는 살아남는가?' },
  'Planck Remnant':          { name: '플랑크 잔해',      description: '완전 증발 뒤 남을지 모르는 플랑크 규모 잔해.' },
  'Final Evaporation Flash':{ name: '최후 증발 섬광',   description: '마지막 블랙홀이 끝나며 터뜨리는 마지막 빛.' },
  'Last Black Hole':        { name: '마지막 블랙홀',    description: '궁극의 방출을 준비하는 바로 그 마지막 지평선.' },

  // Stage 16
  'Tau':                    { name: '타우',             description: '가장 무거운 하전 경입자 — 거의 즉시 붕괴하는 3세대 전자의 형제.' },
  'Lone Photon':            { name: '외로운 광자',      description: '결코 산란되지 않을 우주를 가로지르는 단 하나의 광자.' },
  'Relic Positron':         { name: '잔존 양전자',      description: '끝없이 팽창하는 공허 속을 떠도는 양전자.' },
  'Tau Neutrino':           { name: '타우 중성미자',    description: '타우와 짝을 이루는 3세대 중성미자 — 질량이 거의 없고 약하게만 상호작용한다.' },
  'Cosmic Background Photon':{ name: '우주 배경 광자',  description: '남아 있는 모든 빛이 배경 잡음으로 잦아든다.' },
  'Thermal Equilibrium':    { name: '열적 평형',        description: '온도 차이가 어디서나 한꺼번에 사라진다.' },
  'Max Entropy':             { name: '최대 엔트로피',    description: '어떤 물리 과정도 더 이상 일으킬 자유 에너지가 없다.' },
  'De Sitter Vacuum':       { name: '드 시터 진공',     description: '모든 물질이 사라진 뒤에도 암흑에너지 공간은 남는다.' },
  'Quantum Fluctuation Final':{ name: '최후의 양자 요동',description: '빈 공간조차 가까스로 흔들릴 수 있다.' },
  'Thermal Death':          { name: '열적 죽음',        description: '최대 엔트로피에 도달해 어떤 과정도 일어날 수 없다.' },
  'Dark Energy Spike':      { name: '암흑에너지 폭주',  description: '가속 팽창이 모든 구조를 갈가리 찢는다.' },
  'Gravitational Singularity':{ name: '중력 특이점',    description: '모든 밀도가 단 하나의 점으로 되돌아간다.' },
  'True Vacuum Bubble':     { name: '진정한 진공 거품', description: '더 낮은 에너지의 진공이 팽창해 물리법칙을 다시 쓴다.' },
  'Quantum Bounce':         { name: '양자 반동',        description: '붕괴가 전혀 새로운 팽창으로 튕겨 오른다.' },
};

// Item counts per stage: S1=3C, S2=4C+4R, S3=4C+4R+4E, S4-15=4C+4R+4E+2L, S16=4C+3R+2E+5L(endings)
// Effect distribution: each C/R/E group has 1 auto + 1 click + 1 crit + 1 time; L = multiplier only
// Stage 1 exception: 3 commons only (auto/click/crit), no time
export const STAGE_ENTITIES: StageEntity[] = [
  // ── Stage 1: Inflation (3 common: auto/click/crit) ─────────────────────────
  ...stage(1, [
    item('Quantum Fluctuation', 'δE',  'Vacuum energy ripple that seeds all future structure.',   'common', 'click', 15.0),
    item('False Vacuum Bubble', '⊙',   'Unstable vacuum pocket releasing its pent-up energy.',   'common', 'auto', 1.0),
    item('Inflaton Surge',      'φ̈',  'Spike in the inflaton field amplifying burst power.',     'common', 'crit',  0.5, true),
  ]),

  // ── Stage 2: Baryogenesis (4C + 4R) ────────────────────────────────────────
  ...stage(2, [
    item('Up Quark',            'u',   'Light quark appearing twice in every proton.',            'common', 'auto',  0.8),
    item('Down Quark',          'd',   'Light quark shared by protons and neutrons.',             'common', 'click', 15.0),
    item('Electron',            'e⁻',  'Stable lepton that will orbit every future atom.',        'common', 'crit',  0.3, true),
    withAliases(
      item('Electron Neutrino',   'νₑ',  'Electron-flavor neutrino, nearly massless, slipping through matter untouched.', 'common', 'auto_mult',  2.0),
      ['s2_04_neutrino'],
    ),
    item('Gluon',               'g',   'Color-force carrier binding quarks inside hadrons.',      'rare',   'auto',  2.0),
    item('Strange Quark',       's',   'Second-generation quark carrying strangeness.',           'rare',   'click', 22.0),
    item('W Boson',             'W±',  'Weak-force carrier enabling quark flavor changes.',       'rare',   'crit',  0.5, true),
    item('CP Violation Pocket', 'CP̸', 'Tiny asymmetry that lets matter outlast antimatter.',    'rare',   'auto_mult',  2.0),
  ]),

  // ── Stage 3: Quark-Gluon Plasma (4C + 4R + 4E) ─────────────────────────────
  ...stage(3, [
    item('Free Quark',         'q',    'Quark still unconfined in the hot plasma sea.',           'common', 'click', 15.0),
    item('Gluon Plasma',       'gg',   'Dense bath of unbound color-force carriers.',             'common', 'auto', 1.0),
    item('Pion',               'π',    'Light meson mediating the residual strong force.',        'common', 'crit',  0.4, true),
    item('Muon',               'μ',    'Heavy electron cousin briefly abundant in the plasma.',   'common', 'auto_mult',  1.5),
    item('Plasma Vortex',      '⟳',   'Swirling hot droplet of near-perfect QCD fluid.',        'rare',   'auto',  3.0),
    item('Charm Quark',        'c',    'Heavy second-generation quark in the plasma.',            'rare',   'click', 22.0),
    item('Kaon',               'K',    'Strange meson associated with CP-violation channels.',    'rare',   'crit',  0.6, true),
    item('Bottom Quark',       'b',    'Massive quark that seeds flavor oscillations.',           'rare',   'auto_mult',  2.0),
    item('Color Flux Tube',    '≡',    'Elastic color-field string linking confined quarks.',     'epic',   'auto',  4.0),
    withAliases(
      item('Top Quark',          't',    'Heaviest quark of all — so short-lived it decays before it can ever hadronize.', 'epic',   'click', 35.0),
      ['s3_10_top_quark_decay'],
    ),
    item('QCD Phase Boundary', '─',    'Threshold where strongly-coupled matter changes phase.',  'epic',   'crit',  1.2, true),
    item('Confinement Onset',  '⊂⊃',  'Quarks begin locking permanently inside hadrons.',       'epic',   'auto_mult',  3.0),
  ]),

  // ── Stage 4: Nucleosynthesis (4C + 4R + 4E + 2L) ───────────────────────────
  ...stage(4, [
    item('Proton',               'p⁺',  'Stable baryon that anchors all future hydrogen.',        'common', 'auto',  1.0),
    item('Neutron',              'n',   'Neutral baryon that fuses into light nuclei.',            'common', 'click', 15.0),
    item('Deuterium',            'D',   'Hydrogen-2, the first stable bridge in fusion chains.',  'common', 'auto_mult', 1.5),
    withAliases(
      item('Photon',               'γ',   'Massless quantum of the electromagnetic force — light itself, released at every fusion step.', 'common', 'crit', 0.4, true),
      ['s4_04_gamma_ray'],
    ),
    item('Tritium',              'T',   'Radioactive hydrogen-3 feeding helium synthesis.',       'rare',   'auto',  2.0),
    item('Helium-3',             '³He', 'Light helium isotope in the proton-proton chain.',       'rare',   'click', 22.0),
    item('Beryllium-7',          '⁷Be', 'Unstable stepping-stone toward lithium-7.',              'rare',   'crit',  0.6, true),
    item('Helium-4',             '⁴He', 'Stable helium locking in primordial element ratios.',    'rare',   'auto_mult',  2.0),
    item('Primordial Fireball',  '☀',   'Roiling nuclear furnace of the infant universe.',        'epic', 'click', 35.0),
    item('Lithium-7',            '⁷Li', 'Heaviest nucleus forged in the big-bang furnace.',       'epic', 'auto', 8.0),
    withAliases(
      item('Muon Neutrino',        'νμ',  'Muon-flavor neutrino, decoupling as the lepton plasma cools below its mass.', 'epic',   'crit',  1.5, true),
      ['s4_11_neutrino_freeze_out'],
    ),
    item('Neutron-Proton Ratio', 'n/p', 'The 1:7 ratio that fixes primordial element yields.',    'epic',   'auto_mult',  4.0),
    item('BBN Completion',       '★',   'Light-element synthesis locks in, never to repeat.',     'legendary', 'multiplier', 50.0),
    item('Fusion Window',        '⊕',   'Three-minute window that decides all atomic history.',   'legendary', 'multiplier', 50.0),
  ]),

  // ── Stage 5: Recombination (4C + 4R + 4E + 2L) ─────────────────────────────
  ...stage(5, [
    withAliases(
      item('Hydrogen',                  'H',    'Element 1 — a proton captures an electron and the first neutral atom is born.', 'common', 'auto',  1.5),
      ['s5_01_hydrogen_atom'],
    ),
    item('Free Electron',             'e⁻',   'Last stray charge before the neutral gas era.',        'common', 'click', 15.0),
    withAliases(
      item('Helium',                    'He',   'Element 2 — a helium nucleus pulls in both its electrons to go neutral.', 'common', 'auto_mult', 2.0),
      ['s5_03_helium_atom'],
    ),
    item('CMB Photon',                'γ_r',  'Light set free as the fog of plasma clears.',          'common', 'crit', 0.4, true),
    item('Hydrogen Cloud',            'H₂',   'Neutral hydrogen gathering into the first clouds.',    'rare',   'auto',  3.0),
    item('Photon Decoupling',         'γ↗',   'Light separates from matter and streams freely.',      'rare',   'click', 22.0),
    item('Baryon Acoustic Oscillation','◌',   'Frozen sound waves seeding all large structure.',      'rare', 'auto_mult', 2.0),
    item('Plasma to Gas',             '∽',    'Ionized plasma cools into transparent neutral gas.',   'rare', 'crit', 0.8, true),
    item('Dark Matter Halo',          '○',    'Invisible gravity well shaping where galaxies form.',  'epic',   'auto',  6.0),
    item('Density Perturbation',      'δρ',   'Tiny overdensity seeding the first structures.',       'epic',   'click', 35.0),
    item('Last Scattering Surface',   '═',    'Shell from which CMB photons last scattered.',         'epic', 'auto_mult', 4.0),
    item('CMB Anisotropy',            '≈',    'Minute temperature contrast imprinted in relic light.','epic', 'crit', 2.0, true),
    item('Cosmic Transparency',       'γ∞',   'The universe finally becomes transparent to light.',   'legendary', 'multiplier', 50.0),
    item('Structure Seed',            'δ₀',   'Primordial perturbation that grows into every galaxy.','legendary', 'multiplier', 50.0),
  ]),

  // ── Stage 6: Cosmic Dark Age (4C + 4R + 4E + 2L) ───────────────────────────
  ...stage(6, [
    item('Cold Hydrogen',         'H°',   'Neutral hydrogen drifting in starless darkness.',        'common', 'click', 15.0),
    item('21cm Signal',           '₂₁',   'Hydrogen spin-flip line tracing the cold dark gas.',    'common', 'crit', 0.4, true),
    item('Dark Matter Filament',  '╌',    'Invisible scaffold along which gas slowly flows.',       'common', 'auto_mult', 2.0),
    item('Cold Gas Cloud',        '≋',    'Cooling cloud beginning its long collapse inward.',      'common', 'auto', 1.5),
    item('Molecular Hydrogen',    'H₂*',  'Cooling molecule that lets gas shed heat and collapse.', 'rare',   'auto',  5.0),
    item('Protogalactic Cloud',   '○',    'Large gas reservoir on its way to becoming a galaxy.',  'rare',   'click', 22.0),
    item('Dark Matter Clump',     '●',    'Dense dark knot deepening the local gravity well.',      'rare', 'auto_mult', 3.0),
    item('Gravitational Potential','Φ_g', 'Deepening well drawing gas into future star cradles.',  'rare', 'crit', 0.8, true),
    item('Mini Halo',             '⊙',    'Small dark halo dense enough to cradle a first star.',  'epic',   'auto',  8.0),
    item('Baryonic Streaming',    'v_bs', 'Supersonic gas flow that delays the first stars.',      'epic',   'click', 35.0),
    item('Dark Energy Background','Λ',    'Vacuum energy quietly accelerating the expansion.',     'epic',   'crit',  2.0, true),
    item('Silk Damping',          'λ_d',  'Small-scale fluctuations erased by photon diffusion.',  'epic',   'auto_mult',  4.0),
    item('Gravitational Collapse','↓↓',   'Gravity finally overcomes pressure and ignites fate.',  'legendary', 'multiplier', 50.0),
    item('First Cosmic Dawn Seed','∘',    'The seed that will end darkness when it finally ignites.','legendary','multiplier',50.0),
  ]),

  // ── Stage 7: First Stars (4C + 4R + 4E + 2L) ───────────────────────────────
  ...stage(7, [
    item('Protostar',           '⊙',    'Contracting gas sphere heating toward ignition.',         'common', 'auto',  1.5),
    item('UV Photon',           'UV',   'Energetic photon that strips electrons from hydrogen.',   'common', 'click', 15.0),
    item('Main Sequence Star',  '★',    'Stable hydrogen-burning star in its long quiet phase.',  'common', 'crit',  0.5, true),
    item('Hydrogen Fusion',     'H→He', 'Four protons fuse into one helium in the stellar core.', 'common', 'auto_mult',  2.0),
    item('Oxygen',              'O',    'Helium capture on carbon produces oxygen.',               'rare',   'auto',  4.0),
    item('Stellar Wind',        '~~→',  'Particle stream blown outward from a hot stellar surface.','rare',  'click', 22.0),
    item('HII Region',          'HII',  'Cloud of ionized hydrogen glowing around hot stars.',    'rare',   'crit',  0.8, true),
    withAliases(
      item('Carbon',              'C',    'Element 6 — triple-alpha fusion forges carbon, the dawn of chemistry.', 'rare',   'auto_mult',  3.0),
      ['s7_08_carbon_first'],
    ),
    item('Pop III Cluster',     '✦✦✦',  'Metal-free stars born together in the first generation.','epic',   'auto',  6.0),
    withAliases(
      item('Iron',                'Fe',   'Element 26 — stellar cores forge elements up to iron, the most stable nucleus.', 'epic',   'click', 35.0),
      ['s7_10_first_heavy_elements'],
    ),
    item('Stellar Feedback',    '⟲',   'Energy from stars reshaping the surrounding gas cloud.',  'epic', 'auto_mult', 4.0),
    item('Supernova Precursor', '⚠★',  'Massive star nearing explosive gravitational collapse.',  'epic', 'crit', 2.0, true),
    item('Pop III Supernova',   '☆→',  'First stars explode, seeding space with heavy elements.','legendary','multiplier',50.0),
    item('Pair Instability SN', '✸',   'Giant star destroyed entirely by gamma-pair creation.',   'legendary','multiplier',50.0),
  ]),

  // ── Stage 8: Reionization (4C + 4R + 4E + 2L) ──────────────────────────────
  ...stage(8, [
    item('Ionizing Photon',    'hν',    'Photon energetic enough to strip a hydrogen electron.',   'common', 'auto',  2.0),
    item('Ionized Hydrogen',   'H⁺',   'Hydrogen stripped of its electron by UV starlight.',      'common', 'click', 15.0),
    item('HII Bubble',         '○⁺',   'Expanding sphere of ionized gas around young stars.',     'common', 'crit',  0.5, true),
    item('Lyman Break',        'λ',    'Spectral dropout marking the edge of an HII region.',     'common', 'auto_mult',  2.0),
    item('Quasar',             '⬟',    'Blazing accreting black hole punching ionization far.',   'rare',   'auto',  5.0),
    item('Early Galaxy',       '🌀',   'Young galaxy pouring out a torrent of ionizing light.',  'rare',   'click', 22.0),
    item('Ionization Front',   '→→→',  'Boundary advancing through neutral gas like wildfire.',   'rare', 'auto_mult', 3.0),
    item('X-Ray Background',   'Xγ',   'Hard X-ray photons pre-heating gas ahead of the front.', 'rare', 'crit', 0.8, true),
    item('Metagalactic UV',    '⟿',   'Pervasive ultraviolet background keeping gas ionized.',   'epic',   'auto',  7.0),
    item('Bubble Merger',      '◎',    'Adjacent ionized regions merge into a transparent ocean.','epic',   'click', 35.0),
    item('Gunn-Peterson Trough','GP',  'Absence of neutral hydrogen confirming full reionization.','epic',  'crit',  2.0, true),
    item('Intergalactic Medium','IGM',  'Thin gas tracking the ionization state between galaxies.','epic',  'auto_mult',  4.0),
    item('Reionization Complete','✓',  'Most cosmic hydrogen is ionized — the universe clears.',  'legendary','multiplier',50.0),
    item('Epoch of Reionization','EoR','The great cosmic clearing that ended the dark ages.',     'legendary','multiplier',50.0),
  ]),

  // ── Stage 9: Galaxy Formation (4C + 4R + 4E + 2L) ──────────────────────────
  ...stage(9, [
    item('Dwarf Galaxy',          '🌀',  'Small galaxy holding millions of young stars.',           'common', 'click', 15.0),
    item('Gas Accretion',         '↘',  'Cold gas stream flowing onto the galactic disk.',         'common', 'auto', 2.0),
    item('Spiral Arm',            '⤵',  'Density wave seeding star formation along the disk.',     'common', 'crit',  0.5, true),
    item('Star Formation Cloud',  '★+', 'Molecular cloud collapsing into a new stellar cluster.',  'common', 'auto_mult',  2.0),
    withAliases(
      item('Massive Dark Halo',     '○',  'Massive dark scaffold shaping the galactic potential.',   'rare', 'auto_mult', 3.0),
      ['s9_05_dark_matter_halo'],
    ),
    item('Galaxy Merger',         '⊗',  'Colliding galaxies stirring gas and triggering starbursts.','rare', 'auto', 4.0),
    item('Galaxy Cluster',        '⊞',  'Gravitational city of hundreds of galaxies.',             'rare', 'click', 22.0),
    item('Supermassive BH',       '⚫', 'Central black hole co-evolving with its host galaxy.',    'rare', 'crit', 0.8, true),
    item('Active Galactic Nucleus','AGN','Accreting core outshining the entire host galaxy.',      'epic',   'auto',  7.0),
    item('Gravitational Lens',    '⊃⊂', 'Mass bending background light into arcs and rings.',     'epic', 'crit', 2.0, true),
    item('Filamentary Structure', '⌇',  'Thread of dark matter and gas connecting galaxy nodes.',  'epic', 'auto_mult', 5.0),
    item('Cosmic Web Node',       '✦',  'Filament junction at the heart of the large-scale web.',  'epic', 'click', 35.0),
    item('Cosmic Void',           '□',  'Vast underdense region spanning hundreds of megaparsecs.','legendary','multiplier',50.0),
    item('Large Scale Structure', 'LSS','The full web of filaments, nodes, and voids revealed.',   'legendary','multiplier',50.0),
  ]),

  // ── Stage 10: Solar System (4C + 4R + 4E + 2L) ─────────────────────────────
  ...stage(10, [
    withAliases(
      item('Sun',            '☀',    'Central star forming first from the collapsing nebula.',    'common', 'auto',  1.5),
      ['s10_13_sun'],
    ),
    withAliases(
      item('Dust Grain',     '·',     'Silicate speck that begins the long road to planets.',     'common', 'click', 15.0),
      ['s10_01_dust_grain', 's10_02_iron_core'],
    ),
    item('Planetesimal',     '○',     'Kilometer-scale body built from countless dust grains.',   'common', 'crit',  0.4, true),
    item('Water Ice',        'H₂O',   'Frozen water delivered across the disk by comets.',        'common', 'auto_mult',  2.0),
    item('Rocky Planet',     '🪨',   'Silicate planet with a stable solid surface.',             'rare',   'auto',  4.0),
    item('Comet',            '☄',    'Icy body delivering volatiles and organics inward.',       'rare',   'click', 22.0),
    item('Asteroid Belt',    '⋯',    'Ring of leftover planetesimals that never merged.',        'rare',   'crit',  0.8, true),
    item('Gas Giant',        '♃',    'Hydrogen-helium giant whose gravity shapes the system.',   'rare',   'auto_mult',  2.0),
    item('Moon',             '☽',    'Satellite that stabilizes axial tilt and drives tides.',   'epic',   'auto',  6.0),
    item('Liquid Water',     'H₂O·', 'Stable surface solvent enabling complex chemistry.',       'epic', 'auto_mult', 5.0),
    item('Magnetic Field',   '⇌',    'Planetary shield deflecting harmful stellar wind.',        'epic', 'click', 35.0),
    item('Goldilocks Zone',  '🌡',   'Orbital band where surface water stays liquid.',           'epic', 'crit', 2.0, true),
    item('Protoplanetary Disk','◎',   'The spinning cradle of dust and gas that sculpts every world to come.','legendary','multiplier',50.0),
    item('Habitable World',  '⊕',    'A world where all the conditions for life align.',         'legendary','multiplier',50.0),
  ]),

  // ── Stage 11: Life on Earth (4C + 4R + 4E + 2L) ────────────────────────────
  // Common = Earth formation (chain-locked), Rare = Early life,
  // Epic = Civilization, Legendary = Transcendence.
  //
  // Common purchase order is gated as a chain:
  //   Earth Formation → Moon Formation → (First Ocean + Atmosphere)
  // Effect type follows position: position 2 = click, position 3 = crit,
  // position 4 = time, so the slot effect stays consistent.
  ...stage(11, [
    // Common 1 — Earth Formation (auto). Gateway to the moon.
    withAliases(
      item('Earth Formation',  '🌍',    'Rock and gas clump together, gradually sculpting a young planet.', 'common', 'auto',  2.0),
      ['s11_01_molten_crust'],
    ),
    // Common 2 — Moon Formation (click).
    withAliases(
      item('Moon Formation',   '☽',     'Giant impact ejects debris that coalesces into the Moon.',  'common', 'crit', 0.5, true),
      ['s11_04_moon_formation'],
    ),
    // Common 3 — First Ocean (crit isFlat).
    withAliases(
      item('First Ocean',      'H₂O',   'Steam condenses into vast oceans covering the young Earth.', 'common', 'auto_mult', 2.0),
      ['s11_02_first_ocean'],
    ),
    // Common 4 — Atmosphere (time).
    withAliases(
      item('Atmosphere',       'atm',   'Volcanic gases form a protective blanket around the planet.', 'common', 'click', 15.0),
      ['s11_03_atmosphere'],
    ),
    // Rare: Geology and life emerge
    withAliases(
      item('Continents Rise',  'LAND', 'Tectonic plates push land above the waterline.',            'rare',   'auto',  3.0),
      ['s11_08_continents_rise'],
    ),
    withAliases(
      item('Photosynthesis',   'O₂',   'Cyanobacteria fill the atmosphere with oxygen.',            'rare',   'click', 22.0),
      ['s11_06_photosynthesis'],
    ),
    withAliases(
      item('Prokaryote',       '○',    'First simple cells — life begins in the deep ocean.',       'rare',   'crit',  1.0, true),
      ['s11_05_prokaryote'],
    ),
    withAliases(
      item('Cambrian Explosion', '✳',  'Explosion of complex body plans in ancient seas.',          'rare',   'auto_mult',  2.0),
      ['s11_07_cambrian_explosion'],
    ),
    // Epic: Intelligence and civilization
    withAliases(
      item('Neuron',           '⚡',   'Nerve cells wire together into thinking networks.',          'epic', 'click', 35.0),
      ['s11_11_neuron'],
    ),
    withAliases(
      item('Homo Sapiens',     'HS',   'Tool-makers who reshape the world with language and fire.',  'epic', 'auto', 6.0),
      ['s11_13_homo_sapiens', 's11_13_intelligence'],
    ),
    withAliases(
      item('City Lights',      '🌃',   'Civilization glows on the night side of the planet.',        'epic',   'crit',  2.0, true),
      ['s11_10_artificial_satellite', 's11_10_fish'],
    ),
    withAliases(
      item('Artificial Satellite','🛰','Machines orbit Earth mapping the living planet.',            'epic',   'auto_mult',  5.0),
      ['s11_12_plant'],
    ),
    // Legendary: Transcendence
    withAliases(
      item('Spacefaring Humanity','🚀','A planet-born species becomes a civilization of worlds.',    'legendary','multiplier',50.0),
      ['s11_14_space_telescope'],
    ),
    withAliases(
      item('Interstellar Ark',   'ARK','A living archive carrying Earth beyond its home star.',      'legendary','multiplier',50.0),
      ['s11_14_homo_sapiens'],
    ),
  ]),

  // ── Stage 12: Death of Star (4C + 4R + 4E + 2L) ────────────────────────────
  ...stage(12, [
    item('Red Giant Envelope', '🔴',   'Outer stellar layers swelling past the inner planets.',   'common', 'auto',  2.0),
    item('Stellar Wind AGB',   '~~~→', 'Late-stage star shedding its outer mass into space.',    'common', 'click', 15.0),
    item('Carbon-O Core',      'C/O',  'Compact carbon-oxygen core left by spent fusion.',        'common', 'auto_mult', 2.0),
    item('Helium Flash',       '⚡He', 'Runaway helium ignition in the compressed stellar core.', 'common', 'crit', 0.5, true),
    item('Planetary Nebula',   'PN',   'Glowing gas shell cast off by a dying solar-type star.',  'rare',   'auto',  4.0),
    item('Mass Transfer',      '→→',   'Binary companion steadily feeding the stellar remnant.',  'rare',   'click', 22.0),
    item('Degenerate Electron','e°',   'Crowded electrons obeying Pauli exclusion to resist.',   'rare',   'crit',  0.8, true),
    item('White Dwarf',        'WD',   'Electron-pressure-supported remnant cooling over eons.',  'rare',   'auto_mult',  3.0),
    item('Neutron Star',       'NS',   'Collapsed core dense as an atomic nucleus across miles.', 'epic',   'auto',  7.0),
    item('Nova Eruption',      'NOVA', 'Accreted hydrogen flash on a white dwarf surface.',       'epic', 'crit', 2.5, true),
    item('Magnetar',           '⊛M',  'Neutron star with the strongest magnetic fields known.',  'epic', 'auto_mult', 5.0),
    item('Gravitational Wave', '◌~',   'Spacetime ripples from accelerating compact remnants.',   'epic', 'click', 35.0),
    item('Type Ia Supernova',  'SNIa', 'White dwarf detonation used as a cosmic distance candle.','legendary','multiplier',50.0),
    item('Core Collapse SN',   'SNII', 'Massive stellar core implodes and rebounds outward.',     'legendary','multiplier',50.0),
  ]),

  // ── Stage 13: Stelliferous End (4C + 4R + 4E + 2L) ─────────────────────────
  ...stage(13, [
    item('Brown Dwarf',          '🟫',  'Failed star glowing only from gravitational collapse.',  'common', 'auto',  1.5),
    item('Cold Gas Remnant',     '~H',  'Unused interstellar gas as star formation winds down.',  'common', 'click', 15.0),
    item('Cooling White Dwarf',  'WD↓', 'White dwarf slowly fading over trillions of years.',    'common', 'crit',  0.4, true),
    item('Stellar Graveyard',    '⬜',  'Remnants outnumbering living stars across the galaxy.',  'common', 'auto_mult',  3.0),
    item('Galaxy Halo Dispersal','○○', 'Ancient stars drifting into the galactic outer halo.',    'rare', 'click', 22.0),
    item('Gravitational Slingshot','↗', 'Close encounter launching stars out of their galaxy.',   'rare', 'crit', 1.0, true),
    item('Pulsar',               '⊛~', 'Rotating neutron star sweeping radio beams across space.','rare', 'auto', 4.0),
    item('Black Dwarf',          '●°', 'Future cold remnant when white dwarfs finally go dark.',  'rare',   'auto_mult',  3.0),
    item('Iron Star',            'Fe★','Far-future matter trends toward iron via slow tunneling.', 'epic',   'auto',  8.0),
    item('Binary BH Merger',     '⚫⚫','Two black holes spiraling together — ringing spacetime.', 'epic',   'click', 35.0),
    withAliases(
      item('Relic Supermassive BH','⚫³','Galactic-core black hole that outlasts all the stars.',   'epic',   'crit',  3.0, true),
      ['s13_11_supermassive_bh'],
    ),
    item('Stellar Mass BH',      '⚫', 'Black hole left behind by a collapsed massive star.',     'epic',   'auto_mult',  5.0),
    item('Last Red Dwarf',       '🔴✦','The final small star exhausting its hydrogen supply.',    'legendary','multiplier',50.0),
    item('Total Darkness',       '░',  'Starlight ends; only remnants remain in the galaxy.',     'legendary','multiplier',50.0),
  ]),

  // ── Stage 14: Degenerate Era (4C + 4R + 4E + 2L) ───────────────────────────
  ...stage(14, [
    item('Decay Positron',            'e⁺',  'Antielectron emitted by decaying baryons.',              'common', 'click', 15.0),
    item('Pion Decay',                'π⁰',  'Neutral pion instantly converting to two photons.',      'common', 'auto', 2.0),
    item('Decay Neutrino',            'ν',   'Ghostly decay product escaping freely into space.',       'common', 'crit',  0.4, true),
    item('Proton Decay',              'p→',  'Hypothetical slow dissolution of all baryonic matter.',   'common', 'auto_mult',  2.0),
    item('Diamond Star',              '💎★', 'Crystallized carbon remnant glowing in deep dark.',      'rare',   'auto',  4.0),
    item('GW Echo',                   '◌·',  'Faint gravitational-wave memory of ancient mergers.',    'rare', 'auto_mult', 3.0),
    withAliases(
      item('Higgs Boson',               'H',   'Scalar excitation of the Higgs field that gives particles their mass through symmetry breaking.', 'rare', 'click', 22.0),
      ['s14_07_quantum_tunneling'],
    ),
    item('Relic Neutrino Background', 'νBG', 'Big-bang neutrinos cooled almost to rest.',              'rare', 'crit', 1.5, true),
    withAliases(
      item('Z Boson',                   'Z⁰',  'Neutral weak gauge boson — the chargeless partner of the W that mediates the weak force.', 'epic', 'click', 35.0),
      ['s14_09_gut_monopole_decay'],
    ),
    item('Positronium Atom',          'Ps',  'Electron and positron briefly orbiting each other.',     'epic', 'auto', 7.0),
    item('Dark Matter Annihilation',  'DM⊕', 'Dark matter candidates finally erasing each other.',    'epic', 'auto_mult', 5.0),
    item('BH Domination',             '⚫>', 'Black holes now hold most remaining mass-energy.',       'epic', 'crit', 3.0, true),
    item('Last Baryon',               'p_∞', 'Final proton waiting out its immense decay clock.',     'legendary','multiplier',50.0),
    item('Baryon Washout',            'B=0', 'Baryon number dwindles to zero across the cosmos.',      'legendary','multiplier',50.0),
  ]),

  // ── Stage 15: Black Hole Era (4C + 4R + 4E + 2L) ───────────────────────────
  ...stage(15, [
    item('Hawking Photon',         'Hγ',    'Radiation slowly escaping from the event horizon.',      'common', 'click', 15.0),
    item('Virtual Particle Pair',  '±ℏ',   'Vacuum pair split apart by the black hole gradient.',    'common', 'crit', 0.6, true),
    item('Ergosphere',             'Erg',   'Rotating frame-drag zone where energy can be mined.',    'common', 'auto', 3.0),
    item('Event Horizon',          'EH',    'Boundary in time from which nothing can escape.',        'common', 'auto_mult',  2.0),
    item('Penrose Process',        'Ω→',   'Extracting rotational energy from a spinning BH.',       'rare',   'auto',  5.0),
    item('BH Merger Wave',         '⚫+⚫', 'Black hole inspiral shaking the last geometry.',        'rare',   'click', 22.0),
    item('BH Entropy',             'S=A/4','Horizon area determining every internal state.',          'rare',   'crit',  1.5, true),
    item('Stellar BH Evaporation', '⚫→',  'Smaller black holes slowly radiating themselves away.',  'rare',   'auto_mult',  4.0),
    item('Supermassive Evaporation','⚫⚫→','Largest black holes finally completing their fadeout.',  'epic', 'crit', 3.0, true),
    item('Firewall',               '🔥EH', 'High-energy barrier hypothesis at the event horizon.',   'epic',   'click', 35.0),
    item('Information Paradox',    '?⚫',  'Does information survive the final evaporation?',        'epic', 'auto_mult', 6.0),
    item('Planck Remnant',         'ℓP',   'Possible Planck-scale residue after full evaporation.',  'epic', 'auto', 9.0),
    item('Final Evaporation Flash','☀→∅', 'Last burst of light as the final black hole ends.',      'legendary','multiplier',50.0),
    item('Last Black Hole',        '⚫_',  'The very last horizon preparing its ultimate emission.', 'legendary','multiplier',50.0),
  ]),

  // ── Stage 16: The End (4C + 3R + 2E + 5L endings) ──────────────────────────
  ...stage(16, [
    withAliases(
      item('Tau',                      'τ',    'The heaviest charged lepton — a third-generation electron sibling that decays almost instantly.', 'common', 'click', 15.0),
      ['s16_01_relic_electron'],
    ),
    item('Lone Photon',              'γ',     'A single photon crossing space that will never scatter.','common', 'auto', 2.0),
    item('Relic Positron',           'e⁺∞',  'A positron adrift in ever-expanding emptiness.',         'common', 'crit',  0.5, true),
    withAliases(
      item('Tau Neutrino',             'ντ',   'Third-generation neutrino paired with the tau — nearly massless and weakly interacting.', 'common', 'auto_mult',  2.0),
      ['s16_04_relic_neutrino'],
    ),
    item('Cosmic Background Photon', 'CBG',  'All remaining light fading into background noise.',      'rare', 'click', 22.0),
    item('Thermal Equilibrium',      'ΔT→0', 'Temperature differences vanish everywhere at once.',    'rare', 'auto', 3.0),
    item('Max Entropy',              'S_max','No free energy remains to run any physical process.',    'rare',   'auto_mult',  1.5),
    item('De Sitter Vacuum',         'Λ∞',   'Dark-energy space persists as all matter fades away.',  'epic', 'auto_mult', 3.0),
    item('Quantum Fluctuation Final','δE∞',  'Even empty space can still fluctuate, just barely.',    'epic', 'auto', 8.0),
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
  // Canonical id wins before any alias — otherwise a later entity's canonical
  // id can collide with an earlier entity's alias list, e.g. Cambrian's id
  // `s11_07_cambrian_explosion` was being eaten by Moon Formation's old alias
  // list and the player would see a moon appear when they bought Cambrian.
  const candidates = stageId !== undefined
    ? STAGE_ENTITIES.filter((entity) => entity.stageId === stageId)
    : STAGE_ENTITIES;
  const canonical = candidates.find((entity) => entity.id === entityId);
  if (canonical) return canonical;
  return candidates.find((entity) => entity.aliases?.includes(entityId) === true);
}

export function getPurchasedEntityCount(
  purchasedEntities: PurchasedEntityEntry[],
  entity: StageEntity,
): number {
  const count = purchasedEntities.reduce(
    (sum, entry) => (entityMatchesId(entity, entry.entityId) ? sum + entry.count : sum),
    0,
  );
  return entity.maxCount > 0 ? Math.min(count, entity.maxCount) : count;
}

/**
 * Uncapped owned count — the display/collection counterpart of the
 * maxCount-capped getPurchasedEntityCount (which survives only for purchase
 * gating and the fusion dup-sink). Power applies its own soft cap via
 * getEffectiveCount (effects.ts).
 */
export function getOwnedEntityCount(
  inventory: PurchasedEntityEntry[],
  entity: StageEntity,
): number {
  return inventory.reduce(
    (sum, entry) => (entityMatchesId(entity, entry.entityId) ? sum + entry.count : sum),
    0,
  );
}

export function getMaxTimeEntityMultiplierThroughStage(stageId: number): number {
  return STAGE_ENTITIES.reduce((multiplier, entity) => {
    if (entity.stageId > stageId || entity.effect.type !== 'time') return multiplier;
    const stageFactor = entity.stageId === stageId ? 1 : LEGACY_TIME_ENTITY_EFFECT_FACTOR;
    return multiplier * (1 + (entity.effect.value * stageFactor * entity.maxCount) / 100);
  }, 1);
}

export function getMaxLegacyTimeEntityMultiplierBeforeStage(stageId: number): number {
  return STAGE_ENTITIES.reduce((multiplier, entity) => {
    if (entity.stageId >= stageId || entity.effect.type !== 'time') return multiplier;
    return multiplier * (1 + (entity.effect.value * LEGACY_TIME_ENTITY_EFFECT_FACTOR * entity.maxCount) / 100);
  }, 1);
}
