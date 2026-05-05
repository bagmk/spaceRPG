# Cosmic Coalescence — Refactor V7 Specification

> **Audience**: Autonomous coding agent with full repo access.
> **Mode**: Plan-then-execute. Run `npm run build && npm test` after every module.
> **Status**: Builds on V1+V2+V3+V4+V5+V6. **V7 supersedes parts of V6** — see §0.1.

V7 addresses the user's latest review session. Key targets:

1. **Time scale starts at 10⁻³⁴ s** — currently the cosmic clock fills "1 sec at start" which trivializes stage 1.
2. **UI minimalism** — the bottom HUD must shrink to a small upper-left widget; items + shop become floating bottom-right buttons; the entire rest of the screen is canvas.
3. **Distance label on EVERY incoming particle** — currently inconsistent.
4. **Zoom transitions broken** — they must trigger AFTER the quote message dismisses, not simultaneously with condense.
5. **Square-edge artifact during zoom** — visible canvas rectangle shrinks/grows. Must blend smoothly.
6. **Solar System Earth animation** — Earth appears suddenly mid-stage; animation has no continuity.
7. **Skill upgrade UX** — clicking a level cell forces the player to scroll to find the buy button. Replace with a small popup at the click point.
8. **Cross-node milestones (every 5 levels) don't buy** — the buy action is broken or unreachable. Remove "milestone bonuses" entirely; replace with simple SP-purchasable nodes at every milestone.
9. **First purchase too expensive** — start at 1 quanta. Quanta upgrades cost `2^level`. Time upgrades cost `10^level`.
10. **Big Bang reset must clear stats** — current "Reinitiate Big Bang" preserves stats; user wants full reset.
11. **Intro screen text overlap** — "Let there be light" + "Genesis" + other text overlap.
12. **Ending choice should display unlock conditions** — currently silent.
13. **Earth scale wrong** — shows "1000 m" when it should show ~12,000 km.
14. **AU and ly need tooltips** — non-technical users don't know these units.
15. **Big Bang opening cinematic** — replicate the closing animation for game start.
16. **Stat header consolidation** — top of screen shows only `Quanta ×N · Auto N/s · Crit ×N · Time ×N` and stage title.
17. **Black hole "99 yr" display issue** — investigate weird time display.

Implementation order: V7-A → V7-N (see §15). Each module is independently testable.

---

## 0. V7 Supersedes V6 — Reconciliation

### 0.1 Direct conflicts

| Topic | V6 said | V7 says | Action |
|---|---|---|---|
| Stage 1 cosmic time start | `cosmicTimeSec: 1e-32` | Stage 1 start = `1e-34 s`; gauge fills cosmic time slowly | Keep field; clamp display to 1e-34 minimum |
| Quanta-upgrade cost growth | `10^level` (matched effect) | `2^level` (gentle); effect stays `10^level` | Replace cost formula |
| Time-upgrade cost growth | Same as quanta | `10^level` (steep — distinct cost path) | Add separate cost for Aeon |
| First purchase price | 100+ quanta | 1 quanta | Replace base cost |
| Bottom UI | Full-width panel | Small upper-left widget; bottom-right floating buttons | Re-layout |
| Zoom timing | Inside condense (simultaneous with bursts) | After quote-overlay dismiss | Reorder transition states |
| Zoom shape | Canvas rectangle scales | Smooth fade + blur into next stage; no visible rectangle | Replace transform with crossfade |
| Skill upgrade flow | Bottom detail card with separate scroll | Popup at click position with embedded buy button | Replace UI |
| Milestone "bonus" effects | Bonus effect at every 5 levels | No "bonus" — just SP-purchasable node slots | Remove milestone bonuses |
| Big Bang prestige preserves stats | Yes (skills carry) | Full reset; only Singularity Tree + Atlas + endings persist | Update PRESTIGE reducer |
| Stage transitions cinematic style | Zoom rectangle | Zoom + crossfade blend | Per V7-E |

### 0.2 V6 features V7 keeps

- 16 stages with cosmic time anchors (cosmicTimeSec values unchanged).
- Zoom direction per stage (V6-Q): in/out/none.
- Logarithmic time multiplier (10^level).
- Logarithmic skill effect (10^level).
- Active boost HUD (V6-I).
- Particle distance labels concept (V6-A) — but make universal.
- Black hole orbit-not-fall behavior (V6-K).
- Stage animations driven by cosmic time (V6-J).

---

## 1. Module V7-A — Big Bang Opening Cinematic

### 1.1 Goal

User: "마지막 빅뱅이 참 멋있네, 처음 시작도 그렇게 해주고."

The final "Reinitiate Big Bang" cinematic is good. Use the same cinematic for the game's intro.

### 1.2 Implementation

Reuse `BigBangCinematic` (V6-P §16.2) as a one-shot intro that plays before the player ever sees stage 1:

```tsx
// App.tsx
const [introPlayed, setIntroPlayed] = useState(false);

if (!introPlayed) {
  return (
    <BigBangCinematic
      durationMs={3000}
      onComplete={() => {
        setIntroPlayed(true);
        soundManagerRef.current?.unlock();
      }}
    />
  );
}
```

The cinematic:
- 0–500 ms: black with silent buildup
- 500–1000 ms: tiny bright dot at center, growing
- 1000–2000 ms: dot expands radially, particles emerge
- 2000–3000 ms: bright flash white, fades to game start
- During: `playBigBang()` audio fires once

After cinematic, player is in stage 1 of universe 1.

### 1.3 For prestige

Same cinematic plays after `Reinitiate Big Bang` button click in FinalScreen — already specced V6-P.

