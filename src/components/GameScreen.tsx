import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, Dispatch } from 'react';
import { TUNING } from '../game/constants';
import {
  formatCosmicTime,
  formatGameNumber,
  formatRate,
  formatWhole,
  getAutoRate,
  getClickPower,
  getComboMult,
  getCritMultiplier,
  getEffectiveThreshold,
  getEntropyOnCondense,
  getLifeStepLabel,
  getProgress,
} from '../game/formulas';
import { getActiveModifiers } from '../game/skills/effects';
import { getMechanic } from '../game/mechanics';
import type { GameAction } from '../game/reducer';
import { STAGES } from '../game/stages';
import { getCosmicTimePerRealSec, getStageStartCosmicTime } from '../game/timeFlow';
import type { SoundManager } from '../game/audio';
import type { EndingId, GameState } from '../game/types';
import { EncounterAlert } from './EncounterAlert';
import { FloatingNumber } from './FloatingNumber';
import { ParticleField } from './ParticleField';
import { QuoteOverlay } from './QuoteOverlay';
import { ResourcePanel } from './ResourcePanel';
import { Timeline } from './Timeline';
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
import { ALMANAC } from '../game/almanac';
import { applyUniverseToStage, getAnomalyLabel, getEndingOptions } from '../game/multiverse';

interface FloatingEntry {
  id: number;
  x: number;
  y: number;
  text: string;
  particleName?: string;
  particleDefinition?: string;
  variant: 'normal' | 'crit' | 'collision';
}

interface EncounterEntry {
  id: number;
  name: string;
  color: string;
}

interface TutorialStagePopup {
  stageId: number;
  title: string;
  body: string;
  openSkills: boolean;
}

