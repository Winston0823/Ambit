import { Platform } from 'react-native';
import Constants from 'expo-constants';

/// Google Mobile Ads (AdMob) rewarded-ad integration.
///
/// The native module only exists in a real build (dev-client / standalone), so
/// Expo Go and web fall back to a simulated ad — the app still runs everywhere.
///
/// Initialization + the iOS App Tracking Transparency prompt happen lazily on
/// the FIRST ad request (see `showRewardedAd`), not at app launch. That ties
/// the ATT dialog to a clear user action ("Watch a short ad") instead of
/// firing cold on first open next to the notification prompt.

// Real Rewarded ad-unit IDs from the AdMob console. In __DEV__ the code uses
// TestIds.REWARDED automatically (see showRewardedAd), so these serve real ads
// only in production. Note: showing real ads on your own device without
// registering it as an AdMob test device is a policy violation.
// TODO(admob): Android unit not created yet — set when Android ships.
const REWARDED_UNIT_ID = Platform.select({
  ios: 'ca-app-pub-5182867477471868/2315018167',
  android: 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
  default: '',
});

// The native ads SDK is present everywhere EXCEPT Expo Go and web.
const nativeAdsAvailable = Platform.OS !== 'web' && Constants.appOwnership !== 'expo';

let initialized = false;

// Lazy require so Expo Go / web never execute the native module's import.
function getGma() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('react-native-google-mobile-ads');
}

/// Idempotent: request ATT (iOS) then initialize the SDK. No-op off native.
async function ensureInitialized(): Promise<void> {
  if (!nativeAdsAvailable || initialized) return;
  try {
    if (Platform.OS === 'ios') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { requestTrackingPermissionsAsync } = require('expo-tracking-transparency');
      await requestTrackingPermissionsAsync().catch(() => {});
    }
    await getGma().default().initialize();
    initialized = true;
  } catch (e) {
    console.warn('Ad SDK init failed:', e);
  }
}

/// Show a rewarded ad. Resolves `true` only if the user earned the reward
/// (watched to completion); `false` if they closed it early. Rejects on a
/// load/show failure so the caller can surface "try again". In Expo Go / web
/// it simulates a 2s ad and resolves true.
export function showRewardedAd(): Promise<boolean> {
  if (!nativeAdsAvailable) {
    return new Promise((resolve) => setTimeout(() => resolve(true), 2000));
  }
  return new Promise<boolean>((resolve, reject) => {
    (async () => {
      await ensureInitialized();
      try {
        const { RewardedAd, RewardedAdEventType, AdEventType, TestIds } = getGma();
        const unitId = __DEV__ ? TestIds.REWARDED : REWARDED_UNIT_ID;
        const rewarded = RewardedAd.createForAdRequest(unitId, {
          requestNonPersonalizedAdsOnly: true,
        });

        let earned = false;
        const unsubs: Array<() => void> = [];
        const cleanup = () => unsubs.forEach((u) => { try { u(); } catch {} });

        unsubs.push(
          rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
            rewarded.show().catch((e: unknown) => { cleanup(); reject(e); });
          }),
          rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
            earned = true;
          }),
          rewarded.addAdEventListener(AdEventType.CLOSED, () => {
            cleanup();
            resolve(earned);
          }),
          rewarded.addAdEventListener(AdEventType.ERROR, (e: unknown) => {
            cleanup();
            reject(e);
          }),
        );

        rewarded.load();
      } catch (e) {
        reject(e);
      }
    })();
  });
}
