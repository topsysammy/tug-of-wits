import { useEffect, useState } from 'react';
import type { RoomPlayer, RoomSnapshot } from '@shared/rooms.ts';
import type { Side } from '@shared/types.ts';
import { ROOM_IDLE_MINUTES } from '@shared/gameConfig.ts';
import { Avatar } from '../components/Avatar.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Icon } from '../components/ui/Icon.tsx';
import { CATEGORIES } from '../game/categories.ts';
import { api } from '../net/api.ts';
import type { RoomChannel } from '../net/roomChannel.ts';

interface Props {
  channel: RoomChannel;
  initialRoom: RoomSnapshot;
  mySide: Side;
  onStart: () => void;
  onLeave: () => void;
  onClosed: () => void;
}

const DIFF_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard' } as const;

export function inviteLink(code: string) {
  return `${location.origin}/?room=${code}`;
}

function PlayerRow({ p, me }: { p: RoomPlayer; me: boolean }) {
  return (
    <div className="flex items-center gap-3.5 rounded-[20px] border-2 border-card-edge bg-card px-3.5 py-3 shadow-[0_4px_0_var(--color-card-shadow)]">
      <Avatar who={p.character} size={52} decorative />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-display text-lg font-semibold">
          {p.nickname} {me && <span className="font-body text-sm font-bold text-muted">(you)</span>}
        </span>
        <span className="text-[13px] font-bold text-muted">{p.side === 0 ? 'Host' : 'Joined'}</span>
      </div>
      <span
        className={`rounded-full px-3 py-1.5 text-[13px] font-extrabold ${p.ready ? 'bg-[#DDF7E7] text-[#157A43]' : 'bg-muted-tile text-muted'}`}
      >
        {p.ready ? 'Ready' : 'Not ready'}
      </span>
    </div>
  );
}

function EmptySeat() {
  return (
    <div className="flex items-center gap-3.5 rounded-[20px] border-[3px] border-dashed border-[#E6D2A8] px-3.5 py-3">
      <div className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-muted-tile text-muted">
        <Icon name="plus" size={22} />
      </div>
      <div className="flex flex-col">
        <span className="font-display text-lg font-semibold text-muted">Waiting for your friend…</span>
        <span className="text-[13px] font-bold text-muted">Room closes after {ROOM_IDLE_MINUTES} min</span>
      </div>
    </div>
  );
}

export function LobbyScreen({ channel, initialRoom, mySide, onStart, onLeave, onClosed }: Props) {
  const [room, setRoom] = useState(initialRoom);
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const offLobby = channel.onLobby((ev) => {
      if (ev.t === 'closed') onClosed();
      else setRoom(ev.room);
    });
    const offServer = channel.onServer((ev) => {
      if (ev.t === 'match_start') onStart();
    });
    void channel.connect();
    // Catch up on anything that happened before the channel was open.
    api.getRoom(room.code).then((r) => setRoom(r.room)).catch(() => {});
    return () => {
      offLobby();
      offServer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel]);

  useEffect(() => {
    if (room.status === 'playing') onStart();
  }, [room.status, onStart]);

  const me = room.players[mySide];
  const opp = room.players[mySide === 0 ? 1 : 0];
  const full = room.players[1] !== null;
  const link = inviteLink(room.code);
  const shareText = `Pull me in Tug of Wits! Join room ${room.code}: ${link}`;

  const toggleReady = async () => {
    if (!me) return;
    setPending(true);
    setError(null);
    try {
      const res = await api.setReady(room.code, !me.ready);
      if (res.room) setRoom(res.room);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError(`Copy this link: ${link}`);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col gap-5 px-5 pt-10 pb-7">
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Leave room"
          onClick={onLeave}
          className="flex h-[46px] w-[46px] items-center justify-center rounded-full border-2 border-card-edge bg-card shadow-[0_4px_0_var(--color-card-shadow)] active:translate-y-1 active:shadow-none"
        >
          <Icon name="chevronLeft" size={20} strokeWidth={2.6} />
        </button>
        <span className="rounded-full border-2 border-card-edge bg-card px-3.5 py-2 text-sm font-extrabold">
          {CATEGORIES[room.category].label} · {DIFF_LABEL[room.difficulty]}
        </span>
      </div>

      <section className="flex flex-col items-center gap-4 rounded-[26px] border-2 border-card-edge bg-card px-4 py-5 shadow-[0_4px_0_var(--color-card-shadow)]">
        <div className="flex flex-col items-center gap-0.5">
          <h1 className="m-0 font-display text-2xl font-bold">Room code</h1>
          <span className="text-sm font-bold text-muted">Send it to your friend</span>
        </div>
        <div className="grid w-full grid-cols-5 gap-2 rounded-[20px] bg-[#E3F1FC] p-2.5" aria-label={`Room code ${room.code.split('').join(' ')}`}>
          {room.code.split('').map((ch, i) => (
            <span
              key={i}
              aria-hidden="true"
              className={[
                'flex h-[62px] items-center justify-center rounded-[14px] font-display text-[32px] font-bold',
                i === 2
                  ? 'bg-yellow text-yellow-ink shadow-[0_4px_0_var(--color-yellow-deep)]'
                  : 'bg-blue text-white shadow-[0_4px_0_var(--color-blue-deep)]',
              ].join(' ')}
            >
              {ch}
            </span>
          ))}
        </div>
        <div className="flex w-full gap-2.5">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-2xl bg-whatsapp font-display text-[17px] font-semibold text-whatsapp-ink shadow-[0_4px_0_var(--color-whatsapp-deep)] active:translate-y-1 active:shadow-none"
          >
            <Icon name="share" size={18} />
            WhatsApp
          </a>
          <button
            type="button"
            onClick={copy}
            className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-card-shadow bg-cream font-display text-[17px] font-semibold shadow-[0_4px_0_var(--color-card-shadow)] active:translate-y-1 active:shadow-none"
          >
            <Icon name={copied ? 'check' : 'copy'} size={18} />
            {copied ? 'Copied!' : 'Copy link'}
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="m-0 pl-1 font-display text-xl font-semibold">Players · {full ? 2 : 1} of 2</h2>
        {me && <PlayerRow p={me} me />}
        {opp ? <PlayerRow p={opp} me={false} /> : <EmptySeat />}
      </section>

      <div className="mt-auto flex flex-col gap-3">
        {error && (
          <p role="alert" className="m-0 text-center text-sm font-extrabold text-danger-text">
            {error}
          </p>
        )}
        {full ? (
          <>
            <p className="m-0 text-center text-sm font-bold text-muted" aria-live="polite">
              {me?.ready && !opp?.ready
                ? `Waiting for ${opp?.nickname} to tap Ready…`
                : "The match starts when you're both ready"}
            </p>
            <Button variant={me?.ready ? 'white' : 'yellow'} onClick={toggleReady} disabled={pending}>
              {me?.ready ? 'Not ready yet' : "I'm ready"}
            </Button>
          </>
        ) : (
          <button
            type="button"
            disabled
            className="h-[58px] rounded-[20px] bg-[#EFE4CC] font-display text-xl font-semibold text-muted"
          >
            Waiting for player 2
          </button>
        )}
      </div>
    </div>
  );
}
