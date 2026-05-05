import { useEffect, useRef, useState } from 'react';
import { STAGE_LOGS } from '../game/stageLogs';

interface StageLogToastProps {
  stageId: number;
  progressPercent: number; // 0–100
  onFirstDismiss?: () => void;
}

interface ToastItem {
  id: string;
  title: string;
  message: string;
}

export function StageLogToast({ stageId, progressPercent, onFirstDismiss }: StageLogToastProps) {
  const shownRef = useRef(new Set<string>());
  const queueRef = useRef<ToastItem[]>([]);
  const [queueVersion, setQueueVersion] = useState(0);
  const [current, setCurrent] = useState<ToastItem | null>(null);
  const [visible, setVisible] = useState(false);
  const prevStageIdRef = useRef(-1);
  const firstDismissFiredRef = useRef(false);

  // Reset on stage change, then enqueue matching logs
  useEffect(() => {
    if (prevStageIdRef.current !== stageId) {
      prevStageIdRef.current = stageId;
      shownRef.current = new Set();
      queueRef.current = [];
      setCurrent(null);
      setVisible(false);
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
        queueRef.current.push({ id: key, title: log.title, message: log.message });
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

  // Effect 2: timer — runs when current becomes non-null, cleaned up on unmount only
  // Split from Effect 1 so that state updates from setCurrent don't cancel the timers.
  useEffect(() => {
    if (current === null) return undefined;
    const hideId = window.setTimeout(() => setVisible(false), 3000);
    const clearId = window.setTimeout(() => setCurrent(null), 3500);
    return () => {
      window.clearTimeout(hideId);
      window.clearTimeout(clearId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]); // key on ID so it only fires once per unique toast, not on every re-render

  const handleDismiss = () => {
    setVisible(false);
    window.setTimeout(() => setCurrent(null), 300);
    if (!firstDismissFiredRef.current) {
      firstDismissFiredRef.current = true;
      onFirstDismiss?.();
    }
  };

  if (!current) return null;

  return (
    <div className={`stage-log-toast ${visible ? 'visible' : 'hiding'}`} aria-live="polite">
      <div className="stage-log-content">
        <div>
          <div className="stage-log-title">{current.title}</div>
          <div className="stage-log-message">{current.message}</div>
        </div>
        <button
          type="button"
          className="stage-log-dismiss"
          aria-label="Dismiss message"
          onClick={handleDismiss}
        >
          ×
        </button>
      </div>
    </div>
  );
}
