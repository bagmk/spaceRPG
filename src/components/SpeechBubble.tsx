import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

interface SpeechBubbleProps {
  anchorRef: RefObject<HTMLElement>;
  position: 'top' | 'bottom' | 'left' | 'right';
  message: string;
  ctaLabel?: string;
  onCta?: () => void;
  onDismiss: () => void;
  autoCloseMs?: number;
}

interface BubblePosition {
  left: number;
  top: number;
  side: SpeechBubbleProps['position'];
  arrowLeft?: number; // for top/bottom: anchor center X relative to bubble left
  arrowTop?: number;  // for left/right: anchor center Y relative to bubble top
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

  const anchorCenterX = anchor.left + anchor.width / 2;
  const anchorCenterY = anchor.top + anchor.height / 2;

  for (const side of uniqueCandidates) {
    const left =
      side === 'left'
        ? anchor.left - BUBBLE_WIDTH - GAP
        : side === 'right'
          ? anchor.right + GAP
          : Math.max(12, Math.min(viewportW - BUBBLE_WIDTH - 12, anchorCenterX - BUBBLE_WIDTH / 2));
    const top =
      side === 'top'
        ? anchor.top - BUBBLE_HEIGHT - GAP
        : side === 'bottom'
          ? anchor.bottom + GAP
          : Math.max(12, Math.min(viewportH - BUBBLE_HEIGHT - 12, anchorCenterY - BUBBLE_HEIGHT / 2));
    if (
      left >= 12 &&
      top >= 12 &&
      left + BUBBLE_WIDTH <= viewportW - 12 &&
      top + BUBBLE_HEIGHT <= viewportH - 12
    ) {
      // Arrow tip offset relative to bubble origin (CSS transform still applies, so this is the "top" CSS value)
      const arrowLeft =
        side === 'top' || side === 'bottom'
          ? Math.max(16, Math.min(BUBBLE_WIDTH - 16, anchorCenterX - left))
          : undefined;
      const arrowTop =
        side === 'left' || side === 'right'
          ? Math.max(18, Math.min(BUBBLE_HEIGHT - 18, anchorCenterY - top))
          : undefined;
      return { left, top, side, arrowLeft, arrowTop };
    }
  }

  // Fallback: clamp to viewport
  const left = Math.min(Math.max(12, anchorCenterX - BUBBLE_WIDTH / 2), viewportW - BUBBLE_WIDTH - 12);
  const top = Math.min(Math.max(12, anchor.top - BUBBLE_HEIGHT - GAP), viewportH - BUBBLE_HEIGHT - 12);
  const arrowLeft =
    preferred === 'top' || preferred === 'bottom'
      ? Math.max(16, Math.min(BUBBLE_WIDTH - 16, anchorCenterX - left))
      : undefined;
  const arrowTop =
    preferred === 'left' || preferred === 'right'
      ? Math.max(18, Math.min(BUBBLE_HEIGHT - 18, anchorCenterY - top))
      : undefined;
  return { left, top, side: preferred, arrowLeft, arrowTop };
}

export function SpeechBubble({
  anchorRef,
  position,
  message,
  ctaLabel,
  onCta,
  onDismiss,
  autoCloseMs,
}: SpeechBubbleProps) {
  const [bubblePosition, setBubblePosition] = useState<BubblePosition | null>(null);

  useEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    setBubblePosition(resolvePosition(anchor.getBoundingClientRect(), position));
    // Only reposition on window resize, not on scroll/tick reflows.
    const onResize = () => {
      const el = anchorRef.current;
      if (el) setBubblePosition(resolvePosition(el.getBoundingClientRect(), position));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [anchorRef, position]);

  useEffect(() => {
    if (!autoCloseMs) return undefined;
    const id = window.setTimeout(onDismiss, autoCloseMs);
    return () => window.clearTimeout(id);
  }, [autoCloseMs, onDismiss]);

  if (!bubblePosition) {
    return null;
  }

  const arrowStyle =
    bubblePosition.arrowLeft !== undefined
      ? { left: bubblePosition.arrowLeft }
      : bubblePosition.arrowTop !== undefined
        ? { top: bubblePosition.arrowTop }
        : undefined;

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
      <span
        className="speech-arrow"
        aria-hidden="true"
        style={arrowStyle}
      />
    </div>
  );
}
