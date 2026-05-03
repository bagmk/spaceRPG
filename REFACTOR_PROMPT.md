# Cosmic Coalescence — Comprehensive Refactor Specification

> **Audience**: An autonomous coding agent (Codex / Claude / similar) with full repo access.
> **Mode**: Plan-then-execute. Read all referenced files before making changes. After each module, run `npm run build` and verify acceptance criteria before moving on.
> **Style**: TypeScript, React 18, Vite. Existing code is clean — match its patterns. English comments only. Keep `src/game/{constants, formulas, reducer, stages, types}.ts` as the single source of truth for game logic.

---

## 0. Repo Context

```
src/
  App.tsx
  main.tsx
  index.css
  game/
    audio.ts          # Web Audio procedural sound (good — extend, don't rewrite)
    constants.ts      # TUNING object — central numeric tuning
    formulas.ts       # All math (click power, costs, entropy, ...)
    reducer.ts        # Pure reducer, GameAction union
    stages.ts         # STAGES array (currently 12)
    storage.ts        # localStorage save/load (version 1)
    types.ts          # All shared types
  hooks/
    useGameLoop.ts    # rAF loop
    useGameState.ts   # useReducer + persistence
  canvas/             # drawX.ts files for layered rendering
  components/         # React UI surfaces
```

Current behavior summary (read these files first):
- 12 stages, each: click → accumulate quanta → reach threshold → condense → next stage (resets click/auto/crit levels and quanta).
- Run completes after stage 12 → prestige → universeBoost (capped at 50).
- Three linear upgrades per stage (click power, auto rate, crit multiplier).
- Encounter system: rogue tiers (minor/major/massive) drift across canvas, give bonus quanta + entropy on collision.
- Active mechanics: combo (700 ms window, ×2.0 cap at combo 40), crit (5%–25%, ×5+ multiplier).
- No idle/offline progress. No stage-differentiated mechanics. Numbers cap at 7.5M.

Known design problems being fixed (high-level):
1. Every stage is structurally identical — needs per-stage differentiated mechanics.
2. Threshold growth is too flat (40 → 7.5M across 12 stages) — needs ~1e30+ scale.
3. Prestige is capped at 50 boost via `applyAntiRunaway` — must become unbounded.
4. Stage transitions hard-reset all upgrade levels — needs partial inheritance.
5. No offline/idle reward.
6. Cosmic time compression (the `Timelapse of the Entire Universe` aesthetic) is not represented in gameplay — every stage feels the same length.
7. Missing cosmological events: Inflation, Baryogenesis, Cosmic Dark Age, Reionization.
8. Stage 1 timing label is wrong (10⁻¹² s ≠ Quark-Gluon Plasma).
9. Stage 7 (Life & Civilization) collapses 4 Gyr of biological evolution into a single grind.
10. Heat Death is the only ending — multi-ending branches are missing.
11. Timeline bar is linear in cosmic time — should be logarithmic with accelerating counter.

---

## 1. Top-level Requirements

The agent must implement **all** of the following. Each section is independently testable. Implement in order; later sections depend on earlier ones.

| # | Module | Lines of effort | Blocks |
|---|---|---|---|
| 1 | Number formatting + big-number type | small | all later |
| 2 | Stage list rewrite (16 stages, log-time, sub-arc 7) | small | mechanics, UI |
| 3 | Threshold/cost/click/auto formula rewrite (1e60 scale) | medium | balance |
| 4 | Prestige rework (uncapped, exponential, layered currency) | medium | retention |
| 5 | Stage-progression inheritance (no full reset) | small | feel |
| 6 | Idle/offline progress | medium | retention |
| 7 | Time compression system (cosmic-time-per-second varies per stage) | medium | aesthetic |
| 8 | Per-stage differentiated mechanics (16 mini-mechanics) | **large** | feel |
| 9 | Logarithmic timeline + accelerating cosmic-clock counter | small | UI |
| 10 | Multi-ending branch (Heat Death / Big Rip / Big Crunch / Vacuum Decay) | medium | replay |
| 11 | Audio: silence beats, time-acceleration whoosh, ending-specific stings | small | aesthetic |
| 12 | Save migration (v1 → v2), backward-compatible load | small | shipping |
| 13 | Tests (unit on formulas, deterministic reducer tests) | medium | safety |

After every module, run:
```
npm run build
```
and fix any TypeScript errors before continuing.

---

## 2. Module 1 — Big Numbers and Formatting

### 2.1 Type

Numbers in this game must scale to ~1e120. JavaScript `number` handles up to ~1.8e308 (Float64), so a plain `number` is enough — **do not introduce `decimal.js` or `break_eternity`** unless the agent is sure it's needed (it's not, given that all multiplication chains stay within Float64).

However, to avoid precision loss when summing tiny `tickGain` into a large `quanta`, gate accumulation:

```ts
// formulas.ts — new
export function safeAdd(a: number, b: number): number {
  // Below 1e15, plain add is exact for integer-ish flows.
  if (a < 1e15 && b < 1e15) return a + b;
  // Above that, convert to log space when needed; otherwise let Float64 roundoff happen.
  return a + b;
}
```

This is mostly a placeholder hook — keep `+` everywhere unless a bug surfaces.

### 2.2 `formatWhole` extension

Replace the existing `formatWhole` in `formulas.ts` so it handles the full target scale. Use a hybrid:

