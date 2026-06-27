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
  ENTITY_RARITY_CLICK_SCALE,
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
    // RARITY STEEPENING (PO 2026-06-23): the scale is now TYPE-AWARE — CLICK rides the steep
    // ENTITY_RARITY_CLICK_SCALE (decisive per-tier jump, exponential-safe), everything else keeps
    // the gentler ENTITY_RARITY_EFFECT_SCALE. (Flat-typed AUTO skips both: its ~10×/tier ladder
    // already comes from the rarity-scaled baseCost anchor in getAutoOutputAnchor.)
    const effectScale = spec.effect.isFlat || spec.effect.type === 'multiplier'
      ? 1
      : spec.effect.type === 'click'
        ? ENTITY_RARITY_CLICK_SCALE[spec.rarity]
        : ENTITY_RARITY_EFFECT_SCALE[spec.rarity];
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
  'Quantum Fluctuation':    { name: '양자 요동',        description: '인플레이션이 우주만 하게 늘려 놓은 양자 떨림 — 모든 은하의 씨앗이 된 잡음.' },
  'False Vacuum Bubble':    { name: '거짓 진공 거품',   description: '비어 보이지만 막대한 에너지를 숨긴 진공 — 언덕 중턱의 패인 곳에 멈춘 공처럼 언제든 진짜 바닥으로 굴러떨어진다.' },
  'Inflaton Surge':         { name: '인플라톤 폭주',    description: '찰나의 순간 우주를 양성자보다 작은 크기에서 자몽보다 크게 부풀린 인플라톤 장의 급등.' },

  // Stage 2
  'Up Quark':               { name: '업 쿼크',          description: '모든 양성자에 두 개씩 들어가지만, 양성자 무게의 1%만이 쿼크 자신의 질량 — 나머지 99%는 순수한 결합 에너지다.' },
  'Down Quark':             { name: '다운 쿼크',        description: '업 쿼크보다 아주 조금 무거운데, 그 작은 차이가 중성자를 양성자보다 무겁게 만들어 붕괴하게 한다.' },
  'Electron':               { name: '전자',             description: '양성자 하나의 무게를 채우려면 1,836개가 필요할 만큼 가볍지만, 똑같은 전하를 반대 부호로 지닌 안정한 경입자.' },
  'Electron Neutrino':      { name: '전자 중성미자',    description: '매초 수조 개가 당신 몸을 통과하고, 거의 전부가 지구마저 그냥 관통해 버리는 유령 같은 입자.' },
  'Gluon':                  { name: '글루온',           description: '강력을 나르면서 자신이 반응하는 색전하까지 지녀 — 서로를 잡아당기는 탓에 쿼크는 결코 떼어 놓을 수 없다.' },
  'Strange Quark':          { name: '스트레인지 쿼크',  description: '이 쿼크를 품은 입자들이 \'기묘하게\' 오래 살아남아 — 새로운 보존 법칙을 밝혀낸 2세대 쿼크.' },
  'W Boson':                { name: 'W 보손',           description: '양성자의 약 80배에 달하는 약력의 무거운 전령 — 그 큰 질량 탓에 방사성 붕괴가 그토록 느리다.' },
  'CP Violation Pocket':    { name: 'CP 비대칭 영역',   description: '이 작은 비대칭이 없었다면 물질과 반물질이 완벽히 상쇄돼 빛만 남았을 것 — 당신이 존재하는 이유다.' },

  // Stage 3
  'Free Quark':             { name: '자유 쿼크',        description: '우주 첫 100만 분의 1초, 너무 뜨거워 쿼크가 양성자로 뭉치지 못하고 자유로이 떠돌던 시절 — 실험실에서 만든 가장 뜨거운 물질이다.' },
  'Gluon Plasma':           { name: '글루온 플라스마',  description: '지금껏 만든 가장 뜨거운 물질이면서도, 기체가 아니라 마찰이 거의 없는 \'가장 완벽한 액체\'로 흐른다.' },
  'Pion':                   { name: '파이온',           description: '쿼크로 이루어진 가장 가벼운 입자 — 글루온이 밝혀지기 전, 핵을 묶는 \'풀\'로 여겨졌다.' },
  'Muon':                   { name: '뮤온',             description: '전자의 무겁고 불안정한 사촌(207배) — 빠른 뮤온이 더 오래 사는 것이 아인슈타인 시간 지연의 실제 증거다.' },
  'Plasma Vortex':          { name: '플라스마 소용돌이',description: '쿼크-글루온 플라스마는 지금껏 측정된 가장 격렬히 휘도는 유체 — 가장 강한 태풍의 소용돌이마저 압도한다.' },
  'Charm Quark':            { name: '참 쿼크',          description: '1974년 그 발견이 너무 혁명적이라 \'11월 혁명\'으로 불리는 무거운 2세대 쿼크.' },
  'Kaon':                   { name: '케이온',           description: '1964년, 케이온을 연구하다 우주가 물질·반물질 거울을 처음 깨뜨리는 장면(CP 위반)이 발견됐다.' },
  'Bottom Quark':           { name: '바텀 쿼크',        description: '헬륨 원자 하나만큼 무거운데도 여전히 크기 없는 점으로 여겨지는 무거운 쿼크.' },
  'Color Flux Tube':        { name: '색 자속 끈',       description: '쿼크를 떼려 하면 글루온 힘이 팽팽한 \'끈\'으로 뭉치고 — 세게 당기면 차라리 새 쿼크쌍을 만들어 낼 뿐 결코 풀려나지 않는다.' },
  'Top Quark':              { name: '탑 쿼크',          description: '모든 쿼크 중 가장 무겁고 — 강입자로 묶이기도 전에 붕괴해 우리가 \'벌거벗은\' 채로 보는 유일한 쿼크다.' },
  'QCD Phase Boundary':     { name: 'QCD 상경계',       description: '약 2조 도의 우주적 \'어는점\' — 쿼크 수프가 오늘날 만물을 이루는 양성자와 중성자로 응결한 경계.' },
  'Confinement Onset':      { name: '갇힘 개시',        description: '자연의 가장 기묘한 규칙 — 쿼크는 멀리 떼어 놓을수록 힘이 더 세져서, 결코 홀로 떼어 낼 수 없다.' },

  // Stage 4
  'Proton':                 { name: '양성자',           description: '거대한 물탱크를 몇 년이나 지켜봐도 단 하나 붕괴하지 않는, 수명 10³⁴년이 넘는 놀랍도록 안정한 중입자.' },
  'Neutron':                { name: '중성자',           description: '핵 속에선 끄떡없지만, 홀로 풀려나면 약 15분 만에 붕괴 — 그래서 우주의 자유 중성자는 서둘러 헬륨에 갇혀야 했다.' },
  'Deuterium':              { name: '중수소',           description: '별은 부수기만 할 뿐 만들지 않는 우주의 유물 — 바닷속 모든 중수소는 빅뱅 첫 몇 분의 산물이다.' },
  'Photon':                 { name: '광자',             description: '전자기력을 매개하는 질량 없는 빛의 양자 — 모든 융합 단계에서 방출된다.' },
  'Tritium':                { name: '삼중수소',         description: '빅뱅에서 만들어졌다 곧 헬륨-3으로 붕괴한, 헬륨으로 가는 길의 덧없는 방사성 수소-3.' },
  'Helium-3':               { name: '헬륨-3',           description: '핵융합의 꿈의 연료로 귀해 — 달 표면에서 채굴하자는 진지한 제안까지 나오는 가벼운 헬륨.' },
  'Beryllium-7':            { name: '베릴륨-7',         description: '우주의 원시 리튬-7은 사실 베릴륨-7로 태어나, 나중에 전자를 붙잡아 리튬이 된 것이다.' },
  'Helium-4':               { name: '헬륨-4',           description: '우주 보통 물질의 약 25%(질량)가 빅뱅 첫 20분에 빚어진 헬륨-4 — 138억 년이 지나도 거의 그대로다.' },
  'Primordial Fireball':    { name: '원시 화구',        description: '한때 별 중심보다 뜨겁고 빽빽한 화구였으나, 단 몇 분 만에 팽창이 화로를 영영 꺼 버렸다.' },
  'Lithium-7':              { name: '리튬-7',           description: '빅뱅이 예측한 리튬-7 양이 실제 관측치의 약 3배 — \'우주 리튬 문제\'로 불리는 미해결 수수께끼.' },
  'Muon Neutrino':          { name: '뮤온 중성미자',    description: '식어가는 경입자 플라스마에서 질량 아래로 분리되는 뮤온형 중성미자.' },
  'Neutron-Proton Ratio':   { name: '중성자/양성자 비', description: '중성자가 양성자보다 살짝 무거워 식는 우주가 양성자를 선호한 결과 굳어진 1:7 — 헬륨을 25%로 고정한다.' },
  'BBN Completion':         { name: '빅뱅 핵합성 완료', description: '첫 원소의 조리법은 약 3분 만에 잠기고, 20분 무렵엔 이미 너무 식어 — 수소 75%·헬륨 25%로 영영 고정됐다.' },
  'Fusion Window':          { name: '융합의 창',        description: '핵을 융합할 만큼 뜨겁고 빽빽한 시간은 단 3~20분 — 팽창이 모든 반응을 꺼뜨리기 전, 시계와의 경주.' },

  // Stage 5
  'Hydrogen':               { name: '수소',             description: '1번 원소 — 양성자가 전자를 붙잡아 최초의 중성 원자가 탄생한다.' },
  'Free Electron':          { name: '자유 전자',        description: '광자에게는 악몽 같은 존재 — 빛을 끊임없이 산란시켜 초기 우주를 들여다볼 수 없는 안개로 만든 마지막 떠돌이 전하.' },
  'Helium':                 { name: '헬륨',             description: '2번 원소 — 헬륨 핵이 전자 두 개를 모두 끌어들여 중성이 된다.' },
  'CMB Photon':             { name: 'CMB 광자',         description: '138억 년을 날아온, 어떤 장비로도 검출할 수 있는 가장 오래된 빛.' },
  'Hydrogen Cloud':         { name: '수소 구름',        description: '재결합이 안개를 걷자 우주 전체가 별빛 하나 없는 차갑고 어두운 중성 수소 구름이 됐다.' },
  'Photon Decoupling':      { name: '광자 분리',        description: '빛이 물질을 처음으로 \'놓아주고\' 자유로이 날아간 바로 그 순간 — 오늘 우리가 보는 우주배경복사다.' },
  'Baryon Acoustic Oscillation': { name: '바리온 음향 진동', description: '원시 플라스마를 울리던 음파가 재결합에서 얼어붙어 — 지금도 은하 분포에 약 5억 광년 \'자\'로 새겨져 있다.' },
  'Plasma to Gas':          { name: '플라스마→기체',    description: '약 38만 년, 우주가 빛나는 플라스마에서 투명한 중성 기체로 전환된 찰나 — 불이 켜졌다가 다시 깜깜해졌다.' },
  'Dark Matter Halo':       { name: '암흑물질 헤일로',  description: '보통 물질이 떨어져 은하를 빚을 중력의 \'골짜기\'를, 보이지 않는 암흑물질이 이미 파 놓았다.' },
  'Massive Dark Halo':      { name: '거대 암흑 헤일로', description: '은하 퍼텐셜을 빚는 거대한 암흑 골격.' },
  'Density Perturbation':   { name: '밀도 요동',        description: '첫 찰나의 양자 떨림이 우주 크기로 부풀어 — 존재하는 모든 은하·별·행성의 씨앗이 됐다.' },
  'Last Scattering Surface':{ name: '최후 산란면',      description: '관측 가능한 우주의 끝에 선 빛나는 벽 — 광자가 전자에 마지막으로 부딪힌, 적색편이 약 1100의 자리.' },
  'CMB Anisotropy':         { name: 'CMB 비등방성',     description: 'CMB 온도는 어느 방향이든 10만 분의 1까지 같고, 그 미세한 얼룩이 곧 은하단의 배아다.' },
  'Cosmic Transparency':    { name: '우주의 투명화',    description: '재결합으로 우주가 처음 투명해졌고, 그 빛에 대해서는 지금까지 줄곧 투명한 채로 남아 있다.' },
  'Structure Seed':         { name: '구조 씨앗',        description: '모든 우주 구조는 평균보다 겨우 0.001% 더 빽빽한 밀도 잔물결에서 자랐다 — 우주는 반올림 오차 위에 세워졌다.' },

  // Stage 6
  'Cold Hydrogen':          { name: '차가운 수소',      description: '약 1억 년 동안 우주는 차갑고 어두운 수소 가스뿐 — 별도, 빛도 없는 완전한 암흑이었다.' },
  '21cm Signal':            { name: '21cm 신호',        description: '중성 수소 전자가 스핀을 뒤집을 때 나는 전파 속삭임 — 별 없던 암흑기에서 받을 수 있는 유일한 신호다.' },
  'Dark Matter Filament':   { name: '암흑물질 필라멘트',description: '암흑물질이 짠 \'우주 거미줄\' — 훗날 모든 가스가 이 보이지 않는 실을 따라 흘러 최초의 별을 점화한다.' },
  'Cold Gas Cloud':         { name: '차가운 가스 구름', description: '데워 줄 별이 없어, 원시 가스는 중력이 끌어모으기 전 절대영도보다 겨우 몇 도 높게 식어 버렸다.' },
  'Molecular Hydrogen':     { name: '분자 수소',        description: '수소 원자 둘이 짝지은 H₂는 우주의 유일한 냉각제 — 이 미량의 냉매가 없었다면 최초의 별은 붕괴할 수 없었다.' },
  'Protogalactic Cloud':    { name: '원시 은하 구름',   description: '어떤 은하도 빛나기 전, 암흑물질 우물에 가스가 고여 암흑기에 잠든 원시 은하가 되었다.' },
  'Dark Matter Clump':      { name: '암흑물질 덩어리',  description: '빛의 압력을 받지 않아 — 보통 가스가 아직 플라스마에 갇혀 있는 동안 암흑물질이 가장 먼저 뭉쳤다.' },
  'Gravitational Potential':{ name: '중력 퍼텐셜',      description: '암흑물질이 중력 \'우물\'을 파 놓았고, 모든 별과 은하는 그저 가스가 그 안으로 굴러떨어져 만들어졌다.' },
  'Mini Halo':              { name: '미니 헤일로',      description: '최초의 별 요람은 태양 ~10만~100만 개 질량의 \'미니헤일로\' — 가스를 가둘 만큼만 무거운 작은 암흑 주머니.' },
  'Baryonic Streaming':     { name: '바리온 스트리밍',  description: '재결합 후 가스가 암흑물질에 대해 초음속으로 \'미끄러져\' — 가장 작은 헤일로에서 가스를 흩뜨려 최초의 별을 지연시켰다.' },
  'Dark Energy Background': { name: '암흑에너지 배경',  description: '오늘날 팽창을 가속하는 암흑에너지도 암흑기엔 미미한 구경꾼 — 수십억 년 뒤에야 주도권을 쥔다.' },
  'Silk Damping':           { name: '실크 감쇠',        description: '재결합 전, 빽빽한 영역을 빠져나가는 광자가 가장 작은 밀도 잔물결을 문질러 지워 — 일정 크기 이하의 구조를 없앴다.' },
  'Gravitational Collapse': { name: '중력 붕괴',        description: '맞설 별빛도 압력도 없자, 암흑기에서 마침내 중력이 이겨 — 폭주 붕괴가 최초의 별을 밝혔다.' },
  'First Cosmic Dawn Seed': { name: '우주여명의 씨앗',  description: '어두운 우주 속 단 하나의 과밀한 가스 주머니 — 우주의 첫 일출을 점화할 씨앗.' },

  // Stage 7
  'Protostar':              { name: '원시별',           description: '핵융합이 시작되기도 전에 빛나는 원시별 — 오로지 제 중력 붕괴의 열만으로 타오른다.' },
  'UV Photon':              { name: '자외선 광자',      description: '최초의 별들이 맹렬한 자외선으로 타오르며, 그 광자가 온 우주의 수소에서 전자를 뜯어내 재이온화를 시작했다.' },
  'Main Sequence Star':     { name: '주계열성',         description: '\'주계열\'은 별의 전성기 — 우리 태양도 46억 년째 수소를 태우고 있고, 앞으로 50억 년을 더 태운다.' },
  'Hydrogen Fusion':        { name: '수소 융합',        description: '수소 융합은 질량의 0.7%를 E=mc²로 곧장 에너지로 바꾼다 — 당신이 보는 모든 별을 돌리는 엔진.' },
  'Oxygen':                 { name: '산소',             description: '당신이 들이쉬는 모든 산소 원자는 죽어가는 별의 핵에서 단조돼 우주로 뿌려진 것 — 당신의 폐는 별먼지로 돈다.' },
  'Stellar Wind':           { name: '항성풍',           description: '거대 별은 단 수천 년 만에 태양 하나만큼의 질량을 날려 보낼 만큼 거센 바람으로 물질을 흩뿌린다.' },
  'HII Region':             { name: 'HII 영역',         description: '어린 뜨거운 별이 제 둘레에 이온화 수소의 빛나는 거품을 깎아 내 — \'별이 태어났다\'고 알리는 표지.' },
  'Carbon':                 { name: '탄소',             description: '6번 원소 — 삼중알파 반응이 탄소를 단조하며 화학의 새벽을 연다.' },
  'Pop III Cluster':        { name: '종족 III 성단',    description: '우주 최초의 별인 종족 III — 금속이 전혀 없는 순수 수소·헬륨으로, 일부는 태양의 수백 배에 달했다.' },
  'Iron':                   { name: '철',               description: '26번 원소 — 항성 핵이 헬륨 너머 가장 안정한 핵인 철까지 원소를 단조한다.' },
  'Stellar Feedback':       { name: '항성 피드백',      description: '최초의 별들은 복사·바람·폭발로 새 별을 만들려는 가스 자체를 데우고 흩뜨리며 — 주변 우주를 다시 배선했다.' },
  'Supernova Precursor':    { name: '초신성 전조',      description: '거대 별 핵이 마침내 철을 쌓으면 에너지 수도꼭지가 잠기고 — 1초도 안 돼 중력이 이겨 붕괴가 시작된다.' },
  'Pop III Supernova':      { name: '종족 III 초신성',  description: '우주 최초의 별들이 폭발하며 우주에 첫 금속을 뿌렸다 — 헬륨보다 무거운 모든 원소가 이들로 거슬러 올라간다.' },
  'Pair Instability SN':    { name: '쌍 불안정 초신성', description: '태양 ~140~260배 별에서 감마선이 전자-양전자 쌍으로 변해 핵이 무너지고 — 잔해조차 남기지 않고 완전히 폭발한다.' },

  // Stage 8
  'Ionizing Photon':        { name: '이온화 광자',      description: '수소 원자에서 전자를 깔끔히 뜯어낼 딱 그만큼의 에너지(13.6eV)를 지닌 자외선 광자 — 암흑기를 끝낸 우주의 불씨.' },
  'Ionized Hydrogen':       { name: '이온화 수소',      description: '수소에서 홀로 있던 전자를 떼어 내면 벌거벗은 양성자만 남는다 — 우주에서 가장 단순하고 흔한 하전 입자.' },
  'HII Bubble':             { name: 'HII 거품',         description: '최초의 은하 둘레로 이온화 빛이 투명한 가스 거품을 부풀려 — 안개 낀 방을 손전등으로 밝히듯 우주 안개를 걷어 냈다.' },
  'Lyman Break':            { name: '라이먼 단절',      description: '어린 은하는 제 수소가 자외선을 삼켜 특정 파장 아래로 완전히 사라진다 — 천문학자들이 가장 먼 은하를 찾는 \'드롭아웃\' 묘기.' },
  'Quasar':                 { name: '퀘이사',           description: '태양계만 한 영역에서 — 수천억 별의 모은하 전체보다 밝게 빛나는, 물질을 삼키는 초대질량 블랙홀.' },
  'Early Galaxy':           { name: '초기 은하',        description: '우주를 재이온화한 광자 대부분을 댄 것은 퀘이사가 아니라 우주여명의 흐릿한 왜소은하들 — 화려한 사촌을 표결로 이겼다.' },
  'Ionization Front':       { name: '이온화 전선',      description: '불투명한 중성 가스가 투명한 이온화 플라스마로 뒤집히는 날카로운 경계 — 빛의 속도를 좇아 우주를 가르며 휩쓴다.' },
  'X-Ray Background':       { name: 'X선 배경',         description: '하늘을 뒤덮은 희미한 X선 노을 — 상당 부분은 따로 보기엔 너무 먼, 물질을 삼키는 수백만 블랙홀의 빛이 합쳐진 것.' },
  'Metagalactic UV':        { name: '메타은하 UV',      description: '온 은하간 공간에 스민 희미한 자외선 노을 — 모든 은하와 퀘이사의 새어 나온 빛이 합쳐져 지금도 우주를 이온화 상태로 유지한다.' },
  'Bubble Merger':          { name: '거품 융합',        description: '은하 둘레 이온화 거품들이 자라며 비눗방울처럼 겹치고 합쳐져 — 마지막 우주 안개 자락까지 태워 없앴다.' },
  'Gunn-Peterson Trough':   { name: '건-피터슨 골',     description: '먼 퀘이사 스펙트럼에서 중성 수소 안개가 빛을 모조리 삼킨 칠흑의 틈 — 초기 우주가 아직 미이온화였다는 결정적 지문.' },
  'Intergalactic Medium':   { name: '은하간 매질',      description: '은하 사이의 거의 진공이 우주 보통 물질 대부분을 품는다 — 1m³에 원자 하나도 안 되지만, 모든 별을 합친 것보다 많다.' },
  'Reionization Complete':  { name: '재이온화 완료',    description: '빅뱅 약 10억 년 후 마지막 중성 안개가 걷혀 우주가 투명해졌고 — 그 뒤로 줄곧 그 상태를 지키고 있다.' },
  'Epoch of Reionization':  { name: '재이온화 시기',    description: '우주의 두 번째 위대한 \'점등\' — 별빛이 암흑기에 남은 중성 수소 안개를 태워 없앤 시기.' },

  // Stage 9
  'Dwarf Galaxy':           { name: '왜소은하',         description: '우주에서 가장 흔한 은하는 별 몇백만 개뿐인 작은 왜소은하 — 우리은하 같은 거대 은하를 짓는 벽돌이었을 것이다.' },
  'Gas Accretion':          { name: '가스 강착',        description: '은하는 충돌만이 아니라, 우주 필라멘트를 따라 흘러드는 신선한 가스를 조용히 들이켜 자란다 — 새 별을 먹이는 더딘 식단.' },
  'Spiral Arm':             { name: '나선팔',           description: '나선팔은 별의 고정된 사슬이 아니라 밀도파 — 별들이 통과하며 가스가 쌓여 점화되는 우주적 교통 체증이다.' },
  'Star Formation Cloud':   { name: '별 형성 구름',     description: '별은 빛마저 가리는 차갑고 어두운 분자 구름 안에서 태어난다 — 내부는 영하 260도보다도 차갑다.' },
  'Galaxy Merger':          { name: '은하 충돌',        description: '은하가 충돌해도 별들은 두 벌 떼처럼 서로를 그냥 통과한다 — 그러나 중력이 둘 모두를 새로운 모습으로 빚는다.' },
  'Galaxy Cluster':         { name: '은하단',           description: '수천 개 은하를 거느린, 중력으로 묶인 가장 거대한 천체 — 그런데 질량의 80% 넘는 부분이 보이지 않는 암흑물질이다.' },
  'Supermassive BH':        { name: '초대질량 블랙홀', description: '거의 모든 큰 은하 중심엔 태양 수백만~수십억 배의 블랙홀이 숨어 있다 — 우리은하 중심엔 태양 400만 개짜리가 있다.' },
  'Relic Supermassive BH':  { name: '잔존 초대질량 블랙홀', description: '모든 별보다 오래 살아남는 은하 핵의 블랙홀.' },
  'Active Galactic Nucleus':{ name: '활동성 은하핵',    description: '은하 중심 블랙홀이 가스를 게걸스레 삼키면 수십억 광년 너머에서도 보이는 등대처럼 타오른다 — 은하 규모의 등대.' },
  'Gravitational Lens':     { name: '중력 렌즈',        description: '은하단의 중력이 시공간을 얼마나 강하게 휘는지, 배경 은하를 호와 고리로 일그러뜨린다 — 아인슈타인이 예언한 천연 망원경.' },
  'Filamentary Structure':  { name: '필라멘트 구조',    description: '은하는 무작위로 흩어지지 않고, 수억 광년에 걸친 가스와 암흑물질의 빛나는 필라멘트를 따라 줄지어 늘어선다.' },
  'Cosmic Web Node':        { name: '우주 거미줄 마디', description: '우주 필라멘트가 교차하는 곳에 은하단이 — 거대한 3차원 거미줄의 매듭마다 구슬처럼 쌓인다.' },
  'Cosmic Void':            { name: '우주 보이드',      description: '수천만 광년에 걸친 거대한 거의 텅 빈 거품 — 우주 부피의 대부분을 차지하면서도 거의 아무것도 품지 않는다.' },
  'Large Scale Structure':  { name: '대규모 구조',      description: '하늘에 펼쳐 보면 우주는 비누 거품의 거품 같다 — 은하가 거대한 빈 보이드를 두른 얇은 벽을 그린다.' },

  // Stage 10
  'Dust Grain':             { name: '먼지 알갱이',      description: '당신이 딛고 선 행성을 포함한 모든 암석 행성은, 갓 태어난 태양 둘레 원반에서 들러붙던 미세한 먼지 알갱이로 시작했다.' },
  'Iron Core':              { name: '철 핵',            description: '분화한 암석 행성의 금속이 풍부한 중심.' },
  'Planetesimal':           { name: '미행성',           description: '먼지가 뭉쳐 자란 킬로미터 크기의 잔돌 — 중력이 모아 온전한 행성으로 빚어낸 씨앗.' },
  'Water Ice':              { name: '얼음물',           description: '우주의 물 대부분은 얼어 있고 — 지구의 바다도 혜성과 소행성 속에 갇힌 얼음으로 도착했을지 모른다.' },
  'Rocky Planet':           { name: '암석 행성',        description: '내행성이 암석과 금속의 빽빽한 공인 까닭은 — 어린 태양의 열이 가벼운 얼음을 날려 버려 무거운 것만 남았기 때문이다.' },
  'Comet':                  { name: '혜성',             description: '태양계 탄생의 잔재인 \'더러운 눈덩이\' — 그 빛나는 꼬리는 지구-태양 거리보다 긴 1억km 넘게 뻗기도 한다.' },
  'Asteroid Belt':          { name: '소행성대',         description: '소행성대는 실패한 행성 — 목성 중력이 휘저어 못 뭉치게 했고, 그 잔돌을 다 합쳐도 달 하나에 못 미친다.' },
  'Gas Giant':              { name: '가스 행성',        description: '목성은 다른 행성을 두 번 삼키고도 남을 만큼 거대하지만, 정작 태양과 같은 수소·헬륨으로 이루어져 있다.' },
  'Moon':                   { name: '위성',             description: '달은 매년 약 3.8cm씩 지구에서 멀어지고 있다 — 먼 옛날엔 하늘 가득 어른거릴 만큼 가까웠다.' },
  'Liquid Water':           { name: '액체 물',          description: '지구는 물이 액체로 머무는 드문 \'딱 맞는\' 자리에 있다 — 태양에 더 가까우면 끓고, 멀면 꽁꽁 언다.' },
  'Magnetic Field':         { name: '자기장',           description: '지구의 들끓는 액체 철 핵이 만든 자기 방패가 치명적 태양풍을 튕겨 낸다 — 이게 없었다면 대기가 화성처럼 벗겨졌을 것이다.' },
  'Goldilocks Zone':        { name: '골디락스 영역',    description: '너무 뜨겁지도 차갑지도 않아 물이 액체로 머무는 좁은 궤도 띠 — 지구는 그 안에 편안히 앉아 있고, 금성과 화성은 아슬하게 빗나간다.' },
  'Sun':                    { name: '태양',             description: '태양은 태양계 전체 질량의 99.86%를 쥐고 있다 — 모든 행성·위성·소행성을 합쳐도 반올림 오차에 불과하다.' },
  'Protoplanetary Disk':    { name: '원시행성 원반',    description: '먼지와 가스가 빙글빙글 돌며 세상을 빚어내는 거대한 요람.' },
  'Habitable World':        { name: '생명 가능 행성',   description: '아는 형태의 생명을 품으려면 액체 물·보호 대기·안정한 별이 두루 필요할 것 — 흔치 않을 조합.' },

  // Stage 11 — Earth formation → Life → Civilization
  'Molten Crust':           { name: '용암 지각',        description: '냉각되는 마그마가 최초의 암석 표면을 만든다.' },
  'Earth Formation':        { name: '지구 형성',        description: '지구는 수많은 충돌하는 돌덩어리에서 단 수천만 년 만에 빠르고 격렬하게 조립됐다 — 약 45억 년 전 일이다.' },
  'First Ocean':            { name: '최초의 바다',      description: '지구의 첫 바다는 40억 년도 더 전에 생겼고 — 물은 얼음 머금은 소행성이 나르고 녹은 행성 내부가 뿜어낸 것으로 보인다.' },
  'Atmosphere':             { name: '대기',             description: '지구의 원래 공기엔 산소가 거의 없었다 — 우리가 기대는 숨 쉴 수 있는 대기는 미생물이 수십억 년에 걸쳐 만들어 냈다.' },
  'Moon Formation':         { name: '달 형성',          description: '달은 테이아라는 화성 크기의 천체가 어린 지구에 충돌해, 궤도로 튀어나간 잔해가 뭉쳐 태어났다.' },
  'Prokaryote':             { name: '원핵생물',         description: '지구 역사 절반 동안 모든 생명은 핵 없는 단세포 미생물이었고 — 지금도 모든 동식물보다 압도적으로 수가 많다.' },
  'Photosynthesis':         { name: '광합성',           description: '광합성의 발명은 역사상 가장 중대한 오염 사건 — 그 폐기물 산소가 옛 세상을 독살하고 우리 세상을 지었다.' },
  'Cambrian Explosion':     { name: '캄브리아 대폭발',  description: '약 5억 4천만 년 전, 거의 모든 주요 동물 몸 설계가 지질학적 눈 깜짝할 새 등장했다 — 복잡한 동물의 \'빅뱅\'.' },
  'Continents Rise':        { name: '대륙의 융기',      description: '지구는 대륙과 판 구조를 가진 유일한 행성 — 지각을 재순환하는 느린 컨베이어 벨트가 표면을 끝없이 갈아엎는다.' },
  'Neuron':                 { name: '뉴런',             description: '당신의 뇌는 약 860억 개 뉴런이 전기화학 신호를 주고받으며 돌아간다 — 연못 이끼와 같은 화학으로 문명을 지은 그물.' },
  'Homo Sapiens':           { name: '호모 사피엔스',    description: '살아 있는 모든 인간은 약 30만 년 전 아프리카의 작은 무리에서 갈라져 나왔다 — 우리 종은 많은 별보다도 어리다.' },
  'City Lights':            { name: '도시의 불빛',      description: '인류의 도시는 이제 우주에서도 보일 만큼 환히 빛난다 — 기술 종(種)이 남긴 행성 규모의 첫 서명.' },
  'Artificial Satellite':   { name: '인공위성',         description: '인류는 단 수십 년 만에 땅에 매인 처지에서 수천 대의 궤도 기계로 제 행성을 에워싸기에 이르렀다 — 지구가 제 손으로 만든 후광.' },
  'Spacefaring Humanity':   { name: '우주 항해 인류',   description: '별먼지에서 태어난 종이 다른 세계로 제 탐사선을 보내기 시작했다 — 초기 우주의 물질이 이제 스스로를 사색한다.' },
  'Interstellar Ark':       { name: '성간 방주',        description: '도달 가능한 속도로 별 사이를 건너려면 여러 세대가 걸려 — 진정한 성간선은 산 짐을 수백 년 실어 나르는 자족적 세계여야 한다.' },

  // Stage 12
  'Red Giant Envelope':     { name: '적색거성 외피',    description: '태양이 적색거성이 되면 표면이 수성과 금성을 지나 지구 궤도 부근까지 부풀어 오를 만큼 거대해진다.' },
  'Stellar Wind AGB':       { name: 'AGB 항성풍',       description: '죽어가는 AGB 별은 외층을 느린 바람으로 흘려보내 — 제 질량의 절반 이상을 우주로 되돌린다.' },
  'Carbon-O Core':          { name: '탄소-산소 핵',     description: '태양형 별의 마지막 핵은 태양만 한 질량의 탄소·산소 덩어리를 지구 크기로 짓눌러 놓은 것이다.' },
  'Helium Flash':           { name: '헬륨 섬광',        description: '태양형 별의 축퇴된 핵에서 헬륨이 폭주 \'섬광\'으로 점화 — 잠깐 은하 하나만큼의 에너지를 내뿜으면서도 별 속에 숨어 있다.' },
  'Planetary Nebula':       { name: '행성상 성운',      description: '이름은 오해의 산물(초기 천문학자들이 빛나는 고리를 행성으로 봤다) — 사실은 죽어가는 별이 내쉰 외피가 벌거벗은 뜨거운 핵에 밝혀진 것.' },
  'Mass Transfer':          { name: '질량 이동',        description: '가까운 쌍성에서 한 별이 동반성의 가스를 빨아들여 — 수백만 km 너머로 물질을 훔쳐 온다.' },
  'Degenerate Electron':    { name: '축퇴 전자',        description: '축퇴 물질은 열이 아니라 양자 규칙(파울리 배타 원리)으로 버틴다 — 절대영도에서도 붕괴에 저항한다.' },
  'White Dwarf':            { name: '백색왜성',         description: '백색왜성은 태양만 한 질량을 지구 크기로 욱여넣어 — 각설탕 한 조각이 약 1톤에 달할 만큼 빽빽하다.' },
  'Neutron Star':           { name: '중성자별',         description: '중성자별은 태양 이상의 질량을 도시만 한 공에 짜 넣어 — 한 티스푼이 전 인류를 합친 것보다 무겁다.' },
  'Nova Eruption':          { name: '신성 폭발',        description: '신성은 백색왜성이 훔친 수소층을 표면 열핵 폭발로 터뜨려 수만 배 밝아지는 사건 — 그리고 몇 번이고 다시 터질 수 있다.' },
  'Magnetar':               { name: '마그네타',         description: '마그네타는 우주에서 가장 강한 자석 — 달까지 절반 거리에 둬도 지구의 모든 신용카드 자기 띠를 지워 버릴 정도다.' },
  'Gravitational Wave':     { name: '중력파',           description: '충돌하는 블랙홀이 시공간을 어찌나 희미하게 흔드는지 — 검출하려면 4km 팔 길이의 변화를 양성자 폭의 1천 분의 1까지 재야 했다.' },
  'Type Ia Supernova':      { name: 'Ia형 초신성',      description: '백색왜성은 늘 같은 임계 질량(~태양 1.4배)에서 터져 거의 같은 밝기로 폭발 — 우주 거리를 재고 암흑에너지를 발견하게 한 \'표준 촛불\'.' },
  'Core Collapse SN':       { name: '핵붕괴 초신성',    description: '거대 별의 철 핵이 무너지면 외층이 안으로 쏟아졌다 수 초 만에 튕겨 나가며 — 에너지의 99%를 거의 보이지 않는 중성미자 홍수로 쏟는다.' },

  // Stage 13
  'Brown Dwarf':            { name: '갈색왜성',         description: '갈색왜성은 \'실패한 별\' — 수소를 점화하기엔 너무 작아 진짜로 빛난 적 없이 수조 년 동안 천천히 식어 갈 뿐이다.' },
  'Cold Gas Remnant':       { name: '차가운 가스 잔재', description: '별 형성이 잦아들자 은하엔 너무 묽고 차가워 다신 별로 못 뭉치는 차가운 잔여 가스만 남는다.' },
  'Cooling White Dwarf':    { name: '식어가는 백색왜성',description: '백색왜성은 더 탈 연료가 없어 — 그저 남은 열을 복사해 내며 수십억 년에 걸쳐 까맣게 식어 간다.' },
  'Stellar Graveyard':      { name: '항성의 묘지',      description: '먼 미래의 은하는 \'항성의 묘지\'가 된다 — 마지막 별이 죽은 뒤 백색왜성·중성자별·블랙홀만 남는다.' },
  'Galaxy Halo Dispersal':  { name: '은하 헤일로 흩어짐',description: '아득한 시간 동안 중력적 만남이 별 대부분을 은하 밖으로 내던져 — 어둠 속으로 흩뿌린다.' },
  'Gravitational Slingshot':{ name: '중력 새총',        description: '근접한 삼체 만남에서 한 별은 빠르게 튕겨 나가고 다른 별은 안으로 가라앉는다 — 실제 우주선도 쓰는 중력 새총이다.' },
  'Pulsar':                 { name: '펄사',             description: '펄사는 등대처럼 복사 빔을 휘두르는 회전 중성자별 — 일부는 초당 수백 번 돌며 원자시계보다도 안정적이다.' },
  'Black Dwarf':            { name: '흑색왜성',         description: '흑색왜성은 완전히 식어 까매진 백색왜성 — 그런데 우주는 아직 단 하나가 생기기엔 너무 어려, 첫 흑색왜성은 수조 년 뒤에야 나온다.' },
  'Iron Star':              { name: '철 별',            description: '10¹⁵⁰⁰년쯤 주어지면 양자 터널링이 모든 보통 물질을 철로 천천히 융합·분열시켜 — 차가운 별의 시체를 순수한 철 별로 바꾼다.' },
  'Binary BH Merger':       { name: '쌍 블랙홀 병합',   description: '두 블랙홀이 나선 융합하면 그 충돌이 — 순수한 중력파로, 잠깐 관측 가능한 우주의 모든 별을 합친 것보다 큰 출력을 낸다.' },
  'Stellar Mass BH':        { name: '항성질량 블랙홀',  description: '항성질량 블랙홀은 거대 별의 핵이 중성자별 단계를 지나 붕괴할 때 생겨 — 태양 여러 개를 단 수 km 영역에 욱여넣는다.' },
  'Last Red Dwarf':         { name: '마지막 적색왜성',  description: '가장 가벼운 적색왜성은 너무 검소하게 태워 수조 년을 빛난다 — 태양형 별이 사라진 뒤에도 마지막까지 빛나는 별.' },
  'Total Darkness':         { name: '완전한 어둠',      description: '마지막 적색왜성마저 깜빡 꺼지면 우주는 진짜 어둠에 든다 — 어디에도 빛나는 별이 없고, 식어가는 잉걸과 블랙홀만 남는다.' },

  // Stage 14
  'Decay Positron':         { name: '붕괴 양전자',      description: '양전자(반전자)는 방사성 붕괴에서 튀어나온다 — 평범한 바나나도 칼륨-40 덕에 매시간 몇 개씩 내뿜는다.' },
  'Pion Decay':             { name: '파이온 붕괴',      description: '파이온은 가장 덧없는 입자 — 중성 파이온은 1천조 분의 1초도 못 살고 감마선으로 사라진다.' },
  'Decay Neutrino':         { name: '붕괴 중성미자',    description: '중성미자는 핵붕괴에서 쏟아져 나와 모든 것을 유령처럼 통과한다 — 매초 수조 개가 당신 몸을 아무것도 건드리지 않고 지난다.' },
  'Proton Decay':           { name: '양성자 붕괴',      description: '어떤 이론은 양성자마저 붕괴한다고 예측한다 — 반감기 10³⁴년 넘게, 수십 년간 물탱크를 지켜봐도 단 하나 못 잡았다.' },
  'Diamond Star':           { name: '다이아몬드 별',    description: '결정화한 백색왜성은 사실상 행성만 한 다이아몬드 — 지구 근처에서 발견된 하나(BPM 37093)는 비틀스 노래를 따 \'루시\'로 불린다.' },
  'GW Echo':                { name: '중력파 메아리',    description: '일부 양자중력 이론은 블랙홀 지평선 근처에서 튕기는 희미한 중력파 \'메아리\'를 예측한다 — 아인슈타인 너머 물리학의 단서.' },
  'Higgs Boson':            { name: '힉스 보손',        description: '대칭 깨짐을 통해 입자에 질량을 부여하는 힉스 장의 스칼라 들뜸.' },
  'Relic Neutrino Background':{ name: '잔존 중성미자 배경',description: '거의 정지 상태로 식어버린 빅뱅 중성미자.' },
  'Z Boson':                { name: 'Z 보손',           description: '약한 상호작용을 매개하는 전기적으로 중성인 게이지 보손 — W의 짝.' },
  'Positronium Atom':       { name: '포지트로늄',       description: '포지트로늄은 전자가 제 반물질 쌍둥이를 도는 덧없는 \'원자\' — 잠시 돌다 10억 분의 1초 단위로 감마선이 되어 쌍소멸한다.' },
  'Dark Matter Annihilation':{ name: '암흑물질 소멸',   description: '암흑물질이 제 반입자라면 둘이 충돌해 보통 입자로 소멸할 수 있다 — 물리학자들이 은하 중심에서 찾는 그 빛.' },
  'BH Domination':          { name: '블랙홀 지배기',    description: '축퇴 시대의 황혼, 별도 양성자도 스러진 뒤 — 블랙홀이 살아남은 지배적 천체로서 우주를 물려받는다.' },
  'Last Baryon':            { name: '마지막 바리온',    description: '양성자가 정말 붕괴한다면, 아득한 미래에 우주의 바로 그 마지막 바리온 — 마지막 보통 물질 — 이 그저 녹아 사라진다.' },
  'Baryon Washout':         { name: '바리온 소진',      description: '\'소진\'은 바리온 수를 위반하는 반응이 쌓인 물질 잉여를 지우는 과정 — 애초에 무엇이 빅뱅에서 살아남았는가와 얽혀 있다.' },

  // Stage 15
  'Hawking Photon':         { name: '호킹 광자',        description: '호킹 복사로 블랙홀은 천천히 증발한다 — 그러나 태양 질량 블랙홀은 심우주보다 차가워, 절대영도 위 10억 분의 1도로 빛난다.' },
  'Virtual Particle Pair':  { name: '가상 입자쌍',      description: '빈 공간은 끊임없이 가상 입자쌍이 들고 나며 들끓는다 — 양자 불확정성이 허락하는 찰나, 에너지를 빌려서.' },
  'Ergosphere':             { name: '에르고권',         description: '에르고권은 회전 블랙홀 둘레에서 공간 자체가 너무 세게 끌려 — 무엇도 멈춰 설 수 없고 모든 것이 함께 돌도록 강제되는 영역.' },
  'Event Horizon':          { name: '사건의 지평선',    description: '돌아올 수 없는 지점 — 넘으면 빛조차 못 빠져나오고, 밖에서 보면 당신은 거기 영영 멈춘 채 붉어지며 사라지는 듯 보인다.' },
  'Penrose Process':        { name: '펜로즈 과정',      description: '펜로즈 과정은 회전 블랙홀의 자전에서 에너지를 뽑아낸다 — 원리상 그 질량의 최대 29%를 쓸 수 있는 에너지로 거둘 수 있다.' },
  'BH Merger Wave':         { name: '블랙홀 병합파',    description: '블랙홀 병합은 점점 높아지는 중력파 \'지저귐\'을 내보내며 — 찰나 동안 중력 출력으로 우주 전체를 압도한다.' },
  'BH Entropy':             { name: '블랙홀 엔트로피',  description: '블랙홀 엔트로피는 부피가 아니라 표면에 적혀 있다 — 초대질량 블랙홀 하나가 가시 우주의 모든 보통 물질보다 큰 엔트로피를 품는다.' },
  'Stellar BH Evaporation': { name: '항성 블랙홀 증발', description: '항성질량 블랙홀이 호킹 복사로 완전히 증발하는 데는 약 10⁶⁷년 — 지금 우주 나이보다 천문학적으로 길다.' },
  'Supermassive Evaporation':{ name: '초대질량 증발',   description: '은하 핵의 초대질량 블랙홀은 증발에 약 10¹⁰⁰년(\'구골\' 년)이 걸려 — 우주 역사상 가장 오래 사는 천체다.' },
  'Firewall':               { name: '파이어월',         description: '\'파이어월\' 역설은 떨어지는 우주인이 지평선에서 고에너지 입자의 벽에 부딪힐지 모른다고 본다 — 횡단이 아무렇지 않아야 한다는 아인슈타인과 충돌한다.' },
  'Information Paradox':    { name: '정보 역설',        description: '정보 역설은 블랙홀이 증발하면 정보가 어디로 가느냐고 묻는다 — 물리학은 정보가 파괴될 수 없다는데, 호킹 복사는 지운 듯 보였다.' },
  'Planck Remnant':          { name: '플랑크 잔해',      description: '일부 이론은 증발이 작은 \'플랑크 잔해\'에서 멈춘다고 본다 — 물리학의 최소 크기쯤 되는 안정한 알갱이로, 잃어버린 정보를 품었을지 모른다.' },
  'Final Evaporation Flash':{ name: '최후 증발 섬광',   description: '블랙홀의 죽음은 폭발적이다 — 줄어들수록 더 뜨겁고 밝아져, 마지막 순간 고에너지 복사의 섬광으로 끝난다.' },
  'Last Black Hole':        { name: '마지막 블랙홀',    description: '가장 큰 블랙홀이 마지막에 증발한다 — 마지막 하나는 지금으로부터 약 10¹⁰⁰년 뒤 사라지며, 구조를 가진 물질의 진짜 끝을 알린다.' },

  // Stage 16
  'Tau':                    { name: '타우',             description: '가장 무거운 하전 경입자 — 거의 즉시 붕괴하는 3세대 전자의 형제.' },
  'Lone Photon':            { name: '외로운 광자',      description: '우주의 마지막 상태에서 빛은 너무 옅게 퍼져, 외로운 광자들이 어쩌면 수 광년씩 떨어진 공허를 떠돈다 — 다시는 무엇과도 마주치지 못한 채.' },
  'Relic Positron':         { name: '잔존 양전자',      description: '고대 반물질과의 거의 완벽한 쌍소멸에서 살아남은 떠돌이 양전자들이 — 공허에 남은 마지막 입자로 서성인다.' },
  'Tau Neutrino':           { name: '타우 중성미자',    description: '타우와 짝을 이루는 3세대 중성미자 — 질량이 거의 없고 약하게만 상호작용한다.' },
  'Cosmic Background Photon':{ name: '우주 배경 광자',  description: '우주배경복사는 빅뱅의 잔광 — 138억 년을 날아온 그 광자들이, 옛 무신호 TV 화면 지직거림의 일부를 이룬다.' },
  'Thermal Equilibrium':    { name: '열적 평형',        description: '열적 죽음은 완전한 열적 평형 — 모든 것이 같은 온도에 이르러 더는 에너지가 흐르거나 일할 수 없다.' },
  'Max Entropy':             { name: '최대 엔트로피',    description: '최대 엔트로피는 우주의 마지막 무특징 상태 — 완벽히 무질서하고, 쓸 수 있는 에너지도, 일어날 사건도 없다.' },
  'De Sitter Vacuum':       { name: '드 시터 진공',     description: '암흑에너지가 일정하다면 우주는 텅 빈 채 지수적으로 팽창하는 드 시터 상태로 흘러간다 — 차갑고 어둡게, 열적 죽음을 향해 영원히 늘어나며.' },
  'Quantum Fluctuation Final':{ name: '최후의 양자 요동',description: '\'죽은\' 진공에서도 양자 요동은 결코 완전히 멎지 않는다 — 텅 빈 우주에 남은 마지막 활동, 무작위 잔물결이 계속된다.' },
  'Thermal Death':          { name: '열적 죽음',        description: '\'열적 죽음\'(대동결)은 가장 유력한 예측 — 우주가 영원히 팽창·냉각해 절대영도를 향하고, 모든 구조는 오래전 스러진다.' },
  'Dark Energy Spike':      { name: '암흑에너지 폭주',  description: '빅 립에서 암흑에너지가 너무 강해져 은하·별·행성·원자를 차례로 찢고 — 마지막 순간엔 공간의 직물 자체가 찢어진다.' },
  'Gravitational Singularity':{ name: '중력 특이점',    description: '빅 크런치에서 우주 팽창이 역전돼 모든 것이 다시 한 점으로 무너진다 — 빅뱅을 거꾸로 돌린 단 하나의 뜨거운 특이점.' },
  'True Vacuum Bubble':     { name: '진정한 진공 거품', description: '우리 진공이 \'거짓\'일 뿐이라면, 진짜 진공의 거품이 생겨 광속으로 팽창하며 — 예고 없이 물리법칙을 다시 쓰고 길 위의 모든 것을 지운다.' },
  'Quantum Bounce':         { name: '양자 반동',        description: '반동 모형에서 우주는 진짜로 끝나지 않는다 — 붕괴가 새 빅뱅으로 \'튕겨\', 우주는 끝없는 탄생과 죽음을 순환할지 모른다.' },
  // ── P3 pyramid padding (S4–S15 commons + rares) ──
  // Stage 4
  'Positron':                { name: '양전자',           description: '1932년 처음 발견된 최초의 반입자이자, 오늘날 PET 의료 영상에서 일하는 전자의 반물질 쌍둥이.' },
  'Neutrino Decoupling':     { name: '중성미자 분리',    description: '빅뱅 약 1초 후 중성미자가 상호작용을 멈추고 자유로워져 — 지금도 1cm³마다 약 300개의 유령 입자가 떠돈다.' },
  'Proton-Proton Chain':     { name: '양성자-양성자 연쇄', description: '첫 단계가 너무 드물어 — 태양 중심에서도 양성자 하나가 융합되기까지 평균 수십억 년이 걸리는 융합 과정.' },
  'Deuterium Bottleneck':    { name: '중수소 병목',      description: '10억 대 1의 고에너지 광자가 갓 태어난 중수소를 족족 부수어, 우주가 식을 때까지 모든 원소 합성을 가로막았다.' },
  'e⁺e⁻ Annihilation':       { name: '전자-양전자 쌍소멸', description: '거의 모든 쌍이 빛으로 소멸하고, 10억 분의 1만큼 더 많던 전자만 살아남아 — 오늘의 모든 물질이 됐다.' },
  'Helium-4 Plateau':        { name: '헬륨-4 고원',      description: '가장 단단히 묶인 가벼운 핵이라 거의 모든 중성자가 헬륨-4로 몰려 — 세부 사항과 무관하게 평평한 ~25%로 굳어진다.' },
  'Beryllium-8':             { name: '베릴륨-8',         description: '10⁻¹⁶초 만에 헬륨 둘로 부서지는 막다른 핵 — 별이 이를 건너뛰는 \'공명\' 묘기를 찾아낸 덕에 탄소와 당신이 존재한다.' },
  // Stage 5
  'Lyman-alpha Photon':      { name: '라이먼-알파 광자', description: '수소 전자가 바닥 상태로 떨어질 때 내는 광자 — 재결합은 이것을 조 단위로 쏟아내야 원자가 비로소 만들어졌다.' },
  'Saha Equilibrium':        { name: '사하 평형',        description: '원자가 ~3700K에 생긴다고 예측하지만, 우주가 광자를 충분히 빨리 못 버려 실제 재결합은 훨씬 더 식어서야 일어났다.' },
  'Recombination Front':     { name: '재결합 전선',      description: '재결합은 한순간이 아니라, 식어가는 우주가 마침내 양성자와 전자를 짝지어 주며 수천 년에 걸쳐 휩쓸어 갔다.' },
  'Photon Drag':             { name: '광자 끌림',        description: '재결합 전, 광자 압력이 점성 유체처럼 바리온을 물리적으로 끌어당겨 — 빛이 놓아줄 때까지 물질의 붕괴를 붙들었다.' },
  'Neutral Hydrogen':        { name: '중성 수소',        description: '99.9999999999996%가 텅 빈 공간인 중성 수소 원자 — 그것으로 우주를 채우자 비로소 우주가 투명해졌다.' },
  'Decoupling Redshift':     { name: '분리 적색편이',    description: '우주가 지금의 1100분의 1 크기, 3000K로 빛나던 적색편이 z≈1100 — CMB의 탄생을 정확히 짚을 수 있다.' },
  'Helium Recombination':    { name: '헬륨 재결합',      description: '헬륨이 수소보다 수십만 년 먼저 전자를 붙잡았다 — 더 꽉 쥐는 힘 탓에 더 뜨겁고 이른 우주가 필요했다.' },
  // Stage 6
  'Spin Temperature':        { name: '스핀 온도',        description: '열이 아닌 \'온도\' — 수소 스핀 준위의 분포를 나타내며, 21cm 신호가 CMB 위로 빛날지 그림자를 드리울지를 정한다.' },
  'Wouthuysen-Field':        { name: '보우테이슨-필드 결합', description: '최초의 별이 낸 라이먼-알파 광자가 수소의 스핀 상태를 슬쩍 뒤섞는 효과 — 암흑기 21cm 신호를 보이게 만든 방아쇠.' },
  'Adiabatic Cooling':       { name: '단열 냉각',        description: '별이 없자 암흑기 가스는 순전히 우주 팽창만으로 식어 — CMB보다 차가워져 그 배경 빛을 들이켰다.' },
  'First Overdensity':       { name: '최초의 과밀',      description: '빅뱅의 0.001% 잔물결에서 시작된 우주적 경주에서, 가장 먼저 붕괴할 만큼 빽빽해진 첫 영역.' },
  'Jeans Mass':              { name: '진스 질량',        description: '붕괴의 \'최소 무게\' — 가스 구름은 진스 질량보다 무거워야 점화되고, 냉각이 더딘 원시 가스는 그 문턱이 어마어마하게 높았다.' },
  'Dark Matter Microhalo':   { name: '암흑물질 미소 헤일로', description: '가장 작은 암흑물질 덩어리는 지구 질량의 \'미소헤일로\'일지도 — 우주 거미줄 전체를 씨 뿌린 보이지 않는 조약돌.' },
  'Lyman-Werner Photon':     { name: '라이먼-베르너 광자', description: '닿는 즉시 분자 수소를 깨뜨리는 자외선 광자 — 최초의 별들은 이 H₂ 파괴자를 뿌려 제 형제들의 탄생을 방해했다.' },
  // Stage 7
  'Accretion Disk':          { name: '강착 원반',        description: '치밀한 천체로 나선을 그리며 떨어지는 물질이 초고온 원반으로 쌓여 — 은하 전체보다 밝게 빛날 수 있다.' },
  'Deuterium Burning':       { name: '중수소 연소',      description: '중수소는 보통 수소보다 낮은 온도에서 융합돼, 별이 진짜 점화 전 가장 먼저 태우는 \'시동 연료\'다.' },
  'Triple-Alpha Spark':      { name: '삼중알파 불꽃',    description: '탄소는 아슬아슬한 우연 덕에 존재한다 — 헬륨 핵 셋이 절묘하게 맞춰진 \'호일 상태\'로 10⁻¹⁶초 안에 융합해야 한다.' },
  'Nitrogen':                { name: '질소',             description: '우리 공기의 78%를 채우는 질소는 별 속 CNO 순환의 촉매로 단조됐다 — 태양보다 무거운 별의 융합 엔진.' },
  'Convective Core':         { name: '대류핵',           description: '거대 별 내부는 끓는 수프처럼 들끓어, 대류가 신선한 연료를 융합하는 핵으로 끊임없이 끌어올린다.' },
  'Neon':                    { name: '네온',             description: '거대 별 말기, 네온 연소는 겨우 1년 남짓 지속된다 — 별이 철 핵의 죽음을 향해 질주하고 있다는 신호.' },
  'Silicon':                 { name: '규소',             description: '규소 연소는 별의 마지막 막 — 단 하루 만에 철로 융합되고, 그러면 별에겐 단 몇 초가 남는다.' },
  // Stage 8
  'Escape Fraction':         { name: '탈출 비율',        description: '은하의 이온화 광자 중 우주로 새어 나가는 것은 일부뿐 — 대부분 집안에서 흡수돼, 이 누출률이 재이온화의 핵심 병목이다.' },
  'Lyman Continuum':         { name: '라이먼 연속선',    description: '라이먼 한계 너머의 수소 파괴 자외선 — 은하를 탈출하기만 하면 바로 우주를 재이온화하는 그 빛.' },
  'Patchy Reionization':     { name: '얼룩진 재이온화',  description: '재이온화는 한꺼번에 일어나지 않았다 — 빽빽한 곳이 먼저 밝아지고 보이드는 어두운 채로, 하늘에 스위스 치즈 무늬를 남겼다.' },
  'Photoheating':            { name: '광가열',           description: '가스를 이온화하는 행위 자체가 열을 쏟아부어, 은하간 매질을 수만 도까지 데우고 부풀린다.' },
  'Helium Reionization':     { name: '헬륨 재이온화',    description: '헬륨은 약 110억 년 전 두 번째 재이온화가 필요했고 — 그 단단히 묶인 전자를 벗길 만큼 센 광자는 퀘이사만이 지녔다.' },
  'Damping Wing':            { name: '감쇠 날개',        description: '먼 은하 수소선의 붉은 가장자리에 번진 자국 — 주위를 둘러싼 중성 가스 구름의 흔적으로, 은하별 재이온화 시점을 잰다.' },
  'Lyman-alpha Emitter':     { name: '라이먼-알파 방출체', description: '특정 수소선으로 빛나는 은하는 우주의 손전등 — 그 빛이 흐려지면 근처에 중성 안개가 아직 남았다는 신호다.' },
  // Stage 9
  'Cold Flow':               { name: '차가운 흐름',      description: '은하를 가장 빨리 키우는 길은 충격으로 데워지지 않고 중심까지 곧장 쏟아지는 차가운 가스 줄기 — 우주 거미줄의 급식관.' },
  'Galactic Disk':           { name: '은하 원반',        description: '우리은하의 납작한 별 원반은 지름 10만 광년인데 두께는 약 1천 광년 — 비례로 따지면 종이보다 얇다.' },
  'Stellar Bulge':           { name: '항성 팽대부',      description: '나선은하 중심의 빽빽한 늙은 별 무리 — 그 성장은 안에 숨은 블랙홀의 질량과 단단히 묶여 있다.' },
  'Galactic Fountain':       { name: '은하 분수',        description: '폭발하는 별이 뜨거운 가스를 원반 위 수천 광년까지 날려 올리면, 식어서 다시 비처럼 떨어진다 — 느린 재순환 분수.' },
  'Satellite Galaxy':        { name: '위성 은하',        description: '우리은하는 둘레를 도는 수십 개 작은 은하를 천천히 잡아먹으며 — 그들을 긴 별의 강줄기로 찢어 흩뜨린다.' },
  'Globular Cluster':        { name: '구상성단',         description: '수십만 별이 빽빽이 묶인 이 공은 우주만큼 늙었다 — 120~130억 년으로, 알려진 가장 오래된 별들을 품는다.' },
  'Starburst Galaxy':        { name: '폭발적 항성생성 은하', description: '어떤 은하는 평소보다 수백 배 빠르게 별을 단조해 — 가스를 우주적 찰나에 다 태워 버린다.' },
  // Stage 10
  'Solar Nebula':            { name: '태양 성운',        description: '우리 태양계 전체가 단 하나의 붕괴하는 가스·먼지 구름에서 응결됐다 — 그래서 모든 것이 같은 평면에서 같은 방향으로 돈다.' },
  'Chondrule':               { name: '콘드룰',           description: '태양계 최고(最古)의 고체는 운석 속 한때 녹았던 작은 방울 — 45억 6700만 년 전에 얼어붙어, 지구보다도 늙었다.' },
  'Frost Line':              { name: '서리선',           description: '태양에서 일정 거리 너머는 물이 얼 만큼 추워져 고체 재료가 급증했다 — 그래서 거대 행성들이 모두 그 바깥에서 만들어졌다.' },
  'Accretion Heat':          { name: '강착열',           description: '수많은 미행성이 충돌한 에너지가 어린 지구를 어찌나 격렬히 데웠는지 — 행성 전체가 마그마 바다로 녹아내렸다.' },
  'Protoplanet':             { name: '원시행성',         description: '제 궤도의 잔돌을 쓸어 담으며 행성이 되어 가는 달~화성 크기의 배아 — 때로는 파국적으로 충돌하기도 했다.' },
  'Core Differentiation':    { name: '핵 분화',          description: '어린 지구가 녹았을 때 무거운 철은 가라앉아 핵이 되고 가벼운 암석은 떠올라 — 기름과 물처럼 행성을 층층이 갈랐다.' },
  'Ice Giant':               { name: '얼음 거성',        description: '천왕성과 해왕성은 물·암모니아·메탄 얼음으로 된 \'얼음 거성\' — 해왕성은 시속 2,000km 넘는 태양계 최강의 바람을 분다.' },
  // Stage 11
  'Late Heavy Bombardment':  { name: '후기 대폭격',      description: '약 40억 년 전 소행성의 물결이 어린 행성들을 두들겼을지 모른다 — 그 흉터가 지금도 달의 오래된 얼굴에 곰보처럼 남아 있다.' },
  'Magnetosphere':           { name: '자기권',           description: '지구 자기장은 우주에 거대한 눈물방울 모양 방패를 깎아 내, 밤 쪽으로는 달 궤도 너머까지 뻗는다 — 태양풍을 막는 보이지 않는 갑옷.' },
  'Primordial Soup':         { name: '원시 수프',        description: '번개나 화산 분출구의 에너지를 받은 단순 분자가 최초의 자기복제 체계로 조립된 — 따뜻한 화학 수프에서 생명이 빚어졌을지 모른다.' },
  'Plate Tectonics':         { name: '판 구조',          description: '지구 지각은 손톱 자라는 속도로 떠도는 판들로 쪼개져 있다 — 눈에 안 보일 만큼 느리지만, 대륙을 재배치할 만큼 끈질기다.' },
  'Snowball Earth':          { name: '눈덩이 지구',      description: '수억 년 전 지구 전체가 극에서 극까지 얼어 빙하가 적도까지 내려왔을지 모른다 — 거대한 눈덩이가 된 지구.' },
  'Ozone Layer':             { name: '오존층',           description: '산소가 공기를 채우자 고공에 얇은 오존 방패가 생겨 치명적 자외선을 막았다 — 생명이 마침내 뭍으로 기어오르게 한 자외선 차단막.' },
  'Eukaryote':               { name: '진핵생물',         description: '한 미생물이 다른 미생물을 삼키고 살려 둔 데서 복잡한 세포가 생겼다 — 그래서 당신의 모든 세포엔 그 고대 박테리아의 후손(미토콘드리아)이 발전소로 남아 있다.' },
  // Stage 12
  'Subgiant Branch':         { name: '준거성 가지',      description: '준거성 단계는 별의 짧은 중년의 위기 — 핵의 수소가 바닥나며 별이 적색거성을 향해 부풀기 시작한다.' },
  'Dredge-Up':               { name: '준설',             description: '\'준설\'은 죽어가는 별의 들끓는 대류가 깊은 내부에서 갓 단조한 탄소 같은 원소를 표면까지 끌어올리는 현상이다.' },
  'Thermal Pulse':           { name: '열 맥동',          description: '말년의 별은 주기적 \'열 맥동\'을 겪는다 — 껍질의 헬륨 섬광이 수만 년마다 별을 트림하고 떨게 만든다.' },
  's-Process':               { name: 's-과정',           description: '늙은 별 속 느린 중성자 포획이 철보다 무거운 원소의 절반쯤을 만든다 — 우주의 바륨·납, 그리고 일부 금까지.' },
  'Electron Degeneracy':     { name: '전자 축퇴',        description: '전자 축퇴 압력은 백색왜성을 떠받치는 순수 양자적 밀어냄 — 열이 아니라 배타 원리에서 나오므로 식어도 사라지지 않는다.' },
  'Chandrasekhar Limit':     { name: '찬드라세카르 한계', description: '태양 약 1.4배를 넘으면 전자가 광속에 닿아 축퇴 압력이 무너진다 — 그래서 어떤 백색왜성도 이 한계를 넘으면 터지거나 붕괴한다.' },
  'Carbon Detonation':       { name: '탄소 폭연',        description: '한계까지 몰린 백색왜성이 탄소를 한꺼번에 점화하는 폭주 열핵 폭발 — 단 몇 초 만에 별 전체를 풀어헤친다.' },
  // Stage 13
  'Red Dwarf':               { name: '적색왜성',         description: '적색왜성은 우주의 마라톤 주자 — 너무 어둡고 효율적이라 최대 10조 년, 태양 수명의 1천 배를 탈 수 있다.' },
  'Degenerate Remnant':      { name: '축퇴 잔해',        description: '축퇴 잔해(백색왜성·중성자별)는 오직 양자 압력만으로 버티는 별 — 융합이 끝난 자리에 남은 차가운 시체다.' },
  'Last Star Formation':     { name: '마지막 별 생성',   description: '천문학자들은 우주가 약 100조 년 뒤 별을 만들 가스를 다 써 버려 — 그 뒤로 새 별이 영영 태어나지 않으리라 본다.' },
  'Halo Star Stream':        { name: '헤일로 항성류',    description: '갈가리 찢긴 왜소은하에서 떨어져 나온 별들이 은하 헤일로를 가로지르는 긴 \'항성류\'를 그린다 — 고대 우주 동족포식의 화석 자취.' },
  'WD Crystallization':      { name: '백색왜성 결정화',  description: '백색왜성이 식으면 그 탄소-산소 핵이 안에서 바깥으로 말 그대로 결정화되어 — 사실상 별 크기의 우주 다이아몬드가 된다.' },
  'Merger Remnant':          { name: '병합 잔해',        description: '두 치밀성이 병합하면 남은 천체(더 무거운 중성자별이나 새 블랙홀)가 그 잔해 속에서 금·백금 같은 무거운 원소를 단조한다.' },
  'Millisecond Pulsar':      { name: '밀리초 펄서',      description: '밀리초 펄서는 동반성의 물질을 훔쳐 초당 수백 번까지 빨라진다 — 표면이 광속의 상당 비율로 휘돈다.' },
  // Stage 14
  'Baryon Half-Life':        { name: '바리온 반감기',    description: '양성자가 붕괴한다면 그 반감기는 10³⁴년 넘게 — 지금 우주 나이의 1조×1조 배가 넘는다.' },
  'Decay Photon':            { name: '붕괴 광자',        description: '많은 입자 붕괴는 광자로 끝난다 — 아득한 시대에 걸친 물질의 더딘 붕괴가 우주를 희미하게 흩어진 빛으로 천천히 흘려보낸다.' },
  'Grand Unification Relic': { name: '대통일 잔재',      description: '대통일 이론은 강·약·전자기력이 하나였던 시절의 잔재를 예측한다 — 아직 발견되지 않은 가설적 자기 단극자를 포함해.' },
  'Sphaleron':               { name: '스팔레론',         description: '스팔레론은 쿼크를 경입자로 바꾸고 바리온 수를 다시 쓰는 표준모형 과정 — 뜨거운 초기 우주엔 흔했지만 어떤 가속기에서도 본 적 없다.' },
  'Cold Degenerate Gas':     { name: '차가운 축퇴 기체', description: '먼 미래에 물질은 차가운 축퇴 기체로 가라앉는다 — 오직 양자 압력만으로 버티는, 오늘날 무엇보다 차갑고 고요한 물질.' },
  'Hawking Preheat':         { name: '호킹 예열',        description: '우주가 비어 갈수록 블랙홀의 호킹 복사가 내는 희미한 온기가 — 남은 몇 안 되는 의미 있는 열원이 된다.' },
  'Muonium':                 { name: '뮤오늄',           description: '뮤오늄은 전자가 양성자 대신 뮤온을 도는 기묘한 원자 — 뮤온이 붕괴하기까지 단 약 200만 분의 1초만 존재한다.' },
  // Stage 15
  'Hawking Temperature':     { name: '호킹 온도',        description: '블랙홀의 온도는 직관과 거꾸로다 — 클수록 더 차갑게 빛나, 거대한 것은 거의 얼어붙고 작은 것은 이글거린다.' },
  'Unruh Radiation':         { name: '운루 복사',        description: '운루 효과는 빈 공간을 가속해 지나가기만 해도 진공이 따뜻하게 보인다고 예측한다 — 가속하는 관측자에겐 진짜 \'차가운\' 공허란 없다.' },
  'Page Time':               { name: '페이지 시간',      description: '\'페이지 시간\'은 블랙홀이 질량의 절반을 복사해 낸 순간 — 잃어버린 정보가 마침내 새어 나오기 시작한다고 보는 전환점.' },
  'Frame Dragging':          { name: '좌표계 끌림',      description: '회전하는 질량은 저은 숟가락의 꿀처럼 시공간을 함께 끌고 돈다 — 자전하는 지구 둘레에서도 위성 자이로스코프로 측정된 효과.' },
  'Greybody Factor':         { name: '회색체 인자',      description: '블랙홀은 완벽한 복사체가 아니다 — \'회색체 인자\'는 그 중력이 빠져나가려는 호킹 복사를 어떻게 걸러 빛을 다시 빚는지를 나타낸다.' },
  'Curvature Singularity':   { name: '곡률 특이점',      description: '블랙홀 중심엔 시공간 곡률이 무한이 되어 — 알려진 물리법칙이 통째로 무너지는 특이점이 있다.' },
  'Quasi-normal Ringdown':   { name: '준정규 진동',      description: '병합 후 갓 태어난 블랙홀은 종처럼 \'울려\' — 몇 가지 특유의 중력파 음으로 잦아든다. 이것이 \'링다운\'이다.' },
};

