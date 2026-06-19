# Cosmic Coalescence — Multi-Discipline Game Audit

**Date:** 2026-06-19
**Method:** Read-only audit performed in isolated git worktrees, fanned out across four
specialist agents (UX engineer, UI engineer, server/platform engineer, software architect)
plus a game-design analyst covering five player personas. Findings cross-corroborated and
the headline architecture facts independently verified.

Severity legend: **[P0]** critical · **[P1]** high · **[P2]** medium · **[P3]** polish.

---

## 0. Meta-finding: two divergent codebases (read this first) — [P0, process]

The repository contains **two fundamentally different products** on diverged history:

| | `develop` (`3e18b7d`) — your audit branch base | **`main` / `feat/entity-redesign` (`1f5d73e`) — LIVE** |
|---|---|---|
| src files | 81 | **186** |
| Power system | skill tree (click/auto/crit/time + cross nodes) | **Entity Lab**: gear slots, fusion, enhancement, set bonuses, codex |
| Backend | none (localStorage only) | **Firebase Auth + Firestore cloud sync + global leaderboard** |
| Mobile | web only | **Capacitor iOS/Android**, AdMob, local notifications, haptics |
| Monetization | "free in test mode" stub | **RevenueCat (mobile) + Stripe (web) IAP**, rewarded ads |
| Localization | English only | **i18n (English + Korean)** |
| Economy source | `skills/definitions.ts`, `balance-sim.ts` | `balance.ts`, `prestige.ts`, `entropy-gate-sim.mjs` |
| **Deployed to production?** | No | **Yes** — `deploy.yml` runs on push to `main` |

**Why this matters:** `develop` is not a feature branch of `main`; it is an *earlier, abandoned
architecture*. Anyone who branches off `develop` (as this audit branch did) is building on a
codebase that has nothing to do with what users actually play. Decide explicitly: is `develop`
dead? If so, archive/delete it and re-cut feature branches from `main`. If it represents a
parallel design you intend to revive, that needs to be a documented, deliberate fork — right
now it reads as accidental drift.

> All findings below are against the **live `main`** codebase.

---

## 1. UX Engineer — flow, onboarding, information architecture

- **[P1] Two redundant "first click" prompts render at once.** `GameScreen.tsx:1161`
  shows a `.click-tutorial-hint` ("Click to gather") when `stage.id === 1 && totalClicks === 0`,
  while `GameScreen.tsx:303-312` *also* spawns a centered `tutFirstClick` SpeechBubble under the
  same condition. New players get a label and a bubble pointing at the same spot. → Gate the hint
  on `!activeTutorialBubble`.
- **[P1] The meter the player watches is not the meter that gates the button they're told
  to press.** The HUD shows an **entropy gate** meter (`GameScreen.tsx:991-1003`), but the
  Condense gate appears only when `showCondenseGate` flips (`:989`) and *replaces* it
  (`:1007-1039`). There is no persistent "progress toward Condense" indicator — it just pops
  into existence. → Keep one always-visible progress-to-condense meter.
- **[P2] Tutorial logic is a ~100-line `useMemo` with ~14 ordered branches and winner-take-all
  priority** (`GameScreen.tsx:299-435`). When several conditions are true (common for a returning
  player), lower-priority tutorials are skipped *permanently* because dismissal marks only the one
  that rendered. → Replace with an explicit ordered queue that advances one step at a time.
- **[P2] `App.tsx` route machine can trap the player.** `App.tsx:183-191` force-routes to
  game/final whenever `totalClicks > 0 || stageIdx > 0`, and `:193-197` forces `completedRun → final`.
  A finished player can't return to intro except via the atlas back-button, which itself routes
  back to `final`. Confirm "New Start" (`App.tsx:252`) sets an explicit route rather than relying
  on the heuristic effect.
