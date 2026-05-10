# Architecture Reference

> Read this before touching any file. Purpose: let Claude/Codex navigate the codebase in one read without scanning all files.

---

## Tech Stack

- **Vite** + **React 18** + **TypeScript** (strict)
- **Vitest** for unit tests
- Pure `useReducer` for all game state — no Zustand, no Redux
- Canvas 2D API for particle rendering (no WebGL, no Three.js)
- No CSS modules — all styles in `src/index.css` (2 799 lines)

---

## Top-Level Layout

```
src/
  main.tsx             Vite entry — mounts <App />
  App.tsx              Root router: IntroScreen → GameScreen → FinalScreen
  index.css            ALL styles (global + per-component). No CSS modules.

  canvas/              Pure TS draw functions — no React, no state
  components/          React UI — reads state, dispatches actions
    endings/           5 ending cinematic screens
    skills/            Skill tree panel
  game/                Pure game engine — no React, no DOM
    __tests__/         Vitest tests
    mechanics/         One file per stage mechanic (16 total)
    skills/            Skill tree data + modifier computation
    shop/              Shop item definitions
  hooks/               React hooks that bridge engine ↔ UI
```

---

## File Map (with line counts)

### `src/game/` — pure engine, no React

| File | Lines | What it does |
|------|-------|--------------|
| `types.ts` | ~30 | 얇은 배럴. `export type * from './types/canvas'` + `export type * from './types/events'` + 핵심 게임 타입(`SaveState`, `PersistentGameState`, `GameState`, `CanvasWorld` 등). |
| `types/canvas.ts` | ~120 | Canvas 전용 타입: `Rogue`, `Star`, `Mote`, `Flyer`, `Burst`, `Shockwave` 등. |
| `types/events.ts` | ~30 | UI 이벤트 타입: `FloatingClickEvent`, `FloatingCollisionEvent`, `EncounterEvent`. |
| `defaults.ts` | ~80 | 모든 `createDefault*()` 함수 + `createInitialGameState()`. 단일 소스. |
| `constants.ts` | ~60 | `TUNING` object — 모든 매직넘버 (crit cap, combo mult, cost growth 등). |
| `formulas.ts` | 350 | 모든 게임 수식 + 숫자/시간 포맷터. 사이드 이펙트 없음. |
| `reducer.ts` | ~170 | `GameAction` union + `toPersistentState()` + 얇은 라우팅 switch. 로직은 `reducers/`에. |
| `stages.ts` | 506 | `STAGES` 배열 — 16 스테이지 정의 (임계값, 우주시간, 색상, 배경). |
| `storage.ts` | ~120 | Public API: `saveGame()`, `loadGame()`, `clearSave()` 등. 로직은 `storage/`에. |
| `multiverse.ts` | 290 | 엔딩 판정 로직, 우주 씨드 생성, `UniverseAtlasEntry` 빌더. |
| `timeFlow.ts` | ~60 | `getStageStartCosmicTime()` — 스테이지 진행 시 우주 시계 초기화 헬퍼. |
| `particles.ts` | ~80 | `PARTICLE_DEFINITIONS` — 파티클 타입 + 엔트로피 보너스. |
| `encounters.ts` | ~60 | Rogue 조우 이름/색상 테이블. |
| `audio.ts` | ~120 | `SoundManager` 클래스 — Web Audio API 래퍼. |
| `almanac.ts` | ~200 | `AlmanacId` 키의 백과사전 텍스트. |
| `stageLogs.ts` | ~80 | 스테이지 전환 로그 텍스트. |
| `scaleIndicator.ts` | ~40 | `ScaleIndicator` 컴포넌트용 스케일 레이블 데이터. |

#### `game/reducers/` — 슬라이스 핸들러

`reducer.ts` 의 switch가 각 핸들러로 라우팅. 타입: `Extract<GameAction, { type: 'TICK' }>` 패턴.

