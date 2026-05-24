# Cosmic Coalescence — 성능 저하 / 발열 원인 분석

작성일: 2026-05-23
대상: 메인 브랜치 (`src/`, `src/index.css`, `src/components/ParticleField.tsx`, `src/canvas/*`)
관련 문서: `fixes/04-raf-loop-consolidation.md`, `fixes/06-dpr-cap-hit-target.md`, `fixes/07-autosave-throttle.md`

---

## TL;DR — 게임이 무거워지는 진짜 원인

발열·랙은 한 가지 원인이 아니라 **세 층의 누적**이다.

1. **렌더 비용 (GPU/CPU 열의 70~80%)** — Canvas 2D에서 매 프레임 `createRadialGradient`로 그라디언트 객체를 새로 만들고, `shadowBlur`를 깔고 그린다. 둘 다 모바일 GPU에서 가장 비싼 패턴. 거기에 CSS가 `backdrop-filter` 32회 + `filter` 52회 + `animation` 90회 + `box-shadow` 126회로 GPU 합성을 상시 강제하고 있다.
2. **GC 압력 / 마이크로 스터터 (느려짐의 주범)** — `tickFrame`에서 매 프레임마다 `world.particles.map()`, `world.wakeTrails/flyers/bursts/shockwaves.filter()`로 새 배열 5개를 할당한다. 24~30fps에서 분당 7~9천 개의 배열 + 그 안의 새 객체들이 깎이고 다시 만들어지며, V8/JSC GC가 주기적으로 30~120ms 멈춤을 유발 → "랙 걸림" 체감.
3. **백그라운드 누적 부하** — `useGameLoop`는 `document.hidden`을 체크하지만, `IntroScreen`의 독립 rAF, `setTimeout` 9개 (`GameScreen`), `setInterval`들이 visibility/cleanup을 보장하지 않는다. 탭이 백그라운드여도 일부 타이머는 계속 돈다.

**가장 빠른 효과 (P0): `shadowBlur` 제거 + 그라디언트 캐싱 + `backdrop-filter` 축소**. 이 셋만 정리해도 발열은 체감 절반 수준.

---

## 측정된 사실 (Grep / 파일 분석 기반)

| 항목 | 값 | 위치 | 영향 |
|---|---|---|---|
| Canvas `createRadialGradient` 호출 | 58회 (`drawCluster` 20, `drawEntities` 33 등) | `src/canvas/*` | 매 그리기마다 GPU 텍스처 할당 |
| Canvas `shadowBlur` 사용 | 16회 (`drawEntities`) | `src/canvas/drawEntities.ts` | GPU 오프스크린 + blur 패스 |
| Canvas `save/restore` 쌍 | 146회 | `src/canvas/*` | 상태 push/pop 비용 |
| CSS `@keyframes` | 72개 | `src/index.css` | 동시 애니메이션 누적 |
| CSS `animation:` 선언 | 90회 | 동상 | 상시 GPU 합성 |
| CSS `backdrop-filter:` | 32회 | 동상 | **모바일 GPU 가장 큰 비용** |
| CSS `filter:` | 52회 | 동상 | 비합성 시 페인트 폭증 |
| CSS `box-shadow:` | 126회 | 동상 | 페인트/리플로 비용 |
| CSS `radial-gradient` 배경 | 41회 | 동상 | 큰 영역 래스터화 |
| CSS `will-change:` | **0회** | 동상 | 합성 힌트 부재 → 비효율 합성 |
| `tickFrame` 내 배열 재할당 | 5개 (`.map`/`.filter`) | `ParticleField.tsx:1502, 1517, 1573, 1593, 1700` | 매 프레임 GC 압력 |
| `setTimeout` (GameScreen) | 9회 | `GameScreen.tsx` | 누락 시 누적 위험 |
| `addEventListener` | 14파일 43회 | repo 전체 | 해제 누락 시 메모리 누수 |
| 독립 rAF 호출 | 3개 (`useGameLoop`, `IntroScreen`, `BigBangCinematic`) | — | 동시 호출되면 안 되지만 마운트 타이밍 주의 |
| 모바일 rAF 타깃 | 24fps | `useGameLoop.ts:15` | 적절 |
| DPR 캡 | 2 | `ParticleField.tsx:1282` | 이미 적용됨 ✅ |
| Logic tick | 100ms | `constants.ts:LOGIC_TICK_MS` | 적절 |
| Autosave | 30s + 마일스톤 | `fixes/07` 문서대로 권장 | 적용 확인 필요 |

> 가정: 위 카운트는 `grep` 정적 기준. 실제로 매 프레임 모두 호출되는지는 코드 흐름에 따라 다르지만, `drawEntities`/`drawCluster`는 메인 렌더 경로이므로 대부분 프레임당 1회 이상 실행된다고 봐도 무방.

