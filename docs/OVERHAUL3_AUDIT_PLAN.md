# Overhaul-3 — Autonomous Completion Plan (audit + user fixes)

> **AUTONOMOUS MODE.** The user wants ALL of this finished in one continuous push with
> NO confirmation prompts. Work on branch `worktree-overhaul3-pacing-econ-ui`. After each
> coherent unit: `npx tsc --noEmit` + `npx vitest run --exclude '**/worktrees/**'` +
> `npm run build` + (if balance touched) `node scripts/entropy-gate-sim.mjs`, then commit,
> then fast-forward `main` AND `feat/entity-redesign` to the tip and `git push origin main feat/entity-redesign <branch>`.
> CWD GOTCHA: always run shell cmds from the worktree (avoid `cd /Users/saesunkim/게임 &&` — it
> poisons cwd for the next command). The main working dir has `feat/entity-redesign` checked out.
> Save schema is at v24; P6 bumps to v25. Do NOT ask the user to confirm — just proceed.
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
- [ ] **A7 Nebula box (성운 상자) → 3–4 items + 강화석.** OPEN_GACHA_BOX should grant 3–4 entities
  + some 강화석 (not a single item). Rework `handleOpenGachaBox` (reducers/shop.ts) + the reveal UI
  (ShopPanel) to show the multi-item haul clearly (current single-card reveal is hard to read).
- [ ] **A8 Bonus-overlap arrows.** Where hex bingo bonuses overlap/stack, draw connecting arrows
  on the hex so the player sees which lines combine.

## B. P6 — inventory instance model (save v25) — DO FIRST per user
Flat model: each `EntityInstance` = one physical copy + unique `instanceId`. Migration explode
(user choice): **one copy keeps the stack level, the rest → Lv1.**
- [ ] **B1 Foundation + migration.** Flat EntityInstance (instanceId, count→1), v24→v25 migration
  (explode), full save checklist (SAVE_SCHEMA_VERSION 24→25, SaveState/snapshot/toPersistentState/
  withHydratedTransient, validateV5 whitelist, isEntityInstance guard, normalizeSavedEntityIds
  canonicalize-WITHOUT-merging, finalizeV17 seed, migrateByVersion v25), derived `getOwnedCount`/
  `getCopies` helpers, reroute ~23 `.count` readers. Behavior-preserving; 318 tests + v24→v25
  round-trip test pass.
- [ ] **B2 Per-copy placement** — equip slots carry instanceId; two copies in two hex slots.
- [ ] **B3 Per-copy enhance** — ENHANCE_ENTITY targets instanceId; Lv3 break destroys that copy only.
- [ ] **B4 Per-copy fusion** — fusion consumes specific instances; refund uses each copy's invested.

## C. Audit fixes (from the 7-persona audit, prioritized)
- [ ] **C-P0 Accessibility: core gather loop keyboard/SR operable.** ParticleField hitbox →
  role+tabIndex+Space/Enter gather; ARIA live region for quanta/stage.
- [ ] **C-P0 Branch hygiene.** Confirm `develop` is dead; stop branching from it (we use main/feat).
- [ ] **C-P1 Number-lie fix.** Ending/prestige strings hardcode wrong magnitudes (prestige 1YB vs
  ~0.68GB; Big Rip "1 Ronna Byte" fires ~3.25GB; Big Crunch "1GB" fires ~15MB). Interpolate the live
  balance.ts values into the i18n strings at runtime so they can't desync. (prestige.ts:129-133,
  multiverse.ts:39/50)
- [ ] **C-P1 CI runs tests + PR trigger.** deploy.yml only `npm run build`; add a `test` job as a
  `needs:` of build + a pull_request-triggered workflow.
- [ ] **C-P1 prefers-reduced-motion covers shake/flash/cinematics** (not just ~8 decorative rules):
  .shake/.shake-big, stage-transition cinematics, BigBangCinematic, intro. Opacity-only under RM.
- [ ] **C-P1 Modal a11y:** focus-trap on open + restore on close; shared `useEscapeToClose` for all
  overlays (offline, ending chooser, reset, almanac, quests — shop already has Esc).
- [ ] **C-P1 Cloud merge safety:** snapshot the discarded save before last-write-wins overwrite
  and/or merge on peakEntropy/stageIdx maxima (useCloudSync.ts:64-69).
- [ ] **C-P2 Tutorial queue.** Replace the winner-take-all ~14-branch useMemo (GameScreen.tsx:299-435)
  with an ordered queue that advances one step at a time (lower-priority tutorials currently skipped
  permanently for returning players).
- [ ] **C-P2 HUD topline:** give quanta a dedicated reserved-width region (index.css:11110) so big
  numbers + long Korean stage names don't wrap and shove the entropy meter.
- [ ] **C-P2 Touch affordances:** lock reasons / condense-disabled explanation live in `title=`
  tooltips (never show on touch) — surface as visible inline/tappable text.
- [ ] **C-P2 Global focus-visible ring** (remove blanket `outline:none` at index.css:4050).
- [ ] **C-P2 user-scalable=no** removal (index.html:5) — WCAG 1.4.4.
- [ ] **C-P2 Daily check-in streak** has no gap detection + grants nothing (useGameState.ts:169-174)
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
