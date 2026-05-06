# 레벨 시스템 / 스킬 트리 밸런스 분석

> 시뮬레이터: `balance-simulator.html` (브라우저에서 열어 인터랙티브하게 조정 가능)

## 2026-05-05 Quanta / Time 스킬 경제 패스

가정:
- Active play: `10 clicks/sec`
- Crit: 기대값 계산에서 `50%` 발생으로 고정
- 구매 전략: quanta가 생기면 `click -> auto -> crit -> time` 순서로 root level을 즉시 구매하고, SP node도 낮은 tier부터 즉시 구매
- 시간 목표 곡선: 사용자가 말한 strict `1.7x`면 총 `57.9h`; 예시 `30s -> 54s -> 97.2s`는 `1.8x`에 가까워 총 `126.5h`

이번 코드 반영값:

```ts
click/auto/crit cost(L) = 1-30은 floor(3 ^ (L - 1)), 31-50은 수동 고가 테이블
time cost(L)            = Lv 1-40 수동 테이블
time rate(L)            = 10 ^ L * timeCrossNodes * apex
click/auto/crit max     = 50
time max                = 40
cross-node tiers        = 5, 10, 15, 20, 25, 30
total SP node budget    = 24 nodes, 48 SP
```

핵심 결론:
- Stage advance에서 `cosmicClockSec` 초과분을 다음 stage로 넘기던 것이 stage 6-9 즉시 time-full 현상의 직접 원인이었다.
- 그래서 `ADVANCE_STAGE`에서 cosmic clock을 방금 클리어한 stage의 required time으로 clamp한다. 다음 stage는 항상 이전 stage 경계 시간에서 시작한다.
- `time cost base` 같은 단일 함수는 중반/후반을 동시에 못 맞춘다. Lv 10/12/14/19/30/31+이 열리는 시점을 직접 지정하는 수동 가격표로 교체했다.
- `click/auto/crit`도 Lv 31 이후는 수동 고가 테이블로 전환했다. cap은 50이지만 40대 후반이 너무 일찍 열려 quanta가 후반 time gate를 다시 뚫지 못하게 막는다.
- Stage 6-16 threshold는 carry quanta를 전제로 다시 올렸다. stage 시작 즉시 quanta 조건이 이미 완료되는 문제를 줄이고, 시간/콴타가 같이 움직이는 구간을 늘린다.
- Crit 기대값은 사용자가 지정한 50% 기준과 맞게 cap을 `0.5`로 통일했다.

`npm run sim:economy` 결과:

| Stage | Sim | Q ready | T ready | End levels |
|---|---:|---:|---:|---|
| 5 Recombination | 680s | 0s | 680s | C31/A30/R30/T10 |
| 6 Dark Age | 3,954s | 0s | 3,954s | C32/A32/R32/T12 |
| 7 First Stars | 1,575s | 1,207s | 1,575s | C33/A33/R33/T12 |
| 8 Reionization | 5,335s | 2,519s | 4,850s | C35/A35/R35/T12 |
| 9 Galaxy Formation | 7,750s | 1,980s | 7,750s | C37/A37/R37/T12 |
| 14 Degenerate Era | 13,936s | 9,744s | 13,915s | C46/A45/R45/T30 |
| 15 Black Hole Era | 8,648s | 2,924s | 8,648s | C47/A47/R46/T30 |
| 16 The End | 4,480s | 240s | 4,442s | C49/A49/R49/T33 |

이 패스의 목적은 strict 100h 목표가 아니라 사용자가 직접 지적한 체감 문제 제거다. Stage 6-9는 더 이상 다음 stage 진입 즉시 time-full이 되지 않고, stage 15는 time level 구매가 막혀 수학적으로 불가능해지는 벽을 제거했다. 초반 1-3은 10 CPS + 즉시구매 기준으로 여전히 빠르므로, 초반 연출 시간을 강제하려면 별도 stage minimum pacing이나 stage 1-3 threshold 재생성이 필요하다.

## 2026-05-04 100시간 리밸런스 초안

