# Overhaul-3 — Autonomous Completion Plan (audit + user fixes)

> **AUTONOMOUS MODE.** The user wants ALL of this finished in one continuous push with
> NO confirmation prompts. Work on branch `worktree-overhaul3-pacing-econ-ui`. After each
> coherent unit: `npx tsc --noEmit` + `npx vitest run --exclude '**/worktrees/**'` +
> `npm run build` + (if balance touched) `node scripts/entropy-gate-sim.mjs`, then commit,
> then fast-forward `main` AND `feat/entity-redesign` to the tip and `git push origin main feat/entity-redesign <branch>`.
> CWD GOTCHA: always run shell cmds from the worktree (avoid `cd /Users/saesunkim/게임 &&` — it
> poisons cwd for the next command). The main working dir has `feat/entity-redesign` checked out.
> Save schema is at **v25** (P6 flat instance model shipped, commit b8308b2). Do NOT ask the user
> to confirm — just proceed.
> Update the checkboxes below as items land.

## A. Immediate user fixes (from 2026-06-19 feedback batch)
- [x] **A1 Fusion cost: rarity-only, NOT stage.** DONE — REVERTED P2's player-stage re-anchor in
  `getFusionQuantaCost` (fusion.ts) — cost must rise with RARITY (geometric k≈3.5) but NOT
  with player stage. Use a FIXED base (FUSION_ENHANCE_COST_BASE = anchor[1]) × FUSION_FLAT_COST[rarity].
  Update fusion.test.ts back to stage-independent + geometric-rarity assertions.
- [x] **A2 Enhance cost too steep.** DONE — ENHANCE_COST_GROWTH 1.7→1.35, ENHANCE_STONE_GROWTH
  1.5→1.3; mirrored in entropy-gate-sim.mjs, invariants green.
- [x] **A3 Hexagon: lines BEHIND cards + cards readable.** DONE — opaque filled-card bg (rgba(12,14,22,.94)) so links don't bleed through. SVG `.hex-links` z-index
  below `.hex-slot` (already 0/1 — make slot cards more opaque so lines don't bleed through;
  ensure equipped card + its effect label are clearly legible over the links/glow).
- [x] **A4 Hexagon card name wrapping.** DONE — 2-line clamp + keep-all. Long names (e.g. 글루온/글루온 플라스마) overflow/break
  in `.equip-slot-card__name` / `.hex-slot`. Allow 2-line wrap (clamp 2) instead of clip.
- [x] **A5 Completed-line glow.** DONE (implemented in P3; lit polyline per completed line, clearer now). Confirm completed bingo lines visibly light (the lit polyline)
  when a full line of 3 matches; fix if not firing.
- [x] **A6 Consolidate overlapping effects.** DONE — substat critChance→★ autoPct→■ clickPct→● (match primaries); legend omits the 3 dupes. Crit chance / click power / auto speed appear as
  BOTH a primary trait AND a substat (legend shows ★치명타확률 twice, ●/🖱 클릭위력, ■/⚙ 오토속도).
  Unify to ONE icon+label per stat across EFFECT_TRAIT (balance.ts) + SUBSTAT_TRAIT/labels so the
  legend + chips don't duplicate concepts.
- [x] **A7 Nebula box → 3-4 items + 강화석.** DONE — multi-item haul (faint/bright 3, prime 4) + stones (3/6/12) + grid reveal. OPEN_GACHA_BOX should grant 3–4 entities
  + some 강화석 (not a single item). Rework `handleOpenGachaBox` (reducers/shop.ts) + the reveal UI
  (ShopPanel) to show the multi-item haul clearly (current single-card reveal is hard to read).
- [x] **A8 Bonus-overlap arrows.** DONE — arrowhead markers on completed bonus polylines (marker-mid lands on shared/hub slot). Where hex bingo bonuses overlap/stack, draw connecting arrows
  on the hex so the player sees which lines combine.

## B. P6 — inventory instance model (save v25) — ✅ DONE (commit b8308b2)
Flat model: each `EntityInstance` = one physical copy + unique `instanceId`. Migration explode
(user choice): **one copy keeps the stack level, the rest → Lv1.**
- [x] **B1 Foundation + migration.** Flat EntityInstance (`instanceId?`, count stays 1), v24→v25
  migration explode. Save checklist done: SAVE_SCHEMA_VERSION 24→25, SaveState.version 25,
  validateV5/isEntityInstance whitelist `instanceId`, `normalizeSavedEntityIds` keeps flat copies
  separate (only merges legacy no-id stacks), new `ensureFlatInstances` (explode, slot remap,
  `FLAT_EXPLODE_HARD_CAP` against corrupt counts, idempotent for v25). New `entities/instances.ts`
  (`newInstanceId`/`makeInstance`/`pickFreeCopyId`/`reservedInstanceIds`/`getCopies`).
