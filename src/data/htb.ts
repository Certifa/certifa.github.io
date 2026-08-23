/**
 * HackTheBox profile figures.
 *
 * These lived hand-copied across the homepage panel, the about vitals line and
 * the footer note, which is how one of them ends up quietly disagreeing with
 * the others after a rank change. Edit here and every page follows.
 *
 * Last checked against the profile: 2026-08-23.
 */
export const htb = {
  rank: 'Master',
  level: 75,
  points: 720,
  machines: 74,
  challenges: 34,
  globalRank: 468,
  /** Progress through the current level, not a lifetime total. */
  xp: { current: 1002, next: 2826 },
} as const;

/**
 * The XP bar's fill. Derived, because it was previously written as a separate
 * hardcoded 0.355 in the animation, a number that silently stops matching the
 * XP line beside it the moment either figure moves.
 */
export const xpFraction = htb.xp.current / htb.xp.next;

/** Long form, for the about vitals row. */
export const htbLine = `${htb.rank} · lvl ${htb.level} · global #${htb.globalRank}`;

/** Short form, for the footer and other tight spots. */
export const htbShort = `${htb.rank} · global #${htb.globalRank}`;
