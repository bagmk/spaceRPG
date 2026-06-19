import type { GameState, FusionResultCard } from '../types';
import type { GameAction } from '../reducer';
import { entityMatchesId, findEntityById, getEntitiesForStage } from '../entities/stageItems';
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
  getEnhanceProtectStoneCost,
  getEnhanceFailChance,
  isEnhanceStonePhase,
  getEnhanceBreakStoneReward,
} from '../entities/enhance';
import { rollQualityScore, bestQuality } from '../entities/quality';
import { getSecondaryStats } from '../entities/substats';
import {
  FUSION_ENHANCE_COST_BASE,
  FUSION_BURST_REF_COST_FRAC,
  FUSION_INPUT_COUNT,
  RARITY_STAGE_GATES,
  ENHANCE_MATTER_PAYOUT_SUCCESS,
  ENHANCE_MATTER_PAYOUT_FAIL,
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

  // #50: a purchased copy rolls quality too; the stack keeps its best specimen.
  const rolledQuality =
    action.qualityRoll1 !== undefined && action.qualityRoll2 !== undefined
      ? rollQualityScore(action.qualityRoll1, action.qualityRoll2)
      : undefined;
  const updatedInventory = existing
    ? state.inventory.map((e) =>
        e.entityId === existing.entityId ? { ...e, count: e.count + 1, quality: bestQuality(e.quality, rolledQuality) } : e,
      )
    : [...state.inventory, { entityId: action.entityId, count: 1, level: 1, ...(rolledQuality !== undefined ? { quality: rolledQuality } : {}) }];

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
  /** #50 — gaussian quality roll for the fused output (paired with pickRoll). */
  qualityRoll?: number;
}

interface OneFusionResult {
  outputId: string;
  rarityUp: boolean;
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
  const equippedIds = new Set([...state.equippedSlots, ...state.riftSlots].filter(Boolean) as string[]);
  const validation = validateFusionInputs(state.inventory, inputEntityIds, equippedIds);
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

  // Onboarding: first two fusions at stage 2 (stageIdx 1) yield guaranteed types
  // so new players immediately see both click and auto items to equip. Guards
  // against re-triggering after prestige via the tutorialFlag.
  const stageEntities = getEntitiesForStage(currentStageIdForFusion);
  const isFirstFusion =
    state.stageIdx === 1 &&
    (state.fusionsThisStage ?? 0) === 0 &&
    !state.tutorialFlags['first-fuse-done'];
  const isSecondFusion =
    state.stageIdx === 1 &&
    (state.fusionsThisStage ?? 0) === 1 &&
    !state.tutorialFlags['second-fuse-done'];

  let output =
    isFirstFusion
      ? (stageEntities.find(e => e.rarity === 'common' && e.effect.type === 'click') ?? null)
      : isSecondFusion
        ? (stageEntities.find(e => e.rarity === 'common' && e.effect.type === 'auto') ?? null)
        : null;

  let rarityResult = { rarity: validation.rarity, rarityUp: false as boolean };
  if (!output) {
    rarityResult = rollFusionRarity(
      validation.rarity, rolls.rarityRoll, currentStageIdForFusion,
      sameEntity ? FUSION_SAME_ENTITY_UP_BONUS : 0,
    );
    // Output pool stage follows the same player-stage weighting as drops
    // (Phase 4-1) — input origin stages no longer determine the output pool.
    const outputStageId =
      rolls.stageRoll !== undefined
        ? pickDropStage(currentStageIdForFusion, rolls.stageRoll, state.almanacCollected)
        : currentStageIdForFusion;
    output = pickFusionOutput(outputStageId, rarityResult.rarity, rolls.pickRoll, {
      category: validation.category,
      familyKey: validation.familyKey,
    }, outputStageId !== currentStageIdForFusion);
  }
  if (!output) return null;

