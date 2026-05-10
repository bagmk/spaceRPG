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