// Item counts per stage: S1=3C, S2=4C+4R, S3=4C+4R+4E, S4-15=4C+4R+4E+2L, S16=4C+3R+2E+5L(endings)
// Effect distribution: each C/R/E group has 1 auto + 1 click + 1 crit + 1 time; L = multiplier only
// Stage 1 exception: 3 commons only (auto/click/crit), no time
export const STAGE_ENTITIES: StageEntity[] = [
  // ── Stage 1: Inflation (3 common: auto/click/crit) ─────────────────────────
  ...stage(1, [
    item('Quantum Fluctuation', 'δE',  'Quantum jitter that inflation blew up to cosmic size — the noise that seeded every galaxy.',   'common', 'click', 15.0),
    item('False Vacuum Bubble', '⊙',   'A vacuum that looks empty but hides vast energy — like a ball in a dent partway up a hill, ready to roll.',   'common', 'auto', 1.0),
    item('Inflaton Surge',      'φ̈',  'The field spike that ballooned the cosmos from smaller than a proton to bigger than a grapefruit in an instant.',     'common', 'crit',  0.5, true),
  ]),

  // ── Stage 2: Baryogenesis (4C + 4R) ────────────────────────────────────────
  ...stage(2, [
    item('Up Quark',            'u',   'Two sit in every proton, yet the quarks supply just 1% of its weight — the other 99% is pure binding energy.',            'common', 'auto',  0.8),
    item('Down Quark',          'd',   'A hair heavier than the up quark — and that tiny gap is why the neutron outweighs the proton, and decays.',             'common', 'click', 15.0),
    item('Electron',            'e⁻',  'So light it takes 1,836 of them to match one proton, yet it carries the exact same charge, opposite in sign.',        'common', 'crit',  0.3, true),
    withAliases(
      item('Electron Neutrino',   'νₑ',  'Electron-flavor neutrino, nearly massless, slipping through matter untouched.', 'common', 'auto_mult',  2.0),
      ['s2_04_neutrino'],
    ),
    item('Gluon',               'g',   'It carries the strong force and the very charge it responds to — so gluons pull on each other, trapping quarks forever.',      'rare',   'auto',  2.0),
    item('Strange Quark',       's',   'Named because particles holding it lived "strangely" long before decaying — a clue to a brand-new conservation law.',           'rare',   'click', 22.0),
    item('W Boson',             'W±',  'The weak force\'s heavyweight messenger — about 80 times a proton\'s mass, which is exactly why radioactive decay is so slow.',       'rare',   'crit',  0.5, true),
    item('CP Violation Pocket', 'CP̸', 'Without this tiny asymmetry, matter and antimatter would have annihilated into pure light — the reason you exist.',    'rare',   'auto_mult',  2.0),
  ]),

  // ── Stage 3: Quark-Gluon Plasma (4C + 4R + 4E) ─────────────────────────────
  ...stage(3, [
    item('Free Quark',         'q',    'For the universe\'s first millionth of a second, quarks roamed free — a state recreated as the hottest stuff ever made.',           'common', 'click', 15.0),
    item('Gluon Plasma',       'gg',   'Hotter than anything ever created, yet it flows as the most "perfect" near-frictionless liquid known.',             'common', 'auto', 1.0),
    item('Pion',               'π',    'The lightest particle made of quarks — once thought to be the "glue" holding the nucleus together.',        'common', 'crit',  0.4, true),
    item('Muon',               'μ',    'A fat, unstable cousin of the electron (207× heavier) — fast ones surviving longer is real proof of time dilation.',   'common', 'auto_mult',  1.5),
    item('Plasma Vortex',      '⟳',   'Quark-gluon plasma is the most violently swirling fluid ever measured, dwarfing the mightiest ocean storms.',        'rare',   'auto',  3.0),
    item('Charm Quark',        'c',    'Its 1974 discovery was so revolutionary it\'s called the "November Revolution" of physics.',            'rare',   'click', 22.0),
    item('Kaon',               'K',    'Studying it in 1964 caught the universe breaking the matter/antimatter mirror — the first hint of CP violation.',    'rare',   'crit',  0.6, true),
    item('Bottom Quark',       'b',    'As heavy as a whole helium atom, yet still a sizeless fundamental point.',           'rare',   'auto_mult',  2.0),
    item('Color Flux Tube',    '≡',    'Pull two quarks apart and the force snaps into a taut string — yank hard and it just births a new quark pair.',     'epic',   'auto',  4.0),
    withAliases(
      item('Top Quark',          't',    'Heaviest quark of all — so short-lived it decays before it can ever hadronize.', 'epic',   'click', 35.0),
      ['s3_10_top_quark_decay'],
    ),
    item('QCD Phase Boundary', '─',    'The cosmic "freezing point" near 2 trillion degrees where the quark soup condensed into protons and neutrons.',  'epic',   'crit',  1.2, true),
    item('Confinement Onset',  '⊂⊃',  'Nature\'s strangest rule: a quark can never be isolated, because the force grows stronger the farther you pull.',       'epic',   'auto_mult',  3.0),
  ]),

  // ── Stage 4: Nucleosynthesis (4C + 4R + 4E + 2L) ───────────────────────────
  ...stage(4, [
    item('Proton',               'p⁺',  'Astonishingly stable — tanks of water watched for years never caught one decaying, putting its life past 10³⁴ years.',        'common', 'auto',  1.0),
    item('Neutron',              'n',   'Rock-stable in a nucleus but it lives only ~15 minutes free — so the cosmos had to lock leftover neutrons into helium fast.',            'common', 'click', 15.0),
    item('Deuterium',            'D',   'A relic stars only destroy and never make — so every deuterium atom in the oceans was forged in the Big Bang\'s first minutes.',  'common', 'auto_mult', 1.5),
    withAliases(
      item('Photon',               'γ',   'Massless quantum of the electromagnetic force — light itself, released at every fusion step.', 'common', 'crit', 0.4, true),
      ['s4_04_gamma_ray'],
    ),
    item('Tritium',              'T',   'A fleeting radioactive hydrogen-3 made in the Big Bang that quickly decayed to helium-3 — a brief stepping-stone.',       'rare',   'auto',  2.0),
    item('Helium-3',             '³He', 'So prized as a dream fusion fuel that there are serious proposals to mine it from the surface of the Moon.',       'rare',   'click', 22.0),
    item('Beryllium-7',          '⁷Be', 'Most primordial lithium-7 was actually born as beryllium-7, only later capturing an electron to become lithium.',              'rare',   'crit',  0.6, true),
    item('Helium-4',             '⁴He', 'About 25% of all ordinary matter by mass, nearly all forged in the Big Bang\'s first 20 minutes — unchanged for 13.8 billion years.',    'rare',   'auto_mult',  2.0),
    item('Primordial Fireball',  '☀',   'Once denser and hotter than a star\'s core, the whole cosmos — yet expansion shut the oven off after just a few minutes.',        'epic', 'click', 35.0),
    item('Lithium-7',            '⁷Li', 'The Big Bang predicts about three times more lithium-7 than old stars actually show — the unsolved "cosmological lithium problem."',       'epic', 'auto', 8.0),
    withAliases(
      item('Muon Neutrino',        'νμ',  'Muon-flavor neutrino, decoupling as the lepton plasma cools below its mass.', 'epic',   'crit',  1.5, true),
      ['s4_11_neutrino_freeze_out'],
    ),
    item('Neutron-Proton Ratio', 'n/p', 'Neutrons being slightly heavier, the cooling cosmos favored protons 7 to 1 — and that ratio fixes helium at ~25%.',    'epic',   'auto_mult',  4.0),
    item('BBN Completion',       '★',   'The recipe for the first elements locked in within ~3 minutes — frozen forever at ~75% hydrogen and ~25% helium.',     'legendary', 'multiplier', 50.0),
    item('Fusion Window',        '⊕',   'A race against the clock: the cosmos stayed hot and dense enough to fuse for only about 3 to 20 minutes.',   'legendary', 'auto', 12.0),
    // P3 pyramid padding (append-only) — themed commons + 1 rare → 10C:5R.
    item('Positron',                  'e⁺',   'The first antiparticle ever discovered (1932) — and the "P" doing useful work in PET medical scans today.', 'common', 'auto', 2.0),
    item('Neutrino Decoupling',       'ν↛',   'About one second in, neutrinos flew free forever — that relic background still leaves ~300 ghosts in every cubic centimeter.',       'common', 'click', 15.0),
    item('Proton-Proton Chain',       'pp',   'Its first step is so improbable that the Sun\'s core takes, on average, billions of years to fuse any given proton.',        'common', 'crit', 0.5, true),
    item('Deuterium Bottleneck',      'D⊥',   'A billion-to-one flood of photons blasted apart every newborn deuterium nucleus, stalling all element-building for minutes.',        'common', 'auto_mult', 2.0),
    item('e⁺e⁻ Annihilation',         'e⁺e⁻', 'Nearly all pairs vanished into light — only a one-in-a-billion leftover excess of electrons survived as all matter.',     'common', 'auto', 2.0),
    item('Helium-4 Plateau',          'Yₚ',   'The most tightly-bound light nucleus funneled in almost every neutron — pinning a flat ~25% fraction the cosmos inherits.',   'common', 'click', 15.0),
    item('Beryllium-8',               '⁸Be',  'A dead end that splits into two helium nuclei in 10⁻¹⁶ s — stars only leap past it by a lucky resonance, which is why carbon exists.',         'rare', 'click', 22.0),
  ]),

  // ── Stage 5: Recombination (4C + 4R + 4E + 2L) ─────────────────────────────
  ...stage(5, [
    withAliases(
      item('Hydrogen',                  'H',    'Element 1 — a proton captures an electron and the first neutral atom is born.', 'common', 'auto',  1.5),
      ['s5_01_hydrogen_atom'],
    ),
    item('Free Electron',             'e⁻',   'A photon\'s worst nightmare — it scattered light so relentlessly the early universe was an opaque fog you couldn\'t see through.',        'common', 'click', 15.0),
    withAliases(
      item('Helium',                    'He',   'Element 2 — a helium nucleus pulls in both its electrons to go neutral.', 'common', 'auto_mult', 2.0),
      ['s5_03_helium_atom'],
    ),
    item('CMB Photon',                'γ_r',  'It has traveled 13.8 billion years to reach us — the oldest thing any instrument can ever detect.',          'common', 'crit', 0.4, true),
    item('Hydrogen Cloud',            'H₂',   'Once the fog cleared, the whole universe became one dark, cold cloud of neutral hydrogen with no stars to light it.',    'rare',   'auto',  3.0),
    item('Photon Decoupling',         'γ↗',   'The exact moment light "let go" of matter and flew free — the snapshot we see today as the cosmic microwave background.',      'rare',   'click', 22.0),
    item('Baryon Acoustic Oscillation','◌',   'Sound waves ringing through the primordial plasma froze in place — a ~500-million-light-year "ruler" still seen in galaxy clustering.',      'rare', 'auto_mult', 2.0),
    item('Plasma to Gas',             '∽',    'In a cosmic instant the universe flipped from glowing plasma to transparent gas — the lights came on, then went dark.',   'rare', 'crit', 0.8, true),
    item('Dark Matter Halo',          '○',    'Invisible dark matter had already dug the gravity "valleys" that ordinary matter would fall into to build every galaxy.',  'epic',   'auto',  6.0),
    item('Density Perturbation',      'δρ',   'Quantum jitters from the first fraction of a second, blown up to cosmic size — the seed of every galaxy, star, and planet.',       'epic',   'click', 35.0),
    item('Last Scattering Surface',   '═',    'A glowing wall at the edge of the observable universe — where photons last bounced off an electron, at redshift ~1100.',         'epic', 'auto_mult', 4.0),
    item('CMB Anisotropy',            '≈',    'The CMB is the same to 1 part in 100,000 in every direction — and its tiny hot and cold specks are the embryos of galaxy clusters.','epic', 'crit', 2.0, true),
    item('Cosmic Transparency',       'γ∞',   'Recombination made the universe see-through for the first time — and it has stayed transparent to that light ever since.',   'legendary', 'multiplier', 50.0),
    item('Structure Seed',            'δ₀',   'Every cosmic structure grew from ripples just 0.001% denser than average — the universe is built on rounding errors.','legendary', 'auto_mult', 8.0),
    // P3 pyramid padding (append-only) — themed commons + 1 rare → 10C:5R.
    item('Lyman-alpha Photon',        'Lyα',  'The photon a hydrogen electron emits dropping to ground state — recombination had to dump these by the trillion to let atoms form.',  'common', 'auto', 2.0),
    item('Saha Equilibrium',          'Saha', 'It predicts atoms should form at ~3700 K, yet recombination stalled to a far cooler temperature — the cosmos couldn\'t shed photons fast enough.',           'common', 'click', 15.0),
    item('Recombination Front',       'rec→', 'Recombination wasn\'t instant — it swept through over thousands of years as the cooling cosmos finally paired protons and electrons.',  'common', 'crit', 0.5, true),
    item('Photon Drag',               'γ·',   'Before light let go, photon pressure dragged on the baryons like a viscous fluid, holding back the collapse of matter.',  'common', 'auto_mult', 2.0),
    item('Neutral Hydrogen',          'HI',   'A neutral hydrogen atom is 99.9999999999996% empty space — yet filling the cosmos with it finally made it transparent.',         'common', 'auto', 2.0),
    item('Decoupling Redshift',       'z₁₁₀₀','We can pin the CMB\'s birth to redshift z ≈ 1100, when the universe was 1/1100th its size and a glowing 3000 K.',          'common', 'click', 15.0),
    item('Helium Recombination',      'He↘',  'Helium grabbed its electrons hundreds of thousands of years before hydrogen — its tighter grip needed a hotter, earlier cosmos.',           'rare', 'click', 22.0),
  ]),

  // ── Stage 6: Cosmic Dark Age (4C + 4R + 4E + 2L) ───────────────────────────
  ...stage(6, [
    item('Cold Hydrogen',         'H°',   'For ~100 million years the whole universe was nothing but cold, dark hydrogen — no stars, no light, total blackout.',        'common', 'click', 15.0),
    item('21cm Signal',           '₂₁',   'A radio whisper from hydrogen flipping its electron\'s spin — the only signal we can ever receive from the starless dark ages.',    'common', 'crit', 0.4, true),
    item('Dark Matter Filament',  '╌',    'Dark matter spun the "cosmic web" — vast invisible filaments along which all gas would later flow to ignite the first stars.',       'common', 'auto_mult', 2.0),
    item('Cold Gas Cloud',        '≋',    'With no stars to warm it, primordial gas chilled to just a few degrees above absolute zero before gravity could gather it.',      'common', 'auto', 1.5),
    item('Molecular Hydrogen',    'H₂*',  'Two hydrogen atoms paired into H₂ became the cosmos\'s only refrigerant — without this trace coolant, no first star could collapse.', 'rare',   'auto',  5.0),
    item('Protogalactic Cloud',   '○',    'Long before any galaxy shone, gas pooling in dark-matter wells formed the cold, dark proto-galaxies waiting in the dark ages.',  'rare',   'click', 22.0),
    item('Dark Matter Clump',     '●',    'Dark matter clumped first because, feeling no light pressure, it could collapse while gas was still trapped in the glowing plasma.',      'rare', 'auto_mult', 3.0),
    item('Gravitational Potential','Φ_g', 'Dark matter dug the gravity "wells," and every star and galaxy formed simply by gas tumbling down into them.',  'rare', 'crit', 0.8, true),
    item('Mini Halo',             '⊙',    'The first star cradles were "minihalos" of ~100,000–1,000,000 Suns — dark pockets just heavy enough to trap gas.',  'epic',   'auto',  8.0),
    item('Baryonic Streaming',    'v_bs', 'After recombination, gas was left coasting supersonically past dark matter, sloshing out of the smallest halos to delay the first stars.',      'epic',   'click', 35.0),
    item('Dark Energy Background','Λ',    'The dark energy accelerating today\'s universe was a negligible bystander in the dark ages — it only took over billions of years later.',     'epic',   'crit',  2.0, true),
    item('Silk Damping',          'λ_d',  'Photons diffusing out of dense regions before recombination smeared away the smallest ripples, erasing structure below a certain size.',  'epic',   'auto_mult',  4.0),
    item('Gravitational Collapse','↓↓',   'With no starlight or pressure to fight it, gravity finally won — runaway collapse that lit the very first star.',  'legendary', 'multiplier', 50.0),
    item('First Cosmic Dawn Seed','∘',    'A single overdense pocket of gas in the dark cosmos — the seed that would ignite the universe\'s very first sunrise.','legendary','auto',12.0),
    // P3 pyramid padding (append-only) — themed commons + 1 rare → 10C:5R.
    item('Spin Temperature',      'Tₛ',   'A "temperature" that isn\'t heat — it tracks hydrogen\'s spin levels and decides if the 21cm signal glows or shadows the CMB.',         'common', 'auto', 2.0),
    item('Wouthuysen-Field',      'WF',   'A clever effect where Lyman-alpha photons from the first stars secretly reshuffle hydrogen\'s spin — the trigger that made the 21cm signal visible.',       'common', 'click', 15.0),
    item('Adiabatic Cooling',     'T↓',   'With no stars, dark-age gas cooled purely from cosmic expansion — falling colder than the CMB and drinking in its light.',       'common', 'crit', 0.5, true),
    item('First Overdensity',     'δ⁺',   'The first region to grow dense enough to collapse — winning a cosmic race that began as a 0.001% ripple in the Big Bang.',     'common', 'auto_mult', 2.0),
    item('Jeans Mass',            'M_J',  'The cosmic "minimum weight" for collapse — and primordial gas\'s poor cooling set that bar enormously high.',   'common', 'auto', 2.0),
    item('Dark Matter Microhalo', '○·',   'The very smallest dark-matter clumps may be Earth-mass "microhalos" — invisible pebbles that seeded the entire cosmic web.',         'common', 'click', 15.0),
    item('Lyman-Werner Photon',   'LW',   'A UV photon that shatters molecular hydrogen on contact — the first stars sabotaged their own siblings by flooding space with these H₂-killers.',      'rare', 'click', 22.0),
  ]),

  // ── Stage 7: First Stars (4C + 4R + 4E + 2L) ───────────────────────────────
  ...stage(7, [
    item('Protostar',           '⊙',    'A protostar shines before fusion even begins — powered purely by the heat of its own gravitational collapse.',         'common', 'auto',  1.5),
    item('UV Photon',           'UV',   'The first stars blazed in fierce ultraviolet, and their photons ripped electrons off hydrogen across the cosmos.',   'common', 'click', 15.0),
    item('Main Sequence Star',  '★',    'The "main sequence" is a star\'s prime — a phase our Sun has held for 4.6 billion years and will hold for 5 billion more.',  'common', 'crit',  0.5, true),
    item('Hydrogen Fusion',     'H→He', 'Fusing hydrogen converts 0.7% of its mass straight into energy via E=mc² — the engine that powers every star.', 'common', 'auto_mult',  2.0),
    item('Oxygen',              'O',    'Every oxygen atom you breathe was forged in a dying star and blasted into space — your lungs run on stardust.',               'rare',   'auto',  4.0),
    item('Stellar Wind',        '~~→',  'Massive stars shed matter in winds so fierce they can blow away a Sun\'s worth of mass in mere thousands of years.','rare',  'click', 22.0),
    item('HII Region',          'HII',  'A young hot star carves a glowing bubble of ionized hydrogen around itself — a beacon announcing a star is born.',    'rare',   'crit',  0.8, true),
    withAliases(
      item('Carbon',              'C',    'Element 6 — triple-alpha fusion forges carbon, the dawn of chemistry.', 'rare',   'auto_mult',  3.0),
      ['s7_08_carbon_first'],
    ),
    item('Pop III Cluster',     '✦✦✦',  'The first stars ever — pure hydrogen and helium with zero metals, some hundreds of times heavier than the Sun.','epic',   'auto',  6.0),
    withAliases(
      item('Iron',                'Fe',   'Element 26 — stellar cores forge elements up to iron, the most stable nucleus.', 'epic',   'click', 35.0),
      ['s7_10_first_heavy_elements'],
    ),
    item('Stellar Feedback',    '⟲',   'The first stars rewired the cosmos — their radiation, winds, and blasts heated and scattered the very gas trying to form new stars.',  'epic', 'auto_mult', 4.0),
    item('Supernova Precursor', '⚠★',  'When a massive star\'s core finally builds iron, the energy faucet shuts off — and gravity wins in under a second.',  'epic', 'crit', 2.0, true),
    item('Pop III Supernova',   '☆→',  'When the universe\'s first stars exploded, they seeded the cosmos with its very first metals — all heavier elements trace back to them.','legendary','multiplier',50.0),
    item('Pair Instability SN', '✸',   'In a ~140–260 solar-mass star, gamma rays turn into particle pairs and the star detonates so completely it leaves no remnant at all.',   'legendary','auto_mult',8.0),
    // P3 pyramid padding (append-only) — themed commons + 1 rare → 10C:5R.
    item('Accretion Disk',      '◍',    'Infalling matter piles into a superheated disk so efficient it can outshine entire galaxies.',    'common', 'auto', 2.0),
    item('Deuterium Burning',   'D→',   'Deuterium fuses at a lower temperature than hydrogen, so a forming star burns it first — a brief "starter fuel" before ignition.',        'common', 'click', 15.0),
    item('Triple-Alpha Spark',  '3α',   'Carbon exists only by a razor-thin coincidence: three helium nuclei must fuse via a tuned "Hoyle state" within 10⁻¹⁶ s.',           'common', 'crit', 0.5, true),
    item('Nitrogen',            'N',    'The nitrogen filling 78% of our air was cooked as a catalyst in the CNO cycle — the fusion engine of stars heavier than the Sun.',      'common', 'auto_mult', 2.0),
    item('Convective Core',     '↻',    'Massive stars boil like a pot of soup inside, churning convection dredging fresh fuel into the fusing core.',  'common', 'auto', 2.0),
    item('Neon',                'Ne',   'Late in a massive star\'s life, neon fusion lasts barely a year — the star is racing toward its iron-core death.',   'common', 'click', 15.0),
    item('Silicon',             'Si',   'Silicon burning is a star\'s final act — it fuses into iron in a single day, leaving the star only seconds to live.','rare', 'click', 22.0),
  ]),

  // ── Stage 8: Reionization (4C + 4R + 4E + 2L) ──────────────────────────────
  ...stage(8, [
    item('Ionizing Photon',    'hν',    'A UV photon with just enough energy (13.6 eV) to rip the electron clean off a hydrogen atom — the spark that ended the dark ages.',   'common', 'auto',  2.0),
    item('Ionized Hydrogen',   'H⁺',   'Strip hydrogen\'s lone electron and you\'re left with a bare proton — the simplest, most abundant charged particle there is.',      'common', 'click', 15.0),
    item('HII Bubble',         '○⁺',   'Around the first galaxies, ionizing light blew expanding bubbles of clear gas into the cosmic fog, like flashlights in a foggy room.',     'common', 'crit',  0.5, true),
    item('Lyman Break',        'λ',    'Young galaxies vanish below a sharp UV wavelength as their own hydrogen swallows that light — the "drop-out" trick that finds the most distant galaxies.',     'common', 'auto_mult',  2.0),
    item('Quasar',             '⬟',    'A feeding supermassive black hole, no bigger than our solar system, outshining its entire host galaxy of hundreds of billions of stars.',   'rare',   'auto',  5.0),
    item('Early Galaxy',       '🌀',   'It was the dim dwarf galaxies of cosmic dawn, not quasars, that supplied most of the photons that reionized the universe.',  'rare',   'click', 22.0),
    item('Ionization Front',   '→→→',  'The sharp moving wall where opaque neutral gas flips to transparent ionized plasma, sweeping across space at nearly light speed.',   'rare', 'auto_mult', 3.0),
    item('X-Ray Background',   'Xγ',   'A faint all-sky X-ray glow, much of it the summed light of millions of distant feeding black holes too far to see one by one.', 'rare', 'crit', 0.8, true),
    item('Metagalactic UV',    '⟿',   'A faint ultraviolet glow pervading all intergalactic space — the combined leakage of every galaxy and quasar, ionizing the cosmos to this day.',   'epic',   'auto',  7.0),
    item('Bubble Merger',      '◎',    'As ionized bubbles around galaxies grew and overlapped, they fused like soap bubbles until the last cosmic fog burned away.','epic',   'click', 35.0),
    item('Gunn-Peterson Trough','GP',  'A pitch-black gap in a distant quasar\'s spectrum where neutral fog devoured all light — the smoking gun that the early cosmos wasn\'t yet reionized.','epic',  'crit',  2.0, true),
    item('Intergalactic Medium','IGM',  'The near-vacuum between galaxies holds most ordinary matter — under one atom per cubic meter, yet it dwarfs all the stars combined.','epic',  'auto_mult',  4.0),
    item('Reionization Complete','✓',  'By about a billion years in, the last neutral fog cleared and the universe became transparent — the state it has kept ever since.',  'legendary','multiplier',50.0),
    item('Epoch of Reionization','EoR','The universe\'s second great switching-on of the lights, when starlight burned away the neutral hydrogen fog of the dark ages.',     'legendary','auto',12.0),
    // P3 pyramid padding (append-only) — themed commons + 1 rare → 10C:5R.
    item('Escape Fraction',    'f_esc', 'Only a small slice of a galaxy\'s ionizing photons escapes into space — most are absorbed at home, making this the key bottleneck for reionization.', 'common', 'auto', 2.0),
    item('Lyman Continuum',    'LyC',   'The hydrogen-shattering UV beyond the Lyman limit — the exact light that, if it escapes a galaxy, reionizes the cosmos.',       'common', 'click', 15.0),
    item('Patchy Reionization','▦',     'Reionization didn\'t happen everywhere at once — dense regions lit up first while voids stayed dark, leaving a Swiss-cheese pattern.',        'common', 'crit', 0.5, true),
    item('Photoheating',       'T↑',    'The very act of ionizing gas dumps in heat, warming the intergalactic medium to tens of thousands of degrees and puffing it up.',      'common', 'auto_mult', 2.0),
    item('Helium Reionization','He²⁺',  'Helium needed a second, later reionization — and only quasars pack photons energetic enough to strip its tightly bound electron.',      'common', 'auto', 2.0),
    item('Damping Wing',       'λ⊃',    'A telltale smear on the red edge of a distant galaxy\'s hydrogen line, betraying surrounding neutral gas — a way to time reionization galaxy by galaxy.',  'common', 'click', 15.0),
    item('Lyman-alpha Emitter','LAE',   'Galaxies glowing in a hydrogen line act as cosmic flashlights — when their glow gets muffled, it reveals neutral fog still lingering nearby.',   'rare', 'click', 22.0),
  ]),

  // ── Stage 9: Galaxy Formation (4C + 4R + 4E + 2L) ──────────────────────────
  ...stage(9, [
    item('Dwarf Galaxy',          '🌀',  'The most common galaxies in the universe are tiny dwarfs of a few million stars — likely the building blocks of giants like the Milky Way.',           'common', 'click', 15.0),
    item('Gas Accretion',         '↘',  'Galaxies grow not just by colliding but by quietly drinking fresh gas streaming along cosmic filaments — the slow diet that fuels new stars.',         'common', 'auto', 2.0),
    item('Spiral Arm',            '⤵',  'A galaxy\'s arms aren\'t fixed star chains but density waves — cosmic traffic jams that stars drift through, lighting up as gas piles in.',     'common', 'crit',  0.5, true),
    item('Star Formation Cloud',  '★+', 'Stars are born inside cold molecular clouds so dense they block starlight — yet colder than -260°C inside.',  'common', 'auto_mult',  2.0),
    withAliases(
      item('Massive Dark Halo',     '○',  'Every galaxy sits in an invisible cocoon of dark matter outweighing all its stars roughly ten to one — the real scaffolding holding it together.',   'rare', 'auto_mult', 3.0),
      ['s9_05_dark_matter_halo'],
    ),
    item('Galaxy Merger',         '⊗',  'When galaxies collide their stars almost never hit, passing through like two swarms of bees — yet gravity reshapes both into something new.','rare', 'auto', 4.0),
    item('Galaxy Cluster',        '⊞',  'The largest gravitationally bound objects in existence, holding thousands of galaxies — yet over 80% of their mass is invisible dark matter.',             'rare', 'click', 22.0),
    item('Supermassive BH',       '⚫', 'Nearly every big galaxy hides one at its core, millions to billions of times the Sun — including 4 million Suns at the Milky Way\'s center.',    'rare', 'crit', 0.8, true),
    item('Active Galactic Nucleus','AGN','When a galaxy\'s central black hole gorges on gas, it blazes as a beacon visible across billions of light-years — a galaxy-scale lighthouse.',      'epic',   'auto',  7.0),
    item('Gravitational Lens',    '⊃⊂', 'A galaxy cluster\'s gravity bends spacetime so hard it warps background galaxies into arcs and rings — a natural telescope Einstein predicted.',     'epic', 'crit', 2.0, true),
    item('Filamentary Structure', '⌇',  'Galaxies aren\'t scattered randomly but strung along vast glowing filaments of gas and dark matter spanning hundreds of millions of light-years.',  'epic', 'auto_mult', 5.0),
    item('Cosmic Web Node',       '✦',  'Where cosmic filaments intersect, galaxy clusters pile up like beads at the knots of a vast three-dimensional web.',  'epic', 'click', 35.0),
    item('Cosmic Void',           '□',  'Enormous bubbles of near-emptiness, tens of millions of light-years across, make up most of the universe\'s volume yet hold almost nothing.','legendary','multiplier',50.0),
    item('Large Scale Structure', 'LSS','Mapped across the sky, the universe looks like a foam of soap bubbles — galaxies tracing the thin walls around immense empty voids.',   'legendary','auto_mult',8.0),
    // P3 pyramid padding (append-only) — themed commons + 1 rare → 10C:5R.
    item('Cold Flow',          '↓gas', 'The fastest way to build a galaxy is cold streams of gas pouring straight to the center without shock-heating — feeding tubes from the cosmic web.',     'common', 'auto', 2.0),
    item('Galactic Disk',      '▭',    'The Milky Way\'s star disk spans 100,000 light-years yet is only ~1,000 thick — proportionally thinner than a sheet of paper.',     'common', 'click', 15.0),
    item('Stellar Bulge',      '◐',    'The dense central swarm of a spiral\'s oldest stars, its growth tightly locked to the mass of the black hole hiding within.',      'common', 'crit', 0.5, true),
    item('Galactic Fountain',  '↑↓',   'Exploding stars blast hot gas thousands of light-years above the disk, where it cools and rains back down — a slow recycling fountain.','common', 'auto_mult', 2.0),
    item('Satellite Galaxy',   '∘∘',   'The Milky Way is slowly cannibalizing dozens of smaller galaxies orbiting it, shredding them into long streams of stars.',     'common', 'auto', 2.0),
    item('Globular Cluster',   '⊛',    'These dense balls of hundreds of thousands of stars are nearly as old as the universe — 12 to 13 billion years, holding the oldest stars known.','common', 'click', 15.0),
    item('Starburst Galaxy',   '✦↑',   'Some galaxies forge stars hundreds of times faster than normal, burning through their gas in a cosmic blink.', 'rare', 'click', 22.0),
  ]),

  // ── Stage 10: Solar System (4C + 4R + 4E + 2L) ─────────────────────────────
  ...stage(10, [
    withAliases(
      item('Sun',            '☀',    'The Sun holds 99.86% of all mass in the solar system — every planet, moon, and asteroid combined is barely a rounding error.',    'common', 'auto',  1.5),
      ['s10_13_sun'],
    ),
    withAliases(
      item('Dust Grain',     '·',     'Every rocky planet, including the one you stand on, began as microscopic dust grains sticking together around the newborn Sun.',     'common', 'click', 15.0),
      ['s10_01_dust_grain', 's10_02_iron_core'],
    ),
    item('Planetesimal',     '○',     'Kilometer-sized rubble that grew from clumping dust — the seeds gravity assembled into full planets.',   'common', 'crit',  0.4, true),
    item('Water Ice',        'H₂O',   'Most of the universe\'s water is frozen — and Earth\'s oceans may have arrived as ice locked inside comets and asteroids.',        'common', 'auto_mult',  2.0),
    item('Rocky Planet',     '🪨',   'The inner planets are dense balls of rock and metal because the young Sun\'s heat boiled away their lighter ices, leaving only the heavy stuff.',             'rare',   'auto',  4.0),
    item('Comet',            '☄',    'A "dirty snowball" from the solar system\'s birth — its glowing tail can stretch over 100 million km, longer than Earth\'s distance to the Sun.',       'rare',   'click', 22.0),
    item('Asteroid Belt',    '⋯',    'A failed planet — Jupiter\'s gravity kept it stirred up, and all its rubble combined wouldn\'t even equal our Moon.',        'rare',   'crit',  0.8, true),
    item('Gas Giant',        '♃',    'Jupiter is so massive it could swallow all the other planets twice over, yet it\'s made mostly of the same hydrogen and helium as the Sun.',   'rare',   'auto_mult',  2.0),
    item('Moon',             '☽',    'The Moon is drifting away from Earth about 3.8 cm a year — and long ago it loomed close enough to fill the sky.',   'epic',   'auto',  6.0),
    item('Liquid Water',     'H₂O·', 'Earth sits in a rare sweet spot where water stays liquid — too close to the Sun and it boils, too far and it freezes solid.',       'epic', 'auto_mult', 5.0),
    item('Magnetic Field',   '⇌',    'Earth\'s churning liquid-iron core powers a magnetic shield that deflects deadly solar wind — without it our air could be stripped like Mars\'s was.',        'epic', 'click', 35.0),
    item('Goldilocks Zone',  '🌡',   'The narrow orbital band that\'s not too hot or cold for liquid water — Earth sits comfortably inside it, Venus and Mars just miss.',           'epic', 'crit', 2.0, true),
    item('Protoplanetary Disk','◎',   'The spinning cradle of dust and gas that sculpts every world to come.','legendary','multiplier',50.0),
    item('Habitable World',  '⊕',    'For life as we know it, a world likely needs liquid water, a protective atmosphere, and a stable star — a combination that may be rare.',         'legendary','auto',12.0),
    // P3 pyramid padding (append-only) — themed commons + 1 rare → 10C:5R.
    item('Solar Nebula',     '◌gas', 'Our entire solar system condensed from a single collapsing cloud — which is why everything orbits the Sun the same way, in one plane.','common', 'auto', 2.0),
    item('Chondrule',        '•',     'The oldest solids in the solar system are tiny once-molten droplets in meteorites, frozen 4.567 billion years ago — older than Earth.',    'common', 'click', 15.0),
    item('Frost Line',       '❄|',   'Beyond a critical distance from the Sun it got cold enough for water to freeze, boosting solid material — which is why the giants formed out there.',       'common', 'crit', 0.5, true),
    item('Accretion Heat',   '🔥·',  'The energy of countless colliding planetesimals heated the young Earth so violently it melted into a global ocean of magma.',           'common', 'auto_mult', 2.0),
    item('Protoplanet',      '◓',     'Moon-to-Mars-sized embryos that swept up rubble on their way to becoming planets — and sometimes collided catastrophically.',     'common', 'auto', 2.0),
    item('Core Differentiation','Fe↓','When the young Earth melted, heavy iron sank to form the core while light rock floated up — separating the planet like oil and water.',       'common', 'click', 15.0),
    item('Ice Giant',        '♆',    'Uranus and Neptune are "ice giants" of water, ammonia, and methane — and Neptune blows the fastest winds in the solar system, over 2,000 km/h.',    'rare', 'click', 22.0),
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
      item('Moon Formation',   '☽',     'The Moon was born when a Mars-sized world called Theia slammed into the young Earth, blasting debris into orbit that coalesced.',  'common', 'crit', 0.5, true),
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
      item('Continents Rise',  'LAND', 'Earth is the only known planet with continents and plate tectonics — a slow-motion conveyor belt of crust that recycles its surface.',            'rare',   'auto',  3.0),
      ['s11_08_continents_rise'],
    ),
    withAliases(
      item('Photosynthesis',   'O₂',   'The invention of photosynthesis was history\'s most consequential pollution event — its waste, oxygen, poisoned the old world and built ours.',            'rare',   'click', 22.0),
      ['s11_06_photosynthesis'],
    ),
    withAliases(
      item('Prokaryote',       '○',    'For the first half of Earth\'s history all life was nucleus-free microbes — and they still vastly outnumber every plant and animal today.',       'rare',   'crit',  1.0, true),
      ['s11_05_prokaryote'],
    ),
    withAliases(
      item('Cambrian Explosion', '✳',  'Around 540 million years ago almost every major animal body plan burst onto the scene in a geological eyeblink — the "big bang" of animals.',          'rare',   'auto_mult',  2.0),
      ['s11_07_cambrian_explosion'],
    ),
    // Epic: Intelligence and civilization
    withAliases(
      item('Neuron',           '⚡',   'Your brain runs on ~86 billion neurons firing electrochemical signals — a network that built civilization from the chemistry of pond scum.',          'epic', 'click', 35.0),
      ['s11_11_neuron'],
    ),
    withAliases(
      item('Homo Sapiens',     'HS',   'Every human alive descends from a small African population ~300,000 years ago — making our whole species younger than many stars are old.',  'epic', 'auto', 6.0),
      ['s11_13_homo_sapiens', 's11_13_intelligence'],
    ),
    withAliases(
      item('City Lights',      '🌃',   'Human cities now glow so brightly our artificial light is visible from space — the first planet-scale signature of a technological species.',        'epic',   'crit',  2.0, true),
      ['s11_10_artificial_satellite', 's11_10_fish'],
    ),
    withAliases(
      item('Artificial Satellite','🛰','In just decades humans went from grounded to ringing their planet with thousands of orbiting machines — Earth wears a halo of its own making.',            'epic',   'auto_mult',  5.0),
      ['s11_12_plant'],
    ),
    // Legendary: Transcendence
    withAliases(
      item('Spacefaring Humanity','🚀','A species born from stardust has begun sending its own probes to other worlds — matter from the early universe now contemplating itself.',    'legendary','multiplier',50.0),
      ['s11_14_space_telescope'],
    ),
    withAliases(
      item('Interstellar Ark',   'ARK','Crossing between stars at attainable speeds takes generations — any true starship is a self-contained world carrying living cargo for centuries.',      'legendary','auto_mult',8.0),
      ['s11_14_homo_sapiens'],
    ),
    // P3 pyramid padding (append-only) — themed commons + 1 rare → 10C:5R.
    // New commons gate behind Atmosphere (s11_04), the new rare behind
    // Continents Rise (s11_05) — see STAGE_11_PREREQUISITE in anchors.ts.
    item('Late Heavy Bombardment','☄☄','Around 4 billion years ago a wave of asteroids may have pummeled the young planets — the scars still pock the Moon\'s ancient face.',           'common', 'auto', 2.0),
    item('Magnetosphere',    '⊕⇌',  'Earth\'s field carves a vast teardrop-shaped shield reaching past the Moon\'s orbit on the night side — our invisible armor against the solar wind.',      'common', 'click', 15.0),
    item('Primordial Soup',  '🧪',   'Life may have brewed in a warm chemical broth where simple molecules, energized by lightning or volcanic vents, assembled into self-copying systems.','common', 'crit', 0.5, true),
    item('Plate Tectonics',  '▱▱',   'Earth\'s crust is broken into plates that drift about as fast as your fingernails grow — invisible yet relentless enough to rearrange continents.','common', 'auto_mult', 2.0),
    item('Snowball Earth',   '❄⊕',   'Hundreds of millions of years ago the whole planet may have frozen pole to pole, with glaciers reaching the equator — Earth as a giant snowball.',    'common', 'auto', 2.0),
    item('Ozone Layer',      'O₃',   'Once oxygen filled the air, a thin high-altitude ozone shield formed that blocks deadly UV — the sunscreen that finally let life crawl onto land.',      'common', 'click', 15.0),
    item('Eukaryote',        '◉',     'Complex cells arose when one microbe swallowed another and kept it alive — why your every cell still carries ancient bacteria as power plants.',         'rare', 'click', 22.0),
  ]),

  // ── Stage 12: Death of Star (4C + 4R + 4E + 2L) ────────────────────────────
  ...stage(12, [
    item('Red Giant Envelope', '🔴',   'When the Sun becomes a red giant it will swell so vast its surface may reach past Venus, roughly out to Earth\'s orbit.',   'common', 'auto',  2.0),
    item('Stellar Wind AGB',   '~~~→', 'A dying AGB star sheds its outer layers in a slow wind, blowing more than half its entire mass back into space.',    'common', 'click', 15.0),
    item('Carbon-O Core',      'C/O',  'A Sun-like star\'s final core is a ball of carbon and oxygen — the mass of the Sun crushed into the size of Earth.',        'common', 'auto_mult', 2.0),
    item('Helium Flash',       '⚡He', 'In a degenerate core helium ignites in a runaway "flash" briefly rivaling a whole galaxy\'s output — yet stays hidden inside the star.', 'common', 'crit', 0.5, true),
    item('Planetary Nebula',   'PN',   'Named by mistake — early astronomers thought the glowing rings were planets — it\'s really a dying star\'s exhaled outer atmosphere lit by its bare core.',  'rare',   'auto',  4.0),
    item('Mass Transfer',      '→→',   'In a close binary, one star can siphon gas off its companion, stealing matter across millions of kilometers of space.',  'rare',   'click', 22.0),
    item('Degenerate Electron','e°',   'Degenerate matter is held up not by heat but by a quantum rule forbidding electrons from sharing a state — it resists even at absolute zero.',   'rare',   'crit',  0.8, true),
    item('White Dwarf',        'WD',   'A white dwarf packs roughly the Sun\'s mass into an Earth-sized sphere — a sugar-cube of it would weigh about a ton.',  'rare',   'auto_mult',  3.0),
    item('Neutron Star',       'NS',   'A neutron star squeezes more than the Sun\'s mass into a city-sized ball — one teaspoon would outweigh all of humanity combined.', 'epic',   'auto',  7.0),
    item('Nova Eruption',      'NOVA', 'A white dwarf detonating a stolen layer of hydrogen in a surface thermonuclear blast — brightening tens of thousands of times, again and again.',       'epic', 'crit', 2.5, true),
    item('Magnetar',           '⊛M',  'The universe\'s strongest magnet — one halfway to the Moon could wipe the magnetic strip off every credit card on Earth.',  'epic', 'auto_mult', 5.0),
    item('Gravitational Wave', '◌~',   'Colliding black holes ripple spacetime so faintly that detecting them meant measuring a 4-km arm by a thousandth of a proton\'s width.',   'epic', 'click', 35.0),
    item('Type Ia Supernova',  'SNIa', 'A white dwarf always detonates at the same critical mass, so these explode with near-identical brightness — "standard candles" that revealed dark energy.','legendary','multiplier',50.0),
    item('Core Collapse SN',   'SNII', 'When a massive star\'s iron core collapses, its outer layers crash in and rebound in seconds — releasing 99% of the energy as near-invisible neutrinos.',     'legendary','auto',12.0),
    // P3 pyramid padding (append-only) — themed commons + 1 rare → 10C:5R.
    item('Subgiant Branch',    '↗★',  'A star\'s brief midlife crisis — hydrogen runs out in the core and the star begins swelling toward red-giant size.', 'common', 'auto', 2.0),
    item('Dredge-Up',          '↑C',   'A dying star\'s churning convection hauls freshly forged elements like carbon from its deep interior up to the surface.', 'common', 'click', 15.0),
    item('Thermal Pulse',      '⚡↻',  'Late-life stars suffer periodic "thermal pulses" — shell-helium flashes that make them belch and shudder every tens of thousands of years.',             'common', 'crit', 0.5, true),
    item('s-Process',          'n→',   'Slow neutron capture in aging stars builds about half of all elements heavier than iron — including barium, lead, and some of the gold.',       'common', 'auto_mult', 2.0),
    item('Electron Degeneracy','e⊥',   'A purely quantum push from the exclusion principle, not heat — so it holds up a white dwarf and never cools away.',       'common', 'auto', 2.0),
    item('Chandrasekhar Limit','1.4M☉','Above ~1.4 Suns the electrons hit light speed and degeneracy fails — so no white dwarf can ever exceed it without exploding or collapsing.',        'common', 'click', 15.0),
    item('Carbon Detonation',  'C💥',  'A white dwarf pushed to its limit ignites its carbon all at once — a runaway detonation that unbinds the entire star in seconds.',          'rare', 'click', 22.0),
  ]),

  // ── Stage 13: Stelliferous End (4C + 4R + 4E + 2L) ─────────────────────────
  ...stage(13, [
    item('Brown Dwarf',          '🟫',  'A "failed star" — too small to ignite hydrogen, so it never truly shines and just slowly fades for trillions of years.',  'common', 'auto',  1.5),
    item('Cold Gas Remnant',     '~H',  'As star formation winds down, galaxies are left with cold leftover gas too thin and chilled to ever collapse into new stars.',  'common', 'click', 15.0),
    item('Cooling White Dwarf',  'WD↓', 'A white dwarf has no fuel left — it simply radiates away its leftover heat, taking many billions of years to fade to black.',    'common', 'crit',  0.4, true),
    item('Stellar Graveyard',    '⬜',  'The far-future galaxy becomes a "stellar graveyard," populated only by white dwarfs, neutron stars, and black holes.',  'common', 'auto_mult',  3.0),
    item('Galaxy Halo Dispersal','○○', 'Over immense spans of time, gravitational encounters fling most stars out of their galaxies entirely, scattering them into the dark.',    'rare', 'click', 22.0),
    item('Gravitational Slingshot','↗', 'In a close three-body encounter one star is flung off at high speed while another sinks inward — the slingshot that powers real spacecraft too.',   'rare', 'crit', 1.0, true),
    item('Pulsar',               '⊛~', 'A spinning neutron star sweeping radiation beams like a lighthouse — some spin hundreds of times a second, steadier than an atomic clock.','rare', 'auto', 4.0),
    item('Black Dwarf',          '●°', 'A fully cooled, dark white dwarf — but the universe is far too young for even one to exist yet; the first won\'t form for trillions of years.',  'rare',   'auto_mult',  3.0),
    item('Iron Star',            'Fe★','Given perhaps 10^1500 years, quantum tunneling would slowly fuse and fission all matter into iron — turning cold stellar corpses into iron stars.', 'epic',   'auto',  8.0),
    item('Binary BH Merger',     '⚫⚫','When two black holes merge, the collision can briefly radiate more power, as pure gravitational waves, than all the stars in the observable universe.', 'epic',   'click', 35.0),
    withAliases(
      item('Relic Supermassive BH','⚫³','Long after the last stars die, the giant black holes at galactic centers remain — relics that will outlive nearly everything else.',   'epic',   'crit',  3.0, true),
      ['s13_11_supermassive_bh'],
    ),
    item('Stellar Mass BH',      '⚫', 'Forms when a massive star\'s core collapses past the neutron-star stage, packing several Suns into a region only kilometers across.',     'epic',   'auto_mult',  5.0),
    item('Last Red Dwarf',       '🔴✦','The lowest-mass red dwarfs burn so frugally they shine for trillions of years — the last stars still glowing long after Sun-like stars are gone.',    'legendary','multiplier',50.0),
    item('Total Darkness',       '░',  'Once the final red dwarfs flicker out, the universe enters true darkness — no stars shining anywhere, only cooling embers and black holes.',     'legendary','auto_mult',8.0),
    // P3 pyramid padding (append-only) — themed commons + 1 rare → 10C:5R.
    item('Red Dwarf',            '🔴·','The universe\'s marathon runners — so dim and efficient one could keep burning for up to ten trillion years, a thousand times the Sun\'s lifespan.','common', 'auto', 2.0),
    item('Degenerate Remnant',   '◇',  'White dwarfs and neutron stars are stars held up by quantum pressure alone — the cold corpses left when fusion ends.',            'common', 'click', 15.0),
    item('Last Star Formation',  '★↓', 'Astronomers estimate the universe runs out of star-forming gas in roughly 100 trillion years, after which no new stars are ever born.',           'common', 'crit', 0.5, true),
    item('Halo Star Stream',     '∿∿', 'Stars torn from shredded dwarf galaxies trail through the galactic halo as long "stellar streams" — fossil trails of ancient cannibalism.',      'common', 'auto_mult', 2.0),
    item('WD Crystallization',   '◆',  'As a white dwarf cools, its carbon-oxygen core literally crystallizes from the inside out — becoming, in effect, a star-sized cosmic diamond.',   'common', 'auto', 2.0),
    item('Merger Remnant',       '⊗°', 'When two compact stars merge, the leftover object can forge heavy elements like gold and platinum in the debris.',          'common', 'click', 15.0),
    item('Millisecond Pulsar',   '⊛⊛', 'Spun up to hundreds of rotations a second by stealing matter from a companion — its surface whirling at a sizable fraction of light speed.',        'rare', 'click', 22.0),
  ]),

  // ── Stage 14: Degenerate Era (4C + 4R + 4E + 2L) ───────────────────────────
  ...stage(14, [
    item('Decay Positron',            'e⁺',  'Positrons are spat out in radioactive decays — ordinary bananas emit a few every hour from their potassium-40.',              'common', 'click', 15.0),
    item('Pion Decay',                'π⁰',  'Pions are the most fleeting particles of all — a neutral pion lives less than a quadrillionth of a second before vanishing into gamma rays.',      'common', 'auto', 2.0),
    item('Decay Neutrino',            'ν',   'Neutrinos pour out of nuclear decays and ghost through everything — trillions pass through your body every second without touching a thing.',       'common', 'crit',  0.4, true),
    item('Proton Decay',              'p→',  'Some theories predict even the proton decays, with a half-life over 10^34 years — so long that decades of watching water tanks have caught none.',   'common', 'auto_mult',  2.0),
    item('Diamond Star',              '💎★', 'A crystallized white dwarf is essentially a planet-sized diamond — one found near Earth is nicknamed "Lucy" after the Beatles song.',      'rare',   'auto',  4.0),
    item('GW Echo',                   '◌·',  'Some quantum-gravity ideas predict faint "echoes" of gravitational waves bouncing near a horizon — a hint of physics beyond Einstein.',    'rare', 'auto_mult', 3.0),
    withAliases(
      item('Higgs Boson',               'H',   'Scalar excitation of the Higgs field that gives particles their mass through symmetry breaking.', 'rare', 'click', 22.0),
      ['s14_07_quantum_tunneling'],
    ),
    item('Relic Neutrino Background', 'νBG', 'The universe\'s oldest light — these relic neutrinos broke free just one second after the Big Bang, far earlier than the microwave background\'s 380,000 years.',              'rare', 'crit', 1.5, true),
    withAliases(
      item('Z Boson',                   'Z⁰',  'Neutral weak gauge boson — the chargeless partner of the W that mediates the weak force.', 'epic', 'click', 35.0),
      ['s14_09_gut_monopole_decay'],
    ),
    item('Positronium Atom',          'Ps',  'A fleeting "atom" of an electron orbiting its own antimatter twin — they circle briefly, then annihilate into gamma rays in billionths of a second.',     'epic', 'auto', 7.0),
    item('Dark Matter Annihilation',  'DM⊕', 'If dark matter is its own antiparticle, two could collide and annihilate into normal particles — a glow physicists hunt for at the galaxy\'s center.',    'epic', 'auto_mult', 5.0),
    item('BH Domination',             '⚫>', 'In the Degenerate Era\'s twilight, after stars and even protons fade, black holes inherit the universe as the dominant surviving objects.',       'epic', 'crit', 3.0, true),
    item('Last Baryon',               'p_∞', 'If protons decay, then in the deep future the universe\'s very last baryon — its last atom of ordinary matter — will simply dissolve.',     'legendary','multiplier',50.0),
    item('Baryon Washout',            'B=0', '"Washout" is when baryon-number-violating reactions erase a built-up matter surplus — tied to why anything survived the Big Bang at all.',      'legendary','auto',12.0),
    // P3 pyramid padding (append-only) — themed commons + 1 rare → 10C:5R.
    item('Baryon Half-Life',          't½',  'The proton\'s half-life, if it decays at all, exceeds 10^34 years — over a trillion trillion times the present age of the universe.',          'common', 'auto', 2.0),
    item('Decay Photon',              'γ_d', 'Many particle decays end in photons — the patient decay of matter across eons slowly bleeds the universe into faint, scattered light.',       'common', 'click', 15.0),
    item('Grand Unification Relic',   'X',   'Grand unified theories predict relics from when the strong, weak, and electromagnetic forces were one — including monopoles never yet found.',      'common', 'crit', 0.5, true),
    item('Sphaleron',                 '⊘',   'A Standard Model process that converts quarks into leptons and rewrites baryon number — common in the hot early universe, but never seen in a collider.',     'common', 'auto_mult', 2.0),
    item('Cold Degenerate Gas',       'e°°', 'In the far future, matter settles into cold degenerate gas held up only by quantum pressure — colder and stiller than anything today.',  'common', 'auto', 2.0),
    item('Hawking Preheat',           '⚫·', 'As the cosmos empties, the faint warmth of Hawking radiation from black holes becomes one of the last meaningful sources of heat.',      'common', 'click', 15.0),
    item('Muonium',                   'Mu',  'An exotic atom — an electron orbiting a muon instead of a proton — that exists only about two millionths of a second before the muon decays.',       'rare', 'click', 22.0),
  ]),

  // ── Stage 15: Black Hole Era (4C + 4R + 4E + 2L) ───────────────────────────
  ...stage(15, [
    item('Hawking Photon',         'Hγ',    'Hawking radiation lets black holes slowly evaporate — but a Sun-mass one is colder than deep space, glowing at billionths of a degree above absolute zero.',      'common', 'click', 15.0),
    item('Virtual Particle Pair',  '±ℏ',   'Empty space constantly froths with virtual particle pairs popping in and out of existence — borrowing energy for an instant, as quantum uncertainty allows.',    'common', 'crit', 0.6, true),
    item('Ergosphere',             'Erg',   'A region around a spinning black hole where space itself is dragged so hard nothing can stand still — everything is forced to rotate with the hole.',    'common', 'auto', 3.0),
    item('Event Horizon',          'EH',    'The point of no return — cross it and not even light escapes, and from outside you\'d appear frozen there forever, reddening as you fade.',        'common', 'auto_mult',  2.0),
    item('Penrose Process',        'Ω→',   'Extracts energy from a spinning black hole\'s rotation — in principle harvesting up to 29% of its entire mass as usable energy.',       'rare',   'auto',  5.0),
    item('BH Merger Wave',         '⚫+⚫', 'A merger sends a gravitational-wave "chirp" rising in pitch — and for a fraction of a second outshines the entire universe in gravitational power.',        'rare',   'click', 22.0),
    item('BH Entropy',             'S=A/4','A black hole\'s entropy is written on its surface, not its volume — and one supermassive hole holds more than all ordinary matter in the visible universe.',          'rare',   'crit',  1.5, true),
    item('Stellar BH Evaporation', '⚫→',  'A stellar-mass black hole takes around 10^67 years to fully evaporate via Hawking radiation — astronomically longer than the universe\'s age.',  'rare',   'auto_mult',  4.0),
    item('Supermassive Evaporation','⚫⚫→','A galaxy-core black hole would take roughly 10^100 years — a "googol" of years — to evaporate, the longest-lived objects in cosmic history.',  'epic', 'crit', 3.0, true),
    item('Firewall',               '🔥EH', 'The "firewall" paradox suggests an infalling astronaut might hit a wall of high-energy particles at the horizon — clashing with Einstein\'s smooth crossing.',   'epic',   'click', 35.0),
    item('Information Paradox',    '?⚫',  'Where does information go when a black hole evaporates? Physics says it can\'t be destroyed, yet Hawking radiation seemed to erase it.',        'epic', 'auto_mult', 6.0),
    item('Planck Remnant',         'ℓP',   'Some theories say evaporation halts at a tiny "Planck remnant" — a stable speck near the smallest meaningful size, perhaps hoarding lost information.',  'epic', 'auto', 9.0),
    item('Final Evaporation Flash','☀→∅', 'A black hole\'s death is explosive — as it shrinks it gets hotter and brighter, ending in a final burst of high-energy radiation in its last instant.',      'legendary','multiplier',50.0),
    item('Last Black Hole',        '⚫_',  'The biggest black holes evaporate last — the final one may vanish around 10^100 years from now, marking the true end of structured matter.', 'legendary','auto_mult',8.0),
    // P3 pyramid padding (append-only) — themed commons + 1 rare → 10C:5R.
    item('Hawking Temperature',    'T_H',  'A black hole\'s temperature runs backwards from intuition — the bigger it is, the colder it glows, so giants are nearly frozen while tiny ones blaze.',    'common', 'auto', 2.0),
    item('Unruh Radiation',        'U',    'The Unruh effect predicts that simply accelerating through empty space makes the vacuum appear warm — there\'s no truly "cold" emptiness to an accelerating observer.',       'common', 'click', 15.0),
    item('Page Time',              't_P',  'The "Page time" is the moment a black hole has radiated away half its mass — the turning point when its lost information is thought to start leaking back out.',  'common', 'crit', 0.5, true),
    item('Frame Dragging',         '⟲sp',  'A spinning mass drags spacetime around with it like honey on a stirred spoon — an effect measured around the spinning Earth by orbiting gyroscopes.',        'common', 'auto_mult', 2.0),
    item('Greybody Factor',        'g_b',  'A black hole isn\'t a perfect radiator — "greybody factors" describe how its gravity filters the Hawking radiation trying to escape, reshaping its glow.',    'common', 'auto', 2.0),
    item('Curvature Singularity',  'R→∞',  'At a black hole\'s center lies a point where spacetime curvature becomes infinite and the known laws of physics break down entirely.',         'common', 'click', 15.0),
    item('Quasi-normal Ringdown',  '◌≈',   'After a merger, the newborn black hole "rings" like a struck bell, settling down in a few characteristic gravitational-wave tones.',  'rare', 'click', 22.0),
  ]),

  // ── Stage 16: The End (4C + 3R + 2E + 5L endings) ──────────────────────────
  ...stage(16, [
    withAliases(
      item('Tau',                      'τ',    'The heaviest charged lepton — a third-generation electron sibling that decays almost instantly.', 'common', 'click', 15.0),
      ['s16_01_relic_electron'],
    ),
    item('Lone Photon',              'γ',     'In the universe\'s final state, light spreads so thin that lone photons drift through emptiness, perhaps light-years apart, never to meet anything again.','common', 'auto', 2.0),
    item('Relic Positron',           'e⁺∞',  'Stray positrons — survivors of matter\'s ancient near-perfect annihilation with antimatter — linger as some of the last particles in the void.',         'common', 'crit',  0.5, true),
    withAliases(
      item('Tau Neutrino',             'ντ',   'Third-generation neutrino paired with the tau — nearly massless and weakly interacting.', 'common', 'auto_mult',  2.0),
      ['s16_04_relic_neutrino'],
    ),
    item('Cosmic Background Photon', 'CBG',  'The Big Bang\'s afterglow — its photons have traveled 13.8 billion years, and they make up a small fraction of the static on an old untuned TV.',      'rare', 'click', 22.0),
    item('Thermal Equilibrium',      'ΔT→0', 'Heat death is total thermal equilibrium — everything reaches the same temperature, so no energy can ever flow or do work again.',    'rare', 'auto', 3.0),
    item('Max Entropy',              'S_max','The universe\'s final, featureless state — perfectly disordered, with no usable energy left and no events possible.',    'rare',   'auto_mult',  1.5),
    item('De Sitter Vacuum',         'Λ∞',   'If dark energy is constant, the universe drifts toward an empty, exponentially expanding de Sitter state — cold, dark, and eternally stretching.',  'epic', 'auto_mult', 3.0),
    item('Quantum Fluctuation Final','δE∞',  'Even in a "dead" vacuum, quantum fluctuations never fully cease — random ripples persist, the last flickers of activity in an empty cosmos.',    'epic', 'auto', 8.0),
    // Ending legendaries — each aligned to one universe fate (all multiplier)
    item('Thermal Death',            'ΔS=0', 'The "heat death" (or Big Freeze) is the leading prediction — the universe expands and cools forever toward absolute zero, all structure long faded.',     'legendary','multiplier',50.0, false, 'heat_death'),
    item('Dark Energy Spike',        'Λ↑',   'In the Big Rip, dark energy grows so strong it tears apart galaxies, then stars, then planets, then atoms — the fabric of space itself ripping at the end.',   'legendary','multiplier',50.0, false, 'big_rip'),
    item('Gravitational Singularity','ρ→∞',  'In the Big Crunch, cosmic expansion reverses and everything collapses back together, ending in a single hot singularity — the Big Bang run in reverse.',            'legendary','multiplier',50.0, false, 'big_crunch'),
    item('True Vacuum Bubble',       '◉→',   'If our vacuum is only "false," a bubble of true vacuum could nucleate and expand at light speed, rewriting physics and erasing everything with no warning.',   'legendary','multiplier',50.0, false, 'vacuum_decay'),
    item('Quantum Bounce',           '⟳',   'In bounce models the universe never truly ends — a collapse "bounces" into a new Big Bang, so the cosmos may cycle through endless births and deaths.',     'legendary','multiplier',50.0, false, 'bounce'),
  ]),

  // ── Stage 17: Mythic (fusion-only pool — NON-PLAYABLE bucket) ────────────────
  // These never drop and can never be bought (RARITY_STAGE_GATES.mythic = 999);
  // the ONLY source is fusing three legendaries (FUSION_UP1_CHANCE_BY_TIER.
  // legendary). Stage 17 is not in STAGES, so it never appears in the shop or on
  // the canvas — mythics surface only via fusion, the equip screen, and the
  // codex (Mythic set). Append-only: never reorder these (codex refs positions).
  ...stage(17, [
    { ...item('Singularity Core',  '●',    'The infinitely dense heart where spacetime itself folds shut.',           'mythic', 'click',     20.0),
      nameKo: '특이점 핵',    descriptionKo: '시공간이 스스로 닫혀 무한히 응축되는 핵심.' },
    { ...item('Zero-Point Field',  '⟨0|0⟩','The vacuum’s irreducible energy, humming beneath all of reality.',  'mythic', 'auto',      12.0),
      nameKo: '영점장',       descriptionKo: '모든 실재 아래에서 진동하는, 진공의 줄일 수 없는 에너지.' },
    { ...item('Quantum Foam',      '∿',    'Spacetime frothing at the Planck scale, where certainty dissolves.',      'mythic', 'crit',       1.5, true),
      nameKo: '양자 거품',    descriptionKo: '플랑크 척도에서 들끓는 시공간, 확실성이 녹아내리는 곳.' },
    { ...item('Multiverse Seed',   '✶',    'A bud of inflation ready to bloom into a universe of its own.',           'mythic', 'auto_mult',  6.0),
      nameKo: '다중우주의 씨앗', descriptionKo: '스스로 하나의 우주로 피어날, 인플레이션의 씨눈.' },
    { ...item('Cosmic String',     '|',    'A one-dimensional flaw in spacetime, taut with primordial energy.',       'mythic', 'click',     18.0),
      nameKo: '우주 끈',      descriptionKo: '원시 에너지로 팽팽히 당겨진, 시공간의 1차원 결함.' },
  ]),
];

