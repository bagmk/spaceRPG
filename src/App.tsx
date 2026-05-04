import { useEffect, useRef, useState } from 'react';
import { GameScreen } from './components/GameScreen';
import { IntroScreen } from './components/IntroScreen';
import { FinalScreen } from './components/FinalScreen';
import { BigBangCinematic } from './components/BigBangCinematic';
import { MultiverseAtlas } from './components/MultiverseAtlas';
import { SoundManager } from './game/audio';
import { clearAllStoredState, clearSave, loadMutedPreference, saveMutedPreference } from './game/storage';
import { useGameState } from './hooks/useGameState';
import { createInitialGameState } from './game/reducer';
import { STAGES } from './game/stages';
import { getStageStartCosmicTime } from './game/timeFlow';

type Route = 'intro' | 'game' | 'final' | 'atlas';

export default function App() {
  const { state, dispatch, hadSavedGame } = useGameState();
  const [route, setRoute] = useState<Route>('intro');
  const [resumeAvailable, setResumeAvailable] = useState(hadSavedGame);
  const [muted, setMuted] = useState(loadMutedPreference());
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [bigBangRestarting, setBigBangRestarting] = useState(false);
  const [openingCinematic, setOpeningCinematic] = useState(false);
  const soundManagerRef = useRef<SoundManager | null>(null);

  useEffect(() => {
    const manager = new SoundManager(muted);
    soundManagerRef.current = manager;
    return () => manager.dispose();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('reset') !== '1') {
      const stageParam = params.get('stage');
      if (stageParam && import.meta.env.DEV) {
        const stageNumber = Number(stageParam);
        if (Number.isFinite(stageNumber)) {
          const stageIdx = Math.max(0, Math.min(STAGES.length - 1, stageNumber - 1));
          const now = Date.now();
          dispatch({
            type: 'HYDRATE',
            payload: {
              ...createInitialGameState(now),
              stageIdx,
              cosmicClockSec: getStageStartCosmicTime(stageIdx),
              stageStartedAt: now,
            },
            now,
          });
          setResumeAvailable(false);
          setRoute('game');
        }
      }
      return;
    }
    clearAllStoredState();
    const now = Date.now();
    dispatch({ type: 'HYDRATE', payload: createInitialGameState(now), now });
    setResumeAvailable(false);
    setShowResetConfirm(false);
    setRoute('intro');
    setMuted(loadMutedPreference());
    window.history.replaceState(null, '', window.location.pathname);
  }, [dispatch]);

  useEffect(() => {
    soundManagerRef.current?.setMuted(muted);
    saveMutedPreference(muted);
  }, [muted]);

  useEffect(() => {
    if (state.completedRun) {
      setRoute('final');
    }
  }, [state.completedRun]);

  return (
    <>
      {route === 'intro' ? (
        <IntroScreen
          canResume={resumeAvailable}
          canOpenAtlas={state.universeAtlas.length > 0}
          onResume={() => {
            soundManagerRef.current?.unlock();
            setRoute(state.completedRun ? 'final' : 'game');
          }}
          onNewStart={() => {
            soundManagerRef.current?.unlock();
            clearSave();
            dispatch({ type: 'HYDRATE', payload: createInitialGameState(Date.now()), now: Date.now() });
            setResumeAvailable(false);
          }}
          onComplete={() => {
            setResumeAvailable(false);
            setOpeningCinematic(true);
          }}
          onUnlockAudio={() => {
            soundManagerRef.current?.unlock();
          }}
          onPlayBigBang={() => {
            soundManagerRef.current?.playBigBang();
          }}
          onOpenAtlas={() => setRoute('atlas')}
        />
      ) : null}

      {route === 'game' ? (
        <GameScreen
          state={state}
          dispatch={dispatch}
          soundManager={soundManagerRef.current}
          muted={muted}
          onToggleMute={() => setMuted((current) => !current)}
          onRequestReset={() => setShowResetConfirm(true)}
        />
      ) : null}

      {route === 'final' ? (
        <FinalScreen
          state={state}
          onUnlock={(unlockId) => dispatch({ type: 'BUY_SINGULARITY_UNLOCK', unlockId })}
          onOpenAtlas={() => setRoute('atlas')}
          onPrestige={() => {
            soundManagerRef.current?.unlock();
            soundManagerRef.current?.playBigBang();
            setBigBangRestarting(true);
          }}
        />
      ) : null}

      {bigBangRestarting ? (
        <BigBangCinematic
          onComplete={() => {
            dispatch({ type: 'PRESTIGE', now: Date.now() });
            setResumeAvailable(false);
            setBigBangRestarting(false);
            setRoute('game');
          }}
        />
      ) : null}

      {openingCinematic ? (
        <BigBangCinematic
          onComplete={() => {
            soundManagerRef.current?.unlock();
            setOpeningCinematic(false);
            setRoute('game');
          }}
        />
      ) : null}

      {route === 'atlas' ? (
        <MultiverseAtlas
          entries={state.universeAtlas}
          currentSeed={state.currentUniverseSeed}
          currentUniverseCount={state.universeCount}
          onBack={() => setRoute(state.completedRun ? 'final' : 'intro')}
        />
      ) : null}

      {showResetConfirm ? (
        <div className="reset-backdrop" role="dialog" aria-modal="true">
          <div className="reset-modal">
            <h2>Delete save?</h2>
            <p>This will permanently delete your save. Are you sure?</p>
            <div className="reset-actions">
              <button className="mini-button" type="button" onClick={() => setShowResetConfirm(false)}>
                CANCEL
              </button>
              <button
                className="q-continue"
                type="button"
                onClick={() => {
                  clearAllStoredState();
                  window.location.reload();
                }}
              >
                CONFIRM RESET
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
