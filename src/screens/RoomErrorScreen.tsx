import { ROOM_IDLE_MINUTES } from '@shared/gameConfig.ts';
import type { CharacterId } from '@shared/types.ts';
import { Avatar } from '../components/Avatar.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Icon } from '../components/ui/Icon.tsx';

export type RoomErrorKind = 'not_found' | 'full' | 'in_progress' | 'closed';

const COPY: Record<RoomErrorKind, { title: string; body: (code: string) => string }> = {
  not_found: {
    title: 'Room not found',
    body: (c) => `Code ${c} has expired or doesn't exist. Rooms close after ${ROOM_IDLE_MINUTES} minutes without play.`,
  },
  full: { title: 'Room is full', body: (c) => `Room ${c} already has two players.` },
  in_progress: { title: 'Match already started', body: (c) => `The match in room ${c} is already underway.` },
  closed: { title: 'Room closed', body: () => 'The host left, so the room has closed.' },
};

interface Props {
  kind: RoomErrorKind;
  code: string;
  character: CharacterId;
  onBack: () => void;
}

export function RoomErrorScreen({ kind, code, character, onBack }: Props) {
  const c = COPY[kind];
  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col gap-5 px-5 pt-10 pb-7">
      <button
        type="button"
        aria-label="Back"
        onClick={onBack}
        className="flex h-[46px] w-[46px] items-center justify-center rounded-full border-2 border-card-edge bg-card shadow-[0_4px_0_var(--color-card-shadow)]"
      >
        <Icon name="chevronLeft" size={20} strokeWidth={2.6} />
      </button>
      <div className="mt-10 flex flex-col items-center gap-4 text-center">
        <div className="relative flex h-[168px] w-[168px] items-center justify-center rounded-full border-4 border-card-edge bg-card shadow-[0_6px_0_var(--color-card-shadow)]">
          <Avatar who={character} mood="strain" size={128} decorative />
          <span className="absolute top-1 right-0 flex h-[46px] w-[46px] items-center justify-center rounded-full border-4 border-white bg-yellow font-display text-[26px] font-bold text-yellow-ink shadow-[0_3px_0_var(--color-yellow-deep)]">
            ?
          </span>
        </div>
        <h1 className="m-0 font-display text-[30px] font-bold">{c.title}</h1>
        <p className="m-0 max-w-[300px] text-base leading-relaxed font-bold text-muted">{c.body(code)}</p>
      </div>
      <div className="mt-auto">
        <Button variant="yellow" onClick={onBack}>
          Back to home
        </Button>
      </div>
    </div>
  );
}
