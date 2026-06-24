import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties, Dispatch } from 'react';
import { TUNING } from '../game/constants';
import {
  formatAutoRateValue,
  formatEntropyAmount,
  formatEntropyParts,
  formatEntropyPair,
  formatGameNumberShort,
  formatWhole,
  canCondense as canCondenseNow,
  getAutoRate,
  getClickPower,
  getComboCapMult,
  getCritChance,
  getCritMultiplier,
  getEffectiveThreshold,
  getEntropyGateProgress,
  getEntropyOnCondense,
  getTimeGaugeForCosmicClock,
  getProgress,
  getTimeMultiplier,
} from '../game/formulas';
import { getActiveModifiers } from '../game/skills/effects';
import { getEquippedInstances, getClaimableCodexSubsetIds } from '../game/entities/effects';
import { getComboCapBonus } from '../game/reducers/helpers';
import { getMechanic } from '../game/mechanics';
import type { GameAction } from '../game/reducer';
import { STAGES } from '../game/stages';
import {
  getActiveShopBoostMultiplier,
  getOfflineRewardCapSec,
  isCashShopUnlocked,
} from '../game/shop/boosts';
import { EQUIP_UNLOCK_STAGE_ID, FUSION_UNLOCK_STAGE_ID, SHOP_UNLOCK_STAGE_ID } from '../game/balance';
import { getEntitiesForStage, getPurchasedEntityCount, findEntityById, entityName } from '../game/entities/stageItems';
import { getParticleDefinitionLabel, getParticleNameLabel } from '../game/particles';
import type { SoundManager } from '../game/audio';
import type { EndingId, GameState } from '../game/types';
import { FloatingNumber } from './FloatingNumber';
import { ComboMeter } from './ComboMeter';
import { ParticleField, type ParticleFieldHandle } from './ParticleField';
import { QuoteOverlay } from './QuoteOverlay';
import { ScaleIndicator } from './ScaleIndicator';
import { SpeechBubble } from './SpeechBubble';
import { selectTutorialStep, type TutorialStepCtx } from './tutorialSteps';
import { ShopButton, ShopPanel } from './ShopPanel';
import { ActiveBoostHud } from './ActiveBoostHud';
import { EntityPanel } from './EntityPanel';
import { useGameLoop } from '../hooks/useGameLoop';
import { OfflineProgressModal } from './OfflineProgressModal';
import { EndingChooser } from './EndingChooser';
import { EndingCredits } from './endings/EndingCredits';
import { applyUniverseToStage, getEndingOptions } from '../game/multiverse';
import { AlmanacOverlay } from './AlmanacOverlay';
import { QuestPanel } from './QuestPanel';
import { QuestClaimRollup } from './QuestClaimRollup';
import { isQuestClaimable, getQuest, questTitle } from '../game/quests';
import { milestoneEraLog } from '../game/milestones';
import { pickLogText } from '../game/stageLogs';
import { SettingsPanel } from './SettingsPanel';
import { t, stageName, type StringKey } from '../i18n';
import { getRogueNameLabel } from '../canvas/stageSprites';
import { getPrestigeMultiplier, PRESTIGE_UPGRADES, type PrestigeUpgradeId } from '../game/prestige';
import { useBoostNotifications } from '../hooks/useBoostNotifications';
import { getChapterForStage, getChapterTrackUrls } from '../game/musicChapters';
import { useAudioUnlockOnPointer } from '../hooks/useAudioUnlockOnPointer';
import { useSaveErrorToast } from '../hooks/useSaveErrorToast';
import { vibrateCollision } from '../game/haptics';

interface FloatingEntry {
  id: number;
  x: number;
  y: number;
  text: string;
  particleName?: string;
  particleDefinition?: string;
  entropyGained?: number;
  variant: 'normal' | 'crit' | 'collision' | 'auto';
  delayMs?: number;
}

interface ComboDisplay {
  combo: number;
  mult: number;
  /** Click event id driving the per-hit pulse. */
  pulseId: number;
  /** True on the click that bumped the multiplier to a higher step. */
  levelUp: boolean;
  /** True while the meter is fading out after the combo lapses. */
  fading: boolean;
}

interface TutorialBubble {
  flagId: string;
  anchor: 'entity' | 'equip' | 'fuse' | 'shop' | 'resource' | 'boost' | 'field' | 'focus' | 'quest';
  message: string;
  ctaLabel?: string;
  onCta?: () => void;
  autoCloseMs?: number;
}

type TransitionPhase = 'idle' | 'bursting' | 'quote' | 'revealing';

function formatFloatingGain(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '0';
  }
  if (value < 10 && !Number.isInteger(value)) {
    const rounded = value < 2 ? value.toFixed(2) : value.toFixed(1);
    return rounded.replace(/\.0+$/, '').replace(/(\.\d)0$/, '$1');
  }
  return formatWhole(value);
}

interface GameScreenProps {
  state: GameState;
  dispatch: Dispatch<GameAction>;
  soundManager: SoundManager | null;
  sfxMuted: boolean;
  musicMuted: boolean;
  musicVolume: number;
  language: 'en' | 'ko';
  onToggleSfx: () => void;
  onToggleMusic: () => void;
  onSetMusicVolume: (v: number) => void;
  onToggleLanguage: () => void;
  onRequestReset: () => void;
  onForceReset?: () => void;
  onOpenLeaderboard?: () => void;
}

function EndingCinematic({
  endingId,
  language,
  onComplete,
  soundManager,
}: {
  endingId: EndingId | null;
  language: 'en' | 'ko';
  onComplete: () => void;
  soundManager: SoundManager | null;
}) {
  return endingId === null ? null : (
    <EndingCredits endingId={endingId} language={language} onComplete={onComplete} soundManager={soundManager} />
  );
}

