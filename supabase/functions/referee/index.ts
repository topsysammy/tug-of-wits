/**
 * Tug of Wits referee — Supabase Edge Function.
 *
 * One endpoint, `{ action, ... }` in the body. Rooms and the full match state live in Postgres;
 * every action locks the room row, runs the shared engine, saves, and broadcasts the resulting
 * events on the room's private Realtime channel (`room:<CODE>`). Only this function can
 * broadcast there, so phones can't fake referee events.
 *
 * Timers: an Edge Function can't sit on a 10 s timer between requests, so each step reports when
 * it next needs a tick. We schedule that with EdgeRuntime.waitUntil, and phones also send a
 * `tick` if they've been waiting too long — whichever arrives first does the work (ticks are
 * idempotent under the row lock).
 */
import postgres from 'postgres';
import {
  answer,
  createServerMatch,
  reportAbsent,
  resume,
  syncFor,
  tick,
  usedQuestionIds,
  type ServerMatch,
  type Step,
} from '../_shared/engine.ts';
import { ROOM_IDLE_MINUTES } from '../_shared/gameConfig.ts';
import type { ServerEvent } from '../_shared/protocol.ts';
import {
  CATEGORY_IDS,
  CHARACTER_IDS,
  DIFFICULTIES,
  PLAYABLE_CATEGORIES,
  cleanNickname,
  generateRoomCode,
  isValidRoomCode,
  normaliseRoomCode,
  type LobbyEvent,
  type RoomSnapshot,
} from '../_shared/rooms.ts';
import type { CategoryId, CharacterId, Difficulty, PlayerInfo, SecretQuestion, Side } from '../_shared/types.ts';

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false, max: 4, idle_timeout: 20 });

type Tx = postgres.TransactionSql;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

class AppError extends Error {
  constructor(public code: string, message = code, public status = 200) {
    super(message);
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// ───────────────────────────── auth ─────────────────────────────

/** The gateway has already verified the JWT (verify_jwt = true); we only read who it is. */
function userIdFrom(req: Request): string {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw new AppError('unauthorized', 'Missing token', 401);
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(part.padEnd(part.length + ((4 - (part.length % 4)) % 4), '=')));
    if (claims.role !== 'authenticated' || typeof claims.sub !== 'string') throw new Error('not a user token');
    return claims.sub;
  } catch {
    throw new AppError('unauthorized', 'Sign in (anonymously) first', 401);
  }
}

// ───────────────────────────── realtime ─────────────────────────────

type Outgoing = { event: 'server'; payload: ServerEvent } | { event: 'lobby'; payload: LobbyEvent };

async function broadcast(code: string, messages: Outgoing[]) {
  if (!messages.length) return;
  const res = await fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: messages.map((m) => ({ topic: `room:${code}`, event: m.event, payload: m.payload, private: true })),
    }),
  });
  if (!res.ok) console.error('broadcast failed', res.status, await res.text());
}

const serverMsgs = (events: ServerEvent[]): Outgoing[] => events.map((payload) => ({ event: 'server', payload }));

// ───────────────────────────── rooms ─────────────────────────────

interface RoomRow {
  code: string;
  host_id: string;
  guest_id: string | null;
  host_name: string;
  host_character: CharacterId;
  guest_name: string | null;
  guest_character: CharacterId | null;
  host_ready: boolean;
  guest_ready: boolean;
  category: CategoryId;
  difficulty: Difficulty;
  status: 'lobby' | 'playing' | 'finished';
  match_id: string | null;
  used_question_ids: string[];
}

function snapshot(r: RoomRow): RoomSnapshot {
  return {
    code: r.code,
    category: r.category,
    difficulty: r.difficulty,
    status: r.status,
    players: [
      { side: 0, nickname: r.host_name, character: r.host_character, ready: r.host_ready },
      r.guest_id
        ? { side: 1, nickname: r.guest_name!, character: r.guest_character!, ready: r.guest_ready }
        : null,
    ],
  };
}

function sideOf(r: RoomRow, uid: string): Side | null {
  if (r.host_id === uid) return 0;
  if (r.guest_id === uid) return 1;
  return null;
}

