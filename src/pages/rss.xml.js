import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

/**
 * The writeups feed, restored. It was live from 2026-07-10 to 2026-08-09 and
 * removed with the tag pages, which left anyone subscribed receiving nothing.
 * The URL and item shape are unchanged from that version, so an existing
 * subscription resumes rather than re-delivering every entry as new.
 *
 * Locked writeups are excluded. A machine still active on HackTheBox must not
 * be published, and a feed is the one surface that would push it out to
 * subscribers rather than waiting to be visited.
 */
export async function GET(context) {
  const writeups = (await getCollection('writeups'))
    .filter((w) => !w.body.includes('wu-locked'))
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

  return rss({
    title: 'Certifa · Writeups',
    description: 'HackTheBox writeups across Active Directory, Linux, and web.',
    site: context.site,
    items: writeups.map((w) => ({
      title: w.data.title,
      description: w.data.description,
      pubDate: w.data.date,
      link: `/writeups/${w.slug}/`,
      categories: w.data.tags,
    })),
  });
}
