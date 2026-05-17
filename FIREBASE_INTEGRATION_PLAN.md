# Firebase 통합 플랜 — 로그인, 클라우드 세이브, 캐릭터 이름, 결제, 랭킹

> Claude Code 에이전트 지침: 이 문서는 **단순 참고가 아니라 실행 프로토콜**이다.
> 매 작업 세션 시작 시 이 파일을 처음부터 끝까지 읽고, 현재 진행 단계(Status 섹션)를 확인한 뒤,
> 해당 Phase의 **DECISION POINT**를 사용자에게 묻기 전까지는 코드를 작성하지 마라.

---

## 작업 원칙 (Working Protocol)

1. **Phase 단위로만 진행한다.** 한 번에 여러 Phase를 묶어서 처리하지 않는다.
2. 각 Phase 시작 전 `## DECISION POINT` 항목을 **AskUserQuestion**으로 사용자에게 묻는다. 답을 받기 전엔 코드를 쓰지 않는다.
3. 사용자가 답한 결정은 이 문서의 `## Status` 섹션 아래에 `Decided:` 라인으로 누적 기록한다.
4. 각 Phase 끝나면 `## CHECKPOINT` 항목을 사용자에게 보여주고 "통과" 여부를 받는다. 통과 전엔 다음 Phase로 넘어가지 않는다.
5. 시크릿(Firebase config, Stripe key, Apple key 등)은 **반드시 `.env.local`** 에 쓰고 `.gitignore`에 포함됐는지 확인한다. 실수로 커밋되면 즉시 사용자에게 알린다.
6. 외부 종속성(Firebase SDK 등) 추가 시 `package.json`의 기존 컨벤션(`^` 범위, alphabetical)을 따른다.
7. 기존 `src/game/storage.ts`와 `src/game/storage/migrate.ts` 의 마이그레이션 시스템을 **재사용**한다 — 새로 만들지 마라.

---

## Status (Claude Code가 매 세션 업데이트)

```
Current Phase: 4 (starting)
Decided:
  - Firebase project: the-big-bang-84499 (already created)
  - Scope: Full (Phase 1~4 + Apple login + Stripe IAP)
  - Deploy domain: GitHub Pages (*.github.io)
  - Google Sign-in: enabled
  - Anonymous Sign-in: enabled
  - Firestore: created (Native mode)
  - App Check: deferred
  - Login UI: IntroScreen + SettingsPanel both
  - Link conflict: A (switch to existing account, discard anonymous)
  - Name rules: 2~16 chars, 한/영/숫자/공백, unique enforced, simple blacklist
  - Name change limit: unlimited
  - Anonymous name: B (Google login required for name)
  - First name UX: A (forced modal, no skip)
  - Unique check: A (Firestore Transaction)
Last Checkpoint Passed: Phase 2
  - Phase 3A (Apple): deferred (no Apple Developer account)
  - Phase 3B (Stripe): deferred (no Stripe account yet, will use existing shop items)
Open Questions:
  - (none)
```

> 한 Phase가 끝날 때마다 `Current Phase`, `Decided`, `Last Checkpoint Passed`를 업데이트해서 커밋한다.

---

## 전체 흐름 한눈에

| Phase | 목표 | 예상 소요 | 결과물 |
|-------|------|----------|--------|
| 0 | Firebase 콘솔 셋업 + 환경 변수 수령 | 1~2시간 (사용자 작업) | `.env.local`, 빈 Firestore, 활성 프로바이더 |
| 1 | Auth + 캐릭터 이름 설정 + 로그인 UI | 1일 | 로그인, 이름 설정/변경, `useAuth()` 훅 |
| 2 | Firestore 세이브 동기화 (last-write-wins) | 1~2일 | 멀티 디바이스 진행 유지, 오프라인 fallback |
| 3 | (선택) Apple 로그인, (선택) Stripe IAP | 1~3일 | 결제 권한(entitlements) 시스템 |
| 4 | 엔트로피 랭킹 (Leaderboard) | 1~2일 | 공개 랭킹 페이지, 본인 순위 표시 |

---

## Phase 0 — Firebase 콘솔 셋업

### 목표
사용자가 Firebase 콘솔에서 프로젝트를 만들고, Claude Code가 코드를 짜는 데 필요한 모든 입력값을 확보한다.

### DECISION POINT (Claude Code가 사용자에게 물을 것)
1. **Firebase 프로젝트를 이미 만들었는가?** (예: 프로젝트 ID 알려달라 / 아니오: 단계별 안내 시작)
2. **Apple 로그인을 이번 작업에 포함할까?** (예/아니오 — Phase 3의 Apple 분기 활성화)
3. **결제(Stripe IAP)를 이번 작업에 포함할까?** (예/아니오 — Phase 3의 Stripe 분기 활성화)
4. **랭킹(Phase 4)을 이번 작업에 포함할까?** (예/아니오 — Phase 4 진행 여부)
5. **배포 도메인은?** (GitHub Pages 기본 `*.github.io` / 커스텀 도메인 → Apple Service ID와 Firebase Authorized domains에 반영 필요)

### 사용자에게 안내할 셋업 순서
Claude Code는 사용자가 콘솔에서 다음을 마쳤는지 한 단계씩 확인하며 진행한다. 각 단계 후 입력값을 받는다.

