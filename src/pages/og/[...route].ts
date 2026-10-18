import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { OG_VERSION } from '../../utils/og';
import { getCanvas } from '../../utils/canvaskit';
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
// The headline is two lines because the site's own headings are: one line in
// bone, the next in crimson. A share card is the first thing anyone sees of
// this site, so it states the work rather than introducing the author.
const SHELL: Record<string, { eyebrow: string; headline: [string, string]; refs: string }> = {
  home: {
    eyebrow: 'OFFENSIVE SECURITY  ·  UTRECHT',
    headline: ['Break systems.', 'Document truth.'],
    refs: 'active directory  ·  linux  ·  web',
  },
  writeups: {
    eyebrow: 'WRITEUPS',
    headline: ['Notes,', 'after the flag.'],
    refs: `${entries.length} machines  ·  hack the box`,
  },
  about: {
    eyebrow: 'ABOUT',
    headline: ['A student who breaks', 'things for a grade.'],
    refs: 'active directory  ·  linux  ·  web',
  },
  projects: {
    eyebrow: 'PROJECTS',
    headline: ['Things built', 'on purpose.'],
    refs: 'labs  ·  tooling  ·  dashboards',
  },
  contact: {
    eyebrow: 'CONTACT',
    headline: ['Say something', 'worth reading.'],
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
const AVATAR = 150;
const GAP = 40;

// The new design's tokens (see global.css).
const ACCENT: [number, number, number] = [91, 140, 255];  // --accent  #5b8cff
const FG: [number, number, number] = [245, 245, 245];     // --text    #f5f5f5
const FG_2: [number, number, number] = [163, 163, 163];   // --muted   #a3a3a3
const FG_3: [number, number, number] = [132, 132, 132];   // --dim     #848484
const FG_4: [number, number, number] = [58, 58, 58];
const LINE: [number, number, number] = [34, 34, 34];      // --line    #222
const HEAD_DIM: [number, number, number] = [138, 138, 138]; // first headline line, as on the site

// The box art, oversized and blurred into an ambient field in the upper right.
// Per-box colour taken from the box's own identity: nothing invented, and the
// only colour the monochrome palette lets in.
// Drawn far wider than it needs to be so its own edge stays outside the mask:
// the gradient alone shapes the field, otherwise the art's boundary shows as a
// seam down the card.
const ART = 1150;
const ART_BLUR = 44;
const ART_SAT = 0.16;
const ART_GAIN = 0.55;
const ART_ALPHA = 0.44;
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


// ---- Dither, the way the site does it: a 4x4 Bayer threshold over a field of
// brightness values, drawn as small squares. Content is rasterised onto a tiny
// surface first (one pixel per dither cell), so type and art come out as the
// same blocky grain as the footer wordmark and the machine scenes.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const DPX = 4;

function rasterize(CK: any, cols: number, rows: number, draw: (c: any) => void): Uint8Array {
  const surf = CK.MakeSurface(cols, rows);
  const c = surf.getCanvas();
  c.clear(CK.BLACK);
  draw(c);
  const img = surf.makeImageSnapshot();
  const px = img.readPixels(0, 0, {
    width: cols, height: rows,
    colorType: CK.ColorType.RGBA_8888, alphaType: CK.AlphaType.Unpremul, colorSpace: CK.ColorSpace.SRGB,
  }) as Uint8Array;
  img.delete();
  surf.delete();
  return px;
}

function ditherField(
  CK: any, canvas: any, x: number, y: number, w: number, h: number,
  color: [number, number, number], value: (cx: number, cy: number, cols: number, rows: number) => number,
) {
  const cols = Math.ceil(w / DPX), rows = Math.ceil(h / DPX);
  const paint = new CK.Paint();
  paint.setColor(CK.Color(...color));
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const v = value(cx, cy, cols, rows);
      if (v > BAYER[(cy % 4) * 4 + (cx % 4)]) {
        canvas.drawRect(CK.XYWHRect(x + cx * DPX, y + cy * DPX, DPX - 1, DPX - 1), paint);
      }
    }
  }
  paint.delete();
}

