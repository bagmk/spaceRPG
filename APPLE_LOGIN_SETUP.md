# Apple 로그인 셋업 체크리스트 (App Store 포함)

> ⚠️ **업데이트(네이티브 통일):** 네이티브 빌드는 `@capacitor-firebase/authentication`(capawesome)로 Apple+Google을 통일했습니다(안드로이드 플랜과 동일 플러그인). iOS에선 **GoogleService-Info.plist가 필수**입니다. iOS 패키징/연결 정본은 **[IOS_LAUNCH_PLAN.md](./IOS_LAUNCH_PLAN.md)**. 아래 일부 "plist 불필요" 서술은 통일 이전 기준입니다.

> **코드는 완료.** 아래는 콘솔/계정/네이티브 래핑 등 코드 밖 작업.
> 관련 파일: `src/auth/AuthProvider.tsx` (`signInWithApple` / `linkWithApple`), `src/components/LoginScreen.tsx` (Apple 버튼), `src/index.css` (`.login-screen__apple-btn`)
> Firebase project: **the-big-bang-84499** → authDomain `the-big-bang-84499.firebaseapp.com`

---

## 0. 코드에서 이미 된 것 (✅ tsc --noEmit 통과)

- `AuthProvider`: `signInWithApple`, `linkWithApple` 추가
  - **웹**: `OAuthProvider('apple.com')` + `signInWithPopup`
  - **네이티브 iOS**: `@capacitor-firebase/authentication (capawesome)` → nonce(SHA-256) → `signInWithCredential` (플랫폼 자동 분기, `window.Capacitor` 감지)
- `LoginScreen`: HIG 준수 Apple 버튼(검정/Apple 로고) + `handleApple`
- 첫 로그인에서만 `email` 저장, `profile.displayName`은 절대 건드리지 않음 (게임 내 이름과 분리 — 플랜 규칙 준수)

---

## 1. Apple Developer (사용자 작업, 필수)

- [ ] **Apple Developer Program 가입** ($99/년)
- [ ] **App ID** 생성 (Identifiers → App IDs) — Bundle ID 예: `com.cosmiccoalescence.app`
  - [ ] "Sign in with Apple" capability 체크
- [ ] **Service ID** 생성 (웹/GitHub Pages용) — 예: `com.cosmiccoalescence.web`
  - [ ] "Sign in with Apple" 활성화 → Configure
  - [ ] Primary App ID = 위 App ID
  - [ ] Domains: `the-big-bang-84499.firebaseapp.com`
  - [ ] Return URLs: `https://the-big-bang-84499.firebaseapp.com/__/auth/handler`
- [ ] **Key 생성** (Keys → +) — "Sign in with Apple" 체크 → Primary App ID 연결
  - [ ] `.p8` 다운로드 **(1회만 가능!)** + **Key ID** 기록 + **Team ID** 기록

## 2. Firebase 콘솔

- [ ] Authentication → Sign-in method → **Apple → Enable**
- [ ] 입력: Service ID(`com.cosmiccoalescence.web`), Apple **Team ID**, **Key ID**, **Private key**(.p8 내용)
- [ ] Authentication → Settings → **Authorized domains**에 배포 도메인 포함 확인 (커스텀 도메인이면 추가)

## 3. 환경 변수

- [ ] `.env.local`에 추가(네이티브 plugin clientId용, 선택):
  ```
  VITE_APPLE_SERVICE_ID=com.cosmiccoalescence.web
  ```
  웹 popup 경로는 불필요. 네이티브는 없어도 동작하나 명시 권장.
- [ ] `.env.local`이 `.gitignore`에 있는지 확인 (Working Protocol §5)

## 4. 웹에서 먼저 테스트 (가장 빠른 end-to-end 검증)

- [ ] `npm run dev` → Apple 버튼 → 팝업 로그인
- [ ] **Safari / Chrome / Firefox** 3종 동작 확인 (Phase 3A CHECKPOINT)
- [ ] 첫 로그인 후 Firestore `users/{uid}/profile.email` 저장 확인
- [ ] "이메일 숨기기" 선택 시 relay 주소(`@privaterelay.appleid.com`) 저장 확인

## 5. App Store용 네이티브 래핑 (Capacitor)

> 현재 repo엔 `ios/` 없음. 아래로 추가. **Mac + Xcode + CocoaPods 필요.**

```bash
npm install                 # Capacitor 8 deps already in package.json (+@capacitor/ios)
npm run build               # base must be '/', not the GitHub Pages path
npx cap add ios             # creates ios/ (needs macOS + CocoaPods)
npx cap sync ios
npx cap open ios            # opens Xcode
```

- [ ] Xcode: Signing & Capabilities → **+ "Sign in with Apple"**
- [ ] Bundle ID = App ID(`com.cosmiccoalescence.app`)와 일치
- [ ] Firebase 콘솔에 **iOS 앱 등록** → `GoogleService-Info.plist` 추가
- [ ] 실기기/시뮬레이터에서 Apple 버튼 → **네이티브 시트** 동작 확인