이번 패스에서는 총 목표 시간을 정확히 **100h**로 재분배하고, 첫 3개 stage를 **30s / 120s / 300s**로 맞췄다. 검증 스크립트는 `npm run sim`이며, soft expected 구매 경로 기준 총 **100.001h**, stage별 최대 deviation **0.21%**가 나왔다.

핵심 변경:
- Time root cost base: `10^(L-1)` → `3^(L-1)`; Time 효과는 기존처럼 `10^L` 유지.
- Stage별 강제 level cap은 제거했다. 시뮬레이션은 `[10,12,14,16,18,20,22,24,26,28,29,29,29,29,29,30]`을 expected 구매 target으로만 사용한다.
- SP는 encounter 랜덤 보상이 아니라 stage clear budget으로 지급: `[1,1,2,2,2,3,3,3,3,4,4,4,5,5,6]`, 총 48 SP.
- Cross-node 비용은 tier별 `[1,1,2,2,3,3]`, 4트랙 전체 비용도 총 48 SP라 The End에서 모든 node를 정확히 살 수 있다.
- 모든 24개 cross-node 보유 시 final apex boost가 열린다: click/auto x2, crit/time apex x2.
- 후반 cosmic gate는 최종 레벨 30 기준으로 가능한 범위로 압축했다: Degenerate `2.29e34s`, Black Hole `3.89e35s`, The End `5.01e37s`.
- Stage 1은 skill 구매 없이 10 CPS 기준 30초 근처가 되도록 threshold를 `1,725`로 낮췄다.
- Crit 트랙은 Stage 3부터 열리도록 실제 게임/시뮬레이터 양쪽을 맞췄다.
- Stage advance 시 quanta는 threshold를 차감하지 않고 전부 다음 stage로 carry한다. Threshold 표는 이 누적 carry를 포함해 다시 계산했다.
- Stage 2 matter asymmetry의 9번째 클릭 보너스는 100배 + threshold flat 보상에서 2.8배 보너스로 낮춰, 갑자기 수천 quanta가 튀는 현상을 제거했다.
- 클릭 floating particle은 particle 종류별 entropy 보너스를 주고, rogue collision은 tier와 stage에 따라 큰 entropy 보너스를 준다.

검증 결과 요약:

| Stage | Target | Sim | Dev | Levels | Nodes |
|---|---:|---:|---:|---:|---:|
| 1 Inflation | 30s | 30s | 0.00% | 0/0/0/0 | 0 |
| 2 Baryogenesis | 120s | 120s | 0.21% | 12/12/0/12 | 1 |
| 3 QGP | 300s | 300s | 0.00% | 14/14/14/14 | 2 |
| 5 Recombination | 540s | 540s | 0.05% | 18/18/18/18 | 6 |
| 10 Solar System | 10,800s | 10,799s | -0.01% | 28/28/28/28 | 14 |
| 15 Black Hole Era | 86,400s | 86,401s | 0.00% | 29/29/29/29 | 20 |
| 16 The End | 117,450s | 117,447s | -0.00% | 30/30/30/30 | 24 |

## 🚨 가장 중요한 발견 (먼저 읽어주세요)

**디자인 의도상 모든 스킬의 최종 레벨은 30입니다** (milestones at 1/5/10/15/20/25/30, cross-node tiers up to 30, `effects.ts`의 분기도 모두 ≤30).

레벨 30 최종 기준을 적용하고 시뮬을 돌리면:

| Stage | time L 30 + 모든 cross-node 보유 시 예상 시간 | target |
|---|---:|---:|
| 1–12 | 정상 (몇 분 ~ 몇 시간) | 30s ~ 6h |
| **13 Stelliferous End** | **773 hr** (32일) | 10h |
| **14 Degenerate Era** | **350,000 hr** ≈ 40년 | 15h |
| **15 Black Hole Era** | 사실상 무한대 (10⁷⁰+ 년) | 24h |
| **16 The End** | 사실상 무한대 | 32.6h |

