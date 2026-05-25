/**
 * Per-stage music mapping. Each of the 16 stages maps to its own track pool
 * (1-2 tracks). Pools rotate randomly between tracks; single-track pools
 * loop the same track via the rotation chain.
 *
 * Audio engine: see SoundManager.loadAndPlayChapterPool() in audio.ts.
 *
 * Curation reasoning (per stage):
 *   1  Inflation         → "Space" (The_Mountain) — main-title grand opening
 *   2  Baryogenesis      → "Space Discovery" — pulses, exploration
 *   3  QGP               → ovrsoull dark pulse — particle chaos
 *   4  Nucleosynthesis   → cinematic suspense — forging nuclei
 *   5  Recombination     → 2x drone tracks — light released
 *   6  Cosmic Dark Age   → leberch space ambient — cold, sparse
 *   7  First Stars       → leberch "Space" 3:06 — hopeful spark
 *   8  Reionization      → cinematic space ambient — universe lights up
 *   9  Galaxy Formation  → leberch "Cinematic Space" 3:58 — grand spiritual
 *  10  Solar System      → tech analytics — planet formation pulse
 *  11  Life on Earth     → Planet Earth + Concentration Peace — warm 2-track
 *  12  Death of Star     → 2x emotional uplifting piano — bittersweet swell
 *  13  Stelliferous End  → Light In The Void — dying lights
 *  14  Degenerate Era    → The Dark Void Soundscape — slow vast emptiness
 *  15  Black Hole Era    → Space Ambient (FreeMusicForVideo ★) — singularity
 *  16  The End           → Space Ambient BG (SigmaMusicArt ★) — final reverb
 *
 *   heat_death           → Dark Void — eternal cold
 *   big_crunch           → Blackhole Meditation — dense collapse
 *   big_rip              → Planet of the Lost — chaotic dark sci-fi
 *   bounce               → Uplifting Cinematic Piano — rebirth
 *   vacuum_decay         → Space Ambient (Monume) — sudden silence/ambient
 *
 *   prestige (Final)     → Amazing Grace Instrumental — closing reflection
 */
import type { EndingId } from './types';

/**
 * For backwards-compat with the older "chapter id" terminology, each stage
 * has its own chapter id `stage_NN`. Endings have their own ids. The audio
 * engine just treats these as opaque pool keys.
 */
export type MusicChapterId = `stage_${string}` | `ending_${string}` | 'prestige';

/** Map a stage id (1..16) to its pool id. */
export function getChapterForStage(stageId: number): MusicChapterId {
  const padded = String(stageId).padStart(2, '0');
  return `stage_${padded}` as MusicChapterId;
}

interface StageMeta {
  stageId: number;
  name: string;
  trackFiles: string[];
}

/**
 * Per-stage track pools. Each entry is a list of filenames under public/music/.
 * The audio engine fetches `${BASE_URL}music/${file}` and falls back to silence
 * if any file 404s.
 */
const STAGE_MUSIC: Record<number, string[]> = {
  1:  ['stage_01_1.mp3'],
  2:  ['stage_02_1.mp3'],
  3:  ['stage_03_1.mp3'],
  4:  ['stage_04_1.mp3'],
  5:  ['stage_05_1.mp3', 'stage_05_2.mp3'],
  6:  ['stage_06_1.mp3'],
  7:  ['stage_07_1.mp3'],
  8:  ['stage_08_1.mp3'],
  9:  ['stage_09_1.mp3'],
  10: ['stage_10_1.mp3'],
  11: ['stage_11_1.mp3', 'stage_11_2.mp3'],
  12: ['stage_12_1.mp3', 'stage_12_2.mp3'],
  13: ['stage_13_1.mp3'],
  14: ['stage_14_1.mp3'],
  15: ['stage_15_1.mp3'],
  16: ['stage_16_1.mp3'],
};

export const STAGE_NAMES: Record<number, string> = {
  1: 'Inflation',
  2: 'Baryogenesis',
  3: 'Quark-Gluon Plasma',
  4: 'Nucleosynthesis',
  5: 'Recombination',
  6: 'Cosmic Dark Age',
  7: 'First Stars',
  8: 'Reionization',
  9: 'Galaxy Formation',
  10: 'Solar System',
  11: 'Life on Earth',
  12: 'Death of Star',
  13: 'Stelliferous End',
  14: 'Degenerate Era',
  15: 'Black Hole Era',
  16: 'The End',
};

export const STAGE_METADATA: Record<number, StageMeta> = Object.fromEntries(
  Object.entries(STAGE_MUSIC).map(([id, files]) => [
    Number(id),
    { stageId: Number(id), name: STAGE_NAMES[Number(id)] ?? `Stage ${id}`, trackFiles: files },
  ]),
) as Record<number, StageMeta>;

/** Public URLs for a stage's track pool. Vite serves `public/` at root. */
export function getChapterTrackUrls(chapter: MusicChapterId): string[] {
  const base = import.meta.env.BASE_URL ?? '/';
  // Stage chapter
  const stageMatch = /^stage_(\d+)$/.exec(chapter);
  if (stageMatch) {
    const id = Number(stageMatch[1]);
    return (STAGE_MUSIC[id] ?? []).map((f) => `${base}music/${f}`);
  }
  // Ending chapter
  const endingMatch = /^ending_(.+)$/.exec(chapter);
  if (endingMatch) {
    const eid = endingMatch[1] as EndingId;
    return (ENDING_TRACK_FILES[eid] ?? []).map((f) => `${base}music/${f}`);
  }
  // Prestige / final
  if (chapter === 'prestige') {
    return PRESTIGE_TRACK_FILES.map((f) => `${base}music/${f}`);
  }
  return [];
}

// ── Ending music ─────────────────────────────────────────────────────────

export const ENDING_TRACK_FILES: Record<EndingId, string[]> = {
  heat_death: ['ending_heat_death_1.mp3'],
  big_crunch: ['ending_big_crunch_1.mp3'],
  big_rip: ['ending_big_rip_1.mp3'],
  bounce: ['ending_bounce_1.mp3'],
  vacuum_decay: ['ending_vacuum_decay_1.mp3'],
};

export function getEndingChapterId(endingId: EndingId): MusicChapterId {
  return `ending_${endingId}` as MusicChapterId;
}

export function getEndingTrackUrls(endingId: EndingId): string[] {
  const base = import.meta.env.BASE_URL ?? '/';
  return ENDING_TRACK_FILES[endingId].map((f) => `${base}music/${f}`);
}

// ── Prestige / Final screen ──────────────────────────────────────────────

export const PRESTIGE_TRACK_FILES = ['prestige_1.mp3'];

export const PRESTIGE_CHAPTER_ID: MusicChapterId = 'prestige';

export function getPrestigeTrackUrls(): string[] {
  const base = import.meta.env.BASE_URL ?? '/';
  return PRESTIGE_TRACK_FILES.map((f) => `${base}music/${f}`);
}
