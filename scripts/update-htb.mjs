/**
 * Refresh the syncable HackTheBox figures in src/data/htb.ts.
 *
 *   node scripts/update-htb.mjs --inspect   print the payload, redacted
 *   node scripts/update-htb.mjs --dry-run   report changes, write nothing
 *   node scripts/update-htb.mjs             apply them
 *
 * Only two fields are synced. The v4 /user/profile/basic endpoint returns a
 * ladder badge under `rank` ("Pro Hacker") and a `points` of its own, while
 * the profile page shows an HTB Rank ("Master"), a level and level XP. Same
 * names, different concepts. An earlier version of this script mapped by
 * plausible-looking names and wrote a rank progress percentage into `level`
 * and into both halves of the XP pair, which passed every check because the
 * fields existed and held numbers. Matching on presence is not verification,
 * so the safe set is only what has been confirmed against the profile page:
 *
 *   globalRank <- ranking
 *   machines   <- system_owns
 *
 * Everything else stays hand-maintained. Edits here are surgical for the same
 * reason: regenerating the file would drop the comments explaining all this.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = 'src/data/htb.ts';
const API = 'https://labs.hackthebox.com/api/v4';
const token = process.env.HTB_TOKEN || process.env.HTB_API;
const argv = new Set(process.argv.slice(2));

if (!token) {
  console.error('No token. Set HTB_TOKEN or HTB_API in the environment.');
  process.exit(1);
}

const get = async (path) => {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'User-Agent': 'certifa.net-stats' },
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${res.statusText}`);
  return res.json();
};

const info = await get('/user/info');
const id = info?.info?.id;
if (!id) throw new Error('could not resolve the user id from /user/info');
const profile = (await get(`/user/profile/basic/${id}`))?.profile ?? {};

if (argv.has('--inspect')) {
  /* Read from a public Actions log, and /user/info carries contact details
     and an account identifier that have no business being in one. */
  const SENSITIVE = /email|mail|token|secret|password|phone|address|identifier|account_id|sso|cv$|full_name/i;
  const clean = (v) => {
    if (Array.isArray(v)) return v.map(clean);
    if (v && typeof v === 'object') {
      return Object.fromEntries(
        Object.entries(v).filter(([k]) => !SENSITIVE.test(k)).map(([k, val]) => [k, clean(val)]),
      );
    }
    if (typeof v === 'string') return v.replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[redacted]');
    return v;
  };
  console.log(JSON.stringify({ info: clean(info), profile: clean(profile) }, null, 2));
  process.exit(0);
}

/** A count HTB shows: a non-negative integer, and not absurd. */
const sane = (v, max) => Number.isInteger(v) && v >= 0 && v <= max;

const incoming = { globalRank: profile.ranking, machines: profile.system_owns };
if (!sane(incoming.globalRank, 5_000_000) || !sane(incoming.machines, 2000)) {
  throw new Error(`refusing implausible values: ${JSON.stringify(incoming)}`);
}

let src = readFileSync(FILE, 'utf8');
const changes = [];
for (const [key, value] of Object.entries(incoming)) {
  const re = new RegExp(`(\b${key}:\s*)(\d+)`);
  const m = src.match(re);
  if (!m) throw new Error(`${key} not found in ${FILE}; refusing to guess where it goes`);
  if (+m[2] !== value) {
    changes.push(`${key} ${m[2]} -> ${value}`);
    src = src.replace(re, `$1${value}`);
  }
}

if (!changes.length) {
  console.log('no change');
  process.exit(0);
}
if (argv.has('--dry-run')) {
  console.log(`would apply: ${changes.join(', ')}`);
  process.exit(0);
}
writeFileSync(FILE, src);
console.log(`updated ${FILE}: ${changes.join(', ')}`);