**이유**:
- Stage 14는 cosmic time을 `10^21 → 10^47.5`로 증가시켜야 함 (log span +26)
- Time L 30 + 모든 time cross-node = fill rate `10^30 × 2.5e8 = 2.5e38` cosmic-sec/sec
- 필요 real time = `3.15e47 / 2.5e38 = 1.26e9 sec ≈ 40년`
- Stage 15는 log span +60 → 천문학적 (10⁶⁰배 더 오래)

→ **현재 밸런스는 Stage 14·15·16을 **수학적으로** 디자인 max 안에서 클리어 불가능**한 구조입니다. 누군가 게임을 "끝내려면" 코드의 `rootMaxLevel: Number.MAX_SAFE_INTEGER` 허점을 통해 레벨 30을 넘어 사야 함 (디자인 의도에 어긋남).

이전 시뮬에서 round-robin 741시간 / time_priority 307시간이 나왔던 이유는 시뮬레이터가 30 최종 레벨 기준을 적용하지 않아서 time L 98–115까지 사고 있었기 때문입니다 (실제로는 살 수 없는 레벨).

### 즉시 권장 수정
1. **Stage 14의 `cosmicTimeSec`를 `1e22` 정도로 축소** (현재 3.15e47, log span -26)
2. **Stage 15의 `cosmicTimeSec`를 `1e25` 정도로 축소** (현재 3.15e107, log span -82)
3. **Stage 16의 `cosmicTimeSec`를 `1e26` 정도로 축소** (현재 3.15e110)

이렇게 하면 time L 30 + cross-node로 stage 14·15·16이 합리적 시간 안에 클리어 가능 (시뮬레이터로 검증 가능).

또는 대안으로 cross-node tier 35/40을 추가하거나 time skill의 base cost를 `10` → `5`로 낮춰서 더 많은 레벨을 살 수 있게 만들 수 있음 (단, 디자인 일관성을 위해 milestones도 35/40 추가 필요).

---

## 🎯 threshold를 올리면 stage 시간이 줄어드는 이유

시뮬레이터에서 stage 5 threshold를 단독 변경 (다른 변수 모두 고정):

```
threshold = 5e5    → 31.6h
threshold = 5e6    → 21.6h  (현재값)
threshold = 5e7    → 11.6h
threshold = 5e8    →  1.7h
threshold = 5e9    →  0.18h
```

**원인**: 현재 stage 5는 cosmic-bound. quanta는 1초만에 충족되고 21시간은 cosmic clock 대기. 그동안 player는 quanta를 계속 모으지만 time skill 다음 레벨 비용 (`10^L`)이 천문학적이라 살 수가 없음.

threshold를 올리면:
1. quanta-grind 시간이 길어짐 → 그 사이 quanta 누적량 증가
2. 누적된 quanta로 **time skill 레벨을 더 올림**
3. time L 1 증가 = cosmic fill rate 10× → 대기시간 1/10
4. 결국: 늘어난 grind 시간 + (1/10로 줄어든) 대기 < 원래 대기 시간

이건 시뮬 버그가 아니라 **실제 게임 동역학**입니다. Quanta-bound stages (예: stage 11)는 정반대로 작동 — threshold 10× → 시간 4.5× 증가.

이 비대칭성이 의미하는 것: **현재 quanta gate가 너무 약해서 time skill에 투자할 quanta 예산이 자연스럽게 안 생긴다**. 디자인의 결함.

---


> 시뮬레이터: `balance-simulator.html` (브라우저에서 열어 인터랙티브하게 조정 가능)

## TL;DR

**현재 밸런스로는 100시간이 불가능합니다 — 너무 짧거나 너무 김.**

| 시나리오 | 총 시간 | 100h 대비 |
|---|---|---|
| 10 cps + round-robin (실제 게임 모델) | **741 hr** | 7.4× 초과 |
| 10 cps + time_priority | 307 hr | 3.1× 초과 |
| 10 cps + cheapest 전략 | 1049 hr | 10.5× 초과 |
| 0.5 cps idle | 754 hr | 7.5× 초과 |
| 20 cps 매크로 | 739 hr | 7.4× 초과 |
| no_time_gate (quanta만) | 6.8 hr | 0.07× (너무 짧음) |
| **권장 리밸런스** (cosmic time span 재조정) | **119 hr** | 1.19× ✓ |

