/**
 * Centralised game-wide UI translations.
 * All user-facing strings should live here. Components receive `language` and
 * look up text via `t(language, key)`.
 */

export type Lang = 'en' | 'ko';

export const STRINGS = {
  // ── HUD labels ────────────────────────────────────────────────
  hudStage:      { en: 'Stage',   ko: '단계' },
  hudQuanta:     { en: 'Quanta',  ko: '퀀타' },
  hudAuto:       { en: 'Auto',    ko: '자동' },
  hudCrit:       { en: 'Crit',    ko: '치명타' },
  hudTime:       { en: 'Time',    ko: '시간' },
  hudEntropy:    { en: 'Entropy', ko: '엔트로피' },
  hudCondense:   { en: 'Condense', ko: '응축' },
  hudCompleted:  { en: '🐾 Completed', ko: '🐾 완료' },
  hudRemaining:  { en: 'remaining', ko: '남음' },
  hudCondenseFor: { en: 'Condense for', ko: '응축하여 획득' },
  hudCondenseAlready: { en: 'This stage has already been condensed.', ko: '이미 응축된 단계입니다.' },
  hudViewInfo:   { en: 'View Info / Tutorial', ko: '정보 / 튜토리얼 보기' },
  hudSettings:   { en: 'Settings', ko: '설정' },
  clickToGather: { en: 'CLICK TO GATHER QUANTA', ko: '클릭하여 퀀타를 모으세요' },
  viewingStage:  { en: 'Stage',   ko: '단계' },
  returnCurrent: { en: '← Current', ko: '← 현재' },

  // ── Intro screen ──────────────────────────────────────────────
  introBegin:    { en: 'BEGIN',   ko: '시작' },
  introResume:   { en: 'RESUME',  ko: '이어하기' },
  introNewBang:  { en: 'NEW BIG BANG', ko: '새 빅뱅' },
  introAtlas:    { en: 'MULTIVERSE ATLAS', ko: '다중우주 도감' },
  introTagline:  { en: 'From the first instant to the end of time.', ko: '첫 순간부터 시간의 끝까지.' },
  introLetThere: { en: 'Let there be light', ko: '빛이 있으라' },
  introGenesis:  { en: 'Genesis 1:3', ko: '창세기 1:3' },

  // ── Reset confirm modal ───────────────────────────────────────
  resetTitle:    { en: 'Delete save?', ko: '저장 데이터를 삭제할까요?' },
  resetWarn:     { en: 'This will permanently delete your save. Are you sure?',
                   ko: '저장 데이터가 영구히 삭제됩니다. 정말 진행할까요?' },
  resetCancel:   { en: 'CANCEL', ko: '취소' },
  resetConfirm:  { en: 'CONFIRM RESET', ko: '초기화 확인' },
  errorReload:   { en: 'An error occurred. Please reload the page.', ko: '오류가 발생했습니다. 페이지를 새로고침해주세요.' },
  errorReloadBtn:{ en: 'Reload', ko: '새로고침' },

  // ── Stage names ───────────────────────────────────────────────
  stageInflation:     { en: 'Inflation',          ko: '인플레이션' },
  stageBaryo:         { en: 'Baryogenesis',       ko: '바리온 생성' },
  stageQGP:           { en: 'Quark-Gluon Plasma', ko: '쿼크-글루온 플라스마' },
  stageNucleo:        { en: 'Nucleosynthesis',    ko: '핵합성' },
  stageRecomb:        { en: 'Recombination',      ko: '재결합' },
  stageDarkAge:       { en: 'Cosmic Dark Age',    ko: '우주 암흑시대' },
  stageFirstStars:    { en: 'First Stars',        ko: '최초의 별' },
  stageReionization:  { en: 'Reionization',       ko: '재이온화' },
  stageGalaxy:        { en: 'Galaxy Formation',   ko: '은하 형성' },
  stagePlanet:        { en: 'Planet Formation',   ko: '행성 형성' },
  stageLife:          { en: 'Life Evolution',     ko: '생명의 진화' },
  stageRedGiant:      { en: 'Red Giant Era',      ko: '적색거성 시대' },
  stageRemnant:       { en: 'Stellar Remnants',   ko: '항성 잔해' },
  stageProtonDecay:   { en: 'Proton Decay',       ko: '양성자 붕괴' },
  stageHawking:       { en: 'Hawking Radiation',  ko: '호킹 복사' },
  stageEnding:        { en: 'Final Choice',       ko: '마지막 선택' },

  // ── Tutorial / speech bubble ──────────────────────────────────
  tutorialInfoHint: { en: 'Tap here for info', ko: '여기를 눌러 정보 보기' },
  tutEntityLabIntro:    { en: 'Entity Lab turns quanta into stage entities. They appear in the field and replace the old skill upgrades.',
                          ko: '엔티티 연구소는 퀀타를 단계별 엔티티로 바꿉니다. 화면에 등장해 기존 스킬 강화를 대체합니다.' },
  tutEntityLabOpen:     { en: 'Open Entity Lab', ko: '엔티티 연구소 열기' },
  tutEntityLabCanvas:   { en: 'Purchased entities now orbit the center. Buying more copies adds more bodies, not just a number.',
                          ko: '구매한 엔티티가 중심을 공전합니다. 더 구매할수록 단순한 숫자가 아니라 실제 객체가 늘어납니다.' },
  tutTimeGauge:         { en: 'Cosmic time accumulates here. Time-type entities in the lab speed this gauge up.',
                          ko: '여기에 우주 시간이 누적됩니다. 연구소의 시간형 엔티티로 이 게이지를 가속할 수 있습니다.' },
  tutShop:              { en: 'Cosmic Shop has temporary boosts. Free in test mode.',
                          ko: '우주 상점에는 일시적인 버프가 있습니다. 테스트 모드에서는 무료입니다.' },
  tutShopOpen:          { en: 'Open Shop', ko: '상점 열기' },
  tutBoost:             { en: 'Active boosts appear here and count down in real time. Stack purchases to extend the duration.',
                          ko: '활성 버프가 여기 표시되며 실시간으로 줄어듭니다. 중첩 구매로 시간을 연장할 수 있습니다.' },
  tutCondense:          { en: 'Both gauges are full. Press Condense to advance.',
                          ko: '두 게이지가 모두 가득 찼습니다. 응축을 눌러 진행하세요.' },
  tutStageLog:          { en: 'Stage events are recorded here. Click to explore milestones.',
                          ko: '단계별 사건이 여기 기록됩니다. 눌러서 마일스톤을 살펴보세요.' },
  tutStageLogOpen:      { en: 'Open', ko: '열기' },

  settingsLangSwitchToKo: { en: 'Switch to Korean', ko: '한국어로 전환' },
  settingsLangSwitchToEn: { en: 'Switch to English', ko: '영어로 전환' },
} as const;

export type StringKey = keyof typeof STRINGS;

export function t(lang: Lang, key: StringKey): string {
  return STRINGS[key][lang];
}

// Stage id → name key lookup for runtime translation of stage objects.
export const STAGE_NAME_KEYS: Record<number, StringKey> = {
  1: 'stageInflation',
  2: 'stageBaryo',
  3: 'stageQGP',
  4: 'stageNucleo',
  5: 'stageRecomb',
  6: 'stageDarkAge',
  7: 'stageFirstStars',
  8: 'stageReionization',
  9: 'stageGalaxy',
  10: 'stagePlanet',
  11: 'stageLife',
  12: 'stageRedGiant',
  13: 'stageRemnant',
  14: 'stageProtonDecay',
  15: 'stageHawking',
  16: 'stageEnding',
};

export function stageName(lang: Lang, stageId: number, fallback: string): string {
  const key = STAGE_NAME_KEYS[stageId];
  if (!key) return fallback;
  return STRINGS[key][lang];
}
