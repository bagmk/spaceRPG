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
  description: Record<Lang, string>;
  meta: Record<Lang, string>;
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
    title: { en: 'Heat Death', ko: '열죽음' },
    subtitle: {
      en: 'The universe spends its last gradients and enters equilibrium.',
      ko: '우주는 마지막 기울기를 모두 소모하고 평형으로 들어간다.',
    },
    description: {
      en: 'Over trillions of years, every star burns out. Black holes evaporate through Hawking radiation. The universe reaches a state of maximum entropy — perfectly even temperature everywhere, with no usable energy left to do work. Time still ticks, but no event can occur.',
      ko: '수조 년이 흐르면 모든 별이 꺼지고, 블랙홀마저 호킹 복사로 증발합니다. 우주는 모든 곳이 똑같이 미지근한, 더 이상 일을 할 수 있는 에너지가 남지 않은 최대 엔트로피 상태에 도달합니다. 시간은 흐르지만, 아무 일도 일어날 수 없습니다.',
    },
    meta: {
      en: 'Predicted by the Second Law of Thermodynamics. Currently considered the most likely fate of our universe based on observations of accelerating expansion.',
      ko: '열역학 제2법칙으로 예측됨. 현재 우주의 가속 팽창 관측을 바탕으로 가장 유력하다고 여겨지는 우주의 최후.',
    },
  },
  big_crunch: {
    title: { en: 'Big Crunch', ko: '대붕괴' },
    subtitle: {
      en: 'Expansion yields, and every structure falls back toward one center.',
      ko: '팽창은 굴복하고, 모든 구조는 하나의 중심으로 되돌아간다.',
    },
    description: {
      en: 'If the universe contained enough matter, gravity would eventually overcome cosmic expansion. Galaxies would fall back toward each other, then stars, then atoms — collapsing into a single point of infinite density. The Big Bang in reverse.',
      ko: '우주에 충분한 물질이 있었다면, 결국 중력이 팽창을 이깁니다. 은하가 서로를 향해, 별이, 원자가 무한 밀도의 한 점으로 무너집니다. 빅뱅의 거꾸로.',
    },
    meta: {
      en: 'Once a leading theory; mostly disfavored since 1998 observations showed expansion is accelerating, not slowing. Only possible if dark energy weakens over time.',
      ko: '한때 유력했던 이론. 1998년 우주 팽창이 가속하고 있다는 발견 이후 가능성 낮아짐. 암흑에너지가 시간이 지나며 약해질 때만 가능.',
    },
  },
  big_rip: {
    title: { en: 'Big Rip', ko: '대찢김' },
    subtitle: {
      en: 'Acceleration outruns cohesion and tears every bound scale apart.',
      ko: '가속은 결속을 앞질러 모든 묶인 규모를 찢어낸다.',
    },
    description: {
      en: 'If dark energy grows stronger over time, its repulsive force will eventually overpower all binding forces. Galaxy clusters fly apart first, then individual galaxies, then solar systems, planets, and finally atoms — torn apart because space itself stretches faster than any force can hold things together.',
      ko: '시간이 지날수록 암흑에너지가 강해진다면, 그 척력은 결국 모든 결합력을 이깁니다. 먼저 은하단이, 그 다음 은하가, 태양계가, 행성이, 마지막으로 원자가 찢어집니다 — 공간 자체가 어떤 힘도 잡아둘 수 없을 만큼 빠르게 늘어나기 때문에.',
    },
    meta: {
      en: 'Depends on dark energy being "phantom energy" (equation-of-state parameter w < −1). Possible but not confirmed; current data leaves the door open.',
      ko: '암흑에너지가 "팬텀 에너지" (상태방정식 매개변수 w < −1) 일 때만 가능. 가능성 있지만 미확정 — 현재 데이터는 이 가능성을 닫지 않음.',
    },
  },
  vacuum_decay: {
    title: { en: 'Vacuum Decay', ko: '진공 붕괴' },
    subtitle: {
      en: 'A truer vacuum appears and rewrites everything without delay.',
      ko: '더 참된 진공이 나타나 지체 없이 모든 것을 다시 쓴다.',
    },
    description: {
      en: 'Our universe might not be sitting at the lowest possible energy state. If a more stable vacuum exists, a random quantum tunneling event could create a bubble of "true vacuum" that expands outward at the speed of light, rewriting the laws of physics behind it. No signal could reach us before it arrived.',
      ko: '우리 우주는 사실 가장 낮은 에너지 상태가 아닐 수도 있습니다. 더 안정된 진공이 존재한다면, 무작위 양자 터널링 사건으로 "진짜 진공" 거품이 발생해 빛의 속도로 팽창하며 그 뒤로 물리 법칙을 다시 씁니다. 어떤 신호도 그것보다 먼저 우리에게 도달할 수 없습니다.',
    },
    meta: {
      en: 'Theoretical scenario suggested by Higgs boson measurements indicating our vacuum may be metastable. Could happen at any moment — or never in the observable lifetime of the universe.',
      ko: '힉스 보손 측정에서 우리 진공이 준안정 상태일 가능성이 시사되어 제안된 이론. 지금 당장 일어날 수도, 우주의 관측 가능 수명 안에 한 번도 안 일어날 수도 있음.',
    },
  },
  bounce: {
    title: { en: 'Bounce', ko: '반동 우주' },
    subtitle: {
      en: 'The last universe folds into the first, carrying memory forward.',
      ko: '마지막 우주는 첫 우주로 접히고, 기억을 앞으로 운반한다.',
    },
    description: {
      en: "What if the Big Bang wasn't the beginning? In cyclic cosmology, the universe contracts, \"bounces\" through a quantum gravity phase that smooths out the singularity, and re-expands as a new Big Bang — potentially carrying faint imprints of the previous cycle. Time may be a circle, not a line.",
      ko: '빅뱅이 시작이 아니었다면? 순환 우주론에서는 우주가 수축하고, 특이점을 매끄럽게 만드는 양자 중력 단계를 거쳐 "튕겨" 새로운 빅뱅으로 다시 팽창합니다 — 어쩌면 이전 주기의 희미한 흔적을 품은 채. 시간은 직선이 아닌 원일 수도 있습니다.',
    },
    meta: {
      en: 'Speculative scenarios from loop quantum cosmology and ekpyrotic models. Not the mainstream view, but actively researched as alternatives to a singular Big Bang origin.',
      ko: '루프 양자 우주론과 에크피로틱 모델의 가설적 시나리오. 주류 견해는 아니지만 단일 빅뱅 기원의 대안으로 활발히 연구됨.',
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
    <div className="ending-cinematic ending-credits">
      <div className="ending-credit-scroll">
        {/* Video + overlay title */}
        <div className="ending-credit-hero">
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
              loop
              muted
              disablePictureInPicture
              onContextMenu={(event) => event.preventDefault()}
              onError={() => setVideoFailed(true)}
            />
          )}
          <div className="ending-credit-overlay">
            <h2>{copy.title[language]}</h2>
            <p>{copy.subtitle[language]}</p>
          </div>
        </div>

        {/* Explanation text */}
        <div className="ending-credit-body">
          <p className="ending-credit-explanation-text">{copy.description[language]}</p>
          <p className="ending-credit-explanation-meta">{copy.meta[language]}</p>
        </div>

        <button className="q-continue ending-credit-continue" type="button" onClick={onComplete}>
          {t(language, 'endingCreditsContinue')}
        </button>
      </div>
    </div>
  );
}
