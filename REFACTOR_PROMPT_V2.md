# Cosmic Coalescence — Refactor V2 Specification

> **Audience**: An autonomous coding agent with full repo access (Codex / Claude Code / similar).
> **Mode**: Plan-then-execute. Read every file in `src/` before changing anything. After each module, run `npm run build` and `npm test`.
> **Status**: This builds on `REFACTOR_PROMPT.md` (V1). V1's 16-stage skeleton, mechanics/, timeFlow, endings, SingularityTree, save migration v1→v2, and tests are assumed already implemented. Verify their existence; if any V1 module is missing, complete it before starting V2.

This V2 fixes three structural problems left after V1 and adds one new skill axis:

1. **Stage Visual Mismatch** — Stages 1–8 all share `clusterMode: 'generic'`, so they look identical despite different mechanics. Each stage needs its own visual identity: cluster rendering, mote sprites, click-burst shapes, encounter shapes, ambient particle motifs.
2. **Skill Auto-Growth Removed** — Currently `getClickPower` scales with `sqrt(threshold)`, so click power grows automatically when stages advance even without buying upgrades. This must be removed: clicks gain *only* through bought skill levels. If the player buys nothing, clicking on stage 16 produces the same numeric output as on stage 1.
3. **Hidden Skill Tree Panel** — Replace the always-visible 3-button `UpgradePanel` in the footer with a dedicated panel opened from a floating button. The panel hosts a 4-tree × 4-tier skill graph (CLICK / AUTO / CRIT / TIME) with prerequisite gating.
4. **Time Acceleration (4th skill axis, NEW)** — A new tree that multiplies cosmic-clock rate, auto rate, and encounter spawn rate by the same factor.

Implementation order: A → B → C → D → E → F → G → H. Each module has acceptance criteria. Don't skip; later modules depend on earlier ones.

---

## 0. Repo State Snapshot (Read These First)

```
src/
  App.tsx
  game/
    audio.ts
    constants.ts
    formulas.ts          ← will be heavily rewritten in Module E
    reducer.ts           ← will gain new actions in Module C
    stages.ts            ← will gain new clusterMode values in Module A
    storage.ts           ← will gain v2→v3 migration in Module H
    timeFlow.ts          ← will gain timeMultiplier hook in Module F
    types.ts             ← will gain SkillState, new ClusterMode strings, etc.
    mechanics/           ← 16 mechanic files; verify presence
      index.ts
      click_basic.ts, matter_asymmetry.ts, fusion_window.ts, recombination.ts,
      dark_age.ts, first_stars.ts, reionization.ts, galaxy_weaving.ts,
      planet_formation.ts, life_evolution.ts, civilization.ts, red_giant.ts,
      remnant_cooling.ts, proton_decay.ts, hawking_radiation.ts, ending_choice.ts
  canvas/
    drawCluster.ts       ← will gain 8 new draw functions in Module A
    drawCore.ts
    drawEffects.ts
    drawParticles.ts
    drawRogues.ts
    drawStars.ts
    drawWake.ts
    stageSprites.ts      ← will be heavily extended in Module B
  components/
    GameScreen.tsx       ← footer will be modified in Module D
    UpgradePanel.tsx     ← REMOVED in Module D
    Timeline.tsx
    ResourcePanel.tsx
    QuoteOverlay.tsx
    EncounterAlert.tsx
    FloatingNumber.tsx
    IntroScreen.tsx
    FinalScreen.tsx
    OfflineProgressModal.tsx
    EndingChooser.tsx
    SingularityTree.tsx
    ParticleField.tsx    ← will gain stage-specific click effects in Module B
    endings/
      HeatDeathEnding.tsx, BigCrunchEnding.tsx, BigRipEnding.tsx, VacuumDecayEnding.tsx
    skills/              ← NEW directory in Module D
  hooks/
    useGameLoop.ts
    useGameState.ts
```

Before any change, verify the following V1 deliverables exist. If any are missing, complete them first using `REFACTOR_PROMPT.md` as the source of truth:

- `STAGES` array has 16 entries with new fields (`cosmicTimeSec`, `realPlayTargetSec`, `mechanic`).
- `MECHANICS` registry maps all 16 `StageMechanicId` values.
- `useGameState` triggers an offline-progress modal on hydrate.
- `Timeline.tsx` renders a logarithmic cosmic clock.
- Save migration v1 → v2 lives in `storage.ts`.
- Tests under `src/game/__tests__/` and `src/game/mechanics/__tests__/` pass.

---

## 1. Module A — Stage Visual Identity (clusterModes)

### 1.1 The problem

`stages.ts` currently sets `clusterMode: 'generic'` for stages 1–8. As a result they all render through `drawGenericMotes` in `drawCluster.ts`. Visually they are indistinguishable.

### 1.2 Fix: 16 unique clusterModes

Replace the existing `ClusterMode` union in `types.ts` with 16 explicit values, one per stage:

```ts
export type ClusterMode =
  | 'inflation'        // stage 1
  | 'baryogenesis'     // stage 2
  | 'qgPlasma'         // stage 3
  | 'nucleosynthesis'  // stage 4
  | 'recombination'    // stage 5
  | 'darkAge'          // stage 6
  | 'firstStars'       // stage 7
  | 'reionization'     // stage 8
  | 'galaxy'           // stage 9 (existing)
  | 'planetary'        // stage 10 (existing)
  | 'lifeSurface'      // stage 11 (existing)
  | 'redGiant'         // stage 12 (existing)
  | 'remnant'          // stage 13–14 (existing)
  | 'degenerate'       // stage 14 (NEW — split from 'remnant' for visual differentiation)
  | 'blackHole'        // stage 15 (existing)
  | 'heatDeath';       // stage 16 (existing)
```

Update `stages.ts` so each stage's `clusterMode` matches its position in the table above.

### 1.3 Visual brief per new clusterMode

Each clusterMode gets a `draw{Name}` function in `canvas/drawCluster.ts`. Match the table:

| clusterMode | Visual concept | Mote rendering | Background motif |
|---|---|---|---|
| `inflation` | Single point exploding outward; expanding sphere | tiny bright pixels with strong motion blur, all moving radially outward | bright white-orange flash that decays |
| `baryogenesis` | Pairs of opposite-charge particles annihilating; a few survivors glow | mote pairs (blue + red) with connecting line; lone survivors pulse brighter | dim red/blue field, sparse |
| `qgPlasma` | No discrete particles; fluid plasma | motes blend into a soup using additive blending; high-frequency color noise | wavy turbulence, hot orange/red |
| `nucleosynthesis` | Quarks binding into compound particles (protons, helium nuclei) | motes cluster in groups of 2–4 with a binding glow ring; show "p", "n", "α" symbols faintly | warmer orange with cooler edges (cooling universe) |
| `recombination` | Free electrons being captured; fog clearing | motes (electrons) orbit larger fixed nuclei; on capture, a photon streak shoots radially | desaturated grey fog that thins as progress increases |
| `darkAge` | Empty, drifting | very few motes, slow, low alpha; long thin trails | almost black with subtle blue gradient; star field disabled |
| `firstStars` | Bright Pop III stars igniting then dying | each mote is a 4-pointed star sprite; when mote.age > threshold, draw supernova ring and remove | deep blue-black, occasional starburst flash |
| `reionization` | Bubbles of ionized gas expanding | motes are small sun emitters; each mote casts a transparent expanding sphere that "ionizes" the field | grey haze that gets cleared as bubbles overlap |
| `degenerate` | Cold, twitching remnants; rare decay flashes | motes are dim white-purple dots; very low motion; occasionally one flashes brightly and is removed | dark purple gradient |