1. **Firebase 프로젝트 생성**
   - 콘솔: https://console.firebase.google.com → "프로젝트 추가"
   - 받을 값: 프로젝트 ID
2. **웹 앱 등록**
   - 프로젝트 → "</>" 아이콘 → "Register app"
   - 받을 값: `firebaseConfig` 객체 (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId)
3. **Authentication 활성화**
   - Build → Authentication → Get Started
   - Sign-in method 탭에서: Google 토글 ON, Anonymous 토글 ON
   - Apple은 Phase 3 진입 시 활성화 (지금은 건너뜀)
4. **Authorized domains 확인**
   - Authentication → Settings → Authorized domains
   - `localhost`는 기본 포함. 배포 도메인을 여기에 추가.
5. **Firestore Database 생성**
   - Build → Firestore Database → Create database
   - Mode: **Native mode**
   - Location: `asia-northeast3` (Seoul) — 사용자가 한국 기반인 경우 권장
   - Rules: 처음엔 Test mode로 시작 (Phase 1 끝나면 실제 규칙으로 교체)
6. **App Check 활성화 (선택, 강력 권장)**
   - Build → App Check → Apps → 웹 앱 선택 → reCAPTCHA v3 등록
   - 받을 값: reCAPTCHA site key
7. **Cloud Functions 활성화 (Phase 1 이름 유니크 강제 / Phase 4 랭킹 검증용 — 선택)**
   - Build → Functions → Get Started → Blaze 플랜으로 업그레이드 (소량 무료, 카드 등록 필요)
   - Phase 1 에서 이름 유니크를 클라이언트 transaction 으로만 처리하면 불필요. 강력한 검증 원하면 필수.

### 출력 산출물 (Claude Code가 생성)
- `.env.local` — 다음 변수 포함:
  ```
  VITE_FIREBASE_API_KEY=
  VITE_FIREBASE_AUTH_DOMAIN=
  VITE_FIREBASE_PROJECT_ID=
  VITE_FIREBASE_STORAGE_BUCKET=
  VITE_FIREBASE_MESSAGING_SENDER_ID=
  VITE_FIREBASE_APP_ID=
  VITE_RECAPTCHA_SITE_KEY=        # App Check 쓰는 경우만
  ```
- `.env.local`이 `.gitignore`에 있는지 확인 (`.env*.local` 패턴이 일반적)
- `.env.example` — 위 키들을 빈 값으로 커밋용

### CHECKPOINT
- [ ] `.env.local` 파일이 존재하고 모든 Firebase 키가 채워졌다
- [ ] `.gitignore`가 `.env.local`을 제외한다
- [ ] Firebase 콘솔에서 Google + Anonymous Sign-in이 활성화됐다
- [ ] Firestore 데이터베이스가 생성됐다 (빈 상태)

---

## Phase 1 — Auth + 캐릭터 이름

### 목표
앱 부팅 시 자동 Anonymous 로그인. "Google로 로그인" 버튼 → 익명 계정과 link. 첫 Google 로그인 직후 캐릭터 이름(displayName) 설정 모달이 강제되고, 이후 설정 메뉴에서 변경 가능. 게임 데이터는 아직 클라우드로 안 보냄(Phase 2).

### DECISION POINT
1. **로그인 UI 위치는?** (옵션: 우측 상단 작은 아바타 / 일시정지 메뉴 안 / 별도 LoginScreen / 기존 IntroScreen에 추가)
2. **익명 → Google 링크 실패 시 (같은 Google 계정이 이미 존재) 어떻게 처리?**
   - A: 기존 계정으로 전환 + 익명 진행 폐기 (단순)
   - B: "기존 클라우드 vs 현재 로컬" 다이얼로그 (복잡, Phase 2에서 의미 있음)
   - 권장: Phase 1에선 A, Phase 2 끝나면 B로 업그레이드
3. **캐릭터 이름 규칙은?**
   - 길이 범위 (예: 2~16자)
   - 허용 문자 (예: 한글/영문/숫자/공백, 일부 기호)
   - 유니크 강제 여부 (예: 강제 — 같은 이름 두 명 불가 / 비강제 — 중복 허용 + 내부 식별자로만 구분)
   - 욕설/금지어 필터 (없음 / 간단 블랙리스트 / 외부 API)
   - 권장: 2~16자, 한글+영문+숫자+공백, 유니크 강제, 간단 블랙리스트
4. **이름 변경 제한 정책은?**
   - A: 무제한 (관리 단순, 어뷰징 가능)
   - B: N일에 1번 (예: 30일)
   - C: 1회는 무료, 이후 게임 내 화폐 소비
   - 권장: B (30일 1회) — 랭킹에 노출되는 이름이므로 잦은 변경은 신뢰성 해침
5. **익명 사용자도 이름 설정 강제?**
   - A: 익명도 이름 설정 가능 (단, 랭킹엔 노출 안 함)
   - B: Google 로그인 후만 이름 설정 가능
   - 권장: B (익명은 임시 진행, 이름은 정식 계정 전환 후)
6. **첫 이름 설정 UX는?**
   - A: Google 로그인 직후 강제 모달 (스킵 불가)
   - B: 로그인 직후 모달 (스킵 가능 → 랭킹 진입 시 다시 요구)
   - C: 사용자가 직접 설정 메뉴로 들어가서 입력
   - 권장: A (가장 단순, 랭킹 기능 켜져 있을 때)
