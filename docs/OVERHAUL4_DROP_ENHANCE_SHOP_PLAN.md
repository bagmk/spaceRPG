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
- **P1** maxCount unblock: route mint/grant through `addToInventory`; test a 2nd
  legendary grant succeeds. No save bump.
- **P2** C favorite/lock (save **v26**): `EntityInstance.locked?` → `isEntityInstance`
  guard + clampInstance passthrough; bump v26 + `|| v===26` SAME commit; one
  `isProtected(instance)` predicate; wire fusion spare-selection through it; lock UI
  on the owned-card; remove "전체 강화에서 제외" toggle (replaced by lock); move
  lock to fusion window click; remove "가능한 만큼 전체 강화" button.
- **P3** H equip slot-detail layout (presentation): settle slot-detail structure;
  build the shared `.collection-bar` component. No save bump.
- **P4** Shop redesign (presentation): grade-color cards (era chip, 보유 N chip,
  price pill, no gray-out), gacha box color, split stones/packs; directional guard +
  i18n; lift `RARITY_COLORS` to balance.ts. No save bump.
- **P5** Codex best-drop badge (pure-derived): `getBestDropStage` → locked-card "S{n}"
  farm badge + detail row + i18n. No save bump.
- **P6** Drop affinity kernel (tuning): add `DROP_HOME_AFFINITY_*` consts, multiply
  into pickDropStage backfill (KEEP the loop bound as the hard gate; affinity is a
  weight w/ FLOOR>0 so every later stage can still drop it), re-derive the shifted
  `stageIndependence.test.ts` assertions, balance.ts coupling comment. No save bump.
- **P7** ENHANCE duplicate-collection (save **v27**): replace matter/risk branches
  with the merge branch (consume `need(L)` spares — pooled same-rarity+stage per
  decision #1; anchor = equipped instanceId else highest-level; purge ALL consumed
  ids from slots + syncSlotUnlocks; `bestQuality(anchor, …consumed)`; EnhanceEvent →
  `{outcome:'up', mergedCount, …}`); add the **물질/강화석 copy-token** mint
  (via addToInventory); delete risk helpers + protect UI; rework the F result card
  same commit; fusion carries a level (decision #2); route fodder through isProtected;
  bump v27 + `|| v===27`; **re-pin ENTROPY_THRESHOLDS** (drop-supply + shared-pool,
  both level channels, ENH_DUP_* mirrored into the sim).
- **P8** Inventory bar semantics + G synergy retune: apply `.collection-bar`
  (spares-vs-need(level)) to owned-grid + 등급순/레벨순 sort; retune any pending G
  synergy targets in COPIES not matter, keyed off equipped-set + modest levels.

## need(L) curve
`need(L) = ENH_DUP_BASE + ENH_DUP_STEP·(L-1)` with BASE=3, STEP=2 → 3,5,7,9…;
`cumNeed(L) = L²-1`. Pooled fodder (same rarity+stage) widens effective supply;
copy-token (물질/강화석) is the high-rarity escape valve. Final numbers pinned by
the re-sim in P7.
