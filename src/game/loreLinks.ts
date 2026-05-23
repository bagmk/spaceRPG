/** Generate lore page URLs for entities and milestones. */

import type { StageEntity } from './entities/types';
import type { StageLog } from './stageLogs';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'item';
}

function loreBaseUrl(): string {
  // Same directory as the app — handles both '/' and '/spaceRPG/' (GitHub Pages)
  if (typeof window === 'undefined') return '/lore.html';
  const path = window.location.pathname;
  const dir = path.substring(0, path.lastIndexOf('/') + 1);
  return dir + 'lore.html';
}

/** Compute the slug ID for an entity. Must match the Python parser in fixes/. */
export function entityLoreId(stageId: number, nameEn: string): string {
  const stage = String(stageId).padStart(2, '0');
  return `stage${stage}-entity-${slugify(nameEn)}`;
}

/** Compute the slug ID for a milestone. */
export function milestoneLoreId(stageId: number, progress: number, titleEn: string): string {
  const stage = String(stageId).padStart(2, '0');
  const prog = String(progress).padStart(3, '0');
  return `stage${stage}-milestone-${prog}-${slugify(titleEn)}`;
}

/** Open lore in a new tab. Falls back gracefully if blocked. */
export function openEntityLore(entity: Pick<StageEntity, 'stageId' | 'name'>, lang: 'en' | 'ko' = 'en'): void {
  const id = entityLoreId(entity.stageId, entity.name);
  const url = `${loreBaseUrl()}?id=${encodeURIComponent(id)}&lang=${lang}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function openMilestoneLore(log: Pick<StageLog, 'stageId' | 'progress' | 'title'>, lang: 'en' | 'ko' = 'en'): void {
  const id = milestoneLoreId(log.stageId, log.progress, log.title.en);
  const url = `${loreBaseUrl()}?id=${encodeURIComponent(id)}&lang=${lang}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}
