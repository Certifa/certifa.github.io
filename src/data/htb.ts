/**
 * HackTheBox profile figures.
 *
 * Kept by hand, deliberately. The v4 /user/profile/basic endpoint does not
 * carry most of what this panel shows: it returns the ladder badge
 * ("Pro Hacker") and a points figure of its own, while the profile page shows
 * an HTB Rank ("Master"), a level, and level XP. Those are different concepts
 * with the same names, so syncing from that endpoint would quietly overwrite
 * correct values with unrelated ones. It did exactly that once.
 *
 * Only two fields are safe to sync from it, and scripts/update-htb.mjs now
 * touches only those: globalRank from `ranking`, and machines from
 * `system_owns`, both of which match the profile page.
 *
 * Last checked against the profile page: 2026-08-23.
 */
export const htb = {
  /** HTB Rank as shown on the profile, not the Pro Hacker ladder badge. */
  rank: 'Master',
  level: 75,
  points: 720,
  machines: 77,
  challenges: 34,
  globalRank: 412,
  /** Progress through the current level, not a lifetime total. */
  xp: { current: 1902, next: 2826 },
} as const;

/** The XP bar's fill, derived so it cannot drift from the line beside it. */
export const xpFraction = htb.xp.current / htb.xp.next;

/** Long form, for the about vitals row. */
export const htbLine = `${htb.rank} · lvl ${htb.level} · global #${htb.globalRank}`;

/** Short form, for the footer and other tight spots. */
export const htbShort = `${htb.rank} · global #${htb.globalRank}`;
