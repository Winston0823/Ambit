-- 035_pass_cooldown.sql — passes are a cooldown, not a tombstone.
--
-- Product change: people (and projects) grow. A pass should hide the project
-- from the seeker's deck for a while, not forever. After the cooldown the
-- project resurfaces; passing it again restarts the clock (the client bumps
-- matches.created_at on re-skip). Reach-outs ('applied') stay excluded — that
-- pair already has a conversation, which is the venue for round two.
--
-- Also: reaching out to a pair whose conversation ended (passed /
-- auto-declined) REOPENS it as a fresh active conversation with a new 72h
-- reply window, instead of appending into a locked thread.

-- ─────────────────────────────────────────────────────────────
-- 1. Seeker deck: 30-day skip cooldown.
--    Body copied from 031_safety.sql (roles_sought/image_url/needed_by +
--    block filter); only the matches exclusion changes.
-- ─────────────────────────────────────────────────────────────
create or replace function compat_projects_for_seeker(
  p_seeker_id uuid,
  p_limit     int default 30
)
returns table (
  project_id      uuid,
  title           text,
  vibe_blurb      text,
  required_skills text[],
  roles_sought    text[],
  image_url       text,
  needed_by       date,
  campus_id       text,
  owner_id        uuid,
  score           numeric(5,2),
  skill_match_pct numeric(5,2),
  vibe_similarity numeric(5,2)
)
language sql
stable
security definer
set search_path = public
as $$
  with seeker as (
    select skills, vibe_embedding
    from   profiles
    where  id = p_seeker_id
  ),
  scored as (
    select
      pr.id,
      pr.title,
      pr.vibe_blurb,
      pr.required_skills,
      pr.roles_sought,
      pr.image_url,
      pr.needed_by,
      pr.campus_id,
      pr.owner_id,
      pr.created_at,
      case
        when array_length(pr.required_skills, 1) = 0 then 0
        else (
          select count(*)::numeric
          from   unnest(pr.required_skills) rs
          where  rs = any(seeker.skills)
        ) / array_length(pr.required_skills, 1)::numeric
      end                                        as skill_match_pct,
      case
        when pr.vibe_embedding is null or seeker.vibe_embedding is null then 0
        else greatest(0, 1 - (pr.vibe_embedding <=> seeker.vibe_embedding))
      end                                        as vibe_sim
    from projects pr, seeker
    where pr.active = true
      and pr.owner_id <> p_seeker_id
      -- Reach-outs stay excluded (a conversation exists); skips only cool the
      -- project down for 30 days, then it may resurface.
      and not exists (
        select 1 from matches m
        where m.seeker_id = p_seeker_id
          and m.project_id = pr.id
          and (
            m.outcome = 'applied'
            or (m.outcome = 'skipped' and m.created_at > now() - interval '30 days')
          )
      )
      -- Safety: drop projects whose owner blocked the seeker or is blocked by them.
      and not exists (
        select 1 from blocked_users b
        where (b.blocker_id = p_seeker_id and b.blocked_id = pr.owner_id)
           or (b.blocker_id = pr.owner_id and b.blocked_id = p_seeker_id)
      )
  )
  select
    id              as project_id,
    title,
    vibe_blurb,
    required_skills,
    roles_sought,
    image_url,
    needed_by,
    campus_id,
    owner_id,
    round((70 * skill_match_pct + 30 * vibe_sim)::numeric, 2) as score,
    round((skill_match_pct * 100)::numeric, 2)                as skill_match_pct,
    round((vibe_sim * 100)::numeric, 2)                       as vibe_similarity
  from scored
  order by score desc, created_at desc
  limit p_limit;
$$;

grant execute on function compat_projects_for_seeker(uuid, int) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2. Reach-out reopens a closed conversation.
--    Body copied from 003_messaging.sql; adds the reopen block.
-- ─────────────────────────────────────────────────────────────
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

  -- A pass isn't forever: reaching out again after a passed / auto-declined
  -- ending reopens the thread as a fresh active conversation with a new 72h
  -- reply window. Hired conversations are terminal and stay untouched.
  update conversations
     set status            = 'active',
         pass_reason       = null,
         passed_by         = null,
         hired_proposed_by = null,
         auto_decline_at   = now() + interval '72 hours'
   where id = v_conv_id
     and status in ('passed', 'auto_declined');

  insert into messages (conversation_id, sender_id, body)
  values (v_conv_id, v_caller, p_first_message);

  return v_conv_id;
end;
$$;

grant execute on function start_conversation_with_message(uuid, uuid, text) to authenticated;
