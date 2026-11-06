import { useState } from 'react';
import type { CharacterId } from '@shared/types.ts';
import { STEPS_TO_WIN } from '@shared/gameConfig.ts';
import { Avatar } from '../components/Avatar.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Icon } from '../components/ui/Icon.tsx';
import { CHARACTERS, CHARACTER_IDS } from '../game/characters.ts';
import type { BotSkill } from '../game/localServer.ts';

export interface PracticeConfig {
  nickname: string;
  character: CharacterId;
  skill: BotSkill;
}

interface Props {
  initial: PracticeConfig;
  onStart: (cfg: PracticeConfig) => void;
}

/** Phase 1 launcher: pick a character and start a local match. Replaced by Home in phase 3. */
export function PracticeSetup({ initial, onStart }: Props) {
  const [nickname, setNickname] = useState(initial.nickname);
  const [character, setCharacter] = useState<CharacterId>(initial.character);
  const [skill, setSkill] = useState<BotSkill>(initial.skill);
  const name = nickname.trim();

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col gap-5 px-5 pt-12 pb-7">
      <div className="flex flex-col gap-1">
        <h1 className="m-0 font-display text-[34px] leading-tight font-bold">Tug of Wits</h1>
        <p className="m-0 text-[15px] text-muted">
          Answer first to pull the rope. First to drag it {STEPS_TO_WIN} steps wins.
        </p>
      </div>

      <section className="flex flex-col gap-3 rounded-3xl border-2 border-card-edge bg-card p-4 shadow-[0_4px_0_var(--color-card-shadow)]">
        <label htmlFor="nick" className="font-display text-lg font-semibold">
          Your nickname
        </label>
        <input
          id="nick"
          value={nickname}
          maxLength={14}
          autoComplete="nickname"
          onChange={(e) => setNickname(e.target.value)}
          className="h-[52px] rounded-2xl border-2 border-card-edge bg-ground px-4 font-display text-lg font-semibold outline-none focus:border-blue"
        />
        <span className="font-display text-lg font-semibold">Pick your puller</span>
        <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Character">
          {CHARACTER_IDS.map((id) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={character === id}
              aria-label={CHARACTERS[id].name}
              onClick={() => setCharacter(id)}
              className={[
                'flex flex-col items-center gap-1 rounded-2xl border-[3px] p-1.5 transition-colors',
                character === id ? 'border-me bg-me-tint' : 'border-transparent bg-ground',
              ].join(' ')}
            >
              <Avatar who={id} size={58} decorative />
              <span className="text-xs font-extrabold">{CHARACTERS[id].name}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-3xl border-2 border-card-edge bg-card p-4 shadow-[0_4px_0_var(--color-card-shadow)]">
        <span className="font-display text-lg font-semibold">Practice opponent</span>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Opponent skill">
          {(['easy', 'normal', 'hard'] as BotSkill[]).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={skill === k}
              onClick={() => setSkill(k)}
              className={[
                'h-12 rounded-2xl font-display text-base font-semibold capitalize transition-colors',
                skill === k ? 'bg-blue text-white shadow-[0_4px_0_var(--color-blue-deep)]' : 'bg-ground text-ink',
              ].join(' ')}
            >
              {k}
            </button>
          ))}
        </div>
        <p className="m-0 text-sm text-muted">
          Phase 1 build: you play a simulated friend on this device. Online rooms come next.
        </p>
      </section>

      <div className="mt-auto">
        <Button
          variant="yellow"
          disabled={!name}
          icon={<Icon name="play" size={20} />}
          onClick={() => onStart({ nickname: name, character, skill })}
        >
          Start practice match
        </Button>
      </div>
    </div>
  );
}
