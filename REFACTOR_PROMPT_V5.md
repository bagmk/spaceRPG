# Cosmic Coalescence — Refactor V5 Specification

> **Audience**: Autonomous coding agent with full repo access.
> **Mode**: Plan-then-execute. Run `npm run build && npm test` after every module.
> **Status**: Builds on V1+V2+V3+V4. **V5 supersedes parts of V4** — see §0.1.

V5 addresses user complaints after V4 was implemented. The complaints were specific and actionable; V5 keeps scope tight.

The 11 issues being fixed:

1. **Stages 1–2 too long** — Halve `realPlayTargetSec` for stages 1 and 2.
2. **Critical multiplier too strong early** — User filled stage 2 with a single crit. Lower base crit mult and crit chance growth.
3. **Condense still consuming entropy somewhere** — V3-D said remove this; verify and finish removal.
4. **SP shown on main screen** — Hide SP from the main UI; only show inside the Skills panel header.
5. **Skill tree text clutter** — Remove inline names like "Echoing Click", "Inflaton Echo" from tree itself. Show only icons + Lv numbers in tree. Names only in detail card.
6. **Cross-nodes need their own UI slot** — Place a "+" / cross-node icon to the *right of each milestone level* in each track. Click "+" → detail card opens.
7. **Track gating must come back** — V4 made all 4 tracks always visible. User wants them revealed one by one across early stages: stage 1 = Stellar Forge only; stage 2 + Quantum Lens; stage 3 + Cosmic Web; stage 4 + Aeon Drive. Restore V3-style stage gating.
8. **Skill tree concept poorly explained** — Add a first-time onboarding overlay in the Skills panel that walks the player through how the tree works.
9. **Cosmic time scale wrong** — Time gauge must reflect *actual cosmic time span* of each stage. Without Aeon Drive investment, the cosmic clock for late stages literally cannot complete in human time. Aeon Drive levels exponentially compress real-time → cosmic-time mapping.
10. **Stage-specific dynamics not running** — Black hole shrinking (stage 15) and Earth phase changes (stages 10, 11) were specced but visually not happening. Wire them up properly.
11. **Click events sometimes don't register** — Investigate and fix dropped click events. Likely stale closures, event throttling, or pointer-events conflicts.

Implementation order: V5-A → V5-K (see §13). Each module is self-contained.

---

## 0. V5 Supersedes V4 — Reconciliation

### 0.1 Direct conflicts

| Topic | V4 said | V5 says | Action |
|---|---|---|---|
| Stage 1 realPlayTargetSec | 60 | 30 | Halve |
| Stage 2 realPlayTargetSec | 120 | 60 | Halve |
| Crit multiplier formula | `3 + level * 0.5` | `1.5 + level * 0.3` | Replace formula |
| Crit chance formula | `level * 0.025` (max 50 %) | `level * 0.015` (max 40 %) | Replace formula |
| Track unlock | Always visible (no stage gating) | Stage-gated: stage 1=Stellar Forge only, stage 2 adds Quantum Lens, stage 3 adds Cosmic Web, stage 4 adds Aeon Drive | Restore V3 gating |
| SP on main screen | "Display SP count in Resource Panel header" | Remove from main screen; show only inside Skills panel | Delete badge from Resource Panel |
| Skill tree text labels | Inline node names ("Echoing Click", etc.) | Icons + Lv numbers only | Remove text labels from tree cells |
| Cross-node placement | Drawn between tracks horizontally | "+" icon on right side of each track at each milestone Lv (5, 10, 15, 20, 25, 30) | Reposition cross-nodes |

### 0.2 V4 features V5 keeps

- Time gauge mechanic (V4-E) — re-tuned per V5-G.
- Two-criteria condense (V4-F).
- Cosmic Shop (V4-G).
- Skill Points exist as currency.
- 16 stages with V3 pacing (stages 3–16 unchanged from V3).
- All clusterModes, sprites, particle pools.
- Save migration chain.

---

## 1. Module V5-A — Stage 1 / 2 Timing Halve

### 1.1 Change

In `src/game/stages.ts`:

```ts
// Stage 1 (Inflation)
realPlayTargetSec: 30,    // was 60

// Stage 2 (Baryogenesis)
realPlayTargetSec: 60,    // was 120
```

### 1.2 Threshold adjustments

Halving real-time without adjusting threshold could leave stage 1 unbeatable (less time to gather quanta). Halve thresholds proportionally:

```ts
// Stage 1
threshold: 25,   // was 50
// Stage 2
threshold: 200,  // was 400
```

### 1.3 Acceptance

- Fresh save: stage 1 clears in ~30 s with no skills bought.
- Stage 2 clears in ~60 s with Stellar Forge level ~1–2.

---

## 2. Module V5-B — Crit Multiplier and Chance Reduction

### 2.1 New formulas

In `src/game/skills/effects.ts` and `formulas.ts`:

```ts
// CRIT MULTIPLIER — softer growth, weaker base
export function getCritMultiplier(critLevel: number, mods: Modifiers): number {
  const base = 1.5 + critLevel * 0.3;
  // Quantum Lens milestones add small bonuses
  let bonus = 0;
  if (critLevel >= 10) bonus += 1.0;
  if (critLevel >= 20) bonus += 2.0;
  if (critLevel >= 30) bonus += 3.0;
  return (base + bonus) * mods.critMultMult;
}
// Lv 0: 1.5x, Lv 1: 1.8x, Lv 5: 3.0x, Lv 10: 5.5x, Lv 20: 9.5x, Lv 30: 16.5x

// CRIT CHANCE — slower growth, lower cap
export function getCritChance(critLevel: number, combo: number, mods: Modifiers): number {
  const base = critLevel * 0.015;            // 1.5 % per level
  const comboBonus = combo * 0.003;          // halved from V3
  const cap = 0.40 + mods.critChanceCapAdd;  // cap was 0.50; now 0.40
  return Math.min(cap, base + comboBonus);
}
// Lv 0: 0 %, Lv 5: 7.5 %, Lv 10: 15 %, Lv 20: 30 %, Lv 30: 45 % (capped at 40 %)
```

### 2.2 Apex still scales

When `cosmos_primal` apex is owned (`mods.apexMult = 10`), crit mult IS scaled by apexMult. So Lv 30 + apex = 16.5 × 10 = 165x. Late game crit can still feel powerful, but only after long investment.

### 2.3 Acceptance

- Reducer test: Lv 1 crit applies 1.8x (not 3.5x).
- Single crit at stage 2 with Lv 1 crit and combo 5 contributes ≤ ~10 quanta to a 200-threshold stage. Cannot single-crit-fill the bar.

