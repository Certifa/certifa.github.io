# Certifa.github.io — Portfolio & Writeup Hub

## Project Overview

Multi-page portfolio and writeup site for Mike (Certifa) — cybersecurity student and pentester. Dark, cyber, professional aesthetic. The shell pages (home, about, skills, projects) get the visual flair. Writeup pages prioritize clean readability. Hosted on GitHub Pages via Astro static output.

## Tech Stack

| Layer | Tech | Notes |
|---|---|---|
| **Framework** | Astro | Static site generator, markdown-native, islands architecture |
| **Styling** | Tailwind CSS | `npx astro add tailwind`, utility-first, mobile-first |
| **3D / Visual** | Three.js | Home page hero ONLY — do not load on other pages |
| **Animations** | CSS + Intersection Observer | Scroll reveals, hover effects, no heavy JS animation libs |
| **Content** | Astro Content Collections | Markdown writeups with frontmatter → auto-generated pages |
| **Code Highlighting** | Shiki (built into Astro) | Syntax highlighting in writeup code blocks |
| **Fonts** | Google Fonts | Space Mono (mono) + Outfit (sans) |
| **Deployment** | GitHub Actions → GitHub Pages | Auto-deploy on push to main |

## Site Structure

```
/                    → Home (hero + featured writeups + skills preview)
/about               → Bio, stats, journey timeline
/projects            → Project showcase grid
/writeups            → Writeup listing with filters
/writeups/[slug]     → Individual writeup (rendered from markdown)
/skills              → Interactive tools/arsenal page
```

## Astro Project Structure

```
certifa.github.io/
├── src/
│   ├── layouts/
│   │   ├── BaseLayout.astro      ← HTML shell, nav, footer, noise overlay, meta tags
│   │   ├── PageLayout.astro      ← Standard page with section hero header
│   │   └── WriteupLayout.astro   ← Clean reading layout, TOC sidebar, prev/next nav
│   ├── components/
│   │   ├── Nav.astro             ← Sticky blur nav, active page, mobile hamburger
│   │   ├── Footer.astro
│   │   ├── Hero.astro            ← Home hero with Three.js background
│   │   ├── ThreeBackground.astro ← Three.js island (client:only or client:load)
│   │   ├── ProjectCard.astro
│   │   ├── WriteupCard.astro     ← Card for writeup listing (title, date, difficulty, tags)
│   │   ├── SkillGrid.astro
│   │   ├── Timeline.astro
│   │   └── TableOfContents.astro ← Sticky sidebar TOC for writeup pages
│   ├── content/
│   │   ├── config.ts             ← Content collection schema (writeups)
│   │   └── writeups/             ← Drop .md files here, they become pages
│   │       └── example-box.md
│   ├── pages/
│   │   ├── index.astro
│   │   ├── about.astro
│   │   ├── projects.astro
│   │   ├── skills.astro
│   │   └── writeups/
│   │       ├── index.astro       ← Listing page with filters/search
│   │       └── [...slug].astro   ← Dynamic route for individual writeups
│   └── styles/
│       └── global.css            ← CSS custom properties, base styles, prose styling
├── public/
│   └── images/
├── astro.config.mjs
├── tailwind.config.cjs
├── tsconfig.json
└── package.json
```

## Writeup Content System

### Frontmatter schema for writeups:
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

### Content collection config (src/content/config.ts):
```typescript
import { defineCollection, z } from 'astro:content';

const writeups = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: z.date(),
    tags: z.array(z.string()),
    difficulty: z.enum(['easy', 'medium', 'hard', 'insane']),
    platform: z.enum(['HTB', 'THM', 'CTF', 'Other']),
    description: z.string(),
    featured: z.boolean().default(false),
  }),
});

export const collections = { writeups };
```

### Writeup page features:
- Table of contents generated from headings (sticky sidebar desktop, collapsible mobile)
- Syntax-highlighted code blocks with copy button
- Reading time estimate
- Difficulty badge + platform tag + date
- Prev/next writeup navigation
- Tags as clickable filter links back to listing

