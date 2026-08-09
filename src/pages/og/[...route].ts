import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { OG_VERSION } from '../../utils/og';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

// One OG card per writeup, served at /og/<slug>.png.
//
// Laid out as an advisory header: eyebrow, identity block, hairline rule, then
// a footer of reference data. Deliberately carries nothing the link's own text
// preview already shows, so the title and description aren't said twice.
// Rendered directly with CanvasKit (astro-og-canvas only stacks logo over text).

const entries = await getCollection('writeups');

/**
 * Shell pages carry their own headline rather than the page name, for the same
 * reason the writeup cards omit the title: the link preview prints the name
 * already. Copy is lifted verbatim from each page so the card sounds like it.
 */
const SHELL: Record<string, { eyebrow: string; headline: string; refs: string }> = {
  home: {
    eyebrow: 'OFFENSIVE SECURITY  ·  UTRECHT',
    headline: "Hi, I'm Certifa.",
    refs: 'active directory  ·  linux  ·  web',
  },
  writeups: {
    eyebrow: 'WRITEUPS',
    headline: 'Notes, after the flag.',
    refs: `${entries.length} machines  ·  hack the box`,
  },
  about: {
    eyebrow: 'ABOUT',
    headline: 'A student who breaks things for a grade.',
    refs: 'active directory  ·  linux  ·  web',
  },
  projects: {
    eyebrow: 'PROJECTS',
    headline: 'Things built on purpose.',
    refs: 'labs  ·  tooling  ·  dashboards',
  },
  contact: {
    eyebrow: 'CONTACT',
    headline: "Let's talk.",
    refs: 'discord  ·  github  ·  hack the box  ·  email',
  },
};

export function getStaticPaths() {
  return [
    ...entries.map((e) => ({
      params: { route: `${OG_VERSION}/${e.slug}.png` },
      props: { slug: e.slug, data: e.data, shell: null },
    })),
    ...Object.entries(SHELL).map(([name, shell]) => ({
      params: { route: `${OG_VERSION}/${name}.png` },
      props: { slug: name, data: null, shell },
    })),
  ];
}

const W = 1200;
const H = 630;
const PAD = 72;
const BAR = 12;
const AVATAR = 150;
const GAP = 40;

const ACCENT: [number, number, number] = [74, 222, 128];  // --accent  #4ade80
const FG: [number, number, number] = [228, 228, 231];    // --fg      #e4e4e7
const FG_2: [number, number, number] = [161, 161, 170];  // --fg-2    #a1a1aa
const FG_3: [number, number, number] = [113, 113, 122];  // --fg-3    #71717a
const FG_4: [number, number, number] = [82, 82, 91];     // --fg-4    #52525b
const LINE: [number, number, number] = [31, 31, 35];     // --line    #1f1f23

// The box art, oversized and blurred into an ambient field in the upper right.
// Per-box colour taken from the box's own identity: nothing invented, and the
// only colour the monochrome palette lets in.
// Drawn far wider than it needs to be so its own edge stays outside the mask:
// the gradient alone shapes the field, otherwise the art's boundary shows as a
// seam down the card.
const ART = 1150;
const ART_BLUR = 44;
const ART_SAT = 0.72;
const ART_GAIN = 0.78;
const ART_ALPHA = 0.5;
const ART_FADE_IN = 470;

// Difficulty as an ordinal meter: "hard" on its own never says 3rd of 4.
const SCALE = ['easy', 'medium', 'hard', 'insane'];
const TICK_W = 18;
const TICK_H = 7;
const TICK_GAP = 6;

/** Saturation matrix with a gain that keeps bright art from blowing out. */
function saturation(s: number, gain: number): number[] {
  const [lr, lg, lb] = [0.2126, 0.7152, 0.0722];
  const m = [
    (1 - s) * lr + s, (1 - s) * lg, (1 - s) * lb,
    (1 - s) * lr, (1 - s) * lg + s, (1 - s) * lb,
    (1 - s) * lr, (1 - s) * lg, (1 - s) * lb + s,
  ].map((v) => v * gain);
  return [m[0], m[1], m[2], 0, 0, m[3], m[4], m[5], 0, 0, m[6], m[7], m[8], 0, 0, 0, 0, 0, 1, 0];
}

/**
 * The footer's reference line: CVEs first since they identify the finding,
 * then whatever techniques follow. OS is dropped, the meta line states it.
 */
function reference(tags: string[]): string {
  const usable = tags.filter((t) => !['linux', 'windows'].includes(t.toLowerCase()));
  const isCve = (t: string) => /^cve-/i.test(t);
  return [...usable.filter(isCve), ...usable.filter((t) => !isCve(t))]
    .slice(0, 3)
    .map((t) => (isCve(t) ? t.toUpperCase() : t.toLowerCase()))
    .join('  ·  ');
}

