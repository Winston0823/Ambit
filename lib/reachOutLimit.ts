import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

/// How many reach-outs a user gets for free each calendar day.
export const DAILY_FREE_LIMIT = 5;

/// Cap on extra slots earnable via rewarded ads in a single day. Prevents a
/// user from grinding ads to spam reach-outs (5 free + 3 bonus = 8 max/day).
export const MAX_AD_BONUS = 3;

const STORAGE_KEY = '@ambit/reach_out_daily';

/// Per-account storage key. The counter is device-local, so without the user
/// id in the key, two accounts signed in on the same device share one daily
/// quota. getSession() reads local storage (no network), so this stays cheap.
async function storageKey(): Promise<string> {
  try {
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user?.id;
    if (uid) return `${STORAGE_KEY}/${uid}`;
  } catch {}
  return STORAGE_KEY;
}

interface DailyCounter {
  date: string;     // 'YYYY-MM-DD' — counter resets when this changes
  count: number;    // total reach-outs sent today
  adBonus: number;  // extra slots earned via rewarded ads today
}

/// Local-calendar day key ('YYYY-MM-DD'). Uses the device's own date parts,
/// NOT toISOString() — the latter is UTC, so west-of-UTC users would see the
/// quota reset mid-afternoon (~4–5pm PT) instead of at local midnight.
function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function getCounter(): Promise<DailyCounter> {
  try {
    const raw = await AsyncStorage.getItem(await storageKey());
    if (raw) {
      const c = JSON.parse(raw) as DailyCounter;
      // Still the same calendar day — use the stored counter.
      if (c.date === todayKey()) return c;
    }
  } catch {}
  // First use of the day or corrupt data — start fresh.
  return { date: todayKey(), count: 0, adBonus: 0 };
}

async function setCounter(c: DailyCounter): Promise<void> {
  await AsyncStorage.setItem(await storageKey(), JSON.stringify(c));
}

/// True if the user has capacity for another reach-out right now.
export async function canReachOut(): Promise<boolean> {
  const c = await getCounter();
  return c.count < DAILY_FREE_LIMIT + c.adBonus;
}

/// Call after a message is successfully sent.
export async function recordReachOut(): Promise<void> {
  const c = await getCounter();
  await setCounter({ ...c, count: c.count + 1 });
}

/// Call after a rewarded ad completes. Grants one extra reach-out slot, up to
/// MAX_AD_BONUS per day so the daily cap can't be endlessly ground away.
export async function addAdBonus(): Promise<void> {
  const c = await getCounter();
  await setCounter({ ...c, adBonus: Math.min(c.adBonus + 1, MAX_AD_BONUS) });
}

/// True if the user can still earn another ad bonus today (below MAX_AD_BONUS).
export async function canEarnAdBonus(): Promise<boolean> {
  const c = await getCounter();
  return c.adBonus < MAX_AD_BONUS;
}

/// Returns status for display in the limit sheet.
export async function getReachOutStatus(): Promise<{
  used: number;
  limit: number;
}> {
  const c = await getCounter();
  return { used: c.count, limit: DAILY_FREE_LIMIT + c.adBonus };
}
