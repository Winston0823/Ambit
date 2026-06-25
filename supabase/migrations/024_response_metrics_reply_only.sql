-- ── Response metrics: reply-only definition ───────────────────
-- Supersedes the formula in 005_closure_loop.sql. Previously the
-- "first response" to a reach-out was the EARLIEST of (a) the owner
-- reading the conversation or (b) the owner sending a message — so
-- merely opening a reach-out counted as responding. That overstated
-- responsiveness: a read is not a reply.
--
-- New definition: the first response is the owner's first actual
-- `kind='user'` message in the conversation. Reads no longer count.
-- Everything else (90-day window, 72h SLA, avg-minutes, the profiles
-- cache columns) is unchanged, so callers and triggers need no edits.
--
-- The read trigger (recompute_metrics_on_read) is intentionally kept:
-- a read no longer moves the numerator, but it's still a cheap, natural
-- moment to refresh the cache so conversations that have just aged past
-- the 72h line (and were never replied to) settle into the denominator.
create or replace function recompute_response_metrics(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total      int;
  v_responded  int;
  v_avg_min    numeric;
begin
  with eligible as (
    select c.id, c.created_at
      from conversations c
     where c.owner_id = p_user_id
       and c.created_at > now() - interval '90 days'
       and c.created_at < now() - interval '72 hours'
  ),
  response_time as (
    select
      e.id,
      -- First response = first actual reply the owner sent. Reads excluded.
      (select min(m.created_at) from messages m
         where m.conversation_id = e.id
           and m.sender_id = p_user_id
           and m.kind = 'user') as first_action_at,
      e.created_at
    from eligible e
  ),
  scored as (
    select
      count(*) filter (where first_action_at is not null
                       and first_action_at <= created_at + interval '72 hours') as responded,
      count(*) as total,
      avg(extract(epoch from (first_action_at - created_at)) / 60)
        filter (where first_action_at is not null
                  and first_action_at <= created_at + interval '72 hours') as avg_min
    from response_time
  )
  select responded, total, avg_min
    into v_responded, v_total, v_avg_min
    from scored;

  if v_total is null or v_total = 0 then
    update profiles
       set response_rate         = null,
           avg_response_minutes  = null
     where id = p_user_id;
  else
    update profiles
       set response_rate         = round((v_responded::numeric / v_total::numeric), 2),
           avg_response_minutes  = round(coalesce(v_avg_min, 0))::int
     where id = p_user_id;
  end if;
end;
$$;

-- Backfill every existing profile so the new definition is reflected
-- immediately rather than only after each owner's next message/read.
do $$
declare r record;
begin
  for r in select id from profiles loop
    perform recompute_response_metrics(r.id);
  end loop;
end $$;
