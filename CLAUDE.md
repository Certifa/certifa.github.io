# CLAUDE.md — Certifa (certifa.net)

## Project

Multi-page portfolio and writeup hub for Mike (**Certifa**), an offensive-security student and pentester. Dark, near-black, with a single green accent. Shell pages (home, about, projects, contact, 404) carry the visual flair; writeup pages stay clean for reading.

This site is a signal to recruiters, hiring managers, and CTF teams, so polish is load-bearing, not cosmetic. Built with Astro (static output), deployed to **certifa.net** via GitHub Pages.

No database, no auth, no server-side code in this repo. The only backend touchpoint is a Cloudflare Worker for the contact form (see below). If a change seems to need a database, auth, or a server, stop and ask: it belongs elsewhere.

## Design source of truth

The whole visual system comes from six static HTML mockups exported from AIDesigner:

```
/home/certifa/Desktop/Site/template/certifa.net/
├── design-export/design-export/Page_1__Copy.html   → home
├── design-export (1)/design-export/Page_8.html     → writeups list
├── design-export (2)/design-export/Page_14.html    → about
├── design-export (3)/design-export/Page_19.html    → contact
├── design-export (4)/design-export/Page_22.html    → projects
└── design-export (5)/design-export/Page_27.html    → 404
```

**These files are the design authority.** Do not invent new visual patterns, colors, or page layouts beyond what they contain. If the real site needs something the six don't cover (the writeup detail template, for instance), say so and design it with Mike rather than improvising.

Two caveats when reading them:

- **They disagree with each other.** Page_1 was an earlier pass using a `#00FA9A`/`#00F0FF` accent on `#040405` with Geist; the other five use `#4ade80` and Inter, three of them commenting `// Unified green accent site-wide`. The unified system won, and Page_1 was restyled onto it while keeping its layout, structure, and copy. Backgrounds ranged across four near-blacks; `#09090b` is the settled base.
- **Their copy is largely placeholder.** The exports invent writeups (`Bypass EDR via Syscalls`, `API Abuse & Data Exfil`, `Custom Enumeration Engine`, `IDOR to Account Takeover`, `PowerShell Post-Exploitation`, `Lateral Movement via RBCD`, `SSRF to Internal Pivot`), certifications Mike does not hold, and stock imagery. Layout and styling come from the exports; **content comes from the content collection and from Mike**. Never ship a claim the exports invented.

## Working style

This is a living project, improved continuously. The standing goal is "more beautiful, more technical, more polished." Every change should raise the bar, not just satisfy the letter of the request.

- Read the tokens, `global.css`, and the relevant export before touching anything.
- Never regress performance, accessibility, or mobile layout to chase an effect. Keyboard nav and clean mobile layouts are part of the quality bar.
- If you spot a bad assumption in a request or a better approach, say so before building. Flag it rather than silently obey.
- Factual accuracy outranks design fidelity. If an export states something untrue about Mike, flag it and use the real thing.

## Tech Stack

| Layer | Tech | Notes |
|---|---|---|
| **Framework** | Astro 5 | Static output, markdown-native, zero-JS by default |
| **Styling** | Tailwind (`@astrojs/tailwind`) | Tailwind-first, since the exports are Tailwind. Scoped `<style>` blocks only for what utilities can't express (SVG internals, keyframes, spotlight, prose) |
| **Animations** | CSS + IntersectionObserver | Scroll reveals via `[data-reveal]`, hover lifts, cursor spotlight. No JS animation libraries |
| **Content** | Astro Content Collections | Markdown writeups with frontmatter become pages |
| **Code Highlighting** | Shiki (build-time) | `github-dark` theme, `wrap: true` |
| **Diagrams** | Mermaid (client-side) | Loaded from CDN in `WriteupLayout`, only when a writeup contains a `mermaid` code block |
| **Fonts** | Google Fonts | Inter (body/UI), JetBrains Mono (mono), Space Grotesk (display), Newsreader italic (one word on the 404, nowhere else) |
| **Background effects** | AIDesigner WebGL runtime | Third-party CDN, opt-in per page. See below |
| **Contact form** | Cloudflare Worker | Both forms POST to `forms.certifa.net` (`localhost:8787` in dev) |
| **Deployment** | GitHub Actions → GitHub Pages | Auto-deploy on push to `main`; `public/CNAME` → certifa.net |

