import type { GameState } from '../types';
import type { GameAction } from '../reducer';
import { entityMatchesId, findEntityById } from '../entities/stageItems';
import { isEntityLockedByAnchor } from '../entities/anchors';
import { addToAlmanac, pickDropStage } from '../entities/drops';
import { getDerivedRiftSlotCount, getDerivedUnlockedSlotCount, getEquipCategory } from '../entities/effects';
import {
  applyFusionOutput,
  consumeFusionInputs,
  getFusionEntropyBurst,
  getFusionQuantaCost,
  pickFusionOutput,
  rollFusionRarity,
  validateFusionInputs,
} from '../entities/fusion';
import {
  getEnhanceCost,
  getEnhanceLevelCap,
  getEnhanceStoneCost,
  getEnhanceProtectStoneCost,
  getEnhanceFailChance,
  isEnhanceStonePhase,
  isEnhanceDestroyEligible,
} from '../entities/enhance';
import { getSecondaryStats } from '../entities/substats';
import {
  FUSION_ENHANCE_COST_BASE,
  FUSION_BURST_REF_COST_FRAC,
  FUSION_INPUT_COUNT,
  RARITY_STAGE_GATES,
  ENHANCE_DESTROY_CHANCE_ON_FAIL,
  ENHANCE_STONE_THRESHOLD,
  FUSION_FAIL_STONES_BY_TIER,
  FUSION_SAME_ENTITY_UP_BONUS,
  FUSION_SAME_ENTITY_FAIL_STONE_BONUS,
  FUSION_SAME_SUBSET_BURST_MULT,
} from '../balance';
import { getEntityCost } from '../entities/types';
import { getAutoRate, safeAdd } from '../formulas';
import { getPrestigeMultiplier } from '../prestige';
import { STAGES } from '../stages';
import { withCurrentUniverseEndingProgress } from '../multiverse';
import { getAdjustedClickPower, getCurrentModifiers, nextEventId } from './helpers';
import { advanceQuestTracks } from '../quests';

type PurchaseAction = Extract<GameAction, { type: 'PURCHASE_ENTITY' }>;
type EquipAction = Extract<GameAction, { type: 'EQUIP_ENTITY' }>;
type UnequipAction = Extract<GameAction, { type: 'UNEQUIP_ENTITY' }>;
type FuseAction = Extract<GameAction, { type: 'FUSE_ENTITIES' }>;
type FuseBatchAction = Extract<GameAction, { type: 'FUSE_BATCH' }>;
type EnhanceAction = Extract<GameAction, { type: 'ENHANCE_ENTITY' }>;

/** Raise slot counts when stage/almanac progress earns new slots (never lowers). */
export function syncSlotUnlocks(state: GameState): GameState {
  const stage = STAGES[Math.min(state.stageIdx, STAGES.length - 1)];
  const derived = getDerivedUnlockedSlotCount(stage.id, state.almanacCollected);
  const derivedRift = getDerivedRiftSlotCount(stage.id, state.almanacCollected);
  if (derived <= state.unlockedSlotCount && derivedRift <= state.unlockedRiftSlotCount) return state;
  return {
    ...state,
    unlockedSlotCount: Math.max(state.unlockedSlotCount, derived),
    unlockedRiftSlotCount: Math.max(state.unlockedRiftSlotCount, derivedRift),
  };
}

/**
 * Equip an owned entity. The gear category is derived from the entity itself —
 * auto/time entities go to the rift slots, everything else to click slots.
 * Without an explicit slot, the first empty unlocked one is used.
 */