7. **유니크 강제 시 이름 충돌 검사 방법은?**
   - A: 클라이언트 Firestore Transaction (`displayNames/{nameLower}` reverse index, 단순)
   - B: Cloud Function (서버 사이드 검증, 어뷰징/스크립트 차단 강함)
   - 권장: A 로 시작, 어뷰징 발생 시 B 로 업그레이드

### 데이터 모델 (이 Phase 에서 쓰는 것)

```
users/{uid}/profile
  └─ {
       email,                  // auth provider 제공 (Google/Apple) — 익명은 null
       photoURL,               // auth provider 제공 — null 가능
       displayName,            // ★ 게임 전용 캐릭터 이름 (사용자 설정, 랭킹에 노출)
       displayNameLower,       // displayName.toLowerCase().trim() — 유니크 검사 + 검색용
       nameChangedAt,          // 마지막 이름 변경 시각 (변경 잠금 정책에 사용)
       createdAt,
       lastLoginAt,
       providers: ["google.com" | "apple.com" | "anonymous"]
     }

displayNames/{displayNameLower}     // ★ 이름 유니크 reverse index (강제 시에만)
  └─ { uid, claimedAt }
```

> **중요**: `displayName` 은 **auth provider 의 displayName 과 다른 별개 필드**다. Google 이 주는 이름은 `profile.email` 옆에 임시 디폴트로만 쓸 수 있고, 실제로는 사용자가 명시 입력한 값만 `displayName` 에 저장한다.

### 구현 단계
1. 종속성 추가:
   ```bash
   npm install firebase
   ```
2. `src/cloud/firebase.ts` 생성 — `initializeApp`, `getAuth`, `getFirestore`. 환경변수에서 config 로드.
3. `src/auth/AuthProvider.tsx` — React Context. `useAuth()` 훅 export. 필드: `{ user, profile, status: 'loading'|'anonymous'|'authed'|'needsName'|'signedOut', signInWithGoogle, signOut, linkWithGoogle }`. `needsName` 은 Google 로그인됐지만 `profile.displayName` 없는 상태.
4. 앱 마운트 시 `onAuthStateChanged` 구독. 사용자 없으면 `signInAnonymously()` 자동 호출.
5. `src/cloud/profile.ts`:
   - `getProfile(uid): Promise<Profile | null>` — `users/{uid}/profile` 읽기
   - `claimDisplayName(uid, name): Promise<{ok: true} | {ok: false, reason: 'taken'|'invalid'|'locked'}>` — Firestore Transaction:
     1. `displayNames/{nameLower}` 존재 확인 → 있으면 `taken`
     2. 기존 `profile.displayName` 있으면 옛 reverse index 삭제
     3. 새 `displayNames/{newNameLower}` 생성, `profile` 업데이트, `nameChangedAt = serverTimestamp()`
     4. 변경 잠금 정책(30일 등)은 트랜잭션 안에서 `nameChangedAt` 검증
   - `validateDisplayName(name): {ok: true} | {ok: false, reason: 'length'|'chars'|'profanity'}` — 클라이언트 검증 (UX 빠른 피드백)
6. `src/components/NameSetupModal.tsx` — Google 로그인 직후 `status === 'needsName'` 일 때 자동 표시:
   - 입력창 + 실시간 검증 (길이, 문자, 사용 가능 여부 debounced 조회)
   - "시작하기" 버튼 → `claimDisplayName()` 호출 → 성공 시 모달 닫기, 실패 시 에러 표시
   - 스킵 불가 (정책 A 선택 시) — 모달 바깥 클릭/ESC 무시
7. `src/components/SettingsPanel.tsx` (또는 기존 설정 패널에 섹션 추가):
   - 현재 이름 표시 + "변경" 버튼
   - "변경" → 모달 with 동일 입력 + 검증
   - `nameChangedAt + 30일 > now` 이면 버튼 disable + "변경 가능 시점: YYYY-MM-DD" 표시
8. `src/components/LoginButton.tsx` — 로그인 안 됐을 때 "Google로 계속하기" 버튼, 됐을 때 아바타+displayName+로그아웃 메뉴.
9. `App.tsx`에 `<AuthProvider>` 래핑. LoginButton + NameSetupModal 을 결정된 위치에 배치.
10. `firestore.rules` 초안 (Phase 2 에서 본격 강화, 여기선 최소):
    ```javascript
    rules_version = '2';
    service cloud.firestore {
      match /databases/{database}/documents {
        match /users/{userId}/{document=**} {
          allow read, write: if request.auth != null && request.auth.uid == userId;
        }
        match /displayNames/{nameLower} {
          allow read: if request.auth != null;        // 사용 가능 여부 조회
          allow write: if request.auth != null
                       && request.resource.data.uid == request.auth.uid;
        }
      }
    }
    ```
11. **테스트**:
    - 시크릿 모드 → 자동 익명 로그인 → 이름 모달 안 뜸 (정책 5-B)
    - Google 로그인 → 이름 모달 강제 → 저장 → Firestore profile + displayNames 둘 다 확인
    - 동일 이름으로 다른 계정 진입 시도 → `taken` 거부
    - 설정에서 이름 변경 → 30일 잠금 동작 (시계 조작 또는 nameChangedAt 수동 조작 후)

