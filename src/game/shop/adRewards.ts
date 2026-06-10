import { showRewardedAd } from '../../lib/admob';

const AD_UNIT_MAP: Record<string, 'timeExtension' | 'matterBurst'> = {
  free_time_burst:   'timeExtension',
  free_matter_burst: 'matterBurst',
};

export async function completeRewardedAd(placementId: string): Promise<boolean> {
  const adType = AD_UNIT_MAP[placementId];
  if (!adType) return false;

  try {
    await showRewardedAd(adType);
    return true;
  } catch (e) {
    console.warn('[AdMob] Ad not completed:', e);
    return false;
  }
}
