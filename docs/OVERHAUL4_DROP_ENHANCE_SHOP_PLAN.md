# Overhaul-4 — duplicate-collection enhance + all-stage drops + shop/inventory UI

Designed 2026-06-20 via a 16-agent workflow that verified findings against the
actual code. Branch `feat/entity-redesign` (worktree `overhaul3-pacing-econ-ui`).

## The one idea
You level gear by **collecting duplicate copies (3 → 5 → 7 → 9 …)**, not by
spending money. Six user asks fold into one system because they share the same
spine (the flat per-copy P6 inventory) and surfaces (EntityPanel + ShopPanel +
drops.ts + codex badge).

## Human decisions (locked)
1. **Economy = HYBRID (pooled fodder + card purchase).** Leveling consumes copies;
   you may feed **same-rarity + same-stage** copies as fodder (so common→epic is
   reachable by drops alone), AND you can **buy a copy with 물질/강화석** (the
   uncapped escape valve that rescues legendary/mythic and keeps 물질 a scaling
   sink). Keep 강화석 (it can also buy copies).
2. **Fusion carries a level.** Output level = (recommend) `min(input levels)` or
   `floor(avg)` — so upgrading rarity via fusion doesn't reset all leveling grind.
3. Adopted w/o asking: **remove the fail/break/protect risk mechanic** entirely
   (collection-as-progress shouldn't punish); **C favorite/lock lands before
   enhance** (its `isProtected` is the only safety net once spares auto-consume);
   only **two save bumps: v26 (lock), v27 (enhance)**.

## Balance philosophy (user-locked 2026-06-21) — GEAR is the only matter lever
The economy is balanced by ONE knob: **gear power (fusion + enhance)**. Two anchors
are FIXED and must NOT move:
- **Per-stage base matter generation stays fixed.** Do NOT auto-inflate base click
  or base auto output as stages advance. Clicking does not silently scale up.
- **Shop price is the benchmark/target** — intentionally expensive. It is the
  goalpost, not a number to lower.

The consequence the user wants: at each stage, the ONLY realistic way to afford that
stage's shop is to **equip + enhance + fuse** good gear so your matter *income* (and
click) climbs to meet the (fixed) shop price. Plain base-rate farming must NOT reach
it. So:
- **Enhance per-level effect must be TENS of times (수십배), not a few ×.** Crank
  `ENTITY_LEVEL_EFFECT_BONUS` (currently 0.85 = +85%/lvl) and/or the geometric
  `ENHANCE_MATTER_LEVEL_GROWTH` channel WAY up so a maxed item is orders of magnitude
  stronger.
- **Higher rarity → steeper per-level enhance growth** (rare/epic/legendary level to
  bigger multipliers than common). Add a per-rarity enhance-growth scalar.
- **Tune ONLY the enhance-stack (per-level power + rarity scalar) and the item-stack
  (fusion).** Do NOT change per-stage matter generation or shop prices to balance.

**Re-sim target (P7):** with base click/auto + shop prices held fixed, tune the
enhance curve + per-rarity scalar so the *max achievable gear via realistic
fusion+enhance at stage N* yields matter income that affords stage N's shop (and the
entropy gate still opens). The entropy-gate-sim must model gear-driven income vs.
shop affordability, not just gate timing.

## Verified ground truth (checked in code, not assumed)
- Duplicate count already gives **zero power** (`getEffectiveCount` → 1 for all
  non-time gear). So copies are pure leveling/fusion fuel — no power double-dip.
- The **directional invariant already holds**: `drops.ts pickDropStage` only loops
  `s = 1..playerStage-1`; `shop/daily.ts` draws `max(1, maxStage-…)`. Asks (5/6)
  need a formal **test + one defensive guard**, NOT a rebuild.
- **Levels are the dominant power lever**: `ENTITY_LEVEL_EFFECT_BONUS = 0.85`
  (= +85%/level, balance.ts:431) PLUS a geometric `ENHANCE_MATTER_LEVEL_GROWTH^(L-1)`
  channel (effects.ts:113). Drop-gating levels = gating the whole curve → **the
  entropy gate MUST be re-pinned** (entropy-gate-sim) with a drop-supply + shared-
  pool (fusion contends for copies) model covering BOTH level channels.