  const { inventory: consumed, refund: enhanceRefund, stoneRefund } = consumeFusionInputs(state.inventory, inputEntityIds);
  // #50: the fused output rolls quality too — fusion is the headline "pull", so a
  // lucky tail here is the most exciting place to land a gold item.
  const fusedQuality =
    rolls.qualityRoll !== undefined ? rollQualityScore(rolls.qualityRoll, rolls.pickRoll) : undefined;
  const { inventory, capRefund } = applyFusionOutput(consumed, output, currentStageIdForFusion, fusedQuality);
  const totalRefund = enhanceRefund + capRefund;
  // RARITY-UP IS THE ACTUAL OUTPUT vs INPUT (#42-fix): rollFusionRarity can roll
  // "up" but pickFusionOutput falls back to a lower rarity when the rolled output
  // stage lacks that tier — so a common→common fusion was wrongly flagged "등급
  // 상승". Judge by the real output rarity instead.
  const FUSION_RARITY_RANK: Record<string, number> = { common: 0, rare: 1, epic: 2, legendary: 3, mythic: 4 };
  const rarityUp = (FUSION_RARITY_RANK[output.rarity] ?? 0) > (FUSION_RARITY_RANK[validation.rarity] ?? 0);
  // A failed fusion (no rarity-up) mints 강화석 — the consolation that funds
  // Lv5+ enhancement (R1). Stones scale with the input tier; +bonus for same-entity.
  const stonesEarned = rarityUp
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

  const nextTutorialFlags = isFirstFusion
    ? { ...state.tutorialFlags, 'first-fuse-done': true }
    : isSecondFusion
      ? { ...state.tutorialFlags, 'second-fuse-done': true }
      : state.tutorialFlags;