### Writeup listing page features:
- Filter by platform, difficulty, tags
- Search by title/description
- Sort by date (newest first default)
- Grid layout with WriteupCard components

## Design Direction

### Aesthetic
- **Dark-first** — deep blacks (#06060e, #0a0a0f) with cyan and purple accents
- **Terminal/cyber** — monospace labels, `// section-label` style headings, blinking cursor touches
- **Professional, not edgy** — clean layout, readable type, generous whitespace
- **Two modes**: shell pages get visual flair, writeup pages stay clean for reading

### Color Palette
```css
:root {
  --bg: #06060e;
  --bg-card: rgba(14, 14, 28, 0.7);
  --text: #c8cad0;
  --text-bright: #eaedf3;
  --text-dim: #555a6e;
  --accent: #00e5ff;
  --accent-glow: rgba(0, 229, 255, 0.15);
  --accent2: #8b5cf6;
  --green: #22d37e;
  --border: rgba(255, 255, 255, 0.06);
}
```

### Typography
- **Monospace**: Space Mono — nav, labels, section tags, code, dates
- **Sans-serif**: Outfit — body text, descriptions, headings
- **Writeup prose**: Outfit at 18px, 1.8 line height, max-width 750px

### Visual Effects (shell pages only)
- Noise/grain overlay (SVG filter, fixed, pointer-events: none)
- Subtle scanlines (repeating-linear-gradient)
- Cursor glow following mouse (desktop only)
- Card hover: translateY(-4px), gradient top border reveal, glow shadow
- Scroll-triggered fade-up reveals via IntersectionObserver

### Writeup Page Styling
- Minimal — no noise, no scanlines, no cursor glow
- Clean prose styling via Tailwind Typography or custom prose classes
- Code blocks: dark bg matching site theme, Shiki theme "github-dark" or similar
- Clear heading hierarchy with visual weight

## Responsive Design — MANDATORY

- **Mobile-first** — design for 375px, then scale up
- Breakpoints: 375px, 768px, 1024px, 1440px
- Touch-friendly targets (min 44px)
- Three.js: reduce particle count on mobile, disable cursor glow
- Nav: hamburger with slide-in on mobile
- Writeup TOC: collapsible drawer on mobile, sticky sidebar on desktop

## Performance Rules

- Three.js loaded ONLY on home page (Astro client:only directive)
- Lazy-load images: `loading="lazy"`
- Astro zero-JS by default — only add client directives where needed
- Shiki syntax highlighting at build time, not client-side
- Lighthouse performance > 90, accessibility > 90
- Page weight: < 3MB writeup pages, < 5MB home

## GitHub Pages Deployment

### astro.config.mjs:
```javascript
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://certifa.github.io',
  integrations: [tailwind()],
  output: 'static',
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
    },
  },
});
```

### GitHub Actions: auto-deploy on push to main using withastro/action@v3.

## Code Standards

- Astro components (.astro) with scoped styles
- Semantic HTML5 throughout
- CSS custom properties for theme values in global.css
- Tailwind for layout/spacing, custom CSS for complex effects
- TypeScript for content collection config
- Comment Three.js setup and complex animations for learning
- No jQuery, no unnecessary dependencies

## Content Tone

- First person, confident but not arrogant
- Technical but accessible — recruiters AND hackers should get it
- Short sentences, active voice
- English (Dutch speaker)

## What NOT to Do

- No templates or template-looking designs
- No AI slop (purple gradients on white, Inter/Roboto everywhere)
- No excessive neon glow hurting readability
- No autoplaying sounds or video
- No Lorem ipsum — real or realistic content always
- No client-side JS where Astro handles it at build time
- No Three.js on writeup pages
- No heavy animation libraries — CSS + IntersectionObserver are enough
- No cookie banners or popups
