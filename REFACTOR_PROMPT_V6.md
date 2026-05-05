# Cosmic Coalescence — Refactor V6 Specification

> **Audience**: Autonomous coding agent with full repo access.
> **Mode**: Plan-then-execute. Run `npm run build && npm test` after every module.
> **Status**: Builds on V1+V2+V3+V4+V5. **V6 supersedes parts of V5** — see §0.1.

V6 addresses 22 user issues from a major review session. The dominant themes:
1. Time mechanic was incorrectly tuned: the cosmic-time fill rate must be **logarithmic per Aeon level (each level = 10×)** with **NO auto-scaling on stage advance**.
2. Late-game lag is severe; the leak fix from V5-N was insufficient.
3. Stage-specific animations (Earth, Death of Star, Black Hole) still don't visibly progress.
4. Skill purchases give too small returns (2–3×); raise to ≥10× per purchase.
5. UI is cluttered; consolidate text into the info panel and move skills/shop to the bottom.

Implementation order: V6-A → V6-P (see §17). Each module is independently testable.

---

## 0. V6 Supersedes V5 — Reconciliation

### 0.1 Direct conflicts

| Topic | V5 said | V6 says | Action |
|---|---|---|---|
| Aeon Drive multiplier per level | `1.10^level` (then `1.18^level`, then `1.15^level`) | `10^level` (logarithmic) | Replace formula |
| Aeon Drive max level | 30 | Effectively unbounded; gated by quanta cost. | Remove rootMaxLevel cap |
| Aeon Drive unlock stage | Stage 4 | Stage 2 — all 4 tracks unlock together when reaching stage 2 | Update unlock map |
| Stage transition resets time-flow rate | Implied (per-stage rate normalized) | Time-flow rate is global; doesn't reset per stage | Decouple rate from stage |
| Skill levels yield 1.6×–1.7× per level | Yes | Each level multiplies effect by 10× (or as close as the formula allows) | Replace formula |
| Stats panel position | Top | Bottom of screen | Move panel |
| Time multiplier display | "Time × N" small label | Stat row at the bottom | Move and resize |
| Cross-node UI | ⊕ icon at right of milestone | Same, plus visible **connecting lines** showing prereqs | Add line rendering |
| Shop boost stacking | Single instance only (replaces existing) | Unlimited stacking with composed multiplier | Allow multi-buys |
| Active boost display | Inside Shop panel | On main screen, fixed panel showing remaining time and active multipliers | Add HUD widget |

### 0.2 V5 features V6 keeps

- 16 stages with cosmic time anchors.
- 4 skill tracks (Stellar Forge, Cosmic Web, Quantum Lens, Aeon Drive) — same names, same identity.
- Skill Points (SP) for cross-node unlocks.
- Quanta as level-up currency.
- Two-criteria condense (quanta + time gauge).
- Cosmic clock continuity across stages (V5-M).
- Almanac with cosmic era info (V5-O).
- Distant background + parallax (V5-P).
- Tutorial speech bubbles (V5-F, V5-K).

---

## 1. Module V6-A — Universal Distance Display

### 1.1 The complaint

User: "모든 멀리서 오는 행성 위에는 거리가 얼마인지 AU로 보여주고. 초기에는 거리가 짧으니깐 nm, mm m km등으로 보여줘도 좋아."

Translation: every incoming object should show distance. Use real-scale units appropriate to the era.

### 1.2 Per-stage units

```ts
// src/game/encounters.ts
export function formatEncounterDistance(stageId: number, fracOfScreen: number): string {
  // fracOfScreen 0..1 — 0 is center, 1 is screen edge.
  // Convert to a per-stage "real" distance.
  const v = fracOfScreen;  // 0..1
  if (stageId <= 2)  return `${(v * 1000).toFixed(0)} nm`;
  if (stageId <= 3)  return `${(v * 100).toFixed(0)} pm`;
  if (stageId <= 4)  return `${(v * 10).toFixed(2)} fm`;
  if (stageId <= 5)  return `${(v * 1000).toFixed(0)} mm`;
  if (stageId <= 6)  return `${(v * 100).toFixed(0)} m`;
  if (stageId <= 7)  return `${(v * 100).toFixed(0)} km`;
  if (stageId <= 8)  return `${(v * 100).toFixed(0)} AU`;
  if (stageId <= 9)  return `${(v * 10000).toFixed(0)} ly`;
  if (stageId <= 10) return `${(v * 100).toFixed(0)} AU`;
  if (stageId <= 11) return `${(v * 1000).toFixed(0)} m`;
  if (stageId <= 12) return `${(v * 100).toFixed(0)} AU`;
  if (stageId <= 13) return `${(v * 1000).toFixed(0)} ly`;
  if (stageId <= 14) return `${(v * 1000).toFixed(0)} ly`;
  if (stageId <= 15) return `${(v * 1).toFixed(2)} Mpc`;
  return `${(v * 100).toFixed(0)} Gpc`;
}
```

### 1.3 Display rule

- Show distance label above EVERY incoming encounter (rogue) regardless of distance.
- Once `fracOfScreen < 0.15` (very close), hide the label so it doesn't clutter the click target.
- Use a small monospace font, top-justified above the sprite.

### 1.4 Acceptance

- Stage 7: incoming Pop III star shows "85 km" → "12 km" → label disappears as it nears center.
- Stage 9: galaxy shows "8000 ly".
- Stage 16: distant fluctuation shows "47 Gpc".

---

## 2. Module V6-B — Click Multi-Emission Text Overlap

### 2.1 The bug

When click emits 2+ motes (Stellar Forge level ≥ 5), each emission spawns a floating number at the click point. They overlap because they're at the same coordinates.

### 2.2 Fix

In `ParticleField.tsx` click handler, distribute floating numbers in a small radial spread:

```ts
function spawnFloatingNumbers(state, x, y, gained, count, isCrit, particleName): void {
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
    const radius = 12 + i * 4;
    const fx = x + Math.cos(angle) * radius;
    const fy = y + Math.sin(angle) * radius - i * 6;  // staggered vertically
    addFloatingEntry({
      id: nextId(),
      x: fx, y: fy,
      text: `+${formatWhole(gained)} ${particleName}`,
      variant: isCrit ? 'crit' : 'normal',
      stageId: state.stageIdx + 1,
      delayMs: i * 60,  // stagger appearance
    });
  }
}
```

Add `delayMs` field to `FloatingEntry`. Render with `setTimeout` or animation delay so they appear in sequence, not simultaneously.

### 2.3 Acceptance

- Stellar Forge Lv 5 click: 2 floating numbers visible, not overlapping.
- Stellar Forge Lv 25 click: 6 floating numbers visible in a fanned arc.

---

## 3. Module V6-C — Curved Click Trajectories

### 3.1 The complaint

Clicks send flyers/bursts in straight radial lines. Boring.

### 3.2 Fix: Bezier-curve trajectories

Add curved motion to `Flyer`:

```ts
// types.ts
export interface Flyer {
  x: number; y: number;
  startX: number; startY: number;        // NEW
  controlX: number; controlY: number;    // NEW — Bezier control point
  targetX: number; targetY: number;      // NEW
  t: number;                             // 0..1 progress
  life: number;
  auto?: boolean;
  spriteId?: number;
}
```

Spawn flyer with random curved path:

```ts
function spawnFlyerCurved(world, startX, startY, targetX, targetY, isAuto): Flyer {
  // Random off-axis control point so Bezier curve isn't a straight line.
  const midX = (startX + targetX) / 2;
  const midY = (startY + targetY) / 2;
  const offsetMagnitude = Math.hypot(targetX - startX, targetY - startY) * 0.4;
  const offsetAngle = Math.atan2(targetY - startY, targetX - startX) + Math.PI / 2;
  const sign = Math.random() < 0.5 ? 1 : -1;
  const controlX = midX + Math.cos(offsetAngle) * offsetMagnitude * sign;
  const controlY = midY + Math.sin(offsetAngle) * offsetMagnitude * sign;
  return {
    x: startX, y: startY,
    startX, startY,
    controlX, controlY,
    targetX, targetY,
    t: 0,
    life: 1,
    auto: isAuto,
  };
}

// Update each frame
function updateFlyerCurved(flyer: Flyer, dt: number): void {
  flyer.t += dt * 0.0008;          // adjust speed as needed
  if (flyer.t > 1) flyer.life = 0;
  // Quadratic Bezier
  const oneMinusT = 1 - flyer.t;
  flyer.x = oneMinusT * oneMinusT * flyer.startX
          + 2 * oneMinusT * flyer.t * flyer.controlX
          + flyer.t * flyer.t * flyer.targetX;
  flyer.y = oneMinusT * oneMinusT * flyer.startY
          + 2 * oneMinusT * flyer.t * flyer.controlY
          + flyer.t * flyer.t * flyer.targetY;
}
```

### 3.3 Bursts

Apply same curving to bursts: each burst fragment has a slight tangential acceleration so its path curves over time.

### 3.4 Acceptance

- Click on stage 4: flyers visibly curve toward center, not straight-line.
- Burst fragments fan out and curl rather than fly straight.

---

## 4. Module V6-D — Scale Indicator (Bottom-Left)

### 4.1 The need

User wants a small indicator showing what real-world scale the screen represents (e.g., "1 cm = 10 nm" or "1 cm = 1 AU").

### 4.2 Implementation

New small HUD widget at bottom-left:

```
┌─────────────────────┐
│ Scale               │
│ ├──────┤            │
│   100 nm            │
└─────────────────────┘
```

- A horizontal bar (50 px wide).
- Below it, the unit/value the bar represents.
- Updates per stage (matches `formatEncounterDistance` units).

```ts
// src/game/scaleIndicator.ts
export function getScreenScaleLabel(stageId: number): { length: number; unit: string; value: number } {
  // Returns: 50px bar represents `value` units of `unit`.
  if (stageId <= 2)  return { length: 50, unit: 'nm', value: 100 };
  if (stageId <= 3)  return { length: 50, unit: 'pm', value: 100 };
  if (stageId <= 4)  return { length: 50, unit: 'fm', value: 10 };
  if (stageId <= 5)  return { length: 50, unit: 'mm', value: 1000 };
  if (stageId <= 6)  return { length: 50, unit: 'm',  value: 100 };
  if (stageId <= 7)  return { length: 50, unit: 'km', value: 100 };
  if (stageId <= 8)  return { length: 50, unit: 'AU', value: 100 };
  if (stageId <= 9)  return { length: 50, unit: 'ly', value: 10000 };
  if (stageId <= 10) return { length: 50, unit: 'AU', value: 100 };
  if (stageId <= 11) return { length: 50, unit: 'm',  value: 1000 };
  if (stageId <= 12) return { length: 50, unit: 'AU', value: 100 };
  if (stageId <= 13) return { length: 50, unit: 'ly', value: 1000 };
  if (stageId <= 14) return { length: 50, unit: 'ly', value: 1000 };
  if (stageId <= 15) return { length: 50, unit: 'Mpc', value: 1 };
  return                    { length: 50, unit: 'Gpc', value: 100 };
}
```

### 4.3 Acceptance

- Bottom-left widget visible in every stage.
- Updates label/units when stage changes.
- Doesn't intercept clicks (`pointer-events: none`).

---

## 5. Module V6-E — Stats Panel to Bottom

### 5.1 The change

Move click power, auto rate, crit info, and **time multiplier** display to a single horizontal stats row at the bottom of the screen (above shop/skills buttons).

### 5.2 Layout

```
┌─────────────────────────────────────────────────────┐
│           [GAME CANVAS]                              │
│                                                      │
│                                                      │
├─────────────────────────────────────────────────────┤
│ Quanta: 8,400 / 12,000  ▓▓▓▓▓▓░░░ 70 %              │
│ Cosmic Time: 254 Kyr / 380 Kyr ▓▓▓▓▓▓░░ 67 %        │
├─────────────────────────────────────────────────────┤
│ Click: 384 │ Auto: 21/s │ Crit: ×3 │ Time: ×10⁸    │
├─────────────────────────────────────────────────────┤
│         [SKILLS]   [SHOP]                            │
└─────────────────────────────────────────────────────┘
```

### 5.3 Implementation

In `GameScreen.tsx`, restructure the layout:
- Top: Timeline (cosmic clock + entropy + universe badge)
- Middle: Stage canvas (`<ParticleField>`)
- Below canvas: ResourcePanel (2 progress bars)
- Below ResourcePanel: StatsRow (4 columns: click, auto, crit, time)
- Bottom: Buttons row (Skills, Shop)

Remove the existing "Time × N" floating label from the field (V5-T's small label is now redundant).

### 5.4 StatsRow component

```tsx
// components/StatsRow.tsx
export function StatsRow({ click, auto, crit, time }: StatsRowProps) {
  return (
    <div className="stats-row">
      <div><span className="label">Click</span><span className="value">{formatWhole(click)}</span></div>
      <div><span className="label">Auto</span><span className="value">{formatWhole(auto)}/s</span></div>
      <div><span className="label">Crit</span><span className="value">×{formatWhole(crit)}</span></div>
      <div><span className="label">Time</span><span className="value">{formatTimeMultiplier(time)}</span></div>
    </div>
  );
}

function formatTimeMultiplier(mult: number): string {
  if (mult <= 999) return `×${Math.floor(mult)}`;
  // For huge values (10^9 or higher), show as 10^N
  const exp = Math.floor(Math.log10(mult));
  const mantissa = mult / Math.pow(10, exp);
  if (mantissa < 2) return `×10^${exp}`;
  return `×${Math.floor(mantissa)}·10^${exp}`;
}
```

### 5.5 Acceptance

- Stats are visible in a single row at the bottom.
- Time multiplier displays as `×10^9`, `×10^15`, etc., for large values.
- Top of screen is cleaner (no Time × label there anymore).

---

## 6. Module V6-F — Logarithmic Time Scaling (CRITICAL)

### 6.1 The principle

User: "스테이지가 오른다고 시간의 흐름이 빨라지는거 아니야. 초반에 10⁻¹⁰으로 진행되자나 매초마다. 즉 다음 스테이지 가도 그대로 유지돼. 그 대신 끝이 엄청 증가했잖아. 즉 업그레이드를 해서 10배 100배 증가시키지 않으면 시간을 움직일 수가 없어."

Translation:
1. The time-flow rate doesn't speed up just because the stage advances.
2. The rate is constant per real-second; only stage targets balloon.
3. Without 10×–100× per-level upgrades to Aeon Drive, late stages are unreachable.

### 6.2 Cosmic clock fill formula

```ts
// formulas.ts — RIGHT
export function getCosmicTimeFillRate(aeonLevel: number, mods: Modifiers): number {
  // Returns cosmic seconds per real second.
  // Constant base of 1 cosmic-sec / real-sec; each Aeon level multiplies by 10.
  const base = 1.0;
  const aeonMult = Math.pow(10, aeonLevel);    // 10^level — logarithmic
  return base * aeonMult * mods.timeMult * mods.apexMult;
}
```

| Aeon Lv | Multiplier |
|---:|---:|
| 0 | 1× |
| 5 | 10⁵ |
| 10 | 10¹⁰ |
| 30 | 10³⁰ |
| 50 | 10⁵⁰ |
| 100 | 10¹⁰⁰ |
| 110 | 10¹¹⁰ |

### 6.3 Stage advance criteria

Replace per-stage normalized gauge with **cumulative cosmic time**:

```ts
// Stage advances when:
// 1. quanta >= stage.threshold (existing)
// 2. cumulativeCosmicTimeSec >= stage.cosmicTimeSec
//    (i.e., the universe has reached the stage's epoch)
```

The cosmic clock progresses monotonically. Each stage's `cosmicTimeSec` is its end-time (the universe's age at the end of that stage). When the clock crosses `cosmicTimeSec`, the player CAN condense if quanta is also met.