### 절대 하지 말 것
- `signInWithPopup` 의 에러를 무시하지 마라. `auth/popup-blocked`, `auth/credential-already-in-use` 는 명시적으로 처리.
- 기존 `localStorage` 세이브 로직을 건드리지 마라. 이 Phase 는 Auth + 이름만.
- Auth provider 의 displayName (Google/Apple 이 주는 이름) 을 그대로 `profile.displayName` 으로 쓰지 마라 — 사용자가 명시 설정한 값만 저장.
- 이름 유니크 검사를 클라이언트 단순 read 로만 하지 마라 — 반드시 Firestore Transaction 으로 race condition 차단.
- 욕설 필터를 클라이언트 UI 차단에만 의존하지 마라 — 어뷰저는 직접 SDK 호출 가능. Cloud Function 또는 보안 규칙으로 서버 사이드도 검증.
- `AuthProvider` 의 user 객체를 redux/zustand 스타일로 글로벌 전역에 두지 마라 — Context 안에 머물게.

### CHECKPOINT
- [ ] 시크릿 모드에서 부팅 시 콘솔에 Firebase Auth user uid 가 찍힌다
- [ ] Google 로그인 → 같은 uid 유지(link) 확인
- [ ] 다른 디바이스/브라우저에서 같은 Google 계정으로 로그인 → 동일 uid 확인
- [ ] 첫 Google 로그인 시 이름 설정 모달이 뜨고, 저장 시 `users/{uid}/profile.displayName` + `displayNames/{nameLower}` 둘 다 생성됨
- [ ] 동일 이름으로 다른 계정 입력 시 거부됨 (Transaction race 포함)
- [ ] 설정 메뉴에서 이름 변경 가능, 잠금 정책 동작 확인
- [ ] 익명 사용자에게는 이름 설정 UI 가 나타나지 않음 (정책 5-B)
- [ ] 빌드 (`npm run build`) 통과
- [ ] 기존 게임 진행에 영향 없음 (회귀 없음)

---

## Phase 2 — Firestore 세이브 동기화

### 목표
기존 `SaveState`(`src/game/types.ts`)를 그대로 `users/{uid}/saves/main`에 미러링. 로컬 + 원격 둘 다 유지, 충돌 시 `updatedAt` 큰 쪽 채택 (last-write-wins).

### DECISION POINT
1. **Phase 1 에서 미룬 충돌 다이얼로그(기존 클라우드 vs 현재 로컬)를 지금 만들까?**
   - 안 만들면 last-write-wins 로 사용자 모르게 덮어쓸 수 있음
   - 권장: 만들기. 단, 차이 임계값 정의 필요 (예: `condensedMass` 차이가 10% 이상이거나 `totalTimePlayed` 차이가 30분 이상일 때만 모달)
2. **익명 사용자도 Firestore에 쓸까?**
   - 네: 익명 진행도 클라우드 백업 (브라우저 캐시 날아가도 복구 가능, 단 익명 uid 는 디바이스 묶임이므로 새 기기에서 복구 못함)
   - 아니오: Google 로그인 후부터만 동기화
   - 권장: 익명도 쓰기. Auth 는 어차피 익명도 uid 발급함.

### 데이터 모델 (확정 — Phase 1 의 profile 모델 포함)

```
users/{uid}
  ├─ profile        {
  │                    email,
  │                    photoURL,
  │                    displayName,             // 게임 전용 캐릭터 이름
  │                    displayNameLower,        // 유니크 검사용
  │                    nameChangedAt,           // 변경 잠금용
  │                    createdAt, lastLoginAt,
  │                    providers: [...]
  │                  }
  └─ settings       { soundOn, musicVolume, language, reducedMotion }   // 게임 내 옵션 (선택적)

users/{uid}/saves/main
  └─ {
       schemaVersion: number,    // SaveState.version 재사용 (현재 12)
       data: SaveState,          // 통째로 저장 (수십 KB, Firestore 1MB 한도 내)
       updatedAt: serverTimestamp,
       deviceId: string,         // crypto.randomUUID() 로 첫 생성 후 localStorage에 보관
       writeSeq: number          // 단조증가 카운터, 충돌 감지용
     }

displayNames/{displayNameLower}     // Phase 1 에서 생성됨, 그대로 유지
  └─ { uid, claimedAt }
```

### 구현 단계
1. `src/cloud/sync.ts` 생성:
   - `pullRemoteSave(uid): Promise<SaveState | null>` — Firestore에서 읽기, 없으면 null
   - `pushRemoteSave(uid, save: SaveState): Promise<void>` — `setDoc` with merge:true
   - `subscribeRemoteSave(uid, cb)` — 다른 디바이스에서의 변경 실시간 반영 (선택)
2. `src/cloud/deviceId.ts` — 첫 호출 시 UUID 생성 후 `localStorage['device_id']`에 저장, 이후 동일 값 반환.
3. `src/game/storage.ts` 의 `loadGame()` 수정:
   - 기존: localStorage에서만 로드
   - 신규: localStorage + Firestore 둘 다 로드 → `updatedAt` 큰 쪽 채택
   - 둘 다 있으면 차이 비교 후 임계값 넘으면 충돌 모달 트리거 (이벤트 emit)