export function handleEquipEntity(state: GameState, action: EquipAction): GameState {
  const entity = findEntityById(action.entityId);
  if (!entity) return state;

  const owned = state.inventory.find((e) => entityMatchesId(entity, e.entityId));
  if (!owned || owned.count <= 0) return state;

  const category = getEquipCategory(entity);
  const slots = category === 'rift' ? state.riftSlots : state.equippedSlots;
  const slotCount = category === 'rift' ? state.unlockedRiftSlotCount : state.unlockedSlotCount;

  let slot = action.slot ?? -1;
  if (slot === -1) {
    // First empty unlocked slot; fall back to replacing slot 0.
    slot = 0;
    for (let i = 0; i < slotCount; i++) {
      if (!slots[i]) { slot = i; break; }
    }
  }
  if (slot < 0 || slot >= slotCount) return state;
  // Same entity cannot occupy two slots.
  if (slots.some((id, i) => i !== slot && id === action.entityId)) return state;

  // Dense array — empty slots hold '' so JSON round-trips cleanly (no holes).
  const next: string[] = [];
  for (let i = 0; i < slotCount; i++) next[i] = slots[i] ?? '';
  next[slot] = action.entityId;
  while (next.length > 0 && next[next.length - 1] === '') next.pop();
  // Vacuum decay in gear terms (Phase 4-2): equipping Critical-flavored gear
  // marks the universe as crit-upgraded — the ending requires never doing so.
  const isCritGear =
    entity.effect.type === 'crit' ||
    getSecondaryStats(entity).some((sub) => sub.type === 'critChance' || sub.type === 'critMult');
  const endingProgressFlags = isCritGear && !state.endingProgressFlags.criticalUpgradedThisUniverse
    ? { ...state.endingProgressFlags, criticalUpgradedThisUniverse: true, vacuumDecayEligible: false }
    : state.endingProgressFlags;
  return category === 'rift'
    ? { ...state, riftSlots: next, endingProgressFlags }
    : { ...state, equippedSlots: next, endingProgressFlags };
}

export function handleUnequipEntity(state: GameState, action: UnequipAction): GameState {
  const category = action.target ?? 'click';
  const slots = category === 'rift' ? state.riftSlots : state.equippedSlots;
  if (action.slot < 0 || action.slot >= slots.length) return state;
  if (!slots[action.slot]) return state;
  const next = slots.map((id, i) => (i === action.slot ? '' : id));
  while (next.length > 0 && next[next.length - 1] === '') next.pop();
  return category === 'rift'
    ? { ...state, riftSlots: next }
    : { ...state, equippedSlots: next };
}

export function handlePurchaseEntity(state: GameState, action: PurchaseAction): GameState {
  const entity = findEntityById(action.entityId);
  if (!entity) return state;

  // Allow purchasing entities from any stage up to and including the current stage
  const currentStage = STAGES[state.stageIdx];
  if (!currentStage || entity.stageId > currentStage.id) return state;

  // Rarity gate: higher tiers unlock as the run progresses (fusion can craft
  // one tier early, but the shop never sells ahead of the gate).
  if ((RARITY_STAGE_GATES[entity.rarity] ?? 1) > currentStage.id) return state;

  const existing = state.inventory.find((entry) => entityMatchesId(entity, entry.entityId));
  const currentCount = existing?.count ?? 0;

  // Max count check
  if (entity.maxCount > 0 && currentCount >= entity.maxCount) return state;

  // Anchor lock — non-anchor entities on the same stage are blocked until
  // the anchor entity for that stage (e.g. Sun on stage 10, Earth Formation
  // on stage 11) is fully maxed.
  if (isEntityLockedByAnchor(entity, state.inventory)) return state;

  const cost = getEntityCost(entity, currentCount, currentStage.id);
  if (state.quanta < cost) return state;

  const updatedInventory = existing
    ? state.inventory.map((e) =>
        e.entityId === existing.entityId ? { ...e, count: e.count + 1 } : e,
      )
    : [...state.inventory, { entityId: action.entityId, count: 1, level: 1 }];

  return withCurrentUniverseEndingProgress(syncSlotUnlocks({
    ...state,
    quanta: state.quanta - cost,
    inventory: updatedInventory,
    // Purchases count as collected for the almanac grid.
    almanacCollected: addToAlmanac(state.almanacCollected, entity.stageId, entity.id),
  }));
}

/**
 * FUSE_ENTITIES (Phase 3): consume FUSION_INPUT_COUNT same-rarity copies plus a
 * quanta fraction; roll a same-stage output with pure rarity-up odds (no pity),
 * fire an entropy burst, and feed duplicates at max count into level-ups.
 * Randomness arrives via action rolls so the reducer stays pure.
 */
interface FuseRolls {
  rarityRoll: number;
  pickRoll: number;
  stageRoll?: number;
}

interface OneFusionResult {
  outputId: string;
  rarityUp: boolean;
  leveledUp: boolean;
  atCap: boolean;
  stonesEarned: number;
  burst: number;
  refund: number;
}

