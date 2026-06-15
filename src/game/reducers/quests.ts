/** Quest reducer (Overhaul-2 🅠5): CLAIM_QUEST grants the reward + refreshes the active set. */

import type { GameState } from '../types';
import type { GameAction } from '../reducer';
import { ENTITY_COST_ANCHORS } from '../balance';
import { STAGES } from '../stages';
import { safeAdd } from '../formulas';
import { getQuest, isQuestClaimable, refillActiveQuests } from '../quests';

type ClaimQuestAction = Extract<GameAction, { type: 'CLAIM_QUEST' }>;

/**
 * Claim a completed active quest: grant its (era-relative) matter + flat 강화석
 * reward, move it to completedQuestIds (once-only), drop its transient counter,
 * and refill the active set with the next eligible quest.
 */
export function handleClaimQuest(state: GameState, action: ClaimQuestAction): GameState {
  const quest = getQuest(action.questId);
  if (!quest) return state;
  if (!state.activeQuests.includes(action.questId)) return state;
  if (state.completedQuestIds.includes(action.questId)) return state;
  if (!isQuestClaimable(quest, state)) return state;

  const stageId = STAGES[Math.min(state.stageIdx, STAGES.length - 1)].id;
  const anchor = ENTITY_COST_ANCHORS[stageId as keyof typeof ENTITY_COST_ANCHORS] ?? ENTITY_COST_ANCHORS[16];
  const matter = Math.floor(anchor * (quest.reward.matterAnchorFrac ?? 0));
  const stones = quest.reward.stones ?? 0;

  const completedQuestIds = [...state.completedQuestIds, action.questId];
  const remaining = state.activeQuests.filter((id) => id !== action.questId);
  const activeQuests = refillActiveQuests(remaining, completedQuestIds, stageId);
  const { [action.questId]: _dropped, ...questProgress } = state.questProgress;
  void _dropped;

  return {
    ...state,
    quanta: safeAdd(state.quanta, matter),
    enhanceStones: Math.max(0, state.enhanceStones + stones),
    completedQuestIds,
    activeQuests,
    questProgress,
  };
}
