# Fix 09 (P2) — 첫 클릭 명확화 (코어 idle pulse + CTA 강화)

## 컨텍스트

신규 유저가 처음 게임을 켰을 때 코어가 정적이라 "어디를 눌러야 하는가"가 불명확. `src/components/GameScreen.tsx:273-362`의 튜토리얼 버블 체인은 첫 클릭 후에 트리거되는 것이 많아 첫 클릭 전 시각 신호 부족. Cookie Clicker, Universal Paperclips 등 대부분의 인크리멘탈 게임이 첫 클릭 가능 요소를 시각적으로 강조하는 것과 대조적.

## 작업

### 1) `src/canvas/drawCore.ts` — idle pulse 파라미터

함수 시그니처에 `idlePulse: boolean` 추가:

```ts
interface DrawCoreOptions {
  ctx: CanvasRenderingContext2D;
  stage: Stage;
  width: number;
  height: number;
  progress: number;
  showThresholdRing: boolean;
  now: number;
  idlePulse: boolean;  // NEW
}

export function drawCore(opts: DrawCoreOptions): void {
  // ... existing rendering ...

  // Idle pulse ring: shown only before first click to invite interaction.
  if (opts.idlePulse) {
    const cx = opts.width / 2;
    const cy = opts.height / 2;
    const baseRadius = TUNING.CORE_BASE_RADIUS + opts.progress * TUNING.CORE_PROGRESS_RADIUS;
    const pulseScale = Math.sin(opts.now * 0.005) * 0.15 + 1.25;
    const ringRadius = baseRadius * pulseScale;
    const alpha = (Math.sin(opts.now * 0.005) * 0.5 + 0.5) * 0.5 + 0.2;
    opts.ctx.save();
    opts.ctx.strokeStyle = opts.stage.accent;
    opts.ctx.globalAlpha = alpha;
    opts.ctx.lineWidth = 2;
    opts.ctx.beginPath();
    opts.ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
    opts.ctx.stroke();
    opts.ctx.restore();
  }
}
```

### 2) `src/components/ParticleField.tsx` — prop 전달

`drawCore` 호출 지점(라인 ~1403):

```ts
drawCore({
  ctx,
  stage,
  width,
  height,
  progress,
  showThresholdRing: quanta >= effectiveThreshold && !interactionLocked,
  now,
  idlePulse: totalClicks === 0,  // NEW
});
```

(`totalClicks`는 이미 props에 있음.)

### 3) `src/components/GameScreen.tsx` — 튜토리얼 CTA 강화

라인 ~277의 첫 튜토리얼 버블 수정:

```ts
if (stage.id === 1 && state.totalClicks === 0 && !state.tutorialFlags['matter-time-intro']) {
  return {
    flagId: 'matter-time-intro',
    anchor: 'field',          // CHANGED: was 'resource'
    message: t(language, 'tutFirstClick'),
    autoCloseMs: 0,           // CHANGED: no auto-close until first click
  };
}
```

### 4) `src/i18n.ts` — 메시지 추가/변경

```ts
en: {
  tutFirstClick: 'Tap the glowing core to begin shaping a universe.',
  tutMatterTimeIntro: 'Each tap adds matter; cosmic time fills automatically. Fill both to advance.',
},
ko: {
  tutFirstClick: '빛나는 코어를 탭해서 우주를 빚어보세요.',
  tutMatterTimeIntro: '탭은 물질을, 시간은 자동으로 채워집니다. 둘 다 채우면 다음 단계로.',
},
```

체인: 첫 클릭 전 `tutFirstClick` (필드 중앙) → 첫 클릭 후 `tutMatterTimeIntro` (resource 패널). `state.totalClicks > 0` 가드로 자동 전환.

### 5) (옵션, 별도 PR) Stage 1 Auto 비용 인하

현재 `getAutoCost(stage1, 0) = ceil(2000 * 0.012) = 24 quanta`. clickPower=1 기준 24클릭 필요.

별도 PR로 분리:

```ts
export function getAutoCost(stage: Stage, level: number): number {
  const baseFrac = stage.id === 1 ? 0.006 : 0.012;
  return Math.ceil(stage.threshold * baseFrac * Math.pow(TUNING.COST_GROWTH, level));
}
```

Stage 1 Auto 첫 구매 비용 12 quanta로 인하 → 12클릭 후 idle 모드 전환 가능. 첫 인상 RSI 부담 절반.

### 6) `src/index.css` — cursor 강조

`.game-canvas-hitbox` 셀렉터:

```css
.game-canvas-hitbox {
  cursor: pointer;
}
```

(이미 있으면 스킵.)

## 검증

1. localStorage 클리어 → 게임 진입 → Stage 1.
2. 코어 주변 펄스 ring (1.2초 주기) 표시.
3. 튜토리얼 버블이 필드 중앙 + "Tap the glowing core...".
4. 첫 클릭 시 펄스 ring 사라지고 두 번째 버블로 전환.
5. (옵션 5 적용 시) Auto 첫 구매 12 quanta 표시.

## 영향 범위

- 기존 유저: `totalClicks > 0`이므로 펄스 안 보임. 변화 없음.
- 신규 유저: 첫 클릭까지 시간 단축 (정성적).
- 옵션 5: Stage 1 한정. 후반 밸런스 무영향.

## 주의

- `idlePulse`는 `totalClicks === 0` 조건. prestige 후에도 `totalClicks === 0`이면 다시 보임 — 의도된 동작.
- 펄스가 너무 강하면 distraction. 사용자 피드백으로 `alpha`/`pulseScale` 조정.
- 이 fix는 onboarding UX 영역이라 user 피드백에 따라 보류 가능.
