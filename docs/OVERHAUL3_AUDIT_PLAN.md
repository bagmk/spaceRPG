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
- [ ] **C-P0 Accessibility: core gather loop keyboard/SR operable.** ParticleField hitbox →
  role+tabIndex+Space/Enter gather; ARIA live region for quanta/stage.
- [ ] **C-P0 Branch hygiene.** Confirm `develop` is dead; stop branching from it (we use main/feat).
- [x] **C-P1 Number-lie fix.** DONE — formatPrestigeCost shows real getPrestigeCost (was 1YB..); Big Crunch/Big Rip conditions interpolate the real threshold (formatEntropyAmount). Ending/prestige strings hardcode wrong magnitudes (prestige 1YB vs
  ~0.68GB; Big Rip "1 Ronna Byte" fires ~3.25GB; Big Crunch "1GB" fires ~15MB). Interpolate the live
  balance.ts values into the i18n strings at runtime so they can't desync. (prestige.ts:129-133,
  multiverse.ts:39/50)
- [x] **C-P1 CI runs tests + PR trigger.** DONE — deploy.yml gates on npm test; new ci.yml runs tsc+test+build on PRs + non-main pushes. deploy.yml only `npm run build`; add a `test` job as a
  `needs:` of build + a pull_request-triggered workflow.
- [x] **C-P1 prefers-reduced-motion covers shake/flash/cinematics** DONE — RM block kills .shake/.shake-big + enhance-shake + collapses stage-transition rays/wash to opacity. (not just ~8 decorative rules):
  .shake/.shake-big, stage-transition cinematics, BigBangCinematic, intro. Opacity-only under RM.
- [ ] **C-P1 Modal a11y:** focus-trap on open + restore on close; shared `useEscapeToClose` for all
  overlays (offline, ending chooser, reset, almanac, quests — shop already has Esc).
- [x] **C-P1 Cloud merge safety:** DONE — snapshot local to cc_cloud_overwrite_backup before remote-newer overwrite + skip overwrite when remote regressed on both stage & peakEntropy. snapshot the discarded save before last-write-wins overwrite
  and/or merge on peakEntropy/stageIdx maxima (useCloudSync.ts:64-69).
- [ ] **C-P2 Tutorial queue.** Replace the winner-take-all ~14-branch useMemo (GameScreen.tsx:299-435)
  with an ordered queue that advances one step at a time (lower-priority tutorials currently skipped
  permanently for returning players).
- [ ] **C-P2 HUD topline:** give quanta a dedicated reserved-width region (index.css:11110) so big
  numbers + long Korean stage names don't wrap and shove the entropy meter.
- [ ] **C-P2 Touch affordances:** lock reasons / condense-disabled explanation live in `title=`
  tooltips (never show on touch) — surface as visible inline/tappable text.
- [x] **C-P2 Global focus-visible ring** DONE — global :focus-visible outline added.
- [x] **C-P2 user-scalable=no** DONE — removed maximum-scale+user-scalable=no from index.html viewport (WCAG 1.4.4).
- [x] **C-P2 Daily check-in streak** DONE — consecutive-day gap detection (gap→reset to 1) + escalating 강화석 reward (2..8 by streak) shown in the offline modal.
  — add consecutive-day detection + an escalating return reward.
- [ ] **C-P2 Memoize open modal panels** (Shop/Entity/Quest/Settings re-render ~10×/s) + extract &
  unit-test offline catch-up + cloud-merge (and switch vitest env to jsdom for component tests).
- [ ] **C-P2 Save export/import** in Settings + a small ring of timestamped backups.
- [ ] **C-P3 Dead code:** onPlayBigBang no-op, ResourcePanel/StatsRow dead components, stale
  scripts/balance-design.ts, dead `.bottom-buttons` CSS family (#46), reconcile prestige legacy key
  names (prestige.ts:74-81). Sourcemaps `hidden` + lightweight error reporter.

## D. Done this session (shipped to main @ 207a34f)
P1 pacing (fusion-burst cap + condense-overflow reset) · P2 economy (enhance/fusion geometric — see
A1/A2 for the user's cost-direction corrections) · P3 connected hexagon · P4 mobile UI tokens · P5
perf (O(1) entity/codex lookups). See memory `overhaul3-plan` for commit hashes + details.
