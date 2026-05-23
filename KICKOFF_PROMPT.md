# Claude Code 킥오프 프롬프트

> Claude Code 첫 세션에 아래 내용을 그대로 붙여넣어. 두 번째 세션부터는 Claude Code가 `CODEX_CLAUDE.md` 와 `FIREBASE_INTEGRATION_PLAN.md` 를 자동으로 읽으니 짧은 한 줄만 던지면 됨 ("Phase 1 시작하자" 등).

---

## 첫 세션용 프롬프트 (복사 → 붙여넣기)

```
Cosmic Coalescence 프로젝트에 Firebase 기반 로그인 + 클라우드 세이브 + (선택)결제 시스템을 추가하려고 한다.

지금부터 다음 순서로 작업해라:

1. ARCHITECTURE.md 와 CODEX_CLAUDE.md 를 먼저 읽어 프로젝트 구조와 컨벤션을 파악한다.
2. FIREBASE_INTEGRATION_PLAN.md 를 처음부터 끝까지 읽는다. 이 문서가 작업 프로토콜이다.
3. 그 문서의 "## Status" 섹션을 보고 현재 Phase를 확인한다 (현재: Phase 0).
4. Phase 0 의 "### DECISION POINT" 4개 항목을 AskUserQuestion 으로 나에게 묻는다.
5. 내 답을 받으면 "## Status" 의 "Decided:" 라인에 누적 기록하고 그 변경을 커밋한 뒤 Phase 0 진행을 시작한다.

규칙:
- 한 번에 한 Phase만 진행. 끝나면 CHECKPOINT 검증 후 나에게 "다음 Phase 진행할까요?" 라고 묻고 답을 받기 전엔 멈춘다.
- DECISION POINT 답을 받기 전엔 코드를 절대 쓰지 마라.
- 시크릿(.env.local, .p8 키, Stripe key 등)이 실수로 커밋되면 즉시 멈추고 나에게 알린다.
- 기존 src/game/storage.ts 의 마이그레이션 시스템을 재사용하라. 새로 만들지 마라.

지금 Phase 0 의 DECISION POINT 부터 시작해줘.
```

---

## 이후 세션용 프롬프트 (각 Phase 시작 시)

각 새 세션마다 이렇게만 던지면 됨:

```
FIREBASE_INTEGRATION_PLAN.md 확인하고 다음 Phase 진행하자.
```

또는 특정 Phase를 지정하고 싶으면:

```
FIREBASE_INTEGRATION_PLAN.md 의 Phase 2 시작하자. DECISION POINT 부터 물어봐.
```

---

## Claude Code가 규칙을 어길 때 사용할 교정 프롬프트

가끔 DECISION POINT를 건너뛰고 코드를 쓰려 할 때:

```
멈춰. FIREBASE_INTEGRATION_PLAN.md 의 현재 Phase DECISION POINT 를 먼저 물어봐. 답 받기 전엔 코드 쓰지 마.
```

CHECKPOINT 검증 없이 다음 Phase로 넘어가려 할 때:

```
현재 Phase 의 CHECKPOINT 체크박스를 하나씩 검증하고 결과 보여줘. 통과 안 된 항목이 있으면 그것부터 해결.
```

---

## 워크플로우 한눈에

```
Session 1 (Phase 0):
  사용자: 위 첫 세션 프롬프트 붙여넣기
  Claude: ARCHITECTURE.md, CODEX_CLAUDE.md, PLAN 읽기
  Claude: AskUserQuestion (Firebase 프로젝트 있어? Apple 포함? Stripe 포함? 도메인?)
  사용자: 답변
  Claude: Status 업데이트 커밋
  Claude: Firebase 콘솔 셋업 단계별 안내 + .env.local 생성
  Claude: CHECKPOINT 검증
  Claude: "Phase 0 완료. Phase 1 진행할까요?"

Session 2 (Phase 1):
  사용자: "Phase 1 시작하자"
  Claude: PLAN 의 Phase 1 읽기
  Claude: AskUserQuestion (로그인 UI 위치? 링크 충돌 처리?)
  ... 이후 동일
```

---

## 안 좋은 패턴 (피해야 할 프롬프트)

❌ "Firebase 다 해줘" — 한 번에 다 하라고 시키면 Phase 분할이 무너짐
❌ "그냥 Google 로그인 추가해줘" — PLAN 무시하고 즉흥 구현
❌ "DECISION POINT 알아서 정해서 진행해" — 결정 권한을 위임하면 의도 안 맞는 선택 가능

✅ "PLAN 의 다음 Phase 진행" — 가장 안전
✅ "Phase 2 의 step 3 만 해줘" — 부분 작업도 PLAN 참조 강제