- **[P3] Dead UX wiring:** `onPlayBigBang` is a no-op callback still plumbed through
  `IntroScreen` (`App.tsx:265-267,310-311`); `ResourcePanel.tsx` and `StatsRow.tsx` are
  dead components (self-referencing only) containing non-i18n hardcoded English. Remove.

---

## 2. UI Engineer — visual hierarchy, responsive layout, components

- **[P1] HUD topline is a fragile fixed-column grid.** `index.css:11110-11116`
  (`grid-template-columns: 56px minmax(0,1fr) 18px auto`) crams stage title, separator, quanta
  value, and `+N/s` auto-rate into shared tracks. With big numbers (`1.23e45`) plus a long Korean
  stage name it wraps (`:11142-11147`), shoving the entropy meter down. The most important number
  (quanta) competes for weight with the stage title. → Give quanta a dedicated reserved-width region.
- **[P2] Hover-only affordances on a touch-first game.** Lock reasons and the *entire* explanation
  of why Condense is disabled live in `title=` tooltips (`GameScreen.tsx:1012-1020` `condenseHint`,
  locked Equip/Fuse buttons `:1091,1104`, prestige pips `:1051`, `ScaleIndicator.tsx:21`). `title`
  never shows on touch — the primary platform. → Surface as visible inline text / tappable info.
- **[P2] No global focus-visible styling.** `:focus-visible` is defined for exactly one selector
  (`.entity-card`, `index.css:6945-6947`); `outline: none` is set globally at `:4050`. Keyboard/switch
  users get no focus indicator across the whole UI. → Add a global focus ring; remove the blanket
  `outline:none`.
- **[P2] Hardcoded pixel hit-zone ignores safe-area insets.** `ParticleField.tsx:1603` pins the
  rift tap target at `(46, height-84)` r=42 with the auto-income float anchored to the same magic
  numbers (`GameScreen.tsx:634-635`). On a notched phone it can sit under the home indicator.
  → Derive from layout refs + `env(safe-area-inset-*)`.
- **[P3] Some state is color-only** (shop rarity borders rendering the label in the same hue,
  `ShopPanel.tsx:253,266`). Verify contrast on green/orange tiers for color-blind users.

---

## 3. Accessibility (cross-cutting, owned by UX+UI) 

- **[P0] The game is unplayable by keyboard or screen reader.** The core gather loop is a bare
  `onPointerDown` on a `<div className="game-canvas-hitbox">` with no `role`, `tabIndex`, or key
  handler (`ParticleField.tsx:1591`); comet absorption, rift tap, Moon nudge are all pointer-only
  (`:1600-1637`). → Make the field focusable, bind Space/Enter to a center gather, and add an ARIA
  live region announcing quanta/stage progress.
- **[P1] No focus management/trap in any modal.** Overlays set `role="dialog" aria-modal="true"`
  (e.g. `OfflineProgressModal.tsx:30`, `EndingChooser.tsx:13`, `App.tsx:357`) but never move focus
  in or trap Tab — focus stays behind the modal. → Add a shared focus-trap on open, restore on close.
- **[P1] Escape closes only some modals** (`ShopPanel.tsx:142-145` has it; offline modal, ending
  chooser, reset dialog, almanac, quests do not). → Shared `useEscapeToClose` hook everywhere.
- **[P1] Reduced-motion support is cosmetic only.** The two `@media (prefers-reduced-motion)` blocks
  (`index.css:11069`, `:14382`) cover ~8 decorative selectors. They do **not** cover `.shake`/`.shake-big`
  (fired on every comet collision, `GameScreen.tsx:604`), the 33 stage-transition cinematic rules
  ("violent shake", "blinding flash"), `BigBangCinematic`, or the intro Big Bang
  (`IntroScreen.tsx:110-138`). Real photosensitivity/motion-sickness risk with no escape hatch.
  → Under reduced-motion, replace shake/flash with opacity-only cues.
