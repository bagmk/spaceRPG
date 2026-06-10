# 안드로이드 출시 플랜 — Capacitor 8 → Google Play

> 작성 2026-06-07. 결정: **Capacitor**(웹뷰 래핑), 목표: **Play 스토어 정식 출시**.
> 이 문서는 [FIREBASE_INTEGRATION_PLAN.md](./FIREBASE_INTEGRATION_PLAN.md)의 자매 문서다. Firebase **웹** 연동은 이미 끝났고, 여기서는 **안드로이드 패키징 + 안드로이드용 네이티브 연결 + Play 출시**만 다룬다.

---

## 0. 현재 상태 한눈에

| 항목 | 상태 |
|------|------|
| 웹 Firebase (Auth/Firestore/sync/leaderboard/FCM) | ✅ 완료 (`src/cloud/*`, `src/auth/AuthProvider.tsx`) |
| PWA manifest | ✅ 있음 (`public/manifest.webmanifest`, standalone/portrait/maskable) |
| 서비스워커 | ⚠️ FCM 전용만 (`firebase-messaging-sw.js`), 오프라인 캐싱 SW 없음 |
| 안드로이드 래퍼 (Capacitor/android/) | ❌ 없음 |
| Firebase 콘솔에 **안드로이드 앱** 등록 | ❌ 없음 (웹 앱만) |
| 구글 로그인 방식 | ⚠️ `signInWithPopup`/`linkWithPopup` — **웹뷰에서 동작 안 함** |

## 1. 현재 기준 사실 (검증된 버전/정책, 2026-06)

- **Capacitor 8** (최신). 요구: **Node 22+**, **Android Studio Otter 2025.2.1+**, 웹뷰 Chrome 60+, **minSdk 24**(Android 7).
- **targetSdk 36 (Android 16)**: 2026-08-31부터 신규 앱·업데이트 의무. 지금 출시하면 처음부터 36 타깃으로 맞춘다.
- **네이티브 구글 로그인**: `@capacitor-firebase/authentication`(capawesome) 사용 → 네이티브에서 ID 토큰 받아 JS SDK `signInWithCredential`로 브릿지.
- **결제(IAP) 정책**: 디지털 재화는 원칙적으로 **Google Play Billing 강제**. 단 2025-10-29 Epic 판결 후 미국 개발자는 대체결제(Stripe 등) 가능(2026-01-28까지 등록 의무, Google이 9~20% 수수료 부과 예정). 한국은 별도 대체결제 법규 존재. → **IAP는 지금 deferred, 출시 후 결정.** (실물 상품만이면 Stripe OK)

## 2. 역할 분담

| | **Saesun (사람만 가능)** | **Claude (레포/코드/문서)** |
|---|---|---|
| 계정/콘솔 | Firebase 콘솔, Play Console($25), 결제 | — |
| 로컬 머신 | Android Studio/SDK/JDK 설치, 실기기 빌드·서명 | — |
| 키/시크릿 | 키스토어 생성, SHA 지문 추출 | 추출 명령 제공 |
| 코드 | (검토) | Capacitor 설정, 네이티브 auth 브릿지, gradle 배선 |
| 문서 | (검토) | 개인정보처리방침 초안, 스토어 listing 초안, Data Safety 답안 |

---

## 3. ⚠️ 시작 전 차단 결정 (3개)

1. **`applicationId` (영구 불변 — 출시 후 절대 변경 불가)**
   - 제안: `com.cosmiccoalescence.app` (또는 `io.github.<github_id>.bigbang`)
   - iOS도 나중에 같은 reverse-DNS 쓰는 게 깔끔.
2. **앱 표시명**: 현재 manifest는 `"Big Bang"`. Play 등록명과 일치시킬지(상표/중복 검색 필요할 수 있음).
3. **Play Console 계정 유형** — **타임라인에 큰 영향**:
   - **개인 계정(2023-11 이후 신규)**: 프로덕션 신청 전 **테스터 12명 이상 × 14일 연속 클로즈드 테스트** 의무. → 출시까지 최소 2주 추가. *(정확한 인원/기간은 등록 시점에 콘솔에서 재확인)*
   - **조직 계정**: 위 요건 면제되나 D-U-N-S 등 사업자 검증 필요.

---

## 4. Phase A — 로컬 툴체인 + Capacitor 스캐폴드

**Saesun (Mac):**
- [ ] Node 22+ 설치 확인 (`node -v`)
- [ ] Android Studio Otter 2025.2.1+ 설치 → SDK Manager에서 **Android 16 (API 36)** 플랫폼 + Build-Tools 설치
- [ ] JDK 17+ (Android Studio 내장 사용 가능)