### 6.4 Per-stage real-time estimates

| Stage | cosmicTimeSec | Aeon Lv 0 (1×) real-time | Aeon Lv 5 (10⁵×) real-time | Aeon Lv 30 (10³⁰×) | Aeon Lv 110 (10¹¹⁰×) |
|---|---:|---:|---:|---:|---:|
| 1 | 1e-32 | 1e-32 s ≈ instant | instant | instant | instant |
| 2 | 1e-12 | 1e-12 s ≈ instant | instant | instant | instant |
| 3 | 1e-6 | 1e-6 s | instant | instant | instant |
| 4 | 180 | 180 s = 3 min | < 1 ms | instant | instant |
| 5 | 1.2e13 | 380,000 yr (impossible) | 12 hr | < 1 ms | instant |
| 7 | 6.3e15 | 200 Myr | 25 days | < 1 sec | instant |
| 10 | 2.9e17 | 9.2 Gyr | 920 yr | 2.9 ms | instant |
| 13 | 3.15e21 | impossibly long | 1 Myr | 32 sec | instant |
| 14 | 3.15e47 | impossible | impossible | 1e17 sec | impossible |
| 15 | 3.15e107 | impossible | impossible | impossible | 31 sec |
| 16 | 3.15e110 | impossible | impossible | impossible | 9 hr |

This means:
- Stages 1–4: clearable without Aeon investment.
- Stage 5: needs Aeon Lv 5+.
- Stage 13: needs Aeon Lv 25+.
- Stage 14: needs Aeon Lv 50+.
- Stage 15: needs Aeon Lv 100+.
- Stage 16: needs Aeon Lv 110+.

**This forces meaningful skill investment and makes the tree progression nontrivial.**

### 6.5 Aeon Drive level cap removed

Remove the `rootMaxLevel: 30` cap. Allow any level. Cost grows by 10× per level so it self-balances:

```ts
function getAeonRootCost(level: number): number {
  return Math.floor(100 * Math.pow(10, level));
  // Lv 1: 1000 quanta
  // Lv 5: 1e7
  // Lv 10: 1e12
  // Lv 30: 1e32
  // Lv 100: 1e102
}
```

Player needs 1e102 quanta to buy Lv 100 — they only get this through accumulated late-game grinding + apex/cross-node multipliers.

### 6.6 Display

In StatsRow (V6-E), the Time stat shows `×10^N` notation for clarity:
- Aeon Lv 0: `×1`
- Aeon Lv 5: `×10⁵`
- Aeon Lv 30: `×10³⁰`

### 6.7 Cosmic clock display

Already covered in V5-G/V5-M: cumulative cosmic time monotonic across stages, displayed in real units (`s`, `min`, `yr`, `Myr`, `Gyr`, scientific).

### 6.8 Aeon Drive unlocks at Stage 2

User: "스테이지 2에서 구매하가 해도 좋고."

Update unlock map:

| Stage entry | Tracks unlocked |
|---|---|
| 1 | Stellar Forge only |
| 2 | + Quantum Lens + Cosmic Web + **Aeon Drive** (all 3 added at once) |

Player can buy Aeon Drive starting from stage 2 — earlier, providing more time to invest.

### 6.9 Acceptance

- Aeon Lv 1 produces exactly 10× cosmic time advance.
- Aeon Lv 5 produces exactly 10⁵× advance.
- Cumulative cosmic clock matches real cosmic time anchors.
- Stage 5 unreachable without Aeon Lv 5+.
- Stage 16 unreachable without Aeon Lv 110+.
- Stage 2 lets player buy all three additional tracks.

---

## 7. Module V6-G — Skill 10× Per Level + Cross-Node Connections

### 7.1 Click and Auto: 10× per level

Update formulas:

```ts
export function getClickPower(clickLevel: number, mods: Modifiers): number {
  return 1 * Math.pow(10, clickLevel) * mods.clickPowerMult;
}
// Lv 0: 1, Lv 1: 10, Lv 5: 1e5, Lv 10: 1e10

export function getAutoRate(autoLevel: number, mods: Modifiers): number {
  if (autoLevel === 0) return 0;
  return Math.pow(10, autoLevel) * mods.autoRateMult;
}
// Lv 0: 0, Lv 1: 10/s, Lv 5: 1e5/s, Lv 10: 1e10/s
```

This matches V6-F's logarithmic scale. Each level is a major upgrade.

### 7.2 Quanta cost per skill level

Cost grows 10× per level (matches power growth):

```ts
function getSkillLevelCost(track: TrackId, level: number): number {
  const trackBase = { click: 100, auto: 200, crit: 500, time: 1000 }[track];
  return Math.floor(trackBase * Math.pow(10, level));
}
// click Lv 1: 1000, Lv 5: 1e7, Lv 10: 1e12
```

Net effect: each level multiplies your power 10× and costs 10×. Progression is steep, with each level being meaningful.

### 7.3 Crit multiplier scaling

```ts
export function getCritMultiplier(critLevel: number, mods: Modifiers): number {
  return Math.max(1.5, 1.5 + critLevel * 0.5) * mods.critMultMult;
}
// Lv 0: 1.5, Lv 5: 4, Lv 10: 6.5, Lv 30: 16.5
```

Crit multiplier doesn't go logarithmic; otherwise crits become absurd. Keep it linear-modest.

### 7.4 Cross-node visible connections

In the Skills panel SVG tree, draw lines from each cross-node to its prereqs:

- Cross-node has a list of prereqs (e.g., Echoing Click requires Stellar Forge L15 + Aeon Drive L10).
- Draw two lines from the cross-node icon to those two cells (Stellar Forge column row 15 + Aeon Drive column row 10).
- Line styles:
  - **Both prereqs met**: bright accent color, thick.
  - **Some prereqs met**: thin dashed, dimmer.
  - **No prereqs met**: very dim.
- Lines should not overlap track cells (route around them with bezier curves).

### 7.5 Acceptance

- Click Lv 1 yields 10 quanta per click (vs 1.6× in V5).
- Auto Lv 5 yields 100,000/s.
- Tree shows visible lines connecting cross-nodes to their prereqs.
- Lines change color when prereqs become met.

---

## 8. Module V6-H — SP Cross-Node Verification

### 8.1 The complaint

"각각 구매하는거 SP 사용해서 cross node 구매하는게 잘 안되있는거 같은데 확인해볼래? 그냥 레벨업하면서 자연스럽게 생기는거 같아."

