import AsyncStorage from '@react-native-async-storage/async-storage';

/// How many reach-outs a user gets for free each calendar day.
export const DAILY_FREE_LIMIT = 5;

const STORAGE_KEY = '@ambit/reach_out_daily';

interface DailyCounter {
  date: string;     // 'YYYY-MM-DD' — counter resets when this changes
  count: number;    // total reach-outs sent today
  adBonus: number;  // extra slots earned via rewarded ads today
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

async function getCounter(): Promise<DailyCounter> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
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
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(c));
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

/// Call after a rewarded ad completes. Grants one extra reach-out slot.
export async function addAdBonus(): Promise<void> {
  const c = await getCounter();
  await setCounter({ ...c, adBonus: c.adBonus + 1 });
}

/// Returns status for display in the limit sheet.
export async function getReachOutStatus(): Promise<{
  used: number;
  limit: number;
}> {
  const c = await getCounter();
  return { used: c.count, limit: DAILY_FREE_LIMIT + c.adBonus };
}