export function getEntitiesForStage(stageId: number): StageEntity[] {
  return STAGE_ENTITIES.filter((e) => e.stageId === stageId);
}

export function entityMatchesId(entity: StageEntity, entityId: string): boolean {
  return entity.id === entityId || entity.aliases?.includes(entityId) === true;
}

// Overhaul-3 P5: module-load lookup indices. findEntityById is called per
// inventory entry + per equipped slot inside getActiveModifiers (~20×/sec); the
// old O(291) scan was the dominant idle-jank source. CANONICAL wins over ALIAS
// globally (first-seen in array order, matching the prior .find() semantics) so
// a later entity's canonical id can't be eaten by an earlier entity's alias.
const CANONICAL_BY_ID: Map<string, StageEntity> = (() => {
  const m = new Map<string, StageEntity>();
  for (const e of STAGE_ENTITIES) if (!m.has(e.id)) m.set(e.id, e);
  return m;
})();
const ALIAS_BY_ID: Map<string, StageEntity> = (() => {
  const m = new Map<string, StageEntity>();
  for (const e of STAGE_ENTITIES) for (const a of e.aliases ?? []) if (!m.has(a)) m.set(a, e);
  return m;
})();

export function findEntityById(entityId: string, stageId?: number): StageEntity | undefined {
  // Stage-scoped path (rarer; keeps the canonical-before-alias scan within stage).
  if (stageId !== undefined) {
    const candidates = STAGE_ENTITIES.filter((entity) => entity.stageId === stageId);
    return (
      candidates.find((entity) => entity.id === entityId) ??
      candidates.find((entity) => entity.aliases?.includes(entityId) === true)
    );
  }
  // Hot path: O(1) canonical-then-alias lookup.
  return CANONICAL_BY_ID.get(entityId) ?? ALIAS_BY_ID.get(entityId);
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