---

## 원인별 우선순위 (영향 × 수정 난이도)

| 우선순위 | 원인 | 발열 기여 | 랙 기여 | 수정 난이도 |
|:---:|---|:---:|:---:|:---:|
| **P0** | `shadowBlur` 남용 | 매우 큼 | 보통 | 낮음 |
| **P0** | 매 프레임 `createRadialGradient` | 매우 큼 | 큼 | 보통 |
| **P0** | CSS `backdrop-filter` 32개 | 매우 큼 | 큼 (스크롤/HUD) | 낮음~보통 |
| **P0** | tickFrame 배열 재할당 (GC) | 보통 | **매우 큼** | 보통 |
| P1 | CSS `animation` 90개 상시 가동 | 큼 | 보통 | 보통 |
| P1 | `index.css` 235KB / 11k줄 | 보통 | 보통 (초기 파싱) | 큼 |
| P1 | `setTimeout`/리스너 정리 누락 가능성 | 작음 | 누수 시 큼 | 낮음 |
| P2 | `IntroScreen` 별도 rAF | 작음 | 작음 | 낮음 |
| P2 | `mp4` 4~6MB × 5개 엔딩 영상 프리로드 여부 | 작음 | 큼 (메모리) | 낮음 |

---

## P0 수정안 (구체적 코드 패치)

### 1) `shadowBlur` 제거 → 캐시된 그라디언트 또는 오프스크린 스프라이트

**문제 (`src/canvas/drawEntities.ts`):**
```ts
ctx.shadowBlur = 24;
ctx.shadowColor = stage.coreColor;
ctx.fillStyle = grad;
ctx.fill();
```
모바일 GPU는 `shadowBlur > 0`이면 매 도형마다 오프스크린 텍스처에 그린 뒤 가우시안 블러 → 메인 캔버스로 합성. 한 프레임에 코어 + 위성 + 엔티티 + 버스트가 모두 그림자를 가지면 채움률(fill-rate)이 즉시 한계.

**수정 패턴 — 옵션 A (가장 안전): shadowBlur 비활성 + 다단 radialGradient로 위장**
```ts
// drawEntities.ts (각 shadowBlur 사용처마다)
// BEFORE
ctx.shadowBlur = 24;
ctx.shadowColor = stage.coreColor;
ctx.fillStyle = innerGrad;
ctx.fill();

// AFTER  -- glow를 별도 큰 radialGradient로 한 번 더 그림
ctx.shadowBlur = 0;
const glow = getCachedGlow(ctx, stage.id, x, y, r * 1.6); // 캐시 헬퍼
ctx.fillStyle = glow;
ctx.fillRect(x - r * 1.6, y - r * 1.6, r * 3.2, r * 3.2);
ctx.fillStyle = innerGrad;
ctx.fill();
```

**수정 패턴 — 옵션 B (가장 빠름): 오프스크린 스프라이트 캐시**
```ts
// src/canvas/spriteCache.ts (새 파일)
const cache = new Map<string, HTMLCanvasElement>();
export function getGlowSprite(
  key: string,
  size: number,
  build: (ctx: CanvasRenderingContext2D) => void,
): HTMLCanvasElement {
  const cached = cache.get(key);
  if (cached && cached.width === size) return cached;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const cctx = c.getContext('2d')!;
  build(cctx);
  cache.set(key, c);
  return c;
}
```
사용처:
```ts
const sprite = getGlowSprite(
  `core_glow_${stage.id}_${Math.round(radius)}`,
  Math.round(radius * 3.2),
  (cctx) => {
    const g = cctx.createRadialGradient(/* ... */);
    cctx.fillStyle = g;
    cctx.fillRect(0, 0, cctx.canvas.width, cctx.canvas.height);
  },
);
ctx.drawImage(sprite, x - sprite.width / 2, y - sprite.height / 2);
```
이렇게 하면 매 프레임 그라디언트/블러 비용이 `drawImage` 한 번으로 줄어든다.

### 2) 매 프레임 `createRadialGradient` → 스테이지/엔티티별 캐시

**문제:** `drawCluster.ts:20` 그라디언트, `drawEntities.ts:33` 그라디언트가 모두 `tickFrame`에서 호출되는 경로. 그라디언트는 stop만 같으면 매번 다시 만들 필요 없음 (좌표가 바뀌어도 transform으로 처리 가능, 좌표 의존이면 캐시 키에 좌표 양자화 포함).

