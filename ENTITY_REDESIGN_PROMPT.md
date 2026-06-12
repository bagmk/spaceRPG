# Entity 시스템 재설계 — 빌드 프롬프트 (단일 핸드오프)

> **목적:** "그냥 클릭" 지루함 해결. entity 시스템을 **드랍 → 융합(가챠) → 장착 → 엔트로피** 루프로 재배선.
> **고치는 게 아니라 재배선:** 16 stage(물질 진화 사다리) · entity 240종 · entropy는 이미 존재. 다시 연결만 한다.
> **사용법:** 이 문서 + `GAMEPLAY_REDESIGN_IDEAS.md`(진단 근거)를 빌드 세션에 넘긴다. **DECISION POINT(§6) 답 받기 전엔 코드 금지.**

---

## 0. 붙여넣기용 킥오프 (복사 → 빌드 세션에 붙여넣기)

```
Cosmic Coalescence의 entity 시스템을 재설계한다.

순서:
1. ENTITY_REDESIGN_PROMPT.md 와 GAMEPLAY_REDESIGN_IDEAS.md 를 끝까지 읽는다.
2. ARCHITECTURE.md · CODEX_CLAUDE.md 로 구조/컨벤션을 파악한다.
3. ENTITY_REDESIGN_PROMPT.md §6 DECISION POINT 5개를 AskUserQuestion 으로 나에게 묻는다.
4. 답을 받으면 이 문서 맨 위 "## Status" 에 누적 기록하고 커밋한 뒤 Phase 0 시작.

규칙:
- DECISION POINT 답 받기 전엔 코드 금지.
- 한 번에 한 Phase. CHECKPOINT 검증 후 "다음 Phase 진행할까요?" 묻고 멈춘다.
- src/game/storage.ts 의 마이그레이션 시스템 재사용. SaveState version 올리고 migrate 작성.
- 기존 entity 240종 데이터(stageItems.ts)는 보존 — 테마/등급/효과 재사용.
- 코드 주석은 영어. 변경마다 테스트 추가. 밸런스는 balance-simulator.html 로 검증.

지금 §6 DECISION POINT 부터 물어봐.
```

> 빌드 세션이 규칙을 어기고 코드부터 쓰려 하면: `멈춰. §6 DECISION POINT 먼저 물어. 답 받기 전 코드 금지.`

---

## 1. 문제 / 진단 (왜 바꾸나)

- **클릭이 진행과 분리됨.** `BALANCE_ANALYSIS.md`: CPS 0.5→20 에서 총 시간 1.5%만 변함. 코드 확인: `reducers/gameplay.ts` 의 `handleClick` 은 `cosmicClockSec`(진짜 게이트)를 안 건드림. 진행은 시간 흐름만 결정 → 손은 바쁜데 게임은 안 빨라짐 = 무력감.
- **해결 원칙:** 행동(클릭·수집·융합)이 **엔트로피**를 키우고, **엔트로피가 시대 게이트**가 된다. 우주 시간은 서사/연출로 강등.

## 2. 비전 한 장

**코어 루프**
`클릭 → 물질(quanta) + 아이템 드랍 → 융합/가챠 → 장착 → 클릭 강화 + 엔트로피↑ → 엔트로피 게이트 도달 → 시대 진화 ↺`

**3통화 (역할 분리)**

| 통화 | 역할 | 획득 | 소모/역할 | 색 |
|---|---|---|---|---|
| **Quanta (물질)** | 엔진/전략 | 클릭 + auto | 융합·장착·업그레이드 | 앰버 #e9b94a |
| **Entropy** | 진행 척추 | 행동(특히 융합·수집) | **stage 게이트** (시간 게이트 대체) | 바이올렛 #bb8cff |
| **Meta** | 프레스티지 | peak entropy → 변환 | 영구 업그레이드 (`condensedMass`·`echoes` 기존) | 시안 #46d8c4 |

## 3. 데이터 모델 변경 (구체 — 실제 파일 기준)

> 모든 변경은 `storage/migrate.ts` 마이그레이션 동반. `SaveState.version: 13 → 14`.

- **`game/types.ts · SaveState`**
  - `purchasedEntities: PurchasedEntityEntry[]` → `inventory: EntityInstance[]` (`{ entityId, count, level }`).
  - 추가: `equippedSlots: string[]`(entityId), `unlockedSlotCount: number`, `almanacCollected: Record<number, string[]>`(시대별 수집 id).
  - `entropy`/`peakEntropy` 유지(진행 게이트로 승격). `clickLevel/autoLevel/critLevel`·`skills` 는 §흡수 정책에 따라 축소/제거.
- **`game/entities/types.ts · StageEntity`**
  - 추가: `tier: number`(물질 사다리 위치 — 컨셉 A), `setKey: string`(세트 키 = glyph 패밀리 재사용), `fusionRecipe?: { inputs: string[]; cost: number; outputs: WeightedDrop[] }`.
  - 기존 `rarity · effect(EntityEffect) · visual(EntityGlyph)` 그대로 사용.
