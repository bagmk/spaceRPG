import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { EntityInstance, FusionEvent, EnhanceEvent } from '../game/types';
import type { StageEntity, EntityRarity } from '../game/entities/types';
import { STAGE_ENTITIES, entityMatchesId, findEntityById, getOwnedEntityCount, getPurchasedEntityCount, entityName, entityDescription, getMaxLegacyTimeEntityMultiplierBeforeStage } from '../game/entities/stageItems';
import {
  ENHANCE_UNLOCK_STAGE_ID,
  EQUIP_SLOT_UNLOCKS,
  FUSION_INPUT_COUNT,
  FUSION_BATCH_MAX_TRIOS,
  FUSION_UP1_CHANCE_BY_TIER,
  FUSION_UP2_CHANCE_BY_TIER,
  ENTITY_LEVEL_EFFECT_BONUS,
  LEGACY_TIME_ENTITY_EFFECT_FACTOR,
  RARITY_STAGE_GATES,
  RIFT_SLOT_UNLOCKS,
  SET_BONUS,
  EFFECT_TRAIT,
  SUBSTAT_TRAIT,
  HEX_BINGO_LINES,
  HEX_NODE_XY,
  HEX_LINK_EDGES,
  HEX_WILD_UNLOCK_STAGE,
  type SecondaryStatType,
} from '../game/balance';
import { computeHexBingo } from '../game/entities/hexBingo';
import { getAutoOutputAnchor, getEffectiveCount, getEquipCategory, getEquipSetKey, type EquipCategory } from '../game/entities/effects';
import { getMaxFusionRarityIdx, getFusionQuantaCost } from '../game/entities/fusion';
import { getEnhanceCost, getEnhanceLevelCap, getEnhanceProtectStoneCost, getEnhanceFailChance, isEnhanceStonePhase } from '../game/entities/enhance';
import { getGearPowerMult, getSecondaryStats, type GearPower, type SecondaryStat } from '../game/entities/substats';
import { qualityMult, isTailQuality } from '../game/entities/quality';
import { familyLabel, familyRole } from '../game/entities/families';
import { CODEX_SETS, codexRewardLabel, codexSetLabel, codexSubsetLabel, collectedIdSet, getCodexSubsetIdForEntity, getSubsetMembers, isSetComplete, isSubsetComplete } from '../game/entities/codexSets';
import { LoreSection } from './LoreSection';
import { entityLoreId } from '../game/loreLinks';
import { defaultModifiers } from '../game/skills/effects';
import { STAGES } from '../game/stages';
import { formatAutoRateValue, formatEntropyAmount, getCosmicTimeFillRate } from '../game/formulas';
import { EntityGlyph } from './EntityGlyph';
import { t, type Lang } from '../i18n';

const RARITY_ORDER: EntityRarity[] = ['common', 'rare', 'epic', 'legendary', 'mythic'];
const RARITY_RANK = new Map<EntityRarity, number>(RARITY_ORDER.map((rarity, index) => [rarity, index]));