- `< 1e3`: integer string.
- `1e3 .. 1e33`: SI suffixes `K, M, B, T, Qa, Qi, Sx, Sp, Oc, No, Dc, UDc, DDc, TDc, QaDc, QiDc, SxDc, SpDc, ODc, NDc, V, UV` (extend list to cover up to 1e66 just in case).
- `>= 1e33`: switch to scientific notation `1.23e45`.
- `>= 1e100`: also annotate with named scale (`googol`) if the user toggles "named scale" later — for now just scientific.

Add a parallel `formatCosmicTime(seconds: number): string` that takes seconds and returns:
- `< 1`: `1.2e-9 s` style for very early universe
- `< 60`: `s`
- `< 3600`: `min`
- `< 86400`: `hr`
- `< 31_557_600`: `days`
- `< 1e9 yr`: `yr / Myr / Gyr` with auto unit
- `>= 1e9 yr`: scientific `1.0e14 yr`

Used by the new logarithmic timeline (Module 9).

### 2.3 Acceptance

- Add tests in `src/game/__tests__/formulas.test.ts` (set up Vitest if not present — see Module 13). Cases:
  - `formatWhole(0) === "0"`
  - `formatWhole(999) === "999"`
  - `formatWhole(1000) === "1.00K"`
  - `formatWhole(1.5e36)` returns scientific, not `1500.00DDc`
  - `formatCosmicTime(380000 * 31557600)` returns `"380.00 Kyr"` or similar
  - `formatCosmicTime(1e100 * 31557600)` returns scientific

---

## 3. Module 2 — Stage List Rewrite

### 3.1 New canonical 16 stages

Replace `STAGES` in `src/game/stages.ts`. Add new fields to the `Stage` interface in `types.ts`:

```ts
export interface Stage {
  id: number;
  name: string;
  resource: string;                 // existing
  time: string;                     // human label, kept for back-compat
  cosmicTimeSec: number;            // NEW: time-since-Big-Bang in seconds (for log clock)
  cosmicTimeSpanSec: number;        // NEW: this stage covers from prevCosmicTime to cosmicTimeSec
  realPlayTargetSec: number;        // NEW: target real-time grind length, used by autoRate calibration
  timelinePos: number;              // existing — recompute as log fraction (see Module 9)
  threshold: number;                // existing
  clusterMode: ClusterMode;         // existing
  mechanic: StageMechanicId;        // NEW: which mini-mechanic this stage uses
  accent: string;                   // existing
  coreColor: string;                // existing
  particleColors: string[];         // existing
  clickUpgradeName: string;         // existing
  autoUpgradeName: string;          // existing
  quote: string;                    // existing
  quoteAttr: string;                // existing
  silenceBeforeMs?: number;         // NEW: forced silence in audio at stage start (Dark Age, Heat Death)
  endingId?: EndingId;              // NEW: only set on terminal stages
}

export type StageMechanicId =
  | 'click_basic'        // stage 0 (Inflation) — passive cinematic, click only accelerates
  | 'matter_asymmetry'   // stage 2 — match-pair mini-puzzle (quark/antiquark)
  | 'fusion_window'      // stage 4 (Nucleosynthesis) — timing window
  | 'recombination'      // stage 5 — release captured electrons
  | 'dark_age'           // stage 6 — long silence, idle-only stage
  | 'first_stars'        // stage 7 — manage star lifetimes
  | 'reionization'       // stage 8 — sweep across the field
  | 'galaxy_weaving'     // stage 9 — orbit stabilization
  | 'planet_formation'   // stage 10 — drag planetesimals into the disk
  | 'life_evolution'     // stage 11 — sub-arc with 5 inner steps
  | 'civilization'       // stage 11.5 — builds on life
  | 'red_giant'          // stage 12
  | 'remnant_cooling'    // stage 13 (Stelliferous End)
  | 'proton_decay'       // stage 14 (Degenerate Era)
  | 'hawking_radiation'  // stage 15 (Black Hole Era)
  | 'ending_choice'      // stage 16 — multi-ending branch
  ;

export type EndingId = 'heat_death' | 'big_rip' | 'big_crunch' | 'vacuum_decay';
```

### 3.2 Stage definitions (canonical values)

Use these. `cosmicTimeSec` is in seconds since Big Bang. `realPlayTargetSec` is the target real-world grind length for that stage on a fresh save (see Module 7 — auto rate calibration must hit this).

| id | name | cosmicTimeSec | realPlayTarget | threshold | mechanic |
|---|---|---|---|---|---|
| 1 | Inflation | 1e-32 | 30 s | 50 | click_basic |
| 2 | Baryogenesis | 1e-12 | 90 s | 800 | matter_asymmetry |
| 3 | Quark-Gluon Plasma | 1e-6 | 90 s | 1.5e4 | click_basic |
| 4 | Nucleosynthesis | 180 | 120 s | 4e5 | fusion_window |
| 5 | Recombination | 1.2e13 (380 kyr) | 120 s | 1e7 | recombination |
| 6 | Cosmic Dark Age | 3.15e15 (100 Myr) | 240 s, mostly idle | 4e9 | dark_age |
| 7 | First Stars | 6.3e15 (200 Myr) | 240 s | 2e11 | first_stars |
| 8 | Reionization | 1.6e16 (500 Myr) | 240 s | 1e13 | reionization |
| 9 | Galaxy Formation | 3.15e16 (1 Gyr) | 300 s | 5e15 | galaxy_weaving |
| 10 | Solar System Forms | 2.9e17 (9.2 Gyr) | 300 s | 5e18 | planet_formation |
| 11 | Life on Earth | 4.35e17 (13.8 Gyr) | 600 s, sub-arc of 5 | 1e23 | life_evolution |
| 12 | Death of Earth | 5.83e17 (~+5 Gyr from now) | 240 s | 1e28 | red_giant |
| 13 | Stelliferous End | 3.15e21 (1e14 yr) | 240 s | 1e35 | remnant_cooling |
| 14 | Degenerate Era | 3.15e47 (1e40 yr) | 300 s | 1e50 | proton_decay |
| 15 | Black Hole Era | 3.15e107 (1e100 yr) | 300 s | 1e80 | hawking_radiation |
| 16 | The End | 3.15e110 (1e103 yr) | branching | 1e110 | ending_choice |