Stages 9–13 and 15–16 keep their existing visuals, but apply two consistency upgrades to all stages (see §1.5).

### 1.4 `drawCluster.ts` skeleton

```ts
// canvas/drawCluster.ts
export function drawCluster(args: DrawClusterArgs): void {
  switch (args.stage.clusterMode) {
    case 'inflation':       drawInflation(args); break;
    case 'baryogenesis':    drawBaryogenesis(args); break;
    case 'qgPlasma':        drawQGPlasma(args); break;
    case 'nucleosynthesis': drawNucleosynthesis(args); break;
    case 'recombination':   drawRecombinationField(args); break;
    case 'darkAge':         drawDarkAge(args); break;
    case 'firstStars':      drawFirstStars(args); break;
    case 'reionization':    drawReionization(args); break;
    case 'galaxy':          drawGalaxyDisk(args); break;
    case 'planetary':       drawPlanetarySystem(args); break;
    case 'lifeSurface':     drawLifeSurface(args); break;
    case 'redGiant':        drawRedGiantBloom(args); break;
    case 'remnant':         drawRemnantCloud(args); break;
    case 'degenerate':      drawDegenerateField(args); break;
    case 'blackHole':       drawBlackHoleScene(args); break;
    case 'heatDeath':       drawHeatDeathCloud(args); break;
  }
}
```

Each draw function is ~40–80 lines. Use existing primitives (`hexToRgba`, `drawClusterEnvelope`) and stage's `accent`, `coreColor`, `particleColors`.

### 1.5 Mote sprite per stage

In `canvas/stageSprites.ts`, replace the current generic sprite with a `drawStageSprite(ctx, stageId, x, y, r, color, alpha, time)` that dispatches by stage. Add 16 sprite functions:

- `drawSpriteInflation` — pixel shard with directional blur
- `drawSpriteBaryon` — circle with optional ± symbol overlay
- `drawSpriteQuark` — small triangle (3 = nucleon hint)
- `drawSpriteNucleus` — clustered tri-circle (proton-neutron pair)
- `drawSpriteAtom` — circle with orbital ring
- `drawSpriteHydrogen` — small dim circle with one electron pixel
- `drawSpriteStar` — 4-pointed star
- `drawSpriteIonBubble` — concentric expanding ring
- `drawSpriteGalaxy` — small spiral wisp
- `drawSpritePlanet` — circle with shaded hemisphere
- `drawSpriteCell` — circle with internal nucleus dot
- `drawSpriteEmber` — irregular blob with glow
- `drawSpriteDwarf` — tight bright dot with sharp edge
- `drawSpriteDecay` — dot with cross-hatch (twitch)
- `drawSpriteHawking` — dot with curved escape vector arrow
- `drawSpriteFluctuation` — single pixel that randomly toggles visibility

Each takes the same signature; each is < 30 lines. The dispatcher:

```ts
export function drawStageSprite(
  ctx: CanvasRenderingContext2D,
  stageId: number,
  x: number, y: number, r: number, color: string, alpha: number, t: number,
): void {
  switch (stageId) {
    case 1:  drawSpriteInflation(ctx, x, y, r, color, alpha, t); return;
    case 2:  drawSpriteBaryon(ctx, x, y, r, color, alpha, t); return;
    case 3:  drawSpriteQuark(ctx, x, y, r, color, alpha, t); return;
    case 4:  drawSpriteNucleus(ctx, x, y, r, color, alpha, t); return;
    case 5:  drawSpriteAtom(ctx, x, y, r, color, alpha, t); return;
    case 6:  drawSpriteHydrogen(ctx, x, y, r, color, alpha, t); return;
    case 7:  drawSpriteStar(ctx, x, y, r, color, alpha, t); return;
    case 8:  drawSpriteIonBubble(ctx, x, y, r, color, alpha, t); return;
    case 9:  drawSpriteGalaxy(ctx, x, y, r, color, alpha, t); return;
    case 10: drawSpritePlanet(ctx, x, y, r, color, alpha, t); return;
    case 11: drawSpriteCell(ctx, x, y, r, color, alpha, t); return;
    case 12: drawSpriteEmber(ctx, x, y, r, color, alpha, t); return;
    case 13: drawSpriteDwarf(ctx, x, y, r, color, alpha, t); return;
    case 14: drawSpriteDecay(ctx, x, y, r, color, alpha, t); return;
    case 15: drawSpriteHawking(ctx, x, y, r, color, alpha, t); return;
    case 16: drawSpriteFluctuation(ctx, x, y, r, color, alpha, t); return;
    default: drawSpriteInflation(ctx, x, y, r, color, alpha, t);
  }
}
```

Existing rogue/encounter sprites already use `getStageRogueColor/Name` — extend the same pattern with `getStageRogueShape(stageId)` returning a sprite-id string used by `drawRogues.ts`.

### 1.6 Acceptance for Module A

1. `npm run build` passes.
2. Manually test each stage by entering it via dev URL `?stage=N`. Stages 1–8 must look visually distinct from each other and from stage 9.
3. Add a Vitest snapshot test that captures the 16 unique `clusterMode` strings — protects against accidental reversion.

---

## 2. Module B — Stage-Specific Click & Spawn Effects

### 2.1 The user requirement

> "눌렀을 때 나오는 모양들이랑 생성되는 모양들도 그 스테이지에 맞는 것으로 확실하게 변형될 수 있게."

Translation: when the player clicks in a given stage, the burst/floating-number/flyer effects must use stage-appropriate shapes. When new motes spawn, their sprite must use stage-appropriate shapes. No more generic dots.

### 2.2 Click burst — per stage

In `ParticleField.tsx`, `createBurstSet` currently spawns generic circular bursts. Replace with stage-keyed burst spawner. Add to `types.ts`:

```ts
export interface Burst {
  // existing fields
  spriteId?: number;   // NEW — stageId for drawing
}
```

In `createBurstSet`, accept the stage id and tag every burst:

```ts
function createBurstSet(
  x: number, y: number, count: number, color: string, speedBase: number, stageId: number,
): Burst[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2 + Math.random() * 0.4;
    const speed = speedBase + Math.random() * 3;
    return {
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: 2 + Math.random() * 2.5,
      life: 1,
      color,
      spriteId: stageId,
    };
  });
}
```

In `canvas/drawEffects.ts`, when drawing bursts, dispatch to `drawStageSprite` if `spriteId` is set; otherwise fall back to the existing circle.

### 2.3 Click feedback — `lastClickEvent` visualization

`FloatingNumber.tsx` shows a number that floats up. Add a small inline icon next to the number whose shape matches the stage. Quickest path: render the stage's mote sprite at quarter scale into a `<canvas>` element of size 16×16 inside the floating number.

