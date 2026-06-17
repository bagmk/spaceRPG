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
import type { EntityRarity } from './entities/types';
import type { Lang } from '../i18n';
import { ENTITY_COST_ANCHORS } from './balance';
import { findEntityById, STAGE_ENTITIES } from './entities/stageItems';
import { CODEX_SETS, collectedIdSet, getSubsetMembers, isSetComplete } from './entities/codexSets';
import { buildMilestone, getStageMilestoneActiveIds, isMilestoneId } from './milestones';

interface L { en: string; ko: string; }

/** Action-counter tracks (quests without a track derive progress from state). */
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

// ── Derivation helpers (all read PERSISTED state) ───────────────────────────

function ownedCountByRarity(state: GameState, rarity: EntityRarity): number {
  let n = 0;
  for (const e of state.inventory) {
    if (e.count <= 0) continue;
    const ent = findEntityById(e.entityId);
    if (ent && ent.rarity === rarity) n += e.count;
  }
  return n;
}

function almanacTotal(state: GameState): number {
  return Object.values(state.almanacCollected).reduce((sum, ids) => sum + ids.length, 0);
}

function maxInventoryLevel(state: GameState): number {
  return state.inventory.reduce((m, e) => (e.count > 0 ? Math.max(m, e.level) : m), 0);
}

function collectedInSubset(state: GameState, setId: string, subId: string): number {
  const set = CODEX_SETS.find((s) => s.id === setId);
  const sub = set?.subsets.find((s) => s.id === subId);
  if (!sub) return 0;
  const collected = collectedIdSet(state.almanacCollected);
  return getSubsetMembers(sub, STAGE_ENTITIES).filter((m) => collected.has(m.id)).length;
}

function isCodexSetDone(state: GameState, setId: string): boolean {
  const set = CODEX_SETS.find((s) => s.id === setId);
  if (!set) return false;
  return isSetComplete(set, collectedIdSet(state.almanacCollected), STAGE_ENTITIES);
}

// ── The 12 quests ───────────────────────────────────────────────────────────

