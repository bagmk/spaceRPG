# Cosmic Coalescence — 성능 수정 실행 플랜

스코프: **P0 + P1 + PurgeCSS 전부**
시각 정책: **체감 동일 수준 허용** (픽셀 단위 동일은 안 함)
진행 방식: **단계별 커밋 + 매 단계 검증**
총 예상 시간: **22~24시간** (8개 phase)

---

## 진행 원칙

1. **측정 먼저, 수정 나중에.** Phase 0에서 baseline을 잡고, 각 phase 후 동일 시나리오로 재측정.
2. **회귀 위험이 낮은 것부터.** 인프라(캐시 lib) → 적용 → CSS → PurgeCSS 순.
3. **각 phase = 1 커밋 + 1 검증.** 검증 실패 시 rollback 가능하도록 작은 단위로 끊는다.
4. **시각 회귀는 스크린샷 비교**로 판단. 픽셀 일치가 아니라 "5초간 보고 차이를 못 느끼는가".

---

## 검증 시나리오 (모든 phase 공통)

매 phase 종료 후 동일 5분 플레이 + Performance 녹화:

| 단계 | 내용 | 측정 |
|---|---|---|
| 1 | Big Bang 인트로 (시작) | 첫 페인트, 인트로 전환 매끄러움 |
| 2 | Stage 1~3 활성 클릭 30s | Avg FPS, GPU time |
| 3 | 1분 idle (auto tick) | GC pauses 횟수 |
| 4 | Stage 전환 (prestige 1회) | 메모리 회수 (heap snapshot 비교) |
| 5 | 모바일 에뮬레이션 (Pixel 5 + 4× CPU) | 전체 평균 ms/frame |

기록 위치: `fixes/perf_log/<phase>_<date>.json` (DevTools Profile export).

목표 임계값:

| 지표 | Baseline 예상 | Phase 4 후 | Phase 8 후 |
|---|---|---|---|
| 평균 프레임 비용 (모바일) | 18~28ms | < 15ms | < 12ms |
| GC pause 분당 | 5~10 | < 3 | < 2 |
| `[heavy frame]` (>12ms) | 분당 30+ | < 10 | < 5 |
| 초기 CSS 파싱 | ~250ms | ~250ms | < 100ms |

---

## Phase 0 — 측정 인프라 & Baseline (45min)

**목표:** 비교 기준점 확보. 이후 모든 phase의 효과를 정량 측정 가능하게.

### 작업

1. `src/components/ParticleField.tsx` `tickFrame` 끝에 DEV 전용 측정:
   ```ts
   if (import.meta.env.DEV) {
     const cost = performance.now() - frameStart; // frameStart는 tickFrame 시작
     if (cost > 12) console.warn('[heavy frame]', cost.toFixed(1), {
       bursts: world.bursts.length, flyers: world.flyers.length,
       particles: world.particles.length, rogues: world.rogues.length,
     });
     (window as any).__frameStats ??= { count: 0, heavy: 0, totalMs: 0 };
     const s = (window as any).__frameStats;
     s.count++; s.totalMs += cost; if (cost > 12) s.heavy++;
   }
   ```
2. `src/canvas/` 헬퍼 `src/canvas/__perf.ts` 추가:
   ```ts
   export const PerfCounters = { gradients: 0, shadows: 0, draws: 0 };
   if (import.meta.env.DEV) (window as any).__perf = PerfCounters;
   ```
3. DevTools에서 baseline Performance profile 1개 캡처 → `fixes/perf_log/phase0_baseline.json`.
4. baseline `window.__frameStats` 결과 기록.

### 검증
- `npm run dev` 부팅 후 5분 시나리오 실행.
- `window.__frameStats` 출력: `{ count: N, heavy: H, avg: totalMs/count }` 기록.

### 커밋 메시지
`perf(measure): add tickFrame timing + window.__frameStats for baseline`

### Rollback 기준
- 빌드 실패 / 1프레임 비용 측정으로 인해 자체 오버헤드 > 0.5ms → 측정 코드 더 가볍게 조정.

---

## Phase 1 — Canvas 캐시 인프라 lib (3h)

**목표:** gradient/sprite 캐시 모듈을 추가만 한다. 사용처 0이라 회귀 위험 0.

### 작업

