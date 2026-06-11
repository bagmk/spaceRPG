import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent } from 'react';
import type { EntityInstance } from '../game/types';
import type { StageEntity, EntityRarity } from '../game/entities/types';
import { getEntityCost } from '../game/entities/types';
import { getEntitiesForStage, getPurchasedEntityCount, entityName, entityDescription, getMaxLegacyTimeEntityMultiplierBeforeStage } from '../game/entities/stageItems';
import { getEntityLockPrerequisite, isEntityLockedByAnchor } from '../game/entities/anchors';
import { LoreSection } from './LoreSection';
import { entityLoreId } from '../game/loreLinks';
import { defaultModifiers } from '../game/skills/effects';
import { STAGES } from '../game/stages';
import { formatAutoRateValue, getCosmicTimeFillRate } from '../game/formulas';
import { EntityGlyph } from './EntityGlyph';
import { t, stageName, type Lang } from '../i18n';

const RARITY_ORDER: EntityRarity[] = ['common', 'rare', 'epic', 'legendary'];
const RARITY_RANK = new Map<EntityRarity, number>(RARITY_ORDER.map((rarity, index) => [rarity, index]));

const RARITY_COLORS: Record<EntityRarity, string> = {
  common: '#6db86d',
  rare: '#4a8fff',
  epic: '#b060f0',
  legendary: '#ffa500',
};

function formatEntityCost(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "0";
  const whole = Math.ceil(value);
  if (whole < 1_000) return String(whole);
  if (whole < 1_000_000) return String(Math.ceil(whole / 1_000)) + "k";
  if (whole < 1e9) return String(Math.ceil(whole / 1e6)) + "M";
  if (whole < 1e12) return String(Math.ceil(whole / 1e9)) + "B";
  if (whole < 1e15) return String(Math.ceil(whole / 1e12)) + "T";
  const exp = Math.floor(Math.log10(whole));
  const mantissa = Math.ceil(whole / Math.pow(10, exp));
  return String(mantissa) + "e" + String(exp);
}

