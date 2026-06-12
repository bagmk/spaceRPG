/**
 * Codex collection sets (도감 재미 패스 v2 — nested sets + completion rewards).
 *
 * The Codex is organised into evocative real-science collections that span all
 * stages. Each top-level set holds sub-collections (e.g. Standard Model → Quarks
 * / Leptons / Bosons / Fields). Completing a sub-collection grants a permanent
 * modifier bonus; completing every sub-collection of a set grants a larger set
 * bonus. Collecting matters mechanically, not just for show.
 *
 * Membership is by glyph (= family) or by stage id, so it's deterministic and
 * needs no per-entity data. Collections may overlap (e.g. the Genesis tutorial
 * set shares the 3 stage-1 entities with their families).
 *
 * Reward values live here as plain percentages; they feed modifier fields via
 * applyCollectionRewards (entities/effects.ts wires it into getActiveModifiers).
 */

import type { EntityGlyph, StageEntity } from './types';
import type { Lang } from '../../i18n';

export type CodexRewardStat =
  | 'clickPower'
  | 'critChance'
  | 'critMult'
  | 'autoPower'
  | 'dropRate'
  | 'entropyGain'
  | 'offline';

export interface CodexReward {
  stat: CodexRewardStat;
  /** Percent (critChance is added as flat percentage points / 100). */
  value: number;
}

export interface CodexSubset {
  id: string;
  label: { en: string; ko: string };
  /**
   * Membership rule. `entityIds` is an explicit curated roster (used for the
   * Standard Model / Periodic Table, where we want the exact real-science set
   * rather than whatever a glyph happens to sweep in). `glyphs` / `stageIds`
   * are the loose thematic matchers for the broader sets.
   */
  match: { entityIds?: string[]; glyphs?: EntityGlyph[]; stageIds?: number[] };
  reward: CodexReward;
}

export interface CodexSet {
  id: string;
  label: { en: string; ko: string };
  blurb: { en: string; ko: string };
  icon: string;
  accent: string;
  subsets: CodexSubset[];
  /** Granted when every subset of this set is complete. */
  reward: CodexReward;
}