/** Lock a live room row; expired rooms are deleted and reported as not found. */
async function lockRoom(tx: Tx, rawCode: unknown): Promise<RoomRow> {
  const code = normaliseRoomCode(String(rawCode ?? ''));
  if (!isValidRoomCode(code)) throw new AppError('not_found');
  const [row] = await tx<RoomRow[]>`select * from public.rooms where code = ${code} for update`;
  if (!row) throw new AppError('not_found');
  const [{ expired }] = await tx<{ expired: boolean }[]>`
    select (last_activity < now() - make_interval(mins => ${ROOM_IDLE_MINUTES})) as expired
    from public.rooms where code = ${code}`;
  if (expired) {
    await tx`delete from public.rooms where code = ${code}`;
    throw new AppError('not_found');
  }
  return row;
}

const touch = (tx: Tx, code: string) => tx`update public.rooms set last_activity = now() where code = ${code}`;

function readProfile(body: Record<string, unknown>) {
  const nickname = cleanNickname(body.nickname);
  const character = body.character as CharacterId;
  if (!nickname) throw new AppError('bad_nickname', 'Pick a nickname');
  if (!CHARACTER_IDS.includes(character)) throw new AppError('bad_character');
  return { nickname, character };
}

async function loadPool(tx: Tx, category: CategoryId, difficulty: Difficulty, used: string[]): Promise<SecretQuestion[]> {
  if (category === 'quick-maths') return [];
  const rows = await tx<
    { id: string; text: string; options: string[]; correct_index: number; difficulty: Difficulty; image_url: string | null }[]
  >`select id, text, options, correct_index, difficulty, image_url
    from public.questions where active and category = ${category}
    order by random() limit 300`;
  const all: SecretQuestion[] = rows.map((r) => ({
    id: r.id,
    text: r.text,
    options: r.options,
    correctIndex: r.correct_index,
    category,
    difficulty: r.difficulty,
    ...(r.image_url ? { image: r.image_url } : {}),
  }));
  const usedSet = new Set(used);
  const fresh = all.filter((q) => !usedSet.has(q.id));
  const preferred = fresh.filter((q) => q.difficulty === difficulty);
  // Prefer the chosen difficulty, then anything unseen this session, then repeats.
  if (preferred.length >= 15) return preferred;
  if (fresh.length >= 10) return fresh;
  return all;
}

// ───────────────────────────── match plumbing ─────────────────────────────

interface MatchCtx {
  tx: Tx;
  room: RoomRow;
  state: ServerMatch;
}

/**
 * Lock the room, load its match, run `fn`, persist the step, broadcast (still under the lock,
 * so events from concurrent requests can't arrive out of order), then schedule the wake-up.
 */
async function withMatch<T>(
  rawCode: unknown,
  uid: string | null,
  fn: (ctx: MatchCtx, side: Side | null) => { step: Step; result?: T },
): Promise<T | undefined> {
  let wake: { code: string; at: number } | null = null;
  const out = await sql.begin(async (tx) => {
    const room = await lockRoom(tx, rawCode);
    const side = uid === null ? null : sideOf(room, uid);
    if (uid !== null && side === null) throw new AppError('not_found');
    if (!room.match_id) throw new AppError('no_match');
    const [m] = await tx<{ state: ServerMatch; status: string }[]>`
      select state, status from public.matches where id = ${room.match_id}`;
    if (!m) throw new AppError('no_match');

    const { step, result } = fn({ tx, room, state: m.state }, side);
    const s = step.state;
    await tx`update public.matches set state = ${tx.json(s as unknown as postgres.JSONValue)} where id = ${room.match_id}`;

    const lobby: Outgoing[] = [];
    if (s.phase === 'ended' && m.status !== 'finished') {
      const fin = s.match.finish!;
      await tx`update public.matches set status = 'finished', winner_side = ${fin.winner}, end_reason = ${fin.reason},
               history = ${tx.json(s.match.history as unknown as postgres.JSONValue)}, ended_at = now()
               where id = ${room.match_id}`;
      const used = [...new Set([...room.used_question_ids, ...usedQuestionIds(s)])];
      const [updated] = await tx<RoomRow[]>`
        update public.rooms set status = 'finished', host_ready = false, guest_ready = false,
               used_question_ids = ${used}, last_activity = now()
        where code = ${room.code} returning *`;
      lobby.push({ event: 'lobby', payload: { t: 'room', room: snapshot(updated) } });
    } else if (uid !== null) {
      await touch(tx, room.code);
    }

    await broadcast(room.code, [...serverMsgs(step.events), ...lobby]);
    if (step.wakeAt !== null) wake = { code: room.code, at: step.wakeAt };
    return result;
  });
  if (wake) scheduleTick(wake);
  return out as T | undefined;
}

