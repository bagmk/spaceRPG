import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent } from 'react';
import type { EntityInstance, FusionEvent } from '../game/types';
import type { StageEntity, EntityRarity } from '../game/entities/types';
import { getEntityCost } from '../game/entities/types';
import { entityMatchesId, findEntityById, getEntitiesForStage, getPurchasedEntityCount, entityName, entityDescription, getMaxLegacyTimeEntityMultiplierBeforeStage } from '../game/entities/stageItems';
import {
  ENTROPY_FUSION_COST_FRAC,
  EQUIP_SLOT_UNLOCKS,
  FUSION_INPUT_COUNT,
  FUSION_PITY_THRESHOLD,
  FUSION_UP1_CHANCE,
  FUSION_UP2_CHANCE,
  ENTITY_LEVEL_EFFECT_BONUS,
  RARITY_STAGE_GATES,
  RIFT_SLOT_UNLOCKS,
  SET_BONUS,
  type SecondaryStatType,
} from '../game/balance';
import { getAutoOutputAnchor, getEquipCategory, getSetKey, type EquipCategory } from '../game/entities/effects';
import { getExpectedFusionRefund, getMaxFusionRarityIdx } from '../game/entities/fusion';
import { getEnhanceCost, getEnhanceLevelCap } from '../game/entities/enhance';
import { getSecondaryStats, getStagePowerMult, type SecondaryStat } from '../game/entities/substats';
import { familyLabel, familyRole } from '../game/entities/families';
import { getEntityLockPrerequisite, isEntityLockedByAnchor } from '../game/entities/anchors';
import { LoreSection } from './LoreSection';
import { entityLoreId } from '../game/loreLinks';
import { defaultModifiers } from '../game/skills/effects';
import { STAGES } from '../game/stages';
import { formatAutoRateValue, formatEntropyAmount, getCosmicTimeFillRate } from '../game/formulas';
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

const SUBSTAT_LABEL_KEY: Record<SecondaryStatType, Parameters<typeof t>[1]> = {
  critChance: 'effectCritChance',
  critMult: 'effectCritMult',
  comboCap: 'substatComboCap',
  entropyGain: 'substatEntropyGain',
  dropRate: 'substatDropRate',
  fusionBurst: 'substatFusionBurst',
  autoPct: 'hudAuto',
  clickPct: 'effectClickPower',
  offlineEff: 'statOffline',
};

function getLevelMult(level: number): number {
  return 1 + Math.max(0, level - 1) * ENTITY_LEVEL_EFFECT_BONUS;
}

function formatSubstat(sub: SecondaryStat, lang: Lang, level = 1): string {
  const label = t(lang, SUBSTAT_LABEL_KEY[sub.type]);
  const v = sub.value * getLevelMult(level);
  const value = sub.type === 'comboCap' ? `+${v.toFixed(1)}` : `+${v.toFixed(1)}%`;
  return `${value} ${label}`;
}

