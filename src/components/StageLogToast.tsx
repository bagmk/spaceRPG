import { useEffect, useRef, useState } from 'react';
import { STAGE_LOGS } from '../game/stageLogs';

interface StageLogToastProps {
  stageId: number;
  progressPercent: number; // 0–100
}

interface ToastItem {
  id: string;
  title: string;
  message: string;
}

export function StageLogToast({ stageId, progressPercent }: StageLogToastProps) {
  const shownRef = useRef(new Set<string>());
  const queueRef = useRef<ToastItem[]>([]);
  const [queueVersion, setQueueVersion] = useState(0);
  const [current, setCurrent] = useState<ToastItem | null>(null);
  const [visible, setVisible] = useState(false);
  const prevStageIdRef = useRef(-1);

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

  // Dequeue and display
  useEffect(() => {
    if (current !== null) return;
    if (queueRef.current.length === 0) return;

    const next = queueRef.current.shift()!;
    setCurrent(next);
    setVisible(true);

    const hideId = window.setTimeout(() => setVisible(false), 3000);
    const clearId = window.setTimeout(() => setCurrent(null), 3500);

    return () => {
      window.clearTimeout(hideId);
      window.clearTimeout(clearId);
    };
  }, [current, queueVersion]);

  if (!current) return null;

  return (
    <div className={`stage-log-toast ${visible ? 'visible' : 'hiding'}`} aria-live="polite">
      <div className="stage-log-title">{current.title}</div>
      <div className="stage-log-message">{current.message}</div>
    </div>
  );
}
