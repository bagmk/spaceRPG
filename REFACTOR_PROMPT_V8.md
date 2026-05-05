# Cosmic Coalescence — Refactor V8 Specification

> **Audience**: Autonomous coding agent with full repo access.
> **Mode**: Plan-then-execute. Run `npm run build && npm test` after every module.
> **Status**: Builds on V1–V7. **V8 supersedes parts of V7** — see §0.1.

V8 fixes the issues observed after V7 was implemented. From the user's screenshots and notes:

1. **Cross-nodes should not be stage-gated** — they unlock based on track level only.
2. **Quanta growth too explosive** — V7's 10× per level broke balance. Reduce to 2× per level for click/auto skills.
3. **Time progress not visible** — add a time progress bar in the HUD widget (after stage + quanta).
4. **Time flow rate must be constant across stages** — no per-stage normalization. Aeon Drive level alone determines rate.
5. **Distance display caps wrong** — "100 AU" doesn't update as encounter goes farther.
6. **Scale numbers don't match visual reality** — "1 AU scale" but 100 AU encounter looks 1 AU away. Compute consistently.
7. **Remove top message overlay on stage transition** — already shown in HUD widget.
8. **Remove Skill Pack from shop** — only sell time and quanta boosts.
9. **Last skill popup cut off at bottom** — auto-flip to show above.
10. **Skill popup info too verbose** — show only name, cost, "After: ...".
11. **Visual artifacts behind canvas after level-up** — particle trails visible. Investigate.
12. **Solar System shows standalone Earth** — must show only sun + small planet dots, no separate large Earth sprite.
13. **Stages 12, 15, 16 don't advance** — condense / advance broken.
14. **Black hole grows instead of shrinks** — direction reversed.

Implementation order: V8-A → V8-N (see §15). Each module is independently testable.

---

## 0. V8 Supersedes V7 — Reconciliation

### 0.1 Direct conflicts

