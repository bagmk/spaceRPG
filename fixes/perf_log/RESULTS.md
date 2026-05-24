# Cosmic Coalescence — 성능 수정 실행 결과

날짜: 2026-05-23 ~ 24
브랜치: main (작업 트리, 미커밋 상태)
원본 분석/플랜: [PERFORMANCE_ANALYSIS.md](./PERFORMANCE_ANALYSIS.md), [PERFORMANCE_FIX_PLAN.md](./PERFORMANCE_FIX_PLAN.md)

---

## TL;DR

8개 phase 중 7개 적용 완료 (1개는 인프라만, 1개 N/A로 확정). 테스트 baseline(1 fail / 148 pass) 유지, 새 회귀 0건.

| Phase | 작업 | 상태 | 비고 |
|:---:|---|:---:|---|
| 0 | tickFrame 측정 인프라 | ✅ 적용 | `window.__frameStats`, `window.__perf` |
| 1 | gradientCache + spriteCache lib | ✅ 적용 | +9 테스트 통과 |
| 2 | shadowBlur 제거 | ❌ **N/A** | 코드베이스에 `ctx.shadowBlur` 사용 0개. 초기 분석 오류 |
| 3 | createRadialGradient 캐싱 적용 | ⚠️ 인프라만 | 핫스팟 측정 후 별도 PR 권장 |
| 4 | tickFrame 배열 in-place | ✅ 적용 | 6개 배열 재할당 제거, 객체 풀(resetParticleAtEdge) |
| 5 | CSS will-change + 모바일 backdrop | ✅ 적용 | `--panel-blur` 모바일 변형, 5개 셀렉터에 will-change |
| 6 | 타이머/리스너 cleanup | ✅ 적용 | clickSeqResetRef 누수 1건 수정 |
| 7 | PurgeCSS 도입 | ✅ 적용 | 9% CSS 감소 (238KB → 216KB) |
| 8 | 최종 검증 + 커밋 | 🟡 진행 중 | 사용자 측 커밋 대기 |

---

## 적용된 변경 파일

### 새 파일
- `src/canvas/__perf.ts` (741 B) — DEV 전용 성능 카운터
- `src/canvas/gradientCache.ts` (1.9 KB) — `getRadial`, `getLinear`, `invalidateGradients`
- `src/canvas/spriteCache.ts` (2.8 KB) — `getSprite`, `getRadialGlowSprite`, `invalidateSprites`
- `src/canvas/__tests__/cache.test.ts` (4.1 KB) — 9개 테스트 (모두 통과)
- `postcss.config.cjs` (4.0 KB) — PurgeCSS prod 전용 설정

### 수정 파일
- `src/components/ParticleField.tsx` — tickFrame 측정 코드 + 6개 배열 in-place 변환
- `src/canvas/world.ts` — `resetParticleAtEdge` in-place 변형 함수 추가
- `src/components/GameScreen.tsx` — clickSeqResetRef unmount cleanup
- `src/index.css` — Phase 5 perf 블록 (will-change + 모바일 backdrop-filter 분기)
- `package.json` + `package-lock.json` — `@fullhuman/postcss-purgecss@8`, `postcss@8` devDeps

---

## 측정 결과 (정량)

### 빌드 시 CSS 크기
- Baseline: 238,700 B (11,161 줄)
- PurgeCSS 후: 216,372 B (-9%, 약 22KB 절감)
- Vite minification 추가 후 추정: ~150KB (gzip 후 30~40KB)

### 테스트
- Baseline: 1 fail / 107 pass (12 files)
- 작업 후: 1 fail / 148 pass (16 files)
- 신규 fail: 0
- 신규 pass: +41 (cache.test.ts 9 + 기존에 미실행이던 테스트들이 들어옴)
- 동일하게 실패하는 기존 테스트: `src/game/__tests__/reducer.test.ts:64` "encounter rewards above click-scaled floor" (quanta 80 vs expected 40) — 작업과 무관

### 런타임 (실측 필요)
- DEV 빌드에서 `window.__frameStats` 로 측정 가능
  ```js
  // 5분 플레이 후 DevTools 콘솔에서
  const s = window.__frameStats;
  console.log('avg ms/frame:', s.totalMs / s.count);
  console.log('heavy frames:', s.heavy, '/', s.count);
  console.log('max ms:', s.maxMs);
  ```
- 기대 효과:
  - GC pause 빈도 50%+ 감소 (Phase 4의 in-place 변환에서)
  - 모바일에서 panel/HUD 페인트 시간 30~50% 감소 (Phase 5의 backdrop-filter 비활성)
  - bundle 크기 ~22KB 감소 (Phase 7)

---

## 보류된 작업 (다음 세션 권장)

### Phase 3 본 적용
`createRadialGradient` 50회 중 어느 것이 실제 핫스팟인지는 baseline 측정 데이터가 필요. 권장 순서:
1. `npm run dev`로 게임 띄우고 5분 활성 플레이
2. DevTools Performance 녹화 → Bottom-Up 뷰에서 `createRadialGradient` self-time 상위 5개 식별
3. 그 5개만 `getRadial` 또는 `getRadialGlowSprite`로 변환 (회귀 위험 최소)
4. 다시 측정 → 효과 확인 → 다음 5개로 확장

