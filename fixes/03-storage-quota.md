# Fix 03 (P0) — localStorage quota 핸들링 + 무한 누적 배열 캡

## 컨텍스트

`src/game/storage.ts:114-120`의 `saveGame()`은 `QuotaExceededError`를 silent catch한다.

```ts
export function saveGame(state: GameState): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEYS.save, JSON.stringify(createSaveSnapshot(state)));
  } catch {
    // Storage failures are non-fatal for play.
  }
}
```

다음 배열들이 trim 없이 누적된다:
- `universeAtlas` — prestige마다 entry push.
- `clickRateLog` — 클릭률 분석용 로그.
- `condenseProgressHistory` — 스테이지 클리어마다 push.

iOS WKWebView 기본 quota는 ~1MB. 장기 플레이어는 결국 도달 → silent fail → 진행도 손실.

## 작업

### 1) `src/game/constants.ts` — 캡 상수 추가

`TUNING` 객체 끝부분에 추가:

```ts
// Cap historical arrays in serialized save to prevent localStorage quota overflow.
// In-memory state can hold more — these caps only apply when writing to disk.
HISTORY_CAPS: {
  universeAtlas: 100,
  clickRateLog: 200,
  condenseProgressHistory: 200,
},
```

### 2) `src/game/reducer.ts` 및 `src/game/storage.ts` — `toPersistentState` / `createSaveSnapshot`에서 trim

양쪽 함수에서 해당 필드를 trim:

```ts
universeAtlas: state.universeAtlas.slice(-TUNING.HISTORY_CAPS.universeAtlas),
clickRateLog: state.clickRateLog.slice(-TUNING.HISTORY_CAPS.clickRateLog),
condenseProgressHistory: state.condenseProgressHistory.slice(-TUNING.HISTORY_CAPS.condenseProgressHistory),
```

### 3) `src/game/storage.ts` — `saveGame` 재시도 + 이벤트 발사

```ts
const SAVE_FAILED_EVENT = 'cc-save-failed';

function trySave(state: GameState, aggressive = false): boolean {
  try {
    const snapshot = createSaveSnapshot(state);
    if (aggressive) {
      // Halve historical arrays as last-ditch trim.
      snapshot.universeAtlas = snapshot.universeAtlas.slice(-Math.floor(TUNING.HISTORY_CAPS.universeAtlas / 2));
      snapshot.clickRateLog = snapshot.clickRateLog.slice(-Math.floor(TUNING.HISTORY_CAPS.clickRateLog / 2));
      snapshot.condenseProgressHistory = snapshot.condenseProgressHistory.slice(-Math.floor(TUNING.HISTORY_CAPS.condenseProgressHistory / 2));
    }
    localStorage.setItem(STORAGE_KEYS.save, JSON.stringify(snapshot));
    return true;
  } catch (err) {
    return false;
  }
}

export function saveGame(state: GameState): void {
  if (!isBrowser()) return;
  if (trySave(state, false)) return;
  // First attempt failed — likely quota. Retry with aggressive trim.
  if (trySave(state, true)) {
    console.warn('[storage] Save succeeded after aggressive history trim.');
    return;
  }
  // Both failed — notify UI.
  console.error('[storage] Save failed twice; possible quota exhaustion.');
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SAVE_FAILED_EVENT));
  }
}
```

### 4) `src/i18n.ts` — 메시지 추가

```ts
en: { saveFailedQuota: 'Save failed: storage is full. Consider clearing old data in Settings.' },
ko: { saveFailedQuota: '저장 실패: 저장 공간이 부족합니다. 설정에서 오래된 데이터 정리를 권장합니다.' },
```

### 5) `src/components/GameScreen.tsx` — 토스트 표시

```ts
const [saveErrorVisible, setSaveErrorVisible] = useState(false);
useEffect(() => {
  const handler = () => {
    setSaveErrorVisible(true);
    setTimeout(() => setSaveErrorVisible(false), 5000);
  };
  window.addEventListener('cc-save-failed', handler);
  return () => window.removeEventListener('cc-save-failed', handler);
}, []);
```

JSX:

```tsx
{saveErrorVisible ? (
  <div className="save-error-toast" role="alert">
    {t(language, 'saveFailedQuota')}
  </div>
) : null}
```

`src/index.css`에 `.save-error-toast` 스타일 추가.

### 6) `src/game/__tests__/storage.test.ts` — 신규 파일

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { saveGame } from '../storage';
import { createInitialGameState } from '../defaults';

describe('saveGame quota handling', () => {
  let setItemMock: any;
  let originalSetItem: any;

  beforeEach(() => {
    originalSetItem = Storage.prototype.setItem;
    setItemMock = vi.fn();
    Storage.prototype.setItem = setItemMock;
  });

  afterEach(() => {
    Storage.prototype.setItem = originalSetItem;
  });

  it('retries with trimmed history on QuotaExceededError', () => {
    let attempts = 0;
    setItemMock.mockImplementation(() => {
      attempts += 1;
      if (attempts === 1) {
        const err = new Error('Quota exceeded');
        err.name = 'QuotaExceededError';
        throw err;
      }
    });
    const state = createInitialGameState(Date.now());
    saveGame(state);
    expect(attempts).toBe(2);
  });

  it('dispatches cc-save-failed event when both attempts fail', () => {
    setItemMock.mockImplementation(() => {
      throw new Error('Quota exceeded');
    });
    const eventSpy = vi.fn();
    window.addEventListener('cc-save-failed', eventSpy);
    const state = createInitialGameState(Date.now());
    saveGame(state);
    expect(eventSpy).toHaveBeenCalled();
    window.removeEventListener('cc-save-failed', eventSpy);
  });
});
```

## 검증

```bash
npm test -- storage
```

수동 검증: DevTools Application → Storage → localStorage에 더미 큰 키 채워 quota 줄인 뒤 게임 실행 → trim 후 정상 저장 + toast 노출 확인.

## 영향 범위

- 정상 유저: in-memory에 전체 history 유지 (멀티버스 아틀라스 UI 그대로).
- 디스크 quota 도달 유저: trim 후 저장 성공, 가장 오래된 50개 entry만 손실.
- 양쪽 trim 후에도 실패한 극한 케이스: toast로 명시적 안내.