- **`game/formulas.ts`**
  - `getEntropyFromMatterGain` 을 행동별로 분기: 클릭/auto 는 소량, **융합/세트 완성은 큰 버스트**. (지금은 `ENTROPY_MATTER_RATE=0.5` 고정 → 이걸 풀어야 "엔트로피=quanta 라벨 갈이"가 안 됨. **가장 중요한 한 줄.**)
  - `canCondense`: `quanta>=threshold && cosmicClock>=cosmicTimeSec` → **`entropy >= stage.entropyThreshold`** (혼합이면 quanta 보조 조건 유지 — DECISION 1).
- **`game/stages.ts`**: stage별 `entropyThreshold` 추가. `threshold`(quanta)는 보조/제거, `cosmicTimeSec` 는 표시용 readout 으로만.
- **`game/skills/*` + `reducers/gameplay.ts`**: `click/auto/crit` 효과를 장착/세트 보너스로 이전(흡수). `getActiveModifiers` 가 `equippedSlots` 를 읽도록. `time` 트랙은 DECISION 3.
- **프레스티지**: `getCondensedMassReward`/`getEchoReward`(formulas) 입력을 `peakEntropy` 기준으로. 도감 완성도 보너스 추가.

## 4. 시스템 스펙 (4 서브시스템)

**4.1 수집 (Collect)** — `particles.ts pickParticleName` 재사용. 클릭/크리/`REPORT_COLLISION` 시 확률 드랍. 크리·콤보 높을수록 상위 등급 가중. 드랍 → `inventory` + 도감 셀 채움.

**4.2 융합/가챠 (Fuse)** — 입력 아이템 N + quanta → `fusionRecipe.outputs` 가중 랜덤. 등급 odds 표시. **융합 성공 시 엔트로피 버스트**(진행 직결). **중복 아이템 → 레벨업 sink**(가챠 중복이 안 버려지게). 천장(pity)은 DECISION 4.

**4.3 장착 (Equip)** — 슬롯 1→2→3 해금(도감 % / 시대 / 프레스티지). 장착 효과 합산 → 클릭·auto·crit·엔트로피율. **세트 보너스**(`setKey` 동일 N개). 결과 스탯 패널.

**4.4 도감 (Almanac)** — 기존 `almanac.ts`/`AlmanacOverlay` 에 수집 격자 추가. 시대 세트 완성 % → 영구 보너스 + **진행 가속**(컨셉 A: 물질 사다리 노출). 읽기 전용 교육 콘텐츠는 유지.

## 5. UI 스펙 (목업 5종 — 별도 위젯 참조)

색 규약: **보라=엔트로피(진행)**, 앰버=물질, 시안=우주시간(연출만). 등급 테두리: 일반#8b93a7·레어#54a8e0·에픽#b07dff·전설#ffb347.

1. **메인 HUD** — 상단: 시대 칩 + **엔트로피 게이트 바(주)** + 물질 바(보조) + 시간 readout(흐릿). 중앙: 물질 코어(현 티어) + 드랍 팝. 하단: **장착 슬롯 3** + 탭바(플레이/도감/융합/장착).
2. **도감** — 시대별 격자, 채움/잠김, 완성 % + 세트 보너스 칩.
3. **융합로** — 입력 슬롯 N + 비용 + FUSE 버튼 + 결과 리빌(등급 플래시 + 엔트로피 버스트) + odds 바 + 물질 사다리 힌트.
4. **장착** — 슬롯별 카드(글리프·효과·Lv·업그레이드) + 세트 배너 + 스탯 4종 패널.
5. **아이템 카드** — 글리프+등급테두리 / 티어 배지 / 효과 / Lv+중복 진행 / 액션 3종(장착·융합투입·업그레이드).

## 6. DECISION POINTS (코드 전에 먼저 물어라)

1. **진행 게이트:** (a) 순수 엔트로피 임계값 / (b) 엔트로피 주 + quanta 보조 혼합? — *추천 (a), 단순/명료.*
2. **아이템 carry:** 프레스티지 때 보존 범위? — *추천: 도감 + 최고 티어 carry(메타 성장), 장착 아이템은 리셋(신선함).*
3. **스킬 트리:** (a) click/auto/crit 만 흡수 + time 유지 / (b) 전부 흡수(time→오프라인 수익)? — *추천 (b) 가 깔끔, 단 우주시간 게이트 완전 제거가 전제.*
4. **가챠:** 순수 랜덤 / 천장(pity) 포함? — *추천: 천장 포함(이탈 방지).*
5. **범위:** 신규 화면 빌드 / 기존 `EntityPanel` 점진 개조? — *추천: 점진 개조(자산 보존).*

## 7. 단계별 구현 (Phase + CHECKPOINT)