---

## 3. Module V5-C — Remove Entropy from Condense

### 3.1 Verify

Search the codebase for any remaining entropy-spend logic in condense or stage advance:

```bash
grep -rn "entropy" src/game/reducer.ts src/components/UpgradePanel.tsx \
                   src/components/ResourcePanel.tsx src/components/GameScreen.tsx
```

### 3.2 Remove any of:

- `state.entropy -= ...` inside CONDENSE / START_CONDENSE / ADVANCE_STAGE.
- UI affordances showing "Spend X entropy to condense".
- Any condense-cost computation that involves entropy.

### 3.3 Confirm `START_CONDENSE` is gated only by §V4-F's two criteria

```ts
case 'START_CONDENSE': {
  if (state.completedRun || state.pendingCondenseStageIdx !== null) return state;
  const stage = STAGES[state.stageIdx];
  const threshold = getEffectiveThreshold(stage, /* ... */);
  const budget = getTimeBudget(stage);
  if (state.quanta < threshold) return state;
  if (state.timeGauge < budget) return state;
  // No entropy check, no entropy deduction.
  const earned = getEntropyOnCondense(state.quanta, threshold);
  return {
    ...state,
    entropy: state.entropy + earned,    // ADDS entropy as reward, never deducts
    pendingCondenseStageIdx: state.stageIdx,
    pendingCondenseEntropy: earned,
    combo: 0,
    lastClick: 0,
    imploding: true,
    condenseStartedAt: action.now,
  };
}
```

### 3.4 Acceptance

- Reducer test: condense never decreases entropy.
- Manual: at any stage, condensing leaves entropy unchanged or increased, never reduced.

---

## 4. Module V5-D — Skill Tree Visual: Icons Only, Cross-Node Slots

### 4.1 Tree visual rules

In the Skills panel:
- Each track is a vertical column.
- Each level slot (1–30) is an icon (small circle, 32 × 32 px).
- **Slot label is only the Lv number** (e.g., "5", "12", "30"). No skill name text in the slot.
- Track header shows the track's *symbol icon* (e.g., 🔥 for Stellar Forge, ⏱ for Aeon Drive) + a tiny lv badge ("Lv 7").

### 4.2 Cross-node placement

At every milestone level (5, 10, 15, 20, 25, 30) of every track, render a small **+ icon to the right** of that level slot.

```
Stellar Forge column:
                 (cross-node icon ⊕ here)
   Lv 30 ●────⊕  ← Apex node
   Lv 29 ○
   Lv 28 ○
   ...
   Lv 25 ●────⊕  ← Lv 25 cross-node (e.g., Big Bang Click)
   ...
   Lv 20 ●────⊕  ← Lv 20 cross-node
   ...
   Lv 15 ●────⊕  ← Lv 15 cross-node
   ...
   Lv 10 ●────⊕  ← Lv 10 cross-node
   ...
   Lv  5 ●────⊕  ← Lv 5 cross-node
   ...
   Lv  1 ◉  ← current next-buyable
```

The ⊕ icon size is also 32 × 32 px. Locked (gray + padlock) until prereqs met.

### 4.3 Click behavior

- Click a track-level slot → detail card opens for that level (cost, effect, buy button).
- Click a ⊕ cross-node → detail card opens for that cross-node (prereq status, cost in SP + quanta, buy button).

### 4.4 Detail card content

Track-level detail:
```
┌────────────────────────────────────────┐
│ ⚡ Stellar Forge — Lv 7 → 8           │
│                                         │
│ Each level multiplies click power by   │
│ 1.6×.                                   │
│                                         │
│ Cost: 12,500 quanta                     │
│ After: click 384 → 614                  │
│                                         │
│   [BUY +1 LEVEL]                        │
└────────────────────────────────────────┘
```

Cross-node detail:
```
┌────────────────────────────────────────┐
│ ⚡ (cross-node icon)                    │
│ Echoing Click                           │
│                                         │
│ Each click has 18 % chance to fire     │
│ twice automatically.                    │
│                                         │
│ Requires:                               │
│   ✓ Stellar Forge Lv 15 (you: 16)      │
│   ✗ Aeon Drive   Lv 10 (you: 7)        │
│                                         │
│ Cost: 1 SP + 50,000 quanta             │
│                                         │
│   [LOCKED — Aeon Drive Lv 10]           │
└────────────────────────────────────────┘
```

### 4.5 Tree itself: NO long text inline

The skill tree column shows only:
- Track header: track icon + "Lv N/30"
- Level slots: small filled/empty/glowing circles with the Lv number inside
- Cross-node slots: + icon (locked padlock or unlocked accent)

Names like "Echoing Click", "Inflaton Echo" appear ONLY in the hover tooltip and the click-to-open detail card. Not on the tree.

### 4.6 Acceptance

- Tree column is clean: no inline node names visible at default zoom.
- Cross-node ⊕ markers visible to right of every milestone (Lv 5/10/15/20/25/30).
- Click ⊕ → detail card opens.

---

## 5. Module V5-E — Stage-Gated Track Visibility (Restore V3 Behavior)

### 5.1 The mapping

| Stage entry | Tracks visible/buyable |
|---|---|
| 1 | Stellar Forge only |
| 2 | + Quantum Lens (added) |
| 3 | + Cosmic Web (added) |
| 4 | + Aeon Drive (added) |
| 5+ | All 4 tracks; cross-nodes Lv 5 visible (if applicable) |
| 7 | Cross-nodes Lv 10 visible |
| 11 | Cross-nodes Lv 15 visible |
| 14 | Cross-nodes Lv 20 visible |
| 15 | Cross-nodes Lv 25 visible |
| 16 | Apex node visible |

### 5.2 Implementation

Restore V3's `unlockedTracks` field in `SkillState`. Update `ADVANCE_STAGE`:

```ts
case 'ADVANCE_STAGE': {
  // existing logic ...
  const nextStageId = state.stageIdx + 2;  // 0-indexed → next stage 1-indexed
  const newUnlockedTracks = [...state.skills.unlockedTracks];
  if (nextStageId === 1 && !newUnlockedTracks.includes('click')) newUnlockedTracks.push('click');
  if (nextStageId === 2 && !newUnlockedTracks.includes('crit'))  newUnlockedTracks.push('crit');
  if (nextStageId === 3 && !newUnlockedTracks.includes('auto'))  newUnlockedTracks.push('auto');
  if (nextStageId === 4 && !newUnlockedTracks.includes('time'))  newUnlockedTracks.push('time');

  return {
    ...state,
    stageIdx: state.stageIdx + 1,
    quanta: Math.max(0, state.quanta - currentStage.threshold),
    timeGauge: 0,
    skills: { ...state.skills, unlockedTracks: newUnlockedTracks },
    skillPoints: state.skillPoints + 1,
    // ... rest of advance logic ...
  };
}
```

