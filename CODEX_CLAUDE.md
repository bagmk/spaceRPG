# Codex / Claude — Agent Instructions

> 이 파일을 먼저 읽어라. 코드 수정 전에 반드시 확인.

---

## 프로젝트 한 줄 요약

Vite + React 18 + TypeScript 인크리멘탈 게임. 순수 `useReducer`, Canvas 2D, 외부 상태 라이브러리 없음.

---

## 필수 파일 (작업 전 먼저 읽기)

| 파일 | 언제 읽어야 하나 |
|------|----------------|
| `ARCHITECTURE.md` | 항상. 전체 파일 맵, 데이터 흐름, 공식 레퍼런스. |
| `src/game/types.ts` | 타입 추가·수정 전 |
| `src/game/constants.ts` | 수치(매직넘버) 변경 전 |
| `src/game/reducer.ts` | 액션 추가 전 |
| `src/game/formulas.ts` | 게임 수식 변경 전 |

---

## 절대 하지 말 것

- `src/index.css` 에 컴포넌트별 스타일을 끝에 append하지 마라 — 항상 해당 섹션을 찾아서 수정
- `useReducer` 를 Zustand/Redux 로 교체하지 마라
- Canvas에 WebGL/Three.js 도입하지 마라
- `GameState` 에 파생값(Modifiers 등)을 직접 저장하지 마라 — `getActiveModifiers()` 는 항상 렌더링 시 계산
- 세이브 필드 추가 시 버전 bump 없이 추가하지 마라

---

## 코드 관습

### 상태 변경
모든 게임 로직은 `gameReducer` 를 통해서만. 컴포넌트에서 직접 상태 변이 금지.

```ts
// 새 액션 추가 시:
// 1. GameAction union에 추가 (reducer.ts)
// 2. gameReducer switch에 case 추가
// 3. 슬라이스 핸들러는 src/game/reducers/ 에 (handleXxx 함수)
// 4. 컴포넌트에서 dispatch({ type: 'MY_ACTION', ... })
```

### 파일 구조 (리팩터링 완료 후 현재 상태)

```
src/game/
  types.ts              → 얇은 배럴. 세부 타입은 types/ 서브폴더
  types/canvas.ts       → Canvas 전용 타입 (Rogue, Star, Mote 등)
  types/events.ts       → UI 이벤트 타입 (FloatingClickEvent 등)
  defaults.ts           → createDefault*() 함수들 전부 여기
  reducer.ts            → GameAction union + 얇은 라우팅 switch
  reducers/gameplay.ts  → TICK, CLICK, BUY_* 핸들러
  reducers/stage.ts     → START_CONDENSE, ADVANCE_STAGE, PRESTIGE 등
  reducers/skills.ts    → BUY_TRACK_LEVEL, BUY_CROSS_NODE
  reducers/shop.ts      → BUY_SHOP_ITEM
  reducers/admin.ts     → ADMIN_* 핸들러
  reducers/meta.ts      → HYDRATE, DISMISS, SET_TUTORIAL_DONE 등
  reducers/helpers.ts   → 슬라이스 공통 유틸
  storage.ts            → 얇은 public API (saveGame, loadGame 등)
  storage/legacyTypes.ts → SaveStateV1~V6 인터페이스
  storage/guards.ts     → isFiniteNumber, isEndingId 등 타입 가드
  storage/normalize.ts  → normalizeSkillState, normalizeShopBoosts
  storage/migrate.ts    → migrateV1ToV2 ~ validateV5
```

### 숫자 포맷
- 게임 수치 표시: `formatGameNumber(n)` — `formulas.ts`
- 시간 표시: `formatCosmicTimeSigFigs(sec, sigFigs)` — `formulas.ts`
- 직접 `toFixed()` / `toLocaleString()` 쓰지 마라

### 새 세이브 필드 추가
1. `src/game/types.ts` 의 `SaveState` / `PersistentGameState` / `GameState` 에 필드 추가
2. `src/game/defaults.ts` 의 `createInitialGameState()` 에 기본값 추가
3. `src/game/storage/migrate.ts` 의 `migrateV4ToV5()` 에 기본값 추가
4. `src/game/storage/migrate.ts` 의 `validateV5()` 에 검증 추가
5. `src/game/reducer.ts` 의 `toPersistentState()` 에 추가
6. `SaveState.version` 을 8 로 bump (현재 7)

### 새 스테이지 메카닉 추가
1. `src/game/mechanics/my_mechanic.ts` 생성 — `MechanicSpec` export
2. `StageMechanicId` 유니온에 추가 (`types.ts`)
3. `mechanics/index.ts` 에 등록
4. `stages.ts` 에 스테이지 엔트리 추가

---

## 테스트

```bash
npm test              # 전체
npm test -- formulas  # 특정 파일만
```

테스트 파일은 `src/game/__tests__/` 에.
새 게임 로직 추가 시 테스트도 같이 추가할 것.

---

## 배포

`main` 브랜치 push → GitHub Actions (`deploy.yml`) → Vite 빌드 → GitHub Pages 자동 배포.

---

## Firebase / 인증 / 클라우드 동기화 작업

> 이 영역은 별도 플랜 문서가 있다. 이 섹션은 그 문서를 어떻게 따라가는지만 정의한다.

### 작업 시작 시
1. **반드시** `FIREBASE_INTEGRATION_PLAN.md` 를 처음부터 끝까지 읽는다.
2. 그 문서의 `## Status` 섹션에서 `Current Phase` 를 확인한다.
3. 해당 Phase의 `### DECISION POINT` 항목을 `AskUserQuestion` 으로 사용자에게 묻는다. **답을 받기 전엔 코드 한 줄도 쓰지 않는다.**
4. 사용자가 답한 결정은 `## Status` 의 `Decided:` 라인에 누적 기록하고 그 변경을 커밋한다.

### Phase 진행 중
- `### 구현 단계` 의 번호를 그대로 따른다. 임의로 순서 바꾸지 마라.
- `### 절대 하지 말 것` 의 항목은 글자 그대로 지킨다.
- 시크릿 값(`firebaseConfig`, Stripe key, Apple `.p8` 키 등)을 받으면 즉시 `.env.local` 에 쓰고 `.gitignore` 에 `.env*.local` 패턴이 있는지 확인한다. 없으면 추가.
- 시크릿이 실수로 커밋된 흔적이 보이면 (`git log -p` / `git status`) **즉시 작업을 멈추고** 사용자에게 알린다.

### Phase 끝낼 때
1. `### CHECKPOINT` 의 체크박스를 하나씩 사용자와 함께 검증한다.
2. 전부 통과하면 `## Status` 의 `Last Checkpoint Passed` 를 업데이트.
3. **다음 Phase를 사용자 컨펌 없이 시작하지 마라.** "Phase N 완료, 다음 Phase로 진행할까요?" 라고 명시적으로 묻는다.

### 기존 코드 재사용 원칙
- 세이브/마이그레이션은 `src/game/storage.ts` + `src/game/storage/migrate.ts` 의 기존 시스템을 **확장**할 뿐, 새로 만들지 마라.
- `SaveState` 타입은 그대로 Firestore 문서 body에 dump 한다. 새 필드 추가는 기존 절차(이 파일 위의 "새 세이브 필드 추가") 그대로.
- React 상태 관리는 변함없이 `useReducer` + Context. Firebase 데이터를 Zustand/Redux로 옮기지 마라.
