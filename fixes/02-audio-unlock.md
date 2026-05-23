# Fix 02 (P0) — 첫 게임 내 터치에서 AudioContext unlock 보장

## 컨텍스트

iOS Safari/WKWebView는 사용자 제스처 안에서만 `AudioContext.resume()`이 호출돼야 사운드가 재생된다. 현재 `src/App.tsx:162,166,176,211,232`의 인트로 경로 버튼에서만 `soundManager.unlock()`이 호출된다. 게임 내 첫 클릭 (`src/components/GameScreen.tsx:599 onGatherClick`, `src/components/ParticleField.tsx:1469 onPointerDown`) 에서는 호출되지 않으므로, **Resume 경로로 바로 진입한 유저는 끝까지 무음**이 될 수 있다. 또한 PWA가 백그라운드에서 한참 있다 돌아오면 AudioContext가 다시 `suspended` 상태가 될 수 있어 재unlock이 필요한 경우도 있다.

## 작업

### 1) `src/game/audio.ts` — `unlock()` idempotent + ensureRunning 추가

`unlock` 메서드 교체:

```ts
unlock(): void {
  const ctx = this.ensureContext();
  if (!ctx) return;
  if (this.unlocked && ctx.state === 'running') return;  // skip redundant calls
  this.unlocked = true;
  void ctx.resume();
  if (this.ambient) {
    const targetGain = this.bgmMuted ? 0 : dbToGain(TUNING.DRONE_VOLUME_DB);
    this.ambient.gain.gain.setValueAtTime(targetGain, ctx.currentTime);
  }
}

// Call this when visibility returns. Safe to call multiple times.
ensureRunning(): void {
  const ctx = this.context;
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();
}
```

### 2) `src/components/GameScreen.tsx` — 1회용 unlock 가드

`GameScreen` 컴포넌트 함수 본문 상단(다른 useRef들 옆)에 추가:

```ts
const audioUnlockedRef = useRef(false);
const ensureAudioUnlock = () => {
  if (!audioUnlockedRef.current) {
    soundManager?.unlock();
    audioUnlockedRef.current = true;
  }
};
```

다음 호출지점 모두에 `ensureAudioUnlock();`을 첫 줄로 넣기:

- `onGatherClick` 콜백 (라인 ~599) — 첫 줄.
- `dispatch({ type: 'BUY_CLICK' })` / `'BUY_AUTO'` / `'BUY_CRIT'`을 호출하는 onClick — 각 onClick 핸들러 첫 줄.
- `dispatch({ type: 'START_CONDENSE' })` (라인 ~758) — onClick 첫 줄.
- `dispatch({ type: 'PURCHASE_ENTITY' })` 트리거 onClick — 동일.
- Shop 열기 onClick (라인 ~797).
- Entity 패널 열기 onClick (라인 ~810).
- Settings 열기 onClick (라인 ~820).

핵심: `grep -n "dispatch(" src/components/GameScreen.tsx` 로 모든 dispatch 호출 onClick을 찾아 첫 줄에 가드 추가.

### 3) `src/hooks/useGameState.ts` — visibility 복귀 시 신호 발사

기존 `handleVisibility` 핸들러 보강:

```ts
const handleVisibility = () => {
  if (document.visibilityState === 'hidden') {
    persist();
  } else if (document.visibilityState === 'visible') {
    // AudioContext may have been suspended by the OS while backgrounded.
    // GameScreen owns the SoundManager — emit a custom event to signal resume.
    window.dispatchEvent(new CustomEvent('cc-visibility-resumed'));
  }
};
```

### 4) `src/App.tsx` — visibility 이벤트 핸들러

`AppInner` 컴포넌트에 useEffect 추가:

```ts
useEffect(() => {
  const handler = () => soundManagerRef.current?.ensureRunning();
  window.addEventListener('cc-visibility-resumed', handler);
  return () => window.removeEventListener('cc-visibility-resumed', handler);
}, []);
```

## 검증

1. Chrome DevTools에서 `--autoplay-policy=user-gesture-required` 플래그로 실행 또는 모바일 사파리.
2. 세이브 클리어 → Resume 버튼 안 거치고 곧장 게임 진입 시뮬레이션 (`?stage=1` dev param 활용).
3. 첫 코어 클릭 시 클릭 SFX 재생 확인.
4. 게임 → 다른 탭 30초 → 복귀 → 클릭 시 사운드 정상 재생 확인.

## 영향 범위

- 정상 인트로 경로 유저: 변화 없음 (idempotent 가드).
- Resume/딥링크 유저: 사운드 정상화.
- 백그라운드 장시간 후 복귀 유저: 사운드 복구.

## 주의

Fix 04 (rAF 통합)에서 `ParticleField`를 forwardRef로 바꾸면 onPointerDown 핸들러 위치가 달라질 수 있음. Fix 04를 먼저 적용한 뒤 이 가드를 추가하는 것이 충돌이 적다.
