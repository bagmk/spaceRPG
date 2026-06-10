# 출시 검수 — Big Bang (com.cosmiccoalescence.app)

> 검수일 2026-06-08. 대상: Capacitor 8 안드로이드/iOS 패키징, Firebase, 수익화, 법적/심사 요건.
> 결론 한 줄: **아직 "다 준비됨" 아님.** 골격(Capacitor·Firebase·로그인·계정삭제·법적문서)은 탄탄하나, **결제 지급 버그 1건 + iOS 상점 UI 문제 1건 + 스토어 에셋/호스팅 미확인**이 차단 요소다.

## 판정 요약

| 영역 | 상태 |
|---|---|
| 빌드 / 타입체크 | ✅ `tsc --noEmit` 통과 (vite build는 Mac에서 정상, dist/ 존재) |
| Capacitor/식별자/SDK 버전 | ✅ appId·bundleId 일치, targetSdk 36 / minSdk 24 |
| Firebase 설정(양 플랫폼) | ✅ google-services.json + GoogleService-Info.plist 배치, bundle 일치 |
| 로그인(Apple/Google 네이티브 브릿지) | ✅ 코드 완료, entitlement·URL scheme 존재 |
| 계정 삭제 / 동의 게이트 / 개인정보처리방침 | ✅ 구현·문서화(개인정보방침이 AdMob·IAP 반영) |
| **네이티브 IAP 지급** | 🔴 **결제 성공해도 아이템 미지급 (Android 포함)** |
| **iOS 상점/광고 UI** | 🔴 **버튼은 보이나 동작 안 함 → 리젝 위험** |
| **개인정보/약관 URL 배포** | 🟠 호스팅 라이브 여부 미확인 (필수) |
| 스토어 listing 에셋(스크린샷/피처그래픽) | 🟠 없음 |

---

## 🔴 차단 요소 (출시 전 반드시)

### B1. 네이티브 결제가 성공해도 아이템을 지급하지 않음 — 최우선
가장 중요한 발견. **돈은 빠지고 효과는 없는** 상태로 Android(수익화 켜진 플랫폼)에서 발생한다.

원인 2가지가 겹침:
1. **지급 액션 미발화.** `ShopPanel.handlePaid()`가 `completePurchase(product)`의 반환값(`PurchaseResult`)을 그냥 버리고 `COMPLETE_SHOP_PURCHASE`를 dispatch하지 않는다. 실제로 코드 전체에서 이 액션은 **런타임에서 한 번도 dispatch되지 않음**(리듀서 핸들러·테스트에만 존재). 웹은 Stripe 리다이렉트+서버 정산 전제라 클라 지급이 없어도 되지만, **네이티브(RevenueCat)는 리다이렉트가 없으므로 그대로 미지급**.
2. **소비성 성공 판정 오류.** `completePurchaseNative()`가 성공을 `Object.keys(customerInfo.entitlements.active).length > 0`로 판단. 그런데 유료 4종(`temporal_drive`·`matter_surge`·`deep_time_engine`·`matter_storm`)은 **repeatable timed boost = 소비성(consumable)** 이라 RevenueCat이 entitlement를 채우지 않음 → 항상 `success:false`. (`deep_space_storage`만 non-consumable이라 entitlement로 잡힘.)

**수정 방향**
- 네이티브 성공 시 소비성은 트랜잭션/`nonSubscriptionTransactions` 기준으로 성공 판정하고, 성공하면 `dispatch({ type:'COMPLETE_SHOP_PURCHASE', itemId: product.id, now: Date.now() })`로 지급.
- non-consumable(저장소 확장)은 entitlement/restorePurchases로 복원 처리.
- 지급을 **서버 정산(RC webhook→Firestore→sync)** 로 갈지, **클라 지급**으로 갈지 먼저 결정. 클라 지급이면 위 dispatch로 충분, 서버 정산이면 RC webhook 핸들러가 별도로 필요.
- RC 대시보드 offering의 **package identifier가 product.id와 정확히 일치**해야 `availablePackages.find(p.identifier === product.id)`가 잡힘(현재 코드 가정). 기본 `$rc_…` 식별자면 매칭 실패 → 별도 확인(W3).

### B2. iOS에서 상점·광고 버튼이 보이지만 동작하지 않음 (App Store 리젝 위험)
`capacitor.config.ts`의 `ios.includePlugins`가 **auth 플러그인만** 포함한다(AdMob·RevenueCat·LocalNotifications는 SPM 바이너리 호환 이슈로 의도적 제외). 게다가 `RC_KEYS.ios = 'appl_PLACEHOLDER'`.

그런데 `ShopPanel`에는 **플랫폼 분기가 없어** iOS에서도 유료 상품과 "광고 보기" 버튼이 노출된다. 탭하면 네이티브 메서드 부재로 throw→catch→무반응. Apple Guideline 2.1(비작동 기능)으로 리젝될 수 있고, 정상 통과해도 UX가 깨진다.

**선택지 (v1 권장: A)**
- **A. iOS v1을 결제·광고 없이 출시.** `ShopPanel`에서 `Capacitor.getPlatform() === 'ios'`일 때 유료 섹션과 rewarded-ad 섹션을 숨긴다. 문서(IOS_LAUNCH_PLAN)의 "IAP deferred"와도 일치. 가장 빠름.
- **B. iOS에도 수익화 탑재.** SPM 바이너리 호환 해결 후 `includePlugins`에 AdMob·RevenueCat 추가 + iOS RC 키 입력 + Info.plist에 `GADApplicationIdentifier`·`SKAdNetworkItems`·`NSUserTrackingUsageDescription`(ATT) 추가. 작업량 큼 → v1 이후 권장.