- **[P2] `user-scalable=no` blocks pinch-zoom** (`index.html:5`) on already-small 10–13px HUD text
  — WCAG 1.4.4 failure. → Drop `maximum-scale`/`user-scalable=no`.

---

## 4. Server / Platform Engineer — backend, persistence, infra, CI

- **[P1] Client-authoritative state feeds a *trusted, globally visible* leaderboard.**
  The reducer computes everything client-side and `pushLeaderboardEntry` / `debouncedPush`
  (`useCloudSync.ts:80-110`, `src/cloud/leaderboard.ts`) send whatever the client says. Anyone can
  edit `localStorage` (`cosmic_coalescence_save_v7`) or call the Firestore SDK directly to top the
  board. → Gate writes behind Firestore Security Rules with sanity bounds (monotonic `peakEntropy`,
  rate caps), or explicitly treat the leaderboard as untrusted/cosmetic.
- **[P1] Last-write-wins cloud merge can silently destroy progress across devices.**
  `useCloudSync.ts:64-69` resolves conflicts purely on `remoteSaveAt > localSaveAt` (each device's
  wall clock). A skewed clock or just the last device to push overwrites the other — no merge, no
  backup of the loser. → Snapshot the discarded save before overwrite and/or merge on
  `peakEntropy`/`stageIdx` maxima.
- **[P1] CI never runs the test suite before deploying to production.** `deploy.yml` only runs
  `npm run build` (`tsc --noEmit && vite build`) — typecheck is gated, but the ~29 test files (the
  only safety net for a client-authoritative economy) **never run in CI**, and there is **no
  `pull_request` trigger at all** (push-to-main + manual only). A green deploy can ship a broken
  reducer. → Add a `test` job as a `needs:` of `build` and a PR-triggered CI workflow.
- **[P2] No save export/import and a single one-time corruption backup.** Recovery is good in the
  common case (parse/migrate are try/caught, `validateV5` sanitizes NaN/Inf, the raw blob is backed
  up to `cc_save_backup_v16` once), but the backup is single-slot/one-time and there is **no
  user-facing restore or manual export**. A quota-full browser or a second corruption = total loss.
  → Add JSON export/import in Settings + a small ring of timestamped backups.
- **[P2] No sourcemaps, no error monitoring.** `vite.config.ts` leaves `build.sourcemap` off and
  there's no Sentry; uncaught reducer throws are swallowed after logging (`useGameLoop.ts:35`) and
  are invisible in production — for a game with real-money IAP. → `sourcemap: 'hidden'` + a
  lightweight reporter (Firebase is already a dep; log errors to Firestore).
- **[P3] No bundle budget / manual chunking.** Firebase (`^12`), Capacitor, RevenueCat and the
  canvas/audio modules ship in one chunk graph. → `manualChunks` to split vendor/firebase and
  lazy-load cloud/auth so anonymous players don't pay Firestore cost on first paint.
- *Note:* the architecture agent reported `main` already uses least-privilege `contents: read` and
  ships a `404.html` SPA fallback — **verify these directly** before relying on them.

---

## 5. Software Architect / Developer — state, performance, testing

- **[P1] Fixed-timestep loop discards real `dt`.** The loop accumulates real elapsed time but
  dispatches `TICK` with the *constant* `TUNING.LOGIC_TICK_MS`; combined with the rAF `dt` clamp
  (`useGameLoop.ts:32`), after any stall the sim silently drifts slower than wall-clock (offline
  catch-up papers over big gaps only). → Cap catch-up iterations and dispatch the actual consumed slice.
