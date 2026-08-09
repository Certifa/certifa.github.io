# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: hiring managers and technical leads at security firms.** Pentest consultancies and internal red teams, evaluating Mike (Certifa) as a junior candidate. They will actually open a writeup and judge the reasoning, so depth and correctness outrank scanability. They arrive from a CV, LinkedIn, GitHub, or the HackTheBox profile, and they are deciding whether he is worth an interview.

Secondary audiences, real but not the ones the site is tuned for: technical recruiters and HR screeners doing a first pass, and CTF teams or HackTheBox peers assessing him as a teammate.

## Product Purpose

A portfolio and writeup hub that demonstrates offensive-security capability through published HackTheBox machine writeups, so a technical evaluator can judge how Mike thinks rather than take his word for it.

Success is concrete and sequenced: a mandatory internship (stage) placement for the Cybersecurity & Cloud BSc in the near term, then a first paid junior red-team role after graduation. The site has to serve the placement search now without needing a rebuild for the job search later.

## Positioning

Two claims a neighboring HackTheBox blog could not truthfully copy, both confirmed by Mike:

1. **Full chains, start to finish.** The complete reasoning and the actual path, not a transcript of the commands that happened to work.
2. **Published only after retirement.** Machines that are still active ship as a locked notice rather than a walkthrough, in line with HackTheBox's streaming policy.

Explicitly *not* claimed as differentiators, though both are true of Mike: equal coverage across Active Directory, Linux and web, and rebuilding attacks in a home lab. These are facts about the work and framing rules for copy, not the position.

## Operating Context

- Writeups are authored as Markdown in `src/content/writeups/` and published only once the machine has retired. Frontmatter drives the generated pages, listings and share cards.
- HackTheBox is the main proving ground. A Windows Server 2022 domain controller with two workstations at home is used to rebuild chains outside the platform.
- Evaluators typically arrive from an external profile link rather than by browsing, so entry can be any page, including a single writeup.
- Deployment is push-to-deploy: a push to `main` publishes the live site immediately via GitHub Actions.

## Capabilities and Constraints

- Static Astro site with no database, no auth, and no server-side code. The only backend touchpoint is a Cloudflare Worker handling the contact form at `forms.certifa.net`.
- Hosted on GitHub Pages at **certifa.net**.
- **HackTheBox streaming policy is a hard constraint.** No walkthrough may be published for an active machine, and this applies to every representation of a chain, including diagrams and summaries, not only prose. Active boxes ship as a locked notice.
- Content today: 9 writeups, 8 published and 1 (`htb-pirate`) locked pending retirement.
- Share cards are build output rendered with CanvasKit, not files in the repo. Their URL version must be bumped when the card design changes, because platforms cache previews by URL.
- Background effects come from a third-party AIDesigner WebGL runtime loaded from CDN, opt-in per page. The hero's background depends on that CDN staying up.

## Brand Commitments

- **Name and identity:** Certifa (Mike). The brand mark is a hexagon node with an attack path climbing out of it, chosen by Mike over the shield the design exports specified.
- **Voice:** first person, confident but not arrogant. Technical but accessible to both recruiters and hackers. Short sentences, active voice, English.
- **Framing:** Mike is presented as an offensive-security **student**, and that framing is deliberate. Active Directory, Linux and web are described as three equal focus areas, never as a Windows-only profile.
- **No em dashes** in prose written for the site.
- **At most one clever line per page.** Everything else is plain and functional.
- **No fabricated claims.** No certifications he does not hold, no projects he has not built, no invented metrics, no fake liveness or live counters. Numbers are derived from real data.

## Evidence on Hand

Real material the site can draw on:

- 9 HackTheBox writeups in `src/content/writeups/`, with screenshots under `public/images/writeups/<box>/`
- Box art for all 9 machines at `public/og-avatars/<box>.png`
- Five real projects listed in `src/pages/projects.astro`, including the HTB Tracker dashboard (`certifa.github.io/htb-tracker/`) and this site itself
- HackTheBox profile (`app.hackthebox.com/users/Certifa`), GitHub (`github.com/Certifa`), LinkedIn (`linkedin.com/in/certifa`), Discord (`Quetro`), email (`mike@certifa.net`)
- Standing on HackTheBox: Master rank, peak Pro Hacker, 50+ machines across Easy to Insane
- Personal facts: 24, Utrecht, Netherlands. Hogeschool Utrecht, Cybersecurity & Cloud BSc, in progress. Parrot with tmux, vim and Burp.

Absences that future work must not paper over:

- **No certifications are held.** CJCA exam is booked, CPTS is next, CCNA is planned. The roadmap may be shown; a held credential may not be implied.
- No testimonials, client work, employment history, press, or third-party endorsements exist.
- No uptime figures, visitor counts, or other live telemetry exist.

## Product Principles

1. **A technical evaluator must be able to judge the reasoning, not just the result.** The chain and why it worked is the product; a list of commands is not.
2. **The work is the proof.** Evidence outranks assertion. When a claim and an artifact compete for space, the artifact wins.
3. **Nothing ships that is not true.** A missing credential is stated plainly rather than implied away, and the student framing is presented as an accurate level, not an apology.
4. **Policy compliance is part of the credibility.** Respecting the disclosure rules of the platform being attacked is itself a signal to a security employer, so the retirement rule is never bent for a better-looking page.
5. **Any page can be the entry point.** Evaluators arrive on deep links from external profiles, so a single writeup has to stand on its own.

## Accessibility & Inclusion

No formal standard was mandated by Mike, and this was not put to him during init. Two commitments are nonetheless established in the project and should be treated as durable:

- Keyboard navigation and clean mobile layouts are part of the quality bar, and performance, accessibility and mobile layout are never regressed to achieve a visual effect.
- Body and secondary text meets WCAG AA contrast against both the base and surface backgrounds.