Translation: cross-nodes seem to auto-grant when you level up, instead of requiring SP purchase.

### 8.2 Audit and fix

Check `gameReducer.ADVANCE_STAGE` and `BUY_TRACK_LEVEL`:
- These should NEVER add to `state.skills.ownedCrossNodes`.
- ONLY `BUY_CROSS_NODE` adds to `ownedCrossNodes`.

Check `getActiveModifiers` / `applyCrossNode`:
- Effects from cross-nodes only apply if id is in `state.skills.ownedCrossNodes`.

Make sure `applyNodeEffect` doesn't apply effects based on track levels alone — only on owned cross-node ids.

### 8.3 UI cue

In skill panel, owned cross-nodes show a star (★) overlay. Locked but available cross-nodes show a "BUY" button in the detail card.

### 8.4 Test

```ts
test('reaching Lv 15 in Stellar Forge does not auto-unlock Echoing Click', () => {
  let state = createInitialGameState(0);
  // simulate buying levels
  for (let i = 0; i < 15; i++) {
    state = gameReducer(state, { type: 'BUY_TRACK_LEVEL', trackId: 'click' });
  }
  expect(state.skills.click.level).toBe(15);
  expect(state.skills.ownedCrossNodes.includes('echoing_click')).toBe(false);
});

test('BUY_CROSS_NODE requires SP and quanta', () => {
  let state = createInitialGameState(0);
  state.skills.click.level = 15;
  state.skills.time.level = 10;
  state.quanta = 50_000;
  state.skillPoints = 0;
  state = gameReducer(state, { type: 'BUY_CROSS_NODE', nodeId: 'echoing_click' });
  expect(state.skills.ownedCrossNodes.includes('echoing_click')).toBe(false);  // no SP

  state.skillPoints = 1;
  state = gameReducer(state, { type: 'BUY_CROSS_NODE', nodeId: 'echoing_click' });
  expect(state.skills.ownedCrossNodes.includes('echoing_click')).toBe(true);
});
```

### 8.5 Acceptance

- All cross-nodes require explicit SP+quanta purchase.
- Tests pass.
- UI never shows cross-node as auto-owned.

---

## 9. Module V6-I — Active Boost HUD + Unlimited Stacking

### 9.1 Boost stacking

Currently, V4-G's shop replaces existing boost on re-buy. V6 allows unlimited stacking.

```ts
// types.ts
export interface ShopBoost {
  id: string;
  factor: number;
  expiresAt: number;
}

export interface PersistentGameState {
  // replace single timeMult/quantaMult with arrays
  shopBoosts: ShopBoost[];
}
```

When buying a shop item, append a new `ShopBoost` to the array. Multiple time-mult boosts compose multiplicatively:

```ts
function getCompositeMultiplier(boosts: ShopBoost[], idPrefix: string): number {
  const now = Date.now();
  const active = boosts.filter((b) => b.id.startsWith(idPrefix) && b.expiresAt > now);
  return active.reduce((acc, b) => acc * b.factor, 1);
}

// Use:
const timeBoostMult = getCompositeMultiplier(state.shopBoosts, 'time_');
const quantaBoostMult = getCompositeMultiplier(state.shopBoosts, 'quanta_');
```

Player can buy "Quick Time Boost" (×2 for 10 min) 100 times → 100 stacked × ×2 = ×2¹⁰⁰. No cap.

### 9.2 Active boost HUD

A small fixed widget on the right side of the screen, always visible when any boost is active:

```
┌──────────────────────────────┐
│ Active Boosts                │
│ ⏱ Time × 2¹⁰  9:42 left      │  ← composed time mult
│ ✨ Quanta × 9   24:15 left   │  ← composed quanta mult
└──────────────────────────────┘
```

Implementation:

```tsx
// components/ActiveBoostHud.tsx
export function ActiveBoostHud({ boosts }: { boosts: ShopBoost[] }) {
  const now = Date.now();
  const active = boosts.filter((b) => b.expiresAt > now);
  if (active.length === 0) return null;
  
  const timeBoostCount = active.filter(b => b.id.startsWith('time_')).length;
  const quantaBoostCount = active.filter(b => b.id.startsWith('quanta_')).length;
  const timeMultComposite = active
    .filter(b => b.id.startsWith('time_'))
    .reduce((acc, b) => acc * b.factor, 1);
  const quantaMultComposite = active
    .filter(b => b.id.startsWith('quanta_'))
    .reduce((acc, b) => acc * b.factor, 1);
  
  return (
    <div className="active-boost-hud">
      {timeBoostCount > 0 && (
        <div>⏱ Time × {formatWhole(timeMultComposite)} ({formatTimeRemaining(active, 'time_')})</div>
      )}
      {quantaBoostCount > 0 && (
        <div>✨ Quanta × {formatWhole(quantaMultComposite)} ({formatTimeRemaining(active, 'quanta_')})</div>
      )}
    </div>
  );
}
```

`formatTimeRemaining` shows the soonest-expiring boost's remaining time.

### 9.3 Acceptance

- Buy Time Boost 5 times in a row → composite mult = 2⁵ = 32; HUD shows "Time × 32".
- HUD updates timer every second.
- After all boosts expire, HUD disappears.

---

## 10. Module V6-J — Stage Animations Driven by Cosmic Time

### 10.1 The principle

User: "스테이지마다 애니매이션이 밑에 시간에 따라서 변해야지, 그냥 클릭 몇 번 했다고 바뀌면 안 되지 서서히 변해가야지."

Translation: stage animations should be driven by cumulative cosmic time, not click count. They should gradually change.

### 10.2 Implementation

Each stage's `drawCluster` should compute its phase from `cumulativeCosmicTime` (V5-M), not from `quanta / threshold` (which depends on click count).

For each stage with phased visuals:

```ts
// canvas/drawCluster.ts — drawSolarSystem
function drawSolarSystem(args: DrawClusterArgs): void {
  const { cumulativeCosmicTime, stage } = args;
  const stageStart = STAGES[args.stageIdx - 1]?.cosmicTimeSec ?? 0;
  const stageEnd = stage.cosmicTimeSec;
  const phaseProgress = Math.max(0, Math.min(1, (cumulativeCosmicTime - stageStart) / (stageEnd - stageStart)));
  // Use phaseProgress to dispatch to per-phase draw functions, not quanta-based progress.
  const phase = getSolarPhase(phaseProgress);
  // ...
}
```

### 10.3 Apply to all visual stages

Stages 7 (First Stars), 8 (Reionization), 10 (Solar System), 11 (Life), 12 (Death of Star), 15 (Black Hole), 16 (The End) — all phase animations driven by `cumulativeCosmicTime`.

Stages without complex phases (1, 2, 3, 4, 6, 9, 13, 14) can still use cosmic-time-driven subtle motion (e.g., particle drift speed proportional to cosmic time).

### 10.4 Acceptance

- Stage 10 (Solar System): if you click rapidly, animations don't fast-forward; they progress at cosmic-time pace.
- Stage 11 (Life): civilization flicker happens at exact cosmic time corresponding to stage 11's last 1 % epoch, not when quanta hits threshold.

---

## 11. Module V6-K — Earth, Death of Star, Black Hole Animation Fixes

### 11.1 Earth animation (Stage 11)

Replace the current static "Earth dot" with a phase-driven animated Earth:

