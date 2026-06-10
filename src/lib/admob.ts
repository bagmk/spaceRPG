import {
  AdMob,
  RewardAdPluginEvents,
  type AdMobRewardItem,
} from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

// Ad unit IDs
const AD_UNITS = {
  android: {
    timeExtension: 'ca-app-pub-5232675103934625/9162542284',
    matterBurst:   'ca-app-pub-5232675103934625/5171326382',
  },
  ios: {
    timeExtension: 'ca-app-pub-5232675103934625/5245828092',
    matterBurst:   'ca-app-pub-5232675103934625/3333980628',
  },
  // Official Google test IDs for development
  test: {
    timeExtension: 'ca-app-pub-3940256099942544/5224354917',
    matterBurst:   'ca-app-pub-3940256099942544/5224354917',
  },
};

const IS_DEV = import.meta.env.DEV;

function getAdUnitId(type: 'timeExtension' | 'matterBurst'): string {
  if (IS_DEV) return AD_UNITS.test[type];
  const platform = Capacitor.getPlatform();
  if (platform === 'ios') return AD_UNITS.ios[type];
  return AD_UNITS.android[type];
}

let initialized = false;

export async function initAdMob(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (initialized) return;

  // iOS ATT: request tracking authorization before initializing
  await AdMob.requestTrackingAuthorization().catch(() => {});

  await AdMob.initialize({
    initializeForTesting: IS_DEV,
  });

  initialized = true;
}

export type RewardType = 'timeExtension' | 'matterBurst';

/**
 * Show a rewarded ad. Resolves with the reward item on success,
 * or rejects if the ad fails to load/show.
 */
export function showRewardedAd(type: RewardType): Promise<AdMobRewardItem> {
  return new Promise(async (resolve, reject) => {
    if (!Capacitor.isNativePlatform()) {
      reject(new Error('AdMob only available on native platforms'));
      return;
    }

    const adId = getAdUnitId(type);

    const rewardListener = await AdMob.addListener(
      RewardAdPluginEvents.Rewarded,
      (reward: AdMobRewardItem) => {
        rewardListener.remove();
        failedListener.remove();
        resolve(reward);
      }
    );

    const failedListener = await AdMob.addListener(
      RewardAdPluginEvents.FailedToShow,
      (error) => {
        rewardListener.remove();
        failedListener.remove();
        reject(new Error(`Ad failed to show: ${JSON.stringify(error)}`));
      }
    );

    try {
      await AdMob.prepareRewardVideoAd({ adId });
      await AdMob.showRewardVideoAd();
    } catch (e) {
      rewardListener.remove();
      failedListener.remove();
      reject(e);
    }
  });
}
