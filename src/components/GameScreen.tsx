import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, Dispatch } from 'react';
import { TUNING } from '../game/constants';
import {
  formatAutoRateValue,
  formatCosmicTimeProgressParts,
  formatEntropyAmount,
  formatEntropyParts,
  formatProgressNumberParts,
  formatWhole,
  canCondense as canCondenseNow,
  getAutoRate,
  getEffectiveThreshold,
  getEntropyOnCondense,
  getTimeFillRate,
  getTimeGaugeForCosmicClock,
  getProgress,
  getTimeMultiplier,
} from '../game/formulas';
import { getActiveModifiers } from '../game/skills/effects';
import { getMechanic } from '../game/mechanics';
import type { GameAction } from '../game/reducer';
import { STAGES } from '../game/stages';
import { getStageStartCosmicTime } from '../game/timeFlow';
import {
  getActiveShopBoostMultiplier,
  getOfflineRewardCapSec,
  isCashShopUnlocked,
} from '../game/shop/boosts';
import { getEntityCost } from '../game/entities/types';
import { getEntitiesForStage, getPurchasedEntityCount } from '../game/entities/stageItems';
import type { SoundManager } from '../game/audio';
import type { EndingId, GameState } from '../game/types';
import { EncounterAlert } from './EncounterAlert';
import { FloatingNumber } from './FloatingNumber';
import { ParticleField } from './ParticleField';
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

interface EncounterEntry {
  id: number;
  name: string;
  color: string;
}

interface TutorialBubble {
  flagId: string;
  anchor: 'entity' | 'shop' | 'resource' | 'boost' | 'field';
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
  bgmMuted: boolean;
  sfxMuted: boolean;
  language: 'en' | 'ko';
  onToggleBgm: () => void;
  onToggleSfx: () => void;
  onToggleLanguage: () => void;
  onRequestReset: () => void;
}

function EndingCinematic({
  endingId,
  language,
  onComplete,
}: {
  endingId: EndingId | null;
  language: 'en' | 'ko';
  onComplete: () => void;
}) {
  return endingId === null ? null : (
    <EndingCredits endingId={endingId} language={language} onComplete={onComplete} />
  );
}

