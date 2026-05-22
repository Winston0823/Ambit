// Edge Function: notify-message
// Triggered by a Database Webhook on `messages` (INSERT). Fans out a
// push notification to every device token belonging to the recipient
// (the other participant in the conversation) via the Expo Push API.
//
// Wiring (one-time in Supabase Dashboard → Database → Webhooks):
//   Name:      notify-message
//   Table:     messages
//   Events:    Insert
//   Type:      HTTP Request → POST → https://<project>.functions.supabase.co/notify-message
//   Headers:   Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface WebhookPayload {
  type:   'INSERT' | 'UPDATE' | 'DELETE';
  table:  string;
  schema: string;
  record: {
    id:               string;
    conversation_id:  string;
    sender_id:        string;
    body:             string | null;
    attachment_url:   string | null;
    created_at:       string;
  };
}

interface ExpoMessage {
  to:    string;
  title: string;
  body:  string;
  data:  Record<string, unknown>;
  sound: 'default';
}

async function sendExpoPush(messages: ExpoMessage[]): Promise<void> {
  if (messages.length === 0) return;
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  });
  if (!res.ok) {
    console.error('Expo push API error:', res.status, await res.text());
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }

  if (payload.type !== 'INSERT' || payload.table !== 'messages') {
    return new Response('ok', { status: 200 });
  }

  const msg = payload.record;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Resolve conversation participants + project title for the notification body.
  const { data: convo, error: convoErr } = await supabase
    .from('conversations')
    .select('owner_id, seeker_id, project_id, projects(title)')
    .eq('id', msg.conversation_id)
    .single();

  if (convoErr || !convo) {
    console.error('conversation lookup failed:', convoErr);
    return new Response('ok', { status: 200 });
  }

  const recipientId =
    convo.owner_id === msg.sender_id ? convo.seeker_id : convo.owner_id;

  const { data: sender } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', msg.sender_id)
    .maybeSingle();

  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('user_id', recipientId);

  if (!tokens || tokens.length === 0) {
    return new Response('ok (no tokens)', { status: 200 });
  }

  const senderName = sender?.name ?? 'Someone';
  // Truncate so iOS doesn't blow out the notification line.
  const preview = msg.body
    ? msg.body.length > 140 ? msg.body.slice(0, 137) + '…' : msg.body
    : msg.attachment_url ? '📎 Sent an attachment' : 'New message';

  const expoMessages: ExpoMessage[] = tokens.map((t: { token: string }) => ({
    to:    t.token,
    title: senderName,
    body:  preview,
    sound: 'default',
    data: {
      conversationId: msg.conversation_id,
      messageId:      msg.id,
    },
  }));

  // Expo accepts up to 100 messages per request; chunk if needed.
  for (let i = 0; i < expoMessages.length; i += 100) {
    await sendExpoPush(expoMessages.slice(i, i + 100));
  }

  return new Response('ok', { status: 200 });
});