4. `src/game/storage.ts` 의 `saveGame()` 수정:
   - 즉시 localStorage 저장(기존 동작 유지)
   - Firestore 푸시는 debounce 5초 (`setTimeout` 기반 단순 구현)
   - `writeSeq` 증가
5. `src/components/SyncConflictModal.tsx` — "이 기기의 진행"과 "클라우드의 진행"을 나란히 보여주고 사용자가 선택.
6. `firestore.rules` 강화 (Phase 1 초안을 교체):
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId}/{document=**} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
       match /displayNames/{nameLower} {
         allow read: if request.auth != null;
         allow create: if request.auth != null
                       && request.resource.data.uid == request.auth.uid;
         allow update, delete: if request.auth != null
                       && resource.data.uid == request.auth.uid;
       }
     }
   }
   ```
7. `firebase.json` 추가하고 `firebase deploy --only firestore:rules` 로 배포 (Firebase CLI 필요 — Claude Code 가 사용자에게 설치 안내).
8. **테스트**: PC에서 진행 → Firestore에 문서 생성 확인 → 핸드폰 브라우저로 같은 Google 로그인 → 진행 이어받기.

### 절대 하지 말 것
- `SaveState` 의 새 필드를 Firestore 동기화 위해 추가하지 마라. 기존 그대로 dump.
- 매 게임 tick 마다 Firestore 에 쓰지 마라 — debounce 5초가 최소. 비용 폭발.
- localStorage 폴백을 제거하지 마라 — 오프라인/Auth 실패 시 필수.
- `enableIndexedDbPersistence()` 같은 deprecated API 쓰지 말고 modular SDK 의 `persistentLocalCache` 사용.

### CHECKPOINT
- [ ] 두 디바이스에서 동일 Google 계정 로그인 → 진행 동기화 확인
- [ ] 비행기 모드 → 게임 진행 가능 (localStorage 만으로)
- [ ] 비행기 모드 해제 → 자동 푸시
- [ ] Firestore 콘솔에서 본인 uid 외 다른 uid 문서를 읽으려 하면 거부됨 (Rules Playground 로 확인)
- [ ] 충돌 모달 트리거 케이스 확인 (한 디바이스에서 진행, 동기화 전 다른 디바이스에서 진행)

---

## Phase 3 — (선택) Apple 로그인, (선택) Stripe IAP

### 목표
Phase 0 의 결정에 따라 다음 중 하나 또는 둘 다 구현:
- **3A**: Apple 로그인 추가
- **3B**: Stripe 기반 결제 + entitlements 시스템

### Phase 3A — Apple 로그인

#### DECISION POINT
1. **Apple Developer 계정이 있는가?** ($99/년 멤버십 필수)
   - 없으면: Phase 3A 보류 권장
2. **배포 도메인이 HTTPS 인가?**
   - GitHub Pages `*.github.io` 는 HTTPS 자동 → OK
   - 커스텀 도메인이면 SSL 인증서 확인 필요
3. **Apple "이메일 숨기기" 사용자의 이메일을 마케팅에 쓸 계획?**
   - 쓸 거면 Apple Developer 에서 도메인 인증 + 이메일 릴레이 설정 필요
   - 안 쓰면 그냥 식별자로만 보관

#### 구현 단계
1. **Apple Developer 셋업** (사용자 작업):
   - Identifiers → "+" → App IDs 또는 Services IDs
   - Service ID 생성 (예: `com.cosmiccoalescence.web`), "Sign in with Apple" 활성화
   - Configure → Web Domain + Return URLs (Firebase auth domain: `<project>.firebaseapp.com/__/auth/handler`)
   - Keys → "+" → "Sign in with Apple" 키 생성 → `.p8` 파일 다운로드 + Key ID, Team ID 기록
2. **Firebase 콘솔**:
   - Authentication → Sign-in method → Apple → Enable
   - Service ID, Apple Team ID, Key ID, Private key (.p8 내용) 입력
3. **코드**:
   - `AuthProvider` 에 `signInWithApple` / `linkWithApple` 추가
   - `OAuthProvider('apple.com')` 사용, `signInWithPopup`
   - **첫 응답에서만** displayName/email 이 옴 → 즉시 `users/{uid}/profile.email` 에 저장 (단, **profile.displayName 은 건드리지 마라** — 사용자가 게임에서 설정한 이름과 별개)
4. **LoginButton 에 Apple 버튼 추가** — Apple 가이드라인 준수(공식 로고/색상)

#### CHECKPOINT
- [ ] Safari + Chrome + Firefox 에서 Apple 로그인 동작 확인
- [ ] 이메일 숨기기 옵션 선택 시 relay 이메일 처리 확인
- [ ] 첫 로그인 시 email 이 Firestore profile.email 에 저장됨 (displayName 은 별도 모달로 유지)

### Phase 3B — Stripe IAP

#### DECISION POINT
1. **판매할 상품 목록?** (예: "광고 제거 $4.99", "스킨 팩 $2.99", "프리미엄 구독 $4.99/월")
2. **상품 유형?** (one-time / subscription / consumable)
3. **세금 처리?**
   - Stripe Tax 활성화 (간편, 추가 0.5%)
   - Merchant of Record(MoR) 서비스로 우회 (Paddle, Lemon Squeezy — 그러면 Stripe Extension 사용 X)
4. **환불 정책 + 약관 문서 준비됐는가?** (Apple/Google 앱스토어에선 의무, 웹도 권장)

#### 구현 단계
1. **Stripe 계정 셋업** (사용자 작업):
   - dashboard.stripe.com → 비즈니스 정보 + 은행 입력
   - Test mode에서 상품 생성 (Products → Add)
   - 받을 값: Publishable key (`pk_test_...`), Secret key (`sk_test_...`)
2. **Firebase Extension 설치**:
   - 콘솔 → Extensions → "Run Payments with Stripe" 설치
   - Stripe Secret key 입력 → Extension 이 `customers`, `products`, `prices`, `payments`, `subscriptions` Firestore 컬렉션 자동 생성/동기화
3. **상품 카탈로그**:
   - Stripe 에서 Firebase Extension webhook 으로 자동 동기화 → `products`, `prices` 컬렉션 읽으면 됨
4. **코드**:
   - `src/cloud/checkout.ts` — `createCheckoutSession(priceId)`:
     - `users/{uid}/checkout_sessions` 에 doc 생성 → Extension 이 Stripe Session 생성 → `url` 필드 watching → redirect
   - `src/cloud/entitlements.ts` — Stripe webhook 이 `payments` collection 에 `status: 'succeeded'` 로 쓰면, Cloud Function 이 `users/{uid}/entitlements/{productId}` 작성 (active: true)
   - **클라이언트는 `entitlements` 읽기 전용**. 보안 규칙으로 강제.
5. **게임 내 상점 UI**:
   - 기존 게임 내 화폐 상점 (`reducers/shop.ts`) 과는 별개. 실제 화폐 상점 컴포넌트 신규.
   - `useEntitlements()` 훅으로 권한 체크 → 광고 제거, 스킨 적용 등
6. **보안 규칙 추가**:
   ```javascript
   match /users/{userId}/entitlements/{productId} {
     allow read: if request.auth.uid == userId;
     allow write: if false;  // Cloud Functions only
   }
   match /users/{userId}/payments/{paymentId} {
     allow read: if request.auth.uid == userId;
     allow write: if false;
   }
   ```

#### CHECKPOINT
- [ ] Test mode 에서 카드(4242 4242 4242 4242) 로 결제 → entitlement 부여 확인
- [ ] 환불 처리(Stripe 대시보드) → entitlement 자동 회수 확인
- [ ] 권한 없는 사용자가 entitlements 컬렉션에 쓰기 시도 → Rules 로 거부 확인
- [ ] 결제 실패 케이스(카드 4000 0000 0000 0002) → 에러 UI 동작

---

## Phase 4 — 엔트로피 랭킹 (Leaderboard)

### 목표
전체 사용자의 entropy 값(SaveState.entropy)을 정렬해 Top-N 보여주는 페이지 + 본인 순위 표시. 공개 읽기, 본인만 쓰기. Firestore 단일 쿼리로 페이지네이션 가능하게 설계.

### 전제 조건
- Phase 1 (캐릭터 이름) 완료: displayName 없는 사용자는 랭킹에 노출 불가
- Phase 2 (세이브 동기화) 완료: 랭킹 entry 가 게임 진행과 일관되도록

### DECISION POINT
1. **공개 범위는?**
   - A: 글로벌만 (단순)
   - B: 글로벌 + 친구 탭 (친구 시스템 별도 필요)
   - C: 글로벌 + "내 주변 ±N" 뷰
   - 권장: A + C (단일 글로벌 컬렉션, 내 주변 뷰는 클라이언트 커서 쿼리로 무료 구현)
2. **랭킹 기준은 단일 지표인가 다중 지표인가?**
   - 단일: entropy 만
   - 다중: entropy, condensedMass, universeCount, totalTimePlayed 등 탭으로 분리
   - 권장: Phase 4 에선 entropy 단일, 추후 확장 (각 지표마다 composite index 필요해서 비용 증가)
3. **갱신 빈도는?**
   - A: 실시간 (세이브 시마다 푸시)
   - B: N분마다 배치 (Cloud Functions Scheduled)
   - 권장: A 하되 debounce 30초 — 본인 entry 만 푸시. 글로벌 정렬은 Firestore index 가 자동.
4. **익명 사용자도 랭킹에 포함?**
   - 권장: 제외 (이름 없으니 의미 없음). Google 로그인 + displayName 둘 다 있을 때만 등록.
5. **랭킹에 노출되는 정보는?**
   - 권장 최소: displayName, entropy, stageIdx, universeCount, photoURL (선택)
   - 절대 노출 금지: email, providers 목록, uid 외 다른 게임 데이터, 세이브 내부 필드
6. **탈퇴/계정 삭제 시 랭킹 처리?**
   - A: 항목 삭제 (랭킹에서 사라짐) — GDPR 친화
   - B: 익명화 ("탈퇴한 우주" placeholder) — 랭킹 연속성
   - 권장: A
7. **부정 방지 가드?**
   - A: 보안 규칙 단순 검증 (entropy 가 number, 음수 아님)
   - B: 보안 규칙 + 단조 증가 검증 (`new.entropy >= old.entropy` — 단, 정상 prestige 리셋 케이스 고려)
   - C: A/B + Cloud Function 으로 SaveState 와 cross-check (서버 진실)
   - 권장: B 로 시작 (Blaze 플랜 불필요), 어뷰징 발견되면 C 추가

### 데이터 모델

```
leaderboard/{uid}    // 글로벌 랭킹 entry (Google 로그인 + displayName 있는 사용자만)
  └─ {
       uid,
       displayName,         // users/{uid}/profile.displayName 사본 (이름 변경 시 동기화)
       photoURL,            // 선택
       entropy,             // ★ 랭킹 정렬 기준 — SaveState.entropy 사본
       stageIdx,            // 표시용 부가 정보
       universeCount,       // 표시용 부가 정보
       updatedAt
     }