1. **새 파일** `src/canvas/gradientCache.ts`:
   ```ts
   const radial = new Map<string, CanvasGradient>();
   const linear = new Map<string, CanvasGradient>();

   export function getRadial(
     ctx: CanvasRenderingContext2D, key: string,
     x0: number, y0: number, r0: number,
     x1: number, y1: number, r1: number,
     stops: ReadonlyArray<readonly [number, string]>,
   ): CanvasGradient {
     const cached = radial.get(key);
     if (cached) return cached;
     const g = ctx.createRadialGradient(x0, y0, r0, x1, y1, r1);
     for (const [o, c] of stops) g.addColorStop(o, c);
     radial.set(key, g);
     if (import.meta.env.DEV) (window as any).__perf?.gradients++;
     return g;
   }

   export function invalidateGradients(): void {
     radial.clear(); linear.clear();
   }
   ```

2. **새 파일** `src/canvas/spriteCache.ts`:
   ```ts
   const cache = new Map<string, HTMLCanvasElement>();

   export function getSprite(
     key: string,
     width: number,
     height: number,
     build: (ctx: CanvasRenderingContext2D) => void,
   ): HTMLCanvasElement {
     const cached = cache.get(key);
     if (cached && cached.width === width && cached.height === height) return cached;
     const c = document.createElement('canvas');
     c.width = width; c.height = height;
     const cctx = c.getContext('2d');
     if (!cctx) throw new Error('sprite cache: no 2d ctx');
     build(cctx);
     cache.set(key, c);
     return c;
   }

   export function invalidateSprites(prefix?: string): void {
     if (!prefix) { cache.clear(); return; }
     for (const k of [...cache.keys()]) if (k.startsWith(prefix)) cache.delete(k);
   }
   ```

3. **테스트** `src/canvas/__tests__/cache.test.ts`:
   - 같은 키 두 번 호출 시 동일 인스턴스 반환
   - `invalidateGradients()` 후 새 인스턴스 반환
   - sprite의 build 함수가 첫 호출에만 실행되는지

4. `src/components/ParticleField.tsx` stage 변경 useEffect에 `invalidateGradients()` 호출 추가 (사용처는 다음 phase부터 생기지만, 안전 차원에서 미리).

### 검증
- `npm test` 통과
- `npm run build` 통과
- 게임 부팅 시 캐시 모듈만 import 가능한지 확인 (사용은 아직 없음)
- `[heavy frame]` 빈도는 baseline과 동일해야 함 (사용 안 했으니)

### 커밋 메시지
`feat(canvas): add gradientCache and spriteCache infrastructure`

---

## Phase 2 — `shadowBlur` 제거 + 글로우 스프라이트 적용 (4h)

**목표:** `drawEntities.ts`의 `shadowBlur` 16곳을 캐시된 스프라이트 글로우로 대체. **가장 큰 발열 감소** 예상.

### 작업

1. `src/canvas/drawEntities.ts` 16개 `shadowBlur` 위치 파악.
2. 각 위치마다 패턴 적용:
   ```ts
   // BEFORE
   ctx.shadowBlur = 24;
   ctx.shadowColor = stage.coreColor;
   ctx.fillStyle = innerGrad;
   ctx.fill();

   // AFTER
   const glowSize = Math.ceil(r * 3.2);
   const sprite = getSprite(
     `glow_${stage.id}_${stage.coreColor}_${glowSize}`,
     glowSize, glowSize,
     (cctx) => {
       const half = glowSize / 2;
       const g = cctx.createRadialGradient(half, half, 0, half, half, half);
       g.addColorStop(0, stage.coreColor + 'cc');
       g.addColorStop(0.5, stage.coreColor + '55');
       g.addColorStop(1, stage.coreColor + '00');
       cctx.fillStyle = g;
       cctx.fillRect(0, 0, glowSize, glowSize);
     },
   );
   ctx.drawImage(sprite, x - glowSize / 2, y - glowSize / 2);
   ctx.shadowBlur = 0; // 안전 차원
   ctx.fillStyle = innerGrad;
   ctx.fill();
   ```
3. shadowColor 값에 hex `+ 'cc'` 같은 alpha 접미사 처리가 안 되면 `rgba(...)` 변환 헬퍼 추가.
4. 키에 들어가는 변수가 너무 많으면(예: dynamic radius) 양자화: `Math.round(r / 4) * 4`.