export function GameScreen({
  state,
  dispatch,
  soundManager,
  bgmMuted,
  sfxMuted,
  language,
  onToggleBgm,
  onToggleSfx,
  onToggleLanguage,
  onRequestReset,
}: GameScreenProps) {
  const [shopOpen, setShopOpen] = useState(false);
  const [entityPanelOpen, setEntityPanelOpen] = useState(false);
  const [almanacOpen, setAlmanacOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [viewingStageId, setViewingStageId] = useState<number | null>(null);
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
  const displayProgress01 = getProgress(displayQuanta, displayEffectiveThreshold);
  const modifiers = getActiveModifiers(state.skills, {
    currentQuanta: state.quanta,
    stagesCleared: state.stageIdx,
    secondsInStage: Math.max(0, (wallNow - state.stageStartedAt) / 1000),
    stageId: stage.id,
    progress01,
    clickLevel: state.skills.click.level,
  }, state.purchasedEntities, state.prestigeUpgrades);
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
  const timeGauge = getTimeGaugeForCosmicClock(state.stageIdx, state.cosmicClockSec);
  const timeProgress01 = Math.min(1, timeGauge / 100);
  const displayTimeGauge = isViewingPastStage
    ? getTimeGaugeForCosmicClock(displayStage.id - 1, state.cosmicClockSec)
    : timeGauge;
  const displayTimeProgress01 = Math.min(1, displayTimeGauge / 100);
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
  const condenseHint =
    progress01 >= 1 && timeProgress01 < 1
      ? 'Wait for cosmic time.'
      : timeProgress01 >= 1 && progress01 < 1
        ? 'Gather more quanta.'
        : 'Fill both quanta and cosmic time.';
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
  const [encounterEntries, setEncounterEntries] = useState<EncounterEntry[]>([]);
  const [shakeClass, setShakeClass] = useState('');
  const logicAccumulator = useRef(0);
  const lastWhooshAt = useRef(0);
  const civPlayed = useRef(false);
  const lastToastStageIdRef = useRef(stage.id);
  void lastToastStageIdRef; // suppress unused-variable lint
  const timeFlowRate = getTimeFillRate(stage, state.skills.time.level, modifiers, shopTimeBoost);
  const timeRemainingSeconds =
    timeProgress01 >= 1 || timeFlowRate <= 0
      ? 0
      : (100 - Math.min(100, timeGauge)) / timeFlowRate;
  const timeEstimateLabel = (() => {
    if (timeRemainingSeconds <= 0) return '';
    const s = timeRemainingSeconds;
    if (s < 60) return `${Math.ceil(s)}s`;
    if (s < 3600) return `${Math.floor(s / 60)}m ${Math.floor(s % 60)}s`;
    if (s < 86400) {
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    return h > 0 ? `${d}d ${h}h` : `${d}d`;
  })();
  const cosmicClockFromGauge = state.cosmicClockSec;
  const displayedCosmicClock =
    state.currentUniverseSeed.anomaly === 'inverted_time'
      ? Math.max(
          getStageStartCosmicTime(state.stageIdx),
          stage.cosmicTimeSec - (cosmicClockFromGauge - getStageStartCosmicTime(state.stageIdx)),
        )
      : cosmicClockFromGauge;
  const matterReadout = formatProgressNumberParts(displayQuanta, displayEffectiveThreshold);
  const timeReadout = formatCosmicTimeProgressParts(displayedCosmicClock, displayStage.cosmicTimeSec);
  const entropyReadout = formatEntropyParts(state.entropy);
  const entropyPreviewReadout = formatEntropyParts(entropyPreview);
  const canShowShop = isCashShopUnlocked(state);
  const hasActiveBoost = state.shopBoosts.some((b) => b.expiresAt > wallNow);
  const hasShopNotification = canShowShop && !state.hasSeenCashShopTutorial;
  const displayStageLabel = stageName(language, displayStage.id, displayStage.name);
  const displayStageNumber = String(displayStage.id).padStart(2, '0');
  const openEntityPanel = () => {
    setViewingStageId(null);
    setEntityPanelOpen(true);
  };
  const currentStageEntities = useMemo(() => getEntitiesForStage(stage.id), [stage.id]);
  const hasAffordableEntity = currentStageEntities.some((entity) => {
    const count = getPurchasedEntityCount(state.purchasedEntities, entity);
    const maxed = entity.maxCount > 0 && count >= entity.maxCount;
    return !maxed && state.quanta >= getEntityCost(entity, count);
  });
  const ownedCurrentStageEntityCount = currentStageEntities.reduce((sum, entity) => {
    return sum + getPurchasedEntityCount(state.purchasedEntities, entity);
  }, 0);
  const showEndingButton = state.completedRun && state.lastEndingId === null && endingChooserDismissed;
  const showCondenseGate = isViewingPastStage || canCondense || showEndingButton;
  const activeTutorialBubble = useMemo<TutorialBubble | null>(() => {
    if (entityPanelOpen || state.universeCount !== 1) {
      return null;
    }
    if (stage.id === 1 && state.totalClicks === 0 && !state.tutorialFlags['matter-time-intro']) {
      return {
        flagId: 'matter-time-intro',
        anchor: 'resource',
        message: t(language, 'tutMatterTimeIntro'),
        autoCloseMs: 9000,
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
    if (hasAffordableEntity && !state.tutorialFlags['entity-lab-intro']) {
      return {
        flagId: 'entity-lab-intro',
        anchor: 'entity',
        message: t(language, 'tutEntityLabIntro'),
        ctaLabel: t(language, 'tutEntityLabOpen'),
        onCta: openEntityPanel,
      };
    }
    if (ownedCurrentStageEntityCount > 0 && !state.tutorialFlags['entity-lab-canvas']) {
      return {
        flagId: 'entity-lab-canvas',
        anchor: 'entity',
        message: t(language, 'tutEntityLabCanvas'),
        autoCloseMs: 6000,
      };
    }
    if (encounterEntries.length > 0 && !state.tutorialFlags['rogue-encounter-intro']) {
      return {
        flagId: 'rogue-encounter-intro',
        anchor: 'field',
        message: t(language, 'tutRogueEncounter'),
        autoCloseMs: 7000,
      };
    }
    if (canShowShop && !state.hasSeenCashShopTutorial) {
      return {
        flagId: 'hasSeenCashShopTutorial',
        anchor: 'shop',
        message: t(language, 'tutShop'),
        ctaLabel: t(language, 'tutShopOpen'),
        onCta: () => setShopOpen(true),
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
    return null;
  }, [
    canCondense,
    canShowShop,
    entityPanelOpen,
    hasActiveBoost,
    hasAffordableEntity,
    encounterEntries.length,
    language,
    ownedCurrentStageEntityCount,
    stage.id,
    state.shopBoosts,
    state.hasSeenCashShopTutorial,
    state.totalClicks,
    state.tutorialFlags,
    state.universeCount,
  ]);


  useGameLoop((now, dt) => {
    logicAccumulator.current += dt;
    while (logicAccumulator.current >= TUNING.LOGIC_TICK_MS) {
      dispatch({ type: 'TICK', now: Date.now(), dt: TUNING.LOGIC_TICK_MS });
      logicAccumulator.current -= TUNING.LOGIC_TICK_MS;
    }
    if (
      timeFlowRate > 1e10 &&
      now - lastWhooshAt.current >= TUNING.TIME_ACCELERATION_WHOOSH_INTERVAL_MS
    ) {
      lastWhooshAt.current = now;
      soundManager?.playTimeAccelerationWhoosh(Math.min(1, Math.log10(timeFlowRate) / 20));
    }
  });

  useEffect(() => {
    soundManager?.setStage(displayStage.id - 1, displayStage.silenceBeforeMs ?? 0);
  }, [soundManager, displayStage.id, displayStage.silenceBeforeMs]);

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

  useEffect(() => {
    if (!state.lastClickEvent) {
      return undefined;
    }
    const event = state.lastClickEvent;
    const emissionCount = Math.max(1, clickEmissionCount);
    const gainedLabel = formatFloatingGain(event.gained);
    const text = event.isCrit
      ? `CRIT ${gainedLabel}`
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
          particleName: event.particleName,
          particleDefinition: event.particleDefinition,
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
  }, [clickEmissionCount, dispatch, soundManager, state.lastClickEvent, state.stageIdx]);

  useEffect(() => {
    if (!state.lastCollisionEvent) {
      return undefined;
    }
    const event = state.lastCollisionEvent;
    const rogueName = getRogueNameLabel(event.name, language);
    setFloatingEntries((current) => [
      ...current,
      {
        id: event.id,
        x: event.x,
        y: event.y,
        text: `+${formatWhole(event.bonus)} · ${rogueName.toUpperCase()}`,
        entropyGained: event.entropyGained,
        variant: 'collision',
      },
    ]);
    setShakeClass(event.tier === 'massive' ? 'shake-big' : 'shake');
    soundManager?.playCollision(event.tier);
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
    if (!state.lastEncounterEvent) {
      return undefined;
    }
    const event = state.lastEncounterEvent;
    setEncounterEntries((current) => [...current, { ...event, name: getRogueNameLabel(event.name, language) }]);
    dispatch({ type: 'CLEAR_ENCOUNTER_EVENT', id: event.id });
    const timeoutId = window.setTimeout(() => {
      setEncounterEntries((current) => current.filter((entry) => entry.id !== event.id));
    }, TUNING.ENCOUNTER_ALERT_MS);
    return () => window.clearTimeout(timeoutId);
  }, [dispatch, language, state.lastEncounterEvent]);

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
    setShakeClass('shake-big');
    soundManager?.playCondenseExplosion();
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

  return (
    <div
      className={`app-shell ${shakeClass} ${transitionPhase === 'revealing' ? 'stage-revealing' : ''}`}
      style={{ '--accent': displayStage.accent, '--core': displayStage.coreColor } as CSSProperties}
    >
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
          purchasedEntities={state.purchasedEntities}
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
          onEncounter={(payload) =>
            dispatch({ type: 'REPORT_ENCOUNTER', name: payload.name, color: payload.color })
          }
          onCollision={(payload) =>
            dispatch({
              type: 'REPORT_COLLISION',
              x: payload.x,
              y: payload.y,
              bonus: payload.bonus,
              entropyBonus: payload.entropyBonus,
              tier: payload.tier,
              name: payload.name,
            })
          }
        />
        {shopOpen && canShowShop ? (
          <ShopPanel state={state} dispatch={dispatch} language={language} onClose={() => setShopOpen(false)} />
        ) : null}
        {entityPanelOpen ? (
          <EntityPanel
            currentStageId={stage.id}
            purchasedEntities={state.purchasedEntities}
            quanta={state.quanta}
            language={language}
            onPurchase={(entityId) => dispatch({ type: 'PURCHASE_ENTITY', entityId })}
            onClose={() => setEntityPanelOpen(false)}
            onStageSelect={(id) => setViewingStageId(id === stage.id ? null : id)}
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
                onClick={() => { setAlmanacOpen(true); dispatch({ type: 'MARK_TUTORIAL_FLAG', flagId: 'info-hint-seen' }); }}
                title={t(language, 'hudViewInfo')}
                aria-label={t(language, 'hudViewInfo')}
              >
                {displayStageNumber}
              </button>
              <div className="hud-stage-summary">
                <div className="hud-stage-title-line">
                  <span className="hud-stage-title">{displayStageLabel}</span>
                  <span className="hud-title-separator" aria-hidden="true">·</span>
                    <span className="hud-entropy-readout">
                      <span>{t(language, 'hudEntropy')}</span>
                      <strong>{entropyReadout.value}</strong>
                      <span className="hud-entropy-unit">{entropyReadout.unit}</span>
                    </span>
                </div>
              </div>
            </div>
            {!showCondenseGate ? (
              <div className="hud-progress-stack">
                <div className="hud-meter">
                  <div className="hud-meter-row">
                    <span className="hud-meter-label">
                      <span className="hud-meter-label-text">{t(language, 'hudQuanta')}</span>
                      {displayedAutoRate > 0 && !isViewingPastStage ? (
                        <span className="hud-auto-rate">{`${formatAutoRateValue(displayedAutoRate)}/s`}</span>
                      ) : null}
                    </span>
                    <span className="hud-readout">
                      <span className="hud-readout-value">{matterReadout.value}</span>
                      <span className="hud-readout-exponent">{matterReadout.exponent ?? ''}</span>
                      <span className="hud-readout-unit">{matterReadout.unit}</span>
                    </span>
                  </div>
                  <div className="hud-gauge hud-quanta-gauge" aria-label="Matter progress">
                    <div className="hud-gauge-fill hud-quanta-fill" style={{ width: `${Math.min(100, displayProgress01 * 100)}%` }} />
                  </div>
                </div>
                <div className="hud-meter hud-meter--time">
                  <div className="hud-meter-row">
                    <span className="hud-meter-label">
                      <span className="hud-meter-label-text">{t(language, 'hudTime')}</span>
                      {timeEstimateLabel && !isViewingPastStage ? (
                        <span className="hud-time-estimate-inline">{timeEstimateLabel}</span>
                      ) : null}
                    </span>
                    <span className="hud-readout hud-cosmic-time">
                      <span className="hud-readout-value">{timeReadout.value}</span>
                      <span className="hud-readout-exponent">{timeReadout.exponent ?? ''}</span>
                      <span className="hud-readout-unit">{timeReadout.unit}</span>
                    </span>
                  </div>
                  <div className="hud-gauge hud-time-gauge" aria-label="Cosmic time gauge">
                    <div className="hud-gauge-fill hud-time-fill" style={{ width: `${Math.min(100, displayTimeProgress01 * 100)}%` }} />
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
              <span>{isViewingPastStage ? t(language, 'hudCompleted') : showEndingButton ? (language === 'ko' ? '엔딩 선택' : 'CHOOSE ENDING') : t(language, 'hudCondense')}</span>
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
        <div className="bottom-buttons">
          <div ref={shopAnchorRef}>
            <ShopButton
              highlighted={hasShopNotification}
              disabled={!canShowShop}
              onClick={() => {
                setShopOpen(true);
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
            className={`entity-lab-button ${hasAffordableEntity ? 'affordable' : ''}`}
            onClick={openEntityPanel}
            aria-label="Open Entity Lab"
          >
            <span className="hud-action-icon" aria-hidden="true">⚗</span>
            <span className="hud-action-label">{t(language, 'entityLabTitle')}</span>
            {hasAffordableEntity ? <span className="hud-notification-dot" aria-hidden="true" /> : null}
          </button>
          <button
            type="button"
            className="mini-button settings-gear-btn bottom-settings-button"
            onClick={() => setSettingsOpen(true)}
            title={t(language, 'hudSettings')}
            aria-label={t(language, 'hudSettings')}
          >
            <span className="hud-action-icon" aria-hidden="true">⚙</span>
            <span className="hud-action-label">{t(language, 'hudSettings')}</span>
          </button>
        </div>
        <div className={`stage-transition-wash ${transitionPhase === 'bursting' ? 'active' : ''}`} />
        <div className={`stage-reveal-fade ${transitionPhase === 'revealing' ? 'active' : ''}`} />
        <ScaleIndicator stageId={displayStage.id} language={language} />
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
        {encounterEntries.map((entry) => (
          <EncounterAlert key={entry.id} color={entry.color} name={entry.name} language={language} />
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
          onClose={() => setAlmanacOpen(false)}
        />
      ) : null}

      {settingsOpen ? (
        <SettingsPanel
          bgmMuted={bgmMuted}
          sfxMuted={sfxMuted}
          language={language}
          onToggleBgm={onToggleBgm}
          onToggleSfx={onToggleSfx}
          onToggleLanguage={onToggleLanguage}
          onRequestReset={() => { setSettingsOpen(false); onRequestReset(); }}
          onClose={() => setSettingsOpen(false)}
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

      {state.tutorialFlags['milestone-seen'] && !state.tutorialFlags['info-hint-seen'] && !almanacOpen ? (
        <SpeechBubble
          anchorRef={infoAnchorRef}
          position="bottom"
          message={t(language, 'tutStageLog')}
          ctaLabel={t(language, 'tutStageLogOpen')}
          onCta={() => {
            setAlmanacOpen(true);
            dispatch({ type: 'MARK_TUTORIAL_FLAG', flagId: 'info-hint-seen' });
          }}
          onDismiss={() => dispatch({ type: 'MARK_TUTORIAL_FLAG', flagId: 'info-hint-seen' })}
        />
      ) : null}

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
          onComplete={() => dispatch({ type: 'COMPLETE_ENDING', now: Date.now() })}
        />
      ) : null}
    </div>
  );
}
