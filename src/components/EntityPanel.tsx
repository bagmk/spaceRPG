import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent } from 'react';
import type { PurchasedEntityEntry } from '../game/types';
import type { StageEntity, EntityRarity } from '../game/entities/types';
import { getEntityCost } from '../game/entities/types';
import { getEntitiesForStage, getPurchasedEntityCount } from '../game/entities/stageItems';
import { STAGES } from '../game/stages';
import { formatGameNumber } from '../game/formulas';
import { EntityGlyph } from './EntityGlyph';

const RARITY_ORDER: EntityRarity[] = ['common', 'rare', 'epic', 'legendary'];
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

/** Returns the per-level effect label for an entity (e.g. "+1,210 Click Power" or "+0.5% Crit Chance"). */
function formatEntityEffect(entity: StageEntity): string {
  const { type, value, isFlat } = entity.effect;
  if (type === 'click') {
    return `+${formatGameNumber(entity.baseCost * value / 100)} Click Power`;
  }
  if (type === 'auto') {
    return `+${formatGameNumber(entity.baseCost * value / 100)}/s Auto Rate`;
  }
  if (type === 'crit') {
    return isFlat ? `+${formatPct(value)} Crit Chance` : `+${formatPct(value)} Crit Mult`;
  }
  if (type === 'time') return `+${formatPct(value)} Time Rate`;
  if (type === 'multiplier') return `+${formatPct(value)} All Sources`;
  if (type === 'entropy') return `+${formatPct(value)} Encounter Bonus`;
  return `+${formatPct(value)} ${type}`;
}

/** Returns the cumulative effect label across all owned levels. */
function formatEntityEffectTotal(entity: StageEntity, count: number): string {
  if (count === 0) return '';
  const { type, value, isFlat } = entity.effect;
  if (type === 'click') {
    return `+${formatGameNumber(entity.baseCost * value * count / 100)} total`;
  }
  if (type === 'auto') {
    return `+${formatGameNumber(entity.baseCost * value * count / 100)}/s total`;
  }
  if (type === 'crit') {
    return isFlat
      ? `+${formatPct(value * count)} Crit Chance`
      : `+${formatPct(value * count)} Crit Mult`;
  }
  if (type === 'time') return `+${formatPct(value * count)} Time Rate`;
  if (type === 'multiplier') return `+${formatPct(value * count)} All Sources`;
  if (type === 'entropy') return `+${formatPct(value * count)} Encounter`;
  return `+${formatPct(value * count)} ${type}`;
}

interface Props {
  currentStageId: number;
  purchasedEntities: PurchasedEntityEntry[];
  quanta: number;
  onPurchase: (entityId: string) => void;
  onClose: () => void;
  onStageSelect?: (stageId: number) => void;
}

export function EntityPanel({ currentStageId, purchasedEntities, quanta, onPurchase, onClose, onStageSelect }: Props) {
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

  const entities = useMemo(
    () =>
      [...getEntitiesForStage(selectedStageId)].sort((a, b) => {
        if (a.baseCost !== b.baseCost) return a.baseCost - b.baseCost;
        return (RARITY_RANK.get(a.rarity) ?? 0) - (RARITY_RANK.get(b.rarity) ?? 0);
      }),
    [selectedStageId],
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
            <div className="entity-panel__title">Entity Lab</div>
            <div className="entity-panel__stage" style={{ color: selectedStage?.accent }}>
              {selectedStage ? `Stage ${selectedStage.id} · ${selectedStage.name}` : ''}
            </div>
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
                    aria-label={`Stage ${s.id}: ${s.name}`}
                    aria-pressed={isSelected}
                  >
                    <span className="entity-timeline__dot">
                      {s.id < currentStageId && !isSelected ? '🐾' : s.id}
                    </span>
                    <span className="entity-timeline__label">{s.name}</span>
                  </button>
                </Fragment>
              );
            })}
          </div>
        </div>

        {/* Cleared stage banner */}
        {selectedStage && selectedStage.id < currentStageId && (
          <div className="entity-panel__cleared-banner" style={{ '--stage-accent': selectedStage.accent } as CSSProperties}>
            <span className="entity-panel__cleared-paw">🐾</span>
            <span>Stage {selectedStage.id} cleared — entities still active and upgradeable</span>
          </div>
        )}

        {/* Entity list — key changes on stage switch to replay entry animations */}
        <div className="entity-panel__list" key={selectedStageId}>
          {entities.length === 0 && (
            <div className="entity-panel__empty">No entities for this stage yet.</div>
          )}
          {entities.map((entity, idx) => (
            <EntityCard
              key={entity.id}
              entity={entity}
              count={countOf(entity)}
              quanta={quanta}
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
  rarityColor: string;
  onPurchase: (entityId: string) => void;
  onInspect: () => void;
  animDelay: number;
  canPurchase: boolean;
}

function EntityCard({ entity, count, quanta, rarityColor, onPurchase, onInspect, animDelay, canPurchase }: CardProps) {
  const [isCelebrating, setIsCelebrating] = useState(false);
  const celebrationTimeoutRef = useRef<number | null>(null);
  const cost = getEntityCost(entity, count);
  const maxed = entity.maxCount > 0 && count >= entity.maxCount;
  const canAfford = canPurchase && quanta >= cost && !maxed;
  const showLevelProgress = entity.maxCount > 1;
  const levelProgress = showLevelProgress
    ? Math.min(100, Math.max(0, (count / entity.maxCount) * 100))
    : 0;
  const totalEffectLabel = formatEntityEffectTotal(entity, count);

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

  const effectLabel = formatEntityEffect(entity);

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
        <div className="entity-card__name">{entity.name}</div>
        <div className="entity-card__meta">
          <span className="entity-card__effect" style={{ color: rarityColor }}>
            {effectLabel}
          </span>
        </div>
        {showLevelProgress ? (
          <div
            className="entity-card__progress-row"
            aria-label={`${entity.name} level ${count} of ${entity.maxCount}`}
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
          {!canPurchase ? 'LOCKED' : maxed ? 'MAX' : 'GET'}
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
  rarityColor,
  canPurchase,
  onPurchase,
  onClose,
}: DetailCardProps) {
  const maxed = entity.maxCount > 0 && count >= entity.maxCount;
  const canAfford = canPurchase && !maxed && quanta >= cost;
  const effectLabel = formatEntityEffect(entity);
  const totalEffectLabel = count > 0 ? formatEntityEffectTotal(entity, count) : '';

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
          aria-label="Close entity detail"
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
        <h3 className="entity-detail-card__name">{entity.name}</h3>
        <p className="entity-detail-card__description">{entity.description}</p>
        <div className="entity-detail-card__stats">
          <span style={{ color: rarityColor }}>{effectLabel}</span>
          <span>{entity.maxCount > 1 ? `${count}/${entity.maxCount}` : count > 0 ? 'Owned' : 'Unowned'}</span>
          {totalEffectLabel ? <span style={{ color: rarityColor }}>{totalEffectLabel}</span> : null}
        </div>
        <button
          type="button"
          className="entity-detail-card__buy"
          style={canAfford ? { background: rarityColor } : { borderColor: rarityColor, color: rarityColor }}
          disabled={!canAfford}
          onClick={() => onPurchase(entity.id)}
        >
          {maxed ? 'MAXED' : canPurchase ? `GET · ${formatGameNumber(cost)}` : 'LOCKED'}
        </button>
      </article>
    </div>
  );
}
