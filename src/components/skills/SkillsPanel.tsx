import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, MouseEvent as ReactMouseEvent } from 'react';
import { CROSS_NODES, SKILL_TREES, findNode, findTree, getVisibleCrossTier } from '../../game/skills/definitions';
import type { CrossNodeDef, SkillTreeId } from '../../game/skills/types';
import type { GameAction } from '../../game/reducer';
import type { GameState } from '../../game/types';
import {
  formatGameNumber,
  formatWhole,
  getAutoRate,
  getClickPower,
  getCritMultiplier,
  getTimeMultiplier,
} from '../../game/formulas';
import { getActiveModifiers } from '../../game/skills/effects';

interface SkillsPanelProps {
  state: GameState;
  dispatch: Dispatch<GameAction>;
  onClose: () => void;
}

type MilestoneLevel = 5 | 10 | 15 | 20 | 25 | 30;

type Selection =
  | { kind: 'track'; trackId: SkillTreeId; level: number }
  | { kind: 'cross'; nodeId: string }
  | { kind: 'crossSlot'; trackId: SkillTreeId; tier: MilestoneLevel };

interface PopupState {
  selection: Selection;
  x: number;
  y: number;
}

const MILESTONES: MilestoneLevel[] = [5, 10, 15, 20, 25, 30];
const DISPLAY_MAX_LEVEL = 30;

const TRACK_SYMBOLS: Record<SkillTreeId, string> = {
  click: 'F',
  crit: 'Q',
  auto: 'W',
  time: 'T',
};