  const nextState: GameState = {
    ...state,
    quanta: Math.max(0, state.quanta - cost + totalRefund),
    entropy: nextEntropy,
    peakEntropy: Math.max(state.peakEntropy, nextEntropy),
    enhanceStones: Math.max(0, state.enhanceStones + stonesEarned + stoneRefund),
    inventory,
    almanacCollected: addToAlmanac(state.almanacCollected, output.stageId, output.id),
    tutorialFlags: nextTutorialFlags,
  };
  return {
    state: nextState,
    result: {
      outputId: output.id,
      rarityUp,
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
    fusionsThisStage: r.state.fusionsThisStage + 1, // milestones: per-stage fuse counter
    lastFusionEvent: {
      id: eventId,
      outputEntityId: result.outputId,
      rarityUp: result.rarityUp,
      entropyBurst: result.burst,
      refund: result.refund,
      atCap: result.atCap,
      stonesEarned: result.stonesEarned,
      batchCount: 1,
      successCount: result.rarityUp ? 1 : 0,
      failCount: result.rarityUp ? 0 : 1,
      cards: [{
        outputEntityId: result.outputId,
        rarityUp: result.rarityUp,
        atCap: result.atCap,
        stonesEarned: result.stonesEarned,
      }],
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
  let anyAtCap = false;
  let lastResult: OneFusionResult | null = null;
  const cards: FusionResultCard[] = [];
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
    anyAtCap = anyAtCap || r.result.atCap;
    lastResult = r.result;
    cards.push({
      outputEntityId: r.result.outputId,
      rarityUp: r.result.rarityUp,
      atCap: r.result.atCap,
      stonesEarned: r.result.stonesEarned,
    });
  }
  if (!lastResult) return state;
  const eventId = nextEventId(s);
  return withCurrentUniverseEndingProgress(syncSlotUnlocks({
    ...s,
    eventCounter: eventId,
    fusionsThisStage: s.fusionsThisStage + done, // milestones: per-stage fuse counter
    lastFusionEvent: {
      id: eventId,
      outputEntityId: lastResult.outputId,
      rarityUp: successCount > 0,
      entropyBurst: totalBurst,
      refund: totalRefund,
      atCap: anyAtCap,
      stonesEarned: totalStones,
      batchCount: done,
      successCount,
      failCount,
      cards,
    },
  }));
}

/**
 * ENHANCE_ENTITY (강화소): level an owned stack directly. The base cost is MATTER
 * ONLY at every level (stage-independent). Lv1→3 always succeed; from Lv3 an
 * attempt CAN FAIL (#47) — a failed UNPROTECTED attempt DESTROYS one copy and
 * mints a RANDOM amount of 강화석 (no level-down). 강화석 is spent only to
 * 보호(protect), which negates the loss on a failed attempt.
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

  // ── Matter phase (Lv < 3): pay quanta, always succeeds. ──
  if (!isEnhanceStonePhase(level)) {
    const cost = getEnhanceCost(entity, level, stageId);
    if (state.quanta < cost) return state;
    const payout = Math.ceil(cost * ENHANCE_MATTER_PAYOUT_SUCCESS); // #40: every attempt pays a little back
    return withCurrentUniverseEndingProgress({
      ...state,
      quanta: state.quanta - cost + payout,
      eventCounter: eventId,
      lastEnhanceEvent: { id: eventId, entityId: owned.entityId, outcome: 'up', level: level + 1, payout },
      inventory: state.inventory.map((e) =>
        e.entityId === owned.entityId
          ? { ...e, level: e.level + 1, invested: (e.invested ?? 0) + cost }
          : e,
      ),
    });
  }

  // ── Risk phase (Lv ≥ 3, #47): MATTER-only base cost, can fail. 강화석 is spent
  //    ONLY to 보호(protect). A failed unprotected attempt destroys one copy and
  //    mints random 강화석 (no level-down). ──
  const protect = action.protect === true;
  const matterCost = getEnhanceCost(entity, level, stageId);
  const protectCost = protect ? getEnhanceProtectStoneCost(entity, level) : 0;
  // Need matter for the attempt, and stones only if protecting.
  if (state.quanta < matterCost || state.enhanceStones < protectCost) return state;

  const failChance = getEnhanceFailChance(level);
  const succeeded = (action.failRoll ?? 1) >= failChance;

  // ── Success: matter-only cost, level up, small matter payback. ──
  if (succeeded) {
    const payout = Math.ceil(matterCost * ENHANCE_MATTER_PAYOUT_SUCCESS);
    return withCurrentUniverseEndingProgress({
      ...state,
      quanta: state.quanta - matterCost + payout,
      enhanceStones: state.enhanceStones - protectCost, // 0 unless protecting
      eventCounter: eventId,
      lastEnhanceEvent: { id: eventId, entityId: owned.entityId, outcome: 'up', level: level + 1, payout },
      inventory: state.inventory.map((e) =>
        e.entityId === owned.entityId ? { ...e, level: e.level + 1, invested: (e.invested ?? 0) + matterCost } : e,
      ),
    });
  }

  // ── Failed + 보호: loss negated. Protect stones spent, matter spent (consolation payout). ──
  if (protect) {
    const payout = Math.ceil(matterCost * ENHANCE_MATTER_PAYOUT_FAIL);
    return withCurrentUniverseEndingProgress({
      ...state,
      quanta: state.quanta - matterCost + payout,
      enhanceStones: Math.max(0, state.enhanceStones - protectCost),
      eventCounter: eventId,
      lastEnhanceEvent: { id: eventId, entityId: owned.entityId, outcome: 'protected', level, payout },
    });
  }

  // ── Failed unprotected: DESTROY one copy + mint random 강화석. No matter charged
  //    (the lost item IS the cost); the card shows only the 강화석 gained. ──
  const stonesEarned = getEnhanceBreakStoneReward(entity, action.stoneRoll ?? 0.5);
  let nextInventory = state.inventory.map((e) =>
    e.entityId === owned.entityId
      ? { ...e, count: e.count - 1, level: e.count - 1 <= 0 ? e.level : 1, investedStones: 0 }
      : e,
  );
  let nextState: GameState = { ...state, enhanceStones: state.enhanceStones + stonesEarned };
  if ((nextInventory.find((e) => e.entityId === owned.entityId)?.count ?? 0) <= 0) {
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
    lastEnhanceEvent: { id: eventId, entityId: owned.entityId, outcome: 'break', level, stonesEarned },
  }));
}