| File | Handlers |
|------|----------|
| `helpers.ts` | `getCurrentStage`, `getAdjustedClickPower`, `createClickEvent`, `buildAtlasEntry` 등 공통 유틸 |
| `gameplay.ts` | `TICK`, `CLICK`, `BUY_CLICK`, `BUY_AUTO`, `BUY_CRIT`, `REPORT_COLLISION`, `REPORT_ENCOUNTER` |
| `stage.ts` | `START_CONDENSE`, `ADVANCE_STAGE`, `SELECT_ENDING`, `COMPLETE_ENDING`, `PRESTIGE` |
| `skills.ts` | `BUY_TRACK_LEVEL`, `BUY_CROSS_NODE` |
| `shop.ts` | `BUY_SHOP_ITEM` |
| `admin.ts` | `ADMIN_NEXT_STAGE`, `ADMIN_PREV_STAGE`, `ADMIN_SET_PROGRESS`, `ADMIN_RESTART_RUN`, `BUY_SINGULARITY_UNLOCK` |
| `meta.ts` | `HYDRATE`, `DISMISS_OFFLINE_MODAL`, `SET_TUTORIAL_DONE`, `AWARD_SKILL_POINTS`, `UNLOCK_TRACK`, `MARK_TUTORIAL_*`, `CLEAR_*_EVENT` |

#### `game/storage/` — 세이브 서브모듈

| File | What it does |
|------|--------------|
| `legacyTypes.ts` | `SaveStateV1`~`V6` 인터페이스 |
| `guards.ts` | `isFiniteNumber`, `isEndingId`, `isSkillState` 등 런타임 타입 가드 |
| `normalize.ts` | `normalizeSkillState()`, `normalizeShopBoosts()` |
| `migrate.ts` | `migrateV1ToV2` ~ `migrateV4ToV5` + `validateV5()` |

#### `game/mechanics/` — stage mechanic plug-ins

Each mechanic is one file exporting a `MechanicSpec` object:
```ts
interface MechanicSpec {
  onTick(state, dt, mods): Partial<GameState>
  onStageEnter?(state): Partial<GameState>
  // ...
}
```
`index.ts` registers all 16 mechanics in a `Record<StageMechanicId, MechanicSpec>`.
**To add a new mechanic:** create `game/mechanics/my_mechanic.ts`, add to `StageMechanicId` in `types.ts`, register in `index.ts`.

| File | Mechanic |
|------|----------|
| `click_basic.ts` | Stage 1 — pure click |
| `matter_asymmetry.ts` | Stage 2 |
| `fusion_window.ts` | Stage 3 |
| `recombination.ts` | Stage 4 |
| `dark_age.ts` | Stage 5 |
| `first_stars.ts` | Stage 6 |
| `reionization.ts` | Stage 7 |
| `galaxy_weaving.ts` | Stage 8 |
| `planet_formation.ts` | Stage 9 |
| `life_evolution.ts` | Stage 10 |
| `civilization.ts` | Stage 11 |
| `red_giant.ts` | Stage 12 |
| `remnant_cooling.ts` | Stage 13 |
| `proton_decay.ts` | Stage 14 |
| `hawking_radiation.ts` | Stage 15 |
| `ending_choice.ts` | Stage 16 — triggers ending selection |

#### `game/skills/`

| File | What it does |
|------|--------------|
| `types.ts` | `SkillState`, `SkillTreeId`, `SkillTier` (5\|10\|15\|20\|25\|30) |
| `definitions.ts` | `SKILL_TREES` (4 trees), `CROSS_NODES` (24 nodes), cost curves (`trackLevelCost`), SP reward table |
| `effects.ts` | `getActiveModifiers(skills, ctx) → Modifiers` — computes all multipliers from skill state |

Level caps: click/auto/crit max **50**, time max **40**. Milestone slots at every 5 levels (5–30).

---

### `src/canvas/` — pure draw functions

All functions are `(ctx, world, state, ...) → void`. No React, no refs inside.

| File | Draws |
|------|-------|
| `drawCluster.ts` | Mote cluster (central body) |
| `drawCore.ts` | Core orb glow |
| `drawEffects.ts` | Shockwaves, burst particles |
| `drawParticles.ts` | Ambient background particles |
| `drawRogues.ts` | Rogue particles (bonus objects) |
| `drawStars.ts` | Star field background |
| `drawWake.ts` | Wake trails behind flyers |
| `stageSprites.ts` | Sprite shape definitions |

---

### `src/components/` — React UI

