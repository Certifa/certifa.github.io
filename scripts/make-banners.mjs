// Renders the writeup header banner for every non-locked writeup.
//
// One banner per box at public/images/writeups/<box>/logo.png, composed from
// that box's square avatar in public/og-avatars/. Replaces the HTB screenshots,
// which came from two different eras of their UI and never matched each other.
//
// Typography and colour follow the site tokens, so a banner reads as part of
// the page rather than an imported asset. Fonts are vendored as TTFs in
// src/assets/og-fonts/ because CanvasKit needs the bytes at render time.
//
// Run after adding a box avatar to public/og-avatars/:
//   node scripts/make-banners.mjs

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const W = 1600;           // 2x the 800px display width, for retina
const H = 300;
const ACCENT_BAR = 10;
const PAD = 56;
const AVATAR = 200;
const GAP = 44;

// Keep in step with :root in src/styles/global.css.
const BG = [15, 15, 18];         // --bg-2   #0f0f12
const ACCENT = [74, 222, 128];   // --accent #4ade80
const FG = [228, 228, 231];      // --fg     #e4e4e7
const FG_2 = [161, 161, 170];    // --fg-2   #a1a1aa

// Share card. Same plate, bar and type as the banner, at the 1.91:1 ratio the
// social platforms actually want.
const OG_W = 1200;
const OG_H = 630;
const OG_PAD = 72;
const OG_BAR = 12;
const OG_AVATAR = 150;

const WRITEUPS = 'src/content/writeups';
const AVATARS = 'public/og-avatars';
const OUT = 'public/images/writeups';
const OG_OUT = 'public/og';

