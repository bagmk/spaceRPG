import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, Dispatch } from 'react';
import { TUNING } from '../game/constants';
import {
  formatCosmicTime,
  formatGameNumber,
  formatRate,
  formatWhole,
  canCondense as canCondenseNow,
  getAutoRate,
  getClickPower,
  getCritMultiplier,
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
import { SkillsButton, SkillsPanel } from './skills/SkillsPanel';
import { useGameLoop } from '../hooks/useGameLoop';
import { OfflineProgressModal } from './OfflineProgressModal';
import { EndingChooser } from './EndingChooser';
import { BigCrunchEnding } from './endings/BigCrunchEnding';
import { BigRipEnding } from './endings/BigRipEnding';
import { BounceEnding } from './endings/BounceEnding';
import { HeatDeathEnding } from './endings/HeatDeathEnding';
import { VacuumDecayEnding } from './endings/VacuumDecayEnding';
import { CROSS_NODES, SKILL_TREES, getVisibleCrossTier } from '../game/skills/definitions';
import { applyUniverseToStage, getEndingOptions } from '../game/multiverse';
import { StageLogToast } from './StageLogToast';
import { AlmanacOverlay } from './AlmanacOverlay';

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
  anchor: 'skills' | 'shop' | 'resource';
  message: string;
  ctaLabel?: string;
  onCta?: () => void;
}

type TransitionPhase = 'idle' | 'bursting' | 'quote' | 'revealing';
type StatPopupTrack = 'click' | 'auto' | 'crit' | 'time';

interface GameScreenProps {
  state: GameState;
  dispatch: Dispatch<GameAction>;
  soundManager: SoundManager | null;
  muted: boolean;
  onToggleMute: () => void;
  onRequestReset: () => void;
}

function EndingCinematic({
  endingId,
  onComplete,
}: {
  endingId: EndingId | null;
  onComplete: () => void;
}) {
  if (endingId === 'big_crunch') {
    return <BigCrunchEnding onComplete={onComplete} />;
  }
  if (endingId === 'big_rip') {
    return <BigRipEnding onComplete={onComplete} />;
  }
  if (endingId === 'vacuum_decay') {
    return <VacuumDecayEnding onComplete={onComplete} />;
  }
  if (endingId === 'heat_death') {
    return <HeatDeathEnding onComplete={onComplete} />;
  }
  if (endingId === 'bounce') {
    return <BounceEnding onComplete={onComplete} />;
  }
  return null;
}

