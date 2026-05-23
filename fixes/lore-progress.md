# Lore 보강 작업 진행 상황

## 완료
- **Stage 1 — Inflation** (3 엔티티 + 7 마일스톤) ✅
- **Stage 2 — Baryogenesis** (8 엔티티 + 7 마일스톤) ✅
- **Stage 3 — Quark-Gluon Plasma** (12 엔티티 + 7 마일스톤) ✅

**완료 파일**: `lore-stages-1-3.md` (154KB, 909줄)

## 남은 작업

| Stage | 이름 | 엔티티 | 마일스톤 | 다음 세션 우선순위 |
|-------|------|--------|----------|-------------------|
| 04 | Nucleosynthesis | 14 | 7 | ⭐ 다음 세션 시작 |
| 05 | Recombination | 14 | 7 | |
| 06 | Cosmic Dark Age | 14 | 7 | |
| 07 | First Stars | 14 | 7 | |
| 08 | Reionization | 14 | 7 | |
| 09 | Galaxy Weaving | 14 | 7 | |
| 10 | Planet Formation | 14 | 7 | |
| 11 | Life Evolution | 14 | 7 | |
| 12 | Civilization | 14 | 7 | |
| 13 | Red Giant | 14 | 7 | |
| 14 | Remnant Cooling | 14 | 7 | |
| 15 | Proton Decay | 14 | 7 | |
| 16 | Hawking Radiation | 14 | 7 | |

**남은 총량**: 13 스테이지 × (14 엔티티 + 7 마일스톤) = 182 엔티티 + 91 마일스톤 = **273 항목**

## 작성 가이드라인 (다음 세션에 그대로 사용)

### 형식

```markdown
### 🪐 EntityName / 엔티티명
*Rarity · effect · `formula`*

**EN.** [200-300 words: 무엇인가 → 발견사 → 최신/트리비아]

**KO.** [같은 길이 한글]

---

### 🔬 Milestone N% — Title EN / 제목 KO

**EN.** [400-500 words: 우주적 사건 → 과학적 메커니즘 → 최신 연구]

**KO.** [같은 길이 한글]

---
```

### 톤
- 정확한 수치 + 발견자 + 연도 포함 (예: "2.2 microseconds" "Lee, Yang, Wu 1956–1957 Nobel 1957")
- 최신 연구 적극 인용 (2023~2026): JWST, LHCb, BICEP/Keck, ALICE, LIGO 등
- "Why this matters" 한 문장 포함
- 트리비아/심리적 후크 1개씩

### 작성 효율
- 스테이지당 ~50KB
- 한 세션에 3 스테이지 정도가 합리적 (사이즈 + 품질 균형)
- 따라서 **남은 13 스테이지 = 약 4-5 세션 분량**

## 다음 세션 시작 시 클로드에게 줄 프롬프트

```
@fixes/lore-progress.md 확인 후 @fixes/lore-stages-1-3.md 형식대로 Stage 4 (Nucleosynthesis) 작성.
14 엔티티 + 7 마일스톤, 영문+한글 페어, 최신 연구 적극 포함.

특별 주의 토픽:
- BBN: 원시 lithium problem 2025 상태 (해소된 것으로 보임)
- Deuterium bottleneck
- Neutrino freeze-out (T ~ 1 MeV)
- 원시 He/H 비율 ≈ 0.25 (관측과 어떻게 맞는지)

파일은 lore-stages-4-6.md로 신규 저장. 끝나면 lore-progress.md 업데이트.
```

## 메모

- 한 파일에 16 스테이지 다 넣으면 ~800KB → 검색/스크롤 어려움
- 3-4 스테이지 묶음 (lore-stages-1-3, 4-6, 7-9, 10-12, 13-16)이 적당
- 게임 인게임 로드 시 stage별 lazy-load 권장 (구현 시 별도 fix 필요)
