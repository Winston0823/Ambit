import { supabase } from './supabase';

// ─── Types ──────────────────────────────────────────────────────────

export type PollStatus = 'open' | 'closed' | 'cancelled';

export interface AvailabilityPollRow {
  id:                              string;
  conversation_id:                 string;
  proposer_id:                     string;
  recipient_id:                    string;
  title:                           string;
  duration_min:                    number;
  start_date:                      string;  // 'YYYY-MM-DD'
  end_date:                        string;
  day_start_hour:                  number;
  day_end_hour:                    number;
  tz:                              string;
  status:                          PollStatus;
  settled_scheduling_request_id:   string | null;
  created_at:                      string;
  updated_at:                      string;
}

export interface AvailabilityResponseRow {
  poll_id:        string;
  user_id:        string;
  selected_slots: { start: string; end: string }[];
  updated_at:     string;
}

/// A cell on the grid. The poll defines a (rows × cols) matrix —
/// rows = time-of-day slots stepping by `duration_min`, cols = days
/// from start_date to end_date (inclusive).
export interface GridCell {
  start: Date;
  end:   Date;
  /// Stable string key for React lists + Set membership.
  key:   string;
}

// ─── RPCs ───────────────────────────────────────────────────────────

export async function createAvailabilityPoll(args: {
  conversationId: string;
  title:          string;
  durationMin:    number;
  startDate:      string;  // 'YYYY-MM-DD'
  endDate:        string;
  dayStartHour:   number;
  dayEndHour:     number;
  tz:             string;
  proposerSlots:  { start: string; end: string }[];
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_availability_poll', {
    p_conversation_id: args.conversationId,
    p_title:           args.title,
    p_duration_min:    args.durationMin,
    p_start_date:      args.startDate,
    p_end_date:        args.endDate,
    p_day_start_hour:  args.dayStartHour,
    p_day_end_hour:    args.dayEndHour,
    p_tz:              args.tz,
    p_proposer_slots:  args.proposerSlots,
  });
  if (error) throw error;
  return data as string;
}

export async function setAvailabilityResponse(
  pollId: string,
  slots:  { start: string; end: string }[],
): Promise<void> {
  const { error } = await supabase.rpc('set_availability_response', {
    p_poll_id:        pollId,
    p_selected_slots: slots,
  });
  if (error) throw error;
}

export async function finalizeAvailabilityPoll(
  pollId:    string,
  slotStart: Date,
  slotEnd:   Date,
): Promise<string> {
  const { data, error } = await supabase.rpc('finalize_availability_poll', {
    p_poll_id:    pollId,
    p_slot_start: slotStart.toISOString(),
    p_slot_end:   slotEnd.toISOString(),
  });
  if (error) throw error;
  return data as string;
}

/// An accepted meeting answers "when can we meet?" — settle every still-open
/// poll in the conversation by closing it and pointing it at the scheduling
/// request that resolved it. Idempotent (only touches rows still 'open'),
/// so it's safe if both participants' devices race to call it.
export async function settleOpenPolls(
  conversationId:      string,
  schedulingRequestId: string,
): Promise<void> {
  const { error } = await supabase
    .from('availability_polls')
    .update({
      status:                        'closed',
      settled_scheduling_request_id: schedulingRequestId,
      updated_at:                    new Date().toISOString(),
    })
    .eq('conversation_id', conversationId)
    .eq('status', 'open');
  if (error) throw error;
}

export async function listAvailabilityPolls(
  conversationId: string,
): Promise<AvailabilityPollRow[]> {
  const { data, error } = await supabase
    .from('availability_polls')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as AvailabilityPollRow[];
}

export async function listAvailabilityResponses(
  pollId: string,
): Promise<AvailabilityResponseRow[]> {
  const { data, error } = await supabase
    .from('availability_responses')
    .select('*')
    .eq('poll_id', pollId);
  if (error) throw error;
  return (data ?? []) as AvailabilityResponseRow[];
}

// ─── Grid helpers ───────────────────────────────────────────────────

