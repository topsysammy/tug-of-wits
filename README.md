# Tug of Wits

A two-player, real-time quiz tug-of-war PWA. Both players get the same question, and the first correct answer pulls the rope one step. Drag the rope 5 steps to your side and you win. The rules, flows and fairness model are in [tug-of-wits-prd.md](tug-of-wits-prd.md).

## Status

| Phase | Scope | State |
| --- | --- | --- |
| 1 | Local match against a simulated opponent, every match state, rope and character animation | **Done** |
| 2 | Supabase rooms, lobby, realtime, server referee, reconnect/forfeit | **Done** (needs your Supabase project, below) |
| 3 | Home, create/join, results, rematch, settings, how to play, errors | Next |
| 4 | Share card, WhatsApp share, PWA install, sounds and haptics | — |

## Run it

Requires Node 20 or newer.

```bash
npm install
npm run dev        # http://localhost:5173 (also on your LAN, so you can open it on a phone)
npm test           # referee unit tests
npm run build      # typecheck + production build
```

In dev builds, a round button in the bottom-right corner opens the **simulator** panel. In a production build, add `?sim` to the URL to show it. The panel can:

- change the opponent's skill mid-match
- **Drop opponent** / **Reconnect opponent** to test the 20 s pause and forfeit
- **Win this round for me** to test the winning side of the rope
- **Skip to question 39** to test the safety cap and sudden death

## Where things live

```
supabase/functions/_shared/   ← shared by the browser and the Edge Function
  gameConfig.ts               ← ALL game rules: STEPS_TO_WIN, ROUND_SECONDS, REVEAL_MS, MAX_QUESTIONS, GRACE_MS…
  referee.ts                  ← pure round + match judging (clock passed in, no I/O)
  engine.ts                   ← the whole server game loop (pure): rounds, reveal, pause, forfeit, sync
  protocol.ts                 ← server ⇄ phone message shapes
  mathGen.ts, rooms.ts, types.ts
supabase/functions/referee/   ← the Edge Function (Deno): rooms + match actions over Postgres
supabase/migrations/          ← schema + RLS, Naija Trivia seed, room expiry job
scripts/import-questions.mjs  ← CSV → questions table
src/
  game/localServer.ts         ← practice mode: the engine in the browser + a simulated opponent
  game/transport.ts           ← the interface the match screen talks to
  net/                        ← online: api.ts (Edge Function), roomChannel.ts (Realtime), realtimeTransport.ts
  hooks/useMatch.ts           ← client match state; measures answer time from question paint → tap
  components/Avatar.tsx       ← <Avatar who pose mood size flip /> for the 4 characters
  components/match/*          ← StatBar, Arena (rope), StatusLine, QuestionCard, AnswerGrid, overlays
  screens/                    ← Home (temporary), Lobby, Match, RoomError
tests/                        ← referee + engine + maths generator tests
```

The `@shared/*` import alias points at `supabase/functions/_shared`. Files there import each other with explicit `.ts` extensions so Deno can run them unchanged.

### How fairness works (already built into the referee)

- The phone gets questions without the answer (`PublicQuestion`). Only the referee holds `correctIndex` until the reveal.
- The phone times the answer from the frame the question was painted to the tap (which fires on press, not release) and sends that time.
- After the first correct answer arrives, the referee waits `GRACE_MS` (300 ms) and gives the round to the shortest valid reported time.
- It rejects times under `MIN_ANSWER_MS` (250 ms), answers after the round closes, second answers (the lockout), and times far below what the server itself measured (`MAX_LATENCY_CREDIT_MS`).
- Questions are preloaded `PRELOAD_AHEAD` (2) rounds ahead.
- If a player disconnects mid-round, that round is voided and a fresh question is asked on resume, so the connected player can't use the pause to think.

## Supabase setup

Online play needs a Supabase project. Practice mode works without one.

1. **Create a project** at [supabase.com](https://supabase.com).
2. **Turn on anonymous sign-ins**: Authentication → Sign In / Providers → *Allow anonymous sign-ins*. Players never sign up, but each phone gets a stable id, so a dropped player can rejoin as themselves.
3. **Apply the database and deploy the referee** from this folder:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push                 # tables, security rules, 24 Naija Trivia questions, room expiry job
   npx supabase functions deploy referee
   ```
   The room-expiry migration uses `pg_cron`. If `db push` fails on it, enable *pg_cron* under Database → Extensions and push again.
4. **Recommended:** in Realtime → Settings, turn off *Allow public access*, so only private room channels work.
5. **Point the app at it.** Copy `.env.example` to `.env.local` and fill in:
   ```
   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon / publishable key>   # Project Settings → API
   ```
   Add the same two variables in Vercel (Project → Settings → Environment Variables), then redeploy.

The Edge Function automatically gets `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_DB_URL` from Supabase, so you don't set anything for it.

### Adding questions without redeploying

```bash
node scripts/import-questions.mjs my-questions.csv --dry-run   # check the file
SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<service role key> \
  node scripts/import-questions.mjs my-questions.csv
```

See `scripts/questions.sample.csv` for the columns. Never put the service role key in the app or in Vercel. Quick Maths questions are generated on the server, so they need no import. To open a new category, add it to `PLAYABLE_CATEGORIES` in `supabase/functions/_shared/rooms.ts`.

## How online play works

- **The referee** (`supabase/functions/referee`) is one Edge Function. For every action it locks the room's row in Postgres, runs the shared engine (`_shared/engine.ts`, the same code practice mode runs), saves the match, and broadcasts the resulting events on the private Realtime channel `room:<CODE>`.
- **Only the referee can broadcast** on that channel (Realtime RLS on `realtime.messages`), so a phone can't fake a pull. The `matches` and `questions` tables have no client policies, so answers never leave the server before the reveal.
- **Timers:** an Edge Function can't hold a 10 s timer between requests. Each step reports when it next needs a tick, which runs as a background task (`EdgeRuntime.waitUntil`), and phones send a `tick` if an expected event is overdue. Ticks are idempotent, so whichever arrives first does the work.
- **Disconnects:** phones watch each other's Realtime presence. If the opponent has been gone for 4 s, the phone reports it and the referee pauses the match, voids the open question and starts the 20 s forfeit clock. A phone that comes back, or reloads, calls `resume` and gets a full `sync`. If it doesn't return in time, the first tick after 20 s ends the match by forfeit.
- **Rooms** expire after 30 minutes idle: the referee refuses them on access and a `pg_cron` job deletes them.
