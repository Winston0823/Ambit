import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

interface EmbedRequest {
  table: 'profiles' | 'projects';
  id:    string;
  text:  string;
}

async function openaiEmbed(text: string): Promise<number[]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${body}`);
  }
  const json = await res.json();
  return json.data[0].embedding as number[];
}

const jsonHeaders = { 'Content-Type': 'application/json' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  // ── Authenticate the caller ──────────────────────────────────────────
  // Without this, any client could embed arbitrary text into ANY row (an
  // IDOR + a way to burn the OpenAI budget). Resolve the user from their JWT
  // and only allow writing embeddings for rows they own.
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization' }), { status: 401, headers: jsonHeaders });
  }
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401, headers: jsonHeaders });
  }
  const uid = userData.user.id;

  let body: EmbedRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: jsonHeaders });
  }

  const { table, id, text } = body;
  if (!table || !id || !text) {
    return new Response(JSON.stringify({ error: 'table, id, text required' }), { status: 400, headers: jsonHeaders });
  }
  if (table !== 'profiles' && table !== 'projects') {
    return new Response(JSON.stringify({ error: 'table must be profiles or projects' }), { status: 400, headers: jsonHeaders });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // ── Ownership check ──────────────────────────────────────────────────
  // profiles: the row id IS the user id. projects: caller must be owner_id.
  if (table === 'profiles') {
    if (id !== uid) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: jsonHeaders });
    }
  } else {
    const { data: proj } = await admin.from('projects').select('owner_id').eq('id', id).maybeSingle();
    if (!proj || (proj as { owner_id: string }).owner_id !== uid) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: jsonHeaders });
    }
  }

  try {
    const embedding = await openaiEmbed(text);
    const { error } = await admin.from(table).update({ vibe_embedding: embedding }).eq('id', id);
    if (error) throw error;
    return new Response(JSON.stringify({ ok: true }), { headers: jsonHeaders });
  } catch (e: any) {
    console.error('embed-vibe error:', e);
    return new Response(JSON.stringify({ error: e.message ?? 'Internal error' }), { status: 500, headers: jsonHeaders });
  }
});