```ts
function drawLifeEarth(ctx, x, y, r, phaseProgress, cosmicTime, t): void {
  // Phase-based Earth visual transformation:
  // 0–10 % (early Hadean):  red molten sphere with magma cracks
  // 10–25 % (after Theia impact): smaller red sphere + Moon nearby
  // 25–40 % (cooling): brown surface
  // 40–55 % (water arrives): mostly blue with some brown
  // 55–70 % (continents): brown patches grow on blue
  // 70–85 % (life proliferates): green tints on continents
  // 85–95 % (forests + oceans + clouds): full Earth-like, white clouds
  // 95–98 % (civilization flicker): tiny golden dots on night side for 2 s, then fade
  // 98–100 % (post-civ): Mars-like red dust planet
  
  const moonOrbitT = cosmicTime / (1e8 * 31557600);  // arbitrary slow rotation
  
  if (phaseProgress < 0.10) drawMoltenEarth(ctx, x, y, r, t);
  else if (phaseProgress < 0.25) drawTheiaImpact(ctx, x, y, r, phaseProgress, moonOrbitT, t);
  else if (phaseProgress < 0.40) drawCoolingEarth(ctx, x, y, r, phaseProgress, moonOrbitT);
  else if (phaseProgress < 0.55) drawWaterEarth(ctx, x, y, r, phaseProgress, moonOrbitT);
  else if (phaseProgress < 0.70) drawContinentsEarth(ctx, x, y, r, phaseProgress, moonOrbitT, t);
  else if (phaseProgress < 0.85) drawLifeEarth(ctx, x, y, r, phaseProgress, moonOrbitT, t);
  else if (phaseProgress < 0.95) drawForestEarth(ctx, x, y, r, phaseProgress, moonOrbitT, t);
  else if (phaseProgress < 0.98) drawCivilizationFlicker(ctx, x, y, r, phaseProgress, moonOrbitT, t);
  else drawMarsLikeEarth(ctx, x, y, r);
}
```

Each `drawXxxEarth` function is ~30 lines. Use:
- `ctx.arc` for the planet base
- `ctx.createRadialGradient` for surface coloring
- Small `ctx.arc` patches for continents, oceans, clouds
- `ctx.translate` + rotation for Moon orbit

### 11.2 Death of Star (Stage 12)

Show the Sun expanding and *swallowing planets* visibly:

```ts
function drawDeathOfStar(args): void {
  const { ctx, cx, cy, width, height, cumulativeCosmicTime, stage } = args;
  const stageStart = STAGES[10].cosmicTimeSec;
  const stageEnd = stage.cosmicTimeSec;
  const progress = (cumulativeCosmicTime - stageStart) / (stageEnd - stageStart);
  
  // Sun radius grows:
  const sunRadius = 30 + progress * 250;
  const sunColor = lerpColor('#ffd966', '#ff5533', progress * 1.2);
  
  // Draw Sun with glow
  drawGradientSphere(ctx, cx, cy, sunRadius, sunColor);
  
  // Planets at fixed orbit radii. As Sun expands, it swallows them in order.
  const planets = [
    { name: 'Mercury', orbitR: 50,  swallowAt: 0.05, color: '#aaa' },
    { name: 'Venus',   orbitR: 80,  swallowAt: 0.12, color: '#cc8' },
    { name: 'Earth',   orbitR: 110, swallowAt: 0.25, color: '#4af' },
    { name: 'Mars',    orbitR: 145, swallowAt: 0.38, color: '#d63' },
    { name: 'Jupiter', orbitR: 195, swallowAt: 0.55, color: '#dba' },
    { name: 'Saturn',  orbitR: 250, swallowAt: 0.68, color: '#cb9' },
    { name: 'Uranus',  orbitR: 295, swallowAt: 0.78, color: '#9be' },
    { name: 'Neptune', orbitR: 335, swallowAt: 0.87, color: '#39d' },
    { name: 'Pluto',   orbitR: 365, swallowAt: 0.95, color: '#ccc' },
  ];
  
  for (const planet of planets) {
    if (progress >= planet.swallowAt) continue;  // already swallowed
    const orbitAngle = cumulativeCosmicTime / 1e8;  // slow orbit
    const px = cx + Math.cos(orbitAngle) * planet.orbitR;
    const py = cy + Math.sin(orbitAngle) * planet.orbitR;
    drawSmallPlanet(ctx, px, py, 4, planet.color);
    // Optional name label
  }
  
  // When a planet is just swallowed (within 0.5 % of swallowAt), show a "consumed" flash and award bonus
  for (const planet of planets) {
    if (progress >= planet.swallowAt && progress < planet.swallowAt + 0.005) {
      drawConsumedFlash(ctx, cx, cy, sunRadius);
      // Reward bonus quanta in mechanic onTick
    }
  }
}
```

Bonus quanta dispatch from `mechanics/red_giant.ts onTick` when a planet is freshly consumed.

### 11.3 Black Hole (Stage 15) Smooth Shrinking

The complaint: visual is "딱딱 끊겨있는데" (jagged, broken). Particles falling into the center is wrong — they should orbit AT the event horizon as it shrinks, not fall in.

```ts
function drawBlackHoleScene(args): void {
  const { ctx, cx, cy, width, height, cumulativeCosmicTime, stage } = args;
  const stageStart = STAGES[13].cosmicTimeSec;
  const stageEnd = stage.cosmicTimeSec;
  const progress = (cumulativeCosmicTime - stageStart) / (stageEnd - stageStart);
  
  const minDim = Math.min(width, height);
  const initialRadius = minDim * 0.30;
  const finalRadius = 5;
  const bhRadius = initialRadius * Math.pow(1 - progress, 0.7) + finalRadius * Math.pow(progress, 1.5);
  // Smoother curve than linear.
  
  // 1. Background gravitational lensing — distort star positions by 1/r²
  drawLensedStars(ctx, world.stars, cx, cy, bhRadius);
  
  // 2. Photon ring at exactly 1.5x bhRadius — thin, glowing, smooth
  drawPhotonRing(ctx, cx, cy, bhRadius, t);
  
  // 3. Accretion disk — only if we still have matter. Smooth radial gradient with rotation.
  drawAccretionDisk(ctx, cx, cy, bhRadius, t);
  
  // 4. Event horizon — pure black filled circle, anti-aliased edge.
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(cx, cy, bhRadius, 0, Math.PI * 2);
  ctx.fill();
  
  // 5. PARTICLES (motes) — they orbit AT or just above the event horizon.
  //    NOT falling into center. As BH shrinks, particle orbits also shrink with it.
  for (const mote of world.cluster.motes) {
    // Convert mote.x, mote.y to angle and orbit radius relative to BH
    const dx = mote.x - cx;
    const dy = mote.y - cy;
    const distance = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    
    // Force orbit radius to be at bhRadius * 1.2 (just outside horizon).
    const orbitR = bhRadius * 1.2;
    const newX = cx + Math.cos(angle) * orbitR;
    const newY = cy + Math.sin(angle) * orbitR;
    drawStageSprite(ctx, 15, newX, newY, mote.r, mote.color, 0.7, t);
  }
  
  // 6. Final 1 % evaporation — flash + quick rays outward
  if (progress > 0.99) drawEvaporationFlash(ctx, cx, cy, progress, t);
}
```

### 11.4 Smooth black hole — implementation tips

- Use `ctx.shadowBlur = 20` + `ctx.shadowColor = '#0a0a0a'` for BH's outer rim glow.
- Photon ring: animate hue/alpha with sin(t) for a subtle pulsing.
- Accretion disk: 3 rotating concentric ellipses with alpha, blended with `globalCompositeOperation: 'lighter'`.
- Particles orbit smoothly: velocities tangent to radius, no spiral inward.

