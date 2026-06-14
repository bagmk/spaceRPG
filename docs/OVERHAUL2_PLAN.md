# Cosmic Coalescence — Overhaul 2 Plan (UX + Balance)

> Durable plan so a fresh context can execute it cold. Follows the P0–P6 systems
> overhaul (save v19). This overhaul targets save **v20** (quests).
> Branch: `feat/entity-redesign`. Always `npx tsc --noEmit` + `npx vitest run` +
> `npx vite build` + `node scripts/entropy-gate-sim.mjs` before committing.

## Locked decisions (from user)
1. **Power/cost = STRONG**: `ENTITY_LEVEL_EFFECT_BONUS` 0.6→**0.85**; enhance/fusion costs **fully fixed** (growth → 1.0); aggressively re-tune entropy thresholds to compensate.
2. **Quests on prestige**: `completedQuestIds` persist; active quests reset; **3–4 active at a time**.
3. **Codex set bonus**: only at **100% completion** (keep current binary behavior).
4. **Crack (균열) click → opens NOTHING** (currently opens rift-equip; make it inert/visual only). Rift gear access moves to the right-side **장착** button.

## Current-state facts (verified in code)
- `DROP_RARITY_WEIGHTS` = 80/16/3.5/0.5/0 (balance.ts).
- `ENTITY_LEVEL_EFFECT_BONUS` = 0.6 (balance.ts:337), `ENHANCE_COST_GROWTH` = 2.2 (381), `ENHANCE_STONE_GROWTH` = 1.5 (401), `CODEX_MASS_BONUS` = 1.0 (245).
- `getFusionQuantaCost` = 10% of bank × rarity mult (fusion.ts) — NOT level-scaled, but feels expensive as bank grows.
- `getEnhanceCost` = anchor × 1.5 × 2.2^(level-1) (enhance.ts:65) — level-scaled (the real "gets expensive" culprit).
- Codex UI elements to remove (EntityPanel.tsx ~558–574): `codex-hero` (count/total `codexMeterFound`/mass/bar/caption), `codex-hero__nudge` (`codexClosest` "1주기 2개 남은"), per-card drop chips (`almanac-card__drop`, P3), drop-rate legend (`codex-droprates`).
- Panel entry: `openEntityPanel('lab'|'equip'|'fuse', 'click'|'rift')` (GameScreen:256); crack via `onRiftClick`→`openEntityPanel('equip','rift')` (692); almanac via `setAlmanacOpen`. Bottom bar = `.hud-controls` / `.hud-info-click-zone`.
- Tutorial: free-form `tutorialFlags{}` (defaults.ts:117), `MARK_TUTORIAL_FLAG`; `EQUIP_SLOT_UNLOCKS` (balance.ts:489), `isCashShopUnlocked` (shop/boosts).
- Milestones: 182 passive toasts in `stageLogs.ts` via `StageLogToast.tsx`, no rewards.
- Comets: physics collisions in `gameplay.ts handleReportCollision` (~222–268); `ParticleField.tsx` renders rogues/rift.
- Black hole: `drawEntities.ts` (black_hole 2940–2971, singularity 3495, accretion 3606, `drawBlackHoleLens` 248, `drawHawkingGlow` 1161).
- Floating clicks: `FloatingClickEvent` (types/events), `handleClick` emits `lastClickEvent`, GameScreen useEffect (~439) → `FloatingNumber.tsx`; caps `MAX_FLOATING_NUMBERS=30`, `FLOAT_NORMAL_MS=1000` (constants.ts).
- AlmanacOverlay: stage pills (`selectedId`), `onStageSelect` prop currently UNUSED; needs wiring to GameScreen `viewingStageId` + "← Current" (`returnCurrent` i18n).

---

