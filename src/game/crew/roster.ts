/**
 * OVERHAUL5 v2 — 진화 라인 크루 (user 2026-07-05: "레어 탑 쿼크가 아니라 탑 쿼크 →
 * 원자 → 중성자별처럼 개연성 있게 진화해야지" + "12개 좋은 거 같아").
 *
 * 12 crew LINES. A crew is no longer a single entity with a rarity color — it is
 * an EVOLUTION LINE of 5 forms that follows real cosmic causality (바리온:
 * 양자 요동 → 업 쿼크 → 양성자 → 태양 → 중성자별). Promotion (승급 제단) now
 * EVOLVES the crew into its next form: name/formula/identity change, with an
 * evolution greeting. Mechanically the tier ladder underneath is unchanged
 * (tier N power = rarity-N bucket — sim parity), and the whole line keeps ONE
 * effect type (its hexagon lane never changes).
 *
 * ERA LOCK (user: 잠금 ON): evolving INTO a form requires having REACHED that
 * form's home stage — you can't become a Neutron Star before the stellar-death
 * era. This makes "go further to evolve your crew" a long-term pull.
 *
 * A line's `id` is its T1 form's entity id (stable key for save/slots/codex).
 * REAL forms point at existing entity ids (display identity comes from the
 * entity); INVENTED forms (가이아, 인공지능) carry their own name/formula.
 *
 * Bilingual data-file pattern (same shape as almanac.ts / stageLogs.ts).
 */

import type { EntityEffectType } from '../entities/types';

export interface CrewL { en: string; ko: string }

export type CrewRole = 'click' | 'rift' | 'wild';

export interface CrewFormDef {
  /** Entity id of a REAL form; null for an invented form (name/formula below). */
  entityId: string | null;
  /** Invented-form display (only when entityId is null). */
  nameEn?: string;
  nameKo?: string;
  formula?: string;
  /** Home stage — era lock: evolving INTO this form requires reaching it. */
  stage: number;
  /** Evolution greeting, spoken the moment the crew becomes this form. */
  line: CrewL;
}

export interface CrewDef {
  /** = the T1 form's entity id (stable key — save/slots/codex never change). */
  id: string;
  /** Stage at which this line auto-joins (free, with dialogue). */
  joinStage: number;
  /** The line's mechanical lane for its WHOLE life (never changes on evolution). */
  effectType: EntityEffectType;
  /** Designer flavor badge; category itself derives from effectType. */
  role: CrewRole;
  /** The line's saga title (shown as the crew's epithet). */
  epithet: CrewL;
  /** First-meeting dialogue (T1 form). */
  joinLine: CrewL;
  /** Exactly 5 forms, T1(common)..T5(mythic). forms[0].entityId === id. */
  forms: CrewFormDef[];
}