### 1.4 Acceptance

- Fresh load: Big Bang cinematic plays first; stage 1 only after.
- Prestige: same cinematic plays before stage 1 of next universe.
- Player can NOT skip the cinematic on first universe (universeCount = 1).

---

## 2. Module V7-B — Cosmic Time Start at 10⁻³⁴ s

### 2.1 The complaint

User: "시간 초로 지나가는데 처음에는 10⁻³⁴초로 하자. ... 1초로 하면 바로 차버리잖아."

Translation: cosmic time should start at 10⁻³⁴ s. If it's 1 s, the gauge fills instantly.

### 2.2 Behavior

The cumulative cosmic clock display starts at `1e-34 s` (not 0). The gauge fills CONTINUOUSLY but the displayed value uses log scale internally:

```ts
function getDisplayedCosmicTime(state: GameState): number {
  // Map gauge progress to log-cosmic-time within stage range.
  const stage = STAGES[state.stageIdx];
  const prevStage = state.stageIdx === 0 ? null : STAGES[state.stageIdx - 1];
  const stageStartLog = Math.log10(prevStage?.cosmicTimeSec ?? 1e-34);
  const stageEndLog = Math.log10(stage.cosmicTimeSec);
  const fraction = state.timeGauge / 100;
  const currentLog = stageStartLog + fraction * (stageEndLog - stageStartLog);
  return Math.pow(10, currentLog);
}
```

This means for stage 1 (start `1e-34`, end `1e-32`):
- Gauge 0 % → display `1e-34 s`
- Gauge 50 % → display `1e-33 s`
- Gauge 100 % → display `1e-32 s`

Stage 5 (start `1e-6`, end `1.2e13`):
- Gauge 0 % → `1e-6 s`
- Gauge 50 % → `1e3.5 s ≈ 3162 s ≈ 53 min`
- Gauge 100 % → `1.2e13 s ≈ 380 Kyr`

### 2.3 Display formatter

`formatCosmicTime` already handles small (`1e-34 s`) and large (`1e110 yr`) ranges via scientific notation. Verify it's wired through.

### 2.4 Acceptance

- Stage 1 entering: cosmic clock shows `1e-34 s`.
- Stage 1 progress fills smoothly across log range to `1e-32 s`.
- No "1 s" baseline anywhere.

---

## 3. Module V7-C — UI Minimalism

### 3.1 The complaint

User wants game canvas maximized. Bottom UI takes too much space.

### 3.2 New layout

```
┌──────────────────────────────────────────────────┐
│ ╔════════════════╗                                │
│ ║ Cosmic Time    ║                                │
│ ║ 1e-32 s        ║                                │
│ ║ Stage: Inflation│                                │
│ ║ Quanta: 1,250  ║                                │
│ ║ Time gauge: 67%║                                │
│ ╚════════════════╝                                │
│                                                    │
│                                                    │
│              [GAME CANVAS — full screen]           │
│                                                    │
│                                                    │
│                                                    │
│                                                    │
│                                                    │
│                                          ⚙️        │
│                                          🛒        │
└──────────────────────────────────────────────────┘
```

- Top-left widget (200 × 100 px) shows: cosmic time + stage title + quanta + time gauge progress.
- Bottom-right floating buttons: Skills (gear) and Shop (cart). Each 56 × 56 px.
- Everything else is canvas.

### 3.3 Implementation

```tsx
// components/HudOverlay.tsx
export function HudOverlay({ state, stage }: HudProps) {
  const cosmicTime = getDisplayedCosmicTime(state);
  return (
    <div className="hud-overlay">
      <div className="hud-info">
        <div className="hud-cosmic-time">{formatCosmicTime(cosmicTime)}</div>
        <div className="hud-stage-title">{stage.name}</div>
        <div className="hud-quanta">Quanta: {formatWhole(state.quanta)} / {formatWhole(stage.threshold)}</div>
        <div className="hud-gauge">
          <div className="hud-gauge-fill" style={{ width: `${state.timeGauge}%` }} />
        </div>
      </div>
    </div>
  );
}
```

```css
.hud-overlay {
  position: fixed;
  top: 12px;
  left: 12px;
  width: 200px;
  background: rgba(0, 0, 0, 0.55);
  border-radius: 10px;
  padding: 10px;
  font-size: 11px;
  pointer-events: none;
  user-select: none;
}

.bottom-buttons {
  position: fixed;
  right: 12px;
  bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bottom-buttons > button {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--accent);
  /* ... */
}
```

### 3.4 Stat header (top center)

Add a *separate* compact stats display at top center, above the game canvas:

```
   Quanta ×10  ·  Auto 100/s  ·  Crit ×3  ·  Time ×10⁵
```

Pure text. No background. Single line, small font (12 px). Positioned at top center, not in HUD overlay.

### 3.5 Stat clickable popup (V7-G dependency)

Each stat (`Quanta ×10`, `Auto 100/s`, etc.) is clickable — opens a small skill upgrade popup at the click point. Implementation in §V7-G.

### 3.6 Remove old footer

Delete the old footer panel containing `<ResourcePanel>` and `<UpgradePanel>`. Their content lives in HUD overlay (basic info) and skill popups (upgrades).

### 3.7 Acceptance

- Top-left widget: cosmic time + stage + quanta + gauge.
- Top-center text: stats summary.
- Bottom-right: Skills + Shop buttons.
- 80+ % of screen is canvas.
- Mobile: HUD widget remains readable at 375 × 812.

---

## 4. Module V7-D — Universal Distance Label

### 4.1 The complaint