- **Phase 0 — 회로 검증 (반나절).** DECISION 반영. 진행 게이트를 엔트로피로 바꾸는 **최소 실험** + `balance-simulator.html` 갱신. ☐ "active play(클릭/융합)가 진행을 빠르게 한다"가 수치로 보인다.
- **Phase 1 — 모델 + 수집.** SaveState 마이그레이션. 드랍 → inventory → 도감 채움. ☐ 클릭으로 아이템이 쌓이고 도감이 채워진다. ☐ 기존 세이브가 깨지지 않는다.
- **Phase 2 — 장착 슬롯 1 + 흡수.** 장착 효과 적용, click/auto/crit 흡수 시작. ☐ 장착이 클릭 산출을 바꾼다.
- **Phase 3 — 융합/가챠 + 슬롯 2·3 + 세트.** ☐ 융합이 상위 아이템 + 엔트로피 버스트를 준다. ☐ 세트 보너스 동작.
- **Phase 4 — 도감 메타 + 프레스티지 + 밸런스.** ☐ 16시대 페이싱 재검증(simulator). ☐ 프레스티지 carry 정책 반영.

## 8. 규칙 / 제약

- `storage.ts`/`storage/migrate.ts` 마이그레이션 재사용 — 새로 만들지 말 것. 구 세이브 무손실.
- entity 240종(`stageItems.ts`) 데이터 보존. `tier`/`setKey`/`fusionRecipe` 만 **증분 추가**.
- **one-in-one-out:** 새 시스템 추가 시 대체되는 기존 시스템(스킬 트랙 등)을 같이 흡수/제거 — 시스템 과잉 방지.
- 모바일 성능: 드랍/파티클 객체 풀링(`PERFORMANCE_ANALYSIS.md` 참조). 60fps 회귀 금지.
- 결제/스토어 카피 영향 점검: "no ads" 등 기존 문구가 새 루프와 충돌하는지(`project_store_legal`).
- 코드 주석 영어. 각 Phase 테스트 추가(`game/__tests__/`).

---

## Status (빌드 세션이 누적 기록)

- Current Phase: **Phase 3 — 완료. UI 패스 3회(2026-06-11) 완료. 다음: Phase 4**
- 아이템 ID ↔ 이름 분리 (2026-06-11, 사용자 결정 — "ID를 이름에서 분리"):
  - **정식 ID = 위치 기반**(`s{stage}_{pos}`, 이름 슬러그 제거). 이제 아이템 이름을 바꿔도 ID가 절대 안 바뀜 → 리네임 자유(주기율표 실원소화·표준모형 보강의 선결 조건). **유일 제약**: 스테이지 내 spec 배열 순서를 바꾸면 position이 바뀌니 재정렬 금지(append만).
  - **하위호환**: 기존 이름 기반 ID(`s10_01_sun` 등)를 alias로 자동 보존(`stage()`가 legacyNameId 주입). 로드 시 `normalizeSavedEntityIds`가 inventory/almanac/equipped/rift의 모든 저장 ID를 `findEntityById(id)?.id`로 정식 ID에 정규화(멱등; 한 번 로드되면 영구 위치 ID화). 중복 inventory 엔트리는 count 합·level max로 병합.
  - **세이브 v14→v15**: `SAVE_SCHEMA_VERSION` 15, `createSaveSnapshot`은 상수 사용, 14/15 공용 분기 + 외곽 정규화. `anchors.ts`(STAGE_ANCHOR_ENTITY·STAGE_11_PREREQUISITE)는 정확매칭 키라 위치 ID로 재작성.
  - 검증: 711 통과(신규: 위치 ID 불변식 가드·v15 ID 정규화), tsc, build.
- 도감 중첩 세트 + 완성 보너스 (2026-06-11, 사용자 피드백 — 도감을 더 잘게):
  - **2단 분류**(`codexSets.ts` 재작성): 세트(7) → 서브셋. **태초(Genesis)** 튜토리얼 세트(스테이지1 = 최초의 빛), **표준 모형**(쿼크/경입자/보손/장), **주기율표**(원자핵/원자/분자), **항성의 용광로**(항성/별의 죽음/잔해), **우주 거대구조**(가스·파동/암흑물질/은하), **생명의 세계**(세계/생명), **종말**(중력 우물/공허). 멤버십은 glyph 또는 stageId로 결정적. Genesis는 의도적 오버랩(타 세트의 stage1 입자 공유).
  - **완성 보너스**(영구·결정적, `applyCollectionRewards` → `getActiveModifiers`): 서브셋 완성 → 보너스, 세트 전체(모든 서브셋) 완성 → 추가 세트 보너스. `CodexReward{stat,value}` 7종(clickPower/critChance/critMult/autoPower/dropRate/entropyGain/offline). `almanacCollected`를 모든 getActiveModifiers 호출처(gameplay·helpers·GameScreen·useGameState offline)에 스레드 → 도감이 프레스티지를 넘어 영구 메타 성장. Codex UI: 세트 칩 + 세트 진행바 + 세트 보너스 칩(★/☆) + 서브셋 섹션별 헤더(라벨·N/M·보너스 칩) + 격자.
  - 검증: 710 통과(신규: 서브셋 멤버십·Genesis=stage1·완성 결정성·보너스 적용 경로), tsc, build.
  - **보류(사용자 확인 필요)**: ④ 주기율표 실제 원소화(아이템 리네임 — name 기반 ID라 세이브 호환 위해 `aliases` 필요 + 설명 동반 변경) / ⑤ 융합·기어·오토의 스테이지 독립(스테이지 파워 커브 + 엔트로피 게이트 페이싱과 얽힘 = Phase 4).
