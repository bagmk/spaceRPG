# Fix 06 (P1) — DPR cap + Apple HIG 44pt hit-target

## 컨텍스트

### DPR 문제

`src/components/ParticleField.tsx:1007`의 `resize`:

```ts
const dpr = window.devicePixelRatio || 1;
canvas.width = bounds.width * dpr;
canvas.height = bounds.height * dpr;
```

iPhone 14 Pro Max(DPR 3) + 큰 화면에서 canvas backing store가 1290 * 3 = 3870px. 60fps 유지 어렵고 메모리 부담.

### Hit-target 문제

Apple HIG는 터치 타겟 최소 44pt 권장. `src/index.css`에서 44px 미만 발견:
- 라인 3125 (`min-height: 40px`)
- 라인 5932 (`min-width: 42px`)
- 라인 7225, 9035, 9253 (`min-height: 42px`)

## 작업

### 1) `src/components/ParticleField.tsx` — DPR 캡

라인 1007 부근 `resize` 함수:

```ts
const resize = () => {
  const bounds = canvas.getBoundingClientRect();
  // Cap DPR to 2: high-DPR phones (DPR 3) gain no visible quality for 2.25x
  // GPU/memory cost in a 2D canvas particle game.
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = bounds.width * dpr;
  canvas.height = bounds.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  sizeRef.current = { width: bounds.width, height: bounds.height };
  if (!worldRef.current) {
    worldRef.current = createWorld(bounds.width, bounds.height, stage);
  } else {
    worldRef.current.stars = createStars(bounds.width, bounds.height);
  }
};
```

### 2) `src/index.css` — hit-target 일괄 조정

| 라인 | 변경 전 | 변경 후 |
|------|---------|---------|
| 3125 | `min-height: 40px` | `min-height: 44px` |
| 5932 | `min-width: 42px` | `min-width: 44px` |
| 7225 | `min-height: 42px` | `min-height: 44px` |
| 9035 | `min-height: 42px` | `min-height: 44px` |
| 9253 | `min-height: 42px` | `min-height: 44px` |

각 라인 컨텍스트 확인 후 padding과 함께 조정해 layout 깨짐 방지.

### 3) `src/index.css` — `touch-action: manipulation` 전역 적용

iOS 300ms 더블탭 줌 지연 + 의도치 않은 확대 방지. 파일 상단(button 리셋 인근)에 추가:

```css
button,
[role="button"],
.mini-button,
.q-continue {
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
```

### 4) canvas 영역 `touch-action: none` 확인

`.game-canvas-hitbox` 셀렉터에 다음 속성 모두 적용:

```css
.game-canvas-hitbox {
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}
```

빠진 게 있으면 추가.

## 검증

### DPR
1. Chrome DevTools iPhone 14 Pro Max (DPR 3).
2. 콘솔: `document.querySelector('canvas').width / document.querySelector('canvas').getBoundingClientRect().width` → 2.0.
3. Performance 탭 5초 → frame budget 16ms 이내.

### Hit-target
1. Lighthouse 모바일 audit → Tap targets 100점.
2. iPhone 시뮬레이터로 모서리 작은 버튼들 누르기 → 정상 인식.

## 영향 범위

- DPR 3 기기: 시각 품질 손실 거의 없음 + 프레임 안정성 향상.
- 작은 버튼: 약간 커지지만 spacing 영향 미미.

## 주의

- DPR 캡 변경 후 `getBoundingClientRect`와 `canvas.width / dpr` 비율 검증.
- Apple HIG "44 points"는 CSS 44px와 동일 효과.