- Measured drop shares: rare ≈1.8%, epic ≈0.225%, legendary ≈0.05% per drop.
  Pure `cumNeed(L)=L²-1` ⇒ epic Lv10 ≈109h, legendary Lv10 ≈655h → **supply must
  widen** (hence pooled fodder + copy-token), not just cost.
- **Best drop stage = `max(stageId, RARITY_STAGE_GATES[rarity])`** — 36/289 (12.5%)
  entities have best≠home, so a naive "best==home" argmax is WRONG. One helper
  `getBestDropStage` is the single badge source.
- `enhance-all` (EntityPanel.tsx:1326) only touches the ≤7 EQUIPPED slots — keep
  it equipped-only (no mass-hoard-consume risk).

## Critical gotchas (must-not-miss)
- **Inventory wipe on load**: `convertEntityModelV14` (migrate.ts:102) does
  `rawInventory.every(isEntityInstance)` — ONE malformed copy nukes the WHOLE
  inventory. Any new per-copy field (`locked`, etc.) MUST be added to
  `isEntityInstance` (guards.ts:133), and the guard hardened to `.filter()` the
  bad entry. Pin with a save→load→save round-trip test.
- **Version-not-in-branch load failure**: bumping `SAVE_SCHEMA_VERSION` without
  adding `|| v === 26/27` to `migrateByVersion` (storage.ts:571) → fresh saves
  fail all branches → null → load failure + cloud rejection. Both lines, same commit.
- **maxCount blocks copy-mint**: `handlePurchaseEntity` (entities.ts:156) hard-caps
  legendary/mythic at 1. Route ALL copy grants through `addToInventory` (uncapped),
  not the buy path, or the escape valve dies where it's needed. (Phase 1.)
- **Fusion output is always Lv1** (fusion.ts:351) → with decision #2, make it carry
  a level or fuse→relevel is a brutal double grind.

## Phased implementation (each phase: tsc + vitest + build green; commit; FF main/feat; push)
- **P0 ✅ DONE** Pin invariants + harden migration (no behavior change). Added
  `dropDirectionality.test.ts` (DROP+SHOP+GACHA sweeps P=1..16, backward-reach,
  no-S17-leak) + `saveRoundTrip.test.ts` (length/level/quality survive, idempotent,
  empty-stays-empty, single-corrupt-copy dropped-not-wiped). Hardened
  `convertEntityModelV14` to `.filter(isEntityInstance)` (array-ness = v14
  discriminator). No save bump. 350 tests green.
- **P1 ✅ DONE** maxCount unblock: confirmed `addToInventory` is already uncapped
  (always appends a flat copy); `maxCount` gates only `handlePurchaseEntity` (buy).
  Pinned with a test (a maxCount=1 legendary grants 3 copies via addToInventory) +
  invariant comments on both. No save bump. 351 tests green.
- **P2 ✅ DONE** favorite/lock = ONE concept (save **v26**). Implemented as a
  per-ENTITY `favoriteEntityIds: string[]` (matches the grouped owned-card UI + the
  user's "favorite the item" intent; sidesteps the per-instance isEntityInstance wipe
  risk) — NOT the per-instance `locked` originally sketched. ★ on the fuse owned-card
  toggles it (TOGGLE_FAVORITE → handleToggleFavorite); favorited items are skipped by
  Fuse-All (drawAllTrios) and persist across reload + prestige. Replaced the transient
  ✕ excludedIds with the persistent ★; NO visible "즐겨찾기" text (the ★ conveys it).
  Full save plumbing (v26 + `|| v===26` + validateV5 whitelist + all carry paths);
  dead exclude i18n/CSS removed. Adversarial save-migration review = SHIP IT. 354
  tests. NOTE: "전체 강화에서 제외" toggle + "가능한 만큼 전체 강화" button removal
  deferred to **P7** (the enhance rework) to avoid mid-state churn; in P7 ★ also
  protects from pooled enhance fodder.
