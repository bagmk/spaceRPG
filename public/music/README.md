# `public/music/` — 큐레이션 가이드 (rotation 지원)

각 chapter는 **여러 트랙이 랜덤 rotation** 되며 cross-fade로 자연스럽게 이어진다.
한 트랙이 끝나면 같은 chapter pool에서 다른 트랙으로 자동 전환.
파일이 없으면 silent fail — 게임은 멀쩡히 돌아감.

---

## 너가 보낸 7곡 + 추가 추천 — 다운로드 매핑

각 행의 Pixabay 링크에서 mp3 다운 → 두 번째 열의 파일명으로 저장.
**별표(★)는 너가 직접 지목한 곡.**

### Chapter 1 — `genesis` (Stage 1, 인플레이션)

| Pixabay URL | 저장 파일명 | 아티스트 |
|---|---|---|
| ★ https://pixabay.com/music/main-title-space-438391/ | `genesis_1.mp3` | The_Mountain "Space" (1:53, main-title) |
| ★ https://pixabay.com/music/pulses-space-discovery-179468/ | `genesis_2.mp3` | The_Mountain "Space Discovery" (pulses) |
| https://pixabay.com/music/ambient-drone-space-main-9706/ | `genesis_3.mp3` | "Drone Space (Main)" |

### Chapter 2 — `forge` (Stages 2-4, 바리오제네시스/QGP/핵합성)

| Pixabay URL | 저장 파일명 | 톤 |
|---|---|---|
| https://pixabay.com/music/ambient-dark-ambient-cinematic-drone-investigative-pulse-minimalist-tension-454726/ | `forge_1.mp3` | dark, pulsing, particle physics |
| https://pixabay.com/music/ambient-cinematic-suspense-dark-atmosphere-365185/ | `forge_2.mp3` | cinematic tension |
| https://pixabay.com/music/ambient-cinematic-space-drone-10623/ | `forge_3.mp3` | space drone |

### Chapter 3 — `awakening` (Stages 5-6, 재결합/암흑기)

| Pixabay URL | 저장 파일명 | 톤 |
|---|---|---|
| https://pixabay.com/music/ambient-dark-space-ambient-495569/ | `awakening_1.mp3` | dark cold ambient |
| ★ https://pixabay.com/music/ambient-space-440026/ | `awakening_2.mp3` | leberch "Space" (3:06) |
| https://pixabay.com/music/ambient-the-space-144115/ | `awakening_3.mp3` | The_Mountain "The Space" |

### Chapter 4 — `first_light` (Stages 7-9, 첫 별/재이온화/은하)

| Pixabay URL | 저장 파일명 | 톤 |
|---|---|---|
| ★ https://pixabay.com/music/meditationspiritual-cinematic-space-510707/ | `first_light_1.mp3` | leberch "Cinematic Space" (3:58) |
| https://pixabay.com/music/main-title-inspiring-cinematic-uplifting-piano-171107/ | `first_light_2.mp3` | uplifting piano build |
| https://pixabay.com/music/ambient-cinematic-space-ambient-music-409240/ | `first_light_3.mp3` | cinematic space ambient |

### Chapter 5 — `living` (Stages 10-12, 행성/생명/문명)

| Pixabay URL | 저장 파일명 | 톤 |
|---|---|---|
| ★ https://pixabay.com/music/ambient-planet-earth-146120/ | `living_1.mp3` | The_Mountain "Planet Earth" |
| https://pixabay.com/music/beautiful-plays-inspiring-uplifting-cinematic-piano-119523/ | `living_2.mp3` | uplifting piano "Dreams of the World" |
| https://pixabay.com/music/modern-classical-emotional-inspiring-uplifting-cinematic-piano-133040/ | `living_3.mp3` | emotional cinematic piano |

### Chapter 6 — `twilight` (Stages 13-14, 항성종말/잔해 냉각)

| Pixabay URL | 저장 파일명 | 톤 |
|---|---|---|
| https://pixabay.com/music/ambient-light-in-the-void-dark-cinematic-ambient-178488/ | `twilight_1.mp3` | dark cinematic, void approaching |
| https://pixabay.com/music/ambient-the-dark-void-ambient-soundscape-135354/ | `twilight_2.mp3` | sparse mournful soundscape |
| https://pixabay.com/music/ambient-planet-of-the-lost-deep-dark-sci-fi-future-ambient-space-cinematic-193800/ | `twilight_3.mp3` | "Planet of the Lost" deep sci-fi |

### Chapter 7 — `void` (Stages 15-16, 블랙홀/끝)

