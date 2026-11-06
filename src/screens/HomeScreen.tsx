import { useState, type ReactNode } from 'react';
import type { CategoryId, CharacterId, Difficulty } from '@shared/types.ts';
import { STEPS_TO_WIN } from '@shared/gameConfig.ts';
import { CATEGORY_IDS, PLAYABLE_CATEGORIES, isValidRoomCode, normaliseRoomCode } from '@shared/rooms.ts';
import { Avatar } from '../components/Avatar.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Icon } from '../components/ui/Icon.tsx';
import { Segmented } from '../components/ui/Segmented.tsx';
import { CATEGORIES } from '../game/categories.ts';
import { CHARACTERS, CHARACTER_IDS } from '../game/characters.ts';
import type { BotSkill } from '../game/localServer.ts';
import { onlineAvailable } from '../lib/supabase.ts';

export interface HomeProfile {
  nickname: string;
  character: CharacterId;
}

interface Props {
  profile: HomeProfile;
  onProfile: (p: HomeProfile) => void;
  initialCode?: string;
  busy: 'create' | 'join' | null;
  error: string | null;
  onCreate: (category: CategoryId, difficulty: Difficulty) => void;
  onJoin: (code: string) => void;
  onPractice: (skill: BotSkill) => void;
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-3xl border-2 border-card-edge bg-card p-4 shadow-[0_4px_0_var(--color-card-shadow)]">
      <h2 className="m-0 font-display text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** Phase 2 home: profile, play a friend online, or practice. Phase 3 replaces it with the designed Home. */
export function HomeScreen({ profile, onProfile, initialCode = '', busy, error, onCreate, onJoin, onPractice }: Props) {
  const [category, setCategory] = useState<CategoryId>('naija-trivia');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [code, setCode] = useState(normaliseRoomCode(initialCode));
  const [skill, setSkill] = useState<BotSkill>('normal');
  const named = profile.nickname.trim().length > 0;

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col gap-4 px-5 pt-10 pb-8">
      <div className="flex flex-col gap-1">
        <h1 className="m-0 font-display text-[34px] leading-tight font-bold">Tug of Wits</h1>
        <p className="m-0 text-[15px] text-muted">Answer first to pull the rope. Drag it {STEPS_TO_WIN} steps to win.</p>
      </div>

      <Card title="You">
        <label htmlFor="nick" className="sr-only">
          Nickname
        </label>
        <input
          id="nick"
          value={profile.nickname}
          maxLength={14}
          placeholder="Your nickname"
          autoComplete="nickname"
          onChange={(e) => onProfile({ ...profile, nickname: e.target.value })}
          className="h-[52px] rounded-2xl border-2 border-card-edge bg-ground px-4 font-display text-lg font-semibold outline-none focus:border-blue"
        />
        <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Character">
          {CHARACTER_IDS.map((id) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={profile.character === id}
              aria-label={CHARACTERS[id].name}
              onClick={() => onProfile({ ...profile, character: id })}
              className={[
                'flex flex-col items-center gap-1 rounded-2xl border-[3px] p-1.5 transition-colors',
                profile.character === id ? 'border-me bg-me-tint' : 'border-transparent bg-ground',
              ].join(' ')}
            >
              <Avatar who={id} size={54} decorative />
              <span className="text-xs font-extrabold">{CHARACTERS[id].name}</span>
            </button>
          ))}
        </div>
      </Card>

      {onlineAvailable ? (
        <>
          <Card title="Join a friend">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (isValidRoomCode(code) && named) onJoin(code);
              }}
            >
              <label htmlFor="code" className="sr-only">
                Room code
              </label>
              <input
                id="code"
                value={code}
                onChange={(e) => setCode(normaliseRoomCode(e.target.value))}
                placeholder="CODE"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                inputMode="text"
                className="h-[58px] min-w-0 flex-1 rounded-[20px] border-2 border-card-edge bg-ground px-4 text-center font-display text-2xl font-bold tracking-[0.3em] uppercase outline-none focus:border-blue"
              />
              <Button type="submit" variant="blue" block={false} disabled={!isValidRoomCode(code) || !named || busy !== null}>
                {busy === 'join' ? 'Joining…' : 'Join'}
              </Button>
            </form>
          </Card>

          <Card title="Create a room">
            <Segmented
              label="Category"
              value={category}
              onChange={setCategory}
              columns={2}
              options={CATEGORY_IDS.map((id) => ({
                value: id,
                label: CATEGORIES[id].label,
                disabled: !PLAYABLE_CATEGORIES.includes(id),
                hint: PLAYABLE_CATEGORIES.includes(id) ? undefined : 'Coming soon',
              }))}
            />
            <Segmented
              label="Difficulty"
              value={difficulty}
              onChange={setDifficulty}
              options={[
                { value: 'easy', label: 'Easy' },
                { value: 'medium', label: 'Medium' },
                { value: 'hard', label: 'Hard' },
              ]}
            />
            <Button variant="yellow" disabled={!named || busy !== null} onClick={() => onCreate(category, difficulty)}>
              {busy === 'create' ? 'Creating…' : 'Create room'}
            </Button>
          </Card>
        </>
      ) : (
        <Card title="Play a friend">
          <p className="m-0 text-sm text-muted">
            Online rooms need Supabase. Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> (see the README).
          </p>
        </Card>
      )}

      {error && (
        <p role="alert" className="m-0 rounded-2xl bg-wrong/30 px-4 py-3 text-sm font-extrabold text-danger-text">
          {error}
        </p>
      )}

      <Card title="Practice on this phone">
        <Segmented
          label="Practice opponent skill"
          value={skill}
          onChange={setSkill}
          options={[
            { value: 'easy', label: 'Easy' },
            { value: 'normal', label: 'Normal' },
            { value: 'hard', label: 'Hard' },
          ]}
        />
        <Button variant="white" disabled={!named} icon={<Icon name="play" size={20} />} onClick={() => onPractice(skill)}>
          Practice match
        </Button>
      </Card>
    </div>
  );
}
