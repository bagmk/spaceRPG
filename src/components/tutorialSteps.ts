/**
 * C-P2: tutorial step table + selection (extracted from GameScreen's tutorial
 * useMemo so it is unit-testable and the panel stays lean).
 *
 * Behavior is preserved exactly: the original chain was a series of
 * `if (eligible && !seen) return …` branches, i.e. "the first eligible-and-unseen
 * step in canonical order", with an `allDismissed` early-out that suppresses every
 * step AFTER the two stage-1 intros. `selectTutorialStep` reproduces that. The
 * module is pure (no React, no i18n resolution): it returns the step descriptor
 * (messageKey / ctaAction / anchor) and GameScreen resolves strings + onCta.
 */
export type TutorialAnchor = 'entity' | 'equip' | 'fuse' | 'shop' | 'resource' | 'boost' | 'field' | 'focus' | 'quest';

export type TutorialCtaAction = 'quest' | 'entityEquip' | 'shop' | 'almanac' | 'fuse';

export interface TutorialStepCtx {
  stageId: number;
  universeCount: number;
  entityPanelOpen: boolean;
  /** Which entity-panel sub-page is open (null when the panel is closed). Lets the
   *  in-panel SPARKLE selector fire only on the matching page (equip vs fuse). */
  panelPage: 'lab' | 'equip' | 'fuse' | null;
  /** Any full-screen overlay open (quest/shop/settings panels) — suppress bubbles. */
  questOpen: boolean;
  shopOpen: boolean;
  settingsOpen: boolean;
  totalClicks: number;
  equipUnlocked: boolean;
  /** Enhance (강화) unlocked — stage ≥ ENHANCE_UNLOCK_STAGE_ID. */
  enhanceUnlocked: boolean;
  ownedCurrentStageEntityCount: number;
  /** Any gear currently equipped (a worn copy in any slot) — gates the S3 enhance step. */
  hasEquippedGear: boolean;
  hasClaimableQuest: boolean;
  canShowShop: boolean;
  hasActiveBoost: boolean;
  canCondense: boolean;
  /** Stage-1 condense CORE is fully charged (matter income filled it) → tappable to fire. */
  condenseChargedReady: boolean;
  hasSeenCashShopTutorial: boolean;
  flags: Record<string, boolean>;
}

/**
 * In-panel SPARKLE target. The floating SpeechBubble is suppressed whenever the
 * entity panel is open, so guidance INSIDE the panel rides on this instead: a
 * pulse-ring on the target entity card (or the enhance affordance). Returned to
 * GameScreen which threads it into EntityPanel as `tutorialHighlight*` props.
 *
 * - kind 'equip-entity' / 'fuse-entity' → highlight the owned card with this entityId.
 * - kind 'enhance' → highlight an equipped slot + the enhance button.
 */
export type TutorialHighlight =
  | { kind: 'equip-entity'; entityId: string }
  | { kind: 'fuse-entity'; entityId: string }
  | { kind: 'enhance' };

export interface TutorialStep {
  id: string;
  /** Flag written when the bubble is dismissed (or the cash-shop discriminator). */
  flagId: string;
  anchor: TutorialAnchor;
  messageKey: string;
  ctaKey?: string;
  ctaAction?: TutorialCtaAction;
  autoCloseMs?: number;
  /** Steps after the two stage-1 intros are suppressed once `allDismissed` is set. */
  suppressedByAllDismissed: boolean;
  eligible(ctx: TutorialStepCtx): boolean;
  seen(ctx: TutorialStepCtx): boolean;
  /** Only the matter-time-intro step overrides these (pre-first-click variant). */
  resolveAnchor?(ctx: TutorialStepCtx): TutorialAnchor;
  resolveMessageKey?(ctx: TutorialStepCtx): string;
  resolveAutoCloseMs?(ctx: TutorialStepCtx): number | undefined;
}