> 참고: `signInWithPopup`은 WKWebView에서 동작하지 않음. 그래서 네이티브는 plugin + `signInWithCredential`로 분기됨(코드 처리 완료).

## 6. ⚠️ App Store 심사 차단 요소 (놓치면 리젝)

- [ ] **계정 삭제 — Guideline 5.1.1(v)** : 현재 repo에 **없음**. 앱 내 계정 삭제 제공 필수.
  - 최소 구현: SettingsPanel "계정 삭제" → 재인증(reauth) → Firestore `users/{uid}` 정리 → `deleteUser()`
  - `requires-recent-login` 발생 → 재인증 필요. 하위 컬렉션 정리는 Cloud Function 권장.
- [ ] **Guideline 4.8** : Google 로그인을 제공하므로 Apple 동등 제공 필수 → **이번 작업으로 충족**
- [ ] 개인정보처리방침 URL + App Store Connect **App Privacy**(수집 항목: email) 작성
- [ ] Apple 버튼이 타 로그인과 동등한 위치/크기 (HIG)

---

## 추천 순서

1. **§1~4** — 웹에서 Apple 로그인 end-to-end 검증 (반나절, Mac 불필요)
2. **§6 계정 삭제 구현** — 심사 통과 필수
3. **§5 Capacitor 래핑** — Mac/Xcode 확보 후

---

## iOS ↔ Firebase 연결 (구조부터 이해 — 이게 핵심)

**핵심:** 이 앱은 Firebase **JS SDK**를 WebView에서 사용(`signInWithCredential`). 그래서 iOS 연결이 두 갈래로 갈립니다. 먼저 어느 경로인지 정하세요.

### 경로 A — 현재 코드 그대로 (✅ 권장, 가장 단순)
- iOS WebView 안의 JS SDK가 **웹 config(`.env`의 `VITE_FIREBASE_*`)** 를 그대로 써서 Firebase에 붙습니다.
- **Apple/Google 로그인만 쓸 거면 `GoogleService-Info.plist` 불필요.** 네이티브 Apple 플러그인은 identity token만 만들고, JS SDK가 `signInWithCredential`로 교환합니다.
- iOS "연결"에 실제로 필요한 것:
  1. Firebase 콘솔 → **Apple provider 활성화**(§2). 이게 토큰 검증 백엔드 역할.
  2. `.env`의 `VITE_FIREBASE_*`가 빌드에 인라인되는지 확인(`npm run build` 후 `dist`).
  3. 끝. plist도, 네이티브 Firebase pod도 필요 없음.
- 참고: `signInWithCredential`은 authorized-domain 검사를 하지 않으므로 `capacitor://localhost` 등록도 불필요.

### 경로 B — 네이티브 Firebase SDK (나중에 푸시/애널리틱스가 필요할 때만)
이 경우에만 콘솔에서 iOS 앱을 등록합니다:
1. Firebase 콘솔 → ⚙️ 프로젝트 설정 → "내 앱" → **iOS 앱 추가**
2. **Apple bundle ID**: `com.cosmiccoalescence.app` (App ID와 동일)
3. **GoogleService-Info.plist** 다운로드
4. Xcode에서 `ios/App/App/` 폴더에 드래그 (Target Membership 체크)
5. 플러그인: `@capacitor-firebase/authentication` (+ iOS pod `FirebaseAuth`)
6. (Google까지 네이티브로 하면) `Info.plist`의 URL Schemes에 plist의 `REVERSED_CLIENT_ID` 추가
7. `npx cap sync ios`

### 결정 기준
| 상황 | 선택 |
|---|---|
| 지금 App Store 목표 + Apple/Google 로그인만 | **경로 A** — 콘솔에서 Apple provider만 켜면 iOS 연결 끝 |
| 곧 FCM 푸시 / Crashlytics / 네이티브 Analytics 필요 | **경로 B** — iOS 앱 등록 + plist |

> 결론: **지금은 경로 A로 충분.** 콘솔에서 Apple provider 활성화(§1~2)만 마치면 iOS에서도 Apple 로그인이 동작합니다. plist는 푸시 등을 붙일 때 등록하세요.

---

## 계정 삭제 — 구현 완료 ✅ (Guideline 5.1.1(v))

설정(SettingsPanel)에 **"계정 삭제"** 버튼 추가 (2단계 확인). 동작:
1. `deleteAccountData(uid)` — Firestore 정리: `users/{uid}/profile/main`, `users/{uid}/saves/main`, `leaderboard/{uid}`, `displayNames/{nameLower}` (best-effort)
2. `deleteUser()` — Auth 계정 삭제. `auth/requires-recent-login`이면 자동 재인증(Apple/Google, 웹 popup 또는 네이티브 credential) 후 재시도.
3. `firestore.rules`: leaderboard 본인 삭제 허용 추가(기존 write 규칙은 delete를 막고 있었음).

남은 권장사항(선택): 하위 컬렉션이 늘면 서버 정리를 Firebase **"Delete User Data"** 확장으로 자동화.

---

_생성: 2026-06-07. Phase 3A (Apple 로그인) 코드 완료분 기준._