```tsx
// FloatingNumber.tsx
export function FloatingNumber({ x, y, text, variant, stageId }: FloatingNumberProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    drawStageSprite(ctx, stageId, 8, 8, 5, '#fff', 1, performance.now() / 1000);
  }, [stageId]);
  return (
    <div className={`float-text ${variant}`} style={{ left: `${x}px`, top: `${y}px` }}>
      <canvas ref={canvasRef} width={16} height={16} className="float-glyph" />
      <span>{text}</span>
    </div>
  );
}
```

Pass `stageId` from `GameScreen.tsx`.

### 2.4 Click flyer — per stage

`world.flyers` currently are generic moving particles emitted on click that fly toward the core. Make their shape stage-specific too. Add `spriteId?: number` to `Flyer` and dispatch in `drawWake.ts` (or wherever flyers render).

### 2.5 Mote spawn shape

Already covered by Module A's `drawStageSprite`, but ensure that when a mote is spawned it uses the *current stage's* sprite, not a previous stage's. Specifically, in `createBaseMote(...)`, the mote's color is set from `pickStageColor(stage)` — that's fine — but make sure ParticleField's tick loop re-reads the stage prop on every frame (no stale closure).

### 2.6 Encounter (rogue) shape

`drawRogues.ts` should look up `getStageRogueShape(stage.id)` and render the matching sprite. The rogue's tier (minor / major / massive) controls *size and glow*; the *shape* comes from stage.

For example, in stage 7 (First Stars), all rogues look like stars but minor = small dim star, massive = huge red supergiant. In stage 11 (Life), rogues look like cells — minor = single cell, massive = multicellular blob.

### 2.7 Stage-specific click feedback inside mechanics

Each mechanic in `mechanics/` should already have a `draw` hook. Use it to draw a *click reaction* using stage shapes. For example:

- `click_basic` (Inflation): a single radial expansion ring grows fast.
- `matter_asymmetry` (Baryogenesis): a click creates a pulse at the cursor that *repels* the nearest antimatter pair.
- `nucleosynthesis`: click forces nearby motes to bind into a nucleus instantly.
- `first_stars`: click ignites a star at the cursor — visualized as a radial-burst into a 4-pointed star sprite.
- `recombination`: click captures the nearest electron, spawning a photon streak.

Each mechanic adds a small ephemeral visual effect into `world.bursts` or a new `world.mechanicFx[]` collection (define if needed; cap length).

### 2.8 Acceptance for Module B

1. Click 5 times in each of the 16 stages and verify burst, floating number, and flyer all use that stage's sprite.
2. New motes spawn with the correct sprite even if the previous stage's mote left a residual — i.e., no cross-stage sprite leak.
3. Encounter rogues' shape changes by stage as described.

---

## 3. Module C — Skill Tree System (Data Layer)

### 3.1 Goals

- 4 skill trees, each rooted in one of: CLICK / AUTO / CRIT / TIME.
- Each tree has 4 tiers: Tier 1 = root with 10 levels, Tier 2 = 3 branch nodes, Tier 3 = 3 specialization nodes (depending on T2 ownership), Tier 4 = 1 ultimate node.
- 48 nodes total across 4 trees.
- Nodes are unlocked by prerequisites; resources are spent to purchase them.

### 3.2 New types

In `src/game/skills/types.ts`:

```ts
export type SkillTreeId = 'click' | 'auto' | 'crit' | 'time';
export type SkillTier = 1 | 2 | 3 | 4;

export interface SkillNodeDef {
  id: string;                         // e.g. 'click_t2_echoing'
  treeId: SkillTreeId;
  tier: SkillTier;
  label: string;
  description: string;
  cost: number;                       // SP for T2/T3, condensedMass for T4
  costCurrency: 'skillPoints' | 'condensedMass';
  prerequisites: string[];            // node ids that must be owned
  prereqRootLevel?: number;           // if set, root level must be >= this
  effectId: string;                   // key into effects.ts dispatch table
}

export interface SkillTreeDef {
  id: SkillTreeId;
  label: string;
  description: string;
  rootCostCurve: (level: number) => number;   // Tier 1 cost in quanta
  rootMaxLevel: number;                       // 10
  nodes: SkillNodeDef[];                      // T2/T3/T4 nodes
}

export interface SkillState {
  click: { rootLevel: number; ownedNodes: string[] };
  auto:  { rootLevel: number; ownedNodes: string[] };
  crit:  { rootLevel: number; ownedNodes: string[] };
  time:  { rootLevel: number; ownedNodes: string[] };
}
```

Add `SkillState` and `skillPoints: number` to `PersistentGameState` in `types.ts`.

### 3.3 Tree definitions

In `src/game/skills/definitions.ts`, declare all 4 trees with their nodes. Use exactly these:

