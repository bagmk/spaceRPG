import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { EntityInstance, FusionEvent } from '../game/types';
import type { StageEntity, EntityRarity } from '../game/entities/types';
import { STAGE_ENTITIES, entityMatchesId, findEntityById, getOwnedEntityCount, getPurchasedEntityCount, entityName, entityDescription, getMaxLegacyTimeEntityMultiplierBeforeStage } from '../game/entities/stageItems';
import {
  CODEX_MASS_BONUS,
  ENTROPY_FUSION_COST_FRAC,
  EQUIP_SLOT_UNLOCKS,
  FUSION_INPUT_COUNT,
  FUSION_PITY_THRESHOLD,
  FUSION_UP1_CHANCE,
  FUSION_UP2_CHANCE,
  ENTITY_LEVEL_EFFECT_BONUS,
  LEGACY_TIME_ENTITY_EFFECT_FACTOR,
  RARITY_STAGE_GATES,
  RIFT_SLOT_UNLOCKS,
  SET_BONUS,
  type SecondaryStatType,
} from '../game/balance';
import { getAutoOutputAnchor, getEffectiveCount, getEquipCategory, getSetKey, type EquipCategory } from '../game/entities/effects';
import { getMaxFusionRarityIdx } from '../game/entities/fusion';
import { getEnhanceCost, getEnhanceLevelCap } from '../game/entities/enhance';
import { getGearPowerMult, getSecondaryStats, type GearPower, type SecondaryStat } from '../game/entities/substats';
import { familyLabel, familyRole } from '../game/entities/families';
import { CODEX_SETS, codexRewardLabel, codexSetLabel, codexSubsetLabel, collectedIdSet, getCodexCompletionFraction, getSubsetMembers, isSetComplete, isSubsetComplete, type CodexReward } from '../game/entities/codexSets';
import { LoreSection } from './LoreSection';
import { entityLoreId } from '../game/loreLinks';
import { defaultModifiers } from '../game/skills/effects';
import { STAGES } from '../game/stages';
import { formatAutoRateValue, formatEntropyAmount, getCosmicTimeFillRate } from '../game/formulas';
import { EntityGlyph } from './EntityGlyph';
import { t, type Lang } from '../i18n';

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