interface AlmanacToast {
  stageId: number;
  text: string;
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
  const [almanacOpen, setAlmanacOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState<1 | 2 | 3>(1);
  const [tutorialPopup, setTutorialPopup] = useState<TutorialStagePopup | null>(null);
  const [almanacToast, setAlmanacToast] = useState<AlmanacToast | null>(null);
  const rawStage = STAGES[state.stageIdx];
  const stage = useMemo(
    () => applyUniverseToStage(rawStage, state.currentUniverseSeed),
    [rawStage, state.currentUniverseSeed],
  );
  const previousStage = state.stageIdx > 0 ? STAGES[state.stageIdx - 1] : null;
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
  const autoRate = getAutoRate(modifiers) * modifiers.timeMultMult;
  const clickPower = getClickPower(modifiers);
  const critMultiplier = getCritMultiplier(modifiers);
  const clickEmissionCount =
    modifiers.clickEmissionCount * (state.currentUniverseSeed.anomaly === 'echoing' ? 2 : 1);
  const entropyPreview = getEntropyOnCondense(state.quanta, effectiveThreshold);
  const endingOptions = getEndingOptions(state, Date.now());
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
  const lastToastStageId = useRef(stage.id);
  const stagePositions = useMemo(
    () => STAGES.map((entry) => ({ id: entry.id, left: entry.timelinePos, label: entry.name })),
    [],
  );
  const timeMult = modifiers.timeMultMult;
  const timeFlowRate =
    getCosmicTimePerRealSec(stage, previousStage, timeMult) * state.currentUniverseSeed.timeMod;
  const displayedCosmicClock =
    state.currentUniverseSeed.anomaly === 'inverted_time'
      ? Math.max(
          getStageStartCosmicTime(state.stageIdx),
          stage.cosmicTimeSec - (state.cosmicClockSec - getStageStartCosmicTime(state.stageIdx)),
        )
      : state.cosmicClockSec;
  const canShowSkills = state.universeCount > 1 || state.stageIdx > 0;
  const hasAffordableSkill = useMemo(
    () => {
      const visibleTier = getVisibleCrossTier(stage.id);
      const canBuyTrack = state.skills.unlockedTracks.some((trackId) => {
        const tree = SKILL_TREES.find((entry) => entry.id === trackId);
        if (!tree) return false;
        const level = state.skills[trackId].level;
        if (level >= tree.rootMaxLevel) return false;
        return state.quanta >= Math.ceil(tree.rootCostCurve(level + 1));
      });
      if (canBuyTrack) return true;
      return CROSS_NODES.some((node) => {
        if (node.tier > visibleTier) return false;
        if (state.skills.ownedCrossNodes.includes(node.id)) return false;
        const meetsRequirements = Object.entries(node.requires).every(([trackId, requiredLevel]) => {
          return state.skills[trackId as 'click' | 'auto' | 'crit' | 'time'].level >= (requiredLevel ?? 0);
        });
        return meetsRequirements && state.quanta >= node.cost;
      });
    },
    [stage.id, state.quanta, state.skills],
  );

  useEffect(() => {
    const popupByStage: Record<number, TutorialStagePopup> = {
      2: {
        stageId: 2,
        title: 'Stellar Forge unlocked',
        body: 'Buy levels of click power.',
        openSkills: true,
      },
      3: {
        stageId: 3,
        title: 'Quantum Lens unlocked',
        body: 'Critical hits multiply rewards.',
        openSkills: true,
      },
      4: {
        stageId: 4,
        title: 'Cosmic Web unlocked',
        body: 'The universe gathers itself.',
        openSkills: true,
      },
      5: {
        stageId: 5,
        title: 'Aeon Drive unlocked',
        body: 'Time itself can be sped up.',
        openSkills: true,
      },
      7: {
        stageId: 7,
        title: 'Cross-skill nodes are now visible',
        body: 'Some require two skills together.',
        openSkills: true,
      },
      11: {
        stageId: 11,
        title: 'Higher-tier cross-skills unlocked',
        body: 'Level 20 in two tracks now reveals stronger pairings.',
        openSkills: true,
      },
      14: {
        stageId: 14,
        title: 'Late-game cross-skills unlocked',
        body: 'These nodes are extremely powerful.',
        openSkills: true,
      },
      15: {
        stageId: 15,
        title: 'The Apex node is now in view',
        body: 'It requires all four tracks at level 30.',
        openSkills: true,
      },
    };

    if (stage.id !== lastToastStageId.current) {
      lastToastStageId.current = stage.id;
      setAlmanacToast({
        stageId: stage.id,
        text: ALMANAC[stage.id]?.short ?? stage.quote,
      });
    }

    if (state.universeCount !== 1 || state.tutorialFlags[stage.id]) {
      return;
    }
    const nextPopup = popupByStage[stage.id];
    if (!nextPopup) {
      return;
    }
    setTutorialPopup(nextPopup);
  }, [stage.id, stage.quote, state.tutorialFlags, state.universeCount]);

  useEffect(() => {
    if (!almanacToast) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setAlmanacToast((current) => (current?.stageId === almanacToast.stageId ? null : current));
    }, 3000);
    return () => window.clearTimeout(timeoutId);
  }, [almanacToast]);

  useEffect(() => {
    if (!tutorialPopup) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        dispatch({ type: 'MARK_TUTORIAL_STAGE_SEEN', stageId: tutorialPopup.stageId });
        setTutorialPopup(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dispatch, tutorialPopup]);

  useEffect(() => {
    if (state.tutorialDone) {
      return;
    }
    if (state.totalClicks >= 5 && tutorialStep === 1) {
      setTutorialStep(2);
    }
    if (skillsOpen && tutorialStep === 2) {
      setTutorialStep(3);
    }
  }, [skillsOpen, state.totalClicks, state.tutorialDone, tutorialStep]);

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
      ...current,
      ...Array.from({ length: emissionCount }, (_, index) => {
        const angle = (index / emissionCount) * Math.PI * 2;
        const radius = emissionCount > 1 ? 10 + emissionCount * 2 : 0;
        const variant: FloatingEntry['variant'] = event.isCrit ? 'crit' : 'normal';
        return {
          id: event.id * 100 + index,
          x: event.x + Math.cos(angle) * radius,
          y: event.y + Math.sin(angle) * radius * 0.7,
          text,
          particleName: event.particleName,
          particleDefinition: event.particleDefinition,
          variant,
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
        cosmicClockLabel={formatCosmicTime(displayedCosmicClock)}
        stageTimeLabel={stage.time}
        stagePositions={stagePositions}
        currentStageId={stage.id}
        entropy={formatWhole(state.entropy)}
        comboVisible={state.combo > 1}
        comboMult={formatWhole(
          getComboMult(state.combo, state.singularityUnlocks.includes('free_combo') ? 2 : 0),
        )}
        universeLabel={state.universeCount > 1 ? `Universe #${state.universeCount}` : null}
        muted={muted}
        onToggleMute={onToggleMute}
        onOpenInfo={() => setAlmanacOpen(true)}
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
          timeMult={timeMult}
          effectiveThreshold={effectiveThreshold}
          totalClicks={state.totalClicks}
          imploding={state.imploding}
          interactionLocked={interactionLocked}
          lastClickEvent={state.lastClickEvent}
          stageTransitionStartedAt={postCondenseBurstStartedAt}
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
        {canShowSkills ? (
          <div className="skills-toggle">
            <SkillsButton
              highlighted={hasAffordableSkill}
              onClick={() => setSkillsOpen(true)}
            />
          </div>
        ) : null}
        {skillsOpen && canShowSkills ? (
          <SkillsPanel state={state} dispatch={dispatch} onClose={() => setSkillsOpen(false)} />
        ) : null}
        <div className={`stage-transition-wash ${transitionPhase === 'bursting' ? 'active' : ''}`} />
        <div className="stage-info">
          <div className="stage-num">{`STAGE ${String(stage.id).padStart(2, '0')} / ${String(STAGES.length).padStart(2, '0')}`}</div>
          <div className="stage-name">{stage.name}</div>
          <div className="stage-mechanic">{mechanic.tutorial}</div>
          {stage.mechanic === 'life_evolution' ? (
            <div className="stage-subbeat">{getLifeStepLabel(state.mechanicStep)}</div>
          ) : null}
          <div className="stage-subbeat">{`Time ×${formatWhole(Math.max(1, timeMult))}`}</div>
          <div className="stage-subbeat">{`${state.currentUniverseSeed.atlasName} · ${getAnomalyLabel(state.currentUniverseSeed.anomaly)}`}</div>
        </div>
        {state.totalClicks === 0 ? (
          <div className="stage-hint">click to gather · click direction steers your universe</div>
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
            stageId={stage.id}
          />
        ))}
        {encounterEntries.map((entry) => (
          <EncounterAlert key={entry.id} color={entry.color} name={entry.name} />
        ))}
      </main>

      <footer className="panel">
        <ResourcePanel
          label={stage.resource}
          quanta={formatGameNumber(state.quanta)}
          threshold={formatGameNumber(effectiveThreshold)}
          rate={formatRate(autoRate)}
          progressPercent={progress01 * 100}
          canCondense={canCondense}
          entropyPreview={entropyPreview}
          onCondense={() => dispatch({ type: 'START_CONDENSE', now: performance.now() })}
          clickPowerLabel={formatGameNumber(clickPower)}
          autoRateLabel={formatRate(autoRate)}
          critLabel={`x${Math.floor(critMultiplier)}`}
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

      {almanacOpen ? (
        <div className="overlay-backdrop" role="dialog" aria-modal="true">
          <div className="overlay-card">
            <div className="q-stage">Cosmic Almanac</div>
            <h2>{ALMANAC[stage.id]?.title ?? stage.name}</h2>
            <p>{ALMANAC[stage.id]?.body ?? stage.quote}</p>
            <p className="resource-subhead">{ALMANAC[stage.id]?.funFact}</p>
            <p className="resource-subhead">{`Click ${formatGameNumber(clickPower)} · Auto ${formatRate(autoRate)} · Time x${Math.max(1, Math.floor(timeMult))}`}</p>
            <button className="q-continue" type="button" onClick={() => setAlmanacOpen(false)}>
              CLOSE
            </button>
          </div>
        </div>
      ) : null}

      {almanacToast ? (
        <div className="almanac-toast" role="status" aria-live="polite">
          <div className="q-stage">{`Stage ${String(almanacToast.stageId).padStart(2, '0')}`}</div>
          <div>{almanacToast.text}</div>
        </div>
      ) : null}

      {tutorialPopup ? (
        <div className="overlay-backdrop" role="dialog" aria-modal="true">
          <div className="overlay-card stage-unlock-card">
            <div className="q-stage">{`Stage ${tutorialPopup.stageId} — ${stage.name}`}</div>
            <h2>{tutorialPopup.title}</h2>
            <p>{tutorialPopup.body}</p>
            <div className="reset-actions">
              <button className="q-continue" type="button" onClick={() => {
                dispatch({ type: 'MARK_TUTORIAL_STAGE_SEEN', stageId: tutorialPopup.stageId });
                if (tutorialPopup.openSkills) {
                  setSkillsOpen(true);
                }
                setTutorialPopup(null);
              }}>
                Open Skills
              </button>
              <button className="q-continue intro-secondary" type="button" onClick={() => {
                dispatch({ type: 'MARK_TUTORIAL_STAGE_SEEN', stageId: tutorialPopup.stageId });
                setTutorialPopup(null);
              }}>
                Dismiss
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!state.tutorialDone ? (
        <div className="overlay-backdrop tutorial-overlay" role="dialog" aria-modal="true">
          <div className="overlay-card">
            <div className="q-stage">Tutorial</div>
            {tutorialStep === 1 ? (
              <>
                <h2>Click the cosmos to gather quanta.</h2>
                <p>Make at least 5 clicks to wake the first skill path.</p>
              </>
            ) : null}
            {tutorialStep === 2 ? (
              <>
                <h2>Open Skills to grow your power.</h2>
                <p>The floating skills button in the lower-right opens the new tree panel.</p>
              </>
            ) : null}
            {tutorialStep === 3 ? (
              <>
                <h2>Buy your first root level.</h2>
                <p>Start with Stellar Forge or Cosmic Web, then close this when you are ready.</p>
              </>
            ) : null}
            <div className="reset-actions">
              <button
                className="mini-button"
                type="button"
                onClick={() => dispatch({ type: 'SET_TUTORIAL_DONE' })}
              >
                SKIP
              </button>
              {tutorialStep === 2 ? (
                <button className="q-continue" type="button" onClick={() => setSkillsOpen(true)}>
                  OPEN SKILLS
                </button>
              ) : null}
              {tutorialStep === 3 ? (
                <button
                  className="q-continue"
                  type="button"
                  onClick={() => dispatch({ type: 'SET_TUTORIAL_DONE' })}
                >
                  FINISH
                </button>
              ) : null}
            </div>
          </div>
        </div>
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