```ts
import type { SkillTreeDef } from './types';

const STELLAR_FORGE: SkillTreeDef = {
  id: 'click',
  label: 'Stellar Forge',
  description: 'Each click strikes harder.',
  rootMaxLevel: 10,
  rootCostCurve: (lvl) => Math.ceil(50 * Math.pow(2.4, lvl)),
  nodes: [
    // Tier 2
    { id: 'click_t2_echoing', treeId: 'click', tier: 2, label: 'Echoing Click',
      description: 'Each click has 18% chance to fire twice.', cost: 5, costCurrency: 'skillPoints',
      prerequisites: [], prereqRootLevel: 10, effectId: 'click_echo' },
    { id: 'click_t2_combo_warden', treeId: 'click', tier: 2, label: 'Combo Warden',
      description: 'Combo timeout extends from 700ms to 1100ms.', cost: 5, costCurrency: 'skillPoints',
      prerequisites: [], prereqRootLevel: 10, effectId: 'combo_extend' },
    { id: 'click_t2_first_strike', treeId: 'click', tier: 2, label: 'First Strike',
      description: 'The first click of a new combo gains x3.', cost: 5, costCurrency: 'skillPoints',
      prerequisites: [], prereqRootLevel: 10, effectId: 'first_strike' },
    // Tier 3
    { id: 'click_t3_pair_production', treeId: 'click', tier: 3, label: 'Pair Production',
      description: 'Every 7th click is a guaranteed crit.', cost: 12, costCurrency: 'skillPoints',
      prerequisites: ['click_t2_echoing'], effectId: 'pair_production' },
    { id: 'click_t3_resonant', treeId: 'click', tier: 3, label: 'Resonant Strike',
      description: 'Clicks within 1s of a stage transition deal x10.', cost: 12, costCurrency: 'skillPoints',
      prerequisites: ['click_t2_combo_warden'], effectId: 'resonant_strike' },
    { id: 'click_t3_avalanche', treeId: 'click', tier: 3, label: 'Quark Avalanche',
      description: 'On reaching 50 combo, the next click multiplies by combo count.', cost: 12, costCurrency: 'skillPoints',
      prerequisites: ['click_t2_first_strike'], effectId: 'quark_avalanche' },
    // Tier 4 ultimate
    { id: 'click_t4_big_bang', treeId: 'click', tier: 4, label: 'Big Bang Click',
      description: 'Once per stage: a single click that gains sqrt(totalClicks) * clickPower.',
      cost: 25, costCurrency: 'condensedMass',
      prerequisites: ['click_t3_pair_production', 'click_t3_resonant'], effectId: 'big_bang_click' },
  ],
};

const COSMIC_WEB: SkillTreeDef = {
  id: 'auto',
  label: 'Cosmic Web',
  description: 'Idle accrual grows in volume and reach.',
  rootMaxLevel: 10,
  rootCostCurve: (lvl) => Math.ceil(80 * Math.pow(2.4, lvl)),
  nodes: [
    { id: 'auto_t2_hawking_echo', treeId: 'auto', tier: 2, label: 'Hawking Echo',
      description: 'Offline progress rate raises 50% to 100%.', cost: 5, costCurrency: 'skillPoints',
      prerequisites: [], prereqRootLevel: 10, effectId: 'hawking_echo' },
    { id: 'auto_t2_dark_energy', treeId: 'auto', tier: 2, label: 'Dark Energy',
      description: 'Auto ticks contribute to combo counter (10 ticks = +1 combo).', cost: 5, costCurrency: 'skillPoints',
      prerequisites: [], prereqRootLevel: 10, effectId: 'dark_energy' },
    { id: 'auto_t2_self_catalysis', treeId: 'auto', tier: 2, label: 'Self-Catalysis',
      description: 'Auto rate multiplied by log10(1 + currentQuanta).', cost: 5, costCurrency: 'skillPoints',
      prerequisites: [], prereqRootLevel: 10, effectId: 'self_catalysis' },
    { id: 'auto_t3_vacuum_decay', treeId: 'auto', tier: 3, label: 'Vacuum Decay',
      description: 'Auto rate accelerates by +0.1% per second since stage start.', cost: 12, costCurrency: 'skillPoints',
      prerequisites: ['auto_t2_hawking_echo'], effectId: 'vacuum_decay_skill' },
    { id: 'auto_t3_filament', treeId: 'auto', tier: 3, label: 'Filament Network',
      description: 'Auto rate gains stagesCleared^1.2 multiplier.', cost: 12, costCurrency: 'skillPoints',
      prerequisites: ['auto_t2_dark_energy'], effectId: 'filament_network' },
    { id: 'auto_t3_eternal', treeId: 'auto', tier: 3, label: 'Eternal Engine',
      description: 'Auto continues during condense and cinematics.', cost: 12, costCurrency: 'skillPoints',
      prerequisites: ['auto_t2_self_catalysis'], effectId: 'eternal_engine' },
    { id: 'auto_t4_web_of_all', treeId: 'auto', tier: 4, label: 'Web of All',
      description: 'Auto rate gains a multiplier equal to (clickRootLevel)^2.',
      cost: 25, costCurrency: 'condensedMass',
      prerequisites: ['auto_t3_filament', 'auto_t3_eternal'], effectId: 'web_of_all' },
  ],
};

const QUANTUM_LENS: SkillTreeDef = {
  id: 'crit',
  label: 'Quantum Lens',
  description: 'Critical strikes warp probability.',
  rootMaxLevel: 10,
  rootCostCurve: (lvl) => Math.ceil(120 * Math.pow(2.4, lvl)),
  nodes: [
    { id: 'crit_t2_heisenberg', treeId: 'crit', tier: 2, label: 'Heisenberg',
      description: 'Crit damage is randomized [50%, 200%] of normal (avg +25%).', cost: 5, costCurrency: 'skillPoints',
      prerequisites: [], prereqRootLevel: 10, effectId: 'heisenberg' },
    { id: 'crit_t2_entanglement', treeId: 'crit', tier: 2, label: 'Entanglement',
      description: 'After a crit, the next click within 1s is also a crit.', cost: 5, costCurrency: 'skillPoints',
      prerequisites: [], prereqRootLevel: 10, effectId: 'entanglement' },
    { id: 'crit_t2_wave_collapse', treeId: 'crit', tier: 2, label: 'Wave Collapse',
      description: 'Auto ticks may also crit.', cost: 5, costCurrency: 'skillPoints',
      prerequisites: [], prereqRootLevel: 10, effectId: 'wave_collapse' },
    { id: 'crit_t3_tunneling', treeId: 'crit', tier: 3, label: 'Tunneling',
      description: 'Crit chance bypasses the 50% cap; can reach 100%.', cost: 12, costCurrency: 'skillPoints',
      prerequisites: ['crit_t2_heisenberg'], effectId: 'tunneling' },
    { id: 'crit_t3_superposition', treeId: 'crit', tier: 3, label: 'Superposition',
      description: 'Each click yields 50% gain plus 50% chance of an extra crit.', cost: 12, costCurrency: 'skillPoints',
      prerequisites: ['crit_t2_entanglement'], effectId: 'superposition' },
    { id: 'crit_t3_many_worlds', treeId: 'crit', tier: 3, label: 'Many Worlds',
      description: 'Encounter collisions roll crit at 2x chance.', cost: 12, costCurrency: 'skillPoints',
      prerequisites: ['crit_t2_wave_collapse'], effectId: 'many_worlds' },
    { id: 'crit_t4_schrodinger', treeId: 'crit', tier: 4, label: "Schrödinger Strike",
      description: 'Crit decisions defer 5s; on resolve, accumulated clicks resolve as crits.',
      cost: 25, costCurrency: 'condensedMass',
      prerequisites: ['crit_t3_tunneling', 'crit_t3_superposition'], effectId: 'schrodinger' },
  ],
};

const TEMPORAL_FLOW: SkillTreeDef = {
  id: 'time',
  label: 'Temporal Flow',
  description: 'Bend the rate of cosmic time.',
  rootMaxLevel: 10,
  rootCostCurve: (lvl) => Math.ceil(200 * Math.pow(2.4, lvl)),
  nodes: [
    { id: 'time_t2_inflaton', treeId: 'time', tier: 2, label: 'Inflaton Echo',
      description: 'First 5s of each stage runs at time x3.', cost: 5, costCurrency: 'skillPoints',
      prerequisites: [], prereqRootLevel: 10, effectId: 'inflaton_echo' },
    { id: 'time_t2_compression', treeId: 'time', tier: 2, label: 'Compression',
      description: 'Stage transitions complete 60% faster.', cost: 5, costCurrency: 'skillPoints',
      prerequisites: [], prereqRootLevel: 10, effectId: 'compression' },
    { id: 'time_t2_persistence', treeId: 'time', tier: 2, label: 'Persistence',
      description: 'Each click freezes time for 0.3s (combo retention).', cost: 5, costCurrency: 'skillPoints',
      prerequisites: [], prereqRootLevel: 10, effectId: 'time_persistence' },
    { id: 'time_t3_dilation', treeId: 'time', tier: 3, label: 'Dilation',
      description: 'When quanta is in [80%, 100%] of threshold, time x0.5 but rewards x4.', cost: 12, costCurrency: 'skillPoints',
      prerequisites: ['time_t2_inflaton'], effectId: 'dilation' },
    { id: 'time_t3_hawking_time', treeId: 'time', tier: 3, label: 'Hawking Time',
      description: 'Stages 13-15 run with an extra time x2 multiplier.', cost: 12, costCurrency: 'skillPoints',
      prerequisites: ['time_t2_compression'], effectId: 'hawking_time' },
    { id: 'time_t3_light_cone', treeId: 'time', tier: 3, label: 'Light Cone',
      description: 'Every 100 clicks pre-simulates 1s of progress.', cost: 12, costCurrency: 'skillPoints',
      prerequisites: ['time_t2_persistence'], effectId: 'light_cone' },
    { id: 'time_t4_eternal_return', treeId: 'time', tier: 4, label: 'Eternal Return',
      description: 'Once per run: rewind to previous stage and re-clear it, retaining gains.',
      cost: 25, costCurrency: 'condensedMass',
      prerequisites: ['time_t3_dilation', 'time_t3_hawking_time'], effectId: 'eternal_return' },
  ],
};

export const SKILL_TREES: SkillTreeDef[] = [STELLAR_FORGE, COSMIC_WEB, QUANTUM_LENS, TEMPORAL_FLOW];
```

