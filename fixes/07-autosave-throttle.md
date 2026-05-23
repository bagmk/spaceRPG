# Fix 07 (P1) — 자동저장 throttle (useEffect 의존배열 정리)

## 컨텍스트

`src/hooks/useGameState.ts:193-211`의 useEffect 의존배열:

```ts
useEffect(() => {
  saveGame(state);
}, [
  state.stageIdx,
  state.quanta,        // ← 매 TICK(100ms)마다 변동
  state.timeGauge,     // ← 매 TICK(100ms)마다 변동
  state.pendingCondenseStageIdx,
  state.completedRun,
  // ...
]);
```

**매 100ms마다 `localStorage.setItem` 호출**. 모바일 IO 부하 + 배터리 소모. `setInterval(..., AUTOSAVE_INTERVAL_MS)` 30000ms도 별도로 돌고 있어 중복.

## 작업

### 1) `src/hooks/useGameState.ts` — 의존배열에서 빈번 변동 필드 제거

```ts
useEffect(() => {
  saveGame(state);
}, [
  // Milestone events only — these change rarely and warrant immediate flush.
  state.stageIdx,
  state.pendingCondenseStageIdx,
  state.completedRun,
  state.universeCount,
  state.cumulativeBoost,
  state.condensedMass,
  state.echoes,
  state.skillPoints,
  state.shopBoosts,
  state.hasOfflineStorageUpgrade,
  state.hasSeenCashShopTutorial,
  state.totalShopSpentUSD,
  state.purchasedEntities,
  state.endingsCompleted,
  state.lastEndingId,
  state.selectedEndingId,
  state.singularityUnlocks,
  state.prestigeUpgrades,
  // Intentionally NOT in deps (high-frequency, handled by 30s interval below):
  // state.quanta, state.timeGauge, state.entropy, state.totalClicks,
  // state.collisions, state.cosmicClockSec, state.combo, state.mechanicCharge, state.lastClick
]);
```

### 2) `src/game/constants.ts` — AUTOSAVE_INTERVAL_MS

현재 30000. **그대로 유지**. visibility/beforeunload flush가 있으므로 일반 사용 손실 위험 낮음.

### 3) `src/hooks/useGameState.ts` — flush API 노출 (선택)

```ts
const flushSave = useCallback(() => {
  if (stateRef.current) saveGame(stateRef.current);
}, []);
```

리턴 객체에 `flushSave` 추가. prestige/엔딩 완료 시점에 명시적 호출 가능 (기본 마일스톤 트리거로 충분하면 스킵 가능).

### 4) 디버그 측정 (dev only)

`src/game/storage.ts:saveGame` 진입부에:

```ts
if (import.meta.env.DEV) {
  (window as any).__saveCount = ((window as any).__saveCount ?? 0) + 1;
}
```

수정 전/후 1분 플레이 후 `window.__saveCount` 비교 — 600(매 100ms) → 30(매 30초 + 마일스톤) 수준이면 정상.

## 검증

1. `npm test` 통과.
2. DevTools Application → Storage → `cosmic_coalescence_save_v7` 키 Last modified가 30초 간격.
3. 게임 → 스테이지 전환 → 즉시 새로고침 → 새 스테이지 유지 (마일스톤 트리거).
4. 게임 → 다른 탭 → 즉시 새로고침 → 최근 quanta 보존 (visibilitychange flush).

## 영향 범위

- 일반 유저: 체감 효과 0.
- 모바일: 배터리 소모 감소.
- 손실 윈도우: 최대 30초 (visibility/beforeunload flush로 실질 0초).

## 주의

- 강제 종료 시 최대 30초치 quanta 손실 가능 — 인크리멘탈 게임 표준 (Cookie Clicker 60초).
- React StrictMode에서 useEffect 두 번 실행되어 dev saveCount 2배 표시 — 무시.