**Claude (레포):**
- [ ] `base` 확인 — Capacitor 빌드는 `base: '/'` 필요. 현재 로컬 빌드는 `/`라 OK. **GitHub Actions 경로(`/repo/`)로는 Capacitor 번들을 만들지 말 것.**
- [ ] Capacitor 8 도입 + android 플랫폼 추가:
```bash
npm i @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Big Bang" com.cosmiccoalescence.app --web-dir=dist
npm run build
npx cap add android
npx cap sync android
```
- [ ] `capacitor.config.ts` 생성(webDir=dist, 서버 설정 등)

**CHECKPOINT:** `npx cap open android` → Android Studio에서 빈 셸 빌드/실행 성공.

## 5. Phase B — Firebase 안드로이드 연결 ★ ("안드로이드용 Firebase"의 본체)

**Saesun (Firebase 콘솔 + Mac):**
- [ ] 프로젝트 `the-big-bang-84499`에 **안드로이드 앱 추가** → 패키지명 = 위 applicationId
- [ ] **SHA-1 + SHA-256 지문** 등록:
  - 디버그: `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android`
  - 릴리스/업로드: Play App Signing 쓰면 Play Console → App integrity에서 복사 (Phase D 이후)
- [ ] `google-services.json` 다운로드 → **`android/app/`** 에 배치
- [ ] Authentication → Settings → Authorized domains에 배포 도메인 확인(웹 로그인 유지용)

**Claude (레포):**
- [ ] Android `build.gradle`에 Google Services 플러그인 배선 (plugin classpath + apply)

**CHECKPOINT:** 안드로이드 앱이 Firebase 콘솔에 보이고 `google-services.json` 인식됨.

## 6. Phase C — 네이티브 구글 로그인 브릿지 (코드, Claude)

**핵심 정밀 포인트:** 기존 `src/cloud/*`(sync/leaderboard)는 전부 **JS SDK의 auth 상태**(`getAuth`)에 의존한다. capawesome 플러그인은 기본적으로 **네이티브 Firebase SDK**에 로그인하므로 JS 상태와 분리됨. → **`skipNativeAuth: true`로 두고, 네이티브에서 받은 idToken을 JS SDK `signInWithCredential`에 넣어** JS의 `onAuthStateChanged`가 발화하게 해야 기존 코드가 그대로 동작한다.

- [ ] 설치: `npm i @capacitor-firebase/authentication && npx cap sync`
- [ ] `capacitor.config.ts`:
```ts
plugins: {
  FirebaseAuthentication: { skipNativeAuth: true, providers: ['google.com'] },
}
```
- [ ] `AuthProvider`를 플랫폼 분기 (`Capacitor.isNativePlatform()`):
```ts
// Native: get idToken via plugin, bridge into JS SDK (which all sync code uses)
async function signInWithGoogleNative() {
  const { credential } = await FirebaseAuthentication.signInWithGoogle();
  const cred = GoogleAuthProvider.credential(credential?.idToken);
  await signInWithCredential(auth, cred);
}
// Web: keep existing signInWithPopup
```
- [ ] `linkWithGoogle`도 동일 분기: 네이티브는 idToken → `linkWithCredential(currentUser, ...)`, `auth/credential-already-in-use` 처리(플랜의 충돌 정책 A 유지)
- [ ] FCM 푸시: 웹뷰 web push는 불안정 → v1은 비활성/스텁, 추후 `@capacitor-firebase/messaging` 네이티브화 (우선순위 낮음)

**CHECKPOINT:** 실기기에서 익명 자동 로그인 → 구글 로그인 → 같은 uid 유지 → Firestore 동기화/리더보드 정상.

## 7. Phase D — 빌드 / 서명 / 실기기 테스트

**Claude:** 매 변경 후 `npm run build && npx cap sync android` 루틴 제공.

**Saesun (Mac):**
- [ ] Android Studio에서 실기기/에뮬레이터 실행 (Canvas 게임 **성능 체감** 확인 — 60fps 유지되는지)
- [ ] **Play App Signing 채택**(권장): 서명키는 Google이 보관, 너는 **업로드 키**만 관리 → 키 분실 위험 ↓
- [ ] 서명된 **AAB**(.aab, APK 아님) 생성, targetSdk 36 확인
- [ ] 릴리스 SHA를 Firebase에 추가(Phase B 보강) — 안 하면 프로덕션 빌드에서 구글 로그인 실패

**CHECKPOINT:** 서명된 AAB가 실기기에서 설치·구동, 프로덕션 서명 상태로 구글 로그인 성공.

## 8. Phase E — Play Console 등록 + 스토어 listing

**Saesun:** Play Console 계정 생성($25, 신원 검증), 앱 생성.