export function GameScreen({
  state,
  dispatch,
  soundManager,
  sfxMuted,
  musicMuted,
  musicVolume,
  language,
  onToggleSfx,
  onToggleMusic,
  onSetMusicVolume,
  onToggleLanguage,
  onRequestReset,
  onForceReset,
  onOpenLeaderboard,
}: GameScreenProps) {
  const [shopOpen, setShopOpen] = useState(false);
  const [panelView, setPanelView] = useState<null | { page: 'lab' | 'equip' | 'fuse'; category: 'click' | 'rift' }>(null);
  const entityPanelOpen = panelView !== null;
  const [almanacOpen, setAlmanacOpen] = useState(false);
  const [questOpen, setQuestOpen] = useState(false);
  // 🅠5: badge the quest button when any active quest is claimable.
  const claimableQuestIds = state.activeQuests.filter((id) => {
    const q = getQuest(id);
    return q ? isQuestClaimable(q, state) : false;
  });
  const hasClaimableQuest = claimableQuestIds.length > 0;
  const questMilestoneSeen = Boolean(state.tutorialFlags['quest-milestone-intro']);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [viewingStageId, setViewingStageId] = useState<number | null>(null);
  const entityAnchorRef = useRef<HTMLButtonElement | null>(null);
  const equipAnchorRef = useRef<HTMLButtonElement | null>(null);
  const fuseAnchorRef = useRef<HTMLButtonElement | null>(null);
  const questAnchorRef = useRef<HTMLButtonElement | null>(null);
  // Quest-milestone notification toast (fires when a quest's condition is met).
  const [questToast, setQuestToast] = useState<{ id: string; title: string } | null>(null);
  const prevClaimableRef = useRef<Set<string>>(new Set());
  const questToastTimerRef = useRef<number | null>(null);
  const shopAnchorRef = useRef<HTMLDivElement | null>(null);
  const resourceAnchorRef = useRef<HTMLDivElement | null>(null);
  const infoAnchorRef = useRef<HTMLButtonElement | null>(null);
  const boostAnchorRef = useRef<HTMLDivElement | null>(null);
  const fieldCenterAnchorRef = useRef<HTMLSpanElement | null>(null);
  const wallNow = Date.now();
  const rawStage = STAGES[state.stageIdx];
  // Display stage can be overridden when browsing past stages in Entity Lab
  const displayRawStage = viewingStageId !== null
    ? (STAGES.find((s) => s.id === viewingStageId) ?? rawStage)
    : rawStage;
  const stage = useMemo(
    () => applyUniverseToStage(rawStage, state.currentUniverseSeed),
    [rawStage, state.currentUniverseSeed],
  );
  const displayStage = useMemo(
    () => applyUniverseToStage(displayRawStage, state.currentUniverseSeed),
    [displayRawStage, state.currentUniverseSeed],
  );
  const isViewingPastStage = displayStage.id < stage.id;
  const mechanic = getMechanic(stage.mechanic);
  const effectiveThreshold = getEffectiveThreshold(stage, state.cumulativeBoost);
  const progress01 = getProgress(state.quanta, effectiveThreshold);
  const displayEffectiveThreshold = isViewingPastStage
    ? getEffectiveThreshold(displayStage, state.cumulativeBoost)
    : effectiveThreshold;
  const displayQuanta = state.quanta;
  const modifiers = getActiveModifiers({
    currentQuanta: state.quanta,
    stagesCleared: state.stageIdx,
    secondsInStage: Math.max(0, (wallNow - state.stageStartedAt) / 1000),
    stageId: stage.id,
    gateProgress01: getEntropyGateProgress(state.entropy, state.stageIdx),
    progress01,
  }, getEquippedInstances(state.inventory, [...state.equippedSlots, ...state.riftSlots]), state.prestigeUpgrades, state.almanacCollected, state.claimedCodexSubsetIds);
  const autoRate = getAutoRate(modifiers);
  const stageAutoBonus =
    stage.mechanic === 'reionization'
      ? autoRate * state.mechanicCharge * 0.5
      : stage.mechanic === 'first_stars'
        ? autoRate * Math.min(1.5, state.mechanicCharge * 0.12)
        : 0;
  const shopTimeBoost = getActiveShopBoostMultiplier(state.shopBoosts, 'time', wallNow);
  const shopMatterBoost = getActiveShopBoostMultiplier(state.shopBoosts, 'matter', wallNow);
  // Include autoMatterMult (hex-bingo, ≤6×) so the HUD + equip "오토 속도" match the REAL
  // credited income (gameplay.ts perSecAuto also ×autoMatterMult). Was omitted → the equip
  // readout under-reported by up to 6× vs the floating "+N/s" (user "오토 90.9 stuck/안 맞음").
  const displayedAutoRate = (autoRate + stageAutoBonus) * shopTimeBoost * shopMatterBoost * modifiers.autoMatterMult;
  const timeMult = getTimeMultiplier(modifiers) * shopTimeBoost;
  const entropyGateProgress01 = getEntropyGateProgress(state.entropy, state.stageIdx);
  const clickEmissionCount =
    modifiers.clickEmissionCount * (state.currentUniverseSeed.anomaly === 'echoing' ? 2 : 1);
  const maxComboMult = getComboCapMult(getComboCapBonus(state) + modifiers.comboCapAdd);
  const entropyPreview = getEntropyOnCondense(state.quanta, effectiveThreshold);
  const endingOptions = getEndingOptions(state, wallNow, language);
  const [endingChooserDismissed, setEndingChooserDismissed] = useState(false);
  const canChooseEnding =
    state.completedRun &&
    state.selectedEndingId === null &&
    state.lastEndingId === null &&
    !endingChooserDismissed;
  const canCondense = canCondenseNow(state);
  const condenseHint = t(language, 'hudEntropyGateHint');
  const [transitionPhase, setTransitionPhase] = useState<TransitionPhase>('idle');
  const [revealStartedAt, setRevealStartedAt] = useState<number | null>(null);
  const interactionLocked =
    state.pendingCondenseStageIdx !== null ||
    state.imploding ||
    transitionPhase === 'bursting' ||
    state.selectedEndingId !== null ||
    canChooseEnding;
  useBoostNotifications(state.shopBoosts, language);
  const [floatingEntries, setFloatingEntries] = useState<FloatingEntry[]>([]);
  const [comboDisplay, setComboDisplay] = useState<ComboDisplay | null>(null);
  const comboTimersRef = useRef<number[]>([]);
  const lastComboMultRef = useRef(1);
  const [shakeClass, setShakeClass] = useState('');
  const saveErrorVisible = useSaveErrorToast();
  useAudioUnlockOnPointer(soundManager);
  const logicAccumulator = useRef(0);
  const particleFieldRef = useRef<ParticleFieldHandle>(null);
  const fieldRef = useRef<HTMLElement | null>(null);
  const civPlayed = useRef(false);
  const lastToastStageIdRef = useRef(stage.id);
  void lastToastStageIdRef; // suppress unused-variable lint
  const entropyPreviewReadout = formatEntropyParts(entropyPreview);
  const canShowShop = isCashShopUnlocked(state);
  // 🅠7: staged onboarding — equip/auto + fusion unlock at S2 (codex/quests are S1).
  const equipUnlocked = stage.id >= EQUIP_UNLOCK_STAGE_ID;
  const fusionUnlocked = stage.id >= FUSION_UNLOCK_STAGE_ID;
  const hasActiveBoost = state.shopBoosts.some((b) => b.expiresAt > wallNow);
  const hasShopNotification = canShowShop && !state.hasSeenCashShopTutorial;
  const displayStageLabel = stageName(language, displayStage.id, displayStage.name);
  const displayStageNumber = String(displayStage.id).padStart(2, '0');
  // #42-fix: notification dots on 장착/융합 when NEW items arrived since the panel
  // was last opened (drops/fusion outputs you haven't checked/equipped). Refs
  // record the inventory size at last open; the dot clears when you go in.
  const invTotal = state.inventory.reduce((sum, e) => sum + Math.max(0, e.count), 0);
  const equipSeenInvRef = useRef(invTotal);
  const fuseSeenInvRef = useRef(invTotal);
  // While the matching panel page is OPEN, keep its seen-baseline tracking live
  // inventory growth — so items that arrive WHILE the player is in there (e.g. the
  // guaranteed S2 fusions handed to them) don't relight the dot the moment they
  // leave. Without this the dot re-triggered right after equipping ("클릭하고 돌아오면
  // 다시 알람"), because invTotal had grown past the stale open-time baseline.
  if (panelView?.page === 'equip') equipSeenInvRef.current = invTotal;
  if (panelView?.page === 'fuse' || panelView?.page === 'lab') fuseSeenInvRef.current = invTotal;
  const equipHasNew = equipUnlocked && invTotal > equipSeenInvRef.current;
  const fuseHasNew = fusionUnlocked && invTotal > fuseSeenInvRef.current;
  // v28: a complete-but-unclaimed codex subset → pulse the 도감 button (alarm to claim).
  const codexHasClaimable = getClaimableCodexSubsetIds(state.almanacCollected, state.claimedCodexSubsetIds).length > 0;
  const openEntityPanel = (page: 'lab' | 'equip' | 'fuse' = 'lab', category: 'click' | 'rift' = 'click') => {
    if (page === 'equip') equipSeenInvRef.current = invTotal;
    if (page === 'fuse' || page === 'lab') fuseSeenInvRef.current = invTotal;
    setViewingStageId(null);
    setPanelView({ page, category });
    soundManager?.playUIOpen();
  };
  const currentStageEntities = useMemo(() => getEntitiesForStage(stage.id), [stage.id]);
  const ownedCurrentStageEntityCount = currentStageEntities.reduce((sum, entity) => {
    return sum + getPurchasedEntityCount(state.inventory, entity);
  }, 0);
  const showEndingButton = state.completedRun && state.lastEndingId === null && endingChooserDismissed;
  const showCondenseGate = isViewingPastStage || canCondense || showEndingButton;
  // C-P0 a11y: a polite live-region message. Recomputed every render but the same
  // string never re-announces — so it speaks only on discrete transitions (stage
  // entry, condense becomes available), never per-frame spam.
  const srAnnouncement = useMemo(() => {
    const stageLine = t(language, 'srStageEntered')
      .replace('{n}', String(displayStage.id))
      .replace('{name}', displayStageLabel);
    return canCondense ? `${stageLine}. ${t(language, 'srReadyToCondense')}` : stageLine;
  }, [language, displayStage.id, displayStageLabel, canCondense]);
  const activeTutorialBubble = useMemo<TutorialBubble | null>(() => {
    // C-P2: selection extracted to ./tutorialSteps (pure + unit-tested). Build the
    // context, pick the first eligible-and-unseen step, then resolve strings + onCta
    // here (the closures stay in the component). Behavior is preserved exactly.
    const ctx: TutorialStepCtx = {
      stageId: stage.id,
      universeCount: state.universeCount,
      entityPanelOpen,
      questOpen,
      shopOpen,
      settingsOpen,
      totalClicks: state.totalClicks,
      equipUnlocked,
      ownedCurrentStageEntityCount,
      hasClaimableQuest,
      canShowShop,
      hasActiveBoost,
      canCondense,
      almanacOpen,
      hasSeenCashShopTutorial: state.hasSeenCashShopTutorial,
      flags: state.tutorialFlags,
    };
    const step = selectTutorialStep(ctx);
    if (!step) return null;
    let onCta: (() => void) | undefined;
    switch (step.ctaAction) {
      case 'quest': onCta = () => { setQuestOpen(true); soundManager?.playUIOpen(); }; break;
      case 'entityEquip': onCta = () => openEntityPanel('equip', 'click'); break;
      case 'shop': onCta = () => { setShopOpen(true); soundManager?.playUIOpen(); }; break;
      case 'almanac': onCta = () => { setAlmanacOpen(true); soundManager?.playUIOpen(); }; break;
      default: onCta = undefined;
    }
    return {
      flagId: step.flagId,
      anchor: step.resolveAnchor ? step.resolveAnchor(ctx) : step.anchor,
      message: t(language, (step.resolveMessageKey ? step.resolveMessageKey(ctx) : step.messageKey) as StringKey),
      ctaLabel: step.ctaKey ? t(language, step.ctaKey as StringKey) : undefined,
      onCta,
      autoCloseMs: step.resolveAutoCloseMs ? step.resolveAutoCloseMs(ctx) : step.autoCloseMs,
    };
  }, [
    canCondense,
    canShowShop,
    equipUnlocked,
    hasClaimableQuest,
    entityPanelOpen,
    hasActiveBoost,
    language,
    ownedCurrentStageEntityCount,
    stage.id,
    state.shopBoosts,
    state.hasSeenCashShopTutorial,
    state.totalClicks,
    state.tutorialFlags,
    state.universeCount,
    almanacOpen,
    questOpen,
    shopOpen,
    settingsOpen,
  ]);


  useGameLoop((now, dt) => {
    logicAccumulator.current += dt;
    while (logicAccumulator.current >= TUNING.LOGIC_TICK_MS) {
      dispatch({ type: 'TICK', now: Date.now(), dt: TUNING.LOGIC_TICK_MS });
      logicAccumulator.current -= TUNING.LOGIC_TICK_MS;
    }
    // Drive ParticleField's render in the same frame — single rAF for the app.
    particleFieldRef.current?.tick(now, dt);
  });

  // Per-stage music: lazy-load the stage's track pool, cross-fade rotation.
  // Safe-fails when the file is absent — stage just stays silent.
  useEffect(() => {
    if (!soundManager) return;
    const chapter = getChapterForStage(displayStage.id);
    void soundManager.loadAndPlayChapterPool(chapter, getChapterTrackUrls(chapter));
  }, [soundManager, displayStage.id]);

  // Prefetch the *next* stage's music during idle time so the transition
  // doesn't stall on fetch+decode. We use requestIdleCallback when available
  // (most browsers) and fall back to setTimeout. Cancelled on unmount/change
  // so we never prefetch a stage the user already left.
  useEffect(() => {
    if (!soundManager) return;
    const nextStageId = displayStage.id + 1;
    if (nextStageId > STAGES.length) return; // already on the last stage

    const ric = (window as typeof window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    });
    let handle: number | null = null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    const run = () => {
      const chapter = getChapterForStage(nextStageId);
      void soundManager.prefetchChapter(chapter, getChapterTrackUrls(chapter));
    };
    if (typeof ric.requestIdleCallback === 'function') {
      handle = ric.requestIdleCallback(run, { timeout: 4000 });
    } else {
      timeoutHandle = setTimeout(run, 2000);
    }
    return () => {
      if (handle !== null && typeof ric.cancelIdleCallback === 'function') {
        ric.cancelIdleCallback(handle);
      }
      if (timeoutHandle !== null) clearTimeout(timeoutHandle);
    };
  }, [soundManager, displayStage.id]);

  useEffect(() => {
    if (stage.mechanic === 'life_evolution' && progress01 >= 0.99 && !civPlayed.current) {
      civPlayed.current = true;
      soundManager?.playCivilizationFlicker();
    }
    if (stage.mechanic !== 'life_evolution' || progress01 < 0.99) {
      civPlayed.current = false;
    }
  }, [progress01, soundManager, stage.mechanic]);

  const clickSeqRef = useRef(0);
  const clickSeqResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Phase 6 cleanup: ensure the click-sequence reset timer is released on unmount.
  // The handler-side already clears the previous timeout before setting a new one,
  // but if the component unmounts while a timer is pending, the callback would
  // mutate a ref on a torn-down component.
  useEffect(() => {
    return () => {
      if (clickSeqResetRef.current) {
        clearTimeout(clickSeqResetRef.current);
        clickSeqResetRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!state.lastClickEvent) {
      return undefined;
    }
    const event = state.lastClickEvent;
    const emissionCount = Math.max(1, clickEmissionCount);
    const gainedLabel = formatFloatingGain(event.gained);
    const particleName = getParticleNameLabel(event.particleName, language);
    const particleDefinition = getParticleDefinitionLabel(event.particleName, language);
    const text = event.isCrit
      ? `${language === 'ko' ? '치명타' : 'CRIT'} ${gainedLabel}`
      : gainedLabel;

    setFloatingEntries((current) => [
      ...current.slice(-TUNING.MAX_FLOATING_NUMBERS + emissionCount),
      ...Array.from({ length: emissionCount }, (_, index) => {
        const angle = (index / emissionCount) * Math.PI * 2 + Math.random() * 0.3;
        const radius = emissionCount > 1 ? index * 4 : 0;
        const variant: FloatingEntry['variant'] = event.isCrit ? 'crit' : 'normal';
        return {
          id: event.id * 100 + index,
          x: event.x + Math.cos(angle) * radius,
          y: event.y + Math.sin(angle) * radius - index * 6,
          text,
          particleName,
          particleDefinition,
          entropyGained: undefined,
          variant,
          delayMs: index * 60,
        };
      }),
    ]);

    // ── Combo meter feedback ──
    // event.combo === 1 marks a fresh combo (or an isolated click); only show
    // the meter once a streak is actually building.
    if (event.combo >= 2) {
      const leveledUp = event.comboMult > lastComboMultRef.current;
      setComboDisplay({
        combo: event.combo,
        mult: event.comboMult,
        pulseId: event.id,
        levelUp: leveledUp,
        fading: false,
      });
      comboTimersRef.current.forEach(window.clearTimeout);
      comboTimersRef.current = [];
      // Fade, then unmount, once clicking lapses past the combo window.
      const fadeTimer = window.setTimeout(() => {
        setComboDisplay((current) => (current ? { ...current, fading: true } : null));
        const removeTimer = window.setTimeout(() => setComboDisplay(null), 350);
        comboTimersRef.current.push(removeTimer);
      }, TUNING.COMBO_CLEAR_MS);
      comboTimersRef.current.push(fadeTimer);
    } else {
      comboTimersRef.current.forEach(window.clearTimeout);
      comboTimersRef.current = [];
      setComboDisplay(null);
    }
    lastComboMultRef.current = event.comboMult;

    soundManager?.playClick(state.stageIdx, event.isCrit);
    dispatch({ type: 'CLEAR_CLICK_EVENT', id: event.id });
    const timeoutId = window.setTimeout(() => {
      setFloatingEntries((current) => current.filter((entry) => Math.floor(entry.id / 100) !== event.id));
    }, event.isCrit ? TUNING.FLOAT_CRIT_MS : TUNING.FLOAT_NORMAL_MS);
    return () => window.clearTimeout(timeoutId);
  }, [clickEmissionCount, dispatch, language, soundManager, state.lastClickEvent, state.stageIdx]);

  // Drop any pending combo-meter timers on unmount.
  useEffect(() => () => { comboTimersRef.current.forEach(window.clearTimeout); }, []);

  useEffect(() => {
    if (!state.lastCollisionEvent) {
      return undefined;
    }
    const event = state.lastCollisionEvent;
    const rogueName = getRogueNameLabel(event.name, language);
    const rogueText = language === 'ko' ? rogueName : rogueName.toUpperCase();
    setFloatingEntries((current) => [
      ...current,
      {
        id: event.id,
        x: event.x,
        y: event.y,
        text: `+${formatWhole(event.bonus)} · ${rogueText}`,
        entropyGained: event.entropyGained,
        variant: 'collision',
      },
    ]);
    setShakeClass(event.tier === 'massive' ? 'shake-big' : 'shake');
    soundManager?.playCollision(event.tier);
    vibrateCollision(event.tier);
    dispatch({ type: 'CLEAR_COLLISION_EVENT', id: event.id });
    const floatTimeoutId = window.setTimeout(() => {
      setFloatingEntries((current) => current.filter((entry) => entry.id !== event.id));
    }, TUNING.FLOAT_COLLISION_MS);
    const shakeTimeoutId = window.setTimeout(() => {
      setShakeClass('');
    }, event.tier === 'massive' ? TUNING.SHAKE_BIG_MS : TUNING.SHAKE_SMALL_MS);
    return () => {
      window.clearTimeout(floatTimeoutId);
      window.clearTimeout(shakeTimeoutId);
    };
  }, [dispatch, language, soundManager, state.lastCollisionEvent]);

  // 🅠3: passive auto-income floating text — "+N/s · <entity>" rising from the
  // rift (bottom-left). Emitted ~1/sec by handleTick; transient (no CLEAR needed,
  // the throttle in the reducer controls re-emission).
  useEffect(() => {
    if (!state.lastAutoIncomeEvent) {
      return undefined;
    }
    const event = state.lastAutoIncomeEvent;
    const entity = findEntityById(event.entityId);
    const name = entity ? entityName(entity, language) : '';
    const text = `+${formatFloatingGain(event.gained)}/s${name ? ` · ${name}` : ''}`;
    const height = fieldRef.current?.clientHeight ?? 600;
    // Anchor the float just above the bottom-left crack (rx≈46, ry≈height-84)
    // so auto income reads as flowing from the rift, not floating far above it.
    const x = 46 + (Math.random() - 0.5) * 18;
    const y = (height - 84) + 40 - Math.random() * 10;
    setFloatingEntries((current) => [
      ...current.slice(-TUNING.MAX_FLOATING_NUMBERS + 1),
      { id: event.id, x, y, text, variant: 'auto' },
    ]);
    const timeoutId = window.setTimeout(() => {
      setFloatingEntries((current) => current.filter((entry) => entry.id !== event.id));
    }, TUNING.FLOAT_AUTO_MS);
    return () => window.clearTimeout(timeoutId);
  }, [language, state.lastAutoIncomeEvent]);

  // Quest milestone reached: when a quest newly meets its condition, pop a toast
  // ("Milestone! Tap ✦ to claim"). The very FIRST time is handled by the
  // one-shot tutorial bubble instead, so we don't double-notify.
  const claimableKey = claimableQuestIds.join(',');
  useEffect(() => {
    const prev = prevClaimableRef.current;
    const newlyReady = claimableQuestIds.find((id) => !prev.has(id));
    prevClaimableRef.current = new Set(claimableQuestIds);
    if (newlyReady && questMilestoneSeen) {
      const q = getQuest(newlyReady);
      if (q) {
        setQuestToast({ id: newlyReady, title: questTitle(q, language) });
        soundManager?.playUIOpen(); // #42-fix: the (single, bottom) alarm chimes on appear
        // The era-record alarm replaces the old progress-based lore toast, so mark
        // milestone-seen here to keep the info-hint tutorial chain alive.
        if (!state.tutorialFlags['milestone-seen']) dispatch({ type: 'MARK_TUTORIAL_FLAG', flagId: 'milestone-seen' });
        if (questToastTimerRef.current) window.clearTimeout(questToastTimerRef.current);
        questToastTimerRef.current = window.setTimeout(() => setQuestToast(null), 5200);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimableKey, questMilestoneSeen, language]);

  useEffect(() => () => { if (questToastTimerRef.current) window.clearTimeout(questToastTimerRef.current); }, []);

  useEffect(() => {
    if (state.lastEncounterEvent) {
      dispatch({ type: 'CLEAR_ENCOUNTER_EVENT', id: state.lastEncounterEvent.id });
    }
  }, [dispatch, state.lastEncounterEvent]);

  useEffect(() => {
    if (state.pendingCondenseStageIdx === null) {
      if (transitionPhase !== 'revealing') {
        setTransitionPhase('idle');
      }
    }
  }, [state.pendingCondenseStageIdx, transitionPhase]);

  useEffect(() => {
    if (
      state.pendingCondenseStageIdx === null ||
      state.imploding ||
      transitionPhase !== 'idle'
    ) {
      return;
    }
    // Last stage: skip transition, go straight to ending
    if (state.stageIdx >= STAGES.length - 1) {
      dispatch({ type: 'ADVANCE_STAGE', now: Date.now() });
      return;
    }
    setTransitionPhase('bursting');
    // Play the grand stage-advance impact at the moment of birth (right when
    // the implosion ends and the new stage starts to bloom).
    soundManager?.playStageAdvanceImpact(state.stageIdx + 1);
    // The new cinematic transition system applies its own shake/scale/filter on
    // .app-shell.transitioning--<style>. We intentionally leave shakeClass empty
    // so it doesn't fight the cinematic transform animations.
    setShakeClass('');
  }, [dispatch, soundManager, state.imploding, state.pendingCondenseStageIdx, state.stageIdx, transitionPhase]);

  useEffect(() => {
    if (transitionPhase !== 'bursting') {
      return;
    }
    const quoteTimeoutId = window.setTimeout(() => {
      setTransitionPhase('quote');
      setShakeClass('');
    }, TUNING.STAGE_TRANSITION_QUOTE_DELAY_MS);
    return () => {
      window.clearTimeout(quoteTimeoutId);
    };
  }, [transitionPhase]);

  useEffect(() => {
    if (transitionPhase !== 'revealing') {
      return;
    }
    const revealTimeoutId = window.setTimeout(() => {
      setTransitionPhase('idle');
      setRevealStartedAt(null);
    }, TUNING.STAGE_TRANSITION_REVEAL_MS);
    return () => {
      window.clearTimeout(revealTimeoutId);
    };
  }, [transitionPhase]);

  // While bursting we want classes keyed to the CURRENT stage (the one being left).
  // While revealing, key to the NEW stage (the one we just entered).
  const exitStyle = stage.transitionStyle ?? 'condense';
  const enterStyle = displayStage.transitionStyle ?? 'condense';
  const transitionClass =
    transitionPhase === 'bursting' ? `transitioning transitioning--${exitStyle}` :
    transitionPhase === 'revealing' ? `revealing revealing--${enterStyle}` :
    '';

  return (
    <div
      className={`app-shell ${shakeClass} ${transitionPhase === 'revealing' ? 'stage-revealing' : ''} ${transitionClass}`}
      style={{ '--accent': displayStage.accent, '--core': displayStage.coreColor } as CSSProperties}
    >
      {/* C-P0 a11y: announces stage entry + condense-ready to assistive tech. */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{srAnnouncement}</div>
      {saveErrorVisible ? (
        <div className="save-error-toast" role="alert">
          {t(language, 'saveFailedQuota')}
        </div>
      ) : null}
      <main className="field" ref={fieldRef}>
        <span className="field-center-tutorial-anchor" ref={fieldCenterAnchorRef} aria-hidden="true" />
        {import.meta.env.DEV ? (
          <div className="admin-panel">
            <button
              className="mini-button admin-button"
              type="button"
              onClick={() => dispatch({ type: 'ADMIN_RESTART_RUN', now: Date.now() })}
            >
              RESTART
            </button>
            <button
              className="mini-button admin-button"
              type="button"
              onClick={() => dispatch({ type: 'ADMIN_PREV_STAGE', now: Date.now() })}
            >
              ◀ PREV
            </button>
            <button
              className="mini-button admin-button"
              type="button"
              onClick={() => dispatch({ type: 'ADMIN_NEXT_STAGE', now: Date.now() })}
            >
              NEXT ▶
            </button>
            {([0, 1.0] as const).map((pct) => (
              <button
                key={pct}
                className="mini-button admin-button"
                type="button"
                onClick={() => dispatch({ type: 'ADMIN_SET_PROGRESS', fraction: pct, now: Date.now() })}
              >
                {`${pct * 100}%`}
              </button>
            ))}
            <button
              className="mini-button admin-button"
              type="button"
              onClick={() => dispatch({ type: 'ADMIN_MAX_ENTITIES' })}
            >
              MAX ENT
            </button>
          </div>
        ) : null}
        <ParticleField
          ref={particleFieldRef}
          stage={displayStage}
          actualStageId={displayStage.id}
          quanta={displayQuanta}
          autoRate={displayedAutoRate}
          timeMult={timeMult}
          cosmicClockSec={isViewingPastStage ? displayStage.cosmicTimeSec : state.cosmicClockSec}
          effectiveThreshold={displayEffectiveThreshold}
          totalClicks={state.totalClicks}
          imploding={state.imploding}
          interactionLocked={interactionLocked}
          lastClickEvent={state.lastClickEvent}
          stageTransitionStartedAt={transitionPhase === 'revealing' ? revealStartedAt : null}
          clickEmissionCount={clickEmissionCount}
          clickVfxScale={modifiers.clickVfxScale}
          gravityMod={state.currentUniverseSeed.gravityMod}
          anomaly={state.currentUniverseSeed.anomaly}
          inventory={state.inventory}
          riftSlots={state.riftSlots}
          clickSlots={state.equippedSlots}
          riftPower={modifiers.autoFlatMult}
          onGatherClick={(x, y, forceCrit) => {
            const seq = clickSeqRef.current % 12;
            clickSeqRef.current += 1;
            if (clickSeqResetRef.current) clearTimeout(clickSeqResetRef.current);
            clickSeqResetRef.current = setTimeout(() => { clickSeqRef.current = 0; }, 1200);
            const spiralAngle = seq * 2.4 + Math.random() * 0.5;
            const spiralRadius = 14 + seq * 8;
            const ox = x + Math.cos(spiralAngle) * spiralRadius;
            const oy = y + Math.sin(spiralAngle) * spiralRadius;
            const mechanicResult = mechanic.onClick?.({
              state,
              stage,
              now: Date.now(),
              progress01,
              x: ox,
              y: oy,
            });
            dispatch({
              type: 'CLICK',
              now: Date.now(),
              randomValue: Math.random(),
              dropRoll: Math.random(),
              dropPickRoll: Math.random(),
              dropStageRoll: Math.random(),
              qualityRoll1: Math.random(),
              qualityRoll2: Math.random(),
              x: ox,
              y: oy,
              forceCrit: forceCrit || mechanicResult?.forceCrit,
              gainMultiplier: mechanicResult?.gainMultiplier,
              gainFlat: mechanicResult?.gainFlat,
              quantaDelta: mechanicResult?.quantaDelta,
              entropyDelta: mechanicResult?.entropyDelta,
              mechanicChargeDelta: mechanicResult?.mechanicChargeDelta,
              mechanicStep: mechanicResult?.mechanicStep,
              trigger: mechanicResult?.trigger,
            });
          }}
          onAbsorbComet={(payload) =>
            dispatch({
              type: 'ABSORB_COMET',
              x: payload.x,
              y: payload.y,
              bonus: payload.bonus,
              entropyBonus: payload.entropyBonus,
              tier: payload.tier,
              name: payload.name,
              dropRoll: Math.random(),
              dropPickRoll: Math.random(),
              dropStageRoll: Math.random(),
              qualityRoll1: Math.random(),
              qualityRoll2: Math.random(),
            })
          }
        />
        {shopOpen && canShowShop ? (
          <ShopPanel state={state} dispatch={dispatch} language={language} onClose={() => { setShopOpen(false); soundManager?.playUIClose(); }} onSfx={() => soundManager?.playEntityLevelUp()} />
        ) : null}
        {panelView ? (
          <EntityPanel
            page={panelView.page}
            equipCategory={panelView.category}
            currentStageId={stage.id}
            gateProgress01={entropyGateProgress01}
            inventory={state.inventory}
            equippedSlots={state.equippedSlots}
            unlockedSlotCount={state.unlockedSlotCount}
            riftSlots={state.riftSlots}
            unlockedRiftSlotCount={state.unlockedRiftSlotCount}
            wildSlot={state.wildSlot}
            lastFusionEvent={state.lastFusionEvent}
            almanacCollected={state.almanacCollected}
            codexSeenIds={state.codexSeenIds}
            seenPanelHints={state.seenPanelHints}
            quanta={state.quanta}
            enhanceStones={state.enhanceStones}
            lastEnhanceEvent={state.lastEnhanceEvent}
            stats={{
              // Show the explosive per-click matter (decoupled from entropy): the
              // tame base click power × the matter-only gear multiplier (#39).
              clickPower: getClickPower(modifiers) * modifiers.clickMatterMult + modifiers.clickMatterFlatAdd,
              autoRate: displayedAutoRate,
              critChance: getCritChance(0, modifiers),
              critMult: getCritMultiplier(modifiers),
              comboCapMult: maxComboMult,
              comboCapAdd: modifiers.comboCapAdd,
              offlineEff:
                (modifiers.hawkingEcho || state.singularityUnlocks.includes('hawking_echo')
                  ? 1
                  : TUNING.OFFLINE_BASE_RATE) * modifiers.offlineGainMult,
              offlineGainMult: modifiers.offlineGainMult,
              emissionIntervalMs: Math.min(2200, Math.max(240, 1500 / Math.log10(10 + displayedAutoRate))),
              entropyGainMult: modifiers.entropyGainMult,
              fusionBurstMult: modifiers.fusionBurstMult,
              dropChanceMult: modifiers.dropChanceMult,
              autoFlatMult: modifiers.autoFlatMult,
            }}
            language={language}
            onEquip={(entityId, slot) => { dispatch({ type: 'EQUIP_ENTITY', entityId, slot }); soundManager?.playUITap(); }}
            onEquipWild={(entityId) => { dispatch({ type: 'EQUIP_ENTITY', entityId, wild: true }); soundManager?.playUITap(); }}
            onUnequip={(slot, target) => { dispatch({ type: 'UNEQUIP_ENTITY', slot, target }); soundManager?.playUITap(); }}
            onEnhance={(id) => { dispatch({ type: 'ENHANCE_ENTITY', instanceId: id }); soundManager?.playEntityLevelUp(); }}
            onFuse={(inputEntityIds) => {
              dispatch({ type: 'FUSE_ENTITIES', inputEntityIds, rarityRoll: Math.random(), pickRoll: Math.random(), stageRoll: Math.random(), qualityRoll: Math.random() });
              soundManager?.playEntityLevelUp();
            }}
            onFuseBatch={(inputEntityIds) => {
              // 🅠4: one roll-set per trio the panel drew (3 copies each).
              const trioCount = Math.floor(inputEntityIds.length / 3);
              if (trioCount < 1) return;
              dispatch({
                type: 'FUSE_BATCH',
                inputEntityIds,
                rolls: Array.from({ length: trioCount }, () => ({
                  rarityRoll: Math.random(), pickRoll: Math.random(), stageRoll: Math.random(), qualityRoll: Math.random(),
                })),
              });
              soundManager?.playEntityLevelUp();
            }}
            onClearFusionEvent={(id) => dispatch({ type: 'CLEAR_FUSION_EVENT', id })}
            onClearEnhanceEvent={(id) => dispatch({ type: 'CLEAR_ENHANCE_EVENT', id })}
            favoriteEntityIds={state.favoriteEntityIds}
            onToggleFavorite={(entityId) => dispatch({ type: 'TOGGLE_FAVORITE', entityId })}
            claimedCodexSubsetIds={state.claimedCodexSubsetIds}
            onClaimCodexSubset={(subsetId) => { dispatch({ type: 'CLAIM_CODEX_SUBSET', subsetId }); soundManager?.playEntityLevelUp(); }}
            onMarkCodexSeen={() => dispatch({ type: 'MARK_CODEX_SEEN' })}
            onMarkPanelHint={(hintId) => dispatch({ type: 'MARK_PANEL_HINT', hintId })}
            onClose={() => {
              // #42-fix: clear any open fusion/enhance reveal so it doesn't "pop
              // back out" when the panel is reopened.
              if (state.lastFusionEvent) dispatch({ type: 'CLEAR_FUSION_EVENT', id: state.lastFusionEvent.id });
              if (state.lastEnhanceEvent) dispatch({ type: 'CLEAR_ENHANCE_EVENT', id: state.lastEnhanceEvent.id });
              setPanelView(null); soundManager?.playUIClose();
            }}
            onStageSelect={(id) => { setViewingStageId(id === stage.id ? null : id); soundManager?.playUITap(); }}
            onUITap={() => soundManager?.playUITap()}
          />
        ) : null}
        {viewingStageId !== null && !entityPanelOpen ? (
          <div className="viewing-stage-banner">
            <span className="viewing-stage-banner__dot" />
            {`${t(language, 'hudStage')} ${displayStage.id}: ${displayStageLabel}`}
            <button
              type="button"
              className="viewing-stage-banner__return"
              onClick={() => setViewingStageId(null)}
            >
              {t(language, 'returnCurrent')}
            </button>
          </div>
        ) : null}
        <div className="hud-info" ref={resourceAnchorRef}>
          <div className="hud-info-click-zone">
            <div className="hud-topline">
              <button
                type="button"
                ref={infoAnchorRef}
                className="hud-stage-chip"
                onClick={() => { setAlmanacOpen(true); soundManager?.playUIOpen(); dispatch({ type: 'MARK_TUTORIAL_FLAG', flagId: 'info-hint-seen' }); }}
                title={t(language, 'hudViewInfo')}
                aria-label={t(language, 'hudViewInfo')}
              >
                {displayStageNumber}
              </button>
              <div className="hud-stage-summary">
                <div className="hud-stage-title-line">
                  <button type="button" className="hud-stage-title hud-stage-title--clickable" onClick={() => { setAlmanacOpen(true); soundManager?.playUIOpen(); dispatch({ type: 'MARK_TUTORIAL_FLAG', flagId: 'info-hint-seen' }); }}>{displayStageLabel}</button>
                  <span className="hud-title-separator" aria-hidden="true">·</span>
                    <span className="hud-entropy-readout">
                      {/* Panel #7: matter is the most-watched number — give it the ⚛ glyph
                          (consistent with every other screen) + a bigger value, the plain
                          "물질" word had no glyph and the weakest hierarchy. */}
                      <span className="qsym hud-quanta-glyph" aria-label={t(language, 'hudQuanta')}>⚛</span>
                      <strong className="hud-quanta-value">{formatGameNumberShort(state.quanta)}</strong>
                      {displayedAutoRate > 0 && !isViewingPastStage ? (
                        <span className="hud-auto-rate">{`+${formatAutoRateValue(displayedAutoRate)}/s`}</span>
                      ) : null}
                      {/* F (user): track the 강화석 (◆) stash next to 물질 in the HUD. */}
                      <span className="hud-stones-readout">{`◆ ${formatGameNumberShort(state.enhanceStones)}`}</span>
                    </span>
                </div>
              </div>
            </div>
            {!showCondenseGate ? (
              <div className="hud-progress-stack">
                <div className="hud-meter hud-meter--entropy">
                  <div className="hud-meter-row">
                    <span className="hud-meter-label">
                      <span className="hud-meter-label-text">{t(language, 'hudEntropy')}</span>
                    </span>
                    <span className="hud-entropy-gate">
                      {formatEntropyPair(state.entropy, stage.entropyThreshold)}
                    </span>
                  </div>
                  <div className="hud-gauge hud-entropy-gauge" aria-label="Entropy gate">
                    <div className="hud-gauge-fill hud-entropy-gate-fill" style={{ width: `${Math.min(100, entropyGateProgress01 * 100)}%` }} />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          {showCondenseGate ? (
            <button
              type="button"
              className={`hud-condense ${isViewingPastStage ? 'hud-condense--completed' : ''}`}
              disabled={isViewingPastStage || (!canCondense && !showEndingButton)}
              title={
                isViewingPastStage
                  ? t(language, 'hudCondenseAlready')
                  : showEndingButton
                    ? (language === 'ko' ? '엔딩 선택' : 'Choose Ending')
                    : canCondense
                      ? `${t(language, 'hudCondenseFor')} ${formatEntropyAmount(entropyPreview)} ${t(language, 'hudEntropy').toLowerCase()}`
                      : condenseHint
              }
              onClick={() => {
                if (showEndingButton) {
                  setEndingChooserDismissed(false);
                } else if (!isViewingPastStage) {
                  dispatch({ type: 'START_CONDENSE', now: Date.now() });
                  dispatch({ type: 'MARK_TUTORIAL_FLAG', flagId: 'condense-ready' });
                }
              }}
            >
              <span>{isViewingPastStage ? t(language, 'hudCompleted') : showEndingButton ? (language === 'ko' ? '엔딩 선택' : 'CHOOSE ENDING') : ((language === 'ko' ? stage.condenseLabelKo : stage.condenseLabel) ?? t(language, 'hudCondense'))}</span>
              {!isViewingPastStage && !showEndingButton ? (
                <small className="entropy-inline">
                  <span>{`+${entropyPreviewReadout.value}`}</span>
                  <span className="hud-entropy-unit">{entropyPreviewReadout.unit}</span>
                  <span>{t(language, 'hudEntropy')}</span>
                </small>
              ) : null}
            </button>
          ) : null}
          {(() => {
            const pu = state.prestigeUpgrades;
            const prestigeActive = pu ? (Object.keys(pu) as PrestigeUpgradeId[]).filter((id) => (pu[id] ?? 0) > 0) : [];
            const hasBoosts = state.shopBoosts && state.shopBoosts.length > 0;
            if (prestigeActive.length === 0 && !hasBoosts) return null;
            return (
              <div className="hud-pips-row">
                <div className="hud-pips-left">
                  {prestigeActive.map((id) => {
                    const mult = getPrestigeMultiplier(pu![id] ?? 0);
                    const label = id === 'time_warp' ? 'N' : id === 'matter_forge' ? 'M' : id === 'critical_core' ? 'C' : id === 'auto_engine' ? 'A' : 'E';
                    return <span key={id} className={`prestige-pip prestige-pip--${id}`} title={PRESTIGE_UPGRADES.find((u) => u.id === id)?.name[language]}><span className="prestige-pip__label">{label}</span>{mult.toFixed(1)}</span>;
                  })}
                </div>
                <ActiveBoostHud ref={boostAnchorRef} boosts={state.shopBoosts} language={language} />
              </div>
            );
          })()}
        </div>
        {/* 🅠6 (req ⑦): right-side vertical rail — 도감·퀘스트·장착·융합소·상점 + settings. */}
        <div className="side-rail">
          <button
            ref={entityAnchorRef}
            type="button"
            className={`entity-lab-button ${codexHasClaimable ? 'entity-lab-button--notify' : ''}`}
            style={{ '--rail-accent': '#7ec8ff' } as React.CSSProperties}
            onClick={() => openEntityPanel('lab')}
            aria-label={t(language, 'collectionTitle')}
          >
            <span className="hud-action-icon" aria-hidden="true">📖</span>
            <span className="hud-action-label">{t(language, 'collectionTitle')}</span>
            {codexHasClaimable ? <span className="entity-lab-button__dot" aria-hidden="true" /> : null}
          </button>
          <button
            ref={questAnchorRef}
            type="button"
            className={`entity-lab-button ${hasClaimableQuest ? 'entity-lab-button--notify' : ''}`}
            style={{ '--rail-accent': '#ffcf6b' } as React.CSSProperties}
            onClick={() => { setQuestOpen(true); soundManager?.playUIOpen(); }}
            aria-label={t(language, 'questTitle')}
          >
            <span className="hud-action-icon" aria-hidden="true">✦</span>
            <span className="hud-action-label">{t(language, 'questTitle')}</span>
            {hasClaimableQuest ? <span className="entity-lab-button__dot" aria-hidden="true" /> : null}
          </button>
          <button
            ref={equipAnchorRef}
            type="button"
            className={`entity-lab-button ${equipUnlocked ? '' : 'entity-lab-button--locked'} ${equipHasNew ? 'entity-lab-button--notify' : ''}`}
            style={{ '--rail-accent': '#8ef0c0' } as React.CSSProperties}
            disabled={!equipUnlocked}
            onClick={() => openEntityPanel('equip', 'click')}
            aria-label={t(language, 'equipClickTitle')}
            title={equipUnlocked ? undefined : t(language, 'lockUntilStage').replace('{n}', String(EQUIP_UNLOCK_STAGE_ID))}
          >
            <span className="hud-action-icon" aria-hidden="true">{equipUnlocked ? '⌖' : '🔒'}</span>
            <span className="hud-action-label">{t(language, 'entityEquip')}</span>
            {/* C-P2 touch: surface the unlock-stage on the locked circle (title= is
                invisible on touch). aria-hidden — the button's title/aria-label carry it. */}
            {!equipUnlocked ? <span className="entity-lab-button__lockstage" aria-hidden="true">{`S${EQUIP_UNLOCK_STAGE_ID}`}</span> : null}
            {equipHasNew ? <span className="entity-lab-button__dot" aria-hidden="true" /> : null}
          </button>
          <button
            ref={fuseAnchorRef}
            type="button"
            className={`entity-lab-button ${fusionUnlocked ? '' : 'entity-lab-button--locked'} ${fuseHasNew ? 'entity-lab-button--notify' : ''}`}
            style={{ '--rail-accent': '#c79bff' } as React.CSSProperties}
            disabled={!fusionUnlocked}
            onClick={() => openEntityPanel('fuse')}
            aria-label={t(language, 'fuseTitle')}
            title={fusionUnlocked ? undefined : t(language, 'lockUntilStage').replace('{n}', String(FUSION_UNLOCK_STAGE_ID))}
          >
            <span className="hud-action-icon" aria-hidden="true">{fusionUnlocked ? '🔨' : '🔒'}</span>
            <span className="hud-action-label">{t(language, 'fuseTitle')}</span>
            {!fusionUnlocked ? <span className="entity-lab-button__lockstage" aria-hidden="true">{`S${FUSION_UNLOCK_STAGE_ID}`}</span> : null}
            {fuseHasNew ? <span className="entity-lab-button__dot" aria-hidden="true" /> : null}
          </button>
          <div ref={shopAnchorRef} className="side-rail__shop-slot" style={{ '--rail-accent': '#ff9f6b' } as React.CSSProperties}>
            <ShopButton
              highlighted={hasShopNotification}
              disabled={!canShowShop}
              lockStageLabel={`S${SHOP_UNLOCK_STAGE_ID}`}
              onClick={() => {
                setShopOpen(true);
                soundManager?.playUIOpen();
                if (!state.hasSeenCashShopTutorial) {
                  dispatch({ type: 'MARK_CASH_SHOP_TUTORIAL_SEEN' });
                }
              }}
              label={t(language, 'hudShop')}
            />
          </div>
          <button
            type="button"
            className="mini-button settings-gear-btn bottom-settings-button"
            style={{ '--rail-accent': '#9fb2c8' } as React.CSSProperties}
            onClick={() => { setSettingsOpen(true); soundManager?.playUIOpen(); }}
            title={t(language, 'hudSettings')}
            aria-label={t(language, 'hudSettings')}
          >
            <span className="hud-action-icon" aria-hidden="true">⚙</span>
            <span className="hud-action-label">{t(language, 'hudSettings')}</span>
          </button>
        </div>
        {/* Render transition overlays via Portal directly into document.body so
            they are completely independent of .app-shell's stacking/containing/
            clipping context. This guarantees the fixed-positioned wash/rays/fade
            are anchored to the true viewport with no square-edge artifacts. */}
        {typeof document !== 'undefined' && createPortal(
          <>
            <div className={`stage-transition-wash stage-transition-wash--${exitStyle} ${transitionPhase === 'bursting' ? 'active' : ''}`} />
            <div className={`stage-transition-rays stage-transition-rays--${exitStyle} ${transitionPhase === 'bursting' ? 'active' : ''}`} aria-hidden="true" />
            <div className={`stage-reveal-fade stage-reveal-fade--${enterStyle} ${transitionPhase === 'revealing' ? 'active' : ''}`} />
          </>,
          document.body,
        )}
        <ScaleIndicator stageId={displayStage.id} language={language} />
        {/* #42-fix: the progress-based lore toast is gone — era-records now unfold
            via the claimable quest alarm below (one alarm, claimable-synced) and
            in the almanac on claim. */}
        {stage.id === 1 && state.totalClicks === 0 && !interactionLocked ? (
          <div className="click-tutorial-hint">{t(language, 'clickToGather')}</div>
        ) : null}
        {floatingEntries.map((entry) => (
          <FloatingNumber
            key={entry.id}
            x={entry.x}
            y={entry.y}
            text={entry.text}
            particleName={entry.particleName}
            particleDefinition={entry.particleDefinition}
            variant={entry.variant}
            delayMs={entry.delayMs}
          />
        ))}
        {comboDisplay ? (
          <ComboMeter
            combo={comboDisplay.combo}
            mult={comboDisplay.mult}
            pulseId={comboDisplay.pulseId}
            levelUp={comboDisplay.levelUp}
            fading={comboDisplay.fading}
            maxMult={maxComboMult}
            language={language}
          />
        ) : null}
      </main>

      {state.pendingCondenseStageIdx !== null && !state.imploding && transitionPhase === 'quote' ? (
        <QuoteOverlay
          stage={STAGES[state.pendingCondenseStageIdx]}
          language={language}
          visible
          onContinue={() => {
            setRevealStartedAt(performance.now());
            setTransitionPhase('revealing');
            dispatch({ type: 'ADVANCE_STAGE', now: Date.now() });
          }}
        />
      ) : null}

      {state.offlineElapsedMs > 0 ? (
        <OfflineProgressModal
          awayMs={state.offlineElapsedMs}
          capMs={getOfflineRewardCapSec(state.hasOfflineStorageUpgrade) * 1000}
          gained={state.offlineGained}
          entropyGained={state.offlineEntropyGained}
          timeProgressGained={state.offlineTimeProgressGained}
          dailyStonesGained={state.offlineDailyStonesGained}
          language={language}
          onDismiss={() => dispatch({ type: 'DISMISS_OFFLINE_MODAL' })}
        />
      ) : null}

      {almanacOpen ? (
        <AlmanacOverlay
          currentStageId={stage.id}
          progressPercent={Math.floor(progress01 * 100)}
          language={language}
          onClose={() => { setAlmanacOpen(false); soundManager?.playUIClose(); }}
          onUITap={() => soundManager?.playUITap()}
          onStageSelect={(id) => setViewingStageId(id === stage.id ? null : id)}
          completedQuestIds={state.completedQuestIds}
        />
      ) : null}

      {questOpen ? (
        <QuestPanel
          state={state}
          language={language}
          onClaim={(questId) => { dispatch({ type: 'CLAIM_QUEST', questId }); soundManager?.playQuestClaim(); }}
          onClaimAttendance={() => { dispatch({ type: 'CLAIM_ATTENDANCE', now: Date.now(), rolls: Array.from({ length: 10 }, () => ({ rarityRoll: Math.random(), stageRoll: Math.random(), pickRoll: Math.random(), q1: Math.random(), q2: Math.random() })) }); soundManager?.playQuestClaim(); }}
          onClose={() => { setQuestOpen(false); soundManager?.playUIClose(); }}
        />
      ) : null}

      {/* #42: era-record alarm — tapping CLAIMS IN PLACE (no need to open the panel).
          The slot-machine rollup then plays from lastQuestClaimEvent. */}
      {questToast && !questOpen ? (
        <button
          type="button"
          className="quest-milestone-toast"
          onClick={() => { dispatch({ type: 'CLAIM_QUEST', questId: questToast.id }); soundManager?.playQuestClaim(); setQuestToast(null); }}
        >
          <span className="quest-milestone-toast__tag">{t(language, 'questMilestoneToast')}</span>
          <span className="quest-milestone-toast__title">✦ {questToast.title}</span>
          {/* #42-fix: show the pretty era-record lore line (the old milestone message). */}
          {(() => { const log = milestoneEraLog(questToast.id); return log ? <span className="quest-milestone-toast__lore">{pickLogText(log.message, language)}</span> : null; })()}
          <span className="quest-milestone-toast__cta">{t(language, 'questMilestoneToastCta')}</span>
        </button>
      ) : null}

      {/* #42: slot-machine matter rollup when a milestone/era-record is claimed. */}
      {state.lastQuestClaimEvent ? (
        <QuestClaimRollup
          matter={state.lastQuestClaimEvent.matter}
          stones={state.lastQuestClaimEvent.stones}
          title={(() => { const q = getQuest(state.lastQuestClaimEvent.questId); return q ? questTitle(q, language) : '✦'; })()}
          language={language}
          onDone={() => dispatch({ type: 'CLEAR_QUEST_CLAIM_EVENT', id: state.lastQuestClaimEvent!.id })}
        />
      ) : null}

      {settingsOpen ? (
        <SettingsPanel
          sfxMuted={sfxMuted}
          musicMuted={musicMuted}
          musicVolume={musicVolume}
          language={language}
          soundManager={soundManager}
          onToggleMusic={onToggleMusic}
          onSetMusicVolume={onSetMusicVolume}
          onToggleSfx={onToggleSfx}
          onToggleLanguage={onToggleLanguage}
          onRequestReset={() => { setSettingsOpen(false); soundManager?.playUIClose(); onRequestReset(); }}
          onForceReset={onForceReset ? () => { setSettingsOpen(false); soundManager?.playUIClose(); onForceReset(); } : undefined}
          onOpenLeaderboard={onOpenLeaderboard}
          onClose={() => { setSettingsOpen(false); soundManager?.playUIClose(); }}
        />
      ) : null}

      {activeTutorialBubble ? (
        <SpeechBubble
          anchorRef={
            activeTutorialBubble.anchor === 'entity'
              ? entityAnchorRef
              : activeTutorialBubble.anchor === 'equip'
                ? equipAnchorRef
                : activeTutorialBubble.anchor === 'fuse'
                  ? fuseAnchorRef
                  : activeTutorialBubble.anchor === 'quest'
                    ? questAnchorRef
                    : activeTutorialBubble.anchor === 'shop'
                      ? shopAnchorRef
                      : activeTutorialBubble.anchor === 'boost'
                        ? boostAnchorRef
                        : activeTutorialBubble.anchor === 'field'
                          ? fieldCenterAnchorRef
                          : resourceAnchorRef
          }
          position={
            activeTutorialBubble.anchor === 'resource'
              ? 'bottom'
              : activeTutorialBubble.anchor === 'entity'
                ? 'top'
                : activeTutorialBubble.anchor === 'field'
                  ? 'top'
                  : 'left'
          }
          message={activeTutorialBubble.message}
          ctaLabel={activeTutorialBubble.ctaLabel}
          autoCloseMs={activeTutorialBubble.autoCloseMs}
          onCta={
            activeTutorialBubble.onCta
              ? () => {
                  if (activeTutorialBubble.flagId === 'hasSeenCashShopTutorial') {
                    dispatch({ type: 'MARK_CASH_SHOP_TUTORIAL_SEEN' });
                  } else {
                    dispatch({ type: 'MARK_TUTORIAL_FLAG', flagId: activeTutorialBubble.flagId });
                  }
                  activeTutorialBubble.onCta?.();
                }
              : undefined
          }
          onDismiss={() => {
            if (activeTutorialBubble.flagId === 'hasSeenCashShopTutorial') {
              dispatch({ type: 'MARK_CASH_SHOP_TUTORIAL_SEEN' });
            } else {
              dispatch({ type: 'MARK_TUTORIAL_FLAG', flagId: activeTutorialBubble.flagId });
            }
          }}
        />
      ) : null}

      {/* info-hint tutorial is now part of activeTutorialBubble system */}

      {canChooseEnding ? (
        <EndingChooser
          options={endingOptions}
          language={language}
          onChoose={(endingId) => {
            soundManager?.playEndingSting(endingId);
            dispatch({ type: 'SELECT_ENDING', endingId, now: Date.now() });
          }}
          onClose={() => setEndingChooserDismissed(true)}
        />
      ) : null}

      {state.selectedEndingId !== null ? (
        <EndingCinematic
          endingId={state.selectedEndingId}
          language={language}
          soundManager={soundManager}
          onComplete={() => dispatch({ type: 'COMPLETE_ENDING', now: Date.now() })}
        />
      ) : null}
    </div>
  );
}