User: "어떤 파티클들은 거리가 표기가 되는데 어떤 파티클들은 거리 표현이 안되는 것도 있다."

Translation: distance label inconsistent across particles.

### 4.2 Fix

Every encounter / rogue / incoming object MUST have a distance label, regardless of stage or type. Audit `drawRogues.ts` and ensure:

```ts
function drawRogue(ctx, rogue, stage, screenWidth, screenHeight): void {
  // ... draw sprite ...
  
  // ALWAYS draw distance label (regardless of distance unless very close)
  const dx = rogue.x - screenWidth / 2;
  const dy = rogue.y - screenHeight / 2;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const fracOfScreen = dist / Math.min(screenWidth, screenHeight) * 2;
  
  if (fracOfScreen > 0.20) {
    const label = formatEncounterDistance(stage.id, fracOfScreen);
    drawDistanceLabel(ctx, rogue.x, rogue.y - rogue.r - 12, label);
  }
}
```

### 4.3 Stage-by-stage distance unit map

Use V6-A's table; verify it covers every stage:

```ts
export function formatEncounterDistance(stageId: number, fracOfScreen: number): string {
  const v = fracOfScreen;
  if (stageId === 1)  return `${(v * 100).toFixed(0)} ym`;     // yoctometers (10^-24 m)
  if (stageId === 2)  return `${(v * 1000).toFixed(0)} am`;    // attometers
  if (stageId === 3)  return `${(v * 100).toFixed(0)} fm`;     // femtometers (quark scale)
  if (stageId === 4)  return `${(v * 10).toFixed(0)} pm`;      // picometers
  if (stageId === 5)  return `${(v * 100).toFixed(0)} nm`;     // nanometers
  if (stageId === 6)  return `${(v * 100).toFixed(0)} m`;
  if (stageId === 7)  return `${(v * 100).toFixed(0)} ly`;
  if (stageId === 8)  return `${(v * 1000).toFixed(0)} ly`;
  if (stageId === 9)  return `${(v * 10000).toFixed(0)} ly`;
  if (stageId === 10) return `${(v * 100).toFixed(0)} AU`;
  if (stageId === 11) return `${(v * 1000).toFixed(0)} km`;    // Earth scale
  if (stageId === 12) return `${(v * 100).toFixed(0)} AU`;
  if (stageId === 13) return `${(v * 1000).toFixed(0)} ly`;
  if (stageId === 14) return `${(v * 10).toFixed(0)} kpc`;
  if (stageId === 15) return `${(v * 1).toFixed(2)} Mpc`;
  return `${(v * 100).toFixed(0)} Gpc`;
}
```

### 4.4 Acceptance

- Every encounter shows distance label when more than 20 % of screen-radius away.
- Stages 1–16 each use appropriate unit.

---

## 5. Module V7-E — Zoom Timing + Smooth Crossfade

### 5.1 The complaint

User: "메세지 나오고 나서 줌아웃이나 줌인이 되어야지... 그냥 클릭하면서 컨덴스 할 때 바로 되면서 메세지가 뜨니깐 되니깐 그게 안보이네. 그리고 줌인 줌아웃 되면서 네모난 화면이 줌아웃 되는거 좀 깬다. 다음 화면으로 잘 색깔이 이상하지 않게 바뀌여야지 뭔가 네모가 작아지는 게 보여서 이상해."

Two issues:
1. Zoom currently fires DURING condense — invisible because the screen is filled with bursts.
2. Zoom shows the canvas as a shrinking rectangle — the rectangular shape is jarring.

### 5.2 New transition timeline

```
0 ms    ──────  CONDENSE_IMPLOSION starts
                Initial bursts/sound
500 ms  ──────  Implosion settles; canvas fades to dark
800 ms  ──────  QuoteOverlay appears with stage NUMBER + TITLE
                (Wait for player to dismiss OR auto-advance after 2 s)
2800 ms ──────  Player clicks "Continue →"; QuoteOverlay dismisses
                STAGE_ADVANCE fires; new stage state set
2800 ms ──────  Zoom + crossfade BEGINS:
                - Old stage rendered with crossfade alpha decreasing
                - New stage rendered behind it, alpha increasing
                - Camera scale 1.0 → 0.3 (zoom-out) or 1.0 → 5.0 (zoom-in)
                - The canvas appears to "blur outward" as it crossfades — no visible rectangle
3800 ms ──────  Crossfade complete; new stage fully visible at scale 1.0
                Zoom snap (V6-Q "settle frame")
```

### 5.3 No-rectangle implementation

Don't transform the canvas rectangle itself. Instead:
1. Render old stage AND new stage simultaneously during crossfade (1 s window).
2. Old stage uses zoom transform; new stage stays at scale 1.0.
3. Old stage alpha fades from 1.0 to 0.0.
4. New stage alpha fades from 0.0 to 1.0.

```ts
function renderTransition(
  ctxOld: CanvasRenderingContext2D,
  ctxNew: CanvasRenderingContext2D,
  oldStageState: any,
  newStageState: any,
  t: number,                    // 0..1 transition progress
  zoomDir: 'in' | 'out' | 'none',
): void {
  // Render new stage on its own canvas first (full size, scale 1)
  ctxNew.globalAlpha = t;
  drawStageScene(ctxNew, newStageState);

  // Render old stage on top, scaled and fading
  ctxOld.save();
  let scale = 1;
  if (zoomDir === 'out') scale = 1 - t * 0.7;
  if (zoomDir === 'in')  scale = 1 + t * 4;
  ctxOld.translate(width / 2, height / 2);
  ctxOld.scale(scale, scale);
  ctxOld.translate(-width / 2, -height / 2);
  ctxOld.globalAlpha = 1 - t;
  drawStageScene(ctxOld, oldStageState);
  ctxOld.restore();

  // Composite: ctxNew below, ctxOld above (with alpha)
  // Final ctx draws both:
  finalCtx.drawImage(ctxNew.canvas, 0, 0);
  finalCtx.drawImage(ctxOld.canvas, 0, 0);
}
```

