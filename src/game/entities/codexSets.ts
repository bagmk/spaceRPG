/**
 * Codex collection sets (도감 재미 패스).
 *
 * The Entity Lab became a Codex — instead of dull per-stage tabs, entities are
 * grouped into evocative real-science collections that span all stages: the
 * Standard Model, the Periodic Table, the stellar forge, the cosmic web, living
 * worlds, and the end of everything. Filling a set is the "gotta collect them
 * all" hook. Membership is by glyph (= family = set key), so it's deterministic
 * and needs no per-entity data.
 *
 * Pure presentation data — no balance here.
 */

import type { EntityGlyph } from './types';
import type { Lang } from '../../i18n';

export interface CodexSet {
  id: string;
  label: { en: string; ko: string };
  blurb: { en: string; ko: string };
  /** Symbol shown on the set chip. */
  icon: string;
  accent: string;
  glyphs: EntityGlyph[];
}

export const CODEX_SETS: CodexSet[] = [
  {
    id: 'standard_model',
    label: { en: 'Standard Model', ko: '표준 모형' },
    blurb: { en: 'The fundamental particles of reality', ko: '실재를 이루는 근본 입자들' },
    icon: '⚛',
    accent: '#7c8cff',
    glyphs: ['quantum', 'field', 'quark', 'meson', 'lepton', 'boson', 'particle', 'antiparticle'],
  },
  {
    id: 'periodic_table',
    label: { en: 'Periodic Table', ko: '주기율표' },
    blurb: { en: 'Nuclei and the elements they build', ko: '핵과 그것이 빚는 원소들' },
    icon: '🧪',
    accent: '#ffb45a',
    glyphs: ['nucleus', 'atom', 'molecule'],
  },
  {
    id: 'stellar_forge',
    label: { en: 'Stellar Forge', ko: '항성의 용광로' },
    blurb: { en: 'Stars, their fire, and their ashes', ko: '별과 그 불꽃, 그리고 잔해' },
    icon: '★',
    accent: '#ff8a47',
    glyphs: ['plasma', 'radiation', 'accretion', 'star', 'supernova', 'envelope', 'nebula', 'remnant', 'crystal'],
  },
  {
    id: 'cosmic_web',
    label: { en: 'Cosmic Web', ko: '우주 거대구조' },
    blurb: { en: 'Galaxies, dark matter, and the grand structure', ko: '은하·암흑물질·거대 구조' },
    icon: '🌌',
    accent: '#6d8fff',
    glyphs: ['cloud', 'wave', 'halo', 'galaxy'],
  },
  {
    id: 'living_worlds',
    label: { en: 'Living Worlds', ko: '생명의 세계' },
    blurb: { en: 'Planets, oceans, and the spark of life', ko: '행성·바다·생명의 불씨' },
    icon: '🌍',
    accent: '#68d8a4',
    glyphs: ['planet', 'water', 'life', 'cell', 'dna', 'neuron'],
  },
  {
    id: 'the_end',
    label: { en: 'The End', ko: '종말' },
    blurb: { en: 'Black holes, the void, and what comes after', ko: '블랙홀·공허·그 너머' },
    icon: '🕳',
    accent: '#bb8cff',
    glyphs: ['black_hole', 'singularity', 'void', 'entropy', 'bounce'],
  },
];

const GLYPH_TO_SET = new Map<EntityGlyph, CodexSet>();
for (const set of CODEX_SETS) {
  for (const g of set.glyphs) GLYPH_TO_SET.set(g, set);
}

const FALLBACK_SET = CODEX_SETS[CODEX_SETS.length - 1];

export function getCodexSetForGlyph(glyph: EntityGlyph): CodexSet {
  return GLYPH_TO_SET.get(glyph) ?? FALLBACK_SET;
}

export function codexSetLabel(set: CodexSet, lang: Lang): string {
  return set.label[lang];
}

export function codexSetBlurb(set: CodexSet, lang: Lang): string {
  return set.blurb[lang];
}