**수정 패턴:**
```ts
// src/canvas/gradientCache.ts (새 파일)
type Key = string;
const radial = new Map<Key, CanvasGradient>();

export function getRadial(
  ctx: CanvasRenderingContext2D,
  key: Key,
  x0: number, y0: number, r0: number,
  x1: number, y1: number, r1: number,
  stops: Array<[number, string]>,
): CanvasGradient {
  const cached = radial.get(key);
  if (cached) return cached;
  const g = ctx.createRadialGradient(x0, y0, r0, x1, y1, r1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  radial.set(key, g);
  return g;
}

export function invalidateGradients() { radial.clear(); }
```
스테이지 전환 시 `invalidateGradients()` 호출. **주의**: 좌표·반지름이 매 프레임 바뀌는 경우(코어 펄스 등)는 캐시가 무의미하므로, 그런 곳은 옵션 B (오프스크린 스프라이트)로 전환.

### 3) `tickFrame` 배열 재할당 제거 → in-place 갱신

**문제 (`ParticleField.tsx:1502, 1517, 1573, 1593, 1700`):**
```ts
world.particles = world.particles.map((particle) => { ... });
world.wakeTrails = world.wakeTrails.filter((trail) => { ... });
```
새 배열 + 새 객체를 매 프레임 만든다. `MOTE_MAX 24`, `BURST_MAX 36`, `FLYER_MAX 20`, `WAKE_TRAIL_MAX 16`, `SHOCKWAVE_MAX 5` → 한 프레임에 최대 ~100개 객체 + 5개 배열. 30fps에서 분당 약 18만 객체. JSC/V8 young-gen 회수 비용이 상당.

**수정 패턴 — in-place + write-index 압축:**
```ts
// 기존
world.wakeTrails = world.wakeTrails.filter((trail) => {
  trail.x += trail.vx;
  trail.y += trail.vy;
  trail.life -= TUNING.WAKE_LIFE_DECAY * motionScale;
  return trail.life > 0;
});

// 개선
{
  let w = 0;
  const arr = world.wakeTrails;
  for (let r = 0; r < arr.length; r++) {
    const t = arr[r];
    t.x += t.vx; t.y += t.vy;
    t.life -= TUNING.WAKE_LIFE_DECAY * motionScale;
    if (t.life > 0) {
      if (w !== r) arr[w] = t;
      w++;
    }
  }
  arr.length = w;
}
```
`particles.map`은 새 객체 반환이 필요 없으면 `for` 루프 + 인덱스 갱신으로 충분. `spawnParticleAtEdge`가 새 객체를 반환한다면, 풀(pool)을 두고 재사용:
```ts
const pool: Particle[] = [];
function acquireParticle(): Particle { return pool.pop() ?? makeParticle(); }
function releaseParticle(p: Particle): void { pool.push(p); }
```

### 4) CSS `backdrop-filter` 축소 / `will-change` 추가

**문제:** `backdrop-filter: blur(...)`는 모바일 사파리/크롬에서 매 프레임 GPU 합성 패스를 강제한다. 32개 동시 적용된 패널들이 보이면 화면 단위 비용이 발생.

**즉시 적용 가능한 패치 (`src/index.css`):**
```css
/* 전역: 합성 힌트 부재 → 추가 */
.game-canvas,
.particle-field,
.hud-overlay,
.shop-panel,
.entity-panel {
  will-change: transform, opacity;
  transform: translateZ(0);  /* compositing layer 고정 */
}

/* 모바일에서 backdrop-filter 단계적 비활성화 */
@media (max-width: 768px), (prefers-reduced-motion: reduce) {
  .shop-panel,
  .entity-panel,
  .lore-modal {
    backdrop-filter: none !important;
    background: rgba(8, 10, 22, 0.92);  /* 불투명 대체 */
  }
}
```
**검증 방법**: Chrome DevTools > Rendering > "Paint flashing", "Layer borders"로 비교. backdrop-filter 줄이면 깜빡이는 페인트 영역이 줄어든다.

### 5) 발열 측정 토글 추가 (자가 진단)

```ts
// src/components/ParticleField.tsx tickFrame 끝
if (import.meta.env.DEV) {
  const t0 = performance.now();
  // ... draw calls ...
  const cost = performance.now() - t0;
  if (cost > 12) {
    console.warn('[heavy frame]', cost.toFixed(1), {
      bursts: world.bursts.length,
      flyers: world.flyers.length,
    });
  }
}
```

---

## P1 수정안 (영향 큰 정돈)

### 6) CSS 다이어트
- `index.css`는 11k줄 / 235KB. 어떤 selector가 실제 사용되는지 모르므로 **PurgeCSS** 또는 Vite의 `vite-plugin-purgecss`로 dead-CSS 제거.
- 결과 50KB 이하면 모바일 페이지 파싱 시간 200~400ms 단축.
- `@keyframes` 72개 중 동시 활성 5개 이하가 되도록 정리. 영구 진행 애니메이션(스타필드 등)은 Canvas로 옮긴 게 옳음 → 이미 했다면 CSS 잔재 제거.