- 도감 테마 세트 + 캡 해제 (2026-06-11, 사용자 피드백 — 모으는 맛):
  - **도감 테마 세트**(스테이지 구분 폐지): `codexSets.ts` 6개 — 표준 모형(43)·주기율표(20)·항성의 용광로(50)·우주 거대구조(42)·생명의 세계(23)·종말(27). glyph로 결정적 분류, 205종 전수 커버. Codex 탭: 세트 칩(완성 done/total, 완성 시 글로우) + 세트별 블러브·완성% + 스테이지 횡단 격자(미수집 카드는 ??? + S{stage} 힌트). 타임라인은 장착/융합에만.
  - **최대 아이템 수 캡 해제**: 효과가 `entry.count` 그대로 스케일(min(count,maxCount) 제거). 라벨 합계도 캡 해제(라벨=적용값 유지). maxCount 필드는 융합 중복 sink 레벨 임계로만 잔존. → 무한 수집의 "모으는 맛", 효과도 무한 성장(드랍이 율속, Phase 4 재캘리브레이션 대상).
  - 검증: 706 통과(신규 codex 세트 가드 1건), build.
- 균열 2축 + 도감 전환 (2026-06-11, 사용자 피드백):
  - **균열(오토) 2축 자연화**: `auto`="Auto Speed"(쏘는 속도 — 방출 빈도), `auto_mult`="Auto Power"(파티클 강도). **시각 직접 반영**: 균열 모트 크기·광량 ∝ Auto Power(`riftPower=autoFlatMult`, 모트 scale = 0.9+log1p(power-1)×0.9, 최대 2.4×), 방출 간격 ∝ Auto Speed(autoRate). 라벨/패널/families 갱신.
  - **엔티티랩 → 도감(Codex) 전환**: lab 페이지를 수집 격자로 교체 — 수집/잠김(???) 카드, 스테이지별 완성 N/M·%, 장착 ★ 표시, 탭하면 상세(장착/강화). **구매 전면 제거**: 상세 카드 구매 버튼 삭제, 하단바 ⚗연구소 → 📖도감. 아이템은 드랍+융합으로만 획득. PURCHASE_ENTITY 리듀서는 테스트용 유지(UI 미호출). 튜토리얼을 드랍/장착 루프로 갱신.
  - i18n: collectionTitle/codexCollected/codexConsumed + Auto Speed/Power 라벨(EN/KO).
  - 검증: 706 통과, build. 죽은 구매 코드(EntityCard 등) 정리는 spawn_task로 분리.
- Time 효과 제거 → Auto Power 대체 (2026-06-11, 사용자 요청):
  - **근거**: cosmic-time 게이트가 엔트로피 게이트로 대체된 뒤 `time` 효과는 진행을 못 막는 **죽은 스탯**. 엔티티 44개의 `time` → 신규 **`auto_mult` ("Auto Power")**.
  - **격리 설계**: 신규 모디파이어 `autoFlatMult`(기본 1)가 **엔티티 flat-auto만 곱함**(`getAutoRate`에 항 추가). autoRateMult/substat/세트와 안 엮여 밸런스 무회귀. 항상 유용(오프라인 전용 X). 카테고리는 rift 유지(스테이지 카운트 불변).
  - **세이브**: 효과는 ID로 조회되므로 **마이그레이션 불필요** — 모든 세이브 자동 적용.
  - UI: 카드 효과 라벨 "+X% Auto Power"(라벨=적용값), 균열 스탯 패널에 Auto Power(×) 행 추가. families 역할 문구의 "시간" 표현 → 오토 파워. i18n effectAutoPower(EN/KO).
  - 테스트: time 엔티티 검사 7건 정리 — 4건 auto_mult로 갱신, 죽은 cosmic-gauge 테스트 6건 제거(엔트로피 게이트로 대체된 연출 시스템, Phase 4에서 time 스킬 트랙도 제거 예정). 706 통과, build.
  - 잔여: `EntityEffectType`에 `time`은 union에 남김(스킬 time 트랙 timeMultMult 경로용 — Phase 4에서 트랙째 제거).