- [x] **B2 Per-copy placement** — equip slots carry instanceId (entityId fallback for legacy);
  reducer resolves a free copy; two copies fill two hex slots. EntityPanel groups display by
  entityId (count = copies); `entryOfSlot`/`entityOfSlot`/`freeCountOf` instanceId-aware.
- [x] **B3 Per-copy enhance** — `ENHANCE_ENTITY` targets the slot's instanceId; Lv3 break destroys
  that copy only + clears its slot. Enhance-exclude keyed by instanceId.
- [x] **B4 Per-copy fusion** — count-aware validate/consume; consumes spare copies lowest-level
  first, never an equipped one; refund uses each consumed copy's invested.
- Verified: tsc clean, 319 tests (incl. v25 idempotency round-trip), entropy-gate-sim invariants,
  production build.

## C. Audit fixes (from the 7-persona audit, prioritized)
- [x] **C-P0 Accessibility: core gather loop keyboard/SR operable.** DONE — `.game-canvas-hitbox`
  is now `role=button` + `tabIndex` (−1 when locked) + `aria-keyshortcuts` + Space/Enter gathers at
  field centre; new `.sr-only` `role=status aria-live=polite` region in GameScreen announces stage
  entry + condense-ready (discrete events, no per-frame spam). i18n `srStageEntered`/`srReadyToCondense`.
- [x] **C-P0 Branch hygiene.** DONE (confirmed) — `origin/develop` is **318 commits behind main** =
  dead. Workflow is standardized on `main` + `feat/entity-redesign` (worktree FF's both on push).
  Remote `develop` left intact (not deleting it autonomously — irreversible); just don't branch from it.
- [x] **C-P1 Number-lie fix.** DONE — formatPrestigeCost shows real getPrestigeCost (was 1YB..); Big Crunch/Big Rip conditions interpolate the real threshold (formatEntropyAmount). Ending/prestige strings hardcode wrong magnitudes (prestige 1YB vs
  ~0.68GB; Big Rip "1 Ronna Byte" fires ~3.25GB; Big Crunch "1GB" fires ~15MB). Interpolate the live
  balance.ts values into the i18n strings at runtime so they can't desync. (prestige.ts:129-133,
  multiverse.ts:39/50)
- [x] **C-P1 CI runs tests + PR trigger.** DONE — deploy.yml gates on npm test; new ci.yml runs tsc+test+build on PRs + non-main pushes. deploy.yml only `npm run build`; add a `test` job as a
  `needs:` of build + a pull_request-triggered workflow.
- [x] **C-P1 prefers-reduced-motion covers shake/flash/cinematics** DONE — RM block kills .shake/.shake-big + enhance-shake + collapses stage-transition rays/wash to opacity. (not just ~8 decorative rules):
  .shake/.shake-big, stage-transition cinematics, BigBangCinematic, intro. Opacity-only under RM.
- [x] **C-P1 Modal a11y:** DONE — new shared hook `src/hooks/useModalA11y.ts` (Esc-to-close +
  Tab/Shift+Tab focus trap + focus restore on close). Applied to OfflineProgressModal, EndingChooser
  (Esc no-ops when mandatory), AlmanacOverlay (trap paused while nested LoreModal owns focus),
  QuestPanel, the App reset-confirm dialog, and ShopPanel (replaced its Esc-only effect). Each
  overlay root got `tabIndex={-1}` + (where missing) `role=dialog`/`aria-modal`.
- [x] **C-P1 Cloud merge safety:** DONE — snapshot local to cc_cloud_overwrite_backup before remote-newer overwrite + skip overwrite when remote regressed on both stage & peakEntropy. snapshot the discarded save before last-write-wins overwrite
  and/or merge on peakEntropy/stageIdx maxima (useCloudSync.ts:64-69).
- [x] **C-P2 Tutorial queue.** DONE — extracted the 12-branch tutorial useMemo into a pure,
  unit-tested table `src/components/tutorialSteps.ts` (`TUTORIAL_STEPS` + `selectTutorialStep` =
  first-eligible-and-unseen in canonical order, preserving the `allDismissed` post-intro suppression,
  the matter-intro pre/post-first-click dual content, and the cash-shop dedicated-boolean
  discriminator). GameScreen builds the ctx + resolves strings/onCta; behavior verified identical
  against the original chain (diffed all 12 branches). 10 new vitest cases incl. the anti-shadow
  advance + allDismissed gate. 336 tests green. (Note: the original chain already fell through on
  `seen`; the real value is testability + a lean GameScreen, not a behavior change.)
- [x] **C-P2 HUD topline:** VERIFIED — no fix needed (and the proposed fix would regress). Now that
  the offline preview reaches the game screen, tested the worst case at 390px mobile width: the
  longest stage name ("Cosmic Dark Age", EN) renders on ONE line (18px, no wrap, readout right edge
  376 < 390), with a large gap before MATTER; KO stage names are all ≤6 chars and `formatGameNumberShort`
  keeps quanta ~6 chars, so no realistic reflow. The spec's `flex-wrap:nowrap` + title `max-width`
  + ellipsis would CLIP names that currently display fully → deliberately NOT applied.