**핵심 발견**: CPS는 거의 영향이 없습니다 (0.5~20 cps 범위에서 738~754hr). 게임의 페이싱은 **cosmic time gate**가 100% 결정합니다 — quanta는 1초 안에 충족되지만 cosmic clock이 차길 기다리는 시간이 압도적입니다.

---

## 1. 게임의 두 게이트 시스템

각 스테이지를 넘기려면 **두 조건 모두** 만족해야 함:

```ts
// src/game/formulas.ts:160
export function canCondense(state: GameState): boolean {
  ...
  return state.quanta >= threshold && state.cosmicClockSec >= stage.cosmicTimeSec;
}
```

| 조건 | 어떻게 채워지나 | 스킬 효과 |
|---|---|---|
| `quanta >= threshold` | 클릭 + auto | click L → power × `2^L`, auto L → rate × `2^L` |
| `cosmicClock >= stage.cosmicTimeSec` | 시간 흐름 | time L → fill rate × `10^L` per real second |

스킬 비용 (지속):
- click/auto/crit: `2^(L-1)` quanta
- time: `10^(L-1)` quanta

비용/효과 ratio:
- click/auto: 비용도 2x, 효과도 2x → **선형 (한 레벨 사면 게인이 정확히 2배, 비용도 2배)**
- time: 비용 10x, 효과 10x → **선형 (한 레벨 사면 fill rate 10배, 비용도 10배)**

→ **결과**: 무한정 quanta가 있어도 sustained gain 대비 다음 레벨 가격이 같은 비율로 올라가므로, 스킬에 들이는 quanta는 사실상 "기본 grind 시간을 정수 배만큼 압축"하는 것에 불과.

---

## 2. Cosmic Time Gate 분석 (게임을 좌우하는 진짜 변수)

### 게임 내 cosmic time 분포

| Stage | cosmicTimeSec | log10 | 이전 stage 대비 log 증가 | target real time |
|---|---:|---:|---:|---:|
| 1 Inflation | 1e-32 | -32 | (start) | 30s |
| 2 Baryogenesis | 1e-12 | -12 | +20 | 60s |
| 3 QGP | 1e-6 | -6 | +6 | 4m |
| 4 Nucleosynthesis | 180 | 2.3 | +8.3 | 6m |
| 5 Recombination | 1.2e13 | 13.1 | +10.8 | 9m |
| 6 Dark Age | 3.15e15 | 15.5 | +2.4 | 30m |
| 7 First Stars | 6.3e15 | 15.8 | +0.3 | 1h |
| 8 Reionization | 1.6e16 | 16.2 | +0.4 | 1.5h |
| 9 Galaxy | 3.15e16 | 16.5 | +0.3 | 2h |
| 10 Solar | 2.9e17 | 17.5 | +1.0 | 3h |
| 11 Life | 4.35e17 | 17.6 | +0.1 | 4h |
| 12 Red Giant | 5.83e17 | 17.8 | +0.2 | 6h |
| 13 Stelliferous End | 3.15e21 | 21.5 | +3.7 | 10h |
| 14 Degenerate | 3.15e47 | 47.5 | **+26.0** | 15h |
| 15 Black Hole | 3.15e107 | 107.5 | **+60.0** | 24h |
| 16 The End | 3.15e110 | 110.5 | +3.0 | 32.6h |

### 시간 채움 속도 (time skill L에 대해)

`fill rate = 10^L cosmic-sec / real-sec`

| time L | fill rate (cosmic-sec/real-sec) | log10 |
|---:|---:|---:|
| 0 | 1 | 0 |
| 10 | 1e10 | 10 |
| 20 | 1e20 | 20 |
| 30 | 1e30 | 30 |
| 50 | 1e50 | 50 |
| 100 | 1e100 | 100 |

### 결론: 어느 stage가 어느 time L 필요한가

