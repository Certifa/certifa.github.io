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
const BAR = 12;
const AVATAR = 150;
const GAP = 40;

const ACCENT: [number, number, number] = [193, 31, 31];  // --blood   #c11f1f
const FG: [number, number, number] = [232, 230, 226];    // --bone    #e8e6e2
const FG_2: [number, number, number] = [165, 161, 154];  // --read    #a5a19a
const FG_3: [number, number, number] = [125, 122, 117];  // --dim     #7d7a75
const FG_4: [number, number, number] = [78, 75, 71];     // --dimmer  #4e4b47
const LINE: [number, number, number] = [27, 25, 32];     // --line    #1b1920

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
      [CanvasKit.Color(11, 10, 13), CanvasKit.Color(5, 4, 6)],  // --panel → --void
      null, CanvasKit.TileMode.Clamp,
    ),
  );
  canvas.drawRect(CanvasKit.XYWHRect(0, 0, W, H), bg);
  bg.delete();

  const avatarPath = `public/og-avatars/${slug.replace(/^htb-/, '')}.png`;
  const img = !shell && existsSync(avatarPath)
    ? CanvasKit.MakeImageFromEncoded(await readFile(avatarPath))
    : null;

  // Crimson bloom in the upper right. On shell pages it is the only thing
  // carrying that weight; on writeup cards it tints the desaturated box art
  // beneath it, so both kinds of card sit in the same room.
  {
    const glow = new CanvasKit.Paint();
    glow.setShader(
      CanvasKit.Shader.MakeRadialGradient(
        [W - 170, 120], 640,
        [CanvasKit.Color(...ACCENT, shell ? 0.16 : 0.30), CanvasKit.Color(...ACCENT, 0)],
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

  // Shell cards stop here: two-line headline, no meter, no OS line.
  if (shell) {
    const lines = shell.headline.map((l) => l.toUpperCase());
    const LEADING = 0.92;
    const CAP = 132;
    const maxW = W - PAD * 2;

    // Anton is condensed, but "A STUDENT WHO BREAKS" still sets far wider than
    // "NOTES," at the same size. Measure each line's real set width and scale
    // the whole block down until the longest fits the column, so a headline
    // never wraps into a third line and the two cards never disagree on size
    // for the same reason.
    let size = CAP;
    for (const l of lines) {
      const probe = para(l, FG, CAP, 'Anton', 'Normal', { width: 100000, leading: LEADING });
      const w = probe.getMaxIntrinsicWidth?.() ?? probe.getLongestLine?.() ?? 0;
      probe.delete();
      if (w > maxW) size = Math.min(size, Math.floor(CAP * (maxW / w)));
    }

    const drawn = lines.map((l, i) =>
      para(l, i === 0 ? FG : ACCENT, size, 'Anton', 'Normal', { width: maxW, leading: LEADING }));

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
  const title = para(data.title.toUpperCase(), FG, 116, 'Anton', 'Normal', { width: W - textX - PAD });
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
