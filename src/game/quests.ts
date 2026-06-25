/**
 * Quest system (Overhaul-2 🅠5).
 *
 * Quests are condition + progress + claim + reward goals that sit ALONGSIDE the
 * lore milestone toasts. Each definition exposes a pure `progress(state, …)`
 * derived from PERSISTED game state wherever possible (collisions, stageIdx,
 * inventory, almanac, codex sets) — so progress never resets on reload. The two
 * action-counter quests (fuse N times, reach combo N) read transient counters in
 * `state.questProgress`, which the reducers bump and which reset on reload (the
 * goals are short enough to finish in a session).
 *
 * Save (v20): `activeQuests` (ids currently offered) + `completedQuestIds`
 * (claimed; survive prestige) are persisted; `questProgress` is transient.
 *
 * Rewards are anchor-relative (× ENTITY_COST_ANCHORS[playerStage]) so a claim is
 * era-appropriate whenever it lands. Stones are a flat currency (absolute).
 */

import type { GameState } from './types';
import type { Lang } from '../i18n';
import { buildMilestone, getStageMilestoneActiveIds, isMilestoneId, milestoneStageId } from './milestones';

interface L { en: string; ko: string; }

/** Action-counter tracks (kept for the QuestDef shape; milestones use no track). */
export type QuestTrack = 'fuse' | 'combo';

export interface QuestReward {
  /** Matter reward = ENTITY_COST_ANCHORS[playerStage] × this (era-relative). */
  matterAnchorFrac?: number;
  /** 강화석 reward (flat currency, absolute). */
  stones?: number;
}

export interface QuestDef {
  id: string;
  title: L;
  desc: L;
  target: number;
  /** Set for action-counter quests; absent quests derive progress from state. */
  track?: QuestTrack;
  /** Current progress 0..target from persisted state + transient counters. */
  progress: (state: GameState, questProgress: Record<string, number>) => number;
  reward: QuestReward;
  /** Earliest stage id (1-based) this quest may be offered. */
  minStageId: number;
}

/** How many quests are offered at once. */
export const QUEST_ACTIVE_COUNT = 4;


export function getQuest(id: string): QuestDef | undefined {
  // #42: quests ARE the per-stage milestones now (the 12 legacy hand-authored
  // quests were retired). Each `m.{stage}.{track}.{step}` resolves to a QuestDef
  // titled after the era-record it unlocks. Legacy ids in old saves' completed
  // list simply return undefined (they no longer render anywhere).
  return isMilestoneId(id) ? buildMilestone(id) : undefined;
}

export function questTitle(quest: QuestDef, lang: Lang): string {
  return quest.title[lang];
}
export function questDesc(quest: QuestDef, lang: Lang): string {
  return quest.desc[lang];
}

/** Current progress 0..target for a quest, clamped. */
export function getQuestProgress(quest: QuestDef, state: GameState): number {
  return Math.max(0, Math.min(quest.target, quest.progress(state, state.questProgress)));
}

/** True when an active quest has met its target and can be claimed. */
export function isQuestClaimable(quest: QuestDef, state: GameState): boolean {
  return getQuestProgress(quest, state) >= quest.target;
}

/**
 * Snapshot the CURRENT stage's active quests' progress into stageQuestProgress
 * just before the per-stage counters reset on stage exit. The map is keyed
 * stageId → questId → final progress (already clamped to the target), and the
 * leaving stage's entries are MERGED in (other stages untouched). This lets a
 * PAST-stage tab show frozen progress ("620/840"), and lets a quest that was
 * completed-but-unclaimed before leaving stay claimable later.
 */
export function snapshotStageQuestProgress(
  state: GameState,
  leavingStageId: number,
): Record<number, Record<string, number>> {
  const merged: Record<number, Record<string, number>> = { ...state.stageQuestProgress };
  const forStage: Record<string, number> = { ...(merged[leavingStageId] ?? {}) };
  for (const id of state.activeQuests) {
    const quest = getQuest(id);
    if (!quest) continue;
    // getQuestProgress already clamps at quest.target.
    forStage[id] = getQuestProgress(quest, state);
  }
  merged[leavingStageId] = forStage;
  return merged;
}

/**
 * Past-stage claim check: a quest is claimable from a PAST stage when its frozen
 * snapshot progress met the target AND it has not already been claimed. Used by
 * CLAIM_QUEST so a stage you already left can still hand out an earned reward
 * (the live activeQuests/live-progress path only covers the current stage).
 */
export function isPastQuestClaimable(
  quest: QuestDef,
  stageQuestProgress: Record<number, Record<string, number>>,
  completedQuestIds: readonly string[],
): boolean {
  if (completedQuestIds.includes(quest.id)) return false;
  const stageId = milestoneStageId(quest.id);
  if (!Number.isFinite(stageId)) return false;
  const snap = stageQuestProgress[stageId]?.[quest.id];
  return snap !== undefined && snap >= quest.target;
}

/**
 * Compute the active quest set: keep the still-valid current ones and top up
 * with the next eligible (minStage ≤ stageId, not completed, not already active)
 * quests in definition order, up to QUEST_ACTIVE_COUNT.
 */
export function refillActiveQuests(
  _activeQuests: string[],
  completedQuestIds: string[],
  stageId: number,
): string[] {
  // Overhaul-2: the active set is the CURRENT stage's open milestone steps (one
  // per track, the lowest unclaimed tier) — fully derived from (stage, claimed),
  // so any prior active ids are recomputed rather than kept.
  return getStageMilestoneActiveIds(stageId, completedQuestIds);
}

/** Fresh active set for a new game / prestige (no current quests to keep). */
export function pickActiveQuests(completedQuestIds: string[], stageId: number): string[] {
  return refillActiveQuests([], completedQuestIds, stageId);
}
// (#42: advanceQuestTracks + the questProgress action-counters were retired with
// the 12 legacy quests — milestones derive progress from per-stage state.)