### 5.3 Initial state

A fresh save (universe 1) starts in stage 1 (`stageIdx: 0`). `unlockedTracks` should already include `click` so the player can use Stellar Forge from the start of stage 1:

```ts
export function createInitialGameState(now: number): GameState {
  return {
    // ... existing fields ...
    skills: {
      click: { level: 0 },
      auto:  { level: 0 },
      crit:  { level: 0 },
      time:  { level: 0 },
      unlockedTracks: ['click'],   // Stellar Forge available from stage 1
      ownedCrossNodes: [],
    },
  };
}
```

For prestige (subsequent universes), keep `unlockedTracks` from prior run (so `unlockedTracks` persists across universes). This way the player doesn't lose visibility on tracks they already unlocked.

### 5.4 Tree rendering with locked tracks

In the Skills panel, render all 4 columns. For tracks NOT in `unlockedTracks`:
- Render the column dimmed (50 % opacity).
- Overlay a large padlock icon on the column.
- A tooltip "Unlocks at Stage N" with N being 1/2/3/4.

For tracks in `unlockedTracks`: render normally.

### 5.5 Acceptance

- Fresh save: only Stellar Forge column is interactive in stage 1.
- After advancing to stage 2: Quantum Lens column lights up.
- After stage 4: all 4 columns interactive.
- Across universes, unlocked tracks persist (no need to reach stage 4 again to use Aeon).

---

## 6. Module V5-F — Skill Tree First-Time Tutorial

### 6.1 Trigger

When the player opens the Skills panel for the *very first time* (or whenever `state.tutorialFlags['skill_tree_intro']` is false), show a 4-step walkthrough overlay.

### 6.2 Steps

Use a translucent overlay that highlights one element at a time, with a speech bubble explaining:

1. **Step 1 — "What is the skill tree?"**
   - Highlights: the entire Skills panel.
   - Bubble (Korean):
     > "스킬 트리는 너의 우주를 강화하는 도구야. 4개의 트랙(Click, Crit, Idle, Time)에 레벨을 올려서 더 강해져."

2. **Step 2 — "Track levels"**
   - Highlights: the active track's Lv 1 slot.
   - Bubble:
     > "각 트랙은 1부터 30까지 올릴 수 있어. 클릭해서 quanta로 사봐."

3. **Step 3 — "Milestones"**
   - Highlights: the Lv 5 slot and its ⊕ cross-node icon.
   - Bubble:
     > "5, 10, 15, 20, 25, 30 레벨마다 ★ milestone 보너스가 있고, 옆에 ⊕ 아이콘 누르면 cross-node를 살 수 있어. cross-node는 SP가 필요해."

4. **Step 4 — "What's next?"**
   - Highlights: the locked tracks.
   - Bubble:
     > "다른 트랙은 다음 스테이지로 가면 풀려. 일단 Stellar Forge로 시작해보자."
   - Button: "Got it!" — dismisses tutorial; sets `tutorialFlags.skill_tree_intro = true`.

### 6.3 Re-trigger logic

- Subsequent universes (universeCount > 1): no tutorial.
- If user clicks the ❓ icon in the Skills panel header anytime later, the tutorial replays.

### 6.4 Acceptance

- First time opening Skills panel: 4-step walkthrough fires.
- After dismissing: doesn't re-fire on subsequent opens this save.
- Universe 2+: doesn't fire.
- ❓ icon manually triggers replay.

---

## 7. Module V5-G — Cosmic Time Real-Scale Mapping

### 7.1 The principle

Each stage has a `cosmicTimeSpan = stage.cosmicTimeSec - prevStage.cosmicTimeSec` (in cosmic seconds). The time gauge represents *cosmic time elapsed in this stage*. Display shows actual cosmic units.

Without Aeon Drive investment, the cosmic clock for late stages literally cannot complete in any reasonable real-time. Aeon Drive levels accelerate the clock exponentially.

### 7.2 Fill rate formula

```ts
// formulas.ts
export function getTimeFillRateGauge(stage: Stage, aeonLevel: number, mods: Modifiers): number {
  // Returns gauge units per real second. Gauge is normalized 0..100.
  // baseFillTime: real seconds to fill at Aeon Lv 0.
  const stageMod = stageTimeMod(stage.id);
  const baseFillTime = stage.realPlayTargetSec / stageMod;
  const baseRate = 100 / baseFillTime;             // gauge units per real sec
  const aeonMult = Math.pow(1.15, aeonLevel);
  const apexMult = mods.apexMult;                  // 1 default, 10 with cosmos_primal
  return baseRate * aeonMult * apexMult * mods.timeMult;
}

function stageTimeMod(stageId: number): number {
  // Stages 1-4: full speed (early stages playable without Aeon).
  // Stages 5+: progressively slower, requiring Aeon Drive investment.
  if (stageId <= 4) return 1.0;
  return Math.max(0.05, 1 - (stageId - 4) * 0.08);
  // Stage 5: 0.92, Stage 10: 0.52, Stage 16: 0.05
}
```

### 7.3 Real-time fill estimates at various Aeon levels

| Stage | mod | base fill (Aeon 0) | Aeon 10 (4x) | Aeon 20 (16x) | Aeon 30 (66x) |
|---|---:|---:|---:|---:|---:|
| 1 | 1.00 | 30 s | 7.5 s | 1.9 s | 0.45 s |
| 5 | 0.92 | 587 s (10 min) | 147 s | 37 s | 8.9 s |
| 10 | 0.52 | 20800 s (5.8 hr) | 5200 s | 1300 s | 5.3 min |
| 14 | 0.20 | 270000 s (75 hr) | 67500 s | 4.7 hr | 68 min |
| 16 | 0.05 | 2.35M s (27 days) | 588000 s | 9.8 hr | 9.9 hr |

Without Aeon Drive, stage 16 is 27 days. At Aeon 30 + Apex (×10 multiplier from cosmos_primal), it becomes ~1 hour. This forces multi-universe progression and Aeon Drive maxing.

### 7.4 Cosmic-time display

