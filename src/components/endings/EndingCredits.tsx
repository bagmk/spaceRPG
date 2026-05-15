import { useEffect, useMemo, useState } from 'react';
import type { EndingId } from '../../game/types';
import { t, type Lang } from '../../i18n';

interface EndingCreditsProps {
  endingId: EndingId;
  language: Lang;
  onComplete: () => void;
}

interface EndingCreditCopy {
  title: Record<Lang, string>;
  subtitle: Record<Lang, string>;
}

const CREDIT_VIDEO: Record<EndingId, string> = {
  heat_death: new URL('../../ending/heat_death.mp4', import.meta.url).href,
  big_crunch: new URL('../../ending/big_crunch.mp4', import.meta.url).href,
  big_rip: new URL('../../ending/big_rip.mp4', import.meta.url).href,
  vacuum_decay: new URL('../../ending/Vacuum Decay.mp4', import.meta.url).href,
  bounce: new URL('../../ending/bounce.mp4', import.meta.url).href,
};

const CREDIT_COPY: Record<EndingId, EndingCreditCopy> = {
  heat_death: {
    title: { en: 'Heat Death', ko: '열적 죽음' },
    subtitle: {
      en: 'The universe spends its last gradients and enters equilibrium.',
      ko: '우주는 마지막 기울기를 모두 소모하고 평형으로 들어간다.',
    },
  },
  big_crunch: {
    title: { en: 'Big Crunch', ko: '빅 크런치' },
    subtitle: {
      en: 'Expansion yields, and every structure falls back toward one center.',
      ko: '팽창은 굴복하고, 모든 구조는 하나의 중심으로 되돌아간다.',
    },
  },
  big_rip: {
    title: { en: 'Big Rip', ko: '빅 립' },
    subtitle: {
      en: 'Acceleration outruns cohesion and tears every bound scale apart.',
      ko: '가속은 결속을 앞질러 모든 묶인 규모를 찢어낸다.',
    },
  },
  vacuum_decay: {
    title: { en: 'Vacuum Decay', ko: '진공 붕괴' },
    subtitle: {
      en: 'A truer vacuum appears and rewrites everything without delay.',
      ko: '더 참된 진공이 나타나 지체 없이 모든 것을 다시 쓴다.',
    },
  },
  bounce: {
    title: { en: 'Bounce', ko: '반동' },
    subtitle: {
      en: 'The last universe folds into the first, carrying memory forward.',
      ko: '마지막 우주는 첫 우주로 접히고, 기억을 앞으로 운반한다.',
    },
  },
};

export function EndingCredits({ endingId, language, onComplete }: EndingCreditsProps) {
  const [videoFailed, setVideoFailed] = useState(false);
  const copy = useMemo(() => CREDIT_COPY[endingId], [endingId]);

  useEffect(() => {
    if (!videoFailed) return undefined;
    const timeoutId = window.setTimeout(onComplete, 4500);
    return () => window.clearTimeout(timeoutId);
  }, [onComplete, videoFailed]);

  return (
    <div className="overlay-backdrop ending-cinematic ending-credits">
      <div className="ending-credit-stage">
        <div className="ending-credit-copy">
          <div className="q-stage">{t(language, 'endingCreditsKicker')}</div>
          <h2>{copy.title[language]}</h2>
          <p>{copy.subtitle[language]}</p>
        </div>

        {videoFailed ? (
          <div className="ending-credit-fallback">
            <p>{t(language, 'endingCreditsUnavailable')}</p>
          </div>
        ) : (
          <video
            className="ending-credit-video"
            src={CREDIT_VIDEO[endingId]}
            autoPlay
            playsInline
            controls
            onEnded={onComplete}
            onError={() => setVideoFailed(true)}
          />
        )}

        <button className="q-continue ending-credit-continue" type="button" onClick={onComplete}>
          {t(language, 'endingCreditsContinue')}
        </button>
      </div>
    </div>
  );
}