const flag = (ctx: TutorialStepCtx, id: string) => Boolean(ctx.flags[id]);

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'matter-time-intro', flagId: 'matter-time-intro', anchor: 'resource',
    messageKey: 'tutMatterTimeIntro', autoCloseMs: 9000,
    suppressedByAllDismissed: false,
    eligible: (c) => c.stageId === 1,
    seen: (c) => flag(c, 'matter-time-intro'),
    resolveAnchor: (c) => (c.totalClicks === 0 ? 'field' : 'resource'),
    resolveMessageKey: (c) => (c.totalClicks === 0 ? 'tutFirstClick' : 'tutMatterTimeIntro'),
    resolveAutoCloseMs: (c) => (c.totalClicks === 0 ? 0 : 9000),
  },
  {
    id: 'auto-income-intro', flagId: 'auto-income-intro', anchor: 'field',
    messageKey: 'tutAutoIncome', autoCloseMs: 9000,
    suppressedByAllDismissed: false,
    eligible: (c) => c.stageId === 1 && flag(c, 'matter-time-intro'),
    seen: (c) => flag(c, 'auto-income-intro'),
  },
  {
    // 물질 응축 onboarding: fires once when the central CORE first reaches full charge on
    // stage 1 — tells the player the crack leaks matter that charges the core, then to tap
    // the glowing core to condense (raising entropy toward the gate). One-shot via flag.
    id: 'condense-core', flagId: 'condense-core', anchor: 'field',
    messageKey: 'condenseCoreTutorial', autoCloseMs: 9000,
    suppressedByAllDismissed: false,
    eligible: (c) => c.stageId === 1 && c.condenseChargedReady,
    seen: (c) => flag(c, 'condense-core'),
  },
  {
    id: 'quest-milestone-intro', flagId: 'quest-milestone-intro', anchor: 'quest',
    messageKey: 'tutQuestMilestone', ctaKey: 'tutQuestMilestoneOpen', ctaAction: 'quest',
    suppressedByAllDismissed: true,
    eligible: (c) => c.hasClaimableQuest,
    seen: (c) => flag(c, 'quest-milestone-intro'),
  },
  {
    // ONBOARDING SPINE (user: "장착에서 여러번 나와"): the two guaranteed-fusion
    // equip bubbles (first-fuse-equip / second-fuse-equip) were removed — they
    // chained three back-to-back "go equip" prompts. The single equip prompt below
    // already fires the moment equip unlocks, so the spine is reach-S2 → equip →
    // fuse with exactly ONE equip bubble. (The guaranteed first/second fusions in
    // reducers/entities.ts that HAND the player click+auto items still happen — only
    // their redundant bubbles are gone.)
    // #2 (user): fire the equip-open tutorial the moment equip unlocks (reaching S2),
    // NOT only after a current-stage item drops ("2스테이지 가면 바로, 아이템 나오고 X").
    // By S2 the player already holds S1 drops to equip.
    id: 'entity-lab-intro', flagId: 'entity-lab-intro', anchor: 'equip',
    messageKey: 'tutEntityLabIntro', ctaKey: 'tutEntityLabOpen', ctaAction: 'entityEquip',
    suppressedByAllDismissed: true,
    eligible: (c) => c.equipUnlocked,
    seen: (c) => flag(c, 'entity-lab-intro'),
  },
  {
    // #3 (user): after the FIRST equip, point them to fusion ("장착 하고 나오면 융합 튜토리얼").
    // first-equip-done is set by handleEquipEntity on the first successful equip.
    // The bubble's CTA OPENS the forge; once inside, the in-panel SPARLE on 인플라톤
    // 폭주 (selectTutorialHighlight) takes over (the bubble is suppressed over the panel).
    // It is marked seen by the first FUSION (fuse-spark-done), not just by tapping
    // the bubble — so it keeps reappearing as a reminder until the player actually fuses.
    id: 'fusion-intro', flagId: 'fusion-intro', anchor: 'fuse',
    messageKey: 'tutFusionIntro', ctaKey: 'tutFusionOpen', ctaAction: 'fuse',
    suppressedByAllDismissed: true,
    eligible: (c) => flag(c, 'first-equip-done') && !flag(c, 'fuse-spark-done'),
    seen: (c) => flag(c, 'fusion-intro') && flag(c, 'fuse-spark-done'),
  },
  {
    // S3 enhance (user: "장착 업그레이드(강화)도 반짝임으로 설명"). Once enhance unlocks
    // (S3) and the player wears gear, nudge them INTO the equip page; the in-panel
    // SPARKLE then lands on a worn slot + the enhance button. Marked seen by the
    // first enhance (enhance-spark-done) so it persists as a reminder until done.
    id: 'enhance-intro', flagId: 'enhance-intro', anchor: 'equip',
    messageKey: 'tutEnhanceIntro', ctaKey: 'tutEntityLabOpen', ctaAction: 'entityEquip',
    suppressedByAllDismissed: true,
    eligible: (c) => c.enhanceUnlocked && c.hasEquippedGear && !flag(c, 'enhance-spark-done'),
    seen: (c) => flag(c, 'enhance-intro') && flag(c, 'enhance-spark-done'),
  },
  {
    id: 'hasSeenCashShopTutorial', flagId: 'hasSeenCashShopTutorial', anchor: 'shop',
    messageKey: 'tutShop', ctaKey: 'tutShopOpen', ctaAction: 'shop',
    suppressedByAllDismissed: true,
    eligible: (c) => c.canShowShop,
    seen: (c) => c.hasSeenCashShopTutorial, // dedicated boolean, not flags{}
  },
  {
    id: 'boost-hud-seen', flagId: 'boost-hud-seen', anchor: 'boost',
    messageKey: 'tutBoost', autoCloseMs: 7000,
    suppressedByAllDismissed: true,
    eligible: (c) => c.hasActiveBoost,
    seen: (c) => flag(c, 'boost-hud-seen'),
  },
  {
    id: 'condense-ready', flagId: 'condense-ready', anchor: 'resource',
    messageKey: 'tutCondense', autoCloseMs: 8000,
    suppressedByAllDismissed: true,
    eligible: (c) => c.canCondense,
    seen: (c) => flag(c, 'condense-ready'),
  },
  {
    id: 'info-hint-seen', flagId: 'info-hint-seen', anchor: 'quest',
    messageKey: 'tutStageLog', ctaKey: 'tutStageLogOpen', ctaAction: 'almanac',
    suppressedByAllDismissed: true,
    eligible: (c) => flag(c, 'milestone-seen') && !c.questOpen,
    seen: (c) => flag(c, 'info-hint-seen'),
  },
];

