import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Calendar from 'expo-calendar';
import type { SchedulingRequestRow, SchedulingSlot } from './scheduling';

/// AsyncStorage key for "I have already added a local calendar event for
/// this scheduling request" — value is the device's event id so we can
/// (eventually) update or delete the event if the request changes.
const LOCAL_EVENT_KEY = (requestId: string) => `scheduling.localEvent:${requestId}`;

export async function ensureCalendarPermission(): Promise<boolean> {
  const cur = await Calendar.getCalendarPermissionsAsync();
  if (cur.status === 'granted') return true;
  if (!cur.canAskAgain) return false;
  const next = await Calendar.requestCalendarPermissionsAsync();
  return next.status === 'granted';
}

/// Picks the best writable calendar on the device:
///   - iOS: the user's default (whichever calendar they've set as primary
///     in iOS Settings → Calendar — typically iCloud or their Google
///     account if linked through iOS).
///   - Android: there's no concept of a "default" — we look for the
///     primary writable calendar (isPrimary = true) and fall back to the
///     first one that allows modifications.
async function pickWritableCalendar(): Promise<string | null> {
  if (Platform.OS === 'ios') {
    const def = await Calendar.getDefaultCalendarAsync().catch(() => null);
    if (def?.id) return def.id;
  }

  const all = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const writable = all.filter((c) => c.allowsModifications);
  const primary  = writable.find((c) => (c as any).isPrimary) ?? writable[0];
  return primary?.id ?? null;
}

export async function getStoredLocalEventId(requestId: string): Promise<string | null> {
  return AsyncStorage.getItem(LOCAL_EVENT_KEY(requestId));
}

/// Idempotent. If a local event id is already stored for this request,
/// returns it without re-creating. Otherwise asks for permission (no-op
/// if already granted), picks a writable calendar, and inserts the event.
/// Returns the event id on success, null if permission denied or no
/// writable calendar found.
export async function addAcceptedMeetingToCalendar(
  request: SchedulingRequestRow,
): Promise<string | null> {
  if (request.status !== 'accepted' || !request.accepted_slot) return null;

  const existing = await getStoredLocalEventId(request.id);
  if (existing) return existing;

  const granted = await ensureCalendarPermission();
  if (!granted) return null;

  const calendarId = await pickWritableCalendar();
  if (!calendarId) return null;

  const slot: SchedulingSlot = request.accepted_slot;
  const eventId = await Calendar.createEventAsync(calendarId, {
    title:     request.title,
    startDate: new Date(slot.start),
    endDate:   new Date(slot.end),
    timeZone:  slot.tz,
    notes:     'Set up through Ambit.',
    alarms:    [{ relativeOffset: -15 }],  // 15-min warning
  });

  await AsyncStorage.setItem(LOCAL_EVENT_KEY(request.id), eventId);
  return eventId;
}

/// Removes the locally-stored event id (does NOT delete the event from
/// the calendar itself — that would surprise the user). Used when we
/// want to allow re-adding (e.g. after a cancel + re-propose).
export async function clearStoredLocalEventId(requestId: string): Promise<void> {
  await AsyncStorage.removeItem(LOCAL_EVENT_KEY(requestId));
}
