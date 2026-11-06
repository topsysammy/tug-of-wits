import { useCallback, useState } from 'react';
import type { CharacterId } from '@shared/types.ts';
import { MatchScreen } from './screens/MatchScreen.tsx';
import { PracticeSetup, type PracticeConfig } from './screens/PracticeSetup.tsx';
import { LocalMatchServer } from './game/localServer.ts';
import { LOCAL_QUESTIONS } from './game/questions.local.ts';
import { CHARACTERS } from './game/characters.ts';
import { SimPanel } from './components/dev/SimPanel.tsx';
import { loadProfile, saveProfile } from './lib/profile.ts';

const SHOW_SIM = import.meta.env.DEV || new URLSearchParams(location.search).has('sim');

/** The simulated friend is Tolu unless you picked Tolu, then Topsy. */
const opponentFor = (mine: CharacterId): CharacterId => (mine === 'tolu' ? 'topsy' : 'tolu');

export default function App() {
  const [cfg, setCfg] = useState<PracticeConfig>(() => ({ ...loadProfile(), skill: 'normal' }));
  const [matchId, setMatchId] = useState<number | null>(null);

  const createTransport = useCallback(() => {
    const opp = opponentFor(cfg.character);
    return new LocalMatchServer({
      me: { nickname: cfg.nickname, character: cfg.character },
      bot: { nickname: CHARACTERS[opp].name, character: opp },
      skill: cfg.skill,
      questions: LOCAL_QUESTIONS,
    });
    // matchId is a dependency on purpose: a new id = a fresh match.
  }, [cfg, matchId]);

  if (matchId === null) {
    return (
      <PracticeSetup
        initial={cfg}
        onStart={(next) => {
          saveProfile({ nickname: next.nickname, character: next.character });
          setCfg(next);
          setMatchId(Date.now());
        }}
      />
    );
  }

  return (
    <MatchScreen
      key={matchId}
      createTransport={createTransport}
      onPlayAgain={() => setMatchId(Date.now())}
      onExit={() => setMatchId(null)}
      devTools={SHOW_SIM ? (get) => <SimPanel getServer={get} initialSkill={cfg.skill} /> : undefined}
    />
  );
}