/**
 * Core of one fusion (🅠4): validate + afford-check + roll + consume + apply,
 * returning the MUTATED state (quanta / entropy / 강화석 / inventory / almanac)
 * WITHOUT the lastFusionEvent / eventCounter / ending-progress wrap. The caller
 * (single FUSE_ENTITIES or batched FUSE_BATCH) sets the event + wraps ONCE.
 * Returns null when the inputs are invalid or unaffordable (which stops a batch).
 */
function fuseOnce(
  state: GameState,
  inputEntityIds: string[],
  rolls: FuseRolls,
): { state: GameState; result: OneFusionResult } | null {
  const validation = validateFusionInputs(state.inventory, inputEntityIds);
  if (!validation.ok || !validation.rarity || !validation.stageId) return null;

  const currentStageIdForFusion = STAGES[Math.min(state.stageIdx, STAGES.length - 1)].id;
  // Fusion is a fixed per-era price (Overhaul-2 🅠1): anchor × FUSION_FLAT_COST.
  // The player must afford it in full — there is no bank-fraction discount.
  const cost = getFusionQuantaCost(validation.rarity, currentStageIdForFusion);
  if (state.quanta < cost) return null;
  // P2b bonuses: 3-of-the-same-entity lifts the up chance; 3-from-one-codex
  // category amplifies the entropy burst.
  const sameEntity = validation.sameEntity === true;
  const sameSubset = validation.sameSubsetId != null;
  const rarityResult = rollFusionRarity(
    validation.rarity, rolls.rarityRoll, currentStageIdForFusion,
    sameEntity ? FUSION_SAME_ENTITY_UP_BONUS : 0,
  );
  // Output pool stage follows the same player-stage weighting as drops
  // (Phase 4-1) — input origin stages no longer determine the output pool.
  const outputStageId =
    rolls.stageRoll !== undefined
      ? pickDropStage(currentStageIdForFusion, rolls.stageRoll, state.almanacCollected)
      : currentStageIdForFusion;
  const output = pickFusionOutput(outputStageId, rarityResult.rarity, rolls.pickRoll, {
    category: validation.category,
    familyKey: validation.familyKey,
  }, outputStageId !== currentStageIdForFusion);
  if (!output) return null;

  const { inventory: consumed, refund: enhanceRefund, stoneRefund } = consumeFusionInputs(state.inventory, inputEntityIds);
  const { inventory, leveledUp, capRefund } = applyFusionOutput(consumed, output, currentStageIdForFusion);
  const totalRefund = enhanceRefund + capRefund;
  // A failed fusion (no rarity-up) mints 강화석 — the consolation that funds
  // Lv5+ enhancement (R1). Stones scale with the input tier; +bonus for same-entity.
  const stonesEarned = rarityResult.rarityUp
    ? 0
    : (FUSION_FAIL_STONES_BY_TIER[validation.rarity] ?? 1) + (sameEntity ? FUSION_SAME_ENTITY_FAIL_STONE_BONUS : 0);

  const fusionModifiers = getCurrentModifiers(state);
  const entropyEchoMult = getPrestigeMultiplier(state.prestigeUpgrades?.entropy_echo ?? 0);
  // Burst scales by fusion cost vs a reference price. Overhaul-2 follow-up:
  // both the cost and this reference now use the stage-independent flat base, so
  // burstCostScale resolves to a fixed per-rarity fraction at EVERY stage (the
  // burst no longer collapses late-game when costs were flattened).
  const burstRefCost = FUSION_ENHANCE_COST_BASE * FUSION_BURST_REF_COST_FRAC;
  const burstCostScale = burstRefCost > 0 ? Math.min(1, cost / burstRefCost) : 1;
  const burst =
    getFusionEntropyBurst(getAdjustedClickPower(state), getAutoRate(fusionModifiers)) *
    fusionModifiers.fusionBurstMult *
    entropyEchoMult *
    burstCostScale *
    (sameSubset ? FUSION_SAME_SUBSET_BURST_MULT : 1);
  const nextEntropy = safeAdd(state.entropy, burst);

  const nextState: GameState = {
    ...state,
    quanta: Math.max(0, state.quanta - cost + totalRefund),
    entropy: nextEntropy,
    peakEntropy: Math.max(state.peakEntropy, nextEntropy),
    enhanceStones: Math.max(0, state.enhanceStones + stonesEarned + stoneRefund),
    inventory,
    almanacCollected: addToAlmanac(state.almanacCollected, output.stageId, output.id),
  };
  return {
    state: nextState,
    result: {
      outputId: output.id,
      rarityUp: rarityResult.rarityUp,
      leveledUp,
      atCap: capRefund > 0,
      stonesEarned,
      burst,
      refund: totalRefund,
    },
  };
}

