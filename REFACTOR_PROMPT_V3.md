# Cosmic Coalescence — Refactor V3 Specification

> **Audience**: An autonomous coding agent (Codex / Claude Code / similar) with full repo access.
> **Mode**: Plan-then-execute. Read every file in `src/` before changing anything. After each module, run `npm run build` and `npm test`.
> **Status**: Builds on V1 (`REFACTOR_PROMPT.md`) and V2 (`REFACTOR_PROMPT_V2.md`).
> **V3 supersedes parts of V2**. The conflicts are listed in §0.1; when V3 contradicts V2, V3 wins.

V3 incorporates user feedback gathered while V2 was being implemented. The major changes:

1. **Single unified skill tree** — V2's four separate trees become one connected tree with 4 vertical tracks + cross-skill nodes + a final apex.
2. **Skill points removed** — Only quanta is spent on skills. (V2's `skillPoints` field becomes unused; preserve for save compatibility but stop awarding it.)
3. **Stage-gated tutorial** — Skills are revealed one per early stage: stage 2 unlocks Stellar Forge, stage 3 Quantum Lens, stage 4 Cosmic Web, stage 5 Aeon Drive. Stage 1 has no skill UI at all.
4. **Front-fast / back-slow pacing** — 100 h total, but stages 1–5 in 22 min, stages 14–16 in 72 h.
5. **Click visual scales with skill level** — More emissions per click as Stellar Forge levels up.
6. **Particle name labels on clicks** — Each click shows what was produced (e.g., "+25 Helium-4").
7. **Stage visual rework for stages 7, 10, 11, 12, 15, 16** — User-specified redesigns.
8. **Aeon Drive visual fix** — Remove blur; rely on star-streak length and explicit "× rate" label.
9. **Per-stage backgrounds**.
10. **Universe Atlas + cosmic modifiers** — Each prestige run is *different* (random gravity / time / palette ±20%).
11. **Hidden ending conditions** — Player discovers Big Crunch / Big Rip / Vacuum Decay / Bounce by playing in specific ways.
12. **Numbers floor to integers** — No decimals shown anywhere in UI.
13. **Quanta carries across stage transitions**; condense costs nothing.
14. **Encounter rewards capped at 5 % of stage threshold**.
15. **Mass cap scales with progress, not click count**.

Implementation order: §V3-A → §V3-Z (matches table in §22). Each module is independently testable and shippable.

---

## 0. V3 Supersedes V2 — Reconciliation

### 0.1 Direct conflicts

| Topic | V2 said | V3 says | Action |
|---|---|---|---|
| Skill structure | 4 separate trees, 4 tabs | Single connected tree, 4 vertical tracks | Rewrite SkillsPanel |
| Skill currency | `skillPoints` for T2/T3, `condensedMass` for T4 | Quanta for everything; no skill points | Remove `skillPoints` consumption; keep field zeroed |
| Threshold table (§5.3 V2) | Sums to ~100 h with even-ish distribution | Front-fast: stages 1–5 in 22 min, stages 14–16 in 72 h | Replace `STAGES` thresholds & realPlayTargetSec |
| Skill point awards | +1 per stage advance, +5 per prestige | None — skill points removed | Stop dispatching `AWARD_SKILL_POINTS` |
| Time skill visual | CSS blur + saturate filter | No blur; star-streak length only + explicit "Time × N" label | Remove blur from ParticleField |
| Condense cost | Free already in V2 (only entropy used as currency in some old flow) | Free — confirmed | Verify no hidden cost remains |
| Dark Age "spend entropy to skip 10%" | Present | **Removed** | Delete the skip mechanic |
| Encounter bonus | Up to ~6× click power | Capped at 5 % of current stage threshold | Add cap formula |
| Quanta on stage advance | Set to 0 | Carries over (excess above threshold) | Update `ADVANCE_STAGE` reducer |

### 0.2 V2 features V3 keeps

- Stage list contains 16 entries (with new pacing values from §1).
- 16 mechanics in `mechanics/` directory.
- Multi-ending architecture under `components/endings/`.
- Save migration chain v1 → v2 → v3 → v4.
- Singularity Tree as separate prestige meta-progression.
- Logarithmic Timeline + cosmic clock.
- 16 unique `clusterMode` values.
- `drawStageSprite` dispatch in `canvas/stageSprites.ts`.
- Almanac infrastructure.

---

## 1. Module V3-A — Number Formatting (No Decimals)

### 1.1 Goal

User requirement: "숫자들이 소숫점 아래는 쓰지말아줘." Floor everything to integers in UI. No `1.5K`, only `1K` or `1,500`.

### 1.2 Replace `formatWhole`

```ts
// formulas.ts
export function formatWhole(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0';
  const v = Math.floor(n);
  if (v < 1000) return v.toString();
  if (v < 1_000_000) return v.toLocaleString('en-US');           // "12,345"
  if (v < 1e9)   return `${Math.floor(v / 1e6)}M`;              // "12M"
  if (v < 1e12)  return `${Math.floor(v / 1e9)}B`;              // "12B"
  if (v < 1e15)  return `${Math.floor(v / 1e12)}T`;             // "12T"
  // 1e15+: integer-mantissa scientific
  const exp = Math.floor(Math.log10(v));
  const mantissa = Math.floor(v / Math.pow(10, exp));
  return `${mantissa}e${exp}`;                                  // "1e21"
}
```

### 1.3 Replace `formatRate` and `formatCosmicTime`

```ts
export function formatRate(n: number): string {
  return `${formatWhole(n)}/s`;
}

export function formatCosmicTime(seconds: number): string {
  if (seconds < 1)        return `${Math.floor(seconds * 1e3)}ms`;
  if (seconds < 60)       return `${Math.floor(seconds)}s`;
  if (seconds < 3600)     return `${Math.floor(seconds / 60)}min`;
  if (seconds < 86400)    return `${Math.floor(seconds / 3600)}hr`;
  if (seconds < 31_557_600) return `${Math.floor(seconds / 86400)}d`;
  const years = seconds / 31_557_600;
  if (years < 1e6) return `${Math.floor(years)}yr`;
  if (years < 1e9) return `${Math.floor(years / 1e6)}Myr`;
  if (years < 1e12) return `${Math.floor(years / 1e9)}Gyr`;
  const exp = Math.floor(Math.log10(years));
  const mantissa = Math.floor(years / Math.pow(10, exp));
  return `${mantissa}e${exp}yr`;
}
```

### 1.4 Acceptance

- `formatWhole(1500) === "1,500"`.
- `formatWhole(2_300_000) === "2M"`.
- `formatWhole(1.2e15) === "1e15"`.
- Snapshot tests covering boundaries.

---

## 2. Module V3-B — New Pacing (Front-Fast / Back-Slow)

### 2.1 The canonical pacing table

Sums to exactly 360,000 s = 100 h. Stage thresholds are tuned in §V3-F so that the simulator finishes each stage within ±30 % of its target.

| stage | name | realPlayTargetSec | h:mm | threshold |
|---|---|---:|---:|---:|
| 1 | Inflation | 60 | 0:01 | 50 |
| 2 | Baryogenesis | 120 | 0:02 | 400 |
| 3 | Quark-Gluon Plasma | 240 | 0:04 | 2,400 |
| 4 | Nucleosynthesis | 360 | 0:06 | 12,000 |
| 5 | Recombination | 540 | 0:09 | 80,000 |
| 6 | Cosmic Dark Age | 1,800 | 0:30 | 600,000 |
| 7 | First Stars | 3,600 | 1:00 | 5,000,000 |
| 8 | Reionization | 5,400 | 1:30 | 50,000,000 |
| 9 | Galaxy Formation | 7,200 | 2:00 | 500,000,000 |
| 10 | Solar System | 10,800 | 3:00 | 5,000,000,000 |
| 11 | Life on Earth | 14,400 | 4:00 | 50,000,000,000 |
| 12 | Death of Star | 21,600 | 6:00 | 500,000,000,000 |
| 13 | Stelliferous End | 36,000 | 10:00 | 5e12 |
| 14 | Degenerate Era | 54,000 | 15:00 | 5e14 |
| 15 | Black Hole Era | 86,400 | 24:00 | 5e17 |
| 16 | The End | 117,480 | ~33:00 | 5e21 |
| **Total** | | **360,000** | **100:00** | |

Update `STAGES` in `stages.ts` accordingly.

### 2.2 Why this distribution

- **0–22 min**: Player learns mechanics, sees four cosmic-cool moments, gets hooked.
- **22 min – 8 h**: Skill investment becomes interesting; player chooses a build.
- **8 h – 28 h**: Mid-game; the emotional centerpiece (Stage 11 Life-on-Earth flicker, Stage 12 planet consumption).
- **28 h – 100 h**: Late-game grind that rewards prestige investment and idle play.

### 2.3 Acceptance

- `STAGES.reduce((s, st) => s + st.realPlayTargetSec, 0) === 360_000`.
- `npm run sim` reports total time within [80, 130] hours.
- Each stage's actual time within ±30 % of `realPlayTargetSec`.

---

## 3. Module V3-C — Quanta Carry-Over

### 3.1 Change

Current `ADVANCE_STAGE` reducer sets `quanta: 0`. Change so excess quanta carries forward:

```ts
case 'ADVANCE_STAGE': {
  if (state.pendingCondenseStageIdx === null) return state;
  if (state.stageIdx >= STAGES.length - 1) {
    return { ...state, pendingCondenseStageIdx: null, pendingCondenseEntropy: 0,
             imploding: false, condenseStartedAt: null, completedRun: true };
  }
  const currentStage = STAGES[state.stageIdx];
  const excess = Math.max(0, state.quanta - currentStage.threshold);
  return {
    ...state,
    stageIdx: state.stageIdx + 1,
    quanta: excess,                  // CARRY OVER
    // skill levels are NOT reset — V3 has no skill auto-reset
    combo: 0,
    lastClick: 0,
    pendingCondenseStageIdx: null,
    pendingCondenseEntropy: 0,
    imploding: false,
    condenseStartedAt: null,
  };
}
```

### 3.2 Acceptance

- Reducer test: condense at quanta = threshold + 100 → next stage starts at quanta = 100.
- Skill levels (click/auto/crit/time) untouched after stage advance.

---

## 4. Module V3-D — Free Condense; Remove Dark-Age Skip

### 4.1 Condense

Verify `START_CONDENSE` consumes no quanta nor entropy. Currently in V2 it should already be free since it just transitions; remove any leftover cost code.

### 4.2 Remove Dark Age "spend entropy to skip 10 %"

Delete this code path in `mechanics/dark_age.ts`. The Dark Age stage is intentionally a long quiet stretch. Players use auto skill (Cosmic Web) to pass through it. No skip option.

### 4.3 Acceptance

- Player can condense without paying anything.
- No UI element references "spend entropy to skip" in stage 6.

---

## 5. Module V3-E — Encounter Cap

### 5.1 Change

In the encounter-collision handler (likely `mechanics/index.ts` or `ParticleField.tsx`), cap bonus at 5 % of current stage threshold:

```ts
function calculateEncounterBonus(stage: Stage, tier: RogueTypeKey): number {
  const baseBonus = ROGUE_TYPES[tier].bonusMultiplier * stage.threshold * 0.01;
  return Math.min(baseBonus, stage.threshold * 0.05);
}
```

`many_worlds` cross node owned: cap raises to 10 % of threshold; otherwise cap holds.

### 5.2 Acceptance

- Reducer test: massive collision on stage with threshold 1e10 → bonus ≤ 5e8.
- With many_worlds owned → bonus ≤ 1e9.

---

## 6. Module V3-F — Single Unified Skill Tree

### 6.1 Architecture

Replace V2's four-tree structure with one connected tree:

```
                       ★ Cosmos Primal               ← all 4 tracks at L30
                       (×10 to all effects)
                              │
              ┌──────────────┼──────────────┐
              │              │              │
         [Big Bang]     [Web of All]    [Eternal Return]   ← L25 cross
              │              │              │
              ├──────────────┼──────────────┤
              │              │              │
         [Pair]  [Heisenberg] [Dilation] [Filament]        ← L20 cross
              │              │              │
              ├──────────────┼──────────────┤
              │              │              │
         [Echoing] [Wave Coll] [Inflaton]                  ← L15 cross
              │              │              │
              ├──────────────┼──────────────┤
              │              │              │
   ╔══════════╦══════════╦══════════╦══════════╗
   ║ Lv 30    ║ Lv 30    ║ Lv 30    ║ Lv 30    ║
   ║ ...      ║ ...      ║ ...      ║ ...      ║
   ║ Lv 25 ★  ║ Lv 25 ★  ║ Lv 25 ★  ║ Lv 25 ★  ║   ← milestones
   ║ ...      ║ ...      ║ ...      ║ ...      ║
   ║ Lv 20 ★  ║ Lv 20 ★  ║ Lv 20 ★  ║ Lv 20 ★  ║
   ║ ...      ║ ...      ║ ...      ║ ...      ║
   ║ Lv 15 ★  ║ Lv 15 ★  ║ Lv 15 ★  ║ Lv 15 ★  ║
   ║ ...      ║ ...      ║ ...      ║ ...      ║
   ║ Lv 10 ★  ║ Lv 10 ★  ║ Lv 10 ★  ║ Lv 10 ★  ║
   ║ ...      ║ ...      ║ ...      ║ ...      ║
   ║ Lv 5  ★  ║ Lv 5  ★  ║ Lv 5  ★  ║ Lv 5  ★  ║
   ║ ...      ║ ...      ║ ...      ║ ...      ║
   ║ Lv 1     ║ Lv 1     ║ Lv 1     ║ Lv 1     ║
   ║          ║          ║          ║          ║
   ║ Stellar  ║ Cosmic   ║ Quantum  ║ Aeon     ║
   ║ Forge    ║ Web      ║ Lens     ║ Drive    ║
   ╚══════════╩══════════╩══════════╩══════════╝
   unlocked    unlocked    unlocked   unlocked
   stage 2     stage 4     stage 3    stage 5
```

### 6.2 Track names and milestones

```ts
// Each track has 30 levels. Milestones at 5/10/15/20/25/30 grant a named effect upgrade.
export const TRACKS = {
  click: {
    id: 'click',
    label: 'Stellar Forge',
    description: 'Each click strikes harder.',
    color: '#ff6a45',
    unlockStageId: 2,
    milestones: {
      1:  { name: 'Spark', desc: 'Click yields 1.' },
      5:  { name: 'Quark Bond', desc: 'Click emits 2 motes.' },
      10: { name: 'Gluon Lattice', desc: 'Click emits 3 motes; +20 % power.' },
      15: { name: 'Plasma Strike', desc: 'Combo timeout +200 ms.' },
      20: { name: 'Stellar Forge', desc: 'Click emits 4 motes.' },
      25: { name: 'Supernova Hammer', desc: 'Click emits 5 motes; every 7th click is a guaranteed crit.' },
      30: { name: 'Quasar Cannon', desc: 'Click emits 6 motes; click VFX 2× scale.' },
    },
  },
  auto: {
    id: 'auto',
    label: 'Cosmic Web',
    description: 'The universe gathers itself.',
    color: '#6d8fff',
    unlockStageId: 4,
    milestones: {
      1:  { name: 'Filament Spin', desc: 'Auto rate 1/s.' },
      5:  { name: 'Cold Drift', desc: '+30 % auto rate.' },
      10: { name: 'Dark Flow', desc: '+30 % auto rate.' },
      15: { name: 'Web Loom', desc: 'Auto contributes to combo (10 ticks = +1 combo).' },
      20: { name: 'Cosmic Web', desc: '+50 % auto rate.' },
      25: { name: 'Universal Pulse', desc: 'Auto runs through condense and cinematics.' },
      30: { name: 'Eternal Drift', desc: '+100 % auto rate.' },
    },
  },
  crit: {
    id: 'crit',
    label: 'Quantum Lens',
    description: 'Probability bends to your stare.',
    color: '#9966cc',
    unlockStageId: 3,
    milestones: {
      1:  { name: "Observer's Eye", desc: 'Base crit chance 5 %, ×3 multiplier.' },
      5:  { name: 'Wave Collapse', desc: '+5 % crit chance.' },
      10: { name: 'Heisenberg Lens', desc: 'Crit damage variance becomes [×0.5, ×2.0].' },
      15: { name: 'Probability Sieve', desc: '+10 % crit chance.' },
      20: { name: 'Quantum Lens', desc: 'Crit multiplier ×5.' },
      25: { name: 'Many Worlds', desc: 'Encounters roll crit at 2× chance; encounter cap raises to 10 % of threshold.' },
      30: { name: 'Eigenvalue Strike', desc: 'Crit chance cap 80 %; multiplier ×8.' },
    },
  },
  time: {
    id: 'time',
    label: 'Aeon Drive',
    description: 'Bend the rate of cosmic time.',
    color: '#ffb84d',
    unlockStageId: 5,
    milestones: {
      1:  { name: 'Tick Tock', desc: 'Time × 1.05.' },
      5:  { name: 'Cosmic Pulse', desc: 'Time × 1.30.' },
      10: { name: 'Time Dilation', desc: 'Time × 1.80.' },
      15: { name: 'Temporal Flow', desc: 'Time × 2.50.' },
      20: { name: 'Aeon Drive', desc: 'Time × 4.00.' },
      25: { name: 'Eternity Engine', desc: 'Time × 7.00.' },
      30: { name: 'Cosmic Clock', desc: 'Time × 12.00.' },
    },
  },
} as const;

export type TrackId = keyof typeof TRACKS;
```

### 6.3 Cross-skill nodes

```ts
export const CROSS_NODES: CrossNodeDef[] = [
  // Lv 15 cross (need 2 tracks at certain levels)
  { id: 'echoing_click', tier: 15, label: 'Echoing Click',
    desc: 'Click has 18 % chance to fire twice.',
    cost: 50_000, currency: 'quanta',
    requires: { click: 15, time: 10 } },
  { id: 'wave_capture', tier: 15, label: 'Wave Capture',
    desc: 'Auto ticks may also crit.',
    cost: 50_000, currency: 'quanta',
    requires: { crit: 15, auto: 10 } },
  { id: 'inflaton_echo', tier: 15, label: 'Inflaton Echo',
    desc: 'First 5 s of each stage runs at time × 3.',
    cost: 50_000, currency: 'quanta',
    requires: { time: 15, click: 10 } },

  // Lv 20 cross
  { id: 'pair_production', tier: 20, label: 'Pair Production',
    desc: 'Every 7th click is a guaranteed crit (stacks with Supernova Hammer).',
    cost: 5_000_000, currency: 'quanta',
    requires: { click: 20, crit: 15 } },
  { id: 'heisenberg', tier: 20, label: 'Heisenberg',
    desc: 'Crit damage rolls in [×0.5, ×2.0]; average +25 %.',
    cost: 5_000_000, currency: 'quanta',
    requires: { crit: 20, time: 15 } },
  { id: 'dilation', tier: 20, label: 'Dilation',
    desc: 'When quanta is 80–100 % of threshold, time × 0.5 but rewards × 4.',
    cost: 5_000_000, currency: 'quanta',
    requires: { time: 20, auto: 15 } },
  { id: 'filament', tier: 20, label: 'Filament Network',
    desc: 'Auto rate gains stagesCleared^1.2 multiplier.',
    cost: 5_000_000, currency: 'quanta',
    requires: { auto: 20, click: 15 } },

  // Lv 25 cross
  { id: 'big_bang_click', tier: 25, label: 'Big Bang Click',
    desc: 'Once per stage: a single click that gains sqrt(totalClicks) × clickPower.',
    cost: 500_000_000, currency: 'quanta',
    requires: { click: 25, crit: 25 } },
  { id: 'web_of_all', tier: 25, label: 'Web of All',
    desc: 'Auto rate gains a multiplier equal to (clickLevel)².',
    cost: 500_000_000, currency: 'quanta',
    requires: { auto: 25, click: 25 } },
  { id: 'eternal_return', tier: 25, label: 'Eternal Return',
    desc: 'Once per run: rewind to previous stage and re-clear it, retaining gains.',
    cost: 500_000_000, currency: 'quanta',
    requires: { time: 25, auto: 25 } },

  // Apex
  { id: 'cosmos_primal', tier: 30, label: 'Cosmos Primal',
    desc: 'All effects ×10.',
    cost: 1_000_000_000_000, currency: 'quanta',
    requires: { click: 30, auto: 30, crit: 30, time: 30 } },
];

export interface CrossNodeDef {
  id: string;
  tier: 15 | 20 | 25 | 30;
  label: string;
  desc: string;
  cost: number;
  currency: 'quanta';
  requires: Partial<Record<TrackId, number>>;  // track → required level
}
```

### 6.4 Track level cost curve (quanta)

```ts
function trackLevelCost(track: TrackId, lvl: number): number {
  // Slow growth at start (so early stages aren't blocked) but exponential later.
  const trackBase = { click: 40, auto: 70, crit: 110, time: 180 }[track];
  return Math.floor(trackBase * Math.pow(1.95, lvl));
}
// click: Lv 1=40, Lv 10=8.4K, Lv 20=1.7M, Lv 30=378M.
// time:  Lv 1=180, Lv 10=37K, Lv 20=7.6M, Lv 30=1.7B.
```

### 6.5 Skill state shape

```ts
// types.ts
export interface SkillState {
  click: { level: number };  // 0-30
  auto:  { level: number };
  crit:  { level: number };
  time:  { level: number };
  unlockedTracks: TrackId[];          // tracks the player has unlocked (gated by stage)
  ownedCrossNodes: string[];          // CrossNodeDef ids owned
}
```

The previous `ownedNodes` per-tree concept is replaced by a flat `ownedCrossNodes` array.

### 6.6 Reducer actions

Replace V2's skill actions with:

```ts
| { type: 'BUY_TRACK_LEVEL'; trackId: TrackId }
| { type: 'BUY_CROSS_NODE'; nodeId: string }
| { type: 'UNLOCK_TRACK'; trackId: TrackId }    // automatic on stage entry
```

`BUY_TRACK_LEVEL`:
1. Verify track is in `unlockedTracks`.
2. Compute `cost = trackLevelCost(trackId, currentLevel)`.
3. Verify `quanta >= cost` and `currentLevel < 30`.
4. Deduct, increment.

`BUY_CROSS_NODE`:
1. Find node by id. Verify `requires` against current track levels.
2. Verify quanta ≥ cost. Verify not already owned.
3. Deduct, push to `ownedCrossNodes`.

`UNLOCK_TRACK`:
1. Add trackId to `unlockedTracks` if not present.

In `gameReducer`, the `ADVANCE_STAGE` reducer should automatically dispatch `UNLOCK_TRACK` for the appropriate track when entering stage 2/3/4/5:

```ts
case 'ADVANCE_STAGE': {
  // ... existing logic ...
  const nextStageIdx = state.stageIdx + 1;
  const newUnlocks = [...state.skills.unlockedTracks];
  // Map nextStageIdx (0-based) + 1 (1-based stage id) to track unlock
  const stageId = nextStageIdx + 1;
  if (stageId === 2 && !newUnlocks.includes('click')) newUnlocks.push('click');
  if (stageId === 3 && !newUnlocks.includes('crit')) newUnlocks.push('crit');
  if (stageId === 4 && !newUnlocks.includes('auto')) newUnlocks.push('auto');
  if (stageId === 5 && !newUnlocks.includes('time')) newUnlocks.push('time');
  return {
    ...state,
    skills: { ...state.skills, unlockedTracks: newUnlocks },
    // ... rest of advance logic ...
  };
}
```

### 6.7 Effect computation

```ts
// src/game/skills/effects.ts
export interface Modifiers {
  clickPowerMult: number;
  clickEmissionCount: number;          // mote count emitted per click
  autoRateMult: number;
  critChance: number;
  critMult: number;
  critChanceCap: number;
  comboTimeoutMs: number;
  timeMult: number;
  echoChance: number;
  pairProductionPeriod: number;        // 0 = off, 7 = every 7th click
  bigBangAvailable: boolean;
  webOfAllExp: number;                 // 0 or 2 (if owned)
  eternalReturnAvailable: boolean;
  inflatonEchoSec: number;
  dilationActive: boolean;
  manyWorldsCapMult: number;           // 1 default, 2 with many_worlds
  filamentExp: number;                 // 0 or 1.2
  apexMult: number;                    // 1 default, 10 with cosmos_primal
}

export function computeModifiers(skills: SkillState, ctx: ModifierCtx): Modifiers {
  // base from track levels
  const m: Modifiers = {
    clickPowerMult: Math.pow(1.6, skills.click.level),
    clickEmissionCount: 1
      + (skills.click.level >= 5 ? 1 : 0)
      + (skills.click.level >= 10 ? 1 : 0)
      + (skills.click.level >= 20 ? 1 : 0)
      + (skills.click.level >= 25 ? 1 : 0)
      + (skills.click.level >= 30 ? 1 : 0),
    autoRateMult: skills.auto.level === 0 ? 0 : Math.pow(1.7, skills.auto.level),
    critChance: skills.crit.level * 0.025 + (skills.crit.level >= 5 ? 0.05 : 0)
                                          + (skills.crit.level >= 15 ? 0.10 : 0),
    critMult: 3 + skills.crit.level * 0.5
      + (skills.crit.level >= 20 ? 5 : 0)
      + (skills.crit.level >= 30 ? 8 : 0),
    critChanceCap: skills.crit.level >= 30 ? 0.8 : 0.5,
    comboTimeoutMs: 700 + (skills.click.level >= 15 ? 200 : 0),
    timeMult: skills.time.level === 0 ? 1 : Math.pow(1.18, skills.time.level),
    echoChance: 0,
    pairProductionPeriod: skills.click.level >= 25 ? 7 : 0,
    bigBangAvailable: false,
    webOfAllExp: 0,
    eternalReturnAvailable: false,
    inflatonEchoSec: 0,
    dilationActive: false,
    manyWorldsCapMult: 1,
    filamentExp: 0,
    apexMult: 1,
  };

  for (const id of skills.ownedCrossNodes) applyCrossNode(m, id);

  if (m.apexMult !== 1) {
    m.clickPowerMult *= m.apexMult;
    m.autoRateMult *= m.apexMult;
    m.critMult *= m.apexMult;
    m.timeMult *= m.apexMult;
  }
  return m;
}

function applyCrossNode(m: Modifiers, id: string): void {
  switch (id) {
    case 'echoing_click':   m.echoChance = 0.18; break;
    case 'wave_capture':    /* enable autoCanCrit elsewhere */ break;
    case 'inflaton_echo':   m.inflatonEchoSec = 5; break;
    case 'pair_production': m.pairProductionPeriod = 7; break;
    case 'heisenberg':      /* roll crit damage in apply */ break;
    case 'dilation':        m.dilationActive = true; break;
    case 'filament':        m.filamentExp = 1.2; break;
    case 'big_bang_click':  m.bigBangAvailable = true; break;
    case 'web_of_all':      m.webOfAllExp = 2; break;
    case 'eternal_return':  m.eternalReturnAvailable = true; break;
    case 'cosmos_primal':   m.apexMult = 10; break;
  }
}
```

### 6.8 Acceptance for Module V3-F

- Unit tests covering each milestone effect.
- Cross-node prereq enforcement.
- Apex node multiplies everything by 10.
- A "buy nothing" run cannot progress past stage 1 (since auto.level 0 → autoRate 0, click power = 1, threshold 50 needs 50 clicks → still works). A "buy nothing" run *cannot pass stage 2* (threshold 400, click power 1, no auto).

---

## 7. Module V3-G — Skill Panel UI Rewrite

### 7.1 Layout

420 px slide-in panel from right. Visual is a single connected SVG tree — 4 vertical tracks, each 600 px tall (one node per level slot), with cross-node nodes positioned between tracks.

```
┌─────────────────────────────────────────────┐
│ COSMIC SKILLS                          [✕]  │
├─────────────────────────────────────────────┤
│ Quanta: 1,500,000                            │
├─────────────────────────────────────────────┤
│                  ★ Cosmos Primal             │
│                       🔒                      │
│                       │                       │
│        ┌──────────────┼──────────────┐       │
│        │              │              │       │
│   [Big Bang]     [Web of All]   [Etern.Ret]  │
│       🔒              🔒             🔒       │
│                       │                       │
│   …                                          │
│                                              │
│   ╔═════╦═════╦═════╦═════╗                  │
│   ║ 30  ║ 30  ║ 30  ║ 30  ║                  │
│   ║  …  ║  …  ║  …  ║  …  ║                  │
│   ║[★5] ║[★5] ║[★5] ║[★5] ║                  │
│   ║  4  ║  3  ║  2  ║ 🔒  ║   ← 트랙별 현재 lv │
│   ║  3  ║  2  ║  1  ║ 🔒  ║                  │
│   ║  2  ║  1  ║  0  ║ 🔒  ║                  │
│   ║  1  ║  0  ║  0  ║ 🔒  ║                  │
│   ║Stel ║Cosm ║Quan ║Aeon ║                  │
│   ║Forge║Web  ║Lens ║Drive║                  │
│   ╚═════╩═════╩═════╩═════╝                  │
├─────────────────────────────────────────────┤
│ Selected: Stellar Forge — Lv 4              │
│ Cost to Lv 5: 740 quanta                     │
│ Effect: +1 mote per click (★ Quark Bond)     │
│ After buy: click 6 → 10                      │
│         /s 1 (no change)                     │
│         crit ×3 (no change)                  │
│         time ×1 (no change)                  │
│         [BUY +1 LEVEL]                       │
└─────────────────────────────────────────────┘
```

### 7.2 Visual states for each cell

Each track cell (one per level slot 1–30):

- **filled** (level ≤ current): track color, solid.
- **next** (level = current + 1): glowing border, pulse animation, clickable.
- **future** (level > current + 1, ≤ 30): faint outline, not clickable.
- **milestone** (5/10/15/20/25/30): same as above but with a star ★ icon overlay; if owned, the star is gold.
- **track locked** (track not in `unlockedTracks`): all 30 cells are dim with a padlock icon over the entire column. A label shows "Unlocks at Stage N".

Each cross-node node:

- **locked** (prereqs unmet): gray with padlock; tooltip explains "Requires Stellar Forge L15 + Aeon Drive L10".
- **available** (prereqs met, can afford): glowing border, accent color, clickable.
- **owned**: filled accent color, ★ icon.

### 7.3 Selected-node detail panel

Bottom of panel shows whichever node is selected (track cell or cross-node):

```
Selected: Stellar Forge — Lv 4
Cost to Lv 5: 740 quanta

Effect: +1 mote per click (★ Quark Bond)

After buy:
  Click power:  6 → 10
  Auto rate:    1/s (no change)
  Crit:         ×3 (no change)
  Time:         ×1 (no change)

[BUY +1 LEVEL]   ← disabled if quanta insufficient
```

For cross-nodes, replace "Cost to Lv N" with the node's flat cost and prereq status.

### 7.4 Skills button on main screen

Floating bottom-right. Icon only; no number underneath.

```css
.skills-button {
  /* base */
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 56px; height: 56px;
  border-radius: 50%;
}
.skills-button.affordable {
  animation: pulse-glow 1.6s ease-in-out infinite;
  box-shadow: 0 0 24px var(--accent);
}
.skills-button.has-new-track {
  animation: pulse-glow 0.8s ease-in-out infinite, badge-blink 0.5s 4;
}
```

Affordable = any next-level on any unlocked track is buyable, OR any locked cross-node has prereqs met and is affordable.

### 7.5 Acceptance for Module V3-G

- Panel renders all 4 tracks with correct unlock states.
- Lv 1 buy works; track levels increment; SVG reflects.
- Cross-node lock-on-prereq-fail works.
- Skills button glows when affordable.
- ESC and backdrop close the panel.

---

## 8. Module V3-H — Stage-Gated Track Unlock

### 8.1 Mapping

| Stage entry | Track unlocked |
|---|---|
| 1 → enter | (none — no skill UI) |
| 2 → enter | click (Stellar Forge) |
| 3 → enter | crit (Quantum Lens) |
| 4 → enter | auto (Cosmic Web) |
| 5 → enter | time (Aeon Drive) |
| 7 → enter | Cross-nodes Lv15 are reachable in UI (still need prereqs) |
| 11 → enter | Cross-nodes Lv20 reachable in UI |
| 14 → enter | Cross-nodes Lv25 reachable in UI |
| 15 → enter | Apex reachable in UI |

For the cross-node visibility: locked tier nodes (above current visibility threshold) render as a dim placeholder with "Unlocks at Stage N" label.

### 8.2 Stage 1 has no skill UI

- `<SkillsButton>` is hidden when `state.stageIdx === 0` AND `state.universeCount === 1`.
- After completing stage 1 the first time, button appears.
- For subsequent universes, the button is always visible.

### 8.3 Tutorial popups

When the player enters a stage that unlocks a track for the first time (`universeCount === 1` and first time on this stage), show a centered popup:

> **Stage 2 — Baryogenesis**
>
> **Stellar Forge** is now available.
>
> Buy levels of this skill to make your clicks more powerful. Without it, the universe cannot grow.
>
> [Open Skills]   [Dismiss]

`[Open Skills]` opens the Skills panel automatically; `[Dismiss]` closes the popup.

Track unlocks for stage 3/4/5 follow the same pattern.

### 8.4 Acceptance

- New save: stage 1 has no skills button.
- Entering stage 2: button appears; tutorial popup fires.
- After completing a universe, button is visible from stage 1 onward in next universe.

---

## 9. Module V3-I — Click Visual Scaling

### 9.1 Goal

User feedback: clicks should *look* more powerful as Stellar Forge levels up. Currently every click looks identical.

### 9.2 Implementation

In `ParticleField.tsx`, the click handler currently spawns:
- 1 floating number
- 1 click burst
- 1 flyer

Change to read `modifiers.clickEmissionCount` and spawn that many of each. For `clickEmissionCount = N`:
- Spawn N floating numbers, slightly offset radially.
- Spawn N flyers, each with slightly offset trajectory.
- Spawn `(CLICK_BURST_COUNT * N)` bursts.
- For N ≥ 4: also spawn a small ring shockwave.
- For N ≥ 5: shockwave is amber-tinted and persists 1 s.
- For N ≥ 6: add a pulse halo around the click point.

### 9.3 Visual scaling table

```ts
function getClickEmissionVisual(count: number): {
  floatingCount: number;
  flyerCount: number;
  burstCount: number;
  ringRadius: number;
  haloAlpha: number;
} {
  return {
    floatingCount: count,
    flyerCount: count,
    burstCount: 5 * count,
    ringRadius: count >= 4 ? 30 + count * 5 : 0,
    haloAlpha: count >= 6 ? 0.4 : 0,
  };
}
```

### 9.4 Acceptance

- At click level 0: 1 emission, no ring, no halo.
- At click level 25: 6 emissions + ring + halo + every-7th-click crit flash.
- At apex (level 30 + cosmos_primal): 6 emissions × 2 (apex doubles VFX scale; do NOT spawn 12 motes — just scale up).

---

## 10. Module V3-J — Particle Name Labels on Click

### 10.1 Goal

User: "클릭할 때 나오는 게 뭔지 글짜로도 같이 보여주면 좋겠어." Each click shows the produced particle's name next to the floating number.

### 10.2 Particle pool per stage

Add to `src/game/particles.ts`:

```ts
export const STAGE_PARTICLES: Record<number, string[]> = {
  1:  ['Spacetime', 'Vacuum', 'Quantum Foam', 'Inflaton'],
  2:  ['Quark', 'Antiquark', 'Gluon', 'Lepton', 'Photon'],
  3:  ['Up Quark', 'Down Quark', 'Strange Quark', 'Gluon', 'Photon', 'Neutrino'],
  4:  ['Proton', 'Neutron', 'Hydrogen-1', 'Helium-4', 'Lithium-7', 'Deuterium'],
  5:  ['Electron', 'Photon (CMB)', 'Hydrogen', 'Helium'],
  6:  ['Hydrogen', 'Dark Matter', 'Cold Dust'],
  7:  ['H₂', 'Pop III Star', 'Stellar Wind', 'Carbon', 'Oxygen', 'Iron'],
  8:  ['UV Photon', 'Ionized H', 'Quasar Beam'],
  9:  ['Galaxy', 'Halo', 'Filament', 'Quasar'],
  10: ['Asteroid', 'Dust', 'Planetesimal', 'Moon', 'Earth', 'Mars'],
  11: ['Water', 'RNA', 'Cell', 'Multicellular', 'Mammal', 'Civilization'],
  12: ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'],
  13: ['White Dwarf', 'Neutron Star', 'Iron Star'],
  14: ['Decaying Proton', 'Iron Atom', 'Quantum Tunnel'],
  15: ['Hawking Quantum', 'Photon Pair', 'Information'],
  16: ['Vacuum Fluctuation', 'Boltzmann Brain', 'Final Photon'],
};

export function pickParticleName(stageId: number): string {
  const pool = STAGE_PARTICLES[stageId] ?? STAGE_PARTICLES[1];
  return pool[Math.floor(Math.random() * pool.length)];
}
```

### 10.3 Display

In `FloatingNumber.tsx`, render the particle name to the right of the number:

```tsx
<div className="float-text">
  <canvas className="float-glyph" /> {/* stage sprite, 16x16 */}
  <span className="float-amount">+{formatWhole(gained)}</span>
  <span className="float-particle">{particleName}</span>
</div>
```

CSS: `.float-particle` is smaller, faded, italic.

### 10.4 Particle definitions (tooltips)

Add to `src/game/particles.ts`:

```ts
export const PARTICLE_DEFINITIONS: Record<string, string> = {
  'Quark':       '양성자와 중성자를 만드는 가장 작은 입자.',
  'Helium-4':    '빅뱅 직후에 만들어진, 우주의 25 %를 차지하는 흔한 원소.',
  'CMB':         '우주가 처음 투명해질 때 풀려난 빛. 지금도 우주를 가득 채우고 있어.',
  'Pop III Star': '우주에 처음 등장한 별. 너무 거대해서 백만 년만에 죽었어.',
  'Pluto':       '태양에서 가장 멀리 떨어진 옛 행성. 한국어로 명왕성.',
  // ...full list of all stage particles
};
```

Hovering a particle name in the floating number shows a 1-line popup with the definition.

### 10.5 Acceptance

- Each click shows a stage-appropriate particle name.
- Hover/long-press on the name shows the definition popup.

---

## 11. Module V3-K — Encounter Distance Display

### 11.1 Goal

User: "멀리 있는 별들 가까이 올 때 거리 몇 광년인지 보여주는 것도 재밌을 듯, 멀리 있을 때만."

### 11.2 Implementation

In the encounter (rogue) rendering loop, compute distance from rogue position to screen center:

```ts
const dx = rogue.x - screenWidth / 2;
const dy = rogue.y - screenHeight / 2;
const dist = Math.sqrt(dx*dx + dy*dy);
const fracOfScreen = dist / Math.min(screenWidth, screenHeight) / 2;
```

If `fracOfScreen > 0.5`, render distance label above the rogue sprite.

### 11.3 Stage-specific units

```ts
function formatRogueDistance(stageId: number, fracOfScreen: number): string {
  // fracOfScreen 0.5 ≈ "far" → big number; 1.0 ≈ "screen edge" → bigger
  const v = Math.floor(fracOfScreen * 20);
  if (stageId <= 3)  return `${v} ps·c`;        // picosecond * c
  if (stageId <= 6)  return `${v} AU`;
  if (stageId <= 9)  return `${v} ly`;
  if (stageId <= 12) return `${v} AU`;
  if (stageId <= 14) return `${v} ly`;
  return `${v} Mpc`;
}
```

### 11.4 Acceptance

- Spawning rogue: shows distance label like "9 ly".
- As rogue approaches and `fracOfScreen < 0.5`: label fades and disappears.

---

## 12. Module V3-L — Mass Cap by Progress

### 12.1 Change

Replace `TUNING.MOTE_MERGE_MAX_MASS` (constant 12) with progress-driven:

```ts
function getEffectiveMaxMass(progress01: number): number {
  return 12 + Math.floor(progress01 * 100);   // 12 → 112
}
```

In `ParticleField.tsx` mote-merging logic, call this with `getProgress(quanta, threshold)`:

```ts
const cap = getEffectiveMaxMass(getProgress(quanta, effectiveThreshold));
if (mote.mass + other.mass <= cap) {
  // merge
}
```

### 12.2 Acceptance

- At 0 % progress: motes cap at mass 12 (current center mote stays small).
- At 100 % progress: motes cap at mass 112 (center mote dominates the field).
- Visual: end of stage feels climactic because center is huge.

---

## 13. Module V3-M — Stage 7 First Stars Visual

### 13.1 User feedback

"first star에서 나오는거 너무 깬다. x가 뭐냐. fisrt start니깐 모이는게 수소들이 뭉쳐서 수소별인거잖아... 수소분자처럼 해주면 좋지 않을까? 그러면서 점점 뜨거워지듯이 빨개지면 되잖아. 블랙바디 탬퍼쳐처럼."

### 13.2 New behavior

Replace the X-shaped sprite. Each mote in stage 7 represents a hydrogen-cloud→star formation:

1. Spawn: H₂ molecule cluster (~6 small grey-blue dots in tight ring with bond lines).
2. As mote.age increases (mass-weighted), the cluster contracts and starts emitting blackbody light.
3. Color shifts following blackbody: deep red (T=2500 K) → orange-red → yellow-orange → yellow (5800 K Sun) → white-blue (10000 K) → blue (Pop III, ~30000 K).
4. Once mass ≥ 60: detonate as supernova — burst with metal-rich colors (cyan/green for nebula gas).

```ts
function getBlackbodyColor(temperature: number): string {
  // Approximate blackbody RGB at given temp in Kelvin.
  // 2500 K: rgb(255, 100, 60)
  // 4000 K: rgb(255, 180, 100)
  // 5800 K: rgb(255, 235, 200)
  // 10000 K: rgb(220, 240, 255)
  // 25000 K: rgb(170, 200, 255)
  if (temperature < 2500)   return 'rgb(120, 30, 0)';
  if (temperature < 4000)   return 'rgb(255, 100, 60)';
  if (temperature < 5800)   return 'rgb(255, 180, 100)';
  if (temperature < 8000)   return 'rgb(255, 235, 200)';
  if (temperature < 12000)  return 'rgb(220, 240, 255)';
  return                            'rgb(170, 200, 255)';
}
```

`mote.temperature` is a new derived field: `temperature = 2500 + mote.mass * 600`. Update in `ParticleField.tsx` mote loop.

### 13.3 Sprite

`drawSpriteStar` (used for stage 7 in V2's stageSprites.ts) becomes:

- Small (mass < 5): H₂ molecule ring.
- Medium (mass 5–20): contracting protostar (small reddish disk).
- Large (mass 20–60): main-sequence star (color from blackbody).
- Death (mass ≥ 60): supernova ring expansion (single-frame burst).

Acceptance:
- Stage 7 motes are clearly *not* X-shaped; they look like contracting H₂ clouds turning into stars.
- Color shift visible as motes grow.

---

## 14. Module V3-N — Stage 10 Solar System Visual

### 14.1 User vision

User wants a phased Earth formation: meteorites → red lava planet → moon impact → cooling → water → continents → plants → life → cities → meteor reset → Mars-like at end.

### 14.2 Phase mapping (driven by progress)

| progress | phase | visual |
|---|---|---|
| 0–10 % | Asteroid storm | 점점 떨어지는 dust + 운석. 행성은 빨간 용암 disk가 점점 커짐. |
| 10–20 % | Lava planet | 표면 100 % 용암; 작은 화산 spot. |
| 20–25 % | Moon-forming impact | 거대 운석이 충돌 → 작은 월 분리 (orbits planet from now on). |
| 25–40 % | Cooling | 표면 색이 빨강→갈색→어둠으로 점진. 화산 줄어듦. |
| 40–55 % | Water | 청색 영역 등장 (대륙은 검정 spot). 구름 추가. |
| 55–65 % | Continents | 대륙 형성, 갈색 spot 생김. |
| 65–75 % | Plants | 일부 대륙이 초록으로. |
| 75–85 % | Higher life | 초록 spot 빠르게 변동 (작은 점들 움직임). |
| 85–92 % | Cities | 야간 visibility — 작은 황금 점들 (도시 불빛). 하루 사이클 가속. |
| 92–95 % | **Meteor strike reset** | 거대 운석 → 표면 다시 lava red. cities gone. |
| 95–100 % | Mars-like | 식어서 빨간 사막. 물 사라지고 atmosphere 얇아짐. |

90~95 % between cities-and-meteor: random chance per second to either survive or get hit. If user is fast (high time mult), the cycle can run twice. The message: civilization is fragile.

### 14.3 Implementation

New `clusterMode: 'solarSystem'` (not `planetary`). New draw function `drawSolarSystem(args)` that:

1. Renders central yellow Sun (radius 80 px).
2. Renders Earth as a planet sprite at orbit radius 200 px, rotating once per 5 s.
3. Earth sprite's appearance depends on `progress`:

```ts
function drawEarthPhase(ctx, x, y, r, progress, t): void {
  if (progress < 0.10)      drawAsteroidStorm(ctx, x, y, r);
  else if (progress < 0.20) drawLavaPlanet(ctx, x, y, r);
  else if (progress < 0.25) drawMoonImpact(ctx, x, y, r, progress, t);
  else if (progress < 0.40) drawCoolingPlanet(ctx, x, y, r, progress);
  else if (progress < 0.55) drawWaterPlanet(ctx, x, y, r, progress);
  else if (progress < 0.65) drawContinentPlanet(ctx, x, y, r, progress);
  else if (progress < 0.75) drawPlantPlanet(ctx, x, y, r, progress);
  else if (progress < 0.85) drawLifePlanet(ctx, x, y, r, progress, t);
  else if (progress < 0.92) drawCityPlanet(ctx, x, y, r, progress, t);
  else if (progress < 0.95) drawMeteorImpact(ctx, x, y, r, progress, t);
  else                       drawMarsLike(ctx, x, y, r, progress);
}
```

Each `drawXPlanet` is ~30 lines using `ctx.arc`, gradients, simple spotting.

4. Moon sprite appears at 22 % progress, orbits Earth.
5. After Moon appears, render small lunar orbit ring trail.

### 14.4 Acceptance

- Stage 10 visual moves through 11 phases as progress advances.
- Earth visibly transforms.
- Stage 10 click reward labels match phase: at progress 0.5, click yields "Water" or "Earth"; at 0.9, "Civilization" / "City".

---

## 15. Module V3-O — Stage 11 Life-on-Earth Sub-Arc

### 15.1 Five inner steps

Already specified in V1; reaffirm V3 details:

| inner step | progress range | sprite | particle pool override |
|---|---|---|---|
| Abiogenesis | 0–25 % | RNA strand | RNA, Lipid, Amino Acid |
| Multicellular | 25–50 % | Cell colony | Multicellular, Eukaryote |
| Cambrian | 50–70 % | Diverse organisms | Trilobite, Anomalocaris, Coral |
| Land/Mammal | 70–95 % | Vertebrate | Fish, Amphibian, Reptile, Mammal |
| Civilization | 95–100 % | City lights | Human, City, Civilization |

### 15.2 Civilization Flicker

The last 1 % of stage 11 is rendered as a single-frame cinematic:
- Bright flash white-yellow.
- City lights bloom across Earth surface.
- Within 0.8 s, lights fade to red.
- Audio sting: `playCivilizationFlicker()` (rapid high chimes).

This is the emotional core. Even in a 4-hour stage, the last second is unforgettable.

### 15.3 Acceptance

- Stage 11 progress smoothly traverses 5 phases.
- 95–100 % triggers Civilization Flicker exactly once.

---

## 16. Module V3-P — Stage 12 Death of Star

### 16.1 User vision

User: solar system shows planets orbiting; sun expands; planets are eaten one by one for points; eventually Pluto is consumed.

### 16.2 Visual

1. At stage 12 entry: small yellow Sun + 9 planets (Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto) orbiting at scaled distances.
2. As progress advances:
   - Sun radius grows: `sunRadius = 30 + progress * 250`.
   - When Sun reaches a planet's orbit radius, the planet is consumed:
     - Planet sprite contracts and disappears in a flash.
     - Award: `+0.05 × stage.threshold` quanta.
     - Floating label: "Mercury", "Venus", ..., "Pluto", with 1-line lore: "Mercury was first."
3. Order and progress thresholds:

| planet | consumed at progress | bonus |
|---|---:|---:|
| Mercury | 5 % | 1 % threshold |
| Venus | 12 % | 2 % |
| Earth | 25 % | 5 % + cinematic message: "Home." |
| Mars | 38 % | 3 % |
| Jupiter | 55 % | 5 % |
| Saturn | 68 % | 5 % |
| Uranus | 78 % | 4 % |
| Neptune | 87 % | 4 % |
| Pluto | 95 % | 5 % + "Pluto was last." |

4. After 95 %: Sun shrinks to white dwarf (radius 20 px) — final 5 % is the white-dwarf cooldown.

### 16.3 Implementation

New `clusterMode: 'deathOfStar'`. New draw function. Planets orbit at fixed radii; Sun expands; collision triggers planet removal + reward dispatch.

### 16.4 Acceptance

- Watching stage 12 once shows 9 planets eaten in correct order.
- Bonus quanta arrive at right moments (within ±1 % progress tolerance).
- Final 5 % is white dwarf (small bright pinpoint).

---

## 17. Module V3-Q — Stage 15 Black Hole Simulation

### 17.1 User vision

User wants:
- Black hole shrinks over time (was supposed to but visual is "딱딱 나뉘여 있어서 가짜 같아").
- Click emits Hawking radiation (light goes OUT).
- Realistic gravitational lensing, smooth disk.

### 17.2 Implementation

New `drawBlackHoleScene(args)` function:

1. **Background distortion**: render the star-field with gravitational-lensing pseudo-code:
   ```ts
   for each star (sx, sy):
     const dx = sx - cx, dy = sy - cy;
     const dist = sqrt(dx*dx + dy*dy);
     const lens = 1 + (bhRadius * bhRadius) / (dist * dist);  // simplified
     const drawX = cx + dx * lens;
     const drawY = cy + dy * lens;
     drawStar(ctx, drawX, drawY, ...);
   ```

2. **Event horizon**: filled black circle, radius = `bhRadius`. Smooth.

3. **Photon ring**: thin glowing ring at `1.5 * bhRadius` (Einstein photon sphere).

4. **Accretion disk**: only if any matter remains (early stage). Use existing logic; smooth gradients, no segmentation.

5. **Black hole shrinks**:
   ```ts
   const initialRadius = 0.6 * Math.min(width, height) * 0.5;  // 30 % of screen
   const finalRadius = 5;                                       // pinpoint
   bhRadius = initialRadius * (1 - progress) + finalRadius * progress;
   ```

6. **Click → Hawking radiation**:
   - Click anywhere outside event horizon: spawn a photon flying *radially outward from BH center* (not from cursor).
   - Photon's color shifts from `whitehot` to `blueshift` as BH shrinks (smaller BH = hotter Hawking radiation).
   - Photon expressively escapes to screen edge.

7. **Final 1 %**: BH evaporates rapidly. Ring of photons emitted; final flash; sprite gone.

### 17.3 Acceptance

- BH shrinks smoothly over 24 hours of stage 15.
- No segmented appearance — gradient smooth.
- Clicks emit photons OUT, not IN.
- Lensing visibly distorts background stars.

---

## 18. Module V3-R — Stage 16 The End

### 18.1 User vision

"점점 까매지면서 클릭한 것만 보여도 괜찮을거 같고. 공간이 점점 넓어지는 것도 표현해줘도 좋을것 같고... 빛의 파장이 점점 길어지는 것을 보여줘도..."

### 18.2 Implementation

Stage 16's `drawHeatDeathCloud` is rewritten:

1. **Background**: starts as faint dim grey; over 33 hours fades to absolute black via:
   ```ts
   const bgAlpha = 1 - progress;  // 1 to 0 over the stage
   ctx.fillStyle = `rgba(${5 + bgAlpha*20}, ${5 + bgAlpha*15}, ${10 + bgAlpha*25}, 1)`;
   ctx.fillRect(0, 0, w, h);
   ```

2. **Universe temperature display**: top-left corner (Timeline area), small label:
   ```ts
   const initialT = 2.7;   // current CMB
   const finalT = 1e-30;   // heat death
   const T = initialT * Math.pow(finalT / initialT, progress);
   // Display: "T = 2.7K" → "T = 1e-30 K"
   ```

3. **Space expansion**: existing motes drift apart gradually. Add to mote tick:
   ```ts
   if (stage.id === 16) {
     mote.x += (mote.x - cx) * 0.0003 * timeMult;
     mote.y += (mote.y - cy) * 0.0003 * timeMult;
   }
   ```
   → motes accelerate away from center (Hubble-like expansion). They eventually leave the screen.

4. **Click visuals (redshift)**:
   - Click spawns a flash of starting color (blue).
   - Within 1 second the flash redshifts: blue → green → orange → red → infrared (invisible).
   ```ts
   const colorStops = ['#aaccff', '#88ee88', '#ffaa00', '#ff4400', '#220000', 'rgba(0,0,0,0)'];
   ```

5. **Audio**: drone almost silent. Only clicks make a soft chime that decays in pitch (acoustic redshift).

6. **Final ending choice**: when threshold reached, the EndingChooser appears (already exists from V1). Now with hidden-condition logic from §V3-V.

### 18.3 Acceptance

- Stage 16 background fades from dim to absolute black over its duration.
- Universe temperature decreases on display (formatted with no decimals: `T = 1e-30K`).
- Click flashes redshift over 1 s.
- Motes drift apart (cosmic expansion).

---

## 19. Module V3-S — Per-Stage Backgrounds

### 19.1 Implementation

Add to each stage's definition:

```ts
{
  // ... existing fields ...
  backgroundGradient: {
    top: '#1a0c0c', bottom: '#000000',
    accentParticles: 0.3,
    starsVisible: true,
  },
}
```

In `ParticleField.tsx`, replace the static background with stage-driven values:

```ts
const grad = ctx.createLinearGradient(0, 0, 0, height);
grad.addColorStop(0, stage.backgroundGradient.top);
grad.addColorStop(1, stage.backgroundGradient.bottom);
ctx.fillStyle = grad;
ctx.fillRect(0, 0, width, height);

if (stage.backgroundGradient.starsVisible) drawStars(ctx, world.stars, ...);
```

### 19.2 Per-stage values

| stage | top | bottom | stars |
|---|---|---|---|
| 1 Inflation | `#ffe4c0` | `#9c4a00` | no |
| 2 Baryogenesis | `#3a0820` | `#0a0816` | sparse |
| 3 QGP | `#a83014` | `#3a0c0c` | no |
| 4 Nucleosynthesis | `#c66425` | `#1a0a06` | yes |
| 5 Recombination | `#6a6a78` | `#080614` | yes (fade in) |
| 6 Dark Age | `#0a0a14` | `#000000` | very sparse |
| 7 First Stars | `#0a0a25` | `#000005` | bright pinpoints |
| 8 Reionization | `#1a0a3a` | `#080816` | bright |
| 9 Galaxy | `#0a0c1a` | `#000005` | yes + structure |
| 10 Solar System | `#1a1208` | `#000000` | yes |
| 11 Life | `#0c1830` | `#000005` | yes (Earth view) |
| 12 Death of Star | `#3a0810` | `#0a0606` | yes |
| 13 Stelliferous End | `#0c0c14` | `#000000` | dim, fading |
| 14 Degenerate Era | `#160a25` | `#000000` | very few, flicker |
| 15 Black Hole Era | `#000000` | `#000000` | distorted by lensing |
| 16 The End | `#0a0a14` (fades to black) | `#000000` | redshift |

### 19.3 Acceptance

- Each stage has visibly different background.
- Stage 15 + 16 are notably darker.

---

## 20. Module V3-T — Aeon Drive Visual Fix

### 20.1 Remove blur

In `ParticleField.tsx` or wherever V2 set CSS `filter: blur(...)` based on time multiplier — DELETE.

### 20.2 Visual feedback for time multiplier

1. **Star streak length scales** with `timeMult`: existing `STAR_STREAK_MULTIPLIER` becomes `STAR_STREAK_MULTIPLIER * timeMult`. Capped at 8.
2. **Cosmic clock counter** spins faster as `timeMult` increases (already happens by definition).
3. **Explicit label**: top-left of HUD, near combo display, show:
   ```
   Time × 4
   ```
   Only visible when `timeMult ≥ 1.5`.
4. **Audio whoosh**: when `timeMult ≥ 5`, trigger `playTimeAccelerationWhoosh(timeMult)` once per real second. Already specced in V2.

### 20.3 Acceptance

- No blur effect at any time multiplier.
- Star streaks visibly longer at higher `timeMult`.
- "Time × N" label visible when applicable.

---

## 21. Module V3-U — Universe Atlas + Cosmic Modifiers

### 21.1 Goal

User: "새로 만들어지는 유니버스가 왜 만드는지 모르겠어." Each new universe must feel different.

### 21.2 Cosmic modifiers per universe

On every PRESTIGE action, generate a `UniverseSeed`:

```ts
export interface UniverseSeed {
  index: number;                       // 1-indexed universe count
  gravityMod: number;                  // 0.8 to 1.2
  timeMod: number;                     // 0.8 to 1.2
  paletteShift: number;                // 0 to 360 (HSL hue shift)
  anomaly: AnomalyType | null;         // 5 % chance per universe
  atlasName: string;                   // generated label
}

export type AnomalyType =
  | 'crystalline'        // sharp angular rendering
  | 'inverted_time'      // cosmic clock visually flows backward
  | 'high_energy'        // particles all move 1.5x faster
  | 'dim'                // overall brightness 0.6x
  | 'echoing'            // every click spawns 2x emission free
  ;
```

Generate on `PRESTIGE`:

```ts
function generateUniverseSeed(prevIndex: number): UniverseSeed {
  const index = prevIndex + 1;
  const gravityMod = 0.8 + Math.random() * 0.4;
  const timeMod = 0.8 + Math.random() * 0.4;
  const paletteShift = Math.floor(Math.random() * 360);
  const anomaly = Math.random() < 0.05 ? randomAnomaly() : null;
  const atlasName = generateName(gravityMod, timeMod, anomaly);
  return { index, gravityMod, timeMod, paletteShift, anomaly, atlasName };
}
```

`generateName`: combines descriptors based on values, e.g., "Universe of Dense Crystal", "Slow Bright Universe", "Echoing Anomaly".

### 21.3 Apply modifiers in-game

- `gravityMod`: scales `TUNING.GRAVITY_BASE`.
- `timeMod`: scales `cosmicTimePerRealSec`.
- `paletteShift`: applied to all stage colors via HSL hue rotation.
- `anomaly`: applied per its type.

### 21.4 Atlas UI

New screen reachable from FinalScreen and IntroScreen: `<MultiverseAtlas />`. Lists all completed universes:

```
UNIVERSE LOG

#1  "First Cosmos"       Heat Death          47:23:18
#2  "Slow Crystal"       Big Crunch          52:11:40   [crystalline]
#3  "Bright Universe"    Heat Death          43:08:55
```

Hovering an entry shows full details (modifiers, ending, time, total clicks).

### 21.5 Acceptance

- After PRESTIGE, new universe has different gravity/time/colors.
- 5 % of new universes have an anomaly modifier.
- Atlas screen shows all past universes.

---

## 22. Module V3-V — Hidden Ending Conditions

### 22.1 Conditions

When the player reaches Stage 16 and completes its threshold, the EndingChooser appears with one or more endings unlocked:

| Ending | Condition (hidden from player) | Hint shown after first achievement |
|---|---|---|
| **Heat Death** | Always available. | (default) |
| **Big Crunch** | In stages 13-16, average click rate ≥ 1/sec (the player rushed). | "The universe collapses for those who push too hard." |
| **Big Rip** | Aeon Drive level 30 AND `inflaton_echo` cross-node owned. | "Speed unmakes structure." |
| **Vacuum Decay** | During stage 14, condense exactly when progress is at 25 %, 50 %, 75 %, or 100 % (with ±0.5 % tolerance). Hidden — player doesn't know this. | "A precision so absolute it punctures reality." |
| **Bounce** | universe count ≥ 5 AND each of (Heat Death, Big Crunch, Big Rip, Vacuum Decay) achieved at least once previously. | "The cosmos remembers." |

### 22.2 Tracking

Add to `PersistentGameState`:

```ts
endingsUnlocked: EndingId[];   // includes those player has unlocked but not yet chosen
endingProgressFlags: {
  bigRipEverEligible: boolean;
  bigCrunchEligible: boolean;
  vacuumDecayEligible: boolean;
  // recomputed at end of each run
};
clickRateLog: number[];        // for big crunch detection: avg clicks/sec in stages 13-16 of last run
condenseProgressHistory: { stageId: number; progressAtCondense: number }[];
```

### 22.3 Acceptance

- Heat Death always shown.
- Other endings only show when their conditions are met.
- After first Bounce, all endings unlocked permanently.

---

## 23. Module V3-W — Almanac & Particle Tooltips

### 23.1 Almanac entries (one per stage)

In `src/game/almanac.ts`:

```ts
export const ALMANAC_ENTRIES: Record<number, { title: string; short: string; body: string; funFact: string }> = {
  1: { title: 'Inflation (인플레이션)',
       short: '우주가 빛보다 빠르게 부풀어 오른 시기',
       body: '빅뱅 직후 10⁻³⁶초쯤, 우주는 1초의 1조분의 1조분의 1초보다 짧은 시간 동안 \
10²⁶배 이상 부풀어 올랐어. 어떤 가설의 입자 (인플라톤)가 이 폭발을 일으켰다고 \
생각해. 그 시기에 우주는 평탄해지고, 같아지고, 가능성으로 가득 찼어.',
       funFact: '인플레이션이 끝나는 데 걸린 시간 동안 빛은 원자 하나의 너비도 못 갔어. \
하지만 우주는 1조 배 더 커졌지.' },
  2: { title: 'Baryogenesis (물질 비대칭)',
       short: '왜 우리가 존재하는지의 이유',
       body: '빅뱅 직후 우주는 같은 양의 물질과 반물질을 만들었어야 해. 둘이 만나면 \
빛이 되어 사라지니까, 우주는 텅 비어야 했어. 하지만 어떤 알 수 없는 이유로 \
물질이 반물질보다 10억 분의 1만큼 더 많이 살아남았어. 너 안의 모든 원자는 \
그 약간의 차이에서 왔어.',
       funFact: '대형강입자충돌기에서 물질-반물질 비대칭의 원인을 찾기 위해 K 중간자, B 중간자를 \
연구하고 있어. 아직도 정확한 답은 모르고 있어.' },
  3: { title: 'Quark-Gluon Plasma (쿼크-글루온 플라스마)',
       short: '아직 양성자가 만들어지기 전 뜨거운 입자 수프',
       body: '빅뱅 1마이크로초 후, 우주는 너무 뜨거워서 쿼크들이 양성자 안에 묶이지 못하고 \
자유롭게 떠다녔어. 글루온이 그 사이를 누비며 강력을 전달했지. \
이 상태를 쿼크-글루온 플라스마라고 해.',
       funFact: '지금도 입자가속기에서 잠깐 동안 이 상태를 만들어볼 수 있어. \
그 온도는 태양 중심부의 25만 배.' },
  // ... entries for stages 4-16
};
```

Each entry's `body` and `funFact` written at middle-school comprehension level.

### 23.2 In-game display

Add an "i" icon to the Timeline. Click → opens almanac modal showing current stage's entry.

When stage transitions, briefly show the `short` description as a toast (3 s) at the top of the screen.

### 23.3 Particle tooltips

`PARTICLE_DEFINITIONS` from §V3-J §10.4 — show on long-press / hover of particle name.

### 23.4 Acceptance

- Each of 16 stages has full almanac entry.
- Particle name hover shows definition.
- Toast on stage transition.

---

## 24. Module V3-X — Skill Panel Polish

### 24.1 Skill button glow

Already specced in §V3-G §7.4. Verify implementation: button glows when any next-buy is affordable.

### 24.2 Number-below removal

Remove the SP count display below the button (since SP is gone). Just an icon.

### 24.3 Acceptance

- Button is icon-only.
- Glows on affordable.

---

## 25. Module V3-Y — Tutorial Popups

### 25.1 Triggers

On first entry to stages 2/3/4/5 (in universe 1 only):
- Stage 2: "Stellar Forge unlocked. Buy levels of click power."
- Stage 3: "Quantum Lens unlocked. Critical hits multiply rewards."
- Stage 4: "Cosmic Web unlocked. The universe gathers itself."
- Stage 5: "Aeon Drive unlocked. Time itself can be sped up."

On first entry to stages 7/11/14/15:
- Stage 7: "Cross-skill nodes are now visible. Some require two skills together."
- Stage 11: "Higher-tier cross-skills unlock at level 20 in two tracks."
- Stage 14: "Late-game cross-skills are extremely powerful."
- Stage 15: "The Apex node requires all four tracks at level 30."

### 25.2 Popup design

Centered modal, semi-transparent backdrop. Two buttons: `[Open Skills]`, `[Dismiss]`. ESC dismisses.

After dismissal, set `state.tutorialFlags[stageId] = true` so it doesn't re-fire.

### 25.3 Acceptance

- Each of 8 trigger stages fires popup exactly once per fresh save.
- Subsequent universes don't re-fire (or do, depending on a setting — default off).

---

## 26. Module V3-Z — Save Migration v3 → v4

### 26.1 Schema bump

Bump version to 4. Add fields:

```ts
export interface SaveStateV4 {
  version: 4;
  // ... v3 fields ...
  skills: SkillState;            // v3 shape replaced — see §V3-F
  endingsUnlocked: EndingId[];
  endingProgressFlags: { ... };
  universeAtlas: UniverseSeed[]; // history of completed universes
  currentUniverseSeed: UniverseSeed | null;
  tutorialFlags: Record<number, boolean>;
}
```

### 26.2 Migration

```ts
function migrateV3ToV4(v3: SaveStateV3): SaveStateV4 {
  return {
    ...v3,
    version: 4,
    skills: {
      click: { level: 0 },
      auto:  { level: 0 },
      crit:  { level: 0 },
      time:  { level: 0 },
      unlockedTracks: [],
      ownedCrossNodes: [],
    },
    endingsUnlocked: ['heat_death'],
    endingProgressFlags: { bigRipEverEligible: false, bigCrunchEligible: false, vacuumDecayEligible: false },
    universeAtlas: [],
    currentUniverseSeed: null,
    tutorialFlags: {},
  };
}
```

V3's `skillPoints` field is dropped; V3's per-tree `ownedNodes` is discarded.

### 26.3 Acceptance

- A v3 save loads cleanly into v4 with skills reset to 0.
- v4 round-trip is identity.

---

## 27. Implementation Order

| Phase | Module | Hours |
|---|---|---|
| 1 | V3-A (number formatting) | 2 |
| 2 | V3-B (pacing table) | 4 |
| 3 | V3-C (carry-over) | 2 |
| 4 | V3-D (free condense + dark age skip removal) | 1 |
| 5 | V3-E (encounter cap) | 1 |
| 6 | V3-F (skill data layer) | 16 |
| 7 | V3-G (skill panel UI) | 12 |
| 8 | V3-H (stage-gated unlock) | 4 |
| 9 | V3-I (click visual scaling) | 4 |
| 10 | V3-J (particle name labels + definitions) | 4 |
| 11 | V3-K (encounter distance) | 2 |
| 12 | V3-L (mass cap by progress) | 1 |
| 13 | V3-M (Stage 7 First Stars) | 8 |
| 14 | V3-N (Stage 10 Solar System) | 12 |
| 15 | V3-O (Stage 11 Life sub-arc) | 8 |
| 16 | V3-P (Stage 12 Death of Star) | 8 |
| 17 | V3-Q (Stage 15 Black Hole) | 12 |
| 18 | V3-R (Stage 16 The End) | 8 |
| 19 | V3-S (per-stage backgrounds) | 4 |
| 20 | V3-T (Aeon Drive visual fix) | 2 |
| 21 | V3-U (Universe Atlas + modifiers) | 8 |
| 22 | V3-V (hidden ending conditions) | 4 |
| 23 | V3-W (almanac + particle tooltips) | 8 |
| 24 | V3-X (skill panel polish) | 1 |
| 25 | V3-Y (tutorial popups) | 4 |
| 26 | V3-Z (save migration v3→v4) | 4 |
| 27 | Balance pass — `npm run sim` until total in [80, 130] h | 8 |
| **Total** | | **~152 hours = ~19 days of focused work** |

---

## 28. Definition of Done

After all modules:

1. `npm run build` passes with zero TypeScript errors.
2. `npm test` passes; coverage on `formulas.ts`, `skills/effects.ts`, `reducer.ts`, `storage.ts`, `mechanics/*` is high.
3. `npm run sim` reports total game time in [80, 130] hours and each stage within ±30 % of target.
4. Manual playthrough on a fresh save:
   - Stage 1 has no skills UI.
   - Stage 2 entry triggers Stellar Forge tutorial popup.
   - Without buying any skill, the player cannot pass stage 2.
   - At Stellar Forge level 5, click visibly emits 2 motes.
   - Stage 7 motes look like H₂ → contracting protostar → blackbody-colored star.
   - Stage 10 transitions through asteroid → lava → moon → cooling → water → continents → plants → life → cities → meteor reset → Mars-like.
   - Stage 11 ends in a 1-second Civilization Flicker.
   - Stage 12 visually consumes 9 planets in correct order.
   - Stage 15 black hole shrinks smoothly; clicks emit photons outward.
   - Stage 16 background fades to absolute black; clicks show redshifting flashes.
   - Aeon Drive level 5 shows "Time × 1.30" label and longer star streaks (no blur).
   - Skills panel shows single connected tree with 4 vertical tracks; locked tracks visually identifiable.
5. After completing universe 1:
   - Universe Atlas shows entry #1.
   - Universe 2 has different gravity/time/palette.
   - 5 % chance of anomaly modifier.
6. Hidden endings:
   - Heat Death always available.
   - Big Crunch / Big Rip / Vacuum Decay / Bounce only show when their conditions are met.

---

## 29. Quality Bar

- **No decimals** in any visible number (use `formatWhole` everywhere).
- **No blur effects** anywhere.
- **English code/comments**; UI text can be Korean for almanac.
- **Pure reducer** — no DOM/audio inside reducer.
- **No new top-level dependencies**.
- **All new files include type definitions, not just inline types**.

---

End of V3 specification.