### 3.4 Effect dispatch

In `src/game/skills/effects.ts`, build a single function `getActiveModifiers(skills: SkillState, ctx: ModifierContext): Modifiers` that walks owned nodes and produces a `Modifiers` object:

```ts
export interface Modifiers {
  clickPowerMult: number;          // base 1
  clickPowerAdd: number;           // base 0
  autoRateMult: number;
  autoRateAdd: number;
  critChanceAdd: number;
  critChanceCapAdd: number;
  critMultMult: number;
  comboTimeoutMs: number;          // base 700
  comboCapAdd: number;
  timeMultMult: number;            // base 1
  echoClickChance: number;         // base 0
  firstStrikeMult: number;         // base 1
  pairProductionPeriod: number;    // 0 = disabled, 7 = every 7th click
  resonantStrikeMult: number;
  avalancheUnlocked: boolean;
  bigBangUnlocked: boolean;
  hawkingEcho: boolean;
  darkEnergyAuto: boolean;
  selfCatalysis: boolean;
  vacuumDecayPerSec: number;
  filamentExp: number;             // 0 = disabled, otherwise the exponent
  eternalEngine: boolean;
  webOfAll: boolean;
  heisenberg: boolean;
  entanglement: boolean;
  waveCollapse: boolean;
  tunneling: boolean;
  superposition: boolean;
  manyWorlds: boolean;
  schrodinger: boolean;
  inflatonEchoSec: number;
  compressionFactor: number;
  timePersistenceMs: number;
  dilation: boolean;
  hawkingTime: boolean;
  lightCone: boolean;
  eternalReturnUnlocked: boolean;
}

export function defaultModifiers(): Modifiers { /* zeros / ones */ }

export function getActiveModifiers(skills: SkillState, ctx: ModifierContext): Modifiers {
  const m = defaultModifiers();
  const allOwned = [...skills.click.ownedNodes, ...skills.auto.ownedNodes,
                    ...skills.crit.ownedNodes, ...skills.time.ownedNodes];
  // Tier 1 root effects scale by rootLevel (no cap; pure level → multiplier)
  m.clickPowerMult *= Math.pow(1.6, skills.click.rootLevel);
  m.autoRateAdd     = skills.auto.rootLevel === 0 ? 0 : Math.pow(1.7, skills.auto.rootLevel);
  m.critChanceAdd  += skills.crit.rootLevel * 0.025;
  m.critMultMult   *= 1 + skills.crit.rootLevel * 0.5;
  m.timeMultMult   *= Math.pow(1.25, skills.time.rootLevel);
  for (const id of allOwned) {
    applyNodeEffect(m, id, ctx);
  }
  return m;
}
```

`applyNodeEffect` is a switch on node id that mutates `m` accordingly. ~70 lines.

### 3.5 Reducer actions

In `reducer.ts`, add two new actions:

```ts
| { type: 'BUY_SKILL_ROOT'; treeId: SkillTreeId }
| { type: 'BUY_SKILL_NODE'; nodeId: string }
| { type: 'AWARD_SKILL_POINTS'; amount: number }
```

`BUY_SKILL_ROOT`:
- Look up the tree's `rootCostCurve(state.skills[treeId].rootLevel)` against `state.quanta`.
- If affordable and rootLevel < rootMaxLevel, deduct quanta and increment rootLevel.

`BUY_SKILL_NODE`:
- Find node by id. Verify prerequisites and rootLevel gate. Verify currency (skillPoints or condensedMass) ≥ cost.
- Deduct currency and add to `ownedNodes`.

`AWARD_SKILL_POINTS`: increments `state.skillPoints` by `amount`.

Hook `AWARD_SKILL_POINTS` into:
- `ADVANCE_STAGE` reducer: dispatch +1 SP after advancing.
- `REPORT_COLLISION` reducer: +1 SP if tier === 'major', +3 if tier === 'massive'.
- `PRESTIGE` reducer: +5 SP at run end.

### 3.6 Acceptance for Module C

1. Reducer unit tests for `BUY_SKILL_ROOT` and `BUY_SKILL_NODE` covering: insufficient currency, locked prereq, unmet root level, max level reached, success.
2. `getActiveModifiers` returns expected values for several owned-node configurations (write 5 fixture tests).
3. Save migration v2 → v3 adds `skills` and `skillPoints` to existing saves with default zeros.

---

## 4. Module D — Skill Panel UI

### 4.1 Removal

