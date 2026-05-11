import type { Lang } from '../i18n';

interface L { en: string; ko: string }

export interface StageLog {
  stageId: number;
  progress: number; // 0–100
  title: L;
  message: L;
}

export function pickLogText(value: L, lang: Lang): string {
  return value[lang] || value.en;
}

export const STAGE_LOGS: StageLog[] = [
  // Stage 1 — Inflation
  { stageId: 1, progress: 0,   title: { en: 'Inflation Begins',       ko: '인플레이션 시작' },        message: { en: 'Space itself begins an almost impossible expansion.', ko: '공간 자체가 거의 불가능한 팽창을 시작합니다.' } },
  { stageId: 1, progress: 10,  title: { en: 'A Tiny Universe',        ko: '아주 작은 우주' },         message: { en: 'Everything visible is still packed into a microscopic state.', ko: '보이는 모든 것이 아직 미시적인 상태에 압축되어 있습니다.' } },
  { stageId: 1, progress: 25,  title: { en: 'Expansion Surge',        ko: '팽창 가속' },              message: { en: 'Distances stretch before matter has time to organize.', ko: '물질이 정리할 시간을 갖기도 전에 거리가 늘어납니다.' } },
  { stageId: 1, progress: 50,  title: { en: 'Quantum Seeds',          ko: '양자 씨앗' },              message: { en: 'Tiny fluctuations are stretched into the first hints of cosmic structure.', ko: '작은 요동이 늘어나 최초의 우주 구조의 단서가 됩니다.' } },
  { stageId: 1, progress: 75,  title: { en: 'Cooling Begins',         ko: '냉각 시작' },              message: { en: 'The young universe expands, thins, and starts to cool.', ko: '어린 우주는 팽창하고 옅어지며 식기 시작합니다.' } },
  { stageId: 1, progress: 90,  title: { en: 'Inflation Settles',      ko: '인플레이션 안정' },        message: { en: 'The violent expansion slows into a universe ready to evolve.', ko: '격렬한 팽창이 진화할 준비가 된 우주로 가라앉습니다.' } },
  { stageId: 1, progress: 100, title: { en: 'Inflation Complete',     ko: '인플레이션 완료' },        message: { en: 'The universe has grown enough for particles and fields to matter.', ko: '우주는 입자와 장이 의미를 가질 만큼 커졌습니다.' } },

  // Stage 2 — Baryogenesis
  { stageId: 2, progress: 0,   title: { en: 'Matter Takes the Stage', ko: '물질의 등장' },            message: { en: 'Matter and antimatter emerge in a nearly perfect balance.', ko: '물질과 반물질이 거의 완벽한 균형으로 나타납니다.' } },
  { stageId: 2, progress: 10,  title: { en: 'Symmetry Holds',         ko: '대칭 유지' },              message: { en: 'For every particle, an opposite partner appears.', ko: '모든 입자에 대해 반대 짝이 나타납니다.' } },
  { stageId: 2, progress: 25,  title: { en: 'Annihilation',           ko: '쌍소멸' },                 message: { en: 'Matter and antimatter collide, turning mass back into radiation.', ko: '물질과 반물질이 충돌하며 질량이 다시 복사로 돌아갑니다.' } },
  { stageId: 2, progress: 50,  title: { en: 'A Small Imbalance',      ko: '작은 불균형' },            message: { en: 'A tiny excess of matter survives the annihilation.', ko: '쌍소멸 속에서 아주 미세한 물질의 잉여가 살아남습니다.' } },
  { stageId: 2, progress: 75,  title: { en: 'Matter Remains',         ko: '물질이 남다' },            message: { en: 'Almost everything vanished, but the leftover matter will become everything we know.', ko: '거의 모든 것이 사라졌지만, 남은 물질이 우리가 아는 모든 것이 될 것입니다.' } },
  { stageId: 2, progress: 90,  title: { en: 'The Bias Is Set',        ko: '편향 확정' },              message: { en: 'The universe now has enough matter to build future structure.', ko: '우주는 이제 미래 구조를 만들기에 충분한 물질을 갖습니다.' } },
  { stageId: 2, progress: 100, title: { en: 'Matter Wins',            ko: '물질의 승리' },            message: { en: 'The first great filter is passed: something remains instead of nothing.', ko: '첫 번째 거대한 필터를 통과합니다. 무(無) 대신 무언가가 남았습니다.' } },

  // Stage 3 — Quark-Gluon Plasma
  { stageId: 3, progress: 0,   title: { en: 'Particle Soup',          ko: '입자 수프' },              message: { en: 'The universe is too hot for protons or neutrons to hold together.', ko: '우주가 너무 뜨거워 양성자나 중성자가 결합하지 못합니다.' } },
  { stageId: 3, progress: 10,  title: { en: 'Free Quarks',            ko: '자유 쿼크' },              message: { en: 'Quarks and gluons move through an extremely hot, dense plasma.', ko: '쿼크와 글루온이 매우 뜨겁고 밀도 높은 플라스마 속을 움직입니다.' } },
  { stageId: 3, progress: 25,  title: { en: 'No Atoms Yet',           ko: '아직 원자는 없음' },       message: { en: 'Matter exists, but it is still too energetic to form stable structures.', ko: '물질은 존재하지만, 안정된 구조를 만들기에는 너무 활기찹니다.' } },
  { stageId: 3, progress: 50,  title: { en: 'Cooling Plasma',         ko: '식어가는 플라스마' },      message: { en: 'Expansion lowers the temperature enough for particles to begin pairing.', ko: '팽창으로 온도가 낮아져 입자가 짝을 이루기 시작합니다.' } },
  { stageId: 3, progress: 75,  title: { en: 'Confinement Nears',      ko: '가둠 임박' },              message: { en: 'Quarks begin losing their freedom as the universe cools.', ko: '우주가 식으면서 쿼크가 자유를 잃기 시작합니다.' } },
  { stageId: 3, progress: 90,  title: { en: 'Hadron Formation',       ko: '강입자 형성' },            message: { en: 'The first stable protons and neutrons are about to appear.', ko: '최초의 안정된 양성자와 중성자가 등장하려 합니다.' } },
  { stageId: 3, progress: 100, title: { en: 'Plasma Condensed',       ko: '플라스마 응축' },          message: { en: 'The universe leaves the quark-gluon sea behind.', ko: '우주가 쿼크-글루온 바다를 뒤로합니다.' } },

  // Stage 4 — Nucleosynthesis
  { stageId: 4, progress: 0,   title: { en: 'Nuclei Begin',           ko: '핵의 시작' },              message: { en: 'Protons and neutrons start joining into the first atomic nuclei.', ko: '양성자와 중성자가 결합하여 최초의 원자핵을 만들기 시작합니다.' } },
  { stageId: 4, progress: 10,  title: { en: 'Hydrogen Dominates',     ko: '수소가 지배' },            message: { en: 'Simple hydrogen nuclei fill most of the young universe.', ko: '단순한 수소 원자핵이 어린 우주의 대부분을 채웁니다.' } },
  { stageId: 4, progress: 25,  title: { en: 'Helium Forms',           ko: '헬륨 생성' },              message: { en: 'Some particles fuse into helium, the second great ingredient of stars.', ko: '일부 입자가 융합되어 별의 두 번째 주요 성분인 헬륨이 됩니다.' } },
  { stageId: 4, progress: 50,  title: { en: 'Light Elements',         ko: '가벼운 원소' },            message: { en: 'A small amount of deuterium, helium, and lithium joins the mix.', ko: '소량의 중수소, 헬륨, 리튬이 혼합물에 합류합니다.' } },
  { stageId: 4, progress: 75,  title: { en: 'Fusion Window Closing',  ko: '핵융합 창이 닫힘' },       message: { en: 'The universe cools too quickly for heavier elements to form here.', ko: '우주가 너무 빨리 식어 무거운 원소가 여기서 만들어지지 못합니다.' } },
  { stageId: 4, progress: 90,  title: { en: 'Primordial Recipe',      ko: '원시 레시피' },            message: { en: 'The early chemical inventory is nearly fixed.', ko: '초기 화학 목록이 거의 확정됩니다.' } },
  { stageId: 4, progress: 100, title: { en: 'First Nuclei Complete',  ko: '첫 핵 형성 완료' },        message: { en: 'Hydrogen and helium wait in the dark for the first stars.', ko: '수소와 헬륨이 어둠 속에서 첫 별을 기다립니다.' } },

  // Stage 5 — Recombination
  { stageId: 5, progress: 0,   title: { en: 'Opaque Universe',        ko: '불투명한 우주' },          message: { en: 'Light is trapped in a hot fog of charged particles.', ko: '빛이 뜨거운 대전 입자의 안개에 갇혀 있습니다.' } },
  { stageId: 5, progress: 10,  title: { en: 'Electrons Slow',         ko: '전자 감속' },              message: { en: 'Cooling allows electrons to approach atomic nuclei.', ko: '냉각으로 전자가 원자핵에 접근할 수 있게 됩니다.' } },
  { stageId: 5, progress: 25,  title: { en: 'Atoms Form',             ko: '원자 형성' },              message: { en: 'Electrons bind to nuclei, creating the first neutral atoms.', ko: '전자가 핵과 결합하여 최초의 중성 원자를 만듭니다.' } },
  { stageId: 5, progress: 50,  title: { en: 'Light Escapes',          ko: '빛의 탈출' },              message: { en: 'Photons can finally travel freely across space.', ko: '광자가 마침내 공간을 자유롭게 가로지를 수 있습니다.' } },
  { stageId: 5, progress: 75,  title: { en: 'The Universe Clears',    ko: '우주가 맑아짐' },          message: { en: 'The cosmic fog fades into a faint background glow.', ko: '우주 안개가 희미한 배경 빛으로 사라집니다.' } },
  { stageId: 5, progress: 90,  title: { en: 'Afterglow',              ko: '잔광' },                   message: { en: 'The released light becomes the oldest visible signal in the universe.', ko: '풀려난 빛이 우주에서 가장 오래된 가시 신호가 됩니다.' } },
  { stageId: 5, progress: 100, title: { en: 'Darkness Falls',         ko: '어둠이 내려옴' },          message: { en: 'The universe is transparent now, but no stars exist yet.', ko: '우주는 이제 투명하지만, 아직 별이 존재하지 않습니다.' } },

  // Stage 6 — Cosmic Dark Age
  { stageId: 6, progress: 0,   title: { en: 'Cosmic Dark Age',        ko: '우주 암흑시대' },          message: { en: 'The universe is clear, cold, and almost completely dark.', ko: '우주는 맑고, 차갑고, 거의 완전히 어둡습니다.' } },
  { stageId: 6, progress: 10,  title: { en: 'No Stars Yet',           ko: '아직 별은 없음' },         message: { en: 'Hydrogen and helium drift through space without a source of light.', ko: '수소와 헬륨이 빛의 원천 없이 공간을 떠돕니다.' } },
  { stageId: 6, progress: 25,  title: { en: 'Gravity Begins Its Work',ko: '중력이 일하기 시작' },     message: { en: 'Tiny density differences slowly pull gas into darker regions.', ko: '작은 밀도 차이가 천천히 기체를 더 어두운 영역으로 끌어당깁니다.' } },
  { stageId: 6, progress: 50,  title: { en: 'Clouds Gather',          ko: '구름이 모임' },            message: { en: 'Invisible halos and gas clouds begin shaping the future cosmic web.', ko: '보이지 않는 헤일로와 기체 구름이 미래 우주 거미줄을 빚기 시작합니다.' } },
  { stageId: 6, progress: 75,  title: { en: 'Collapse Deepens',       ko: '붕괴 심화' },              message: { en: 'The densest clouds grow heavy enough to prepare for ignition.', ko: '가장 밀도 높은 구름이 점화를 준비할 만큼 무거워집니다.' } },
  { stageId: 6, progress: 90,  title: { en: 'First Cores',            ko: '최초의 핵' },              message: { en: 'The first star-forming cores begin to warm inside the darkness.', ko: '최초의 별 형성 핵이 어둠 속에서 데워지기 시작합니다.' } },
  { stageId: 6, progress: 100, title: { en: 'The First Light Approaches', ko: '최초의 빛 임박' },     message: { en: 'The dark age is about to end.', ko: '암흑시대가 끝나려 합니다.' } },

  // Stage 7 — First Stars
  { stageId: 7, progress: 0,   title: { en: 'First Stars',            ko: '최초의 별' },              message: { en: 'Gravity compresses primordial gas until the first stars can ignite.', ko: '중력이 원시 기체를 압축해 최초의 별이 점화될 수 있게 합니다.' } },
  { stageId: 7, progress: 10,  title: { en: 'Dense Primordial Clouds',ko: '밀집 원시 구름' },         message: { en: 'Hydrogen gathers into massive, unstable clouds.', ko: '수소가 거대하고 불안정한 구름으로 모입니다.' } },
  { stageId: 7, progress: 25,  title: { en: 'Ignition',               ko: '점화' },                   message: { en: 'The first stars ignite, ending millions of years of darkness.', ko: '최초의 별이 점화되어 수백만 년의 어둠을 끝냅니다.' } },
  { stageId: 7, progress: 50,  title: { en: 'Massive and Brief',      ko: '거대하고 짧은 생애' },     message: { en: 'These early stars burn intensely and live fast.', ko: '이 초기 별들은 격렬하게 타오르며 빠르게 살아갑니다.' } },
  { stageId: 7, progress: 75,  title: { en: 'First Heavy Elements',   ko: '최초의 무거운 원소' },     message: { en: 'Inside the first stars, heavier elements begin to form.', ko: '최초의 별 내부에서 무거운 원소가 만들어지기 시작합니다.' } },
  { stageId: 7, progress: 90,  title: { en: 'Radiation Fronts',       ko: '복사 전선' },              message: { en: 'Starlight pushes into the surrounding gas.', ko: '별빛이 주변 기체로 밀고 들어갑니다.' } },
  { stageId: 7, progress: 100, title: { en: 'The Universe Lights Up', ko: '우주가 밝아짐' },          message: { en: 'The first stars prepare the universe for galaxies.', ko: '최초의 별이 우주를 은하를 위해 준비시킵니다.' } },

  // Stage 8 — Reionization
  { stageId: 8, progress: 0,   title: { en: 'Reionization Begins',    ko: '재이온화 시작' },          message: { en: 'Energetic starlight starts changing the gas between galaxies.', ko: '강력한 별빛이 은하 사이의 기체를 바꾸기 시작합니다.' } },
  { stageId: 8, progress: 10,  title: { en: 'Ionized Bubbles',        ko: '이온화 거품' },            message: { en: 'Light carves glowing bubbles around the first stars.', ko: '빛이 첫 별 주위에 빛나는 거품을 새깁니다.' } },
  { stageId: 8, progress: 25,  title: { en: 'Growing Cavities',       ko: '성장하는 공동' },          message: { en: 'Ionized regions expand into the neutral hydrogen fog.', ko: '이온화된 영역이 중성 수소 안개로 확장됩니다.' } },
  { stageId: 8, progress: 50,  title: { en: 'Bubbles Overlap',        ko: '거품의 중첩' },            message: { en: 'Separate regions of light begin connecting across space.', ko: '분리된 빛의 영역이 공간을 가로질러 연결되기 시작합니다.' } },
  { stageId: 8, progress: 75,  title: { en: 'The Fog Breaks',         ko: '안개가 걷힘' },            message: { en: 'The universe becomes increasingly transparent to ultraviolet light.', ko: '우주가 자외선에 점점 더 투명해집니다.' } },
  { stageId: 8, progress: 90,  title: { en: 'Cosmic Web Revealed',    ko: '우주 거미줄 드러남' },     message: { en: 'The large-scale structure of the universe becomes easier to see.', ko: '우주의 거대 구조가 보기 쉬워집니다.' } },
  { stageId: 8, progress: 100, title: { en: 'Reionization Complete',  ko: '재이온화 완료' },          message: { en: 'The universe has entered a long era of stars and galaxies.', ko: '우주는 별과 은하의 긴 시대로 접어들었습니다.' } },

  // Stage 9 — Galaxy Formation
  { stageId: 9, progress: 0,   title: { en: 'Galaxies Begin',         ko: '은하의 시작' },            message: { en: 'Stars, gas, and dark matter gather into the first galactic systems.', ko: '별, 기체, 암흑물질이 모여 최초의 은하계를 이룹니다.' } },
  { stageId: 9, progress: 10,  title: { en: 'Proto-Galaxies',         ko: '원시 은하' },              message: { en: 'Small stellar groups merge into larger structures.', ko: '작은 항성 집단이 더 큰 구조로 병합됩니다.' } },
  { stageId: 9, progress: 25,  title: { en: 'Galactic Cores',         ko: '은하 핵' },                message: { en: 'Dense centers form as matter falls inward.', ko: '물질이 안쪽으로 떨어지면서 밀집된 중심이 형성됩니다.' } },
  { stageId: 9, progress: 50,  title: { en: 'Arms and Halos',         ko: '나선팔과 헤일로' },        message: { en: 'Rotation and gravity sculpt disks, arms, and halos.', ko: '회전과 중력이 원반, 나선팔, 헤일로를 조각합니다.' } },
  { stageId: 9, progress: 75,  title: { en: 'Cosmic Cities',          ko: '우주 도시' },              message: { en: 'Galaxies become the major homes of stars, gas, and future planets.', ko: '은하가 별, 기체, 미래 행성의 주요 거처가 됩니다.' } },
  { stageId: 9, progress: 90,  title: { en: 'A Local Neighborhood',   ko: '지역 이웃' },              message: { en: 'One galaxy becomes the stage for a future solar system.', ko: '한 은하가 미래 태양계의 무대가 됩니다.' } },
  { stageId: 9, progress: 100, title: { en: 'A Star-Forming Region',  ko: '별 형성 영역' },           message: { en: 'Inside a galaxy, a cloud begins collapsing toward a new star.', ko: '은하 안에서 한 구름이 새 별을 향해 붕괴하기 시작합니다.' } },

  // Stage 10 — Solar System
  { stageId: 10, progress: 0,   title: { en: 'Solar System Formation', ko: '태양계 형성' },           message: { en: 'A quiet cloud inside the galaxy begins to collapse.', ko: '은하 안의 조용한 구름이 붕괴하기 시작합니다.' } },
  { stageId: 10, progress: 8,   title: { en: 'Proto-Sun',              ko: '원시 태양' },             message: { en: 'Gas falls inward and the young Sun begins to glow.', ko: '기체가 안쪽으로 떨어지며 어린 태양이 빛나기 시작합니다.' } },
  { stageId: 10, progress: 16,  title: { en: 'Accretion Disk',         ko: '응집 원반' },             message: { en: 'Dust and gas flatten into a rotating disk around the newborn Sun.', ko: '먼지와 기체가 갓 태어난 태양 주위에 회전하는 원반으로 평평해집니다.' } },
  { stageId: 10, progress: 24,  title: { en: 'Planetesimals',          ko: '미행성체' },              message: { en: 'Tiny grains collide, stick, and grow into the seeds of planets.', ko: '작은 알갱이들이 충돌하고 들러붙어 행성의 씨앗으로 자랍니다.' } },
  { stageId: 10, progress: 32,  title: { en: 'Mercury Forms',          ko: '수성 형성' },             message: { en: 'A small rocky world takes shape close to the Sun.', ko: '태양 가까이서 작은 암석 세계가 모습을 갖춥니다.' } },
  { stageId: 10, progress: 40,  title: { en: 'Venus Forms',            ko: '금성 형성' },             message: { en: "A dense inner planet gathers under the young Sun's heat.", ko: '어린 태양의 열기 아래 밀도 높은 안쪽 행성이 모입니다.' } },
  { stageId: 10, progress: 48,  title: { en: 'Proto-Earth',            ko: '원시 지구' },             message: { en: 'Earth begins as a molten rocky body, scarred by impacts.', ko: '지구가 충돌로 상처 입은 용융된 암석체로 시작합니다.' } },
  { stageId: 10, progress: 58,  title: { en: 'Mars Forms',             ko: '화성 형성' },             message: { en: "A smaller red world stabilizes beyond Earth's orbit.", ko: '더 작은 붉은 세계가 지구 궤도 너머에서 안정됩니다.' } },
  { stageId: 10, progress: 66,  title: { en: 'Jupiter Forms',          ko: '목성 형성' },             message: { en: 'The largest planet gathers gas and reshapes the young system.', ko: '가장 큰 행성이 기체를 모아 어린 태양계를 재편합니다.' } },
  { stageId: 10, progress: 74,  title: { en: 'Saturn Forms',           ko: '토성 형성' },             message: { en: 'A second gas giant appears, wrapped in a growing ring system.', ko: '두 번째 가스 거인이 자라나는 고리계에 둘러싸여 나타납니다.' } },
  { stageId: 10, progress: 80,  title: { en: 'Uranus Forms',           ko: '천왕성 형성' },           message: { en: 'An icy giant settles into the outer system.', ko: '얼음 거인이 외곽 태양계에 자리잡습니다.' } },
  { stageId: 10, progress: 86,  title: { en: 'Neptune Forms',          ko: '해왕성 형성' },           message: { en: 'A distant blue world takes its place far from the Sun.', ko: '먼 푸른 세계가 태양에서 멀리 자리잡습니다.' } },
  { stageId: 10, progress: 91,  title: { en: 'Outer Debris',           ko: '외곽 잔해' },             message: { en: 'Icy fragments and distant small worlds mark the edge of the system.', ko: '얼음 파편과 먼 작은 세계들이 태양계의 가장자리를 이룹니다.' } },
  { stageId: 10, progress: 95,  title: { en: 'Orbits Stabilize',       ko: '궤도 안정화' },           message: { en: 'The young planets settle into long, repeating paths.', ko: '어린 행성들이 길고 반복되는 경로로 정착합니다.' } },
  { stageId: 10, progress: 100, title: { en: 'A Solar System',         ko: '하나의 태양계' },         message: { en: 'The stage is set for one small world to change.', ko: '하나의 작은 세계가 변할 무대가 마련됩니다.' } },

  // Stage 11 — Life on Earth
  { stageId: 11, progress: 0,   title: { en: 'Molten Earth',           ko: '용융 지구' },             message: { en: 'Earth begins as a violent world of rock, impact, and lava.', ko: '지구가 바위, 충돌, 용암의 폭력적인 세계로 시작합니다.' } },
  { stageId: 11, progress: 10,  title: { en: 'Steam World',            ko: '증기 세계' },             message: { en: 'Heat, vapor, and early atmosphere wrap the young planet.', ko: '열기, 수증기, 초기 대기가 어린 행성을 감쌉니다.' } },
  { stageId: 11, progress: 20,  title: { en: 'First Oceans',           ko: '최초의 바다' },           message: { en: 'As the surface cools, water begins collecting into oceans.', ko: '표면이 식으면서 물이 모여 바다가 됩니다.' } },
  { stageId: 11, progress: 32,  title: { en: 'Continents Rise',        ko: '대륙의 융기' },           message: { en: "Land breaks through the oceans and reshapes the planet's face.", ko: '땅이 바다를 뚫고 솟아 행성의 얼굴을 재편합니다.' } },
  { stageId: 11, progress: 45,  title: { en: 'Life Spreads',           ko: '생명의 확산' },           message: { en: 'Green begins to spread across the land and seas.', ko: '초록이 땅과 바다로 퍼지기 시작합니다.' } },
  { stageId: 11, progress: 58,  title: { en: 'A Living Planet',        ko: '살아있는 행성' },         message: { en: 'Clouds, oceans, land, and life create a changing blue world.', ko: '구름, 바다, 땅, 생명이 변화하는 푸른 세계를 만듭니다.' } },
  { stageId: 11, progress: 72,  title: { en: 'Civilization',           ko: '문명' },                  message: { en: 'Tiny lights appear on the night side of Earth.', ko: '지구의 밤면에 작은 불빛들이 나타납니다.' } },
  { stageId: 11, progress: 82,  title: { en: 'Space Age',              ko: '우주 시대' },             message: { en: 'Earth reaches beyond its atmosphere with satellites and stations.', ko: '지구가 위성과 우주정거장으로 대기 너머로 손을 뻗습니다.' } },
  { stageId: 11, progress: 90,  title: { en: 'Orbital Industry',       ko: '궤도 산업' },             message: { en: 'Structures grow around the planet, collecting energy and extending civilization.', ko: '구조물들이 행성 주위에 자라나 에너지를 모으고 문명을 확장합니다.' } },
  { stageId: 11, progress: 97,  title: { en: 'Peak Earth',             ko: '지구 절정' },             message: { en: 'A bright world turns below a web of machines, lights, and clouds.', ko: '기계, 빛, 구름의 거미줄 아래 밝은 세계가 돌아갑니다.' } },
  { stageId: 11, progress: 100, title: { en: 'A Brief Golden Age',     ko: '짧은 황금기' },           message: { en: 'For a moment, the universe learns to look back at itself.', ko: '잠시 동안, 우주는 자신을 되돌아보는 법을 배웁니다.' } },

  // Stage 12 — Death of Star
  { stageId: 12, progress: 0,   title: { en: 'The Sun Ages',           ko: '태양의 노화' },           message: { en: 'The mature solar system enters the final life of its star.', ko: '성숙한 태양계가 별의 마지막 삶에 접어듭니다.' } },
  { stageId: 12, progress: 10,  title: { en: 'Solar Brightening',      ko: '태양 밝아짐' },           message: { en: 'The Sun grows hotter and brighter, stressing the inner worlds.', ko: '태양이 더 뜨겁고 밝아져 안쪽 세계들을 압박합니다.' } },
  { stageId: 12, progress: 20,  title: { en: 'Red Giant Begins',       ko: '적색거성 시작' },         message: { en: 'The Sun swells outward as its outer layers expand.', ko: '태양이 외층 팽창과 함께 바깥쪽으로 부풀어 오릅니다.' } },
  { stageId: 12, progress: 32,  title: { en: 'Mercury Lost',           ko: '수성 소실' },             message: { en: 'The innermost planet disappears into the expanding Sun.', ko: '가장 안쪽 행성이 팽창하는 태양 속으로 사라집니다.' } },
  { stageId: 12, progress: 40,  title: { en: 'Venus Lost',             ko: '금성 소실' },             message: { en: 'Venus is swallowed by the growing red giant.', ko: '금성이 자라나는 적색거성에 삼켜집니다.' } },
  { stageId: 12, progress: 48,  title: { en: 'Earth Burns',            ko: '지구의 불타는 운명' },    message: { en: "Earth's oceans boil away and the night lights go dark.", ko: '지구의 바다가 끓어 사라지고 밤의 불빛이 꺼집니다.' } },
  { stageId: 12, progress: 56,  title: { en: 'Earth Lost',             ko: '지구 소실' },             message: { en: 'The world that carried life is consumed by its star.', ko: '생명을 품었던 세계가 자신의 별에 의해 소멸합니다.' } },
  { stageId: 12, progress: 66,  title: { en: 'Mars Scorched',          ko: '화성 그을림' },           message: { en: 'The inner system collapses into heat and debris.', ko: '안쪽 태양계가 열기와 잔해로 무너집니다.' } },
  { stageId: 12, progress: 74,  title: { en: 'Outer Worlds Stripped',  ko: '외곽 세계 박탈' },        message: { en: "The giant planets are battered by the dying Sun's expansion.", ko: '거대 행성들이 죽어가는 태양의 팽창에 시달립니다.' } },
  { stageId: 12, progress: 82,  title: { en: 'Megastructures Fail',    ko: '거대구조 붕괴' },         message: { en: 'The machines around the solar system break apart in the red light.', ko: '태양계 주위의 기계들이 붉은 빛 속에서 부서집니다.' } },
  { stageId: 12, progress: 90,  title: { en: 'Envelope Ejection',      ko: '외피 방출' },             message: { en: 'The Sun sheds its outer layers into a glowing nebula.', ko: '태양이 외층을 빛나는 성운으로 흩뿌립니다.' } },
  { stageId: 12, progress: 96,  title: { en: 'White Dwarf',            ko: '백색왜성' },              message: { en: 'A small hot remnant remains where the Sun once ruled.', ko: '한때 태양이 지배했던 곳에 작은 뜨거운 잔해가 남습니다.' } },
  { stageId: 12, progress: 100, title: { en: 'After the Sun',          ko: '태양 이후' },             message: { en: 'The solar system is gone, leaving only a fading stellar ember.', ko: '태양계는 사라지고, 사그라드는 항성 잉걸만 남습니다.' } },

  // Stage 13 — Stelliferous End
  { stageId: 13, progress: 0,   title: { en: 'The Long Stellar Era',   ko: '긴 항성 시대' },          message: { en: 'For ages, stars continue to burn across the universe.', ko: '오랜 세월 동안 별들이 우주에서 계속 타오릅니다.' } },
  { stageId: 13, progress: 10,  title: { en: 'Star Formation Slows',   ko: '별 형성 둔화' },          message: { en: 'Gas becomes harder to gather into new stars.', ko: '기체를 새로운 별로 모으기가 어려워집니다.' } },
  { stageId: 13, progress: 25,  title: { en: 'Bright Stars Fade First',ko: '밝은 별이 먼저 사라짐' }, message: { en: 'The largest and bluest stars vanish from the sky.', ko: '가장 크고 푸른 별들이 하늘에서 사라집니다.' } },
  { stageId: 13, progress: 50,  title: { en: 'Old Stars Remain',       ko: '늙은 별만 남음' },        message: { en: 'Small, dim stars become the last steady lights of the universe.', ko: '작고 희미한 별들이 우주의 마지막 한결같은 빛이 됩니다.' } },
  { stageId: 13, progress: 75,  title: { en: 'The Last Red Dwarfs',    ko: '마지막 적색왜성' },       message: { en: 'The smallest stars burn slowly, then finally exhaust their fuel.', ko: '가장 작은 별들이 천천히 타다가 마침내 연료를 소진합니다.' } },
  { stageId: 13, progress: 90,  title: { en: 'No New Dawn',            ko: '새 새벽은 없다' },        message: { en: 'The universe no longer has enough fuel to keep making stars.', ko: '우주는 더 이상 별을 만들 만큼의 연료가 없습니다.' } },
  { stageId: 13, progress: 100, title: { en: 'Starlight Ends',         ko: '별빛의 종말' },           message: { en: 'The age of shining stars gives way to the age of remnants.', ko: '빛나는 별의 시대가 잔해의 시대에 자리를 내줍니다.' } },

  // Stage 14 — Degenerate Era
  { stageId: 14, progress: 0,   title: { en: 'Degenerate Era',         ko: '축퇴 시대' },             message: { en: 'The stars are gone. Their remnants drift through a colder universe.', ko: '별들은 사라졌습니다. 그 잔해는 더 차가운 우주를 떠돕니다.' } },
  { stageId: 14, progress: 10,  title: { en: 'White Dwarfs Cool',      ko: '백색왜성 냉각' },         message: { en: 'Once-bright stellar cores slowly fade toward darkness.', ko: '한때 밝았던 항성 중심부가 천천히 어둠으로 사그라듭니다.' } },
  { stageId: 14, progress: 25,  title: { en: 'Dead Systems Drift',     ko: '죽은 시스템 표류' },      message: { en: 'Frozen worlds and stellar remnants wander through empty space.', ko: '얼어붙은 세계와 항성 잔해가 빈 공간을 떠돕니다.' } },
  { stageId: 14, progress: 50,  title: { en: 'Galaxies Loosen',        ko: '은하의 와해' },           message: { en: 'Without new stars, old structures slowly scatter and thin out.', ko: '새 별 없이 옛 구조들이 천천히 흩어지고 옅어집니다.' } },
  { stageId: 14, progress: 65,  title: { en: 'Matter Decays',          ko: '물질 붕괴' },             message: { en: 'Across unimaginable time, ordinary structures lose their meaning.', ko: '상상할 수 없는 시간에 걸쳐, 평범한 구조들이 의미를 잃습니다.' } },
  { stageId: 14, progress: 75,  title: { en: 'Black Dwarfs',           ko: '흑색왜성' },              message: { en: 'Former white dwarfs become cold, dark relics.', ko: '한때의 백색왜성이 차갑고 어두운 유물이 됩니다.' } },
  { stageId: 14, progress: 90,  title: { en: 'Black Holes Remain',     ko: '블랙홀만 남음' },         message: { en: 'The most persistent objects are now the black holes.', ko: '이제 가장 끈질긴 천체는 블랙홀입니다.' } },
  { stageId: 14, progress: 100, title: { en: 'Only the Deepest Wells', ko: '가장 깊은 우물만' },      message: { en: "Gravity's darkest survivors inherit the universe.", ko: '중력의 가장 어두운 생존자들이 우주를 물려받습니다.' } },

  // Stage 15 — Black Hole Era
  { stageId: 15, progress: 0,   title: { en: 'Black Hole Era',         ko: '블랙홀 시대' },           message: { en: 'Almost everything that once shone has vanished or fallen into darkness.', ko: '한때 빛났던 거의 모든 것이 사라지거나 어둠 속으로 떨어졌습니다.' } },
  { stageId: 15, progress: 10,  title: { en: 'Dark Survivors',         ko: '어둠의 생존자' },         message: { en: 'Black holes remain as the last massive landmarks.', ko: '블랙홀이 마지막 거대한 이정표로 남습니다.' } },
  { stageId: 15, progress: 25,  title: { en: 'Slow Spirals',           ko: '느린 나선' },             message: { en: 'Some black holes drift together over impossible timescales.', ko: '일부 블랙홀이 불가능할 정도로 긴 시간에 걸쳐 서로에게 다가갑니다.' } },
  { stageId: 15, progress: 40,  title: { en: 'Merger',                 ko: '병합' },                  message: { en: 'Two black holes become one, sending ripples through spacetime.', ko: '두 블랙홀이 하나가 되며 시공간에 잔물결을 보냅니다.' } },
  { stageId: 15, progress: 58,  title: { en: 'Fewer, Larger',          ko: '더 적고 더 큰' },         message: { en: 'The number of black holes falls while their average mass grows.', ko: '블랙홀의 수는 줄지만 평균 질량은 커집니다.' } },
  { stageId: 15, progress: 75,  title: { en: 'Lonely Horizons',        ko: '외로운 지평선' },         message: { en: 'Only isolated giants remain in the dark.', ko: '어둠 속에 고립된 거인들만이 남습니다.' } },
  { stageId: 15, progress: 88,  title: { en: 'Hawking Radiation',      ko: '호킹 복사' },             message: { en: 'Even black holes are not perfectly eternal.', ko: '블랙홀조차 완벽히 영원하지 않습니다.' } },
  { stageId: 15, progress: 96,  title: { en: 'Final Evaporation',      ko: '마지막 증발' },           message: { en: 'The last dark horizons begin to shrink into faint radiation.', ko: '마지막 어두운 지평선이 희미한 복사로 줄어들기 시작합니다.' } },
  { stageId: 15, progress: 100, title: { en: 'Black Holes End',        ko: '블랙홀의 종말' },         message: { en: 'The deepest objects in the universe finally disappear.', ko: '우주에서 가장 깊은 천체들이 마침내 사라집니다.' } },

  // Stage 16 — The End
  { stageId: 16, progress: 0,   title: { en: 'The Dark Era',           ko: '어둠의 시대' },           message: { en: 'The last black hole prepares to vanish.', ko: '마지막 블랙홀이 사라질 준비를 합니다.' } },
  { stageId: 16, progress: 10,  title: { en: 'Final Flash',            ko: '마지막 섬광' },           message: { en: 'A final burst of radiation fades into empty space.', ko: '마지막 복사 폭발이 텅 빈 공간으로 사그라집니다.' } },
  { stageId: 16, progress: 25,  title: { en: 'No Bound Structures',    ko: '결합된 구조 없음' },      message: { en: 'No stars, no planets, no galaxies remain.', ko: '별도, 행성도, 은하도 남지 않습니다.' } },
  { stageId: 16, progress: 40,  title: { en: 'Rare Particles',         ko: '희박한 입자' },           message: { en: 'Only sparse particles and faint radiation drift through the dark.', ko: '듬성한 입자와 희미한 복사만이 어둠을 떠돕니다.' } },
  { stageId: 16, progress: 60,  title: { en: 'Distances Lose Meaning', ko: '거리의 의미 상실' },      message: { en: 'Everything is too far apart to gather again.', ko: '모든 것이 너무 멀어져 다시 모일 수 없습니다.' } },
  { stageId: 16, progress: 75,  title: { en: 'Memory Echo',            ko: '기억의 메아리' },         message: { en: 'For an instant, the shapes of galaxies and worlds seem to return.', ko: '잠시, 은하와 세계의 형상들이 돌아오는 듯합니다.' } },
  { stageId: 16, progress: 88,  title: { en: 'Almost Nothing',         ko: '거의 무(無)' },           message: { en: 'The universe is cold, dilute, and nearly silent.', ko: '우주는 차갑고, 희박하며, 거의 침묵합니다.' } },
  { stageId: 16, progress: 100, title: { en: 'The End',                ko: '마지막' },                message: { en: 'The universe does not end with fire, but with distance, silence, and forgetting.', ko: '우주는 불꽃이 아니라, 거리와 침묵과 망각으로 끝납니다.' } },
];

export function getLogsForStage(stageId: number): StageLog[] {
  return STAGE_LOGS.filter((l) => l.stageId === stageId);
}