Note: stage 11 (`life_evolution`) is internally a 5-step sub-arc. The reducer treats it as one stage but the mechanic exposes inner steps `abiogenesis → multicellular → cambrian → land → mind`. Each inner step has its own threshold equal to `1/5, 1/4, 1/3, 1/2, 1` of the stage threshold cumulatively. Civilization is the last 1% of step 5 — must be visually emphasized as a single flicker.

### 3.3 Quotes

Replace placeholder quotes with original text in the spirit of Melodysheep's narration. Important: do NOT copy any text from the actual *Timelapse of the Entire Universe* video. Write fresh prose, ~1–3 sentences, no proper nouns from the documentary. Each quote should land on a single emotional beat:

- **Inflation**: scale (the universe expands faster than light for an instant)
- **Baryogenesis**: asymmetry (one in a billion of matter survives — that's why anything exists)
- **Recombination**: light (the fog clears)
- **Dark Age**: silence (no stars, no light, just neutral hydrogen drifting)
- **First Stars**: brilliance and brevity (Pop III stars live and die in millions of years)
- **Galaxy Formation**: structure (the cosmic web reveals itself)
- **Life on Earth**: improbability (one rock learns to remember itself)
- **Civilization sub-beat**: span (everything you've ever known fits inside this flicker)
- **Death of Earth**: indifference (the sun does not notice what it consumed)
- **Stelliferous End**: ending of light
- **Black Hole Era**: patience (the kings of an empty kingdom)
- **Heat Death**: equilibrium (or — perhaps — a flicker)

Keep the text under 240 chars per quote.

### 3.4 Acceptance

- 16 stages compile.
- `Stage` interface adds the new fields without breaking existing UI (other modules will use the new fields).
- Save migration handles the new stage count (Module 12).

---

## 4. Module 3 — Threshold and Cost Rewrite

### 4.1 Goals

- A first-time player reaches *each* stage in roughly its `realPlayTargetSec` value, regardless of stage index, **assuming they buy the optimal upgrade**.
- Late-game thresholds reach 1e110 to make the cosmic scale legible.
- Click and auto upgrade levels matter even after a stage transition (see Module 5 — partial inheritance).

### 4.2 New formulas

In `formulas.ts`, replace the existing functions:

```ts
// Click power — log-base scaling so thresholds at 1e80 don't make click power explode in raw int land.
export function getClickPower(stage: Stage, clickLevel: number, prestigeBoost: number): number {
  // Base scales with sqrt of threshold so click is meaningful but not the only path.
  const base = Math.max(1, Math.sqrt(stage.threshold) * 0.05);
  const levelMult = Math.pow(1.18, clickLevel);  // exponential per upgrade
  const prestigeMult = 1 + prestigeBoost * 0.5;  // each boost point = +50% click
  return base * levelMult * prestigeMult;
}

export function getAutoRate(stage: Stage, autoLevel: number, prestigeBoost: number): number {
  if (autoLevel === 0) return 0;
  // Calibrate so that a player buying auto upgrades reaches threshold in ~realPlayTargetSec.
  // basePerLevel * autoLevel ~= threshold / realPlayTarget when autoLevel is "reasonable".
  const basePerLevel = stage.threshold / (stage.realPlayTargetSec * 30);
  const levelMult = autoLevel * Math.pow(1.06, autoLevel);  // mild compounding
  return basePerLevel * levelMult * (1 + prestigeBoost * 0.3);
}

export function getCritMultiplier(critLevel: number): number {
  return 5 + critLevel * 2 + Math.floor(critLevel / 10) * 5;  // soft milestones
}

const COST_GROWTH = 1.15;

export function getClickCost(stage: Stage, level: number): number {
  return Math.ceil(stage.threshold * 0.005 * Math.pow(COST_GROWTH, level));
}

export function getAutoCost(stage: Stage, level: number): number {
  return Math.ceil(stage.threshold * 0.012 * Math.pow(COST_GROWTH, level));
}

export function getCritCost(stage: Stage, level: number): number {
  return Math.ceil(stage.threshold * 0.025 * Math.pow(COST_GROWTH, level));
}
```

### 4.3 Combo curve

Increase ceiling. In `constants.ts`:

```ts
COMBO_TIMEOUT_MS: 700,
COMBO_CLEAR_MS: 1200,
COMBO_MULT_PER_10: 0.4,        // was 0.25
COMBO_MULT_MAX: 8.0,           // was 2.0
CRIT_BASE_CHANCE: 0.05,
CRIT_PER_COMBO: 0.01,          // was 0.005
CRIT_MAX: 0.5,                 // was 0.25
```

### 4.4 Acceptance

- Optimal-buy simulation: write `npm run sim` (a node script under `scripts/balance-sim.ts`) that plays each stage with greedy "buy whatever I can afford in this order: auto, click, crit" and reports time-to-threshold per stage.
- Output should be within ±30% of `realPlayTargetSec` for stages 1–10. Late stages (11–16) are tuned by hand because of mechanics layering.
- Add unit tests verifying monotonicity: `getAutoRate(stage, n+1, b) > getAutoRate(stage, n, b)` for all stages and levels 0–200.

---

## 5. Module 4 — Prestige Rework

### 5.1 Goals

- Remove the `applyAntiRunaway` cap. Prestige reward must scale with run quality without an artificial ceiling.
- Introduce a layered currency to enable long-term metaprogression.

### 5.2 Currencies

Add to `PersistentGameState` and `GameState`:

```ts
entropy: number;            // existing — earned during a run
condensedMass: number;      // NEW — second-tier currency, awarded only on full completion
echoes: number;             // NEW — meta-meta currency, awarded only when player chooses a different ending than last time
```

### 5.3 Reward formulas

```ts
// formulas.ts
export function getUniverseBoost(runEntropy: number): number {
  // Smoothly increasing, no cap.
  return Math.log10(1 + runEntropy) * 2;  // ~80 at entropy=1e40
}

export function getCondensedMassReward(runEntropy: number, endingId: EndingId, universeCount: number): number {
  const base = Math.pow(runEntropy, 0.4);
  const endingMult: Record<EndingId, number> = {
    heat_death: 1.0,
    big_rip: 1.5,        // riskier ending
    big_crunch: 1.2,
    vacuum_decay: 2.0,   // hardest to trigger
  };
  // First-time-completion bonus.
  const firstTimeBonus = universeCount === 1 ? 3 : 1;
  return base * endingMult[endingId] * firstTimeBonus;
}

export function getEchoReward(uniqueEndingsCompleted: number): number {
  // Earned when finishing a never-before-seen ending.
  return Math.pow(2, uniqueEndingsCompleted);
}
```

### 5.4 Boost effects

- `universeBoost` (cumulative across runs): +50% click power, +30% auto rate (per point).
- `condensedMass`: spent (not consumed totally — log-cost) on permanent unlocks listed below. Add a *Singularity Tree* in a new component `SingularityTree.tsx` reachable from the FinalScreen.
- `echoes`: gates higher-difficulty seeds (Module 10).

### 5.5 Singularity Tree (permanent unlocks)

Implement as a flat list initially (a real tree in v2). Each row is `{id, label, cost, effect, description}`. Suggested initial set:

```
1. "Quark Foam"       cost 10        +1 click power per level forever
2. "Free Combo"       cost 25        Combo cap +2.0
3. "Stellar Memory"   cost 50        Retain 25% of click/auto/crit levels across stage transitions
4. "Hawking Echo"     cost 100       Idle/offline progress at 50% rate (Module 6)
5. "Inflaton Spark"   cost 200       Skip Inflation stage; start from Baryogenesis with bonus
6. "Cosmic Web"       cost 400       Encounter rate +50%, encounter rewards +100%
7. "Red Shift"        cost 800       Time-compression speedup for stages 11–15
8. "Multiverse Lens"  cost 2000      Unlock seed customization (different physics per run)
9. "Vacuum Stability" cost 8000      Unlock vacuum_decay ending
10. "Boltzmann Brain" cost 30000     Run continues past Heat Death indefinitely (NG+)
```

`condensedMass` is **spent** (not just gated), and shows current balance + tooltips of effect.

### 5.6 PRESTIGE action rewrite

In `reducer.ts`, replace the `PRESTIGE` case so that:
1. It computes `universeBoost` from run entropy and *adds* (not replaces) to `cumulativeBoost` (no cap).
2. If `state.completedRun` and an ending was selected, also award `condensedMass` and (if first-time) `echoes`.
3. Resets stage to 1 (or to "Inflaton Spark"-skipped stage 2 if unlocked).
4. Preserves `cumulativeBoost`, `condensedMass`, `echoes`, `singularityUnlocks`, `endingsCompleted`.

### 5.7 Acceptance

- Save round-trip preserves all new fields.
- Test: complete a 1-run scenario in the reducer (use `scripts/balance-sim.ts`), verify currency math, verify levels reset but boost persists.

---

## 6. Module 5 — Stage Progression Inheritance

### 6.1 Problem

Currently `ADVANCE_STAGE` zeros `clickLevel`, `autoLevel`, `critLevel`, `quanta`. Players feel like they start over.

### 6.2 Fix

In `reducer.ts`, replace `ADVANCE_STAGE`:

```ts
case 'ADVANCE_STAGE': {
  if (state.pendingCondenseStageIdx === null) return state;
  if (state.stageIdx >= STAGES.length - 1) {
    return { ...state, pendingCondenseStageIdx: null, pendingCondenseEntropy: 0,
             imploding: false, condenseStartedAt: null, completedRun: true };
  }
  const inheritFrac = state.singularityUnlocks.includes('stellar_memory') ? 0.25 : 0.10;
  return {
    ...state,
    stageIdx: state.stageIdx + 1,
    quanta: 0,
    clickLevel: Math.floor(state.clickLevel * inheritFrac),
    autoLevel: Math.floor(state.autoLevel * inheritFrac),
    critLevel: Math.floor(state.critLevel * inheritFrac),
    combo: 0,
    lastClick: 0,
    pendingCondenseStageIdx: null,
    pendingCondenseEntropy: 0,
    imploding: false,
    condenseStartedAt: null,
  };
}
```

### 6.3 Acceptance

- Existing test: state.clickLevel was 12 → after stage advance → 1 (10% default) or 3 (25% if stellar_memory unlocked).

---

## 7. Module 6 — Idle / Offline Progress

### 7.1 Goal

When the player closes the tab and returns N seconds later, award them `min(autoRate * N, autoRate * MAX_OFFLINE_SEC)` quanta (capped). Show a modal on resume: "You were away for X. The universe gained Y."

### 7.2 Implementation

1. On every save (in `useGameState.ts`), record `lastSaveAt: number` (epoch ms).
2. On hydrate (load), compute `awaySec = (Date.now() - savedLastSaveAt) / 1000`. Cap at `TUNING.MAX_OFFLINE_SEC` (default 8 hours = 28800 s).
3. Multiply by `0.5` if `singularityUnlocks` doesn't include `hawking_echo`. With `hawking_echo`, multiply by `1.0`.
4. Award `awaySec * autoRate(currentStage, autoLevel, boost)` to quanta.
5. Show `<OfflineProgressModal awayMs={...} gained={...} />` until dismissed.

### 7.3 Constants

```ts
// constants.ts
MAX_OFFLINE_SEC: 28_800,      // 8 hours
OFFLINE_BASE_RATE: 0.5,
```

### 7.4 Acceptance

- Save with `lastSaveAt = now - 3600_000`, load → modal appears with "1 hour" label and gained quanta = `autoRate * 3600 * 0.5` (rounded).

---

## 8. Module 7 — Time Compression System

### 8.1 The vision

The single most differentiating feature. *Real play time and cosmic time are decoupled and visualized in tandem.* When the player is in stage 1 (Inflation), 1 real second covers 1e-33 cosmic seconds. When the player is in stage 15 (Black Hole Era), 1 real second covers 1e95 cosmic years.

### 8.2 Implementation

Add to game state (transient, computed in render layer; not persisted):

```ts
interface TimeFlow {
  cosmicTimePerRealSec: number;   // current rate
  cosmicClockSec: number;         // current displayed cosmic time
}
```

Compute in a new file `src/game/timeFlow.ts`:

```ts
export function getCosmicTimePerRealSec(stage: Stage, prevStage: Stage | null, progress01: number): number {
  // The stage spans from prevStage.cosmicTimeSec to stage.cosmicTimeSec, in cosmic seconds.
  // The player should traverse this in stage.realPlayTargetSec real seconds.
  const span = stage.cosmicTimeSec - (prevStage?.cosmicTimeSec ?? 0);
  return span / Math.max(1, stage.realPlayTargetSec);
}
```

The rate jumps between stages — that's intentional (it's the "telescoping" effect). To smooth: in the timeline UI, animate the cosmic clock with `easeOutCubic` over 800 ms when the rate changes.

The cosmic clock is *displayed* in `Timeline.tsx`. It updates every real-time tick:

```ts
// in useGameLoop callback
cosmicClockSec += dt * cosmicTimePerRealSec;
```

### 8.3 Audio coupling

When `cosmicTimePerRealSec` is high (stages 13–15), play an "acceleration whoosh" once per second (low-passed wind noise, see `audio.ts` extension below).

### 8.4 Stage 11 (Life) sub-arc time compression

Inside stage 11, the *visible cosmic clock* must spend ~80% of the stage on abiogenesis→cambrian (3 Gyr biological evolution, 4 of the 5 inner steps) and ~20% on the last step (which itself contains civilization as a final 1% flicker). When the clock crosses into "civilization", flash a bright frame, play a high chime, and run a 1-second cinematic that shows cities lighting up and going dark.

### 8.5 Acceptance

- Stage 1 plays for ~30 s real, advances cosmic clock from `0` to `1e-32 s`. Stage 15 plays for ~300 s real, advances cosmic clock from `~1e60 s` to `~1e107 s`.
- Logarithmic timeline marker (Module 9) moves smoothly across the bar at a *visually constant* speed even though linear cosmic time is wildly different.

---

## 9. Module 8 — Per-Stage Differentiated Mechanics

This is the largest module. Each `StageMechanicId` corresponds to an active mini-mechanic that overlays on top of the base click+auto loop. The base loop still works — these add *flavor and active engagement*.

Define mechanics in new files under `src/game/mechanics/`:

```
mechanics/
  index.ts            // registry: { [id: StageMechanicId]: MechanicSpec }
  click_basic.ts
  matter_asymmetry.ts
  fusion_window.ts
  ...
  ending_choice.ts
```

Each `MechanicSpec` has the shape:

```ts
export interface MechanicSpec {
  id: StageMechanicId;
  // Called every game tick. Returns optional events to dispatch.
  onTick?(state: GameState, world: CanvasWorld, dt: number): MechanicEvent[];
  // Called on click; return `true` if the mechanic consumed the click (so base CLICK action is skipped).
  onClick?(state: GameState, world: CanvasWorld, x: number, y: number): MechanicClickResult;
  // Called by ParticleField — draws on top of base canvas.
  draw?(ctx: CanvasRenderingContext2D, state: GameState, world: CanvasWorld, w: number, h: number): void;
  // Called on stage entry — initialize any local state.
  init?(state: GameState, world: CanvasWorld): void;
}
```

Local mechanic state lives on `world.mechanicState: Record<StageMechanicId, unknown>` keyed by id, populated in `init`.

### 9.1 Mechanic specs

Implement each as below. Keep them small (50–150 lines each).

**`click_basic`** (Inflation, Quark-Gluon Plasma)
- No special behavior; standard click.
- Visual: in Inflation, every click creates a radial expansion ring whose radius grows visibly *faster than before* (echoing inflation). Add ring entries to `world.shockwaves`.

**`matter_asymmetry`** (Baryogenesis)
- Two kinds of particles spawn: matter (blue) and antimatter (red), in pairs.
- They drift toward each other and annihilate on contact, releasing 0 quanta normally.
- The player's job: click on matter particles to nudge them away from antimatter; pairs that survive 3 seconds award quanta.
- 1 in 1e9 ratio is *visually represented* as a stochastic bias: every 100 frames, exactly one extra matter particle spawns with no antimatter counterpart. Highlight it with a faint glow. If the player clicks that one, award a 100× crit-equivalent.
- Tutorial line: "One in a billion survives — that's why anything exists."

**`fusion_window`** (Nucleosynthesis)
- A "fusion meter" oscillates between 0 and 1 over 3 seconds.
- Clicking when the meter is in the green band (0.7–0.9) gives 5× click reward. Outside the band: 0.5×.
- After the meter oscillation ends (~3 min cosmic time / 120 s real), the window closes — clicks revert to base. This *is the fusion window of BBN*.

**`recombination`** (Recombination)
- Field is full of free electrons orbiting nuclei.
- Click on an electron → it captures into a nucleus, releasing a photon (visible streak from electron to edge of screen).
- Once 70% of electrons are captured, the screen suddenly becomes transparent (tween from foggy overlay to clear) and a shockwave releases. Award 3× the stage threshold's worth of quanta in a single payout.
- Quote line is delayed until this transparency event.

**`dark_age`** (Cosmic Dark Age)
- Stage forces the player to be *idle*. Click power is reduced to 1% of normal.
- Auto rate is normal but slow.
- A countdown timer ("Dark Age remaining: XX seconds in cosmic-compressed time") is displayed.
- Audio: drone fades to near-silence. Only an extremely low rumble.
- The player can *speed up* the dark age by spending entropy (cost: 100 entropy per 10% skip). This is the only place in the game where entropy is spent during a run.
- This is intentionally a lull — the next stage (First Stars) will feel like an explosion of color by contrast.

**`first_stars`** (First Stars)
- Click spawns a Population III star at the click location.
- Each star has a mass slider (use mouse-down duration: short hold = small star, long hold = giant). Bigger star = more quanta per second but shorter lifetime.
- Stars die in supernovae after their lifetime, releasing a burst of quanta + scattering metals.
- Active management: keep 4–8 stars alive at once for max throughput.

**`reionization`** (Reionization)
- The field is filled with neutral hydrogen (gray haze).
- Click sweeps a "UV beam" from click point outward, ionizing hydrogen in its cone.
- Goal: clear 90% of the field. As more is cleared, the next stage's auto rate gets a bonus.
- Once cleared, the universe becomes visually transparent again — and the second light-emergence quote drops.

**`galaxy_weaving`** (Galaxy Formation)
- The motes/clusters are now tied to the cosmic web.
- Click drags a "filament" between two distant motes. Connecting motes that share a particle color → they spiral together into a galaxy. Wrong-color connections fizzle.
- Existing `clusterMode === 'galaxy'` rendering already supports the visual; extend with line-drawing.

**`planet_formation`** (Solar System Forms)
- A central yellow sun.
- Click on free planetesimals to drag them into stable orbits. Stable orbits = sustained quanta income. Unstable = collision and destruction.
- Optionally: 1 planet must be in the habitable zone (visualized as a green band) for stage advance bonus.

**`life_evolution`** (Life on Earth — sub-arc, 5 inner steps)
- This is *the centerpiece*. Internally subdivides:
  1. **Abiogenesis** (RNA-world): click to fold ribozymes
  2. **Multicellular**: click to merge single cells into colonies
  3. **Cambrian Explosion**: click to introduce mutations (rapid spawning of varied life forms)
  4. **Land/Mammalian**: click to evolve traits (hair, warm-blood, intelligence)
  5. **Mind**: click on the planet to spark consciousness — the moment cities light up
- Each inner step has its own threshold (cumulative percent of stage threshold). The cosmic clock runs *very slowly* through steps 1–4, and *very fast* through step 5. Civilization itself is rendered as a final 1-second flicker where every city light blooms then dims to red. **This single second is the emotional core of the entire game.**

**`civilization`** (if separated)
- Optional separate mechanic. If implemented, it's the 1-second flicker described above.

**`red_giant`** (Death of Earth)
- A red giant sun expands across the screen.
- Earth (a small blue dot) gets engulfed at a fixed cosmic-time point.
- Click the dot rapidly to "evacuate" — successful evacuation gives a one-time entropy bonus called "Diaspora".
- Failed evacuation → the dot is consumed silently. (No mechanical penalty, but visually the most somber moment.)

**`remnant_cooling`** (Stelliferous End)
- Field of dim white dwarfs.
- Click on a white dwarf to "harvest" residual heat (each click cools it slightly until it becomes a black dwarf and stops giving quanta).
- Replenishment is extremely slow — most progress comes from auto.

**`proton_decay`** (Degenerate Era)
- Each click triggers a probability roll on a particle to decay.
- Visual: particles twitch and occasionally annihilate.
- The *expected* time between decays at this stage is enormous — clicking just lets the player force the next decay.

**`hawking_radiation`** (Black Hole Era)
- Central black hole.
- Click anywhere → emit a Hawking quantum (random walk from event horizon outward).
- Hawking rate ∝ 1/M² where M is the BH mass — as the BH evaporates, the rate increases. This is *visualized*: the black hole gets smaller and clicks pay out more.

**`ending_choice`** (The End)
- Player is presented with up to 4 ending paths, depending on unlocks:
  1. Heat Death (always available)
  2. Big Crunch (if `condensedMass` ≥ 1000)
  3. Big Rip (if `cumulativeBoost` ≥ 100)
  4. Vacuum Decay (if `vacuum_stability` Singularity unlock owned)
- Each ending plays a unique cinematic (5–10 s):
  - Heat Death: fade to black, clock keeps ticking past 1e150 yr
  - Big Crunch: everything spirals inward, ending in a flash
  - Big Rip: everything tears apart, even subatomic particles
  - Vacuum Decay: bubble of true vacuum expands at light speed
- After cinematic → FinalScreen → prestige.

### 9.2 Wiring

In `GameScreen.tsx` and `ParticleField.tsx`, look up the current stage's mechanic via `MECHANICS[stage.mechanic]` and call its `onTick`/`onClick`/`draw`/`init` hooks.

Order of click resolution:
1. Mechanic `onClick` runs first. If it returns `{ consumed: true, gain?: number }`, dispatch `CLICK` with the mechanic's gain instead of base click power.
2. If `consumed: false`, fall through to base CLICK action.

### 9.3 Acceptance

- Each mechanic compiles and is registered in `mechanics/index.ts`.
- Smoke test: write a simple fixture that simulates 10 clicks per mechanic, verifies the mechanic's `onClick` is called and that gain matches the spec.
- Visual QA in browser: cycle through stages via `?stage=N` URL parameter (add a debug hook in `App.tsx` that allows jumping to a stage in dev mode).

---

## 10. Module 9 — Logarithmic Timeline + Accelerating Clock

### 10.1 Replace linear timeline

In `Timeline.tsx`, replace the linear bar with a logarithmic one. The bar represents cosmic time from `1e-32 s` (left edge) to `1e110 s` (right edge), spanning 142 orders of magnitude.

Marker position:
```ts
const log10Min = -32;
const log10Max = 110;
const cosmicTimeLog10 = Math.log10(Math.max(1e-32, cosmicClockSec));
const fraction = (cosmicTimeLog10 - log10Min) / (log10Max - log10Min);
const markerLeftPercent = fraction * 100;
```

Tick marks at every order of magnitude, with labels at major beats (`1e-30s`, `1s`, `1yr`, `1Myr`, `1Gyr`, `13.8Gyr`, `1Tyr`, `1e100yr`).

### 10.2 Accelerating clock display

Below the bar, render `cosmicClockSec` formatted via `formatCosmicTime`. Animate transitions with monospace digits and a "rolling odometer" effect when the rate is high.

### 10.3 Stage chevrons on the bar

Each of the 16 stages has a chevron at its `cosmicTimeSec` position. Current stage is highlighted. Past stages are dim. Future stages are barely visible.

### 10.4 Acceptance

- Clock crosses `13.8Gyr` exactly when the player enters Life on Earth.
- Marker visually moves at roughly constant speed regardless of stage (because the bar is log-scaled and `cosmicTimePerRealSec` is calibrated per stage).

---

## 11. Module 10 — Multi-ending Branch

Already partially specced in Module 9 (mechanic `ending_choice`). Implementation details:

### 11.1 Cinematics

Build each ending cinematic as a self-contained component under `src/components/endings/`:

```
endings/
  HeatDeathEnding.tsx
  BigCrunchEnding.tsx
  BigRipEnding.tsx
  VacuumDecayEnding.tsx
```

Each component:
- Mounts when the player picks that ending.
- Plays a 5–10 s cinematic with full-screen canvas effects.
- Calls `onComplete()` callback that triggers FinalScreen.

### 11.2 State

Add to persistent state:
```ts
endingsCompleted: EndingId[];   // unique list of endings achieved
lastEndingId: EndingId | null;
```

### 11.3 First-time bonus

If the player picks an ending in `endingsCompleted` already, normal rewards. If new, +echoes (Module 4).

### 11.4 Acceptance

- Beat the game with each ending → unique cinematic plays, ending is added to `endingsCompleted`, echoes increment.

---

## 12. Module 11 — Audio Extensions

### 12.1 Silence beats

In `SoundManager.setStage`, if `stage.silenceBeforeMs > 0`, fade ambient drone to 0 over that duration before fading the new drone in. Used for Dark Age and Heat Death.

### 12.2 Time-acceleration whoosh

Add `playTimeAccelerationWhoosh(intensity: number)` — a noise burst with rising filter sweep. Trigger every 1 s of real time when `cosmicTimePerRealSec > 1e10`.

### 12.3 Ending stings

Each ending has a unique audio signature:
- **Heat Death**: long sub-bass pad fading to silence over 8 s.
- **Big Crunch**: rising minor chord, abrupt silence at peak.
- **Big Rip**: shrieking high-frequency tear, increasing in pitch until cutoff.
- **Vacuum Decay**: a single, perfectly clean sine wave that ends abruptly.

Implement each as a method on `SoundManager`.

### 12.4 Civilization flicker

In `playCivilizationFlicker()`: a fast "city-lights" sound (multiple high chimes in random phase, ducked over 800 ms).

---

## 13. Module 12 — Save Migration

Bump `SaveState.version` from `1` to `2`. The new schema adds:

```ts
export interface SaveStateV2 {
  version: 2;
  // ...all v1 fields...
  condensedMass: number;
  echoes: number;
  singularityUnlocks: string[];   // ids
  endingsCompleted: EndingId[];
  lastEndingId: EndingId | null;
  lastSaveAt: number;             // for offline progress (Module 6)
}
```

In `storage.ts`:

```ts
export function loadGame(): PersistentGameState | null {
  const raw = localStorage.getItem(STORAGE_KEYS.save);
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  if (parsed.version === 1) return migrateV1ToV2(parsed);
  if (parsed.version === 2) return validateV2(parsed);
  return null;  // unknown version
}

function migrateV1ToV2(v1: SaveStateV1): PersistentGameState {
  return {
    ...v1,
    version: 2,
    condensedMass: 0,
    echoes: 0,
    singularityUnlocks: [],
    endingsCompleted: [],
    lastEndingId: null,
    lastSaveAt: Date.now(),
  };
}
```

### 13.1 Acceptance

- A v1 save loads cleanly into v2 with default values for new fields.
- A v2 save round-trips identically.

---

## 14. Module 13 — Tests

### 14.1 Setup

Add Vitest:
```bash
npm install --save-dev vitest @vitest/ui jsdom
```

Add `vitest.config.ts` extending `vite.config.ts`.

Update `package.json`:
```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest",
  "sim": "tsx scripts/balance-sim.ts"
}
```

Add `tsx` as a dev dependency for running the balance sim.

### 14.2 Test coverage targets

Mandatory:
- `formulas.test.ts`: every formula function, edge cases (0, very large, negative input).
- `reducer.test.ts`: every action type, idempotency where applicable, state invariants.
- `migration.test.ts`: v1 save → v2 load.
- `mechanics/*.test.ts`: at least one test per mechanic (smoke).

Nice-to-have:
- Snapshot tests for stages.ts content (so accidental edits to stage data are caught).

### 14.3 Balance simulation

`scripts/balance-sim.ts`:
- Imports `STAGES`, formulas, runs a deterministic simulation per stage.
- Greedy buyer: at each tick, buy the cheapest affordable upgrade in priority order (auto > click > crit).
- Reports for each stage: `realTimeSec`, `clicksUsed`, `finalAutoLevel`, `finalClickLevel`.
- Fails CI if any stage's `realTimeSec` deviates from `realPlayTargetSec` by more than 50%.

---

## 15. Module 14 — UI Polish (defer to last)

Once mechanics work:
- Add tooltips to every upgrade button explaining the formula.
- Add a "Cosmic Almanac" panel (collapsible) that shows current stage info, mechanic explanation, and a real-time scientific note (e.g., "BBN produced ~75% H, ~25% He by mass").
- Add a settings panel: mute toggle, clock format (scientific vs natural), animation intensity, accessibility (reduce motion).
- Mobile responsiveness: ensure timeline + clock are legible at 360px.

---

## 16. Out of Scope

These are NOT to be implemented in this refactor — flag for a future pass:
- Multiplayer / cloud save
- Achievements / metagame trophies
- Localization (keep English UI for now)
- Mobile native build

---

## 17. Definition of Done

The agent is finished when:

1. `npm run build` passes with no TypeScript errors.
2. `npm test` passes.
3. `npm run sim` reports all stages within ±50% of `realPlayTargetSec`.
4. Manual playthrough on a fresh save:
   - Reaches Life on Earth in under 30 minutes of real play.
   - Civilization flicker is visually striking (1-second flash, audible chime).
   - All 16 stages are reachable.
   - At least 2 endings can be selected and play their cinematic.
5. Loading a v1 save migrates without crashing; the player resumes at the same stage with default values for new fields.
6. Closing the tab for 2 minutes and reopening shows the offline-progress modal with correct numbers.

---

## 18. Working Process

The agent should:

1. **Read every file in `src/` first.** Especially `reducer.ts`, `formulas.ts`, `constants.ts`, `stages.ts`, `types.ts`, `audio.ts`, and the components. Build a complete mental model before changing anything.
2. **Branch the work.** Create a single branch `refactor/cosmic-coalescence-v2`.
3. **Implement modules in order.** Don't skip ahead — earlier modules are foundations.
4. **Commit per module** with a clear message: `feat(stages): add 4 missing cosmological stages`, `feat(mechanics): implement matter_asymmetry`, etc.
5. **Run `npm run build` and `npm test` after each commit.** Fix everything before moving on.
6. **Document mechanic state shapes in code** with inline comments and types.
7. **Avoid mock data in mechanics.** All visual effects must be reactive to real state.
8. **Don't touch the canvas drawing layer (`canvas/draw*.ts`) more than necessary.** Reuse existing primitives.
9. **Ask questions only if blocked.** If a numeric value is ambiguous, prefer the value listed in this spec; if missing, choose a reasonable default and document it.

---

## 19. Reference: Why each change matters

| Change | Without it | With it |
|---|---|---|
| 16 stages instead of 12 | Players miss inflation, baryogenesis, dark age, reionization (the dramatic events) | Game is cosmologically literate |
| Time compression | Every stage feels the same length | Plays back the actual cosmic timeline scale |
| Stage-differentiated mechanics | Stages are reskins | Each stage is its own micro-game |
| Civilization flicker | Stage 11 is a long grind | Single most affecting moment in the game |
| Multi-ending | One playthrough is enough | 4× replay value, narrative depth |
| Idle progress | No retention | Players come back |
| Uncapped prestige | Numbers stop | Late-game compounding feel |
| Logarithmic timeline | Linear bar misrepresents cosmic time | Player intuits the scale of 1e110 yr |
| Singularity tree | No metaprogression | Rewards persistent play |
| Save migration | v1 players lose progress | Smooth update |
| Tests | Refactors break silently | Confidence to keep iterating |

---

## 20. Tone Reminder for Generated Content

When writing in-game text (quotes, mechanic tutorials, ending cinematics):
- Voice: contemplative documentary narrator.
- Avoid: hype, achievement language ("you did it!"), exclamation points.
- Prefer: present tense, short sentences, scientific specificity grounded in poetry.
- Length: ~1–3 sentences per beat, never more than 240 chars.
- Do not quote the *Timelapse of the Entire Universe* documentary. All text must be original.

---

End of specification.