### Phase 3 후보 (정적 위치/크기, 캐싱 안전)
초기 분석에서 식별한 정적 패턴:
- `drawCluster.ts:553` — `(0, 0, 0, 0, 0, 52)` 완전 상수
- `drawCluster.ts:1318` — `(0, 0, inner * 0.2, 0, 0, inner * 1.28)` 좌표 0 기준
- `drawCluster.ts:243` — `(0, 0, 0, 0, 0, coreR * 3)` 좌표 0 기준
- `drawCluster.ts:1643` — `(0, 0, inner, 0, 0, outer)` 좌표 0 기준
- `drawCluster.ts:513` — `(0, 0, 0, 0, 0, outer)` 좌표 0 기준

위 5개부터 변환하면 가장 안전.

### PurgeCSS 추가 최적화
- 현재 safelist가 conservative해서 9% 감소에 그침. 실 회귀 테스트 후 greedy 패턴 축소 가능
- 모든 16개 stage × 5개 ending × 모든 패널 스크린샷 검증 후 safelist 압축 → 30~40% 추가 감소 가능
- 별도 PR로 분리 권장 (회귀 위험)

### 기존 reducer 테스트 실패
- `src/game/__tests__/reducer.test.ts:64` "encounter rewards above click-scaled floor"
- main에 이미 있던 fail이라 이번 작업과 무관하지만, 정리하면 좋음

---

## 사용자 측 커밋 명령

샌드박스에서 `.git/index.lock` 권한 충돌로 자동 커밋이 안 되었습니다. 아래 한 줄을 사용자 터미널에서 실행하시면 모든 phase가 단일 커밋으로 main에 들어갑니다.

```bash
cd ~/게임 && rm -f .git/index.lock && \
git add src/canvas/__perf.ts src/canvas/gradientCache.ts src/canvas/spriteCache.ts \
        src/canvas/__tests__/cache.test.ts \
        src/canvas/world.ts \
        src/components/ParticleField.tsx \
        src/components/GameScreen.tsx \
        src/index.css \
        postcss.config.cjs \
        package.json package-lock.json && \
git commit -m "perf: tickFrame in-place, canvas cache infra, mobile CSS, PurgeCSS

Multi-phase performance fix per PERFORMANCE_FIX_PLAN.md:

Phase 0 — measurement
  - src/canvas/__perf.ts: window.__perf counters
  - ParticleField.tickFrame: window.__frameStats + heavy-frame warning

Phase 1 — canvas cache infrastructure
  - src/canvas/gradientCache.ts: getRadial/getLinear/invalidateGradients
  - src/canvas/spriteCache.ts: getSprite/getRadialGlowSprite/invalidateSprites
  - src/canvas/__tests__/cache.test.ts: 9 new tests, all passing

Phase 4 — tickFrame GC pressure removal
  - 6 array reallocations replaced with in-place write-index compaction
    (wakeTrails, particles, flyers, bursts, shockwaves, rogues)
  - world.ts: resetParticleAtEdge() in-place variant of spawnParticleAtEdge

Phase 5 — CSS compositing hints
  - will-change on canvas + key overlay layers
  - Mobile/reduced-motion: drop --panel-blur saturation and disable
    backdrop-filter on the heaviest panels

Phase 6 — cleanup
  - GameScreen.clickSeqResetRef: add unmount cleanup

Phase 7 — PurgeCSS (production builds only)
  - postcss.config.cjs with conservative safelist
  - dev builds unchanged (env-gated)
  - measured 9% CSS reduction (238KB → 216KB)

Not applied here, deferred to baseline-measurement-driven follow-ups:
- Phase 2 (shadowBlur removal): not applicable — codebase has zero
  ctx.shadowBlur usage. Initial grep was matching unrelated
  shadow* variable names (moon shading etc.).
- Phase 3 (gradient caching): infrastructure ready, but identifying the
  hottest 5-10 gradients requires runtime profile data first.

Test baseline preserved: 1 pre-existing fail / 148 pass."
```

### 커밋 분할을 원하면

phase별로 따로 커밋하려면:

```bash
cd ~/게임 && rm -f .git/index.lock

# Phase 0
git add src/canvas/__perf.ts src/components/ParticleField.tsx
git commit -m "perf(measure): Phase 0 - tickFrame timing baseline"

# Phase 1 — 별도로 ParticleField 변경분을 분리해야 함 (Phase 0과 Phase 4 둘 다 만짐)
# → 단일 커밋이 더 깔끔. 분할 원하면 git add -p 로 hunks 골라야 함

# Phase 5
git add src/index.css
git commit -m "perf(css): Phase 5 - will-change + mobile backdrop-filter"

# Phase 6
git add src/components/GameScreen.tsx
git commit -m "fix(cleanup): Phase 6 - clickSeqResetRef unmount cleanup"

# Phase 7
git add postcss.config.cjs package.json package-lock.json
git commit -m "perf(css): Phase 7 - PurgeCSS in production builds"
```

권장: 단일 커밋이 더 깔끔합니다 (위 첫 번째 명령).