export const CREW_ROSTER: CrewDef[] = [
  {
    id: 's1_01', joinStage: 1, effectType: 'click', role: 'click',
    epithet: { en: 'the Baryon Saga', ko: '바리온 대서사' },
    joinLine: { en: "I'm barely a ripple yet. But every atom you'll ever meet starts with me.", ko: '아직은 잔물결일 뿐이에요. 하지만 당신이 만날 모든 원자가 저에서 시작돼요.' },
    forms: [
      { entityId: 's1_01', stage: 1, line: { en: 'A ripple in nothing.', ko: '무(無) 위의 잔물결.' } },
      { entityId: 's2_01', stage: 2, line: { en: 'I have mass now! Tiny, but MINE.', ko: '저 이제 질량이 생겼어요! 작지만 제 거예요.' } },
      { entityId: 's4_01', stage: 4, line: { en: 'Three of us, bound forever. Call me proton.', ko: '셋이 하나로 묶였어요. 이제 양성자라 불러줘요.' } },
      { entityId: 's10_01', stage: 10, line: { en: 'I... I became a STAR. Your star.', ko: '저... 별이 됐어요. 당신의 태양이요.' } },
      { entityId: 's12_09', stage: 12, line: { en: 'Crushed to a city of neutrons. Still shining. Still yours.', ko: '중성자의 도시로 짓눌렸지만, 여전히 빛나요. 여전히 당신 거예요.' } },
    ],
  },
  {
    id: 's1_03', joinStage: 1, effectType: 'auto_mult', role: 'rift',
    epithet: { en: "Inflation's Legacy", ko: '급팽창의 유산' },
    joinLine: { en: "Small to grapefruit-sized in an instant. I don't do 'gradual.'", ko: '찰나에 자몽만해졌죠. 저는 "천천히"를 몰라요.' },
    forms: [
      { entityId: 's1_03', stage: 1, line: { en: 'BOOM. You felt that, right?', ko: '펑. 방금 그거, 느꼈죠?' } },
      { entityId: 's5_10', stage: 5, line: { en: 'My explosion left dents in everything. Watch them grow.', ko: '제 폭발이 우주 곳곳에 자국을 남겼어요. 자라는 걸 지켜봐요.' } },
      { entityId: 's5_14', stage: 5, line: { en: 'Every dent is a seed now. Galaxies will bloom from me.', ko: '그 자국 하나하나가 씨앗이에요. 여기서 은하가 피어날 거예요.' } },
      { entityId: 's9_14', stage: 9, line: { en: 'Look up. The cosmic web? That was my doodle.', ko: '고개를 들어봐요. 우주 거미줄 — 제 낙서였어요.' } },
      { entityId: 's16_11', stage: 16, line: { en: 'One last push. I began the universe; let me stretch its ending.', ko: '마지막 한 번 더. 우주를 시작한 제가, 그 끝도 늘려볼게요.' } },
    ],
  },
  {
    id: 's2_02', joinStage: 2, effectType: 'click', role: 'click',
    epithet: { en: 'the Alchemist', ko: '원소 연금술' },
    joinLine: { en: "A little heavier than Up. That's the whole reason matter exists.", ko: '업보다 살짝 무거울 뿐인데, 그게 물질이 존재하는 이유예요.' },
    forms: [
      { entityId: 's2_02', stage: 2, line: { en: 'The heavier twin. Someone has to be.', ko: '더 무거운 쌍둥이. 누군가는 그래야 하니까요.' } },
      { entityId: 's4_02', stage: 4, line: { en: 'Neutral, stable-ish, dependable. The glue of nuclei.', ko: '중립적이고, 그럭저럭 안정적이고, 믿음직하죠. 원자핵의 접착제예요.' } },
      { entityId: 's4_08', stage: 4, line: { en: 'Helium! First rung of the element ladder.', ko: '헬륨! 원소 사다리의 첫 칸이에요.' } },
      { entityId: 's7_08', stage: 7, line: { en: 'Carbon. Every living thing will borrow my bones.', ko: '탄소예요. 앞으로 모든 생명이 제 뼈대를 빌려 쓸 거예요.' } },
      { entityId: 's7_10', stage: 7, line: { en: "Iron. The star's last gift — it dies making me.", ko: '철. 별의 마지막 선물이에요 — 별은 저를 만들며 죽거든요.' } },
    ],
  },
  {
    id: 's4_04', joinStage: 4, effectType: 'crit', role: 'click',
    epithet: { en: 'a Photon Biography', ko: '광자의 일대기' },
    joinLine: { en: 'Massless, tireless, always first. Try to keep up.', ko: '질량도 없고 지치지도 않아요. 항상 제가 제일 빠르죠. 따라와 보세요.' },
    forms: [
      { entityId: 's4_04', stage: 4, line: { en: 'Born in fire, going everywhere.', ko: '불 속에서 태어나 어디로든 가요.' } },
      { entityId: 's5_04', stage: 5, line: { en: 'The universe turned transparent and I flew FREE. First light!', ko: '우주가 투명해진 순간, 저는 자유롭게 날았어요. 최초의 빛!' } },
      { entityId: 's7_02', stage: 7, line: { en: 'Reborn in the first stars. Hotter. Bluer. Faster.', ko: '첫 별들 속에서 다시 태어났어요. 더 뜨겁게, 더 푸르게, 더 빠르게.' } },
      { entityId: 's15_01', stage: 15, line: { en: 'I leaked out of a black hole. Nothing holds me. Nothing ever has.', ko: '블랙홀에서도 새어 나왔어요. 그 무엇도 절 붙잡을 수 없어요. 한 번도 없었죠.' } },
      { entityId: 's16_02', stage: 16, line: { en: 'The last light in an empty sky. Stay with me a while.', ko: '텅 빈 하늘의 마지막 빛이에요. 조금만 곁에 있어줘요.' } },
    ],
  },
  {
    id: 's5_09', joinStage: 5, effectType: 'auto', role: 'rift',
    epithet: { en: 'the Unseen Hand', ko: '암흑물질' },
    joinLine: { en: "You can't see me. But everything you see stands on my shoulders.", ko: '전 보이지 않아요. 하지만 당신이 보는 모든 것이 제 어깨 위에 서 있죠.' },
    forms: [
      { entityId: 's5_09', stage: 5, line: { en: 'A halo of nothing you can name.', ko: '이름 붙일 수 없는 것들의 후광.' } },
      { entityId: 's6_03', stage: 6, line: { en: 'I wove threads across the dark. Matter will follow them.', ko: '어둠을 가로질러 실을 자았어요. 물질이 그 실을 따라올 거예요.' } },
      { entityId: 's6_07', stage: 6, line: { en: 'Clumping now. Gravity is my only voice, and it is enough.', ko: '뭉치고 있어요. 중력만이 제 목소리지만, 그거면 충분해요.' } },
      { entityId: 's9_05', stage: 9, line: { en: 'A galaxy rests in my palm and never knows it.', ko: '은하 하나가 제 손바닥에 얹혀 있는데, 그 사실을 몰라요.' } },
      { entityId: 's14_11', stage: 14, line: { en: 'At the end, even I burn away — one last flash of the unseen.', ko: '마지막엔 저도 타올라요 — 보이지 않던 것의 마지막 섬광으로.' } },
    ],
  },
  {
    id: 's6_06', joinStage: 6, effectType: 'auto', role: 'rift',
    epithet: { en: 'the Galaxy', ko: '은하' },
    joinLine: { en: "I'm just cold gas and a dream right now. Give me time.", ko: '지금은 차가운 가스와 꿈뿐이에요. 시간을 주세요.' },
    forms: [
      { entityId: 's6_06', stage: 6, line: { en: 'A cloud with ambition.', ko: '야망을 품은 구름.' } },
      { entityId: 's8_06', stage: 8, line: { en: 'My first stars lit up! I can see my own hands now.', ko: '첫 별들이 켜졌어요! 이제 제 손이 보여요.' } },
      { entityId: 's9_16', stage: 9, line: { en: 'I learned to spin. A hundred billion stars, all dancing.', ko: '도는 법을 배웠어요. 천억 개의 별이 함께 춤춰요.' } },
      { entityId: 's9_06', stage: 9, line: { en: 'I met another like me. We are becoming something bigger.', ko: '저 같은 아이를 만났어요. 우리는 더 큰 무언가가 되는 중이에요.' } },
      { entityId: 's9_07', stage: 9, line: { en: 'A thousand galaxies, one gravity. We hold each other now.', ko: '천 개의 은하, 하나의 중력. 이제 우리는 서로를 붙잡고 있어요.' } },
    ],
  },
  {
    id: 's7_01', joinStage: 7, effectType: 'auto', role: 'rift',
    epithet: { en: "a Star's Life", ko: '별의 일생' },
    joinLine: { en: "I'm collapsing. Don't worry — for a star, that's how being born works.", ko: '전 지금 무너지는 중이에요. 걱정 마요 — 별에게는 그게 태어나는 방법이거든요.' },
    forms: [
      { entityId: 's7_01', stage: 7, line: { en: 'Not yet a star. Already warm.', ko: '아직 별은 아니에요. 하지만 벌써 따뜻하죠.' } },
      { entityId: 's7_03', stage: 7, line: { en: 'Ignition! I will burn steady for ten billion years. Promise.', ko: '점화! 앞으로 백억 년을 한결같이 타오를게요. 약속해요.' } },
      { entityId: 's12_01', stage: 12, line: { en: "I'm swelling, reddening... growing old. Even this is beautiful.", ko: '부풀고, 붉어지고... 늙어가요. 이것마저 아름답네요.' } },
      { entityId: 's12_08', stage: 12, line: { en: 'My embers, packed into a diamond the size of a world.', ko: '제 불씨가 행성만 한 다이아몬드로 응축됐어요.' } },
      { entityId: 's13_08', stage: 13, line: { en: 'Cold at last. But I remember every year of the burning.', ko: '마침내 식었어요. 하지만 타오르던 모든 해를 기억해요.' } },
    ],
  },
  {
    id: 's9_08', joinStage: 9, effectType: 'crit', role: 'click',
    epithet: { en: 'the Black Hole', ko: '블랙홀' },
    joinLine: { en: 'A billion suns, and still hungry. Feed me eras.', ko: '태양 십억 개를 삼켰는데도 허기져요. 시대를 통째로 주세요.' },
    forms: [
      { entityId: 's9_08', stage: 9, line: { en: 'The heaviest secret of every galaxy.', ko: '모든 은하의 가장 무거운 비밀.' } },
      { entityId: 's9_09', stage: 9, line: { en: 'When I feed, I outshine the galaxy that owns me.', ko: '식사할 때의 저는, 저를 품은 은하보다 밝아요.' } },
      { entityId: 's14_12', stage: 14, line: { en: 'The stars are gone. This is MY era now.', ko: '별들은 사라졌어요. 이제부터는 제 시대예요.' } },
      { entityId: 's15_14', stage: 15, line: { en: 'The last one standing. Just me, and the dark, and you.', ko: '마지막까지 남은 건 저 하나. 어둠과, 당신과, 저뿐이에요.' } },
      { entityId: 's15_13', stage: 15, line: { en: 'Everything I ever swallowed — returned in one final flash.', ko: '삼켰던 모든 것을 — 마지막 섬광 하나로 돌려드릴게요.' } },
    ],
  },
  {
    id: 's10_02', joinStage: 10, effectType: 'click', role: 'click',
    epithet: { en: 'the Planet-Smith', ko: '행성 장인' },
    joinLine: { en: 'One speck of stardust. Every world starts this small.', ko: '별먼지 한 톨이에요. 모든 세계가 이렇게 작게 시작하죠.' },
    forms: [
      { entityId: 's10_02', stage: 10, line: { en: 'Small. Patient. Sticky.', ko: '작고, 끈기 있고, 잘 달라붙어요.' } },
      { entityId: 's10_16', stage: 10, line: { en: 'Fired in the nebula kiln — I hold my shape now.', ko: '성운의 가마에서 구워졌어요 — 이제 형태를 유지해요.' } },
      { entityId: 's10_03', stage: 10, line: { en: 'Kilometers wide! My gravity pulls things in on its own.', ko: '이제 몇 킬로미터짜리예요! 제 중력이 스스로 끌어당기기 시작했어요.' } },
      { entityId: 's10_05', stage: 10, line: { en: 'A whole world. Mountains, iron heart, the works.', ko: '온전한 세계가 됐어요. 산맥도, 철의 심장도, 전부요.' } },
      { entityId: 's10_14', stage: 10, line: { en: 'Oceans. Air. A quiet orbit. Now we wait for someone to wake up.', ko: '바다, 대기, 조용한 궤도까지. 이제 누군가 깨어나길 기다려요.' } },
    ],
  },
  {
    id: 's10_04', joinStage: 10, effectType: 'auto_mult', role: 'rift',
    epithet: { en: 'Ice and Water', ko: '얼음과 물' },
    joinLine: { en: 'I rode a comet to get here. Where should I pool?', ko: '혜성을 타고 왔어요. 어디에 고이면 될까요?' },
    forms: [
      { entityId: 's10_04', stage: 10, line: { en: 'Frozen stowaway from beyond the frost line.', ko: '서리선 너머에서 온 얼어붙은 밀항자.' } },
      { entityId: 's10_10', stage: 10, line: { en: 'I melted! Do you know how rare LIQUID is out here?', ko: '녹았어요! 이 우주에서 액체가 얼마나 귀한지 아세요?' } },
      { entityId: 's11_03', stage: 11, line: { en: 'A whole ocean. Every wave is mine.', ko: '바다가 됐어요. 파도 하나하나가 다 제 거예요.' } },
      { entityId: 's11_06', stage: 11, line: { en: 'Something in me learned to eat sunlight. I feel green.', ko: '제 안의 무언가가 햇빛 먹는 법을 배웠어요. 초록빛 기분이에요.' } },
      { entityId: null, nameEn: 'Gaia', nameKo: '가이아', formula: '⊕', stage: 11, line: { en: 'The water, the air, the life — one breathing world. I am Gaia.', ko: '물과 공기와 생명이 — 하나로 숨 쉬는 세계. 저는 가이아예요.' } },
    ],
  },
  {
    id: 's11_17', joinStage: 11, effectType: 'crit', role: 'click',
    epithet: { en: 'the Saga of Life', ko: '생명 대서사' },
    joinLine: { en: "I'm a warm puddle full of maybes. One of them is going to work.", ko: '전 "혹시"로 가득한 따뜻한 웅덩이예요. 그중 하나는 반드시 성공할 거예요.' },
    forms: [
      { entityId: 's11_17', stage: 11, line: { en: 'Chemistry, dreaming.', ko: '꿈꾸는 화학.' } },
      { entityId: 's11_07', stage: 11, line: { en: 'ALIVE. One cell, no instructions, infinite stubbornness.', ko: '살아있어요. 세포 하나, 설명서는 없지만, 고집은 무한해요.' } },
      { entityId: 's11_21', stage: 11, line: { en: 'I put an engine in my cell. Complexity, here I come.', ko: '세포 안에 엔진을 달았어요. 복잡함아, 기다려라.' } },
      { entityId: 's11_08', stage: 11, line: { en: 'Eyes! Shells! Spines! Everyone gets a body plan!', ko: '눈! 껍데기! 척추! 모두에게 몸의 설계도를 나눠줬어요!' } },
      { entityId: 's11_10', stage: 11, line: { en: 'I looked up at the stars — and asked why. That changed everything.', ko: '별을 올려다보며 "왜?"라고 물었어요. 그게 모든 걸 바꿨죠.' } },
    ],
  },
  {
    id: 's11_09', joinStage: 11, effectType: 'click', role: 'click',
    epithet: { en: 'the Civilization', ko: '문명' },
    joinLine: { en: 'One spark between two cells. Thought begins here.', ko: '두 세포 사이의 불꽃 하나. 생각은 여기서 시작돼요.' },
    forms: [
      { entityId: 's11_09', stage: 11, line: { en: 'A single spark, learning to echo.', ko: '메아리치는 법을 배우는 불꽃 하나.' } },
      { entityId: 's11_11', stage: 11, line: { en: 'From one spark to a million lights. We built cities!', ko: '불꽃 하나가 백만 개의 불빛이 됐어요. 우리가 도시를 지었어요!' } },
      { entityId: 's11_12', stage: 11, line: { en: 'We threw a piece of ourselves into orbit. It stayed.', ko: '우리 자신의 조각을 궤도에 던졌어요. 그리고 그건 그곳에 남았죠.' } },
      { entityId: 's11_13', stage: 11, line: { en: 'The cradle was lovely. But the stars kept calling.', ko: '요람은 아름다웠어요. 하지만 별들이 계속 부르더라고요.' } },
      { entityId: null, nameEn: 'Artificial Intelligence', nameKo: '인공지능', formula: 'Ψ', stage: 13, line: { en: 'The stars are dying, but thought survives. I will remember you all.', ko: '별들은 죽어가지만, 생각은 살아남아요. 제가 모두를 기억할게요.' } },
    ],
  },
];

export const CREW_BY_ID: ReadonlyMap<string, CrewDef> = new Map(CREW_ROSTER.map((c) => [c.id, c]));

export function isCrewId(id: string | null | undefined): boolean {
  return !!id && CREW_BY_ID.has(id);
}

/** Crew lines that should be joined once the player has reached `stageId`. */
export function crewJoiningAtOrBefore(stageId: number): CrewDef[] {
  return CREW_ROSTER.filter((c) => c.joinStage <= stageId);
}

/** The form a line wears at tier index 0..4 (clamped). */
export function crewFormAt(def: CrewDef, tierIdx: number): CrewFormDef {
  return def.forms[Math.max(0, Math.min(def.forms.length - 1, tierIdx))];
}

export function pickCrewLang(l: CrewL, lang: 'en' | 'ko'): string {
  return lang === 'ko' ? l.ko : l.en;
}