**No Three.js.** Background fields come from the AIDesigner runtime, not a local WebGL library. Do not add Three.js.

### AIDesigner WebGL runtime

Four exports carry a `[data-aifx]` background: home and about and projects use `ascii`, the 404 uses `dot-grid-wave`. `BaseLayout` loads the runtime from `cdn.aidesigner.ai` only when a page passes `effects`:

```astro
<BaseLayout title="About" effects>
```

Writeups and contact deliberately don't pass it. Things to know: the script carries Mike's API key, checks a licence endpoint on every load, and injects a "Made in AIDesigner" badge if the key is unlicensed. The current key returns `{"watermark":false}`, so no badge appears. The hero background depends on their CDN staying up.

## Site Structure

```
/                    → Home (hero + attack-path graph + writeups + arsenal bento + contact)
/about               → Bio + fact sidebar + focus-area grid
/projects            → Project card grid
/writeups            → Writeup listing with search + difficulty filters
/writeups/[slug]     → Individual writeup (rendered from markdown)
/contact             → Contact channels + form
/404                 → Not found
```

There is **no** `/skills` page, no `/tags` pages, no RSS feed.

## Astro Project Structure

```
certifa.github.io/
├── src/
│   ├── layouts/
│   │   ├── BaseLayout.astro      ← HTML shell, nav, footer, meta, fonts, `effects` prop, scroll-reveal + copy-to-clipboard
│   │   └── WriteupLayout.astro   ← Reading layout: header meta, TOC sidebar, copy buttons, active-heading tracking, Mermaid
│   ├── components/
│   │   ├── Nav.astro             ← Fixed blur nav, real routes, active state, availability chip, mobile drawer
│   │   ├── Footer.astro          ← Shared footer, year derived at build
│   │   ├── BrandMark.astro       ← The Certifa mark. Used by Nav and Footer; mirrors favicon.svg
│   │   ├── ContactForm.astro     ← Editor-motif form. `variant="filled"` (home) | `"outlined"` (contact). Validation, honeypot and Worker call defined once
│   │   ├── CardMotif.astro       ← Code-motif card visual, variant chosen from a writeup's tags
│   │   └── WriteupFeature.astro  ← Homepage's alternating two-column writeup row
│   ├── content/
│   │   ├── config.ts             ← Content collection schema (writeups)
│   │   └── writeups/             ← Drop .md files here; they become pages
│   ├── pages/
│   │   ├── index.astro           ← Home
│   │   ├── about.astro
│   │   ├── projects.astro        ← Project list lives in this file's frontmatter
│   │   ├── contact.astro
│   │   ├── 404.astro
│   │   └── writeups/
│   │       ├── index.astro       ← Listing with search + filter chips
│   │       └── [...slug].astro   ← Dynamic route; computes reading time
│   ├── pages/og/[...route].ts    ← Renders every share card at build. See below
│   ├── utils/og.ts               ← OG_VERSION + ogCard(). Bump on design change
│   ├── styles/
│   │   └── global.css            ← Theme tokens, base, chips/pills/tags, writeup prose, TOC, locked notice
│   └── assets/og-fonts/          ← TTFs the card route needs at render time. Do not delete
├── scripts/
│   └── make-icons.mjs            ← Raster favicons, rendered from favicon.svg. Run by hand
├── .github/workflows/deploy.yml  ← Build with Astro + deploy to Pages (on push to main)
├── public/
│   ├── images/writeups/<box>/    ← Writeup screenshots
│   ├── og-avatars/<box>.png      ← Square HTB box art, input to the share cards
│   ├── favicon.svg               ← Source of truth for the mark
│   ├── favicon-32.png            ← Generated, see scripts/make-icons.mjs
│   ├── apple-touch-icon.png      ← Generated
│   └── CNAME                     ← certifa.net
├── astro.config.mjs
├── tailwind.config.cjs           ← Colour + font tokens
└── package.json
```

### Share cards

