import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';

// Set how the system handles foreground notifications. Without this,
// remote pushes don't surface a banner while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  true,
    shouldSetBadge:   true,
  }),
});

/// Asks for permission, fetches an Expo push token, and upserts it into
/// the push_tokens table for the signed-in user.
///
/// IMPORTANT: Remote push notifications no longer work in Expo Go on
/// SDK 53+. To deliver real pushes you need an EAS development build
/// (`eas build --profile development`). This function still runs safely
/// in Expo Go — it just returns null without registering.
export async function registerForPushNotifications(userId: string): Promise<string | null> {
  // Always request notification permissions first — local notifications
  // (the realtime fallback used in Expo Go / Simulator) need them too.
  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== 'granted') return null;

  // Expo Go can't register for remote APNs/FCM tokens (SDK 53+).
  // Permissions are still granted above for local notification fallback.
  if (Constants.appOwnership === 'expo') {
    console.log('Push token skipped: running in Expo Go (local notification fallback active).');
    return null;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as any).easConfig?.projectId;
  if (!projectId) {
    console.warn('Push registration: no EAS projectId in app config.');
    return null;
  }

  const tokenRes = await Notifications.getExpoPushTokenAsync({ projectId });
  const token = tokenRes.data;

  await supabase
    .from('push_tokens')
    .upsert(
      {
        user_id:    userId,
        token,
        platform:   Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,token' },
    );

  return token;
}

export async function unregisterPushToken(userId: string, token: string): Promise<void> {
  await supabase
    .from('push_tokens')
    .delete()
    .eq('user_id', userId)
    .eq('token', token);
}

/// Removes ALL push tokens for a user. Call on sign-out so the device
/// stops receiving notifications after the session ends.
export async function unregisterAllPushTokens(userId: string): Promise<void> {
  await supabase.from('push_tokens').delete().eq('user_id', userId);
}

/// Sets the app icon badge to the given count. No-ops on platforms that
/// don't support badging (Android < 8 without a launcher that supports it).
export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count).catch(() => {});
}

/// Clears the app icon badge to zero. Safe to call at any time.
export async function clearBadge(): Promise<void> {
  await Notifications.setBadgeCountAsync(0).catch(() => {});
}