| Topic | V7 said | V8 says | Action |
|---|---|---|---|
| Click/Auto effect per level | `10^level` | `2^level` | Replace |
| Crit effect per level | `1.5 + 0.3 * level` | unchanged | — |
| Time effect per level | `10^level` | `10^level` (kept) | — |
| Quanta upgrade cost | `2^level` | `2^level` (kept) | — |
| Time upgrade cost | `10^level` | `10^level` (kept) | — |
| Cross-node unlock | Was tied to track level requirement | Stays — but NEVER gated by stage | Remove any stage check |
| Time gauge fills in target real-time per stage | (V5-G's stageMod) | Time fills at constant cosmic rate; per-stage target is COSMIC time span | Remove stageMod; rate is global |
| Stage transition top toast | Small message at top after stage start | Remove entirely; HUD widget shows current stage | Delete dispatch |
| Cash shop Skill Pack | Sells SP for $1.99 | Removed | Delete from SHOP_ITEMS |
| Solar System (Stage 10) Earth | Earth shown as growing planet from phase 2 | Earth NOT shown standalone — only orbits | Refactor `drawSolarSystem` |
| Skill popup content | Detailed multi-line | Just: name, cost, "After: X" | Trim popup |
| Distance label | Caps at 100 AU | Uncapped; uses scale-pixel ratio | Compute from screen scale |

### 0.2 V7 features V8 keeps

- Big Bang opening cinematic (V7-A).
- Cosmic time start at `1e-34` s (V7-B).
- UI minimalism layout — top-left HUD widget, bottom-right floating buttons (V7-C).
- Universal distance label concept (V7-D) — but compute correctly per V8-F.
- Zoom timing after quote dismiss (V7-E).
- Skill click → popup (V7-G) — minimal info per V8-J.
- Cross-node SP-buyable per milestone (V7-H) — but level-only gating per V8-A.
- Big Bang reset stats (V7-J).
- Intro text overlap fix (V7-K).
- Ending conditions display (V7-L).
- Earth scale + AU/ly tooltips (V7-M).

---

## 1. Module V8-A — Cross-Node Level-Only Unlock

### 1.1 Goal

User: "크로스 노드는, unlock을 스테이지에서 언락가능하게 하지 말고 레벨이 맞으면 언락할 수 있게 해줘야지."

Cross-nodes unlock based purely on track level reaching the milestone. NO stage gate.

### 1.2 Audit

Find any code that checks `state.stageIdx` for cross-node visibility/buyability. Remove those checks. The only requirement is:

```ts
function canBuyCrossNode(state: GameState, def: CrossNodeDef): boolean {
  if (state.skills.ownedCrossNodes.includes(def.id)) return false;
  if (state.skills[def.trackId].level < def.requiredLvl) return false;
  if (state.skillPoints < def.cost) return false;
  return true;
}
```

No stage check. The cross-node SVG icon next to a milestone slot is shown regardless of stage.

### 1.3 Visibility in tree

Cross-nodes are always rendered in the tree (with appropriate state — locked/available/owned). They are not "hidden" by stage progression.

### 1.4 Acceptance

- A player at stage 4 with Stellar Forge level 5 can buy `click_lv5` cross-node (assuming they have SP).
- A player at stage 16 cannot buy `click_lv30` cross-node unless their click level is 30.

---

## 2. Module V8-B — Skill Effect 2× Per Level (Click/Auto)

### 2.1 Goal

User: "Quanta 증가 속도가 너무 커서 게임이 붕괴가 되어버렸어. 10배씩 증가하는 건 너무 크다. 2배 정도면 충분할거 같아."

Click and Auto skill effects must scale 2× per level, not 10×.

### 2.2 New formulas

```ts
// formulas.ts
const BASE_CLICK = 1;
const BASE_AUTO = 0;

export function getClickPower(clickLevel: number, mods: Modifiers): number {
  return BASE_CLICK * Math.pow(2, clickLevel) * mods.clickPowerMult;
}
// Lv 0: 1, Lv 5: 32, Lv 10: 1024, Lv 20: ~1e6, Lv 30: ~1e9

export function getAutoRate(autoLevel: number, mods: Modifiers): number {
  if (autoLevel === 0) return 0;
  return Math.pow(2, autoLevel) * mods.autoRateMult;
}
// Lv 0: 0, Lv 5: 32/s, Lv 10: 1024/s, Lv 20: ~1M/s, Lv 30: ~1B/s

export function getCritMultiplier(critLevel: number, mods: Modifiers): number {
  return Math.max(1.5, 1.5 + critLevel * 0.3) * mods.critMultMult;
  // unchanged
}

export function getTimeFillRate(aeonLevel: number, mods: Modifiers): number {
  // Time stays at 10^level — it MUST scale through 1e110 cosmic seconds
  return 1.0 * Math.pow(10, aeonLevel) * mods.timeMult * mods.apexMult;
}
```

### 2.3 Cost adjustments

Skill costs stay at `2^level` (V7-I), but rebalance thresholds since power growth is gentler now:

| stage | threshold |
|---|---|
| 1 | 5 |
| 2 | 100 |
| 3 | 5,000 |
| 4 | 200,000 |
| 5 | 5,000,000 |
| 6 | 1e8 |
| 7 | 1e10 |
| 8 | 1e12 |
| 9 | 1e14 |
| 10 | 1e16 |
| 11 | 1e18 |
| 12 | 1e21 |
| 13 | 1e25 |
| 14 | 1e30 |
| 15 | 1e36 |
| 16 | 1e44 |

Threshold growth ~10–100x per stage matches the 2× skill scaling — players need to invest in many levels per stage.

### 2.4 Cross-node multipliers

Cross-nodes still apply 2x → 1000x effect (V7-H). With 2× base scaling, cross-nodes provide significant boosts that justify their SP cost.

### 2.5 Acceptance

- Stage 1: at click Lv 0 (= 1 click power), threshold 5 → 5 clicks to clear.
- At click Lv 5 (= 32 click power), stage 5 threshold 5e6 → ~156,250 clicks (impossible alone — must invest in auto and Aeon Drive).
- `npm run sim` reports total time within [80, 130] hours under moderate skill investor policy.

---

## 3. Module V8-C — Time Progress Bar in HUD

### 3.1 Goal

User: "시간의 흐름 밑에 프로그레스 바를 보여줘야 시간이 흐르는 것을 알수 있지. 즉 스테이지 먼저 보이고 콴타 보이고 그후에 시간과 프로그래스 바 이렇게 해줘."

HUD widget order: Stage → Quanta → Cosmic Time + Progress Bar.

### 3.2 Implementation

```tsx
// components/HudOverlay.tsx
export function HudOverlay({ state, stage }: HudProps) {
  const cosmicTime = getDisplayedCosmicTime(state);
  const cosmicTimeProgress = getCosmicTimeProgressInStage(state, stage);

  return (
    <div className="hud-overlay">
      <div className="hud-stage-title">{`Stage ${stage.id}: ${stage.name}`}</div>
      <div className="hud-quanta">{`Quanta ${formatWhole(state.quanta)} / ${formatWhole(stage.threshold)}`}</div>
      <div className="hud-quanta-bar">
        <div className="hud-quanta-fill" style={{ width: `${(state.quanta / stage.threshold) * 100}%` }} />
      </div>
      <div className="hud-time-label">{formatCosmicTime(cosmicTime)}</div>
      <div className="hud-time-bar">
        <div className="hud-time-fill" style={{ width: `${cosmicTimeProgress * 100}%` }} />
      </div>
    </div>
  );
}

function getCosmicTimeProgressInStage(state: GameState, stage: Stage): number {
  const prevStage = state.stageIdx === 0 ? null : STAGES[state.stageIdx - 1];
  const stageStart = prevStage?.cosmicTimeSec ?? 1e-34;
  const stageEnd = stage.cosmicTimeSec;
  const cumulative = state.cumulativeCosmicTime;
  const progress = (cumulative - stageStart) / (stageEnd - stageStart);
  return Math.max(0, Math.min(1, progress));
}
```

### 3.3 Visual order

Top-left HUD widget renders:
```
Stage 5: Recombination
Quanta 1,250 / 100,000
[==>------] 12%
1.2e3 s
[========>-] 87%
```

Each progress bar is a thin horizontal bar (3 px tall). Quanta is amber; time is blue.

### 3.4 Acceptance

- HUD widget shows two stacked progress bars (quanta + time).
- Time bar visibly fills as cosmic clock advances.
- Bar shows fraction within current stage's cosmic span.

---

## 4. Module V8-D — Constant Time Flow Rate

### 4.1 Goal

User: "시간 흐르는 거 새 스테이지 가도 원래 흐르던 시간 그대로 e-32 라면 e-32 그대로 흐르게 해서 업그레이드를 해야 시간이 흐를 수 있게."

Time flow rate is global (depends only on Aeon Drive level), not stage-normalized. Stage advance does NOT change the rate.

### 4.2 Behavior

```
At Aeon Lv 0: 1 cosmic-sec / real-sec.
At Aeon Lv N: 10^N cosmic-sec / real-sec.

Stage 1 cosmic span = 1e-32 - 1e-34 ≈ 1e-32 s
  → at Lv 0 fills in 1e-32 real-sec ≈ instant.
Stage 2 span ≈ 1e-12 s
  → at Lv 0 fills in 1e-12 real-sec ≈ instant.
Stage 5 span ≈ 1.2e13 s
  → at Lv 0 fills in 1.2e13 real-sec ≈ 380,000 years (impossible without upgrade).
Stage 16 span ≈ 1e110 s
  → at Lv 0 fills in 1e110 real-sec ≈ impossible.
  → at Aeon Lv 105 (10^105×): 1e110 / 1e105 = 1e5 sec ≈ 28 hours.
```

### 4.3 Implementation

```ts
// formulas.ts
export function getCosmicTimeFillRate(aeonLevel: number, mods: Modifiers): number {
  // Returns cosmic-seconds per real-second.
  // Constant baseline; only Aeon level + apex/cross-nodes/shop boosts modify it.
  return 1.0 * Math.pow(10, aeonLevel) * mods.timeMult * mods.apexMult;
}
```

The TICK reducer uses this rate:

```ts
case 'TICK': {
  const dt = action.dt;          // real ms
  const dtSec = dt / 1000;
  const rate = getCosmicTimeFillRate(state.skills.time.level, modifiers);
  const cosmicAdvance = rate * dtSec;
  return {
    ...state,
    cumulativeCosmicTime: state.cumulativeCosmicTime + cosmicAdvance,
    // ... other fields
  };
}
```

NO stage-based modifier on the rate. The rate is the same whether you're in stage 1 or stage 16.

### 4.4 Stage advance condition

```ts
function canCondense(state: GameState, modifiers: Modifiers): boolean {
  if (state.completedRun || state.pendingCondenseStageIdx !== null || state.imploding) return false;
  const stage = STAGES[state.stageIdx];
  return state.quanta >= stage.threshold && state.cumulativeCosmicTime >= stage.cosmicTimeSec;
}
```

### 4.5 Acceptance

- Stage 1 with Aeon Lv 0: cosmic clock fills its tiny span almost instantly. Player only blocked by quanta.
- Stage 5 with Aeon Lv 0: cosmic clock barely moves. Player CANNOT advance even if quanta full.
- Buying Aeon Lv 5 → rate × 100,000 → stage 5 advances in ~hours.
- Buying Aeon Lv 100 → rate × 10^100 → late stages playable.

---

## 5. Module V8-E — Distance Display Uncapped

### 5.1 Goal

User: "100 AU 이상부터는 거리가 안 바뀌네, 그렇다면 100 AU+ 라는 식으로 해줘야지."

Distance label should not cap. If physical position implies > 100 AU, show actual or `100AU+`.

### 5.2 Implementation

```ts
function formatEncounterDistance(stageId: number, pixelDistance: number, screenScale: ScaleInfo): string {
  // Compute real distance from pixel and scale.
  const realDistance = pixelDistance * (screenScale.value / screenScale.length);
  const cap = 1000 * screenScale.value;  // cap at 1000x scale
  if (realDistance > cap) {
    return `${formatWhole(cap)}+ ${screenScale.unit}`;
  }
  return `${formatWhole(realDistance)} ${screenScale.unit}`;
}
```

### 5.3 Acceptance

- Stage 10 with scale "1 AU = 50 px": encounter at 200 px from center → "4 AU".
- Encounter at 5000 px (off-screen position) → "100 AU+" (capped).
- All distance labels use the same calculation (no inconsistency).

---

## 6. Module V8-F — Scale Calculation Rework

### 6.1 The bug

User: "1 AU 스케일이라면서 100 AU가 마치 1 AU 거리같아. 스케일이 조금 이상해. 모든 곳에서 스케일 아무렇게나 한 거 같은데?"

Scale labels disagree with visual positioning. Encounter at 100 AU appears at 1 AU's screen position.

### 6.2 Root cause

The encounter's `x, y` are pixel coordinates within the screen. The scale label is independent. If we don't compute label from pixels, they decouple.

### 6.3 Fix

For every distance display (encounter labels + scale indicator):
- Pull pixels from canvas.
- Pull "scale value per pixel" from the active stage's scale info.
- Multiply: `realDistance = pixelDistance * (scaleValue / scaleLengthPixels)`.

```ts
// types.ts
export interface ScaleInfo {
  length: number;   // pixels for the scale bar
  value: number;    // real units corresponding to length
  unit: string;     // 'AU', 'ly', etc.
}

export function getStageScaleInfo(stageId: number): ScaleInfo {
  // Same table as V7-M but verified:
  if (stageId === 1)  return { length: 50, value: 100, unit: 'ym' };       // yoctometer
  if (stageId === 2)  return { length: 50, value: 100, unit: 'am' };
  if (stageId === 3)  return { length: 50, value: 100, unit: 'fm' };
  if (stageId === 4)  return { length: 50, value: 10,  unit: 'pm' };
  if (stageId === 5)  return { length: 50, value: 100, unit: 'nm' };
  if (stageId === 6)  return { length: 50, value: 100, unit: 'm' };
  if (stageId === 7)  return { length: 50, value: 100, unit: 'ly' };
  if (stageId === 8)  return { length: 50, value: 1000, unit: 'ly' };
  if (stageId === 9)  return { length: 50, value: 100_000, unit: 'ly' };   // Milky Way diameter
  if (stageId === 10) return { length: 50, value: 40, unit: 'AU' };       // out to Pluto
  if (stageId === 11) return { length: 50, value: 13_000, unit: 'km' };   // Earth diameter
  if (stageId === 12) return { length: 50, value: 1, unit: 'AU' };
  if (stageId === 13) return { length: 50, value: 1000, unit: 'ly' };
  if (stageId === 14) return { length: 50, value: 10, unit: 'kpc' };
  if (stageId === 15) return { length: 50, value: 1, unit: 'Mpc' };
  return                       { length: 50, value: 100, unit: 'Gpc' };
}
```

The `length: 50` and `value: X` together state: "50 px on screen = X units of `unit`".

For encounter distance:

```ts
const scale = getStageScaleInfo(stageId);
const pixelDist = Math.sqrt((rogue.x - cx) ** 2 + (rogue.y - cy) ** 2);
const realDist = pixelDist * (scale.value / scale.length);
return `${formatWhole(realDist)} ${scale.unit}`;
```

Now if stage 10 scale is "1 AU per 50 px", encounter at 200 px from center = 200 * (1/50) = 4 AU. Consistent.

### 6.4 Sanity check

Encounter at screen edge (~700 px from center on 1920x1080 → 1080/2 = 540 px diagonal): 540 * (1/50) = 10.8 AU. So a stage 10 encounter at the screen edge labels "10 AU". Reasonable.

### 6.5 Acceptance

- Stage 10 encounter near center: < 5 AU label.
- Stage 10 encounter near screen edge: ~10–15 AU label.
- Scale indicator and encounter labels use IDENTICAL value-per-pixel ratio.

---

## 7. Module V8-G — Remove Top Stage Transition Toast

### 7.1 Goal

User wants the small toast at top after stage transition removed. The HUD widget already shows the stage name.

### 7.2 Implementation

In `GameScreen.tsx` or wherever stage transitions emit a toast/encounter alert with the stage name, remove that dispatch:

```ts
// REMOVE this:
// dispatch({ type: 'REPORT_ENCOUNTER', name: `Stage ${nextStage.id}: ${nextStage.name}`, color: nextStage.accent });

// Just rely on the HUD widget to show the new stage
```

If there's a `<EncounterAlert>` component that auto-shows for stage transitions, gate it to only show for actual encounters (rogue collisions), not stage transitions.

### 7.3 Move to info

If you wish, the stage transition can append a brief log entry to the Almanac/Info panel (history view). But don't display in the canvas.

### 7.4 Acceptance

- Stage transition: no toast appears at top.
- HUD widget updates to show new stage immediately.

---

## 8. Module V8-H — Remove Skill Pack from Shop

### 8.1 Update SHOP_ITEMS

```ts
// src/game/shop/items.ts
export const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'time_boost',
    label: 'Quick Time Boost',
    description: 'Time × 10 for 10 minutes.',
    priceUSD: 0.99,
    applyEffect: (s) => ({
      ...s,
      shopBoosts: [
        ...(s.shopBoosts ?? []),
        { id: `time_${Date.now()}`, factor: 10, expiresAt: Date.now() + 10 * 60_000 },
      ],
    }),
  },
  {
    id: 'cosmic_surge',
    label: 'Cosmic Surge',
    description: 'Quanta × 3 for 30 minutes.',
    priceUSD: 2.99,
    applyEffect: (s) => ({
      ...s,
      shopBoosts: [
        ...(s.shopBoosts ?? []),
        { id: `quanta_${Date.now()}`, factor: 3, expiresAt: Date.now() + 30 * 60_000 },
      ],
    }),
  },
  {
    id: 'time_boost_xl',
    label: 'Aeon Surge',
    description: 'Time × 100 for 30 minutes.',
    priceUSD: 4.99,
    applyEffect: (s) => ({
      ...s,
      shopBoosts: [
        ...(s.shopBoosts ?? []),
        { id: `time_${Date.now()}`, factor: 100, expiresAt: Date.now() + 30 * 60_000 },
      ],
    }),
  },
  // skill_pack_s REMOVED
];
```

### 8.2 Acceptance

- Shop UI shows 3 items: Quick Time Boost, Cosmic Surge, Aeon Surge.
- No Skill Pack item.

---

## 9. Module V8-I — Skill Popup Edge-Aware Positioning

### 9.1 Goal

Last skill (Lv 30) popup gets cut off at bottom of screen.

### 9.2 Fix

When opening a skill popup, compute available space and position above or below as needed:

```ts
// components/skills/SkillPopup.tsx
export function SkillPopup({ anchorRect, ... }: SkillPopupProps) {
  const popupHeight = 110;  // estimated
  const popupWidth = 220;
  const margin = 8;
  
  let top = anchorRect.top - popupHeight - margin;  // try above
  let arrowDirection = 'down';                       // arrow pointing down to anchor
  
  if (top < 0) {
    // Not enough space above; flip below
    top = anchorRect.bottom + margin;
    arrowDirection = 'up';
  }
  
  // Horizontal: center on anchor, but clamp to screen
  let left = anchorRect.left + anchorRect.width / 2 - popupWidth / 2;
  left = Math.max(margin, Math.min(left, window.innerWidth - popupWidth - margin));
  
  return (
    <div className={`skill-popup arrow-${arrowDirection}`} style={{ top, left }}>
      {/* content */}
    </div>
  );
}
```

### 9.3 Acceptance

- Click Lv 1 (top of column) popup: appears above anchor.
- Click Lv 30 (bottom of column) popup: appears above anchor (auto-flipped).
- Popup never extends below screen.

---

## 10. Module V8-J — Skill Popup Minimal Content

### 10.1 Goal

User: "팝업 안에 내용이 너무 많아. 그냥 Stellar forge 하고 레벨 정보는 지워도 되고, cost, 업그레이드 하면 클릭당 얼마로 바뀌는지만 알려주고 다 지워줘."

Show only:
- Skill name (e.g., "Stellar Forge")
- Cost
- After-upgrade primary effect

### 10.2 Implementation

```tsx
// components/skills/SkillPopup.tsx
export function SkillPopup({ track, currentLevel, ... }: SkillPopupProps) {
  const cost = getSkillLevelCost(track.id, currentLevel);
  const nextEffect = computeEffectAtLevel(track.id, currentLevel + 1);
  const effectLabel = (
    track.id === 'click' ? `Click ${formatWhole(nextEffect.click)}` :
    track.id === 'auto'  ? `Auto ${formatWhole(nextEffect.auto)}/s` :
    track.id === 'crit'  ? `Crit ×${formatWhole(nextEffect.critMult)}` :
    track.id === 'time'  ? `Time ×10^${nextEffect.timeLogMult}` :
    'unknown'
  );

  return (
    <div className="skill-popup">
      <div className="skill-popup-name">{track.label}</div>
      <div className="skill-popup-cost">Cost: {formatWhole(cost)} quanta</div>
      <div className="skill-popup-effect">After: {effectLabel}</div>
      <button className="skill-popup-buy" onClick={onBuy}>BUY</button>
    </div>
  );
}
```

### 10.3 Cross-node popup

```tsx
// For cross-nodes:
return (
  <div className="skill-popup">
    <div className="skill-popup-name">{def.label}</div>
    <div className="skill-popup-cost">Cost: {def.cost} SP</div>
    <div className="skill-popup-effect">After: {effectDescription(def)}</div>
    <button className="skill-popup-buy" onClick={onBuy}>BUY</button>
  </div>
);
```

### 10.4 Remove

- "Currently active" line.
- "Lv X / Y" line.
- "Each level multiplies..." description.
- All comparison ("before / after").

### 10.5 Acceptance

- Popup shows 3 lines + button.
- Each line: skill name, cost, after.
- ≤ 100 px tall.

---

## 11. Module V8-K — Particle Trail Visual Artifact Fix

### 11.1 The bug

User screenshot shows particle trails behind clipped canvas after level-up. Likely:

1. Canvas not clearing on each frame.
2. Skill panel rendered on top without clearing canvas behind.
3. Z-index allowing canvas frame to leak.

### 11.2 Fix

In `ParticleField.tsx` render loop, ensure:

```ts
// At start of each frame
ctx.clearRect(0, 0, canvas.width, canvas.height);

// Check canvas size matches CSS size (DPR-aware)
const dpr = window.devicePixelRatio || 1;
if (canvas.width !== container.clientWidth * dpr ||
    canvas.height !== container.clientHeight * dpr) {
  canvas.width = container.clientWidth * dpr;
  canvas.height = container.clientHeight * dpr;
  ctx.scale(dpr, dpr);
}
```

### 11.3 Skill panel z-index

When skill panel opens, place a backdrop overlay (semi-transparent black) between the canvas and the panel:

```css
.skills-panel-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 100;
}
.skills-panel {
  z-index: 101;
}
```

Click on backdrop dismisses the panel.

### 11.4 Investigate transition canvas

If V7-E's crossfade uses two canvases stacked, ensure the upper canvas's `globalAlpha = 1` after transition completes; otherwise it could leave residual draws.

### 11.5 Acceptance

- After level-up: no visible particle trails outside canvas.
- After skill panel close: canvas renders cleanly.
- DPR handling correct on Retina displays.

---

## 12. Module V8-L — Solar System: No Standalone Earth

### 12.1 Goal

User: "솔러시스템에서는 이상하게 지구도 같이 나오거든 정말 싫다. 솔러시스템만 보여줘."

Stage 10 should show only the solar system (sun + planets in orbit). NOT a separate large Earth sprite.

### 12.2 Refactor `drawSolarSystem`

```ts
// canvas/drawCluster.ts

function drawSolarSystem(args: DrawClusterArgs): void {
  const { ctx, cx, cy, width, height, cumulativeCosmicTime, stage, t } = args;
  
  // Sun at center
  drawSun(ctx, cx, cy, 30);

  // Orbital paths
  const planets = [
    { name: 'Mercury', orbitR: 50,  size: 1.5, color: '#aaa' },
    { name: 'Venus',   orbitR: 80,  size: 2.0, color: '#dba' },
    { name: 'Earth',   orbitR: 110, size: 2.0, color: '#48a' },     // SMALL DOT, not separate sprite
    { name: 'Mars',    orbitR: 140, size: 1.5, color: '#d63' },
    { name: 'Jupiter', orbitR: 195, size: 5.0, color: '#dba' },
    { name: 'Saturn',  orbitR: 245, size: 4.0, color: '#cb9' },
    { name: 'Uranus',  orbitR: 285, size: 3.0, color: '#9be' },
    { name: 'Neptune', orbitR: 320, size: 3.0, color: '#39d' },
    { name: 'Pluto',   orbitR: 360, size: 1.0, color: '#ccc' },
  ];

  // Draw orbits as faint circles
  for (const planet of planets) {
    drawOrbitRing(ctx, cx, cy, planet.orbitR, 0.2);
  }

  // Draw planets at their orbital positions (slow rotation)
  for (const planet of planets) {
    const orbitT = (cumulativeCosmicTime / 31557600) % (planet.orbitR);  // simple orbit
    const angle = orbitT / planet.orbitR * Math.PI * 2;
    const px = cx + Math.cos(angle) * planet.orbitR;
    const py = cy + Math.sin(angle) * planet.orbitR;
    drawSmallPlanet(ctx, px, py, planet.size, planet.color);
  }
}

function drawSun(ctx, cx, cy, r): void {
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0, '#fff7d8');
  grad.addColorStop(0.4, '#ffd966');
  grad.addColorStop(1, '#cc8800');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawSmallPlanet(ctx, x, y, r, color): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
```

### 12.3 Stage 11 (Life on Earth) gets the Earth detail

Stage 11 should draw a single, large, detailed Earth view — that's where Earth phases (molten → moon → cooling → water → continents → civilization) belong. NOT in stage 10.

```ts
// canvas/drawCluster.ts
function drawLifeSurface(args): void {
  const { ctx, cx, cy, cumulativeCosmicTime, stage, t } = args;
  const phaseProgress = getPhaseProgress(state, stage);
  const earthRadius = 100;  // big — this is THE Earth view
  drawEarthDetail(ctx, cx, cy, earthRadius, phaseProgress, t);
}
```

### 12.4 Acceptance

- Stage 10 visual: sun + 9 small planet dots in orbits. Earth is just one of them, similar size to other inner planets.
- Stage 11 visual: single large Earth, detailed.
- No "Earth + solar system both visible" overlap.

---

## 13. Module V8-M — Stage Advance Bug Fix (12, 15, 16)

### 13.1 The bug

Death of Star (12), Black Hole (15), The End (16) don't advance to next stage.

### 13.2 Diagnose

Possible causes:
1. `stage.cosmicTimeSec` for these stages is so large that `cumulativeCosmicTime` never reaches it (related to V8-D — must invest Aeon Drive).
2. Mechanic's `onTick` blocks condense via stale flag.
3. `pendingCondenseStageIdx` stuck at non-null.
4. Special "ending" stages have different transition logic that breaks.

### 13.3 Fix

#### 13.3.1 Confirm `canCondense` works

```ts
// formulas.ts
export function canCondense(state: GameState, modifiers: Modifiers): boolean {
  if (state.completedRun) return false;
  if (state.pendingCondenseStageIdx !== null) return false;
  if (state.imploding) return false;
  const stage = STAGES[state.stageIdx];
  if (state.quanta < stage.threshold) return false;
  if (state.cumulativeCosmicTime < stage.cosmicTimeSec) return false;
  return true;
}
```

If `imploding` or `pendingCondenseStageIdx` are stuck, that's the bug. Check that:
- `STAGE_TRANSITION_TOTAL_MS` timer fires `ADVANCE_STAGE` action that resets these flags.
- The transition state machine (`bursting` → `quote` → `revealing` → `idle`) doesn't deadlock.

#### 13.3.2 Stage 16 special case

Stage 16 (The End) leads to ending choice, NOT to a 17th stage. Verify:

```ts
case 'ADVANCE_STAGE': {
  if (state.stageIdx >= STAGES.length - 1) {
    // Stage 16 → end of run
    return {
      ...state,
      pendingCondenseStageIdx: null,
      pendingCondenseEntropy: 0,
      imploding: false,
      condenseStartedAt: null,
      completedRun: true,           // triggers FinalScreen / EndingChooser
    };
  }
  // ... normal advance ...
}
```

Then `App.tsx` watches `state.completedRun` and transitions to `<FinalScreen>` or `<EndingChooser>`.

#### 13.3.3 Stage 12 / 15 should advance normally

Verify these are NOT short-circuiting in `ADVANCE_STAGE`. They must increment stageIdx like any other stage.

### 13.4 Add logging

Log every state transition in dev mode:

```ts
case 'START_CONDENSE':
case 'ADVANCE_STAGE': {
  console.debug('[transition]', action.type, {
    stageIdx: state.stageIdx,
    quanta: state.quanta,
    threshold: STAGES[state.stageIdx].threshold,
    cumulativeCosmicTime: state.cumulativeCosmicTime,
    cosmicTimeRequired: STAGES[state.stageIdx].cosmicTimeSec,
    pendingCondenseStageIdx: state.pendingCondenseStageIdx,
    imploding: state.imploding,
  });
  // ... existing logic
}
```

### 13.5 Acceptance

- Stage 12 advances when both criteria met.
- Stage 15 advances when both criteria met.
- Stage 16 transitions to FinalScreen / EndingChooser.
- Console log shows full transition info.

---

## 14. Module V8-N — Black Hole Shrink Direction Fix

### 14.1 The bug

Black hole grows over progress instead of shrinking.

### 14.2 Verify formula

```ts
function getBlackHoleRadius(progress: number, minDim: number): number {
  const initialRadius = minDim * 0.3;     // big
  const finalRadius = 5;                  // tiny
  // As progress goes 0 → 1, radius goes initialRadius → finalRadius (SHRINKING)
  return initialRadius * (1 - progress) + finalRadius * progress;
}
```

If `progress` is computed wrong (going 1 → 0 instead of 0 → 1), the formula reverses. Check:

```ts
const progress = (state.cumulativeCosmicTime - stageStart) / (stageEnd - stageStart);
// Should go 0 → 1 over stage 15.
// If it's reversed, fix the formula.
```

### 14.3 Implementation

In `drawBlackHoleScene`:

```ts
function drawBlackHoleScene(args: DrawClusterArgs): void {
  const { ctx, cx, cy, width, height, cumulativeCosmicTime, stage } = args;
  const stageStart = STAGES[13].cosmicTimeSec;       // stage 14 end
  const stageEnd = stage.cosmicTimeSec;              // stage 15 end
  const progress = Math.max(0, Math.min(1, (cumulativeCosmicTime - stageStart) / (stageEnd - stageStart)));
  
  const minDim = Math.min(width, height);
  const initialRadius = minDim * 0.30;
  const finalRadius = 5;
  // SHRINKS over progress
  const bhRadius = initialRadius * Math.pow(1 - progress, 0.7) + finalRadius * Math.pow(progress, 1.5);
  
  // ... draw using bhRadius ...
}
```

Test: at progress=0, bhRadius = 0.30 * minDim. At progress=1, bhRadius ≈ 5. Shrinks visibly.

### 14.4 Particles orbit horizon, not center

Re-confirm V6-K §11.3: motes orbit at `bhRadius * 1.2`, NOT falling into center.

### 14.5 Acceptance

- Stage 15 entry: black hole takes ~30 % of screen.
- Stage 15 mid: black hole ~15 %.
- Stage 15 end: black hole tiny (~5 px).
- Particles always remain at orbit, not falling to center.

---

## 15. Implementation Order

| # | Module | Hours | Priority |
|---|---|---|---|
| 1 | V8-M (stage advance bug 12/15/16) | 4 | **P0** |
| 2 | V8-N (black hole shrink direction) | 2 | **P0** |
| 3 | V8-B (skill effect 2× per level + threshold rebalance) | 4 | **P0** |
| 4 | V8-D (constant time flow rate across stages) | 4 | **P0** |
| 5 | V8-A (cross-node level-only unlock) | 2 | P0 |
| 6 | V8-L (Solar System without standalone Earth) | 4 | P0 |
| 7 | V8-C (time progress bar in HUD) | 2 | P1 |
| 8 | V8-F (scale calculation rework) | 4 | P1 |
| 9 | V8-E (distance display uncapped) | 2 | P1 |
| 10 | V8-J (skill popup minimal info) | 2 | P1 |
| 11 | V8-I (skill popup edge-aware positioning) | 1 | P1 |
| 12 | V8-K (particle trail artifact fix) | 3 | P1 |
| 13 | V8-G (remove top stage transition toast) | 1 | P2 |
| 14 | V8-H (remove Skill Pack from shop) | 1 | P2 |
| 15 | Balance sim + integration tests | 4 | P2 |
| **Total** | | **~40 hours = ~5 days** | |

---

## 16. Definition of Done

After all V8 modules:

1. `npm run build` passes; no TypeScript errors.
2. `npm test` passes.
3. `npm run sim` reports total time in [80, 130] hours.
4. Manual playthrough on a fresh save:
   - Stages 12, 15, 16 advance correctly when both quanta + time criteria met.
   - Black hole visibly shrinks across stage 15.
   - Cross-node unlocks at any stage as long as track level reaches milestone.
   - Click power Lv 5 = 32 (not 100,000). Game progression feels gradual.
   - Time gauge fills at constant rate per real-second; without Aeon Drive late stages stuck.
   - HUD widget order: Stage → Quanta + bar → Cosmic time + bar.
   - Encounter distance label updates correctly with screen position.
   - Scale label and encounter distance use the same unit/pixel ratio.
   - Solar System (Stage 10): only sun + 9 small orbiting planets. Earth is one of them, not separate.
   - Stage 11 (Life): single large detailed Earth.
   - Skill popup shows: name, cost, after-effect, BUY button. Nothing else.
   - Last skill popup auto-flips to show above when near bottom.
   - No particle trails leaking after skill panel close.
   - No top toast on stage transition.
   - Shop: Time Boost, Cosmic Surge, Aeon Surge — no Skill Pack.

---

## 17. Quality Bar

- **No decimals** in displayed numbers.
- **No CSS blur effects**.
- **All click events register**.
- **Mobile hit targets ≥ 44 px**.
- **Text-selection disabled**.
- **English code comments**.
- **Pure reducer**.
- **Per-stage performance**: 50+ fps on stage 16.

---

End of V8 specification.
