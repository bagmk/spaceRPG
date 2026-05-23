# Cosmic Coalescence — 출시 전 수정 작업 인덱스

각 파일은 클로드 코드에 그대로 붙여 넣을 수 있는 자기완결적 프롬프트.
**위에서부터 순서대로** 처리 권장.

## 작업 목록

| # | 파일 | 우선순위 | 예상 작업량 | 핵심 문제 |
|---|------|----------|-------------|-----------|
| 01 | `01-safeadd-guard.md` | P0 | 30분 | `safeAdd`가 noop이라 `Infinity` 전파 위험 |
| 02 | `02-audio-unlock.md` | P0 | 15분 | iOS Resume 경로 무음 버그 |
| 03 | `03-storage-quota.md` | P0 | 1시간 | localStorage 1MB 초과 시 silent 손실 |
| 04 | `04-raf-loop-consolidation.md` | P0 | 2~3시간 | rAF 루프 두 개 동시 실행 |
| 05 | `05-dvh-unify.md` | P1 | 20분 | iOS 주소창에 UI 잘림 |
| 06 | `06-dpr-cap-hit-target.md` | P1 | 1시간 | 고DPR 기기 성능 + Apple HIG 44pt |
| 07 | `07-autosave-throttle.md` | P1 | 30분 | TICK마다 localStorage write |
| 08 | `08-boost-pause-resume.md` | P1 | 2시간 | 백그라운드에서 부스트 소진 |
| 09 | `09-first-click-onboarding.md` | P2 | 2시간 | 첫 클릭 시각 신호 부족 |

## 권장 실행 순서

1. **01 → 03 → 07**: 수치 안정성 + 세이브 안전성 묶음.
2. **04 → 02**: rAF 통합 먼저 하고 audio unlock 추가 (4가 ParticleField 구조 바꾸므로).
3. **05 → 06**: CSS/모바일 UX.
4. **08**: 상점 작업 마무리 단계에 맞춰서.
5. **09**: 베타 테스트 후 결정.

## 코드 외 작업 (별도)

- **WebView 네이티브 통합** — PWA를 그대로 WKWebView로 래핑하면 Apple Guideline 4.2 (minimum functionality)로 리젝트 위험. Capacitor + IAP/푸시/햅틱 중 최소 1개 네이티브 기능 추가 필요. 코드 패치가 아니라 빌드 구성 작업.
- **CCPA/GDPR 삭제 UI** — Firebase 클라우드 세이브가 들어간 후 "계정 데이터 영구 삭제" 버튼 추가 필요.

## 검증 공통 사항

각 작업 후:
```bash
npm test
npm run build
```
이 두 개가 통과해야 PR/커밋 가능.