Practically: use offscreen canvases to compose. Or use CSS opacity transitions on two stacked canvas elements.

Simpler approach: keep one canvas. During transition, draw old stage with transform at decreasing alpha, then draw new stage at full alpha on top WITHOUT transform. The blending hides the rectangle issue.

### 5.4 Background color blend

During transition, lerp the background color from old stage's gradient to new stage's gradient. This prevents "color flash" when the new stage suddenly appears.

```ts
function lerpStageBackground(oldStage, newStage, t): { top: string; bottom: string } {
  return {
    top: lerpColor(oldStage.background.top, newStage.background.top, t),
    bottom: lerpColor(oldStage.background.bottom, newStage.background.bottom, t),
  };
}
```

### 5.5 Acceptance

- Pressing condense → bursts → quote appears → dismiss → zoom transition runs (1 s) → new stage settled.
- During zoom transition, no visible rectangle edge. The canvas appears as a smooth color blend.
- Stage 9 → 10 zoom-in feels like "rushing toward a star" rather than "rectangle growing".
- Stage 1 → 2 zoom-out feels like "pulling back" smoothly.

---

## 6. Module V7-F — Solar System Earth Continuity

### 6.1 The complaint

"솔러시스템 할때 어느 정도 모이니깐 갑자기 지구가 뜬금없이 나타나는데? 이상해. 지구 애니매이션도 잘 안되있는거 같고."

Translation: in Solar System stage, Earth appears suddenly out of nowhere; the animation feels disconnected.

### 6.2 Fix: continuous Earth presence

Earth must be visible from the start of stage 10, evolving smoothly through phases. No "Earth pops in" moment.

### 6.3 Phased Earth across stages 10 + 11

| Stage / progress | Earth state | Visible? |
|---|---|---|
| Stage 10, 0–10 % | dust cloud, no Earth yet | Earth NOT yet drawn |
| Stage 10, 10–25 % | T-Tauri Sun ignites; Earth = small molten dot accreting | small red dot at orbit |
| Stage 10, 25–40 % | Planetesimals; Earth grows | small reddish dot, slightly larger |
| Stage 10, 40–55 % | Inner planets formed; Earth = clearly visible red molten | clear red sphere |
| Stage 10, 55–70 % | Outer planets; Earth still molten red | red sphere |
| Stage 10, 70–80 % | Late bombardment; Earth red-brown with impacts | red-brown |
| Stage 10, 80–90 % | Stable; Earth still hot but cooling | dark red |
| Stage 10, 90–95 % | First water; Earth begins to show blue | blue patches on red |
| Stage 10, 95–100 % | Civilization preview; Earth shows night-side lights briefly | full Earth-like |
| Stage 11 starts | Earth is fully visible from start, in its current state | inherited from stage 10 |

So Earth doesn't "pop in" at stage 10 phase 4 — it's been growing continuously from phase 2. Just very small at first.

### 6.4 Implementation

In `drawSolarSystem`:

```ts
function drawEarth(ctx, x, y, baseRadius, phaseProgress, t): void {
  if (phaseProgress < 0.10) return;  // before T-Tauri, no Earth
  
  // Earth grows from 0 to baseRadius across 10–55 %
  const growT = Math.min(1, (phaseProgress - 0.10) / 0.45);
  const r = baseRadius * growT;
  
  // Render Earth based on phase
  if (phaseProgress < 0.25) drawAccretingEarth(ctx, x, y, r);
  else if (phaseProgress < 0.40) drawMoltenEarth(ctx, x, y, r, t);
  else if (phaseProgress < 0.55) drawCoolingMoltenEarth(ctx, x, y, r, t);
  else if (phaseProgress < 0.70) drawBrownEarth(ctx, x, y, r);
  else if (phaseProgress < 0.80) drawBombardedEarth(ctx, x, y, r, t);
  else if (phaseProgress < 0.90) drawDarkEarth(ctx, x, y, r);
  else if (phaseProgress < 0.95) drawWaterFormingEarth(ctx, x, y, r);
  else drawFullEarth(ctx, x, y, r);
}
```

Each `drawXxxEarth` is ~20 lines.

### 6.5 Stage 11 Earth carry-over

When transitioning stage 10 → 11 via crossfade:
- Stage 10 ends with Earth state at 95–100 %.
- Stage 11 starts with Earth in same state (full Earth-like).
- The crossfade ensures continuity.

### 6.6 Acceptance

- Stage 10 from start: Earth visible as growing red dot from phase 2.
- No "sudden appearance" — continuous growth and color shift.
- Stage 11 begins with Earth in the exact state stage 10 ended with.

---

## 7. Module V7-G — Skill Upgrade Click-to-Popup

### 7.1 The complaint

"레벨업 ui에서 하나 업그레이드 하려면 다시 내려와서 업그레이드 하기가 어려워. 그러니 클릭하고 바로 조그만 창이 떠서 업그레이드 할수 있게 해줘. 그리고 레벨업 창들 너무 다 멀리 떨어져 있어서, 조금 가까히 붙혀도 좋을거 가탇."

Translation: clicking a level forces scrolling to find buy button. Add a popup right at the click point. Skill cells are too spread out — bring them closer.

### 7.2 Click-popup design

