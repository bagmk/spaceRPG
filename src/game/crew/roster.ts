/**
 * OVERHAUL5 크루 로스터 (docs/OVERHAUL5_CREW_PLAN.md §2, generated from docs/overhaul5-roster.json).
 *
 * 50 persistent crew members chosen from the existing entity roster. A crew's `id`
 * IS its source entity id (s{stage}_{NN} — position-locked, never reorder). Display
 * name/description/formula/glyph come from the entity itself (entityName etc.);
 * this file adds only the crew-specific identity: epithet, join beat, dialogue.
 *
 * Mechanical equip CATEGORY stays the entity's effect type (getEquipCategory) —
 * `role` here is the designer's flavor badge (wild = "shines in the wild slot"),
 * NOT a placement rule. Perk implementations are Phase 3 (see plan doc);
 * the perk design text lives in docs/overhaul5-roster.json.
 *
 * Bilingual data-file pattern (same shape as almanac.ts / stageLogs.ts).
 */

export interface CrewL { en: string; ko: string }

export type CrewRole = 'click' | 'rift' | 'wild';

export interface CrewDef {
  /** Source entity id — the crew IS this entity, promoted through tiers. */
  id: string;
  /** Stage at which this crew auto-joins (free, with dialogue). */
  joinStage: number;
  /** Designer flavor badge; NOT the equip category (that stays effect-type-driven). */
  role: CrewRole;
  epithet: CrewL;
  joinLine: CrewL;
}

