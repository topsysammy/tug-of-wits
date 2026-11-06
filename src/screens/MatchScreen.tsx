import { useRef, type ReactNode } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ROUND_MS } from '@shared/gameConfig.ts';
import { useMatch } from '../hooks/useMatch.ts';
import { useNow } from '../hooks/useNow.ts';
import type { MatchTransport } from '../game/transport.ts';
import { statusFor, tileLooks } from '../game/matchView.ts';
import { StatBar } from '../components/match/StatBar.tsx';
import { Arena } from '../components/match/Arena.tsx';
import { StatusLine } from '../components/match/StatusLine.tsx';
import { QuestionCard } from '../components/match/QuestionCard.tsx';
import { AnswerGrid } from '../components/match/AnswerGrid.tsx';
import { LockedPill } from '../components/match/LockedPill.tsx';
import { Countdown } from '../components/match/Countdown.tsx';
import { DisconnectOverlay } from '../components/match/DisconnectOverlay.tsx';
import { MatchEndSheet } from '../components/match/MatchEndSheet.tsx';

interface MatchScreenProps<T extends MatchTransport> {
  /** Must be stable for the life of one match; a new function starts a new match. */
  createTransport: () => T;
  onPlayAgain: () => void;
  onExit: () => void;
  /** Optional dev tools (phase 1 simulator panel). */
  devTools?: (getTransport: () => T | null) => ReactNode;
}

export function MatchScreen<T extends MatchTransport>({ createTransport, onPlayAgain, onExit, devTools }: MatchScreenProps<T>) {
  const { state: s, question, shownAt, answer, transportRef } = useMatch(createTransport);
  const ticking = s.phase === 'question' && shownAt !== null;
  const now = useNow(ticking, 100);

  // Freeze the clock where it stopped during the reveal instead of snapping to 0 or 10.
  const lastLeft = useRef(ROUND_MS);
  if (s.phase === 'question' && shownAt === null) lastLeft.current = ROUND_MS;
  if (ticking) lastLeft.current = Math.max(0, ROUND_MS - (now - shownAt));
  const msLeft = lastLeft.current;
  const timeUp = ticking && msLeft <= 0;

  const getTransport = () => transportRef.current;
  const dev = devTools?.(getTransport);

  if (!s.me || !s.opp) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted">
        Connecting…
        {dev}
      </div>
    );
  }

  if (s.phase === 'countdown' && s.countdownEndsAt) {
    return (
      <>
        <Countdown me={s.me} opp={s.opp} category={s.category} endsAt={s.countdownEndsAt} />
        {dev}
      </>
    );
  }

  const paused = s.phase === 'paused';
  const status = statusFor(s, timeUp);
  const options = paused ? null : question?.options ?? null;
  const disabled = s.phase !== 'question' || s.myChoice !== null || shownAt === null || timeUp;

  return (
    <div className="relative mx-auto flex min-h-dvh max-w-[480px] flex-col gap-3.5 overflow-hidden px-5 pt-[max(24px,env(safe-area-inset-top))] pb-6">
      <StatBar questionNumber={s.questionNumber} secondsLeft={msLeft / 1000} wins={s.wins} />
      <Arena
        me={s.me}
        opp={s.opp}
        pos={s.pos}
        pulledBy={s.reveal?.winner ?? null}
        pullSeq={s.pullSeq}
        oppFaded={!s.oppOnline}
      />
      <StatusLine {...status} timeLeft={paused ? null : msLeft / ROUND_MS} />
      <QuestionCard
        question={paused ? null : question}
        suddenDeath={s.suddenDeath}
        placeholder={paused ? 'Waiting for the next question…' : undefined}
      />
      <AnswerGrid options={options} looks={tileLooks(s, options?.length ?? 4)} disabled={disabled} onPick={answer} />
      {s.phase === 'question' && s.myVerdict === 'wrong' && <LockedPill oppName={s.opp.nickname} />}

      <AnimatePresence>
        {paused && !s.oppOnline && s.forfeitAt && (
          <DisconnectOverlay key="dc" opp={s.opp} forfeitAt={s.forfeitAt} onLeave={onExit} />
        )}
      </AnimatePresence>
      {s.phase === 'ended' && s.end && (
        <MatchEndSheet
          iWon={s.end.iWon}
          reason={s.end.reason}
          opp={s.opp}
          mySide={s.mySide}
          wins={s.wins}
          history={s.end.history}
          durationMs={s.end.durationMs}
          onPlayAgain={onPlayAgain}
          onExit={onExit}
        />
      )}
      {dev}
    </div>
  );
}
