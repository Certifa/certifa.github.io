import type { APIRoute } from 'astro';
import { getCanvas, PALETTE } from '../../utils/canvaskit';

/**
 * Profile banner, served at /og/banner.png.
 *
 * Same identity as the share cards in a 4:1 shape, because a 1200x630 card
 * used as a README header renders about 500px tall and swamps the page.
 *
 * Deliberately not versioned like the OG cards. Those carry a version so the
 * social platforms re-scrape after a redesign; this one is linked from a
 * profile README that nobody will remember to update, so the URL has to stay
 * put. Redesigns overwrite it in place.
 */
const W = 1280;
const H = 320;
const PAD = 56;
const BAR = 10;

const LINES: [string, string] = ['Break systems.', 'Document truth.'];
const EYEBROW = 'OFFENSIVE SECURITY  ·  UTRECHT';

export const GET: APIRoute = async () => {
  const { CanvasKit, fontMgr } = await getCanvas();
  const surface = CanvasKit.MakeSurface(W, H);
  const canvas = surface.getCanvas();

  const para = (
    text: string,
    color: [number, number, number],
    size: number,
    family: string,
    opts: { tracking?: number; width?: number; leading?: number; align?: any } = {},
  ) => {
    const style = new CanvasKit.ParagraphStyle({
      textStyle: {
        color: CanvasKit.Color(...color),
        fontFamilies: [family],
        fontSize: size,
        heightMultiplier: opts.leading ?? 1.15,
        letterSpacing: opts.tracking ?? 0,
      },
      textAlign: opts.align ?? CanvasKit.TextAlign.Left,
    });
    const b = CanvasKit.ParagraphBuilder.Make(style, fontMgr);
    b.addText(text);
    const p = b.build();
    p.layout(opts.width ?? W - PAD * 2);
    b.delete();
    return p;
  };

  // ground: the same panel-to-void descent the pages use
  const bg = new CanvasKit.Paint();
  bg.setShader(
    CanvasKit.Shader.MakeLinearGradient(
      [0, 0], [0, H],
      [CanvasKit.Color(...PALETTE.panel), CanvasKit.Color(...PALETTE.void)],
      null, CanvasKit.TileMode.Clamp,
    ),
  );
  canvas.drawRect(CanvasKit.XYWHRect(0, 0, W, H), bg);
  bg.delete();

  // crimson bloom, upper right, so the frame is not flat
  const glow = new CanvasKit.Paint();
  glow.setShader(
    CanvasKit.Shader.MakeRadialGradient(
      [W - 190, 60], 520,
      [CanvasKit.Color(...PALETTE.blood, 0.22), CanvasKit.Color(...PALETTE.blood, 0)],
      [0, 1], CanvasKit.TileMode.Clamp,
    ),
  );
  canvas.drawRect(CanvasKit.XYWHRect(0, 0, W, H), glow);
  glow.delete();

  // the spine
  const bar = new CanvasKit.Paint();
  bar.setColor(CanvasKit.Color(...PALETTE.blood));
  canvas.drawRect(CanvasKit.XYWHRect(0, 0, BAR, H), bar);
  bar.delete();

  const eyebrow = para(EYEBROW, PALETTE.dim, 17, 'JetBrains Mono', { tracking: 3.4 });
  canvas.drawParagraph(eyebrow, PAD, 40);

  const site = para('certifa.net', PALETTE.read, 19, 'JetBrains Mono', {
    align: CanvasKit.TextAlign.Right,
  });
  canvas.drawParagraph(site, PAD, H - PAD - 4);

  // Headline, scaled so the longer of the two lines fits the column. Same rule
  // as the share cards: measure, then shrink, so it can never wrap.
  const LEADING = 0.92;
  const CAP = 84;
  const maxW = W - PAD * 2 - 200;   // room kept clear on the right for the bloom
  const upper = LINES.map((l) => l.toUpperCase());

  let size = CAP;
  for (const l of upper) {
    const probe = para(l, PALETTE.bone, CAP, 'Anton', { width: 100000, leading: LEADING });
    const w = probe.getMaxIntrinsicWidth?.() ?? probe.getLongestLine?.() ?? 0;
    probe.delete();
    if (w > maxW) size = Math.min(size, Math.floor(CAP * (maxW / w)));
  }

  const drawn = upper.map((l, i) =>
    para(l, i === 0 ? PALETTE.bone : PALETTE.blood, size, 'Anton', {
      width: maxW,
      leading: LEADING,
    }));

  const blockH = drawn.reduce((s, p) => s + p.getHeight(), 0);
  let y = (H - blockH) / 2 + 12;   // optically centred, allowing for the eyebrow above
  for (const p of drawn) {
    canvas.drawParagraph(p, PAD, y);
    y += p.getHeight();
    p.delete();
  }

  eyebrow.delete();
  site.delete();

  const shot = surface.makeImageSnapshot();
  const bytes = shot.encodeToBytes();
  shot.delete();
  surface.delete();

  return new Response(Buffer.from(bytes), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' },
  });
};