const RARITY_COLORS: Record<EntityRarity, string> = {
  common: '#6db86d',
  rare: '#4a8fff',
  epic: '#b060f0',
  legendary: '#ffa500',
  mythic: '#ff5db5',
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
  mythic: 'rarityMythic',
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

/**
 * Structured (value, label) parts of an entity's primary effect — feeds the
 * spec-chip so the icon, number, and term render as three distinct pieces
 * instead of one dense string. Mirrors formatEntityEffect / *Total math.
 */
export function effectValueLabel(
  entity: StageEntity,
  lang: Lang,
  power: GearPower,
  count: number,
  level: number,
  carried: boolean,
  total: boolean,
  quality?: number,
): { value: string; label: string } {
  const { type, value, isFlat } = entity.effect;
  const lvl = getLevelMult(level);
  const effCount = total ? getEffectiveCount(count, entity.maxCount, type === 'time') : 1;
  const curve = getGearPowerMult(power, entity.stageId, carried);
  // #50: quality scales the shown number so the card matches the applied power.
  const q = qualityMult(quality);
  const pct = (v: number) => `+${formatPct(v * q)}`;
  switch (type) {
    case 'click':
      return { value: pct(value * effCount * lvl * curve), label: t(lang, 'effectClickPower') };
    case 'auto':
      // The bare "/s" suffix here — NOT effectAutoRateUnit, which already bakes in
      // "Auto Speed" and would duplicate the label the SpecChip renders separately.
      return {
        value: `+${formatAutoRateValue(getEntityAutoRate(entity, power, total ? count : 1, level, carried) * q)}${t(lang, 'effectAutoRatePerSec')}`,
        label: t(lang, 'hudAuto'),
      };
    case 'crit':
      return isFlat
        ? { value: pct(value * effCount * lvl), label: t(lang, 'effectCritChance') }
        : { value: pct(value * effCount * lvl * curve), label: t(lang, 'effectCritMult') };
    case 'auto_mult':
      return { value: pct(value * effCount * lvl), label: t(lang, 'effectAutoPower') };
    case 'time':
      return {
        value: pct(total ? getTotalTimeRatePct(entity, count, level, power.stageId) : getNextTimeRatePct(entity, count, level, power.stageId)),
        label: t(lang, 'effectTimeRate'),
      };
    case 'multiplier':
      return { value: pct(value * effCount * lvl * curve), label: t(lang, 'effectAllSources') };
    case 'entropy':
      return { value: pct(value * effCount * lvl * curve), label: t(lang, 'effectEncounter') };
    case 'combo_cap':
      return { value: `+${(value * effCount * lvl * q).toFixed(1)}`, label: t(lang, 'substatComboCap') };
    default:
      return { value: pct(value * effCount * lvl), label: String(type) };
  }
}

/** Structured substat parts (icon + value + label) for the spec-chip rows. */
function substatValueLabel(
  sub: SecondaryStat,
  lang: Lang,
  level: number,
  gearPower: number,
  quality?: number,
): { icon: string; value: string; label: string } {
  const v = sub.value * getLevelMult(level) * (sub.scales ? gearPower : 1) * qualityMult(quality);
  const value = sub.type === 'comboCap' ? `+${v.toFixed(1)}` : `+${v.toFixed(1)}%`;
  return { icon: SUBSTAT_TRAIT[sub.type], value, label: t(lang, SUBSTAT_LABEL_KEY[sub.type]) };
}

/** Corner trait badge — at-a-glance "what does this item do" on any item card. */
export function TraitBadge({ entity, className = '' }: { entity: StageEntity; className?: string }) {
  const trait = EFFECT_TRAIT[entity.effect.type];
  if (!trait) return null;
  return (
    <span
      className={`trait-badge ${className}`}
      style={{ color: trait.accent, borderColor: trait.accent } as CSSProperties}
      aria-hidden="true"
    >
      {trait.icon}
    </span>
  );
}

/** Icon + value + label chip — the readable spec line inside an expanded card. */
export function SpecChip({ icon, value, label, accent, primary = false }: { icon: string; value: string; label: string; accent: string; primary?: boolean }) {
  return (
    <span className={`spec-chip ${primary ? 'spec-chip--primary' : ''}`} style={{ '--chip-accent': accent } as CSSProperties}>
      <span className="spec-chip__icon">{icon}</span>
      <span className="spec-chip__value">{value}</span>
      <span className="spec-chip__label">{label}</span>
    </span>
  );
}

// The trait shapes the player actually meets, with a short label — shown as a
// legend strip in the equip/fusion screens so ●/■/★/◆/✚ are self-explanatory.
const TRAIT_LEGEND: { type: keyof typeof EFFECT_TRAIT; labelKey: Parameters<typeof t>[1] }[] = [
  { type: 'click', labelKey: 'effectClickPower' },
  { type: 'auto', labelKey: 'hudAuto' },
  { type: 'crit', labelKey: 'effectCritChance' },
  { type: 'auto_mult', labelKey: 'effectAutoPower' },
  { type: 'multiplier', labelKey: 'effectAllSources' },
];

// #48: the SUBSTAT shapes (✷✶🔗🌀🎁⚗⚙🖱🌙) were missing from the legend, so the
// chips on the cards had no key. Driven straight off SUBSTAT_TRAIT/LABEL so it
// can never drift from what the cards actually render.
// A6: critChance / autoPct / clickPct are the SAME stat as the click/auto/crit
// primaries (now sharing their icon) — list them only in the primary legend so
// each stat appears once, not twice.
const SUBSTAT_LEGEND_OMIT: ReadonlySet<SecondaryStatType> = new Set(['critChance', 'autoPct', 'clickPct']);
const SUBSTAT_LEGEND = (Object.keys(SUBSTAT_TRAIT) as SecondaryStatType[])
  .filter((type) => !SUBSTAT_LEGEND_OMIT.has(type))
  .map((type) => ({
    type,
    icon: SUBSTAT_TRAIT[type],
    labelKey: SUBSTAT_LABEL_KEY[type],
  }));

/** Legend explaining what each trait shape means (#42-fix: 도형 직관화).
    Collapsed by default — the per-item SpecChips already label each stat, so the
    full grid is reference-only and was crowding the top of the equip page. */
function TraitLegend({ language }: { language: Lang }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`trait-legend ${open ? 'trait-legend--open' : ''}`}>
      <button
        type="button"
        className="trait-legend__toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="trait-legend__toggle-icon" aria-hidden="true">{open ? '▴' : '▾'}</span>
        {t(language, 'traitLegend')}
      </button>
      {open ? (
        <div className="trait-legend__items">
          {TRAIT_LEGEND.map(({ type, labelKey }) => (
            <span key={type} className="trait-legend__item">
              <span className="trait-legend__icon" style={{ color: EFFECT_TRAIT[type].accent }}>{EFFECT_TRAIT[type].icon}</span>
              <span className="trait-legend__label">{t(language, labelKey)}</span>
            </span>
          ))}
          <span className="trait-legend__divider" aria-hidden="true" />
          {SUBSTAT_LEGEND.map(({ type, icon, labelKey }) => (
            <span key={type} className="trait-legend__item trait-legend__item--sub">
              <span className="trait-legend__icon trait-legend__icon--sub">{icon}</span>
              <span className="trait-legend__label">{t(language, labelKey)}</span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
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
  /** #44 hexagon CENTER (wild) slot — '' when empty. Accepts any gear at stage ≥ HEX_WILD_UNLOCK_STAGE. */
  wildSlot?: string;
  lastFusionEvent: FusionEvent | null;
  almanacCollected: Record<number, string[]>;
  /** Entity ids already seen in the codex — drives the NEW-discovery badge (v18). */
  codexSeenIds?: string[];
  /** First-visit panel hint ids already shown (codex/equip/fuse intro lines, v18). */
  seenPanelHints?: string[];
  quanta: number;
  /** 강화석 balance — Lv5+ enhancement currency (v19). */
  enhanceStones?: number;
  lastEnhanceEvent?: EnhanceEvent | null;
  stats: PanelStats;
  language: Lang;
  onEquip: (entityId: string, slot?: number) => void;
  /** #44: equip into the hexagon CENTER (wild) slot — dispatches EQUIP_ENTITY {wild:true}. */
  onEquipWild?: (entityId: string) => void;
  onUnequip: (slot: number, target: EquipCategory | 'wild') => void;
  onEnhance: (entityId: string, protect?: boolean) => void;
  onFuse: (inputEntityIds: string[]) => void;
  /** 🅠4: batch fuse — inputEntityIds is FUSION_INPUT_COUNT × N copies (N trios). */
  onFuseBatch: (inputEntityIds: string[]) => void;
  onClearFusionEvent: (id: number) => void;
  onClearEnhanceEvent?: (id: number) => void;
  /** Overhaul-4 (v26): favorited entity ids (★) — protected from Fuse-All. */
  favoriteEntityIds?: string[];
  onToggleFavorite?: (entityId: string) => void;
  onClose: () => void;
  onStageSelect?: (stageId: number) => void;
  onUITap?: () => void;
  /** Snapshot all collected ids as seen (clears NEW badges). */
  onMarkCodexSeen?: () => void;
  /** Record a first-visit hint as shown. */
  onMarkPanelHint?: (hintId: string) => void;
}

export function EntityPanel({ page, equipCategory, currentStageId, gateProgress01, inventory, equippedSlots, unlockedSlotCount, riftSlots, unlockedRiftSlotCount, wildSlot = '', lastFusionEvent, almanacCollected, codexSeenIds, seenPanelHints, quanta, enhanceStones = 0, lastEnhanceEvent, stats, language, onEquip, onEquipWild, onUnequip, onEnhance, onFuse, onFuseBatch, onClearFusionEvent, onClearEnhanceEvent, favoriteEntityIds = [], onToggleFavorite, onClose, onStageSelect, onUITap, onMarkCodexSeen, onMarkPanelHint }: Props) {
  // Full-screen tab + equip-category are now interactive state (seeded from the
  // entry point), so one overlay hosts all three pages and the click/rift toggle.
  const [tab] = useState<PanelPage>(page);
  // (?) rules overlay — the equip/fusion systems are intricate, so a single help
  // button per page spells out the rules on demand (user request).
  const [helpOpen, setHelpOpen] = useState(false);
  const [equipCat, setEquipCat] = useState<EquipCategory>(equipCategory);
  // 🅠6 (req ⑫): 전체/클릭/오토 filter — 'all' shows both slot groups (6 slots) at once.
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
  const [inspectedSlot, setInspectedSlot] = useState<number | null>(null);
  // #44: the hexagon CENTER (wild) slot has its own picker (any category) since
  // it isn't tied to the click/rift equipCat+slotIndex addressing of the outer 6.
  const [pickingWild, setPickingWild] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [protectEnhance, setProtectEnhance] = useState(false);
  // 🅠7: enhancement unlocks at S3 (S1 = collect/codex, S2 = equip/fuse).
  const enhanceUnlocked = currentStageId >= ENHANCE_UNLOCK_STAGE_ID;
  const [pickingSlot, setPickingSlot] = useState<number | null>(null);
  const [fuseInputs, setFuseInputs] = useState<string[]>([]);
  // Gacha suspense: brief "charging" beat before the result is committed.
  const [fusing, setFusing] = useState(false);
  // 🅠4: remember the last fuse so the result reveal's 재시도 can repeat it.
  const [lastFuse, setLastFuse] = useState<{ rarity: EntityRarity; batch: boolean; all?: boolean } | null>(null);
  const fuseTimerRef = useRef<number | null>(null);
  const pendingFuseRef = useRef<{ batch: boolean; ids: string[] } | null>(null);
  // Gacha reveal: how many result cards have flipped face-up so far.
  const [revealedCount, setRevealedCount] = useState(0);
  // #42-fix: brief "강화 중…" beat before an enhance commits (parity with fusion;
  // the result success/fail then shows via the inline enhance toast). Holds the
  // id being enhanced so the charge core can show its glyph.
  const [enhancing, setEnhancing] = useState<string | null>(null);
  const enhanceTimerRef = useRef<number | null>(null);
  // Overhaul-4 (v26): Fuse-All protection is now the PERSISTENT ★ favorite
  // (favoriteEntityIds prop) — the old per-session excludedIds Set was replaced.
  // #51: Enhance-All exclude — equipped items the player has shielded from the
  // bulk 강화 (since #47 enhance can DESTROY an item in the risk phase, you want
  // to keep your best gear out of the spray-and-pray).
  const [enhanceExcludedIds, setEnhanceExcludedIds] = useState<Set<string>>(() => new Set());
  const trayRarity = fuseInputs.length > 0 ? findEntityById(fuseInputs[0])?.rarity : undefined;

  const playerStage = STAGES.find((s) => s.id === currentStageId) ?? STAGES[STAGES.length - 1];
  const accent = playerStage?.accent ?? '#8090b0';


  // Gacha "tempt fate" beat: spin for a moment, THEN commit the fusion so the
  // result lands as a reveal (suspense, not an instant swap).
  // "융합 중" suspense before the reveal. #42-fix: shorter + slightly RANDOM
  // (was a fixed 2800ms — too long). ~1.2–2.4s so it feels alive (sometimes
  // snappy, sometimes a beat longer) without dragging. Single AND batch/Fuse-All
  // run through this beat; Skip fast-forwards.
  const fuseChargeMs = () => 1200 + Math.random() * 1200;
  // Commit the pending fuse now (called by the charge timer OR by Skip). Handles
  // single (onFuse) and batch/Fuse-All (onFuseBatch) — both charge first.
  const commitFuse = () => {
    if (fuseTimerRef.current !== null) { window.clearTimeout(fuseTimerRef.current); fuseTimerRef.current = null; }
    const pending = pendingFuseRef.current;
    pendingFuseRef.current = null;
    setFusing(false);
    if (!pending) return;
    if (pending.batch) onFuseBatch(pending.ids); else onFuse(pending.ids);
    setFuseInputs([]);
  };
  const triggerFuse = (inputsArg?: string[]) => {
    const inputs = inputsArg ?? fuseInputs;
    if (fusing || inputs.length !== FUSION_INPUT_COUNT) return;
    const rarity = findEntityById(inputs[0])?.rarity;
    setFusing(true);
    if (rarity) setLastFuse({ rarity, batch: false });
    pendingFuseRef.current = { batch: false, ids: inputs };
    onUITap?.();
    fuseTimerRef.current = window.setTimeout(commitFuse, fuseChargeMs());
  };

  // #42-fix: enhance through a brief "강화 중…" beat (parity with fusion). The
  // outcome (성공/실패/파괴) then surfaces via the inline enhance toast.
  const triggerEnhance = (id: string, protect: boolean) => {
    if (enhancing) return;
    setEnhancing(id);
    onUITap?.();
    enhanceTimerRef.current = window.setTimeout(() => {
      setEnhancing(null);
      onEnhance(id, protect);
    }, 550 + Math.random() * 450); // ~0.55–1.0s, slightly random
  };

  // Ids currently occupying an equip/rift slot. RESERVED from fusion: the player
  // can fuse spare copies but never the one they're actively using (장착된 건 조합
  // 불가). Defined HERE (before the draw fns + canRetry) so it's initialized before
  // any render-time call — a closure TDZ here crashed the panel on fuse (#42 fix).
  const equippedIdSet = useMemo(
    () => new Set([...equippedSlots, ...riftSlots, wildSlot].filter(Boolean) as string[]),
    [equippedSlots, riftSlots, wildSlot],
  );
  // P6: slots hold instanceIds. "Reserved" = how many copies of this entityId are
  // currently equipped (their instanceId sits in a slot); only spare copies fuse.
  const reservedOf = (entityId: string) =>
    inventory.filter((e) => e.entityId === entityId && e.count > 0 && e.instanceId && equippedIdSet.has(e.instanceId)).length;
  const copiesOf = (entityId: string) =>
    inventory.reduce((s, e) => (e.entityId === entityId && e.count > 0 ? s + e.count : s), 0);
  const freeCountOf = (entityId: string) => copiesOf(entityId) - reservedOf(entityId);
  // Resolve a slot's stored instanceId → the specific equipped copy + its entity.
  const entryOfSlot = (slotId: string): EntityInstance | undefined => {
    if (!slotId) return undefined;
    const byInst = inventory.find((e) => e.instanceId === slotId);
    if (byInst) return byInst;
    const ent = findEntityById(slotId); // legacy/unmigrated slot held an entityId
    return ent ? inventory.find((e) => entityMatchesId(ent, e.entityId) && e.count > 0) : undefined;
  };
  const entityOfSlot = (slotId: string): StageEntity | undefined => {
    const entry = entryOfSlot(slotId);
    if (entry) return findEntityById(entry.entityId);
    return slotId ? findEntityById(slotId) : undefined;
  };

  // 🅠4: draw a flat list of FUSION_INPUT_COUNT × N owned copies of one rarity
  // (N = up to maxTrios) for a batch fuse. The reducer caps at what's affordable.
  const drawTriosOfRarity = (rarity: EntityRarity, maxTrios: number): string[] => {
    const ids: string[] = [];
    for (const e of inventory) {
      // P6 flat: one copy per entry; skip the equipped copy (instanceId in a slot).
      if (e.count <= 0) continue;
      if (e.instanceId && equippedIdSet.has(e.instanceId)) continue;
      const ent = findEntityById(e.entityId);
      if (!ent || ent.rarity !== rarity) continue;
      ids.push(e.entityId);
    }
    const trios = Math.min(maxTrios, Math.floor(ids.length / FUSION_INPUT_COUNT));
    return ids.slice(0, trios * FUSION_INPUT_COUNT);
  };

  const triggerBatch = (rarity: EntityRarity) => {
    if (fusing) return;
    const ids = drawTriosOfRarity(rarity, FUSION_BATCH_MAX_TRIOS);
    if (ids.length < FUSION_INPUT_COUNT) return;
    setLastFuse({ rarity, batch: true });
    setFuseInputs([]);
    setFusing(true);
    pendingFuseRef.current = { batch: true, ids }; // charge first (#41), then reveal
    onUITap?.();
    fuseTimerRef.current = window.setTimeout(commitFuse, fuseChargeMs());
  };

  // Fuse-All (no insertion): gather every fusable trio across ALL rarities,
  // skipping locked (excluded) stacks. Each contiguous run of 3 stays one
  // rarity (the reducer validates per-trio), so each bucket is padded to ×3.
  const drawAllTrios = (): string[] => {
    const out: string[] = [];
    let trioBudget = FUSION_BATCH_MAX_TRIOS;
    for (const r of RARITY_ORDER) {
      if (trioBudget <= 0) break;
      const ids: string[] = [];
      for (const e of inventory) {
        // P6 flat: one copy per entry; skip equipped copies + excluded entity types.
        // Overhaul-4: ★ favorited entities are protected from Fuse-All entirely.
        if (e.count <= 0 || favoriteEntityIds.includes(e.entityId)) continue;
        if (e.instanceId && equippedIdSet.has(e.instanceId)) continue;
        const ent = findEntityById(e.entityId);
        if (!ent || ent.rarity !== r) continue;
        ids.push(e.entityId);
      }
      const trios = Math.min(trioBudget, Math.floor(ids.length / FUSION_INPUT_COUNT));
      for (let i = 0; i < trios * FUSION_INPUT_COUNT; i++) out.push(ids[i]);
      trioBudget -= trios;
    }
    return out;
  };
  const allTriosCount = (): number => Math.floor(drawAllTrios().length / FUSION_INPUT_COUNT);
  const triggerFuseAll = () => {
    if (fusing) return;
    const ids = drawAllTrios();
    if (ids.length < FUSION_INPUT_COUNT) return;
    const firstRarity = findEntityById(ids[0])?.rarity ?? 'common';
    setLastFuse({ rarity: firstRarity, batch: true, all: true });
    setFuseInputs([]);
    setFusing(true);
    pendingFuseRef.current = { batch: true, ids }; // charge first (#41), then reveal
    onUITap?.();
    fuseTimerRef.current = window.setTimeout(commitFuse, fuseChargeMs());
  };
  // 🅠4: repeat the last fuse (single or batch) with freshly-drawn copies.
  const retryFuse = () => {
    if (!lastFuse || !lastFusionEvent) return;
    onClearFusionEvent(lastFusionEvent.id);
    if (lastFuse.all) {
      triggerFuseAll();
    } else if (lastFuse.batch) {
      triggerBatch(lastFuse.rarity);
    } else {
      const ids = drawTriosOfRarity(lastFuse.rarity, 1);
      if (ids.length === FUSION_INPUT_COUNT) triggerFuse(ids);
    }
  };
  const canRetry =
    lastFuse !== null && (lastFuse.all ? allTriosCount() > 0 : drawTriosOfRarity(lastFuse.rarity, 1).length === FUSION_INPUT_COUNT);
  useEffect(() => () => {
    if (fuseTimerRef.current !== null) window.clearTimeout(fuseTimerRef.current);
    if (enhanceTimerRef.current !== null) window.clearTimeout(enhanceTimerRef.current);
  }, []);
  // #42-fix: leaving the fuse page clears a lingering reveal so an old result
  // card doesn't "pop back out" when the player returns to the forge.
  useEffect(() => {
    if (page !== 'fuse' && lastFusionEvent) onClearFusionEvent(lastFusionEvent.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);
  // Sequential gacha flip — reveal result cards one-by-one (skippable). #49: the
  // batch grid shows only rarity-UP cards (fails roll up into the 강화석 total), so
  // the flip sequence counts ups, not every trio.
  useEffect(() => {
    if (!lastFusionEvent) { setRevealedCount(0); return undefined; }
    const upCount = lastFusionEvent.cards.filter((c) => c.rarityUp).length;
    const target = lastFusionEvent.cards.length <= 1 ? lastFusionEvent.cards.length : upCount;
    if (target <= 1) { setRevealedCount(target); return undefined; }
    setRevealedCount(0);
    let n = 0;
    const id = window.setInterval(() => {
      n += 1;
      setRevealedCount(n);
      if (n >= target) window.clearInterval(id);
    }, 180);
    return () => window.clearInterval(id);
  }, [lastFusionEvent]);

  // Auto-dismiss the 강화 result card (it's a full card now — give it time to read;
  // break lingers longest). Click also dismisses.
  useEffect(() => {
    if (!lastEnhanceEvent || !onClearEnhanceEvent) return undefined;
    const ms = lastEnhanceEvent.outcome === 'break' ? 3600 : 3000;
    const id = window.setTimeout(() => onClearEnhanceEvent(lastEnhanceEvent.id), ms);
    return () => window.clearTimeout(id);
  }, [lastEnhanceEvent, onClearEnhanceEvent]);

  // The gear array this equip page edits.
  const gearSlots = equipCat === 'rift' ? riftSlots : equippedSlots;
  const gearSlotCount = equipCat === 'rift' ? unlockedRiftSlotCount : unlockedSlotCount;

  // P6: the inventory is FLAT (one entry per copy). For DISPLAY we group by
  // canonical entityId — one tile per item, the synthesized `entry.count` = the
  // number of copies, the representative = the highest-level copy (best quality).
  // Per-copy levels stay visible on equipped slots (resolved by instanceId).
  const ownedEntities = useMemo(() => {
    const byId = new Map<string, { entry: EntityInstance; entity: StageEntity; copies: number; bestQ: number | undefined }>();
    for (const inst of inventory) {
      if (inst.count <= 0) continue;
      const entity = findEntityById(inst.entityId);
      if (!entity) continue;
      const g = byId.get(entity.id);
      const q = inst.quality;
      if (!g) {
        byId.set(entity.id, { entry: inst, entity, copies: inst.count, bestQ: q });
      } else {
        g.copies += inst.count;
        if ((inst.level ?? 1) > (g.entry.level ?? 1)) g.entry = inst; // show the best copy
        if (q !== undefined && (g.bestQ === undefined || q > g.bestQ)) g.bestQ = q;
      }
    }
    return [...byId.values()]
      .map(({ entry, entity, copies, bestQ }) => ({
        entry: { ...entry, count: copies, quality: bestQ } as EntityInstance,
        entity,
      }))
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

  // Equip grid: while picking a slot, show only that slot's category; otherwise
  // honour the 전체/클릭/오토 filter (🅠6 — 전체 shows both categories' gear).
  const pickerEntities = useMemo(() => {
    const cat: EquipCategory | null = pickingSlot !== null ? equipCat : null;
    return cat === null ? rarityFiltered : rarityFiltered.filter(({ entity }) => getEquipCategory(entity) === cat);
  }, [rarityFiltered, equipCat, pickingSlot]);

  // Active set bonus spans both gear categories (largest glyph family counts).
  const equippedEntities = useMemo(
    () => gearSlots.map((id) => (id ? entityOfSlot(id) : undefined)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gearSlots, inventory],
  );
  const allEquippedEntities = useMemo(
    // #44: include the wild slot so the displayed set tier matches the applied
    // bonus (the reducer counts wildSlot in getEquippedInstances for set bonuses).
    () => [...equippedSlots, ...riftSlots, wildSlot].map((id) => (id ? entityOfSlot(id) : undefined)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [equippedSlots, riftSlots, wildSlot, inventory],
  );
  const setInfo = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entity of allEquippedEntities) {
      if (!entity) continue;
      const key = getEquipSetKey(entity);
      if (key === null) continue;
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
    const usedCopies = fuseInputs.filter((id) => id === entity.id).length;
    // P6: only spare (un-equipped) copies are fuseable; the worn one is reserved.
    if (freeCountOf(entity.id) <= usedCopies) return;
    if (trayRarity && entity.rarity !== trayRarity) return;
    setFuseInputs((current) => [...current, entity.id]);
    onUITap?.();
  };

  // 🅠4: the fusion reveal no longer auto-dismisses — it stays until the player
  // taps 재시도 (retry) or 닫기 (close), so the result + new item description can
  // be read at leisure and the next fuse is an explicit choice (no auto-refill).

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
        {/* 🅠6: de-tabbed — each rail button opens its own screen (no tab switcher). */}
        <header className="entity-fs__topbar">
          <h2 className="entity-fs__screen-title">
            {tab === 'lab'
              ? t(language, 'collectionTitle')
              : tab === 'equip'
                ? t(language, 'entityEquip')
                : t(language, 'fuseTitle')}
          </h2>
          {tab !== 'lab' ? (
            <div className="entity-fs__wallet">
              <span>{t(language, 'hudQuanta')}</span>
              <strong>⚛{formatEntityCost(quanta)}</strong>
            </div>
          ) : null}
          {tab !== 'lab' ? (
            <div className="entity-fs__wallet entity-fs__wallet--stones">
              <span>{t(language, 'hudStones')}</span>
              <strong>◆{formatEntityCost(enhanceStones)}</strong>
            </div>
          ) : null}
          {tab !== 'lab' ? (
            <button
              type="button"
              className="entity-fs__help"
              aria-label={t(language, 'panelHelp')}
              title={t(language, 'panelHelp')}
              onClick={() => { setHelpOpen(true); onUITap?.(); }}
            >
              ?
            </button>
          ) : null}
          <button className="entity-fs__close" aria-label={t(language, 'panelClose')} onClick={onClose}>✕</button>
        </header>

        <div className="entity-fs__body">


        {tab === 'lab' ? (() => {
          // Codex: a glyph wall crowned by ONE completion meter. Sets→subsets
          // span all eras; chips are an opt-in filter (default = all).
          const collectedSet = collectedIdSet(almanacCollected);
          const isCollected = (e: StageEntity) => collectedSet.has(e.id) || countOf(e) > 0;
          // #45: entries from eras the player hasn't reached are LOCKED (blur + 🔒)
          // — distinct from merely-uncollected. The full-roster totals below are
          // left untouched, so "collected/total" still counts these in the denominator.
          const isFutureStage = (e: StageEntity) => e.stageId > currentStageId;
          // 🅠6 codex cleanup: the completion meter, prestige-mass factor,
          // "closest set" nudge and per-rarity drop-rate legend are gone — the
          // set/subset dividers carry the only signal (the set-completion benefit).
          const totalAll = STAGE_ENTITIES.length;
          const collectedAll = STAGE_ENTITIES.filter(isCollected).length;

          const setsToRender = selectedSetId === 'all'
            ? CODEX_SETS
            : CODEX_SETS.filter((cs) => cs.id === selectedSetId);

          return (
            <>
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
              <p className="codex-bonus-help">{t(language, 'codexBonusHelp')}</p>

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
                          <span className="codex-reward__text">{codexRewardLabel(cs.reward, language)}</span>
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
                              <span className="codex-reward__text">{codexRewardLabel(sub.reward, language)}</span>
                            </span>
                            <span className="codex-divider__rule" />
                          </div>
                          <div className="almanac-grid">
                            {visible.map((entity, idx) => {
                              const collected = isCollected(entity);
                              const future = !collected && isFutureStage(entity);
                              const rarityColor = RARITY_COLORS[entity.rarity];
                              // Signature specialty (P4) — the item's one varied identity stat.
                              const signature = getSecondaryStats(entity)[0];
                              return (
                                <button
                                  key={entity.id}
                                  type="button"
                                  className={`almanac-card almanac-card--${entity.rarity} ${collected ? '' : future ? 'almanac-card--locked almanac-card--future' : 'almanac-card--locked'}`}
                                  style={{ '--rarity-color': rarityColor, '--card-anim-delay': `${Math.min(idx, 24) * 25}ms` } as CSSProperties}
                                  onClick={() => { if (collected) { setInspectedEntityId(entity.id); onUITap?.(); } }}
                                >
                                  {collected && codexNew.has(entity.id) ? (
                                    <span className="almanac-card__new">NEW</span>
                                  ) : null}
                                  {future ? <span className="almanac-card__lock" aria-hidden="true">🔒</span> : null}
                                  {collected ? <TraitBadge entity={entity} className="trait-badge--card" /> : null}
                                  <div className="almanac-card__glyph">
                                    {collected
                                      ? <EntityGlyph entity={entity} color={rarityColor} />
                                      : <span className="almanac-card__mystery">?</span>}
                                  </div>
                                  {collected ? (
                                    <div className="almanac-card__name">{entityName(entity, language)}</div>
                                  ) : null}
                                  {collected && signature ? (
                                    <span className="almanac-card__specialty" style={{ color: rarityColor }}>
                                      {t(language, SUBSTAT_LABEL_KEY[signature.type])}
                                    </span>
                                  ) : null}
                                  {entity.stageId <= 16 ? (
                                    <span className="almanac-card__era">{`S${entity.stageId}`}</span>
                                  ) : null}
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
          const heroFor = (cat: EquipCategory) => cat === 'click'
            ? { label: t(language, 'effectClickPower'), value: `${formatAutoRateValue(stats.clickPower)} ${t(language, 'hudPerClick')}` }
            : { label: t(language, 'hudAuto'), value: `${formatAutoRateValue(stats.autoRate)}/s` };
          // 🅠6 (req ⑫): one category's hero value + its 3 slots. Tapping a slot makes
          // that category active (drives the picker + slot-detail / inline enhance).
          const renderSlotGroup = (cat: EquipCategory) => {
            const slots = cat === 'rift' ? riftSlots : equippedSlots;
            const count = cat === 'rift' ? unlockedRiftSlotCount : unlockedSlotCount;
            const rules = cat === 'rift' ? RIFT_SLOT_UNLOCKS : EQUIP_SLOT_UNLOCKS;
            const hero = heroFor(cat);
            return (
              <div className="equip-group" key={cat}>
                <div className="equip-group__head">
                  <span className="equip-group__label">{hero.label}</span>
                  <strong className="equip-group__value">{hero.value}</strong>
                </div>
                <div className="equip-page__slots">
                  {Array.from({ length: 3 }, (_, i) => {
                    if (i >= count) {
                      const rule = rules.find((r) => r.slot === i + 1);
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
                    const slotId = slots[i];
                    const slotEntity = entityOfSlot(slotId);
                    const entry = entryOfSlot(slotId);
                    const linked = Boolean(slotEntity && dominantKey && getEquipSetKey(slotEntity) === dominantKey);
                    const isPicking = equipCat === cat && pickingSlot === i;
                    return (
                      <button
                        key={i}
                        type="button"
                        className={`equip-slot-card ${slotEntity ? 'equip-slot-card--filled' : ''} ${isPicking ? 'equip-slot-card--picking' : ''} ${linked ? 'equip-slot-card--linked' : ''} ${isTailQuality(entry?.quality) ? 'equip-slot-card--tail' : ''}`}
                        style={slotEntity ? ({ '--rarity-color': RARITY_COLORS[slotEntity.rarity] } as CSSProperties) : undefined}
                        onClick={() => {
                          setEquipCat(cat);
                          if (slotEntity) { setInspectedSlot(i); }
                          else { setPickingSlot(isPicking ? null : i); }
                          onUITap?.();
                        }}
                      >
                        {slotEntity ? (
                          <>
                            {linked ? <span className="equip-slot-card__set">⬡</span> : null}
                            {/* #51: at-a-glance "전체 강화에서 빠짐" marker. */}
                            {entry?.instanceId && enhanceExcludedIds.has(entry.instanceId) ? <span className="equip-slot-card__skip">{t(language, 'enhanceExcludeBadge')}</span> : null}
                            {/* Inline unequip — a span (not button) since this card is itself a button. */}
                            <span
                              className="equip-slot-card__remove"
                              role="button"
                              tabIndex={0}
                              aria-label={t(language, 'entityUnequip')}
                              title={t(language, 'entityUnequip')}
                              onClick={(e) => { e.stopPropagation(); onUnequip(i, cat); onUITap?.(); }}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); onUnequip(i, cat); onUITap?.(); } }}
                            >
                              ✕
                            </span>
                            <TraitBadge entity={slotEntity} className="trait-badge--card" />
                            <div className="equip-slot-card__glyph">
                              <EntityGlyph entity={slotEntity} color={RARITY_COLORS[slotEntity.rarity]} />
                            </div>
                            <div className="equip-slot-card__name">{entityName(slotEntity, language)}</div>
                            {/* #48: drop the old "+% 합계" dense string (the "합계" term wasn't in
                                the legend) — show the structured value + the SAME effect term the
                                legend explains, so the card matches the rest of the panel. */}
                            {(() => {
                              const p = effectValueLabel(slotEntity, language, power, entry?.count ?? 1, entry?.level ?? 1, entry?.carried ?? false, true, entry?.quality);
                              return (
                                <div className="equip-slot-card__effect" style={{ color: RARITY_COLORS[slotEntity.rarity] }}>
                                  <span className="equip-slot-card__effect-value">{p.value}</span>
                                  <span className="equip-slot-card__effect-label">{p.label}</span>
                                </div>
                              );
                            })()}
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
              </div>
            );
          };
          const shownCats: EquipCategory[] = ['click', 'rift'];
          // The flat per-category groups are kept available but no longer rendered:
          // the hexagon below is the live loadout view. Retain the reference so the
          // helper doesn't read as dead code while the hex is the primary layout.
          void renderSlotGroup;

          // #44 HEXAGON — the 7-slot board (0-2 click, 3-5 rift, 6 wild) read by
          // computeHexBingo. The wild center unlocks at HEX_WILD_UNLOCK_STAGE.
          const wildUnlocked = currentStageId >= HEX_WILD_UNLOCK_STAGE;
          const hexIds: (string | null)[] = [
            equippedSlots[0] || null, equippedSlots[1] || null, equippedSlots[2] || null,
            riftSlots[0] || null, riftSlots[1] || null, riftSlots[2] || null,
            wildSlot || null,
          ];
          const bingo = computeHexBingo(hexIds);
          // Hex slot indices that sit on a completed line → drive the glow.
          const litSlots = new Set<number>();
          for (const li of bingo.completedLines) for (const s of HEX_BINGO_LINES[li].slots) litSlots.add(s);

          // Map a hex index (0-5 outer) to its category + per-category slot index.
          const hexAddr = (idx: number): { cat: EquipCategory; slot: number } =>
            idx < 3 ? { cat: 'click', slot: idx } : { cat: 'rift', slot: idx - 3 };

          // Shared card BODY (filled vs empty) — reused by every hex slot incl. wild.
          const renderCardBody = (slotEntity: StageEntity | undefined, entry: EntityInstance | undefined, onRemove: () => void) => {
            if (!slotEntity) {
              return (
                <>
                  <span className="equip-slot-card__plus">＋</span>
                  <span className="equip-slot-card__hint">{t(language, 'equipSlotTapFill')}</span>
                </>
              );
            }
            const linked = Boolean(dominantKey && getEquipSetKey(slotEntity) === dominantKey);
            const p = effectValueLabel(slotEntity, language, power, entry?.count ?? 1, entry?.level ?? 1, entry?.carried ?? false, true, entry?.quality);
            return (
              <>
                {linked ? <span className="equip-slot-card__set">⬡</span> : null}
                {entry?.instanceId && enhanceExcludedIds.has(entry.instanceId) ? <span className="equip-slot-card__skip">{t(language, 'enhanceExcludeBadge')}</span> : null}
                <span
                  className="equip-slot-card__remove"
                  role="button"
                  tabIndex={0}
                  aria-label={t(language, 'entityUnequip')}
                  title={t(language, 'entityUnequip')}
                  onClick={(e) => { e.stopPropagation(); onRemove(); onUITap?.(); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); onRemove(); onUITap?.(); } }}
                >
                  ✕
                </span>
                <TraitBadge entity={slotEntity} className="trait-badge--card" />
                <div className="equip-slot-card__glyph">
                  <EntityGlyph entity={slotEntity} color={RARITY_COLORS[slotEntity.rarity]} />
                </div>
                <div className="equip-slot-card__name">{entityName(slotEntity, language)}</div>
                <div className="equip-slot-card__effect" style={{ color: RARITY_COLORS[slotEntity.rarity] }}>
                  <span className="equip-slot-card__effect-value">{p.value}</span>
                  <span className="equip-slot-card__effect-label">{p.label}</span>
                </div>
              </>
            );
          };

          // One outer hex slot (click/rift) — mirrors renderSlotGroup's per-slot logic.
          const renderHexOuter = (idx: number) => {
            const { cat, slot } = hexAddr(idx);
            const slots = cat === 'rift' ? riftSlots : equippedSlots;
            const count = cat === 'rift' ? unlockedRiftSlotCount : unlockedSlotCount;
            const rules = cat === 'rift' ? RIFT_SLOT_UNLOCKS : EQUIP_SLOT_UNLOCKS;
            const lit = litSlots.has(idx);
            const [px, py] = HEX_NODE_XY[idx];
            const posStyle = { left: `${px}%`, top: `${py}%` } as CSSProperties;
            if (slot >= count) {
              const rule = rules.find((r) => r.slot === slot + 1);
              const hint = rule?.minStageId !== undefined
                ? t(language, 'equipSlotLockedStage').replace('{n}', String(rule.minStageId))
                : t(language, 'equipSlotLockedAlmanac').replace('{n}', String(rule?.minAlmanacCount ?? 0));
              return (
                <div className={`hex-slot hex-slot--${cat} equip-slot-card equip-slot-card--locked`} style={posStyle}>
                  <span className="equip-slot-card__lock">🔒</span>
                  <span className="equip-slot-card__hint">{hint}</span>
                </div>
              );
            }
            const slotId = slots[slot];
            const slotEntity = entityOfSlot(slotId);
            const entry = entryOfSlot(slotId);
            const isPicking = equipCat === cat && pickingSlot === slot && !pickingWild;
            return (
              <button
                type="button"
                className={`hex-slot hex-slot--${cat} equip-slot-card ${slotEntity ? 'equip-slot-card--filled' : ''} ${isPicking ? 'equip-slot-card--picking' : ''} ${lit ? 'hex-slot--line' : ''} ${isTailQuality(entry?.quality) ? 'equip-slot-card--tail' : ''}`}
                style={slotEntity ? ({ '--rarity-color': RARITY_COLORS[slotEntity.rarity], ...posStyle } as CSSProperties) : posStyle}
                onClick={() => {
                  setEquipCat(cat);
                  setPickingWild(false);
                  if (slotEntity) { setInspectedSlot(slot); }
                  else { setPickingSlot(isPicking ? null : slot); }
                  onUITap?.();
                }}
              >
                {renderCardBody(slotEntity, entry, () => onUnequip(slot, cat))}
              </button>
            );
          };

          // The hexagon CENTER (wild) slot — locked until HEX_WILD_UNLOCK_STAGE,
          // then accepts ANY gear; tapping opens the wild picker (all categories).
          const renderHexCenter = () => {
            const lit = litSlots.has(6);
            const [cpx, cpy] = HEX_NODE_XY[6];
            const centerPos = { left: `${cpx}%`, top: `${cpy}%` } as CSSProperties;
            if (!wildUnlocked) {
              return (
                <div className="hex-slot hex-slot--center equip-slot-card equip-slot-card--locked" style={centerPos}>
                  <span className="equip-slot-card__lock">🔒</span>
                  <span className="equip-slot-card__hint">{t(language, 'hexWildLockHint').replace('{n}', String(HEX_WILD_UNLOCK_STAGE))}</span>
                </div>
              );
            }
            const slotEntity = entityOfSlot(wildSlot);
            const entry = entryOfSlot(wildSlot);
            return (
              <button
                type="button"
                className={`hex-slot hex-slot--center equip-slot-card ${slotEntity ? 'equip-slot-card--filled' : ''} ${pickingWild ? 'equip-slot-card--picking' : ''} ${lit ? 'hex-slot--line' : ''} ${isTailQuality(entry?.quality) ? 'equip-slot-card--tail' : ''}`}
                style={slotEntity ? ({ '--rarity-color': RARITY_COLORS[slotEntity.rarity], ...centerPos } as CSSProperties) : centerPos}
                onClick={() => {
                  setPickingSlot(null);
                  setPickingWild((v) => !v);
                  onUITap?.();
                }}
              >
                <span className="hex-slot__wild-tag">{t(language, 'hexWildSlot')}</span>
                {slotEntity
                  ? renderCardBody(slotEntity, entry, () => onUnequip(0, 'wild'))
                  : (
                    <>
                      <span className="equip-slot-card__plus">＋</span>
                      <span className="equip-slot-card__hint">{t(language, 'hexWildTapFill')}</span>
                    </>
                  )}
              </button>
            );
          };

          const bonusReadout = bingo.completedLines.length > 0
            ? t(language, 'hexBonusReadout')
                .replace('{click}', bingo.clickMult.toFixed(1))
                .replace('{auto}', bingo.autoMult.toFixed(1))
                .replace('{lines}', String(bingo.completedLines.length))
            : t(language, 'hexBonusNone');

          // H redesign: the LEFT stat-stack — only the stats you actually HAVE
          // (click/auto always; crit chance+mult only once you have crit gear).
          // Replaces the removed icon-guide legend + click/auto readout cards.
          const statStack: { key: string; icon: string; color: string; label: string; value: string }[] = [
            { key: 'click', icon: EFFECT_TRAIT.click.icon, color: EFFECT_TRAIT.click.accent, label: t(language, 'effectClickPower'), value: `${formatAutoRateValue(stats.clickPower)}${t(language, 'hudPerClick')}` },
            { key: 'auto', icon: EFFECT_TRAIT.auto.icon, color: EFFECT_TRAIT.auto.accent, label: t(language, 'hudAuto'), value: `${formatAutoRateValue(stats.autoRate)}${t(language, 'effectAutoRatePerSec')}` },
          ];
          if (stats.critChance > 0) {
            statStack.push({ key: 'critC', icon: EFFECT_TRAIT.crit.icon, color: EFFECT_TRAIT.crit.accent, label: t(language, 'effectCritChance'), value: `${Math.round(stats.critChance * 100)}%` });
            statStack.push({ key: 'critM', icon: SUBSTAT_TRAIT.critMult, color: EFFECT_TRAIT.crit.accent, label: t(language, 'effectCritMult'), value: `×${stats.critMult.toFixed(1)}` });
          }

          return (
            <div className="equip-page cc-scroll">
              {hintShow['equip'] ? <div className="equip-purpose">{t(language, 'equipPurpose')}</div> : null}

              {/* H redesign: left owned-stats stack + hexagon on the right — replaces
                  the icon-guide legend + the click/auto readout cards. */}
              <div className="equip-loadout">
                <aside className="equip-statstack" aria-label={t(language, 'effectClickPower')}>
                  {statStack.map((s) => (
                    <div className="equip-statstack__row" key={s.key}>
                      <span className="equip-statstack__icon" style={{ color: s.color }} aria-hidden="true">{s.icon}</span>
                      <span className="equip-statstack__label">{s.label}</span>
                      <strong className="equip-statstack__value">{s.value}</strong>
                    </div>
                  ))}
                </aside>

              {/* #44 HEXAGON loadout — a TRUE connected hexagon: an SVG link layer
                  (6 ring edges + 6 center spokes) sits behind 7 absolutely-placed
                  slots on regular-hexagon vertices (0-2 click / 3-5 rift / center
                  wild). Completed bingo lines light their segments. */}
              <div className="hex-board">
                <svg className="hex-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  {/* A8: arrowhead marker — completed bonus lines become directional
                      arrows; the mid-marker lands on the SHARED/hub slot so overlapping
                      lines visibly connect there. */}
                  <defs>
                    <marker id="hex-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3.4" markerHeight="3.4" orient="auto-start-reverse">
                      <path d="M1,1 L9,5 L1,9 Z" className="hex-links__arrow" />
                    </marker>
                  </defs>
                  {HEX_LINK_EDGES.map(([a, b], i) => (
                    <line
                      key={`e${i}`}
                      className="hex-links__edge"
                      x1={HEX_NODE_XY[a][0]} y1={HEX_NODE_XY[a][1]}
                      x2={HEX_NODE_XY[b][0]} y2={HEX_NODE_XY[b][1]}
                    />
                  ))}
                  {bingo.completedLines.map((li) => {
                    const pts = HEX_BINGO_LINES[li].slots
                      .map((s) => `${HEX_NODE_XY[s][0]},${HEX_NODE_XY[s][1]}`)
                      .join(' ');
                    return (
                      <polyline
                        key={`l${li}`}
                        className="hex-links__lit"
                        points={pts}
                        markerMid="url(#hex-arrow)"
                        markerEnd="url(#hex-arrow)"
                      />
                    );
                  })}
                </svg>
                {[0, 1, 2, 3, 4, 5].map((idx) => <Fragment key={idx}>{renderHexOuter(idx)}</Fragment>)}
                {renderHexCenter()}
              </div>
              </div>
              <div className={`hex-bonus ${bingo.completedLines.length > 0 ? 'hex-bonus--active' : ''}`}>{bonusReadout}</div>

              {/* Active set magnitude (compact) + batch enhance */}
              <div className="equip-actions">
                {setInfo ? (() => {
                  // setInfo.key is a codex subset id "setId/subId" — name the category.
                  const [sid, subid] = setInfo.key.split('/');
                  const sub = CODEX_SETS.find((s) => s.id === sid)?.subsets.find((x) => x.id === subid);
                  const name = sub ? `${codexSubsetLabel(sub, language)} ` : '';
                  return (
                    <span className="equip-set-chip">
                      {`⬡ ${name}${t(language, 'setBonusLabel')} ×${setInfo.bonus.clickAutoMult}${setInfo.bonus.critChanceAdd > 0 ? ` · ${t(language, 'effectCritChance')} +${Math.round(setInfo.bonus.critChanceAdd * 100)}%` : ''}`}
                    </span>
                  );
                })() : <span />}
                <button
                  type="button"
                  className="equip-enhance-all"
                  disabled={!enhanceUnlocked}
                  title={enhanceUnlocked ? undefined : t(language, 'lockUntilStage').replace('{n}', String(ENHANCE_UNLOCK_STAGE_ID))}
                  onClick={() => { [...equippedSlots, ...riftSlots, wildSlot].forEach((id) => { if (id && !enhanceExcludedIds.has(id)) onEnhance(id); }); }}
                >
                  {/* C-P2: show the unlock-stage reason in the VISIBLE label (not just
                      title=, invisible on touch) — mirrors the codex-card enhance button. */}
                  {enhanceUnlocked
                    ? t(language, 'enhanceAll')
                    : `🔒 ${t(language, 'enhanceAll')} · ${t(language, 'lockUntilStage').replace('{n}', String(ENHANCE_UNLOCK_STAGE_ID))}`}
                </button>
              </div>

              {/* Owned gear of this category — quiet at rest, deltas while picking */}
              <div className="entity-inv">
                <div className="entity-inv__head">
                  <span className="entity-inv__title">
                    {pickingSlot !== null || pickingWild
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
                      // P6: per-copy placement — equippable while a SPARE (un-equipped)
                      // copy exists, even if another copy of the same item is already
                      // worn. Dim only when every copy is already equipped.
                      const noFree = freeCountOf(entity.id) <= 0;
                      let delta: number | null = null;
                      if (pickingSlot !== null && pickBase > 0 && !noFree) {
                        const d = Math.round((gearStrength(entity, entry) / pickBase - 1) * 100);
                        if (Number.isFinite(d)) delta = d;
                      }
                      return (
                        <button
                          key={entity.id}
                          type="button"
                          className={`owned-card ${noFree ? 'owned-card--dim' : ''} ${isTailQuality(entry?.quality) ? 'owned-card--tail' : ''}`}
                          style={{ '--rarity-color': RARITY_COLORS[entity.rarity] } as CSSProperties}
                          disabled={noFree}
                          onClick={() => {
                            if (pickingWild) {
                              onEquipWild?.(entity.id);
                              setPickingWild(false);
                            } else if (pickingSlot !== null) {
                              onEquip(entity.id, pickingSlot);
                            } else {
                              // At rest: equip into this item's own category — first empty slot,
                              // else replace the occupant. Instant swap, no unequip-first.
                              onEquip(entity.id);
                            }
                            setPickingSlot(null);
                          }}
                        >
                          {delta !== null ? (
                            <span className={`owned-card__delta ${delta > 0 ? 'owned-card__delta--up' : delta < 0 ? 'owned-card__delta--down' : ''}`}>
                              {delta > 0 ? `+${delta}%` : `${delta}%`}
                            </span>
                          ) : null}
                          <TraitBadge entity={entity} className="trait-badge--card" />
                          <span className="owned-card__formula" style={{ color: RARITY_COLORS[entity.rarity] }}>{entity.formula}</span>
                          <span className="owned-card__name">{entityName(entity, language)}</span>
                          {/* 🅠6 (req ⑫) card format: Lv.N · count/threshold · ⬆ (when below cap). */}
                          <span className="owned-card__count">
                            {`Lv.${entry.level} · ${entry.count}/${entity.maxCount}`}
                            {entry.level < getEnhanceLevelCap(entity) ? <span className="owned-card__up"> ⬆</span> : null}
                          </span>
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
          // Odds are per-input-tier (P2), pure chance — no pity. Default to common when empty.
          const oddsTier = trayRarity ?? 'common';
          const up1Pct = Math.round(FUSION_UP1_CHANCE_BY_TIER[oddsTier] * 100);
          const up2Pct = Math.round(FUSION_UP2_CHANCE_BY_TIER[oddsTier] * 100);
          const ready = fuseInputs.length === FUSION_INPUT_COUNT;
          // Overhaul-2 🅠1: fusion cost is a fixed per-era price (anchor-based),
          // not a fraction of the bank — and must be afforded in full.
          const cost = getFusionQuantaCost(oddsTier, currentStageId);
          const affordable = quanta >= cost;
          // P2b bonus indicators: 3-same-entity / 3-same-codex-category.
          const sameEntityTray = ready && new Set(fuseInputs).size === 1;
          const sameSubsetTray = ready && (() => {
            const subs = fuseInputs.map((id) => { const e = findEntityById(id); return e ? getCodexSubsetIdForEntity(e) : null; });
            return subs[0] != null && subs.every((s) => s === subs[0]);
          })();

          // Fusable-trio pressure + auto-fill: copies available per rarity.
          const copiesByRarity = new Map<EntityRarity, number>();
          for (const { entry, entity } of ownedEntities) {
            copiesByRarity.set(entity.rarity, (copiesByRarity.get(entity.rarity) ?? 0) + entry.count);
          }
          const triosAt = (r: EntityRarity) => Math.floor((copiesByRarity.get(r) ?? 0) / FUSION_INPUT_COUNT);
          const trios = trayRarity ? triosAt(trayRarity) : RARITY_ORDER.reduce((s, r) => s + triosAt(r), 0);
          // 🅠4: trios available of the tray rarity — gates the batch (×N) button.
          const batchTrios = trayRarity ? Math.min(FUSION_BATCH_MAX_TRIOS, triosAt(trayRarity)) : 0;

          return (
            <div className="fuse-page cc-scroll">
              {hintShow['fuse'] ? <div className="fuse-loop-hint">{t(language, 'fuseLoopHint')}</div> : null}
              <TraitLegend language={language} />
              {/* Fuse-All — compact box (#41): label + a small trio-count chip
                  (no more "(N조)" in the label). Fuses every trio across all
                  rarities except ✕-excluded stacks. */}
              {(() => {
                const allTrios = allTriosCount();
                return (
                  <button
                    type="button"
                    className="gacha-fuse-all-btn"
                    disabled={fusing || allTrios < 1}
                    onClick={triggerFuseAll}
                  >
                    <span className="gacha-fuse-all-btn__label">
                      {allTrios > 0 ? t(language, 'fuseAll') : t(language, 'fuseAllNone')}
                    </span>
                    {allTrios > 0 ? (
                      <span className="gacha-fuse-all-btn__count">{t(language, 'fuseTrios').replace('{n}', String(allTrios))}</span>
                    ) : null}
                  </button>
                );
              })()}
              {/* The altar — the whole bet (stake / cost / odds) on one lever */}
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
                {sameEntityTray || sameSubsetTray ? (
                  <div className="gacha-bonus">
                    {sameEntityTray ? <span className="gacha-bonus__chip">★ {t(language, 'fuseBonusSameEntity')}</span> : null}
                    {sameSubsetTray ? <span className="gacha-bonus__chip">◈ {t(language, 'fuseBonusSameCategory')}</span> : null}
                  </div>
                ) : null}
                <button
                  type="button"
                  className={`gacha-fuse-btn ${fusing ? 'gacha-fuse-btn--charging' : ''} ${ready && affordable && !fusing ? 'gacha-fuse-btn--armed' : ''}`}
                  disabled={!ready || !affordable || fusing}
                  onClick={() => triggerFuse()}
                >
                  <span className="gacha-fuse-btn__label">
                    {fusing
                      ? t(language, 'fuseChanting')
                      : !ready
                        ? t(language, 'fuseLeverNeed')
                        : t(language, 'fuseLeverReady').replace('{cost}', formatEntityCost(cost))}
                  </span>
                </button>
                {/* 🅠4: batch-fuse all available trios of the tray rarity (up to N). */}
                {trayRarity && batchTrios >= 2 ? (
                  <button
                    type="button"
                    className="gacha-batch-btn"
                    disabled={fusing || !affordable}
                    onClick={() => triggerBatch(trayRarity)}
                  >
                    {t(language, 'fuseBatch').replace('{n}', String(batchTrios))}
                  </button>
                ) : null}
                <div className="gacha-odds">
                  {capped ? (
                    <span className="gacha-odds__cap">
                      {t(language, 'fuseMaxRarity').replace('{r}', t(language, RARITY_LABEL_KEY[RARITY_ORDER[maxIdx]]))}
                    </span>
                  ) : (
                    <>
                      <span className="gacha-odds__up1">{`⬆ ${t(language, 'fuseOddsUp1')} ${up1Pct}%`}</span>
                      {up2Possible && up2Pct > 0 ? (
                        <span className="gacha-odds__up2">{`⬆⬆ ${t(language, 'fuseOddsUp2')} ${up2Pct}%`}</span>
                      ) : null}
                    </>
                  )}
                </div>
              </div>

              {/* Fuel tray — quiet, adjacent; first tap locks rarity */}
              <div className="entity-inv entity-inv--fuse">
                <div className="entity-inv__head">
                  <span className="entity-inv__title">{t(language, 'fuseFuel')}</span>
                  {trios > 0 ? <span className="entity-inv__sub">{t(language, 'fuseTrios').replace('{n}', String(trios))}</span> : null}
                </div>
                {rarityFilterBar}
                {rarityFiltered.length === 0 ? (
                  <div className="entity-panel__empty">{t(language, 'equipPickEmpty')}</div>
                ) : (
                  <div className="owned-grid">
                    {rarityFiltered.map(({ entry, entity }) => {
                      const usedCopies = fuseInputs.filter((id) => id === entity.id).length;
                      const reserved = reservedOf(entity.id); // equipped copy held back
                      const usable = entry.count - reserved;
                      const blocked =
                        fuseInputs.length >= FUSION_INPUT_COUNT ||
                        usable <= usedCopies ||
                        (trayRarity !== undefined && entity.rarity !== trayRarity);
                      const fav = favoriteEntityIds.includes(entity.id);
                      return (
                        <div
                          key={entity.id}
                          className={`owned-card-wrap ${fav ? 'owned-card-wrap--fav' : ''}`}
                          style={{ '--rarity-color': RARITY_COLORS[entity.rarity] } as CSSProperties}
                        >
                          <button
                            type="button"
                            className={`owned-card ${blocked ? 'owned-card--dim' : ''} ${isTailQuality(entry?.quality) ? 'owned-card--tail' : ''}`}
                            disabled={blocked}
                            onClick={() => addFuseInput(entity)}
                          >
                            <TraitBadge entity={entity} className="trait-badge--card" />
                            <span className="owned-card__formula" style={{ color: RARITY_COLORS[entity.rarity] }}>{entity.formula}</span>
                            <span className="owned-card__name">{entityName(entity, language)}</span>
                            <span className="owned-card__count">{`×${Math.max(0, usable - usedCopies)}`}</span>
                            {reserved > 0 ? <span className="owned-card__reserved">{t(language, 'fuseEquippedReserved')}</span> : null}
                          </button>
                          {/* Overhaul-4 (v26): ★ favorite toggle — protects this item's
                              copies from Fuse-All (and, later, pooled enhance fodder).
                              Persistent (saved), replacing the old per-session ✕ exclude. */}
                          <button
                            type="button"
                            className={`owned-card__fav ${fav ? 'owned-card__fav--on' : ''}`}
                            aria-label={t(language, 'favoriteToggle')}
                            title={t(language, 'favoriteToggle')}
                            onClick={() => { onToggleFavorite?.(entity.id); onUITap?.(); }}
                          >
                            {fav ? '★' : '☆'}
                          </button>
                        </div>
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
      {/* Charging beat — suspense before the reveal lands (tap Skip to fast-forward) */}
      {fusing ? (
        <div className="fusion-charge" role="status" aria-live="polite" onClick={commitFuse}>
          <div className="fusion-charge__core">
            {/* #42-fix: Fuse-All/batch clears fuseInputs, so fall back to the
                pending batch's first id — otherwise the charge core was empty and
                "융합 중" looked like it had no animation. */}
            {(() => {
              const gid = fuseInputs[0] ?? pendingFuseRef.current?.ids[0];
              const gent = gid ? findEntityById(gid) : undefined;
              return gent ? <EntityGlyph entity={gent} color={RARITY_COLORS[gent.rarity]} /> : null;
            })()}
          </div>
          <div className="fusion-charge__label">{t(language, 'fuseChanting')}</div>
          <button type="button" className="fusion-charge__skip" onClick={(e) => { e.stopPropagation(); commitFuse(); }}>
            {t(language, 'fuseSkip')}
          </button>
        </div>
      ) : null}
      {/* #42-fix: "강화 중…" beat (no Skip — it's short). Result shows via the toast. */}
      {enhancing ? (
        <div className="fusion-charge fusion-charge--enhance" role="status" aria-live="polite">
          <div className="fusion-charge__core">
            {(() => { const e = findEntityById(enhancing); return e ? <EntityGlyph entity={e} color={RARITY_COLORS[e.rarity]} /> : null; })()}
          </div>
          <div className="fusion-charge__label">{t(language, 'enhanceCharging')}</div>
        </div>
      ) : null}
      {/* Fusion result reveal */}
      {lastFusionEvent ? (() => {
        const output = findEntityById(lastFusionEvent.outputEntityId);
        if (!output) return null;
        // Batch → gacha card-pull grid: flip each result one-by-one (skippable).
        const ev = lastFusionEvent;
        if (ev.cards.length > 1) {
          // #49: show ONLY the rarity-up reveals as cards; every failed trio rolls
          // up into the single 강화석 total below (no clutter of identical fail cards).
          const upCards = ev.cards.filter((c) => c.rarityUp);
          const failCount = ev.cards.length - upCards.length;
          const total = upCards.length;
          const allRevealed = revealedCount >= total;
          return (
            <div className="fusion-result fusion-result--grid" role="status">
              <div className="fusion-reveal__head">
                <span className="fusion-reveal__tag">
                  {t(language, 'fuseBatchSummary').replace('{s}', String(ev.successCount)).replace('{n}', String(ev.batchCount))}
                </span>
                {total > 0 && !allRevealed ? (
                  <button type="button" className="fusion-reveal__skip" onClick={() => setRevealedCount(total)}>
                    {t(language, 'fuseSkip')}
                  </button>
                ) : null}
              </div>
              {upCards.length > 0 ? (
                <div className="fusion-reveal-grid cc-scroll cc-scroll--hidden">
                  {upCards.map((card, i) => {
                    const ent = findEntityById(card.outputEntityId);
                    const flipped = i < revealedCount;
                    return (
                      <div
                        key={i}
                        className={`fusion-reveal-card ${flipped ? 'is-flipped' : ''} ${flipped ? 'fusion-reveal-card--up' : ''}`}
                        style={ent ? ({ '--rarity-color': RARITY_COLORS[ent.rarity] } as CSSProperties) : undefined}
                      >
                        <div className="fusion-reveal-card__inner">
                          <span className="fusion-reveal-card__back" aria-hidden="true">◈</span>
                          <span className="fusion-reveal-card__face">
                            {ent ? <EntityGlyph entity={ent} color={RARITY_COLORS[ent.rarity]} /> : null}
                            <span className="fusion-reveal-card__badge">⬆</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="fusion-reveal__allfail">{t(language, 'fuseResultFail')}</div>
              )}
              {failCount > 0 ? (
                <div className="fusion-reveal__failnote">
                  {t(language, 'fuseBatchFailStones').replace('{n}', String(failCount)).replace('{s}', String(ev.stonesEarned))}
                </div>
              ) : null}
              <div className="fusion-reveal__totals">
                <span>{`+${formatEntropyAmount(ev.entropyBurst)} ${t(language, 'hudEntropy')}`}</span>
                {ev.stonesEarned > 0 ? <span>{`💎 ${ev.stonesEarned}`}</span> : null}
                {ev.refund > 0 ? <span>{`⚛${formatEntityCost(ev.refund)}`}</span> : null}
              </div>
              <div className="fusion-result__actions">
                <button type="button" className="fusion-result__retry" disabled={!canRetry} onClick={(e) => { e.stopPropagation(); retryFuse(); }}>
                  {t(language, 'fuseRetry')}
                </button>
                <button type="button" className="fusion-result__close" onClick={(e) => { e.stopPropagation(); onClearFusionEvent(ev.id); }}>
                  {t(language, 'fuseClose')}
                </button>
              </div>
            </div>
          );
        }
        return (
          <div
            className={`fusion-result ${lastFusionEvent.rarityUp ? 'fusion-result--boom' : 'fusion-result--fail'}`}
            role="status"
          >
            <div
              className={`fusion-result__card fusion-result__card--${output.rarity} ${lastFusionEvent.rarityUp ? 'fusion-result__card--up' : 'fusion-result__card--fail'}`}
              style={{ '--rarity-color': RARITY_COLORS[output.rarity] } as CSSProperties}
            >
              {lastFusionEvent.rarityUp ? <div className="fusion-result__rays" aria-hidden="true" /> : null}
              {/* Primary verdict: batch summary (N/M), or single up/fail. */}
              <div className={`fusion-result__tag ${lastFusionEvent.rarityUp ? '' : 'fusion-result__tag--fail'}`}>
                {lastFusionEvent.batchCount > 1
                  ? t(language, 'fuseBatchSummary')
                      .replace('{s}', String(lastFusionEvent.successCount))
                      .replace('{n}', String(lastFusionEvent.batchCount))
                  : lastFusionEvent.rarityUp
                    ? t(language, 'fuseResultUp')
                    : t(language, 'fuseResultFail')}
              </div>
              <EntityGlyph entity={output} color={RARITY_COLORS[output.rarity]} />
              <div className="fusion-result__name">{entityName(output, language)}</div>
              {/* #42-fix: show the item's spec right in the reveal. */}
              {(() => {
                const p = effectValueLabel(output, language, power, 1, 1, false, false);
                const tr = EFFECT_TRAIT[output.effect.type];
                return <SpecChip icon={tr.icon} value={p.value} label={p.label} accent={tr.accent} primary />;
              })()}
              {/* On a failed upgrade the 강화석 ARE the payout — show them prominently. */}
              {!lastFusionEvent.rarityUp && lastFusionEvent.stonesEarned > 0 ? (
                <div className="fusion-result__stones fusion-result__stones--big">
                  {`💎 ${t(language, 'fuseStonesEarned').replace('{n}', String(lastFusionEvent.stonesEarned))}`}
                </div>
              ) : null}
              {/* Secondary: what became of the output copy. */}
              <div className="fusion-result__sub">
                {lastFusionEvent.atCap
                  ? t(language, 'fuseResultRefund')
                  : t(language, 'fuseResultNew')}
              </div>
              <div className="fusion-result__burst">
                {`+${formatEntropyAmount(lastFusionEvent.entropyBurst)} ${t(language, 'hudEntropy')}`}
              </div>
              {lastFusionEvent.refund > 0 ? (
                <div className="fusion-result__refund">
                  {`${t(language, 'fuseRefund')} ⚛${formatEntityCost(lastFusionEvent.refund)}`}
                </div>
              ) : null}
              {/* 🅠4: explicit retry + close — no auto-dismiss, no auto-refill. */}
              <div className="fusion-result__actions">
                <button
                  type="button"
                  className="fusion-result__retry"
                  disabled={!canRetry}
                  onClick={(e) => { e.stopPropagation(); retryFuse(); }}
                >
                  {t(language, 'fuseRetry')}
                </button>
                <button
                  type="button"
                  className="fusion-result__close"
                  onClick={(e) => { e.stopPropagation(); onClearFusionEvent(lastFusionEvent.id); }}
                >
                  {t(language, 'fuseClose')}
                </button>
              </div>
            </div>
          </div>
        );
      })() : null}
      {/* (?) rules overlay — explains the equip / fusion systems on demand (user
          request: these screens are intricate, so one help button spells out the rules). */}
      {helpOpen ? (
        <div className="entity-help-layer" role="dialog" aria-modal="true" onClick={(e) => { e.stopPropagation(); setHelpOpen(false); }}>
          <article className="entity-help-card cc-scroll" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="entity-help-card__close" aria-label={t(language, 'panelClose')} onClick={() => setHelpOpen(false)}>×</button>
            <h3 className="entity-help-card__title">{`${tab === 'fuse' ? t(language, 'fuseTitle') : t(language, 'entityEquip')} · ${t(language, 'panelHelp')}`}</h3>
            <ol className="entity-help-card__list">
              {(tab === 'fuse'
                ? (['helpFuseRule1', 'helpFuseRule2', 'helpFuseRule3', 'helpFuseRule4'] as const)
                : (['helpEquipRule1', 'helpEquipRule2', 'helpEquipRule3', 'helpEquipRule4'] as const)
              ).map((k) => (
                <li key={k}>{t(language, k)}</li>
              ))}
            </ol>
          </article>
        </div>
      ) : null}
      {/* 강화 result CARD (user feedback): a proper card-sized popup — outcome banner +
          the item's glyph + (on success) the primary stat BEFORE → AFTER, level, and
          matter payback; on a destroy, a shattered glyph + the 강화석 minted. Replaces
          the old tiny "파괴됨! ◆7" chip. Click anywhere or wait to dismiss. */}
      {lastEnhanceEvent ? (() => {
        const ev = lastEnhanceEvent;
        const palette: Record<string, string> = { up: '#bb8cff', break: '#e2554a', protected: '#4a8fff' };
        const col = palette[ev.outcome];
        const labelKey = ({ up: 'enhanceOutcomeUp', break: 'enhanceOutcomeBreak', protected: 'enhanceOutcomeProtected' } as const)[ev.outcome];
        const ent = findEntityById(ev.entityId);
        const entry = ev.instanceId ? inventory.find((e) => e.instanceId === ev.instanceId) : undefined;
        const tr = ent ? EFFECT_TRAIT[ent.effect.type] : null;
        // before → after for the primary stat on a successful level-up.
        let beforeVal: string | null = null;
        let afterVal: string | null = null;
        let statLabel = '';
        if (ent && ev.outcome === 'up' && ev.prevLevel != null) {
          const cnt = entry?.count ?? 1;
          const carried = entry?.carried ?? false;
          const before = effectValueLabel(ent, language, power, cnt, ev.prevLevel, carried, true, entry?.quality);
          const after = effectValueLabel(ent, language, power, cnt, ev.level, carried, true, entry?.quality);
          beforeVal = before.value; afterVal = after.value; statLabel = after.label;
        }
        return (
          <div className="enhance-result-layer" role="status" onClick={(e) => { e.stopPropagation(); onClearEnhanceEvent?.(ev.id); }}>
            <article
              className={`enhance-result-card enhance-result-card--${ev.outcome}`}
              style={{ '--flash-color': col } as CSSProperties}
            >
              <div className="enhance-result-card__banner">{t(language, labelKey)}</div>
              {ent ? (
                <div className={`enhance-result-card__visual ${ev.outcome === 'break' ? 'enhance-result-card__visual--broken' : ''}`}>
                  <EntityGlyph entity={ent} color={ev.outcome === 'break' ? '#e2554a' : RARITY_COLORS[ent.rarity]} />
                </div>
              ) : null}
              {ent ? <h3 className="enhance-result-card__name">{entityName(ent, language)}</h3> : null}
              {ev.outcome === 'up' && beforeVal && afterVal ? (
                <div className="enhance-result-card__delta">
                  {tr ? <span className="enhance-result-card__delta-icon" style={{ color: tr.accent }}>{tr.icon}</span> : null}
                  <span className="enhance-result-card__stat">{statLabel}</span>
                  <span className="enhance-result-card__before">{beforeVal}</span>
                  <span className="enhance-result-card__arrow">→</span>
                  <span className="enhance-result-card__after">{afterVal}</span>
                </div>
              ) : null}
              {ev.outcome !== 'break' ? (
                <div className="enhance-result-card__lv">{`Lv.${ev.prevLevel ?? ev.level} → Lv.${ev.level}`}</div>
              ) : null}
              {ev.outcome === 'break' && (ev.stonesEarned ?? 0) > 0 ? (
                <div className="enhance-result-card__payout enhance-result-card__payout--stones">{`◆ ${ev.stonesEarned} ${t(language, 'hudStones')}`}</div>
              ) : null}
              {ev.outcome !== 'break' && ev.payout && ev.payout > 0 ? (
                <div className="enhance-result-card__payout">{`⚛ ${formatEntityCost(ev.payout)}`}</div>
              ) : null}
            </article>
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
        // P6: this detail is for the SPECIFIC equipped copy — resolve by the slot's
        // instanceId so its own level/quality (not a spare's) drives enhance.
        const slotVal = gearSlots[i] ?? '';
        const entry = entryOfSlot(slotVal);
        const lvl = entry?.level ?? 1;
        const cap = getEnhanceLevelCap(ent);
        const atCap = lvl >= cap;
        const stonePhase = isEnhanceStonePhase(lvl);
        const matterCost = getEnhanceCost(ent, lvl, currentStageId);
        const protectCost = getEnhanceProtectStoneCost(ent, lvl);
        const failPct = Math.round(getEnhanceFailChance(lvl) * 100);
        // #47: normal enhance is matter-only; 강화석 is needed only when protecting.
        const affordable = !atCap && quanta >= matterCost && (stonePhase && protectEnhance ? enhanceStones >= protectCost : true);
        const rc = RARITY_COLORS[ent.rarity];
        return (
          <div className="entity-detail-layer" role="dialog" aria-modal="true" onClick={(e) => { e.stopPropagation(); setInspectedSlot(null); }}>
            <article className={`entity-detail-card cc-scroll entity-detail-card--${ent.rarity} ${isTailQuality(entry?.quality) ? 'entity-detail-card--tail' : ''}`} style={{ '--rarity-color': rc } as CSSProperties} onClick={(e) => e.stopPropagation()}>
              <button type="button" className="entity-detail-card__close" aria-label={t(language, 'panelClose')} onClick={() => setInspectedSlot(null)}>×</button>
              <div className="entity-detail-card__visual"><EntityGlyph entity={ent} color={rc} /></div>
              <div className="entity-detail-card__formula" style={{ color: rc }}>{ent.formula}</div>
              <h3 className="entity-detail-card__name">{entityName(ent, language)}</h3>
              <div className="entity-detail-card__stats">
                {(() => {
                  const p = effectValueLabel(ent, language, power, entry?.count ?? 1, lvl, entry?.carried ?? false, true, entry?.quality);
                  const tr = EFFECT_TRAIT[ent.effect.type];
                  return <SpecChip icon={tr.icon} value={p.value} label={p.label} accent={tr.accent} primary />;
                })()}
                <span className="entity-detail-card__lvl">{`Lv.${lvl} · ×${copiesOf(ent.id)}`}</span>
                {/* #50: a tail (gold) specimen shows its quality percentile. */}
                {isTailQuality(entry?.quality) ? (
                  <span className="entity-detail-card__quality">{`✦ ${t(language, 'qualityTail')} ${Math.round((entry?.quality ?? 0) * 100)}%`}</span>
                ) : null}
              </div>
              {getSecondaryStats(ent).length > 0 ? (
                <div className="entity-detail-card__substats spec-chip-row">
                  {getSecondaryStats(ent).map((sub) => {
                    const s = substatValueLabel(sub, language, lvl, getGearPowerMult(power, ent.stageId, entry?.carried), entry?.quality);
                    return <SpecChip key={sub.type} icon={s.icon} value={s.value} label={s.label} accent="#aab6cc" />;
                  })}
                </div>
              ) : null}
              {stonePhase && !atCap ? (
                <button
                  type="button"
                  className={`slot-detail__protect ${protectEnhance ? 'slot-detail__protect--on' : ''}`}
                  onClick={() => { setProtectEnhance((v) => !v); onUITap?.(); }}
                >
                  {`${protectEnhance ? '☑' : '☐'} ${t(language, 'enhanceProtect')} ◆${formatEntityCost(protectCost)}`}
                </button>
              ) : null}
              <button
                type="button"
                className="entity-detail-card__equip entity-detail-card__enhance"
                style={affordable && enhanceUnlocked ? { background: '#bb8cff' } : { borderColor: '#bb8cff', color: '#bb8cff' }}
                disabled={!affordable || !enhanceUnlocked || enhancing !== null}
                onClick={() => triggerEnhance(slotVal, stonePhase ? protectEnhance : false)}
              >
                {!enhanceUnlocked
                  ? `🔒 ${t(language, 'enhanceLabel')} · ${t(language, 'lockUntilStage').replace('{n}', String(ENHANCE_UNLOCK_STAGE_ID))}`
                  : atCap
                    ? `${t(language, 'enhanceLabel')} ${t(language, 'enhanceMax')} (Lv.${lvl})`
                    : (
                      <>
                        <span className="enhance-btn__label">{t(language, 'enhanceLabel')}</span>
                        <span className="enhance-btn__lv">{`Lv.${lvl} → ${lvl + 1}`}</span>
                        <span className="enhance-btn__cost">{`⚛${formatEntityCost(matterCost)}`}</span>
                        {stonePhase ? (
                          <span className="enhance-btn__fail">{t(language, 'enhanceFailLabel').replace('{n}', String(failPct))}</span>
                        ) : null}
                      </>
                    )}
              </button>
              {/* #51: keep this item out of the "전체 강화" spray (so Enhance-All
                  never risk-destroys your best gear). */}
              {!atCap ? (
                <button
                  type="button"
                  className={`slot-detail__skip ${enhanceExcludedIds.has(slotVal) ? 'slot-detail__skip--on' : ''}`}
                  onClick={() => {
                    setEnhanceExcludedIds((prev) => {
                      const nextSet = new Set(prev);
                      if (nextSet.has(slotVal)) nextSet.delete(slotVal); else nextSet.add(slotVal);
                      return nextSet;
                    });
                    onUITap?.();
                  }}
                >
                  {`${enhanceExcludedIds.has(slotVal) ? '☑' : '☐'} ${t(language, 'enhanceExcludeToggle')}`}
                </button>
              ) : null}
              <div className="slot-detail__actions">
                <button type="button" className="entity-detail-card__equip slot-detail__swap" onClick={() => { setPickingSlot(i); setInspectedSlot(null); }}>
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
        className={`entity-detail-card cc-scroll entity-detail-card--${entity.rarity}`}
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
        <div className="entity-detail-card__stats">
          {(() => {
            const p = effectValueLabel(entity, language, power, count, ownedLevel, false, false);
            const tr = EFFECT_TRAIT[entity.effect.type];
            return <SpecChip icon={tr.icon} value={p.value} label={p.label} accent={tr.accent} primary />;
          })()}
          <span className="entity-detail-card__lvl">{entity.maxCount > 1 ? `${count}/${entity.maxCount}` : count > 0 ? t(language, 'entityLabOwned') : t(language, 'codexConsumed')}</span>
        </div>
        {getSecondaryStats(entity).length > 0 ? (
          <div className="entity-detail-card__substats spec-chip-row">
            {getSecondaryStats(entity).map((sub) => {
              const s = substatValueLabel(sub, language, ownedLevel, getGearPowerMult(power, entity.stageId));
              return <SpecChip key={sub.type} icon={s.icon} value={s.value} label={s.label} accent="#aab6cc" />;
            })}
          </div>
        ) : null}
        {/* Flavor demoted below the mechanical specs — what it DOES reads first. */}
        <p className="entity-detail-card__description entity-detail-card__description--flavor">{entityDescription(entity, language)}</p>
        <LoreSection loreId={entityLoreId(entity.stageId, entity.name)} language={language} />
      </article>
    </div>
  );
}