/**
 * FUSE_ENTITIES (Phase 3 / 🅠4): consume FUSION_INPUT_COUNT same-rarity copies +
 * a fixed quanta cost; roll a same-stage output with pure rarity-up odds, fire an
 * entropy burst, feed duplicates at max count into level-ups. Randomness arrives
 * via action rolls so the reducer stays pure.
 */
export function handleFuseEntities(state: GameState, action: FuseAction): GameState {
  if (state.completedRun || state.pendingCondenseStageIdx !== null || state.imploding || state.selectedEndingId !== null) {
    return state;
  }
  const r = fuseOnce(state, action.inputEntityIds, action);
  if (!r) return state;
  const eventId = nextEventId(r.state);
  const { result } = r;
  return withCurrentUniverseEndingProgress(syncSlotUnlocks({
    ...r.state,
    eventCounter: eventId,
    questProgress: advanceQuestTracks(r.state, 'fuse', 1), // 🅠5
    lastFusionEvent: {
      id: eventId,
      outputEntityId: result.outputId,
      rarityUp: result.rarityUp,
      leveledUp: result.leveledUp,
      entropyBurst: result.burst,
      refund: result.refund,
      atCap: result.atCap,
      stonesEarned: result.stonesEarned,
      batchCount: 1,
      successCount: result.rarityUp ? 1 : 0,
      failCount: result.rarityUp ? 0 : 1,
    },
  }));
}

/**
 * FUSE_BATCH (🅠4): fuse up to action.rolls.length trios in one action. The UI
 * supplies a flat inputEntityIds list (FUSION_INPUT_COUNT × N copies it already
 * drew from the inventory) plus N roll-sets. Each trio runs through fuseOnce;
 * the loop stops early on the first invalid/unaffordable trio. A single batch
 * summary event ("N성공 / M") is emitted with the accumulated totals.
 */
export function handleFuseBatch(state: GameState, action: FuseBatchAction): GameState {
  if (state.completedRun || state.pendingCondenseStageIdx !== null || state.imploding || state.selectedEndingId !== null) {
    return state;
  }
  let s = state;
  let done = 0;
  let successCount = 0;
  let failCount = 0;
  let totalStones = 0;
  let totalBurst = 0;
  let totalRefund = 0;
  let anyLeveled = false;
  let anyAtCap = false;
  let lastResult: OneFusionResult | null = null;
  for (let i = 0; i < action.rolls.length; i++) {
    const trio = action.inputEntityIds.slice(i * FUSION_INPUT_COUNT, i * FUSION_INPUT_COUNT + FUSION_INPUT_COUNT);
    if (trio.length < FUSION_INPUT_COUNT) break;
    const r = fuseOnce(s, trio, action.rolls[i]);
    if (!r) break; // invalid inputs or out of quanta — stop the batch here.
    s = r.state;
    done += 1;
    if (r.result.rarityUp) successCount += 1; else failCount += 1;
    totalStones += r.result.stonesEarned;
    totalBurst += r.result.burst;
    totalRefund += r.result.refund;
    anyLeveled = anyLeveled || r.result.leveledUp;
    anyAtCap = anyAtCap || r.result.atCap;
    lastResult = r.result;
  }
  if (!lastResult) return state;
  const eventId = nextEventId(s);
  return withCurrentUniverseEndingProgress(syncSlotUnlocks({
    ...s,
    eventCounter: eventId,
    questProgress: advanceQuestTracks(s, 'fuse', done), // 🅠5
    lastFusionEvent: {
      id: eventId,
      outputEntityId: lastResult.outputId,
      rarityUp: successCount > 0,
      leveledUp: anyLeveled,
      entropyBurst: totalBurst,
      refund: totalRefund,
      atCap: anyAtCap,
      stonesEarned: totalStones,
      batchCount: done,
      successCount,
      failCount,
    },
  }));
}

