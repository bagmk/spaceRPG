import { useEffect, useReducer, useRef } from 'react';
import { gameReducer, createInitialGameState } from '../game/reducer';
import { clearSave, loadGame, saveGame } from '../game/storage';
import { TUNING } from '../game/constants';
import { getAutoRate, safeAdd } from '../game/formulas';
import { getActiveModifiers } from '../game/skills/effects';
import { STAGES } from '../game/stages';
import { getCosmicTimePerRealSec } from '../game/timeFlow';
import type { Dispatch } from 'react';
import type { GameAction } from '../game/reducer';
import type { GameState } from '../game/types';

interface UseGameStateResult {
  state: GameState;
  dispatch: Dispatch<GameAction>;
  hadSavedGame: boolean;
  clearStoredRun: () => void;
}

export function useGameState(): UseGameStateResult {
  const saved = useRef(loadGame());
  const hadSavedGame = saved.current !== null;
  const stateRef = useRef<GameState | null>(null);
  const getDayKey = (date: Date) => date.toISOString().slice(0, 10);
  const [state, dispatch] = useReducer(
    gameReducer,
    saved.current,
    (payload) => {
      const now = Date.now();
      if (!payload) {
        return createInitialGameState(now);
      }
      const baseState: GameState = {
        ...createInitialGameState(now),
        ...payload,
        combo: 0,
        lastClick: 0,
        imploding: false,
        condenseStartedAt: null,
        eventCounter: 0,
        lastClickEvent: null,
        lastCollisionEvent: null,
        lastEncounterEvent: null,
        offlineElapsedMs: 0,
        offlineGained: 0,
        endingStartedAt: null,
      };
      if (baseState.completedRun) {
        return baseState;
      }
      const awaySec = Math.min(
        TUNING.MAX_OFFLINE_SEC,
        Math.max(0, (now - payload.lastSaveAt) / 1000),
      );
      if (awaySec <= 0) {
        return baseState;
      }
      const stage = STAGES[Math.min(payload.stageIdx, STAGES.length - 1)];
      const modifiers = getActiveModifiers(payload.skills, {
        currentQuanta: payload.quanta,
        stagesCleared: payload.stageIdx,
        secondsInStage: Math.max(0, (now - payload.stageStartedAt) / 1000),
        stageId: stage.id,
        clickLevel: payload.skills.click.level,
      });
      const autoRate = getAutoRate(modifiers);
      const offlineMultiplier = modifiers.hawkingEcho || payload.singularityUnlocks.includes('hawking_echo')
        ? 1
        : TUNING.OFFLINE_BASE_RATE;
      const gained = autoRate * awaySec * offlineMultiplier;
      const previousStage = payload.stageIdx > 0 ? STAGES[payload.stageIdx - 1] : null;
      const timeMult = modifiers.timeMultMult;
      const cosmicRate =
        getCosmicTimePerRealSec(stage, previousStage, timeMult) *
        payload.currentUniverseSeed.timeMod *
        offlineMultiplier;
      const todayKey = getDayKey(new Date(now));
      const isDailyCheckIn = payload.dailyCheckIns.lastDayKey !== todayKey;
      return {
        ...baseState,
        quanta: safeAdd(baseState.quanta, gained),
        cosmicClockSec: Math.min(stage.cosmicTimeSec, baseState.cosmicClockSec + awaySec * cosmicRate),
        lastSaveAt: now,
        offlineElapsedMs: awaySec * 1000,
        offlineGained: gained,
        dailyCheckIns: isDailyCheckIn
          ? {
              lastDayKey: todayKey,
              streakDays: payload.dailyCheckIns.lastDayKey ? payload.dailyCheckIns.streakDays + 1 : 1,
            }
          : payload.dailyCheckIns,
      };
    },
  );

  stateRef.current = state;

  useEffect(() => {
    const persist = () => {
      if (stateRef.current) {
        saveGame(stateRef.current);
      }
    };
    const intervalId = window.setInterval(() => {
      persist();
    }, TUNING.AUTOSAVE_INTERVAL_MS);

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        persist();
      }
    };

    window.addEventListener('beforeunload', persist);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('beforeunload', persist);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  useEffect(() => {
    saveGame(state);
  }, [
    state.stageIdx,
    state.pendingCondenseStageIdx,
    state.completedRun,
    state.universeCount,
    state.cumulativeBoost,
    state.condensedMass,
    state.echoes,
  ]);

  return {
    state,
    dispatch,
    hadSavedGame,
    clearStoredRun: () => {
      clearSave();
    },
  };
}
