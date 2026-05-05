# Cosmic Coalescence — Refactor V4 Specification

> **Audience**: Autonomous coding agent with full repo access.
> **Mode**: Plan-then-execute. After each module, run `npm run build` and `npm test`.
> **Status**: Builds on V1, V2, V3. **V4 supersedes parts of V3** — see §0.1.

V4 incorporates user feedback after V3 was implemented. Major changes:

1. **Skill Points (SP) reintroduced** — V3 removed SP entirely; V4 brings SP back with a redefined role: **SP unlocks cross-nodes** (and only cross-nodes). Track levels stay quanta-only.
2. **Time gauge mechanic** — A second mandatory progress meter alongside quanta. Fills passively in real time, accelerated by Aeon Drive level. Both gauges (quanta AND time) must be full to condense.
3. **Skill tree visual rework** — Levels render bottom-up (Lv 1 at bottom, Lv 30 at top). Connecting lines between cross-nodes and tracks. Symbol-icon nodes; click-to-detail card with embedded buy button. No more long inline text.
4. **Tracks always visible, no stage-gating** — V3 gated tracks by stage (Stellar Forge at stage 2, etc.). V4 removes this: all 4 tracks are always visible. Internal prerequisites (e.g., "Quantum Lens needs Stellar Forge L5") gate skill order. Stages 2/3/4/5 only trigger *tutorial popups*, not unlocks.
5. **Tutorial as floating speech bubble** — Replaces V3's modal popup. Bubble points at the Skills button with a tail; small dismiss-only.
6. **Cosmic Shop** — New panel above Skills. 3 items: Time Boost, Cosmic Surge, Skill Pack. Display USD price; clicking auto-applies effect for free (test mode). Track total fake-spent.
7. **Particle Affinity inside Quantum Lens** — Encounter bonus multipliers now live on Quantum Lens milestones (Lv 10 +50 %, Lv 20 +100 %, Lv 30 +200 %). No 5th track.
8. **Quanta persists across stages always** — Already partially specced in V3-C; V4 makes it strict and verifies it. Skill levels also persist.
9. **Encounter cap reduced** — V3 said 5 % of threshold; V4 says 2 % (tighter; user feedback "너무 점수가 크다").
10. **Solar System (Stage 10) redesign — 9 phases** — V3-N was 11 phases. V4-L is a cleaner 9-phase progression with better visual focus.
11. **Time accuracy notes in Almanac** — Stage 14 proton decay timeline depends on GUT model; flag uncertainty.
12. **UI bug fixes** — IntroScreen text overlap; canvas-wide text-selection disabled.

Implementation order: V4-A → V4-N (see §16). Each module is independently testable.

---

## 0. V4 Supersedes V3 — Reconciliation

### 0.1 Direct conflicts

| Topic | V3 said | V4 says | Action |
|---|---|---|---|
| Skill Points | Removed; quanta-only | Reintroduced for cross-node unlocks | Restore `skillPoints` field; restore `AWARD_SKILL_POINTS` reducer |
| Track unlock | Stage-gated (stage 2 unlocks Stellar Forge, etc.) | Always visible; internal prereqs gate skill order | Remove `unlockedTracks` checks; replace with track prereq logic |
| Stage tutorial | Modal popup (V3-Y) | Floating speech bubble pointing at Skills button | Replace modal with bubble component |
| Encounter cap | 5 % of threshold | 2 % of threshold (Many Worlds raises to 5 %) | Adjust formula |
| Condense criterion | Just quanta ≥ threshold | Quanta ≥ threshold AND time gauge full | Add `timeGauge` to state; gate condense on both |
| Particle Affinity | Was implicit in encounter logic | Tied to Quantum Lens milestones | Add milestone effects |

### 0.2 V3 features V4 keeps

- 16 stages with V3 pacing table.
- 16 unique clusterModes.
- Per-stage backgrounds.
- Per-stage particle name labels on click.
- Universe Atlas + cosmic modifiers.
- Hidden ending conditions.
- Almanac infrastructure.
- Number formatting (no decimals).
- Quanta carry-over on ADVANCE_STAGE.
- Aeon Drive visual fix (no blur).
- Save migration v3→v4.
- Stage 7 First Stars H₂→blackbody visual.
- Stage 11 Life sub-arc + Civilization Flicker.
- Stage 12 Death of Star (9 planet swallow).
- Stage 15 Black Hole shrinking simulation.
- Stage 16 The End redshift.

---

## 1. Module V4-A — SP System Reintroduction

### 1.1 Roles

| Currency | Used for | Earned via |
|---|---|---|
| **Quanta** | Track level-ups (1→30) | Click + auto |
| **Skill Points (SP)** | Cross-node unlocks (Lv 15/20/25/Apex) | Stage clear, encounters, prestige |
| **Condensed Mass** | Singularity Tree (existing) | Universe completion |

### 1.2 Awarding SP

Restore the V2 `AWARD_SKILL_POINTS` reducer. Hook into:

