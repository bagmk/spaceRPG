/**
 * Entity families (정체성 패스).
 *
 * The glyph is the family key (also the set-bonus key). Each family carries a
 * thematic identity — a name + a one-line gameplay role — so the player can
 * read "this is a Pulsar-type, it drives Auto" straight off the card. The
 * effect data is assigned to match these roles (see stageItems.ts).
 *
 * Pure presentation data: no balance numbers here.
 */

import type { EntityGlyph } from './types';
import type { Lang } from '../../i18n';

interface FamilyIdentity {
  /** Family display name. */
  label: { en: string; ko: string };
  /** One-line gameplay identity. */
  role: { en: string; ko: string };
}

/** Default for any glyph without an explicit identity. */
const DEFAULT_FAMILY: FamilyIdentity = {
  label: { en: 'Cosmic Matter', ko: '우주 물질' },
  role: { en: 'General-purpose gear', ko: '범용 장비' },
};

export const ENTITY_FAMILIES: Partial<Record<EntityGlyph, FamilyIdentity>> = {
  // ── Engines: steady auto income ──
  star:      { label: { en: 'Star', ko: '항성' }, role: { en: 'Steady auto engine', ko: '꾸준한 오토 엔진' } },
  nebula:    { label: { en: 'Nebula', ko: '성운' }, role: { en: 'Diffuse auto bloom', ko: '확산형 오토' } },
  envelope:  { label: { en: 'Stellar Envelope', ko: '항성 외피' }, role: { en: 'Swelling auto output', ko: '팽창하는 오토' } },
  accretion: { label: { en: 'Accretion', ko: '강착' }, role: { en: 'Inflowing auto + click', ko: '유입 오토·클릭' } },
  molecule:  { label: { en: 'Molecular Cloud', ko: '분자운' }, role: { en: 'Cold auto fuel', ko: '냉각 오토 연료' } },
  atom:      { label: { en: 'Atom', ko: '원자' }, role: { en: 'Stable auto base', ko: '안정 오토 기반' } },
  cloud:     { label: { en: 'Gas Cloud', ko: '가스운' }, role: { en: 'Slow auto / time', ko: '느린 오토·시간' } },
  water:     { label: { en: 'Water World', ko: '물의 세계' }, role: { en: 'Life-bearing auto', ko: '생명의 오토' } },
  planet:    { label: { en: 'World', ko: '행성' }, role: { en: 'Orbital auto / time', ko: '궤도 오토·시간' } },

  // ── Remnants: dim rhythmic auto (Pulsar identity) ──
  remnant:   { label: { en: 'Remnant', ko: '잔해' }, role: { en: 'Pulsing auto burst', ko: '맥동 오토 버스트' } },
  crystal:   { label: { en: 'Crystal Star', ko: '결정성' }, role: { en: 'Frozen auto lattice', ko: '결정화 오토' } },

  // ── Particles: fast clicks / multi-hit (Quark identity) ──
  quark:     { label: { en: 'Quark', ko: '쿼크' }, role: { en: 'Rapid click hits', ko: '빠른 클릭 연타' } },
  lepton:    { label: { en: 'Lepton', ko: '경입자' }, role: { en: 'Light click + crit', ko: '경량 클릭·치명' } },
  meson:     { label: { en: 'Meson', ko: '중간자' }, role: { en: 'Bound click + crit', ko: '결합 클릭·치명' } },
  boson:     { label: { en: 'Boson', ko: '보손' }, role: { en: 'Force-carrier click', ko: '매개 클릭' } },
  particle:  { label: { en: 'Particle', ko: '입자' }, role: { en: 'Pure click power', ko: '순수 클릭력' } },
  quantum:   { label: { en: 'Quantum', ko: '양자' }, role: { en: 'Uncertain click + crit', ko: '불확정 클릭·치명' } },

  // ── Energetic: crit / explosive (Supernova identity) ──
  supernova: { label: { en: 'Supernova', ko: '초신성' }, role: { en: 'Explosive critical', ko: '폭발 치명타' } },
  radiation: { label: { en: 'Radiation', ko: '복사' }, role: { en: 'Energetic crit burst', ko: '고에너지 치명' } },
  plasma:    { label: { en: 'Plasma', ko: '플라스마' }, role: { en: 'Hot click + crit', ko: '고온 클릭·치명' } },

  // ── Sparks of life ──
  life:      { label: { en: 'Life', ko: '생명' }, role: { en: 'Living crit spark', ko: '생명의 치명' } },
  cell:      { label: { en: 'Cell', ko: '세포' }, role: { en: 'Replicating crit', ko: '증식 치명' } },
  neuron:    { label: { en: 'Mind', ko: '정신' }, role: { en: 'Neural click + crit', ko: '신경 클릭·치명' } },

  // ── Structure: large-scale / slow (time / field) ──
  galaxy:    { label: { en: 'Galaxy', ko: '은하' }, role: { en: 'Structural time / auto', ko: '구조 시간·오토' } },
  halo:      { label: { en: 'Dark Matter', ko: '암흑물질' }, role: { en: 'Offline / entropy lean', ko: '오프라인·엔트로피' } },
  field:     { label: { en: 'Field', ko: '장(場)' }, role: { en: 'Slow field shaping', ko: '느린 장 형성' } },
  wave:      { label: { en: 'Wave', ko: '파동' }, role: { en: 'Propagating time / crit', ko: '전파 시간·치명' } },

  // ── Gravity wells: deep / accumulating (Black Hole identity) ──
  black_hole:{ label: { en: 'Black Hole', ko: '블랙홀' }, role: { en: 'Deep slow accumulation', ko: '심연의 축적' } },
  singularity:{ label: { en: 'Singularity', ko: '특이점' }, role: { en: 'Endgame all-source', ko: '종말 전방위' } },
  void:      { label: { en: 'Void', ko: '공허' }, role: { en: 'Emptiness amplifier', ko: '공허 증폭' } },

  // ── Endgame ──
  entropy:   { label: { en: 'Entropy', ko: '엔트로피' }, role: { en: 'Heat-death multiplier', ko: '열죽음 배율' } },
  bounce:    { label: { en: 'Bounce', ko: '재탄생' }, role: { en: 'Cyclic rebirth', ko: '순환 재탄생' } },
};

export function getFamily(glyph: EntityGlyph): FamilyIdentity {
  return ENTITY_FAMILIES[glyph] ?? DEFAULT_FAMILY;
}

export function familyLabel(glyph: EntityGlyph, lang: Lang): string {
  return getFamily(glyph).label[lang];
}

export function familyRole(glyph: EntityGlyph, lang: Lang): string {
  return getFamily(glyph).role[lang];
}