export const QUESTS: QuestDef[] = [
  {
    id: 'absorb_10',
    title: { en: 'First Contact', ko: '첫 접촉' },
    desc: { en: 'Discover 10 entities', ko: '엔티티 10종 발견' },
    target: 10,
    progress: (s) => Math.min(10, almanacTotal(s)),
    reward: { matterAnchorFrac: 0.3 },
    minStageId: 1,
  },
  {
    id: 'combo_100',
    title: { en: 'On a Roll', ko: '연쇄 반응' },
    desc: { en: 'Reach a 100 combo', ko: '콤보 100 달성' },
    target: 100,
    track: 'combo',
    progress: (_s, qp) => Math.min(100, qp.combo_100 ?? 0),
    reward: { matterAnchorFrac: 0.4 },
    minStageId: 1,
  },
  {
    id: 'comet_50',
    title: { en: 'Comet Hunter', ko: '혜성 사냥꾼' },
    desc: { en: 'Absorb 50 comets', ko: '혜성 50개 흡수' },
    target: 50,
    progress: (s) => Math.min(50, s.collisions),
    reward: { matterAnchorFrac: 0.5 },
    minStageId: 1,
  },
  {
    id: 'quarks_5',
    title: { en: 'Standard Issue', ko: '쿼크 수집가' },
    desc: { en: 'Register 5 quarks in the Codex', ko: '쿼크 5종 도감 등록' },
    target: 5,
    progress: (s) => Math.min(5, collectedInSubset(s, 'standard_model', 'quarks')),
    reward: { stones: 4 },
    minStageId: 2,
  },
  {
    id: 'fuse_3',
    title: { en: 'Alchemist', ko: '연금술사' },
    desc: { en: 'Fuse 3 times', ko: '융합 3회' },
    target: 3,
    track: 'fuse',
    progress: (_s, qp) => Math.min(3, qp.fuse_3 ?? 0),
    reward: { matterAnchorFrac: 0.5 },
    minStageId: 3,
  },
  {
    id: 'rare_20',
    title: { en: 'Collector', ko: '수집광' },
    desc: { en: 'Own 20 rare copies', ko: '레어 20개 보유' },
    target: 20,
    progress: (s) => Math.min(20, ownedCountByRarity(s, 'rare')),
    reward: { matterAnchorFrac: 0.6 },
    minStageId: 3,
  },
  {
    id: 'equip_lv5',
    title: { en: 'Sharpened', ko: '연마' },
    desc: { en: 'Enhance any item to Lv5', ko: '아이템 Lv5 강화' },
    target: 5,
    progress: (s) => Math.min(5, maxInventoryLevel(s)),
    reward: { stones: 6 },
    minStageId: 3,
  },
  {
    id: 'standard_model_set',
    title: { en: 'The Standard Model', ko: '표준 모형' },
    desc: { en: 'Complete the Standard Model set', ko: '표준 모형 세트 완성' },
    target: 1,
    progress: (s) => (isCodexSetDone(s, 'standard_model') ? 1 : 0),
    reward: { matterAnchorFrac: 1.5, stones: 12 },
    minStageId: 4,
  },
  {
    id: 'epic_1',
    title: { en: 'Epic Find', ko: '에픽 등장' },
    desc: { en: 'Obtain an epic entity', ko: '에픽 엔티티 1개 획득' },
    target: 1,
    progress: (s) => (ownedCountByRarity(s, 'epic') > 0 ? 1 : 0),
    reward: { matterAnchorFrac: 1.0 },
    minStageId: 7,
  },
  {
    id: 'legendary_craft',
    title: { en: 'Legend Forged', ko: '전설 제련' },
    desc: { en: 'Forge a legendary by fusion', ko: '전설 1개 융합 제작' },
    target: 1,
    progress: (s) => (ownedCountByRarity(s, 'legendary') > 0 ? 1 : 0),
    reward: { matterAnchorFrac: 2.0 },
    minStageId: 12,
  },
  {
    id: 'mythic_craft',
    title: { en: 'Mythmaker', ko: '신화 창조' },
    desc: { en: 'Forge a mythic entity', ko: '신화 엔티티 제작' },
    target: 1,
    progress: (s) => (ownedCountByRarity(s, 'mythic') > 0 ? 1 : 0),
    reward: { matterAnchorFrac: 2.5, stones: 25 },
    minStageId: 14,
  },
  {
    id: 'stage_16',
    title: { en: 'The End', ko: '종말까지' },
    desc: { en: 'Reach Stage 16', ko: '스테이지 16 도달' },
    target: 1,
    progress: (s) => (s.stageIdx >= 15 ? 1 : 0),
    reward: { matterAnchorFrac: 3.0 },
    minStageId: 14,
  },
];

const QUEST_BY_ID = new Map(QUESTS.map((q) => [q.id, q]));

export function getQuest(id: string): QuestDef | undefined {
  // Overhaul-2: `m.*` ids are per-stage milestone steps (generated); the legacy
  // map still resolves any pre-existing claimed quest ids in old saves.
  if (isMilestoneId(id)) return buildMilestone(id);
  return QUEST_BY_ID.get(id);
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

/**
 * Bump the transient action-counters for active quests on the given track.
 * 'fuse' accumulates (+value); 'combo' takes the running max (value = combo
 * reached). Returns a new questProgress map, or the same ref when nothing
 * changed (so reducers don't churn state needlessly).
 */
export function advanceQuestTracks(
  state: GameState,
  track: QuestTrack,
  value: number,
): Record<string, number> {
  let changed = false;
  const next: Record<string, number> = { ...state.questProgress };
  for (const id of state.activeQuests) {
    const q = QUEST_BY_ID.get(id);
    if (!q || q.track !== track) continue;
    if (track === 'combo') {
      if (value > (next[id] ?? 0)) { next[id] = value; changed = true; }
    } else {
      next[id] = (next[id] ?? 0) + value;
      changed = true;
    }
  }
  return changed ? next : state.questProgress;
}