| Trigger | Amount |
|---|---|
| `ADVANCE_STAGE` | +1 SP |
| `REPORT_COLLISION` (tier=major) | +1 SP |
| `REPORT_COLLISION` (tier=massive) | +3 SP |
| `PRESTIGE` | +5 SP |

Per-universe expected SP:
- 15 stage advances × 1 = 15
- ~20 encounters × avg 1.5 = 30 (but most are minor → ~10 effective)
- 1 prestige × 5 = 5
- **Total ≈ 20–30 SP per universe**

### 1.3 Cross-node SP cost

```ts
const CROSS_NODE_COSTS: Record<string, { sp: number; quanta: number }> = {
  // Lv 15 cross — 1 SP, ~50K quanta
  echoing_click:   { sp: 1, quanta: 50_000 },
  wave_capture:    { sp: 1, quanta: 50_000 },
  inflaton_echo:   { sp: 1, quanta: 50_000 },

  // Lv 20 cross — 3 SP, ~5M quanta
  pair_production: { sp: 3, quanta: 5_000_000 },
  heisenberg:      { sp: 3, quanta: 5_000_000 },
  dilation:        { sp: 3, quanta: 5_000_000 },
  filament:        { sp: 3, quanta: 5_000_000 },

  // Lv 25 cross — 8 SP, ~500M quanta
  big_bang_click:  { sp: 8, quanta: 500_000_000 },
  web_of_all:      { sp: 8, quanta: 500_000_000 },
  eternal_return:  { sp: 8, quanta: 500_000_000 },

  // Apex — 25 SP, 1T quanta
  cosmos_primal:   { sp: 25, quanta: 1_000_000_000_000 },
};
```

Sum of all cross-node SP cost: 3 + 12 + 24 + 25 = **64 SP**.
At 20 SP per universe → **3–4 universes** to fully unlock the tree. Matches the design intent of multi-universe progression.

### 1.4 BUY_CROSS_NODE reducer

```ts
case 'BUY_CROSS_NODE': {
  const def = findCrossNodeDef(action.nodeId);
  if (!def) return state;
  if (state.skills.ownedCrossNodes.includes(action.nodeId)) return state;

  // Check track-level prereqs
  const reqs = def.requires;
  for (const [trackId, requiredLvl] of Object.entries(reqs)) {
    if (state.skills[trackId as TrackId].level < requiredLvl) return state;
  }

  const cost = CROSS_NODE_COSTS[action.nodeId];
  if (state.quanta < cost.quanta || state.skillPoints < cost.sp) return state;

  return {
    ...state,
    quanta: state.quanta - cost.quanta,
    skillPoints: state.skillPoints - cost.sp,
    skills: {
      ...state.skills,
      ownedCrossNodes: [...state.skills.ownedCrossNodes, action.nodeId],
    },
  };
}
```

### 1.5 SP introduced at stage 5

Stage 5 entry triggers:
- Aeon Drive becomes "available to buy" (its prereq is met by the implicit "you've reached stage 5").
- Tutorial speech bubble: "You earned **5 SP** so far. Use them to unlock cross-nodes when you reach milestone levels."

Display SP count in the Resource Panel header (small badge: `SP 5`).

### 1.6 Acceptance for V4-A

- Reducer test: stage advance increments SP by 1.
- Reducer test: BUY_CROSS_NODE consumes both SP and quanta.
- BUY_CROSS_NODE rejects if SP insufficient even when quanta is plenty.
- After 1 universe completion, SP balance = ~20.

---

## 2. Module V4-B — Skill Tree Visual Rework (Bottom-Up)

### 2.1 Layout principle

V3's tree drew Lv 1 at top of each track. Awkward for clicking — players had to reach up to small upper cells.

V4: tracks grow **bottom to top**, like plants:
- Lv 1 cell at the bottom (large hit target, ≥ 44 px tall)
- Lv 30 cell at the top
- Cross-nodes between tracks appear as horizontal connectors at appropriate heights

### 2.2 SVG layout (per track)

```
       Lv 30 ◇  ← Apex slot (★)
       Lv 29 ○
       Lv 28 ○
       ...
       Lv 25 ◇  ← milestone
       ...
       Lv 20 ◇  ← milestone (★)
       ...
       Lv 15 ◇  ← milestone (★)
       ...
       Lv 10 ◇  ← milestone (★)
       ...
       Lv 5  ◇  ← milestone (★)
       ...
       Lv 1  ◯  ← buyable next slot (glow)
       ─────────
       (track label + Lv badge)
```

Click hit area for the next-buyable slot: full cell width, 44 px tall on mobile.

### 2.3 Connecting lines

Cross-nodes draw as small icon nodes positioned horizontally between tracks at their tier height. Example for Echoing Click (requires Stellar Forge L15 + Aeon Drive L10):

```
   Stellar Forge       Aeon Drive
      │                    │
      Lv 15 ─◯ Echoing ◯─ Lv 10
      │                    │
```

Connecting lines from cross-node to its prerequisite track cells. Lines are dim if prereqs unmet, bright (accent color) if prereqs met.

### 2.4 Click target and feedback

