/**
 * Version segment for the generated share cards.
 *
 * Discord, Slack and LinkedIn cache preview images by URL, frequently for
 * months. Bumping this moves every card to a fresh path, so the next scrape
 * fetches the new artwork instead of serving a stale copy from the old one.
 *
 * Bump it whenever the card design changes. Note it cannot rewrite an embed a
 * platform has already rendered: those keep their cached image until the link
 * is posted somewhere new.
 */
export const OG_VERSION = 'v2';

/** Public path of a generated share card, e.g. ogCard('htb-kobold'). */
export const ogCard = (name: string): string => `/og/${OG_VERSION}/${name}.png`;
