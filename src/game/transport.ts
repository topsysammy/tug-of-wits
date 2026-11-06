import type { ClientMessage, ServerEvent } from '@shared/protocol.ts';
import type { Side } from '@shared/types.ts';

/**
 * How the match screen talks to "the server". Phase 1: LocalMatchServer (in-browser referee +
 * simulated opponent). Phase 2: a Supabase Realtime channel. The UI only ever sees this.
 */
export interface MatchTransport {
  readonly mySide: Side;
  subscribe(listener: (ev: ServerEvent) => void): () => void;
  send(msg: ClientMessage): void;
  start(): void;
  dispose(): void;
}
