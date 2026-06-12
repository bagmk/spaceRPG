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
import { getEquippedInstances } from '../game/entities/effects';
import { getMechanic } from '../game/mechanics';
import type { GameAction } from '../game/reducer';
import { STAGES } from '../game/stages';
import {
  getActiveShopBoostMultiplier,
  getOfflineRewardCapSec,
  isCashShopUnlocked,
} from '../game/shop/boosts';
import { getEntityCost } from '../game/entities/types';
import { getEntitiesForStage, getPurchasedEntityCount } from '../game/entities/stageItems';
import { getParticleDefinitionLabel, getParticleNameLabel } from '../game/particles';
import type { SoundManager } from '../game/audio';
import type { EndingId, GameState } from '../game/types';
import { FloatingNumber } from './FloatingNumber';
import { ParticleField, type ParticleFieldHandle } from './ParticleField';
import { QuoteOverlay } from './QuoteOverlay';
import { ScaleIndicator } from './ScaleIndicator';
import { SpeechBubble } from './SpeechBubble';
import { ShopButton, ShopPanel } from './ShopPanel';
import { ActiveBoostHud } from './ActiveBoostHud';
import { EntityPanel } from './EntityPanel';
import { useGameLoop } from '../hooks/useGameLoop';
import { OfflineProgressModal } from './OfflineProgressModal';
import { EndingChooser } from './EndingChooser';
import { EndingCredits } from './endings/EndingCredits';
import { applyUniverseToStage, getEndingOptions } from '../game/multiverse';
import { StageLogToast } from './StageLogToast';
import { AlmanacOverlay } from './AlmanacOverlay';
import { SettingsPanel } from './SettingsPanel';
import { t, stageName } from '../i18n';
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
  variant: 'normal' | 'crit' | 'collision';
  delayMs?: number;
}

