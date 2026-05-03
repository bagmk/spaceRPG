import { useEffect, useMemo, useState } from 'react';
import type { Dispatch } from 'react';
import { CROSS_NODES, SKILL_TREES, findNode, findTree, getVisibleCrossTier } from '../../game/skills/definitions';
import type { SkillTreeId } from '../../game/skills/types';
import type { GameAction } from '../../game/reducer';
import type { GameState } from '../../game/types';
import { formatGameNumber, formatWhole, getAutoRate, getClickPower, getCritMultiplier, getTimeMultiplier } from '../../game/formulas';
import { getActiveModifiers } from '../../game/skills/effects';

interface SkillsPanelProps {
  state: GameState;
  dispatch: Dispatch<GameAction>;
  onClose: () => void;
}

type Selection =
  | { kind: 'track'; trackId: SkillTreeId }
  | { kind: 'cross'; nodeId: string };

function getTrackLockedReason(state: GameState, trackId: SkillTreeId): string | null {
  const tree = findTree(trackId);
  if (!tree) return 'Missing track';
  if (!state.skills.unlockedTracks.includes(trackId)) {
    return `Unlocks at Stage ${tree.unlockStageId}`;
  }
  const level = state.skills[trackId].level;
  if (level >= tree.rootMaxLevel) {
    return 'Track maxed';
  }
  const cost = Math.ceil(tree.rootCostCurve(level + 1));
  return state.quanta < cost ? 'Not enough quanta' : null;
}

function getCrossLockedReason(state: GameState, nodeId: string, visibleTier: number): string | null {
  const node = findNode(nodeId);
  if (!node) return 'Missing node';
  if (node.tier > visibleTier) {
    return `Unlocks at Stage ${node.unlockStageId}`;
  }
  if (state.skills.ownedCrossNodes.includes(node.id)) {
    return 'Already owned';
  }
  const unmet = Object.entries(node.requires).find(([trackId, requiredLevel]) => {
    return state.skills[trackId as SkillTreeId].level < (requiredLevel ?? 0);
  });
  if (unmet) {
    const tree = findTree(unmet[0] as SkillTreeId);
    return `Requires ${tree?.label ?? unmet[0]} Lv ${unmet[1]}`;
  }
  if (state.quanta < node.cost) {
    return 'Not enough quanta';
  }
  return null;
}

function TrackColumn({
  treeId,
  state,
  selected,
  onSelect,
}: {
  treeId: SkillTreeId;
  state: GameState;
  selected: boolean;
  onSelect: () => void;
}) {
  const tree = findTree(treeId)!;
  const level = state.skills[treeId].level;
  const unlocked = state.skills.unlockedTracks.includes(treeId);

  return (
    <button
      type="button"
      className={`skill-track ${selected ? 'selected' : ''} ${unlocked ? 'unlocked' : 'locked'}`}
      onClick={onSelect}
    >
      <div className="skill-track-grid">
        {Array.from({ length: tree.rootMaxLevel }, (_, index) => {
          const slot = tree.rootMaxLevel - index;
          const isFilled = unlocked && slot <= level;
          const isNext = unlocked && slot === level + 1;
          const isMilestone = [5, 10, 15, 20, 25, 30].includes(slot);
          return (
            <div
              key={slot}
              className={`skill-cell ${isFilled ? 'filled' : isNext ? 'next' : 'future'} ${isMilestone ? 'milestone' : ''}`}
            >
              <span>{slot}</span>
              {isMilestone ? <small>★</small> : null}
            </div>
          );
        })}
      </div>
      <div className="skill-track-footer">
        <strong>{tree.label}</strong>
        <span>{unlocked ? `Lv ${level}` : `Stage ${tree.unlockStageId}`}</span>
      </div>
    </button>
  );
}

export function SkillsButton({
  highlighted,
  onClick,
}: {
  highlighted: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`skills-button ${highlighted ? 'affordable' : ''}`}
      onClick={onClick}
      aria-label="Open skills"
    >
      <span>✦</span>
    </button>
  );
}

