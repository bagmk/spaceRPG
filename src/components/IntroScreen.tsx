import { useEffect, useMemo, useRef, useState } from 'react';
import { TUNING } from '../game/constants';
import { clamp, hexToRgba } from '../game/formulas';

type IntroPhase = 'idle' | 'collapsing' | 'expanding' | 'done';

const COLLAPSE_MS = 700; // particles converge before the bang

interface IntroParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
}

interface IntroScreenProps {
  canResume: boolean;
  canOpenAtlas: boolean;
  onResume: () => void;
  onNewStart: () => void;
  onComplete: () => void;
  onUnlockAudio: () => void;
  onPlayBigBang: () => void;
  onOpenAtlas: () => void;
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

function createCollapseParticles(width: number, height: number): IntroParticle[] {
  const cx = width / 2;
  const cy = height / 2;
  const colors = ['#ffffff', '#ffaa66', '#ff6644', '#ffeebb'];
  return Array.from({ length: TUNING.INTRO_BURST_COUNT }, (_, index) => {
    const angle = (index / TUNING.INTRO_BURST_COUNT) * Math.PI * 2 + Math.random() * 0.3;
    const dist = Math.min(width, height) * (0.22 + Math.random() * 0.28);
    const speed = 5 + Math.random() * 10;
    return {
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
      vx: -Math.cos(angle) * speed, // inward
      vy: -Math.sin(angle) * speed,
      size: 1.2 + Math.random() * 2.4,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 1,
    };
  });
}

function createBurstParticles(width: number, height: number): IntroParticle[] {
  const cx = width / 2;
  const cy = height / 2;
  return Array.from({ length: TUNING.INTRO_BURST_COUNT }, (_, index) => {
    const angle = (index / TUNING.INTRO_BURST_COUNT) * Math.PI * 2 + Math.random() * 0.3;
    const speed = 3 + Math.random() * 9;
    const colors = ['#ffffff', '#ffaa66', '#ff6644', '#ffeebb'];
    return {
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 1.5 + Math.random() * 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 1,
    };
  });
}

export function IntroScreen({
  canResume,
  canOpenAtlas,
  onResume,
  onNewStart,
  onComplete,
  onUnlockAudio,
  onPlayBigBang,
  onOpenAtlas,
}: IntroScreenProps) {
  const [phase, setPhase] = useState<IntroPhase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<IntroParticle[]>([]);

  const tickerIndex = Math.min(
    INTRO_TIMES.length - 1,
    Math.floor(elapsed / (TUNING.INTRO_TOTAL_MS / INTRO_TIMES.length)),
  );

  useEffect(() => {
    if (phase !== 'collapsing' && phase !== 'expanding') {
      return undefined;
    }

    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    // Start with collapse particles converging inward
    particlesRef.current = createCollapseParticles(window.innerWidth, window.innerHeight);

    let frameId = 0;
    const startTime = performance.now();
    let previous = startTime;
    let burstCreated = false;

    const draw = (now: number) => {
      const dt = now - previous;
      previous = now;
      const nextElapsed = now - startTime;
      setElapsed(nextElapsed);
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      const w = window.innerWidth;
      const h = window.innerHeight;

      // At collapse → burst transition: fire big bang sound + swap particles
      if (nextElapsed >= COLLAPSE_MS && !burstCreated) {
        burstCreated = true;
        setPhase('expanding');
        onPlayBigBang();
        particlesRef.current = createBurstParticles(w, h);
      }

      particlesRef.current.forEach((particle) => {
        particle.x += particle.vx * (dt / 16.67);
        particle.y += particle.vy * (dt / 16.67);

        if (!burstCreated) {
          // Collapse phase: alpha fades in as particles converge toward center
          const dx = particle.x - w / 2;
          const dy = particle.y - h / 2;
          const dist = Math.hypot(dx, dy);
          const maxDist = Math.min(w, h) * 0.55;
          particle.life = 0.35 + 0.65 * Math.min(1, dist / maxDist);
        } else {
          // Burst phase: normal life decay
          particle.life -= 0.01 * (dt / 16.67);
        }

        ctx.fillStyle = hexToRgba(particle.color, Math.max(0, particle.life));
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      });

      if (burstCreated) {
        particlesRef.current = particlesRef.current.filter((p) => p.life > 0);
      }

      // Total duration counts from burst start (COLLAPSE_MS offset)
      if (burstCreated && nextElapsed >= COLLAPSE_MS + TUNING.INTRO_TOTAL_MS) {
        setPhase('done');
        setElapsed(TUNING.INTRO_TOTAL_MS);
        onComplete();
        return;
      }
      frameId = window.requestAnimationFrame(draw);
    };

    frameId = window.requestAnimationFrame(draw);
    window.addEventListener('resize', resize);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
    };
  }, [onComplete, onPlayBigBang, phase]);