### 검증
- 시각 비교: `cosmic_coalescence_v3.html` 같은 데모와 스크린샷 비교 (5초 보고 차이를 못 느끼는지).
- `window.__frameStats.heavy` 비율 측정 — baseline 대비 30% 이상 감소 기대.
- DevTools Performance에서 GPU time 감소 확인.
- `npm test` 통과.

### 커밋 메시지
`perf(canvas): replace shadowBlur with cached glow sprites in drawEntities`

### Rollback 기준
- 시각적으로 명백히 어색하다 (글로우 모양이 다름 → 양자화 단계 조절)
- 프레임 비용 증가 (스프라이트 캐시 미스 폭주 → 키 단순화)

---

## Phase 3 — 그라디언트 캐싱 적용 (3h)

**목표:** `drawCluster.ts`, `drawEntities.ts`의 정적 그라디언트 33+20=53개 중 좌표·반지름이 고정인 것 캐시화.

### 작업

1. `drawEntities.ts`, `drawCluster.ts`에서 `createRadialGradient` 사용처를 두 분류:
   - **A. 좌표/반지름이 매 프레임 동일** (예: 배경 별, stage 고정 글로우) → `getRadial(...)` 캐시
   - **B. 좌표가 매 프레임 변동** (예: 코어 펄스) → Phase 2의 스프라이트로 대체
2. A 케이스 일괄 변경:
   ```ts
   // BEFORE
   const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
   grad.addColorStop(0, color1);
   grad.addColorStop(1, color2);

   // AFTER
   const grad = getRadial(ctx,
     `entity_${stage.id}_${entityId}`,
     x, y, 0, x, y, r,
     [[0, color1], [1, color2]],
   );
   ```
3. B 케이스는 Phase 2 스프라이트로 추가 변환 (혹은 변동량 양자화 후 캐시).
4. `ParticleField.tsx` stage 전환 effect에 `invalidateGradients()` 확인.

### 검증
- `window.__perf.gradients` 카운터: phase 시작 시 5분간 X회 → phase 끝 시 5분간 5% 이하로 감소.
- 시각 비교 동일.
- `npm test` 통과.

### 커밋 메시지
`perf(canvas): cache static radial gradients via gradientCache`

---

## Phase 4 — `tickFrame` in-place 변환 + 객체 풀 (3h)

**목표:** GC 압력 제거. 매 프레임 새 배열·객체 할당을 없앤다.

### 작업

1. `src/components/ParticleField.tsx`의 5개 변환:
   - `world.particles = world.particles.map(...)` (라인 1517)
   - `world.wakeTrails = world.wakeTrails.filter(...)` (라인 1502)
   - `world.flyers = world.flyers.filter(...)` (라인 1573)
   - `world.bursts = world.bursts.filter(...)` (라인 1593)
   - `world.shockwaves = world.shockwaves.filter(...)` (라인 1700)