Delete `<UpgradePanel>` from `GameScreen.tsx` footer. Also delete the import. The footer should now contain only the `<ResourcePanel>` and the condense button (move the condense button into ResourcePanel since it's resource-related anyway).

### 4.2 New floating button

In `GameScreen.tsx`, add a `<SkillsButton>` at fixed bottom-right of the field:

```tsx
<SkillsButton
  skillPoints={state.skillPoints}
  hasUnlockableTier={hasAnyAffordableSkill(state)}
  onClick={() => setSkillsPanelOpen(true)}
/>
```

`hasAnyAffordableSkill` checks if any tree's root upgrade or any unlocked node is affordable.

### 4.3 Slide-in panel

`src/components/skills/SkillsPanel.tsx`:

```
┌──────────────────────────────────────────────┐
│ COSMIC SKILLS                          [✕]   │
├──────────────────────────────────────────────┤
│ Quanta: 1.2M    SP: 12    Mass: 8            │
├──────────────────────────────────────────────┤
│ [Stellar Forge] [Cosmic Web] [Lens] [Flow]   │
├──────────────────────────────────────────────┤
│                                              │
│   (SVG SkillTreeView for active tab)         │
│                                              │
│                                              │
│ Selected node: "Echoing Click"               │
│ Click has 18% chance to fire twice.          │
│ Cost: 5 SP   [BUY]                           │
└──────────────────────────────────────────────┘
```

Behavior:
- Slides in from right at 420px width.
- ESC closes it. Backdrop click closes it.
- Tab buttons select tree.
- The SVG tree shows root + 3 T2 + 3 T3 + 1 T4 in a fixed layout (see §4.5).
- Hovering a node shows its tooltip; clicking selects it; clicking BUY triggers the appropriate action.

### 4.4 SkillTreeView (SVG layout)

```
                          ●  ROOT (Tier 1)
                          │
              ┌───────────┼───────────┐
              │           │           │
              ●           ●           ●        Tier 2 (3 nodes)
              │           │           │
              ●           ●           ●        Tier 3 (3 nodes)
              └───────────┼───────────┘
                          │
                          ●                    Tier 4 ultimate
```

Hard-coded 320×420 SVG layout. Lines drawn based on prerequisite relationships. Node colors:
- locked (greyscale, dotted border)
- available (glowing accent border, animated pulse)
- owned (filled accent color)

For root, draw a progress ring around the node showing `rootLevel / rootMaxLevel`.

### 4.5 Tier 1 click — buys 1 root level at a time

When the root node is clicked, the bottom of panel shows:

```
"Quark Bond" — Tier 1 Root
Each level multiplies click power by 1.6×.
Current: LV 7/10
Next cost: 4,167 quanta
[ BUY +1 LV ]
```

`[BUY +1 LV]` is disabled when `quanta < cost` or `rootLevel >= rootMaxLevel`.

### 4.6 Acceptance for Module D

1. Skill panel opens, closes (ESC, ✕, backdrop), persists tab selection.
2. Click on root → buy upgrades quanta correctly; level increments.
3. Click on T2 node when root < 10 → BUY disabled, tooltip explains "Reach root level 10".
4. Click on T2 → BUY → SP deducts, ownedNodes updates, node visually fills in.
5. Existing UpgradePanel removed; no orphan imports.

---

## 5. Module E — Skill-Driven Power (No Auto-Growth)

### 5.1 Goal

> "스킬을 올리지 않으면 스테이지가 지나도 클릭하거나 그래도 올라가지 않아."

Translation: if the player does not upgrade skills, advancing stages alone must not increase click power, auto rate, crit chance, or time multiplier. All gains come from skills.

### 5.2 Rewrite formulas.ts

Replace `getClickPower`, `getAutoRate`, `getCritChance`, `getCritMultiplier`. They no longer take `Stage` as input; they take only `Modifiers` (and optional ctx for combo, etc.).

```ts
import type { Modifiers } from './skills/effects';

const BASE_CLICK = 1;
const BASE_AUTO = 0;

export function getClickPower(mods: Modifiers): number {
  return (BASE_CLICK + mods.clickPowerAdd) * mods.clickPowerMult;
}

export function getAutoRate(mods: Modifiers): number {
  return (BASE_AUTO + mods.autoRateAdd) * mods.autoRateMult;
}

export function getCritChance(combo: number, mods: Modifiers): number {
  const base = mods.critChanceAdd + combo * 0.005;
  const cap = 0.5 + mods.critChanceCapAdd;
  return Math.min(cap, base);
}

export function getCritMultiplier(mods: Modifiers): number {
  return 3 * mods.critMultMult;
}

// NEW
export function getTimeMultiplier(mods: Modifiers): number {
  return mods.timeMultMult;
}
```

Important: existing call sites in `reducer.ts` (CLICK case, TICK case) and in `GameScreen.tsx` (display values) must be updated. They currently pass `(stage, level, prestigeBoost)` — change to compute modifiers once per render and pass that:

```ts
// In GameScreen.tsx
const modifiers = useMemo(
  () => getActiveModifiers(state.skills, { stagesCleared: state.stageIdx, ...etc }),
  [state.skills, state.stageIdx, ...]
);

const clickPower = getClickPower(modifiers);
const autoRate = getAutoRate(modifiers);
```

In `reducer.ts`, the reducer is pure — it cannot call `getActiveModifiers` directly without ctx. Solution: pass `modifiers` into the action payload from `GameScreen.tsx`:

```ts
dispatch({ type: 'CLICK', now, randomValue, x, y, modifiers, forceCrit });
```

Or, simpler: store a derived `currentModifiers` snapshot on state in a `'SET_MODIFIERS'` action that fires whenever skills change. The action is dispatched from a `useEffect` watching `state.skills`. Both work; pick one and document it.

### 5.3 Threshold curve adjustment (calibrated for the 100-hour completion target)

> See Module I (§12) for the canonical time-budget derivation. The numbers below are derived from those constraints — do not change them without re-running the balance simulation.

Calibration assumptions:
- **Total real-time to first completion**: ~100 hours (360,000 s).
- **Player click rate (active)**: up to 10 clicks per second on mobile.
- **Active vs idle split (lifetime)**: 30% active clicking, 70% idle accrual.
- **Click power no longer scales with stage** — only with skills. A fresh-from-prestige player on stage 1 has `click = 1` until the first skill purchase.

Per-stage real-time targets (sum = 360,000 s = 100 h):

| stage | name | realPlayTargetSec | h:mm | threshold |
|---|---|---:|---:|---:|
| 1 | Inflation | 60 | 0:01 | 60 |
| 2 | Baryogenesis | 180 | 0:03 | 600 |
| 3 | QGP | 300 | 0:05 | 4,000 |
| 4 | Nucleosynthesis | 600 | 0:10 | 25,000 |
| 5 | Recombination | 1,200 | 0:20 | 200,000 |
| 6 | Cosmic Dark Age | 2,400 | 0:40 | 1.6e6 |
| 7 | First Stars | 4,800 | 1:20 | 1.4e7 |
| 8 | Reionization | 9,600 | 2:40 | 1.4e8 |
| 9 | Galaxy Formation | 14,400 | 4:00 | 1.6e9 |
| 10 | Solar System Forms | 38,460 | 10:41 | 4.5e10 |
| 11 | Life on Earth | 50,000 | 13:53 | 8.0e11 |
| 12 | Death of Earth | 35,000 | 9:43 | 1.0e13 |
| 13 | Stelliferous End | 59,000 | 16:23 | 1.0e15 |
| 14 | Degenerate Era | 40,000 | 11:06 | 1.0e17 |
| 15 | Black Hole Era | 50,000 | 13:53 | 1.0e20 |
| 16 | The End | 54,000 | 15:00 | 1.0e24 |
| **Total** | | **360,000** | **100:00** | |

Threshold derivation (per stage):
```
expected_clicks_active   = realPlayTargetSec * 0.3 * 10  // 30% active at 10 CPS
expected_idle_seconds    = realPlayTargetSec * 0.7
threshold ≈ expected_clicks_active * avg_click_power(stage)
          + expected_idle_seconds  * avg_auto_rate(stage)
```
The numbers above are tuned so this equality holds when the player is buying skills at a "moderate" rate (root level grows by ~1 per minute of stage progress, plus T2 picks at stage 7+).

Skill cost curve (revised for 100h budget):
```ts
// Tier 1 root cost — quanta. Growth of 2.4 per level was too fast for 100h.
// Use 1.95 instead so root level scales smoothly across the full 100h.
function rootCostCurve(treeIdx: number, lvl: number): number {
  const treeBase = [40, 70, 110, 180][treeIdx];  // click, auto, crit, time
  return Math.ceil(treeBase * Math.pow(1.95, lvl));
}
// Click root cost: lvl1=40, lvl5=584, lvl10=8.4K, lvl15=120K, lvl20=1.7M, lvl25=24M.
// Late-game player invests root level into the 25-30 range across all 4 trees.
```

Increase root max level to 30 (was 10):
```ts
rootMaxLevel: 30,        // was 10
prereqRootLevel: 15,     // T2 nodes unlock at root level 15 (was 10)
// T3 still requires owning a T2 prereq node
// T4 unchanged: requires 2 T3 nodes
```

Click-power growth at root level 30: `1.6^30 ≈ 4.2e6`. Combined with crit (×~25), combo (×8), and T2/T3 multipliers, late-game per-click gain reaches ~1e10 — sufficient to chip away at stage 16's 1e24 threshold over 15 hours of mixed active/idle play.

Auto-rate growth at root level 30: `1.7^30 ≈ 2.3e7/sec`. Over a 15-hour stage that's `2.3e7 × 54000 ≈ 1.2e12`. The remaining `~1e24 - 1e12` comes from active clicks plus T2/T3 multipliers (Self-Catalysis × log(quanta), Filament Network × stagesCleared^1.2, etc.). The math is set up so the late-game requires owning multiple Tier 3 nodes — i.e., the time budget *forces* skill investment.

If `npm run sim` reports any stage outside ±30% of its `realPlayTargetSec`, retune the corresponding threshold first, then the skill cost curve. Do not change the realPlayTarget column itself — that's the hard requirement from the user.

### 5.4 Update mechanics that previously assumed stage-scaled click power

In `mechanics/recombination.ts` and similar, any code that paid out as a function of `stage.threshold` needs to switch to "X seconds of current auto rate" or "100 clicks at current click power" — i.e., normalized to *player capacity*, not stage threshold.

### 5.5 Acceptance for Module E

1. Fresh save: clicking on stage 1 yields exactly 1 quantum per click. Confirmed via reducer unit test.
2. Advancing through 5 stages without buying any skill → click power is still exactly 1.
3. Buying click root to level 5 → click power = 1.6^5 ≈ 10.49.
4. Adding `click_t2_first_strike` → first click of combo gains x3 (= 31.46 at click root 5).
5. Balance sim: a "buy nothing" run gets stuck in stage 1 (cannot reach threshold via auto either, since auto root level 0 = 0/sec).

### 5.6 Number Display Policy — No Decimals In Game UI

Game-facing numbers must never display decimal points.

Important distinction:
- Internal calculations may use floating-point values.
- Saved state may store floating-point values where needed.
- Balance simulation may print decimals if useful for debugging.
- But all player-facing UI must show whole numbers or compact integer notation only.

Add a shared formatter:

```ts
// src/game/format.ts
export function formatGameNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';

  const abs = Math.abs(value);

  if (abs < 1_000) {
    return Math.floor(value).toLocaleString();
  }

  const units = [
    { value: 1e24, suffix: 'Y' },
    { value: 1e21, suffix: 'Z' },
    { value: 1e18, suffix: 'E' },
    { value: 1e15, suffix: 'P' },
    { value: 1e12, suffix: 'T' },
    { value: 1e9, suffix: 'B' },
    { value: 1e6, suffix: 'M' },
    { value: 1e3, suffix: 'K' },
  ];

  const unit = units.find((u) => abs >= u.value);
  if (!unit) return Math.floor(value).toLocaleString();

  return `${Math.floor(value / unit.value)}${unit.suffix}`;
}

---

## 6. Module F — Time Acceleration Skill

### 6.1 Mechanic

The Time skill multiplies three things by the same factor `T = mods.timeMultMult`:

1. `cosmicTimePerRealSec` (visual cosmic clock advances faster).
2. `effectiveAutoRate = getAutoRate(mods) * T` (production gain).
3. `encounterIntervalMs / T` (encounters spawn more often).

### 6.2 Implementation

In `timeFlow.ts`:

```ts
export function getCosmicTimePerRealSec(stage: Stage, prevStage: Stage | null, timeMult: number): number {
  const span = stage.cosmicTimeSec - (prevStage?.cosmicTimeSec ?? 0);
  return (span / Math.max(1, stage.realPlayTargetSec)) * timeMult;
}
```

In `reducer.ts` `TICK` case, the `gained` per dt should multiply by `timeMult`. In `ParticleField.tsx`, the encounter cooldown decrements by `dt * timeMult` so encounters spawn faster.

### 6.3 Visual feedback

When `timeMult > 1.5`:
- Apply CSS filter on the field canvas: `filter: blur(${(timeMult-1)*0.5}px) saturate(${1+(timeMult-1)*0.1})`.
- Star streak length proportional to `timeMult` (extend `STAR_STREAK_MULTIPLIER` dynamically).
- Audio: trigger `playTimeAccelerationWhoosh(timeMult)` once per real second.

When `timeMult > 5`:
- Add a translucent yellow overlay at 5% opacity to indicate "time-accelerated state".

### 6.4 Acceptance for Module F

1. Buy time root to level 1 → cosmic clock advances 1.25x faster than at level 0.
2. Buy time root to level 10 → cosmic clock advances ~9.31x faster.
3. Auto rate visibly increases when time skill increases (independent of auto skill).
4. Visual blur and streak appear at level 4+.
5. Buying `time_t3_hawking_time` while on stage 14 → no extra effect; on stage 14 → 2x.

---

## 7. Module G — Tooltips, Tutorial, Discoverability

### 7.1 Onboarding tutorial

First-time players (universeCount === 1, totalClicks === 0) see a forced 3-step tutorial overlay:

1. "Click the cosmos to gather quanta." — arrow points at the field.
2. After 5 clicks: "Open Skills to grow your power." — arrow points at SkillsButton.
3. On panel open: "Buy your first Stellar Forge level." — arrow points at root node.

Skip button always available. Set `tutorialDone: true` in persistent state after step 3 or skip.

### 7.2 Per-node tooltip content

Tooltips show:
- Node name
- Description
- Current effect (computed from current modifiers)
- "Next effect" if buyable (showing what changes after purchase)
- Cost + currency
- Locked-reason if locked ("Requires X" or "Reach root level 10")

### 7.3 Cosmic Almanac

A collapsible info panel triggered by an "i" icon on the timeline. Shows:
- Current stage scientific note (e.g., "BBN produced ~75% H, ~25% He by mass.")
- Stage progression so far
- Current modifiers summary

Content per stage written as plain English in `src/game/almanac.ts`:

```ts
export const ALMANAC: Record<number, { title: string; body: string }> = {
  1: { title: 'Inflation', body: 'In a fraction of a second, the universe expands by a factor of more than 10^26. The mechanism is a hypothesized scalar field called the inflaton.' },
  // ... 16 entries
};
```

### 7.4 Acceptance for Module G

1. Fresh save shows tutorial; after completing or skipping, tutorial does not return.
2. Tooltips render correctly with locked/available/owned states.
3. Almanac button on timeline opens a panel with content for the current stage.

---

## 8. Module H — Migration v2 → v3

### 8.1 Schema bump

Bump `SaveState.version` from 2 to 3. Add fields:

```ts
export interface SaveStateV3 {
  version: 3;
  // all V2 fields...
  skills: SkillState;
  skillPoints: number;
  tutorialDone: boolean;
}
```

### 8.2 Migration

```ts
function migrateV2ToV3(v2: SaveStateV2): PersistentGameState {
  return {
    ...v2,
    version: 3,
    skills: {
      click: { rootLevel: 0, ownedNodes: [] },
      auto:  { rootLevel: 0, ownedNodes: [] },
      crit:  { rootLevel: 0, ownedNodes: [] },
      time:  { rootLevel: 0, ownedNodes: [] },
    },
    skillPoints: 0,
    tutorialDone: v2.totalClicks > 0 ? true : false,
  };
}
```

Chain migrations: v1 → v2 → v3. A v1 save loaded after V2 update should still hydrate cleanly.

### 8.3 Acceptance for Module H

1. v1 save → v3 hydration: succeeds, all defaults applied.
2. v2 save → v3: succeeds, no data loss.
3. v3 save → v3: identity round-trip.

---

## 9. Module I — Time Budget & Pacing (NEW, hard constraint)

### 9.1 Hard requirement

A player completing the game on **mobile** with **up to 10 clicks per second** of active play must require **approximately 100 hours of total real time** to clear all 16 stages and reach an ending for the first time. This is non-negotiable; everything else (thresholds, skill costs, idle rates, rewards) bends to this constraint.

### 9.2 The numbers behind the budget

```
TOTAL_REAL_HOURS         = 100
TOTAL_REAL_SECONDS       = 360,000
ACTIVE_FRACTION          = 0.3           // 30% of play time is active clicking
IDLE_FRACTION            = 0.7
MAX_ACTIVE_CPS_MOBILE    = 10            // 10 clicks/sec achievable on mobile
EXPECTED_CLICKS_LIFETIME = 360,000 * 0.3 * 10  = 1,080,000 clicks
EXPECTED_IDLE_SECONDS    = 360,000 * 0.7       = 252,000 seconds
```

The per-stage `realPlayTargetSec` table in §5.3 is calibrated so the **sum** equals 360,000 s. Modify any individual stage's target only if you also adjust another stage to keep the sum constant. 

### 9.3 Why active+idle split matters

If we assumed 100% active play, the player would need to click 3.6 million times across 100 h — impossible. If we assumed 0% active play, idle rate alone would have to do all the work, removing all reasons for the click skill tree. The 30/70 split makes both axes meaningful: skill choices that boost click power *and* skill choices that boost auto rate *both* matter, and the player chooses which to prioritize.

### 9.4 Mobile considerations

- Touch targets ≥ 44 px square (Apple HIG). The clickable field already covers most of the screen — fine. Skill nodes in the panel: ensure ≥ 44 px hit area.
- Avoid hover-only tooltips. Skill node tooltips on mobile show on tap-and-hold OR on first tap (then second tap = buy).
- Combo timing: 700 ms timeout works at 10 CPS. Don't shorten.
- Encounters: their click target hitbox should be ≥ 36 px even when the visual sprite is smaller; the user can tap them mid-finger-spam.
- Idle rate boost on mobile lock screen: when the page is hidden via `visibilitychange`, the game continues to accrue auto, but at a 50% rate (call it "background drift"). This protects from abuse where someone leaves 20 tabs open. Skill `Hawking Echo` raises this from 50% → 100%.

### 9.5 Retention hooks (necessary to make 100 h not feel like a slog)

100 h is long. Without retention hooks, players will drop off around hour 5–10. Add the following:

1. **Daily check-in bonus**: When the player loads the game and the current local-day differs from `lastLoadDay`, grant `min(60, awaySec / 60)` skill points (capped at 60). Encourages daily return.
2. **Stage milestones**: Every 4 stages cleared (4, 8, 12, 16), grant a small permanent bonus visible in the Singularity Tree as "Cosmic Milestones".
3. **Hourly tick reward**: For every cumulative real-hour played in this run, a "Cosmic Hour" notification grants a small one-time entropy bonus.
4. **Combo streak achievements**: Hidden until earned. Unlock notifications: "First combo of 50", "First combo of 100", etc. Reward = 1 skill point each, 5 total tiers.

Track `cosmicHoursThisRun: number` and `dailyCheckIns: { lastDayKey: string; streakDays: number }` in `PersistentGameState`. Migration v3 → v4 adds these fields with sensible defaults.

### 9.6 Validation

`scripts/balance-sim.ts` must:
1. Simulate 1 full run with a "moderate skill investor" policy (rule: every 60 s of stage time, buy whatever skill upgrade is now affordable in priority `auto > click > crit > time`).
2. Report total real-time elapsed.
3. Fail CI if total time is outside [80, 130] hours.
4. Print per-stage real-time, click count, skill levels at end of stage, dominant skill bottleneck.

---

## 10. Final Acceptance: Definition of Done

After all modules:

1. `npm run build` passes with zero TypeScript errors.
2. `npm test` passes; coverage on `formulas.ts`, `skills/effects.ts`, `reducer.ts`, `storage.ts` is high.
3. `npm run sim` reports each stage's time-to-clear when the player invests skills as the simulator's policy dictates; results within ±30% of `realPlayTargetSec` per stage AND total elapsed time within [80, 130] hours.
4. Manual playthrough on a fresh save:
   - Stage 1: tutorial fires; first 5 clicks each gain 1 quantum.
   - At quanta = 50, clicking the SkillsButton opens the panel; buying click root level 1 makes subsequent clicks gain 1.6 quanta.
   - Each of stages 1–8 has a *visually distinct* cluster, mote sprite, click burst sprite, and encounter shape.
   - Buying a Tier 2 node on any tree produces a perceptible mechanical change.
   - Time skill at level 5 visibly accelerates the cosmic clock and ambient star streaks.
   - Reaching stage 11, the Life sub-arc fires a "civilization flicker" lasting roughly one second.
   - Choosing an ending plays the matching cinematic.
5. Loading a v1 save (preserved from before V1 refactor) hydrates into v3 cleanly.
6. All upgrade controls are inside the SkillsPanel; the GameScreen footer holds only resource info and condense.
7. No player-facing UI number contains a decimal point. Internal calculations may still use floats, but all displayed values use `formatGameNumber`.


---

## 11. Working Order

1. **Module I** (time budget — read first, drives all numerical decisions) — no code, just commit the constants in §9 to `constants.ts`.
2. **Module A** (visual identity) — establishes the look. ~1 day.
3. **Module B** (click + spawn shapes) — depends on A. ~0.5 day.
4. **Module E** (skill-driven power, formula rewrite + 100h threshold table) — ~0.75 day.
5. **Module C** (skill data layer + new root max level 30 + cost curve) — ~1.5 days.
6. **Module F** (time skill behavior) — ~0.5 day.
7. **Module D** (skill panel UI) — ~1.5 days.
8. **Module G** (tutorial / tooltips / almanac / daily check-in / hourly bonus) — ~1.25 days.
9. **Module H** (migration v2→v3, then v3→v4 for daily check-in fields) — ~0.5 day.
10. **Balance pass** — `npm run sim` until total elapsed time is in [80, 130] hours and every stage is in ±30% of its target. ~1 day.

Total: ~8.75 days of focused work.

---

## 12. Quality Bar Reminders

- **Pure reducer**: do not call DOM, audio, or fetch from inside the reducer. Pass all needed data via action payloads.
- **No Korean comments**: all code comments in English, even though user-facing UI might later be localized.
- **Match existing code style**: same import order, same file headers, same naming conventions.
- **Tests are mandatory**: every public function in `formulas.ts`, `skills/effects.ts`, and the reducer needs at least one test.
- **No new top-level dependencies** unless absolutely required. The only acceptable additions: nothing for V2 (everything fits in TS + React).

---

End of V2 specification.
