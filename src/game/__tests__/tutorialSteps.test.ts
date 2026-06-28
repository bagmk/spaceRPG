import { describe, expect, it } from 'vitest';
import {
  selectTutorialStep,
  selectTutorialHighlight,
  TUTORIAL_STEPS,
  TUT_SPARK_EQUIP_FIRST_ID,
  TUT_SPARK_EQUIP_SECOND_ID,
  TUT_SPARK_FUSE_ID,
  type TutorialStepCtx,
} from '../../components/tutorialSteps';

function ctx(over: Partial<TutorialStepCtx> = {}): TutorialStepCtx {
  return {
    stageId: 1,
    universeCount: 1,
    entityPanelOpen: false,
    panelPage: null,
    questOpen: false,
    shopOpen: false,
    settingsOpen: false,
    totalClicks: 5,
    equipUnlocked: false,
    enhanceUnlocked: false,
    ownedCurrentStageEntityCount: 0,
    hasEquippedGear: false,
    hasClaimableQuest: false,
    canShowShop: false,
    hasActiveBoost: false,
    canCondense: false,
    condenseChargedReady: false,
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

  it('info-hint requires the milestone flag and a closed quest panel', () => {
    const base = ctx({ flags: { 'matter-time-intro': true, 'auto-income-intro': true, 'milestone-seen': true } });
    expect(selectTutorialStep(base)?.id).toBe('info-hint-seen');
    expect(selectTutorialStep(ctx({ ...base, questOpen: true }))).toBeNull();
  });

  it('has a unique, ordered step table', () => {
    const ids = TUTORIAL_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([
      'matter-time-intro', 'auto-income-intro', 'condense-core', 'quest-milestone-intro',
      'entity-lab-intro', 'fusion-intro', 'enhance-intro',
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

  it('fusion-intro PERSISTS until the first fusion (seen needs fuse-spark-done, not just the flag)', () => {
    const flags = {
      'matter-time-intro': true, 'auto-income-intro': true,
      'entity-lab-intro': true, 'first-equip-done': true,
    };
    const base = ctx({ stageId: 2, equipUnlocked: true, flags });
    // dismissing the bubble alone (flag set) does NOT retire it — it re-shows
    expect(selectTutorialStep(ctx({ ...base, flags: { ...flags, 'fusion-intro': true } }))?.id).toBe('fusion-intro');
    // only the actual fusion (fuse-spark-done) clears it
    expect(selectTutorialStep(ctx({ ...base, flags: { ...flags, 'fusion-intro': true, 'fuse-spark-done': true } }))?.id).not.toBe('fusion-intro');
  });

  it('S3 enhance-intro fires once enhance is unlocked AND gear is worn, persisting until the first enhance', () => {
    const flags = {
      'matter-time-intro': true, 'auto-income-intro': true,
      'entity-lab-intro': true, 'first-equip-done': true, 'fuse-spark-done': true,
    };
    // S2 (enhance locked) → no enhance-intro
    expect(selectTutorialStep(ctx({ stageId: 2, equipUnlocked: true, flags }))?.id).not.toBe('enhance-intro');
    // S3, gear worn → enhance-intro
    const s3 = ctx({ stageId: 3, equipUnlocked: true, enhanceUnlocked: true, hasEquippedGear: true, flags });
    expect(selectTutorialStep(s3)?.id).toBe('enhance-intro');
    // S3 but NO gear worn → no enhance-intro yet
    expect(selectTutorialStep(ctx({ ...s3, hasEquippedGear: false }))?.id).not.toBe('enhance-intro');
    // dismissing the bubble alone does NOT retire it
    expect(selectTutorialStep(ctx({ ...s3, flags: { ...flags, 'enhance-intro': true } }))?.id).toBe('enhance-intro');
    // the first enhance (enhance-spark-done) clears it
    expect(selectTutorialStep(ctx({ ...s3, flags: { ...flags, 'enhance-intro': true, 'enhance-spark-done': true } }))?.id).not.toBe('enhance-intro');
  });
});

describe('selectTutorialHighlight — in-panel SPARKLE (separate from the bubble)', () => {
  const equipBase = {
    stageId: 2, equipUnlocked: true, panelPage: 'equip' as const,
    flags: { 'matter-time-intro': true, 'auto-income-intro': true, 'entity-lab-intro': true },
  };

  it('returns null when the panel is closed (no page open)', () => {
    expect(selectTutorialHighlight(ctx({ ...equipBase, panelPage: null }))).toBeNull();
  });

  it('returns null for veterans (not the first universe) or after allDismissed', () => {
    expect(selectTutorialHighlight(ctx({ ...equipBase, universeCount: 2 }))).toBeNull();
    expect(selectTutorialHighlight(ctx({ ...equipBase, flags: { ...equipBase.flags, allDismissed: true } }))).toBeNull();
  });

  it('S2 equip: sparkles 거짓 진공 거품 (s1_02) first, then 양자 요동 (s1_01), then stops', () => {
    // nothing equipped yet → first target is the vacuum (rift) item
    expect(selectTutorialHighlight(ctx(equipBase))).toEqual({ kind: 'equip-entity', entityId: TUT_SPARK_EQUIP_FIRST_ID });
    // after the vacuum is equipped → advance to quantum (click)
    const afterVacuum = ctx({ ...equipBase, flags: { ...equipBase.flags, 'equip-spark-vacuum-done': true } });
    expect(selectTutorialHighlight(afterVacuum)).toEqual({ kind: 'equip-entity', entityId: TUT_SPARK_EQUIP_SECOND_ID });
    // both equipped → no more equip sparkle (and enhance not unlocked at S2)
    const both = ctx({ ...equipBase, flags: { ...equipBase.flags, 'equip-spark-vacuum-done': true, 'equip-spark-quantum-done': true } });
    expect(selectTutorialHighlight(both)).toBeNull();
  });

  it('S2 fuse: sparkles 인플라톤 폭주 (s1_03) only AFTER the equip step is done, until the first fusion', () => {
    const fuseBase = ctx({
      stageId: 2, panelPage: 'fuse',
      flags: { 'matter-time-intro': true, 'auto-income-intro': true, 'equip-spark-quantum-done': true },
    });
    expect(selectTutorialHighlight(fuseBase)).toEqual({ kind: 'fuse-entity', entityId: TUT_SPARK_FUSE_ID });
    // before the equip step completes → no fuse sparkle
    const preEquip = ctx({ stageId: 2, panelPage: 'fuse', flags: { 'matter-time-intro': true } });
    expect(selectTutorialHighlight(preEquip)).toBeNull();
    // after the first fusion (fuse-spark-done) → cleared
    const fused = ctx({ ...fuseBase, flags: { 'equip-spark-quantum-done': true, 'fuse-spark-done': true } });
    expect(selectTutorialHighlight(fused)).toBeNull();
  });

  it('does not cross-fire: the fuse sparkle never appears on the equip page (and vice-versa)', () => {
    const equipReadyForFuse = ctx({
      stageId: 2, equipUnlocked: true, panelPage: 'equip',
      flags: { 'equip-spark-vacuum-done': true, 'equip-spark-quantum-done': true },
    });
    // equips done, enhance locked → equip page shows nothing (fuse target stays on the fuse page)
    expect(selectTutorialHighlight(equipReadyForFuse)).toBeNull();
  });

  it('S3 enhance: sparkles the enhance affordance on the equip page once equips are done + gear worn', () => {
    const s3 = ctx({
      stageId: 3, equipUnlocked: true, enhanceUnlocked: true, hasEquippedGear: true, panelPage: 'equip',
      flags: { 'equip-spark-vacuum-done': true, 'equip-spark-quantum-done': true },
    });
    expect(selectTutorialHighlight(s3)).toEqual({ kind: 'enhance' });
    // after the first enhance → cleared
    expect(selectTutorialHighlight(ctx({ ...s3, flags: { ...s3.flags, 'enhance-spark-done': true } }))).toBeNull();
    // no worn gear → no enhance sparkle
    expect(selectTutorialHighlight(ctx({ ...s3, hasEquippedGear: false }))).toBeNull();
  });
});
