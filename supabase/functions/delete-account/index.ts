// Edge Function: delete-account
// Permanently deletes the calling user's account and all their data.
//
// The client (anon key) cannot delete its own auth.users row — that needs
// the service role. This function authenticates the caller from their JWT,
// then deletes the auth user with the admin API. Every table that
// references auth.users(id) ON DELETE CASCADE (profiles, projects,
// conversations, messages, portfolio_items, push_tokens, scheduling,
// availability, matches, …) is removed automatically.
//
// Deploy:  supabase functions deploy delete-account
// Invoke:  POST https://<project>.functions.supabase.co/delete-account
//          Header: Authorization: Bearer <user access token>
//
// Required to satisfy Apple App Store Guideline 5.1.1(v): apps that support
// account creation must let users delete their account in-app.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Resolve the caller from their JWT (anon client scoped to their token).
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: 'Invalid or expired session' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const uid = userData.user.id;

  // Delete with the service role. CASCADE removes all owned rows; we also
  // delete the profile row explicitly in case its FK predates the cascade.
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  await admin.from('profiles').delete().eq('id', uid);

  const { error: delErr } = await admin.auth.admin.deleteUser(uid);
  if (delErr) {
    console.error('deleteUser failed:', delErr);
    return new Response(JSON.stringify({ error: 'Could not delete account' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
