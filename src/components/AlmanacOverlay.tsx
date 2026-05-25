import { useEffect, useRef, useState } from 'react';
import { ALMANAC, pickLang } from '../game/almanac';
import { STAGE_LOGS, getLogsForStage, pickLogText } from '../game/stageLogs';
import { STAGES } from '../game/stages';
import { t, stageName, type Lang } from '../i18n';
import { milestoneLoreId } from '../game/loreLinks';
import { LoreModal } from './LoreModal';

/** Remove filler words like "roughly", "about", "near", "approximately" from era values */
function stripPrefix(s: string | undefined): string {
  if (!s) return '';
  return s
    .replace(/^(roughly|about|near|approximately|circa|~)\s+/i, '')
    .replace(/,?\s*(model[- ]dependent|uncertain|speculative|theoretical|estimated)/gi, '')
    .trim();
}

interface AlmanacOverlayProps {
  currentStageId: number;
  progressPercent: number;
  language: Lang;
  onClose: () => void;
  onUITap?: () => void;
}

export function AlmanacOverlay({ currentStageId, progressPercent, language, onClose, onUITap }: AlmanacOverlayProps) {
  const [selectedId, setSelectedId] = useState(currentStageId);
  const [activeLoreId, setActiveLoreId] = useState<string | null>(null);
  const pillsRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const infoRef = useRef<HTMLDivElement | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = pillsRef.current;
    if (!container) return;
    const btn = container.querySelector<HTMLButtonElement>(`[data-stage-id="${selectedId}"]`);
    btn?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [selectedId]);

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    infoRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    logRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [selectedId]);

  const isPast = (id: number) => id < currentStageId;
  const isCurrent = (id: number) => id === currentStageId;
  const isFuture = (id: number) => id > currentStageId;

  const allLogs = getLogsForStage(selectedId);
  const effectiveProgress = isPast(selectedId) ? 100 : isCurrent(selectedId) ? progressPercent : -1;

  const almanac = ALMANAC[selectedId];
  const stageMeta = STAGES.find((s) => s.id === selectedId);
  const localizedStageName = stageMeta ? stageName(language, stageMeta.id, stageMeta.name) : t(language, 'almanacUnknown');

  const unlockedCount = STAGE_LOGS.filter((l) => {
    if (l.stageId < currentStageId) return true;
    if (l.stageId === currentStageId) return progressPercent >= l.progress;
    return false;
  }).length;
  const totalCount = STAGE_LOGS.length;

  return (
    <div className="overlay-backdrop" role="dialog" aria-modal="true" aria-label={t(language, 'almanacTitle')}>
      <div className="overlay-card almanac-overlay">
        <div className="almanac-header">
          <div>
            <span className="q-stage">{t(language, 'almanacTitle')}</span>
            <span className="almanac-badge">{`${unlockedCount} / ${totalCount} ${t(language, 'almanacDiscovered')}`}</span>
          </div>
          <button className="mini-button" type="button" onClick={onClose}>{t(language, 'almanacClose')}</button>
        </div>

        <div className="almanac-stage-pills" ref={pillsRef}>
          {STAGES.map((s) => {
            const state = isPast(s.id) ? 'past' : isCurrent(s.id) ? 'current' : 'future';
            return (
              <button
                key={s.id}
                type="button"
                data-stage-id={s.id}
                className={`almanac-pill almanac-pill--${state} ${selectedId === s.id ? 'almanac-pill--active' : ''}`}
                style={{ '--pill-accent': s.accent } as React.CSSProperties}
                onClick={() => { setSelectedId(s.id); onUITap?.(); }}
              >
                <span className="almanac-pill-num">{String(s.id).padStart(2, '0')}</span>
                {isFuture(s.id) ? <span className="almanac-pill-lock">🔒</span> : null}
              </button>
            );
          })}
        </div>

        <div className="almanac-scroll" ref={contentRef} style={{ '--stage-accent': stageMeta?.accent ?? '#8090b0' } as React.CSSProperties}>
          {/* Description — always visible at top */}
          <div className="almanac-desc">
            <h2 className="almanac-stage-name">
              {isFuture(selectedId)
                ? <span className="almanac-locked-name">{localizedStageName}</span>
                : (pickLang(almanac?.title, language) || localizedStageName)}
            </h2>

            {isFuture(selectedId) ? (
              <p className="almanac-locked-body">{t(language, 'almanacLockedEra')}</p>
            ) : (
              <>
                <p className="almanac-short">{pickLang(almanac?.short, language)}</p>
                {almanac?.cosmicEra ? (
                  <div className="almanac-era-tags">
                    <span className="almanac-era-tag">{stripPrefix(pickLang(almanac.cosmicEra.timeRange, language))}</span>
                    <span className="almanac-era-tag">{stripPrefix(pickLang(almanac.cosmicEra.temperature, language))}</span>
                  </div>
                ) : null}
                <p className="almanac-body">{pickLang(almanac?.body, language) || (language === 'ko' ? stageMeta?.quoteKo ?? stageMeta?.quote : stageMeta?.quote)}</p>
                {almanac?.funFact ? (
                  <p className="almanac-funfact">{pickLang(almanac.funFact, language)}</p>
                ) : null}
              </>
            )}
          </div>

          {/* Milestones — flows below, scrollable with the page */}
          {!isFuture(selectedId) && allLogs.filter((log) => log.progress > 0).length > 0 ? (
            <div className="almanac-milestones">
              <div className="almanac-milestones__title">{t(language, 'almanacMilestones')}</div>
              {allLogs.filter((log) => log.progress > 0).map((log) => {
                const unlocked = effectiveProgress >= log.progress;
                const loreId = unlocked ? milestoneLoreId(log.stageId, log.progress, log.title.en) : null;
                return (
                  <div key={log.progress} className={`almanac-ms ${unlocked ? 'almanac-ms--open' : 'almanac-ms--locked'}`}>
                    <div className="almanac-ms__text">
                      <div className="almanac-ms__title">{unlocked ? pickLogText(log.title, language) : t(language, 'almanacLogLocked')}</div>
                      {unlocked ? <div className="almanac-ms__msg">{pickLogText(log.message, language)}</div> : null}
                    </div>
                    {unlocked && loreId ? (
                      <button type="button" className="almanac-ms__more" onClick={() => { setActiveLoreId(loreId); onUITap?.(); }}>→</button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}

          {isFuture(selectedId) ? (
            <div className="almanac-milestones">
              <p className="almanac-locked-body">{t(language, 'almanacUnlockHint')}</p>
            </div>
          ) : null}
        </div>
      </div>
      {activeLoreId !== null ? (
        <LoreModal loreId={activeLoreId} language={language} onClose={() => setActiveLoreId(null)} />
      ) : null}
    </div>
  );
}
