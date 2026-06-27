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

export type TutorialCtaAction = 'quest' | 'entityEquip' | 'shop' | 'almanac';

export interface TutorialStepCtx {
  stageId: number;
  universeCount: number;
  entityPanelOpen: boolean;
  /** Any full-screen overlay open (quest/shop/settings panels) — suppress bubbles. */
  questOpen: boolean;
  shopOpen: boolean;
  settingsOpen: boolean;
  totalClicks: number;
  equipUnlocked: boolean;
  ownedCurrentStageEntityCount: number;
  hasClaimableQuest: boolean;
  canShowShop: boolean;
  hasActiveBoost: boolean;
  canCondense: boolean;
  hasSeenCashShopTutorial: boolean;
  flags: Record<string, boolean>;
}

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
    id: 'fusion-intro', flagId: 'fusion-intro', anchor: 'fuse',
    messageKey: 'tutFusionIntro',
    suppressedByAllDismissed: true,
    eligible: (c) => flag(c, 'first-equip-done'),
    seen: (c) => flag(c, 'fusion-intro'),
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
    id: 'info-hint-seen', flagId: 'info-hint-seen', anchor: 'resource',
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