/**
 * ENHANCE_ENTITY (강화소): level an owned stack directly. Lv1→5 spend matter and
 * always succeed; Lv5+ spend 강화석 and CAN FAIL — mostly a level-down, with a
 * small chance to destroy a copy near the cap. "보호 강화" (protect) costs extra
 * stones and negates any loss on a failed attempt (운빨 존망겜, P1).
 */
export function handleEnhanceEntity(state: GameState, action: EnhanceAction): GameState {
  if (state.completedRun || state.pendingCondenseStageIdx !== null || state.imploding || state.selectedEndingId !== null) {
    return state;
  }
  const entity = findEntityById(action.entityId);
  if (!entity) return state;
  const owned = state.inventory.find((e) => entityMatchesId(entity, e.entityId));
  if (!owned || owned.count <= 0) return state;
  const level = owned.level;
  if (level >= getEnhanceLevelCap(entity)) return state;

  const eventId = nextEventId(state);
  const stageId = STAGES[Math.min(state.stageIdx, STAGES.length - 1)].id;

  // ── Matter phase (Lv < 5): pay quanta, always succeeds. ──
  if (!isEnhanceStonePhase(level)) {
    const cost = getEnhanceCost(entity, level, stageId);
    if (state.quanta < cost) return state;
    return withCurrentUniverseEndingProgress({
      ...state,
      quanta: state.quanta - cost,
      eventCounter: eventId,
      lastEnhanceEvent: { id: eventId, entityId: owned.entityId, outcome: 'up', level: level + 1 },
      inventory: state.inventory.map((e) =>
        e.entityId === owned.entityId
          ? { ...e, level: e.level + 1, invested: (e.invested ?? 0) + cost }
          : e,
      ),
    });
  }

  // ── Stone phase (Lv ≥ 5): pay 강화석, can fail. ──
  const protect = action.protect === true;
  const stoneCost = getEnhanceStoneCost(entity, level);
  const protectCost = protect ? getEnhanceProtectStoneCost(entity, level) : 0;
  const totalStones = stoneCost + protectCost;
  if (state.enhanceStones < totalStones) return state;

  const failChance = getEnhanceFailChance(level);
  const succeeded = (action.failRoll ?? 1) >= failChance;
  const nextStones = state.enhanceStones - totalStones;

  let outcome: 'up' | 'down' | 'break' | 'protected';
  let nextLevel = level;
  let destroyed = false;
  if (succeeded) {
    outcome = 'up';
    nextLevel = level + 1;
  } else if (protect) {
    outcome = 'protected'; // loss negated — stones still spent
  } else if (isEnhanceDestroyEligible(entity, level) && (action.destroyRoll ?? 1) < ENHANCE_DESTROY_CHANCE_ON_FAIL) {
    outcome = 'break';
    destroyed = true;
  } else {
    outcome = 'down';
    nextLevel = Math.max(ENHANCE_STONE_THRESHOLD, level - 1); // never below the matter-bought line
  }

  // Apply to the stack. A break consumes one copy and resets the stack's level;
  // if it empties, drop the entry's slot references.
  let nextInventory = state.inventory.map((e) => {
    if (e.entityId !== owned.entityId) return e;
    const investedStones = succeeded ? (e.investedStones ?? 0) + stoneCost : (e.investedStones ?? 0);
    if (destroyed) {
      return { ...e, count: e.count - 1, level: 1, investedStones: 0 };
    }
    return { ...e, level: nextLevel, investedStones };
  });
  let nextState: GameState = { ...state, enhanceStones: Math.max(0, nextStones) };
  if (destroyed && (nextInventory.find((e) => e.entityId === owned.entityId)?.count ?? 0) <= 0) {
    nextInventory = nextInventory.filter((e) => e.entityId !== owned.entityId);
    nextState = {
      ...nextState,
      equippedSlots: state.equippedSlots.filter((id) => id !== owned.entityId),
      riftSlots: state.riftSlots.filter((id) => id !== owned.entityId),
    };
  }

  return withCurrentUniverseEndingProgress(syncSlotUnlocks({
    ...nextState,
    inventory: nextInventory,
    eventCounter: eventId,
    lastEnhanceEvent: { id: eventId, entityId: owned.entityId, outcome, level: destroyed ? 1 : nextLevel },
  }));
}