/** Pull the few frontmatter fields the banner needs. */
function frontmatter(md) {
  const block = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!block) return null;
  const field = (name) => block[1].match(new RegExp(`^${name}:\\s*(.+)$`, 'm'))?.[1].trim();
  const title = field('title')?.replace(/^["']|["']$/g, '');
  const difficulty = field('difficulty');
  const tags = (field('tags') ?? '').replace(/^\[|\]$/g, '').split(',').map((t) => t.trim().toLowerCase());
  const os = tags.includes('windows') ? 'Windows' : tags.includes('linux') ? 'Linux' : null;
  return title && difficulty && os ? { title, difficulty, os } : null;
}

const require = createRequire(import.meta.url);
const CanvasKitInit = require('canvaskit-wasm/bin/canvaskit.js');
const ckDir = path.dirname(require.resolve('canvaskit-wasm/bin/canvaskit.js'));
const CanvasKit = await CanvasKitInit({ locateFile: (f) => path.join(ckDir, f) });

const [spaceGrotesk, jetbrains] = await Promise.all([
  readFile('src/assets/og-fonts/space-grotesk-700.ttf'),
  readFile('src/assets/og-fonts/jetbrains-400.ttf'),
]);
const fontMgr = CanvasKit.FontMgr.FromData(spaceGrotesk, jetbrains);

function paragraph(text, color, size, family, weight) {
  const style = new CanvasKit.ParagraphStyle({
    textStyle: {
      color: CanvasKit.Color(...color),
      fontFamilies: [family],
      fontSize: size,
      fontStyle: { weight: CanvasKit.FontWeight[weight] },
      heightMultiplier: 1.1,
    },
    textAlign: CanvasKit.TextAlign.Left,
  });
  const builder = CanvasKit.ParagraphBuilder.Make(style, fontMgr);
  builder.addText(text);
  const p = builder.build();
  p.layout(W);
  builder.delete();
  return p;
}

async function banner({ title, difficulty, os }, avatarFile) {
  const surface = CanvasKit.MakeSurface(W, H);
  const canvas = surface.getCanvas();

  // Solid background, no alpha anywhere: these sit on the page as opaque plates.
  const bg = new CanvasKit.Paint();
  bg.setColor(CanvasKit.Color(...BG));
  canvas.drawRect(CanvasKit.XYWHRect(0, 0, W, H), bg);
  bg.delete();

  // Left accent edge, echoing the OG share card.
  const bar = new CanvasKit.Paint();
  bar.setColor(CanvasKit.Color(...ACCENT));
  canvas.drawRect(CanvasKit.XYWHRect(0, 0, ACCENT_BAR, H), bar);
  bar.delete();

  const img = CanvasKit.MakeImageFromEncoded(await readFile(avatarFile));
  if (!img) throw new Error(`could not decode ${avatarFile}`);
  const ip = new CanvasKit.Paint();
  ip.setAntiAlias(true);
  canvas.drawImageRectOptions(
    img,
    CanvasKit.XYWHRect(0, 0, img.width(), img.height()),
    CanvasKit.XYWHRect(ACCENT_BAR + PAD, (H - AVATAR) / 2, AVATAR, AVATAR),
    CanvasKit.FilterMode.Linear, CanvasKit.MipmapMode.None, ip,
  );
  ip.delete();
  img.delete();

  // Title over meta, the pair centred against the avatar.
  const textX = ACCENT_BAR + PAD + AVATAR + GAP;
  const name = paragraph(title, FG, 68, 'Space Grotesk', 'Bold');
  const label = difficulty[0].toUpperCase() + difficulty.slice(1);
  const meta = paragraph(`${os} · ${label}`, FG_2, 30, 'JetBrains Mono', 'Normal');

  const groupGap = 16;
  const top = (H - (name.getHeight() + groupGap + meta.getHeight())) / 2;
  canvas.drawParagraph(name, textX, top);
  canvas.drawParagraph(meta, textX, top + name.getHeight() + groupGap);
  name.delete();
  meta.delete();

  const snapshot = surface.makeImageSnapshot();
  const png = snapshot.encodeToBytes();
  snapshot.delete();
  surface.delete();
  return Buffer.from(png);
}

async function ogCard({ title, difficulty, os }, avatarFile) {
  const surface = CanvasKit.MakeSurface(OG_W, OG_H);
  const canvas = surface.getCanvas();

  const bg = new CanvasKit.Paint();
  bg.setColor(CanvasKit.Color(...BG));
  canvas.drawRect(CanvasKit.XYWHRect(0, 0, OG_W, OG_H), bg);
  bg.delete();

  const bar = new CanvasKit.Paint();
  bar.setColor(CanvasKit.Color(...ACCENT));
  canvas.drawRect(CanvasKit.XYWHRect(0, 0, OG_BAR, OG_H), bar);
  bar.delete();

  const x = OG_BAR + OG_PAD;
  const maxText = OG_W - x - OG_PAD;

  const img = CanvasKit.MakeImageFromEncoded(await readFile(avatarFile));
  if (!img) throw new Error(`could not decode ${avatarFile}`);

  const label = difficulty[0].toUpperCase() + difficulty.slice(1);
  const name = paragraph(title, FG, 92, 'Space Grotesk', 'Bold');
  name.layout(maxText);
  const meta = paragraph(`HTB · ${os} · ${label} · certifa.net`, FG_2, 32, 'JetBrains Mono', 'Normal');
  meta.layout(maxText);

  // Avatar, title and meta as one vertically centred stack.
  const gapA = 44;
  const gapB = 24;
  const total = OG_AVATAR + gapA + name.getHeight() + gapB + meta.getHeight();
  let y = (OG_H - total) / 2;

  const ip = new CanvasKit.Paint();
  ip.setAntiAlias(true);
  canvas.drawImageRectOptions(
    img,
    CanvasKit.XYWHRect(0, 0, img.width(), img.height()),
    CanvasKit.XYWHRect(x, y, OG_AVATAR, OG_AVATAR),
    CanvasKit.FilterMode.Linear, CanvasKit.MipmapMode.None, ip,
  );
  ip.delete();
  img.delete();

  y += OG_AVATAR + gapA;
  canvas.drawParagraph(name, x, y);
  y += name.getHeight() + gapB;
  canvas.drawParagraph(meta, x, y);
  name.delete();
  meta.delete();

  const snapshot = surface.makeImageSnapshot();
  const png = snapshot.encodeToBytes();
  snapshot.delete();
  surface.delete();
  return Buffer.from(png);
}

const files = (await readdir(WRITEUPS)).filter((f) => f.endsWith('.md'));
let made = 0;

for (const file of files.sort()) {
  const slug = file.replace(/\.md$/, '');
  const box = slug.replace(/^htb-/, '');
  const avatar = path.join(AVATARS, `${box}.png`);

  // No avatar means a locked placeholder writeup: it carries no banner.
  if (!existsSync(avatar)) {
    console.log(`skip  ${box} (no avatar)`);
    continue;
  }

  const data = frontmatter(await readFile(path.join(WRITEUPS, file), 'utf8'));
  if (!data) {
    console.log(`skip  ${box} (frontmatter missing title/difficulty/os)`);
    continue;
  }

  await mkdir(path.join(OUT, box), { recursive: true });
  await writeFile(path.join(OUT, box, 'logo.png'), await banner(data, avatar));

  await mkdir(OG_OUT, { recursive: true });
  await writeFile(path.join(OG_OUT, `${box}.png`), await ogCard(data, avatar));

  console.log(`ok    ${box}  ${data.title} · ${data.os} · ${data.difficulty}`);
  made++;
}

console.log(`\n${made} banner(s) → ${OUT}/<box>/logo.png`);
console.log(`${made} share card(s) → ${OG_OUT}/<box>.png`);