/// Enumerate every cell of a poll's grid. Returns a 2D matrix indexed
/// as [rowIdx][colIdx] — row = time-of-day step, col = day.
///
/// Implementation note: we treat day boundaries in local time of the
/// poll's tz. JS Date doesn't natively support "construct in a given
/// IANA tz" — we approximate by building Dates in the device's local
/// time then trusting that scheduling consumers (which the device
/// calendar runs in local tz anyway) reconcile correctly. For v1 this
/// is fine because the poll's tz is the proposer's tz which is the
/// device tz at creation time.
export function buildGrid(poll: AvailabilityPollRow): GridCell[][] {
  const rows: GridCell[][] = [];
  const startDate = parseISODate(poll.start_date);
  const endDate   = parseISODate(poll.end_date);
  const dayCount  = daysBetween(startDate, endDate) + 1;
  const stepMin   = poll.duration_min;
  const rowCount  = ((poll.day_end_hour - poll.day_start_hour) * 60) / stepMin;

  for (let row = 0; row < rowCount; row++) {
    const cells: GridCell[] = [];
    const minutesIntoDay = poll.day_start_hour * 60 + row * stepMin;
    const hour   = Math.floor(minutesIntoDay / 60);
    const minute = minutesIntoDay % 60;

    for (let col = 0; col < dayCount; col++) {
      const start = new Date(startDate);
      start.setDate(startDate.getDate() + col);
      start.setHours(hour, minute, 0, 0);
      const end = new Date(start.getTime() + stepMin * 60_000);
      cells.push({ start, end, key: start.toISOString() });
    }
    rows.push(cells);
  }

  return rows;
}

/// Returns the set of cell keys that overlap any of the given busy
/// intervals. Caller passes this into the cell renderer to decide
/// whether to disable a cell ("blocked by your calendar").
export function busyCellKeys(
  cells: GridCell[][],
  busy:  { start: Date; end: Date }[],
): Set<string> {
  const out = new Set<string>();
  if (busy.length === 0) return out;
  for (const row of cells) {
    for (const cell of row) {
      for (const b of busy) {
        if (b.start < cell.end && b.end > cell.start) {
          out.add(cell.key);
          break;
        }
      }
    }
  }
  return out;
}

/// Same idea but for "this cell is part of my (or their) selected
/// slots". A response's selected_slots is a list of {start, end}
/// strings (we serialise as ISO). The cell matches if its start equals
/// any slot's start — we store one entry per cell, so this is just a
/// set lookup once normalised.
export function selectedCellKeys(
  selectedSlots: { start: string; end: string }[],
): Set<string> {
  const out = new Set<string>();
  for (const s of selectedSlots) {
    out.add(new Date(s.start).toISOString());
  }
  return out;
}

/// Cells where both users are available — the candidate set for
/// locking in. Returns the cell keys.
export function overlapCellKeys(mine: Set<string>, theirs: Set<string>): string[] {
  const out: string[] = [];
  for (const k of mine) {
    if (theirs.has(k)) out.push(k);
  }
  return out.sort();
}

/// Format a cell start as a label for the "overlapping times" list.
export function formatCellLabel(start: Date): string {
  return start.toLocaleString(undefined, {
    weekday: 'short',
    month:   'short',
    day:     'numeric',
    hour:    'numeric',
    minute:  '2-digit',
  });
}

// ─── Date helpers ───────────────────────────────────────────────────

function parseISODate(s: string): Date {
  // 'YYYY-MM-DD' → local-midnight Date. Avoid 'new Date("YYYY-MM-DD")'
  // because that parses as UTC and shifts the day on negative offsets.
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

export function todayISODate(): string {
  const d = new Date();
  return formatISODate(d);
}

export function addDaysISODate(s: string, days: number): string {
  const d = parseISODate(s);
  d.setDate(d.getDate() + days);
  return formatISODate(d);
}

export function formatISODate(d: Date): string {
  const y  = d.getFullYear();
  const m  = (d.getMonth() + 1).toString().padStart(2, '0');
  const dd = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function deviceTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}