2. 각각 in-place write-index 패턴으로 교체:
   ```ts
   {
     const arr = world.wakeTrails;
     let w = 0;
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

3. `particles.map`은 새 객체 반환이 필요할 수 있음(`spawnParticleAtEdge` 케이스). 객체 풀:
   ```ts
   // ParticleField.tsx 상단
   const particlePool: Particle[] = [];
   function recycleParticle(p: Particle, init: (q: Particle) => void): Particle {
     init(p); return p;
   }
   ```
   `spawnParticleAtEdge`가 새 객체를 만드는 대신 기존 객체를 reset:
   ```ts
   function resetParticleAtEdge(p: Particle, width: number, height: number): void {
     // p.x, p.y, p.vx, p.vy 등을 in-place 갱신
   }
   ```

4. `world.wakeTrails.push(...)` 같은 spawn 경로도 풀 도입 가능 (선택, 효과 작음).

### 검증
- DevTools Memory > Allocation Timeline 5분 녹화. baseline 대비 50%+ 감소 기대.
- `[heavy frame]` 빈도 추가 감소.
- 게임플레이 회귀 없음 (`npm test` + 5분 플레이).
- **주의**: in-place 변환 시 같은 배열을 가리키는 다른 참조가 있으면 사이드이펙트. ref 검색해서 확인.

### 커밋 메시지
`perf(particles): in-place tickFrame array updates + object pooling`

### Rollback 기준
- 게임플레이 버그 (파티클이 사라지거나 중복) → 풀 도입 빼고 in-place만 적용

---

## Phase 5 — CSS `backdrop-filter` 모바일 분기 + `will-change` (1.5h)

**목표:** 모바일에서 backdrop-filter 부담 제거, 합성 힌트 부여.

### 작업

1. `src/index.css` 상단(또는 적절 위치)에 추가:
   ```css
   /* Compositing hints — 0회 → 핵심 레이어에 부여 */
   .game-canvas,
   .game-canvas-hitbox,
   .hud-overlay,
   .shop-panel,
   .entity-panel,
   .skills-panel,
   .almanac-overlay {
     will-change: transform, opacity;
   }

   /* 캔버스는 별도 합성 레이어 강제 */
   .game-canvas {
     transform: translateZ(0);
   }

   /* 모바일 / reduced-motion: backdrop-filter 단계 비활성 */
   @media (max-width: 768px), (prefers-reduced-motion: reduce) {
     .shop-panel,
     .entity-panel,
     .skills-panel,
     .almanac-overlay,
     .lore-modal,
     .settings-panel {
       backdrop-filter: none !important;
       -webkit-backdrop-filter: none !important;
       background: rgba(8, 10, 22, 0.94);
     }
   }
   ```

2. CSS 셀렉터 이름은 실제 클래스명에 맞춰 grep 후 보정. 위 셀렉터는 추정.
3. `box-shadow` 무거운 패널 몇 개도 모바일에서 단순화 검토 (선택).

### 검증
- Chrome DevTools > Rendering > "Paint flashing" 켜고 비교: backdrop-filter 영역의 매 프레임 재페인트가 멈췄는지.
- iPhone 14 Pro DPR 3 에뮬레이션에서 패널 열고 닫을 때 끊김 감소.
- 데스크탑 외관은 변화 없어야 함.

### 커밋 메시지
`perf(css): add will-change hints + disable backdrop-filter on mobile`

---

## Phase 6 — 타이머/리스너 cleanup 점검 (2h)

**목표:** 누수 가능 경로 차단.

### 작업

1. `src/components/GameScreen.tsx` `setTimeout` 9개 점검 (라인 229, 460, 486, 489, 505, 541, 554, 640):
   - 각 `useEffect` `return` cleanup에 `clearTimeout` 있는지
   - `clickSeqResetRef`는 unmount 시 clear

2. `addEventListener` 점검 (14파일 43회) — 핵심:
   - `ParticleField.tsx:1295` resize
   - `useGameState.ts` visibility/beforeunload
   - `useCloudSync.ts` 6회
   - 모두 `return () => removeEventListener(...)` 짝 확인

3. `IntroScreen.tsx` 독립 rAF (`tick`, frameId)가 unmount 시 cancel되는지 확인.

4. `BigBangCinematic.tsx`는 `useGameLoop` 사용 — active prop으로 비활성 조건 명확화.

5. StrictMode 중복 등록 대응: `useEffect` body에서 `addEventListener` 후 cleanup이 같은 핸들러 참조 가리키는지.

### 검증
- 1시간 자동 idle 플레이 후 heap snapshot — 메모리 안정.
- `getEventListeners(window)` (Chrome DevTools Console) — 동일 핸들러 중복 없는지.

### 커밋 메시지
`fix(cleanup): ensure all timers/listeners are released on unmount`

---

## Phase 7 — PurgeCSS 도입 (4~6h, 가장 위험)

**목표:** `index.css` 235KB → 50KB 이하. 초기 파싱 200~400ms 단축.

### 작업

1. 의존성 설치:
   ```bash
   npm i -D @fullhuman/postcss-purgecss postcss
   ```

2. `postcss.config.cjs` 신규/수정:
   ```js
   module.exports = {
     plugins: [
       require('@fullhuman/postcss-purgecss')({
         content: ['./index.html', './src/**/*.{ts,tsx,html}'],
         safelist: {
           standard: [
             /^stage-/, /^entity-/, /^skill-/, /^boost-/, /^endings?-/,
             /^anomaly-/, /^lore-/, /^modal-/, /^toast-/,
             'is-active', 'is-open', 'is-hidden', 'is-disabled',
           ],
           deep: [/transition-/, /animate-/],
           greedy: [/^z-/, /^layer-/],
         },
         defaultExtractor: (content) => content.match(/[A-Za-z0-9_-]+/g) || [],
         variables: false,
         keyframes: false, // 동적으로 추가되는 keyframes 있으면 true
       }),
     ],
   };
   ```

3. **safelist 작성이 핵심**. 다음 패턴을 grep으로 모아 safelist에 추가:
   - 템플릿 리터럴로 합성되는 클래스명: ``className={`stage-${id}`}``
   - 조건부 활성화: `is-active`, `is-mobile` 등
   - 외부에서 주입되는 클래스 (i18n.ts 등)

4. **회귀 테스트 절차:**
   - 매 stage(1~16) 1회씩 진입 후 스크린샷
   - prestige, 엔딩(5종), shop, almanac, settings 모두 열어보기
   - 사라진 스타일이 보이면 safelist 추가

5. CSS 분리 검토 (선택):
   - 핵심 path: `index.css` (5KB 이하 목표 — critical CSS)
   - 모달/패널: lazy CSS import (`import('./PanelStyles.css')`)

### 검증
- 빌드 산출물 `dist/assets/index-*.css` 크기 비교: 235KB → ?KB
- Lighthouse 모바일 Performance 점수 비교
- 시각 회귀 0 (스크린샷 diff)

### 커밋 메시지
`perf(css): purge unused CSS via PostCSS PurgeCSS`

### Rollback 기준
- 어떤 화면이라도 스타일 깨짐 → safelist 보강 / 부분 비활성화
- 빌드 시간 5분 초과 → 옵션 조정

---

## Phase 8 — 최종 측정 & 문서화 (1h)

**목표:** 효과 정량 입증 + 후속 작업자 인계.

### 작업

1. Phase 0 시나리오로 최종 Performance profile 캡처.
2. `fixes/perf_log/phase8_final.json` 저장.
3. `fixes/perf_log/RESULTS.md` 작성:
   ```markdown
   # Performance fix results — 2026-05-23
   | 지표 | Baseline | Phase 4 | Phase 8 |
   |---|---|---|---|
   | Avg ms/frame (모바일) | XX | XX | XX |
   | GC pause / min | XX | XX | XX |
   | Heavy frame / min | XX | XX | XX |
   | CSS size | 235KB | 235KB | XKB |
   | FCP | XXms | XXms | XXms |
   ```
4. `fixes/` README에 작업 완료 표기.

### 커밋 메시지
`docs(perf): record before/after measurements`

---

## 전체 타임라인

| Phase | 작업 | 시간 | 누적 | 위험 |
|:---:|---|:---:|:---:|:---:|
| 0 | 측정 인프라 + baseline | 0.75h | 0.75h | 없음 |
| 1 | 캐시 lib 추가 (사용 0) | 3h | 3.75h | 없음 |
| 2 | shadowBlur 제거 | 4h | 7.75h | 시각 |
| 3 | 그라디언트 캐싱 | 3h | 10.75h | 시각 |
| 4 | tickFrame in-place | 3h | 13.75h | 게임플레이 |
| 5 | CSS backdrop-filter 분기 | 1.5h | 15.25h | 시각 (모바일만) |
| 6 | 타이머/리스너 cleanup | 2h | 17.25h | 작음 |
| 7 | PurgeCSS | 5h | 22.25h | 큼 (회귀) |
| 8 | 최종 측정 + 문서화 | 1h | 23.25h | 없음 |

---

## 시작 전 체크리스트

- [ ] `git status` 깨끗한지 확인
- [ ] 현재 브랜치 명시 (`git rev-parse --abbrev-ref HEAD`)
- [ ] `npm install` 동기화
- [ ] `npm test` 현재 상태 통과 (baseline)
- [ ] `npm run build` 통과
- [ ] DevTools Performance 녹화 한 번 연습 (5분 시나리오 익히기)
- [ ] `fixes/perf_log/` 폴더 생성

---

## 의사결정 분기점

각 phase 후 다음 중 선택:

1. **계속** — 검증 통과 + 효과 확인. 다음 phase 진행.
2. **튜닝** — 효과는 있으나 미흡. 같은 phase 내에서 추가 최적화.
3. **롤백** — 회귀 발생. 직전 커밋으로 되돌리고 원인 분석.
4. **건너뛰기** — Phase 7 같은 위험 단계에서 효과가 비례하지 않으면 보류.

**스코프 조정 기준:** Phase 4까지 진행 후 측정 결과가 목표(<15ms)를 이미 달성했으면 Phase 7(PurgeCSS)은 별도 PR로 분리.