- **Track cell, current next-buy**: glowing border + pulse animation. Click to open detail card on the right.
- **Track cell, future**: dim. Click does nothing visible (could open detail card showing locked state).
- **Track cell, owned**: filled accent color, no pulse.
- **Cross-node, locked**: gray with padlock icon. Click opens detail showing prereq requirements.
- **Cross-node, available**: glowing accent border. Click opens detail.
- **Cross-node, owned**: filled accent, ★ icon.

### 2.5 Acceptance

- Lv 1 cell is at the bottom of each track column.
- Tracks line up horizontally so cross-nodes draw cleanly between them.
- Connecting lines visually communicate prerequisites.
- All clickable cells are ≥ 44 px tall.

---

## 3. Module V4-C — Symbol Tooltip + Detail Card

### 3.1 Each node = single icon + lv label

In the tree, render:
- Track cell: small symbol (☆ for milestones, ○ for normal levels) + Lv number
- Cross-node: themed icon (e.g., 🔥 for Big Bang Click, ⏱ for time-related nodes)

No long descriptions in the tree itself.

### 3.2 Hover preview

Hover/long-press shows a tooltip:
```
Quark Bond ★
Lv 5 milestone
Click emits 2 motes
Cost: 540 quanta
```

### 3.3 Click → detail card

Clicking opens a detail card on the right side of the panel (or below on mobile):

```
┌──────────────────────────────────┐
│ 🔥 Quark Bond                    │
│ Stellar Forge — Lv 5 milestone   │
│                                   │
│ Each click emits 2 motes instead │
│ of 1. Doubles visual emission.   │
│                                   │
│ Active when: Stellar Forge ≥ 5   │
│ Currently: NO (you are at Lv 4)  │
│                                   │
│ ─────────────                    │
│                                   │
│ Buy Stellar Forge Lv 4 → 5       │
│ Cost: 540 quanta                  │
│ After buy:                       │
│   Click power: 6 → 10            │
│   Emissions:   1 → 2  (★!)       │
│                                   │
│   [BUY +1 LEVEL]                  │
└──────────────────────────────────┘
```

If a cross-node selected:
```
┌──────────────────────────────────┐
│ ⚡ Echoing Click                 │
│ Lv 15 cross-node                 │
│                                   │
│ Each click has an 18 % chance to │
│ fire twice automatically.        │
│                                   │
│ Requires:                         │
│   Stellar Forge Lv 15  (✓ 16)    │
│   Aeon Drive Lv 10     (✗ 7)     │
│                                   │
│ Cost: 1 SP + 50,000 quanta       │
│                                   │
│   [LOCKED — Aeon Drive Lv 10]     │
└──────────────────────────────────┘
```

The buy button always lives at the bottom of the card. If unaffordable, show *exactly why* (insufficient quanta / SP / level).

### 3.4 Acceptance

- Tree itself has no long text — only icons and Lv numbers.
- Hover shows compact 4-line tooltip.
- Click opens detail card with everything needed to make the decision.
- Buy button in detail card is the only place to actually purchase.

---

## 4. Module V4-D — Stage Tutorial Speech Bubbles

### 4.1 Replacing V3 modals

V3 used centered modal popups. V4 uses **floating speech bubbles** anchored to UI elements they reference.

### 4.2 Bubble component

```tsx
// components/SpeechBubble.tsx
interface SpeechBubbleProps {
  anchorRef: React.RefObject<HTMLElement>;
  position: 'top' | 'bottom' | 'left' | 'right';
  message: string;
  ctaLabel?: string;        // optional button label
  onCta?: () => void;
  onDismiss: () => void;
}
```

Renders as an absolutely-positioned bubble with a CSS arrow pointing to the anchor element. Auto-positions if anchor is near screen edge.

```css
.speech-bubble {
  position: fixed;
  background: var(--accent);
  color: var(--bg-deep);
  padding: 12px 16px;
  border-radius: 12px;
  max-width: 260px;
  font-size: 14px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.3);
  z-index: 50;
}
.speech-bubble .arrow { /* CSS triangle pointing at anchor */ }
.speech-bubble .dismiss { /* small x icon */ }
```

### 4.3 Tutorial sequence (universe 1 only)

| Trigger | Anchor | Message | CTA |
|---|---|---|---|
| Stage 2 entry | Skills button | "New skill: **Stellar Forge**. Stronger clicks. Tap to upgrade." | Open Skills |
| Stage 3 entry | Skills button | "New: **Quantum Lens**. Critical hits multiply rewards." | Open Skills |
| Stage 4 entry | Skills button | "New: **Cosmic Web**. The universe gathers itself." | Open Skills |
| Stage 5 entry | Skills button + SP badge | "**Aeon Drive** unlocked. You have 5 SP — spend on cross-nodes." | Open Skills |
| First time SP > 0 + cross-node available | The cross-node | "This cross-node is buyable. 1 SP + 50K quanta." | (none) |
| First condense ready | Condense button | "Both gauges full. Press to advance." | (none) |
| Time gauge first visible (stage 5+) | Time gauge | "Cosmic time accumulates. Aeon Drive levels speed it up." | (none) |
| First Shop affordance (stage 5+) | Shop button | "Cosmic Shop has temporary boosts. Free in test mode." | Open Shop |