| File | Lines | Responsibility |
|------|-------|----------------|
| `GameScreen.tsx` | 768 | Main game HUD. Click handler, tutorial speech bubbles, upgrade buttons layout, stat popup, transition state machine. |
| `ParticleField.tsx` | 1 515 | Canvas world. Holds `CanvasWorld` in a ref. Runs physics (mote gravity, rogue movement, flyer arcs) on each rAF frame. Calls all `canvas/draw*.ts` functions. Dispatches `REPORT_COLLISION`. |
| `ResourcePanel.tsx` | ~120 | Click / Auto / Crit upgrade buttons. |
| `SkillsPanel.tsx` | 496 | Skill tree UI. `TrackColumn` per tree, cross-node slots, tutorial walkthrough (now rendered as overlay sibling, not inside drawer). |
| `ShopPanel.tsx` | ~200 | IAP shop. Quanta boosts + SP packs. |
| `FloatingNumber.tsx` | ~80 | Animated click/collision numbers. |
| `SpeechBubble.tsx` | ~120 | Tutorial speech bubbles with smart arrow positioning. `arrowTop` for left/right, `arrowLeft` for top/bottom. |
| `ActiveBoostHud.tsx` | ~60 | Active shop boost timers in HUD. |
| `ScaleIndicator.tsx` | ~60 | Scale label (e.g. "1 fm", "1 AU"). |
| `StatsRow.tsx` | ~40 | Stats display row. |
| `Timeline.tsx` | ~80 | Cosmic timeline at bottom. |
| `EndingChooser.tsx` | ~150 | Ending selection UI at Stage 16. |
| `AlmanacOverlay.tsx` | ~100 | Encyclopedia overlay. |
| `SingularityTree.tsx` | ~150 | Singularity unlock tree. |
| `MultiverseAtlas.tsx` | ~100 | Universe history viewer. |
| `OfflineProgressModal.tsx` | ~60 | Offline gains modal. |
| `QuoteOverlay.tsx` | ~40 | Stage transition quote. |
| `StageLogToast.tsx` | ~40 | Stage transition log. |
| `EncounterAlert.tsx` | ~40 | Rogue encounter toast. |
| `BigBangCinematic.tsx` | ~80 | Big Bang cinematic screen. |
| `IntroScreen.tsx` | ~60 | Pre-game splash. |
| `FinalScreen.tsx` | ~60 | Post-run screen. |
| `endings/*.tsx` | ~80 ea | BigCrunch, BigRip, Bounce, HeatDeath, VacuumDecay. |

---

### `src/hooks/`

| File | Lines | What it does |
|------|-------|--------------|
| `useGameState.ts` | 158 | `useReducer(gameReducer)` wrapper. Loads save on mount, auto-saves on change, computes `modifiers` via `getActiveModifiers`. Exposes `{ state, dispatch, modifiers }`. |
| `useGameLoop.ts` | 39 | `requestAnimationFrame` loop. Dispatches `{ type: 'TICK', now, dt }` every frame. |

---

## Data Flow

```
useGameState
  useReducer(gameReducer, initialState)
  └── on change: storage.saveGame()
  └── exposes: { state, dispatch, modifiers }

App.tsx
  └── <GameScreen state dispatch modifiers />

GameScreen
  ├── useGameLoop → dispatch TICK every frame
  ├── onClick → dispatch CLICK
  ├── <ParticleField>  → dispatch REPORT_COLLISION (rogue hit)
  ├── <ResourcePanel>  → dispatch BUY_CLICK / BUY_AUTO / BUY_CRIT
  ├── <SkillsPanel>    → dispatch BUY_TRACK_LEVEL / BUY_CROSS_NODE
  └── <ShopPanel>      → dispatch BUY_SHOP_ITEM

gameReducer(state, action)
  ├── TICK → formulas + mechanics[stage.mechanic].onTick()
  ├── CLICK → click power, crit, combo, quanta gain
  ├── ADVANCE_STAGE → stage transition, SP award, skill track unlock
  ├── BUY_TRACK_LEVEL / BUY_CROSS_NODE → skills state update
  ├── BUY_SHOP_ITEM → shopBoosts[], SP award
  └── ... (30 action types total)
```

---

## Key Formulas (quick reference)

All in `formulas.ts`:

| Function | Returns |
|----------|---------|
| `getClickPower(mods)` | Click quanta per click |
| `getAutoRate(mods)` | Auto quanta/s |
| `getCritChance(critLevel, combo, mods)` | 0–1 crit probability |
| `getCritMultiplier(critLevel, mods)` | Crit damage multiplier |
| `getComboMult(combo, capBonus)` | Combo multiplier |
| `getCosmicTimeFillRate(aeonLevel, mods, boost)` | Cosmic seconds/real-second |
| `canCondense(state)` | Whether stage advance is available |
| `getEntropyOnCondense(quanta, threshold)` | Entropy gain on condense |
| `formatGameNumber(n)` | 6 sig-fig display (e.g. `1.23456e17`) |
| `formatGameNumberShort(n)` | 2 sig-fig display for thresholds |
| `formatCosmicTimeSigFigs(sec, sigFigs)` | `18.0000Gyr` format |