`src/pages/og/[...route].ts` renders every card at build with CanvasKit, into `/og/<OG_VERSION>/<name>.png`. There are no card image files in the repo: they are build output.

One card design serves everything: `HACK THE BOX · WRITEUP` kicker, avatar beside a Space Grotesk title, a four-segment difficulty scale, tags along the bottom rule, `certifa.net` opposite, and the box art blurred into the background wash. Shell pages use the same frame with their own copy, defined in the `SHELL` map at the top of the route.

| Page | Card |
|---|---|
| writeup | `/og/v3/htb-<box>.png` |
| home, writeups, about, projects, contact | `/og/v3/<name>.png` |

The **same card is also the writeup masthead**, at `max-w-2xl`. That width is not arbitrary: the card's title is 88px within a 1200px card, so 672px renders it at 49px, matching the site's `text-5xl` page-title size. Because the card carries the title, the `h1` is `sr-only` on those pages so the box name is not set twice in the same typeface. **Do not put banner images back into the markdown**; they used to sit under `## Overview` and no longer belong there.

Adding a box: drop a square PNG at `public/og-avatars/<box>.png` (box = slug minus the `htb-` prefix). That is the whole step. The route picks it up on the next build, and a box with no avatar still gets a text-only card rather than failing.

**`OG_VERSION` in `src/utils/og.ts` must be bumped whenever the card design changes.** Discord, Slack and LinkedIn cache preview images by URL for months, so changed artwork at an unchanged path keeps serving the stale copy. Bumping moves every card to a fresh path. It cannot rewrite embeds a platform has already rendered; those keep their old image until the link is posted somewhere new. Currently `v3`.

`canvaskit-wasm` is a **devDependency**, which is fine: `npm ci` installs devDependencies, so the Actions build can render the cards.

### Brand mark and icons

The mark is a hexagon node with an attack path climbing out of it, replacing the shield the exports specify in the nav and footer of Page_14 / Page_19 / Page_22 / Page_27. That departure was Mike's call.

- `src/components/BrandMark.astro` is the one copy for nav and footer. It inherits `currentColor`, so the nav's hover-to-accent and the footer's muted grey both keep working. Do not paste the paths inline.
- `public/favicon.svg` is the source of truth for the raster icons.
- `scripts/make-icons.mjs` renders `favicon-32.png` and `apple-touch-icon.png` from it with sharp. Rerun after editing the mark.

`favicon.svg` and `BrandMark.astro` hold the same geometry at different scales (32 and 24 viewBox). Change one, change the other.

## Commands

Treat `package.json` scripts as the source of truth.
- `npm run dev` — local dev server at `localhost:4321`
- `npm run build` — production build to `dist/`
- `npm run preview` — serve the build locally

Node/npm are installed on this machine. There is no `gh` CLI.

**Deployment is push-to-deploy via GitHub Actions.** The Pages source is "GitHub Actions", so `.github/workflows/deploy.yml` builds and publishes on every push to `main`. **Pushing to `main` deploys the live site immediately, so only push when explicitly asked.**

## Design Direction

### Colour tokens

Defined in `tailwind.config.cjs`, and mirrored as CSS custom properties in `global.css` so the markdown prose system (which Tailwind never sees) stays on the same palette. **Keep the two in sync.**

```js
bg: '#09090b'  surface: '#0f0f12'  surfaceHover: '#161619'
border: '#1f1f23'  borderHover: '#3f3f46'
muted: '#71717a'  fg: '#e4e4e7'
accent: { DEFAULT: '#4ade80', dim: 'rgba(74,222,128,0.1)', faint: 'rgba(74,222,128,0.05)' }
```

Difficulty is the **only** badge that carries colour, because there the colour encodes real data. Semantic, not a single-hue ramp:

```css
--diff-easy:   #4ade80   /* green  */
--diff-medium: #fbbf24   /* amber  */
--diff-hard:   #f87171   /* red    */
--diff-insane: #c084fc   /* violet */
```

Weight climbs with severity so the ramp survives without colour. Use `.diff-pill .diff-<difficulty>`; never restyle difficulty inline.

### Typography