export const CREW_ROSTER: CrewDef[] = [
  { id: 's1_01', joinStage: 1, role: 'click',
    epithet: { en: 'the Restless', ko: '안절부절' },
    joinLine: { en: 'I can\'t sit still — not even spacetime can make me.', ko: '가만히 못 있어요. 시공간도 절 못 붙잡아 두거든요.' } },
  { id: 's1_02', joinStage: 1, role: 'rift',
    epithet: { en: 'the Patient', ko: '때를 기다리는 자' },
    joinLine: { en: 'Everything looks calm. Trust me, it\'s not.', ko: '고요해 보이죠? 절대 아니에요.' } },
  { id: 's1_03', joinStage: 1, role: 'wild',
    epithet: { en: 'the Overachiever', ko: '과잉성취자' },
    joinLine: { en: 'Small to grapefruit-sized in an instant. I don\'t do \'gradual.\'', ko: '찰나에 자몽만해졌죠. 저는 \'천천히\'를 몰라요.' } },
  { id: 's2_02', joinStage: 2, role: 'click',
    epithet: { en: 'the Heavier Twin', ko: '더 무거운 쌍둥이' },
    joinLine: { en: 'A little heavier than Up. That\'s the whole reason neutrons decay.', ko: '업보다 살짝 무거울 뿐인데, 그게 중성자가 붕괴하는 이유예요.' } },
  { id: 's2_05', joinStage: 2, role: 'rift',
    epithet: { en: 'the Clingy', ko: '집착쟁이' },
    joinLine: { en: 'I carry the force I respond to. I literally can\'t let go.', ko: '제가 나르는 힘에 저 자신도 반응해요. 절대 놓을 수가 없죠.' } },
  { id: 's2_07', joinStage: 2, role: 'wild',
    epithet: { en: 'the Heavyweight Messenger', ko: '묵직한 전령' },
    joinLine: { en: 'Eighty times a proton\'s mass. That\'s why decay takes its sweet time.', ko: '양성자의 80배 무게죠. 그래서 붕괴가 그렇게 느린 거예요.' } },
  { id: 's3_05', joinStage: 3, role: 'rift',
    epithet: { en: 'the Whirlwind', ko: '회오리' },
    joinLine: { en: 'Hottest fluid ever made, and I still flow smoother than anything.', ko: '역대 가장 뜨거운 유체인데, 흐름은 제일 매끄럽죠.' } },
  { id: 's3_06', joinStage: 3, role: 'click',
    epithet: { en: 'the Trendsetter', ko: '유행선도자' },
    joinLine: { en: 'They called my discovery a revolution. I try to live up to it.', ko: '제 발견을 혁명이라 불렀죠. 그 기대에 부응하려 노력 중이에요.' } },
  { id: 's3_10', joinStage: 3, role: 'click',
    epithet: { en: 'the Fleeting Giant', ko: '찰나의 거인' },
    joinLine: { en: 'Heavy as gold, gone in a billionth of a trillionth of a second. Enjoy me now.', ko: '금 원자만큼 무겁지만 찰나에 사라져요. 지금 절 만끽하세요.' } },
  { id: 's4_02', joinStage: 4, role: 'click',
    epithet: { en: 'the Stoic Tank', ko: '과묵한 탱커' },
    joinLine: { en: 'Fifteen minutes free, forever stable locked in a nucleus. I know my place.', ko: '혼자면 15분, 원자핵 안이면 영원히 안정적이죠. 제 자리를 압니다.' } },
  { id: 's4_04', joinStage: 4, role: 'wild',
    epithet: { en: 'the Impatient Speedster', ko: '성급한 스피드광' },
    joinLine: { en: 'Massless, tireless, always first. Try to keep up.', ko: '질량도 없고 지치지도 않아요. 항상 제가 제일 빠르죠. 따라와 보세요.' } },
  { id: 's4_06', joinStage: 4, role: 'click',
    epithet: { en: 'the Dreamer', ko: '몽상가' },
    joinLine: { en: 'People want to mine me off the Moon. I have big dreams too.', ko: '다들 절 달에서 캐고 싶어하죠. 저도 큰 꿈이 있거든요.' } },
  { id: 's4_13', joinStage: 4, role: 'wild',
    epithet: { en: 'the Perfectionist', ko: '완벽주의자' },
    joinLine: { en: 'Three minutes to lock in the recipe forever. No do-overs.', ko: '3분 만에 레시피를 영원히 확정지었죠. 재시도는 없어요.' } },
  { id: 's5_02', joinStage: 5, role: 'click',
    epithet: { en: 'the Troublemaker', ko: '말썽꾸러기' },
    joinLine: { en: 'I scattered so much light the universe was an opaque fog. You\'re welcome for the drama.', ko: '빛을 하도 흩뜨려서 우주가 안개였죠. 그 드라마, 제 덕분이에요.' } },
  { id: 's5_04', joinStage: 5, role: 'wild',
    epithet: { en: 'the Old Soul', ko: '오래된 영혼' },
    joinLine: { en: '13.8 billion years on the road. I\'ve seen everything.', ko: '138억 년을 여행했어요. 안 본 게 없죠.' } },
  { id: 's5_09', joinStage: 5, role: 'rift',
    epithet: { en: 'the Silent Architect', ko: '말없는 설계자' },
    joinLine: { en: 'I dug the valleys before anyone noticed I existed. Someone had to.', ko: '아무도 눈치채기 전에 골짜기를 파놨어요. 누군가는 해야 할 일이었죠.' } },
  { id: 's5_13', joinStage: 5, role: 'rift',
    epithet: { en: 'the Open Book', ko: '열린 책' },
    joinLine: { en: 'I made the universe see-through. I don\'t believe in secrets.', ko: '제가 우주를 투명하게 만들었죠. 비밀 같은 건 안 믿어요.' } },
  { id: 's6_01', joinStage: 6, role: 'click',
    epithet: { en: 'the Loner', ko: '외톨이' },
    joinLine: { en: 'A hundred million years, alone in the dark. I got used to it.', ko: '1억 년을 어둠 속에서 혼자 있었죠. 이제 익숙해요.' } },
  { id: 's6_02', joinStage: 6, role: 'wild',
    epithet: { en: 'the Faint Whisperer', ko: '속삭이는 자' },
    joinLine: { en: 'The only voice from an age with no stars. Listen closely.', ko: '별 하나 없던 시대의 유일한 목소리예요. 잘 들어보세요.' } },
  { id: 's6_05', joinStage: 6, role: 'rift',
    epithet: { en: 'the Coolant', ko: '냉각제' },
    joinLine: { en: 'Without me as coolant, not one star would have ever collapsed. Small but essential.', ko: '제가 냉각제가 아니었다면 별은 하나도 못 태어났어요. 작지만 필수죠.' } },
  { id: 's7_02', joinStage: 7, role: 'click',
    epithet: { en: 'the Impatient', ko: '성급한 자' },
    joinLine: { en: 'No mass, no patience — let\'s move.', ko: '질량도 없고 기다릴 시간도 없어요. 바로 갑니다.' } },
  { id: 's7_04', joinStage: 7, role: 'rift',
    epithet: { en: 'the Engine', ko: '엔진' },
    joinLine: { en: '0.7% of me becomes energy. All of it becomes yours.', ko: '제 질량의 0.7%가 에너지가 됩니다. 전부 당신 것입니다.' } },
  { id: 's7_10', joinStage: 7, role: 'click',
    epithet: { en: 'the Dead End', ko: '종착점' },
    joinLine: { en: 'Fusing me costs more than it pays. So I pay it forward instead.', ko: '저를 융합해봐야 손해예요. 대신 다른 방식으로 갚죠.' } },
  { id: 's7_13', joinStage: 7, role: 'wild',
    epithet: { en: 'the Seeder', ko: '씨뿌리는 자' },
    joinLine: { en: 'I go out once. Everything after is made of me.', ko: '저는 단 한 번 터집니다. 그 이후의 모든 것이 저로 만들어지죠.' } },
  { id: 's8_05', joinStage: 8, role: 'rift',
    epithet: { en: 'the Loudmouth', ko: '떠벌이' },
    joinLine: { en: 'I\'m no bigger than a solar system. Watch me outshine a galaxy.', ko: '태양계보다 크지도 않은데, 은하 전체보다 밝게 빛나 볼게요.' } },
  { id: 's8_08', joinStage: 8, role: 'wild',
    epithet: { en: 'the Whisperer', ko: '속삭이는 자' },
    joinLine: { en: 'Millions of tiny signals too far to see alone. Together, unmistakable.', ko: '혼자서는 안 보이는 수백만 개의 신호. 하지만 합치면 분명해지죠.' } },
  { id: 's8_13', joinStage: 8, role: 'click',
    epithet: { en: 'the Clarifier', ko: '정화자' },
    joinLine: { en: 'The last fog just burned away. Everything\'s visible now.', ko: '마지막 안개가 걷혔습니다. 이제 모든 게 보입니다.' } },
  { id: 's9_05', joinStage: 9, role: 'rift',
    epithet: { en: 'the Unseen Giant', ko: '보이지 않는 거인' },
    joinLine: { en: 'You can\'t see most of me. That\'s kind of the point.', ko: '제 대부분은 보이지 않습니다. 원래 그런 존재니까요.' } },
  { id: 's9_09', joinStage: 9, role: 'rift',
    epithet: { en: 'the Glutton', ko: '폭식가' },
    joinLine: { en: 'Feed me matter. I\'ll turn it into light you can see from anywhere.', ko: '물질을 먹여주세요. 어디서든 보일 빛으로 바꿔드리죠.' } },
  { id: 's9_13', joinStage: 9, role: 'wild',
    epithet: { en: 'the Empty One', ko: '텅 빈 자' },
    joinLine: { en: 'I contain almost nothing. And yet I\'m most of the universe.', ko: '저는 거의 텅 비어 있어요. 그런데도 우주 대부분을 차지하죠.' } },
  { id: 's10_02', joinStage: 10, role: 'click',
    epithet: { en: 'the Humble Beginning', ko: '소박한 시작' },
    joinLine: { en: 'Everything starts small. I\'m proof.', ko: '모든 건 작게 시작해요. 제가 증거입니다.' } },
  { id: 's10_06', joinStage: 10, role: 'click',
    epithet: { en: 'the Wanderer', ko: '방랑자' },
    joinLine: { en: 'I swing by once in a long while. Make it count.', ko: '아주 가끔 지나가니까, 그 순간을 제대로 써야죠.' } },
  { id: 's10_11', joinStage: 10, role: 'wild',
    epithet: { en: 'the Shield', ko: '방패' },
    joinLine: { en: 'You never see me working. You\'d definitely notice if I stopped.', ko: '제가 일하는 건 안 보여요. 하지만 멈추면 바로 알게 될 겁니다.' } },
  { id: 's11_02', joinStage: 11, role: 'click',
    epithet: { en: 'the Impact Child', ko: '충돌의 자식' },
    joinLine: { en: 'One impact made me. I like starting from a hit.', ko: '저는 한 번의 충돌에서 태어났어요. 강한 한 방으로 시작하는 게 좋더라고요.' } },
  { id: 's11_06', joinStage: 11, role: 'rift',
    epithet: { en: 'the Polluter', ko: '오염자' },
    joinLine: { en: 'My waste product is your future atmosphere. You\'re welcome.', ko: '제 부산물이 미래의 대기가 될 거예요. 천만에요.' } },
  { id: 's12_09', joinStage: 12, role: 'rift',
    epithet: { en: 'the Unbreakable', ko: '부서지지 않는 자' },
    joinLine: { en: 'A teaspoon of me outweighs your whole fleet. I don\'t rest, I compress.', ko: '제 한 스푼이 함대 전체보다 무겁죠. 쉬지 않습니다, 압축할 뿐.' } },
  { id: 's12_12', joinStage: 12, role: 'click',
    epithet: { en: 'the Faint Whisper', ko: '희미한 속삭임' },
    joinLine: { en: 'You won\'t feel me arrive. You\'ll only notice the universe rippled.', ko: '제가 오는 걸 느끼진 못할 거예요. 우주가 흔들렸다는 것만 알아채겠죠.' } },
  { id: 's12_13', joinStage: 12, role: 'wild',
    epithet: { en: 'the Standard Candle', ko: '표준 촛불' },
    joinLine: { en: 'Same mass, same blast, every time. Consistency is my whole point.', ko: '언제나 같은 질량, 같은 폭발. 일관성이 제 존재 이유입니다.' } },
  { id: 's13_10', joinStage: 13, role: 'click',
    epithet: { en: 'the Collision Course', ko: '충돌의 길' },
    joinLine: { en: 'Two of us spiral in. Only one shockwave walks out.', ko: '둘이 나선을 그리며 다가옵니다. 걸어 나가는 충격파는 하나뿐이죠.' } },
  { id: 's13_12', joinStage: 13, role: 'rift',
    epithet: { en: 'the Quiet Devourer', ko: '조용한 포식자' },
    joinLine: { en: 'I don\'t chase. I wait. Everything falls in eventually.', ko: '쫓지 않습니다. 기다릴 뿐이죠. 결국 모든 건 빨려 들어옵니다.' } },
  { id: 's13_13', joinStage: 13, role: 'wild',
    epithet: { en: 'the Marathoner', ko: '마라토너' },
    joinLine: { en: 'Ten trillion years of burning teaches you not to waste anything — even a reset.', ko: '10조 년을 타고 나면 알게 됩니다. 리셋마저도 아껴 써야 한다는 걸요.' } },
  { id: 's14_07', joinStage: 14, role: 'click',
    epithet: { en: 'the Mass-Giver', ko: '질량을 주는 자' },
    joinLine: { en: 'Nothing else would have mass without me. I just don\'t like to brag.', ko: '제가 없으면 아무것도 질량을 갖지 못해요. 그냥 자랑을 안 할 뿐이죠.' } },
  { id: 's14_09', joinStage: 14, role: 'click',
    epithet: { en: 'the Neutral Mediator', ko: '중립의 중재자' },
    joinLine: { en: 'I carry no charge, but I always get the message across.', ko: '전하는 없지만, 메시지는 항상 제대로 전달하죠.' } },
  { id: 's14_13', joinStage: 14, role: 'wild',
    epithet: { en: 'the Final Atom', ko: '마지막 원자' },
    joinLine: { en: 'When I\'m gone, ordinary matter is gone too. I intend to make this count.', ko: '제가 사라지면 평범한 물질도 끝입니다. 그러니 헛되이 쓰지 않을 거예요.' } },
  { id: 's14_14', joinStage: 14, role: 'rift',
    epithet: { en: 'the Great Eraser', ko: '위대한 지우개' },
    joinLine: { en: 'I decided who got to exist before the universe was a second old. I still balance ledgers.', ko: '우주가 1초도 되기 전에 누가 존재할지 정한 게 저예요. 지금도 장부는 맞춰드리죠.' } },
  { id: 's15_06', joinStage: 15, role: 'click',
    epithet: { en: 'the Rising Chirp', ko: '치솟는 지저귐' },
    joinLine: { en: 'Watch the pitch rise. For one heartbeat, I outshine everything.', ko: '음이 치솟는 걸 보세요. 단 한 순간, 제가 모든 걸 압도합니다.' } },
  { id: 's15_10', joinStage: 15, role: 'click',
    epithet: { en: 'the Paradox', ko: '역설' },
    joinLine: { en: 'Einstein promised you a smooth fall. I promise you a wall of fire instead.', ko: '아인슈타인은 매끄러운 낙하를 약속했죠. 전 불의 벽을 약속합니다.' } },
  { id: 's15_13', joinStage: 15, role: 'wild',
    epithet: { en: 'the Last Blaze', ko: '마지막 불꽃' },
    joinLine: { en: 'Shrinking makes me hotter, not weaker. Watch the finale.', ko: '작아질수록 전 더 뜨거워집니다, 약해지는 게 아니라요. 피날레를 지켜보세요.' } },
  { id: 's16_06', joinStage: 16, role: 'rift',
    epithet: { en: 'the Great Leveler', ko: '위대한 평준화자' },
    joinLine: { en: 'Given enough time, everything reaches the same temperature as me. Even your hexagon.', ko: '시간이 충분하면 결국 모든 게 저와 같은 온도가 됩니다. 당신의 육각형도요.' } },
  { id: 's16_09', joinStage: 16, role: 'rift',
    epithet: { en: 'the Last Flicker', ko: '마지막 깜빡임' },
    joinLine: { en: 'They call it a dead vacuum. I\'m still flickering, and I pick which lane I flicker in.', ko: '죽은 진공이라고들 하죠. 전 아직 깜빡이고 있고, 어느 자리에서 깜빡일지는 제가 고릅니다.' } },
];

export const CREW_BY_ID: ReadonlyMap<string, CrewDef> = new Map(CREW_ROSTER.map((c) => [c.id, c]));

export function isCrewId(id: string | null | undefined): boolean {
  return !!id && CREW_BY_ID.has(id);
}

/** Crew that should be unlocked once the player has reached `stageId` (join beats). */
export function crewJoiningAtOrBefore(stageId: number): CrewDef[] {
  return CREW_ROSTER.filter((c) => c.joinStage <= stageId);
}

export function pickCrewLang(l: CrewL, lang: 'en' | 'ko'): string {
  return lang === 'ko' ? l.ko : l.en;
}
