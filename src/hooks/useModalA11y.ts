import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * C-P1 (audit a11y): shared modal/overlay accessibility.
 * - Esc closes the overlay (capture phase, so the topmost open overlay wins).
 * - Tab / Shift+Tab are trapped inside the container (focus can't escape to the
 *   game behind the overlay).
 * - On open, focus moves into the overlay; on close/unmount it returns to the
 *   element that had focus before (so keyboard users aren't dumped at <body>).
 *
 * The container element should carry `tabIndex={-1}` so it can hold focus when
 * it has no focusable children. Pass `isOpen=false` to disable for a mounted-
 * but-hidden overlay.
 */
export function useModalA11y(
  containerRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  isOpen = true,
): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return undefined;
    const container = containerRef.current;
    const previouslyFocused = (typeof document !== 'undefined' ? document.activeElement : null) as HTMLElement | null;

    // Move focus into the overlay (first focusable child, else the container).
    if (container) {
      const focusables = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      (focusables[0] ?? container).focus();
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !container) return;
      const focusables = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (focusables.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (!container.contains(active)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      previouslyFocused?.focus?.();
    };
  }, [isOpen, containerRef]);
}