// Lazily initialise CanvasKit + fonts once, reused across every image.
let _ck: any;
let _fontMgr: any;
async function getCanvas() {
  if (_ck) return { CanvasKit: _ck, fontMgr: _fontMgr };
  const require = createRequire(import.meta.url);
  const CanvasKitInit = require('canvaskit-wasm/bin/canvaskit.js');
  const ckDir = path.dirname(require.resolve('canvaskit-wasm/bin/canvaskit.js'));
  _ck = await CanvasKitInit({ locateFile: (f: string) => path.join(ckDir, f) });
  const [display, jetbrains] = await Promise.all([
    readFile(path.resolve('src/assets/og-fonts/space-grotesk-700.ttf')),
    readFile(path.resolve('src/assets/og-fonts/jetbrains-400.ttf')),
  ]);
  _fontMgr = _ck.FontMgr.FromData(display, jetbrains);
  return { CanvasKit: _ck, fontMgr: _fontMgr };
}

export const GET: APIRoute = async ({ props }) => {
  const { slug, data, shell } = props as { slug: string; data: any; shell: any };
  const { CanvasKit, fontMgr } = await getCanvas();

  const surface = CanvasKit.MakeSurface(W, H);
  const canvas = surface.getCanvas();

  const bg = new CanvasKit.Paint();
  bg.setShader(
    CanvasKit.Shader.MakeLinearGradient(
      [0, 0], [0, H],
      [CanvasKit.Color(15, 15, 18), CanvasKit.Color(9, 9, 11)],  // --bg-2 → --bg
      null, CanvasKit.TileMode.Clamp,
    ),
  );
  canvas.drawRect(CanvasKit.XYWHRect(0, 0, W, H), bg);
  bg.delete();

  const avatarPath = `public/og-avatars/${slug.replace(/^htb-/, '')}.png`;
  const img = !shell && existsSync(avatarPath)
    ? CanvasKit.MakeImageFromEncoded(await readFile(avatarPath))
    : null;

  // Shell pages have no box art, so the accent supplies the same upper-right
  // weight: one soft azure bloom, well under the level that would fight text.
  if (shell) {
    const glow = new CanvasKit.Paint();
    glow.setShader(
      CanvasKit.Shader.MakeRadialGradient(
        [W - 170, 120], 640,
        [CanvasKit.Color(...ACCENT, 0.16), CanvasKit.Color(...ACCENT, 0)],
        [0, 1], CanvasKit.TileMode.Clamp,
      ),
    );
    canvas.drawRect(CanvasKit.XYWHRect(0, 0, W, H), glow);
    glow.delete();
  }
  const src = img && CanvasKit.XYWHRect(0, 0, img.width(), img.height());

  // Ambient field, masked so it only exists to the right of the type.
  if (img) {
    canvas.saveLayer();
    const art = new CanvasKit.Paint();
    art.setAntiAlias(true);
    art.setAlphaf(ART_ALPHA);
    art.setImageFilter(
      CanvasKit.ImageFilter.MakeColorFilter(
        CanvasKit.ColorFilter.MakeMatrix(saturation(ART_SAT, ART_GAIN)),
        CanvasKit.ImageFilter.MakeBlur(ART_BLUR, ART_BLUR, CanvasKit.TileMode.Decal, null),
      ),
    );
    canvas.drawImageRectOptions(
      img, src,
      CanvasKit.XYWHRect(W - ART + 330, -ART * 0.40, ART, ART),
      CanvasKit.FilterMode.Linear, CanvasKit.MipmapMode.None, art,
    );
    const mask = new CanvasKit.Paint();
    mask.setBlendMode(CanvasKit.BlendMode.DstIn);
    mask.setShader(
      CanvasKit.Shader.MakeLinearGradient(
        [ART_FADE_IN, 0], [W, 0],
        [
          CanvasKit.Color(255, 255, 255, 0),
          CanvasKit.Color(255, 255, 255, 1),
          CanvasKit.Color(255, 255, 255, 0.45),
        ],
        [0, 0.55, 1], CanvasKit.TileMode.Clamp,
      ),
    );
    canvas.drawRect(CanvasKit.XYWHRect(0, 0, W, H), mask);
    mask.delete();
    art.delete();
    canvas.restore();
  }

  const bar = new CanvasKit.Paint();
  bar.setColor(CanvasKit.Color(...ACCENT));
  canvas.drawRect(CanvasKit.XYWHRect(0, 0, BAR, H), bar);
  bar.delete();

  const para = (
    text: string,
    color: [number, number, number],
    size: number,
    family: string,
    weight: string,
    opts: { align?: any; tracking?: number; width?: number } = {},
  ) => {
    const style = new CanvasKit.ParagraphStyle({
      textStyle: {
        color: CanvasKit.Color(...color),
        fontFamilies: [family],
        fontSize: size,
        fontStyle: { weight: CanvasKit.FontWeight[weight] },
        heightMultiplier: 1.15,
        letterSpacing: opts.tracking ?? 0,
      },
      textAlign: opts.align ?? CanvasKit.TextAlign.Left,
    });
    const builder = CanvasKit.ParagraphBuilder.Make(style, fontMgr);
    builder.addText(text);
    const p = builder.build();
    p.layout(opts.width ?? W - PAD * 2);
    builder.delete();
    return p;
  };

  // Eyebrow: orients the reader without repeating the link's own title.
  const eyebrow = para(
    shell ? shell.eyebrow : 'HACK THE BOX  ·  WRITEUP',
    FG_3, 22, 'JetBrains Mono', 'Normal', { tracking: 4 },
  );
  canvas.drawParagraph(eyebrow, PAD, PAD);

  // Footer: hairline rule over reference data and the signature.
  const footTop = H - PAD - 34;
  const ruleY = footTop - 40;
  const rule = new CanvasKit.Paint();
  rule.setColor(CanvasKit.Color(...LINE));
  canvas.drawRect(CanvasKit.XYWHRect(PAD, ruleY, W - PAD * 2, 2), rule);
  rule.delete();

  const refs = para(
    shell ? shell.refs : reference(data.tags ?? []),
    FG_3, 24, 'JetBrains Mono', 'Normal',
  );
  canvas.drawParagraph(refs, PAD, footTop);
  const site = para('certifa.net', FG_2, 24, 'JetBrains Mono', 'Normal', {
    align: CanvasKit.TextAlign.Right,
  });
  canvas.drawParagraph(site, PAD, footTop);

  // Identity block, centred in the space the eyebrow and rule leave behind.
  const bandTop = PAD + eyebrow.getHeight();
  const mid = bandTop + (ruleY - bandTop) / 2;
  let textX = PAD;

  if (img) {
    const ip = new CanvasKit.Paint();
    ip.setAntiAlias(true);
    canvas.drawImageRectOptions(
      img, src,
      CanvasKit.XYWHRect(PAD, mid - AVATAR / 2, AVATAR, AVATAR),
      CanvasKit.FilterMode.Linear, CanvasKit.MipmapMode.None, ip,
    );
    ip.delete();
    textX = PAD + AVATAR + GAP;
  }

  // Shell cards stop here: headline set to wrap, no meter, no OS line.
  if (shell) {
    const headline = para(shell.headline, FG, 62, 'Space Grotesk', 'Bold', { width: 880 });
    canvas.drawParagraph(headline, PAD, mid - headline.getHeight() / 2);
    headline.delete();

    eyebrow.delete();
    refs.delete();
    site.delete();

    const shot = surface.makeImageSnapshot();
    const bytes = shot.encodeToBytes();
    shot.delete();
    surface.delete();
    return new Response(Buffer.from(bytes), {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' },
    });
  }

  // The eyebrow already names the platform, so the meta line carries the OS.
  const tags: string[] = (data.tags ?? []).map((t: string) => t.toLowerCase());
  const os = tags.includes('windows') ? 'Windows' : tags.includes('linux') ? 'Linux' : data.platform;
  const label = data.difficulty[0].toUpperCase() + data.difficulty.slice(1);
  const title = para(data.title, FG, 88, 'Space Grotesk', 'Bold', { width: W - textX - PAD });
  const meta = para(`${os}  ·  ${label}`, FG_2, 26, 'JetBrains Mono', 'Normal', {
    width: W - textX - PAD,
  });

  const groupGap = 22;
  const top = mid - (title.getHeight() + groupGap + meta.getHeight()) / 2;
  canvas.drawParagraph(title, textX, top);

  const metaTop = top + title.getHeight() + groupGap;
  const filled = SCALE.indexOf(data.difficulty) + 1;
  const tick = new CanvasKit.Paint();
  for (let i = 0; i < SCALE.length; i++) {
    tick.setColor(CanvasKit.Color(...(i < filled ? ACCENT : FG_4)));
    canvas.drawRect(
      CanvasKit.XYWHRect(
        textX + i * (TICK_W + TICK_GAP),
        metaTop + meta.getHeight() / 2 - TICK_H / 2,
        TICK_W, TICK_H,
      ),
      tick,
    );
  }
  tick.delete();
  canvas.drawParagraph(meta, textX + SCALE.length * (TICK_W + TICK_GAP) + 20, metaTop);

  eyebrow.delete();
  refs.delete();
  site.delete();
  title.delete();
  meta.delete();
  img?.delete();

  const snapshot = surface.makeImageSnapshot();
  const png = snapshot.encodeToBytes();
  snapshot.delete();
  surface.delete();

  return new Response(Buffer.from(png), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
};
