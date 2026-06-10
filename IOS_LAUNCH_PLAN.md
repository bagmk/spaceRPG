# iOS 출시 플랜 — Capacitor 8 → App Store

> 작성 2026-06-07. [ANDROID_LAUNCH_PLAN.md](./ANDROID_LAUNCH_PLAN.md)의 자매 문서. 웹 Firebase 연동·계정삭제는 이미 끝났고, 여기서는 **iOS 패키징 + 네이티브 Apple/Google 로그인 + App Store 출시**만 다룬다. 로그인 코드/콘솔 세부는 [APPLE_LOGIN_SETUP.md](./APPLE_LOGIN_SETUP.md).

---

## 0. 현재 상태 한눈에

| 항목 | 상태 |
|------|------|
| 웹 Firebase (Auth/Firestore/sync/leaderboard) | ✅ 완료 |
| Capacitor 8 + `capacitor.config.ts` (appId `com.cosmiccoalescence.app`, "Big Bang") | ✅ (android과 공유) |
| `@capacitor/ios` 의존성 | ✅ 추가됨 → `npm install` 필요 |
| `capacitor.config.ts` providers에 `apple.com` | ✅ 추가됨 |
| **네이티브 Apple 브릿지** (`nativeAppleCredential` → `signInWithCredential`) | ✅ 코드 완료 |
| **네이티브 Google 브릿지** (`nativeGoogleCredential`, 공유) | ✅ 코드 완료 |
| 계정 삭제 (Guideline 5.1.1(v)) | ✅ 완료 (SettingsPanel) |
| `ios/` 네이티브 프로젝트 | ❌ (`npx cap add ios` — macOS) |
| Firebase 콘솔 **iOS 앱** + `GoogleService-Info.plist` | ❌ (Phase B) |
| Apple Developer / App Store Connect | ❌ (사람) |

## 1. 버전 / 요구 (2026-06)

- **Capacitor 8.4**, `@capacitor-firebase/authentication` **8.3** (firebase `^12` 호환 — 현재 `^12.13.0` OK).
- **macOS + Xcode(최신) + CocoaPods 필수.** iOS 빌드는 Mac에서만 가능.
- **Apple Developer Program $99/년.**
- Capacitor 8 기본 iOS deployment target 확인(iOS 14+).

## 2. 역할 분담

| | **Saesun (사람만 가능)** | **Claude (레포/코드/문서)** |
|---|---|---|
| 계정/콘솔 | Apple Developer, App Store Connect, Firebase 콘솔 | — |
| Mac | Xcode/CocoaPods, `cap add ios`, 서명, Archive | 명령/루틴 제공 |
| 키 | `.p8`(Sign in with Apple), 서명 인증서 | 사용처 안내 |
| 코드 | (검토) | Capacitor 설정, 네이티브 auth 브릿지, 계정삭제 |
| 문서 | (검토) | 개인정보처리방침·listing·App Privacy 초안 |

## 3. ⚠️ 차단 결정

1. **Bundle ID = `com.cosmiccoalescence.app`** (Android applicationId와 동일, 영구 불변).
2. **앱 표시명 "Big Bang"** (App Store Connect 등록명과 일치 — 상표/중복 확인).
3. **App Store Connect 계정 유형** (개인/조직).

## 4. Phase A — Capacitor iOS 스캐폴드

**Claude (완료):** `@capacitor/ios` 의존성 추가, `capacitor.config.ts`에 `apple.com` provider 추가, `cap:ios` 스크립트 추가.

**Saesun (Mac):**
```bash
npm install
npm run build            # base '/' 확인 (GitHub Pages 경로로 빌드 금지)
npx cap add ios          # ios/ 생성 (CocoaPods)
npx cap sync ios
npx cap open ios         # Xcode
```
**CHECKPOINT:** Xcode에서 빈 셸 빌드·실행 성공.

## 5. Phase B — Firebase iOS 연결 ★ ("iOS Firebase 연결"의 본체)

capawesome 플러그인은 iOS에서 **네이티브 Firebase**를 쓰므로 plist가 필요하다.

