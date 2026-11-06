import type { RealtimeChannel } from '@supabase/supabase-js';
import type { ServerEvent } from '@shared/protocol.ts';
import type { LobbyEvent } from '@shared/rooms.ts';
import type { Side } from '@shared/types.ts';
import { ensureSession, supabase } from '../lib/supabase.ts';

type Fn<T> = (v: T) => void;

/**
 * The phone's connection to one room: a private Realtime channel `room:<CODE>` that carries
 * referee events (`server`), lobby updates (`lobby`) and presence. One per room, shared by
 * the lobby and match screens, so nothing is missed in between.
 */
export class RoomChannel {
  private channel: RealtimeChannel | null = null;
  private server = new Set<Fn<ServerEvent>>();
  private lobby = new Set<Fn<LobbyEvent>>();
  private presence = new Set<Fn<boolean>>();
  private status = new Set<(online: boolean, reconnected: boolean) => void>();
  private subscribedOnce = false;
  private closed = false;

  /** Whether the other player is currently in the channel. */
  oppPresent = false;
  /** Whether this phone is currently connected to the channel. */
  online = false;

  constructor(readonly code: string, readonly side: Side) {}

  async connect() {
    if (!supabase || this.channel) return;
    const token = await ensureSession();
    await supabase.realtime.setAuth(token);
    if (this.closed) return;

    const ch = supabase.channel(`room:${this.code}`, {
      config: { private: true, presence: { key: String(this.side) }, broadcast: { self: false } },
    });
    ch.on('broadcast', { event: 'server' }, ({ payload }) => this.server.forEach((f) => f(payload as ServerEvent)));
    ch.on('broadcast', { event: 'lobby' }, ({ payload }) => this.lobby.forEach((f) => f(payload as LobbyEvent)));
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState();
      const present = Object.keys(state).includes(String(this.side === 0 ? 1 : 0));
      if (present !== this.oppPresent) {
        this.oppPresent = present;
        this.presence.forEach((f) => f(present));
      }
    });
    ch.subscribe((s) => {
      if (s === 'SUBSCRIBED') {
        const reconnected = this.subscribedOnce;
        this.subscribedOnce = true;
        this.online = true;
        void ch.track({ side: this.side });
        this.status.forEach((f) => f(true, reconnected));
      } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') {
        if (this.online) {
          this.online = false;
          this.status.forEach((f) => f(false, false));
        }
      }
    });
    this.channel = ch;
  }

  onServer(f: Fn<ServerEvent>) {
    this.server.add(f);
    return () => void this.server.delete(f);
  }
  onLobby(f: Fn<LobbyEvent>) {
    this.lobby.add(f);
    return () => void this.lobby.delete(f);
  }
  onPresence(f: Fn<boolean>) {
    this.presence.add(f);
    return () => void this.presence.delete(f);
  }
  onStatus(f: (online: boolean, reconnected: boolean) => void) {
    this.status.add(f);
    return () => void this.status.delete(f);
  }

  close() {
    this.closed = true;
    if (this.channel && supabase) void supabase.removeChannel(this.channel);
    this.channel = null;
    this.server.clear();
    this.lobby.clear();
    this.presence.clear();
    this.status.clear();
  }
}