When the player clicks a level cell or cross-node icon in the Skills panel, instead of opening a separate detail card on the right, show a **small floating popup** anchored to the click point:

```
   ┌──────────────────────┐
   │ Stellar Forge Lv 7→8 │
   │ Cost: 128 quanta     │
   │ Click 64 → 640       │
   │ [BUY +1 LEVEL]       │
   └──────────────────────┘
            ▼
            ●  Lv 7 cell (clicked)
```

Position: above the clicked cell, with a small arrow pointing down. Auto-flips to below if near top of screen.

Size: 200 × 110 px max. Compact.

### 7.3 Tighter cell spacing

Currently each level cell is ~32 × 32 px with 4 px gap. Make cells 24 × 24 with 2 px gap. This brings 30 levels to ~780 px column height (was ~1080 px). Much more compact.

If still too tall, group every 5 levels with a thin separator instead of full gap; render 6 milestone groups (Lv 1–5, 6–10, ..., 26–30) compactly.

### 7.4 Implementation

```tsx
// components/skills/SkillPopup.tsx
export function SkillPopup({ anchorRef, content, onBuy, onClose }: SkillPopupProps) {
  // Position above anchor element, with arrow pointing down
  // ...
  return (
    <div className="skill-popup" style={{ top, left }}>
      <div className="skill-popup-content">{content}</div>
      <button onClick={onBuy}>BUY</button>
      <button onClick={onClose}>×</button>
    </div>
  );
}

// components/skills/SkillsPanel.tsx
// On level cell click:
const [popupAnchor, setPopupAnchor] = useState<{ ref, levelInfo } | null>(null);
<SkillPopup
  anchorRef={popupAnchor.ref}
  content={popupContent}
  onBuy={...}
  onClose={() => setPopupAnchor(null)}
/>
```

### 7.5 Click-outside dismisses popup

```tsx
useEffect(() => {
  const onDocClick = (e: MouseEvent) => {
    if (!popupRef.current?.contains(e.target as Node)) setPopupAnchor(null);
  };
  document.addEventListener('mousedown', onDocClick);
  return () => document.removeEventListener('mousedown', onDocClick);
}, []);
```

### 7.6 Acceptance

- Clicking a level cell shows popup right at that spot.
- Buy button in popup.
- Click outside popup or the × dismisses it.
- Cells are visually tighter (≤ 800 px column height for 30 levels).

---

## 8. Module V7-H — Cross-Node Milestone Fix (Remove Bonus, SP-Only)

### 8.1 The complaint

"매 5업마다 뜨는 건 업그레이드가 안되는데 왜 이래? cross node 구매가 안되. 마일스톤 보너스를 없애고 그냥 단순하게 그 마일스톤을 SP로 살수 있게 해줘."

Translation: every 5-level milestone — the cross-node buy doesn't work. Remove the milestone bonuses; just make milestones SP-purchasable.

### 8.2 Design change

Remove the concept of "milestone bonuses" entirely from formulas. Each track's level effects are linear (10× per level for click/auto/time, +0.5 per level for crit).

Cross-nodes at every 5-level milestone (5, 10, 15, 20, 25, 30) are simple SP-purchasable nodes. No effect tied to track level itself; the effect is from owning the cross-node.

### 8.3 New cross-node list

```ts
export const CROSS_NODES: CrossNodeDef[] = [
  // Each track has 6 milestone slots: at level 5, 10, 15, 20, 25, 30
  // Format: <track>_lv<level>
  // Effect: simple bonus that applies if owned

  // Stellar Forge (click) line
  { id: 'click_lv5',  trackId: 'click', requiredLvl: 5,  cost: 1,  costType: 'sp', effect: { clickPowerMult: 2 } },
  { id: 'click_lv10', trackId: 'click', requiredLvl: 10, cost: 2,  costType: 'sp', effect: { clickPowerMult: 5 } },
  { id: 'click_lv15', trackId: 'click', requiredLvl: 15, cost: 4,  costType: 'sp', effect: { clickPowerMult: 10 } },
  { id: 'click_lv20', trackId: 'click', requiredLvl: 20, cost: 8,  costType: 'sp', effect: { clickPowerMult: 25 } },
  { id: 'click_lv25', trackId: 'click', requiredLvl: 25, cost: 16, costType: 'sp', effect: { clickPowerMult: 100 } },
  { id: 'click_lv30', trackId: 'click', requiredLvl: 30, cost: 32, costType: 'sp', effect: { clickPowerMult: 1000 } },

  // Cosmic Web (auto) line — same structure
  { id: 'auto_lv5',  trackId: 'auto', requiredLvl: 5,  cost: 1,  costType: 'sp', effect: { autoRateMult: 2 } },
  // ... etc

  // Quantum Lens (crit) line
  { id: 'crit_lv5',  trackId: 'crit', requiredLvl: 5,  cost: 1,  costType: 'sp', effect: { critMultMult: 1.5 } },
  // ... etc

  // Aeon Drive (time) line
  { id: 'time_lv5',  trackId: 'time', requiredLvl: 5,  cost: 1,  costType: 'sp', effect: { timeMult: 2 } },
  { id: 'time_lv10', trackId: 'time', requiredLvl: 10, cost: 2,  costType: 'sp', effect: { timeMult: 5 } },
  { id: 'time_lv15', trackId: 'time', requiredLvl: 15, cost: 4,  costType: 'sp', effect: { timeMult: 10 } },
  // ... cumulative
];
```

Total cross-nodes: 4 tracks × 6 milestones = 24. Simple. Each owned cross-node multiplies its track's effect.

