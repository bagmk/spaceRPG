import { useEffect, useRef, useState } from 'react';
import { ALMANAC, pickLang } from '../game/almanac';
import { STAGE_LOGS, getLogsForStage, pickLogText } from '../game/stageLogs';
import { STAGES } from '../game/stages';
import { t, stageName, type Lang } from '../i18n';
import { milestoneLoreId } from '../game/loreLinks';
import { LoreModal } from './LoreModal';

interface AlmanacOverlayProps {
  currentStageId: number;
  progressPercent: number;
  language: Lang;
  onClose: () => void;
}

export function AlmanacOverlay({ currentStageId, progressPercent, language, onClose }: AlmanacOverlayProps) {
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
                onClick={() => setSelectedId(s.id)}
              >
                <span className="almanac-pill-num">{String(s.id).padStart(2, '0')}</span>
                {isFuture(s.id) ? <span className="almanac-pill-lock">🔒</span> : null}
              </button>
            );
          })}
        </div>

        <div className="almanac-content" ref={contentRef}>
          <div className="almanac-info" ref={infoRef}>
            <h2 className="almanac-stage-name">
              {isFuture(selectedId)
                ? <span className="almanac-locked-name">{localizedStageName}</span>
                : (pickLang(almanac?.title, language) || localizedStageName)}
            </h2>

            {isFuture(selectedId) ? (
              <p className="almanac-locked-body">{t(language, 'almanacLockedEra')}</p>
            ) : (
              <>
                <p className="resource-subhead">{pickLang(almanac?.short, language)}</p>
                <p>{pickLang(almanac?.body, language) || (language === 'ko' ? stageMeta?.quoteKo ?? stageMeta?.quote : stageMeta?.quote)}</p>
                {almanac?.uncertaintyNote ? (
                  <p className="almanac-note">{`${t(language, 'almanacNote')}: ${pickLang(almanac.uncertaintyNote, language)}`}</p>
                ) : null}
                {almanac?.cosmicEra ? (
                  <div className="almanac-era">
                    <div className="q-stage">{t(language, 'almanacEraInfo')}</div>
                    <div>{`${t(language, 'almanacEraTime')}: ${pickLang(almanac.cosmicEra.timeRange, language)}`}</div>
                    <div>{`${t(language, 'almanacEraTemp')}: ${pickLang(almanac.cosmicEra.temperature, language)}`}</div>
                    <div>{`${t(language, 'almanacEraKey')}: ${pickLang(almanac.cosmicEra.keyParticles, language)}`}</div>
                    <p>{pickLang(almanac.cosmicEra.realWorldScale, language)}</p>
                  </div>
                ) : null}
                {almanac?.funFact ? (
                  <p className="resource-subhead">{pickLang(almanac.funFact, language)}</p>
                ) : null}
              </>
            )}
          </div>

          <div className="almanac-log" ref={logRef}>
            <div className="q-stage almanac-log-header">
              {isFuture(selectedId) ? t(language, 'almanacMilestonesLocked') : t(language, 'almanacMilestones')}
            </div>
            {isFuture(selectedId) ? (
              <div className="almanac-log-locked-stage">
                <div className="almanac-log-locked-count">
                  {`${allLogs.length} ${t(language, 'almanacMilestonesSealed')}`}
                </div>
                <p className="almanac-locked-body">{t(language, 'almanacUnlockHint')}</p>
              </div>
            ) : (
              <div className="almanac-log-list">
                {allLogs.filter((log) => log.progress > 0).map((log) => {
                  const unlocked = effectiveProgress >= log.progress;
                  const loreId = unlocked ? milestoneLoreId(log.stageId, log.progress, log.title.en) : null;
                  return (
                    <div key={log.progress} className={`almanac-log-entry ${unlocked ? 'almanac-log-entry--open' : 'almanac-log-entry--locked'}`}>
                      {!unlocked && (
                        <div className="almanac-log-progress">{t(language, 'almanacUnknown')}</div>
                      )}
                      <div className="almanac-log-body">
                        <div className="almanac-log-entry-title">
                          {unlocked ? pickLogText(log.title, language) : t(language, 'almanacLogLocked')}
                        </div>
                        {unlocked ? (
                          <div className="almanac-log-entry-msg">{pickLogText(log.message, language)}</div>
                        ) : null}
                      </div>
                      {unlocked && loreId ? (
                        <button
                          type="button"
                          className="almanac-log-entry__more"
                          onClick={() => setActiveLoreId(loreId)}
                          aria-label={language === 'ko' ? '심층 해설 보기' : 'Read more'}
                        >
                          {language === 'ko' ? '자세히 →' : 'More →'}
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      {activeLoreId !== null ? (
        <LoreModal loreId={activeLoreId} language={language} onClose={() => setActiveLoreId(null)} />
      ) : null}
    </div>
  );
}