```

**왜 별도 컬렉션 (denormalized)?**
- `users/{uid}/saves/main` 은 본인만 읽기. 랭킹은 공개 읽기 필요.
- 정렬 인덱스 비용 최소화: `SaveState` 전체가 아니라 entropy 한 필드만.
- 노출 필드 명시: 정보 누출 방지.

### 구현 단계
1. `src/cloud/leaderboard.ts`:
   - `pushLeaderboardEntry(uid, save: SaveState, profile: Profile): Promise<void>`
     - 익명/displayName 없음 → 조용히 return
     - `setDoc(doc('leaderboard', uid), { uid, displayName: profile.displayName, photoURL, entropy: save.entropy, stageIdx: save.stageIdx, universeCount: save.universeCount, updatedAt: serverTimestamp() }, { merge: true })`
   - `fetchTopN(n: number): Promise<LeaderboardEntry[]>`
     - `query(collection('leaderboard'), orderBy('entropy', 'desc'), limit(n))`
   - `fetchRankAround(uid, range: number): Promise<LeaderboardEntry[]>`
     - 본인 entropy 읽기 → `where('entropy', '>=', myEntropy - epsilon)` + `where('entropy', '<=', myEntropy + epsilon)` + `orderBy('entropy', 'desc')` + `limit(range * 2 + 1)`
     - 더 정확한 본인 순위 필요 시 Cloud Function 으로 `count()` aggregation 호출
   - `fetchMyRank(uid): Promise<number | null>` — 본인 위에 있는 항목 수를 count aggregation 으로
2. `src/cloud/sync.ts` 의 `pushRemoteSave()` 내부에서 조건부 호출:
   - 익명 사용자 → leaderboard 푸시 안 함
   - displayName 없음 → 푸시 안 함
   - 둘 다 통과 → `pushLeaderboardEntry()` 도 같이 호출 (단, debounce 30초)
3. `src/cloud/profile.ts` 의 `claimDisplayName()` 마지막에 leaderboard entry 의 displayName 도 업데이트 (이미 entry 있으면):
   ```ts
   const lbRef = doc(db, 'leaderboard', uid);
   const snap = await getDoc(lbRef);
   if (snap.exists()) {
     await updateDoc(lbRef, { displayName: newName });
   }
   ```
4. `src/components/Leaderboard.tsx`:
   - Top 100 표시 + 본인 위치 (없으면 "랭킹에 등록되지 않음" 상태 표시 + 등록 방법 안내)
   - 페이지네이션 (커서 기반, "다음 100" 버튼)
   - 자기 행 하이라이트
   - 익명 사용자 진입 시 "Google 로그인 + 이름 설정 후 등록됩니다" 안내
5. `firestore.rules` 추가 (Phase 2 의 rules 에 append):
   ```javascript
   match /leaderboard/{userId} {
     // 공개 읽기 — 누구나 (로그인 안 한 사용자도 가능, 원하면 request.auth != null 추가)
     allow read: if true;

     // 본인 entry 만 쓰기, 필드 검증
     allow write: if request.auth != null
                  && request.auth.uid == userId
                  && request.resource.data.uid == userId
                  && request.resource.data.displayName is string
                  && request.resource.data.displayName.size() > 0
                  && request.resource.data.displayName.size() <= 32
                  && request.resource.data.entropy is number
                  && request.resource.data.entropy >= 0
                  // 단조 증가 검증 (정책 7-B): 기존 entry 보다 낮은 entropy 거부
                  && (resource == null || request.resource.data.entropy >= resource.data.entropy - 1);
                  // 주의: prestige 리셋이 entropy 를 낮추면 이 규칙으로 막힘 → 게임 모델 확인 필요
   }
   ```
6. **Firestore Index 생성**:
   - Composite/Single-field: `leaderboard` 컬렉션, `entropy DESC`
   - `firestore.indexes.json` 에 선언:
     ```json
     {
       "indexes": [
         {
           "collectionGroup": "leaderboard",
           "queryScope": "COLLECTION",
           "fields": [{ "fieldPath": "entropy", "order": "DESCENDING" }]
         }
       ]
     }
     ```
   - `firebase deploy --only firestore:indexes` 로 배포
7. **계정 삭제 처리** (정책 6-A 선택 시):
   - 사용자가 "계정 삭제" 버튼 누르면 클라이언트가 다음 순서로 삭제:
     1. `leaderboard/{uid}` 삭제
     2. `displayNames/{lower}` 삭제
     3. `users/{uid}/...` 전체 삭제 (서브컬렉션 포함 — Cloud Function 권장)
     4. Firebase Auth 사용자 삭제 (`deleteUser()`)
   - 모두 클라이언트에서 처리 가능하나, 부분 실패 시 고아 데이터 남으니 Cloud Function 으로 묶는 게 안전
8. **테스트**:
   - 두 계정으로 entropy 다르게 진행 → Leaderboard 페이지에서 순서 확인
   - 익명 계정으로 진행 → Leaderboard 에 안 나타남
   - displayName 변경 후 → leaderboard entry 의 displayName 도 업데이트됨 확인
   - Firestore Rules Playground: 다른 사용자가 본인 entry 변조 시도 → 거부
   - 비정상 entropy(음수, 매우 큰 값) 쓰기 시도 → 거부

### 절대 하지 말 것
- `users/{uid}/saves/main` 을 공개 읽기로 풀지 마라. 항상 별도 `leaderboard` 컬렉션 사용.
- 랭킹 entry 에 게임 상태 전체를 쓰지 마라. 노출할 필드만 명시.
- Top-N 쿼리에서 `limit` 없이 fetch 하지 마라 — 비용 폭발.
- 매 게임 tick 마다 leaderboard 푸시하지 마라 — debounce 30초가 최소.
- 클라이언트 쓰기를 보안 규칙으로 완전히 막을 수 없다고 판단되면 (예: entropy 위변조 시도) Cloud Function 으로 검증 거치게 전환.
- 익명 사용자의 entry 가 leaderboard 에 새는지 항상 확인 — `pushLeaderboardEntry` 의 가드 절대 우회 금지.

### CHECKPOINT
- [ ] 두 계정의 entropy 가 다르면 Leaderboard 에서 정렬 순서가 맞다
- [ ] 본인 행이 하이라이트됨
- [ ] 익명 사용자는 랭킹에 노출되지 않는다
- [ ] displayName 변경 시 leaderboard 의 표시 이름도 갱신됨
- [ ] Firestore Rules Playground 로 타 uid 의 leaderboard entry 수정 시도 거부 확인
- [ ] Top 100 fetch 시 Firestore read 비용이 100 회 이내인지 확인 (단일 query)
- [ ] entropy 비정상 값 (음수, Infinity, 매우 큰 값) 차단 동작 확인
- [ ] 계정 삭제 시 leaderboard entry 도 함께 삭제됨

---

## 부록 A — 환경 변수 정리

```
# Vite 빌드 시 인라인되는 클라이언트 키들 (공개돼도 OK, Auth는 Authorized domains로 보호)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_RECAPTCHA_SITE_KEY=

