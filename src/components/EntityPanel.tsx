import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent } from 'react';
import type { PurchasedEntityEntry } from '../game/types';
import type { StageEntity, EntityRarity } from '../game/entities/types';
import { getEntityCost } from '../game/entities/types';
import { getEntitiesForStage, getPurchasedEntityCount, entityName, entityDescription } from '../game/entities/stageItems';
import { STAGES } from '../game/stages';
import { formatGameNumber } from '../game/formulas';
import { EntityGlyph } from './EntityGlyph';
import { t, stageName, type Lang } from '../i18n';

const RARITY_ORDER: EntityRarity[] = ['common', 'rare', 'epic', 'legendary'];
type RarityFilter = EntityRarity | 'all';
const RARITY_FILTERS: RarityFilter[] = ['all', ...RARITY_ORDER];
const RARITY_RANK = new Map<EntityRarity, number>(RARITY_ORDER.map((rarity, index) => [rarity, index]));

const RARITY_COLORS: Record<EntityRarity, string> = {
  common: '#6db86d',
  rare: '#4a8fff',
  epic: '#b060f0',
  legendary: '#ffa500',
};

function formatPct(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

function rarityLabel(filter: RarityFilter, lang: Lang): string {
  if (filter === 'all') return lang === 'ko' ? '전체' : 'All';
  const labels: Record<EntityRarity, { en: string; ko: string }> = {
    common: { en: 'Common', ko: '일반' },
    rare: { en: 'Rare', ko: '희귀' },
    epic: { en: 'Epic', ko: '에픽' },
    legendary: { en: 'Legendary', ko: '전설' },
  };
  return labels[filter][lang];
}

/** Returns the per-level effect label for an entity (e.g. "+1,210 Click Power" or "+0.5% Crit Chance"). */
function formatEntityEffect(entity: StageEntity, lang: Lang): string {
  const { type, value, isFlat } = entity.effect;
  if (type === 'click') {
    return `+${formatGameNumber(entity.baseCost * value / 100)} ${t(lang, 'effectClickPower')}`;
  }
  if (type === 'auto') {
    return `+${formatGameNumber(entity.baseCost * value / 100)}${t(lang, 'effectAutoRateUnit')}`;
  }
  if (type === 'crit') {
    return isFlat
      ? `+${formatPct(value)} ${t(lang, 'effectCritChance')}`
      : `+${formatPct(value)} ${t(lang, 'effectCritMult')}`;
  }
  if (type === 'time') return `+${formatPct(value)} ${t(lang, 'effectTimeRate')}`;
  if (type === 'multiplier') return `+${formatPct(value)} ${t(lang, 'effectAllSources')}`;
  if (type === 'entropy') return `+${formatPct(value)} ${t(lang, 'effectEncounterBonus')}`;
  return `+${formatPct(value)} ${type}`;
}

/** Returns the cumulative effect label across all owned levels. */
function formatEntityEffectTotal(entity: StageEntity, count: number, lang: Lang): string {
  if (count === 0) return '';
  const { type, value, isFlat } = entity.effect;
  if (type === 'click') {
    return `+${formatGameNumber(entity.baseCost * value * count / 100)} ${t(lang, 'effectTotal')}`;
  }
  if (type === 'auto') {
    return `+${formatGameNumber(entity.baseCost * value * count / 100)}/s ${t(lang, 'effectTotal')}`;
  }
  if (type === 'crit') {
    return isFlat
      ? `+${formatPct(value * count)} ${t(lang, 'effectCritChance')}`
      : `+${formatPct(value * count)} ${t(lang, 'effectCritMult')}`;
  }
  if (type === 'time') return `+${formatPct(value * count)} ${t(lang, 'effectTimeRate')}`;
  if (type === 'multiplier') return `+${formatPct(value * count)} ${t(lang, 'effectAllSources')}`;
  if (type === 'entropy') return `+${formatPct(value * count)} ${t(lang, 'effectEncounter')}`;
  return `+${formatPct(value * count)} ${type}`;
}

interface Props {
  currentStageId: number;
  purchasedEntities: PurchasedEntityEntry[];
  quanta: number;
  language: Lang;
  onPurchase: (entityId: string) => void;
  onClose: () => void;
  onStageSelect?: (stageId: number) => void;
}

export function EntityPanel({ currentStageId, purchasedEntities, quanta, language, onPurchase, onClose, onStageSelect }: Props) {
  const [selectedStageId, setSelectedStageId] = useState(currentStageId);
  const [inspectedEntityId, setInspectedEntityId] = useState<string | null>(null);
  const [selectedRarity, setSelectedRarity] = useState<RarityFilter>('all');
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
  const entities = useMemo(
    () => selectedRarity === 'all'
      ? stageEntities
      : stageEntities.filter((entity) => entity.rarity === selectedRarity),
    [selectedRarity, stageEntities],
  );
  const rarityCounts = useMemo(
    () => RARITY_FILTERS.reduce<Record<RarityFilter, number>>((acc, filter) => {
      acc[filter] = filter === 'all'
        ? stageEntities.length
        : stageEntities.filter((entity) => entity.rarity === filter).length;
      return acc;
    }, { all: 0, common: 0, rare: 0, epic: 0, legendary: 0 }),
    [stageEntities],
  );

  const countOf = (entity: StageEntity) => getPurchasedEntityCount(purchasedEntities, entity);
  const inspectedEntity = entities.find((entity) => entity.id === inspectedEntityId) ?? null;

  useEffect(() => {
    if (!timelineRef.current) return;
    const selected = timelineRef.current.querySelector<HTMLElement>('.entity-timeline__node--selected');
    selected?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [selectedStageId]);

  useEffect(() => {
    setInspectedEntityId(null);
    setSelectedRarity('all');
  }, [selectedStageId]);

  return (
    <div className="entity-overlay" onClick={onClose}>
      <aside className="entity-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div
          className="entity-panel__header"
          style={{ '--stage-accent': selectedStage?.accent ?? '#8090b0' } as CSSProperties}
        >
          <div>
            <div className="entity-panel__title">{t(language, 'entityLabTitle')}</div>
            <div className="entity-panel__stage" style={{ color: selectedStage?.accent }}>
              {selectedStage ? `${t(language, 'entityLabStageLabel')} ${selectedStage.id} · ${stageName(language, selectedStage.id, selectedStage.name)}` : ''}
            </div>
          </div>
          <div className="entity-panel__wallet">
            <span>{t(language, 'hudQuanta')}</span>
            <strong>{formatGameNumber(quanta)}</strong>
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

        <div className="entity-rarity-tabs" role="tablist" aria-label="Entity rarity filters">
          {RARITY_FILTERS.map((filter) => {
            const isSelected = filter === selectedRarity;
            const color = filter === 'all' ? selectedStage?.accent ?? '#8090b0' : RARITY_COLORS[filter];
            return (
              <button
                key={filter}
                type="button"
                role="tab"
                className={`entity-rarity-tab${isSelected ? ' entity-rarity-tab--active' : ''}`}
                style={{ '--rarity-color': color } as CSSProperties}
                aria-selected={isSelected}
                onClick={() => setSelectedRarity(filter)}
              >
                <span>{rarityLabel(filter, language)}</span>
                <strong>{rarityCounts[filter]}</strong>
              </button>
            );
          })}
        </div>

        {/* Cleared stage banner */}
        {selectedStage && selectedStage.id < currentStageId && (
          <div className="entity-panel__cleared-banner" style={{ '--stage-accent': selectedStage.accent } as CSSProperties}>
            <span className="entity-panel__cleared-paw">✓</span>
            <span>{`${t(language, 'entityLabStageLabel')} ${selectedStage.id} ${t(language, 'entityLabStageCleared')}`}</span>
          </div>
        )}

        {/* Entity list — key changes on stage switch to replay entry animations */}
        <div className="entity-panel__list" key={selectedStageId}>
          {entities.length === 0 && (
            <div className="entity-panel__empty">{t(language, 'entityLabNoEntities')}</div>
          )}
          {entities.map((entity, idx) => (
            <EntityCard
              key={entity.id}
              entity={entity}
              count={countOf(entity)}
              quanta={quanta}
              language={language}
              rarityColor={RARITY_COLORS[entity.rarity]}
              onPurchase={onPurchase}
              onInspect={() => setInspectedEntityId(entity.id)}
              animDelay={idx * 45}
              canPurchase={selectedStageId <= currentStageId}
            />
          ))}
        </div>
        {inspectedEntity ? (
          <EntityDetailCard
            entity={inspectedEntity}
            count={countOf(inspectedEntity)}
            cost={getEntityCost(inspectedEntity, countOf(inspectedEntity))}
            quanta={quanta}
            language={language}
            rarityColor={RARITY_COLORS[inspectedEntity.rarity]}
            canPurchase={selectedStageId <= currentStageId}
            onPurchase={onPurchase}
            onClose={() => setInspectedEntityId(null)}
          />
        ) : null}
      </aside>
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
}

function EntityCard({ entity, count, quanta, language, rarityColor, onPurchase, onInspect, animDelay, canPurchase }: CardProps) {
  const [isCelebrating, setIsCelebrating] = useState(false);
  const celebrationTimeoutRef = useRef<number | null>(null);
  const cost = getEntityCost(entity, count);
  const maxed = entity.maxCount > 0 && count >= entity.maxCount;
  const canAfford = canPurchase && quanta >= cost && !maxed;
  const showLevelProgress = entity.maxCount > 1;
  const levelProgress = showLevelProgress
    ? Math.min(100, Math.max(0, (count / entity.maxCount) * 100))
    : 0;
  const totalEffectLabel = formatEntityEffectTotal(entity, count, language);

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

  const effectLabel = formatEntityEffect(entity, language);
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
      </div>

      {/* Info */}
      <div className="entity-card__info">
        <div className="entity-card__name">{displayName}</div>
        <div className="entity-card__meta">
          <span className="entity-card__effect" style={{ color: rarityColor }}>
            {effectLabel}
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
        {canPurchase && !maxed ? <div className="entity-card__cost">{formatGameNumber(cost)}</div> : null}
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
          {!canPurchase ? t(language, 'entityLabLocked') : maxed ? t(language, 'entityLabMax') : t(language, 'entityLabGet')}
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
  onPurchase: (entityId: string) => void;
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
  onPurchase,
  onClose,
}: DetailCardProps) {
  const maxed = entity.maxCount > 0 && count >= entity.maxCount;
  const canAfford = canPurchase && !maxed && quanta >= cost;
  const effectLabel = formatEntityEffect(entity, language);
  const totalEffectLabel = count > 0 ? formatEntityEffectTotal(entity, count, language) : '';

  return (
    <div className="entity-detail-layer" onClick={onClose}>
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
        <button
          type="button"
          className="entity-detail-card__buy"
          style={canAfford ? { background: rarityColor } : { borderColor: rarityColor, color: rarityColor }}
          disabled={!canAfford}
          onClick={() => onPurchase(entity.id)}
        >
          {maxed ? t(language, 'entityLabMaxed') : canPurchase ? `${t(language, 'entityLabGet')} · ${formatGameNumber(cost)}` : t(language, 'entityLabLocked')}
        </button>
      </article>
    </div>
  );
}