### 8.4 Cross-node cost progression

SP cost doubles per milestone (1, 2, 4, 8, 16, 32) → max 32 SP per milestone, 4 × (1+2+4+8+16+32) = 252 SP for full unlock.

### 8.5 Cross-track nodes (later)

Optionally add 4 cross-track nodes at Lv 30 of all four tracks (Apex equivalents):
- `apex_click_x_time`: requires click30 + time30 → click power × time mult fold-in
- `apex_quad_30`: requires all 4 at 30 → cosmic primal effect

These are bonus, not required.

### 8.6 BUY_CROSS_NODE simplification

```ts
case 'BUY_CROSS_NODE': {
  const def = CROSS_NODES.find((n) => n.id === action.nodeId);
  if (!def) return state;
  if (state.skills.ownedCrossNodes.includes(action.nodeId)) return state;
  if (state.skills[def.trackId].level < def.requiredLvl) return state;
  if (state.skillPoints < def.cost) return state;
  return {
    ...state,
    skillPoints: state.skillPoints - def.cost,
    skills: { ...state.skills, ownedCrossNodes: [...state.skills.ownedCrossNodes, action.nodeId] },
  };
}
```

Apply effects in `computeModifiers`:

```ts
for (const id of skills.ownedCrossNodes) {
  const def = CROSS_NODES.find((n) => n.id === id);
  if (!def) continue;
  if (def.effect.clickPowerMult)  m.clickPowerMult  *= def.effect.clickPowerMult;
  if (def.effect.autoRateMult)    m.autoRateMult    *= def.effect.autoRateMult;
  if (def.effect.critMultMult)    m.critMultMult    *= def.effect.critMultMult;
  if (def.effect.timeMult)        m.timeMult        *= def.effect.timeMult;
}
```

### 8.7 Acceptance

- Each milestone (Lv 5/10/15/20/25/30) of each track has a buyable SP cross-node.
- Buying triggers immediate stat boost.
- Reducer test: buy click_lv5 with 1 SP and click level 5 → click power doubles.
- No "milestone bonuses" applied automatically without SP purchase.

---

## 9. Module V7-I — Skill Costs Rebalance

### 9.1 New cost formulas

```ts
// formulas.ts

// Quanta-based skills (Stellar Forge, Cosmic Web, Quantum Lens):
function getSkillLevelCost_Quanta(track: TrackId, level: number): number {
  return Math.floor(1 * Math.pow(2, level));  // 1, 2, 4, 8, 16, 32, ...
}
// Lv 1: 1, Lv 5: 16, Lv 10: 512, Lv 20: 524288, Lv 30: 1.07e9

// Time-based skill (Aeon Drive):
function getSkillLevelCost_Aeon(level: number): number {
  return Math.floor(1 * Math.pow(10, level));  // 1, 10, 100, 1000, ...
}
// Lv 1: 1, Lv 5: 100,000, Lv 10: 1e10, Lv 30: 1e30
```

Aeon Drive is more expensive per level because each level grants 10× time multiplier. Other skills also grant 10× per level but cost only 2× per level (cheap → grow fast).

### 9.2 Rebalance threshold table

With cheaper skill costs, players will be much more powerful per stage. Recalibrate thresholds:

```ts
// stages.ts — threshold updates
{ id: 1, threshold: 10 },          // was 25
{ id: 2, threshold: 100 },         // was 200
{ id: 3, threshold: 1_000 },
{ id: 4, threshold: 10_000 },
{ id: 5, threshold: 100_000 },
{ id: 6, threshold: 1_000_000 },
{ id: 7, threshold: 10_000_000 },
{ id: 8, threshold: 100_000_000 },
{ id: 9, threshold: 1e9 },
{ id: 10, threshold: 1e10 },
{ id: 11, threshold: 1e12 },
{ id: 12, threshold: 1e14 },
{ id: 13, threshold: 1e17 },
{ id: 14, threshold: 1e22 },
{ id: 15, threshold: 1e30 },
{ id: 16, threshold: 1e60 },
```

Steeper late-stage growth matches the logarithmic skill scaling.

### 9.3 Run balance sim

After rebalance, run `npm run sim`. Verify:
- Total real-time still in [80, 130] hours.
- Per-stage real-time within ±50 % of target.
- No stage takes < 10 s on a fresh save.

### 9.4 Acceptance

- Stage 1 first level upgrade: 1 quanta. Affordable in seconds.
- Stage 5 + Aeon Lv 5 affordable: ~100K quanta accumulated.
- Stage 16 unlockable only with Aeon Lv 80+ (10^80 quanta investment + cross-nodes/apex).

---

## 10. Module V7-J — Big Bang Reset Stats

### 10.1 The complaint

"다시 빅뱅하면 기존에 스텟은 사라져야지."

Translation: when restart, stats must reset.

### 10.2 Fix PRESTIGE reducer

```ts
case 'PRESTIGE': {
  // Save persistent fields
  const persistentFields = {
    universeCount: state.universeCount + 1,
    cumulativeBoost: state.cumulativeBoost,        // Singularity Tree boost
    condensedMass: state.condensedMass,
    echoes: state.echoes,
    universeAtlas: state.universeAtlas,
    endingsCompleted: state.endingsCompleted,
    singularityUnlocks: state.singularityUnlocks,
    tutorialFlags: state.tutorialFlags,
    totalShopSpentUSD: state.totalShopSpentUSD,
  };

  // Everything else resets to fresh
  const fresh = createInitialGameState(action.now);

  return {
    ...fresh,
    ...persistentFields,
    // skill levels reset to 0
    skills: {
      click: { level: 0 },
      auto:  { level: 0 },
      crit:  { level: 0 },
      time:  { level: 0 },
      unlockedTracks: ['click'],     // back to stage 1 — only Stellar Forge
      ownedCrossNodes: [],
    },
    skillPoints: 0,                  // RESET — rebuild SP this run
  };
}
```

