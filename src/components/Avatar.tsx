import { memo } from 'react';
import type { CharacterId } from '@shared/types.ts';
import { CHARACTERS, type CharacterLook } from '../game/characters.ts';

export type AvatarPose = 'face' | 'pull';
export type AvatarMood = 'happy' | 'strain';

interface AvatarProps {
  who: CharacterId;
  pose?: AvatarPose;
  mood?: AvatarMood;
  /** Width in px. The pull pose is 110/90 as tall. */
  size?: number;
  /** Mirror horizontally (the opponent faces left). */
  flip?: boolean;
  className?: string;
  /** Set when the avatar sits next to a visible name, so screen readers don't hear it twice. */
  decorative?: boolean;
}

const INK = '#22150A';

function Hair({ c }: { c: CharacterLook }) {
  return (
    <>
      {c.puffA[2] > 0 && <circle cx={c.puffA[0]} cy={c.puffA[1]} r={c.puffA[2]} fill={c.hair} />}
      {c.puffB[2] > 0 && <circle cx={c.puffB[0]} cy={c.puffB[1]} r={c.puffB[2]} fill={c.hair} />}
      <path d={c.hairD} fill={c.hair} />
      {c.brimD && <path d={c.brimD} fill={c.hair} />}
      {c.bandD && c.band !== 'none' && (
        <path d={c.bandD} fill="none" stroke={c.band} strokeWidth={3} strokeLinecap="round" />
      )}
    </>
  );
}

function Face({ c, strain }: { c: CharacterLook; strain: boolean }) {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
      <circle cx="50" cy="50" r="50" fill={c.tint} />
      <path d="M22.9 92 Q26 70 50 70 Q74 70 77.1 92 A50 50 0 0 1 22.9 92Z" fill={c.shirt} />
      <rect x="44" y="60" width="12" height="14" rx="4" fill={c.skin} />
      <circle cx="26" cy="48" r="5" fill={c.skin} />
      <circle cx="74" cy="48" r="5" fill={c.skin} />
      <circle cx="50" cy="46" r="24" fill={c.skin} />
      <Hair c={c} />
      <ellipse cx="36" cy="55" rx="4.5" ry="2.6" fill="#FF6B6B" fillOpacity={0.35} />
      <ellipse cx="64" cy="55" rx="4.5" ry="2.6" fill="#FF6B6B" fillOpacity={0.35} />
      <circle cx="41" cy="48" r="3.4" fill={INK} />
      <circle cx="59" cy="48" r="3.4" fill={INK} />
      <circle cx="42.2" cy="46.8" r="1.1" fill="#FFFFFF" />
      <circle cx="60.2" cy="46.8" r="1.1" fill="#FFFFFF" />
      {strain && (
        <path d="M36 40 L45 43 M64 40 L55 43" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
      )}
      {strain ? (
        <path d="M42 58 L58 58 L58 61 L42 61Z" fill="#FFFFFF" stroke={INK} strokeWidth={2.6} strokeLinejoin="round" />
      ) : (
        <path d="M41 56 Q50 65 59 56" fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round" />
      )}
    </svg>
  );
}

function Pull({ c, strain }: { c: CharacterLook; strain: boolean }) {
  return (
    <svg viewBox="0 0 90 110" width="100%" height="100%" aria-hidden="true" overflow="visible">
      <ellipse cx="40" cy="106" rx="28" ry="4" fill="#3B2A12" fillOpacity={0.14} />
      {/* braced legs */}
      <line x1="36" y1="72" x2="20" y2="102" stroke="#2B3A55" strokeWidth={10} strokeLinecap="round" />
      <line x1="42" y1="72" x2="58" y2="100" stroke="#33466A" strokeWidth={10} strokeLinecap="round" />
      <ellipse cx="17" cy="104" rx="8" ry="4.5" fill="#FFFFFF" stroke="#3B2A12" strokeWidth={1.5} />
      <ellipse cx="62" cy="102" rx="8" ry="4.5" fill="#FFFFFF" stroke="#3B2A12" strokeWidth={1.5} />
      {/* body leaning back, arm out to the rope */}
      <line x1="33" y1="44" x2="40" y2="72" stroke={c.shirt} strokeWidth={24} strokeLinecap="round" />
      <line x1="38" y1="49" x2="78" y2="60" stroke={c.shirt} strokeWidth={9} strokeLinecap="round" />
      <circle cx="81" cy="60" r="5.5" fill={c.skin} />
      <rect x="26" y="34" width="8" height="10" rx="3" fill={c.skin} />
      {/* head, side view, one eye */}
      <g transform="translate(28 26) scale(0.625) translate(-50 -46)">
        <circle cx="26" cy="48" r="5" fill={c.skin} />
        <circle cx="50" cy="46" r="24" fill={c.skin} />
        <Hair c={c} />
        <ellipse cx="66" cy="56" rx="4.5" ry="2.6" fill="#FF6B6B" fillOpacity={0.4} />
        <circle cx="62" cy="46" r="3.6" fill={INK} />
        <circle cx="63.3" cy="44.8" r="1.2" fill="#FFFFFF" />
        <path
          d={strain ? 'M56 38 L67 42' : 'M57 39 L67 39'}
          fill="none"
          stroke={INK}
          strokeWidth={3}
          strokeLinecap="round"
        />
        {strain ? (
          <path d="M57 56 L69 56 L69 59.5 L57 59.5Z" fill="#FFFFFF" stroke={INK} strokeWidth={2.6} strokeLinejoin="round" />
        ) : (
          <path d="M57 57 Q63 62 69 56" fill="none" stroke={INK} strokeWidth={3.4} strokeLinecap="round" />
        )}
      </g>
      {strain && <path d="M12 14 Q9 19 12 21 Q15 19 12 14Z" fill="#6CC2FF" />}
    </svg>
  );
}

export const Avatar = memo(function Avatar({
  who,
  pose = 'face',
  mood = 'happy',
  size = 120,
  flip = false,
  className,
  decorative = false,
}: AvatarProps) {
  const c = CHARACTERS[who] ?? CHARACTERS.topsy;
  const strain = mood === 'strain';
  const height = pose === 'pull' ? Math.round((size * 110) / 90) : size;
  const label = c.name + (pose === 'pull' ? (strain ? ' straining on the rope' : ' pulling the rope') : '');

  return (
    <div
      className={className}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
      style={{ width: size, height, flexShrink: 0, transform: flip ? 'scaleX(-1)' : undefined }}
    >
      {pose === 'pull' ? <Pull c={c} strain={strain} /> : <Face c={c} strain={strain} />}
    </div>
  );
});