- **Display (Space Grotesk)** via `font-display`: page titles, section headings, writeup and card titles.
- **Sans (Inter)**: body, descriptions, buttons, UI.
- **Mono (JetBrains Mono)**: kickers, section labels, code, badges, form chrome.
- **Serif (Newsreader italic)**: the words "this path." on the 404. Nowhere else.
- **Writeup prose**: Inter at 17px, 1.8 line height, max-width 760px.

### Layout

The nav is `fixed`, so `global.css` gives `main` a `4rem` top padding to clear it. Pages that want more add the **remainder** on their own wrapper, not the full value from the export. Example: Page_1 specifies `pt-32`, so `index.astro` uses `pt-16`.

### Visual effects in use

Scroll reveals (`[data-reveal]`), card hover lift, cursor-follow spotlight on the arsenal bento, a scan line on the tooling card, the `ascii` and `dot-grid-wave` WebGL fields, image `group-hover:scale-105`, and the 404's split-numeral hover. All present because an export specifies them.

### Keeping copy readable over the fields — do not undo

The WebGL fields sit *behind* page copy. The exports set them at full strength, which is unreadable in practice: on mobile the columns collapse and text lands directly on a moving background. Four measures fix it, and they work together:

1. `[data-aifx] { opacity: 0.18 }` under 768px, in `global.css`.
2. `opacity-70` on the hero and projects fields at desktop widths.
3. `.hero-copy::before` in `index.astro`: a soft radial scrim, inset well past the text so it fades as a vignette, heavier and recentred on mobile. It also supplies the `position: relative` that makes the column's `z-10` work at all, which keeps the scrim above the field and below the text.
4. Hero body copy at `zinc-300`, small mono labels at `zinc-400`. The `--fg-3` muted token is too dim to sit over a field.

Raising any of these back toward the export values reintroduces the problem. The fields also `display: none` under `prefers-reduced-motion`.

## Writeup Content System

### Frontmatter schema
```yaml
---
title: "Box Name"
date: 2025-12-15
tags: [web, privesc, AD]
difficulty: easy | medium | hard | insane
platform: HTB | THM | CTF | Other
description: "One-line summary"
featured: true | false
---
```

### Card motifs

`CardMotif.astro` turns a writeup's tags into a code panel, following the `.card-visual-code` pattern from Page_8. Variants: `delegation`, `kerberos`, `ad-enum`, `shellshock`, `mcp`, `sqli`, `web-rce`, `network`, `privesc`, `recon`. **Order matters, first match wins**, and delegation is deliberately checked before kerberos so a box tagged both tells the more specific story. Hostnames derive from the slug (`htb-cicada` → `cicada.htb`). Token colours live in `.card-visual-code` in `global.css`.

Adding a new attack shape means adding a variant here, not a bespoke visual on the page.

### Writeup page features (WriteupLayout)
- TOC from H2/H3 headings (sticky sidebar from `lg`, collapsible drawer below, list scrolls independently)
- Copy button on every code block
- Reading-progress bar pinned under the nav
- Reading-time estimate (computed in `[...slug].astro`)
- Difficulty pill, platform, date, and tags in the header. Tags are plain text, not links
- Related writeups by shared tags, plus chronological prev/next
- Hover anchor links on headings, hidden below 900px
- Wide tables wrapped for horizontal scroll; Mermaid rendered client-side

**No export covers this page**, so every element is derived from a pattern the six already establish, never invented:

| Element | Derived from |
|---|---|
| Header band: accent-slash kicker, display title, lead paragraph, `border-b` | Page_22 projects header |
| Meta strip micro-labels (`text-[10px] font-mono uppercase tracking-widest`) | Page_8 list header |
| TOC panel chrome (`bg-surface/40 backdrop-blur-sm`, dashed-divider feel) | Page_14 fact sidebar |
| Related + prev/next cards | Page_8 writeup cards |
| Closing "All writeups" button | Page_22 outlined CTA |

Keep deriving. If this page needs something none of the six contain, raise it with Mike rather than improvising a new treatment.

The masthead is the generated share card, not a markdown image. See "Share cards" above.