### 11.5 Acceptance

- Stage 11 Earth: when stage progresses, Earth visibly transforms from molten → cool → water → continents → green → forest → civ flicker → Mars.
- Stage 12 Death of Star: Sun visibly expands; planets get swallowed in order with consumption flashes.
- Stage 15 Black Hole: smooth shrinking; particles orbit the horizon, not falling in; no jagged edges.

---

## 12. Module V6-L — Quanta Carry-Over Hard Verification

### 12.1 Test

```ts
test('advancing stage preserves all excess quanta', () => {
  let state = createInitialGameState(0);
  state.stageIdx = 4;          // Stage 5
  state.quanta = STAGES[4].threshold * 2;  // 2x threshold
  state.timeGauge = STAGES[4].cosmicTimeSec * 1.1;  // exceeded
  state.cumulativeCosmicTime = STAGES[4].cosmicTimeSec * 1.1;
  
  state = gameReducer(state, { type: 'START_CONDENSE', now: 1000 });
  state = gameReducer(state, { type: 'ADVANCE_STAGE' });
  
  expect(state.stageIdx).toBe(5);
  expect(state.quanta).toBe(STAGES[4].threshold);  // 1x threshold remaining
  expect(state.cumulativeCosmicTime).toBe(STAGES[4].cosmicTimeSec * 1.1);  // not reset!
});
```

### 12.2 If broken, fix in `ADVANCE_STAGE`

```ts
case 'ADVANCE_STAGE': {
  if (state.pendingCondenseStageIdx === null) return state;
  if (state.stageIdx >= STAGES.length - 1) {
    return { ...state, completedRun: true, /*...*/ };
  }
  const currentStage = STAGES[state.stageIdx];
  return {
    ...state,
    stageIdx: state.stageIdx + 1,
    quanta: Math.max(0, state.quanta - currentStage.threshold),  // CARRY EXCESS
    // cumulativeCosmicTime — DO NOT MUTATE
    timeGauge: 0,  // per-stage gauge resets
    combo: 0,
    lastClick: 0,
    pendingCondenseStageIdx: null,
    pendingCondenseEntropy: 0,
    imploding: false,
    condenseStartedAt: null,
    skillPoints: state.skillPoints + 1,
    skills: { /* unlock tracks if needed */ },
  };
}
```

### 12.3 Acceptance

- Test passes.
- Manual: complete stage 3 with 3× threshold worth of quanta → start of stage 4 has 2× threshold quanta.

---

## 13. Module V6-M — Aggressive Late-Game Lag Fix

### 13.1 The complaint

"끄리고 랙이 엄첨 심해졌어. 시간이 지나면 별것도 아닌데 랙이 왜이렇게 심한지 분석해봐."
"게임이 보니깐 처음 스테이지는 랙도 안걸리다가 마지막 스테이지게 아면 갈수록 랙이 심해지는 느낌이야."

Translation: lag becomes severe as you progress. Stage 1 is fine; later stages lag.

### 13.2 Likely culprits

1. **`world.bursts`, `world.flyers`, `world.wakeTrails` array growth** — they should self-clean by `life <= 0` filtering, but if filter logic is buggy, items accumulate. Verify each frame removes dead items.

2. **`world.cluster.motes` array growth** — V5-N suggested capping. If motes grow unbounded as merges fail, the per-frame O(n²) gravity calculation balloons.

3. **`world.shockwaves` accumulation** — old shockwaves persist if `startedAt + duration < now` check is missed.

4. **CSS/DOM nodes accumulating** — `<FloatingNumber>` elements may not unmount cleanly. Check setTimeout cleanup chain.

5. **Audio context drone overlap** — each stage spawns 2 oscillators. If old drone's oscillators aren't stopped on crossfade, they accumulate.

6. **React re-renders** — `<ParticleField>` should re-render minimally. If `useEffect` dependency arrays are wrong, it re-mounts every frame.

7. **Canvas not clearing** — verify `ctx.clearRect(0, 0, w, h)` happens at frame start.

### 13.3 Profiling adds

Add a dev-only FPS overlay that displays frame time:

```tsx
// components/PerfOverlay.tsx
export function PerfOverlay() {
  const [fps, setFps] = useState(60);
  useEffect(() => {
    let lastT = performance.now();
    let frames = 0;
    const id = setInterval(() => {
      frames++;
      if (frames % 60 === 0) {
        const now = performance.now();
        setFps(Math.floor(60 * 1000 / (now - lastT)));
        lastT = now;
      }
    }, 16);
    return () => clearInterval(id);
  }, []);
  return <div className="perf-overlay">{fps} FPS</div>;
}
```

In ParticleField, log to console every 5 seconds (dev only):

```ts
if (isDev && (now - lastDebugLog > 5000)) {
  console.debug('perf', {
    stage: state.stageIdx + 1,
    bursts: world.bursts.length,
    flyers: world.flyers.length,
    motes: world.cluster.motes.length,
    floats: floatingEntries.length,
    rogues: world.rogues.length,
    shockwaves: world.shockwaves.length,
  });
  lastDebugLog = now;
}
```

If any number grows monotonically across stages, that's the leak.

### 13.4 Hard caps everywhere

```ts
// constants.ts
MAX_BURSTS_PER_FRAME: 200,
MAX_FLYERS: 80,
MAX_WAKE_TRAILS: 40,
MAX_SHOCKWAVES: 8,
MAX_FLOATING_NUMBERS: 60,

// In ParticleField:
if (world.bursts.length > MAX_BURSTS_PER_FRAME) {
  world.bursts.splice(0, world.bursts.length - MAX_BURSTS_PER_FRAME);
}
// Similar for other collections.
```

### 13.5 Mote count safety

In late stages, allow mote merging to reduce count. Cap mote count at 60:

```ts
if (world.cluster.motes.length > 60) {
  // Force-merge the smallest motes
  world.cluster.motes.sort((a, b) => a.mass - b.mass);
  while (world.cluster.motes.length > 50) {
    const sacrifice = world.cluster.motes.shift();
    if (sacrifice) world.cluster.motes[0].mass += sacrifice.mass;
  }
}
```

### 13.6 Acceptance

- Stage 16 frame rate ≥ 50 fps on a typical mobile device.
- Console log shows bounded collection sizes.
- Manual: 1 hour of play in stage 8 → no fps degradation.

---

## 14. Module V6-N — UI Text Consolidation

### 14.1 Cleanup top of screen

Remove from main canvas:
- "Outcome 21/s" (currently shown both at top and bottom — keep only bottom).
- Stage description text (e.g., "the fusion window is brief").
- Stage flavor quotes that pop up on click bursts.

### 14.2 Top header

Show only:
- Cosmic time display (with current era label next to it: "Cosmic Time: 380 Kyr — Recombination").
- Entropy badge.
- Universe badge (if universeCount > 1).
- Mute / Reset buttons.
- Cosmic time and stage TITLE (e.g., "Nucleosynthesis") combined.

### 14.3 Stage label

```
┌─────────────────────────────────────┐
│ Cosmic Time: 254 Kyr · Recombination │
│ Entropy: 84  ⏸  ⟲                   │
└─────────────────────────────────────┘
```

Stage description is gone. Just the title.

### 14.4 Move all flavor text to almanac

In `almanac.ts`, ensure every flavor line is captured under the appropriate stage entry:

- Click-burst quotes ("the fusion window is brief").
- Stage transitions previously had inline quotes.
- All stage-specific flavor.

