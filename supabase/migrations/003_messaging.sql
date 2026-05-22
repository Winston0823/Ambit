-- ============================================================
-- 003_messaging.sql  ·  Ambit conversations, messages, reactions,
-- reads, push tokens, search. One migration for the full surface.
-- Run via supabase db push, then enable a Database Webhook on the
-- messages table (insert) pointing at the notify-message Edge
-- Function so push notifications fan out.
-- ============================================================

-- ── 1. conversations ────────────────────────────────────────
-- Always scoped to (seeker, project). One thread per seeker per
-- project — same owner can have multiple parallel threads with
-- the same seeker if they own multiple projects. owner_id is
-- denormalized from projects.owner_id so the inbox query and
-- RLS don't need an extra join on every read.
create table if not exists conversations (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects(id) on delete cascade,
  owner_id        uuid not null references auth.users(id) on delete cascade,
  seeker_id       uuid not null references auth.users(id) on delete cascade,
  created_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  unique (seeker_id, project_id),
  check (owner_id <> seeker_id)
);

create index if not exists idx_conversations_owner   on conversations (owner_id, last_message_at desc);
create index if not exists idx_conversations_seeker  on conversations (seeker_id, last_message_at desc);
create index if not exists idx_conversations_project on conversations (project_id);

-- ── 2. messages ─────────────────────────────────────────────
-- body OR attachment_url must be present (unless deleted_at is
-- set — soft-delete keeps replies/reactions stable). parent_id
-- powers reply quotes; ON DELETE SET NULL so deleting a parent
-- doesn't cascade into the replies that quoted it.
create table if not exists messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id       uuid not null references auth.users(id) on delete cascade,
  body            text,
  attachment_url  text,
  parent_id       uuid references messages(id) on delete set null,
  edited_at       timestamptz,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  check (
    deleted_at is not null
    or body is not null
    or attachment_url is not null
  )
);

create index if not exists idx_messages_conv_time on messages (conversation_id, created_at);
create index if not exists idx_messages_parent     on messages (parent_id) where parent_id is not null;

-- Generated tsvector + GIN index for full-text search across all
-- non-deleted message bodies. English config — fine for v1.
alter table messages
  add column if not exists body_tsv tsvector
  generated always as (to_tsvector('english', coalesce(body, ''))) stored;

create index if not exists idx_messages_body_tsv
  on messages using gin (body_tsv);

-- Bump conversations.last_message_at on every new message so the
-- inbox can sort by it without an aggregate scan of messages.
create or replace function trg_bump_conversation_last_message()
returns trigger language plpgsql as $$
begin
  update conversations
    set last_message_at = new.created_at
    where id = new.conversation_id;
  return new;
end;
$$;
drop trigger if exists bump_conversation_last_message on messages;
create trigger bump_conversation_last_message
  after insert on messages
  for each row execute function trg_bump_conversation_last_message();