Each bubble dismissed via X or by clicking the CTA. Set `tutorialFlags[bubbleId] = true` to prevent re-fire.

### 4.4 No tutorial on prestige

If `state.universeCount > 1`, no tutorial bubbles fire. The player has played before; they know.

### 4.5 Acceptance

- Stage 2 first-time entry → bubble appears next to Skills button.
- After dismissing, never appears again in this save.
- Universe 2 onwards: no tutorial bubbles.

---

## 5. Module V4-E — Time Gauge Mechanic (Core Change)

### 5.1 The new progression model

Each stage now has TWO completion criteria that must both be met:
1. `quanta >= threshold` (existing)
2. `timeGauge >= timeBudget` (NEW)

### 5.2 Time budget per stage

```ts
// Equal to realPlayTargetSec from V3-B; renaming for clarity.
function getTimeBudget(stage: Stage): number {
  return stage.realPlayTargetSec;
}
// Stage 1: 60, Stage 16: 117480
```

### 5.3 Time fill rate

```ts
// formulas.ts
export function getTimeFillRate(timeLevel: number, mods: Modifiers): number {
  // Base 1.0 unit per real second; exponentially scales with Aeon Drive level.
  return 1.0 * Math.pow(1.10, timeLevel) * mods.apexMult;
}
```

| Aeon Drive Lv | Fill rate | Stage 1 (60) | Stage 5 (540) | Stage 10 (10800) | Stage 16 (117480) |
|---:|---:|---:|---:|---:|---:|
| 0 | 1.00 | 60s | 540s | 3h | 32.6h |
| 5 | 1.61 | 37s | 335s | 1.9h | 20.3h |
| 10 | 2.59 | 23s | 209s | 1.2h | 12.6h |
| 15 | 4.18 | 14s | 129s | 43min | 7.8h |
| 20 | 6.73 | 9s | 80s | 27min | 4.8h |
| 25 | 10.83 | 6s | 50s | 17min | 3.0h |
| 30 | 17.45 | 3s | 31s | 10min | 1.9h |

Without Aeon Drive investment, late stages take days. With investment, late stages take hours. This forces meaningful time-skill investment.

### 5.4 State

Add to game state:

```ts
// types.ts (PersistentGameState)
timeGauge: number;        // current accumulated time for this stage
```

Reset to 0 in `ADVANCE_STAGE`. Persist across saves.

### 5.5 Tick loop

In `reducer.ts` TICK case:

```ts
case 'TICK': {
  const stage = STAGES[state.stageIdx];
  const budget = getTimeBudget(stage);
  const mods = computeModifiers(state.skills, ctx);
  const fillRate = getTimeFillRate(state.skills.time.level, mods);

  const newTimeGauge = Math.min(budget, state.timeGauge + (fillRate * action.dt) / 1000);

  // existing TICK logic for quanta...
  return {
    ...state,
    timeGauge: newTimeGauge,
    quanta: state.quanta + gainedQuanta,
    // ...
  };
}
```

### 5.6 Acceptance

- Time gauge increments per tick at correct rate.
- Stage 1 with Aeon 0: gauge fills in ~60 s.
- Stage 5 with Aeon 5: gauge fills in ~5 min.
- Save/load preserves timeGauge for current stage.

---

## 6. Module V4-F — Two-Criteria Condense

### 6.1 Resource Panel UI

Two stacked progress bars instead of one:

```
┌───────────────────────────────────────┐
│ NUCLEI                       +5/s     │
│ 8,400 / 12,000                         │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░  70%             │
│                                        │
│ COSMIC TIME                            │
│ 240 / 360 s                            │
│ ▓▓▓▓▓▓▓▓▓▓▒▒▒░░░░░░░  67%             │
└───────────────────────────────────────┘
```

When only one is full, show a hint:
- Quanta full, time not: "Wait for cosmic time"
- Time full, quanta not: "Gather more quanta"
- Both full: `[ → CONDENSE ← ]` button glows, becomes clickable

### 6.2 Condense gate

```ts
// formulas.ts
export function canCondense(state: GameState, mods: Modifiers): boolean {
  if (state.completedRun || state.pendingCondenseStageIdx !== null || state.imploding) return false;
  const stage = STAGES[state.stageIdx];
  const threshold = getEffectiveThreshold(stage, /* ... */);
  const budget = getTimeBudget(stage);
  return state.quanta >= threshold && state.timeGauge >= budget;
}
```

Replace existing `canCondense` derivation in `GameScreen.tsx`.

### 6.3 Acceptance

- Quanta full, time partial → condense button disabled, hint visible.
- Both full → condense glows.
- Test: stage 1 with Aeon 0, click 60 times → quanta full at ~12 s but time not yet → must wait.

---

## 7. Module V4-G — Cosmic Shop

### 7.1 Three items

