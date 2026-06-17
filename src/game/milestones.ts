/**
 * Stage milestones (Overhaul-2: per-stage "Achievement Tracks").
 *
 * Each `m.{stage}.{track}.{step}` id resolves to a QuestDef-shaped goal derived
 * from per-stage state, and is fed through the EXISTING quest pipeline
 * (activeQuests / completedQuestIds / CLAIM_QUEST / QuestPanel / 우주도감). The
 * active set is always the CURRENT stage's open steps — one per eligible track,
 * the lowest tier not yet claimed. Claiming appends the id to completedQuestIds
 * (the chronological, era-grouped log). All tunables live in balance.ts.
 *
 * Milestones are evaluated only for the current stage (their per-stage metrics
 * reset on stage entry), so a step's progress is read while it is active.
 */

import {
  MILESTONE_TRACKS,
  MILESTONE_COUNT_SOFTENING,
  MILESTONE_MAX_SCALE,
  type MilestoneMetric,
  type MilestoneTrack,
  type MilestoneTrackSpec,
} from './balance';
import { STAGES } from './stages';
import { getEntropyGateProgress } from './formulas';
import { getEntitiesForStage } from './entities/stageItems';
import { getLogsForStage, type StageLog } from './stageLogs';
import type { GameState } from './types';
import type { QuestDef } from './quests';

const TIER_LABEL = ['I', 'II', 'III', 'IV'];
const TRACK_LABEL: Record<MilestoneTrack, { en: string; ko: string }> = {
  pulse:   { en: 'Pulse',      ko: '맥동' },
  forge:   { en: 'Forge',      ko: '제련' },
  archive: { en: 'Archive',    ko: '기록' },
  expanse: { en: 'Survey',     ko: '탐사' },
  comet:   { en: 'Comet Hunt', ko: '혜성 사냥' },
  combo:   { en: 'Chain',      ko: '연쇄' },
};

function descFor(metric: MilestoneMetric, n: number): { en: string; ko: string } {
  switch (metric) {
    case 'clicksThisStage':  return { en: `Click ${n} times this era`,       ko: `이 시대에 ${n}회 클릭` };
    case 'fusionsThisStage': return { en: `Fuse ${n} times this era`,        ko: `이 시대에 ${n}회 융합` };
    case 'collectThisStage': return { en: `Discover ${n} entities this era`, ko: `이 시대 엔티티 ${n}종 발견` };
    case 'gateProgress01':   return { en: `Fill the entropy gate to ${n}%`,  ko: `엔트로피 게이트 ${n}% 충전` };
    case 'cometsThisStage':  return { en: `Absorb ${n} comets this era`,     ko: `이 시대 혜성 ${n}개 흡수` };
    case 'comboThisStage':   return { en: `Reach a ${n} combo this era`,     ko: `이 시대 콤보 ${n} 달성` };
  }
}

function stageScale(stageId: number): number {
  const base = STAGES[0].realPlayTargetSec || 30;
  const s = STAGES[Math.min(Math.max(0, stageId - 1), STAGES.length - 1)];
  const raw = Math.pow((s.realPlayTargetSec || base) / base, MILESTONE_COUNT_SOFTENING);
  return Math.min(MILESTONE_MAX_SCALE, raw);
}

/** Tier threshold for a spec at a stage (count tracks scale; others are fixed). */
function tierThreshold(spec: MilestoneTrackSpec, stageId: number, step: number): number {
  const base = spec.baseTiers[step];
  let target = spec.scaled ? Math.max(1, Math.round(base * stageScale(stageId))) : base;
  // Collect targets can't exceed the stage's own collectible pool, or they're
  // unreachable on small stages.
  if (spec.metric === 'collectThisStage') {
    target = Math.min(target, getEntitiesForStage(stageId).length);
  }
  return target;
}

function metricValue(metric: MilestoneMetric, state: GameState, stageId: number): number {
  switch (metric) {
    case 'clicksThisStage':  return Math.max(0, state.totalClicks - (state.stageClicksAtStageStart ?? 0));
    case 'fusionsThisStage': return state.fusionsThisStage ?? 0;
    case 'collectThisStage': return (state.almanacCollected[stageId] ?? []).length;
    case 'gateProgress01':   return Math.floor(getEntropyGateProgress(state.entropy, state.stageIdx) * 100);
    case 'cometsThisStage':  return state.cometsThisStage ?? 0;
    case 'comboThisStage':   return state.comboThisStage ?? 0;
  }
}

export function isMilestoneId(id: string): boolean {
  return id.startsWith('m.');
}

/** Parse the stage id out of an `m.{stage}.{track}.{step}` id (NaN if not one). */
export function milestoneStageId(id: string): number {
  const parts = id.split('.');
  return parts[0] === 'm' ? Number(parts[1]) : NaN;
}