interface TutorialBubble {
  flagId: string;
  anchor: 'entity' | 'shop' | 'resource' | 'boost' | 'field' | 'focus';
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [viewingStageId, setViewingStageId] = useState<number | null>(null);
  const focusAnchorRef = useRef<HTMLButtonElement | null>(null);
  const entityAnchorRef = useRef<HTMLButtonElement | null>(null);
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
  const modifiers = getActiveModifiers(state.skills, {
    currentQuanta: state.quanta,
    stagesCleared: state.stageIdx,
    secondsInStage: Math.max(0, (wallNow - state.stageStartedAt) / 1000),
    stageId: stage.id,
    gateProgress01: getEntropyGateProgress(state.entropy, state.stageIdx),
    progress01,
    clickLevel: state.skills.click.level,
  }, getEquippedInstances(state.inventory, [...state.equippedSlots, ...state.riftSlots]), state.prestigeUpgrades, state.almanacCollected);
  const autoRate = getAutoRate(modifiers);
  const stageAutoBonus =
    stage.mechanic === 'reionization'
      ? autoRate * state.mechanicCharge * 0.5
      : stage.mechanic === 'first_stars'
        ? autoRate * Math.min(1.5, state.mechanicCharge * 0.12)
        : 0;
  const shopTimeBoost = getActiveShopBoostMultiplier(state.shopBoosts, 'time', wallNow);
  const shopMatterBoost = getActiveShopBoostMultiplier(state.shopBoosts, 'matter', wallNow);
  const displayedAutoRate = (autoRate + stageAutoBonus) * shopTimeBoost * shopMatterBoost;
  const timeMult = getTimeMultiplier(state.skills.time.level, modifiers) * shopTimeBoost;
  const entropyGateProgress01 = getEntropyGateProgress(state.entropy, state.stageIdx);
  const clickEmissionCount =
    modifiers.clickEmissionCount * (state.currentUniverseSeed.anomaly === 'echoing' ? 2 : 1);
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
  const [shakeClass, setShakeClass] = useState('');
  const saveErrorVisible = useSaveErrorToast();
  useAudioUnlockOnPointer(soundManager);
  const logicAccumulator = useRef(0);
  const particleFieldRef = useRef<ParticleFieldHandle>(null);
  const civPlayed = useRef(false);
  const lastToastStageIdRef = useRef(stage.id);
  void lastToastStageIdRef; // suppress unused-variable lint
  const entropyPreviewReadout = formatEntropyParts(entropyPreview);
  const canShowShop = isCashShopUnlocked(state);
  const hasActiveBoost = state.shopBoosts.some((b) => b.expiresAt > wallNow);
  const hasShopNotification = canShowShop && !state.hasSeenCashShopTutorial;
  const displayStageLabel = stageName(language, displayStage.id, displayStage.name);
  const displayStageNumber = String(displayStage.id).padStart(2, '0');
  const openEntityPanel = (page: 'lab' | 'equip' | 'fuse' = 'lab', category: 'click' | 'rift' = 'click') => {
    setViewingStageId(null);
    setPanelView({ page, category });
    soundManager?.playUIOpen();
  };
  const currentStageEntities = useMemo(() => getEntitiesForStage(stage.id), [stage.id]);
  const hasAffordableEntity = currentStageEntities.some((entity) => {
    const count = getPurchasedEntityCount(state.inventory, entity);
    const maxed = entity.maxCount > 0 && count >= entity.maxCount;
    return !maxed && state.quanta >= getEntityCost(entity, count, stage.id);
  });
  const ownedCurrentStageEntityCount = currentStageEntities.reduce((sum, entity) => {
    return sum + getPurchasedEntityCount(state.inventory, entity);
  }, 0);
  const showEndingButton = state.completedRun && state.lastEndingId === null && endingChooserDismissed;
  const showCondenseGate = isViewingPastStage || canCondense || showEndingButton;
  const activeTutorialBubble = useMemo<TutorialBubble | null>(() => {
    if (entityPanelOpen || state.universeCount !== 1) {
      return null;
    }
    if (stage.id === 1 && !state.tutorialFlags['matter-time-intro']) {
      // Before the first click: invite interaction at the field center.
      // After it: explain matter/time, anchored to the resource panel.
      const beforeFirstClick = state.totalClicks === 0;
      return {
        flagId: 'matter-time-intro',
        anchor: beforeFirstClick ? 'field' : 'resource',
        message: t(language, beforeFirstClick ? 'tutFirstClick' : 'tutMatterTimeIntro'),
        autoCloseMs: beforeFirstClick ? 0 : 9000,
      };
    }
    if (state.tutorialFlags.allDismissed) {
      return null;
    }
    if (stage.id >= 2 && !state.tutorialFlags['time-gauge-visible']) {
      return {
        flagId: 'time-gauge-visible',
        anchor: 'resource',
        message: t(language, 'tutTimeGauge'),
        autoCloseMs: 7000,
      };
    }
    if (ownedCurrentStageEntityCount > 0 && !state.tutorialFlags['entity-lab-intro']) {
      return {
        flagId: 'entity-lab-intro',
        anchor: 'entity',
        message: t(language, 'tutEntityLabIntro'),
        ctaLabel: t(language, 'tutEntityLabOpen'),
        onCta: () => openEntityPanel('equip', 'click'),
      };
    }
    if (stage.id >= 3 && !state.tutorialFlags['focus-mode-intro']) {
      return {
        flagId: 'focus-mode-intro',
        anchor: 'focus',
        message: t(language, 'tutFocusMode'),
        autoCloseMs: 7000,
      };
    }
    if (canShowShop && !state.hasSeenCashShopTutorial) {
      return {
        flagId: 'hasSeenCashShopTutorial',
        anchor: 'shop',
        message: t(language, 'tutShop'),
        ctaLabel: t(language, 'tutShopOpen'),
        onCta: () => { setShopOpen(true); soundManager?.playUIOpen(); },
      };
    }
    if (hasActiveBoost && !state.tutorialFlags['boost-hud-seen']) {
      return {
        flagId: 'boost-hud-seen',
        anchor: 'boost',
        message: t(language, 'tutBoost'),
        autoCloseMs: 7000,
      };
    }
    if (canCondense && !state.tutorialFlags['condense-ready']) {
      return {
        flagId: 'condense-ready',
        anchor: 'resource',
        message: t(language, 'tutCondense'),
        autoCloseMs: 8000,
      };
    }
    if (state.tutorialFlags['milestone-seen'] && !state.tutorialFlags['info-hint-seen'] && !almanacOpen) {
      return {
        flagId: 'info-hint-seen',
        anchor: 'resource',
        message: t(language, 'tutStageLog'),
        ctaLabel: t(language, 'tutStageLogOpen'),
        onCta: () => { setAlmanacOpen(true); soundManager?.playUIOpen(); },
      };
    }
    return null;
  }, [
    canCondense,
    canShowShop,
    entityPanelOpen,
    hasActiveBoost,
    hasAffordableEntity,
    language,
    ownedCurrentStageEntityCount,
    stage.id,
    state.shopBoosts,
    state.hasSeenCashShopTutorial,
    state.totalClicks,
    state.tutorialFlags,
    state.universeCount,
    almanacOpen,
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
    soundManager?.playClick(state.stageIdx, event.isCrit);
    dispatch({ type: 'CLEAR_CLICK_EVENT', id: event.id });
    const timeoutId = window.setTimeout(() => {
      setFloatingEntries((current) => current.filter((entry) => Math.floor(entry.id / 100) !== event.id));
    }, event.isCrit ? TUNING.FLOAT_CRIT_MS : TUNING.FLOAT_NORMAL_MS);
    return () => window.clearTimeout(timeoutId);
  }, [clickEmissionCount, dispatch, language, soundManager, state.lastClickEvent, state.stageIdx]);

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
      {saveErrorVisible ? (
        <div className="save-error-toast" role="alert">
          {t(language, 'saveFailedQuota')}
        </div>
      ) : null}
      <main className="field">
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
          onRiftClick={() => openEntityPanel('equip', 'rift')}
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
          onCollision={(payload) =>
            dispatch({
              type: 'REPORT_COLLISION',
              x: payload.x,
              y: payload.y,
              bonus: payload.bonus,
              entropyBonus: payload.entropyBonus,
              tier: payload.tier,
              name: payload.name,
              dropRoll: Math.random(),
              dropPickRoll: Math.random(),
              dropStageRoll: Math.random(),
            })
          }
        />
        {shopOpen && canShowShop ? (
          <ShopPanel state={state} dispatch={dispatch} language={language} onClose={() => { setShopOpen(false); soundManager?.playUIClose(); }} />
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
            fusionPity={state.fusionPity}
            lastFusionEvent={state.lastFusionEvent}
            almanacCollected={state.almanacCollected}
            quanta={state.quanta}
            stats={{
              clickPower: getClickPower(modifiers),
              autoRate: displayedAutoRate,
              critChance: getCritChance(state.skills.crit.level, 0, modifiers),
              critMult: getCritMultiplier(state.skills.crit.level, modifiers),
              comboCapMult:
                TUNING.COMBO_MULT_MAX +
                (state.singularityUnlocks.includes('free_combo') ? 2 : 0) +
                modifiers.comboCapAdd,
              offlineEff:
                (modifiers.hawkingEcho || state.singularityUnlocks.includes('hawking_echo')
                  ? 1
                  : TUNING.OFFLINE_BASE_RATE) * modifiers.offlineGainMult,
              emissionIntervalMs: Math.min(2200, Math.max(240, 1500 / Math.log10(10 + displayedAutoRate))),
              entropyGainMult: modifiers.entropyGainMult,
              autoFlatMult: modifiers.autoFlatMult,
            }}
            language={language}
            onPurchase={(entityId) => { dispatch({ type: 'PURCHASE_ENTITY', entityId }); soundManager?.playEntityLevelUp(); }}
            onEquip={(entityId, slot) => { dispatch({ type: 'EQUIP_ENTITY', entityId, slot }); soundManager?.playUITap(); }}
            onUnequip={(slot, target) => { dispatch({ type: 'UNEQUIP_ENTITY', slot, target }); soundManager?.playUITap(); }}
            onEnhance={(entityId) => { dispatch({ type: 'ENHANCE_ENTITY', entityId }); soundManager?.playEntityLevelUp(); }}
            onFuse={(inputEntityIds) => {
              dispatch({ type: 'FUSE_ENTITIES', inputEntityIds, rarityRoll: Math.random(), pickRoll: Math.random(), stageRoll: Math.random() });
              soundManager?.playEntityLevelUp();
            }}
            onClearFusionEvent={(id) => dispatch({ type: 'CLEAR_FUSION_EVENT', id })}
            onClose={() => { setPanelView(null); soundManager?.playUIClose(); }}
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
        <div className={`hud-info ${focusMode ? 'focus-hidden' : ''}`} ref={resourceAnchorRef}>
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
                      <span>{t(language, 'hudQuanta')}</span>
                      <strong>{formatGameNumberShort(state.quanta)}</strong>
                      {displayedAutoRate > 0 && !isViewingPastStage ? (
                        <span className="hud-auto-rate">{`+${formatAutoRateValue(displayedAutoRate)}/s`}</span>
                      ) : null}
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
                    const label = id === 'time_warp' ? 'T' : id === 'matter_forge' ? 'M' : id === 'critical_core' ? 'C' : id === 'auto_engine' ? 'A' : 'E';
                    return <span key={id} className={`prestige-pip prestige-pip--${id}`} title={PRESTIGE_UPGRADES.find((u) => u.id === id)?.name[language]}><span className="prestige-pip__label">{label}</span>{mult.toFixed(1)}</span>;
                  })}
                </div>
                <ActiveBoostHud ref={boostAnchorRef} boosts={state.shopBoosts} language={language} />
              </div>
            );
          })()}
        </div>
        <div className={`bottom-buttons ${focusMode ? 'focus-hidden' : ''}`}>
          <div ref={shopAnchorRef}>
            <ShopButton
              highlighted={hasShopNotification}
              disabled={!canShowShop}
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
            ref={entityAnchorRef}
            type="button"
            className="entity-lab-button"
            onClick={() => openEntityPanel('lab')}
            aria-label={t(language, 'collectionTitle')}
          >
            <span className="hud-action-icon" aria-hidden="true">📖</span>
            <span className="hud-action-label">{t(language, 'collectionTitle')}</span>
          </button>
          <button
            type="button"
            className="entity-lab-button"
            onClick={() => openEntityPanel('equip', 'click')}
            aria-label={t(language, 'equipClickTitle')}
          >
            <span className="hud-action-icon" aria-hidden="true">⌖</span>
            <span className="hud-action-label">{t(language, 'entityEquip')}</span>
          </button>
          <button
            type="button"
            className="entity-lab-button"
            onClick={() => openEntityPanel('fuse')}
            aria-label={t(language, 'fuseTitle')}
          >
            <span className="hud-action-icon" aria-hidden="true">⚛</span>
            <span className="hud-action-label">{t(language, 'fuseTitle')}</span>
          </button>
          <button
            type="button"
            className="mini-button settings-gear-btn bottom-settings-button"
            onClick={() => { setSettingsOpen(true); soundManager?.playUIOpen(); }}
            title={t(language, 'hudSettings')}
            aria-label={t(language, 'hudSettings')}
          >
            <span className="hud-action-icon" aria-hidden="true">⚙</span>
            <span className="hud-action-label">{t(language, 'hudSettings')}</span>
          </button>
        </div>
        <button
          ref={focusAnchorRef}
          type="button"
          className={`focus-toggle-btn ${focusMode ? 'focus-toggle-btn--active' : ''}`}
          onClick={() => { setFocusMode((v) => !v); soundManager?.playToggle(!focusMode); }}
          aria-label={focusMode ? 'Exit focus mode' : 'Enter focus mode'}
        >
          {focusMode ? '◉' : '○'}
        </button>
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
        <ScaleIndicator stageId={displayStage.id} language={language} className={focusMode ? 'focus-hidden' : ''} />
        {state.totalClicks > 0 || import.meta.env.DEV ? (
          <StageLogToast stageId={stage.id} progressPercent={Math.floor(progress01 * 100)} language={language} onFirstDismiss={() => dispatch({ type: 'MARK_TUTORIAL_FLAG', flagId: 'milestone-seen' })} />
        ) : null}
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
              : activeTutorialBubble.anchor === 'shop'
                ? shopAnchorRef
                : activeTutorialBubble.anchor === 'boost'
                  ? boostAnchorRef
                  : activeTutorialBubble.anchor === 'focus'
                    ? focusAnchorRef
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
                  : activeTutorialBubble.anchor === 'focus'
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