```ts
// src/game/shop/items.ts
export interface ShopItem {
  id: string;
  label: string;
  description: string;
  priceUSD: number;
  applyEffect(state: GameState): GameState;
}

export const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'time_boost',
    label: 'Quick Time Boost',
    description: 'Time × 2 for 10 minutes.',
    priceUSD: 0.99,
    applyEffect: (s) => ({
      ...s,
      shopBoosts: {
        ...s.shopBoosts,
        timeMult: { factor: 2, expiresAt: Date.now() + 10 * 60_000 },
      },
    }),
  },
  {
    id: 'cosmic_surge',
    label: 'Cosmic Surge',
    description: 'Quanta × 3 for 30 minutes.',
    priceUSD: 2.99,
    applyEffect: (s) => ({
      ...s,
      shopBoosts: {
        ...s.shopBoosts,
        quantaMult: { factor: 3, expiresAt: Date.now() + 30 * 60_000 },
      },
    }),
  },
  {
    id: 'skill_pack_s',
    label: 'Skill Pack S',
    description: '+10 Skill Points immediately.',
    priceUSD: 1.99,
    applyEffect: (s) => ({
      ...s,
      skillPoints: s.skillPoints + 10,
    }),
  },
];
```

### 7.2 State

```ts
// PersistentGameState additions
shopBoosts: {
  timeMult?: { factor: number; expiresAt: number };  // epoch ms
  quantaMult?: { factor: number; expiresAt: number };
};
totalShopSpentUSD: number;          // running total of fake-spent dollars
```

### 7.3 Apply boosts

In `getTimeFillRate` and click/auto reward calculations, apply active boosts:

```ts
function getActiveBoostMultiplier(boost: { factor: number; expiresAt: number } | undefined): number {
  if (!boost) return 1;
  if (Date.now() >= boost.expiresAt) return 1;
  return boost.factor;
}

// In time fill:
fillRate *= getActiveBoostMultiplier(state.shopBoosts.timeMult);

// In quanta gain:
gainedQuanta *= getActiveBoostMultiplier(state.shopBoosts.quantaMult);
```

### 7.4 Shop UI

New component `<ShopPanel>` reachable from a button next to Skills (above it actually):

```
┌──────────────────────────────────────┐
│ COSMIC SHOP                  [✕]     │
├──────────────────────────────────────┤
│  ┌──────────────────────────────┐    │
│  │ ⏱  Quick Time Boost           │    │
│  │    Time × 2 for 10 minutes    │    │
│  │    $0.99           [BUY]      │    │
│  └──────────────────────────────┘    │
│  ┌──────────────────────────────┐    │
│  │ ✨  Cosmic Surge               │    │
│  │    Quanta × 3 for 30 minutes  │    │
│  │    $2.99           [BUY]      │    │
│  └──────────────────────────────┘    │
│  ┌──────────────────────────────┐    │
│  │ 🎯  Skill Pack S               │    │
│  │    +10 Skill Points instantly │    │
│  │    $1.99           [BUY]      │    │
│  └──────────────────────────────┘    │
├──────────────────────────────────────┤
│  Active boosts:                       │
│   ⏱ Time × 2 — 4:32 remaining         │
├──────────────────────────────────────┤
│  Total spent: $4.97 (test mode)      │
└──────────────────────────────────────┘
```

`[BUY]` click immediately calls `applyEffect` and `totalShopSpentUSD += price`. No real payment integration.

### 7.5 Reducer action

```ts
| { type: 'BUY_SHOP_ITEM'; itemId: string }

case 'BUY_SHOP_ITEM': {
  const item = SHOP_ITEMS.find((i) => i.id === action.itemId);
  if (!item) return state;
  const next = item.applyEffect(state);
  return {
    ...next,
    totalShopSpentUSD: state.totalShopSpentUSD + item.priceUSD,
  };
}
```

### 7.6 Acceptance

- Shop opens on icon click; closes on ✕.
- Buying an item applies effect immediately.
- Active boost timer counts down in panel.
- `totalShopSpentUSD` persists across saves.

---

## 8. Module V4-H — Particle Affinity inside Quantum Lens

### 8.1 Goal

V3 mentioned encounter bonus multipliers as a possible 5th track. V4 instead bakes them into Quantum Lens milestones for simplicity.

### 8.2 Effect

```ts
// In computeModifiers — extend Quantum Lens milestones
if (skills.crit.level >= 10) m.encounterBonusMult *= 1.5;   // +50 %
if (skills.crit.level >= 20) m.encounterBonusMult *= 1.5;   // total ×2.25
if (skills.crit.level >= 30) m.encounterBonusMult *= 1.5;   // total ×3.375
```

Milestone descriptions update:
- Lv 10 "Heisenberg Lens": now also "+50 % encounter bonus".
- Lv 20 "Quantum Lens": "+50 % more encounter bonus" (cumulative ×2.25).
- Lv 30 "Eigenvalue Strike": "+50 % more encounter bonus" (cumulative ×3.375).

### 8.3 Acceptance

- At crit Lv 10, encounter bonus visibly increases by 50 %.
- Cap at Lv 30 with cosmos_primal: ×3.375 × ×10 (apex) = ×33.75.

