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

- Current Phase: **Phase 2 — 완료 (2026-06-10). CHECKPOINT 사용자 검토 대기, 통과 시 Phase 3 진입**
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
