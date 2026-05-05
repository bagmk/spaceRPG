import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

interface SpeechBubbleProps {
  anchorRef: RefObject<HTMLElement>;
  position: 'top' | 'bottom' | 'left' | 'right';
  message: string;
  ctaLabel?: string;
  onCta?: () => void;
  onDismiss: () => void;
}

interface BubblePosition {
  left: number;
  top: number;
  side: SpeechBubbleProps['position'];
}

const BUBBLE_WIDTH = 260;
const BUBBLE_HEIGHT = 170;
const GAP = 14;

function resolvePosition(
  anchor: DOMRect,
  preferred: SpeechBubbleProps['position'],
): BubblePosition {
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;
  const candidates: SpeechBubbleProps['position'][] = [
    preferred,
    'top',
    'bottom',
    'left',
    'right',
  ];
  const uniqueCandidates = [...new Set(candidates)];

  for (const side of uniqueCandidates) {
    const left =
      side === 'left'
        ? anchor.left - BUBBLE_WIDTH - GAP
        : side === 'right'
          ? anchor.right + GAP
          : anchor.left + anchor.width / 2 - BUBBLE_WIDTH / 2;
    const top =
      side === 'top'
        ? anchor.top - BUBBLE_HEIGHT - GAP
        : side === 'bottom'
          ? anchor.bottom + GAP
          : anchor.top + anchor.height / 2 - BUBBLE_HEIGHT / 2;
    if (
      left >= 12 &&
      top >= 12 &&
      left + BUBBLE_WIDTH <= viewportW - 12 &&
      top + BUBBLE_HEIGHT <= viewportH - 12
    ) {
      return { left, top, side };
    }
  }

  return {
    left: Math.min(Math.max(12, anchor.left + anchor.width / 2 - BUBBLE_WIDTH / 2), viewportW - BUBBLE_WIDTH - 12),
    top: Math.min(Math.max(12, anchor.top - BUBBLE_HEIGHT - GAP), viewportH - BUBBLE_HEIGHT - 12),
    side: preferred,
  };
}

export function SpeechBubble({
  anchorRef,
  position,
  message,
  ctaLabel,
  onCta,
  onDismiss,
}: SpeechBubbleProps) {
  const [bubblePosition, setBubblePosition] = useState<BubblePosition | null>(null);

  useEffect(() => {
    const update = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      setBubblePosition(resolvePosition(anchor.getBoundingClientRect(), position));
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [anchorRef, position]);

  if (!bubblePosition) {
    return null;
  }

  return (
    <div
      className={`speech-bubble ${bubblePosition.side}`}
      style={{ left: bubblePosition.left, top: bubblePosition.top }}
      role="status"
      aria-live="polite"
    >
      <button className="speech-dismiss" type="button" onClick={onDismiss} aria-label="Dismiss tutorial">
        x
      </button>
      <div className="speech-message">{message}</div>
      {ctaLabel && onCta ? (
        <button className="speech-cta" type="button" onClick={onCta}>
          {ctaLabel}
        </button>
      ) : null}
      <span className="speech-arrow" aria-hidden="true" />
    </div>
  );
}