## 🅠1 · Economy & pacing rebalance (req ①④⑨) — CORE, needs sim recalibration
- `ENTITY_LEVEL_EFFECT_BONUS` 0.6→**0.85**.
- `ENHANCE_COST_GROWTH` 2.2→**1.0**; `ENHANCE_STONE_GROWTH` 1.5→**1.0** (flat per level).
- Fusion cost → **flat per-rarity matter** (new `FUSION_FLAT_COST` table) replacing the 10%-of-bank `getFusionQuantaCost`.
- `DROP_RARITY_WEIGHTS` → **90 / 9 / 0.9 / 0.1 / 0** (mythic fusion-only).
- `CODEX_MASS_BONUS` 1.0→**2.0**; bump `CODEX_SETS` reward % (set bonus still 100%-only).
- Comet over-reward: lower per-collision entropy so 1 comet ≠ 2–3 stages.
- Re-tune `ENTROPY_THRESHOLDS` + shop prices; update + re-run `scripts/entropy-gate-sim.mjs` (mirror all changed constants in the sim's hardcoded copies; re-paste derived thresholds). Re-fix `pacing`/`stageItems` tests if they assert old costs.
- Save: tunables only (no migration). Tests touching enhance/fusion cost + drop weights must update.

## 🅠2 · Comet click-to-absorb (req ①c)
- Floating comets become **clickable → instant absorb** (entropy + drop). Remove "enter center to recover". Files: `ParticleField.tsx` (rogue hit-test + click), `gameplay.ts` (`handleReportCollision`→`handleAbsorbComet`), reducer action.

## 🅠3 · Auto-income floating text (req ②)
- New `FloatingAutoIncomeEvent` (types/events), `handleTick` emits ~1/sec (throttled), shows "+N <entityName>" of the primary equipped auto entity. GameScreen useEffect + `FloatingNumber` auto variant. Transient (no save).

## 🅠4 · Fusion forge redesign (req ③)
- **30× batch**: `FUSE_ENTITIES.batchCount`; reducer loops, accumulates results; summary reveal ("N성공/N실패").
- **Remove auto-refill** → on result show **"성공!/실패!" + new-item description**, then a **재시도 버튼** (+ "Clear"). First enhance immediately clickable.
- Files: `reducers/entities.ts` (handleFuseEntities batch), `reducer.ts`, `EntityPanel` fuse UI, `events.ts` (lastFusionBatch?), `i18n`.

## 🅠5 · Quest system (req ⑥) — BIGGEST, save v20
- Replace milestones with **condition + progress + claim + reward** quests.
- Save **v20**: add `activeQuests[]`, `completedQuestIds[]`, `questProgress` (transient counters). Migration in `finalizeV17`/migrateByVersion (`v===14..20`); validateV5 whitelist; createInitialGameState/snapshot/persistent/withHydratedTransient. Prestige: keep `completedQuestIds`, reset active.
- New `src/game/quests.ts` (definitions + `evaluateQuest(state, action)`); `CLAIM_QUEST` action; progress hooked into reducers (click/drop/fuse/enhance/codex/comet/stage). `QuestPanel` UI (right-side button).
- **12 example quests** (creative, real actions): 입자 10흡수 · 쿼크 5종 도감등록 · 융합 3회 · 장비 Lv5 · 에픽 1획득 · 레어 20획득 · 콤보 100 · 혜성 50흡수 · 표준모형 세트 완성 · 전설 1개 융합제작 · 신화 제작 · 스테이지 16 도달. Rewards: matter / 강화석 / codex bonus, budget per `ENTITY_COST_ANCHORS` (S1–3 ~0.5–2.5K, S4–8 ~2.5–8K, S9+ 8–50K).

## 🅠6 · UI shell overhaul (req ⑦⑪⑫ + ⑨-codex + ⑩)
- **Bottom bar → right-side vertical column** of 5 buttons: 도감 · 퀘스트 · 장착 · 융합소 · 상점. De-tab `EntityPanel` into separate screens. Smaller overall scale. Files: `GameScreen.tsx`, `EntityPanel.tsx`, `index.css`.
- **Equip screen**: 6 slots at once + item filter 전체/클릭/오토 + stack display + inline enhance + larger info (req ⑫).
- **Codex cleanup (req ⑨⑫)**: remove `codex-hero` meter, `codex-hero__nudge` ("1주기 2개 남은"), all drop% chips/legend; cards = **name only**; show only the **set-completion benefit**.
- **Card format (req ⑫, ref image 1)**: Lv.N + current/threshold count + ⬆ arrow.
- **Enhance reveal (req ⑫)**: success/fail shows **detailed** item info.
- **Stage codex nav (req ⑪)**: wire `AlmanacOverlay.onStageSelect` → GameScreen `viewingStageId`; clicking a stage navigates; restore "← Current" (`returnCurrent`).
- **Crack (req ⑩)**: click does **nothing** (remove `onRiftClick`→panel); keep/polish visual only.

## 🅠7 · Tutorial re-gating (req ⑧)
- S1: click/entropy/item/codex + quest intro (equip·auto·shop·fusion LOCKED).
- S2: equip·auto·fusion unlock+explain (shop·enhance LOCKED).
- S3: shop + enhance(강화석) unlock + explain. Files: `tutorialFlags`, `EQUIP_SLOT_UNLOCKS`, `isCashShopUnlocked`, GameScreen tutorials, `i18n`.

## 🅠8 · Black hole visual (req ⑤) — cosmetic only
- `drawEntities.ts`: replace single-ellipse with Interstellar-style multi-ring temperature-gradient accretion disk + crisp photon ring + lensing. No save/balance impact. (Optionally apply to stage-17 mythic Singularity Core.)

---
## Dependency order
🅠1 (balance + sim) first → others mostly parallel. 🅠5 (quests, save v20) and 🅠6 (UI) are the heaviest. Commit per phase; verify each (tsc/vitest/build/sim).

## Parked (separate track)
- **iOS release build**: Swift 6.0.3 (Xcode 16.2) can't read the Capacitor `capacitor-swift-pm` binary's Swift-6.2 `.swiftinterface` → LocalNotifications "no member" errors. Fix = **update Xcode to Swift ≥6.2** (or pin capacitor-swift-pm to a Swift-6.0 build). Repo already reverted to original 8.3.0 deps.