export const CODEX_SETS: CodexSet[] = [
  {
    id: 'genesis',
    label: { en: 'Genesis', ko: '태초' },
    blurb: { en: 'The first instants — before everything', ko: '모든 것 이전, 첫 순간' },
    icon: '✦',
    accent: '#ff9d5c',
    reward: { stat: 'dropRate', value: 8 },
    subsets: [
      {
        id: 'first_light',
        label: { en: 'First Light', ko: '최초의 빛' },
        match: { stageIds: [1] },
        reward: { stat: 'dropRate', value: 6 },
      },
    ],
  },
  {
    id: 'standard_model',
    label: { en: 'Standard Model', ko: '표준 모형' },
    blurb: { en: 'The fundamental particles of reality', ko: '실재를 이루는 근본 입자들' },
    icon: '⚛',
    accent: '#7c8cff',
    reward: { stat: 'clickPower', value: 15 },
    subsets: [
      // Curated to the real Standard Model roster (explicit ids), so the codex
      // shows the genuine particle set instead of whatever a glyph sweeps in.
      // Quarks: up · down · strange · charm · bottom · top.
      { id: 'quarks', label: { en: 'Quarks', ko: '쿼크' }, match: { entityIds: ['s2_01', 's2_02', 's2_06', 's3_06', 's3_08', 's3_10'] }, reward: { stat: 'clickPower', value: 8 } },
      // Leptons present in the lepton epoch: electron, electron neutrino, muon, muon neutrino.
      { id: 'leptons', label: { en: 'Leptons', ko: '경입자' }, match: { entityIds: ['s2_03', 's2_04', 's3_04', 's4_11'] }, reward: { stat: 'critChance', value: 3 } },
      // Bosons (integer spin): gluon, W, photon + the residual-force mesons pion & kaon.
      { id: 'bosons', label: { en: 'Bosons', ko: '보손' }, match: { entityIds: ['s2_05', 's2_07', 's4_04', 's3_03', 's3_07'] }, reward: { stat: 'autoPower', value: 8 } },
      // Fields & symmetry: CP violation, QCD phase boundary, confinement.
      { id: 'fields', label: { en: 'Fields', ko: '장(場)' }, match: { entityIds: ['s2_08', 's3_11', 's3_12'] }, reward: { stat: 'entropyGain', value: 8 } },
    ],
  },
  {
    id: 'periodic_table',
    label: { en: 'Periodic Table', ko: '주기율표' },
    blurb: { en: 'Nuclei and the elements they build', ko: '핵과 그것이 빚는 원소들' },
    icon: '🧪',
    accent: '#ffb45a',
    reward: { stat: 'autoPower', value: 12 },
    subsets: [
      { id: 'nuclei', label: { en: 'Nuclei', ko: '원자핵' }, match: { glyphs: ['nucleus'] }, reward: { stat: 'autoPower', value: 8 } },
      { id: 'atoms', label: { en: 'Atoms', ko: '원자' }, match: { glyphs: ['atom'] }, reward: { stat: 'dropRate', value: 6 } },
      { id: 'molecules', label: { en: 'Molecules', ko: '분자' }, match: { glyphs: ['molecule'] }, reward: { stat: 'autoPower', value: 5 } },
    ],
  },
  {
    id: 'stellar_forge',
    label: { en: 'Stellar Forge', ko: '항성의 용광로' },
    blurb: { en: 'Stars, their fire, and their ashes', ko: '별과 그 불꽃, 그리고 잔해' },
    icon: '★',
    accent: '#ff8a47',
    reward: { stat: 'autoPower', value: 14 },
    subsets: [
      { id: 'stars', label: { en: 'Living Stars', ko: '항성' }, match: { glyphs: ['star', 'plasma', 'radiation', 'accretion'] }, reward: { stat: 'autoPower', value: 10 } },
      { id: 'stellar_death', label: { en: 'Stellar Death', ko: '별의 죽음' }, match: { glyphs: ['supernova', 'envelope', 'nebula'] }, reward: { stat: 'critMult', value: 6 } },
      { id: 'remnants', label: { en: 'Remnants', ko: '잔해' }, match: { glyphs: ['remnant', 'crystal'] }, reward: { stat: 'autoPower', value: 8 } },
    ],
  },
  {
    id: 'cosmic_web',
    label: { en: 'Cosmic Web', ko: '우주 거대구조' },
    blurb: { en: 'Galaxies, dark matter, and the grand structure', ko: '은하·암흑물질·거대 구조' },
    icon: '🌌',
    accent: '#6d8fff',
    reward: { stat: 'entropyGain', value: 12 },
    subsets: [
      { id: 'gas', label: { en: 'Gas & Waves', ko: '가스·파동' }, match: { glyphs: ['cloud', 'wave'] }, reward: { stat: 'dropRate', value: 6 } },
      { id: 'dark_matter', label: { en: 'Dark Matter', ko: '암흑물질' }, match: { glyphs: ['halo'] }, reward: { stat: 'offline', value: 12 } },
      { id: 'galaxies', label: { en: 'Galaxies', ko: '은하' }, match: { glyphs: ['galaxy'] }, reward: { stat: 'entropyGain', value: 8 } },
    ],
  },
  {
    id: 'living_worlds',
    label: { en: 'Living Worlds', ko: '생명의 세계' },
    blurb: { en: 'Planets, oceans, and the spark of life', ko: '행성·바다·생명의 불씨' },
    icon: '🌍',
    accent: '#68d8a4',
    reward: { stat: 'critChance', value: 4 },
    subsets: [
      { id: 'worlds', label: { en: 'Worlds', ko: '세계' }, match: { glyphs: ['planet', 'water'] }, reward: { stat: 'autoPower', value: 8 } },
      { id: 'life', label: { en: 'Life', ko: '생명' }, match: { glyphs: ['life', 'cell', 'dna', 'neuron'] }, reward: { stat: 'critChance', value: 5 } },
    ],
  },
  {
    id: 'the_end',
    label: { en: 'The End', ko: '종말' },
    blurb: { en: 'Black holes, the void, and what comes after', ko: '블랙홀·공허·그 너머' },
    icon: '🕳',
    accent: '#bb8cff',
    reward: { stat: 'entropyGain', value: 15 },
    subsets: [
      { id: 'gravity', label: { en: 'Gravity Wells', ko: '중력 우물' }, match: { glyphs: ['black_hole', 'singularity'] }, reward: { stat: 'clickPower', value: 10 } },
      { id: 'the_void', label: { en: 'The Void', ko: '공허' }, match: { glyphs: ['void', 'entropy', 'bounce'] }, reward: { stat: 'entropyGain', value: 10 } },
    ],
  },
];

