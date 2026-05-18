import { useEffect, useReducer, useRef } from 'react';
import { gameReducer, createInitialGameState } from '../game/reducer';
import { clearSave, loadGame, saveGame } from '../game/storage';
import { TUNING } from '../game/constants';
import {
  getAutoRate,
  getCosmicTimeFillRate,
  getEffectiveThreshold,
  getEntropyFromMatterGain,
  getTimeGaugeForCosmicClock,
  safeAdd,
} from '../game/formulas';
import {
  getOfflineRewardCapSec,
  integrateBoostedSeconds,
  pruneExpiredShopBoosts,
} from '../game/shop/boosts';
import { getActiveModifiers } from '../game/skills/effects';
import { getPrestigeMultiplier } from '../game/prestige';
import { STAGES } from '../game/stages';
import { getStageStartCosmicTime } from '../game/timeFlow';
import type { Dispatch } from 'react';
import type { GameAction } from '../game/reducer';
import type { GameState } from '../game/types';

interface UseGameStateResult {
  state: GameState;
  dispatch: Dispatch<GameAction>;
  hadSavedGame: boolean;
  clearStoredRun: () => void;
}

function safeParseSave(): ReturnType<typeof loadGame> {
  try {
    return loadGame();
  } catch (e) {
    console.error('[useGameState] Failed to load save, resetting:', e);
    clearSave();
    return null;
  }
}

export function useGameState(): UseGameStateResult {
  const saved = useRef(safeParseSave());
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
      try {
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
        offlineEntropyGained: 0,
        offlineTimeProgressGained: 0,
        endingStartedAt: null,
      };
      if (baseState.completedRun) {
        return { ...baseState, shopBoosts: pruneExpiredShopBoosts(baseState.shopBoosts, now) };
      }
      const offlineCapSec = getOfflineRewardCapSec(Boolean(payload.hasOfflineStorageUpgrade));
      const awaySec = Math.min(
        offlineCapSec,
        Math.max(0, (now - payload.lastSaveAt) / 1000),
      );
      if (awaySec <= 0) {
        return { ...baseState, shopBoosts: pruneExpiredShopBoosts(baseState.shopBoosts, now) };
      }
      const offlineStartMs = payload.lastSaveAt;
      const offlineEndMs = payload.lastSaveAt + awaySec * 1000;
      const stage = STAGES[Math.min(payload.stageIdx, STAGES.length - 1)];
      const modifiers = getActiveModifiers(
        payload.skills,
        {
          currentQuanta: payload.quanta,
          stagesCleared: payload.stageIdx,
          secondsInStage: Math.max(0, (now - payload.stageStartedAt) / 1000),
          stageId: stage.id,
          clickLevel: payload.skills.click.level,
        },
        payload.purchasedEntities ?? [],
        payload.prestigeUpgrades,
      );
      const autoRate = getAutoRate(modifiers);
      const offlineMultiplier = modifiers.hawkingEcho || payload.singularityUnlocks.includes('hawking_echo')
        ? 1
        : TUNING.OFFLINE_BASE_RATE;
      const boostedTimeSec = integrateBoostedSeconds(
        payload.shopBoosts,
        ['time'],
        offlineStartMs,
        offlineEndMs,
      );
      const boostedMatterSec = integrateBoostedSeconds(
        payload.shopBoosts,
        ['time', 'matter'],
        offlineStartMs,
        offlineEndMs,
      );
      const gained = autoRate * boostedMatterSec * offlineMultiplier;
      const nextQuanta = safeAdd(baseState.quanta, gained);
      const effectiveThreshold = getEffectiveThreshold(stage, payload.cumulativeBoost);
      const entropyEchoMult = getPrestigeMultiplier(payload.prestigeUpgrades?.entropy_echo ?? 0);
      const entropyGained = getEntropyFromMatterGain(baseState.quanta, nextQuanta, effectiveThreshold) * entropyEchoMult;
      const stageStartCosmic = getStageStartCosmicTime(payload.stageIdx);
      const logSpan = Math.log10(stage.cosmicTimeSec) - Math.log10(stageStartCosmic);
      const safeCosmic = Math.max(payload.cosmicClockSec, stageStartCosmic);
      const gaugeRate = getCosmicTimeFillRate(
        payload.skills.time.level,
        modifiers,
        1,
        payload.stageIdx + 1,
      );
      const cosmicDelta = logSpan > 0
        ? (gaugeRate * boostedTimeSec * offlineMultiplier * logSpan * Math.LN10 * safeCosmic) / 100
        : 0;
      const nextCosmicClockSec = Math.min(safeCosmic + cosmicDelta, stage.cosmicTimeSec);
      const previousTimeGauge = getTimeGaugeForCosmicClock(payload.stageIdx, safeCosmic);
      const nextTimeGauge = getTimeGaugeForCosmicClock(payload.stageIdx, nextCosmicClockSec);
      const todayKey = getDayKey(new Date(now));
      const isDailyCheckIn = payload.dailyCheckIns.lastDayKey !== todayKey;
      return {
        ...baseState,
        quanta: nextQuanta,
        entropy: safeAdd(baseState.entropy, entropyGained),
        cosmicClockSec: nextCosmicClockSec,
        timeGauge: nextTimeGauge,
        lastSaveAt: now,
        offlineElapsedMs: awaySec * 1000,
        offlineGained: gained,
        offlineEntropyGained: entropyGained,
        offlineTimeProgressGained: Math.max(0, nextTimeGauge - previousTimeGauge),
        shopBoosts: pruneExpiredShopBoosts(payload.shopBoosts, now),
        dailyCheckIns: isDailyCheckIn
          ? {
              lastDayKey: todayKey,
              streakDays: payload.dailyCheckIns.lastDayKey ? payload.dailyCheckIns.streakDays + 1 : 1,
            }
          : payload.dailyCheckIns,
      };
      } catch (e) {
        console.error('[useGameState] Corrupted save data, resetting:', e);
        clearSave();
        return createInitialGameState(now);
      }
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
      } else if (document.visibilityState === 'visible') {
        // AudioContext may have been suspended by the OS while backgrounded.
        // App owns the SoundManager — emit an event to signal resume.
        window.dispatchEvent(new CustomEvent('cc-visibility-resumed'));
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
    // Milestone events only — these change rarely and warrant immediate flush.
    // High-frequency fields (quanta, timeGauge, entropy, cosmicClockSec, ...) are
    // intentionally excluded; the 30s interval above persists them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    state.stageIdx,
    state.pendingCondenseStageIdx,
    state.completedRun,
    state.universeCount,
    state.cumulativeBoost,
    state.condensedMass,
    state.echoes,
    state.skillPoints,
    state.shopBoosts,
    state.hasOfflineStorageUpgrade,
    state.hasSeenCashShopTutorial,
    state.totalShopSpentUSD,
    state.purchasedEntities,
    state.endingsCompleted,
    state.lastEndingId,
    state.selectedEndingId,
    state.singularityUnlocks,
    state.prestigeUpgrades,
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