function formatSubstat(sub: SecondaryStat, lang: Lang, level = 1, gearPower = 1): string {
  const label = t(lang, SUBSTAT_LABEL_KEY[sub.type]);
  // Mirrors applyEntityModifiers: `scales` substats ride the gear power curve.
  const v = sub.value * getLevelMult(level) * (sub.scales ? gearPower : 1);
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

// Labels share the EXACT applied formula (entities/effects.ts) — anchor + soft-capped count + level.
function getEntityAutoRate(entity: StageEntity, power: GearPower, count = 1, level = 1, carried = false): number {
  const effCount = getEffectiveCount(count, entity.maxCount, false);
  return Math.max(0, getAutoOutputAnchor(entity, power, carried) * (entity.effect.value * effCount * getLevelMult(level)) / 100);
}

function getEntityTimeFillRate(entity: StageEntity, count: number, level: number, playerStageId: number): number {
  const mods = defaultModifiers();
  // Mirrors applyEntityModifiers' time branch: hard count cap, level multiplier,
  // and the legacy factor for past-stage time gear — keyed to the PLAYER stage.
  const cappedCount = Math.min(Math.max(0, count), entity.maxCount);
  const legacyFactor = entity.stageId < playerStageId ? LEGACY_TIME_ENTITY_EFFECT_FACTOR : 1;
  mods.timeMultMult = getMaxLegacyTimeEntityMultiplierBeforeStage(playerStageId);
  if (cappedCount > 0) {
    mods.timeMultMult *= 1 + (entity.effect.value * cappedCount * getLevelMult(level) * legacyFactor) / 100;
  }
  return getCosmicTimeFillRate(mods, 1, playerStageId);
}

function getEffectiveTimeRatePct(
  entity: StageEntity,
  level: number,
  playerStageId: number,
  fromCount: number,
  toCount: number,
): number {
  const beforeRate = getEntityTimeFillRate(entity, fromCount, level, playerStageId);
  const afterRate = getEntityTimeFillRate(entity, toCount, level, playerStageId);
  if (!Number.isFinite(beforeRate) || beforeRate <= 0 || !Number.isFinite(afterRate)) return entity.effect.value;
  return Math.max(0, (afterRate / beforeRate - 1) * 100);
}

function getNextTimeRatePct(entity: StageEntity, count: number, level: number, playerStageId: number): number {
  const cappedCount = Math.min(Math.max(0, count), entity.maxCount);
  const nextCount = Math.min(entity.maxCount, cappedCount + 1);
  const fromCount = nextCount === cappedCount && cappedCount > 0 ? cappedCount - 1 : cappedCount;
  return getEffectiveTimeRatePct(entity, level, playerStageId, fromCount, nextCount);
}

function getTotalTimeRatePct(entity: StageEntity, count: number, level: number, playerStageId: number): number {
  const cappedCount = Math.min(Math.max(0, count), entity.maxCount);
  return getEffectiveTimeRatePct(entity, level, playerStageId, 0, cappedCount);
}

/** Returns the per-level effect label for an entity (e.g. "+15% Click Power" or "+0.5% Crit Chance"). */
function formatEntityEffect(
  entity: StageEntity,
  lang: Lang,
  power: GearPower,
  count = 0,
  level = 1,
  carried = false,
): string {
  const { type, value, isFlat } = entity.effect;
  const lvl = getLevelMult(level);
  // Curve follows the player's live power; carried items drop the itemStage clamp.
  const curved = value * lvl * getGearPowerMult(power, entity.stageId, carried);
  if (type === 'click') {
    return `+${formatPct(curved)} ${t(lang, 'effectClickPower')}`;
  }
  if (type === 'auto') {
    return `+${formatAutoRateValue(getEntityAutoRate(entity, power, 1, level, carried))}${t(lang, 'effectAutoRateUnit')}`;
  }
  if (type === 'crit') {
    return isFlat
      ? `+${formatPct(value * lvl)} ${t(lang, 'effectCritChance')}`
      : `+${formatPct(curved)} ${t(lang, 'effectCritMult')}`;
  }
  if (type === 'auto_mult') return `+${formatPct(value * lvl)} ${t(lang, 'effectAutoPower')}`;
  if (type === 'time') return `+${formatPct(getNextTimeRatePct(entity, count, level, power.stageId))} ${t(lang, 'effectTimeRate')}`;
  if (type === 'multiplier') return `+${formatPct(curved)} ${t(lang, 'effectAllSources')}`;
  if (type === 'entropy') return `+${formatPct(curved)} ${t(lang, 'effectEncounterBonus')}`;
  return `+${formatPct(value * lvl)} ${type}`;
}

/** Returns the cumulative effect label across all owned levels. */
function formatEntityEffectTotal(
  entity: StageEntity,
  count: number,
  lang: Lang,
  power: GearPower,
  level = 1,
  carried = false,
): string {
  if (count === 0) return '';
  const { type, value, isFlat } = entity.effect;
  // Soft-capped count + player-power curve — matches applyEntityModifiers exactly.
  const effCount = getEffectiveCount(count, entity.maxCount, type === 'time');
  const lvl = getLevelMult(level);
  const curvedTotal = value * effCount * lvl * getGearPowerMult(power, entity.stageId, carried);
  if (type === 'click') {
    return `+${formatPct(curvedTotal)} ${t(lang, 'effectTotal')}`;
  }
  if (type === 'auto') {
    return `+${formatAutoRateValue(getEntityAutoRate(entity, power, count, level, carried))}${t(lang, 'effectAutoRateUnit')} ${t(lang, 'effectTotal')}`;
  }
  if (type === 'crit') {
    return isFlat
      ? `+${formatPct(value * effCount * lvl)} ${t(lang, 'effectCritChance')}`
      : `+${formatPct(curvedTotal)} ${t(lang, 'effectCritMult')}`;
  }
  if (type === 'auto_mult') return `+${formatPct(value * effCount * lvl)} ${t(lang, 'effectAutoPower')}`;
  if (type === 'time') return `+${formatPct(getTotalTimeRatePct(entity, count, level, power.stageId))} ${t(lang, 'effectTimeRate')}`;
  if (type === 'multiplier') return `+${formatPct(curvedTotal)} ${t(lang, 'effectAllSources')}`;
  if (type === 'entropy') return `+${formatPct(curvedTotal)} ${t(lang, 'effectEncounter')}`;
  return `+${formatPct(value * effCount * lvl)} ${type}`;
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
  /** Entropy-gate progress 0..1 — fractional gear power exponent (label == applied). */
  gateProgress01: number;
  inventory: EntityInstance[];
  equippedSlots: string[];
  unlockedSlotCount: number;
  riftSlots: string[];
  unlockedRiftSlotCount: number;
  fusionPity: number;
  lastFusionEvent: FusionEvent | null;
  almanacCollected: Record<number, string[]>;
  /** Entity ids already seen in the codex — drives the NEW-discovery badge (v18). */
  codexSeenIds?: string[];
  /** First-visit panel hint ids already shown (codex/equip/fuse intro lines, v18). */
  seenPanelHints?: string[];
  quanta: number;
  stats: PanelStats;
  language: Lang;
  onEquip: (entityId: string, slot?: number) => void;
  onUnequip: (slot: number, target: EquipCategory) => void;
  onEnhance: (entityId: string) => void;
  onFuse: (inputEntityIds: string[]) => void;
  onClearFusionEvent: (id: number) => void;
  onClose: () => void;
  onStageSelect?: (stageId: number) => void;
  onUITap?: () => void;
  /** Snapshot all collected ids as seen (clears NEW badges). */
  onMarkCodexSeen?: () => void;
  /** Record a first-visit hint as shown. */
  onMarkPanelHint?: (hintId: string) => void;
}

export function EntityPanel({ page, equipCategory, currentStageId, gateProgress01, inventory, equippedSlots, unlockedSlotCount, riftSlots, unlockedRiftSlotCount, fusionPity, lastFusionEvent, almanacCollected, codexSeenIds, seenPanelHints, quanta, stats, language, onEquip, onUnequip, onEnhance, onFuse, onClearFusionEvent, onClose, onStageSelect, onUITap, onMarkCodexSeen, onMarkPanelHint }: Props) {
  // Full-screen tab + equip-category are now interactive state (seeded from the
  // entry point), so one overlay hosts all three pages and the click/rift toggle.
  const [tab, setTab] = useState<PanelPage>(page);
  const [equipCat, setEquipCat] = useState<EquipCategory>(equipCategory);
  const [rarityFilter, setRarityFilter] = useState<'all' | EntityRarity>('all');
  // Stage browsing is gone — items show across all eras at once. The prop stays
  // for API compatibility but is no longer driven from here.
  void onStageSelect;
  // Live gear-power context — all effect labels derive from this (label == applied).
  const power: GearPower = { stageId: currentStageId, gateProgress01 };
  const [selectedSetId, setSelectedSetId] = useState<string>('all');
  const [showMissing, setShowMissing] = useState(false);
  // v18: NEW-discovery badge snapshot + first-visit hint visibility (per session).
  const [codexNew, setCodexNew] = useState<Set<string>>(new Set());
  const [hintShow, setHintShow] = useState<Record<string, boolean>>({});
  const [inspectedEntityId, setInspectedEntityId] = useState<string | null>(null);
  // Equip: hero-stat breakdown expand, slot-detail inspector, on-demand filter.
  const [statsExpanded, setStatsExpanded] = useState(false);
  const [inspectedSlot, setInspectedSlot] = useState<number | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [pickingSlot, setPickingSlot] = useState<number | null>(null);
  const [fuseInputs, setFuseInputs] = useState<string[]>([]);
  // Gacha suspense: brief "charging" beat before the result is committed.
  const [fusing, setFusing] = useState(false);
  const [hasFused, setHasFused] = useState(false);
  const fuseTimerRef = useRef<number | null>(null);
  const trayRarity = fuseInputs.length > 0 ? findEntityById(fuseInputs[0])?.rarity : undefined;

  const playerStage = STAGES.find((s) => s.id === currentStageId) ?? STAGES[STAGES.length - 1];
  const accent = playerStage?.accent ?? '#8090b0';

  const switchTab = (next: PanelPage) => {
    if (next === tab) return;
    setTab(next);
    setInspectedEntityId(null);
    setInspectedSlot(null);
    setPickingSlot(null);
    onUITap?.();
  };
  const switchEquipCat = (next: EquipCategory) => {
    if (next === equipCat) return;
    setEquipCat(next);
    setInspectedSlot(null);
    setPickingSlot(null);
    onUITap?.();
  };

  // Gacha "tempt fate" beat: spin for a moment, THEN commit the fusion so the
  // result lands as a reveal (suspense, not an instant swap).
  const FUSE_CHARGE_MS = 720;
  const triggerFuse = (inputsArg?: string[]) => {
    const inputs = inputsArg ?? fuseInputs;
    if (fusing || inputs.length !== FUSION_INPUT_COUNT) return;
    setFusing(true);
    setHasFused(true);
    onUITap?.();
    fuseTimerRef.current = window.setTimeout(() => {
      onFuse(inputs);
      setFuseInputs([]);
      setFusing(false);
      fuseTimerRef.current = null;
    }, FUSE_CHARGE_MS);
  };
  useEffect(() => () => {
    if (fuseTimerRef.current !== null) window.clearTimeout(fuseTimerRef.current);
  }, []);

  // The gear array this equip page edits.
  const gearSlots = equipCat === 'rift' ? riftSlots : equippedSlots;
  const gearSlotCount = equipCat === 'rift' ? unlockedRiftSlotCount : unlockedSlotCount;
  const gearRules = equipCat === 'rift' ? RIFT_SLOT_UNLOCKS : EQUIP_SLOT_UNLOCKS;

  // Every owned stack, across ALL eras — sorted best-first (rarity desc → era asc).
  const ownedEntities = useMemo(() => {
    return inventory
      .filter((entry) => entry.count > 0)
      .map((entry) => ({ entry, entity: findEntityById(entry.entityId) }))
      .filter((x): x is { entry: EntityInstance; entity: StageEntity } => Boolean(x.entity))
      .sort((a, b) => {
        const rr = (RARITY_RANK.get(b.entity.rarity) ?? 0) - (RARITY_RANK.get(a.entity.rarity) ?? 0);
        if (rr !== 0) return rr;
        if (a.entity.stageId !== b.entity.stageId) return a.entity.stageId - b.entity.stageId;
        return a.entity.baseCost - b.entity.baseCost;
      });
  }, [inventory]);

  // Rarity-filter chip applied on top of the full list (shared by equip + fuse grids).
  const rarityFiltered = useMemo(
    () => (rarityFilter === 'all' ? ownedEntities : ownedEntities.filter(({ entity }) => entity.rarity === rarityFilter)),
    [ownedEntities, rarityFilter],
  );

  // Equip grid shows only the matching gear category (click vs rift).
  const pickerEntities = useMemo(
    () => rarityFiltered.filter(({ entity }) => getEquipCategory(entity) === equipCat),
    [rarityFiltered, equipCat],
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

  // Auto-dismiss the fusion reveal — a rarity-up detonation lingers; a plain
  // level-up/refund is a quick flash so spam-fusing never waits on a cutscene.
  useEffect(() => {
    if (!lastFusionEvent) return undefined;
    const ms = lastFusionEvent.rarityUp ? 3200 : 1000;
    const timeoutId = window.setTimeout(() => onClearFusionEvent(lastFusionEvent.id), ms);
    return () => window.clearTimeout(timeoutId);
  }, [lastFusionEvent, onClearFusionEvent]);

  const countOf = (entity: StageEntity) => getPurchasedEntityCount(inventory, entity);
  // Alias-aware stack lookup — migrated saves may store entries under legacy ids.
  const ownedEntryOf = (entity: StageEntity) =>
    inventory.find((e) => entityMatchesId(entity, e.entityId));
  // Inspected card resolves across the whole roster (codex spans all eras).
  const inspectedEntity = inspectedEntityId ? findEntityById(inspectedEntityId) : null;

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

  // Every discovered id (almanac record ∪ owned stacks) — drives the NEW badge.
  const collectedAllIds = useMemo(() => {
    const s = new Set<string>(collectedIdSet(almanacCollected));
    for (const e of inventory) if (e.count > 0) s.add(e.entityId);
    return s;
  }, [almanacCollected, inventory]);

  // On entering the Codex, snapshot what's NEW since last visit; on leaving,
  // persist all-collected as seen (badges stay for the whole session view).
  useEffect(() => {
    if (tab !== 'lab') return undefined;
    const seen = new Set(codexSeenIds ?? []);
    const fresh = new Set<string>();
    for (const id of collectedAllIds) if (!seen.has(id)) fresh.add(id);
    setCodexNew(fresh);
    return () => { onMarkCodexSeen?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // First-visit hint per tab: snapshot "show" before marking it seen.
  useEffect(() => {
    const key = tab === 'lab' ? 'codex' : tab;
    if ((seenPanelHints ?? []).includes(key) || hintShow[key]) return;
    setHintShow((m) => ({ ...m, [key]: true }));
    onMarkPanelHint?.(key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const TABS: { id: PanelPage; key: Parameters<typeof t>[1] }[] = [
    { id: 'lab', key: 'tabCodex' },
    { id: 'equip', key: 'tabEquip' },
    { id: 'fuse', key: 'tabFuse' },
  ];

  // Shared rarity-filter chip row (equip + fusion grids).
  const rarityFilterBar = (
    <div className="rarity-filter">
      {(['all', 'common', 'rare', 'epic', 'legendary'] as const).map((r) => (
        <button
          key={r}
          type="button"
          className={`rarity-filter__chip ${rarityFilter === r ? 'rarity-filter__chip--active' : ''}`}
          style={r === 'all' ? undefined : ({ '--rarity-color': RARITY_COLORS[r] } as CSSProperties)}
          onClick={() => { setRarityFilter(r); onUITap?.(); }}
        >
          {r === 'all' ? t(language, 'rarityAll') : t(language, RARITY_LABEL_KEY[r])}
        </button>
      ))}
    </div>
  );

  return (
    <div className="entity-fs" onClick={onClose}>
      <section
        className="entity-fs__panel"
        onClick={(e) => e.stopPropagation()}
        style={{ '--stage-accent': accent } as CSSProperties}
      >
        {/* Top bar — tabs / wallet / close (one overlay hosts all three pages) */}
        <header className="entity-fs__topbar">
          <nav className="entity-fs__tabs" aria-label={t(language, 'tabCodex')}>
            {TABS.map((tabDef) => (
              <button
                key={tabDef.id}
                type="button"
                className={`entity-fs__tab ${tab === tabDef.id ? 'entity-fs__tab--active' : ''}`}
                aria-pressed={tab === tabDef.id}
                onClick={() => switchTab(tabDef.id)}
              >
                {t(language, tabDef.key)}
              </button>
            ))}
          </nav>
          {tab !== 'lab' ? (
            <div className="entity-fs__wallet">
              <span>{t(language, 'hudQuanta')}</span>
              <strong>⚛{formatEntityCost(quanta)}</strong>
            </div>
          ) : null}
          <button className="entity-fs__close" aria-label={t(language, 'panelClose')} onClick={onClose}>✕</button>
        </header>

        <div className="entity-fs__body">


        {tab === 'lab' ? (() => {
          // Codex: a glyph wall crowned by ONE completion meter. Sets→subsets
          // span all eras; chips are an opt-in filter (default = all).
          const collectedSet = collectedIdSet(almanacCollected);
          const isCollected = (e: StageEntity) => collectedSet.has(e.id) || countOf(e) > 0;

          // HERO meter — global completion + the prestige-mass factor it grants.
          const totalAll = STAGE_ENTITIES.length;
          const collectedAll = STAGE_ENTITIES.filter(isCollected).length;
          const codexPct = totalAll > 0 ? Math.round((collectedAll / totalAll) * 100) : 0;
          const massFactor = 1 + getCodexCompletionFraction(almanacCollected) * CODEX_MASS_BONUS;

          // Closest-to-completion nudge — the cheapest next reward (fewest missing).
          let closest: { label: string; remaining: number } | null = null;
          for (const cs of CODEX_SETS) {
            for (const sub of cs.subsets) {
              const rem = getSubsetMembers(sub, STAGE_ENTITIES).filter((m) => !isCollected(m)).length;
              if (rem > 0 && (closest === null || rem < closest.remaining)) {
                closest = { label: codexSubsetLabel(sub, language), remaining: rem };
              }
            }
          }

          const shortReward = (r: CodexReward) => `+${r.value}%`;
          const setsToRender = selectedSetId === 'all'
            ? CODEX_SETS
            : CODEX_SETS.filter((cs) => cs.id === selectedSetId);

          return (
            <>
              {/* HERO completion meter */}
              <div className="codex-hero">
                <div className="codex-hero__row">
                  <span className="codex-hero__count">
                    {collectedAll}
                    <span className="codex-hero__total">{` / ${totalAll} ${t(language, 'codexMeterFound')} · ${codexPct}%`}</span>
                  </span>
                  <span className="codex-hero__mass">
                    {t(language, 'codexMassFactor')} <b>×{massFactor.toFixed(2)}</b>
                  </span>
                </div>
                <div className="codex-hero__bar">
                  <div className="codex-hero__fill" style={{ width: `${codexPct}%` }} />
                </div>
                {hintShow['codex'] ? <div className="codex-hero__caption">{t(language, 'codexPurpose')}</div> : null}
                {closest ? (
                  <div className="codex-hero__nudge">
                    {`▸ ${t(language, 'codexClosest').replace('{name}', closest.label).replace('{n}', String(closest.remaining))}`}
                  </div>
                ) : null}
              </div>

              {/* Set filter chips (default 전체) + missing-only toggle. No mini-bar. */}
              <div className="codex-sets">
                <button
                  type="button"
                  className={`codex-set-chip ${selectedSetId === 'all' ? 'codex-set-chip--active' : ''}`}
                  onClick={() => { setSelectedSetId('all'); onUITap?.(); }}
                >
                  <span className="codex-set-chip__label">{t(language, 'rarityAll')}</span>
                  <span className="codex-set-chip__count">{`${collectedAll}/${totalAll}`}</span>
                </button>
                {CODEX_SETS.map((cs) => {
                  const ids = new Set<string>();
                  for (const sub of cs.subsets) for (const m of getSubsetMembers(sub, STAGE_ENTITIES)) ids.add(m.id);
                  const members = STAGE_ENTITIES.filter((e) => ids.has(e.id));
                  const done = members.filter(isCollected).length;
                  const full = isSetComplete(cs, collectedSet, STAGE_ENTITIES);
                  const near = !full && members.length - done > 0 && members.length - done <= 2;
                  const hasNew = members.some((m) => codexNew.has(m.id));
                  return (
                    <button
                      key={cs.id}
                      type="button"
                      className={`codex-set-chip ${cs.id === selectedSetId ? 'codex-set-chip--active' : ''} ${full ? 'codex-set-chip--full' : ''} ${near ? 'codex-set-chip--near' : ''}`}
                      style={{ '--set-accent': cs.accent } as CSSProperties}
                      onClick={() => { setSelectedSetId(cs.id); onUITap?.(); }}
                    >
                      {hasNew ? <span className="codex-set-chip__dot" aria-hidden="true" /> : null}
                      <span className="codex-set-chip__icon">{cs.icon}</span>
                      <span className="codex-set-chip__label">{codexSetLabel(cs, language)}</span>
                      <span className="codex-set-chip__count">{`${done}/${members.length}`}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  className={`codex-set-chip codex-set-chip--toggle ${showMissing ? 'codex-set-chip--active' : ''}`}
                  onClick={() => { setShowMissing((v) => !v); onUITap?.(); }}
                >
                  <span className="codex-set-chip__label">{t(language, 'codexShowMissing')}</span>
                </button>
              </div>

              {/* The glyph wall — thin set/subset dividers, dense cards. */}
              {setsToRender.map((cs) => {
                const setDone = isSetComplete(cs, collectedSet, STAGE_ENTITIES);
                return (
                  <Fragment key={cs.id}>
                    {selectedSetId === 'all' ? (
                      <div className="codex-divider codex-divider--set" style={{ '--set-accent': cs.accent } as CSSProperties}>
                        <span className="codex-divider__icon">{cs.icon}</span>
                        <span className="codex-divider__label">{codexSetLabel(cs, language)}</span>
                        <span className={`codex-reward ${setDone ? 'codex-reward--earned' : ''}`} title={codexRewardLabel(cs.reward, language)}>
                          <span className="codex-reward__star">{setDone ? '★' : '☆'}</span>
                          <span className="codex-reward__text">{shortReward(cs.reward)}</span>
                        </span>
                      </div>
                    ) : null}
                    {cs.subsets.map((sub) => {
                      const members = getSubsetMembers(sub, STAGE_ENTITIES)
                        .sort((a, b) => (a.stageId - b.stageId) || ((RARITY_RANK.get(a.rarity) ?? 0) - (RARITY_RANK.get(b.rarity) ?? 0)));
                      const subDone = isSubsetComplete(sub, collectedSet, STAGE_ENTITIES);
                      const subGot = members.filter(isCollected).length;
                      const visible = showMissing ? members.filter((m) => !isCollected(m)) : members;
                      if (visible.length === 0) return null;
                      return (
                        <div className="codex-subset" key={sub.id}>
                          <div className="codex-divider">
                            <span className="codex-divider__label">{codexSubsetLabel(sub, language)}</span>
                            <span className="codex-divider__count">{`${subGot}/${members.length}`}</span>
                            <span className={`codex-reward ${subDone ? 'codex-reward--earned' : ''}`} title={codexRewardLabel(sub.reward, language)}>
                              <span className="codex-reward__star">{subDone ? '★' : '☆'}</span>
                              <span className="codex-reward__text">{shortReward(sub.reward)}</span>
                            </span>
                            <span className="codex-divider__rule" />
                          </div>
                          <div className="almanac-grid">
                            {visible.map((entity, idx) => {
                              const collected = isCollected(entity);
                              const rarityColor = RARITY_COLORS[entity.rarity];
                              return (
                                <button
                                  key={entity.id}
                                  type="button"
                                  className={`almanac-card almanac-card--${entity.rarity} ${collected ? '' : 'almanac-card--locked'}`}
                                  style={{ '--rarity-color': rarityColor, '--card-anim-delay': `${Math.min(idx, 24) * 25}ms` } as CSSProperties}
                                  onClick={() => { if (collected) { setInspectedEntityId(entity.id); onUITap?.(); } }}
                                >
                                  {collected && codexNew.has(entity.id) ? (
                                    <span className="almanac-card__new">NEW</span>
                                  ) : null}
                                  <div className="almanac-card__glyph">
                                    {collected
                                      ? <EntityGlyph entity={entity} color={rarityColor} />
                                      : <span className="almanac-card__mystery">?</span>}
                                  </div>
                                  {collected ? (
                                    <div className="almanac-card__name">{entityName(entity, language)}</div>
                                  ) : null}
                                  <span className="almanac-card__era">{`S${entity.stageId}`}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </Fragment>
                );
              })}
            </>
          );
        })() : null}

        {/* ── Equip page ── */}
        {tab === 'equip' ? (() => {
          const heroValue = equipCat === 'click'
            ? `${formatAutoRateValue(stats.clickPower)} ${t(language, 'hudPerClick')}`
            : `${formatAutoRateValue(stats.autoRate)}/s`;
          const heroLabel = equipCat === 'click' ? t(language, 'effectClickPower') : t(language, 'hudAuto');
          const breakdown: [string, string][] = equipCat === 'click'
            ? [
                [t(language, 'effectCritChance'), `${(stats.critChance * 100).toFixed(1)}%`],
                [t(language, 'effectCritMult'), `×${stats.critMult.toFixed(2)}`],
                [t(language, 'statComboCapMax'), `×${stats.comboCapMult.toFixed(1)}`],
              ]
            : [
                [t(language, 'effectAutoPower'), `×${stats.autoFlatMult.toFixed(2)}`],
                [t(language, 'statEmission'), `${(stats.emissionIntervalMs / 1000).toFixed(1)}s`],
                [t(language, 'statOffline'), `${Math.round(stats.offlineEff * 100)}%`],
              ];
          // Strength score proportional to applied multiplicative contribution —
          // used only for relative deltas while picking (ratio is meaningful).
          const gearStrength = (entity: StageEntity, entry?: EntityInstance) => {
            const count = entry?.count ?? 1;
            const level = entry?.level ?? 1;
            return entity.effect.value * getEffectiveCount(count, entity.maxCount, false)
              * getLevelMult(level) * getGearPowerMult(power, entity.stageId, entry?.carried);
          };
          const pickEquipped = pickingSlot !== null ? equippedEntities[pickingSlot] : undefined;
          const pickBase = pickEquipped ? gearStrength(pickEquipped, ownedEntryOf(pickEquipped)) : 0;
          const dominantKey = setInfo?.key;
          return (
            <div className="equip-page">
              {hintShow['equip'] ? <div className="equip-purpose">{t(language, 'equipPurpose')}</div> : null}
              {/* Click vs Rift(auto) gear toggle — plain-outcome labels */}
              <div className="equip-cat-toggle">
                {(['click', 'rift'] as EquipCategory[]).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`equip-cat-toggle__btn ${equipCat === cat ? 'equip-cat-toggle__btn--active' : ''}`}
                    aria-pressed={equipCat === cat}
                    onClick={() => switchEquipCat(cat)}
                  >
                    {t(language, cat === 'rift' ? 'equipCatRift' : 'equipCatClick')}
                  </button>
                ))}
              </div>

              {/* HERO — the one number you grow (4-stat detail behind ⌄) */}
              <div className="equip-hero">
                <div className="equip-hero__label">{heroLabel}</div>
                <div className="equip-hero__value-row">
                  <span className="equip-hero__value" key={heroValue}>{heroValue}</span>
                  <button
                    type="button"
                    className={`equip-hero__toggle ${statsExpanded ? 'equip-hero__toggle--open' : ''}`}
                    aria-label={t(language, 'equipStatDetails')}
                    aria-expanded={statsExpanded}
                    onClick={() => { setStatsExpanded((v) => !v); onUITap?.(); }}
                  >⌄</button>
                </div>
                {statsExpanded ? (
                  <div className="equip-hero__breakdown">
                    {breakdown.map(([label, value]) => (
                      <div key={label} className="equip-hero__stat">
                        <span className="equip-hero__stat-label">{label}</span>
                        <span className="equip-hero__stat-value">{value}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* Loadout — slots show identity + strength only; tap for detail */}
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
                  const linked = Boolean(slotEntity && dominantKey && getSetKey(slotEntity) === dominantKey);
                  return (
                    <button
                      key={i}
                      type="button"
                      className={`equip-slot-card ${slotEntity ? 'equip-slot-card--filled' : ''} ${pickingSlot === i ? 'equip-slot-card--picking' : ''} ${linked ? 'equip-slot-card--linked' : ''}`}
                      style={slotEntity ? ({ '--rarity-color': RARITY_COLORS[slotEntity.rarity] } as CSSProperties) : undefined}
                      onClick={() => {
                        if (slotEntity) { setInspectedSlot(i); }
                        else { setPickingSlot(pickingSlot === i ? null : i); }
                        onUITap?.();
                      }}
                    >
                      {slotEntity ? (
                        <>
                          {linked ? <span className="equip-slot-card__set">⬡</span> : null}
                          <div className="equip-slot-card__glyph">
                            <EntityGlyph entity={slotEntity} color={RARITY_COLORS[slotEntity.rarity]} />
                          </div>
                          <div className="equip-slot-card__name">{entityName(slotEntity, language)}</div>
                          <div className="equip-slot-card__effect" style={{ color: RARITY_COLORS[slotEntity.rarity] }}>
                            {formatEntityEffectTotal(slotEntity, entry?.count ?? 1, language, power, entry?.level ?? 1, entry?.carried)}
                          </div>
                        </>
                      ) : (
                        <>
                          <span className="equip-slot-card__plus">＋</span>
                          <span className="equip-slot-card__hint">{t(language, 'equipSlotTapFill')}</span>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Active set magnitude (compact) + batch enhance */}
              <div className="equip-actions">
                {setInfo ? (
                  <span className="equip-set-chip">
                    {`⬡ ${t(language, 'setBonusLabel')} ×${setInfo.bonus.clickAutoMult}${setInfo.bonus.critChanceAdd > 0 ? ` · ${t(language, 'effectCritChance')} +${Math.round(setInfo.bonus.critChanceAdd * 100)}%` : ''}`}
                  </span>
                ) : <span />}
                <button
                  type="button"
                  className="equip-enhance-all"
                  onClick={() => { equippedEntities.forEach((e) => { if (e) onEnhance(e.id); }); }}
                >
                  {t(language, 'enhanceAll')}
                </button>
              </div>

              {/* Owned gear of this category — quiet at rest, deltas while picking */}
              <div className="entity-inv">
                <div className="entity-inv__head">
                  <span className="entity-inv__title">
                    {pickingSlot !== null
                      ? t(language, 'equipPickActive')
                      : `${t(language, 'ownedItemsLabel')} (${pickerEntities.length})`}
                  </span>
                  <button
                    type="button"
                    className={`entity-inv__filter ${filterOpen ? 'entity-inv__filter--on' : ''}`}
                    aria-label={t(language, 'rarityAll')}
                    onClick={() => { setFilterOpen((v) => !v); onUITap?.(); }}
                  >
                    <i className="ti ti-filter" aria-hidden="true"></i>
                  </button>
                </div>
                {filterOpen ? rarityFilterBar : null}
                {pickerEntities.length === 0 ? (
                  <div className="entity-panel__empty">{t(language, 'equipPickEmpty')}</div>
                ) : (
                  <div className="owned-grid">
                    {pickerEntities.map(({ entry, entity }) => {
                      const alreadyAt = gearSlots.indexOf(entity.id);
                      let delta: number | null = null;
                      if (pickingSlot !== null && pickBase > 0 && alreadyAt < 0) {
                        const d = Math.round((gearStrength(entity, entry) / pickBase - 1) * 100);
                        if (Number.isFinite(d)) delta = d;
                      }
                      return (
                        <button
                          key={entity.id}
                          type="button"
                          className={`owned-card ${alreadyAt >= 0 ? 'owned-card--dim' : ''}`}
                          style={{ '--rarity-color': RARITY_COLORS[entity.rarity] } as CSSProperties}
                          disabled={alreadyAt >= 0}
                          onClick={() => {
                            let target = pickingSlot;
                            if (target === null) {
                              for (let s = 0; s < gearSlotCount; s++) { if (!gearSlots[s]) { target = s; break; } }
                            }
                            if (target === null) return;
                            onEquip(entity.id, target);
                            setPickingSlot(null);
                          }}
                        >
                          {delta !== null ? (
                            <span className={`owned-card__delta ${delta > 0 ? 'owned-card__delta--up' : delta < 0 ? 'owned-card__delta--down' : ''}`}>
                              {delta > 0 ? `+${delta}%` : `${delta}%`}
                            </span>
                          ) : null}
                          <span className="owned-card__formula" style={{ color: RARITY_COLORS[entity.rarity] }}>{entity.formula}</span>
                          <span className="owned-card__name">{entityName(entity, language)}</span>
                          <span className="owned-card__count">{`×${entry.count}${entry.level > 1 ? ` · Lv.${entry.level}` : ''}`}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })() : null}

        {/* ── Fusion forge page — luck-based gacha ── */}
        {tab === 'fuse' ? (() => {
          const maxIdx = getMaxFusionRarityIdx(currentStageId);
          const trayIdx = trayRarity ? RARITY_ORDER.indexOf(trayRarity) : 0;
          const capped = trayRarity !== undefined && trayIdx >= maxIdx;
          const up2Possible = trayIdx + 2 <= maxIdx;
          const remaining = Math.max(0, FUSION_PITY_THRESHOLD - fusionPity);
          const pityPct = Math.min(100, Math.round((fusionPity / FUSION_PITY_THRESHOLD) * 100));
          const ready = fuseInputs.length === FUSION_INPUT_COUNT;
          const cost = quanta * ENTROPY_FUSION_COST_FRAC;

          // Fusable-trio pressure + auto-fill: copies available per rarity.
          const copiesByRarity = new Map<EntityRarity, number>();
          for (const { entry, entity } of ownedEntities) {
            copiesByRarity.set(entity.rarity, (copiesByRarity.get(entity.rarity) ?? 0) + entry.count);
          }
          const triosAt = (r: EntityRarity) => Math.floor((copiesByRarity.get(r) ?? 0) / FUSION_INPUT_COUNT);
          const trios = trayRarity ? triosAt(trayRarity) : RARITY_ORDER.reduce((s, r) => s + triosAt(r), 0);
          const autoFillAndFuse = () => {
            const cand = trayRarity && triosAt(trayRarity) > 0
              ? trayRarity
              : RARITY_ORDER.filter((r) => triosAt(r) > 0)
                  .sort((a, b) => (copiesByRarity.get(b) ?? 0) - (copiesByRarity.get(a) ?? 0))[0];
            if (!cand) return;
            const ids: string[] = [];
            for (const { entry, entity } of ownedEntities) {
              if (entity.rarity !== cand) continue;
              for (let k = 0; k < entry.count && ids.length < FUSION_INPUT_COUNT; k++) ids.push(entity.id);
              if (ids.length >= FUSION_INPUT_COUNT) break;
            }
            if (ids.length < FUSION_INPUT_COUNT) return;
            setFuseInputs(ids);
            triggerFuse(ids);
          };

          return (
            <div className="fuse-page">
              {hintShow['fuse'] ? <div className="fuse-loop-hint">{t(language, 'fuseLoopHint')}</div> : null}
              {/* The altar — the whole bet (stake / cost / odds / pity) on one lever */}
              <div className={`gacha-altar ${ready ? 'gacha-altar--ready' : ''}`}>
                <div className="gacha-altar__slots">
                  {Array.from({ length: FUSION_INPUT_COUNT }, (_, i) => {
                    const inputId = fuseInputs[i];
                    const inputEntity = inputId ? findEntityById(inputId) : undefined;
                    return (
                      <button
                        key={i}
                        type="button"
                        className={`gacha-slot ${inputEntity ? 'gacha-slot--filled' : ''}`}
                        style={inputEntity ? ({ '--rarity-color': RARITY_COLORS[inputEntity.rarity] } as CSSProperties) : undefined}
                        onClick={() => {
                          if (!inputId) return;
                          setFuseInputs((current) => current.filter((_, j) => j !== i));
                          onUITap?.();
                        }}
                      >
                        {inputEntity ? (
                          <EntityGlyph entity={inputEntity} color={RARITY_COLORS[inputEntity.rarity]} />
                        ) : (
                          <span className="gacha-slot__plus">＋</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="gacha-altar__caption">
                  {fuseInputs.length === 0
                    ? t(language, 'fuseAltarEmpty')
                    : ready
                      ? t(language, 'fuseAltarReady')
                      : t(language, 'fuseHint')}
                </div>
                <button
                  type="button"
                  className={`gacha-fuse-btn ${fusing ? 'gacha-fuse-btn--charging' : ''} ${ready && !fusing ? 'gacha-fuse-btn--armed' : ''}`}
                  disabled={!ready || fusing}
                  onClick={() => triggerFuse()}
                >
                  <span className="gacha-fuse-btn__label">
                    {fusing
                      ? t(language, 'fuseChanting')
                      : ready
                        ? t(language, 'fuseLeverReady').replace('{cost}', formatEntityCost(cost))
                        : t(language, 'fuseLeverNeed')}
                  </span>
                  <span className="gacha-fuse-btn__pity" style={{ width: `${pityPct}%` }} aria-hidden="true" />
                </button>
                <div className="gacha-odds">
                  {capped ? (
                    <span className="gacha-odds__cap">
                      {t(language, 'fuseMaxRarity').replace('{r}', t(language, RARITY_LABEL_KEY[RARITY_ORDER[maxIdx]]))}
                    </span>
                  ) : (
                    <>
                      <span className="gacha-odds__up1">{`⬆ ${t(language, 'fuseOddsUp1')} ${Math.round(FUSION_UP1_CHANCE * 100)}%`}</span>
                      {up2Possible ? (
                        <span className="gacha-odds__up2">{`⬆⬆ ${t(language, 'fuseOddsUp2')} ${Math.round(FUSION_UP2_CHANCE * 100)}%`}</span>
                      ) : null}
                    </>
                  )}
                  <span className="gacha-odds__pity">
                    {remaining === 0
                      ? t(language, 'fusePityNow')
                      : `${t(language, 'fusePityTitle')} ${t(language, 'fuseTimesUnit').replace('{n}', String(remaining))}`}
                  </span>
                </div>
              </div>

              {/* Fuel tray — quiet, adjacent; first tap locks rarity */}
              <div className="entity-inv entity-inv--fuse">
                <div className="entity-inv__head">
                  <span className="entity-inv__title">{t(language, 'fuseFuel')}</span>
                  {trios > 0 ? <span className="entity-inv__sub">{t(language, 'fuseTrios').replace('{n}', String(trios))}</span> : null}
                </div>
                {hasFused && fuseInputs.length === 0 && trios > 0 ? (
                  <button type="button" className="gacha-again" onClick={autoFillAndFuse}>
                    {t(language, 'fuseAgainAuto')}
                  </button>
                ) : null}
                {rarityFilterBar}
                {rarityFiltered.length === 0 ? (
                  <div className="entity-panel__empty">{t(language, 'equipPickEmpty')}</div>
                ) : (
                  <div className="owned-grid">
                    {rarityFiltered.map(({ entry, entity }) => {
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
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })() : null}
        </div>
      </section>
      {/* Charging beat — suspense before the reveal lands */}
      {fusing ? (
        <div className="fusion-charge" role="status" aria-live="polite">
          <div className="fusion-charge__core">
            {fuseInputs[0] ? (
              <EntityGlyph entity={findEntityById(fuseInputs[0])!} color={RARITY_COLORS[trayRarity ?? 'common']} />
            ) : null}
          </div>
          <div className="fusion-charge__label">{t(language, 'fuseChanting')}</div>
        </div>
      ) : null}
      {/* Fusion result reveal */}
      {lastFusionEvent ? (() => {
        const output = findEntityById(lastFusionEvent.outputEntityId);
        if (!output) return null;
        return (
          <div
            className={`fusion-result ${lastFusionEvent.rarityUp ? 'fusion-result--boom' : 'fusion-result--quiet'}`}
            role="status"
            onClick={(e) => { e.stopPropagation(); onClearFusionEvent(lastFusionEvent.id); }}
          >
            <div
              className={`fusion-result__card fusion-result__card--${output.rarity} ${lastFusionEvent.rarityUp ? 'fusion-result__card--up' : ''}`}
              style={{ '--rarity-color': RARITY_COLORS[output.rarity] } as CSSProperties}
            >
              {lastFusionEvent.rarityUp ? <div className="fusion-result__rays" aria-hidden="true" /> : null}
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
          count={getOwnedEntityCount(inventory, inspectedEntity)}
          language={language}
          rarityColor={RARITY_COLORS[inspectedEntity.rarity]}
          power={power}
          ownedLevel={ownedEntryOf(inspectedEntity)?.level ?? 1}
          onClose={() => setInspectedEntityId(null)}
        />
      ) : null}
      {/* Equip slot detail — gear actions (enhance / swap / unequip) live here */}
      {inspectedSlot !== null && equippedEntities[inspectedSlot] ? (() => {
        const i = inspectedSlot;
        const ent = equippedEntities[i]!;
        const entry = ownedEntryOf(ent);
        const lvl = entry?.level ?? 1;
        const cap = getEnhanceLevelCap(ent);
        const atCap = lvl >= cap;
        const cost = getEnhanceCost(ent, lvl, currentStageId);
        const affordable = !atCap && quanta >= cost;
        const rc = RARITY_COLORS[ent.rarity];
        return (
          <div className="entity-detail-layer" role="dialog" aria-modal="true" onClick={() => setInspectedSlot(null)}>
            <article className={`entity-detail-card entity-detail-card--${ent.rarity}`} style={{ '--rarity-color': rc } as CSSProperties} onClick={(e) => e.stopPropagation()}>
              <button type="button" className="entity-detail-card__close" aria-label={t(language, 'panelClose')} onClick={() => setInspectedSlot(null)}>×</button>
              <div className="entity-detail-card__visual"><EntityGlyph entity={ent} color={rc} /></div>
              <div className="entity-detail-card__formula" style={{ color: rc }}>{ent.formula}</div>
              <h3 className="entity-detail-card__name">{entityName(ent, language)}</h3>
              <div className="entity-detail-card__stats">
                <span style={{ color: rc }}>{formatEntityEffectTotal(ent, entry?.count ?? 1, language, power, lvl, entry?.carried)}</span>
                <span>{`Lv.${lvl} · ×${entry?.count ?? 1}`}</span>
              </div>
              {getSecondaryStats(ent).length > 0 ? (
                <div className="entity-detail-card__substats">
                  {getSecondaryStats(ent).map((sub) => (
                    <span key={sub.type} style={{ color: rc }}>{formatSubstat(sub, language, lvl, getGearPowerMult(power, ent.stageId, entry?.carried))}</span>
                  ))}
                </div>
              ) : null}
              <button
                type="button"
                className="entity-detail-card__equip entity-detail-card__enhance"
                style={affordable ? { background: '#bb8cff' } : { borderColor: '#bb8cff', color: '#bb8cff' }}
                disabled={!affordable}
                onClick={() => onEnhance(ent.id)}
              >
                {atCap
                  ? `${t(language, 'enhanceLabel')} ${t(language, 'enhanceMax')} (Lv.${lvl})`
                  : `${t(language, 'enhanceLabel')} Lv.${lvl} → ${lvl + 1} · ⚛${formatEntityCost(cost)}`}
              </button>
              <div className="slot-detail__actions">
                <button type="button" className="entity-detail-card__equip" style={{ borderColor: rc, color: rc }} onClick={() => { setPickingSlot(i); setInspectedSlot(null); }}>
                  {t(language, 'equipSwap')}
                </button>
                <button type="button" className="entity-detail-card__equip slot-detail__remove" onClick={() => { onUnequip(i, equipCat); setInspectedSlot(null); }}>
                  {t(language, 'entityUnequip')}
                </button>
              </div>
            </article>
          </div>
        );
      })() : null}
    </div>
  );
}

interface DetailCardProps {
  entity: StageEntity;
  count: number;
  language: Lang;
  rarityColor: string;
  power: GearPower;
  ownedLevel: number;
  onClose: () => void;
}

/**
 * Codex trophy view — a found-entity showcase, NOT a control panel. Identity
 * first (glyph, name, family, what it does, lore); gear actions (equip/enhance)
 * and gear-optimisation math (substats, totals) live on the 장착 tab instead.
 */
function EntityDetailCard({
  entity,
  count,
  language,
  rarityColor,
  power,
  ownedLevel,
  onClose,
}: DetailCardProps) {
  const effectLabel = formatEntityEffect(entity, language, power, count, ownedLevel);

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
          <span>{entity.maxCount > 1 ? `${count}/${entity.maxCount}` : count > 0 ? t(language, 'entityLabOwned') : t(language, 'codexConsumed')}</span>
        </div>
        <LoreSection loreId={entityLoreId(entity.stageId, entity.name)} language={language} />
      </article>
    </div>
  );
}
