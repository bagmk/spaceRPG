import { Component, useEffect, useRef, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { GameScreen } from './components/GameScreen';
import { IntroScreen } from './components/IntroScreen';
import { FinalScreen } from './components/FinalScreen';
import { BigBangCinematic } from './components/BigBangCinematic';
import { MultiverseAtlas } from './components/MultiverseAtlas';
import { SoundManager } from './game/audio';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { NameSetupModal } from './components/NameSetupModal';
import { LoginScreen } from './components/LoginScreen';
import { useCloudSync } from './hooks/useCloudSync';
import { initAdMob } from './lib/admob';
import { initRevenueCat } from './game/shop/purchase';
import { Leaderboard } from './components/Leaderboard';
import {
  clearAllStoredState,
  clearSave,
  saveGame,
  loadSfxMuted,
  saveSfxMuted,
  loadMusicMuted,
  saveMusicMuted,
  loadMusicVolume,
  saveMusicVolume,
  loadLanguage,
  saveLanguage,
} from './game/storage';
import { useGameState } from './hooks/useGameState';
import { createInitialGameState, toPersistentState } from './game/reducer';
import { STAGES } from './game/stages';
import { getStageStartCosmicTime } from './game/timeFlow';
import { t } from './i18n';

class ErrorBoundary extends Component<{ language: 'en' | 'ko'; children: ReactNode }, { error: Error | null }> {
  constructor(props: { language: 'en' | 'ko'; children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[GameError]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', gap: '16px', color: '#c0b8d0', fontFamily: 'monospace' }}>
          <p style={{ margin: 0 }}>{t(this.props.language, 'errorReload')}</p>
          <button
            style={{ padding: '8px 20px', background: '#4a3060', border: '1px solid #8060b0', borderRadius: '6px', color: '#e0d8f0', cursor: 'pointer' }}
            onClick={() => window.location.reload()}
          >
            {t(this.props.language, 'errorReloadBtn')}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

type Route = 'login' | 'intro' | 'game' | 'final' | 'atlas';

function AppInner() {
  const { state, dispatch, hadSavedGame } = useGameState();
  const stateRef = useRef(state);
  stateRef.current = state;
  const { status: authStatus } = useAuth();
  useCloudSync({ state, dispatch });
  const [route, setRoute] = useState<Route>('login');
  const [resumeAvailable, setResumeAvailable] = useState(hadSavedGame);
  const [sfxMuted, setSfxMuted] = useState(loadSfxMuted);
  const [musicMuted, setMusicMuted] = useState(loadMusicMuted);
  const [musicVolume, setMusicVolumeState] = useState(loadMusicVolume);
  const [language, setLanguage] = useState(loadLanguage);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [bigBangRestarting, setBigBangRestarting] = useState(false);
  const [openingCinematic, setOpeningCinematic] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const soundManagerRef = useRef<SoundManager | null>(null);

  useEffect(() => {
    initAdMob().catch(console.warn);
    initRevenueCat().catch(console.warn);
    const manager = new SoundManager(sfxMuted, musicMuted);
    manager.setMusicVolume(musicVolume);
    soundManagerRef.current = manager;
    return () => manager.dispose();
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    window.history.replaceState(null, '', window.location.pathname);
  }, [dispatch]);

  useEffect(() => {
    const resume = () => soundManagerRef.current?.ensureRunning();
    let backgroundAt = 0;
    // Custom app event
    window.addEventListener('cc-visibility-resumed', resume);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        // Record when we went to background and snapshot lastSaveAt
        backgroundAt = Date.now();
        saveGame(stateRef.current);
      } else if (document.visibilityState === 'visible') {
        resume();
        // If away > 30s, re-hydrate to trigger offline reward calculation
        const awayMs = backgroundAt > 0 ? Date.now() - backgroundAt : 0;
        if (awayMs > 30_000 && stateRef.current && !stateRef.current.completedRun) {
          const persistent = toPersistentState(stateRef.current);
          persistent.lastSaveAt = backgroundAt;
          dispatch({ type: 'HYDRATE', payload: persistent, now: Date.now() });
        }
        backgroundAt = 0;
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pointerdown', resume);
    return () => {
      window.removeEventListener('cc-visibility-resumed', resume);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointerdown', resume);
    };
  }, []);

  useEffect(() => {
    soundManagerRef.current?.setSfxMuted(sfxMuted);
    saveSfxMuted(sfxMuted);
  }, [sfxMuted]);

  useEffect(() => {
    soundManagerRef.current?.setMusicMuted(musicMuted);
    saveMusicMuted(musicMuted);
  }, [musicMuted]);

  useEffect(() => {
    soundManagerRef.current?.setMusicVolume(musicVolume);
    saveMusicVolume(musicVolume);
  }, [musicVolume]);

  useEffect(() => {
    saveLanguage(language);
  }, [language]);

  // When cloud save arrives via HYDRATE and we're still on login/intro,
  // auto-forward to the game (skip the intro "Resume" button).
  useEffect(() => {
    if (state.totalClicks > 0 || state.stageIdx > 0) {
      setResumeAvailable(true);
      if (route === 'login' || route === 'intro') {
        soundManagerRef.current?.unlock();
        setRoute(state.completedRun ? 'final' : 'game');
      }
    }
  }, [state.totalClicks, state.stageIdx]);

  useEffect(() => {
    if (state.completedRun && state.lastEndingId !== null) {
      setRoute('final');
    }
  }, [state.completedRun, state.lastEndingId]);

  useEffect(() => {
    if (authStatus === 'signedOut') {
      soundManagerRef.current?.fadeOutMusic(800);
      soundManagerRef.current?.stopDrone(800);
      dispatch({ type: 'HYDRATE', payload: createInitialGameState(Date.now()), now: Date.now() });
      setResumeAvailable(false);
      setRoute('login');
    }
  }, [authStatus]);

  // Start/stop ambient drone on login/intro screens.
  // iOS requires a user gesture to unlock AudioContext, so we listen for
  // the first pointerdown on login/intro and start the drone then.
  useEffect(() => {
    const sm = soundManagerRef.current;
    if (!sm) return;
    if (route === 'login' || route === 'intro') {
      const tryStart = () => {
        sm.unlock();
        sm.startDrone();
      };
      // Try immediately (works if already unlocked from a previous session)
      tryStart();
      // Also listen for first tap in case context is still locked
      window.addEventListener('pointerdown', tryStart);
      return () => window.removeEventListener('pointerdown', tryStart);
    }
    sm.stopDrone(1500);
    return undefined;
  }, [route]);

  return (
    <>
      {route === 'login' ? (
        <LoginScreen
          language={language}
          onLanguageChange={setLanguage}
          onContinue={() => {
            soundManagerRef.current?.unlock();
            setRoute('intro');
          }}
        />
      ) : null}

      {route === 'intro' ? (
        <IntroScreen
          canResume={resumeAvailable && (state.totalClicks > 0 || state.stageIdx > 0)}
          canOpenAtlas={state.universeAtlas.length > 0}
          language={language}
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
            // (Big Bang sting removed — too cheesy. Music handles the transition.)
          }}
          onOpenAtlas={() => setRoute('atlas')}
          onOpenLeaderboard={() => setShowLeaderboard(true)}
        />
      ) : null}

      {route === 'game' ? (
        <ErrorBoundary language={language}>
          <GameScreen
            state={state}
            dispatch={dispatch}
            soundManager={soundManagerRef.current}
            sfxMuted={sfxMuted}
            musicMuted={musicMuted}
            musicVolume={musicVolume}
            language={language}
            onToggleSfx={() => setSfxMuted((v) => !v)}
            onToggleMusic={() => setMusicMuted((v) => !v)}
            onSetMusicVolume={setMusicVolumeState}
            onToggleLanguage={() => setLanguage((v) => (v === 'en' ? 'ko' : 'en'))}
            onRequestReset={() => setShowResetConfirm(true)}
            onForceReset={() => {
              clearAllStoredState();
              const now = Date.now();
              dispatch({ type: 'HYDRATE', payload: createInitialGameState(now), now });
              setResumeAvailable(false);
              setRoute('intro');
            }}
            onOpenLeaderboard={() => setShowLeaderboard(true)}
          />
        </ErrorBoundary>
      ) : null}

      {route === 'final' ? (
        <FinalScreen
          state={state}
          language={language}
          soundManager={soundManagerRef.current}
          onBuyPrestigeUpgrade={(upgradeId) => dispatch({ type: 'BUY_PRESTIGE_UPGRADE', upgradeId })}
          onOpenAtlas={() => setRoute('atlas')}
          onOpenLeaderboard={() => setShowLeaderboard(true)}
          onPrestige={() => {
            soundManagerRef.current?.unlock();
            // (Big Bang sting removed — too cheesy. Music handles the transition.)
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
          language={language}
          onBack={() => setRoute(state.completedRun ? 'final' : 'intro')}
        />
      ) : null}

      {authStatus === 'needsName' ? (
        <NameSetupModal language={language} onComplete={() => {}} />
      ) : null}

      {showLeaderboard ? (
        <Leaderboard language={language} onClose={() => setShowLeaderboard(false)} />
      ) : null}

      {showResetConfirm ? (
        <div className="reset-backdrop" role="dialog" aria-modal="true">
          <div className="reset-modal">
            <h2>{t(language, 'resetTitle')}</h2>
            <p>{t(language, 'resetWarn')}</p>
            <div className="reset-actions">
              <button className="mini-button" type="button" onClick={() => setShowResetConfirm(false)}>
                {t(language, 'resetCancel')}
              </button>
              <button
                className="q-continue"
                type="button"
                onClick={() => {
                  clearAllStoredState();
                  const now = Date.now();
                  dispatch({ type: 'HYDRATE', payload: createInitialGameState(now), now });
                  setResumeAvailable(false);
                  setShowResetConfirm(false);
                  setRoute('intro');
                }}
              >
                {t(language, 'resetConfirm')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