각 stage에서 **이전 stage 대비 cosmic 증가 / target real time** 만큼의 fill rate가 필요. 그러므로 필요한 log10(fill rate) = log10(증가량) - log10(target sec):

| Stage | 필요 log fill rate | 필요 time L |
|---|---:|---:|
| 5 Recombination | 13.1 - 2.7 = **10.4** | L≥11 |
| 6 Dark Age | 15.5 - 3.3 = **12.2** | L≥13 |
| 7 First Stars | 15.8 - 3.6 = **12.2** | L≥13 |
| 13 Stelliferous End | 21.5 - 4.6 = **16.9** | L≥17 |
| 14 Degenerate | 47.5 - 4.7 = **42.8** | L≥**43** |
| 15 Black Hole | 107.5 - 4.9 = **102.6** | L≥**103** |
| 16 The End | 110.5 - 5.1 = **105.4** | L≥**106** |

**stage 14·15는 time L 43·103이 필요합니다.** time skill 비용은 `10^(L-1)`이므로 L=43 한 레벨에 `10^42` quanta, L=103 한 레벨에 `10^102` quanta가 필요. 그런데 stage 14 threshold는 `1e30`, stage 15는 `1e36`이라 **이론적으로 절대 살 수 없는 레벨**.

→ **현재 밸런스에서는 stage 14·15·16이 cosmic time gate에 의해 사실상 통과 불가능**합니다. 시뮬레이션이 끝나는 이유는 quanta가 충분히 grind되어 time level 95~100을 살 수 있을 정도로 quanta를 모으기 때문 (그것도 비현실적으로 오래 걸려서 22일이 됨).

---

## 3. Round-robin 4-track 전략 시뮬레이션 (10 CPS)

설정: `cps=10`, `combo=100 (saturated → mult 8)`, round-robin click→auto→crit→time, cross-node greedy, log_cosmic time mode.

```
Stage                       Real      Target   bottleneck
---------------------------------------------------------
1  Inflation                 0.5s     30s      quanta
2  Baryogenesis              1.6s     1m       quanta
3  Quark-Gluon Plasma       43.4s     4m       quanta
4  Nucleosynthesis           4.2m     6m       quanta
5  Recombination            21.6h     9m       cosmicTime  ← 144배 초과
6  Cosmic Dark Age          14.4h     30m      cosmicTime  ← 29배 초과
7  First Stars              52.5m     1h       cosmicTime
8  Reionization              2.7h     1.5h     cosmicTime
9  Galaxy Formation         25.9m     2h       cosmicTime
10 Solar System             26.2s     3h       quanta      ← 너무 빠름
11 Life on Earth             2.1m     4h       quanta      ← 너무 빠름
12 Death of Star            17.5m     6h       quanta      ← 너무 빠름
13 Stelliferous End         46.3m     10h      quanta      ← 너무 빠름
14 Degenerate Era            5.2d     15h      cosmicTime  ← 8배 초과
15 Black Hole Era           22.4d     1d       cosmicTime  ← 22배 초과
16 The End                   1.6d     32.6h    cosmicTime
---------------------------------------------------------
Total: 741 hr
```

### 패턴
- **Stage 1–4**: quanta 게이트로 1분 미만 (target 대비 100x 빠름)
- **Stage 5–9**: cosmic time이 처음으로 활성화 → time L 11~15 필요인데 round-robin으론 L 9~12. → 몇 시간 stuck
- **Stage 10–13**: time L가 충분해져서 quanta가 다시 bottleneck → 30분 미만 (target 대비 6~30x 빠름)
- **Stage 14–16**: cosmic time이 폭발 (log10 +26, +60, +3) → time L 30+ 필요, 며칠 stuck

→ **스테이지별로 페이싱이 wildly inconsistent**. 진행감(pacing curve)이 깨져 있음.

---

## 4. CPS는 왜 영향이 없는가

| cps | 총 시간 |
|---:|---:|
| 0.5 | 754 hr |
| 1 | 743 hr |
| 3 | 744 hr |
| 5 | 742 hr |
| 10 | 741 hr |
| 20 | 739 hr |

