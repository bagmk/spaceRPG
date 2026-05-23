import { useEffect, useState } from 'react';

export interface LoreItem {
  id: string;
  type: 'entity' | 'milestone';
  stageId: number;
  stageEn: string;
  stageKo: string;
  nameEn?: string;
  nameKo?: string;
  titleEn?: string;
  titleKo?: string;
  meta?: string;
  progress?: number;
  bodyEn: string;
  bodyKo: string;
}

type LoreMap = Record<string, LoreItem>;

let cache: LoreMap | null = null;
let inflight: Promise<LoreMap> | null = null;

function loreUrl(): string {
  // Vite injects BASE_URL ('/' locally, '/spaceRPG/' on GitHub Pages).
  const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '/');
  return base + 'lore.json';
}

async function fetchLore(): Promise<LoreMap> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch(loreUrl());
      if (!res.ok) throw new Error(`Lore fetch failed: ${res.status}`);
      const data = (await res.json()) as LoreMap;
      cache = data;
      return data;
    } catch (err) {
      inflight = null;
      throw err;
    }
  })();
  return inflight;
}

export type LoreState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; item: LoreItem | null }
  | { status: 'error'; error: string };

/** Subscribe to a lore item by id. Returns {status, item} for rendering. */
export function useLore(id: string | null): LoreState {
  const [state, setState] = useState<LoreState>(
    id ? { status: 'loading' } : { status: 'idle' },
  );

  useEffect(() => {
    if (!id) {
      setState({ status: 'idle' });
      return;
    }
    let cancelled = false;
    if (cache) {
      setState({ status: 'ready', item: cache[id] ?? null });
      return;
    }
    setState({ status: 'loading' });
    fetchLore()
      .then((data) => {
        if (cancelled) return;
        setState({ status: 'ready', item: data[id] ?? null });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ status: 'error', error: err instanceof Error ? err.message : String(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return state;
}