**Claude (초안 제공):**
- [ ] 스토어 listing: 제목/짧은 설명/전체 설명(한·영), 카테고리(게임>캐주얼/시뮬레이션)
- [ ] **개인정보처리방침** URL용 문서 초안 (Firebase Auth 이메일·이름, Firestore 진행데이터, FCM 기기식별자 수집 명시) — **필수**
- [ ] **Data Safety 양식** 답안 (수집 데이터 매핑)
- [ ] 콘텐츠 등급 설문 가이드

**Saesun (에셋):** 폰 스크린샷, 피처 그래픽(1024×500), 512 아이콘(있음). 필요하면 Claude가 스크린샷 캡션/배치 초안.

## 9. Phase F — 테스트 트랙 → 프로덕션

- [ ] (개인 계정이면) 클로즈드 테스트: 테스터 12+ × 14일 → 프로덕션 액세스 신청
- [ ] 단계적 출시(rollout %) 권장
- [ ] 출시 후: 크래시/ANR 모니터링, 리뷰 대응

---

## 10. 크리티컬 패스 / 타임라인 (대략)

```
A 스캐폴드(0.5d) → B Firebase안드로이드(0.5d) → C 네이티브로그인(1~2d)
→ D 빌드·서명·실기기(0.5~1d) → E listing·정책문서(0.5d, 병렬가능)
→ F [개인계정이면 +14일 클로즈드 테스트] → 프로덕션
```
실작업 ~3~4일 + (개인 계정 시) Play 의무 테스트 14일이 최대 병목. 조직 계정이면 14일 생략.

## 11. 검증 단계 (출시 전)

- [ ] 기기 매트릭스: 저가·고가 안드로이드 1대씩 Canvas fps 확인
- [ ] 회귀: 웹(GitHub Pages) 구글 로그인 여전히 동작(분기 깨지지 않음)
- [ ] Firestore Rules Playground: 타 uid 데이터 접근 거부 재확인
- [ ] 프로덕션 서명 빌드에서 로그인(릴리스 SHA 등록 누락 시 실패하는 대표 버그) 점검
- [ ] Pre-launch report(Play Console 자동 로봇 테스트) 크래시 0 확인

## 출처
- [Capacitor Android / Environment Setup](https://capacitorjs.com/docs/android), [Updating to 8.0](https://capacitorjs.com/docs/updating/8-0)
- [capawesome @capacitor-firebase/authentication — setup-google](https://github.com/capawesome-team/capacitor-firebase/blob/main/packages/authentication/docs/setup-google.md)
- [Play Target API level requirements](https://support.google.com/googleplay/android-developer/answer/11926878)
- [Understanding Google Play's Payments policy](https://support.google.com/googleplay/android-developer/answer/10281818), [Can You Use Stripe for IAP in 2026 (Adapty)](https://adapty.io/blog/can-you-use-stripe-for-in-app-purchases/)

---

## 부록 — Phase A 실행 메모 (2026-06-07, Claude)

**완료 (레포 반영 · Mac 이식 가능):**
- `package.json`: `@capacitor/core·cli·android@^8.4.0`, `@capacitor-firebase/authentication@^8.3.0` (firebase ^12 호환 확인)
- `capacitor.config.ts`: `appId=com.cosmiccoalescence.app`, `appName="Big Bang"`, `webDir=dist`, `FirebaseAuthentication { skipNativeAuth:true, providers:['google.com'] }`
- `src/auth/AuthProvider.tsx`: 구글 로그인/링크에 네이티브 분기 추가 — `isNativePlatform()` → `nativeGoogleCredential()`(플러그인 dynamic import) → JS SDK `signInWithCredential`. 웹 `signInWithPopup`은 그대로. **tsc --noEmit 에러 0.**

**Mac에서 마무리 (이 세션 샌드박스는 마운트 FS의 `unlink`/`rm` 제한(EPERM)으로 `cap add`/`cap sync`의 네이티브 생성 단계를 완주 못 함):**
```bash
# 프로젝트 루트(~/게임)에서, Mac 터미널
rm -rf android              # 이 세션이 만든 반쯤-생성된 android/ 제거
npm install                 # package.json의 Capacitor deps 설치
npm run build               # dist 생성 (tsc 통과 필요)
npx cap add android         # 네이티브 프로젝트 정상 생성(패키지 rename 정상)
# → android/variables.gradle 의 ext { } 안에 capawesome 구글 플래그 재적용:
#     rgcfaIncludeGoogle = true
#     androidxCredentialsVersion = '1.3.0'
npx cap sync android        # @capacitor-firebase/authentication gradle 배선 완성
npx cap open android
```
이어서 **Phase B**(google-services.json + SHA-1/256) → **Phase C 마무리**(Firebase 콘솔에서 Google 로그인 활성화) → **Phase D**(서명 AAB).