| Pixabay URL | 저장 파일명 | 톤 |
|---|---|---|
| ★ https://pixabay.com/music/ambient-space-ambient-446647/ | `void_1.mp3` | FreeMusicForVideo "Space Ambient" (blackhole 매칭) |
| ★ https://pixabay.com/music/ambient-space-ambient-background-music-462074/ | `void_2.mp3` | SigmaMusicArt (end 매칭) |
| https://pixabay.com/music/horror-scene-blackhole-dark-ambient-meditation-166455/ | `void_3.mp3` | "Blackhole Dark Ambient Meditation" |
| https://pixabay.com/music/ambient-dark-void-275422/ | `void_4.mp3` | "Dark Void" |

---

## 엔딩 5개 (각 1트랙, 원하면 더 늘려도 됨)

| Pixabay URL | 저장 파일명 | 엔딩 톤 |
|---|---|---|
| https://pixabay.com/music/ambient-space-ambient-background-music-462074/ | `ending_heat_death_1.mp3` | cold eternal (SigmaMusicArt 재사용 OK) |
| https://pixabay.com/music/ambient-cinematic-suspense-dark-atmosphere-365185/ | `ending_big_crunch_1.mp3` | gathering tension |
| https://pixabay.com/music/ambient-dark-ambient-cinematic-drone-investigative-pulse-minimalist-tension-454726/ | `ending_big_rip_1.mp3` | chaotic pulses |
| https://pixabay.com/music/beautiful-plays-inspiring-uplifting-cinematic-piano-119523/ | `ending_bounce_1.mp3` | rebirth, uplifting |
| https://pixabay.com/music/horror-scene-blackhole-dark-ambient-meditation-166455/ | `ending_vacuum_decay_1.mp3` | dread, void |

→ 총 **26개 파일** (chapter 22개 + 엔딩 5개; 일부 중복 OK라면 더 적음)

---

## 빠른 작업 순서

1. 위 표의 Pixabay URL 클릭 → 페이지에서 **녹색 Download 버튼** 클릭 → 무료 다운
2. 다운된 파일 이름을 두 번째 열의 이름으로 **rename**
3. `~/게임/public/music/` 폴더에 전부 **그대로 드롭**
4. `npm run dev` 또는 `npm run build` 다시 실행
5. 게임 진입 → Stage 1에서 음악 cross-fade in 되면 OK

---

## 동작 방식

```
[Stage 1 진입 (genesis)]
  → loadAndPlayChapterPool('genesis', [genesis_1.mp3, genesis_2.mp3, genesis_3.mp3])
  → 3개 다 parallel load (캐시)
  → 랜덤 1개 선정 → cross-fade in (4초)
  → 그 트랙 끝나기 ~3.8초 전부터 다음 랜덤 트랙 cross-fade in (같은 곡 안 반복)
  → 무한 rotation

[Stage 2 진입 (forge, 새 chapter)]
  → currentPoolId === 'forge' 인지 체크
  → 다르면 forge pool load + 첫 트랙 cross-fade in
  → 기존 genesis 트랙은 cross-fade out

[Stage 3 진입 (forge, 같은 chapter)]
  → currentPoolId === 'forge' → no-op (음악 안 끊김, rotation 계속)

[엔딩 진입]
  → currentPoolId = null (chain 정지)
  → fadeOutMusic(1500)
  → ending pool load + 첫 트랙 cross-fade in
```

---

## 파일 이름 정확히 지켜야 하는 이유

`src/game/musicChapters.ts`의 `CHAPTER_METADATA[chapter].trackFiles` 배열이 그대로 fetch URL이 됨.
이름 다르면 404 → silent fail → 게임은 도는데 음악만 없음.

---

## 인코딩 변환 (옵션, 사이즈 줄이려면)

Pixabay 원본이 너무 크면:

```bash
# 모노 96 kbps mp3 (chapter loop 트랙에 충분)
ffmpeg -i original.mp3 -c:a libmp3lame -b:a 96k -ac 1 chapter_track.mp3

# 스테레오 128 kbps mp3 (엔딩 트랙용)
ffmpeg -i original.mp3 -c:a libmp3lame -b:a 128k -ac 2 ending_track.mp3
```

목표 총 음원 사이즈: **30~50 MB** (게임 총 사이즈 60~90 MB).

---

## 마음에 안 들면

같은 파일명으로 덮어쓰기 → 다음 페이지 로드 시 새 트랙 자동 반영.
한 chapter에 트랙 수 늘리고 싶으면 `musicChapters.ts`의 `trackFiles` 배열에 추가 후 같은 이름 규칙으로 파일 드롭.

---

## 라이선스 (출시 전 필수 정리)

전부 **Pixabay Content License**:
- 상업 사용 OK
- 귀속 표기 권장(필수 아님)
- 재판매 금지 (음원 자체를 상품화 X, 게임 BGM 사용은 OK)

`docs/MUSIC_CREDITS.md` 파일을 만들어 사용한 트랙 출처 정리 권장.
