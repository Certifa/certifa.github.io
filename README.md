# certifa.github.io

Source for [certifa.net](https://certifa.net): my offensive security portfolio and writeup hub.

## Stack

- [Astro](https://astro.build) static site with [Tailwind CSS](https://tailwindcss.com)
- Writeups as Markdown in `src/content/writeups/`, rendered via Astro Content Collections
- [Shiki](https://shiki.style) for syntax highlighting at build time
- Background fields on the home, about, projects and 404 pages come from the AIDesigner WebGL runtime, loaded from CDN only on pages that pass the `effects` prop to `BaseLayout`. There is no local WebGL library and no Three.js
- Contact form posts to a Cloudflare Worker (`worker/`, deployed at `forms.certifa.net`)
- Deployed to GitHub Pages via [`actions/deploy-pages`](https://github.com/actions/deploy-pages)

## Local development

```bash
npm install
npm run dev    # http://localhost:4321
npm run build  # static output to dist/
```

## Deploying

`.github/workflows/deploy.yml` builds and publishes on every push to `main`, so **a push to `main` deploys the live site immediately.** There is no staging step.

## Adding a writeup

Drop a Markdown file into `src/content/writeups/` with frontmatter:

```yaml
---
title: "Box Name"
date: 2026-05-05
tags: [web, privesc, AD]
difficulty: medium       # easy | medium | hard | insane
platform: HTB            # HTB | THM | CTF | Other
description: "One-line summary"
featured: false
---
```

Astro auto-generates the page at `/writeups/<slug>`. Schema lives in `src/content/config.ts`.

Drop a square PNG at `public/og-avatars/<box>.png` (box being the slug without the `htb-` prefix) and the share card and listing artwork pick it up on the next build. A box without one still gets a text-only card.

### Active machines

HackTheBox's streaming policy forbids publishing a walkthrough for a machine that has not retired. Boxes that are still active ship as a locked notice instead: the body is a single `<div class="wu-locked">`, styled from one block in `global.css`. Replace it with the real writeup once the box retires.

This applies to any representation of the chain, including diagrams elsewhere on the site, not only to prose.

## Share cards

`src/pages/og/[...route].ts` renders every card at build time with CanvasKit into `/og/<OG_VERSION>/<name>.png`. No card images are committed; they are build output.

`OG_VERSION` in `src/utils/og.ts` (currently `v3`) must be bumped whenever the card design changes. Discord, Slack and LinkedIn cache preview images by URL for months, so changed artwork at an unchanged path keeps serving the stale copy.

## Icons

`public/favicon.svg` is the source of truth for the brand mark. `node scripts/make-icons.mjs` regenerates `favicon-32.png` and `apple-touch-icon.png` from it. Run it by hand after editing the mark, and keep `src/components/BrandMark.astro` in step since it holds the same geometry at a different scale.

## Project context

- `CLAUDE.md` is the working brief: design authority, colour and type tokens, content rules, and the things not to do.
- `PRODUCT.md` records durable product truth: users, purpose, positioning, and constraints.

---

Reach me at `mike@certifa.net`.