/** Background tick at `at`. Ticks are idempotent, so duplicates are harmless. */
function scheduleTick({ code, at }: { code: string; at: number }) {
  const delay = at - Date.now();
  if (delay > 30_000 || typeof EdgeRuntime === 'undefined') return; // phones' watchdog ticks cover the rest
  EdgeRuntime.waitUntil(
    new Promise((r) => setTimeout(r, Math.max(0, delay) + 20))
      .then(() => withMatch(code, null, ({ state }) => ({ step: tick(state, Date.now()) })))
      .catch((e) => console.error('scheduled tick failed', e)),
  );
}

// ───────────────────────────── actions ─────────────────────────────

type Body = Record<string, unknown>;

async function createRoom(uid: string, body: Body) {
  const { nickname, character } = readProfile(body);
  const category = body.category as CategoryId;
  const difficulty = body.difficulty as Difficulty;
  if (!CATEGORY_IDS.includes(category) || !PLAYABLE_CATEGORIES.includes(category)) {
    throw new AppError('bad_category', 'That category is coming soon');
  }
  if (!DIFFICULTIES.includes(difficulty)) throw new AppError('bad_difficulty');

  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateRoomCode();
    // Reuse a code only if its room has expired.
    await sql`delete from public.rooms where code = ${code}
              and last_activity < now() - make_interval(mins => ${ROOM_IDLE_MINUTES})`;
    const rows = await sql<RoomRow[]>`
      insert into public.rooms (code, host_id, host_name, host_character, category, difficulty)
      values (${code}, ${uid}, ${nickname}, ${character}, ${category}, ${difficulty})
      on conflict (code) do nothing returning *`;
    if (rows[0]) return { code, side: 0 as Side, room: snapshot(rows[0]) };
  }
  throw new AppError('busy', 'Could not make a room code, try again');
}

async function joinRoom(uid: string, body: Body) {
  const { nickname, character } = readProfile(body);
  let room!: RoomRow;
  let side!: Side;
  await sql.begin(async (tx) => {
    const r = await lockRoom(tx, body.code);
    const current = sideOf(r, uid);
    if (current === 0) {
      [room] = await tx<RoomRow[]>`update public.rooms set last_activity = now()
        ${r.status === 'lobby' ? tx`, host_name = ${nickname}, host_character = ${character}` : tx``}
        where code = ${r.code} returning *`;
      side = 0;
    } else if (current === 1 || (r.guest_id === null && r.status === 'lobby')) {
      [room] = await tx<RoomRow[]>`update public.rooms set guest_id = ${uid}, last_activity = now()
        ${r.status === 'lobby' ? tx`, guest_name = ${nickname}, guest_character = ${character}` : tx``}
        where code = ${r.code} returning *`;
      side = 1;
    } else if (r.status !== 'lobby') {
      throw new AppError('in_progress', 'That match has already started');
    } else {
      throw new AppError('full', 'That room already has two players');
    }
    await broadcast(room.code, [{ event: 'lobby', payload: { t: 'room', room: snapshot(room) } }]);
  });
  return { code: room.code, side, room: snapshot(room) };
}

async function getRoom(uid: string, body: Body) {
  return sql.begin(async (tx) => {
    const r = await lockRoom(tx, body.code);
    const side = sideOf(r, uid);
    if (side === null) throw new AppError('not_found');
    return { code: r.code, side, room: snapshot(r) };
  });
}

