import type { SyncEvent } from '@shared/protocol.ts';
import type { RoomSnapshot } from '@shared/rooms.ts';
import type { CategoryId, CharacterId, Difficulty, Side } from '@shared/types.ts';
import { ensureSession, supabase } from '../lib/supabase.ts';

/** Errors the referee can return, plus network trouble. */
export type ApiErrorCode =
  | 'not_found'
  | 'full'
  | 'in_progress'
  | 'bad_nickname'
  | 'bad_category'
  | 'no_questions'
  | 'network'
  | 'server_error'
  | string;

export class ApiError extends Error {
  constructor(public code: ApiErrorCode, message?: string) {
    super(message ?? code);
  }
}

async function call<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  if (!supabase) throw new ApiError('not_configured', 'Online play is not configured');
  await ensureSession();
  const { data, error } = await supabase.functions.invoke('referee', { body: { action, ...body } });
  if (error) {
    // FunctionsHttpError carries the JSON body in `context`.
    const ctx = (error as { context?: Response }).context;
    const payload = ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) : null;
    if (payload?.error) throw new ApiError(payload.error, payload.message);
    throw new ApiError('network', 'Network problem. Check your connection and try again.');
  }
  if (data?.error) throw new ApiError(data.error, data.message);
  return data as T;
}

export interface RoomResult {
  code: string;
  side: Side;
  room: RoomSnapshot;
}

export interface Profile {
  nickname: string;
  character: CharacterId;
}

export const api = {
  createRoom: (p: Profile, category: CategoryId, difficulty: Difficulty) =>
    call<RoomResult>('create_room', { ...p, category, difficulty }),
  joinRoom: (code: string, p: Profile) => call<RoomResult>('join_room', { code, ...p }),
  getRoom: (code: string) => call<RoomResult>('get_room', { code }),
  setReady: (code: string, ready: boolean) => call<{ ok: true; room?: RoomSnapshot }>('set_ready', { code, ready }),
  leaveRoom: (code: string) => call<{ ok: true }>('leave_room', { code }),
  answer: (code: string, round: number, choice: number, reportedMs: number) =>
    call<{ ok: true }>('answer', { code, round, choice, reportedMs }),
  tick: (code: string) => call<{ ok: true }>('tick', { code }),
  reportAbsent: (code: string) => call<{ ok: true }>('report_absent', { code }),
  resume: (code: string) => call<{ sync: SyncEvent }>('resume', { code }),
};
