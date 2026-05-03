import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, Dispatch } from 'react';
import { TUNING } from '../game/constants';
import {
  formatCosmicTime,
  formatRate,
  formatWhole,
  getAutoCost,
  getAutoRate,
  getClickCost,
  getClickPower,
  getComboMult,
  getCritCost,
  getCritMultiplier,
  getEffectiveThreshold,
  getEndingOptions,
  getEntropyOnCondense,
  getLifeStepLabel,
  getProgress,
} from '../game/formulas';
import { getMechanic } from '../game/mechanics';
import type { GameAction } from '../game/reducer';
import { STAGES } from '../game/stages';
import { getCosmicTimePerRealSec } from '../game/timeFlow';
import type { SoundManager } from '../game/audio';
import type { EndingId, GameState } from '../game/types';
import { EncounterAlert } from './EncounterAlert';
import { FloatingNumber } from './FloatingNumber';
import { ParticleField } from './ParticleField';
import { QuoteOverlay } from './QuoteOverlay';
import { ResourcePanel } from './ResourcePanel';
import { Timeline } from './Timeline';
import { UpgradePanel } from './UpgradePanel';
import { useGameLoop } from '../hooks/useGameLoop';
import { OfflineProgressModal } from './OfflineProgressModal';
import { EndingChooser } from './EndingChooser';
import { BigCrunchEnding } from './endings/BigCrunchEnding';
import { BigRipEnding } from './endings/BigRipEnding';
import { HeatDeathEnding } from './endings/HeatDeathEnding';
import { VacuumDecayEnding } from './endings/VacuumDecayEnding';

interface FloatingEntry {
  id: number;
  x: number;
  y: number;
  text: string;
  variant: 'normal' | 'crit' | 'collision';
}

interface EncounterEntry {
  id: number;
  name: string;
  color: string;
}