const RARITY_LABEL_KEY: Record<EntityRarity, Parameters<typeof t>[1]> = {
  common: 'rarityCommon',
  rare: 'rarityRare',
  epic: 'rarityEpic',
  legendary: 'rarityLegendary',
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

// Labels share the EXACT applied formula (entities/effects.ts) — anchor + level.
function getEntityAutoRate(entity: StageEntity, count = 1, level = 1): number {
  return Math.max(0, getAutoOutputAnchor(entity) * (entity.effect.value * count * getLevelMult(level)) / 100);
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
  level = 1,
): string {
  const { type, value, isFlat } = entity.effect;
  const lvl = getLevelMult(level);
  const curved = value * lvl * getStagePowerMult(entity.stageId);
  if (type === 'click') {
    return `+${formatPct(curved)} ${t(lang, 'effectClickPower')}`;
  }
  if (type === 'auto') {
    return `+${formatAutoRateValue(getEntityAutoRate(entity, 1, level))}${t(lang, 'effectAutoRateUnit')}`;
  }
  if (type === 'crit') {
    return isFlat
      ? `+${formatPct(value * lvl)} ${t(lang, 'effectCritChance')}`
      : `+${formatPct(curved)} ${t(lang, 'effectCritMult')}`;
  }
  if (type === 'auto_mult') return `+${formatPct(value * lvl)} ${t(lang, 'effectAutoPower')}`;
  if (type === 'time') return `+${formatPct(getNextTimeRatePct(entity, count, displayStageId))} ${t(lang, 'effectTimeRate')}`;
  if (type === 'multiplier') return `+${formatPct(curved)} ${t(lang, 'effectAllSources')}`;
  if (type === 'entropy') return `+${formatPct(curved)} ${t(lang, 'effectEncounterBonus')}`;
  return `+${formatPct(value * lvl)} ${type}`;
}

/** Returns the cumulative effect label across all owned levels. */
function formatEntityEffectTotal(
  entity: StageEntity,
  count: number,
  lang: Lang,
  displayStageId = entity.stageId,
  level = 1,
): string {
  if (count === 0) return '';
  const { type, value, isFlat } = entity.effect;
  const cappedCount = entity.maxCount > 0 ? Math.min(count, entity.maxCount) : count;
  const lvl = getLevelMult(level);
  const curvedTotal = value * cappedCount * lvl * getStagePowerMult(entity.stageId);
  if (type === 'click') {
    return `+${formatPct(curvedTotal)} ${t(lang, 'effectTotal')}`;
  }
  if (type === 'auto') {
    return `+${formatAutoRateValue(getEntityAutoRate(entity, cappedCount, level))}${t(lang, 'effectAutoRateUnit')} ${t(lang, 'effectTotal')}`;
  }
  if (type === 'crit') {
    return isFlat
      ? `+${formatPct(value * cappedCount * lvl)} ${t(lang, 'effectCritChance')}`
      : `+${formatPct(curvedTotal)} ${t(lang, 'effectCritMult')}`;
  }
  if (type === 'auto_mult') return `+${formatPct(value * cappedCount * lvl)} ${t(lang, 'effectAutoPower')}`;
  if (type === 'time') return `+${formatPct(getTotalTimeRatePct(entity, count, displayStageId))} ${t(lang, 'effectTimeRate')}`;
  if (type === 'multiplier') return `+${formatPct(curvedTotal)} ${t(lang, 'effectAllSources')}`;
  if (type === 'entropy') return `+${formatPct(curvedTotal)} ${t(lang, 'effectEncounter')}`;
  return `+${formatPct(value * cappedCount * lvl)} ${type}`;
}

/** Live combat stats shown on the equip page (computed by GameScreen). */
export interface PanelStats {
  clickPower: number;
  autoRate: number;
  critChance: number;
  critMult: number;
  /** Max combo multiplier (base cap + gear bonuses). */
  comboCapMult: number;
  /** Offline income efficiency 0..1+. */
  offlineEff: number;
  /** Rift emission interval in ms (visual cadence of auto income). */
  emissionIntervalMs: number;
  /** Entropy income multiplier from gear. */
  entropyGainMult: number;
  /** Auto Power — multiplier on entity flat-auto output. */
  autoFlatMult: number;
}

export type PanelPage = 'lab' | 'equip' | 'fuse';

interface Props {
  page: PanelPage;
  /** Which gear category the equip page edits — click gear or the rift (auto). */
  equipCategory: EquipCategory;
  currentStageId: number;
  inventory: EntityInstance[];
  equippedSlots: string[];
  unlockedSlotCount: number;
  riftSlots: string[];
  unlockedRiftSlotCount: number;
  fusionPity: number;
  lastFusionEvent: FusionEvent | null;
  almanacCollected: Record<number, string[]>;
  quanta: number;
  stats: PanelStats;
  language: Lang;
  onPurchase: (entityId: string) => void;
  onEquip: (entityId: string, slot?: number) => void;
  onUnequip: (slot: number, target: EquipCategory) => void;
  onEnhance: (entityId: string) => void;
  onFuse: (inputEntityIds: string[]) => void;
  onClearFusionEvent: (id: number) => void;
  onClose: () => void;
  onStageSelect?: (stageId: number) => void;
  onUITap?: () => void;
}

export function EntityPanel({ page, equipCategory, currentStageId, inventory, equippedSlots, unlockedSlotCount, riftSlots, unlockedRiftSlotCount, fusionPity, lastFusionEvent, almanacCollected, quanta, stats, language, onPurchase, onEquip, onUnequip, onEnhance, onFuse, onClearFusionEvent, onClose, onStageSelect, onUITap }: Props) {
  const [selectedStageId, setSelectedStageId] = useState(currentStageId);
  const [inspectedEntityId, setInspectedEntityId] = useState<string | null>(null);
  const tab = page;
  const [pickingSlot, setPickingSlot] = useState<number | null>(null);
  const [fuseInputs, setFuseInputs] = useState<string[]>([]);
  const timelineRef = useRef<HTMLDivElement>(null);
  const trayRarity = fuseInputs.length > 0 ? findEntityById(fuseInputs[0])?.rarity : undefined;

  // The gear array this equip page edits.
  const gearSlots = equipCategory === 'rift' ? riftSlots : equippedSlots;
  const gearSlotCount = equipCategory === 'rift' ? unlockedRiftSlotCount : unlockedSlotCount;
  const gearRules = equipCategory === 'rift' ? RIFT_SLOT_UNLOCKS : EQUIP_SLOT_UNLOCKS;

  // Owned stacks resolved to entities, selected stage only (tracking stays simple;
  // the timeline switches stages on every page).
  const ownedEntities = useMemo(() => {
    return inventory
      .filter((entry) => entry.count > 0)
      .map((entry) => ({ entry, entity: findEntityById(entry.entityId) }))
      .filter((x): x is { entry: EntityInstance; entity: StageEntity } => Boolean(x.entity))
      .filter((x) => x.entity.stageId === selectedStageId)
      .sort((a, b) => {
        if (a.entity.stageId !== b.entity.stageId) return a.entity.stageId - b.entity.stageId;
        return (RARITY_RANK.get(a.entity.rarity) ?? 0) - (RARITY_RANK.get(b.entity.rarity) ?? 0);
      });
  }, [inventory, selectedStageId]);

  // Picker shows only the matching gear category.
  const pickerEntities = useMemo(
    () => ownedEntities.filter(({ entity }) => getEquipCategory(entity) === equipCategory),
    [ownedEntities, equipCategory],
  );

  // Active set bonus spans both gear categories (largest glyph family counts).
  const equippedEntities = useMemo(
    () => gearSlots.map((id) => (id ? findEntityById(id) : undefined)),
    [gearSlots],
  );
  const allEquippedEntities = useMemo(
    () => [...equippedSlots, ...riftSlots].map((id) => (id ? findEntityById(id) : undefined)),
    [equippedSlots, riftSlots],
  );
  const setInfo = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entity of allEquippedEntities) {
      if (!entity) continue;
      const key = getSetKey(entity);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    let bestKey = '';
    let best = 0;
    for (const [key, count] of counts) {
      if (count > best) { best = count; bestKey = key; }
    }
    const tier = Math.min(best, 3);
    const bonus = tier >= 2 ? SET_BONUS[tier] ?? SET_BONUS[2] : undefined;
    return bonus ? { key: bestKey, count: best, bonus } : null;
  }, [allEquippedEntities]);

  const addFuseInput = (entity: StageEntity) => {
    if (fuseInputs.length >= FUSION_INPUT_COUNT) return;
    const owned = inventory.find((e) => e.entityId === entity.id);
    const usedCopies = fuseInputs.filter((id) => id === entity.id).length;
    if (!owned || owned.count <= usedCopies) return;
    if (trayRarity && entity.rarity !== trayRarity) return;
    setFuseInputs((current) => [...current, entity.id]);
    onUITap?.();
  };

  // Auto-dismiss the fusion result reveal.
  useEffect(() => {
    if (!lastFusionEvent) return undefined;
    const timeoutId = window.setTimeout(() => onClearFusionEvent(lastFusionEvent.id), 2600);
    return () => window.clearTimeout(timeoutId);
  }, [lastFusionEvent, onClearFusionEvent]);

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
  // Alias-aware stack lookup — migrated saves may store entries under legacy ids.
  const ownedEntryOf = (entity: StageEntity) =>
    inventory.find((e) => entityMatchesId(entity, e.entityId));
  const equippedSlotOf = (entity: StageEntity) =>
    (getEquipCategory(entity) === 'rift' ? riftSlots : equippedSlots).indexOf(entity.id);
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
            {tab === 'equip'
              ? t(language, equipCategory === 'rift' ? 'equipRiftTitle' : 'equipClickTitle')
              : tab === 'fuse'
                ? t(language, 'fuseTitle')
                : selectedStage ? `${String(selectedStage.id).padStart(2, '0')} · ${stageName(language, selectedStage.id, selectedStage.name)}` : ''}
          </div>
          <button className="entity-panel__close" onClick={onClose}>✕</button>
        </div>

        {/* Stage Timeline — shared by all pages (filters equip picker + fusion grid too) */}
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


        {tab === 'lab' ? (<>
        {(() => {
          const discovered = new Set(almanacCollected[selectedStageId] ?? []);
          const isCollected = (e: StageEntity) => discovered.has(e.id) || countOf(e) > 0;
          const total = entities.length;
          const got = entities.filter(isCollected).length;
          const pct = total > 0 ? Math.round((got / total) * 100) : 0;
          return (
            <>
              <div className="almanac-progress">
                <div className="almanac-progress__row">
                  <span>{t(language, 'codexCollected')}</span>
                  <span>{`${got} / ${total} · ${pct}%`}</span>
                </div>
                <div className="almanac-progress__bar">
                  <div className="almanac-progress__fill" style={{ width: `${pct}%`, background: selectedStage?.accent }} />
                </div>
              </div>
              <div className="almanac-grid" key={selectedStageId}>
                {entities.length === 0 && (
                  <div className="entity-panel__empty">{t(language, 'entityLabNoEntities')}</div>
                )}
                {entities.map((entity, idx) => {
                  const collected = isCollected(entity);
                  const entry = ownedEntryOf(entity);
                  const rarityColor = RARITY_COLORS[entity.rarity];
                  return (
                    <button
                      key={entity.id}
                      type="button"
                      className={`almanac-card almanac-card--${entity.rarity} ${collected ? '' : 'almanac-card--locked'}`}
                      style={{ '--rarity-color': rarityColor, '--card-anim-delay': `${idx * 35}ms` } as CSSProperties}
                      onClick={() => { if (collected) { setInspectedEntityId(entity.id); onUITap?.(); } }}
                    >
                      <div className="almanac-card__glyph">
                        {collected
                          ? <EntityGlyph entity={entity} color={rarityColor} />
                          : <span className="almanac-card__mystery">?</span>}
                        {equippedSlotOf(entity) >= 0 ? <span className="almanac-card__equipped">★</span> : null}
                      </div>
                      <div className="almanac-card__name">
                        {collected ? entityName(entity, language) : '???'}
                      </div>
                      {collected && entry ? (
                        <div className="almanac-card__meta" style={{ color: rarityColor }}>
                          {`×${entry.count}${entry.level > 1 ? ` · Lv.${entry.level}` : ''}`}
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </>
          );
        })()}
        </>) : null}

        {/* ── Equip page ── */}
        {tab === 'equip' ? (
          <div className="equip-page">
            <div className="equip-page__stats">
              {(equipCategory === 'click'
                ? ([
                    [t(language, 'effectClickPower'), `${formatAutoRateValue(stats.clickPower)} ${t(language, 'hudPerClick')}`],
                    [t(language, 'effectCritChance'), `${(stats.critChance * 100).toFixed(1)}%`],
                    [t(language, 'effectCritMult'), `×${stats.critMult.toFixed(2)}`],
                    [t(language, 'statComboCapMax'), `×${stats.comboCapMult.toFixed(1)}`],
                  ] as [string, string][])
                : ([
                    [t(language, 'hudAuto'), `${formatAutoRateValue(stats.autoRate)}/s`],
                    [t(language, 'effectAutoPower'), `×${stats.autoFlatMult.toFixed(2)}`],
                    [t(language, 'statEmission'), `${(stats.emissionIntervalMs / 1000).toFixed(1)}s`],
                    [t(language, 'statOffline'), `${Math.round(stats.offlineEff * 100)}%`],
                  ] as [string, string][])
              ).map(([label, value]) => (
                <div key={label} className="equip-page__stat">
                  <span className="equip-page__stat-label">{label}</span>
                  <span className="equip-page__stat-value">{value}</span>
                </div>
              ))}
            </div>
            <div className={`equip-page__set ${setInfo ? 'equip-page__set--active' : ''}`}>
              {setInfo
                ? `${t(language, 'setBonusLabel')}: ${setInfo.key} ×${setInfo.count} — ${t(language, 'effectClickPower')}/${t(language, 'hudAuto')} ×${setInfo.bonus.clickAutoMult}${setInfo.bonus.critChanceAdd > 0 ? ` · ${t(language, 'effectCritChance')} +${Math.round(setInfo.bonus.critChanceAdd * 100)}%` : ''}`
                : t(language, 'setBonusNone')}
            </div>
            <div className="equip-page__slots">
              {Array.from({ length: 3 }, (_, i) => {
                if (i >= gearSlotCount) {
                  const rule = gearRules.find((r) => r.slot === i + 1);
                  const hint = rule?.minStageId !== undefined
                    ? t(language, 'equipSlotLockedStage').replace('{n}', String(rule.minStageId))
                    : t(language, 'equipSlotLockedAlmanac').replace('{n}', String(rule?.minAlmanacCount ?? 0));
                  return (
                    <div key={i} className="equip-slot-card equip-slot-card--locked">
                      <span className="equip-slot-card__lock">🔒</span>
                      <span className="equip-slot-card__hint">{hint}</span>
                    </div>
                  );
                }
                const slotEntity = equippedEntities[i];
                const entry = slotEntity ? ownedEntryOf(slotEntity) : undefined;
                return (
                  <button
                    key={i}
                    type="button"
                    className={`equip-slot-card ${slotEntity ? 'equip-slot-card--filled' : ''}`}
                    style={slotEntity ? ({ '--rarity-color': RARITY_COLORS[slotEntity.rarity] } as CSSProperties) : undefined}
                    onClick={() => { setPickingSlot(pickingSlot === i ? null : i); onUITap?.(); }}
                  >
                    {slotEntity ? (
                      <>
                        <div className="equip-slot-card__glyph">
                          <EntityGlyph entity={slotEntity} color={RARITY_COLORS[slotEntity.rarity]} />
                        </div>
                        <div className="equip-slot-card__name">{entityName(slotEntity, language)}</div>
                        <div className="equip-slot-card__meta">
                          {`Lv.${entry?.level ?? 1} · ×${entry?.count ?? 1}`}
                        </div>
                        <div className="equip-slot-card__effect" style={{ color: RARITY_COLORS[slotEntity.rarity] }}>
                          {formatEntityEffectTotal(slotEntity, entry?.count ?? 1, language, currentStageId, entry?.level ?? 1)}
                        </div>
                        {getSecondaryStats(slotEntity).length > 0 ? (
                          <div className="equip-slot-card__substats">
                            {getSecondaryStats(slotEntity).map((sub) => (
                              <span key={sub.type}>{formatSubstat(sub, language, entry?.level ?? 1)}</span>
                            ))}
                          </div>
                        ) : null}
                        {(() => {
                          const level = entry?.level ?? 1;
                          const cap = getEnhanceLevelCap(slotEntity);
                          const atCap = level >= cap;
                          const cost = getEnhanceCost(slotEntity, level);
                          return (
                            <span
                              role="button"
                              tabIndex={0}
                              className={`equip-slot-card__enhance ${atCap || quanta < cost ? 'equip-slot-card__enhance--off' : ''}`}
                              onClick={(e) => { e.stopPropagation(); if (!atCap && quanta >= cost) onEnhance(slotEntity.id); }}
                              onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !atCap && quanta >= cost) { e.stopPropagation(); onEnhance(slotEntity.id); } }}
                            >
                              {atCap
                                ? `${t(language, 'enhanceLabel')} ${t(language, 'enhanceMax')}`
                                : `${t(language, 'enhanceLabel')} ⚛${formatEntityCost(cost)}`}
                            </span>
                          );
                        })()}
                        <span
                          role="button"
                          tabIndex={0}
                          className="equip-slot-card__remove"
                          aria-label={t(language, 'entityUnequip')}
                          onClick={(e) => { e.stopPropagation(); onUnequip(i, equipCategory); }}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onUnequip(i, equipCategory); } }}
                        >
                          ✕
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="equip-slot-card__plus">＋</span>
                        <span className="equip-slot-card__hint">{t(language, 'equipSlotEmpty')}</span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
            {pickingSlot !== null ? (
              <div className="equip-picker">
                <div className="equip-picker__title">{t(language, 'equipPickTitle')}</div>
                {pickerEntities.length === 0 ? (
                  <div className="entity-panel__empty">{t(language, 'equipPickEmpty')}</div>
                ) : (
                  <div className="owned-grid">
                    {pickerEntities.map(({ entry, entity }) => {
                      const alreadyAt = gearSlots.indexOf(entity.id);
                      return (
                        <button
                          key={entity.id}
                          type="button"
                          className={`owned-card ${alreadyAt >= 0 ? 'owned-card--dim' : ''}`}
                          style={{ '--rarity-color': RARITY_COLORS[entity.rarity] } as CSSProperties}
                          disabled={alreadyAt >= 0 && alreadyAt !== pickingSlot}
                          onClick={() => {
                            onEquip(entity.id, pickingSlot);
                            setPickingSlot(null);
                          }}
                        >
                          <span className="owned-card__formula" style={{ color: RARITY_COLORS[entity.rarity] }}>{entity.formula}</span>
                          <span className="owned-card__name">{entityName(entity, language)}</span>
                          <span className="owned-card__count">{`×${entry.count}${entry.level > 1 ? ` · Lv.${entry.level}` : ''}`}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* ── Fusion forge page ── */}
        {tab === 'fuse' ? (
          <div className="fuse-page">
            <div className="fuse-page__hint">{t(language, 'fuseHint')}</div>
            <div className="owned-grid fuse-page__grid">
              {ownedEntities.length === 0 ? (
                <div className="entity-panel__empty">{t(language, 'equipPickEmpty')}</div>
              ) : (
                ownedEntities.map(({ entry, entity }) => {
                  const usedCopies = fuseInputs.filter((id) => id === entity.id).length;
                  const blocked =
                    fuseInputs.length >= FUSION_INPUT_COUNT ||
                    entry.count <= usedCopies ||
                    (trayRarity !== undefined && entity.rarity !== trayRarity);
                  return (
                    <button
                      key={entity.id}
                      type="button"
                      className={`owned-card ${blocked ? 'owned-card--dim' : ''}`}
                      style={{ '--rarity-color': RARITY_COLORS[entity.rarity] } as CSSProperties}
                      disabled={blocked}
                      onClick={() => addFuseInput(entity)}
                    >
                      <span className="owned-card__formula" style={{ color: RARITY_COLORS[entity.rarity] }}>{entity.formula}</span>
                      <span className="owned-card__name">{entityName(entity, language)}</span>
                      <span className="owned-card__count">{`×${entry.count - usedCopies}`}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ) : null}

        {/* Fusion tray (Phase 3) */}
        {tab === 'fuse' ? (
          <div className="fusion-tray">
            <div className="fusion-tray__slots">
              {Array.from({ length: FUSION_INPUT_COUNT }, (_, i) => {
                const inputId = fuseInputs[i];
                const inputEntity = inputId ? findEntityById(inputId) : undefined;
                return (
                  <button
                    key={i}
                    type="button"
                    className={`fusion-tray__slot ${inputEntity ? 'fusion-tray__slot--filled' : ''}`}
                    onClick={() => {
                      if (!inputId) return;
                      setFuseInputs((current) => current.filter((_, j) => j !== i));
                    }}
                  >
                    {inputEntity ? (
                      <span style={{ color: RARITY_COLORS[inputEntity.rarity] }}>{inputEntity.formula}</span>
                    ) : (
                      <span className="fusion-tray__plus">+</span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="fusion-tray__info">
              {fuseInputs.length === 0 ? (
                <span>{t(language, 'fuseHint')}</span>
              ) : (
                <>
                  {(() => {
                    // Upgrade odds + pity only apply below the stage's fusion cap;
                    // a capped tray shows the cap instead of impossible odds.
                    const maxIdx = getMaxFusionRarityIdx(currentStageId);
                    const trayIdx = trayRarity ? RARITY_ORDER.indexOf(trayRarity) : 0;
                    if (trayIdx >= maxIdx) {
                      return (
                        <span className="fusion-tray__cap">
                          {t(language, 'fuseMaxRarity').replace('{r}', t(language, RARITY_LABEL_KEY[RARITY_ORDER[maxIdx]]))}
                        </span>
                      );
                    }
                    const up2Possible = trayIdx + 2 <= maxIdx;
                    return (
                      <>
                        <span>
                          {`${t(language, 'fuseOddsUp1')} ${Math.round(FUSION_UP1_CHANCE * 100)}%${up2Possible ? ` · ${t(language, 'fuseOddsUp2')} ${Math.round(FUSION_UP2_CHANCE * 100)}%` : ''}`}
                        </span>
                        <span className="fusion-tray__pity">
                          {t(language, 'fusePity').replace('{n}', String(Math.max(0, FUSION_PITY_THRESHOLD - fusionPity)))}
                        </span>
                      </>
                    );
                  })()}
                  <span>{`${t(language, 'fuseCostLabel')} ⚛${formatEntityCost(quanta * ENTROPY_FUSION_COST_FRAC)}`}</span>
                  {(() => {
                    const expected = getExpectedFusionRefund(inventory, fuseInputs);
                    if (expected <= 0) return null;
                    return (
                      <span className="fusion-tray__refund">
                        {`${t(language, 'fuseRefund')} +⚛${formatEntityCost(expected)}`}
                      </span>
                    );
                  })()}
                </>
              )}
            </div>
            <button
              type="button"
              className="fusion-tray__fuse"
              disabled={fuseInputs.length !== FUSION_INPUT_COUNT}
              onClick={() => { onFuse(fuseInputs); setFuseInputs([]); }}
            >
              {t(language, 'fuseButton')}
            </button>
          </div>
        ) : null}
      </aside>
      {/* Fusion result reveal */}
      {lastFusionEvent ? (() => {
        const output = findEntityById(lastFusionEvent.outputEntityId);
        if (!output) return null;
        return (
          <div
            className="fusion-result"
            role="status"
            onClick={(e) => { e.stopPropagation(); onClearFusionEvent(lastFusionEvent.id); }}
          >
            <div
              className={`fusion-result__card fusion-result__card--${output.rarity} ${lastFusionEvent.rarityUp ? 'fusion-result__card--up' : ''}`}
              style={{ '--rarity-color': RARITY_COLORS[output.rarity] } as CSSProperties}
            >
              <div className="fusion-result__tag">
                {lastFusionEvent.atCap
                  ? t(language, 'fuseResultRefund')
                  : lastFusionEvent.rarityUp
                    ? t(language, 'fuseResultUp')
                    : lastFusionEvent.leveledUp
                      ? t(language, 'fuseResultLevel')
                      : t(language, 'fuseResultNew')}
              </div>
              <EntityGlyph entity={output} color={RARITY_COLORS[output.rarity]} />
              <div className="fusion-result__name">{entityName(output, language)}</div>
              <div className="fusion-result__burst">
                {`+${formatEntropyAmount(lastFusionEvent.entropyBurst)} ${t(language, 'hudEntropy')}`}
              </div>
              {lastFusionEvent.refund > 0 ? (
                <div className="fusion-result__refund">
                  {`${t(language, 'fuseRefund')} +⚛${formatEntityCost(lastFusionEvent.refund)}`}
                </div>
              ) : null}
            </div>
          </div>
        );
      })() : null}
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
          ownedLevel={ownedEntryOf(inspectedEntity)?.level ?? 1}
          onPurchase={onPurchase}
          onEquip={onEquip}
          onUnequip={(slot) => onUnequip(slot, getEquipCategory(inspectedEntity))}
          onEnhance={onEnhance}
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
  /** Rarity gate not reached yet — render as a "???" mystery teaser. */
  rarityLocked?: boolean;
  ownedLevel?: number;
}

function EntityCard({ entity, count, quanta, language, rarityColor, onPurchase, onInspect, animDelay, canPurchase, anchorLockedBy, displayStageId, isEquipped, rarityLocked, ownedLevel = 1 }: CardProps) {
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

  const effectLabel = formatEntityEffect(entity, language, displayStageId, count, ownedLevel);
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
        rarityLocked ? 'entity-card--mystery' : '',
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
        <div className="entity-card__name">{rarityLocked ? '???' : displayName}</div>
        <div className="entity-card__meta">
          <span className="entity-card__effect" style={{ color: rarityColor }}>
            {rarityLocked
              ? t(language, 'equipSlotLockedStage').replace('{n}', String(RARITY_STAGE_GATES[entity.rarity] ?? 1))
              : anchorLockedBy
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
  ownedLevel: number;
  onPurchase: (entityId: string) => void;
  onEquip: (entityId: string) => void;
  onUnequip: (slot: number) => void;
  onEnhance: (entityId: string) => void;
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
  ownedLevel,
  onPurchase,
  onEquip,
  onUnequip,
  onEnhance,
  onClose,
}: DetailCardProps) {
  const maxed = entity.maxCount > 0 && count >= entity.maxCount;
  const canAfford = canPurchase && !maxed && quanta >= cost;
  const isEquipped = equippedSlot >= 0;
  const effectLabel = formatEntityEffect(entity, language, displayStageId, count, ownedLevel);
  const totalEffectLabel = count > 0 ? formatEntityEffectTotal(entity, count, language, displayStageId, ownedLevel) : '';

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
        <div className="entity-detail-card__family">
          <span className="entity-detail-card__family-name" style={{ color: rarityColor }}>
            {familyLabel(entity.visual.glyph, language)}
          </span>
          <span className="entity-detail-card__family-role">{familyRole(entity.visual.glyph, language)}</span>
        </div>
        <p className="entity-detail-card__description">{entityDescription(entity, language)}</p>
        <div className="entity-detail-card__stats">
          <span style={{ color: rarityColor }}>{effectLabel}</span>
          <span>{entity.maxCount > 1 ? `${count}/${entity.maxCount}` : count > 0 ? t(language, 'entityLabOwned') : t(language, 'entityLabUnowned')}</span>
          {totalEffectLabel ? <span style={{ color: rarityColor }}>{totalEffectLabel}</span> : null}
        </div>
        {getSecondaryStats(entity).length > 0 ? (
          <div className="entity-detail-card__substats">
            {getSecondaryStats(entity).map((sub) => (
              <span key={sub.type} style={{ color: rarityColor }}>{formatSubstat(sub, language, ownedLevel)}</span>
            ))}
          </div>
        ) : null}
        <LoreSection loreId={entityLoreId(entity.stageId, entity.name)} language={language} />
        {count > 0 ? (
          <button
            type="button"
            className={`entity-detail-card__equip ${isEquipped ? 'entity-detail-card__equip--on' : ''}`}
            style={isEquipped ? { borderColor: rarityColor, color: rarityColor } : { background: rarityColor }}
            onClick={() => (isEquipped ? onUnequip(equippedSlot) : onEquip(entity.id))}
          >
            {isEquipped ? t(language, 'entityUnequip') : t(language, 'entityEquip')}
          </button>
        ) : (
          <div className="entity-detail-card__undiscovered">{t(language, 'codexConsumed')}</div>
        )}
        {count > 0 ? (() => {
          const cap = getEnhanceLevelCap(entity);
          const atCap = ownedLevel >= cap;
          const enhCost = getEnhanceCost(entity, ownedLevel);
          const affordable = !atCap && quanta >= enhCost;
          return (
            <button
              type="button"
              className="entity-detail-card__equip entity-detail-card__enhance"
              style={affordable ? { background: '#bb8cff' } : { borderColor: '#bb8cff', color: '#bb8cff' }}
              disabled={!affordable}
              onClick={() => onEnhance(entity.id)}
            >
              {atCap
                ? `${t(language, 'enhanceLabel')} ${t(language, 'enhanceMax')} (Lv.${ownedLevel})`
                : `${t(language, 'enhanceLabel')} Lv.${ownedLevel} → ${ownedLevel + 1} · ⚛${formatEntityCost(enhCost)}`}
            </button>
          );
        })() : null}
      </article>
    </div>
  );
}