In `Timeline.tsx`, show actual cosmic time elapsed since Big Bang based on (gauge progress + previous stages' cosmicTimeSec):

```ts
function getDisplayedCosmicTime(state: GameState): number {
  const stage = STAGES[state.stageIdx];
  const prev = state.stageIdx === 0 ? null : STAGES[state.stageIdx - 1];
  const stageStart = prev?.cosmicTimeSec ?? 0;
  const stageEnd = stage.cosmicTimeSec;
  const fraction = state.timeGauge / 100;
  return stageStart + fraction * (stageEnd - stageStart);
}
// Display via formatCosmicTime(seconds) — already has logic for s, min, yr, Myr, Gyr, scientific.
```

The cosmic clock shows:
- Stage 1 progress 50 %: "T = 5e-33 s"
- Stage 5 progress 50 %: "T = 6e12 s" or "T = 190 Kyr"
- Stage 16 progress 50 %: "T = 1.5e103 yr"

### 7.5 Time gauge visual on screen

The gauge itself stays normalized 0–100 % in the Resource Panel:

```
┌───────────────────────────────────┐
│ NUCLEI                  +5/s      │
│ 8,400 / 12,000                     │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░  70 %        │
│                                    │
│ COSMIC TIME                        │
│ 67 / 100                           │
│ ▓▓▓▓▓▓▓▓▓▓▒▒▒░░░░░░░  67 %        │
│ T = 254 Kyr                        │
└───────────────────────────────────┘
```

The "T = 254 Kyr" subtitle is formatted by `formatCosmicTime`.

### 7.6 Acceptance

- Stage 1, Aeon Lv 0: time gauge fills in ~30 s.
- Stage 5, Aeon Lv 0: time gauge fills in ~10 min.
- Stage 10, Aeon Lv 0: time gauge fills in ~5.8 hours.
- Stage 16, Aeon Lv 0: would take ~27 days (impossible — must invest).
- Cosmic clock display shows correct values with proper units (`s`, `min`, `yr`, `Myr`, `Gyr`, scientific) per stage.
- Saving and reloading mid-stage preserves cosmic clock position.

---

## 8. Module V5-H — Stage Dynamics Enforcement (Black Hole, Earth)

### 8.1 The complaints

User says "내가 블랙홀이랑 작아지고, 지구 변하는것도 이야기 한것 같은데 스테이지 별로 바뀌는것 잘 구동이 안되었네." Translation: black hole shrinking and Earth changing were specced but they don't actually run.

### 8.2 Black hole shrinking — verify

In `canvas/drawCluster.ts → drawBlackHoleScene`, ensure:

```ts
function drawBlackHoleScene(args: DrawClusterArgs): void {
  const { ctx, stage, cx, cy, width, height, progress, now } = args;
  const minDim = Math.min(width, height);
  const initialRadius = minDim * 0.3;
  const finalRadius = 5;
  const bhRadius = initialRadius * (1 - progress) + finalRadius * progress;

  // Lensing distortion of background stars (simplified)
  // ... (see V3-Q §17.2 for full impl)

  // Event horizon
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(cx, cy, bhRadius, 0, Math.PI * 2);
  ctx.fill();

  // Photon ring at 1.5x bhRadius
  ctx.strokeStyle = `rgba(255, 220, 180, ${0.6 + 0.4 * Math.sin(now / 600)})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, bhRadius * 1.5, 0, Math.PI * 2);
  ctx.stroke();

  // Final 1 % evaporation flash
  if (progress > 0.99) drawEvaporationFlash(ctx, cx, cy, progress);
}
```

The progress comes from `quanta / threshold`. As progress goes from 0 to 1, BH visibly shrinks. **Verify this draws every frame** — if it's drawing once and not reacting to progress, fix the calling code in `ParticleField.tsx` to pass current progress every frame.

### 8.3 Click on stage 15 = photon emission

In `mechanics/hawking_radiation.ts`, the `onClick` should:

```ts
onClick(state, world, x, y): MechanicClickResult {
  // Click outside event horizon spawns photon flying radially outward FROM black hole center.
  const cx = world.width / 2;
  const cy = world.height / 2;
  const angle = Math.atan2(y - cy, x - cx);
  const radius = bhRadius(state);
  // photon starts at edge of event horizon
  world.bursts.push({
    x: cx + Math.cos(angle) * radius * 1.5,
    y: cy + Math.sin(angle) * radius * 1.5,
    vx: Math.cos(angle) * 6,
    vy: Math.sin(angle) * 6,
    r: 3,
    life: 1,
    color: getHawkingPhotonColor(bhRadius(state)),
    spriteId: 15,
  });
  return { consumed: false };  // base CLICK still applies
}
```

### 8.4 Earth phase changes — verify

In `canvas/drawCluster.ts → drawSolarSystem` (V4-L, 9 phases), confirm `progress` parameter drives `getSolarPhase(progress)` every frame. If the phase function is being called with stale values, fix.

For `drawLifeSurface` (stage 11), V3-O specced 5 inner steps. Ensure each phase's draw function is invoked based on current progress. The Civilization Flicker in last 1 % must trigger a one-shot animation; track it in `world.mechanicState.life_evolution.civFlickerStarted`.

### 8.5 Acceptance

- Stage 15: click anywhere → photon spawns and flies outward from BH center.
- Stage 15: BH visibly shrinks as progress fills (visible at multiple progress points: 25 %, 50 %, 75 %, 95 %).
- Stage 10: visual phase transitions at 10 %, 25 %, 40 %, 55 %, 70 %, 80 %, 90 %, 95 %.
- Stage 11: civilization flicker fires once at progress >= 0.99.

---

## 9. Module V5-I — Click Event Reliability Fix

### 9.1 The complaint

"클릭하는데 에러? 클릭해도 아무 반응 안하는 일들이 너무 많다." Translation: clicks frequently produce no response.

### 9.2 Likely causes (investigate each)

1. **Stale closure** — `useGameLoop` callback references stale `state` because `useEffect` dependency missing. Fix: use a ref for state inside callback.

2. **Event throttling** — `playClick` rate limit (`CLICK_MIN_GAP_MS = 30 ms`) hard-blocks clicks faster than 33 Hz. On mobile rapid tap sequences this could drop. Lower to 10 ms or remove.

3. **Pointer-events: none** — A CSS layer overlapping the click target may have `pointer-events: auto` accidentally. Audit `ParticleField.tsx` overlay elements.

4. **Click only on canvas, not on full play area** — If `onClick` is on canvas but mobile users tap on a slightly off-canvas pixel, miss. Wrap in a div that captures clicks and forwards.

5. **State predicates in CLICK reducer too restrictive** — The reducer drops clicks if `state.completedRun || state.pendingCondenseStageIdx !== null || state.imploding`. Verify these are not erroneously true. Particularly, after condense the `imploding` flag persists for 900 ms (`CONDENSE_IMPLOSION_MS`). Clicks in this window are silently dropped — that's intended. But the post-condense fade transition should be < 1.5 s total.

6. **React re-render race** — The `onClick` handler captures `state` at a stale render. Use a ref or always read from `useGameState`.

### 9.3 Fix checklist

```ts
// 1. Lower rate-limit gap
CLICK_MIN_GAP_MS: 10,    // was 30