function getTrackLockedReason(state: GameState, trackId: SkillTreeId, targetLevel: number): string | null {
  const tree = findTree(trackId);
  if (!tree) return 'Missing track';
  if (!state.skills.unlockedTracks.includes(trackId)) {
    return `Unlocks at Stage ${tree.unlockStageId}`;
  }
  const level = state.skills[trackId].level;
  if (targetLevel <= level) {
    return 'Already owned';
  }
  if (targetLevel > level + 1) {
    return `Buy Lv ${level + 1} first`;
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
  if (state.skillPoints < node.spCost) {
    return 'Not enough SP';
  }
  if (state.quanta < node.cost) {
    return 'Not enough quanta';
  }
  return null;
}

function getCrossNodeForSlot(trackId: SkillTreeId, tier: MilestoneLevel): CrossNodeDef | null {
  return (
    CROSS_NODES.find((node) => node.tier === tier && node.requires[trackId] === tier) ??
    CROSS_NODES.find((node) => node.tier === tier && node.requires[trackId] !== undefined) ??
    null
  );
}

function getSlotUnlockStage(tier: MilestoneLevel): number {
  if (tier === 30) return 16;
  if (tier === 25) return 15;
  if (tier === 20) return 14;
  if (tier === 15) return 11;
  if (tier === 10) return 7;
  return 5;
}

function CrossNodeConnections({ state, visibleTier }: { state: GameState; visibleTier: number }) {
  const trackOrder = SKILL_TREES.map((tree) => tree.id);
  const paths = CROSS_NODES.flatMap((node) => {
    if (node.tier > visibleTier) return [];
    const reqs = Object.entries(node.requires) as Array<[SkillTreeId, number]>;
    if (reqs.length < 2) return [];
    const metCount = reqs.filter(([trackId, level]) => state.skills[trackId].level >= level).length;
    const owned = state.skills.ownedCrossNodes.includes(node.id);
    const className = owned || metCount === reqs.length ? 'met' : metCount > 0 ? 'partial' : 'locked';
    const points = reqs.map(([trackId, level]) => {
      const col = trackOrder.indexOf(trackId);
      const x = ((col + 0.5) / trackOrder.length) * 100;
      const y = 54 + (DISPLAY_MAX_LEVEL - Math.min(DISPLAY_MAX_LEVEL, level)) * 39 + 16;
      return { x, y };
    });
    const source = points[0];
    return points.slice(1).map((target, index) => {
      const midY = Math.min(source.y, target.y) - 22 - index * 6;
      return {
        id: `${node.id}-${index}`,
        className,
        d: `M ${source.x} ${source.y} C ${source.x} ${midY}, ${target.x} ${midY}, ${target.x} ${target.y}`,
      };
    });
  });

  return (
    <svg className="cross-connections" viewBox="0 0 100 1240" preserveAspectRatio="none" aria-hidden="true">
      {paths.map((path) => (
        <path key={path.id} className={path.className} d={path.d} />
      ))}
    </svg>
  );
}

function TrackColumn({
  treeId,
  state,
  visibleTier,
  selection,
  onSelect,
}: {
  treeId: SkillTreeId;
  state: GameState;
  visibleTier: number;
  selection: Selection;
  onSelect: (selection: Selection, event: ReactMouseEvent<HTMLElement>) => void;
}) {
  const tree = findTree(treeId)!;
  const level = state.skills[treeId].level;
  const unlocked = state.skills.unlockedTracks.includes(treeId);

  return (
    <div
      className={`skill-track ${unlocked ? 'unlocked' : 'locked'}`}
      title={unlocked ? tree.label : `Unlocks at Stage ${tree.unlockStageId}`}
    >
      <div className="skill-track-head">
        <span className="skill-track-symbol" style={{ color: tree.color }}>
          {TRACK_SYMBOLS[treeId]}
        </span>
        <span>{`Lv ${level}`}</span>
      </div>
      <div className="skill-track-grid" aria-label={`${tree.label} levels`}>
        {Array.from({ length: DISPLAY_MAX_LEVEL }, (_, index) => {
          const slot = DISPLAY_MAX_LEVEL - index;
          const milestone = MILESTONES.includes(slot as MilestoneLevel)
            ? (slot as MilestoneLevel)
            : null;
          const crossNode = milestone ? getCrossNodeForSlot(treeId, milestone) : null;
          const isFilled = unlocked && slot <= level;
          const isNext = unlocked && slot === level + 1;
          const selected =
            selection.kind === 'track' &&
            selection.trackId === treeId &&
            selection.level === slot;
          const crossSelected =
            milestone &&
            ((selection.kind === 'cross' && crossNode?.id === selection.nodeId) ||
              (selection.kind === 'crossSlot' &&
                selection.trackId === treeId &&
                selection.tier === milestone));
          const crossOwned = crossNode ? state.skills.ownedCrossNodes.includes(crossNode.id) : false;
          const crossAvailable =
            crossNode && getCrossLockedReason(state, crossNode.id, visibleTier) === null;
          const crossStageLocked = milestone !== null && milestone > visibleTier;

          return (
            <div key={slot} className={`skill-row ${milestone ? 'milestone-row' : ''}`}>
              <button
                type="button"
                className={`skill-cell ${isFilled ? 'filled' : isNext ? 'next' : 'future'} ${
                  selected ? 'selected' : ''
                }`}
                disabled={!unlocked}
                onClick={(event) => onSelect({ kind: 'track', trackId: treeId, level: slot }, event)}
                title={`${tree.label} Lv ${slot}`}
              >
                <span>{slot}</span>
              </button>
              {milestone ? (
                <button
                  type="button"
                  className={`cross-slot ${crossOwned ? 'owned' : crossAvailable ? 'available' : 'locked'} ${
                    crossStageLocked ? 'stage-locked' : ''
                  } ${crossSelected ? 'selected' : ''}`}
                  disabled={!unlocked}
                  onClick={(event) =>
                    crossNode
                      ? onSelect({ kind: 'cross', nodeId: crossNode.id }, event)
                      : onSelect({ kind: 'crossSlot', trackId: treeId, tier: milestone }, event)
                  }
                  title={
                    crossNode
                      ? crossNode.label
                      : `Milestone cross-node slot, Stage ${getSlotUnlockStage(milestone)}`
                  }
                >
                  {crossOwned ? '*' : crossStageLocked ? 'L' : '+'}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
      {!unlocked ? <div className="skill-track-lock">Unlocks Stage {tree.unlockStageId}</div> : null}
    </div>
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
  const [selection, setSelection] = useState<Selection>({ kind: 'track', trackId: 'click', level: 1 });
  const [popup, setPopup] = useState<PopupState | null>(null);
  const [tutorialActive, setTutorialActive] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const visibleTier = getVisibleCrossTier(state.stageIdx + 1);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    const onDocMouseDown = (event: MouseEvent) => {
      if (popupRef.current?.contains(event.target as Node)) {
        return;
      }
      const target = event.target as HTMLElement;
      if (target.closest('.skill-cell') || target.closest('.cross-slot')) {
        return;
      }
      setPopup(null);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  useEffect(() => {
    if (state.universeCount === 1 && !state.tutorialFlags.skill_tree_intro) {
      setTutorialActive(true);
      setTutorialStep(0);
    }
  }, [state.tutorialFlags.skill_tree_intro, state.universeCount]);

  const summary = useMemo(
    () =>
      `Quanta ${formatGameNumber(state.quanta)}   SP ${formatWhole(state.skillPoints)}   Mass ${formatGameNumber(state.condensedMass)}`,
    [state.condensedMass, state.quanta, state.skillPoints],
  );

  const selectedTree = selection.kind === 'track' ? findTree(selection.trackId)! : null;
  const selectedCross = selection.kind === 'cross' ? findNode(selection.nodeId)! : null;
  const selectedSlotTree = selection.kind === 'crossSlot' ? findTree(selection.trackId)! : null;
  const lockedReason =
    selection.kind === 'track'
      ? getTrackLockedReason(state, selection.trackId, selection.level)
      : selection.kind === 'cross'
        ? getCrossLockedReason(state, selection.nodeId, visibleTier)
        : `Cross-node slot opens at Stage ${getSlotUnlockStage(selection.tier)}`;

  const canBuy =
    selection.kind === 'track'
      ? lockedReason === null
      : selection.kind === 'cross'
        ? lockedReason === null
        : false;

  const buy = () => {
    if (selection.kind === 'track') {
      dispatch({ type: 'BUY_TRACK_LEVEL', trackId: selection.trackId });
    } else if (selection.kind === 'cross') {
      dispatch({ type: 'BUY_CROSS_NODE', nodeId: selection.nodeId });
    }
    setPopup(null);
  };

  const currentModifiers = getActiveModifiers(state.skills, {
    currentQuanta: state.quanta,
    stagesCleared: state.stageIdx,
    secondsInStage: Math.max(0, (Date.now() - state.stageStartedAt) / 1000),
    stageId: state.stageIdx + 1,
    progress01: 0,
    clickLevel: state.skills.click.level,
  });

  let heading = 'Select a node';
  let previewText = '';
  let costLine = '';

  if (selection.kind === 'track' && selectedTree) {
    const currentLevel = state.skills[selection.trackId].level;
    const nextLevel = currentLevel + 1;
    const targetLevel = selection.level;
    heading =
      targetLevel <= currentLevel
        ? `${selectedTree.label} — Lv ${targetLevel}`
        : `${selectedTree.label} — Lv ${currentLevel} -> ${nextLevel}`;
    costLine =
      targetLevel === nextLevel
        ? `Cost: ${formatGameNumber(Math.ceil(selectedTree.rootCostCurve(nextLevel)))} quanta`
        : targetLevel <= currentLevel
          ? 'Already owned'
          : `Requires Lv ${currentLevel + 1} first`;
    previewText =
      selectedTree.milestones[targetLevel]?.desc ??
      `${selectedTree.label} grows stronger at Lv ${targetLevel}.`;
  } else if (selection.kind === 'cross' && selectedCross) {
    heading = selectedCross.label;
    costLine = `Cost: ${formatWhole(selectedCross.spCost)} SP`;
    previewText = selectedCross.description;
  } else if (selection.kind === 'crossSlot' && selectedSlotTree) {
    heading = `${selectedSlotTree.label} — Lv ${selection.tier} cross slot`;
    costLine = `Unlocks at Stage ${getSlotUnlockStage(selection.tier)}`;
    previewText =
      selectedSlotTree.milestones[selection.tier]?.desc ??
      'This milestone slot is reserved for a future cross-node.';
  }

  const tutorialSteps = [
    {
      label: 'What is the skill tree?',
      body: '스킬 트리는 너의 우주를 강화하는 도구야. 4개의 트랙(Click, Crit, Idle, Time)에 레벨을 올려서 더 강해져.',
    },
    {
      label: 'Track levels',
      body: '각 트랙은 1부터 30까지 올릴 수 있어. 클릭해서 quanta로 사봐.',
    },
    {
      label: 'Milestones',
      body: '5, 10, 15, 20, 25, 30 레벨마다 SP로 살 수 있는 milestone node가 열려. 자동 보너스가 아니라 직접 구매해야 해.',
    },
    {
      label: "What's next?",
      body: '다른 트랙은 다음 스테이지로 가면 풀려. 일단 Stellar Forge로 시작해보자.',
    },
  ];

  const dismissTutorial = () => {
    setTutorialActive(false);
    setTutorialStep(0);
    dispatch({ type: 'MARK_TUTORIAL_FLAG', flagId: 'skill_tree_intro' });
  };

  const selectWithPopup = (nextSelection: Selection, event: ReactMouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setSelection(nextSelection);
    const flipBelow = event.clientY < 150;
    setPopup({
      selection: nextSelection,
      x: event.clientX,
      y: event.clientY + (flipBelow ? 36 : -12),
    });
  };

  const popupLeft = popup ? Math.max(12, Math.min(window.innerWidth - 224, popup.x - 100)) : 0;
  const popupTop = popup
    ? popup.y < 150
      ? Math.max(12, popup.y)
      : Math.max(12, popup.y - 132)
    : 0;

  return (
    <div className="skills-overlay" onClick={onClose} role="presentation">
      <aside className="skills-drawer" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="skills-header">
          <div>
            <div className="q-stage">Cosmic Skills</div>
            <div className="skills-title-row">
              <h2>Unified Tree</h2>
              <button
                type="button"
                className="help-button"
                aria-label="Replay skill tutorial"
                onClick={() => {
                  setTutorialActive(true);
                  setTutorialStep(0);
                }}
              >
                ?
              </button>
            </div>
            <p className="skills-subtitle">Spend quanta to level up. Spend SP to unlock cross-nodes.</p>
          </div>
          <button type="button" className="mini-button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="skills-meta">{summary}</div>

        <div className="skills-graph unified">
          <CrossNodeConnections state={state} visibleTier={visibleTier} />
          <div className="skills-track-row">
            {SKILL_TREES.map((tree) => (
              <TrackColumn
                key={tree.id}
                treeId={tree.id}
                state={state}
                visibleTier={visibleTier}
                selection={selection}
                onSelect={selectWithPopup}
              />
            ))}
          </div>
        </div>

        {popup ? (
        <div
          ref={popupRef}
          className={`skills-detail skill-popup ${popup.y < 150 ? 'below' : 'above'}`}
          style={{ left: popupLeft, top: popupTop }}
        >
          <strong>{heading}</strong>
          <p>{previewText}</p>
          {selection.kind === 'cross' && selectedCross ? (
            <div className="cross-req-list">
              {Object.entries(selectedCross.requires).map(([trackId, requiredLevel]) => {
                const tree = findTree(trackId as SkillTreeId);
                const current = state.skills[trackId as SkillTreeId].level;
                const met = current >= (requiredLevel ?? 0);
                return (
                  <span key={trackId} className={met ? 'met' : 'unmet'}>
                    {`${met ? 'OK' : 'NO'} ${tree?.label ?? trackId} Lv ${requiredLevel} (you: ${current})`}
                  </span>
                );
              })}
            </div>
          ) : null}
          <div className="skills-detail-line">{costLine}</div>
          <div className="skills-detail-line">{`Balance: ${formatWhole(state.skillPoints)} SP · ${formatGameNumber(state.quanta)} quanta`}</div>
          <div className="skills-detail-line">{`Now: Click ${formatWhole(getClickPower(currentModifiers))} · Auto ${formatWhole(getAutoRate(currentModifiers))}/s · Crit x${formatWhole(getCritMultiplier(state.skills.crit.level, currentModifiers))} · Time x${formatWhole(getTimeMultiplier(state.skills.time.level, currentModifiers))}`}</div>
          {lockedReason ? <div className="skills-locked-reason">{lockedReason}</div> : null}
          <button type="button" className="q-continue skills-buy" disabled={!canBuy} onClick={buy}>
            {selection.kind === 'track' ? 'Buy +1 Level' : 'Buy Cross Node'}
          </button>
        </div>
        ) : null}

        {tutorialActive ? (
          <div className="skills-walkthrough" role="dialog" aria-live="polite">
            <div className={`tutorial-focus step-${tutorialStep + 1}`} />
            <div className="walkthrough-card">
              <div className="q-stage">{`Step ${tutorialStep + 1} / ${tutorialSteps.length}`}</div>
              <strong>{tutorialSteps[tutorialStep].label}</strong>
              <p>{tutorialSteps[tutorialStep].body}</p>
              <div className="walkthrough-actions">
                {tutorialStep > 0 ? (
                  <button type="button" className="mini-button" onClick={() => setTutorialStep((step) => step - 1)}>
                    Back
                  </button>
                ) : null}
                {tutorialStep < tutorialSteps.length - 1 ? (
                  <button type="button" className="q-continue" onClick={() => setTutorialStep((step) => step + 1)}>
                    Next
                  </button>
                ) : (
                  <button type="button" className="q-continue" onClick={dismissTutorial}>
                    Got it!
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
