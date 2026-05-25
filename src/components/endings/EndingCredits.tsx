import { useEffect, useMemo, useState } from 'react';
import type { EndingId } from '../../game/types';
import type { SoundManager } from '../../game/audio';
import { getEndingChapterId, getEndingTrackUrls } from '../../game/musicChapters';
import { t, type Lang } from '../../i18n';

interface EndingCreditsProps {
  endingId: EndingId;
  language: Lang;
  onComplete: () => void;
  soundManager?: SoundManager | null;
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
      en: "Picture the universe as a slowly cooling cup of coffee, scaled up by an absurd factor. Lord Kelvin already imagined this finale in 1862, long before anyone knew what a galaxy actually was. Today\'s observations from Planck and DESI strongly favor it. The path is patient: stars run out of hydrogen one by one, the brightest first, until even red dwarfs flicker out around 10¹⁴ years from now. White dwarfs cool to black, neutron stars freeze in place, and Grand Unified Theories suggest the protons themselves may slowly disintegrate over 10³⁴-plus years. Black holes inherit the cosmos next — but Hawking radiation, predicted in 1974 and confirmed mathematically by the 2019 \"Page curve\" calculations, eats them too: a stellar-mass hole lasts 10⁶⁷ years, the largest supermassive ones about 10¹⁰⁰. After that, only red-shifted photons, neutrinos, and stray particles drift through a near-empty expanding space. Temperature evens out everywhere, and no gradient is left to drive any process. Time still ticks, but no event can register on it ever again — including, eventually, your own memory of having played this game.",
      ko: '우주를 천천히 식어가는 커피 한 잔이라고 상상해 보세요. 단지 그 잔이 어처구니없을 만큼 거대할 뿐입니다. 켈빈 경은 누구도 은하가 무엇인지 알지 못했던 1862년에 이미 이런 결말을 떠올렸고, 오늘날 플랑크 위성과 DESI의 관측 결과는 이 결말을 가장 강하게 뒷받침합니다. 과정은 끈질깁니다. 별들은 가장 밝은 별부터 차례로 수소를 다 태우고 사라지고, 가장 오래 사는 적색왜성마저 약 10¹⁴년 뒤에는 깜빡이며 꺼집니다. 백색왜성은 식어 검게 변하고, 중성자별은 그 자리에서 얼어붙으며, 대통일이론이 옳다면 양성자조차 10³⁴년이 넘는 시간 동안 천천히 풀어집니다. 그다음엔 블랙홀이 우주를 물려받습니다. 그러나 1974년에 호킹이 예측하고 2019년의 "페이지 곡선" 계산으로 정보 보존이 수학적으로 확인된 호킹 복사가 블랙홀마저 갉아먹습니다 — 항성 질량은 약 10⁶⁷년, 가장 큰 거대 블랙홀은 약 10¹⁰⁰년이면 사라집니다. 그 후엔 적색편이된 광자, 중성미자, 외로운 입자들만이 거의 텅 빈 팽창 공간을 떠다닐 뿐입니다. 온도가 어디나 똑같아져 어떤 과정도 일으킬 기울기가 남지 않습니다. 시간은 계속 흐르지만, 어떤 사건도 다시는 그 위에 기록되지 않습니다. 결국엔 당신이 이 게임을 했다는 기억마저도.',
    },
    meta: {
      en: "Predicted by the Second Law of Thermodynamics and currently the textbook \"default\" fate of our cosmos. Planck 2018 measured the dark-energy equation-of-state parameter w ≈ −1 (consistent with a constant cosmological constant), and DESI\'s 2024–2025 data, while hinting at slight evolution, has not yet derailed the heat-death timeline. Quantum mechanics has one last twist: on truly astronomical timescales (10^(10^120) years, Poincaré recurrence), vacuum fluctuations could in principle assemble \"Boltzmann brains\" — fully formed conscious observers popping into existence by accident. They cannot escape the surrounding equilibrium, but they are statistically inevitable. Modern cosmologists treat this as a serious problem for any cosmology that includes infinite quiet time.",
      ko: '열역학 제2법칙으로 예측된, 현재 교과서적으로 "기본"인 우주의 결말입니다. 플랑크 위성의 2018년 발표는 암흑에너지 상태방정식 매개변수 w ≈ −1 (즉 일정한 우주상수와 일치) 라는 값을 내놓았고, 2024–2025년 DESI 결과는 미세한 진화 단서를 보여주긴 했지만 아직 열적 죽음 일정표 자체를 흔들지는 못했습니다. 양자역학은 마지막 반전을 숨겨둡니다 — 정말로 천문학적인 시간(10^(10^120)년의 푸앵카레 재귀)이 흐르면, 진공 요동에서 우연히 완성된 의식 관찰자, 이른바 "볼츠만 뇌"가 자발적으로 조립될 수 있습니다. 그들은 주변의 평형을 벗어날 수 없지만, 통계적으로는 피할 수 없습니다. 현대 우주론자들은 무한히 긴 정적의 시간을 포함하는 모든 시나리오에 대해 이 가설을 진지한 문젯거리로 다룹니다.',
    },
  },
  big_crunch: {
    title: { en: 'Big Crunch', ko: '대붕괴' },
    subtitle: {
      en: 'Expansion yields, and every structure falls back toward one center.',
      ko: '팽창은 굴복하고, 모든 구조는 하나의 중심으로 되돌아간다.',
    },
    description: {
      en: "Imagine playing the cosmic film in reverse. Expansion slows, halts at some maximum, then turns around. Distant galaxies, after billions of years of running away, swing back. The cosmic microwave background — only 2.7 kelvin today — begins to heat as space contracts. Within a few billion years the night sky brightens; eventually it glows red, then orange, then white-hot enough that life is impossible anywhere. Stars boil away in the rising bath of photons before they can finish their normal lifecycles. Then atoms ionize. Then nuclei dissolve back into a quark-gluon plasma. The Penrose–Hawking singularity theorems (1965–1970) proved that, under fairly mild assumptions, this kind of collapse cannot avoid funneling into a true mathematical singularity — a single point of infinite density, the mirror of the Big Bang. Time as we know it ends there. The 2024 DESI Year-1 release and 2025 Year-3 follow-up have re-opened this scenario unexpectedly: if their hints that the dark-energy equation-of-state w(z) drifts away from −1 hold up under more data, expansion could in principle stop and reverse on timescales of ~50–100 billion years. Most cosmologists are still cautious, but the debate is alive in a way it hasn\'t been for two decades.",
      ko: '우주라는 영상을 거꾸로 돌리는 모습을 상상해 보세요. 팽창이 점차 느려져 어느 정점에서 멈추고, 마침내 방향을 바꿉니다. 수십억 년 동안 우리에게서 멀어지던 은하들이 다시 돌아옵니다. 오늘날 겨우 2.7 K인 우주배경복사는 공간이 수축하면서 점점 데워집니다. 수십억 년 뒤면 밤하늘이 밝아지기 시작하고, 결국 붉게, 주황으로, 그리고 어디서도 생명이 살 수 없을 만큼 환한 백열로 변합니다. 별들은 자기 정상 수명을 다 채우기도 전에 그 광자 바다에서 끓어 사라집니다. 그다음엔 원자가 이온화되고, 원자핵마저 풀어져 다시 쿼크-글루온 플라스마가 됩니다. 1965~1970년 펜로즈와 호킹이 발표한 특이점 정리는, 꽤 일반적인 가정만으로도 이런 붕괴가 진짜 수학적 특이점 — 무한 밀도의 한 점, 즉 빅뱅의 거울상 — 으로 빨려들 수밖에 없음을 증명했습니다. 우리가 아는 시간은 거기서 끝납니다. 2024년 발표된 DESI 1년차 결과와 2025년 후속 분석은 이 시나리오를 뜻밖에 다시 살려냈습니다. 만약 암흑에너지 상태방정식 w(z)가 −1에서 벗어나 시간에 따라 변한다는 그 단서가 더 많은 데이터로도 살아남는다면, 약 500억~1000억 년 뒤에 팽창이 멈추고 역전될 가능성도 원리적으로 열립니다. 대부분의 우주론자는 아직 신중하지만, 이 논쟁은 20년 만에 다시 활발해졌습니다.',
    },
    meta: {
      en: "Long disfavored after the 1998 supernova discovery of accelerating expansion (Perlmutter, Riess, Schmidt; Nobel 2011). DESI 2024–2025 has shaken the consensus by reporting w₀ ≈ −0.95 and wₐ ≈ −0.4 (evolving dark energy) with ~4σ tension against a pure cosmological constant — Riess\'s 2024 SH0ES paper called it the most important cosmological discovery since acceleration itself. Some ekpyrotic and cyclic models connect a future Big Crunch directly to the next Big Bang, blurring the line between this ending and the Bounce.",
      ko: '1998년 펄머터·리스·슈미트의 초신성 관측이 우주의 가속 팽창을 보여준 (2011년 노벨상) 이후 오랫동안 비주류로 밀려나 있었습니다. 그러나 2024~2025년 DESI는 w₀ ≈ −0.95, wₐ ≈ −0.4라는 "진화하는 암흑에너지" 결과를 약 4σ 신뢰도로 발표하며 합의를 흔들었습니다 — 리스의 2024년 SH0ES 논문은 이를 "가속 팽창 발견 이래 가장 중요한 우주론적 발견"이라고 표현했습니다. 일부 에크피로틱·순환 우주론은 미래의 대붕괴를 곧장 다음 빅뱅과 연결해, 이 결말과 다음의 "반동" 시나리오 사이의 경계를 흐려놓기도 합니다.',
    },
  },
  big_rip: {
    title: { en: 'Big Rip', ko: '대찢김' },
    subtitle: {
      en: 'Acceleration outruns cohesion and tears every bound scale apart.',
      ko: '가속은 결속을 앞질러 모든 묶인 규모를 찢어낸다.',
    },
    description: {
      en: "This is the most violent ending. Robert Caldwell, Marc Kamionkowski, and Nevin Weinberg sketched it out in 2003: what if dark energy isn\'t merely constant but actively grows stronger over time? They called this hypothetical fluid \"phantom energy\" — equation-of-state parameter w < −1, which technically violates several theoretical \"energy conditions\" we usually assume. As space stretches, phantom energy intensifies, pushing harder, in a runaway loop. The countdown to the end becomes specific and terrifying. About 60 million years before the rip, galaxy clusters fly apart. Three months before, our own Milky Way disassembles, individual stars suddenly finding themselves alone in deep void. Half an hour before, the Solar System loses its planets to the stretching of space. The Earth\'s atmosphere tears off seconds before its surface. In the final 10⁻¹⁹ seconds, even atoms come apart — the space between proton and electron stretches faster than light can cross it. The very fabric of spacetime is shredded at the end, with every length scale separating at once. Then there are no more length scales to separate. The story stops because there is nothing left to tell it.",
      ko: '이건 가장 격렬한 결말입니다. 2003년 로버트 콜드웰·마크 카미온코프스키·네빈 와인버그가 정식화한 시나리오로, 만약 암흑에너지가 단순히 일정한 게 아니라 시간이 갈수록 정말로 강해진다면 어떻게 되는지를 그렸습니다. 그들은 이 가상의 에너지를 "팬텀 에너지"라 불렀습니다 — 상태방정식 매개변수 w < −1로, 보통 가정하는 여러 이론적 "에너지 조건"을 위반합니다. 공간이 늘어날수록 팬텀 에너지는 더 강해지고, 점점 더 세게 밀어내며, 자기 자신을 폭주시킵니다. 끝까지의 카운트다운은 무서울 만큼 구체적입니다. 약 6천만 년 전, 은하단이 갈라집니다. 3개월 전, 우리 은하수가 풀어지고 별들이 갑자기 깊은 빈 공간에 외로이 서 있게 됩니다. 30분 전, 태양계가 행성들을 잃습니다 — 공간 자체가 그들을 멀리 밀어내기 때문입니다. 지구의 대기는 표면이 분해되기 몇 초 전에 먼저 떨어져 나갑니다. 마지막 10⁻¹⁹초에는 원자조차 부서집니다. 양성자와 전자 사이의 공간이, 빛이 한 번 가로지를 수 있는 시간보다 빨리 늘어나기 때문입니다. 정말 마지막엔 시공간 자체가 갈가리 찢어집니다. 어떤 작은 길이도, 동시에 둘로 나뉩니다. 그러고 나면 더 이상 나뉠 길이조차 남지 않습니다. 이야기를 들려줄 무엇도 남지 않았기 때문에, 이야기는 거기서 멈춥니다.',
    },
    meta: {
      en: "For a phantom-energy parameter w ≈ −1.5, the Rip arrives in about 22 billion years. The 2024 DESI release sparked the loudest revival of this scenario in years — its preferred wₐ < 0 trajectory actually crosses the phantom boundary on certain time windows. Whether the apparent w-evolution survives systematic checks (BAO calibration, supernova reanalysis, JWST distance ladder) is one of the hottest open questions in cosmology in 2025. Even if it doesn\'t, the math of phantom fields keeps re-appearing in inflation models and modified-gravity theories, so the Big Rip refuses to stay buried.",
      ko: 'w ≈ −1.5인 팬텀 에너지라면 대찢김은 약 220억 년 뒤에 도착합니다. 2024년 DESI 발표는 이 시나리오를 수년 만에 가장 큰 목소리로 부활시켰습니다 — DESI의 가장 잘 맞는 wₐ < 0 경로는 특정 시간 구간에서 실제로 팬텀 경계를 넘나듭니다. 이 명백한 w 진화가 BAO 보정, 초신성 재분석, JWST 거리 사다리 같은 계통 오차 점검을 통과할지 여부는 2025년 우주론의 가장 뜨거운 미해결 문제 중 하나입니다. 설령 살아남지 못해도, 팬텀 장의 수학은 인플레이션 모형이나 수정 중력 이론에서 거듭 등장하기 때문에, 대찢김은 좀처럼 사라지지 않고 자꾸 되살아납니다.',
    },
  },
  vacuum_decay: {
    title: { en: 'Vacuum Decay', ko: '진공 붕괴' },
    subtitle: {
      en: 'A truer vacuum appears and rewrites everything without delay.',
      ko: '더 참된 진공이 나타나 지체 없이 모든 것을 다시 쓴다.',
    },
    description: {
      en: "Here\'s the unsettling thought: our universe\'s vacuum may not be the lowest possible energy state. It might just be a \"false\" vacuum, a long-lived plateau perched above a deeper \"true\" vacuum waiting at lower energy. Quantum mechanics means that, somewhere in the universe, at some random moment, a microscopic bubble of true vacuum can spontaneously tunnel into existence — exactly the way an alpha particle escapes a heavy nucleus, just with all of physics on the inside instead of one particle. Once it exists, the bubble wall accelerates outward to essentially the speed of light. Inside, the laws of physics are different: particle masses change, the strengths of the fundamental forces shift, atoms and stars cannot exist the way we know them. The truly horrifying part is that you never see it coming. The bubble wall arrives at exactly the same instant as the light that would announce its existence — both move at c. There is no early warning, no flash on the horizon. One moment everything is normal; the next, the universe has been rewritten around you, and \"you\" are no longer a meaningful concept. Sidney Coleman and Frank De Luccia worked out the geometry in 1980 in a paper memorably titled \"Gravitational Effects on and of Vacuum Decay.\"",
      ko: '여기 좀 으스스한 생각이 있습니다. 우리 우주의 진공은 사실 가장 낮은 에너지 상태가 아닐 수도 있다는 것입니다. 그저 오래 머무는 "거짓 진공", 더 깊은 "진짜 진공" 위에 자리잡은 긴 안정 영역일 수 있습니다. 양자역학은 우주 어딘가에서, 어느 순간, 미세한 진짜 진공 거품이 자발적으로 양자 터널링으로 등장할 수 있게 허용합니다 — 무거운 원자핵에서 알파 입자가 탈출하는 것과 똑같은 원리지만, 입자 하나 대신 물리 법칙 전체가 그 안에 들어 있을 뿐입니다. 거품이 일단 생기면, 그 벽은 사실상 빛의 속도로 바깥으로 가속됩니다. 거품 안에서는 물리 법칙이 다릅니다. 입자의 질량이 바뀌고, 기본 힘의 세기가 변하며, 우리가 아는 원자와 별은 존재할 수 없습니다. 정말 무서운 부분은 다가오는 모습을 절대 볼 수 없다는 점입니다. 거품 벽이 도착하는 순간과, 그 존재를 알리는 빛이 도착하는 순간이 정확히 같습니다 — 둘 다 c로 움직이기 때문입니다. 경고도 없고, 지평선의 섬광도 없습니다. 한순간 모든 게 정상이다가, 다음 순간 우주가 당신을 둘러싼 채로 새로 쓰여 있습니다. 그리고 그 시점엔 "당신"이라는 개념조차 더 이상 의미 없습니다. 시드니 콜먼과 프랭크 디 루치아가 1980년 발표한 논문 — 인상적인 제목 "진공 붕괴에 미치는 그리고 진공 붕괴가 미치는 중력 효과" — 이 이 거품의 기하학을 정식으로 풀어냈습니다.',
    },
    meta: {
      en: "Andreassen, Frost, and Schwartz (2018) re-ran the calculation with the LHC\'s precise measurements of the Higgs boson mass (125.10 GeV) and the top-quark mass (~172.6 GeV) and concluded our vacuum is metastable, with a half-life of roughly 10¹³⁹ years. That number is so vast that black holes will evaporate, all matter will decay, and heat death will arrive long, long before any bubble realistically nucleates. But the mathematics is clear: it could happen anywhere in the cosmos, at any second, with no warning. Some grand-unified-theory extensions and supersymmetric scenarios push the vacuum back into stability — so getting our vacuum-stability story straight is one of the strongest experimental motivations for finding physics beyond the Standard Model.",
      ko: '안드레아센·프로스트·슈워츠(2018)는 LHC의 정밀 측정값 — 힉스 보손 125.10 GeV, 톱쿼크 약 172.6 GeV — 을 사용해 계산을 다시 돌리고, 우리 진공이 준안정 상태이며 반감기가 약 10¹³⁹년이라는 결론을 내놓았습니다. 이 숫자가 너무나 커서, 어떤 거품이 현실적으로 핵 생성되기 한참 전에 블랙홀이 다 증발하고 모든 물질이 붕괴하며 열적 죽음이 찾아오게 됩니다. 그러나 수학은 분명합니다. 어디서든, 어느 순간에도, 경고 없이 일어날 수 있습니다. 일부 대통일이론 확장이나 초대칭 시나리오는 진공을 다시 안정한 영역으로 밀어 넣는데, 그래서 진공 안정성 이야기를 깔끔히 풀어내는 것이 표준 모형 너머의 물리를 찾는 가장 강력한 실험적 동기 중 하나가 됩니다.',
    },
  },
  bounce: {
    title: { en: 'Bounce', ko: '반동 우주' },
    subtitle: {
      en: 'The last universe folds into the first, carrying memory forward.',
      ko: '마지막 우주는 첫 우주로 접히고, 기억을 앞으로 운반한다.',
    },
    description: {
      en: "What if the Big Bang wasn\'t the beginning of anything, just the rebound of a previous universe\'s collapse? Loop Quantum Cosmology, developed by Abhay Ashtekar and collaborators throughout the 2000s, replaces the classical singularity with a quantum bounce: at extreme densities, the discrete granular structure of spacetime predicted by loop quantum gravity resists further compression and springs back outward. The universe was finite all the way through, just very dense for an instant. Roger Penrose\'s Conformal Cyclic Cosmology goes wilder: an infinite chain of \"aeons\" follows one another, each ending in heat death and dark-energy expansion, then being conformally rescaled — stretched and squashed in a way that preserves angles but destroys lengths — into the seed of the next Big Bang. In this picture time is not a line but a loop, and our cosmos is one heartbeat in a chain that has no first or last. Penrose has spent the late 2010s and early 2020s searching for \"Hawking points\": warm circular patches in the cosmic microwave background that, in his theory, would be the scars left by giant black holes that finished evaporating in the previous aeon. Several studies have reported tentative detections; others insist the patterns are just noise. The argument is still unresolved.",
      ko: '빅뱅이 무언가의 시작이 아니라, 이전 우주의 붕괴가 다시 튕긴 순간이라면 어떨까요? 2000년대에 아바이 아쉬테카르와 동료들이 발전시킨 루프 양자 우주론(LQC)은 고전적 특이점을 양자 반동으로 대체합니다 — 극단적인 밀도에서는 루프 양자 중력이 예측한 시공간의 알갱이 구조가 더 이상의 압축을 거부하고 바깥으로 다시 튕깁니다. 우주는 시종일관 유한했고, 단지 한순간 매우 빽빽했을 뿐입니다. 로저 펜로즈의 등각 순환 우주론(CCC)은 훨씬 더 대담합니다. 무한히 많은 "이언(aeon)"이 차례로 이어지는데, 각 이언은 열적 죽음과 암흑에너지 팽창으로 끝난 뒤 등각 변환 — 각도는 보존하되 길이는 모두 사라지는 변환 — 을 거쳐 다음 빅뱅의 씨앗으로 다시 그려집니다. 이 그림에서 시간은 직선이 아닌 고리이고, 우리 우주는 처음도 끝도 없는 사슬의 한 박동일 뿐입니다. 펜로즈는 2010년대 후반과 2020년대 초반을 "호킹 포인트" 찾는 데 보냈습니다 — 그의 이론에서, 이전 이언에서 완전히 증발한 거대 블랙홀들이 우주배경복사에 따뜻한 원형 자국으로 남겨야 하는 흔적입니다. 몇몇 연구가 잠정적 검출을 보고했지만, 다른 연구들은 그 패턴이 그저 잡음이라고 반박합니다. 논쟁은 아직 끝나지 않았습니다.',
    },
    meta: {
      en: "Active areas of research in 2024–2025: Ashtekar\'s LQC bounce predicts subtle, potentially observable imprints on the CMB power spectrum at large scales, which next-generation experiments like the Simons Observatory (first light 2024) and CMB-S4 (planned 2030s) may be able to test. Penrose\'s Hawking-points claims, made jointly with Daniel An and Krzysztof Meissner, have been challenged by the Planck collaboration\'s own analyses but refuse to die quietly. Ekpyrotic and \"cyclic\" cosmologies championed by Paul Steinhardt and Neil Turok offer yet another bouncing variant, where two parallel \"branes\" in higher-dimensional space periodically collide. None of these is mainstream, but together they refuse to let the awkward question \"what came before the Big Bang?\" stay unanswered.",
      ko: '2024~2025년에도 활발히 연구되는 분야들: 아쉬테카르의 루프 양자 우주론 반동은 우주배경복사 파워 스펙트럼의 큰 각 척도에 미묘하지만 관측 가능한 흔적을 예측합니다. 차세대 실험인 사이먼스 천문대(2024년 첫 빛)와 CMB-S4(2030년대 계획) 같은 망원경이 이를 검증할 수 있을지도 모릅니다. 펜로즈가 다니엘 안·크쥐슈토프 마이스너와 함께 발표한 "호킹 포인트" 주장은 플랑크 협력단 자체 분석에서 반박을 받았지만, 조용히 사라지지는 않습니다. 폴 스타인하트와 닐 투록이 옹호하는 에크피로틱·"순환" 우주론은 또 다른 종류의 반동 — 고차원 공간에서 두 평행 "브레인"이 주기적으로 충돌하는 — 을 제안합니다. 어느 것도 주류는 아니지만, 그들이 함께 거부하지 않는 한 가지가 있습니다. "빅뱅 이전에 무엇이 있었는가?" 라는 까다로운 질문이 영영 답 없이 남는 것 말입니다.',
    },
  },
};

export function EndingCredits({ endingId, language, onComplete, soundManager }: EndingCreditsProps) {
  const [videoFailed, setVideoFailed] = useState(false);
  const copy = useMemo(() => CREDIT_COPY[endingId], [endingId]);

  useEffect(() => {
    if (!videoFailed) return undefined;
    const timeoutId = window.setTimeout(onComplete, 4500);
    return () => window.clearTimeout(timeoutId);
  }, [onComplete, videoFailed]);

  // Ending-specific music: fade out chapter BGM, lazy-load the ending track,
  // and play it under the (muted) cinematic video. On unmount, fade out so
  // the next screen (FinalScreen / multiverse) starts on a clean slate.
  useEffect(() => {
    if (!soundManager) return undefined;
    soundManager.fadeOutMusic(1500);
    const chapterId = getEndingChapterId(endingId);
    void soundManager.loadAndPlayChapterPool(chapterId, getEndingTrackUrls(endingId), 2000);
    return () => {
      soundManager.fadeOutMusic(1500);
    };
  }, [soundManager, endingId]);

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