- **P3 ◧ IN PROGRESS** H equip-page redesign (presentation, no save). DONE: removed
  the 아이콘 안내 TraitLegend + the click/auto readout cards (`.hex-heroes`, incl. the
  superseded sticky readout); new `.equip-loadout` row = LEFT owned-stats stack
  (`.equip-statstack`, click/auto always + crit chance/mult when present — "보유한
  스탯만") + hexagon flexed right. Verified 390px: clean, one-view. REMAINING:
  multi-icon on rare+/multi-effect item cards (2–3 trait icons); the shared
  `.collection-bar` deferred to P8 (needs P7 copies-vs-need data).
- **P4** Shop redesign (presentation): grade-color cards (era chip, 보유 N chip,
  price pill, no gray-out), gacha box color, split stones/packs; directional guard +
  i18n; lift `RARITY_COLORS` to balance.ts. No save bump.
- **P5** Codex best-drop badge (pure-derived): `getBestDropStage` → locked-card "S{n}"
  farm badge + detail row + i18n. No save bump.
- **P6** Drop affinity kernel (tuning): add `DROP_HOME_AFFINITY_*` consts, multiply
  into pickDropStage backfill (KEEP the loop bound as the hard gate; affinity is a
  weight w/ FLOOR>0 so every later stage can still drop it), re-derive the shifted
  `stageIndependence.test.ts` assertions, balance.ts coupling comment. No save bump.
- **P7a ✅ DONE (29f970c) — gear-only economy crank (no save bump).** Quick crank chosen over the full dup-collection rework (user). Root causes fixed: enhance cost rode the shop anchor (unreachable levels) → ENHANCE_COST_FACTOR 1.5→0.5, GROWTH 1.35→1.15; per-rarity steepness ENHANCE_RARITY_GROWTH (common1.0…mythic1.12) + MATTER_LEVEL_GROWTH 1.3→1.2; cliff tame CLICK_GEAR_MATTER_BOOST 6→2; DEAD AUTO channel fixed — getAutoOutputAnchor now player-stage-anchored × AUTO_GEAR_INCOME_SCALE 0.16 + geo level climb (WALLET), with a TAME stage-1 split feeding the entropy gate (new transient Modifiers.autoEntropyFlatAdd / getTameAutoOutputAnchor / getAutoEntropyRate) so gate pacing is unchanged. Sim extended w/ per-stage affordability asserts + ENTROPY_THRESHOLDS recalibrated. 354 tests, sim ALL PASS. P7b (dup-collection enhance, save v27) still PENDING — the cost-via-copies model would supersede the money-cost reachability band-aid; revisit when the user wants it.
- **P7** ENHANCE duplicate-collection (save **v27**): replace matter/risk branches
  with the merge branch (consume `need(L)` spares — pooled same-rarity+stage per
  decision #1; anchor = equipped instanceId else highest-level; purge ALL consumed
  ids from slots + syncSlotUnlocks; `bestQuality(anchor, …consumed)`; EnhanceEvent →
  `{outcome:'up', mergedCount, …}`); add the **물질/강화석 copy-token** mint
  (via addToInventory); delete risk helpers + protect UI; rework the F result card
  same commit; fusion carries a level (decision #2); route fodder through isProtected;
  bump v27 + `|| v===27`; **re-pin ENTROPY_THRESHOLDS** (drop-supply + shared-pool,
  both level channels, ENH_DUP_* mirrored into the sim). **ALSO crank the enhance
  power curve per the balance philosophy:** raise `ENTITY_LEVEL_EFFECT_BONUS` /
  `ENHANCE_MATTER_LEVEL_GROWTH` to 수십배-scale + add a per-rarity enhance-growth
  scalar (rare/epic/legendary steeper), and sim gear-driven matter income vs. FIXED
  shop prices + FIXED base generation so maxed gear at stage N affords stage N's shop.
- **P8** Inventory bar semantics + G synergy retune: apply `.collection-bar`
  (spares-vs-need(level)) to owned-grid + 등급순/레벨순 sort; retune any pending G
  synergy targets in COPIES not matter, keyed off equipped-set + modest levels.

## need(L) curve
`need(L) = ENH_DUP_BASE + ENH_DUP_STEP·(L-1)` with BASE=3, STEP=2 → 3,5,7,9…;
`cumNeed(L) = L²-1`. Pooled fodder (same rarity+stage) widens effective supply;
copy-token (물질/강화석) is the high-rarity escape valve. Final numbers pinned by
the re-sim in P7.
