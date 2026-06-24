import { describe, expect, it } from 'vitest';
import { selectTutorialStep, TUTORIAL_STEPS, type TutorialStepCtx } from '../../components/tutorialSteps';

function ctx(over: Partial<TutorialStepCtx> = {}): TutorialStepCtx {
  return {
    stageId: 1,
    universeCount: 1,
    entityPanelOpen: false,
    questOpen: false,
    shopOpen: false,
    settingsOpen: false,
    totalClicks: 5,
    equipUnlocked: false,
    ownedCurrentStageEntityCount: 0,
    hasClaimableQuest: false,
    canShowShop: false,
    hasActiveBoost: false,
    canCondense: false,
    almanacOpen: false,
    hasSeenCashShopTutorial: false,
    flags: {},
    ...over,
  };
}

describe('C-P2 tutorial step selection (extracted, behavior-preserving)', () => {
  it('suppresses entirely when the entity panel is open or it is not the first universe', () => {
    expect(selectTutorialStep(ctx({ entityPanelOpen: true }))).toBeNull();
    expect(selectTutorialStep(ctx({ universeCount: 2 }))).toBeNull();
  });

  it('suppresses while any full-screen overlay is open (no bubble over the milestone/shop/settings panel)', () => {
    // stage-1 intro would otherwise be eligible (totalClicks 0)
    expect(selectTutorialStep(ctx({ totalClicks: 0, questOpen: true }))).toBeNull();
    expect(selectTutorialStep(ctx({ totalClicks: 0, shopOpen: true }))).toBeNull();
    expect(selectTutorialStep(ctx({ totalClicks: 0, settingsOpen: true }))).toBeNull();
    expect(selectTutorialStep(ctx({ totalClicks: 0, almanacOpen: true }))).toBeNull();
  });

  it('matter-time-intro shows the pre-first-click variant before any click', () => {
    const step = selectTutorialStep(ctx({ totalClicks: 0 }));
    expect(step?.id).toBe('matter-time-intro');
    expect(step?.resolveAnchor?.(ctx({ totalClicks: 0 }))).toBe('field');
    expect(step?.resolveMessageKey?.(ctx({ totalClicks: 0 }))).toBe('tutFirstClick');
    expect(step?.resolveAutoCloseMs?.(ctx({ totalClicks: 0 }))).toBe(0);
  });

  it('matter-time-intro switches to the post-click variant after the first click', () => {
    const c = ctx({ totalClicks: 5 });
    const step = selectTutorialStep(c);
    expect(step?.id).toBe('matter-time-intro');
    expect(step?.resolveAnchor?.(c)).toBe('resource');
    expect(step?.resolveMessageKey?.(c)).toBe('tutMatterTimeIntro');
    expect(step?.resolveAutoCloseMs?.(c)).toBe(9000);
  });

  it('advances to auto-income after the matter intro is seen', () => {
    expect(selectTutorialStep(ctx({ flags: { 'matter-time-intro': true } }))?.id).toBe('auto-income-intro');
  });

  it('quest-milestone wins when claimable and the stage-1 intros are done', () => {
    const step = selectTutorialStep(ctx({
      flags: { 'matter-time-intro': true, 'auto-income-intro': true },
      hasClaimableQuest: true,
    }));
    expect(step?.id).toBe('quest-milestone-intro');
  });

  it('returns the first eligible-AND-UNSEEN step, advancing as each is marked seen (anti-shadow)', () => {
    const base = ctx({
      stageId: 3,
      equipUnlocked: true,
      ownedCurrentStageEntityCount: 1,
      flags: {
        'matter-time-intro': true,
        'auto-income-intro': true,
        'quest-milestone-intro': true,
        'time-gauge-visible': true,
      },
    });
    // earlier steps are seen/ineligible → first unseen eligible is entity-lab-intro
    expect(selectTutorialStep(base)?.id).toBe('entity-lab-intro');
    // mark it seen → nothing else eligible at this ctx → null (no shadowing left over)
    const afterLab = ctx({ ...base, flags: { ...base.flags, 'entity-lab-intro': true } });
    expect(selectTutorialStep(afterLab)).toBeNull();
  });

  it('allDismissed still allows the two stage-1 intros but suppresses every later step', () => {
    // stage-1 intro still shows
    expect(selectTutorialStep(ctx({ totalClicks: 0, flags: { allDismissed: true } }))?.id).toBe('matter-time-intro');
    // everything after the intros is suppressed even when eligible
    const later = selectTutorialStep(ctx({
      stageId: 3,
      hasClaimableQuest: true,
      canCondense: true,
      flags: { allDismissed: true, 'matter-time-intro': true, 'auto-income-intro': true },
    }));
    expect(later).toBeNull();
  });

  it('cash-shop tutorial reads the dedicated boolean, not the flags map', () => {
    const base = ctx({ canShowShop: true, flags: { 'matter-time-intro': true, 'auto-income-intro': true } });
    expect(selectTutorialStep(base)?.id).toBe('hasSeenCashShopTutorial');
    expect(selectTutorialStep(ctx({ ...base, hasSeenCashShopTutorial: true }))).toBeNull();
  });

  it('info-hint requires the milestone flag and a closed almanac', () => {
    const base = ctx({ flags: { 'matter-time-intro': true, 'auto-income-intro': true, 'milestone-seen': true } });
    expect(selectTutorialStep(base)?.id).toBe('info-hint-seen');
    expect(selectTutorialStep(ctx({ ...base, almanacOpen: true }))).toBeNull();
  });

  it('has a unique, ordered step table', () => {
    const ids = TUTORIAL_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([
      'matter-time-intro', 'auto-income-intro', 'quest-milestone-intro', 'time-gauge-visible',
      'entity-lab-intro', 'fusion-intro',
      'hasSeenCashShopTutorial', 'boost-hud-seen', 'condense-ready', 'info-hint-seen',
    ]);
  });

  it('#2: equip-intro fires on reaching S2 (equipUnlocked) even with NO current-stage item', () => {
    const step = selectTutorialStep(ctx({
      stageId: 2, equipUnlocked: true, ownedCurrentStageEntityCount: 0,
      flags: { 'matter-time-intro': true, 'auto-income-intro': true, 'time-gauge-visible': true },
    }));
    expect(step?.id).toBe('entity-lab-intro');
  });

  it('#3: fusion-intro fires after the first equip (first-equip-done), once equip-intro is seen', () => {
    const base = ctx({
      stageId: 2, equipUnlocked: true,
      flags: {
        'matter-time-intro': true, 'auto-income-intro': true, 'time-gauge-visible': true,
        'entity-lab-intro': true, 'first-equip-done': true,
      },
    });
    expect(selectTutorialStep(base)?.id).toBe('fusion-intro');
    // before the first equip it must NOT show
    const noEquip = ctx({ ...base, flags: { ...base.flags, 'first-equip-done': false } });
    expect(selectTutorialStep(noEquip)?.id).not.toBe('fusion-intro');
  });
});
