-- Tug of Wits — rooms, matches, questions, and Realtime authorization.
-- Players are Supabase *anonymous* users (no sign-up): auth.uid() identifies a device.

-- ───────────── Questions ─────────────
create table public.questions (
  id            text primary key default gen_random_uuid()::text,
  category      text not null check (category in
                  ('quick-maths','general-knowledge','naija-trivia','science','football','bible-quran')),
  difficulty    text not null check (difficulty in ('easy','medium','hard')),
  text          text not null check (length(text) between 3 and 300),
  options       jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4),
  correct_index smallint not null check (correct_index between 0 and 3),
  image_url     text,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
create index questions_category_idx on public.questions (category, difficulty) where active;

-- ───────────── Rooms ─────────────
create table public.rooms (
  code             text primary key check (code ~ '^[A-HJ-NP-Z2-9]{5}$'),
  host_id          uuid not null,
  guest_id         uuid,
  host_name        text not null,
  host_character   text not null,
  guest_name       text,
  guest_character  text,
  host_ready       boolean not null default false,
  guest_ready      boolean not null default false,
  category         text not null,
  difficulty       text not null,
  status           text not null default 'lobby' check (status in ('lobby','playing','finished')),
  match_id         uuid,
  used_question_ids text[] not null default '{}',
  created_at       timestamptz not null default now(),
  last_activity    timestamptz not null default now()
);
create index rooms_last_activity_idx on public.rooms (last_activity);

-- ───────────── Matches ─────────────
-- `state` holds the referee's full ServerMatch, including answers not yet revealed.
-- No RLS policies: only the Edge Function (service role) can read it.
create table public.matches (
  id          uuid primary key default gen_random_uuid(),
  room_code   text not null references public.rooms (code) on delete cascade,
  state       jsonb not null,
  status      text not null default 'playing' check (status in ('playing','finished')),
  winner_side smallint,
  end_reason  text,
  history     jsonb,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz
);
create index matches_room_idx on public.matches (room_code);

alter table public.rooms
  add constraint rooms_match_fk foreign key (match_id) references public.matches (id) on delete set null;

-- ───────────── Row level security ─────────────
alter table public.questions enable row level security; -- no policies: server only
alter table public.matches   enable row level security; -- no policies: server only
alter table public.rooms     enable row level security;

create policy "members can read their room"
  on public.rooms for select to authenticated
  using (auth.uid() = host_id or auth.uid() = guest_id);

-- ───────────── Realtime: private channel per room ─────────────
-- Topic is 'room:<CODE>'. Members may receive broadcasts and use presence.
-- Nobody but the server (service role) may *send* broadcasts, so a phone can't fake referee events.

create or replace function public.is_room_member(topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.rooms r
    where 'room:' || r.code = topic
      and (r.host_id = auth.uid() or r.guest_id = auth.uid())
  );
$$;

create policy "room members receive broadcasts and presence"
  on realtime.messages for select to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and public.is_room_member(realtime.topic())
  );

create policy "room members track presence"
  on realtime.messages for insert to authenticated
  with check (
    realtime.messages.extension = 'presence'
    and public.is_room_member(realtime.topic())
  );