# 서버 사이드 (Firebase Functions config 또는 Stripe Extension에 직접 입력 — 절대 클라이언트에 노출 금지)
# STRIPE_SECRET_KEY=
# STRIPE_WEBHOOK_SECRET=
# APPLE_PRIVATE_KEY (.p8 파일 내용)
```

## 부록 B — `package.json` 추가될 종속성

```json
{
  "dependencies": {
    "firebase": "^10.x"
  },
  "devDependencies": {
    "firebase-tools": "^13.x"
  }
}
```

## 부록 C — Firebase CLI 셋업 가이드 (사용자용)

Claude Code 가 Phase 2 진입 시 사용자에게 안내:
```bash
npm install -g firebase-tools   # 또는 npx 사용
firebase login
firebase init firestore         # 프로젝트 디렉토리에서. 기존 firebase.json 덮어쓰기 주의
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes    # Phase 4 진입 시
```

---

## 부록 D — 마이그레이션 노트

기존 사용자(`localStorage` 세이브만 있는)는 Phase 2 배포 시 첫 로그인하면:
1. Anonymous Auth 자동 시작
2. `loadGame()` 이 localStorage 에서 SaveState 로드
3. Firestore 에는 아직 문서 없음 → 첫 `saveGame()` 호출 시 자동 푸시
4. 다른 디바이스에서 Google 로그인 → `linkWithCredential` → Firestore 문서 자동 이전
5. Phase 1 의 이름 설정 모달이 첫 Google 로그인 시점에 강제됨 (기존 익명 사용자도 Google 로 전환하는 순간 모달)
6. 랭킹은 Phase 4 가 배포된 후, displayName 이 채워진 사용자에 한해 자동 등록

데이터 손실 방지: Phase 2 배포 후 첫 푸시 성공 전까지 localStorage 를 **삭제하지 않는다**.

---

## 부록 E — 어뷰징/보안 체크리스트

| 위협 | 대응 |
|------|------|
| 다른 사용자의 세이브 읽기/변조 | Firestore Rules 의 `request.auth.uid == userId` 검증 |
| 동일 이름 동시 클레임 (race) | `claimDisplayName` 의 Firestore Transaction |
| 욕설/도용 이름 등록 | 클라이언트 검증 + 보안 규칙 길이 제한 + (선택) Cloud Function 블랙리스트 |
| Leaderboard entropy 위변조 | Rules 의 단조 증가 검증 + (선택) Cloud Function cross-check |
| 익명 사용자 leaderboard 노출 | `pushLeaderboardEntry` 가드 + (옵션) Rules 에서 `request.auth.token.firebase.sign_in_provider != 'anonymous'` 검증 |
| 봇/스크립트 대량 가입 | App Check (reCAPTCHA v3) — Phase 0 단계에서 활성화 권장 |
| 시크릿 키 노출 | `.env*.local` 을 `.gitignore` 에 명시, 커밋 전 `git diff --cached` 확인 |
| Stripe 결제 위변조 | Stripe webhook signature 검증 (Extension 기본 제공) |
