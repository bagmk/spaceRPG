import { useEffect, type CSSProperties } from 'react';
import { t, type Lang } from '../i18n';
import { findEntityById, entityName } from '../game/entities/stageItems';
import type { EntityRarity } from '../game/entities/types';
import { EntityGlyph } from './EntityGlyph';

interface Props {
  entityId: string;
  /** Pool stage the copy came from — disambiguates the lookup. */
  stageId: number;
  rarity: EntityRarity;
  language: Lang;
  onDismiss: () => void;
}

/** Rarity-colored accent — mirrors the RARITY_COLORS palette used in EntityPanel/ShopPanel. */
const RARITY_COLORS: Record<EntityRarity, string> = {
  common: '#6db86d',
  rare: '#4a8fff',
  epic: '#b060f0',
  legendary: '#ffa500',
  mythic: '#ff5db5',
};

/** Rare+ discoveries get a slightly bigger / more emphatic entrance (escalation). */
const ESCALATED: Record<EntityRarity, boolean> = {
  common: false,
  rare: false,
  epic: true,
  legendary: true,
  mythic: true,
};

const DISMISS_MS = 2500;

/**
 * Persona #10: floating "발견! / Discovered!" reveal when a field drop collects a
 * brand-new (not-yet-in-codex) entity. Auto-dismisses after ~2.5s (mirrors the
 * gacha/fusion reveal auto-clear) and is clickable to dismiss early. Reuses the
 * EntityGlyph + rarity-color styling of the inventory/shop cards.
 */
export function DropDiscoveryToast({ entityId, stageId, rarity, language, onDismiss }: Props) {
  useEffect(() => {
    const dismiss = window.setTimeout(onDismiss, DISMISS_MS);
    return () => window.clearTimeout(dismiss);
  }, [onDismiss]);

  const entity = findEntityById(entityId, stageId) ?? findEntityById(entityId);
  if (!entity) return null;
  const color = RARITY_COLORS[rarity];
  const style = {
    '--rarity-color': color,
  } as CSSProperties & Record<string, string>;

  return (
    <button
      type="button"
      className={`drop-discovery-toast${ESCALATED[rarity] ? ' drop-discovery-toast--rare' : ''}`}
      style={style}
      role="status"
      onClick={onDismiss}
      aria-label={`${t(language, 'dropDiscovered')} ${entityName(entity, language)}`}
    >
      <span className="drop-discovery-toast__tag" style={{ color }}>
        {t(language, 'dropDiscovered')}
      </span>
      <span className="drop-discovery-toast__glyph">
        <EntityGlyph entity={entity} color={color} />
      </span>
      <span className="drop-discovery-toast__name">{entityName(entity, language)}</span>
      <span className="drop-discovery-toast__badge" style={{ color }}>
        {t(language, 'dropDiscoveredNewBadge')}
      </span>
    </button>
  );
}