// ── #42: 1:1 milestone ↔ era-record (StageLog) mapping ──────────────────────
// Every milestone unlocks one era-record. The milestone is TITLED after that
// record, and claiming it reveals the record in the almanac timeline — so
// completing quests literally unfolds the era's history. Milestones per stage
// (~9-11) usually outnumber the logs (~7-13), so the deterministic order is
// mapped evenly across the logs (adjacent milestones may share a record).

/** Deterministic ordered milestone ids for a stage (track order × step order). */
function orderedStageMilestoneIds(stageId: number): string[] {
  const ids: string[] = [];
  for (const spec of MILESTONE_TRACKS) {
    if ((spec.minStageId ?? 1) > stageId) continue;
    for (let step = 0; step < spec.baseTiers.length; step++) ids.push(`m.${stageId}.${spec.track}.${step}`);
  }
  return ids;
}

/** The log index (within getLogsForStage order) a milestone at ordered-index k maps to. */
function logIndexForOrdinal(k: number, total: number, logCount: number): number {
  if (logCount <= 1 || total <= 1) return 0;
  return Math.min(logCount - 1, Math.round((k * (logCount - 1)) / (total - 1)));
}

/** The era-record (StageLog) a milestone id unlocks — undefined if not a milestone. */
export function milestoneEraLog(id: string): StageLog | undefined {
  const stageId = milestoneStageId(id);
  if (!Number.isFinite(stageId)) return undefined;
  const logs = getLogsForStage(stageId);
  if (logs.length === 0) return undefined;
  const ordered = orderedStageMilestoneIds(stageId);
  const k = ordered.indexOf(id);
  if (k < 0) return undefined;
  return logs[logIndexForOrdinal(k, ordered.length, logs.length)];
}

/** Is the era-record at `logIndex` of `stageId` unlocked? (any milestone mapped
 *  to it has been claimed). Drives the almanac timeline reveal. */
export function isEraRecordUnlocked(stageId: number, logIndex: number, completedQuestIds: readonly string[]): boolean {
  const logs = getLogsForStage(stageId);
  if (logs.length === 0) return false;
  const completed = new Set(completedQuestIds);
  const ordered = orderedStageMilestoneIds(stageId);
  for (let k = 0; k < ordered.length; k++) {
    if (logIndexForOrdinal(k, ordered.length, logs.length) === logIndex && completed.has(ordered[k])) return true;
  }
  return false;
}

/** Build the QuestDef for an `m.{stage}.{track}.{step}` id (undefined if invalid). */
export function buildMilestone(id: string): QuestDef | undefined {
  const parts = id.split('.');
  if (parts.length !== 4 || parts[0] !== 'm') return undefined;
  const stageId = Number(parts[1]);
  const track = parts[2] as MilestoneTrack;
  const step = Number(parts[3]);
  const spec = MILESTONE_TRACKS.find((t) => t.track === track);
  if (!spec || !Number.isFinite(stageId) || !Number.isInteger(step) || step < 0 || step >= spec.baseTiers.length) {
    return undefined;
  }
  const target = tierThreshold(spec, stageId, step);
  // #42: the milestone is NAMED after the era-record it unlocks; the track label
  // is the fallback when no log exists for the stage.
  const eraLog = milestoneEraLog(id);
  const tierSuffix = spec.baseTiers.length > 1 ? ` ${TIER_LABEL[step] ?? String(step + 1)}` : '';
  const trackL = TRACK_LABEL[track];
  const title = eraLog ? eraLog.title : { en: `${trackL.en}${tierSuffix}`, ko: `${trackL.ko}${tierSuffix}` };
  return {
    id,
    title,
    desc: descFor(spec.metric, target),
    target,
    progress: (s) => metricValue(spec.metric, s, stageId),
    reward: { matterAnchorFrac: spec.rewardFrac[step], stones: spec.stoneTiers?.[step] },
    minStageId: Math.max(spec.minStageId ?? 1, stageId), // only offered on its own stage
  };
}

/**
 * The current stage's OPEN milestone steps — one per eligible track (the lowest
 * tier not yet claimed). This is the active set fed to the quest pipeline.
 */
export function getStageMilestoneActiveIds(stageId: number, completedQuestIds: string[]): string[] {
  const completed = new Set(completedQuestIds);
  const ids: string[] = [];
  for (const spec of MILESTONE_TRACKS) {
    if ((spec.minStageId ?? 1) > stageId) continue;
    for (let step = 0; step < spec.baseTiers.length; step++) {
      const id = `m.${stageId}.${spec.track}.${step}`;
      if (!completed.has(id)) {
        ids.push(id);
        break;
      }
    }
  }
  return ids;
}