Modifiers flow: `getActiveModifiers(state.skills, ctx) → Modifiers` — always recomputed, never stored in `GameState`.

---

## Save System

- `SaveState` interface in `types.ts` — has explicit `version: 7`
- `storage.ts` exports `saveGame(state)` and `loadGame() → PersistentGameState | null`
- Migration chain: `migrate(raw)` runs `v1→v2`, `v2→v3`, … `v6→v7` sequentially
- **When adding a new save field:** bump version, add migration step at the end of the chain, update `SaveState` interface

---

## Scalability Issues (current pain points)

### Critical

1. **`ParticleField.tsx` (~1 500 lines)** — physics simulation + canvas rendering + React lifecycle all in one file. `CanvasWorld` ref state is untestable. Fix: extract `CanvasWorld` physics to `canvas/world.ts` as pure functions; `ParticleField.tsx` becomes a thin rAF runner.

2. **`index.css` (~2 800 lines)** — all styles in one file. No locality. Fix: create `.module.css` files per component directory going forward. Keep `index.css` for global resets and CSS variables only.

### Moderate

3. **`GameScreen.tsx` (~768 lines)** — manages transition state machine, tutorial bubbles, stat popups, and HUD layout simultaneously. Fix: extract `useTransitionPhase` and `useTutorialBubble` hooks.

4. **`stages.ts` (506 lines)** — 16 stage blobs with computed fields mixed in. Fix: `stages/data.ts` for raw definitions + `stages/builder.ts` to fill computed fields.

### Completed ✅

- ~~`reducer.ts` (1 118 lines)~~ → `reducer.ts` (~170 lines) + `reducers/` 6 슬라이스 파일
- ~~`storage.ts` (735 lines)~~ → `storage.ts` (~120 lines) + `storage/` 4 서브모듈
- ~~`types.ts` (441 lines)~~ → `types.ts` (배럴) + `types/canvas.ts` + `types/events.ts`

---

## Adding New Content (quick guides)

### New stage mechanic
1. Create `src/game/mechanics/my_mechanic.ts` exporting `myMechanic: MechanicSpec`
2. Add `'my_mechanic'` to `StageMechanicId` in `types.ts`
3. Register in `mechanics/index.ts`
4. Add a stage entry in `stages.ts` with `mechanic: 'my_mechanic'`

### New skill cross-node tier
1. Add tier value to `CROSS_TIERS` in `definitions.ts`
2. Add to `SkillTier` union in `skills/types.ts`
3. Add cost to `CROSS_SP_COST`, label to `CROSS_MULT_LABELS`
4. Add mult to `CROSS_NODE_MULTS` in `effects.ts`
5. Add `MilestoneLevel` to `SkillsPanel.tsx` and `MILESTONES` array

### New shop item
1. Add entry to `shop/items.ts` `SHOP_ITEMS` array
2. Handle the `itemId` in the `BUY_SHOP_ITEM` case in `reducer.ts`

### New save field
1. `types.ts` 의 `SaveState` / `PersistentGameState` / `GameState` 에 필드 추가
2. `defaults.ts` 의 `createInitialGameState()` 에 기본값 추가
3. `storage/migrate.ts` 의 `migrateV4ToV5()` + `validateV5()` 에 추가
4. `reducer.ts` 의 `toPersistentState()` 에 추가
5. `SaveState.version` 을 8 로 bump (현재 7)

### New game action
1. `reducer.ts` 의 `GameAction` union에 추가
2. `gameReducer` switch에 case 추가 — 해당 슬라이스 파일의 핸들러로 라우팅
3. `reducers/` 에 핸들러 함수 구현 (`handleXxx(state, action): GameState`)
4. 컴포넌트에서 `dispatch({ type: 'MY_ACTION', ... })`

---

## Test Coverage

All tests in `src/game/__tests__/`. Run with `npm test`.

| File | Tests |
|------|-------|
| `formulas.test.ts` | Number formatters, game math |
| `reducer.test.ts` | State transitions for key actions |
| `skills.test.ts` | Skill cost curves, modifier computation |
| `stages.test.ts` | Stage threshold/timing validation |
| `migration.test.ts` | Save migration chain v1→v7 |
| `almanac.test.ts` | Almanac entry completeness |
| `mechanics/__tests__/mechanics.test.ts` | Per-mechanic onTick behavior |