---

## 9. Module V4-I — Quanta Carry-Over Verification

### 9.1 Confirm V3-C is implemented correctly

Per V3-C, ADVANCE_STAGE should preserve `excess = quanta - threshold` into the next stage. Verify this in code; if missing, restore.

### 9.2 Reset timeGauge on advance

```ts
case 'ADVANCE_STAGE': {
  // ... existing logic ...
  return {
    ...state,
    stageIdx: state.stageIdx + 1,
    quanta: Math.max(0, state.quanta - currentStage.threshold),
    timeGauge: 0,             // RESET
    combo: 0,
    lastClick: 0,
    pendingCondenseStageIdx: null,
    pendingCondenseEntropy: 0,
    imploding: false,
    condenseStartedAt: null,
    skillPoints: state.skillPoints + 1,    // V4-A reward
  };
}
```

Skill levels are NOT reset (already V3 design).

### 9.3 Acceptance

- After advance: quanta = excess, timeGauge = 0, skill levels unchanged, SP += 1.

---

## 10. Module V4-J — Encounter Bonus Reduction

### 10.1 New cap

```ts
function calculateEncounterBonus(stage: Stage, tier: RogueTypeKey, mods: Modifiers): number {
  const baseBonus = ROGUE_TYPES[tier].bonusMultiplier * stage.threshold * 0.005;
  const cap = stage.threshold * (mods.manyWorldsCapMult > 1 ? 0.05 : 0.02);
  return Math.min(baseBonus * mods.encounterBonusMult, cap);
}
```

- Default cap: 2 % of threshold (was 5 %).
- With Many Worlds cross-node: cap raised to 5 %.

### 10.2 Acceptance

- Massive encounter on stage 10 (threshold 5e9) → bonus ≤ 1e8.
- With Many Worlds → bonus ≤ 2.5e8.

---

## 11. Module V4-K — UI Bug Fixes

### 11.1 IntroScreen text overlap

In `IntroScreen.tsx`, locate the "Let there be light" headline and any background countdown text. Fix:

```tsx
<div className="intro-headline" style={{ position: 'relative', zIndex: 10 }}>
  Let there be light
</div>
<div className="intro-bg-text" style={{ position: 'absolute', zIndex: 1, pointerEvents: 'none' }}>
  ...
</div>
```

Verify in browser at 1920×1080, 1280×720, and mobile portrait that text doesn't overlap.

### 11.2 Disable text-selection across game UI

Add to `index.css`:

```css
.app-shell, .field, .timeline, .panel, .skills-panel, .shop-panel,
.float-text, .stage-info, .stage-hint, .encounter-alert, .speech-bubble,
.quote-overlay, .final-card, canvas {
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
}

/* Allow selection in text-heavy modal content if needed */
.almanac-body, .ending-card-body {
  user-select: text;
}
```

### 11.3 Acceptance

- IntroScreen: "Let there be light" not overlapping.
- Clicking and dragging in canvas does not select any text.
- Long-pressing on a particle-name label does not trigger iOS selection menu.

---

## 12. Module V4-L — Solar System (Stage 10) Redesign V2

### 12.1 Replace V3-N's 11 phases with V4's 9 phases

V4 phases focus on stage 10 as **birth-and-stabilization** of the solar system. Earth's biological/civilizational evolution belongs to stage 11.

| progress | phase | visual focus |
|---|---|---|
| 0–10 % | Pre-stellar nebula | Spinning dust + gas. Central protostar forming. Particle pool: "Dust", "Gas", "Hydrogen". |
| 10–25 % | T-Tauri Sun ignites | Central nuclear fusion starts. Solar wind blast pushes nearby dust outward. Pool: "Photon", "Solar Wind". |
| 25–40 % | Planetesimals form | Dust aggregates into rocky bodies. Many small collisions. Pool: "Planetesimal", "Asteroid". |
| 40–55 % | Inner planets | Mercury, Venus, Earth, Mars become visible. Pool: "Mercury", "Venus", "Earth", "Mars". |
| 55–70 % | Outer planets | Jupiter (large), Saturn (rings), Uranus, Neptune. Pool: "Jupiter", "Saturn", "Uranus", "Neptune". |
| 70–80 % | Late Heavy Bombardment | Meteor wave reddens Earth's surface. Pool: "Meteor", "Comet", "Lava". |
| 80–90 % | Stable solar system | All 9 bodies orbit calmly. Pool: "Orbit", "Asteroid Belt". |
| 90–95 % | First water on Earth | Earth zoom-in; oceans form. Pool: "Water", "Atmosphere". |
| 95–100 % | Civilization preview | Distant night-side city lights flicker briefly (foreshadows stage 11). Pool: "Light", "City". |

### 12.2 Implementation

Replace `drawSolarSystem` to dispatch by phase:

