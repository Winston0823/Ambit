// Edge Function: delete-account
// Permanently deletes the calling user's account and all associated data.
// Satisfies App Store Guideline 5.1.1(v) (in-app account deletion).
//
// Flow:
//   1. Read the caller's JWT from the Authorization header and resolve the
//      user (a user can only ever delete THEMSELVES — we never trust a
//      user_id from the request body).
//   2. Best-effort purge the user's Storage objects (all buckets key their
//      objects under a `<userId>/…` prefix). Storage is NOT covered by the
//      auth-user delete cascade, so we clear it explicitly.
//   3. auth.admin.deleteUser(userId) — every domain table FKs to
//      auth.users(id) ON DELETE CASCADE (profiles, projects, matches,
//      conversations, messages, portfolio_items, scheduling, push_tokens,
//      …), so this single call removes all of the user's rows.
//
// Deploy:  supabase functions deploy delete-account
// Secrets: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by the
//          platform automatically; no extra secrets needed.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Every bucket stores objects under a `<userId>/…` prefix (see lib/portfolio,
// lib/projects, lib/resume, and the avatar upload in profile.tsx).
const USER_SCOPED_BUCKETS = ['avatars', 'project-images', 'portfolio-images', 'resumes'];

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

/// Best-effort: list and remove every object under `<userId>/` in a bucket.
/// Never throws — storage cleanup must not block the account deletion itself.
async function purgeBucketFolder(
  admin: ReturnType<typeof createClient>,
  bucket: string,
  userId: string,
): Promise<void> {
  try {
    const { data, error } = await admin.storage.from(bucket).list(userId, { limit: 1000 });
    if (error || !data || data.length === 0) return;
    const paths = data.map((obj) => `${userId}/${obj.name}`);
    await admin.storage.from(bucket).remove(paths);
  } catch (_e) {
    // swallow — a failed purge leaves orphaned files (not user-accessible),
    // which is acceptable; the account + DB rows are still deleted.
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return json({ error: 'Missing Authorization bearer token' }, 401);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Resolve the caller from their JWT — the ONLY user this request may delete.
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) {
    return json({ error: 'Invalid or expired session' }, 401);
  }
  const userId = userData.user.id;

  // 1. Best-effort storage purge (before the cascade so we still have the id).
  for (const bucket of USER_SCOPED_BUCKETS) {
    await purgeBucketFolder(admin, bucket, userId);
  }

  // 2. Delete the auth user → cascades every FK'd domain row.
  const { error: delErr } = await admin.auth.admin.deleteUser(userId);
  if (delErr) {
    return json({ error: `Failed to delete account: ${delErr.message}` }, 500);
  }

  return json({ ok: true, deleted: userId }, 200);
});