type TransitionPhase = 'idle' | 'bursting' | 'quote' | 'revealing';

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
  const stage = STAGES[state.stageIdx];
  const previousStage = state.stageIdx > 0 ? STAGES[state.stageIdx - 1] : null;
  const mechanic = getMechanic(stage.mechanic);
  const effectiveThreshold = getEffectiveThreshold(stage, state.cumulativeBoost);
  const progress01 = getProgress(state.quanta, effectiveThreshold);
  const autoRate = getAutoRate(stage, state.autoLevel, state.cumulativeBoost);
  const clickPower = getClickPower(stage, state.clickLevel, state.cumulativeBoost);
  const clickCost = getClickCost(stage, state.clickLevel);
  const autoCost = getAutoCost(stage, state.autoLevel);
  const critCost = getCritCost(stage, state.critLevel);
  const critMultiplier = getCritMultiplier(state.critLevel);
  const entropyPreview = getEntropyOnCondense(state.quanta, effectiveThreshold);
  const endingOptions = getEndingOptions(
    state.cumulativeBoost,
    state.condensedMass,
    state.singularityUnlocks,
  );
  const canChooseEnding =
    stage.id === STAGES.length &&
    state.pendingCondenseStageIdx === null &&
    state.selectedEndingId === null &&
    state.quanta >= effectiveThreshold;
  const canCondense =
    stage.id !== STAGES.length &&
    state.pendingCondenseStageIdx === null &&
    !state.completedRun &&
    state.quanta >= effectiveThreshold;
  const [transitionPhase, setTransitionPhase] = useState<TransitionPhase>('idle');
  const [postCondenseBurstStartedAt, setPostCondenseBurstStartedAt] = useState<number | null>(null);
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
  const stagePositions = useMemo(
    () => STAGES.map((entry) => ({ id: entry.id, left: entry.timelinePos, label: entry.name })),
    [],
  );
  const timeFlowRate = getCosmicTimePerRealSec(stage, previousStage, progress01);

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
    const text = event.isCrit
      ? `CRIT +${formatWhole(event.gained)}`
      : event.comboMult > 1
        ? `+${formatWhole(event.gained)} ×${event.comboMult.toFixed(2)}`
        : `+${formatWhole(event.gained)}`;
    setFloatingEntries((current) => [
      ...current,
      {
        id: event.id,
        x: event.x,
        y: event.y,
        text,
        variant: event.isCrit ? 'crit' : 'normal',
      },
    ]);
    soundManager?.playClick(state.stageIdx, event.isCrit);
    dispatch({ type: 'CLEAR_CLICK_EVENT', id: event.id });
    const timeoutId = window.setTimeout(() => {
      setFloatingEntries((current) => current.filter((entry) => entry.id !== event.id));
    }, event.isCrit ? TUNING.FLOAT_CRIT_MS : TUNING.FLOAT_NORMAL_MS);
    return () => window.clearTimeout(timeoutId);
  }, [dispatch, soundManager, state.lastClickEvent, state.stageIdx]);

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
      setPostCondenseBurstStartedAt(null);
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
    const startedAt = performance.now();
    setPostCondenseBurstStartedAt(startedAt);
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
    const washTimeoutId = window.setTimeout(() => {
      setPostCondenseBurstStartedAt(null);
    }, TUNING.STAGE_TRANSITION_TOTAL_MS);
    return () => {
      window.clearTimeout(quoteTimeoutId);
      window.clearTimeout(washTimeoutId);
    };
  }, [transitionPhase]);

  useEffect(() => {
    if (transitionPhase !== 'revealing') {
      return;
    }
    const revealTimeoutId = window.setTimeout(() => {
      setTransitionPhase('idle');
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
      <Timeline
        timelinePos={stage.timelinePos}
        cosmicClockLabel={formatCosmicTime(state.cosmicClockSec)}
        stageTimeLabel={stage.time}
        stagePositions={stagePositions}
        currentStageId={stage.id}
        entropy={formatWhole(state.entropy)}
        comboVisible={state.combo > 1}
        comboMult={getComboMult(state.combo, state.singularityUnlocks.includes('free_combo') ? 2 : 0).toFixed(2)}
        universeLabel={state.universeCount > 1 ? `Universe #${state.universeCount}` : null}
        muted={muted}
        onToggleMute={onToggleMute}
        onRequestReset={onRequestReset}
      />

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
          key={stage.id}
          stage={stage}
          quanta={state.quanta}
          autoRate={autoRate}
          effectiveThreshold={effectiveThreshold}
          totalClicks={state.totalClicks}
          imploding={state.imploding}
          interactionLocked={interactionLocked}
          lastClickEvent={state.lastClickEvent}
          stageTransitionStartedAt={postCondenseBurstStartedAt}
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
        <div className={`stage-transition-wash ${transitionPhase === 'bursting' ? 'active' : ''}`} />
        <div className="stage-info">
          <div className="stage-num">{`STAGE ${String(stage.id).padStart(2, '0')} / ${String(STAGES.length).padStart(2, '0')}`}</div>
          <div className="stage-name">{stage.name}</div>
          <div className="stage-mechanic">{mechanic.tutorial}</div>
          {stage.mechanic === 'life_evolution' ? (
            <div className="stage-subbeat">{getLifeStepLabel(state.mechanicStep)}</div>
          ) : null}
        </div>
        {state.totalClicks === 0 ? (
          <div className="stage-hint">click to gather · click direction steers your universe</div>
        ) : null}
        {floatingEntries.map((entry) => (
          <FloatingNumber key={entry.id} x={entry.x} y={entry.y} text={entry.text} variant={entry.variant} />
        ))}
        {encounterEntries.map((entry) => (
          <EncounterAlert key={entry.id} color={entry.color} name={entry.name} />
        ))}
        {stage.mechanic === 'dark_age' ? (
          <button className="dark-age-skip" type="button" onClick={() => dispatch({ type: 'SPEND_DARK_AGE_SKIP' })}>
            Spend 100 entropy to skip 10%
          </button>
        ) : null}
      </main>

      <footer className="panel">
        <ResourcePanel
          label={stage.resource}
          quanta={formatWhole(state.quanta)}
          threshold={formatWhole(effectiveThreshold)}
          rate={formatRate(autoRate)}
          progressPercent={progress01 * 100}
          canCondense={canCondense}
          entropyPreview={entropyPreview}
        />
        <UpgradePanel
          clickUpgrade={{
            label: `${stage.clickUpgradeName} · Click Power`,
            level: state.clickLevel,
            cost: clickCost,
            description: `Power ${formatWhole(clickPower)} per click`,
            disabled: interactionLocked || state.quanta < clickCost,
          }}
          autoUpgrade={{
            label: `${stage.autoUpgradeName} · Auto Rate`,
            level: state.autoLevel,
            cost: autoCost,
            description: `${formatRate(autoRate)} ${stage.resource.toLowerCase()}/s`,
            disabled: interactionLocked || state.quanta < autoCost,
          }}
          critUpgrade={{
            label: 'Critical Lens · Crit Multiplier',
            level: state.critLevel,
            cost: critCost,
            description: `Critical hits pay ×${critMultiplier.toFixed(1)} · click rogues to crit`,
            disabled: interactionLocked || state.quanta < critCost,
          }}
          canCondense={canCondense}
          entropyPreview={entropyPreview}
          onBuyClick={() => dispatch({ type: 'BUY_CLICK' })}
          onBuyAuto={() => dispatch({ type: 'BUY_AUTO' })}
          onBuyCrit={() => dispatch({ type: 'BUY_CRIT' })}
          onCondense={() => dispatch({ type: 'START_CONDENSE', now: performance.now() })}
        />
      </footer>

      {state.pendingCondenseStageIdx !== null && !state.imploding && transitionPhase === 'quote' ? (
        <QuoteOverlay
          stage={STAGES[state.pendingCondenseStageIdx]}
          visible
          onContinue={() => {
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
