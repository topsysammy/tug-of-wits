import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CategoryId, CharacterId, Difficulty, Side } from '@shared/types.ts';
import type { RoomSnapshot } from '@shared/rooms.ts';
import { MatchScreen } from './screens/MatchScreen.tsx';
import { HomeScreen } from './screens/HomeScreen.tsx';
import { LobbyScreen } from './screens/LobbyScreen.tsx';
import { RoomErrorScreen, type RoomErrorKind } from './screens/RoomErrorScreen.tsx';
import { LocalMatchServer, type BotSkill } from './game/localServer.ts';
import { LOCAL_QUESTIONS } from './game/questions.local.ts';
import { CHARACTERS } from './game/characters.ts';
import { SimPanel } from './components/dev/SimPanel.tsx';
import { loadProfile, saveProfile, type Profile } from './lib/profile.ts';
import { onlineAvailable } from './lib/supabase.ts';
import { api, ApiError } from './net/api.ts';
import { RoomChannel } from './net/roomChannel.ts';
import { RealtimeTransport } from './net/realtimeTransport.ts';

const SHOW_SIM = import.meta.env.DEV || new URLSearchParams(location.search).has('sim');
const ACTIVE_ROOM_KEY = 'tow.activeRoom';

interface Session {
  code: string;
  side: Side;
  channel: RoomChannel;
}

type Screen =
  | { k: 'home' }
  | { k: 'loading' }
  | { k: 'practice'; id: number; skill: BotSkill }
  | { k: 'lobby'; session: Session; room: RoomSnapshot }
  | { k: 'match'; session: Session; id: number }
  | { k: 'error'; kind: RoomErrorKind; code: string };

const opponentFor = (mine: CharacterId): CharacterId => (mine === 'tolu' ? 'topsy' : 'tolu');

const store = {
  get: () => {
    try {
      return localStorage.getItem(ACTIVE_ROOM_KEY);
    } catch {
      return null;
    }
  },
  set: (code: string | null) => {
    try {
      if (code) localStorage.setItem(ACTIVE_ROOM_KEY, code);
      else localStorage.removeItem(ACTIVE_ROOM_KEY);
    } catch {
      /* storage blocked */
    }
  },
};

function friendlyError(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  return 'Something went wrong. Try again.';
}

export default function App() {
  const [profile, setProfile] = useState<Profile>(loadProfile);
  const inviteCode = useMemo(() => new URLSearchParams(location.search).get('room') ?? '', []);
  const [screen, setScreen] = useState<Screen>(() => (onlineAvailable && store.get() ? { k: 'loading' } : { k: 'home' }));
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateProfile = (p: Profile) => {
    setProfile(p);
    if (p.nickname.trim()) saveProfile({ nickname: p.nickname.trim(), character: p.character });
  };

  const openRoom = useCallback((code: string, side: Side, room: RoomSnapshot) => {
    store.set(code);
    if (location.search) history.replaceState(null, '', location.pathname);
    const session: Session = { code, side, channel: new RoomChannel(code, side) };
    setScreen(room.status === 'playing' ? { k: 'match', session, id: Date.now() } : { k: 'lobby', session, room });
  }, []);

  const goHome = useCallback((session?: Session) => {
    session?.channel.close();
    store.set(null);
    setScreen({ k: 'home' });
  }, []);

  const fail = useCallback((e: unknown, code: string) => {
    if (e instanceof ApiError && ['not_found', 'full', 'in_progress'].includes(e.code)) {
      store.set(null);
      setScreen({ k: 'error', kind: e.code as RoomErrorKind, code });
    } else {
      setError(friendlyError(e));
    }
  }, []);

  // Reopened the app (or reloaded) while in a room: go straight back to it.
  useEffect(() => {
    if (screen.k !== 'loading') return;
    const code = store.get()!;
    api
      .getRoom(code)
      .then((r) => openRoom(r.code, r.side, r.room))
      .catch(() => {
        store.set(null);
        setScreen({ k: 'home' });
      });
  }, [screen.k, openRoom]);

  const create = async (category: CategoryId, difficulty: Difficulty) => {
    setBusy('create');
    setError(null);
    try {
      const r = await api.createRoom({ nickname: profile.nickname.trim(), character: profile.character }, category, difficulty);
      openRoom(r.code, r.side, r.room);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  const join = async (code: string) => {
    setBusy('join');
    setError(null);
    try {
      const r = await api.joinRoom(code, { nickname: profile.nickname.trim(), character: profile.character });
      openRoom(r.code, r.side, r.room);
    } catch (e) {
      fail(e, code);
    } finally {
      setBusy(null);
    }
  };

  // ── practice ──
  const practiceId = screen.k === 'practice' ? screen.id : 0;
  const practiceSkill = screen.k === 'practice' ? screen.skill : 'normal';
  const createPractice = useCallback(() => {
    const opp = opponentFor(profile.character);
    return new LocalMatchServer({
      me: { nickname: profile.nickname.trim(), character: profile.character },
      bot: { nickname: CHARACTERS[opp].name, character: opp },
      skill: practiceSkill,
      questions: LOCAL_QUESTIONS,
    });
    // A new practiceId = a fresh match.
  }, [profile, practiceSkill, practiceId]);

  // ── online match ──
  const matchSession = screen.k === 'match' ? screen.session : null;
  const matchId = screen.k === 'match' ? screen.id : 0;
  const createOnline = useCallback(
    () => new RealtimeTransport(matchSession!.channel),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [matchSession, matchId],
  );

  switch (screen.k) {
    case 'loading':
      return <div className="flex min-h-dvh items-center justify-center text-muted">Rejoining your room…</div>;

    case 'error':
      return (
        <RoomErrorScreen
          kind={screen.kind}
          code={screen.code}
          character={profile.character}
          onBack={() => setScreen({ k: 'home' })}
        />
      );

    case 'practice':
      return (
        <MatchScreen
          key={screen.id}
          createTransport={createPractice}
          onPlayAgain={() => setScreen({ k: 'practice', id: Date.now(), skill: screen.skill })}
          onExit={() => setScreen({ k: 'home' })}
          devTools={SHOW_SIM ? (get) => <SimPanel getServer={get} initialSkill={screen.skill} /> : undefined}
        />
      );

    case 'lobby': {
      const { session } = screen;
      return (
        <LobbyScreen
          key={session.code}
          channel={session.channel}
          initialRoom={screen.room}
          mySide={session.side}
          onStart={() => setScreen({ k: 'match', session, id: Date.now() })}
          onLeave={() => {
            void api.leaveRoom(session.code).catch(() => {});
            goHome(session);
          }}
          onClosed={() => {
            session.channel.close();
            store.set(null);
            setScreen({ k: 'error', kind: 'closed', code: session.code });
          }}
        />
      );
    }

    case 'match': {
      const { session } = screen;
      return (
        <MatchScreen
          key={screen.id}
          mySide={session.side}
          createTransport={createOnline}
          onExit={() => {
            // Back to the lobby: tapping Ready again starts a new match in the same room.
            api
              .getRoom(session.code)
              .then((r) => setScreen({ k: 'lobby', session, room: r.room }))
              .catch(() => goHome(session));
          }}
        />
      );
    }

    default:
      return (
        <HomeScreen
          profile={profile}
          onProfile={updateProfile}
          initialCode={inviteCode}
          busy={busy}
          error={error}
          onCreate={create}
          onJoin={join}
          onPractice={(skill) => setScreen({ k: 'practice', id: Date.now(), skill })}
        />
      );
  }
}