/** The site's section frame: a hairline box with a plus mark on each corner. */
function frame(CK: any, canvas: any) {
  const M = 28, LINE_C = CK.Color(30, 30, 30), PLUS_C = CK.Color(90, 90, 90), P = 7;
  const p = new CK.Paint();
  p.setColor(LINE_C);
  canvas.drawRect(CK.XYWHRect(M, M, W - M * 2, 1), p);
  canvas.drawRect(CK.XYWHRect(M, H - M, W - M * 2, 1), p);
  canvas.drawRect(CK.XYWHRect(M, M, 1, H - M * 2), p);
  canvas.drawRect(CK.XYWHRect(W - M, M, 1, H - M * 2 + 1), p);
  p.setColor(PLUS_C);
  for (const [cx, cy] of [[M, M], [W - M, M], [M, H - M], [W - M, H - M]]) {
    canvas.drawRect(CK.XYWHRect(cx - P, cy, P * 2 + 1, 1), p);
    canvas.drawRect(CK.XYWHRect(cx, cy - P, 1, P * 2 + 1), p);
  }
  p.delete();
}

// CanvasKit and the fonts now live in src/utils/canvaskit.ts, shared with the
// profile banner route so the wasm and faces load once for the whole build.

export const GET: APIRoute = async ({ props }) => {
  const { slug, data, shell } = props as { slug: string; data: any; shell: any };
  const { CanvasKit, fontMgr } = await getCanvas();

  const surface = CanvasKit.MakeSurface(W, H);
  const canvas = surface.getCanvas();

  const bg = new CanvasKit.Paint();
  bg.setShader(
    CanvasKit.Shader.MakeLinearGradient(
      [0, 0], [0, H],
      [CanvasKit.Color(14, 14, 14), CanvasKit.Color(10, 10, 10)],
      null, CanvasKit.TileMode.Clamp,
    ),
  );
  canvas.drawRect(CanvasKit.XYWHRect(0, 0, W, H), bg);
  bg.delete();

  const avatarPath = `public/og-avatars/${slug.replace(/^htb-/, '')}.png`;
  const img = !shell && existsSync(avatarPath)
    ? CanvasKit.MakeImageFromEncoded(await readFile(avatarPath))
    : null;

  const src = img && CanvasKit.XYWHRect(0, 0, img.width(), img.height());

  frame(CanvasKit, canvas);

  if (shell) {
    // Rings going out from a point, in the accent: the same signal the contact
    // page sends out behind its form.
    const FX = 520, FY = 60, FW = W - FX - 40, FH = H - 120;
    ditherField(CanvasKit, canvas, FX, FY, FW, FH, ACCENT, (cx, cy, cols, rows) => {
      const ox = cols * 0.78, oy = rows * 0.42;
      const d = Math.hypot(cx - ox, (cy - oy) * 1.1);
      const fade = Math.max(0, 1 - d / (cols * 0.6));
      const ring = (0.5 + 0.5 * Math.sin(d * 0.42)) ** 9;
      // clear of the headline on the left and of the footer line below
      const left = Math.max(0, Math.min(1, (cx / cols - 0.3) / 0.4));
      const foot = Math.max(0, Math.min(1, (0.78 - cy / rows) / 0.1));
      return ring * 0.85 * fade * left * foot;
    });
  } else if (img) {
    // The box art, dithered grey and faded in from the left, the way each
    // machine's scene sits behind its title on the writeup page.
    const AW = 560, AX = W - AW - 36, AY = 56, AH = H - 112;
    const cols = Math.ceil(AW / DPX), rows = Math.ceil(AH / DPX);
    const px = rasterize(CanvasKit, cols, rows, (c) => {
      const pa = new CanvasKit.Paint();
      pa.setAntiAlias(true);
      const side = Math.min(cols, rows) * 1.05;
      c.drawImageRectOptions(
        img, src,
        CanvasKit.XYWHRect(cols - side - cols * 0.02, (rows - side) / 2, side, side),
        CanvasKit.FilterMode.Linear, CanvasKit.MipmapMode.None, pa,
      );
      pa.delete();
    });
    ditherField(CanvasKit, canvas, AX, AY, AW, AH, [150, 150, 150], (cx, cy) => {
      const i = (cy * cols + cx) * 4;
      const lum = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
      const left = Math.max(0, Math.min(1, (cx / cols - 0.3) / 0.4));
      const right = 1 - Math.max(0, cx / cols - 0.9) * 6;
      const foot = Math.max(0, Math.min(1, (0.78 - cy / rows) / 0.1));
      return lum * 0.9 * left * right * foot;
    });
  }

  const para = (
    text: string,
    color: [number, number, number],
    size: number,
    family: string,
    weight: string,
    opts: { align?: any; tracking?: number; width?: number; leading?: number } = {},
  ) => {
    const style = new CanvasKit.ParagraphStyle({
      textStyle: {
        color: CanvasKit.Color(...color),
        fontFamilies: [family],
        fontSize: size,
        fontStyle: { weight: CanvasKit.FontWeight[weight] },
        // Display type set at this size needs its leading pulled in well under
        // the 1.15 that suits a line of body copy, or the two headline lines
        // read as two separate statements instead of one.
        heightMultiplier: opts.leading ?? 1.15,
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
    FG_3, 22, 'Geist Mono', 'Normal', { tracking: 4 },
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
    FG_3, 24, 'Geist Mono', 'Normal',
  );
  canvas.drawParagraph(refs, PAD, footTop);
  const site = para('certifa.net', FG_2, 24, 'Geist Mono', 'Normal', {
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

  // Shell cards stop here: two-line headline, no meter, no OS line.
  if (shell) {
    const lines = shell.headline as string[];
    const LEADING = 1.0;
    const CAP = 112;
    const maxW = W - PAD * 2;

    // The longest headline still sets far wider than
    // the shortest at the same size. Measure each line's real set width and scale
    // the whole block down until the longest fits the column, so a headline
    // never wraps into a third line and the two cards never disagree on size
    // for the same reason.
    let size = CAP;
    for (const l of lines) {
      const probe = para(l, FG, CAP, 'Geist', 'SemiBold', { width: 100000, leading: LEADING, tracking: -3 });
      const w = probe.getMaxIntrinsicWidth?.() ?? probe.getLongestLine?.() ?? 0;
      probe.delete();
      if (w > maxW) size = Math.min(size, Math.floor(CAP * (maxW / w)));
    }

    const drawn = lines.map((l, i) =>
      para(l, i === 0 ? HEAD_DIM : FG, size, 'Geist', 'SemiBold', { width: maxW, leading: LEADING, tracking: -3 }));

    // Bottom-anchored against the footer rule. Centring the block in the band
    // left a hollow middle with the type floating in it; sitting it low echoes
    // the site's hero, where the heading rests near the foot of the viewport.
    const blockH = drawn.reduce((s, p) => s + p.getHeight(), 0);
    let y = ruleY - 58 - blockH;
    for (const p of drawn) {
      canvas.drawParagraph(p, PAD, y);
      y += p.getHeight();
      p.delete();
    }

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
  // Matched to the weight the shell cards carry: the longest box name is ten
  // characters, which still sets well inside the column left of the avatar.
  const title = para(data.title, FG, 112, 'Geist', 'SemiBold', { width: W - textX - PAD, leading: 1.0, tracking: -3 });
  const meta = para(`${os}  ·  ${label}`, FG_2, 26, 'Geist Mono', 'Normal', {
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