**1.5% 차이**. 이유: cosmic time gate가 모든 시간을 잡아먹고, quanta는 부수적. 어느 cps든 quanta는 즉시 채워짐 (1분 미만), 나머지는 모두 cosmic clock 기다리기.

**시사점**: 현재 게임은 active play 인센티브가 사실상 없음. 클릭을 빠르게 해도 진행이 빨라지지 않음. idle 게임의 핵심인 "active 시 부스트" 감각이 없음.

---

## 5. 스킬 전략 비교

| Strategy | 총 시간 | 최종 C/A/R/T |
|---|---:|---|
| round_robin (당신 시나리오) | 741 hr | 272/272/272/98 |
| cheapest (가장 싼 것 우선) | **1049 hr** | 324/324/324/98 |
| time_priority (time만 우선) | **307 hr** | 293/0/0/98 |
| quanta_priority (click/auto/crit 우선) | timeout | — |

**time_priority가 압도적**: round-robin 대비 2.4배 빠름. 즉 게임에서 합리적 플레이어는 time 스킬에만 투자해야 함 — 다른 트랙은 사실상 더미.

---

## 6. 캐쉬샵 영향

기본 샵 아이템 (`src/game/shop/items.ts`):
- Time Boost: ×10 for 10분, $0.99
- Cosmic Surge (quanta): ×3 for 30분, $2.99
- Aeon Surge: ×100 for 30분, $4.99

10 cps + Aeon Surge ×100 마다 60분: 748 hr (거의 동일). 30분마다 + 항상 사용: 효과 미미.

**이유**: 30분 ×100 = 1800배의 cosmic-second 제공. Stage 15는 1e60배의 추가 cosmic-second가 필요. **현재 샵 가격으로는 게임을 완료할 수 없음**.

→ **샵이 진행에 의미있는 영향을 주려면 기본 cosmic time 게이트가 합리적인 수준이어야 함**.

---

## 7. 권장 리밸런싱 (시뮬레이터 검증)

### 핵심 변경사항

**1. Cosmic time span을 stage별로 일정한 log 비율로 재구성**

각 스테이지의 `cosmicTimeSec` 증가량을, 그 시점에 player가 가진다고 가정한 time level의 fill rate × target real time이 되도록 설계.

```js
// 새로운 cosmicTimeSec 권장값 (player가 stage i에서 time L = 2 + 2i 보유 가정)
let cum = 1e-34;
const expectedTimeLevel = (i) => Math.min(30, 2 + i * 2);
stages.forEach((s, i) => {
  const tL = expectedTimeLevel(i);
  const span = Math.pow(10, tL) * s.realPlayTargetSec * 0.8;
  cum += span;
  s.cosmicTimeSec = cum;
});
```

**2. 시뮬레이터로 검증한 결과**

```
Total: 119 hr  (목표 100hr 대비 +19%, 80~130h 범위 내)
```

스테이지별 분포는 여전히 prep 필요하지만, **cosmic time이 게이트로 작동하는 정상 범위**로 들어옴.

**3. Time skill cost growth 완화 (대안)**

Time skill cost를 `10^(L-1)` → `5^(L-1)`로 낮추기:

| skillCostBase.time | 총 시간 | 최종 time L |
|---:|---:|---:|
| 10 (현재) | 741 hr | 98 |
| 5 | 422 hr | 102 |
| 3 | 174 hr | 103 |
| **2.5** | **74 hr** | 103 |
| 2 | 31 hr | 110 |

**`skillCostBase.time = 2.5`로 낮추면 round-robin도 100시간 근처**가 됩니다.

**4. Time fill base 강화**

| timeFillBase | 총 시간 |
|---:|---:|
| 10 (현재) | 741 hr |
| 12 | 632 hr |
| 15 | 585 hr |
| 20 | 486 hr |
| 50 | 278 hr |
| 100 | 183 hr |

자체로는 부족 — 별도 변경과 결합해야 함.