- 아이템 정체성 패스 (2026-06-11, 스펙 §4 — 이름↔효과↔외형 정합):
  - **진단**: 효과가 테마 무관 **순수 위치 배정**이었음(각 등급 행 [auto,click,crit,time] 기계적). "Pulsar=crit, Supernova Precursor=time, Dark Matter Halo=auto" 등 이름↔효과 불일치의 근본 원인. 실제 엔티티 수 = **205종**(문서의 "240"은 근사).
  - **수정(코드모드)**: 각 등급 행 안에서 effect 3요소(type/value/flat)를 글리프 친화도 페널티 최적으로 **재배치**, 앵커(Sun/Earth Formation) 고정. 70건 변경. **행 멀티셋 보존 → 스테이지 카테고리(rift6/click8)·효과분포·ID·glyph·비용·시각 전부 불변 → 밸런스/세이브 0 리스크.** 0-친화 배정 44→19(데이터 구조상 같은 글리프 2개가 한 행이면 일부 강제).
  - 결과: Pulsar→auto(맥동 오토), Supernova/Nova/Helium Flash→crit(폭발 치명), Free Quark 등 quark 5/8→click(연타), Dark Matter 4종→time(느림/오프라인), Magnetar→time. 마퀴 전부 의도대로.
  - **계열 정체성**: `families.ts` — glyph(=setKey=계열)마다 계열명+역할 1줄(EN/KO). 상세 카드에 "항성 · 꾸준한 오토 엔진" 식 배지. 33개 글리프 전부 라벨링.
  - 테스트: 205종/카테고리 스냅샷/효과분포/마퀴 코히런스 가드 9건. 713/713, build 통과.
  - 잔여: 중복 역할 통합·삭제는 미실시(세이브 보존 우선, 등급 게이팅으로 "samey" 체감은 완화). multi-hit/burst 신규 효과 타입은 Phase 4 후보. 모바일 검증(사용자).
