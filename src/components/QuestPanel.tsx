import { useRef } from 'react';
import type { GameState } from '../game/types';
import { t, type Lang } from '../i18n';
import { useModalA11y } from '../hooks/useModalA11y';
import { ENTITY_COST_ANCHORS } from '../game/balance';
import { STAGES } from '../game/stages';
import { formatGameNumberShort } from '../game/formulas';
import {
  getQuest,
  getQuestProgress,
  isQuestClaimable,
  questDesc,
  questTitle,
  type QuestDef,
} from '../game/quests';

interface QuestPanelProps {
  state: GameState;
  language: Lang;
  onClaim: (questId: string) => void;
  onClose: () => void;
}

/** Matter reward resolved at the current stage anchor (era-relative, 🅠5). */
function rewardMatter(quest: QuestDef, stageId: number): number {
  const anchor = ENTITY_COST_ANCHORS[stageId as keyof typeof ENTITY_COST_ANCHORS] ?? ENTITY_COST_ANCHORS[16];
  return Math.floor(anchor * (quest.reward.matterAnchorFrac ?? 0));
}

export function QuestPanel({ state, language, onClaim, onClose }: QuestPanelProps) {
  const stageId = STAGES[Math.min(state.stageIdx, STAGES.length - 1)].id;
  const quests = state.activeQuests
    .map((id) => getQuest(id))
    .filter((q): q is QuestDef => q !== undefined);

  const overlayRef = useRef<HTMLDivElement>(null);
  useModalA11y(overlayRef, onClose);

  return (
    <div className="quest-overlay" role="dialog" aria-modal="true" aria-label={t(language, 'questTitle')} onClick={onClose} ref={overlayRef} tabIndex={-1}>
      <div className="quest-panel cc-scroll" onClick={(e) => e.stopPropagation()}>
        <div className="quest-panel__head">
          <h2 className="quest-panel__title">{t(language, 'questTitle')}</h2>
          <span className="quest-panel__done">
            {t(language, 'questCompleted').replace('{n}', String(state.completedQuestIds.length))}
          </span>
          <button type="button" className="quest-panel__close" onClick={onClose} aria-label={t(language, 'fuseClose')}>✕</button>
        </div>

        {quests.length === 0 ? (
          <div className="quest-panel__empty">{t(language, 'questAllDone')}</div>
        ) : (
          <div className="quest-list">
            {quests.map((quest) => {
              const progress = getQuestProgress(quest, state);
              const claimable = isQuestClaimable(quest, state);
              const matter = rewardMatter(quest, stageId);
              const stones = quest.reward.stones ?? 0;
              const pct = Math.round((progress / quest.target) * 100);
              return (
                <div key={quest.id} className={`quest-card ${claimable ? 'quest-card--ready' : ''}`}>
                  <div className="quest-card__main">
                    <div className="quest-card__title">{questTitle(quest, language)}</div>
                    <div className="quest-card__desc">{questDesc(quest, language)}</div>
                    <div className="quest-card__bar" aria-hidden="true">
                      <div className="quest-card__fill" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="quest-card__progress">{`${progress} / ${quest.target}`}</div>
                  </div>
                  <div className="quest-card__side">
                    <div className="quest-card__reward">
                      {matter > 0 ? <span className="quest-card__matter">{`⚛${formatGameNumberShort(matter)}`}</span> : null}
                      {stones > 0 ? <span className="quest-card__stones">{`💎${stones}`}</span> : null}
                    </div>
                    <button
                      type="button"
                      className="quest-card__claim"
                      disabled={!claimable}
                      onClick={() => onClaim(quest.id)}
                    >
                      {claimable ? t(language, 'questClaim') : `${pct}%`}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
