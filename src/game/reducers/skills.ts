/** Handlers: BUY_TRACK_LEVEL, BUY_CROSS_NODE */

import { findTree, findNode } from '../skills/definitions';
import { withCurrentUniverseEndingProgress } from '../multiverse';
import type { GameState } from '../types';
import type { GameAction } from '../reducer';

type BuyTrackLevelAction = Extract<GameAction, { type: 'BUY_TRACK_LEVEL' }>;
type BuyCrossNodeAction = Extract<GameAction, { type: 'BUY_CROSS_NODE' }>;

export function handleBuyTrackLevel(state: GameState, action: BuyTrackLevelAction): GameState {
  const treeId = action.trackId;
  const treeDef = findTree(treeId);
  if (!treeDef) return state;
  if (!state.skills.unlockedTracks.includes(treeId)) return state;
  const branch = state.skills[treeId];
  const nextLevel = branch.level + 1;
  if (nextLevel > treeDef.rootMaxLevel) return state;
  const cost = Math.ceil(treeDef.rootCostCurve(nextLevel));
  if (state.quanta < cost) return state;

  const nextSkills = { ...state.skills, [treeId]: { ...branch, level: nextLevel } };

  return withCurrentUniverseEndingProgress({
    ...state,
    quanta: state.quanta - cost,
    clickLevel: treeId === 'click' ? nextLevel : state.clickLevel,
    autoLevel: treeId === 'auto' ? nextLevel : state.autoLevel,
    critLevel: treeId === 'crit' ? nextLevel : state.critLevel,
    skills: nextSkills,
  });
}

export function handleBuyCrossNode(state: GameState, action: BuyCrossNodeAction): GameState {
  const { nodeId } = action;
  const nodeDef = findNode(nodeId);
  if (!nodeDef) return state;
  if (state.skills.ownedCrossNodes.includes(nodeId)) return state;

  const meetsRequirements = Object.entries(nodeDef.requires).every(([trackId, requiredLevel]) => {
    const branch = state.skills[trackId as 'click' | 'auto' | 'crit' | 'time'];
    return branch.level >= (requiredLevel ?? 0);
  });
  if (!meetsRequirements || state.quanta < nodeDef.cost) return state;
  if (state.skillPoints < nodeDef.spCost) return state;

  const nextSkills = {
    ...state.skills,
    ownedCrossNodes: [...state.skills.ownedCrossNodes, nodeId],
  };

  return withCurrentUniverseEndingProgress({
    ...state,
    quanta: state.quanta - nodeDef.cost,
    skillPoints: state.skillPoints - nodeDef.spCost,
    skills: nextSkills,
  });
}
