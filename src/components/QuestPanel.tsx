import { useRef, useState } from 'react';
import type { GameState } from '../game/types';
import { t, type Lang } from '../i18n';
import { useModalA11y } from '../hooks/useModalA11y';
import { ENTITY_COST_ANCHORS, ATTENDANCE_REWARDS } from '../game/balance';
import { STAGES } from '../game/stages';
import { getStageMilestoneActiveIds } from '../game/milestones';
import { toDateKey } from '../game/shop/daily';
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
  /** v27: claim today's daily attendance reward. */
  onClaimAttendance: () => void;
  onClose: () => void;
}

/** Matter reward resolved at the current stage anchor (era-relative, 🅠5). */
function rewardMatter(quest: QuestDef, stageId: number): number {
  const anchor = ENTITY_COST_ANCHORS[stageId as keyof typeof ENTITY_COST_ANCHORS] ?? ENTITY_COST_ANCHORS[16];
  return Math.floor(anchor * (quest.reward.matterAnchorFrac ?? 0));
}

export function QuestPanel({ state, language, onClaim, onClaimAttendance, onClose }: QuestPanelProps) {
  const stageId = STAGES[Math.min(state.stageIdx, STAGES.length - 1)].id;
  // v27 daily attendance: cycleDay = the next reward index (0-6); ✓ for passed days.
  const attClaimedToday = state.attendanceClaimedDate === toDateKey(Date.now());
  const attCycleDay = state.attendanceStreak % ATTENDANCE_REWARDS.length;
  const attReward = ATTENDANCE_REWARDS[attCycleDay];
  const attAnchor = ENTITY_COST_ANCHORS[stageId as keyof typeof ENTITY_COST_ANCHORS] ?? ENTITY_COST_ANCHORS[16];
  const attMatter = Math.ceil(attReward.matterAnchorMult * attAnchor);

  // User: quests from a cleared stage shouldn't vanish — let you tab back to view each
  // stage's quests. The CURRENT stage tab shows live/claimable quests; PAST stage tabs
  // show that stage's record (✓ claimed) PLUS each open quest's FROZEN snapshot
  // progress (v29 stageQuestProgress) — and if a snapshot hit its target but was never
  // claimed, the quest stays CLAIMABLE here (no replay needed).
  const [tabStage, setTabStage] = useState(stageId);
  const milestoneStageOf = (id: string): number => {
    const p = id.split('.');
    return p[0] === 'm' ? Number(p[1]) : NaN;
  };
  // 'active' = live current-stage progress; 'past' = a left-stage quest shown with its
  // frozen snapshot (claimable when snapshot ≥ target); 'claimed' = already rewarded.
  type QuestRow = { quest: QuestDef; status: 'active' | 'past' | 'claimed' };
  const claimedForTab = state.completedQuestIds.filter((id) => milestoneStageOf(id) === tabStage);
  const openForTab = tabStage === stageId
    ? state.activeQuests
    : getStageMilestoneActiveIds(tabStage, state.completedQuestIds);
  const questRows: QuestRow[] = [
    ...openForTab.map((id) => ({ id, status: (tabStage === stageId ? 'active' : 'past') as QuestRow['status'] })),
    ...claimedForTab.map((id) => ({ id, status: 'claimed' as QuestRow['status'] })),
  ]
    .map(({ id, status }) => ({ quest: getQuest(id), status }))
    .filter((r): r is QuestRow => r.quest !== undefined);

  const overlayRef = useRef<HTMLDivElement>(null);
  useModalA11y(overlayRef, onClose);

  return (
    <div className="quest-overlay" role="dialog" aria-modal="true" aria-label={t(language, 'questTitle')} onClick={onClose} ref={overlayRef} tabIndex={-1}>
      <div className="quest-panel cc-scroll cc-scroll--hidden" onClick={(e) => e.stopPropagation()}>
        <div className="quest-panel__head">
          <h2 className="quest-panel__title">{t(language, 'questTitle')}</h2>
          <span className="quest-panel__done">
            {t(language, 'questCompleted').replace('{n}', String(state.completedQuestIds.length))}
          </span>
          <button type="button" className="quest-panel__close" onClick={onClose} aria-label={t(language, 'fuseClose')}>✕</button>
        </div>

        {/* v27: daily attendance — a repeating 7-day check-in (day 7 = gift, then loops). */}
        <div className="attendance">
          <div className="attendance__head">
            <span className="attendance__title">{t(language, 'attendanceTitle')}</span>
          </div>
          <div className="attendance__row">
            {ATTENDANCE_REWARDS.map((r, i) => {
              const claimed = i < attCycleDay;
              const current = i === attCycleDay && !attClaimedToday;
              const gift = i === ATTENDANCE_REWARDS.length - 1;
              return (
                <div
                  key={i}
                  className={`attendance__day ${claimed ? 'attendance__day--claimed' : ''} ${current ? 'attendance__day--current' : ''} ${gift ? 'attendance__day--gift' : ''}`}
                >
                  <span className="attendance__day-n">{`D${i + 1}`}</span>
                  <span className="attendance__day-reward">{gift ? '🎁' : r.stones > 0 ? `◆${r.stones}` : '⚛'}</span>
                  {claimed ? <span className="attendance__day-check">✓</span> : null}
                </div>
              );
            })}
          </div>
          <button
            type="button"
            className="attendance__claim"
            disabled={attClaimedToday}
            onClick={onClaimAttendance}
          >
            {attClaimedToday
              ? t(language, 'attendanceClaimedToday')
              : `${t(language, 'attendanceClaim')} · ${attReward.gachaBoxId
                  ? `🎁 ${t(language, 'attendanceBoxGift')}`
                  : [attMatter > 0 ? `⚛${formatGameNumberShort(attMatter)}` : '', attReward.stones > 0 ? `◆${attReward.stones}` : ''].filter(Boolean).join(' ')}`}
          </button>
        </div>

        {/* User: per-stage quest tabs — cleared stages no longer vanish; tab back to
            view each stage's quests (S{n}). Only shown once past stage 1. */}
        {stageId > 1 ? (
          <div className="quest-tabs cc-scroll cc-scroll--hidden" role="tablist">
            {Array.from({ length: stageId }, (_, i) => i + 1).map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={s === tabStage}
                className={`quest-tab ${s === tabStage ? 'quest-tab--active' : ''}`}
                onClick={() => setTabStage(s)}
              >
                {`S${s}`}
              </button>
            ))}
          </div>
        ) : null}

        {questRows.length === 0 ? (
          <div className="quest-panel__empty">
            {tabStage === stageId ? t(language, 'questAllDone') : t(language, 'questStageEmpty')}
          </div>
        ) : (
          <div className="quest-list">
            {questRows.map(({ quest, status }) => {
              // Reward is granted at the CURRENT stage anchor (handleClaimQuest), so a
              // past-stage claim shows the matter it will actually pay, not the old era's.
              const matter = rewardMatter(quest, status === 'past' ? stageId : tabStage);
              const stones = quest.reward.stones ?? 0;
              if (status === 'active') {
                const progress = getQuestProgress(quest, state);
                const claimable = isQuestClaimable(quest, state);
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
                        {matter > 0 ? <span className="quest-card__matter"><span className="qsym">⚛</span>{formatGameNumberShort(matter)}</span> : null}
                        {stones > 0 ? <span className="quest-card__stones">{`◆${stones}`}</span> : null}
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
              }
              if (status === 'past') {
                // v29: a left stage's open quest — render its FROZEN snapshot progress
                // ("{snap}/{target}"); if the snapshot met the target it is still
                // CLAIMABLE here (the reward was earned, just never collected).
                const snap = Math.min(quest.target, state.stageQuestProgress[tabStage]?.[quest.id] ?? 0);
                const claimable = snap >= quest.target;
                const pct = Math.round((snap / quest.target) * 100);
                return (
                  <div key={quest.id} className={`quest-card ${claimable ? 'quest-card--ready' : ''}`}>
                    <div className="quest-card__main">
                      <div className="quest-card__title">{questTitle(quest, language)}</div>
                      <div className="quest-card__desc">{questDesc(quest, language)}</div>
                      <div className="quest-card__bar" aria-hidden="true">
                        <div className="quest-card__fill" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="quest-card__progress">{`${snap} / ${quest.target}`}</div>
                    </div>
                    <div className="quest-card__side">
                      <div className="quest-card__reward">
                        {matter > 0 ? <span className="quest-card__matter"><span className="qsym">⚛</span>{formatGameNumberShort(matter)}</span> : null}
                        {stones > 0 ? <span className="quest-card__stones">{`◆${stones}`}</span> : null}
                      </div>
                      {claimable ? (
                        <button
                          type="button"
                          className="quest-card__claim"
                          onClick={() => onClaim(quest.id)}
                        >
                          {t(language, 'questClaim')}
                        </button>
                      ) : (
                        <span className="quest-card__status quest-card__status--missed">{`${pct}%`}</span>
                      )}
                    </div>
                  </div>
                );
              }
              // claimed — a compact per-stage RECORD card.
              return (
                <div key={quest.id} className={`quest-card quest-card--record quest-card--${status}`}>
                  <div className="quest-card__main">
                    <div className="quest-card__title">{questTitle(quest, language)}</div>
                    <div className="quest-card__desc">{questDesc(quest, language)}</div>
                  </div>
                  <div className="quest-card__side">
                    <span className={`quest-card__status quest-card__status--${status}`}>
                      {`✓ ${t(language, 'questDone')}`}
                    </span>
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