The user can read this in the Almanac modal. The main game canvas is text-free.

### 14.5 Acceptance

- Main game canvas shows no flavor text — only sprites and particles.
- Top header shows only cosmic time + stage title + entropy + buttons.
- All flavor text accessible via Almanac modal (i icon).

---

## 15. Module V6-O — Skills + Shop at Bottom Layout

### 15.1 Layout

Move Skills button and Shop button to a horizontal bar at the bottom of the screen, below StatsRow:

```
┌─────────────────────────────────────────────────────┐
│           [GAME CANVAS]                              │
├─────────────────────────────────────────────────────┤
│  Quanta gauge + Time gauge                           │
│  Click | Auto | Crit | Time stats                    │
├─────────────────────────────────────────────────────┤
│            [SKILLS]   [SHOP]                         │
└─────────────────────────────────────────────────────┘
```

Buttons are wide (20 % screen width each), tall (60 px), prominent.

### 15.2 Skills panel slide-up

When opened, the Skills panel slides UP from the bottom (instead of from the right). On mobile this is more thumb-friendly.

```css
.skills-panel {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: 80%;
  transform: translateY(100%);
  transition: transform 0.3s ease-out;
}
.skills-panel.open {
  transform: translateY(0);
}
```

Same for Shop panel.

### 15.3 Acceptance

- Buttons row visible at bottom of screen.
- Tapping Skills slides panel up from bottom.
- Tapping Shop slides shop panel up similarly.

---

## 16. Module V6-P — The End Silence + Big Bang Restart Cinematic

### 16.1 The End ambient silence

In `mechanics/ending_choice.ts` or `audio.ts`:

When entering stage 16 (The End), set ambient drone to muted:

```ts
case 'STAGE_TRANSITION_TO_16':
  soundManager.fadeOutAmbient(2000);  // 2s fadeout
  soundManager.muteAmbient = true;
```

Click sounds still play. Background music is silent.

### 16.2 Big Bang restart cinematic

When the player clicks "Reinitiate Big Bang" (final screen prestige button):

```tsx
// components/BigBangCinematic.tsx
export function BigBangCinematic({ onComplete }: { onComplete: () => void }) {
  // 3-second cinematic:
  // 0–0.5s: complete black, silence
  // 0.5–1.0s: tiny bright dot appears at center, growing
  // 1.0–2.0s: dot expands outward at increasing rate
  // 2.0–3.0s: full screen flashes white, fades out
  // After 3s: onComplete fires (transitions to stage 1 of new universe)
  
  useEffect(() => {
    const timer = setTimeout(onComplete, 3000);
    return () => clearTimeout(timer);
  }, [onComplete]);
  
  // SVG/canvas animated big bang scene
  return (
    <div className="bigbang-cinematic">
      <canvas ref={canvasRef} />
    </div>
  );
}
```

Audio: play `playBigBang()` during the cinematic with the dramatic burst sound.

### 16.3 Acceptance

- Stage 16 entry: ambient drone fades out, only click sounds remain.
- "Reinitiate Big Bang" button click: 3s cinematic plays before next universe starts.

---

## 16.5 Module V6-Q — Stage Transition Cinematic (Zoom-In/Zoom-Out)

### 16.5.1 The vision

User: "다음 스테이지 갈 때 팡 터지고 메세지 뜬 다음에 줌아웃 하는 느낌으로 쓕 느낌을 주고. 스케일도 같이 변화는 애니매이션을 넣어서 쭉 줌아웃 되는 느낌을 주자. 그 대신, 갤럭시랑 솔러 시스템 지구는 줌인이니깐, 스테이지별로 줌인 줌아웃 잘 구분해보고."

Translation: when advancing stage, give a "bang explodes → message appears → zoom out" feel, with the scale indicator changing along with it. BUT galaxy / solar system / Earth are zoom-INs, so distinguish per stage.

### 16.5.2 Per-stage zoom direction

Each stage has a `zoomDirection: 'in' | 'out' | 'none'` indicating how the cinematic should feel when ENTERING this stage from the previous one:

| Entering stage | Feel | Zoom |
|---|---|---|
| 1 Inflation | from "before universe" | none |
| 2 Baryogenesis | universe expanding | **out** |
| 3 QGP | larger view | **out** |
| 4 Nucleosynthesis | hadrons → broader plasma | **out** |
| 5 Recombination | atoms → broader space | **out** |
| 6 Cosmic Dark Age | huge empty universe | **out** (very strong) |
| 7 First Stars | first lights in vast dark | **out** |
| 8 Reionization | universe-wide ionization | **out** |
| 9 Galaxy Formation | structure emerging | **out** |
| 10 Solar System | **zoom into one star** | **in** |
| 11 Life on Earth | **zoom into one planet** | **in** |
| 12 Death of Star | back out to solar system | **out** |
| 13 Stelliferous End | universe-wide death | **out** (very strong) |
| 14 Degenerate Era | cosmic-scale silence | **out** |
| 15 Black Hole Era | one black hole detail | **in** |
| 16 The End | cosmic-scale cooling | **out** (final) |

Add `zoomDirection: 'in' | 'out' | 'none'` to each `Stage` definition in `stages.ts`.

### 16.5.3 Cinematic timeline

When `ADVANCE_STAGE` fires:

```
0 ms  ──────  CONDENSE_IMPLOSION begins (existing — bursts, shockwave, sound)
500 ms ─────  Stage transition wash (white flash + sound: playCondenseExplosion)
            ↓
800 ms  ────  Quote overlay appears with stage NUMBER + TITLE only
            ↓
1500 ms ────  Quote dismissed; player presses "Continue →" (or auto-advance after 2 s)
            ↓
1500 ms ────  ZOOM CINEMATIC begins:
            - 'out': camera scales DOWN (objects shrink, scale indicator changes)
            - 'in': camera scales UP (objects grow, scale indicator changes)
            - 'none': no zoom, just fade
2500 ms ────  Cinematic ends; new stage interactive
```

### 16.5.4 Implementation

Add a transient transition state to game state:

```ts
// types.ts
export interface TransitionState {
  active: boolean;
  startedAt: number;
  zoomDirection: 'in' | 'out' | 'none';
  fromStageId: number;
  toStageId: number;
}
```

In `ParticleField.tsx`, during a transition:

```ts
function applyZoomTransform(ctx: CanvasRenderingContext2D, transition: TransitionState, now: number): void {
  if (!transition.active) return;
  const elapsed = now - transition.startedAt;
  const totalDuration = 1000;  // 1s zoom
  const t = Math.min(1, elapsed / totalDuration);
  const eased = 1 - Math.pow(1 - t, 3);  // ease-out cubic
  
  let scale = 1;
  if (transition.zoomDirection === 'out') {
    scale = 1 - eased * 0.7;        // shrink to 30 %
  } else if (transition.zoomDirection === 'in') {
    scale = 1 + eased * 4;          // grow to 5x
  }
  
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.scale(scale, scale);
  ctx.translate(-width / 2, -height / 2);
}

function endZoomTransform(ctx: CanvasRenderingContext2D): void {
  ctx.restore();
}
```

Wrap all rendering inside `applyZoomTransform` / `endZoomTransform` during the transition window.

### 16.5.5 Scale indicator animates too

The bottom-left Scale Indicator (V6-D) animates its label across the transition. When entering stage 5 → 6 (zoom-out), the scale label transitions from "100 km" → "100 m" with a sliding number animation (0.5 s).