export function SkillsPanel({ state, dispatch, onClose }: SkillsPanelProps) {
  const [selection, setSelection] = useState<Selection>({ kind: 'track', trackId: 'click' });
  const visibleTier = getVisibleCrossTier(state.stageIdx + 1);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const summary = useMemo(
    () => `Quanta ${formatGameNumber(state.quanta)}   Mass ${formatGameNumber(state.condensedMass)}`,
    [state.condensedMass, state.quanta],
  );

  const selectedTree = selection.kind === 'track' ? findTree(selection.trackId)! : null;
  const selectedCross = selection.kind === 'cross' ? findNode(selection.nodeId)! : null;
  const lockedReason =
    selection.kind === 'track'
      ? getTrackLockedReason(state, selection.trackId)
      : getCrossLockedReason(state, selection.nodeId, visibleTier);

  const buy = () => {
    if (selection.kind === 'track') {
      dispatch({ type: 'BUY_TRACK_LEVEL', trackId: selection.trackId });
      return;
    }
    dispatch({ type: 'BUY_CROSS_NODE', nodeId: selection.nodeId });
  };

  const currentModifiers = getActiveModifiers(state.skills, {
    currentQuanta: state.quanta,
    stagesCleared: state.stageIdx,
    secondsInStage: Math.max(0, (Date.now() - state.stageStartedAt) / 1000),
    stageId: state.stageIdx + 1,
    progress01: 0,
    clickLevel: state.skills.click.level,
  });

  let previewText = '';
  let costLine = '';
  let canBuy = lockedReason === null;

  if (selection.kind === 'track' && selectedTree) {
    const nextLevel = Math.min(selectedTree.rootMaxLevel, state.skills[selection.trackId].level + 1);
    costLine = `Cost to Lv ${nextLevel}: ${formatGameNumber(Math.ceil(selectedTree.rootCostCurve(nextLevel)))} quanta`;
    previewText =
      selectedTree.milestones[nextLevel]?.desc ??
      `${selectedTree.label} grows stronger at Lv ${nextLevel}.`;
  } else if (selection.kind === 'cross' && selectedCross) {
    costLine = `Cost: ${formatGameNumber(selectedCross.cost)} quanta`;
    previewText = selectedCross.description;
  } else {
    canBuy = false;
  }

  return (
    <div className="skills-overlay" onClick={onClose} role="presentation">
      <aside className="skills-drawer" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="skills-header">
          <div>
            <div className="q-stage">Cosmic Skills</div>
            <h2>Unified Tree</h2>
          </div>
          <button type="button" className="mini-button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="skills-meta">{summary}</div>

        <div className="skills-graph unified">
          <div className="skills-track-row">
            {SKILL_TREES.map((tree) => (
              <TrackColumn
                key={tree.id}
                treeId={tree.id}
                state={state}
                selected={selection.kind === 'track' && selection.trackId === tree.id}
                onSelect={() => setSelection({ kind: 'track', trackId: tree.id })}
              />
            ))}
          </div>

          <div className="cross-node-grid">
            {CROSS_NODES.map((node) => {
              const hidden = node.tier > visibleTier;
              const owned = state.skills.ownedCrossNodes.includes(node.id);
              const available = !hidden && getCrossLockedReason(state, node.id, visibleTier) === null;
              return (
                <button
                  key={node.id}
                  type="button"
                  className={`cross-node ${hidden ? 'hidden-tier' : owned ? 'owned' : available ? 'available' : 'locked'} ${
                    selection.kind === 'cross' && selection.nodeId === node.id ? 'selected' : ''
                  }`}
                  onClick={() => setSelection({ kind: 'cross', nodeId: node.id })}
                >
                  <strong>{node.label}</strong>
                  <span>{hidden ? `Stage ${node.unlockStageId}` : `Tier ${node.tier}`}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="skills-detail">
          <strong>
            {selection.kind === 'track'
              ? `${selectedTree?.label} — Lv ${state.skills[selection.trackId].level}`
              : selectedCross?.label ?? 'Unknown'}
          </strong>
          <p>{previewText}</p>
          <div className="skills-detail-line">{costLine}</div>
          <div className="skills-detail-line">{`After buy: Click ${formatWhole(getClickPower(currentModifiers))} · Auto ${formatWhole(getAutoRate(currentModifiers))}/s · Crit ×${formatWhole(getCritMultiplier(currentModifiers))} · Time ×${formatWhole(getTimeMultiplier(currentModifiers))}`}</div>
          {lockedReason ? <div className="skills-locked-reason">{lockedReason}</div> : null}
          <button type="button" className="q-continue skills-buy" disabled={!canBuy} onClick={buy}>
            {selection.kind === 'track' ? 'Buy +1 Level' : 'Buy Cross Node'}
          </button>
        </div>
      </aside>
    </div>
  );
}
