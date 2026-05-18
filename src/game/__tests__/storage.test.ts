import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveGame } from '../storage';
import { createInitialGameState } from '../reducer';

// vitest runs in a node environment — stub the browser globals saveGame needs.
describe('saveGame quota handling', () => {
  let setItem: ReturnType<typeof vi.fn>;
  const listeners: Record<string, Array<(e: unknown) => void>> = {};

  beforeEach(() => {
    setItem = vi.fn();
    global.localStorage = {
      getItem: () => null,
      setItem,
      removeItem: () => {},
    } as unknown as Storage;
    global.window = {
      addEventListener: (type: string, cb: (e: unknown) => void) => {
        (listeners[type] ??= []).push(cb);
      },
      removeEventListener: () => {},
      dispatchEvent: (e: { type: string }) => {
        (listeners[e.type] ?? []).forEach((cb) => cb(e));
        return true;
      },
    } as unknown as Window & typeof globalThis;
    if (typeof (globalThis as { CustomEvent?: unknown }).CustomEvent === 'undefined') {
      (globalThis as { CustomEvent?: unknown }).CustomEvent = class {
        type: string;
        constructor(type: string) {
          this.type = type;
        }
      };
    }
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // @ts-expect-error test cleanup
    delete global.window;
    // @ts-expect-error test cleanup
    delete global.localStorage;
    for (const key of Object.keys(listeners)) delete listeners[key];
    vi.restoreAllMocks();
  });

  it('retries with trimmed history on QuotaExceededError', () => {
    let attempts = 0;
    setItem.mockImplementation(() => {
      attempts += 1;
      if (attempts === 1) {
        const err = new Error('Quota exceeded');
        err.name = 'QuotaExceededError';
        throw err;
      }
    });
    saveGame(createInitialGameState(Date.now()));
    expect(attempts).toBe(2);
  });

  it('dispatches cc-save-failed event when both attempts fail', () => {
    setItem.mockImplementation(() => {
      throw new Error('Quota exceeded');
    });
    const eventSpy = vi.fn();
    window.addEventListener('cc-save-failed', eventSpy);
    saveGame(createInitialGameState(Date.now()));
    expect(eventSpy).toHaveBeenCalled();
  });
});
