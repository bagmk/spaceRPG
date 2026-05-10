import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, MouseEvent as ReactMouseEvent } from 'react';
import {
  CROSS_NODES,
  SKILL_TREES,
  findNode,
  findTree,
  getVisibleCrossTier,
} from '../../game/skills/definitions';
import type { CrossNodeDef, SkillTreeId } from '../../game/skills/types';
import type { GameAction } from '../../game/reducer';
import type { GameState } from '../../game/types';
import { formatGameNumber, formatWhole } from '../../game/formulas';

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
function getTrackLevels(maxLevel: number): number[] {
  return Array.from({ length: maxLevel }, (_, index) => maxLevel - index);
}

const TRACK_SYMBOLS: Record<SkillTreeId, string> = {
  click: 'F',
  crit: 'Q',
  auto: 'W',
  time: 'T',
};

function getStatPreview(treeId: SkillTreeId, currentLevel: number): string {
  const next = currentLevel + 1;
  switch (treeId) {
    case 'click': {
      const cur = formatGameNumber(Math.pow(2, currentLevel));
      const nxt = formatGameNumber(Math.pow(2, next));
      return `Click: ×${cur} → ×${nxt}`;
    }
    case 'auto': {
      const cur = currentLevel <= 0 ? '0' : formatGameNumber(Math.pow(2, currentLevel));
      const nxt = formatGameNumber(Math.pow(2, next));
      return `Auto: ${cur}/s → ${nxt}/s`;
    }
    case 'crit': {
      const curC = (currentLevel * 1.5).toFixed(1);
      const nxtC = (next * 1.5).toFixed(1);
      const curM = (1.5 + currentLevel * 0.5).toFixed(1);
      const nxtM = (1.5 + next * 0.5).toFixed(1);
      return `Crit: ${curC}% → ${nxtC}%  ×${curM} → ×${nxtM}`;
    }
    case 'time': {
      return `Time: 10^${currentLevel} → 10^${next} (/s)`;
    }
  }
}

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
  if (targetLevel > tree.rootMaxLevel) {
    return `Max Lv ${tree.rootMaxLevel}`;
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


function TrackColumn({
  treeId,
  state,
  dispatch,
  visibleTier,
  selection,
  onSelect,
}: {
  treeId: SkillTreeId;
  state: GameState;
  dispatch: Dispatch<GameAction>;
  visibleTier: number;
  selection: Selection;
  onSelect: (selection: Selection, event: ReactMouseEvent<HTMLElement>) => void;
}) {
  const tree = findTree(treeId)!;
  const level = state.skills[treeId].level;
  const unlocked = state.skills.unlockedTracks.includes(treeId);
  const gridRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const targetLevel = Math.max(1, Math.min(tree.rootMaxLevel, level + 1));
    const target = gridRef.current?.querySelector<HTMLElement>(`[data-level="${targetLevel}"]`);
    target?.scrollIntoView({ block: 'center' });
  }, [level, tree.rootMaxLevel]);

  return (
    <div
      className={`skill-track ${unlocked ? 'unlocked' : 'locked'}`}
      title={unlocked ? tree.label : `Unlocks at Stage ${tree.unlockStageId}`}
    >
      <div className="skill-track-head">
        <div className="skill-track-name" style={{ color: unlocked ? tree.color : undefined }}>
          {tree.label}
        </div>
        <div className="skill-track-subhead">
          <span className="skill-track-badge" style={{ color: unlocked ? tree.color : undefined }}>
            ({TRACK_SYMBOLS[treeId]})
          </span>
          <span>{`Lv ${level}`}</span>
        </div>
      </div>
      <div ref={gridRef} className="skill-track-grid" aria-label={`${tree.label} levels`}>
        {getTrackLevels(tree.rootMaxLevel).map((slot) => {
          const milestone = MILESTONES.includes(slot as MilestoneLevel)
            ? (slot as MilestoneLevel)
            : null;
          const crossNode = milestone ? getCrossNodeForSlot(treeId, milestone) : null;
          const isCurrent = unlocked && slot === level;
          const isFilled = unlocked && slot < level;
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
          return (
            <div key={slot} className={`skill-row ${milestone ? 'milestone-row' : ''}`} data-level={slot}>
              <button
                type="button"
                className={`skill-cell ${isCurrent ? 'current' : isFilled ? 'filled' : isNext ? 'next' : 'future'} ${
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
                    crossSelected ? 'selected' : ''
                  }`}
                  disabled={!unlocked}
                  onClick={(event) =>
                    crossNode
                      ? onSelect({ kind: 'cross', nodeId: crossNode.id }, event)
                      : onSelect({ kind: 'crossSlot', trackId: treeId, tier: milestone }, event)
                  }
                  title={crossNode ? crossNode.label : `Milestone cross-node slot, Lv ${milestone}`}
                >
                  {crossOwned ? '*' : '+'}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
      {unlocked && level < tree.rootMaxLevel ? (
        <button
          type="button"
          className={`track-upgrade-btn ${getTrackLockedReason(state, treeId, level + 1) === null ? 'affordable' : ''}`}
          disabled={getTrackLockedReason(state, treeId, level + 1) !== null}
          onClick={() => dispatch({ type: 'BUY_TRACK_LEVEL', trackId: treeId })}
        >
          ↑ Lv {level + 1}
        </button>
      ) : null}
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
    () => `Quanta ${formatGameNumber(state.quanta)}   SP ${formatWhole(state.skillPoints)}`,
    [state.quanta, state.skillPoints],
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

  let heading = 'Select a node';
  let costLine = '';
  let statPreview = '';

  if (selection.kind === 'track' && selectedTree) {
    const currentLevel = state.skills[selection.trackId].level;
    const nextLevel = currentLevel + 1;
    const targetLevel = selection.level;
    heading =
      targetLevel <= currentLevel
        ? `Lv ${targetLevel} — owned`
        : `→ Lv ${nextLevel}`;
    costLine =
      targetLevel === nextLevel
        ? `Cost: ${formatGameNumber(Math.ceil(selectedTree.rootCostCurve(nextLevel)))} quanta`
        : targetLevel <= currentLevel
          ? 'Already owned'
          : `Requires Lv ${currentLevel + 1} first`;
    if (targetLevel === nextLevel) {
      statPreview = getStatPreview(selection.trackId, currentLevel);
    }
  } else if (selection.kind === 'cross' && selectedCross) {
    heading = selectedCross.label;
    costLine = `Cost: ${formatWhole(selectedCross.spCost)} SP`;
    statPreview = selectedCross.description;
  } else if (selection.kind === 'crossSlot' && selectedSlotTree) {
    heading = `Lv ${selection.tier} milestone slot`;
    costLine = `Unlocks at Stage ${getSlotUnlockStage(selection.tier)}`;
  }

  const tutorialSteps = [
    {
      label: 'What is the skill tree?',
      body: '스킬 트리는 너의 우주를 강화하는 도구야. 4개의 트랙(Click, Crit, Idle, Time)에 레벨을 올려서 더 강해져.',
    },
    {
      label: 'Track levels',
      body: 'Click, Idle, Crit은 50까지, Time은 40까지 올릴 수 있어. 클릭해서 quanta로 사봐.',
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
    setPopup({
      selection: nextSelection,
      x: event.clientX,
      y: event.clientY,
    });
  };

  // Popup should appear to the left of the click (drawer is on the right)
  const popupLeft = popup ? Math.max(8, Math.min(window.innerWidth - 230, popup.x - 240)) : 0;
  const popupTop = popup ? Math.max(8, Math.min(window.innerHeight - 180, popup.y - 60)) : 0;

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
          <div className="skills-track-row">
            {SKILL_TREES.map((tree) => (
              <TrackColumn
                key={tree.id}
                treeId={tree.id}
                state={state}
                dispatch={dispatch}
                visibleTier={visibleTier}
                selection={selection}
                onSelect={selectWithPopup}
              />
            ))}
          </div>
        </div>

      </aside>

      {tutorialActive ? (
        <div className="skills-walkthrough" role="dialog" aria-live="polite">
          <div className={`tutorial-focus step-${tutorialStep + 1}`} />
          <div className="walkthrough-card" onClick={(e) => e.stopPropagation()}>
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

      {popup ? (
        <div
          ref={popupRef}
          className="skills-detail skill-popup above"
          style={{ left: popupLeft, top: popupTop }}
          onClick={(event) => event.stopPropagation()}
        >
          <strong>{heading}</strong>
          <div className="skills-detail-line">{costLine}</div>
          {statPreview ? <div className="skill-stat-preview">{statPreview}</div> : null}
          {lockedReason ? <div className="skills-locked-reason">{lockedReason}</div> : null}
          <button type="button" className="q-continue skills-buy" disabled={!canBuy} onClick={buy}>
            UPGRADE
          </button>
        </div>
      ) : null}
    </div>
  );
}