### 10.3 Acceptance

- Press "Reinitiate Big Bang" → next universe starts at stage 1, skill levels 0, SP 0, quanta 0.
- Persists: universeAtlas, singularityUnlocks, endingsCompleted.

---

## 11. Module V7-K — Intro Text Overlap Fix

### 11.1 The complaint

"처음 시작할때 렛데얼비 라이트랑. 제네시스랑 여러 글자들이 겹쳐서 보인다. 잘 처리해주고."

Translation: at game start, "Let there be light", "Genesis", and other text overlap.

### 11.2 Fix

Audit `IntroScreen.tsx`. Currently multiple text elements likely have absolute positioning that overlaps. Refactor:

```tsx
export function IntroScreen({ onStart, ... }: IntroScreenProps) {
  return (
    <div className="intro-screen">
      <div className="intro-content">
        <div className="intro-title">Cosmic Coalescence</div>
        <div className="intro-subtitle">In the beginning... was nothing.</div>
        <button className="intro-cta" onClick={onStart}>
          Let there be light
        </button>
      </div>
    </div>
  );
}
```

```css
.intro-screen {
  position: fixed;
  inset: 0;
  background: black;
  display: flex;
  align-items: center;
  justify-content: center;
}
.intro-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  text-align: center;
}
.intro-title { font-size: 48px; font-weight: bold; }
.intro-subtitle { font-size: 18px; opacity: 0.7; }
.intro-cta { padding: 16px 32px; font-size: 16px; }
```

Single column. No overlap. Clean.

### 11.3 Acceptance

- Intro screen shows: title + subtitle + CTA in a vertical column.
- No text elements overlap.

---

## 12. Module V7-L — Ending Conditions Display

### 12.1 The complaint

"마지막에 choose the shape of the last moment 할때 조건도 알려주라. 어떤 조건에서 보여지는 건지."

Translation: when choosing the last moment ending, show what triggered each option.

### 12.2 EndingChooser update

Each ending option in the chooser now shows a short condition explainer:

```tsx
<EndingOption ending="heat_death">
  <h3>Heat Death</h3>
  <p>The universe approaches perfect equilibrium.</p>
  <span className="condition">Always available</span>
</EndingOption>

<EndingOption ending="big_crunch">
  <h3>Big Crunch</h3>
  <p>Gravity wins; everything collapses inward.</p>
  <span className="condition">You rushed late stages — crit > 1/sec in stages 13–16</span>
</EndingOption>

<EndingOption ending="big_rip">
  <h3>Big Rip</h3>
  <p>Even atoms tear apart from runaway expansion.</p>
  <span className="condition">You maxed time skill — Aeon Drive Lv 30 + Inflaton Echo</span>
</EndingOption>

<EndingOption ending="vacuum_decay">
  <h3>Vacuum Decay</h3>
  <p>True vacuum bubble expands at light speed.</p>
  <span className="condition">Precision strikes during proton decay era</span>
</EndingOption>

<EndingOption ending="bounce">
  <h3>Cosmic Bounce</h3>
  <p>The cosmos remembers and starts again.</p>
  <span className="condition">Universe count ≥ 5, all other endings achieved</span>
</EndingOption>
```

Conditions displayed even if not yet met (greyed out).

### 12.3 Acceptance

- Ending chooser shows 5 options.
- Each shows its condition.
- Met conditions are bright; unmet are dim with the condition text grey-italic.

---

## 13. Module V7-M — Earth Scale + Unit Tooltips

### 13.1 Earth scale

Earth's diameter ≈ 12,756 km. The current scale indicator on stage 11 might show "1,000 m" — wrong by a factor of 12,000.

Fix `getScreenScaleLabel(stageId)`:

```ts
function getScreenScaleLabel(stageId: number): { length: 50; unit: string; value: number } {
  // ... existing entries ...
  if (stageId === 11) return { length: 50, unit: 'km', value: 13_000 };  // Earth scale ≈ 13,000 km
  // ...
}
```

