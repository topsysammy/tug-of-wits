# Tug of Wits

A two-player, real-time quiz tug-of-war PWA. Both players get the same question, and the first correct answer pulls the rope one step. Drag the rope 5 steps to your side and you win. The rules, flows and fairness model are in [tug-of-wits-prd.md](tug-of-wits-prd.md).

## Status

| Phase | Scope | State |
| --- | --- | --- |
| 1 | Local match against a simulated opponent, every match state, rope and character animation | **Done** |
| 2 | Supabase rooms, lobby, realtime, server referee, reconnect/forfeit | Next |
| 3 | Home, create/join, results, rematch, settings, how to play, errors | — |
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
supabase/functions/_shared/   ← shared by the browser and (phase 2) the Edge Function
  gameConfig.ts               ← ALL game rules: STEPS_TO_WIN, ROUND_SECONDS, REVEAL_MS, MAX_QUESTIONS, GRACE_MS…
  referee.ts                  ← pure round + match judging (clock passed in, no I/O)
  protocol.ts                 ← server ⇄ phone message shapes
  types.ts
src/
  game/localServer.ts         ← phase 1 stand-in for the server: runs the referee + simulated opponent
  game/transport.ts           ← the interface the UI talks to (local now, Supabase Realtime in phase 2)
  hooks/useMatch.ts           ← client match state; measures answer time from question paint → tap
  components/Avatar.tsx       ← <Avatar who pose mood size flip /> for the 4 characters
  components/match/*          ← StatBar, Arena (rope), StatusLine, QuestionCard, AnswerGrid, overlays
  screens/                    ← MatchScreen, PracticeSetup (phase 1 launcher)
tests/referee.test.ts
```

The `@shared/*` import alias points at `supabase/functions/_shared`. Files there import each other with explicit `.ts` extensions so Deno can run them unchanged.

### How fairness works (already built into the referee)

- The phone gets questions without the answer (`PublicQuestion`). Only the referee holds `correctIndex` until the reveal.
- The phone times the answer from the frame the question was painted to the tap (which fires on press, not release) and sends that time.
- After the first correct answer arrives, the referee waits `GRACE_MS` (300 ms) and gives the round to the shortest valid reported time.
- It rejects times under `MIN_ANSWER_MS` (250 ms), answers after the round closes, second answers (the lockout), and times far below what the server itself measured (`MAX_LATENCY_CREDIT_MS`).
- Questions are preloaded `PRELOAD_AHEAD` (2) rounds ahead.
- If a player disconnects mid-round, that round is voided and a fresh question is asked on resume, so the connected player can't use the pause to think.

## Supabase setup (phase 2)

You'll need these in `.env.local` once phase 2 lands:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
```

The Edge Function will also use `SUPABASE_SERVICE_ROLE_KEY`, which Supabase injects automatically. Phase 2 will add the full steps for migrations, seeding, the CSV import and deploying the function.