**Saesun (Firebase 콘솔 + Xcode):**
- [ ] 프로젝트 `the-big-bang-84499` → **iOS 앱 추가** → Apple bundle ID = `com.cosmiccoalescence.app`
- [ ] **`GoogleService-Info.plist`** 다운로드 → Xcode `ios/App/App/`에 드래그 (Target Membership 체크)
- [ ] Authentication → Settings → Authorized domains에 배포 도메인 유지(웹 popup용)

**CHECKPOINT:** iOS 앱이 콘솔에 보이고 빌드가 plist를 인식.

## 6. Phase C — 네이티브 Apple / Google 로그인

**Claude (코드 완료):** `AuthProvider`가 `isNativePlatform()`으로 분기 → `nativeAppleCredential()` / `nativeGoogleCredential()` → `signInWithCredential` 브릿지 (`skipNativeAuth: true`). 웹은 기존 `signInWithPopup` 유지.

**Saesun (Xcode + 콘솔):**
- [ ] Xcode → Signing & Capabilities → **+ "Sign in with Apple"** 추가
- [ ] Firebase 콘솔 → Apple provider 활성화 (Service ID + `.p8` + Team/Key ID — APPLE_LOGIN_SETUP.md §1~2). Google provider는 이미 ON.
- [ ] Apple Developer App ID(`com.cosmiccoalescence.app`)에 "Sign in with Apple" capability 체크

**CHECKPOINT:** 실기기에서 Apple·Google 로그인 → 동일 uid 유지 → Firestore 동기화/리더보드 정상.

## 7. Phase D — 빌드 / 서명 / TestFlight

**Claude:** 변경마다 `npm run build && npx cap sync ios` 루틴.

**Saesun (Mac):**
- [ ] Signing: Automatic, Apple Developer 팀 선택, Bundle ID 일치
- [ ] Archive → App Store Connect 업로드 → **TestFlight** 내부 테스트
- [ ] 실기기 Canvas **60fps 체감** 확인

**CHECKPOINT:** TestFlight 빌드 설치·로그인 성공.

## 8. Phase E — App Store Connect listing + 심사

**Claude (초안):**
- [ ] listing: 제목/부제/설명(한·영), 카테고리(게임)
- [ ] **개인정보처리방침 URL** 문서 (Firebase Auth 이메일·이름, Firestore 진행데이터 수집 명시) — 필수
- [ ] **App Privacy(Nutrition Label)** 답안

**심사 핵심:**
- [ ] **Guideline 4.8** — Google 제공 → Apple 동등 제공 = **충족**
- [ ] **Guideline 5.1.1(v)** — 인앱 계정 삭제 = **완료**
- [ ] **IAP** — deferred(출시 후). 디지털 재화는 **Apple IAP 강제**, RevenueCat 검토. 실물/광고제거 정책 확정 후.

**CHECKPOINT:** 심사 제출 → 통과.

## 9. 타임라인 (대략)

```
A 스캐폴드(0.5d, Mac) → B Firebase iOS(0.5d) → C 로그인 마무리(콘솔/capability 0.5d)
→ D TestFlight(0.5~1d) → E listing·정책(0.5d, 병렬) → 심사(보통 1~3일)
```
실작업 ~2~3일 + 심사 대기.

## 10. 검증 (출시 전)

- [ ] 실기기 저가·고가 fps
- [ ] 웹(GitHub Pages) popup 로그인 회귀 — 분기 안 깨짐
- [ ] Apple "이메일 숨기기" relay 주소 저장
- [ ] 계정 삭제 후 재로그인 → 신규 계정 생성 확인
- [ ] Firestore Rules: 타 uid 데이터 거부
- [ ] 릴리스 서명 빌드에서 Apple·Google 로그인 성공

## 출처
- [capawesome — setup-apple](https://github.com/capawesome-team/capacitor-firebase/blob/main/packages/authentication/docs/setup-apple.md)
- [Capacitor iOS docs](https://capacitorjs.com/docs/ios)
- [App Store Review Guidelines 4.8 / 5.1.1](https://developer.apple.com/app-store/review/guidelines/)
