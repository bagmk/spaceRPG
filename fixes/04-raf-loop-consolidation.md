# Fix 04 (P0) — rAF 루프 중복 통합

## 컨텍스트

`useGameLoop` 훅이 현재 두 컴포넌트에서 각각 호출된다:
- `src/components/GameScreen.tsx:365` — TICK dispatch용.
- `src/components/ParticleField.tsx:1145` — 캔버스 물리/렌더용.

각자 독립된 `requestAnimationFrame` 스케줄러를 돌리고, 둘 다 모바일 24fps target(`useGameLoop.ts:15`)을 사용하지만 phase가 어긋나면 매 16ms마다 두 번 깨어나는 경우 발생. 결과적으로 effective fps가 ~48까지 올라가 배터리/CPU 비효율.

## 작업

### 1) `src/components/ParticleField.tsx` — `forwardRef` + `useImperativeHandle`로 변환

상단 import 수정:

```ts
import { forwardRef, memo, useEffect, useImperativeHandle, useRef } from 'react';
```

`useGameLoop` import 제거.

컴포넌트 정의 변경:

```ts
export interface ParticleFieldHandle {
  tick: (now: number, dt: number) => void;
}

const ParticleFieldInner = forwardRef<ParticleFieldHandle, ParticleFieldProps>(function ParticleFieldInner(props, ref) {
  // ... existing body ...

  // Always-current props snapshot to avoid stale closures in tickFrame.
  const propsRef = useRef(props);
  propsRef.current = props;

  const tickFrame = (now: number, dt: number) => {
    const p = propsRef.current;
    // ... entire body of the old useGameLoop callback,
    // using `p.stage`, `p.quanta`, `p.interactionLocked`, etc.
  };

  useImperativeHandle(ref, () => ({ tick: tickFrame }), []);

  return (
    <div className="game-canvas-hitbox" /* ...handlers... */>
      <canvas ref={canvasRef} className="game-canvas" /* ... */ />
    </div>
  );
});

export const ParticleField = memo(ParticleFieldInner);
```

**중요**: 기존 `useGameLoop((now, dt) => {...})` 콜백 본문 안에서 props를 직접 참조하던 부분(`stage`, `quanta`, `interactionLocked`, `lastClickEvent` 등)을 모두 `p.stage`, `p.quanta` 식으로 바꿔야 stale closure 방지.

### 2) `src/components/GameScreen.tsx` — master 루프에서 ParticleField 호출

상단:

```ts
import { ParticleField, type ParticleFieldHandle } from './ParticleField';
```

본문:

```ts
const particleFieldRef = useRef<ParticleFieldHandle>(null);
```

기존 `useGameLoop((now, dt) => { ... TICK 디스패치 ... })`를 다음으로 교체:

```ts
useGameLoop((now, dt) => {
  // 1. Accumulate logic ticks.
  logicAccumulator.current += dt;
  while (logicAccumulator.current >= TUNING.LOGIC_TICK_MS) {
    dispatch({ type: 'TICK', now: Date.now(), dt: TUNING.LOGIC_TICK_MS });
    logicAccumulator.current -= TUNING.LOGIC_TICK_MS;
  }

  // 2. Sound triggers (unchanged).
  if (
    timeFlowRate > 1e10 &&
    now - lastWhooshAt.current >= TUNING.TIME_ACCELERATION_WHOOSH_INTERVAL_MS
  ) {
    lastWhooshAt.current = now;
    soundManager?.playTimeAccelerationWhoosh(Math.min(1, Math.log10(timeFlowRate) / 20));
  }

  // 3. Drive ParticleField render in the SAME frame.
  particleFieldRef.current?.tick(now, dt);
});
```

`<ParticleField ... />` JSX에 `ref={particleFieldRef}` 추가.

### 3) 검증 도구 (선택, dev only)

`ParticleField.tsx` 내부 dev-only 디버그 인터벌(라인 ~1040)에 fps 측정 추가:

```ts
const frameTimestamps = useRef<number[]>([]);

// In tickFrame:
frameTimestamps.current.push(now);
if (frameTimestamps.current.length > 60) frameTimestamps.current.shift();

// In existing dev useEffect:
if (import.meta.env.DEV) {
  const ts = frameTimestamps.current;
  const fps = ts.length >= 2 ? (ts.length - 1) * 1000 / (ts[ts.length - 1] - ts[0]) : 0;
  console.debug('[perf]', { fps: fps.toFixed(1), /* ... existing fields ... */ });
}
```

## 검증

1. `npm run build` — TypeScript 통과.
2. 게임 실행 → DevTools Performance 탭 → 5초 녹화 → Animation Frame Fired가 프레임당 1개만 보이는지 확인.
3. `[perf]` 로그에서 fps가 모바일 ~24, 데스크탑 ~30 근처 안정.
4. 클릭/콜리전/스테이지 전환이 시각적으로 모두 정상 동작.

## 영향 범위

- 시각/게임플레이 동작 변화 0이어야 함 (순수 구조 리팩토링).
- CPU/배터리 부하 감소.
- 다른 fix들이 ParticleField에 추가 코드를 넣을 때 단일 진입점이 생겨 충돌 감소.

## 주의

- `memo` 비교는 props 얕은 비교라 ref는 영향 없음.
- `useEffect`로 stage 변경 시 `worldRef` 리셋하는 로직(라인 ~1024)은 그대로 유지.
- 이 작업 이후에 Fix 02 (audio unlock) 적용 시 onPointerDown 위치 동일하므로 작업 가능.
