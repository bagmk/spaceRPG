import { useEffect, useMemo, useState } from 'react';
import { TUNING } from '../game/constants';
import { clamp } from '../game/formulas';
import { INTRO_GENESIS_MS, INTRO_BIG_BANG_TO_GAME_MS } from '../game/balance';
import { t, type Lang } from '../i18n';

type IntroPhase = 'idle' | 'expanding' | 'done';

const GENESIS_MS = INTRO_GENESIS_MS;
const BIG_BANG_TO_GAME_MS = INTRO_BIG_BANG_TO_GAME_MS;

interface IntroScreenProps {
  canResume: boolean;
  canOpenAtlas: boolean;
  language: Lang;
  onResume: () => void;
  onNewStart: () => void;
  onComplete: () => void;
  onUnlockAudio: () => void;
  onPlayBigBang: () => void;
  onOpenAtlas: () => void;
  onOpenLeaderboard: () => void;
}

const INTRO_TIMES = ['10⁻⁴³ s', '10⁻³⁵ s', '10⁻⁶ s', '10⁻¹² s'] as const;
const INTRO_COLORS = ['#ffffff', '#ffaa66', '#050505'] as const;

function mixChannel(start: number, end: number, amount: number): number {
  return Math.round(start + (end - start) * amount);
}

function mixHex(a: string, b: string, amount: number): string {
  const ar = parseInt(a.slice(1, 3), 16);
  const ag = parseInt(a.slice(3, 5), 16);
  const ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16);
  const bg = parseInt(b.slice(3, 5), 16);
  const bb = parseInt(b.slice(5, 7), 16);
  return `rgb(${mixChannel(ar, br, amount)}, ${mixChannel(ag, bg, amount)}, ${mixChannel(ab, bb, amount)})`;
}

export function IntroScreen({
  canResume,
  canOpenAtlas,
  language,
  onResume,
  onNewStart,
  onComplete,
  onUnlockAudio,
  onPlayBigBang,
  onOpenAtlas,
  onOpenLeaderboard,
}: IntroScreenProps) {
  const [phase, setPhase] = useState<IntroPhase>('idle');
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (phase !== 'expanding') {
      return undefined;
    }

    let frameId = 0;
    const startTime = performance.now();
    let bigBangPlayed = false;

    const tick = (now: number) => {
      const nextElapsed = now - startTime;
      setElapsed(nextElapsed);

      if (!bigBangPlayed && nextElapsed >= GENESIS_MS) {
        bigBangPlayed = true;
        onPlayBigBang();
      }

      if (nextElapsed >= GENESIS_MS + BIG_BANG_TO_GAME_MS) {
        setPhase('done');
        setElapsed(GENESIS_MS + BIG_BANG_TO_GAME_MS);
        onComplete();
        return;
      }
      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [onComplete, onPlayBigBang, phase]);

  const bgElapsed = phase === 'expanding' ? Math.max(0, elapsed - GENESIS_MS) : 0;
  const tickerIndex = Math.min(
    INTRO_TIMES.length - 1,
    Math.floor(bgElapsed / (BIG_BANG_TO_GAME_MS / INTRO_TIMES.length)),
  );

  const introBackground = useMemo(() => {
    if (phase === 'idle' || elapsed < GENESIS_MS) {
      return '#000000';
    }
    if (bgElapsed < 220) {
      return INTRO_COLORS[0];
    }
    if (bgElapsed < 560) {
      return mixHex(INTRO_COLORS[0], INTRO_COLORS[1], (bgElapsed - 220) / 340);
    }
    return mixHex(INTRO_COLORS[1], INTRO_COLORS[2], clamp((bgElapsed - 560) / 280, 0, 1));
  }, [bgElapsed, elapsed, phase]);

  const flashOpacity =
    phase !== 'expanding' || elapsed < GENESIS_MS
      ? 0
      : bgElapsed < 120
        ? 1 - bgElapsed / 120
        : bgElapsed < 260
          ? 0.25 - ((bgElapsed - 120) / 140) * 0.25
          : 0;
  const dotScale =
    phase === 'expanding' && elapsed >= GENESIS_MS ? 1 + clamp(bgElapsed / 280, 0, 1) * 6.5 : 1;
  const dotBrightness =
    phase === 'idle'
      ? 0.75 + Math.sin((elapsed / TUNING.INTRO_PULSE_MS) * Math.PI * 2) * 0.25
      : 1;

  const genesisOpacity =
    phase === 'expanding' && elapsed < GENESIS_MS + 260
      ? elapsed < 220
        ? clamp(elapsed / 220, 0, 1)
        : elapsed < GENESIS_MS
          ? 1
          : clamp(1 - (elapsed - GENESIS_MS) / 260, 0, 1)
      : 0;

  const beginBigBang = () => {
    onUnlockAudio();
    setElapsed(0);
    setPhase('expanding');
  };

  return (
    <section className={`intro-screen ${phase}`} style={{ background: introBackground }}>
      <div className="intro-flash" style={{ opacity: flashOpacity }} />
      <div
        className="genesis-line"
        style={{ opacity: genesisOpacity, color: elapsed < GENESIS_MS ? '#f8f1d8' : '#050505' }}
      >
        <span>{t(language, 'introLetThere')}</span>
        <small>{t(language, 'introGenesis')}</small>
      </div>
      <div className="intro-content">
        <div
          className={`intro-dot ${phase === 'expanding' ? 'expanding' : ''}`}
          style={{
            width: `${TUNING.INTRO_DOT_SIZE}px`,
            height: `${TUNING.INTRO_DOT_SIZE}px`,
            transform: `scale(${dotScale})`,
            opacity: phase === 'idle' ? undefined : dotBrightness,
          }}
        />
        <div className="intro-ticker">{phase === 'expanding' ? INTRO_TIMES[tickerIndex] : ''}</div>
        <p className="intro-tagline">{t(language, 'introTagline')}</p>
        {phase === 'idle' ? (
          canResume ? (
            <div className="intro-actions">
              <button
                className="q-continue intro-button"
                type="button"
                onClick={() => {
                  onUnlockAudio();
                  onResume();
                }}
              >
                {t(language, 'introResume')}
              </button>
              {canOpenAtlas ? (
                <button className="q-continue intro-button intro-secondary" type="button" onClick={onOpenAtlas}>
                  {t(language, 'introAtlas')}
                </button>
              ) : null}
              <button className="q-continue intro-button intro-secondary intro-icon-btn" type="button" onClick={onOpenLeaderboard} title={language === 'ko' ? '랭킹' : 'Ranking'}>
                🏆
              </button>
            </div>
          ) : (
            <div className="intro-actions">
              <button className="q-continue intro-button" type="button" onClick={beginBigBang}>
                {t(language, 'introBegin')}
              </button>
              {canOpenAtlas ? (
                <button className="q-continue intro-button intro-secondary" type="button" onClick={onOpenAtlas}>
                  {t(language, 'introAtlas')}
                </button>
              ) : null}
              <button className="q-continue intro-button intro-secondary intro-icon-btn" type="button" onClick={onOpenLeaderboard} title={language === 'ko' ? '랭킹' : 'Ranking'}>
                🏆
              </button>
            </div>
          )
        ) : null}
      </div>
    </section>
  );
}
