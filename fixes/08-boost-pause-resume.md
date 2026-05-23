# Fix 08 (P1) — 백그라운드 진입 시 부스트 일시정지 (active-time 기반)

## 컨텍스트

`src/game/shop/boosts.ts`의 `pruneExpiredShopBoosts`는 wall-clock 기준 `expiresAt`만 체크. 유저가 30초짜리 부스트를 사고 다른 앱으로 갔다가 50초 후 돌아오면 부스트가 만료. 모바일 환경에서 "사기 부스트" 클레임 + 유료 IAP 환불 요청 가능성.

**설계 결정**: (B) 명시적 active-time 누적. 부스트는 게임이 foreground에 있는 동안만 소모.

## 작업

### 1) `src/game/types.ts` — `TimedShopBoost` 확장

```ts
export interface TimedShopBoost {
  // ... existing fields ...
  /** @deprecated use remainingMs + startedAt instead. Kept for v13 → v14 migration. */
  expiresAt: number;

  // v14+:
  /** Active-time remaining in milliseconds. Frozen while paused. */
  remainingMs: number;
  /** Wall-clock timestamp when the boost was last resumed. */
  startedAt: number;
  /** True when game is backgrounded — remainingMs not counted down. */
  paused: boolean;
}
```

### 2) `src/game/storage/migrate.ts` — V13 → V14 마이그레이션

```ts
export function migrateV13ToV14(save: Partial<SaveState>): Partial<SaveState> {
  const now = Date.now();
  const boosts = (save.shopBoosts ?? []).map((b: any) => {
    if (b.remainingMs !== undefined) return b;  // already migrated
    const remainingMs = Math.max(0, (b.expiresAt ?? now) - now);
    return {
      ...b,
      remainingMs,
      startedAt: now,
      paused: false,
    };
  });
  return { ...save, shopBoosts: boosts, version: 14 };
}
```

`src/game/storage.ts:loadGame`에 v13 처리 + v14 핸들러 추가. `createSaveSnapshot`의 `version` 13 → 14로 bump.

### 3) `src/game/shop/boosts.ts` — 핵심 로직

```ts
export function getActiveShopBoostMultiplier(
  boosts: ShopBoost[] | undefined,
  category: ShopBoostCategory,
  now: number,
): number {
  if (!boosts) return 1;
  let mult = 1;
  for (const b of boosts) {
    if (b.category !== category) continue;
    if (!isTimedBoost(b)) continue;
    if (b.paused) continue;
    const elapsed = now - b.startedAt;
    if (elapsed >= b.remainingMs) continue;
    mult *= b.factor;
  }
  return mult;
}

export function pruneExpiredShopBoosts(
  boosts: ShopBoost[],
  now: number,
): ShopBoost[] {
  return boosts.filter((b) => {
    if (!isTimedBoost(b)) return true;
    if (b.paused) return true;  // keep paused boosts indefinitely
    return now - b.startedAt < b.remainingMs;
  });
}

/** Freeze active boosts' active-time and mark them paused. Idempotent. */
export function pauseBoosts(boosts: ShopBoost[], now: number): ShopBoost[] {
  return boosts.map((b) => {
    if (!isTimedBoost(b) || b.paused) return b;
    const elapsed = now - b.startedAt;
    return {
      ...b,
      remainingMs: Math.max(0, b.remainingMs - elapsed),
      paused: true,
    };
  });
}

/** Restart active-time counter for paused boosts. Idempotent. */
export function resumeBoosts(boosts: ShopBoost[], now: number): ShopBoost[] {
  return boosts.map((b) => {
    if (!isTimedBoost(b) || !b.paused) return b;
    return {
      ...b,
      startedAt: now,
      paused: false,
    };
  });
}
```

`integrateBoostedSeconds`도 paused 부스트 제외하도록 수정.

### 4) `src/hooks/useGameState.ts` — visibility 핸들러 + 액션

권장 방식: 새 GameAction `PAUSE_BOOSTS` / `RESUME_BOOSTS` 추가.

`src/game/reducer.ts`:

```ts
export type GameAction =
  // ...
  | { type: 'PAUSE_BOOSTS'; now: number }
  | { type: 'RESUME_BOOSTS'; now: number };
```

`src/game/reducers/gameplay.ts`(또는 `shop.ts`):

```ts
export function handlePauseBoosts(state: GameState, action: { now: number }): GameState {
  return { ...state, shopBoosts: pauseBoosts(state.shopBoosts, action.now) };
}

export function handleResumeBoosts(state: GameState, action: { now: number }): GameState {
  return { ...state, shopBoosts: resumeBoosts(state.shopBoosts, action.now) };
}
```

`useGameState.ts`의 `handleVisibility`:

```ts
const handleVisibility = () => {
  if (document.visibilityState === 'hidden') {
    dispatch({ type: 'PAUSE_BOOSTS', now: Date.now() });
    persist();
  } else if (document.visibilityState === 'visible') {
    dispatch({ type: 'RESUME_BOOSTS', now: Date.now() });
    window.dispatchEvent(new CustomEvent('cc-visibility-resumed'));
  }
};
```

### 5) `src/components/ActiveBoostHud.tsx` — UI 표기

잔여시간 계산:
```ts
const remaining = b.paused ? b.remainingMs : Math.max(0, b.remainingMs - (now - b.startedAt));
```

paused일 때는 "PAUSED" 배지 + 잔여시간 그대로 표시.

i18n:
```ts
en: { boostActiveTime: 'Active time', boostPaused: 'Paused' },
ko: { boostActiveTime: '활성 시간', boostPaused: '일시정지' },
```

### 6) `src/game/__tests__/shop.test.ts` — 테스트

```ts
describe('boost pause/resume', () => {
  const now = 1_000_000;
  const baseBoost = {
    id: 'time_2x_30s',
    category: 'time' as const,
    factor: 2,
    startedAt: now,
    remainingMs: 30_000,
    paused: false,
    expiresAt: now + 30_000,
  };

  it('preserves remainingMs across pause/resume', () => {
    const boosts = [baseBoost];
    const paused = pauseBoosts(boosts, now + 10_000);
    expect(paused[0].remainingMs).toBe(20_000);
    expect(paused[0].paused).toBe(true);

    const resumed = resumeBoosts(paused, now + 60_000);
    expect(resumed[0].remainingMs).toBe(20_000);
    expect(resumed[0].paused).toBe(false);
    expect(resumed[0].startedAt).toBe(now + 60_000);
  });

  it('background 60s does not consume active-time', () => {
    let boosts = [baseBoost];
    boosts = pauseBoosts(boosts, now);
    boosts = resumeBoosts(boosts, now + 60_000);
    expect(getActiveShopBoostMultiplier(boosts, 'time', now + 60_000)).toBe(2);
    expect(getActiveShopBoostMultiplier(boosts, 'time', now + 90_001)).toBe(1);
  });
});
```

## 검증

1. `npm test -- shop migration`
2. 게임 부스트 구매 → 5초 후 다른 탭 → 1분 후 복귀 → 잔여시간 약 25초 + 카운트 재개.
3. 부스트 활성 중 브라우저 종료 → 재시작 → paused 상태로 잔여시간 보존.

## 영향 범위

- 부스트 보유 유저: 백그라운드 손실 방지.
- 미보유 유저: 변화 없음.
- 세이브: V13 → V14 자동 변환.

## 주의

- 무한 부스트는 영향 없음.
- 정책 (A) "백그라운드에도 흐름" 으로 결정 시 이 fix 전체 스킵 + UI에 "wall-clock based" 명시만 추가.
