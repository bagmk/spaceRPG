import { useEffect, useRef, useState } from 'react';
import { STAGE_LOGS, pickLogText } from '../game/stageLogs';
import type { Lang } from '../i18n';

interface StageLogToastProps {
  stageId: number;
  progressPercent: number; // 0–100
  language: Lang;
  onFirstDismiss?: () => void;
}

interface ToastItem {
  id: string;
  title: string;
  message: string;
}

export function StageLogToast({ stageId, progressPercent, language, onFirstDismiss }: StageLogToastProps) {
  const shownRef = useRef(new Set<string>());
  const queueRef = useRef<ToastItem[]>([]);
  const [queueVersion, setQueueVersion] = useState(0);
  const [current, setCurrent] = useState<ToastItem | null>(null);
  const [visible, setVisible] = useState(false);
  const [showDismiss, setShowDismiss] = useState(false);
  const prevStageIdRef = useRef(-1);
  const onFirstDismissRef = useRef(onFirstDismiss);

  useEffect(() => {
    onFirstDismissRef.current = onFirstDismiss;
  }, [onFirstDismiss]);

  // Reset on stage change, then enqueue matching logs
  useEffect(() => {
    if (prevStageIdRef.current !== stageId) {
      prevStageIdRef.current = stageId;
      shownRef.current = new Set();
      queueRef.current = [];
      setCurrent(null);
      setVisible(false);
      setShowDismiss(false);
    }

    const newItems = STAGE_LOGS.filter((log) => {
      if (log.stageId !== stageId) return false;
      const key = `${stageId}:${log.progress}`;
      if (shownRef.current.has(key)) return false;
      return progressPercent >= log.progress;
    });

    if (newItems.length > 0) {
      for (const log of newItems) {
        const key = `${stageId}:${log.progress}`;
        shownRef.current.add(key);
        queueRef.current.push({ id: key, title: pickLogText(log.title, language), message: pickLogText(log.message, language) });
      }
      setQueueVersion((v) => v + 1);
    }
  }, [stageId, progressPercent]);

  // Effect 1: dequeue next item when nothing is showing
  useEffect(() => {
    if (current !== null) return;
    if (queueRef.current.length === 0) return;
    const next = queueRef.current.shift()!;
    setCurrent(next);
    setVisible(true);
  }, [current, queueVersion]);

  const handleDismiss = () => {
    setVisible(false);
    setShowDismiss(false);
    window.setTimeout(() => setCurrent(null), 300);
    onFirstDismissRef.current?.();
  };

  useEffect(() => {
    if (!current || !visible) return undefined;
    setShowDismiss(false);
    const revealDismissId = window.setTimeout(() => setShowDismiss(true), 3000);
    const autoDismissId = window.setTimeout(handleDismiss, 7200);
    return () => {
      window.clearTimeout(revealDismissId);
      window.clearTimeout(autoDismissId);
    };
  }, [current?.id, visible]);

  if (!current) return null;

  return (
    <div className={`stage-log-toast ${visible ? 'visible' : 'hiding'}`} aria-live="polite">
      <div className="stage-log-content">
        <div className="stage-log-line">
          <div className="stage-log-title">{current.title}</div>
          <div className="stage-log-message">{current.message}</div>
        </div>
        {showDismiss ? (
          <button
            type="button"
            className="stage-log-dismiss"
            aria-label="Dismiss message"
            onClick={handleDismiss}
          >
            ×
          </button>
        ) : null}
      </div>
    </div>
  );
}