// 2. In ParticleField, ensure click handler doesn't drop unrelated state changes
const handleClick = useCallback((e: React.MouseEvent) => {
  const rect = canvasRef.current?.getBoundingClientRect();
  if (!rect) return;
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  onGatherClick(x, y, false);
}, [onGatherClick]);  // onGatherClick depends on state via closure — verify it's the latest

// 3. Add pointer-events: none to overlapping decorative layers
.stage-transition-wash, .float-text {
  pointer-events: none;
}
.encounter-alert {
  pointer-events: none;  // unless tappable
}

// 4. In reducer CLICK case, log dropped clicks (dev mode) for debugging
if (state.imploding) {
  console.debug('Click dropped: imploding');
  return state;
}
```

### 9.4 Add an integration test

```ts
test('rapid clicks all register', () => {
  let state = createInitialGameState(0);
  for (let i = 0; i < 100; i++) {
    state = gameReducer(state, { type: 'CLICK', now: i, randomValue: 0, x: 100, y: 100 });
  }
  expect(state.totalClicks).toBe(100);
});
```

### 9.5 Acceptance

- Tapping rapidly on mobile: every tap produces a floating number.
- Test passes: 100 dispatched CLICK actions all register.
- No console errors during normal gameplay.

---

## 10. Module V5-J — SP Hidden from Main Screen

### 10.1 Remove SP badge

V4-A added a small "SP 5" badge in the Resource Panel header. Remove it.

In `ResourcePanel.tsx`, delete the SP-display element. SP is now visible only:
- Inside the Skills panel header.
- Inside cross-node detail cards (showing cost vs. balance).

### 10.2 Acceptance

- Main screen has no SP-related text.
- Opening Skills panel: SP balance visible at top.

---

## 11. Module V5-K — Skill Tree Concept Tutorial Fix

(Already covered in V5-F. This is the conceptual layer.)

The Skills panel header should also have:
- A small ❓ icon next to the panel title that re-triggers the tutorial walkthrough.
- A subtitle line: "Spend quanta to level up. Spend SP to unlock cross-nodes."

### 11.1 Acceptance

- Skills panel header shows: title + ❓ + brief subtitle.
- Click ❓: tutorial walkthrough replays.

---

## 12. Module V5-L — Save Migration v5 → v6

### 12.1 Schema bump

Bump version to 6. No new state fields needed (all V5 changes are formula tweaks and visibility). But:
- Reset `unlockedTracks` based on current stage if missing.
- Ensure `tutorialFlags` map exists.

```ts
function migrateV5ToV6(v5: SaveStateV5): SaveStateV6 {
  // Reconstruct unlockedTracks from current stage progression
  const unlockedTracks: TrackId[] = [];
  if (v5.stageIdx >= 0) unlockedTracks.push('click');
  if (v5.stageIdx >= 1) unlockedTracks.push('crit');
  if (v5.stageIdx >= 2) unlockedTracks.push('auto');
  if (v5.stageIdx >= 3) unlockedTracks.push('time');

  return {
    ...v5,
    version: 6,
    skills: { ...v5.skills, unlockedTracks },
    tutorialFlags: v5.tutorialFlags ?? {},
  };
}
```

### 12.2 Acceptance

- v5 save loads cleanly into v6.
- Existing player on stage 7 (mid-game) has all 4 tracks unlocked.

---

## 12.5 Module V5-M — Cumulative State on Stage Advance

### 12.5.1 The complaint

User: "다음 스테이지 가도 전에 quanta는 가져가고 시간도 그대로 들고 가야지." Translation: "When advancing, quanta must be carried over and time must be kept too."

V3-C already specced quanta carry-over, but the user is also asking for *cosmic time continuity*. Visually the cosmic clock should NEVER reset — it's a monotonic record of universe age since Big Bang.

### 12.5.2 Design: cumulative cosmic clock + per-stage gauge

Two distinct concepts:

| Concept | Behavior | Storage |
|---|---|---|
| **Cosmic clock** (display) | Monotonic. Always advancing. Survives stage advance. Survives prestige? *No* — resets to 0 on prestige. | Derived: `cosmicClockSec = (stage start cosmic time) + (stageGauge / 100) × (stage cosmic span)` |
| **Stage gauge** (gating) | Per-stage 0–100. Resets to 0 on advance. Used to gate condense. | `state.timeGauge: number` |
| **Quanta** (currency) | Excess above threshold carries to next stage. | `state.quanta: number` |

### 12.5.3 Excess time carry-over

When the player advances at gauge ≥ 100, allow excess to carry into next stage *proportionally*:

```ts
case 'ADVANCE_STAGE': {
  const currentStage = STAGES[state.stageIdx];
  const nextStage = STAGES[state.stageIdx + 1];

  // Quanta: excess carries
  const excessQuanta = Math.max(0, state.quanta - currentStage.threshold);

  // Time gauge: convert excess gauge to next stage's gauge proportionally
  // gauge values are 0..100 normalized, so excess >100 maps to next stage's gauge.
  // Cap the carry-over at 25 % of next stage budget so it doesn't trivialize.
  const gaugeOverflow = Math.max(0, state.timeGauge - 100);
  const carriedTimeGauge = Math.min(25, gaugeOverflow);

  return {
    ...state,
    stageIdx: state.stageIdx + 1,
    quanta: excessQuanta,
    timeGauge: carriedTimeGauge,           // CARRY OVER (capped)
    // skill levels untouched ✓
    combo: 0,
    lastClick: 0,
    pendingCondenseStageIdx: null,
    pendingCondenseEntropy: 0,
    imploding: false,
    condenseStartedAt: null,
    skillPoints: state.skillPoints + 1,
  };
}
```

### 12.5.4 Cosmic clock continuity in UI

In `Timeline.tsx` and `ResourcePanel.tsx`, derive the displayed cosmic clock from cumulative cosmic time:

```ts
function computeCumulativeCosmicTime(state: GameState): number {
  const stage = STAGES[state.stageIdx];
  const prevStage = state.stageIdx === 0 ? null : STAGES[state.stageIdx - 1];
  const stageStart = prevStage?.cosmicTimeSec ?? 0;
  const stageEnd = stage.cosmicTimeSec;
  const stageFraction = state.timeGauge / 100;
  return stageStart + stageFraction * (stageEnd - stageStart);
}
```

This *never* visually resets across stage advances. From the player's perspective, the cosmic clock just keeps ticking forward.

### 12.5.5 Acceptance

- Reducer test: advance stage with quanta = 1.2 × threshold → next stage starts with quanta = 0.2 × threshold.
- Reducer test: advance stage with timeGauge = 110 → next stage starts with timeGauge = 10.
- Cosmic clock display: continuously increasing across stage transitions. No visible resets.

---

## 12.6 Module V5-N — Stage Transition Lag Investigation

### 12.6.1 The complaint

"랙은 스테이지 넘어갈수록 더 심해진다." Translation: lag gets worse with each stage advance. This is a memory leak or accumulating-state issue.

### 12.6.2 Likely causes

1. **Mechanic state not cleaned up** — `world.mechanicState` from previous stage's mechanic is left in memory. New stage's mechanic adds new state alongside the old. By stage 16 the world holds 16 sets of mechanic state.

2. **Listener leak** — `useEffect` returns no cleanup. Each stage advance adds another listener (audio, animation frame, timer).

3. **Canvas accumulation** — `world.bursts`, `world.flyers`, `world.wakeTrails`, `world.shockwaves`, `world.rogues` arrays grow unbounded if cleanup conditions are off. Verify each has a max-length or age-based cleanup.

4. **React re-renders** — Each stage advance recreates `<ParticleField>` because the `key={stage.id}` prop changes. This *should* be a clean unmount, but if the unmount handler doesn't dispose the audio drone or stop animation frames, leaks happen.

5. **Stage transition's STAGE_TRANSITION_BURST_COUNT = 120** — adds 120 bursts to `world.bursts` on every advance. If burst cleanup is slow or fails, bursts accumulate.

### 12.6.3 Diagnostic adds

In dev mode, log every 5 seconds:

```ts
useEffect(() => {
  if (!isDev) return;
  const id = setInterval(() => {
    console.debug('[perf]', {
      stageIdx: stateRef.current.stageIdx,
      bursts: worldRef.current.bursts.length,
      flyers: worldRef.current.flyers.length,
      rogues: worldRef.current.rogues.length,
      wakeTrails: worldRef.current.wakeTrails.length,
      shockwaves: worldRef.current.shockwaves.length,
      motes: worldRef.current.cluster.motes.length,
      mechanicStates: Object.keys(worldRef.current.mechanicState ?? {}).length,
    });
  }, 5000);
  return () => clearInterval(id);
}, []);
```

If any number grows monotonically across stage advances, that's the leak.

### 12.6.4 Fix checklist

```ts
// 1. On stage advance, clear mechanic state
function resetWorldOnStageChange(world: CanvasWorld, oldStage: Stage, newStage: Stage): void {
  world.bursts.length = 0;
  world.flyers.length = 0;
  world.wakeTrails.length = 0;
  world.shockwaves.length = 0;
  world.rogues.length = 0;
  world.cluster.motes.length = 0;
  world.cluster.nextMoteId = 1;
  world.moteNeighborCache.clear();
  world.moteLastNeighborRefresh = 0;
  world.moteLastAutoSpawnAt = 0;
  world.mechanicState = {};
  // Re-init the new mechanic if needed
  const mech = MECHANICS[newStage.mechanic];
  mech.init?.(stateRef.current, world);
}