  // elapsed during collapsing counts from 0; during expanding it resets to 0 at burst
  // We offset by COLLAPSE_MS so background timing stays consistent
  const bgElapsed = phase === 'collapsing' ? 0 : elapsed;
  const introBackground = useMemo(() => {
    if (phase === 'idle' || phase === 'collapsing') {
      return '#000000';
    }
    if (bgElapsed < 1400) {
      return INTRO_COLORS[0];
    }
    if (bgElapsed < 1800) {
      return mixHex(INTRO_COLORS[0], INTRO_COLORS[1], (bgElapsed - 1400) / 400);
    }
    return mixHex(INTRO_COLORS[1], INTRO_COLORS[2], clamp((bgElapsed - 1800) / 400, 0, 1));
  }, [bgElapsed, phase]);

  const flashOpacity =
    bgElapsed < 400
      ? 0
      : bgElapsed < 600
        ? (bgElapsed - 400) / 200
        : bgElapsed < 800
          ? 1 - ((bgElapsed - 600) / 200) * 0.4
          : 0;
  const dotScale =
    phase === 'expanding' ? 1 + clamp(bgElapsed / 400, 0, 1) * 6.5 : 1;
  const dotBrightness =
    phase === 'idle'
      ? 0.75 + Math.sin((elapsed / TUNING.INTRO_PULSE_MS) * Math.PI * 2) * 0.25
      : 1;

  const previewOpacity = clamp((bgElapsed - 1800) / 400, 0, 1);
  const genesisOpacity =
    phase === 'expanding' && bgElapsed > 520 && bgElapsed < 1550
      ? bgElapsed < 760
        ? clamp((bgElapsed - 520) / 240, 0, 1)
        : clamp(1 - (bgElapsed - 1260) / 290, 0, 1)
      : 0;

  const beginBigBang = () => {
    onUnlockAudio();
    setElapsed(0);
    setPhase('collapsing');
  };

  return (
    <section className={`intro-screen ${phase}`} style={{ background: introBackground }}>
      <canvas ref={canvasRef} className="intro-canvas" aria-hidden="true" />
      <div className="intro-flash" style={{ opacity: flashOpacity }} />
      <div className="genesis-line" style={{ opacity: genesisOpacity }}>
        <span>Let there be light</span>
        <small>Genesis 1:3</small>
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
        <p className="intro-tagline">From the first instant to the end of time.</p>
        {phase === 'idle' ? (
          canResume ? (
            <div className="intro-actions">
              <button
                className="q-continue intro-button intro-secondary"
                type="button"
                onClick={() => {
                  onUnlockAudio();
                  onResume();
                }}
              >
                RESUME
              </button>
              <button
                className="q-continue intro-button"
                type="button"
                onClick={() => {
                  onNewStart();
                  beginBigBang();
                }}
              >
                NEW BIG BANG
              </button>
              {canOpenAtlas ? (
                <button className="mini-button intro-secondary" type="button" onClick={onOpenAtlas}>
                  MULTIVERSE ATLAS
                </button>
              ) : null}
            </div>
          ) : (
            <div className="intro-actions">
              <button className="q-continue intro-button" type="button" onClick={beginBigBang}>
                BEGIN
              </button>
              {canOpenAtlas ? (
                <button className="mini-button intro-secondary" type="button" onClick={onOpenAtlas}>
                  MULTIVERSE ATLAS
                </button>
              ) : null}
            </div>
          )
        ) : null}
      </div>
      <div className="intro-preview" style={{ opacity: previewOpacity }}>
        <div className="intro-preview-stage">STAGE 01 / 16</div>
        <div className="intro-preview-name">Inflation</div>
      </div>
    </section>
  );
}
