import { useEffect, useState } from 'react';

/**
 * Subscribes to the `cc-save-failed` event dispatched by storage.saveGame()
 * when localStorage quota is exhausted. Returns whether the toast should be
 * shown right now. Auto-hides after 5 seconds.
 */
export function useSaveErrorToast(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const handler = () => {
      setVisible(true);
      window.setTimeout(() => setVisible(false), 5000);
    };
    window.addEventListener('cc-save-failed', handler);
    return () => window.removeEventListener('cc-save-failed', handler);
  }, []);
  return visible;
}
