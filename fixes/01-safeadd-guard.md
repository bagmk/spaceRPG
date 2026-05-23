# Fix 01 (P0) — `safeAdd` 캡 + 세이브 검증에 수치 가드

## 컨텍스트

`src/game/formulas.ts:35-40`의 `safeAdd`는 현재 두 분기가 동일한 `a+b`를 반환해서 가드가 무의미하다. 후반 스테이지(threshold 4e21까지) + 부스트/엔티티/콤보/크리트 곱셈을 거치면 일부 경로에서 `Number.MAX_VALUE`를 넘어 `Infinity`가 발생할 수 있고, 그게 한 번 들어가면 `quanta`/`entropy`/`peakEntropy`/`condensedMass`까지 전염되어 세이브에 그대로 직렬화된다. `repairSave`는 `cosmicClockSec`만 복원하고 다른 수치 필드는 검증하지 않는다.

## 작업

### 1) `src/game/formulas.ts` — `safeAdd` 교체

```ts
// Cap to prevent Infinity propagation in long-running saves.
export const MAX_SAFE_QUANTA = 1e300;

export function safeAdd(a: number, b: number): number {
  const aFinite = Number.isFinite(a);
  const bFinite = Number.isFinite(b);
  if (!aFinite && !bFinite) return 0;
  if (!aFinite) return Math.min(MAX_SAFE_QUANTA, Math.max(0, b));
  if (!bFinite) return Math.min(MAX_SAFE_QUANTA, Math.max(0, a));
  const sum = a + b;
  if (!Number.isFinite(sum)) return MAX_SAFE_QUANTA;
  return Math.min(MAX_SAFE_QUANTA, sum);
}
```

### 2) `src/game/__tests__/formulas.test.ts` — 케이스 추가

```ts
describe('safeAdd', () => {
  it('adds finite numbers normally', () => {
    expect(safeAdd(1, 2)).toBe(3);
  });
  it('clamps Infinity to MAX_SAFE_QUANTA', () => {
    expect(safeAdd(Infinity, 1)).toBe(MAX_SAFE_QUANTA);
    expect(Number.isFinite(safeAdd(Infinity, 1))).toBe(true);
  });
  it('substitutes 0 when both inputs are non-finite', () => {
    expect(safeAdd(NaN, NaN)).toBe(0);
  });
  it('treats NaN as missing and returns the finite side', () => {
    expect(safeAdd(NaN, 5)).toBe(5);
  });
  it('caps sum that overflows to Infinity', () => {
    expect(safeAdd(1e300, 1e300)).toBe(MAX_SAFE_QUANTA);
  });
});
```

### 3) `src/game/storage/migrate.ts` — `validateV5`에 수치 검증

`validateV5` 함수 내부에 추가:

```ts
// Sanitize numeric fields that could carry Infinity/NaN from earlier bugs.
const NUMERIC_FIELDS: (keyof Pick<SaveState,
  'quanta' | 'entropy' | 'peakEntropy' | 'condensedMass' | 'echoes'>)[] =
  ['quanta', 'entropy', 'peakEntropy', 'condensedMass', 'echoes'];

for (const field of NUMERIC_FIELDS) {
  const value = (candidate as any)[field];
  if (!Number.isFinite(value) || value < 0) {
    (candidate as any)[field] = 0;
  }
}
```

### 4) `src/game/__tests__/migration.test.ts` — 손상 케이스

```ts
it('repairs saves with Infinity in quanta', () => {
  const corrupted = { ...validV13Save, quanta: Infinity, entropy: NaN };
  const repaired = validateV5(corrupted);
  expect(repaired?.quanta).toBe(0);
  expect(repaired?.entropy).toBe(0);
});
```

### 5) `src/game/storage.ts` — `repairSave` 보강

`repairSave` 함수 끝부분에서 동일한 5개 필드를 한 번 더 sanitize:

```ts
// Final numeric sanity pass for fields that legacy bugs may have corrupted.
for (const field of ['quanta', 'entropy', 'peakEntropy', 'condensedMass', 'echoes'] as const) {
  const v = (result as any)[field];
  if (!Number.isFinite(v) || v < 0) (result as any)[field] = 0;
}
```

## 검증

```bash
npm test -- formulas migration
npm run build
```

## 영향 범위

- 정상 플레이 유저에게 체감 효과 0.
- 후반 스테이지 도달한 유저 또는 손상된 세이브 보유 유저에게 진행도 복구 효과.
- 부작용 위험 낮음 — `safeAdd`는 `quanta`/`entropy` 누적에만 쓰이고 1e300은 사실상 도달 불가.