async function setReady(uid: string, body: Body) {
  const ready = body.ready === true;
  let wake: { code: string; at: number } | null = null;
  const res = await sql.begin(async (tx) => {
    const r = await lockRoom(tx, body.code);
    const side = sideOf(r, uid);
    if (side === null) throw new AppError('not_found');
    if (r.status === 'playing') return { ok: true };

    const col = side === 0 ? tx`host_ready` : tx`guest_ready`;
    let [room] = await tx<RoomRow[]>`update public.rooms set ${col} = ${ready}, last_activity = now()
      ${r.status === 'finished' ? tx`, status = 'lobby'` : tx``}
      where code = ${r.code} returning *`;

    const out: Outgoing[] = [];
    if (room.host_ready && room.guest_ready && room.guest_id) {
      // Both ready: start the match.
      const pool = await loadPool(tx, room.category, room.difficulty, room.used_question_ids);
      if (room.category !== 'quick-maths' && pool.length < 4) throw new AppError('no_questions', 'No questions in this category yet');
      const players: [PlayerInfo, PlayerInfo] = [
        { side: 0, nickname: room.host_name, character: room.host_character },
        { side: 1, nickname: room.guest_name!, character: room.guest_character! },
      ];
      const step = createServerMatch({ players, category: room.category, difficulty: room.difficulty, pool, now: Date.now() });
      const [m] = await tx<{ id: string }[]>`
        insert into public.matches (room_code, state) values (${room.code}, ${tx.json(step.state as unknown as postgres.JSONValue)})
        returning id`;
      [room] = await tx<RoomRow[]>`update public.rooms set status = 'playing', match_id = ${m.id},
        host_ready = false, guest_ready = false where code = ${room.code} returning *`;
      out.push({ event: 'lobby', payload: { t: 'room', room: snapshot(room) } }, ...serverMsgs(step.events));
      if (step.wakeAt !== null) wake = { code: room.code, at: step.wakeAt };
    } else {
      out.push({ event: 'lobby', payload: { t: 'room', room: snapshot(room) } });
    }
    await broadcast(room.code, out);
    return { ok: true, room: snapshot(room) };
  });
  if (wake) scheduleTick(wake);
  return res;
}

async function leaveRoom(uid: string, body: Body) {
  await sql.begin(async (tx) => {
    const r = await lockRoom(tx, body.code);
    const side = sideOf(r, uid);
    if (side === null || r.status === 'playing') return;
    if (side === 0) {
      await tx`delete from public.rooms where code = ${r.code}`;
      await broadcast(r.code, [{ event: 'lobby', payload: { t: 'closed' } }]);
    } else {
      const [room] = await tx<RoomRow[]>`update public.rooms set guest_id = null, guest_name = null,
        guest_character = null, guest_ready = false, host_ready = false, status = 'lobby', last_activity = now()
        where code = ${r.code} returning *`;
      await broadcast(r.code, [{ event: 'lobby', payload: { t: 'room', room: snapshot(room) } }]);
    }
  }).catch((e) => {
    if (!(e instanceof AppError && e.code === 'not_found')) throw e;
  });
  return { ok: true };
}

// ───────────────────────────── server ─────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const uid = userIdFrom(req);
    const body = (await req.json().catch(() => ({}))) as Body;
    const now = () => Date.now();

    switch (body.action) {
      case 'create_room':
        return json(await createRoom(uid, body));
      case 'join_room':
        return json(await joinRoom(uid, body));
      case 'get_room':
        return json(await getRoom(uid, body));
      case 'set_ready':
        return json(await setReady(uid, body));
      case 'leave_room':
        return json(await leaveRoom(uid, body));

      case 'answer': {
        const round = Number(body.round), choice = Number(body.choice), ms = Number(body.reportedMs);
        await withMatch(body.code, uid, ({ state }, side) => ({ step: answer(state, side!, round, choice, ms, now()) }));
        return json({ ok: true });
      }
      case 'tick':
        await withMatch(body.code, uid, ({ state }) => ({ step: tick(state, now()) }));
        return json({ ok: true });
      case 'report_absent':
        await withMatch(body.code, uid, ({ state }, side) => {
          const t = tick(state, now());
          const a = reportAbsent(t.state, side!, now());
          return { step: { ...a, events: [...t.events, ...a.events] } };
        });
        return json({ ok: true });
      case 'resume': {
        // Coming back (or opening the match screen): settle anything due, un-pause if we were
        // the missing player, and hand back a full sync so the phone can render.
        const sync = await withMatch(body.code, uid, ({ state }, side) => {
          const t = tick(state, now());
          const r = resume(t.state, side!, now());
          const step = { ...r, events: [...t.events, ...r.events] };
          return { step, result: syncFor(step.state, side!, now()) };
        });
        return json({ sync });
      }
      default:
        return json({ error: 'bad_action' }, 400);
    }
  } catch (e) {
    if (e instanceof AppError) return json({ error: e.code, message: e.message }, e.status);
    console.error(e);
    return json({ error: 'server_error', message: 'Something went wrong' }, 500);
  }
});