- [x] **C-P2 Touch affordances:** DONE — (1) equip-panel **Enhance-All** locked button shows the
  unlock-stage in its visible label (`🔒 전체 강화 · 스테이지 N`); (2) the **equip/fuse side-rail** locked
  buttons now carry a small absolutely-positioned `S{n}` stage badge (`.entity-lab-button__lockstage`,
  verified in the offline preview — 18×14px corner pills, zero reflow of the 44px circles). The
  **condense pre-gate** guidance is already surfaced by the entropy tutorial bubble (the
  `hudEntropyGateHint` line shows on first reaching the meter), so a persistent meter note would be
  redundant — skipped. Remaining `title=` attributes (shop odds, icon names) are decorative — left.
- [x] **C-P2 Global focus-visible ring** DONE — global :focus-visible outline added.
- [x] **C-P2 user-scalable=no** DONE — removed maximum-scale+user-scalable=no from index.html viewport (WCAG 1.4.4).
- [x] **C-P2 Daily check-in streak** DONE — consecutive-day gap detection (gap→reset to 1) + escalating 강화석 reward (2..8 by streak) shown in the offline modal.
  — add consecutive-day detection + an escalating return reward.
- [x] **C-P2 extract/test save-sync logic + memoize panels (RESOLVED):** DONE — extracted the
  load-bearing decisions to pure, unit-tested modules: **cloud-merge** (`src/cloud/merge.ts`
  `decideCloudMerge` — last-write-wins + regression guard, 6 tests) and the **daily check-in/streak**
  (`src/game/dailyCheckIn.ts` `computeDailyCheckIn` — consecutive/gap/first-ever, 5 tests); both
  behaviour-preserving, useCloudSync/useGameState delegate. 347 tests green. **Panel React.memo:
  investigated + deliberately DECLINED** — `getActiveModifiers` reads `gateProgress01` (feeds
  `applyEntityModifiers` gear-power scaling), which advances EVERY tick via constant base
  auto-income; so the panels' per-tick re-renders are mostly LEGITIMATE content updates (power /
  affordability genuinely changing), not waste. memo could only spare the rare fully-static frame,
  and only by rounding `gateProgress01` — which would regress gear-power ramping into visible steps.
  No felt perf problem; the optimization is unwarranted. REMAINING (deferred, not blocking): the FULL
  offline-gain extraction — large, hot, load-bearing; safe only with a jsdom golden-baseline harness
  (forcing it risks a silent offline-reward bug, same class as the CSS-stripper incident).
- [x] **C-P2 Save export/import** DONE — storage.ts codec `serializeSave`/`deserializeSave`
  (UTF-8-safe base64, `CCSAVE1.` envelope, raw-JSON + bare-base64 fallbacks, routes through
  migrateToCurrent → v25) + a rolling `cc_save_backup_ring` (last 5 autosaves, deduped, skipped on
  aggressive trim) with `listBackupRing`/`pushBackupRing`/`restoreBackupRing`. Settings "Save Data"
  section: Export (copy/download), Import (paste/upload), Restore-from-backup. Import stamps a fresh
  `lastSaveAt` (no offline windfall + wins the next cloud sync). 7 new vitest cases (round-trip,
  v24→v25 import explode, KO/UTF-8, fail-soft, ring cap/dedupe). 326 tests green.
- [x] **C-P3 Dead code (RESOLVED):** DONE — deleted unimported `ResourcePanel.tsx` +
  `StatsRow.tsx`; removed the no-op `onPlayBigBang` prop (IntroScreen + App); **removed the dead
  `.bottom-buttons` CSS family (#46) — 30 inert rules dropped + 2 live-mixed compounds
  (`.scale-indicator.focus-hidden`, `.hud-info,…,.scale-indicator`) rewritten to keep only the live
  member + 3 emptied `@media` dropped, via a postcss-AST pass (after a bespoke brace-counter
  corrupted `.stat-header` and was reverted). Verified: grep-zero refs, no empty @media, the
  `.stat-header` canary + every adjacent live rule intact, build + 336 tests green; diff = 258
  deletions / 1 insertion, all `.bottom-buttons`-only.** DEFERRED (each its own reason):
  `scripts/balance-design.ts` is NOT dead — it backs `npm run sim` (keep/re-point separately);
  prestige legacy-key reconcile (prestige.ts) is save-touching; sourcemaps `hidden` + error reporter
  is build-config, separate.

## D. Done this session (shipped to main @ 207a34f)
P1 pacing (fusion-burst cap + condense-overflow reset) · P2 economy (enhance/fusion geometric — see
A1/A2 for the user's cost-direction corrections) · P3 connected hexagon · P4 mobile UI tokens · P5
perf (O(1) entity/codex lookups). See memory `overhaul3-plan` for commit hashes + details.
