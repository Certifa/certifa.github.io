// Raster icons, rendered from public/favicon.svg (the single source of truth).
//
// An SVG favicon covers modern browsers, but not all of them, and iOS needs a
// PNG for the home-screen icon. Run after editing the mark:
//   node scripts/make-icons.mjs

import sharp from 'sharp';

const SRC = 'public/favicon.svg';

const targets = [
  { out: 'public/favicon-32.png', size: 32 },
  { out: 'public/apple-touch-icon.png', size: 180 },
];

for (const { out, size } of targets) {
  // High density first so the strokes rasterise cleanly, then downsample.
  await sharp(SRC, { density: 1200 }).resize(size, size).png().toFile(out);
  console.log(`ok    ${out}  ${size}x${size}`);
}

console.log(`\n${targets.length} icon(s) written from ${SRC}`);