### Writeup listing (writeups/index.astro)
- Search over title, description, and tags, combining with the active chip
- Chips: All / Easy / Medium / Hard / Insane / Featured, each shown only when its count is non-zero
- Empty state with a "Clear filters" reset
- Sorted by date, newest first

Filtering sets `style.display` directly: the cards carry Tailwind's `flex`, which outranks the `[hidden]` attribute.

### Active-machine (locked) writeups
HTB's streaming policy forbids publishing walkthroughs for machines that are still active. Boxes that aren't retired yet ship as a **locked notice** instead of a full writeup:
- The markdown body is a single `<div class="wu-locked">…</div>`. No inline `<style>`, no per-file CSS.
- All styling lives in one `.wu-locked` block in `global.css`, built from theme tokens.
- Frontmatter still uses a real title/date/tags; `description` is the placeholder "Active HackTheBox machine. Full writeup published after retirement."
- When a box retires, replace the locked `<div>` with the real writeup.

**The hero graph must show a retired box.** It used to spell out Pirate's full chain down to `root.txt`, naming real credentials, while `htb-pirate.md` withheld the writeup precisely because the machine was still active. The graph is a walkthrough in its own right, so it falls under the same policy as the prose. It now shows **DarkZero**, which is retired and has a published writeup. When swapping in a new box, check it is retired first, and keep the panel's label (`DarkZero · HTB · Hard`) in step with the SVG.

## Responsive Design — MANDATORY

- **Mobile-first**: design for 375px, then scale up.
- Touch targets min 44px; inputs use 16px font on mobile to stop iOS zoom.
- Nav collapses to a hamburger drawer under `md`.
- Writeup TOC: collapsible drawer on mobile, sticky sidebar on desktop.

## Performance Rules

- Astro zero-JS by default; add client scripts only where needed.
- Mermaid imported from CDN only when a writeup actually contains a diagram.
- The WebGL runtime loads only on pages passing `effects`.
- Images lazy-loaded with `loading="lazy" decoding="async"`.
- Shiki highlighting at build time, not client-side.
- Keep only the four fonts in use in the Google Fonts request.

## Content Tone

- First person, confident but not arrogant. Mike is presented as an offensive-security **student**; keep that framing.
- Technical but accessible: recruiters and hackers should both get it.
- Short sentences, active voice. English (Mike is a Dutch speaker).
- **Active Directory, Linux, and web are three equal focus areas.** Do not frame the work as Windows/AD-only.
- **No fabricated claims.** No certifications he doesn't hold, no projects he hasn't built, no fake uptime or live counters. Derive numbers from real data.
- **No em dashes (—)** in prose written for the site. Use a colon, a comma, a period, or → for arrows. Copy quoted verbatim from an export is the one exception.

### Current facts (verify before changing)
- 24, Utrecht, Netherlands. Hogeschool Utrecht, Cybersecurity & Cloud BSc.
- HackTheBox Master, peak Pro Hacker, 50+ machines. Parrot, tmux/vim/burp.
- Windows Server 2022 DC plus two workstations at home.
- **No certifications yet.** CJCA exam booked, CPTS next, CCNA planned.
- Five real projects, listed in `projects.astro`.

## Code Conventions

- Astro components: logic in frontmatter, markup lean. Tailwind utilities first; scoped `<style>` only where utilities fall short.
- Repeated markup belongs in a component or a frontmatter array, never copy-pasted across pages.
- Semantic HTML5; use the tokens, never hardcode a hex a token already covers.
- TypeScript for the content collection config and inline scripts.

## Guardrails

- Small, focused changes over sweeping rewrites. If a task balloons in scope, pause and re-scope.
- **Confirm before anything hard to reverse or outward-facing**: deploying/pushing to `main`, deleting files, or adding a dependency.
- Routine, in-scope edits don't need pre-approval, but keep Mike oriented: say what you're about to do, and surface anything surprising.

## What NOT to Do

- No Three.js.
- No new visual patterns outside the six exports; ask instead.
- No shipping the exports' invented content as fact.
- No Lorem ipsum; real content always.
- No excessive glow hurting readability.
- No autoplaying sound or video.
- No client-side JS where Astro handles it at build time.
- No cookie banners or popups.