```ts
function drawSolarSystem(args): void {
  const phase = getSolarPhase(args.progress);
  switch (phase) {
    case 'pre_stellar':       drawPreStellarNebula(args); break;
    case 't_tauri':           drawTTauriIgnition(args); break;
    case 'planetesimals':     drawPlanetesimalCollisions(args); break;
    case 'inner_planets':     drawInnerPlanets(args); break;
    case 'outer_planets':     drawOuterPlanets(args); break;
    case 'late_bombardment':  drawLateBombardment(args); break;
    case 'stable':            drawStableSystem(args); break;
    case 'first_water':       drawFirstWater(args); break;
    case 'civ_preview':       drawCivPreview(args); break;
  }
}

function getSolarPhase(p: number): SolarPhase {
  if (p < 0.10) return 'pre_stellar';
  if (p < 0.25) return 't_tauri';
  if (p < 0.40) return 'planetesimals';
  if (p < 0.55) return 'inner_planets';
  if (p < 0.70) return 'outer_planets';
  if (p < 0.80) return 'late_bombardment';
  if (p < 0.90) return 'stable';
  if (p < 0.95) return 'first_water';
  return 'civ_preview';
}
```

### 12.3 Phase-specific particle pools

Override `pickParticleName(stageId)` for stage 10 to pick from the active phase's pool. Add to `particles.ts`:

```ts
const STAGE_10_PHASE_POOLS: Record<SolarPhase, string[]> = {
  pre_stellar:    ['Dust', 'Gas', 'Hydrogen'],
  t_tauri:        ['Photon', 'Solar Wind'],
  planetesimals:  ['Planetesimal', 'Asteroid', 'Rock'],
  inner_planets:  ['Mercury', 'Venus', 'Earth', 'Mars'],
  outer_planets:  ['Jupiter', 'Saturn', 'Uranus', 'Neptune'],
  late_bombardment: ['Meteor', 'Comet', 'Lava'],
  stable:         ['Orbit', 'Asteroid Belt', 'Pluto'],
  first_water:    ['Water', 'Atmosphere', 'Ocean'],
  civ_preview:    ['City Light', 'Civilization', 'Smoke'],
};

export function pickParticleNameForStage10(progress: number): string {
  const phase = getSolarPhase(progress);
  const pool = STAGE_10_PHASE_POOLS[phase];
  return pool[Math.floor(Math.random() * pool.length)];
}
```

### 12.4 Visual primitives

Each `drawXxx` function is ~30–60 lines using ctx primitives:
- Sun gradient (yellow radial)
- Planet sprites (small filled circles with shaded edge, color per planet)
- Orbit lines (thin dashed circles)
- Meteor streaks (lines with motion blur)
- Earth detail (blue circle + brown spots for continents at higher progress)

### 12.5 Acceptance

- Stage 10 visibly cycles through 9 phases as progress fills.
- At 50 % progress, Earth + Mars + Mercury + Venus visible.
- At 75 %, all 9 planets visible.
- At 95 %, brief city-light flicker on Earth night side.

---

## 13. Module V4-M — Almanac Time-Uncertainty Notes

### 13.1 Add uncertainty flag

Some cosmological timestamps depend on theoretical assumptions. Add a `uncertaintyNote` field to almanac entries where relevant:

```ts
{
  id: 'degenerate_era',
  title: 'Degenerate Era (디제너레이트 시대)',
  short: '양성자가 천천히 붕괴하는 매우 긴 시대',
  body: '...',
  funFact: '...',
  uncertaintyNote: '양성자 붕괴 시간은 GUT 모델에 따라 1e34년에서 1e45년까지 다양해. \
이 게임의 1e40년은 중간값을 사용한 거야.',
},
```

### 13.2 Stages with uncertainty notes

| Stage | Note |
|---|---|
| 1 Inflation | Inflation period theoretical; range 1e-36 to 1e-32 s |
| 8 Reionization | End of reionization 0.5–1 Gyr; some debate |
| 14 Degenerate Era | Proton decay 1e34–1e45 yr |
| 15 Black Hole Era | Stellar BH evaporation 1e67 yr; SMBH 1e100 yr |
| 16 The End | Heat death asymptotic; Big Rip / Big Crunch are alternatives |

### 13.3 UI

Almanac modal shows note in italics under the body:

```
─────────────────────────────────────
ⓘ Note: Proton decay timing depends
  on theoretical models. The 1e40 yr
  shown here is a midpoint estimate.
```

### 13.4 Acceptance

- Stages 1, 8, 14, 15, 16 show uncertainty notes when almanac viewed.
- Other stages show no note (no clutter).

---

## 14. Module V4-N — System Integration & Balance

### 14.1 Balance simulation update

`scripts/balance-sim.ts` must now:
1. Apply time-gauge gating in addition to quanta threshold.
2. Use moderate skill investor policy that *also* invests in Aeon Drive.
3. Verify total real-time in [80, 130] hours.
4. Verify per-stage time within ±30 % of `realPlayTargetSec`.

### 14.2 Skill investment policy for sim

Round-robin spending priority:
1. If quanta is full but time gauge is < 50 %: BUY Aeon Drive level.
2. Else if quanta is full but encounter rate is low: BUY Cosmic Web.
3. Else if click power is bottleneck: BUY Stellar Forge.
4. Else: BUY Quantum Lens for crits.
5. Cross-nodes bought when prereqs met and SP available, in tier order.