Update the per-stage table to use realistic scales:
- Stage 9 Galaxy: `100,000 ly` (Milky Way diameter)
- Stage 10 Solar System: `40 AU` (out to Pluto)
- Stage 11 Earth: `13,000 km` (Earth diameter)
- Stage 12 Death of Star: `1 AU` (Sun's red giant radius approx)

### 13.2 AU and ly tooltips

User: "1 ly 와 AU 옆에 살짝 설명 해줄래?"

Add hover tooltips next to scale unit:
- Hover "AU" → "Astronomical Unit: distance from Earth to Sun (~150 million km)"
- Hover "ly" → "Light-year: distance light travels in 1 year (~9.5 trillion km)"
- Hover "Mpc" → "Megaparsec: ~3.26 million light-years"
- Hover "kpc" → "Kiloparsec: ~3,261 light-years"

Implementation in HudOverlay:

```tsx
<span className="scale-unit" title={getUnitTooltip(unit)}>
  {unit}
</span>
```

```ts
function getUnitTooltip(unit: string): string {
  return {
    'nm':  '나노미터 (10⁻⁹ m)',
    'pm':  '피코미터 (10⁻¹² m)',
    'fm':  '펨토미터 (10⁻¹⁵ m); 양성자 크기 정도',
    'AU':  'Astronomical Unit: 지구–태양 거리 (~1억 5천만 km)',
    'ly':  'Light-year: 빛이 1년 동안 가는 거리 (~9.5조 km)',
    'kpc': 'Kiloparsec: 약 3,261 광년',
    'Mpc': 'Megaparsec: 약 3,260,000 광년',
    'Gpc': 'Gigaparsec: 약 32억 광년',
  }[unit] ?? unit;
}
```

### 13.3 Acceptance

- Stage 11 scale indicator shows "13,000 km".
- Hover "ly" → tooltip with explanation.

---

## 13.5 Module V7-N1 — Cash Shop Time Boost ×10

### 13.5.1 The complaint

User: "캐쉬샾에서 타음은 2배가 아닌 10배씩 증가해야할거 같다."

Translation: shop's time boost should multiply by 10× (not 2×) per buy.

### 13.5.2 Update SHOP_ITEMS

```ts
// src/game/shop/items.ts
export const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'time_boost',
    label: 'Quick Time Boost',
    description: 'Time × 10 for 10 minutes.',     // was × 2
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
    // unchanged
    applyEffect: (s) => ({
      ...s,
      shopBoosts: [
        ...(s.shopBoosts ?? []),
        { id: `quanta_${Date.now()}`, factor: 3, expiresAt: Date.now() + 30 * 60_000 },
      ],
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
  // NEW (recommended) — bigger time tiers for late-game players
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
];
```

### 13.5.3 Stack composition

Per V6-I, multiple stacks compose multiplicatively. Buying time_boost 5 times → composite × 10⁵ for 10 min (or whatever soonest expires).

### 13.5.4 Acceptance

- Buying Quick Time Boost once: time × 10 for 10 min.
- Buying it 3 times: composite × 1000.
- Active Boost HUD shows the composite multiplier correctly.

---

## 14. Module V7-N — Save Migration v6 → v7

### 14.1 Schema bump

V7 has minor structural changes (skill cost formulas, transition state, popup flag). No new persistent fields needed; just data migration:

```ts
function migrateV6ToV7(v6: SaveStateV6): SaveStateV7 {
  return {
    ...v6,
    version: 7,
    // skills field: ensure ownedCrossNodes uses new id format (track_lv5, etc.)
    skills: {
      ...v6.skills,
      ownedCrossNodes: migrateCrossNodeIds(v6.skills.ownedCrossNodes),
    },
  };
}

function migrateCrossNodeIds(oldIds: string[]): string[] {
  // V6 ids like 'echoing_click' don't exist in V7. They're discarded.
  // Player gets refunded SP equivalent (not implemented; just discard for simplicity).
  return [];
}
```

### 14.2 Acceptance

- v6 save loads cleanly into v7 with old cross-node IDs discarded; player can re-buy.

---

## 15. Implementation Order

| # | Module | Hours | Priority |
|---|---|---|---|
| 1 | V7-I (skill cost rebalance + threshold) | 4 | **P0** |
| 2 | V7-H (cross-node milestone fix) | 4 | **P0** |
| 3 | V7-G (skill upgrade click-popup) | 4 | **P0** |
| 4 | V7-J (Big Bang reset stats) | 1 | P0 |
| 5 | V7-F (Solar System Earth continuity) | 6 | P0 |
| 6 | V7-E (zoom timing + smooth crossfade) | 6 | P0 |
| 7 | V7-A (Big Bang opening cinematic) | 2 | P1 |
| 8 | V7-B (cosmic time start at 1e-34) | 2 | P1 |
| 9 | V7-C (UI minimalism) | 4 | P1 |
| 10 | V7-D (universal distance label) | 2 | P1 |
| 11 | V7-K (intro text overlap fix) | 1 | P1 |
| 12 | V7-L (ending conditions display) | 2 | P1 |
| 13 | V7-M (Earth scale + AU/ly tooltips) | 2 | P2 |
| 14 | V7-N1 (shop time boost ×10) | 1 | P1 |
| 15 | V7-N (save migration v6→v7) | 1 | P2 |
| 16 | Balance sim + integration tests | 4 | P2 |
| **Total** | | **~46 hours = ~5.75 days** | |

---

## 16. Definition of Done

After all V7 modules:

1. `npm run build` passes; no TypeScript errors.
2. `npm test` passes.
3. `npm run sim` reports total time in [80, 130] hours.
4. Manual playthrough on a fresh save:
   - Big Bang cinematic plays at game start.
   - Stage 1 cosmic clock starts at `1e-34 s`.
   - First skill upgrade costs 1 quanta.
   - HUD widget at top-left; Skills+Shop buttons at bottom-right; canvas fills screen.
   - Stat header at top center: `Quanta ×N · Auto N/s · Crit ×N · Time ×N`.
   - Click stat → popup with upgrade option.
   - Click skill cell → popup at click point with buy button.
   - Cells visually compact; 30 levels fit in ~800 px.
   - Cross-nodes at every 5 levels are SP-buyable.
   - Stage advance: bursts → quote (only stage number + title) → click Continue → smooth crossfade with zoom direction (in/out) + bg color blend → new stage settled. No visible canvas rectangle.
   - Stage 10 from start: Earth visible as growing dot from phase 2; no sudden appearance.
   - Stage 11 inherits Earth from stage 10's final state.
   - All distance labels visible on every encounter regardless of stage.
   - Stage 11 scale indicator: "13,000 km".
   - Hover AU/ly: tooltip with explanation.
   - Reinitiate Big Bang: full reset of stats; cinematic plays.
   - Intro screen: no text overlap.
   - Ending chooser: shows 5 options with condition labels.

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

End of V7 specification.
