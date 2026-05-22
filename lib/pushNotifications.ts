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
  // Expo Go heuristic: Constants.appOwnership === 'expo'. In that case
  // skip the registration entirely so we don't pollute the DB with
  // useless tokens that the push API will reject.
  if (Constants.appOwnership === 'expo') {
    console.log('Push registration skipped: running in Expo Go.');
    return null;
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== 'granted') return null;

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
