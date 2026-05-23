# Cosmic Coalescence — 엔티티 & 마일스톤 심층 해설 (전체 인덱스)

> 게임 인게임 클릭/탭 시 표시되는 풀-텍스트 lore. 16 스테이지, 204 엔티티, 134 마일스톤 = **338 항목**.
> 모든 항목 영문(EN) + 한국어(KO) 페어, 최신 연구(2023-2025) 적극 인용.

## 📁 파일 구성

| 파일 | 스테이지 | 엔티티 | 마일스톤 | 크기 |
|------|----------|--------|----------|------|
| `lore-stages-1-3.md` | Inflation, Baryogenesis, QGP | 23 | 21 | 154 KB |
| `lore-stages-4-6.md` | Nucleosynthesis, Recombination, Dark Age | 42 | 21 | 174 KB |
| `lore-stages-7-9.md` | First Stars, Reionization, Galaxy Weaving | 42 | 21 | 60 KB |
| `lore-stages-10-12.md` | Planet Formation, Life Evolution, Civilization (적색거성) | 42 | 39 | 115 KB |
| `lore-stages-13-16.md` | Stelliferous End, Remnant Cooling, Black Hole Era, Dark Era | 56 | 32 | 79 KB |
| **합계** | **16 스테이지** | **205** | **134** | **~580 KB** |

## 🎯 작성 형식

각 엔티티/마일스톤은 다음 형식:

```markdown
### 🪐 EntityName / 엔티티명
*Rarity · effect xValue · `formula`*

**EN.** (영문 설명: 무엇 → 발견 → 최신 연구)

**KO.** (한국어 동일 내용)

---

### 🔬 Milestone N% — Title EN / 제목 KO

**EN.** (영문 마일스톤 묘사)

**KO.** (한국어 동일)
```

## 📚 주요 인용 출처

### 입자물리 / 우주론
- BICEP/Keck Array (인플레이션, primordial GW, 2024 σ(r)=0.009)
- LHCb (CP 위반, CKM angle γ 2.6° precision 2025)
- ALICE @ LHC (QGP in proton-proton collisions, 2024)
- KATRIN (neutrino mass < 0.45 eV, 2024)
- Fermilab Muon g-2 (2023)
- NANOGrav (nanohertz GW background, 2023)
- DESI (BAO, dark energy w(z) hints, 2024)
- Planck (CMB final results, 2018)

### 천체물리 / 천문학
- JWST (LAP1-B Pop III candidate 2025, JADES-GS-z14-0 z=14.32, 2024)
- LIGO/Virgo/KAGRA O4 (BH-BH, NS-NS mergers, 2023-2024)
- Event Horizon Telescope (M87* 2019, Sgr A* 2022)
- HERA, SKA (21-cm cosmology, 진행 중)
- Chandra, XRISM (X-ray surveys)
- Hubble Space Telescope (~30 years observation)

### 생명/지구/태양계
- LUCA dating 4.2 Bya (Nature Ecology 2024)
- K2-18b DMS detection (JWST 2023-2024, controversial)
- Perseverance Mars (2021-, sample caching)
- Europa Clipper (NASA 2024 launch)
- JUICE (ESA 2023 launch, Jupiter system)
- Chang'e-6 farside samples (2024)

## 🎮 게임 사용 시나리오

### 옵션 A: 직접 파일 로드
플레이어가 엔티티/마일스톤 클릭 → 새 탭에 해당 섹션 표시.

### 옵션 B: 데이터베이스/JSON 변환
파일을 파싱해서 ID 기반 lookup table 생성:
```ts
{
  "entity_quantum_fluctuation": {
    en: { name: "Quantum Fluctuation", text: "..." },
    ko: { name: "양자 요동", text: "..." }
  }
}
```

### 옵션 C: 점진적 로드
스테이지별 lazy-load. 플레이어가 Stage 5 도달 시 lore-stages-4-6.md 페치.

## 🔧 후속 작업 권장사항

1. **검수 패스**: 각 파일을 한 번 더 읽어보며 사실 검증 + 문장 매끄럽게.
2. **이미지 어셋**: 각 항목에 1개씩 이미지 매칭 (예: Sun 엔티티에 SDO 사진).
3. **하이퍼링크**: 위키피디아 / NASA / ESA 공식 출처 링크 추가.
4. **음성 더빙**: 한국어/영어 TTS로 lore 음성 제공 (접근성).
5. **다국어 확장**: 일본어, 중국어 등 자동 번역 + 인간 검수.

## 📊 분량 통계

- 평균 엔티티: ~150 단어/언어
- 평균 마일스톤: ~250 단어/언어
- 총 단어 수: ~130,000 (EN+KO 합산)
- 1인 검수 예상 시간: 약 20-30시간

## ✅ 최신 연구 커버리지

2023-2025년 발표된 주요 우주론/천체물리/입자물리 결과를 적극 인용:
- JWST 첫 3년 성과 (2022-2025)
- LIGO O4 캠페인 (2023-2024)
- DESI 1년차 결과 (2024)
- LHCb 4 fb⁻¹ 데이터셋 (2024-2025)
- LUCA 게놈 재구성 (2024)
- 다양한 2024년 노벨상 후보 연구들

작성: AI 보조 + 인간 검수 추천
