import { supabase } from './supabase';

export interface SchedulingSlot {
  start: string;  // ISO 8601
  end:   string;
  tz:    string;
}

export type SchedulingStatus = 'proposed' | 'accepted' | 'declined' | 'cancelled';

export interface SchedulingRequestRow {
  id:                          string;
  conversation_id:             string;
  proposer_id:                 string;
  recipient_id:                string;
  status:                      SchedulingStatus;
  proposed_slots:              SchedulingSlot[];
  accepted_slot:               SchedulingSlot | null;
  title:                       string;
  duration_min:                number;
  google_event_id_proposer:    string | null;
  google_event_id_recipient:   string | null;
  created_at:                  string;
  updated_at:                  string;
}

/// Propose a meeting in an existing conversation. Inserts both the
/// scheduling_requests row and the chat message that references it,
/// atomically via the propose_meeting RPC. Returns the request id.
export async function proposeMeeting(args: {
  conversationId: string;
  slots:          SchedulingSlot[];
  title:          string;
  durationMin:    number;
}): Promise<string> {
  if (args.slots.length < 1 || args.slots.length > 3) {
    throw new Error('Propose between 1 and 3 time slots.');
  }
  const { data, error } = await supabase.rpc('propose_meeting', {
    p_conversation_id: args.conversationId,
    p_proposed_slots:  args.slots,
    p_title:           args.title,
    p_duration_min:    args.durationMin,
  });
  if (error) throw error;
  return data as string;
}

export async function acceptMeeting(requestId: string, slotIndex: number): Promise<void> {
  const { error } = await supabase.rpc('respond_to_meeting', {
    p_request_id: requestId,
    p_action:     'accept',
    p_slot_index: slotIndex,
  });
  if (error) throw error;
}

export async function declineMeeting(requestId: string): Promise<void> {
  const { error } = await supabase.rpc('respond_to_meeting', {
    p_request_id: requestId,
    p_action:     'decline',
  });
  if (error) throw error;
}

export async function cancelMeeting(requestId: string): Promise<void> {
  const { error } = await supabase.rpc('respond_to_meeting', {
    p_request_id: requestId,
    p_action:     'cancel',
  });
  if (error) throw error;
}

/// Load every scheduling request belonging to a conversation. Used by
/// the thread screen to populate the bubble UI and subscribe to live
/// status changes.
export async function listSchedulingRequests(
  conversationId: string,
): Promise<SchedulingRequestRow[]> {
  const { data, error } = await supabase
    .from('scheduling_requests')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as SchedulingRequestRow[];
}

/// Lightweight helper for building proposed slots from a JS Date.
export function buildSlot(start: Date, durationMin: number): SchedulingSlot {
  const end = new Date(start.getTime() + durationMin * 60_000);
  return {
    start: start.toISOString(),
    end:   end.toISOString(),
    tz:    Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}