/** The first eligible-and-unseen tutorial step in canonical order, or null. */
export function selectTutorialStep(ctx: TutorialStepCtx): TutorialStep | null {
  // Global suppression — never float a bubble over a full-screen overlay (it would
  // point at a now-hidden background element / overlap the panel), or after universe 1.
  if (
    ctx.entityPanelOpen ||
    ctx.questOpen ||
    ctx.shopOpen ||
    ctx.settingsOpen ||
    ctx.universeCount !== 1
  ) {
    return null;
  }
  const dismissed = Boolean(ctx.flags.allDismissed);
  for (const step of TUTORIAL_STEPS) {
    if (dismissed && step.suppressedByAllDismissed) continue;
    if (step.eligible(ctx) && !step.seen(ctx)) return step;
  }
  return null;
}

/**
 * The three guided SPARKLE targets are the STAGE-1 commons every player owns by S2
 * (positional ids, stageItems.ts): s1_01 = 양자 요동/Quantum Fluctuation (click),
 * s1_02 = 거짓 진공 거품/False Vacuum Bubble (auto→rift), s1_03 = 인플라톤 폭주/Inflaton
 * Surge (crit — the FUSE target). Equip order is vacuum (rift) → quantum (click).
 */
export const TUT_SPARK_EQUIP_FIRST_ID = 's1_02'; // 거짓 진공 거품 (rift)
export const TUT_SPARK_EQUIP_SECOND_ID = 's1_01'; // 양자 요동 (click)
export const TUT_SPARK_FUSE_ID = 's1_03'; // 인플라톤 폭주 (crit)

/**
 * The in-panel SPARKLE target, or null. This is SEPARATE from selectTutorialStep:
 * the floating bubble is suppressed while the panel is open, so once the player is
 * INSIDE the matching page this drives a pulse-ring on the exact card/button instead.
 * It is gated on first-universe + the relevant unlock + the matching page being open,
 * and advances purely off the same free-form tutorialFlags the bubble chain uses.
 */
export function selectTutorialHighlight(ctx: TutorialStepCtx): TutorialHighlight | null {
  // First universe only (mirrors the bubble suppression) — never re-spark for veterans.
  if (ctx.universeCount !== 1 || Boolean(ctx.flags.allDismissed)) return null;

  // S2 EQUIP page: spark the next un-equipped target (vacuum → quantum).
  if (ctx.panelPage === 'equip' && ctx.equipUnlocked) {
    if (!flag(ctx, 'equip-spark-vacuum-done')) {
      return { kind: 'equip-entity', entityId: TUT_SPARK_EQUIP_FIRST_ID };
    }
    if (!flag(ctx, 'equip-spark-quantum-done')) {
      return { kind: 'equip-entity', entityId: TUT_SPARK_EQUIP_SECOND_ID };
    }
    // S3 ENHANCE: both equips done + enhance unlocked + still un-enhanced + worn gear
    // → spark a worn slot + the enhance button (the player enhances ON the equip page).
    if (ctx.enhanceUnlocked && ctx.hasEquippedGear && !flag(ctx, 'enhance-spark-done')) {
      return { kind: 'enhance' };
    }
    return null;
  }

  // S2 FUSE page: after the equip step is done, spark 인플라톤 폭주 to fuse three.
  if (ctx.panelPage === 'fuse') {
    if (
      flag(ctx, 'equip-spark-quantum-done') &&
      !flag(ctx, 'fuse-spark-done')
    ) {
      return { kind: 'fuse-entity', entityId: TUT_SPARK_FUSE_ID };
    }
    return null;
  }

  return null;
}