### 14.3 Integration tests

```ts
// tests/integration/full-run.test.ts
test('a full universe completes in 80–130 hours under moderate policy', () => {
  const result = simulateFullRun({ policy: 'moderate' });
  expect(result.totalRealHours).toBeGreaterThanOrEqual(80);
  expect(result.totalRealHours).toBeLessThanOrEqual(130);
  expect(result.spEarned).toBeGreaterThanOrEqual(15);
  expect(result.spEarned).toBeLessThanOrEqual(35);
});

test('time gauge mechanics gate stage advance', () => {
  let state = initialState();
  state = clickUntilQuantaFull(state);
  expect(state.timeGauge).toBeLessThan(getTimeBudget(STAGES[0]));
  expect(canCondense(state)).toBe(false);
  state = waitTime(state, 60);
  expect(canCondense(state)).toBe(true);
});

test('SP earned per universe', () => {
  const result = simulateFullRun({ policy: 'moderate' });
  expect(result.spEarned).toBeGreaterThanOrEqual(20);
});
```

### 14.4 Acceptance

- All integration tests pass.
- `npm run sim` reports total time in valid range.
- Per-stage real time within ±30 % of target.

---

## 15. Module V4-O — Save Migration v4 → v5

### 15.1 Schema bump

Bump version to 5. Add fields:

```ts
export interface SaveStateV5 {
  version: 5;
  // ... v4 fields ...
  skillPoints: number;            // restored
  timeGauge: number;              // current stage's gauge
  shopBoosts: ShopBoosts;         // active timed boosts
  totalShopSpentUSD: number;
  tutorialFlags: Record<string, boolean>;  // per-bubble dismissal flags
}
```

### 15.2 Migration

```ts
function migrateV4ToV5(v4: SaveStateV4): SaveStateV5 {
  return {
    ...v4,
    version: 5,
    skillPoints: 0,             // v3→v4 dropped this; v5 starts from 0
    timeGauge: 0,
    shopBoosts: {},
    totalShopSpentUSD: 0,
    tutorialFlags: v4.universeCount > 1 ? { allDismissed: true } : {},
  };
}
```

### 15.3 Acceptance

- v4 save loads cleanly into v5 with skillPoints reset to 0.
- v5 round-trip identity.

---

## 16. Implementation Order

| # | Module | Hours |
|---|---|---|
| 1 | V4-A (SP system) | 4 |
| 2 | V4-I (Quanta carry-over verify) | 2 |
| 3 | V4-J (Encounter cap reduction) | 1 |
| 4 | V4-E (Time gauge — core) | 12 |
| 5 | V4-F (Two-criteria condense) | 4 |
| 6 | V4-B (Bottom-up tree visual) | 8 |
| 7 | V4-C (Symbol tooltip + detail card) | 6 |
| 8 | V4-D (Speech bubble tutorials) | 4 |
| 9 | V4-G (Cosmic Shop) | 8 |
| 10 | V4-H (Particle Affinity in QL) | 1 |
| 11 | V4-K (UI bug fixes) | 2 |
| 12 | V4-L (Solar System redesign) | 12 |
| 13 | V4-M (Almanac uncertainty notes) | 2 |
| 14 | V4-N (Balance sim + integration tests) | 8 |
| 15 | V4-O (Save migration) | 2 |
| **Total** | | **~76 hours = ~9.5 days** |

---

## 17. Definition of Done

After all modules:

1. `npm run build` passes; no TypeScript errors.
2. `npm test` passes; all integration tests included.
3. `npm run sim` reports total time in [80, 130] hours, per-stage ±30 %.
4. Manual playthrough on a fresh save:
   - Stage 1: no skill UI, no tutorial, just click.
   - Stage 2: speech bubble points to Skills button on first entry.
   - Stage 5: Aeon Drive available; tutorial mentions SP.
   - Time gauge visible from stage 5 onward.
   - At any stage, condense gated by both quanta AND time gauge.
   - Buying Stellar Forge Lv 5 visibly emits 2 motes per click.
   - Cross-nodes show prereq status (locked / available / owned).
   - Detail card with embedded buy button works.
   - Shop opens, items apply effects, totalShopSpentUSD updates.
   - IntroScreen text not overlapping.
   - Drag in canvas does not select text.
   - Stage 10 cycles through 9 phases (pre-stellar → civ-preview).
5. Multi-universe progression:
   - SP carries across universes.
   - Cross-nodes once owned remain owned across universes.
   - Tutorial bubbles do NOT re-appear in universe 2.

---

## 18. Quality Bar

- **No decimals** in displayed numbers (use V3-A `formatWhole`).
- **No CSS blur effects**.
- **Pure reducer** — no DOM/audio/network in reducer.
- **All UI text-selectable disabled** via CSS (V4-K).
- **English code comments**.
- **Mobile hit targets ≥ 44 px**.
- **Skill panel must be usable on portrait mobile** (test at 375 × 812).

---

End of V4 specification.