- **[P2] `Date.now()` (non-monotonic) drives all in-loop time math.** The loop schedules on
  `performance.now()` but stamps `now: Date.now()` (combo timeout, boost expiry, implosion end). A
  backward clock jump makes `now - lastClick` negative → combos never expire / boosts look permanent.
  → Standardize the sim clock; clamp deltas to `>= 0` everywhere (some sites do, combo logic doesn't).
- **[P2] Open modal panels re-render ~10×/s.** `ParticleField` is correctly `memo`'d and driven
  imperatively (canvas does *not* re-render on state — excellent), but `ShopPanel`/`EntityPanel`/
  `QuestPanel`/`SettingsPanel` are unmemoized and receive the whole `state`/`dispatch`, re-deriving
  every tick while open. → `React.memo` + narrowed props.
- **[P3] Per-frame allocation drives GC churn.** Bursts/flyers/wake/motes are object literals
  pushed each click/auto/collision (`ParticleField.tsx:973-1426`); counts are capped (good) but not
  pooled. Radial gradients are recreated per object per frame in `drawCluster.ts`. → Object-pool the
  capped structs; cache gradients per (color,radius) bucket.
- **[P2] Logic is well-tested; UI, the game loop, offline catch-up, and cloud-merge are untested.**
  The highest-risk untested paths are pure-ish functions trapped inside hooks (offline math in
  `useGameState.ts:88-175`, cloud merge decision in `useCloudSync.ts:64-69`). → Extract and unit-test
  them. Also: tests run in `node` env despite `jsdom` being installed (`vite.config.ts`), which blocks
  component tests — switch to `jsdom`.

---

## 6. Game Design — systems, balance, monetization

- **[P1] Player-facing numbers are wrong by 12–14 orders of magnitude.**
  - Prestige cost label hardcodes `1YB/5YB/…` (`prestige.ts:129-133`) but Lv1 actually costs
    `0.5×T8 ≈ 0.68 GB`.
  - Big Rip UI says "Reach 1 Ronna Byte (1024 YB)" (`multiverse.ts:50`); code triggers at
    `1.3×T9 ≈ 3.25 GB`.
  - Big Crunch UI says "1GB by Stage 3" (`multiverse.ts:39`); code triggers at `0.5×T3 ≈ 15 MB`.
  These conditions were rebased to be threshold-relative (`balance.ts:238-247`) but the bilingual
  strings were never updated. → **Interpolate the live `balance.ts` value into the strings at runtime**
  so they can never desync. This is the single biggest trust-breaker.
- **[P1] Daily check-in streak is dead *and* buggy.** `dailyCheckIns.streakDays` increments on any
  new calendar day with **no consecutive-day gap check** (`useGameState.ts:169-174`) and is **never
  read to grant anything**. → Add gap detection + an escalating return reward. Cheapest retention win available.
- **[P2] The entropy ladder barely grows.** T1 `1.467e3` → T16 `1.729e8` is only ~1.18M× across 16
  stages, and the **final step is 1.25×** (`balance.ts:235-236`). Pacing is carried almost entirely
  by time-gauge growth, so the "number-go-up" on the gate that actually matters is anticlimactic.
- **[P2] Active vs idle weighting is invisible.** `ENTROPY_W_CLICK = 0.6` vs `ENTROPY_W_AUTO = 0.04`
  (`balance.ts:294,302`) — clicking pushes the gate ~15× faster than auto, quietly punishing pure-idle
  builds (counter to genre expectations) with nothing in the UI explaining it. → Surface a
  "gate progress/sec: click X · auto Y" readout.
- **[P2] Stingy idle + soft paywall.** Default offline cap is **1h** at **0.5× rate** (`boosts.ts:5-6`,
  `useGameState.ts:112`) for a ~100h game; the only real-money lever on *progression speed* is the
  $2.99 8h-storage IAP. → Raise the default cap (4–6h) and make `hawking_echo` (full-rate offline)
  cheaper on the first run.
- **[P3, positive] Monetization is unusually fair.** USD matter packs grant `quanta` with **no
  entropy conversion** (`reducers/shop.ts:75-80`), so **paying does not advance the stage gate** —
  money buys gear/collection/convenience, not progression. Worth protecting as a design principle.
- **[P2] Maintainability debt:** two "threshold" systems with wildly different magnitudes
  (`stage.threshold` ~1e21 vs `ENTROPY_THRESHOLDS` ~1e8); prestige legacy save keys whose names no
  longer match their levers (`prestige.ts:74-81`, e.g. `time_warp` now = drop rate); stale
  `scripts/balance-design.ts` simulating the *removed* skill tree. → Reconcile/rename/delete.

---

## 7. Five Player Personas

**1. First-timer Fiona (casual, mobile, short attention).**
Delighted by the fast first stages (Inflation targets 30s) and warm plain-language quotes.
Overwhelmed when stage 3 unlocks shop + gacha + fusion + enhancement all at once
(`balance.ts:638-642`), and at risk if Korean glyphs (강화석/보호) leak into an English build.
*Change:* stagger system reveals across stages 3–6, one tutorial each.

**2. Idle-veteran Ivan (hardcore, optimal play).**
Loves the real prestige depth in `SINGULARITY_UNLOCKS` ("Skip Inflation", "Offline at full rate",
Boltzmann-Brain endgame). Annoyed that the headline entropy ladder barely grows (1.25× final step)
and that the 1h/0.5× offline default punishes his idle build — which is *also* silently 15× slower
on the gate (`W_AUTO 0.04`). *Change:* surface the active/idle weighting and front-load full-rate offline.

**3. Speedrunner Sasha (min-max, exploit, save-edit).**
Respects that the obvious breaks are already patched (comet-entropy span cap `balance.ts:307-319`,
bank-then-fuse-dump closed `:397-403`). Will burn time chasing the **wrong ending-condition text**
("1 Ronna Byte" Big Rip that actually fires at ~3 GB) and suspect a cheat before realizing the *text*
is stale. *Change:* drive ending conditions from `balance.ts` at runtime.

**4. Lapsed Luca (returns after a week).**
His save survives (versioned migrations + corruption backup + cloud sync). But a week away yields at
most 1–8h of capped, half-rate offline, and the **streak mechanic that should re-hook him grants
nothing and never detected his absence** (`useGameState.ts:169-174`). *Change:* wire `streakDays` to a
real escalating welcome-back reward with proper gap detection.

**5. Educator / Curious Cora (cosmology theme, accuracy).**
Delighted by the genuinely well-researched Almanac — per-stage temperature/particles/events and rare
honest `uncertaintyNote` caveats ("Inflation is theoretical, ~1e-36–1e-32 s"). Jarred that the rigor
is undercut by meaningless flavor units: "1 Ronna Byte" (a real SI prefix, 10²⁷) labeling a ~3 GB
trigger. *Change:* extend the Almanac's honesty to gameplay numbers — make units real or clearly mark
them as cosmic flavor.

---

## Top 10 priorities (consolidated)

1. **[P0]** Resolve the `develop` vs `main` divergence — decide if `develop` is dead and stop branching from it (§0).
2. **[P0]** Make the core gather loop keyboard/screen-reader operable + ARIA live region (§3).
3. **[P1]** Fix the player-facing number lies (ending conditions + prestige cost) by interpolating live `balance.ts` values (§6).
4. **[P1]** Add a `test` job + PR-trigger to CI so the economy can't ship broken (§4).
5. **[P1]** Extend `prefers-reduced-motion` to kill shake/flash/cinematics — photosensitivity risk (§3).
6. **[P1]** Gate leaderboard/cloud writes server-side (Firestore rules) + back up the loser before last-write-wins overwrite (§4).
7. **[P1]** Make the daily streak real (gap detection + reward); de-dupe the first-click onboarding (§6, §1).
8. **[P2]** Add save export/import + a backup ring; enable sourcemaps + error monitoring (§4).
9. **[P2]** `React.memo` open panels; dispatch real `dt` and clamp time deltas `>= 0` (§5).
10. **[P2]** Add a global `:focus-visible` ring, drop `user-scalable=no`, enforce 44px touch targets (§2, §3).
