import { useRef, useState } from 'react';
import type { GameState } from '../game/types';
import { t, stageName, type Lang } from '../i18n';
import { useModalA11y } from '../hooks/useModalA11y';
import { ENTITY_COST_ANCHORS } from '../game/balance';
import { STAGES } from '../game/stages';
import { getStageMilestoneActiveIds, milestoneEraLog } from '../game/milestones';
import { ALMANAC, pickLang } from '../game/almanac';
import { pickLogText } from '../game/stageLogs';
import { milestoneLoreId } from '../game/loreLinks';
import { LoreModal } from './LoreModal';
import { formatGameNumberShort } from '../game/formulas';
import {
  getQuest,
  getQuestProgress,
  isQuestClaimable,
  pastQuestProgress,
  questDesc,
  questTitle,
  type QuestDef,
} from '../game/quests';

/** Remove filler words like "roughly", "about", "near", "approximately" from era values */
function stripPrefix(s: string | undefined): string {
  if (!s) return '';
  return s
    .replace(/^(roughly|about|near|approximately|circa|~)\s+/i, '')
    .replace(/,?\s*(model[- ]dependent|uncertain|speculative|theoretical|estimated)/gi, '')
    .trim();
}

interface QuestPanelProps {
  state: GameState;
  language: Lang;
  onClaim: (questId: string) => void;
  /** 🅠6: navigate the game's viewed stage (canvas scene) when a quest tab is tapped. */
  onStageSelect?: (stageId: number) => void;
  onClose: () => void;
}

/** Matter reward resolved at the current stage anchor (era-relative, 🅠5). */
function rewardMatter(quest: QuestDef, stageId: number): number {
  const anchor = ENTITY_COST_ANCHORS[stageId as keyof typeof ENTITY_COST_ANCHORS] ?? ENTITY_COST_ANCHORS[16];
  return Math.floor(anchor * (quest.reward.matterAnchorFrac ?? 0));
}

