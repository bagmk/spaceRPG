# Fix 05 (P1) — `100vh` → `100dvh` 통일

## 컨텍스트

iOS Safari 주소창의 동적 높이 때문에 `100vh`는 가시 영역보다 크게 계산돼 UI가 잘린다. 현재 `src/index.css`에 `100vh` 잔존 라인: 99, 286, 1268, 3683 (`min-height: 100vh`), 3830 (`max-height: calc(100vh - 40px)`). 일부는 이미 `100dvh`로 마이그레이션됨 (1549, 4148, 5711, 5824).

## 작업

### 1) `src/index.css` — 각 라인 수정

`100vh` → `100dvh` 교체, **구버전 사파리 폴백 패턴**으로 두 줄 적기:

#### 라인 99, 286, 1268

```css
height: 100vh; /* fallback for browsers without dvh support */
height: 100dvh;
```

#### 라인 3683

```css
min-height: 100vh;
min-height: 100dvh;
```

#### 라인 3830

```css
max-height: calc(100vh - 40px);
max-height: calc(100dvh - 40px);
```

### 2) 누락 셀렉터 검수

```bash
grep -nE "(height|min-height|max-height):\s*(100vh|calc\(100vh)" src/index.css
```

발견되는 모든 라인에 동일 패턴 적용.

### 3) `index.html` viewport 메타 검증

이미 `viewport-fit=cover` 포함됨. 변경 불필요.

### 4) 모달/오버레이 검증

다음 셀렉터들이 dvh를 쓰는지 grep 확인:
- `.reset-backdrop`, `.reset-modal`
- `.shop-panel`, `.entity-panel`, `.almanac-overlay`, `.settings-panel`
- `.ending-credits`, `.big-bang-cinematic`

vh 쓰는 게 있으면 동일 폴백 패턴 적용.

## 검증

1. Chrome DevTools 모바일 에뮬레이션 (iPhone 14 Pro Max) → 게임 화면이 viewport 딱.
2. Safari Responsive Design Mode iPhone → 주소창 토글 시 UI 안 잘림.
3. 모달 열고 닫을 때 backdrop이 화면 전체 덮음.
4. iOS Safari 14 이하 시뮬레이터에서 fallback `100vh` 적용 시 깨지지 않음.

## 영향 범위

- 데스크탑: 변화 없음.
- iOS Safari 15.4+: 주소창 토글에 영향 없는 안정 레이아웃.
- iOS Safari 14: fallback으로 기존 동작 유지.

## 주의

- `dvh` 외 `svh`(smallest), `lvh`(largest)도 있지만 게임 UI는 `dvh`(dynamic) 적합.
- Android Chrome 108+ 역시 `dvh` 지원.