export function GameScreen({
  state,
  dispatch,
  soundManager,
  muted,
  onToggleMute,
  onRequestReset,
}: GameScreenProps) {
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [almanacOpen, setAlmanacOpen] = useState(false);
  const [statPopup, setStatPopup] = useState<{ trackId: StatPopupTrack; x: number; y: number } | null>(null);
  const skillsAnchorRef = useRef<HTMLDivElement | null>(null);
  const shopAnchorRef = useRef<HTMLDivElement | null>(null);
  const resourceAnchorRef = useRef<HTMLDivElement | null>(null);
  const rawStage = STAGES[state.stageIdx];
  const stage = useMemo(
    () => applyUniverseToStage(rawStage, state.currentUniverseSeed),
    [rawStage, state.currentUniverseSeed],
  );
  const mechanic = getMechanic(stage.mechanic);
  const effectiveThreshold = getEffectiveThreshold(stage, state.cumulativeBoost);
  const progress01 = getProgress(state.quanta, effectiveThreshold);
  const modifiers = getActiveModifiers(state.skills, {
    currentQuanta: state.quanta,
    stagesCleared: state.stageIdx,
    secondsInStage: Math.max(0, (Date.now() - state.stageStartedAt) / 1000),
    stageId: stage.id,
    progress01,
    clickLevel: state.skills.click.level,
  });
  const autoRate = getAutoRate(modifiers);
  const clickPower = getClickPower(modifiers);
  const critMultiplier = getCritMultiplier(state.skills.crit.level, modifiers);
  const timeMult = getTimeMultiplier(state.skills.time.level, modifiers);
  const timeGauge = getTimeGaugeForCosmicClock(state.stageIdx, state.cosmicClockSec);
  const timeProgress01 = Math.min(1, timeGauge / 100);
  const clickEmissionCount =
    modifiers.clickEmissionCount * (state.currentUniverseSeed.anomaly === 'echoing' ? 2 : 1);
  const entropyPreview = getEntropyOnCondense(state.quanta, effectiveThreshold);
  const endingOptions = getEndingOptions(state, Date.now());
  const canChooseEnding =
    stage.id === STAGES.length &&
    state.pendingCondenseStageIdx === null &&
    state.selectedEndingId === null &&
    state.quanta >= effectiveThreshold &&
    state.cosmicClockSec >= stage.cosmicTimeSec;
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
    state.selectedEndingId !== null;
  const [floatingEntries, setFloatingEntries] = useState<FloatingEntry[]>([]);
  const [encounterEntries, setEncounterEntries] = useState<EncounterEntry[]>([]);
  const [shakeClass, setShakeClass] = useState('');
  const logicAccumulator = useRef(0);
  const lastWhooshAt = useRef(0);
  const civPlayed = useRef(false);
  const lastToastStageIdRef = useRef(stage.id);
  void lastToastStageIdRef; // suppress unused-variable lint
  const timeFlowRate = getTimeFillRate(stage, state.skills.time.level, modifiers);
  const cosmicClockFromGauge = state.cosmicClockSec;
  const displayedCosmicClock =
    state.currentUniverseSeed.anomaly === 'inverted_time'
      ? Math.max(
          getStageStartCosmicTime(state.stageIdx),
          stage.cosmicTimeSec - (cosmicClockFromGauge - getStageStartCosmicTime(state.stageIdx)),
        )
      : cosmicClockFromGauge;
  const canShowSkills = stage.id >= 2;
  const canShowShop = state.universeCount > 1 || stage.id >= 6;
  const statPopupTree = statPopup ? SKILL_TREES.find((tree) => tree.id === statPopup.trackId) : null;
  const statPopupLevel = statPopup ? state.skills[statPopup.trackId].level : 0;
  const statPopupNextLevel = statPopupLevel + 1;
  const statPopupUnlocked = statPopup ? state.skills.unlockedTracks.includes(statPopup.trackId) : false;
  const statPopupCost = statPopupTree ? Math.ceil(statPopupTree.rootCostCurve(statPopupNextLevel)) : 0;
  const statPopupCanBuy = Boolean(statPopup && statPopupUnlocked && state.quanta >= statPopupCost);
  const hasAffordableSkill = useMemo(
    () => {
      const canBuyTrack = SKILL_TREES.some((tree) => {
        const trackId = tree.id;
        if (!state.skills.unlockedTracks.includes(trackId)) return false;
        const level = state.skills[trackId].level;
        return state.quanta >= Math.ceil(tree.rootCostCurve(level + 1));
      });
      if (canBuyTrack) return true;
      const visibleTier = getVisibleCrossTier(stage.id);
      return CROSS_NODES.some((node) => {
        if (node.tier > visibleTier) return false;
        if (state.skills.ownedCrossNodes.includes(node.id)) return false;
        const meetsRequirements = Object.entries(node.requires).every(([trackId, requiredLevel]) => {
          return state.skills[trackId as 'click' | 'auto' | 'crit' | 'time'].level >= (requiredLevel ?? 0);
        });
        return meetsRequirements && state.quanta >= node.cost && state.skillPoints >= node.spCost;
      });
    },
    [stage.id, state.quanta, state.skillPoints, state.skills],
  );
  const activeTutorialBubble = useMemo<TutorialBubble | null>(() => {
    if (state.universeCount !== 1 || state.tutorialFlags.allDismissed) {
      return null;
    }
    const stageBubbles: Record<number, string> = {
      2: 'Stellar Forge unlocked. Your clicks grow stronger.',
      3: 'Cosmic Web unlocked. Quanta begin gathering on their own.',
      4: 'Quantum Lens unlocked. Critical hits begin from this stage.',
      5: 'Aeon Drive unlocked. Bend the flow of cosmic time.',
    };
    const stageFlag = `stage-${stage.id}-skills`;
    if (stageBubbles[stage.id] && !state.tutorialFlags[stageFlag] && canShowSkills) {
      return {
        flagId: stageFlag,
        anchor: 'skills',
        message: stageBubbles[stage.id],
        ctaLabel: 'Open Skills',
        onCta: () => setSkillsOpen(true),
      };
    }
    if (stage.id >= 5 && !state.tutorialFlags['time-gauge-visible']) {
      return {
        flagId: 'time-gauge-visible',
        anchor: 'resource',
        message: 'Cosmic time accumulates. Aeon Drive levels speed it up.',
      };
    }
    if (canShowShop && !state.tutorialFlags['shop-visible']) {
      return {
        flagId: 'shop-visible',
        anchor: 'shop',
        message: 'Cosmic Shop has temporary boosts. Free in test mode.',
        ctaLabel: 'Open Shop',
        onCta: () => setShopOpen(true),
      };
    }
    if (canCondense && !state.tutorialFlags['condense-ready']) {
      return {
        flagId: 'condense-ready',
        anchor: 'resource',
        message: 'Both gauges are full. Press Condense to advance.',
      };
    }
    return null;
  }, [
    canCondense,
    canShowShop,
    canShowSkills,
    stage.id,
    state.tutorialFlags,
    state.universeCount,
  ]);


  useGameLoop((now, dt) => {
    logicAccumulator.current += dt;
    while (logicAccumulator.current >= TUNING.LOGIC_TICK_MS) {
      dispatch({ type: 'TICK', now, dt: TUNING.LOGIC_TICK_MS });
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
    soundManager?.setStage(stage.id - 1, stage.silenceBeforeMs ?? 0);
  }, [soundManager, stage.id, stage.silenceBeforeMs]);

  useEffect(() => {
    if (stage.mechanic === 'life_evolution' && progress01 >= 0.99 && !civPlayed.current) {
      civPlayed.current = true;
      soundManager?.playCivilizationFlicker();
    }
    if (stage.mechanic !== 'life_evolution' || progress01 < 0.99) {
      civPlayed.current = false;
    }
  }, [progress01, soundManager, stage.mechanic]);

  useEffect(() => {
    if (!state.lastClickEvent) {
      return undefined;
    }
    const event = state.lastClickEvent;
    const emissionCount = Math.max(1, clickEmissionCount);
    const text = event.isCrit
      ? `CRIT +${formatWhole(event.gained)}`
      : event.comboMult > 1
        ? `+${formatWhole(event.gained)} ×${formatWhole(event.comboMult)}`
        : `+${formatWhole(event.gained)}`;
    setFloatingEntries((current) => [
      ...current.slice(-TUNING.MAX_FLOATING_NUMBERS + emissionCount),
      ...Array.from({ length: emissionCount }, (_, index) => {
        const angle = (index / emissionCount) * Math.PI * 2 + Math.random() * 0.3;
        const radius = emissionCount > 1 ? 12 + index * 4 : 0;
        const variant: FloatingEntry['variant'] = event.isCrit ? 'crit' : 'normal';
        return {
          id: event.id * 100 + index,
          x: event.x + Math.cos(angle) * radius,
          y: event.y + Math.sin(angle) * radius - index * 6,
          text,
          particleName: event.particleName,
          particleDefinition: event.particleDefinition,
          entropyGained: event.entropyGained,
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
    setFloatingEntries((current) => [
      ...current,
      {
        id: event.id,
        x: event.x,
        y: event.y,
        text: `+${formatWhole(event.bonus)} · ${event.name.toUpperCase()}`,
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
  }, [dispatch, soundManager, state.lastCollisionEvent]);

  useEffect(() => {
    if (!state.lastEncounterEvent) {
      return undefined;
    }
    const event = state.lastEncounterEvent;
    setEncounterEntries((current) => [...current, event]);
    dispatch({ type: 'CLEAR_ENCOUNTER_EVENT', id: event.id });
    const timeoutId = window.setTimeout(() => {
      setEncounterEntries((current) => current.filter((entry) => entry.id !== event.id));
    }, TUNING.ENCOUNTER_ALERT_MS);
    return () => window.clearTimeout(timeoutId);
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
    setTransitionPhase('bursting');
    setShakeClass('shake-big');
    soundManager?.playCondenseExplosion();
  }, [soundManager, state.imploding, state.pendingCondenseStageIdx, transitionPhase]);

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
      style={{ '--accent': stage.accent, '--core': stage.coreColor } as CSSProperties}
    >
      <main className="field">
        {import.meta.env.DEV ? (
          <div className="admin-panel">
            <button
              className="mini-button admin-button"
              type="button"
              onClick={() => dispatch({ type: 'ADMIN_RESTART_RUN', now: Date.now() })}
            >
              RESTART RUN
            </button>
            <button
              className="mini-button admin-button"
              type="button"
              onClick={() => dispatch({ type: 'ADMIN_NEXT_STAGE', now: Date.now() })}
            >
              NEXT STAGE
            </button>
          </div>
        ) : null}
        <ParticleField
          stage={stage}
          quanta={state.quanta}
          autoRate={autoRate}
          timeMult={timeMult}
          cosmicClockSec={state.cosmicClockSec}
          effectiveThreshold={effectiveThreshold}
          totalClicks={state.totalClicks}
          imploding={state.imploding}
          interactionLocked={interactionLocked}
          lastClickEvent={state.lastClickEvent}
          stageTransitionStartedAt={transitionPhase === 'revealing' ? revealStartedAt : null}
          clickEmissionCount={clickEmissionCount}
          clickVfxScale={modifiers.clickVfxScale}
          gravityMod={state.currentUniverseSeed.gravityMod}
          anomaly={state.currentUniverseSeed.anomaly}
          onGatherClick={(x, y, forceCrit) => {
            const mechanicResult = mechanic.onClick?.({
              state,
              stage,
              now: performance.now(),
              progress01,
              x,
              y,
            });
            dispatch({
              type: 'CLICK',
              now: performance.now(),
              randomValue: Math.random(),
              x,
              y,
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
          <ShopPanel state={state} dispatch={dispatch} onClose={() => setShopOpen(false)} />
        ) : null}
        {skillsOpen && canShowSkills ? (
          <SkillsPanel state={state} dispatch={dispatch} onClose={() => setSkillsOpen(false)} />
        ) : null}
        <div className="hud-info" ref={resourceAnchorRef}>
          <div className="hud-stage-title">{`Stage ${stage.id}: ${stage.name}`}</div>
          <div className="hud-quanta">{`Quanta ${formatGameNumber(state.quanta)} / ${formatGameNumber(effectiveThreshold)}`}</div>
          <div className="hud-gauge hud-quanta-gauge" aria-label="Quanta progress">
            <div className="hud-gauge-fill hud-quanta-fill" style={{ width: `${Math.min(100, progress01 * 100)}%` }} />
          </div>
          <div className="hud-cosmic-time">{formatCosmicTime(displayedCosmicClock)}</div>
          <div className="hud-gauge hud-time-gauge" aria-label="Cosmic time gauge">
            <div className="hud-gauge-fill hud-time-fill" style={{ width: `${Math.min(100, timeProgress01 * 100)}%` }} />
          </div>
          <button
            type="button"
            className="hud-condense"
            disabled={!canCondense}
            title={canCondense ? `Condense for ${formatWhole(entropyPreview)} entropy` : condenseHint}
            onClick={() => dispatch({ type: 'START_CONDENSE', now: performance.now() })}
          >
            Condense
          </button>
        </div>
        <div className="stat-header" aria-label="Core stats">
          <button
            className="stat-header-item"
            type="button"
            onClick={(event) => setStatPopup({ trackId: 'click', x: event.clientX, y: event.clientY })}
          >
            {`Quanta x${formatWhole(clickPower)}`}
          </button>
          <button
            className="stat-header-item"
            type="button"
            onClick={(event) => setStatPopup({ trackId: 'auto', x: event.clientX, y: event.clientY })}
          >
            {`Auto ${formatRate(autoRate)}`}
          </button>
          {stage.id > 2 ? (
            <button
              className="stat-header-item"
              type="button"
              onClick={(event) => setStatPopup({ trackId: 'crit', x: event.clientX, y: event.clientY })}
            >
              {`Crit x${formatWhole(critMultiplier)}`}
            </button>
          ) : null}
          <button
            className="stat-header-item"
            type="button"
            onClick={(event) => setStatPopup({ trackId: 'time', x: event.clientX, y: event.clientY })}
          >
            {`Time x${formatWhole(timeMult)}`}
          </button>
          <span className="stat-header-item stat-header-readout">{`Entropy ${formatWhole(state.entropy)}`}</span>
        </div>
        {statPopup && statPopupTree ? (
          <div
            className="stat-upgrade-popup"
            style={{
              left: Math.max(12, Math.min(window.innerWidth - 224, statPopup.x - 100)),
              top: Math.max(48, statPopup.y + 14),
            }}
          >
            <button
              type="button"
              className="popup-close"
              aria-label="Close stat upgrade"
              onClick={() => setStatPopup(null)}
            >
              x
            </button>
            <strong>{`${statPopupTree.label} Lv ${statPopupLevel} -> ${statPopupNextLevel}`}</strong>
            <span>{`Cost: ${formatGameNumber(statPopupCost)} quanta`}</span>
            {!statPopupUnlocked ? <span>{`Unlocks at Stage ${statPopupTree.unlockStageId}`}</span> : null}
            <button
              type="button"
              className="q-continue stat-buy"
              disabled={!statPopupCanBuy}
              onClick={() => {
                dispatch({ type: 'BUY_TRACK_LEVEL', trackId: statPopup.trackId });
                setStatPopup(null);
              }}
            >
              BUY +1
            </button>
          </div>
        ) : null}
        <div className="hud-controls">
          <button type="button" className="mini-button" onClick={() => setAlmanacOpen(true)}>
            INFO
          </button>
          <button type="button" className="mini-button" onClick={onToggleMute}>
            {muted ? 'SOUND' : 'MUTE'}
          </button>
          <button type="button" className="mini-button" onClick={onRequestReset}>
            RESET
          </button>
        </div>
        <div className="bottom-buttons">
          {canShowSkills ? (
            <div ref={skillsAnchorRef}>
              <SkillsButton highlighted={hasAffordableSkill} onClick={() => setSkillsOpen(true)} />
            </div>
          ) : null}
          {canShowShop ? (
            <div ref={shopAnchorRef}>
              <ShopButton
                highlighted={state.shopBoosts.some((boost) => boost.expiresAt > Date.now())}
                onClick={() => setShopOpen(true)}
              />
            </div>
          ) : null}
        </div>
        <div className={`stage-transition-wash ${transitionPhase === 'bursting' ? 'active' : ''}`} />
        <div className={`stage-reveal-fade ${transitionPhase === 'revealing' ? 'active' : ''}`} />
        <ScaleIndicator stageId={stage.id} />
        <ActiveBoostHud boosts={state.shopBoosts} />
        <StageLogToast stageId={stage.id} progressPercent={Math.floor(progress01 * 100)} />
        {floatingEntries.map((entry) => (
          <FloatingNumber
            key={entry.id}
            x={entry.x}
            y={entry.y}
            text={entry.text}
            particleName={entry.particleName}
            particleDefinition={entry.particleDefinition}
            entropyGained={entry.entropyGained}
            variant={entry.variant}
            stageId={stage.id}
            delayMs={entry.delayMs}
          />
        ))}
        {encounterEntries.map((entry) => (
          <EncounterAlert key={entry.id} color={entry.color} name={entry.name} />
        ))}
      </main>

      {state.pendingCondenseStageIdx !== null && !state.imploding && transitionPhase === 'quote' ? (
        <QuoteOverlay
          stage={STAGES[state.pendingCondenseStageIdx]}
          visible
          onContinue={() => {
            setRevealStartedAt(performance.now());
            setTransitionPhase('revealing');
            dispatch({ type: 'ADVANCE_STAGE', now: performance.now() });
          }}
        />
      ) : null}

      {state.offlineElapsedMs > 0 ? (
        <OfflineProgressModal
          awayMs={state.offlineElapsedMs}
          gained={state.offlineGained}
          onDismiss={() => dispatch({ type: 'DISMISS_OFFLINE_MODAL' })}
        />
      ) : null}

      {almanacOpen ? (
        <AlmanacOverlay
          currentStageId={stage.id}
          progressPercent={Math.floor(progress01 * 100)}
          onClose={() => setAlmanacOpen(false)}
        />
      ) : null}

      {activeTutorialBubble ? (
        <SpeechBubble
          anchorRef={
            activeTutorialBubble.anchor === 'skills'
              ? skillsAnchorRef
              : activeTutorialBubble.anchor === 'shop'
                ? shopAnchorRef
                : resourceAnchorRef
          }
          position={activeTutorialBubble.anchor === 'resource' ? 'top' : 'left'}
          message={activeTutorialBubble.message}
          ctaLabel={activeTutorialBubble.ctaLabel}
          onCta={
            activeTutorialBubble.onCta
              ? () => {
                  dispatch({ type: 'MARK_TUTORIAL_FLAG', flagId: activeTutorialBubble.flagId });
                  activeTutorialBubble.onCta?.();
                }
              : undefined
          }
          onDismiss={() => dispatch({ type: 'MARK_TUTORIAL_FLAG', flagId: activeTutorialBubble.flagId })}
        />
      ) : null}

      {canChooseEnding ? (
        <EndingChooser
          options={endingOptions}
          onChoose={(endingId) => {
            soundManager?.playEndingSting(endingId);
            dispatch({ type: 'SELECT_ENDING', endingId, now: performance.now() });
          }}
        />
      ) : null}

      {state.selectedEndingId !== null ? (
        <EndingCinematic
          endingId={state.selectedEndingId}
          onComplete={() => dispatch({ type: 'COMPLETE_ENDING', now: performance.now() })}
        />
      ) : null}
    </div>
  );
}