### 권장 조합 (100시간 타겟)

| 변경 | 변경 전 | 변경 후 |
|---|---|---|
| `skillCostBase.time` | 10 | **2.5~3** |
| late-stage `cosmicTimeSec` | log +60 점프 | log +5~10 균등 |
| Aeon Surge factor | 100 | 1000+ (or duration 10x) |

---

## 8. 시뮬레이터 사용법

`balance-simulator.html`을 브라우저에서 열어주세요. 사이드바에서 인풋 조정:

| 섹션 | 핵심 인풋 | 효과 |
|---|---|---|
| **플레이 패턴** | cps, combo, skill strategy | 액티브/아이들 시뮬 |
| **스킬 비용/효과** | cost base, power per L, time fill base | 한 레벨의 비용·이득 |
| **Cross-node multipliers** | tier별 click/auto/crit/time × | 5/10/15/.../30 단계의 보너스 |
| **캐쉬샵** | useShop, factor, duration, frequency | 샵이 페이싱에 미치는 영향 |
| **스테이지 임계값** | quanta threshold + cosmic sec + target | 각 스테이지의 두 gate |

프리셋:
- `기본` / `10 CPS`: 게임 현재 밸런스
- `완전 idle`: 0 cps (auto 만)
- `100h 목표`: 권장 리밸런스 적용
- `샵 풀스펙`: 샵 항상 사용

**자동 재계산**: 인풋을 변경하면 100ms 디바운스 후 자동 재시뮬. 결과는 차트 + 표로 즉시 표시.

**bottleneck 색상**:
- 🔴 빨강 = quanta가 부족해서 시간 대부분 소모
- 🔵 파랑 = quanta는 채웠으나 cosmic time gate 대기
- 🟢 초록 = 동시에 만족 (이상적)

**deviation 색상**:
- 🟢 ±30% 이내 = OK
- 🟡 ±100% 이내 = 경고
- 🔴 ±100% 초과 = 페이싱 깨짐

---

## 9. 시뮬레이터의 한계

- **확률적 요소 무시**: crit/encounter는 expected value로 처리 (실제 게임은 분산 있음)
- **combo 가정**: sustained combo 100 (cap 도달) 가정. 실제로는 idle 시 0
- **Mechanic 효과 단순화**: per-stage onClick 보너스는 단순 평균 multiplier로 모델링 (예: hawking_radiation은 progress에 따라 1.5→5.5 변하는데 평균 3.5로 처리)
- **purchasing 전략**: 1초당 1번 구매 (현실적이지만 이론 최적과는 다름)
- **offline 진행 무시**: 현재 시뮬은 100% online 기준
- **샵 구매 패턴**: 60분마다 boost 1개 자동 구매 (실제 결제 행동과 다름)

---

## 10. Action Items (우선순위 순)

1. **Stage 14·15의 `cosmicTimeSec`를 현실적 범위로 축소** (현재 1e47, 1e107 → 1e22, 1e25 정도)
   - 가장 critical. 현재 late game은 사실상 unreachable
2. **`time` skill cost growth를 `10^L` → `3^L` 또는 `5^L`** 로 완화
   - 또는 cross-node time mult를 더 강화
3. **CPS가 진행에 영향을 주도록 mechanism 추가**
   - 옵션 A: cosmic clock도 클릭으로 진행 (scaled)
   - 옵션 B: late-stage mechanics (proton_decay 등)이 cosmic time도 forward
4. **Stage 5·6 (Recombination, Dark Age) cosmic time을 아래로 조정**
   - 현재 target 9분/30분이지만 실제 21시간/14시간
5. **Stage 10–13 quanta threshold를 위로 조정**
   - 현재 26초~46분, target 3시간~10시간 (cosmic time이 이미 충족된 상태에서 quanta가 너무 빨리 충족됨)

---

## 11. 시뮬레이터 파일 위치

- `balance-simulator.html` — 인터랙티브 브라우저 시뮬레이터 (이 파일을 더블클릭하면 열림)
- `BALANCE_ANALYSIS.md` — 이 문서
