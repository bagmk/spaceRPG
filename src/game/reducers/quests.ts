/** Quest reducer (Overhaul-2 🅠5): CLAIM_QUEST grants the reward + refreshes the active set. */

import type { GameState } from '../types';
import type { GameAction } from '../reducer';
import { ENTITY_COST_ANCHORS } from '../balance';
import { STAGES } from '../stages';
import { safeAdd } from '../formulas';
import { getQuest, isPastQuestClaimable, isQuestClaimable, refillActiveQuests } from '../quests';
import { milestoneStageId } from '../milestones';

type ClaimQuestAction = Extract<GameAction, { type: 'CLAIM_QUEST' }>;

/**
 * Claim a completed quest: grant its (era-relative) matter + flat 강화석 reward,
 * move it to completedQuestIds (once-only), drop its transient counter, and
 * refill the active set with the next eligible quest.
 *
 * Two claim paths share one grant:
 *  - LIVE  — a current-stage active quest whose live progress met the target.
 *  - PAST  — a quest from a stage already left whose FROZEN snapshot progress
 *            (stageQuestProgress) met the target but was never claimed. The
 *            completedQuestIds guard prevents any double-grant across both paths.
 */
export function handleClaimQuest(state: GameState, action: ClaimQuestAction): GameState {
  const quest = getQuest(action.questId);
  if (!quest) return state;
  if (state.completedQuestIds.includes(action.questId)) return state;
  const isLive = state.activeQuests.includes(action.questId) && isQuestClaimable(quest, state);
  const isPast = isPastQuestClaimable(quest, state);
  if (!isLive && !isPast) return state;

  const stageId = STAGES[Math.min(state.stageIdx, STAGES.length - 1)].id;
  // User: a quest's reward is FIXED to the stage it BELONGS to — a past-stage quest must pay
  // what that stage gave, not the inflated current-stage anchor. milestoneStageId → quest's stage
  // (NaN for any non-milestone id → fall back to the current stage, i.e. unchanged for live).
  const qStage = milestoneStageId(action.questId);
  const rewardStageId = Number.isFinite(qStage) ? qStage : stageId;
  const anchor = ENTITY_COST_ANCHORS[rewardStageId as keyof typeof ENTITY_COST_ANCHORS] ?? ENTITY_COST_ANCHORS[16];
  const matter = Math.floor(anchor * (quest.reward.matterAnchorFrac ?? 0));
  const stones = quest.reward.stones ?? 0;

  const completedQuestIds = [...state.completedQuestIds, action.questId];
  const remaining = state.activeQuests.filter((id) => id !== action.questId);
  const activeQuests = refillActiveQuests(remaining, completedQuestIds, stageId);
  const { [action.questId]: _dropped, ...questProgress } = state.questProgress;
  void _dropped;
  const eventId = state.eventCounter + 1;

  return {
    ...state,
    quanta: safeAdd(state.quanta, matter),
    enhanceStones: Math.max(0, state.enhanceStones + stones),
    completedQuestIds,
    activeQuests,
    questProgress,
    eventCounter: eventId,
    // #42: drives the slot-machine matter rollup + sound in GameScreen.
    lastQuestClaimEvent: { id: eventId, questId: action.questId, matter, stones },
  };
}