- 장비 시스템 통합 패스 (2026-06-11, 대형 스펙 — 카테고리 순수성/환급/파티클 연동):
  - **카테고리 순수성(§1/§10)**: 보조 스탯 풀 이원화(`SECONDARY_STAT_POOLS`) — 클릭 장비: 크리확률/크리배율/콤보캡/엔트로피/드랍률/융합버스트/클릭%, 균열 장비: 오토%/엔트로피/드랍률/융합버스트/**오프라인 효율(신규 offlineEff → offlineGainMult)**. `multiplier`(클릭 장비)의 오토 누수 제거 — 클릭+크리만. `getEquipCategory`는 entities/types.ts로 이동(순환 의존 해소).
  - **강화 투자 추적 + 융합 환급(§6/§7)**: `EntityInstance.invested`(옵션 필드 — v14 호환, 가드 옵션 처리). 강화 시 누적, 융합 소모 시 지분 비례 × `ENHANCE_REFUND_RATE(0.6)` 환급(트레이에 예상 환급 표시 = 실지급 동일 함수). **캡 중복 융합은 소멸 대신 환급**(`FUSION_CAP_DUP_REFUND_FRAC(0.5)`×baseCost, 결과 카드 '최대치 — 환급' 표기).
  - **융합 보장/바이어스(§7)**: 입력 전부 동일 카테고리면 **동일 카테고리 출력 보장**, 전부 동일 글리프 계열이면 `FUSION_FAMILY_BIAS(0.6)` 확률로 계열 유지.
  - **파티클 연동(§8)**: 클릭 모트 = 장착 클릭 장비 심볼(슬롯 순환, 크리 2개+대형), 균열 모트 = 균열 장비 심볼(기존). UI/캔버스 공유 시각 모델 = `entity.visual`(symbol/color/glyph) 단일 소스.
  - **카테고리별 스탯 패널(§2)**: 클릭 페이지(클릭당/크리확률/크리배율/콤보 상한) vs 균열 페이지(오토율/방출 주기/오프라인 효율/엔트로피 배율). PanelStats 확장.
  - 검증: 704/704 테스트(신규 gear-system 7건), build 통과.
  - 잔여(후속 패스): 240종 이름↔효과 정합 감사·중복 통합(콘텐츠 패스 — 등급 게이팅으로 경험적 목표는 달성, 데이터 수술은 별도), Cosmic 등급(불필요 판정 — 게이트로 해결), 모바일 실기기 검증(사용자), Phase 4 시뮬레이터 재캘리브레이션에 환급/강화 싱크 반영.
- 아이템 진행 패스 (2026-06-11, 사용자 승인 A안 + 확장):
  - **스테이지 파워 커브**: %효과(click/critMult/multiplier/entropy)에 `STAGE_POWER_BASE(1.3)^(stage-1)` — 같은 스테이지 전설≈커먼 13×라 전설이 ~9스테이지 우위 유지 후 세대교체. 크리확률/콤보캡(캡 자원)은 비스케일. **오토 앵커 분리**: 출력 = (baseCost/스테이지 앵커)×앵커1×`AUTO_STAGE_POWER_BASE(8)^(stage-1)` — 구 ×15/스테이지 폭주 완화, 균열 장비 수명 연장.
  - **등급 게이팅**: `RARITY_STAGE_GATES` 레어3/에픽7/전설12. 드랍 가중치 0→3스테이지 램프(`getRarityGateRamp`), 상점 게이트 차단 + 연구소 "???" 미스터리 카드, **융합은 게이트+1 생성**(`getMaxFusionRarityIdx`, 캡 도달 입력은 pity 동결). 초반 커먼 → 중반 레어~에픽 → 12+ 전설 진행감 확보.
  - **강화소**: `ENHANCE_ENTITY` — 물질로 스택 레벨 직접 상승(비용 baseCost×1.5×1.9^lv), 등급별 캡 10/15/20/25(`ENHANCE_LEVEL_CAPS`), 융합 중복 sink도 캡 준수. UI: 장착 슬롯 카드 + 상세 카드 강화 버튼.
  - **A안 보조 스탯**: `substats.ts` — FNV-1a(entityId) 결정적 유도, 레어1/에픽2/전설3개, 8종 풀(크리확률/크리배율/콤보캡/엔트로피획득/드랍률/융합버스트/오토%/클릭%). 신규 Modifiers 3종(dropChanceMult/entropyGainMult/fusionBurstMult) → 클릭·틱·충돌 엔트로피 및 드랍 확률, 융합 버스트에 배선. 레벨이 주+보조 동반 증폭. 카드/슬롯/상세에 표시.
  - 검증: tsc 클린, 697/697 테스트(신규 progression 12건), build 통과. 멀티에이전트 적대 리뷰 수행.
  - Phase 4 이월 추가: 커브/게이트/강화 싱크를 simulator에 반영해 재캘리브레이션.
- UI 패스 3 (2026-06-11, 사용자 피드백):
  - **출력 디버프 제거**: CLICK_OUTPUT_MULTIPLIER ⅓→1, AUTO_OUTPUT_MULTIPLIER ½→1. 근거: Phase 0 sim(임계값 캘리브레이션)은 디버프 없는 모델 — 라이브를 설계 모델에 정렬, "클릭이 너무 약함" 직접 해소.
  - 균열 가시성: 할로(radial gradient r34) + 균열 1.7배 확대 + 엣지 스파크, 히트 반경 42px.
  - 하단 바: 5버튼($/연구소/장착/융합/설정) 균일 62×52 아이콘+라벨, 한 줄 고정 (CSS 말미 오버라이드).
  - 장착/융합 페이지에도 스테이지 타임라인 공유 — 보유 그리드/피커는 선택 스테이지 기준 필터.
  - 장착 페이지 클릭 스탯: ×배율 → **클릭당 실수치** (`1.2 /클릭`).
- UI 패스 2 (2026-06-11, 사용자 피드백):
  - **장비 이원화**: 클릭 장착(equippedSlots) vs **균열 장착(riftSlots — 신규 v14 필드)**. 카테고리는 엔티티에서 자동 유도(`getEquipCategory`: auto/time → 균열, 나머지 → 클릭). EQUIP_ENTITY가 자동 라우팅, UNEQUIP_ENTITY에 target. 균열 슬롯 해금: 2=6시대, 3=도감 60종(`RIFT_SLOT_UNLOCKS`). 효과는 두 배열 합산 적용, 세트도 합산 기준.
  - **하단 바 분리 진입**: 연구소 ⚗ / 장착 ⌖ / 융합로 ⚛ 각각 버튼. 패널 내부 탭 제거(page는 컨트롤드 prop). **균열 클릭 → 균열 장착 페이지** (캔버스 히트테스트 반경 32px).
  - 클릭 시 장착 심볼 퍼프 제거(요청). 클릭 파워 레벨 스케일은 ENTITY_LEVEL_EFFECT_BONUS로 기존 적용 중. 균열 방출 심볼은 riftSlots 기준.
  - 장착 피커/융합 그리드는 **현재 스테이지 엔티티만** 표시(트래킹 단순화). 685/685 테스트, build 통과.
- UI 패스 (2026-06-11, 사용자 피드백 반영):
  - EntityPanel 3탭 분리: **연구소**(타임라인+구매/수집 카드) / **장착**(스탯 4종 패널 + 세트 배너 + 슬롯 카드 3 + 장착 피커) / **융합로**(보유 그리드 + 트레이 + odds/pity + FUSE). 슬롯 행/융합 토글 바 제거.
  - HUD: 엔트로피 readout 짤림 근본 원인 = 구 `hud-readout` 3컬럼 그리드의 지수/단위 예약폭 66px → 게이트 readout은 그리드 미사용으로 전환. 우주시간 readout 완전 제거.
  - 캔버스: 좌하단 **공간 균열(rift)** — 오토 수입 시각화(방출 간격 log 스케일), 장착 엔티티 심볼 모양의 파티클이 코어로 수렴. 클릭 시에도 장착 심볼 퍼프(슬롯 수만큼 1~3개). 모트 캡 14, 화면 공간 드로우.
- Phase 3 결과 (융합/가챠 + 슬롯 2·3 + 세트):
  - 융합(D4): `FUSE_ENTITIES` — 동일 등급 3개 소모 + 물질 10%(은행 비례 싱크) → 같은 스테이지(입력 중 최고) 풀에서 가중 랜덤 출력. odds: +1등급 40% / +2등급 5% / 유지 55%. **pity: 연속 5회 실패 시 +1 보장**(`fusionPity` 세이브 필드 — v14에 합산, v14 미배포라 버전 범프 불필요). 전설 입력은 pity 비적용.
  - 엔트로피 버스트: `ENTROPY_FUSION_VALUE_SEC(30s) × (wClick×clickPower×refCps3 + wAuto×autoRate)` — Phase 0 sim의 버스트 모델 미러링(active 기여 29~43% 유지 목표). entropy_echo 프레스티지 배율 적용, peakEntropy 갱신.
  - 중복 sink: 출력이 maxCount 도달 엔티티면 **레벨업**(+25%/레벨 효과 배율 — `ENTITY_LEVEL_EFFECT_BONUS`). applyEntityModifiers가 level 반영.
  - 세트 보너스: setKey = glyph 패밀리(별도 데이터 불필요). 장착 2개 일치 ×1.25 click/auto, 3개 일치 ×1.6 + 크리확률 +5% (`SET_BONUS`).
  - 슬롯 해금(데이터: `EQUIP_SLOT_UNLOCKS`): 슬롯2 = 4시대 진입, 슬롯3 = 도감 30종. `syncSlotUnlocks`가 ADVANCE_STAGE/구매/드랍/융합에서 동기화(내려가지 않음). 장착은 기본 첫 빈 슬롯.
  - UI(D5 점진 개조): EntityPanel 상단 장착 슬롯 행(해제 ✕, 잠금 힌트) + 융합로 토글 → 카드 탭으로 입력 트레이(3칸, 등급 강제) + odds/pity/비용 + FUSE + 결과 리빌 카드(등급 플래시 + 엔트로피 버스트, 2.6s 자동 닫힘). i18n 16키 EN/KO.
  - 검증: tsc 클린, vitest 683/683 (신규 fusion/sets/slots 10건), build 통과.
  - Phase 4 이월: 스킬 트리 제거 + time→오프라인 수익(D3 완성), 페이싱 재검증(simulator에 융합 버스트 실측 반영), casual/hardcore 스프레드 압축, idle stage 13 floor, 장착/세트 스케일 재조정, 도감 완성 % 메타 보너스 + 프레스티지 carry 선택 UI(D2).
- Phase 2 결과 (장착 슬롯 1 + 흡수 시작):
  - 액션: `EQUIP_ENTITY {entityId, slot?}` / `UNEQUIP_ENTITY {slot}`. 검증: 소유 필수, slot < unlockedSlotCount(현재 1), 동일 엔티티 중복 슬롯 금지. 점유 슬롯에 장착 시 교체. 슬롯 배열은 ''로 dense 유지(JSON 안전).
  - **흡수 시작: 엔티티 효과는 이제 장착된 것만 적용.** `getEquippedInstances(inventory, equippedSlots)`가 슬롯→인벤토리 스택 해석(stale id 무시), 모든 getActiveModifiers 호출부(tick/click/collision/offline/HUD) 전환. 보유=패시브 버프 모델 폐기.
  - UI: EntityPanel 카드에 '장착됨' 배지, 상세 카드에 장착/해제 버튼(소유 시). i18n: entityEquip/entityUnequip/entityEquipped (EN/KO).
  - 프레스티지: equippedSlots 리셋(런과 함께), 도감은 보존 — D2 그대로.
  - 검증: tsc 클린, vitest 673/673 (신규 equip 8건, 기존 3건을 구매=패시브 → 장착 기준으로 갱신 — "장착이 클릭 산출을 바꾼다" CHECKPOINT 테스트 포함), build 통과.
  - 의도된 시퀀싱: **스킬 트리(click/auto/crit/time 트랙)는 아직 살아 있음.** Phase 0 캘리브레이션이 스킬 구매를 경제 싱크로 가정하므로, 트리 제거+오프라인 수익 전환(D3 완성)은 Phase 3(융합이 대체 성장 제공) 이후 Phase 4 리밸런스에서 수행. 장착 1슬롯 효과는 기존 엔티티 수치 그대로(레벨 배율은 Phase 3 가챠 중복 sink와 함께).
  - 밸런스 노트: 기존 세이브는 보유 엔티티 패시브가 사라져 산출 하락 — 흡수 설계 의도. Phase 4에서 장착/세트 보너스 스케일 재조정.
- Phase 1 결과 (SaveState v13→14 + 엔트로피 게이트 라이브 + 드랍/수집):
  - 데이터 모델: `inventory: EntityInstance[]`(entityId/count/level), `equippedSlots`, `unlockedSlotCount`, `almanacCollected` 추가. `purchasedEntities` 제거(마이그레이션 변환). 튜너블은 전부 `balance.ts`(ENTROPY_THRESHOLDS 16개, ENTROPY_W_CLICK/W_AUTO, DROP_* 6종).
  - 게이트 전환(D1): `canCondense = entropy >= stage.entropyThreshold` 단일 조건. 16스테이지 엔딩 게이트도 동일. 엔트로피 가중: 클릭 0.5 / auto 0.25 (sim과 모델 일치). HUD: 시간 게이지 → 엔트로피 게이트 바(보라 #bb8cff), 우주시간은 흐릿한 readout으로 강등.
  - 마이그레이션 지뢰 처리: 구 세이브 entropy를 [이전 게이트 floor, 게이트 50% 지점]으로 클램프 — 스테이지 스킵/역행 둘 다 방지. peakEntropy는 새 스케일로 리베이스. 클라우드: pullRemoteSave가 validateV5 통과 + **미래 스키마(remote.schemaVersion > 14) 감지 시 hydrate/push 차단** (구 클라이언트가 신 세이브 clobber 방지). SAVE_SCHEMA_VERSION=14 단일화 (useCloudSync의 stale 12 수정).
  - 드랍/수집: 클릭 4%(크리 ×3), 충돌 35% 확률로 현재 스테이지 엔티티 드랍 → inventory + almanacCollected. 크리/콤보100+는 레어 이상 가중 ×2. 등급 부재 시 하위 등급 폴백. 랜덤은 액션 주입(dropRoll/dropPickRoll)으로 리듀서 순수성 유지. 구매도 도감 기록. 프레스티지 시 도감 보존(D2).
  - 검증: `npx tsc --noEmit` 클린, vitest 665/665 통과(신규: drops 9건, v13→14 마이그레이션 3건), `npm run build` 통과.
  - Phase 2 이월: 드랍 아이템도 현재는 구매품과 동일하게 즉시 효과 적용(임시) — Phase 2에서 장착 슬롯으로 효과 이전. 드랍 토스트/도감 격자 UI 미구현(이벤트에 droppedEntityId만 전달). getEntropyOnCondense(quanta 10%) 게이트 피드백은 Phase 4 캘리브레이션 대상.
- Phase 0 결과 (scripts/entropy-gate-sim.mjs — `node scripts/entropy-gate-sim.mjs`):
  - 엔트로피 게이트에서 CPS 0.5→20 = 총 플레이타임 97.5% 단축 (현행 라이브 게임: BALANCE_ANALYSIS 기준 1.5%). **"행동→진행" 회로 작동 확인.**
  - 융합 버스트가 active 플레이어 엔트로피의 29~43% 기여 — 융합이 진행에 직결됨.
  - entropyThreshold 16개 캘리브레이션 완료 (reference 프로필 cps3/af0.5/fusion90s 이 realPlayTargetSec에 정확히 안착, 누적 1.06e2 → 4.50e19).
  - 미해결(Phase 4로 이월): casual/hardcore 스프레드 122×로 과도 — 압축 레버 = wClick:wAuto 비율, fusionValueSec, 후반 업그레이드 코스트 월. idle 프로필 stage 13 진행 불가(현행도 stage 14 stuck — 회귀 아님) — 오프라인 엔트로피 floor 필요.
  - balance-simulator.html 게이트 모드 통합 완료 (2026-06-10): gateMode 셀렉터 + 엔트로피 파라미터 5종 + stage별 entropyThreshold 컬럼 + simulateStageEntropy. current 모드는 HEAD 대비 무회귀 검증(동일 출력 11000.5h). 엔트로피 모드 모델 패리티 .mjs와 일치(reference 100.0h, hardcore 3.6h).
- Decided:
  - D1 진행 게이트: (a) 순수 엔트로피 — stage 진입 = `entropy >= stage.entropyThreshold` 단일 조건. quanta threshold는 게이트에서 제거, cosmicTime은 연출 readout으로 강등.
  - D2 아이템 carry: 도감(almanacCollected) 영구 보존 + 프레스티지 시 최고 티어 아이템 중 **1개를 플레이어가 직접 선택**해 carry. 나머지 인벤토리/장착 리셋.
  - D3 스킬 트리: 4트랙 전부 흡수. click/auto/crit → 장착/세트 보너스로 이전, time → 오프라인 수익으로 전환. 스킬 트리 UI 제거.
  - D4 가챠: 천장(pity) 포함 — 연속 실패 N회 후 상위 등급 보장. 중복은 레벨업 sink.
  - D5 UI 범위: 기존 EntityPanel/AlmanacOverlay 점진 개조. 신규 화면 전면 빌드 없음.
