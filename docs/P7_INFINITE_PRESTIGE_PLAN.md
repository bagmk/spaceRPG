# P7 — Infinite / Compounding Prestige + Mythic Pity ("Singularity Echoes" / 특이점 잔향)

Designed via the `p7-infinite-prestige-design` workflow (7 maps → system model → 3 designs → 3-lens
judge panel → synthesized plan). Winner: **Design 1 "Singularity Echoes"** (won both Balance-Safety
and Implementation-Risk lenses), grafting the FinalScreen tier banner + HUD pip (display-only, from
D3) and a single off-gate click/auto focus split (from D2).

## Core design

**Meta currency — Singularity Echo / 특이점 잔향** (HUD label "Resonance"):
- DERIVED from `peakEntropy` (already carried verbatim across prestige): `getSingularityEcho(peakEntropy) = floor(peakEntropy^ECHO_PEAK_EXP)`, `ECHO_PEAK_EXP=0.30` (below `getCondensedMassReward`'s 0.40, so the infinite source grows slower than the one-shot reward).
- Spendable = `getSingularityEcho(peakEntropy) − echoSpent`. **Only `echoSpent` (one int) is persisted** — earn side needs ZERO migration; a non-finite balance can never be silently dropped on load.

**Sink — Resonance Core / 공명 코어** (sibling to 응축 핵 Condensation Core), endless/uncapped:
- `getResonanceCoreMultiplier(level) = (1+RESONANCE_CORE_RATE)^level`, `RESONANCE_CORE_RATE=0.03` (TRUE geometric, NOT the linear +0.02 Condensation Core uses).
- `getResonanceCoreCost(level) = ceil(RESONANCE_CORE_COST_BASE × RESONANCE_CORE_COST_GROWTH^level)`, BASE=5, GROWTH=1.35 (> rate → free-levels/run self-stabilizes, no single-run runaway).
- **OFF-GATE**: multiplies `clickMatterMult` / `autoMatterMult` ONLY (the wallet), at the proven Condensation Core insertion point (effects.ts:197-199). Sim reads neither sub-key → P1 gate calibration untouched, no re-sim for the income lever.
- **Focus split** `echoFocus` (0..100, default 50): re-weights the SAME multiplier between click/auto via geometric-mean-preserving exponents `reso^(2*cw)` / `reso^(2*(1-cw))` (cw=focus/100). At 50 both = reso^1; sqrt(click·auto)=reso at every split → re-spec feel, never total power. Re-sim-free.

**Mythic pity floor** — global persistent int `fusionsSinceMythic`, flat **N=40** (`FUSION_MYTHIC_PITY_N`):
- Hook in `fuseOnce` AFTER rarityUp resolves (entities.ts:303) and AFTER the 보호석 block (313-332).
- Fires only when: `!rarityUp && !protectedUsed && fusionsSinceMythic >= N && input rarity==='legendary' && getMaxFusionRarityIdx(stage)===4 (stage≥12) && singleFusionOnly`. Reuses the 보호석 forced-pick commit guard (only commit if forced rank > input rank).
- Accounting keyed off REAL output rarity (`FUSION_RARITY_RANK`): reset to 0 on any real mythic (rolled/pitied/보호석-forced), increment on eligible legendary non-mythic, HOLD below stage 12.
- `singleFusionOnly`: handleFuseEntities=true, handleFuseBatch=false (mirrors 보호석 batch exemption) — counter still increments per eligible trio in a batch, but only single fuses can TRIP the force (no batch flood).
- **N=40 conservative** because the sim does NOT model mythic supply (RARITY_GATES stops at legendary:12) — an aggressive pity can't be sim-validated. Manual gate-test at stage 12+.

**Display-only grafts** (pure fns of carried peakEntropy, NEVER enter getActiveModifiers):
- `getAscensionTier(peakEntropy)`: `ASCENSION_TIER_BASE_PEAK=1e6` (tier 1 start), `ASCENSION_TIER_LOG_STEP=1.0` (one named tier per ~10×). FinalScreen tier-up banner (compare vs PRE-RUN peak snapshot, not live) + "Current Multiverse: <tier>" line.
- Live HUD Echo pip + Fusion 잔향 게이지 (fusionsSinceMythic/N, visible only at stage≥12).

## Save v32 plumbing checklist (single bump v31→v32)
Two NEW top-level ints (`echoSpent`, `fusionsSinceMythic`) = FULL checklist. Two prestigeUpgrades sub-keys (`resonance_core`, `echoFocus`=50) = migration-light (ride backfill + ?? reads).
1. types.ts — version literal 31→32; add `echoSpent`/`fusionsSinceMythic` to SaveState.
2. storage.ts:68 — SAVE_SCHEMA_VERSION 31→32 (+ JSDoc).
3. defaults.ts createInitialGameState — both ints 0; prestige.ts createDefaultPrestigeUpgrades — resonance_core:0, echoFocus:50; PrestigeUpgradeId + PrestigeUpgradeLevels add the two sub-keys.
4. storage.ts createSaveSnapshot — persist both ints.
5. reducer.ts toPersistentState — include both ints (cloud push).
6. migrate.ts validateV5 whitelist — both ints with Math.max(0,..)/Math.floor; **CHANGE the prestigeUpgrades backfill** from `?? createDefaultPrestigeUpgrades()` to `{ ...createDefaultPrestigeUpgrades(), ...(parsed).prestigeUpgrades }` so old saves get the new sub-keys. Do NOT add ints to the reject if-guard.
7. migrate.ts migrateV4ToV5 literal — both ints 0.
8. storage.ts:597 migrateByVersion combined branch — append `|| v === 32`.
9. finalizeV17 — default 0 (validateV5 default usually suffices).
10. reducers/meta.ts withHydratedTransient — `?? 0` both.
- **handlePrestige (stage.ts:195)**: `echoSpent: state.echoSpent` + `fusionsSinceMythic: state.fusionsSinceMythic` EXPLICIT carry (resetState spread zeros them — trap!). resonance_core/echoFocus carry free via prestigeUpgrades.
- merge.ts: `echoSpent` Math.max on pull (monotonic spend); `fusionsSinceMythic` Math.max.
- Tests: migration.test/storage version asserts + round-trip the two ints.

## Balance constants (balance.ts)
`ECHO_PEAK_EXP=0.30`, `RESONANCE_CORE_RATE=0.03`, `RESONANCE_CORE_COST_BASE=5`, `RESONANCE_CORE_COST_GROWTH=1.35`, `ECHO_FOCUS_DEFAULT=50`, `FUSION_MYTHIC_PITY_N=40`, `FUSION_PITY_INPUT_RARITY='legendary'`, `ASCENSION_TIER_BASE_PEAK=1e6`, `ASCENSION_TIER_LOG_STEP=1.0`.

## Phases (each independently committable + verified: tsc + vitest + build [+ sim])
- **P0** — Save v32 plumbing, NO behavior (both ints stay 0). Verify: tsc + vitest (version asserts + v31→v32 round-trip) + sim unchanged.
- **P1** — Echo earn (formulas) + Resonance Core spend (admin BUY_PRESTIGE_UPGRADE branch) + off-gate power (effects.ts after :199 with focus split) + SET_ECHO_FOCUS action. Verify: tsc + vitest (off-gate assert, buy/earn unit) + sim ALL PASS.
- **P2** — Mythic pity floor (fuseOnce hook + singleFusionOnly thread + accounting). Verify: tsc + vitest (increment/reset/hold/batch/보호석) + MANUAL mythic supply at stage12+ (sim is a false green here).
- **P3** — PrestigeShop Resonance Core card + focus slider + Echo balance; FinalScreen +N delta + tier banner. i18n EN/KO.
- **P4** — HUD Echo pip + Fusion 잔향 게이지 (stage≥12). i18n EN/KO.

## Locked defaults (user can override after playtest)
- ECHO_PEAK_EXP=0.30 earn pacing (taste call).
- fusionsSinceMythic PERSISTS across prestige (gacha norm). Flip = reset in handlePrestige (one line).

## Risks
- Sim FALSE-GREEN for pity (no mythic model) → manual test, keep N=40.
- validateV5 prestigeUpgrades backfill must spread defaults (else old saves miss new sub-keys).
- handlePrestige MUST explicitly carry echoSpent/fusionsSinceMythic (resetState zeros them).
- echoFocus split must REPLACE the flat reso multiply, not stack (double-count).
- merge.ts echoSpent Math.max (cross-device spend monotonic).
- FinalScreen banner compares vs PRE-RUN peak snapshot (live peak already bumped).