### B3. 개인정보처리방침 / 약관 URL 라이브 여부 (양 스토어 필수)
코드·심사 모두 `https://the-big-bang-84499.web.app/privacy.html`, `.../terms.html`을 사용. **Firebase Hosting에 실제 배포돼 있어야** 스토어 등록·심사·앱 내 동의 링크가 작동한다. (검수 환경에서 URL 확인이 타임아웃 — 직접 확인 필요.)
- 확인: 브라우저로 두 URL 200 OK인지. 아니면 `firebase deploy --only hosting`.
- Play는 "데이터 삭제" URL도 요구 → `delete-account.html`도 같은 호스트에 배포.

---

## 🟠 경고 (출시 가능하나 확인/리스크)

**W1. 스토어 listing 에셋 부재.** `assets/`엔 음악뿐. **폰 스크린샷(양 스토어 필수)**, **Play 피처 그래픽 1024×500**이 없다. 앱 아이콘(512/1024)은 있음. 스크린샷 없이는 제출 불가 → 실기기/시뮬레이터 캡처 필요.

**W2. 스토어 연락 이메일 `saysoonkim@gmail.com`.** 로그인/계정 이메일 `saesunkim@gmail.com`과 **한 글자 다름**(saysoon vs saesun). 의도면 OK, 오타면 심사 회신·계정삭제 요청 메일이 유실된다. privacy/terms/delete-account 3개 문서 전부 동일 주소 → 한 번에 확인.

**W3. RevenueCat offering ↔ product.id 매핑.** B1 수정과 함께, RC 대시보드 offering의 package identifier가 `temporal_drive` 등 product.id와 일치하도록 구성됐는지 확인.

**W4. Android `AD_ID` 권한 + Data Safety 일치.** targetSdk 36에서 광고 식별자 사용 시 `com.google.android.gms.permission.AD_ID` 필요(보통 AdMob SDK 매니페스트 머지로 포함). 최종 머지 매니페스트에서 확인하고, Play **Data Safety**에 "광고 ID 수집"을 신고해 일치시킬 것.

**W5. iOS 화면 방향.** Info.plist가 iPhone 가로(Landscape)를 허용. 게임이 세로 전용이면 가로에서 레이아웃 깨질 수 있음 → 세로 고정 검토.

**W6. Android release `minifyEnabled false`.** R8 축소/난독화 꺼짐. 차단은 아니나 AAB 크기·기본 보호에 영향.

**W7. 커밋 위생.** `android/`·`ios/`가 아직 untracked. 커밋 전: ① 업로드 **keystore(.jks)·.p8는 절대 커밋 금지**(현재 레포에 없음 — 유지), ② `google-services.json`/`GoogleService-Info.plist`는 클라이언트 설정이라 커밋해도 무방. 레포에 쌓인 `vite.config.ts.timestamp-*.mjs`(이미 gitignore됨)와 빌드 잔여물 정리 권장.

---

## ✅ 정상 확인됨
- `tsc --noEmit` 0 에러. (sandbox의 `vite build` 실패는 rollup linux 네이티브 바이너리 누락 — **환경 문제, 코드 무관**. node_modules가 darwin-arm64로 설치돼 있고 dist/ 53개 파일 존재.)
- 식별자/버전: applicationId=bundleId=`com.cosmiccoalescence.app`, targetSdk 36 / minSdk 24 / compileSdk 36, 표시명 "Big Bang" 전 영역 일치.
- Firebase: 양 플랫폼 설정 파일 배치, GoogleService-Info BUNDLE_ID 일치, iOS Google URL scheme(REVERSED_CLIENT_ID) 존재.
- 로그인: Apple/Google 네이티브 브릿지(`skipNativeAuth:true` → `signInWithCredential`) 코드 완료, **Sign in with Apple** entitlement 존재(Guideline 4.8 충족).
- 계정 삭제(Guideline 5.1.1(v)) 구현, 동의 게이트(약관·개인정보 링크 KO/EN) 존재, 개인정보처리방침 v2가 AdMob·소비성 IAP·푸시·광고 식별자 반영.
- Android 플러그인 배선 정상: capacitor.build.gradle에 admob·revenuecat·firebase-auth·local-notifications 모두 포함. AdMob app id(`ca-app-pub-5232675103934625~3717124001`)·광고 단위 id 설정. Android RC 키 실값.
- 시크릿 노출 없음: RC 공개키·AdMob id·Firebase client config는 모두 공개 전제값. `.env`/`.env.local`은 gitignore.

---

## 출시 전 체크리스트 (우선순위 순)

1. [ ] **B1** 네이티브 결제 지급 수정 — 소비성 성공 판정 + `COMPLETE_SHOP_PURCHASE` dispatch. 실기기 결제 후 부스트 적용 확인.
2. [ ] **B2** iOS 상점/광고 UI 플랫폼 분기 — `getPlatform()==='ios'`에서 유료·광고 섹션 숨김(v1).
3. [ ] **B3** privacy/terms/delete-account 호스팅 라이브 확인 또는 `firebase deploy --only hosting`.
4. [ ] **W1** 폰 스크린샷 + Play 피처 그래픽 1024×500 제작.
5. [ ] **W2** 연락 이메일 saysoonkim vs saesunkim 확정.
6. [ ] **W3** RC offering package identifier ↔ product.id 매핑 확인(B1과 함께).
7. [ ] **W4** 머지 매니페스트 AD_ID 권한 + Play Data Safety 광고 ID 신고.
8. [ ] (Mac) Android: 서명 AAB(Play App Signing) / iOS: Archive→TestFlight, 실기기 60fps·로그인·결제 회귀.
9. [ ] (Play 개인계정이면) 클로즈드 테스트 12명×14일 일정 확보.