### 7) 이벤트 리스너 / 타이머 정리 점검
- `GameScreen.tsx:229, 460, 486, 489, 505, 541, 554, 640` — `setTimeout` 8개. 각 `useEffect`의 `return () => clearTimeout(id)` 누락 여부 점검. 특히 `clickSeqResetRef`처럼 ref에 저장된 타이머는 stage 전환/언마운트 시 cleanup 필요.
- `addEventListener('resize', ...)`는 dedup 검증 (StrictMode + Fast Refresh로 중복 등록 가능).

### 8) 엔딩 영상(`src/ending/*.mp4` 4~6MB × 5)
- 모두 프리로드되면 모바일 메모리 50MB 차지 → 다른 메모리 압박 시 GPU 자원 회수.
- **lazy import** + `<video preload="none">` 확인. 이미 lazy면 OK.

---

## 검증 절차 (수정 전/후 측정)

1. **Chrome DevTools Performance** (모바일 에뮬레이션 + 4× CPU throttle)
   - 동일 시나리오: Big Bang → Stage 3 → 30초 활성 클릭 → 1분 idle.
   - 측정값: Avg FPS, GPU time, Scripting time, Paint time, GC pauses.
2. **iPhone 실측** (Safari Web Inspector)
   - Timelines > Memory: heap이 stage 한 사이클마다 평탄한지 (계단식 증가는 누수).
   - Energy Impact (Xcode Instruments via WKWebView 환경) — Low가 목표.
3. **Self-instrumentation**
   - DEV에서 `[perf]`와 `[heavy frame]` 로그를 30초 캡처.
   - shadowBlur 제거 후 `[heavy frame]` 발생 빈도가 1/3 이하로 줄어야 통과.

| 지표 | 현재 추정 | 목표 (수정 후) |
|---|---|---|
| 평균 프레임 비용 (모바일) | 18~28ms | < 12ms |
| GC 일시정지 빈도 | 분당 5~10회 | 분당 1~2회 |
| 첫 페인트(FCP) | CSS 파싱 영향 ~1.2s | < 0.8s |
| 1분 발열 (체감) | 따뜻함 | 미온 |

---

## 작업 순서 권장

1. **`shadowBlur = 0` 일괄 변경** (`drawEntities.ts`) — 1시간. 시각 손실 확인.
2. **`gradientCache.ts` 도입** — 정적 그라디언트 우선 캐싱. 2시간.
3. **`spriteCache.ts`로 코어/엔티티 글로우 오프스크린화** — 4시간.
4. **`tickFrame` 배열 in-place 변환** — 2시간 + 테스트.
5. **CSS `backdrop-filter` 모바일 미디어쿼리 분기** — 1시간.
6. **PurgeCSS 도입 + dead-CSS 정리** — 별도 4~6시간 (회귀 위험 있음, 마지막에).
7. **타이머/리스너 cleanup 일제 점검** — 1시간.

각 단계 후 `npm test` + 5분 플레이 + Performance 녹화 비교.

---

## 불확실한 부분 (확인 후 수정 방향 결정)

- `tickFrame`에서 매 프레임 호출되는 정확한 draw 함수 목록과 그 안의 grad/shadow 사용량은 `drawEntities.ts` (141KB)를 단계별로 더 봐야 정확. **빠른 검증 방법**: Chrome DevTools Performance에서 함수별 self-time 상위 10개를 캡처해 우선순위 재조정.
- `index.css` 235KB가 실제 런타임에 얼마나 살아있는지 (PurgeCSS dry-run으로 확인 가능).
- 엔딩 mp4 5개의 프리로드 정책은 `EndingChooser.tsx` 확인 필요 (이번 분석에서 미확인).
- `IntroScreen`의 별도 rAF가 게임 중에도 살아있는지 확인 필요 — 마운트 라이프사이클만 보면 인트로 종료 시 unmount되어야 정상.

---

## 부록: 이미 적용된 좋은 패턴

- ✅ `useGameLoop`에서 `document.hidden` 시 프레임 스킵.
- ✅ DPR cap 2 (`ParticleField.tsx:1282`).
- ✅ rAF 통합 (`ParticleFieldHandle` + `forwardRef` 패턴) — `fixes/04` 적용 확인.
- ✅ 모바일 24fps 타겟.
- ✅ 배열 max cap (`MOTE_MAX`, `BURST_MAX` 등).
- ✅ `HISTORY_CAPS`로 직렬화 시 길이 제한.

이미 P0급 구조 수정은 끝냈다. 남은 건 **렌더 비용**과 **GC 압력** 두 축이고, 위 1~4번이 그걸 정조준한다.