export function QuestPanel({ state, language, onClaim, onStageSelect, onClose }: QuestPanelProps) {
  const stageId = STAGES[Math.min(state.stageIdx, STAGES.length - 1)].id;

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

  // Per-quest era-record lore reveal (merged from 우주도감). Disables the panel's
  // focus trap while the nested LoreModal owns focus (mirror AlmanacOverlay).
  const [openLoreId, setOpenLoreId] = useState<string | null>(null);

  // Era header for the SELECTED tab's era (tabStage, not the live stage).
  const tabAlmanac = ALMANAC[tabStage];
  const tabStageMeta = STAGES.find((s) => s.id === tabStage);
  const tabEraName = pickLang(tabAlmanac?.title, language)
    || (tabStageMeta ? stageName(language, tabStageMeta.id, tabStageMeta.name) : '');

  const overlayRef = useRef<HTMLDivElement>(null);
  useModalA11y(overlayRef, onClose, openLoreId === null);

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

        {/* User: per-stage quest tabs — cleared stages no longer vanish; tab back to
            view each stage's quests (S{n}). Only shown once past stage 1. Tapping a
            tab also flies the canvas to that era (🅠6, was the 우주도감 pill strip). */}
        {stageId > 1 ? (
          <div className="quest-tabs cc-scroll cc-scroll--hidden" role="tablist">
            {Array.from({ length: stageId }, (_, i) => i + 1).map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={s === tabStage}
                className={`quest-tab ${s === tabStage ? 'quest-tab--active' : ''}`}
                onClick={() => { setTabStage(s); onStageSelect?.(s); }}
              >
                {`S${s}`}
              </button>
            ))}
          </div>
        ) : null}

        {/* 우주도감 era header for the SELECTED tab's era (merged in from AlmanacOverlay):
            name + flavor + two cosmic-era chips. Sits at the top of the quest list so the
            player reads that era's identity while working its quests. */}
        {tabAlmanac ? (
          <div className="quest-era">
            <div className="quest-era__name">{tabEraName}</div>
            {pickLang(tabAlmanac.short, language) ? (
              <div className="quest-era__flavor">{pickLang(tabAlmanac.short, language)}</div>
            ) : null}
            {tabAlmanac.cosmicEra ? (
              <div className="almanac-era-tags">
                <span className="almanac-era-tag">{stripPrefix(pickLang(tabAlmanac.cosmicEra.timeRange, language))}</span>
                <span className="almanac-era-tag">{stripPrefix(pickLang(tabAlmanac.cosmicEra.temperature, language))}</span>
              </div>
            ) : null}
          </div>
        ) : null}

        {questRows.length === 0 ? (
          <div className="quest-panel__empty">
            {tabStage === stageId ? t(language, 'questAllDone') : t(language, 'questStageEmpty')}
          </div>
        ) : (
          <div className="quest-list">
            {questRows.map(({ quest, status }) => {
              // User: a quest's reward is FIXED to ITS stage (the tab's stage = where the quest
              // belongs) — not the inflated current stage. Matches handleClaimQuest, which anchors
              // to milestoneStageId(quest). So a past-era quest shows + pays that era's amount.
              const matter = rewardMatter(quest, tabStage);
              const stones = quest.reward.stones ?? 0;
              // 시대 기록 — the era-record this quest unlocks (#42 1:1 map). A CLAIMED
              // quest shows the record in full + a → to open its LoreModal; an unclaimed
              // quest shows a "not yet earned" placeholder (all rows visible, no padlock).
              const log = milestoneEraLog(quest.id);
              const claimed = status === 'claimed';
              const loreRow = log ? (
                <div className={`quest-lore ${claimed ? 'quest-lore--open' : 'quest-lore--locked'}`}>
                  <div className="quest-lore__head">{t(language, 'almanacMilestones')}</div>
                  {claimed ? (
                    <div className="quest-lore__body">
                      <div className="quest-lore__text">
                        <div className="quest-lore__title">{pickLogText(log.title, language)}</div>
                        <div className="quest-lore__msg">{pickLogText(log.message, language)}</div>
                      </div>
                      <button
                        type="button"
                        className="quest-lore__more"
                        onClick={() => setOpenLoreId(milestoneLoreId(log.stageId, log.progress, log.title.en))}
                      >
                        →
                      </button>
                    </div>
                  ) : (
                    <div className="quest-lore__locked">{t(language, 'almanacLogLocked')}</div>
                  )}
                </div>
              ) : null;
              if (status === 'active') {
                const progress = getQuestProgress(quest, state);
                const claimable = isQuestClaimable(quest, state);
                const pct = Math.round((progress / quest.target) * 100);
                return (
                  <div key={quest.id} className="quest-card-wrap">
                    <div className={`quest-card ${claimable ? 'quest-card--ready' : ''}`}>
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
                    {loreRow}
                  </div>
                );
              }
              if (status === 'past') {
                // A left stage's open quest. Codex/archive quests read LIVE (revisiting to
                // collect keeps filling them); other tracks render their FROZEN snapshot
                // ("{snap}/{target}"). Either way, hitting the target keeps it CLAIMABLE here.
                const snap = pastQuestProgress(quest, state);
                const claimable = snap >= quest.target;
                const pct = Math.round((snap / quest.target) * 100);
                return (
                  <div key={quest.id} className="quest-card-wrap">
                    <div className={`quest-card ${claimable ? 'quest-card--ready' : ''}`}>
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
                    {loreRow}
                  </div>
                );
              }
              // claimed — a compact per-stage RECORD card + its revealed era-record.
              return (
                <div key={quest.id} className="quest-card-wrap">
                  <div className={`quest-card quest-card--record quest-card--${status}`}>
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
                  {loreRow}
                </div>
              );
            })}
          </div>
        )}
      </div>
      {openLoreId !== null ? (
        <LoreModal loreId={openLoreId} language={language} onClose={() => setOpenLoreId(null)} />
      ) : null}
    </div>
  );
}
