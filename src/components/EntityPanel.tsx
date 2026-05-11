import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { PurchasedEntityEntry } from '../game/types';
import type { StageEntity, EntityRarity } from '../game/entities/types';
import { getEntityCost } from '../game/entities/types';
import { getEntitiesForStage } from '../game/entities/stageItems';
import { STAGES } from '../game/stages';
import { formatGameNumber } from '../game/formulas';
import { EntityGlyph } from './EntityGlyph';

const RARITY_ORDER: EntityRarity[] = ['common', 'rare', 'epic', 'legendary'];
const RARITY_RANK = new Map<EntityRarity, number>(RARITY_ORDER.map((rarity, index) => [rarity, index]));

const RARITY_LABELS: Record<EntityRarity, string> = {
  common: 'COMMON',
  rare: 'RARE',
  epic: 'EPIC',
  legendary: 'LEGENDARY',
};

const RARITY_COLORS: Record<EntityRarity, string> = {
  common: '#6db86d',
  rare: '#4a8fff',
  epic: '#b060f0',
  legendary: '#ffa500',
};

const EFFECT_LABELS: Record<string, string> = {
  auto: 'Auto Rate',
  click: 'Click Power',
  crit: 'Crit Chance',
  time: 'Cosmic Time',
  entropy: 'Entropy Gain',
  combo_cap: 'Combo Cap',
  multiplier: 'All Sources',
};

function formatEffectValue(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
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

  const countOf = (entityId: string) =>
    purchasedEntities.find((e) => e.entityId === entityId)?.count ?? 0;

  useEffect(() => {
    if (!timelineRef.current) return;
    const selected = timelineRef.current.querySelector<HTMLElement>('.entity-timeline__node--selected');
    selected?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
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
            <span>Stage {selectedStage.id} cleared — entities still active</span>
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
              count={countOf(entity.id)}
              quanta={quanta}
              rarityColor={RARITY_COLORS[entity.rarity]}
              onPurchase={onPurchase}
              animDelay={idx * 45}
            />
          ))}
        </div>
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
  animDelay: number;
}

function EntityCard({ entity, count, quanta, rarityColor, onPurchase, animDelay }: CardProps) {
  const [isCelebrating, setIsCelebrating] = useState(false);
  const celebrationTimeoutRef = useRef<number | null>(null);
  const cost = getEntityCost(entity, count);
  const maxed = entity.maxCount > 0 && count >= entity.maxCount;
  const canAfford = quanta >= cost && !maxed;
  const showLevelProgress = entity.maxCount > 1 && count > 0;
  const levelProgress = showLevelProgress
    ? Math.min(100, Math.max(0, (count / entity.maxCount) * 100))
    : 0;
  const totalEffectLabel = `+${formatEffectValue(entity.effect.value * count)}`;

  useEffect(() => {
    return () => {
      if (celebrationTimeoutRef.current !== null) {
        window.clearTimeout(celebrationTimeoutRef.current);
      }
    };
  }, []);

  const handlePurchase = () => {
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

  const effectLabel = (() => {
    const label = EFFECT_LABELS[entity.effect.type] ?? entity.effect.type;
    const val = formatEffectValue(entity.effect.value);
    return `+${val} ${label}`;
  })();

  return (
    <div
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
        <div className="entity-card__desc">{entity.description}</div>
        <div className="entity-card__meta">
          <span className="entity-card__rarity" style={{ color: rarityColor }}>
            {RARITY_LABELS[entity.rarity]}
          </span>
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
        {!maxed && <div className="entity-card__cost">{formatGameNumber(cost)}</div>}
        <button
          className={`entity-card__buy ${maxed ? 'entity-card__buy--maxed' : ''}`}
          style={
            maxed
              ? { borderColor: rarityColor, color: rarityColor }
              : canAfford
                ? { background: rarityColor }
                : {}
          }
          disabled={!canAfford}
          onClick={handlePurchase}
        >
          {maxed ? 'MAX' : 'GET'}
        </button>
      </div>
    </div>
  );
}