// 2. Hard caps on collections
const MAX_BURSTS = 200;
const MAX_FLYERS = 100;
const MAX_WAKES = 60;
const MAX_ROGUES = 5;
// Apply: world.bursts = world.bursts.slice(-MAX_BURSTS);

// 3. ParticleField unmount cleanup
useEffect(() => {
  return () => {
    // cancel all timers, animation frames, audio crossfade promises
    cancelAnimationFrame(rafIdRef.current);
    timerIdsRef.current.forEach(clearTimeout);
    timerIdsRef.current.length = 0;
  };
}, []);

// 4. Audio: ensure drone crossfade properly disposes prior oscillators
// (already in audio.ts — verify the timeout doesn't leak if component unmounts during crossfade)
```

### 12.6.5 Acceptance

- Manual playthrough through 5 stage advances: frame rate stays stable (no degradation).
- Dev console shows bounded collection sizes after each advance (bursts ≤ 200, etc.).
- React DevTools profile: ParticleField doesn't accumulate untouched effects.

---

## 12.7 Module V5-O — Real Cosmic Scale Calibration + Almanac Era Info

### 12.7.1 The complaint

"Quanta도 조금 조사해봐서 실제 우주 모형과 맞게 threshold랑 시간도 실제랑 비슷하게. 그리고 info에 그 부분도 더해주고. 우주의 시대 정보 넣어주고."

Translation: research real cosmic models, set thresholds and times near reality, and add this info to the in-game info panel including era-specific details.

### 12.7.2 Real-world scale anchors per stage

For each stage, set the threshold in a unit that loosely corresponds to real cosmological quantity. Numbers are approximate (game scale, not literal).

| stage | unit interpretation | real scale hint | game threshold |
|---|---|---|---|
| 1 Inflation | spacetime expansion factor | ~10²⁶ expansion | 25 (gameplay; halved in V5-A) |
| 2 Baryogenesis | matter-antimatter pairs | matter survives at 1:10⁹ ratio | 200 (V5-A halved) |
| 3 QGP | hadronization events | ~10⁸⁰ baryons in observable universe | 2,400 |
| 4 Nucleosynthesis | nuclei formed | ~75 % H + 25 % He of all matter | 12,000 |
| 5 Recombination | photons released as CMB | ~10⁸⁹ photons in observable universe | 80,000 |
| 6 Dark Age | hydrogen clouds | ~10⁵⁷ atoms drifting | 600,000 |
| 7 First Stars | Pop III stars | first ~10⁸ stars before reionization | 5,000,000 |
| 8 Reionization | ionized hydrogen volumes | universe goes 100 % ionized | 50,000,000 |
| 9 Galaxy Formation | galaxies | ~2 × 10¹¹ galaxies estimated | 500,000,000 |
| 10 Solar System | planetesimals + planets | ~10²² objects in cosmic neighborhood | 5,000,000,000 |
| 11 Life on Earth | living cells | ~10³⁰ cells estimated to have ever lived | 50,000,000,000 |
| 12 Death of Star | stellar deaths | ~10¹⁵ stellar deaths over universe age | 500,000,000,000 |
| 13 Stelliferous End | dimming events | last stars die over 10¹⁴ yr | 5e12 |
| 14 Degenerate Era | proton decays | 10⁴⁰ yr GUT proton decay (model-dependent) | 5e14 |
| 15 Black Hole Era | Hawking quanta | SMBH evaporation 10¹⁰⁰ yr | 5e17 |
| 16 The End | vacuum fluctuations | infinite quantum noise | 5e21 |

These thresholds are *not* literal; they're calibrated for gameplay. The almanac will explain the loose connection.

### 12.7.3 Cosmic time anchors (already in V3, verify accurate)

V3-B's cosmicTimeSec values are accurate. Module V5-O will add the cumulative description in almanac. No threshold changes here, just reinforcement.

### 12.7.4 Almanac era info

Each almanac entry expands to include "Era info" — actual cosmological details for that stage:

```ts
// src/game/almanac.ts
export interface AlmanacEntry {
  id: string;
  title: string;
  short: string;
  body: string;
  funFact: string;
  uncertaintyNote?: string;
  // NEW
  cosmicEra: {
    timeRange: string;            // e.g., "10⁻³⁶ s ~ 10⁻³² s"
    temperature: string;          // e.g., "10²⁸ K → 10²⁷ K"
    keyParticles: string[];       // e.g., ["Inflaton", "Quark", "Antiquark"]
    keyEvents: string[];          // e.g., ["Cosmic inflation", "Reheating"]
    realWorldScale: string;       // human-readable scale comparison
  };
}
```

Example for stage 4 (Nucleosynthesis):

```ts
{
  id: 'nucleosynthesis',
  title: 'Big Bang Nucleosynthesis',
  short: '첫 가벼운 원자핵이 형성된 사건',
  body: '빅뱅 1초쯤 우주는 1조도가 넘게 뜨거웠어. 양성자와 중성자가 자유롭게 떠다녔지. \
3분쯤 되자 우주가 충분히 식어서 (10억도 정도) 양성자와 중성자가 처음으로 \
서로 결합했어. 이때 만들어진 가벼운 원자핵이 모든 무거운 원소의 시초가 됐지.',
  funFact: '오늘날 우주에 있는 모든 헬륨 중 약 75 %는 빅뱅 후 3분 사이에 만들어졌어. \
별이 만든 것보다 훨씬 더 많아.',
  cosmicEra: {
    timeRange: '약 1초 ~ 20분',
    temperature: '10¹⁰ K → 10⁸ K',
    keyParticles: ['Proton', 'Neutron', 'Deuterium', 'Helium-4', 'Lithium-7'],
    keyEvents: ['Neutron decay 시작', 'D 형성', '⁴He 형성', '약간의 ⁷Li 형성'],
    realWorldScale: '수소 75 %, 헬륨 25 %, 그 외 < 1 % — 이 비율은 오늘날까지도 거의 그대로.',
  },
},
```

Provide entries for all 16 stages with similar depth.

### 12.7.5 In-game UI

Almanac modal shows:

```
┌──────────────────────────────────────┐
│ Big Bang Nucleosynthesis    [?]      │
├──────────────────────────────────────┤
│ 첫 가벼운 원자핵이 형성된 사건         │
│                                       │
│ 빅뱅 1초쯤 우주는 1조도가 넘게...     │
│ (full body text)                      │
│                                       │
│ ─── ERA INFO ───                      │
│  ⏱ Time:   약 1초 ~ 20분              │
│  🌡 Temp:   10¹⁰ K → 10⁸ K            │
│  ⚛ Key:    Proton, Neutron, He-4...   │
│  ⚡ Events: Neutron decay 시작...      │
│                                       │
│ 💡 Real-world scale:                  │
│ 수소 75 %, 헬륨 25 %, 그 외 < 1 %     │
│                                       │
│ ─── FUN FACT ───                      │
│ 오늘날 우주에 있는 모든 헬륨...        │
└──────────────────────────────────────┘
```

### 12.7.6 Acceptance

- All 16 almanac entries have `cosmicEra` field populated.
- Almanac modal renders ERA INFO section formatted as above.
- In-game tooltip on stage transition mentions era details.

---

## 12.8 Module V5-P — Distant Cosmic Background + Parallax

### 12.8.1 The complaint

"먼 우주 배경도 있어야지. 내가 움직일 때 배경도 살짝 움직여 주면서 움직임을 표현해주는 것도 있으면 좋겠다. 배경은 각 시대에 맞추어서 조금씩 변동시켜주고."

Translation: there should be a distant cosmic background. When the player moves, the background should slightly move (parallax). Background should change subtly per era.

### 12.8.2 Three-layer parallax background

Add three star/nebula layers to `canvas/drawStars.ts`:

```ts
// constants.ts
STAR_LAYERS: [
  { count: 100, depth: 0.15, rMin: 0.4, rMax: 1.0, alphaMin: 0.15, alphaMax: 0.4 },  // far background
  { count: 70,  depth: 0.4,  rMin: 0.6, rMax: 1.4, alphaMin: 0.25, alphaMax: 0.6 },  // mid
  { count: 35,  depth: 0.8,  rMin: 0.8, rMax: 1.8, alphaMin: 0.35, alphaMax: 0.85 }, // near
]
```

Each star carries a `depth` value. When the player clicks (and `coreVX, coreVY` updates), shift each layer by `depth * coreVX, depth * coreVY`. Layer 0 (depth 0.15) barely moves; layer 2 (depth 0.8) moves prominently.

### 12.8.3 Per-era background motif

Add to each stage definition:

```ts
{
  // ... existing fields ...
  background: {
    gradientTop: '#ffe4c0',
    gradientBottom: '#9c4a00',
    nebulaIntensity: 0.3,
    starDensity: 0.0,           // hide stars entirely (e.g., during inflation/QGP)
    starColor: '#ffffff',
    distantElementColor: '#ff6b3d',
    // NEW: distant element types for variety
    distantElements: 'plasma_swirl',   // or 'galaxy_field' | 'nebula_shred' | 'void' | etc.
  },
}
```

Per stage:
| stage | distantElements |
|---|---|
| 1 Inflation | `expansion_burst` |
| 2 Baryogenesis | `pair_streaks` |
| 3 QGP | `plasma_swirl` |
| 4 Nucleosynthesis | `binding_orbits` |
| 5 Recombination | `clearing_fog` |
| 6 Dark Age | `void` |
| 7 First Stars | `bright_pinpoints` |
| 8 Reionization | `ionization_bubbles` |
| 9 Galaxy | `galaxy_field` |
| 10 Solar System | `nearby_stars` |
| 11 Life | `earth_orbit` |
| 12 Death of Star | `red_shroud` |
| 13 Stelliferous End | `fading_stars` |
| 14 Degenerate Era | `dim_specks` |
| 15 Black Hole Era | `lensed_field` |
| 16 The End | `redshifted_void` |

Each `distantElements` type maps to a draw routine. Examples:

```ts
function drawDistantPlasmaSwirl(ctx, w, h, t, accent, intensity): void {
  // Draw 6-8 large translucent swirls of orange/red
  for (let i = 0; i < 6; i++) {
    const x = (i / 6) * w + Math.sin(t / 2000 + i) * 50;
    const y = h * 0.3 + Math.cos(t / 1700 + i * 1.3) * 80;
    const radius = 80 + 40 * Math.sin(t / 1500 + i);
    ctx.fillStyle = `rgba(${accent.r}, ${accent.g}, ${accent.b}, ${0.05 * intensity})`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawDistantGalaxyField(ctx, w, h, t, accent, intensity): void {
  // Draw 5-7 small spiral hints across the background
  // Each is a small ellipse with a faint spiral arm
  // ...
}
```

### 12.8.4 Click-induced background shift

In ParticleField click handler:

```ts
function applyClickNudge(world: CanvasWorld, x: number, y: number, w: number, h: number): void {
  const cx = w / 2;
  const cy = h / 2;
  const dx = (x - cx) / w;
  const dy = (y - cy) / h;
  // Apply nudge to coreVX/coreVY which drives background shift
  world.coreVX += dx * TUNING.CLICK_NUDGE_STRENGTH;
  world.coreVY += dy * TUNING.CLICK_NUDGE_STRENGTH;
}
```

Existing `coreVX, coreVY` already exist. Make sure draw routines apply layer-specific offsets:

```ts
// drawStars
for (const star of stars) {
  const offsetX = world.coreVX * star.depth;
  const offsetY = world.coreVY * star.depth;
  drawStar(ctx, star.x + offsetX, star.y + offsetY, ...);
}
```

Apply same offset (with smaller depth) to `distantElements`.

### 12.8.5 Camera dampening

Existing `CAMERA_DAMPENING = 0.985` decays the velocity. Confirm this is still active so background settles after motion.

### 12.8.6 Acceptance

- Click in stage 3 (QGP) → background plasma swirls shift slightly toward the click.
- Stage transition from 3 → 4: background distant elements transition (plasma_swirl fades, binding_orbits emerges) over ~1 s.
- Stages 1, 6, 16 have visibly distinct distant backgrounds.

---

## 13. Implementation Order

| # | Module | Hours |
|---|---|---|
| 1 | V5-A (stages 1–2 halve) | 1 |
| 2 | V5-B (crit reduction) | 2 |
| 3 | V5-C (entropy from condense — verify removed) | 1 |
| 4 | V5-J (SP hidden from main) | 1 |
| 5 | V5-D (tree icons-only + ⊕ slots) | 6 |
| 6 | V5-E (track stage gating restored) | 3 |
| 7 | V5-F (skill tree tutorial) | 4 |
| 8 | V5-M (cumulative state + cosmic clock continuity) | 3 |
| 9 | V5-N (stage transition lag fix) | 6 |
| 10 | V5-G (cosmic time real-scale) | 6 |
| 11 | V5-H (BH shrink + Earth phases verify) | 4 |
| 12 | V5-I (click event reliability fix) | 4 |
| 13 | V5-K (Skill panel ❓ icon) | 1 |
| 14 | V5-O (real cosmic scale + almanac era info) | 8 |
| 15 | V5-P (distant background + parallax) | 6 |
| 16 | V5-L (migration v5→v6) | 1 |
| 17 | Balance sim + integration tests | 4 |
| **Total** | | **~61 hours = ~7.5 days** |

---

## 14. Definition of Done

After all modules:

1. `npm run build` passes; no TypeScript errors.
2. `npm test` passes; all integration tests included.
3. `npm run sim` reports total time in [80, 130] hours, per-stage ±30 %.
4. Manual playthrough on a fresh save:
   - Stage 1 clears in ~30 seconds.
   - Stage 2 clears in ~60 seconds.
   - Stage 2 cannot be filled by a single crit (max combo + max crit chance with Lv 1 crit produces ≤ 25 % of threshold).
   - SP not visible anywhere on main screen.
   - Skill tree shows icons + Lv numbers only (no inline names).
   - ⊕ markers visible at Lv 5/10/15/20/25/30 of every track.
   - Click ⊕ → detail card opens with cross-node info.
   - Stage 1: only Stellar Forge interactive; other 3 columns padlocked.
   - Stage 4: all 4 columns interactive.
   - First time opening Skills panel: 4-step tutorial walkthrough fires.
   - Cosmic clock display shows realistic units (`s`, `min`, `yr`, `Myr`, etc.).
   - Stage 5 with Aeon Lv 0: time gauge takes ~10 min to fill.
   - Stage 16 with Aeon Lv 0: time gauge requires Aeon investment to be playable.
   - Stage 15: click → photon emits radially from BH center; BH visibly shrinks as progress increases.
   - Stage 10: visual transitions clearly through 9 phases.
   - Rapid mobile tapping: every tap registers a click.
5. Migration: v5 save → v6 with reconstructed `unlockedTracks` based on stage progress.
6. Stage advance preserves: cosmic clock continues monotonically; quanta excess carries; gauge excess (capped at 25 %) carries.
7. Frame-rate stable across 5+ stage advances (no progressive lag).
8. Almanac entries 1–16 each include `cosmicEra` info with timeRange/temperature/keyParticles/keyEvents.
9. Each stage shows distinct distant background; clicking shifts it via parallax; stages transition smoothly.

---

## 15. Quality Bar (cumulative reminder)

- **No decimals** in displayed numbers (V3-A `formatWhole`).
- **No CSS blur effects** anywhere.
- **English code comments**.
- **Pure reducer** — no DOM/audio/network in reducer.
- **Mobile hit targets ≥ 44 px**.
- **Text-selection disabled** on canvas + UI containers (V4-K).
- **Click events log dropped reasons in dev mode** for debugging.

---

End of V5 specification.