function formatPct(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

function getEntityAutoRate(entity: StageEntity, count = 1): number {
  return Math.max(0, entity.baseCost * entity.effect.value * count / 100);
}

function getEntityTimeFillRate(entity: StageEntity, count: number, displayStageId: number): number {
  const mods = defaultModifiers();
  const cappedCount = Math.min(Math.max(0, count), entity.maxCount);
  mods.timeMultMult = getMaxLegacyTimeEntityMultiplierBeforeStage(displayStageId);
  if (cappedCount > 0) {
    mods.timeMultMult *= 1 + (entity.effect.value * cappedCount) / 100;
  }
  return getCosmicTimeFillRate(0, mods, 1, displayStageId);
}

function getEffectiveTimeRatePct(
  entity: StageEntity,
  displayStageId: number,
  fromCount: number,
  toCount: number,
): number {
  const beforeRate = getEntityTimeFillRate(entity, fromCount, displayStageId);
  const afterRate = getEntityTimeFillRate(entity, toCount, displayStageId);
  if (!Number.isFinite(beforeRate) || beforeRate <= 0 || !Number.isFinite(afterRate)) return entity.effect.value;
  return Math.max(0, (afterRate / beforeRate - 1) * 100);
}

function getNextTimeRatePct(entity: StageEntity, count: number, displayStageId: number): number {
  const cappedCount = Math.min(Math.max(0, count), entity.maxCount);
  const nextCount = Math.min(entity.maxCount, cappedCount + 1);
  const fromCount = nextCount === cappedCount && cappedCount > 0 ? cappedCount - 1 : cappedCount;
  return getEffectiveTimeRatePct(entity, displayStageId, fromCount, nextCount);
}

function getTotalTimeRatePct(entity: StageEntity, count: number, displayStageId: number): number {
  const cappedCount = Math.min(Math.max(0, count), entity.maxCount);
  return getEffectiveTimeRatePct(entity, displayStageId, 0, cappedCount);
}

/** Returns the per-level effect label for an entity (e.g. "+15% Click Power" or "+0.5% Crit Chance"). */
function formatEntityEffect(
  entity: StageEntity,
  lang: Lang,
  displayStageId = entity.stageId,
  count = 0,
): string {
  const { type, value, isFlat } = entity.effect;
  if (type === 'click') {
    return `+${formatPct(value)} ${t(lang, 'effectClickPower')}`;
  }
  if (type === 'auto') {
    return `+${formatAutoRateValue(getEntityAutoRate(entity))}${t(lang, 'effectAutoRateUnit')}`;
  }
  if (type === 'crit') {
    return isFlat
      ? `+${formatPct(value)} ${t(lang, 'effectCritChance')}`
      : `+${formatPct(value)} ${t(lang, 'effectCritMult')}`;
  }
  if (type === 'time') return `+${formatPct(getNextTimeRatePct(entity, count, displayStageId))} ${t(lang, 'effectTimeRate')}`;
  if (type === 'multiplier') return `+${formatPct(value)} ${t(lang, 'effectAllSources')}`;
  if (type === 'entropy') return `+${formatPct(value)} ${t(lang, 'effectEncounterBonus')}`;
  return `+${formatPct(value)} ${type}`;
}

/** Returns the cumulative effect label across all owned levels. */
function formatEntityEffectTotal(
  entity: StageEntity,
  count: number,
  lang: Lang,
  displayStageId = entity.stageId,
): string {
  if (count === 0) return '';
  const { type, value, isFlat } = entity.effect;
  if (type === 'click') {
    return `+${formatPct(value * count)} ${t(lang, 'effectTotal')}`;
  }
  if (type === 'auto') {
    return `+${formatAutoRateValue(getEntityAutoRate(entity, count))}${t(lang, 'effectAutoRateUnit')} ${t(lang, 'effectTotal')}`;
  }
  if (type === 'crit') {
    return isFlat
      ? `+${formatPct(value * count)} ${t(lang, 'effectCritChance')}`
      : `+${formatPct(value * count)} ${t(lang, 'effectCritMult')}`;
  }
  if (type === 'time') return `+${formatPct(getTotalTimeRatePct(entity, count, displayStageId))} ${t(lang, 'effectTimeRate')}`;
  if (type === 'multiplier') return `+${formatPct(value * count)} ${t(lang, 'effectAllSources')}`;
  if (type === 'entropy') return `+${formatPct(value * count)} ${t(lang, 'effectEncounter')}`;
  return `+${formatPct(value * count)} ${type}`;
}

interface Props {
  currentStageId: number;
  inventory: EntityInstance[];
  equippedSlots: string[];
  quanta: number;
  language: Lang;
  onPurchase: (entityId: string) => void;
  onEquip: (entityId: string) => void;
  onUnequip: (slot: number) => void;
  onClose: () => void;
  onStageSelect?: (stageId: number) => void;
  onUITap?: () => void;
}

export function EntityPanel({ currentStageId, inventory, equippedSlots, quanta, language, onPurchase, onEquip, onUnequip, onClose, onStageSelect, onUITap }: Props) {
  const [selectedStageId, setSelectedStageId] = useState(currentStageId);
  const [inspectedEntityId, setInspectedEntityId] = useState<string | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const accessibleStages = useMemo(
    () => STAGES.filter((s) => s.id <= currentStageId),
    [currentStageId],
  );

  const selectedStage =
    accessibleStages.find((s) => s.id === selectedStageId) ??
    accessibleStages[accessibleStages.length - 1];

  const stageEntities = useMemo(
    () =>
      [...getEntitiesForStage(selectedStageId)].sort((a, b) => {
        if (a.baseCost !== b.baseCost) return a.baseCost - b.baseCost;
        return (RARITY_RANK.get(a.rarity) ?? 0) - (RARITY_RANK.get(b.rarity) ?? 0);
      }),
    [selectedStageId],
  );
  const entities = stageEntities;

  const countOf = (entity: StageEntity) => getPurchasedEntityCount(inventory, entity);
  const equippedSlotOf = (entity: StageEntity) => equippedSlots.indexOf(entity.id);
  const inspectedEntity = entities.find((entity) => entity.id === inspectedEntityId) ?? null;

  useEffect(() => {
    if (!timelineRef.current) return;
    const selected = timelineRef.current.querySelector<HTMLElement>('.entity-timeline__node--selected');
    selected?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [selectedStageId]);

  useEffect(() => {
    setInspectedEntityId(null);
  }, [selectedStageId]);

  useEffect(() => {
    if (!inspectedEntityId) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setInspectedEntityId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inspectedEntityId]);

  return (
    <div className="entity-overlay" onClick={onClose}>
      <aside
        className="entity-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="entity-panel__header"
          style={{ '--stage-accent': selectedStage?.accent ?? '#8090b0' } as CSSProperties}
        >
          <div className="entity-panel__stage" style={{ color: selectedStage?.accent }}>
            {selectedStage ? `${String(selectedStage.id).padStart(2, '0')} · ${stageName(language, selectedStage.id, selectedStage.name)}` : ''}
          </div>
          <button className="entity-panel__close" onClick={onClose}>✕</button>
        </div>

        {/* Stage Timeline */}
        <div className="entity-timeline" ref={timelineRef}>
          <div className="entity-timeline__track">
            {accessibleStages.map((s, i) => {
              const prev = i > 0 ? accessibleStages[i - 1] : null;
              const isSelected = s.id === selectedStageId;
              const isCurrent = s.id === currentStageId;

              return (
                <Fragment key={s.id}>
                  {prev && (
                    <div
                      className="entity-timeline__line"
                      style={{
                        background: `linear-gradient(to right, ${prev.accent}55, ${s.accent}55)`,
                      }}
                    />
                  )}
                  <button
                    type="button"
                    className={[
                      'entity-timeline__node',
                      isSelected ? 'entity-timeline__node--selected' : '',
                      isCurrent ? 'entity-timeline__node--current' : '',
                      s.id < currentStageId ? 'entity-timeline__node--completed' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={{ '--node-color': s.accent } as CSSProperties}
                    onClick={() => { setSelectedStageId(s.id); onStageSelect?.(s.id); }}
                    aria-label={`${t(language, 'entityLabStageLabel')} ${s.id}: ${stageName(language, s.id, s.name)}`}
                    aria-pressed={isSelected}
                  >
                    <span className="entity-timeline__dot">
                      {s.id < currentStageId && !isSelected ? '✓' : s.id}
                    </span>
                    <span className="entity-timeline__label">{stageName(language, s.id, s.name)}</span>
                  </button>
                </Fragment>
              );
            })}
          </div>
        </div>

        {/* Cleared stage banner + back button */}
        {selectedStage && selectedStage.id < currentStageId && (
          <div className="entity-panel__cleared-banner" style={{ '--stage-accent': selectedStage.accent } as CSSProperties}>
            <span className="entity-panel__cleared-paw">✓</span>
            <span>{`${t(language, 'entityLabStageLabel')} ${selectedStage.id} ${t(language, 'entityLabStageCleared')}`}</span>
            <button
              type="button"
              className="entity-panel__back-btn"
              onClick={() => { setSelectedStageId(currentStageId); onStageSelect?.(currentStageId); }}
            >
              {language === 'ko' ? `단계 ${currentStageId}로 ▶` : `Stage ${currentStageId} ▶`}
            </button>
          </div>
        )}

        {/* Hint: past stages are upgradeable */}
        {currentStageId >= 3 && selectedStageId === currentStageId && (
          <div className="entity-panel__hint">
            {language === 'ko'
              ? '💡 이전 스테이지의 엔티티도 업그레이드할 수 있습니다!'
              : '💡 You can still upgrade entities from previous stages!'}
          </div>
        )}

        {/* Entity list — key changes on stage switch to replay entry animations */}
        <div className="entity-panel__list" key={selectedStageId}>
          {entities.length === 0 && (
            <div className="entity-panel__empty">{t(language, 'entityLabNoEntities')}</div>
          )}
          {entities.map((entity, idx) => {
            const prereq = getEntityLockPrerequisite(entity, inventory);
            const anchorLocked = prereq !== undefined;
            const anchorName = prereq ? entityName(prereq, language) : undefined;
            return (
              <EntityCard
                key={entity.id}
                entity={entity}
                count={countOf(entity)}
                quanta={quanta}
                language={language}
                rarityColor={RARITY_COLORS[entity.rarity]}
                onPurchase={onPurchase}
                onInspect={() => { setInspectedEntityId(entity.id); onUITap?.(); }}
                animDelay={idx * 45}
                canPurchase={selectedStageId <= currentStageId && !anchorLocked}
                anchorLockedBy={anchorLocked ? anchorName : undefined}
                displayStageId={selectedStageId}
                isEquipped={equippedSlotOf(entity) >= 0}
              />
            );
          })}
        </div>
      </aside>
      {inspectedEntity ? (
        <EntityDetailCard
          entity={inspectedEntity}
          count={countOf(inspectedEntity)}
          cost={getEntityCost(inspectedEntity, countOf(inspectedEntity))}
          quanta={quanta}
          language={language}
          rarityColor={RARITY_COLORS[inspectedEntity.rarity]}
          canPurchase={
            selectedStageId <= currentStageId &&
            !isEntityLockedByAnchor(inspectedEntity, inventory)
          }
          displayStageId={selectedStageId}
          equippedSlot={equippedSlotOf(inspectedEntity)}
          onPurchase={onPurchase}
          onEquip={onEquip}
          onUnequip={onUnequip}
          onClose={() => setInspectedEntityId(null)}
        />
      ) : null}
    </div>
  );
}

interface CardProps {
  entity: StageEntity;
  count: number;
  quanta: number;
  language: Lang;
  rarityColor: string;
  onPurchase: (entityId: string) => void;
  onInspect: () => void;
  animDelay: number;
  canPurchase: boolean;
  anchorLockedBy?: string;
  displayStageId: number;
  isEquipped: boolean;
}

function EntityCard({ entity, count, quanta, language, rarityColor, onPurchase, onInspect, animDelay, canPurchase, anchorLockedBy, displayStageId, isEquipped }: CardProps) {
  const [isCelebrating, setIsCelebrating] = useState(false);
  const celebrationTimeoutRef = useRef<number | null>(null);
  const cost = getEntityCost(entity, count);
  const maxed = entity.maxCount > 0 && count >= entity.maxCount;
  const canAfford = canPurchase && quanta >= cost && !maxed;
  const showLevelProgress = entity.maxCount > 1;
  const levelProgress = showLevelProgress
    ? Math.min(100, Math.max(0, (count / entity.maxCount) * 100))
    : 0;
  const totalEffectLabel = formatEntityEffectTotal(entity, count, language, displayStageId);

  useEffect(() => {
    return () => {
      if (celebrationTimeoutRef.current !== null) {
        window.clearTimeout(celebrationTimeoutRef.current);
      }
    };
  }, []);

  const handlePurchase = (event?: MouseEvent<HTMLButtonElement>) => {
    event?.stopPropagation();
    if (!canAfford) return;
    onPurchase(entity.id);
    setIsCelebrating(true);
    if (celebrationTimeoutRef.current !== null) {
      window.clearTimeout(celebrationTimeoutRef.current);
    }
    celebrationTimeoutRef.current = window.setTimeout(() => {
      setIsCelebrating(false);
      celebrationTimeoutRef.current = null;
    }, entity.rarity === 'legendary' ? 1050 : 650);
  };

  const effectLabel = formatEntityEffect(entity, language, displayStageId, count);
  const displayName = entityName(entity, language);

  return (
    <div
      role="button"
      tabIndex={0}
      className={[
        'entity-card',
        `entity-card--${entity.rarity}`,
        canAfford ? 'entity-card--affordable' : '',
        maxed ? 'entity-card--maxed' : '',
        isCelebrating ? 'entity-card--celebrate' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={
        {
          '--card-anim-delay': `${animDelay}ms`,
          '--rarity-color': rarityColor,
        } as CSSProperties
      }
      onClick={onInspect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onInspect();
        }
      }}
    >
      {/* Glyph with count badge */}
      <div className="entity-card__glyph">
        <EntityGlyph entity={entity} color={rarityColor} />
        {count > 0 && (
          <div className="entity-card__count" style={{ background: rarityColor }}>
            ×{count}
          </div>
        )}
        {isEquipped && (
          <div className="entity-card__equipped-badge" title={t(language, 'entityEquipped')}>
            {t(language, 'entityEquipped')}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="entity-card__info">
        <div className="entity-card__name">{displayName}</div>
        <div className="entity-card__meta">
          <span className="entity-card__effect" style={{ color: rarityColor }}>
            {anchorLockedBy
              ? t(language, 'entityLabAnchorLockHint').replace('{anchor}', anchorLockedBy)
              : effectLabel}
          </span>
        </div>
        {showLevelProgress ? (
          <div
            className="entity-card__progress-row"
            aria-label={`${displayName} level ${count} of ${entity.maxCount}`}
          >
            <div className="entity-card__progress-track">
              <div
                className="entity-card__progress-fill"
                style={{ width: `${levelProgress}%`, background: rarityColor }}
              />
            </div>
            <span className="entity-card__progress-level">{`${count}/${entity.maxCount}`}</span>
            <span className="entity-card__progress-bonus" style={{ color: rarityColor }}>
              {totalEffectLabel}
            </span>
          </div>
        ) : null}
      </div>

      {/* Right: cost + buy button */}
      <div className="entity-card__right">
        <button
          className={[
            'entity-card__buy',
            maxed ? 'entity-card__buy--maxed' : '',
            !canPurchase ? 'entity-card__buy--view' : '',
          ].filter(Boolean).join(' ')}
          style={
            !canPurchase
              ? { borderColor: rarityColor, color: rarityColor }
              : maxed
              ? { borderColor: rarityColor, color: rarityColor }
              : canAfford
                ? { background: rarityColor }
                : {}
          }
          disabled={!canAfford}
          onClick={handlePurchase}
        >
          {canPurchase && !maxed ? (
            <>
              <span className="entity-card__buy-cost">
                <span className="entity-card__buy-symbol" aria-hidden="true">⚛</span>
                <span>{formatEntityCost(cost)}</span>
              </span>
              <span className="entity-card__buy-label">{t(language, 'entityLabGet')}</span>
            </>
          ) : (
            <span className="entity-card__buy-label">
              {anchorLockedBy
                ? t(language, 'entityLabAnchorLock').replace('{anchor}', anchorLockedBy)
                : !canPurchase
                  ? t(language, 'entityLabLocked')
                  : t(language, 'entityLabMax')}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

interface DetailCardProps {
  entity: StageEntity;
  count: number;
  cost: number;
  quanta: number;
  language: Lang;
  rarityColor: string;
  canPurchase: boolean;
  displayStageId: number;
  /** Slot index this entity occupies, or -1 when not equipped. */
  equippedSlot: number;
  onPurchase: (entityId: string) => void;
  onEquip: (entityId: string) => void;
  onUnequip: (slot: number) => void;
  onClose: () => void;
}

function EntityDetailCard({
  entity,
  count,
  cost,
  quanta,
  language,
  rarityColor,
  canPurchase,
  displayStageId,
  equippedSlot,
  onPurchase,
  onEquip,
  onUnequip,
  onClose,
}: DetailCardProps) {
  const maxed = entity.maxCount > 0 && count >= entity.maxCount;
  const canAfford = canPurchase && !maxed && quanta >= cost;
  const isEquipped = equippedSlot >= 0;
  const effectLabel = formatEntityEffect(entity, language, displayStageId, count);
  const totalEffectLabel = count > 0 ? formatEntityEffectTotal(entity, count, language, displayStageId) : '';

  return (
    <div
      className="entity-detail-layer"
      role="dialog"
      aria-modal="true"
      aria-label={entityName(entity, language)}
      onClick={(event) => {
        event.stopPropagation();
        onClose();
      }}
    >
      <article
        className={`entity-detail-card entity-detail-card--${entity.rarity}`}
        style={{ '--rarity-color': rarityColor } as CSSProperties}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="entity-detail-card__close"
          aria-label={t(language, 'entityLabCloseDetail')}
          onClick={onClose}
        >
          ×
        </button>
        <div className="entity-detail-card__visual">
          <EntityGlyph entity={entity} color={rarityColor} />
        </div>
        <div className="entity-detail-card__formula" style={{ color: rarityColor }}>
          {entity.formula}
        </div>
        <h3 className="entity-detail-card__name">{entityName(entity, language)}</h3>
        <p className="entity-detail-card__description">{entityDescription(entity, language)}</p>
        <div className="entity-detail-card__stats">
          <span style={{ color: rarityColor }}>{effectLabel}</span>
          <span>{entity.maxCount > 1 ? `${count}/${entity.maxCount}` : count > 0 ? t(language, 'entityLabOwned') : t(language, 'entityLabUnowned')}</span>
          {totalEffectLabel ? <span style={{ color: rarityColor }}>{totalEffectLabel}</span> : null}
        </div>
        <LoreSection loreId={entityLoreId(entity.stageId, entity.name)} language={language} />
        <button
          type="button"
          className="entity-detail-card__buy"
          style={canAfford ? { background: rarityColor } : { borderColor: rarityColor, color: rarityColor }}
          disabled={!canAfford}
          onClick={() => onPurchase(entity.id)}
        >
          {maxed ? t(language, 'entityLabMaxed') : canPurchase ? `${t(language, 'entityLabGet')} · ${formatEntityCost(cost)}` : t(language, 'entityLabLocked')}
        </button>
        {count > 0 ? (
          <button
            type="button"
            className={`entity-detail-card__equip ${isEquipped ? 'entity-detail-card__equip--on' : ''}`}
            style={isEquipped ? { borderColor: rarityColor, color: rarityColor } : { background: rarityColor }}
            onClick={() => (isEquipped ? onUnequip(equippedSlot) : onEquip(entity.id))}
          >
            {isEquipped ? t(language, 'entityUnequip') : t(language, 'entityEquip')}
          </button>
        ) : null}
      </article>
    </div>
  );
}