-- ── 3. message_reactions ────────────────────────────────────
-- Composite PK includes emoji so a user can react with multiple
-- emojis on the same message, but not the same emoji twice.
create table if not exists message_reactions (
  message_id  uuid references messages(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete cascade,
  emoji       text not null,
  created_at  timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);
create index if not exists idx_reactions_message on message_reactions (message_id);

-- ── 4. conversation_reads ───────────────────────────────────
-- Drives unread badges and per-message ✓✓. One row per
-- (conversation, user). Updated whenever the user opens the thread.
create table if not exists conversation_reads (
  conversation_id uuid references conversations(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete cascade,
  last_read_at    timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

-- ── 5. push_tokens ──────────────────────────────────────────
-- One row per (user, token). A user can have multiple devices.
-- The notify-message Edge Function reads all tokens for the
-- recipient and fans out via Expo Push API.
create table if not exists push_tokens (
  user_id     uuid references auth.users(id) on delete cascade,
  token       text not null,
  platform    text not null check (platform in ('ios','android','web')),
  updated_at  timestamptz not null default now(),
  primary key (user_id, token)
);
create index if not exists idx_push_tokens_user on push_tokens (user_id);

-- ── 6. RLS ──────────────────────────────────────────────────
alter table conversations       enable row level security;
alter table messages            enable row level security;
alter table message_reactions   enable row level security;
alter table conversation_reads  enable row level security;
alter table push_tokens         enable row level security;

create policy "conversations: participant read"
  on conversations for select to authenticated
  using (owner_id = auth.uid() or seeker_id = auth.uid());

-- Direct inserts are locked down — clients go through the RPC
-- start_conversation_with_message which validates the project
-- exists and the caller is allowed to talk to the other party.
create policy "conversations: participant insert"
  on conversations for insert to authenticated
  with check (
    (seeker_id = auth.uid() or owner_id = auth.uid())
    and exists (
      select 1 from projects p
      where p.id = project_id and p.owner_id = conversations.owner_id
    )
  );

create policy "messages: participant read"
  on messages for select to authenticated
  using (
    exists (
      select 1 from conversations c
      where c.id = conversation_id
        and (c.owner_id = auth.uid() or c.seeker_id = auth.uid())
    )
  );

create policy "messages: participant insert"
  on messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from conversations c
      where c.id = conversation_id
        and (c.owner_id = auth.uid() or c.seeker_id = auth.uid())
    )
  );

create policy "messages: sender update"
  on messages for update to authenticated
  using (sender_id = auth.uid()) with check (sender_id = auth.uid());

create policy "messages: sender delete"
  on messages for delete to authenticated
  using (sender_id = auth.uid());

create policy "reactions: participant read"
  on message_reactions for select to authenticated
  using (
    exists (
      select 1 from messages m
      join conversations c on c.id = m.conversation_id
      where m.id = message_id
        and (c.owner_id = auth.uid() or c.seeker_id = auth.uid())
    )
  );
create policy "reactions: own write"
  on message_reactions for insert to authenticated
  with check (user_id = auth.uid());
create policy "reactions: own delete"
  on message_reactions for delete to authenticated
  using (user_id = auth.uid());

create policy "conversation_reads: own all"
  on conversation_reads for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "push_tokens: own all"
  on push_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── 7. start_conversation_with_message RPC ─────────────────
-- Atomic create-or-find + first-message insert. Either party can
-- initiate: seeker swiping up on a project, or owner swiping up
-- on a seeker (in which case p_project_id is the owner's first
-- active project, decided client-side).
create or replace function start_conversation_with_message(
  p_project_id    uuid,
  p_seeker_id     uuid,
  p_first_message text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_owner uuid;
  v_caller        uuid := auth.uid();
  v_conv_id       uuid;
begin
  if v_caller is null then raise exception 'not authenticated'; end if;
  if length(coalesce(trim(p_first_message), '')) = 0 then
    raise exception 'empty message';
  end if;

  select owner_id into v_project_owner from projects where id = p_project_id;
  if v_project_owner is null then raise exception 'project not found'; end if;
  if v_project_owner = p_seeker_id then
    raise exception 'cannot message your own project';
  end if;

  -- Caller must be one of the two participants.
  if v_caller <> v_project_owner and v_caller <> p_seeker_id then
    raise exception 'not a participant';
  end if;

  insert into conversations (project_id, owner_id, seeker_id)
  values (p_project_id, v_project_owner, p_seeker_id)
  on conflict (seeker_id, project_id) do update
    set last_message_at = now()
  returning id into v_conv_id;

  insert into messages (conversation_id, sender_id, body)
  values (v_conv_id, v_caller, p_first_message);

  return v_conv_id;
end;
$$;

-- ── 8. get_inbox RPC ────────────────────────────────────────
-- One round-trip for the inbox: conversation + partner profile +
-- last message preview + unread count per row. Security definer
-- so the joins don't trip multiple RLS checks; we still filter
-- to auth.uid()'s conversations in the where clause.
create or replace function get_inbox()
returns table (
  conversation_id              uuid,
  project_id                   uuid,
  project_title                text,
  partner_id                   uuid,
  partner_name                 text,
  partner_photo_url            text,
  last_message_at              timestamptz,
  last_message_body            text,
  last_message_attachment_url  text,
  last_message_sender_id       uuid,
  last_message_deleted         boolean,
  unread_count                 bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (select auth.uid() as id)
  select
    c.id,
    c.project_id,
    p.title,
    case when c.owner_id = (select id from me) then c.seeker_id else c.owner_id end,
    partner.name,
    partner.photo_url,
    c.last_message_at,
    last_msg.body,
    last_msg.attachment_url,
    last_msg.sender_id,
    (last_msg.deleted_at is not null),
    (
      select count(*) from messages m2
      where m2.conversation_id = c.id
        and m2.sender_id <> (select id from me)
        and m2.created_at > coalesce(r.last_read_at, '1970-01-01'::timestamptz)
        and m2.deleted_at is null
    )::bigint
  from conversations c
  join projects p on p.id = c.project_id
  join profiles partner on partner.id =
    (case when c.owner_id = (select id from me) then c.seeker_id else c.owner_id end)
  left join lateral (
    select body, attachment_url, sender_id, deleted_at
    from messages
    where conversation_id = c.id
    order by created_at desc
    limit 1
  ) last_msg on true
  left join conversation_reads r
    on r.conversation_id = c.id and r.user_id = (select id from me)
  where c.owner_id = (select id from me) or c.seeker_id = (select id from me)
  order by c.last_message_at desc;
$$;

-- ── 9. search_messages RPC ──────────────────────────────────
create or replace function search_messages(p_query text, p_limit int default 50)
returns table (
  message_id      uuid,
  conversation_id uuid,
  body            text,
  created_at      timestamptz,
  partner_name    text,
  project_title   text,
  rank            real
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (select auth.uid() as id), q as (
    select plainto_tsquery('english', p_query) as tsq
  )
  select
    m.id,
    m.conversation_id,
    m.body,
    m.created_at,
    partner.name,
    p.title,
    ts_rank(m.body_tsv, q.tsq) as rank
  from messages m
  join conversations c on c.id = m.conversation_id
  join projects p on p.id = c.project_id
  join profiles partner on partner.id =
    (case when c.owner_id = (select id from me) then c.seeker_id else c.owner_id end),
    q
  where (c.owner_id = (select id from me) or c.seeker_id = (select id from me))
    and m.deleted_at is null
    and m.body_tsv @@ q.tsq
  order by rank desc, m.created_at desc
  limit p_limit;
$$;

-- ── 10. mark_conversation_read RPC ──────────────────────────
-- Upsert convenience so the client doesn't have to construct the
-- on-conflict clause every time it opens a thread.
create or replace function mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into conversation_reads (conversation_id, user_id, last_read_at)
  values (p_conversation_id, auth.uid(), now())
  on conflict (conversation_id, user_id) do update set last_read_at = now();
end;
$$;

-- ── 11. Realtime publication ────────────────────────────────
-- Add messages + reactions + reads to the supabase_realtime publication
-- so the client can subscribe to live changes via postgres_changes.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table messages;
    alter publication supabase_realtime add table message_reactions;
    alter publication supabase_realtime add table conversation_reads;
  end if;
exception
  -- "relation is already member of publication" — safe to ignore on re-run.
  when duplicate_object then null;
end $$;

-- ── 12. Storage bucket for attachments ─────────────────────
-- Private bucket; access via signed URLs. Path convention:
-- {conversation_id}/{uuid}.{ext}
insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', false)
on conflict (id) do nothing;

-- Drop existing policies first so re-runs don't error.
drop policy if exists "chat-attachments: authenticated upload" on storage.objects;
drop policy if exists "chat-attachments: authenticated read"   on storage.objects;
drop policy if exists "chat-attachments: owner delete"          on storage.objects;

create policy "chat-attachments: authenticated upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-attachments');

create policy "chat-attachments: authenticated read"
  on storage.objects for select to authenticated
  using (bucket_id = 'chat-attachments');

create policy "chat-attachments: owner delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'chat-attachments' and owner = auth.uid());