// ── Membership + completion ─────────────────────────────────────────────────

export function subsetMatches(subset: CodexSubset, entity: StageEntity): boolean {
  const { entityIds, glyphs, stageIds } = subset.match;
  if (entityIds && entityIds.includes(entity.id)) return true;
  if (glyphs && glyphs.includes(entity.visual.glyph)) return true;
  if (stageIds && stageIds.includes(entity.stageId)) return true;
  return false;
}

export function getSubsetMembers(subset: CodexSubset, allEntities: StageEntity[]): StageEntity[] {
  return allEntities.filter((e) => subsetMatches(subset, e));
}

/** Flatten almanacCollected into a single set of entity ids. */
export function collectedIdSet(almanacCollected: Record<number, string[]>): Set<string> {
  const out = new Set<string>();
  for (const ids of Object.values(almanacCollected)) for (const id of ids) out.add(id);
  return out;
}

export function isSubsetComplete(subset: CodexSubset, collected: Set<string>, allEntities: StageEntity[]): boolean {
  const members = getSubsetMembers(subset, allEntities);
  return members.length > 0 && members.every((m) => collected.has(m.id));
}

export function isSetComplete(set: CodexSet, collected: Set<string>, allEntities: StageEntity[]): boolean {
  return set.subsets.every((sub) => isSubsetComplete(sub, collected, allEntities));
}

// ── Labels ──────────────────────────────────────────────────────────────────

export function codexSetLabel(set: CodexSet, lang: Lang): string {
  return set.label[lang];
}
export function codexSetBlurb(set: CodexSet, lang: Lang): string {
  return set.blurb[lang];
}
export function codexSubsetLabel(sub: CodexSubset, lang: Lang): string {
  return sub.label[lang];
}

const REWARD_STAT_LABEL: Record<CodexRewardStat, { en: string; ko: string }> = {
  clickPower: { en: 'Click Power', ko: '클릭 파워' },
  critChance: { en: 'Crit Chance', ko: '치명 확률' },
  critMult: { en: 'Crit Power', ko: '치명 배율' },
  autoPower: { en: 'Auto Power', ko: '오토 파워' },
  dropRate: { en: 'Drop Rate', ko: '드랍 확률' },
  entropyGain: { en: 'Entropy Gain', ko: '엔트로피 획득' },
  offline: { en: 'Offline Gain', ko: '오프라인 획득' },
};

/** "+8% Click Power" / "+3%p Crit Chance" — crit chance is flat percentage points. */
export function codexRewardLabel(reward: CodexReward, lang: Lang): string {
  const unit = reward.stat === 'critChance' ? '%p' : '%';
  return `+${reward.value}${unit} ${REWARD_STAT_LABEL[reward.stat][lang]}`;
}

/** Which top-level set an entity belongs to (first matching set). */
export function getCodexSetForEntity(entity: StageEntity): CodexSet {
  for (const set of CODEX_SETS) {
    if (set.id === 'genesis') continue; // Genesis overlaps; don't claim entities from families
    if (set.subsets.some((sub) => subsetMatches(sub, entity))) return set;
  }
  return CODEX_SETS[CODEX_SETS.length - 1];
}