### 16.5.6 Reverse-tween at end of transition

The zoom should ease into a "settle" frame at the new stage's natural scale:

```
Zoom-out cinematic:
  scale 1.0 → 0.3 (during 1s)
  → at 1s, render the new stage at scale 1.0 (snapped — feel: "we landed at a wider view")
Zoom-in cinematic:
  scale 1.0 → 5.0 (during 1s)
  → at 1s, render the new stage at scale 1.0 (snapped — feel: "we zoomed into a closeup")
```

The "snap" is intentional — gives the feeling of arriving at the new perspective.

### 16.5.7 Acceptance

- Transition from stage 1 → 2: zoom-out felt (objects shrink during 1 s).
- Transition from stage 9 → 10: zoom-in felt (galaxy → solar system close-up).
- Transition from stage 11 → 12: zoom-out (back from Earth surface to solar system).
- Transition from stage 15 → 16: strong zoom-out (cosmic scale).
- Scale indicator label visibly animates across each transition.

---

## 16.6 Module V6-R — Planet-Eating Lag Targeted Fix

### 16.6.1 The complaint

"렉 걸리는게 행성 같은 것을 많이 먹으면 렉 걸리는 거 같긴 해."

Translation: lag worsens specifically when many planets are eaten (encounter consumption).

### 16.6.2 Diagnose

Suspected causes:
1. Each "consumed" planet leaves a residual particle effect that's never cleaned up.
2. Encounter array (`world.rogues`) accumulates "deceased" entries instead of removing them.
3. Burst particles from consumption never dispose.
4. Planet-consumed flash effects (in stage 12) leak.

### 16.6.3 Fix

Audit each "consume" path:

```ts
// mechanics/red_giant.ts (or wherever planet swallow happens)
function consumePlanet(world: CanvasWorld, planetId: string): void {
  // 1. Remove planet from list
  const idx = world.planetsRemaining.findIndex((p) => p.id === planetId);
  if (idx >= 0) world.planetsRemaining.splice(idx, 1);
  
  // 2. Spawn ONE consumption flash (capped at 3 active flashes)
  if (world.activeFlashes.length < 3) {
    world.activeFlashes.push({ id: nextId(), x: ..., y: ..., startedAt: now, durationMs: 800 });
  }
  
  // 3. Cleanup flashes that have expired
  world.activeFlashes = world.activeFlashes.filter((f) => now - f.startedAt < f.durationMs);
  
  // 4. Don't keep dead planets in any structure.
}
```

Verify in every `mechanic.onTick`:
- All transient effects are cleaned up after their duration.
- Ledgers (`world.activeFlashes`, `world.consumedPlanets`, etc.) don't grow unbounded.

### 16.6.4 Encounter array cleanup

In `ParticleField.tsx` encounter update loop:

```ts
world.rogues = world.rogues.filter((r) => {
  return r.age < TUNING.ROGUE_EXPIRE_MS && r.distance < TUNING.ROGUE_DESPAWN_DISTANCE_FRAC * Math.max(width, height);
});
```

If a rogue is consumed (collision), it must be removed from the array immediately, not just marked.

### 16.6.5 Add a "consumed entity counter" log

Dev mode:

```ts
console.debug('consumed', {
  planets: world.consumedPlanets?.length ?? 0,
  flashes: world.activeFlashes?.length ?? 0,
  rogues: world.rogues.length,
  bursts: world.bursts.length,
});
```

If `flashes` or `consumedPlanets` grows monotonically, that's the bug.

### 16.6.6 Acceptance

- Stage 12 with all 9 planets eaten: frame rate stable.
- Console log: `flashes` array doesn't grow above 3.
- Stage 8 with 50+ encounters consumed across the stage: frame rate stable.

---

## 17. Implementation Order

| # | Module | Hours | Priority |
|---|---|---|---|
| 1 | V6-M (lag fix) | 8 | **P0** |
| 2 | V6-F (logarithmic time) | 8 | **P0** |
| 3 | V6-G (10× skills + cross-node connections) | 6 | P0 |
| 4 | V6-L (quanta carry verify) | 2 | P0 |
| 5 | V6-K (Earth, Death, Black Hole animations) | 12 | P0 |
| 6 | V6-J (animations driven by cosmic time) | 4 | P1 |
| 7 | V6-N (UI text consolidation) | 4 | P1 |
| 8 | V6-O (skills + shop bottom layout) | 4 | P1 |
| 9 | V6-E (stats panel to bottom) | 3 | P1 |
| 10 | V6-D (scale indicator) | 2 | P1 |
| 11 | V6-A (universal distance display) | 3 | P1 |
| 12 | V6-B (multi-emission text overlap) | 2 | P2 |
| 13 | V6-C (curved click trajectories) | 4 | P2 |
| 14 | V6-H (SP cross-node verification) | 3 | P2 |
| 15 | V6-I (active boost HUD + stacking) | 4 | P2 |
| 16 | V6-P (The End silence + Big Bang cinematic) | 4 | P2 |
| 17 | V6-Q (zoom-in/out stage transitions) | 6 | P1 |
| 18 | V6-R (planet-eating lag targeted fix) | 4 | P0 |
| 19 | Save migration v6 → v7 | 2 | P2 |
| **Total** | | **~85 hours = ~10.5 days** | |

---

## 18. Definition of Done

After all V6 modules:

1. `npm run build` passes; no TypeScript errors.
2. `npm test` passes; all integration tests included.
3. `npm run sim` reports total time in [80, 130] hours, per-stage ±30 %.
4. Manual playthrough on a fresh save:
   - Stages 1–4 clearable without Aeon Drive investment.
   - Stage 5 requires Aeon Lv 5+; impossible without.
   - Stage 16 requires Aeon Lv 110+; impossible without.
   - Click power scales 10× per Stellar Forge level.
   - Time multiplier displays as `×10ⁿ` notation.
   - Stats row at bottom shows click/auto/crit/time stats.
   - Scale indicator at bottom-left shows current era's scale (e.g., "100 km").
   - All distant objects show distance label (nm/mm/m/km/AU/ly/Mpc per stage).
   - Multi-click emissions don't overlap visually.
   - Click flyers travel curved Bezier paths.
   - Stage 11: Earth visibly transforms (molten → moon → cooling → water → continents → green → civ flicker → Mars-like).
   - Stage 12: Sun expands, swallows planets in order, each consumption flashes.
   - Stage 15: Black hole smooth, shrinks gradually, particles orbit horizon (don't fall in).
   - Stage animations driven by cosmic time, not click count.
   - Cosmic clock continues monotonically; never resets.
   - Quanta excess carries between stages.
   - Cross-nodes show visible connecting lines to prereqs.
   - Shop boosts stack: buy time-mult 5 times → composite ×32.
   - Active Boost HUD shows composed multipliers and remaining time.
   - SP cross-nodes never auto-grant; always require explicit purchase.
   - The End: ambient drone fades out; only click sounds.
   - Reinitiate Big Bang: 3 s cinematic plays.
5. Stage 16 frame rate ≥ 50 fps; no progressive lag.
6. Save migration v6 → v7 succeeds.

---

## 19. Quality Bar

- **No decimals** in displayed numbers.
- **No CSS blur effects** (still).
- **All click events register** (V5-I held).
- **Mobile hit targets ≥ 44 px**.
- **Text-selection disabled**.
- **English code comments only**.
- **Pure reducer**.
- **Per-stage performance**: stage 16 must perform as well as stage 1.

---

End of V6 specification.
