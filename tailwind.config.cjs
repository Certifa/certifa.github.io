/** @type {import('tailwindcss').Config} */

// Unified token system, reconciled from the six AIDesigner exports.
// Five of the six agreed on the #4ade80 accent; the backgrounds ranged across
// #040405 / #050505 / #09090b / #0a0a0c, so #09090b is the settled base.
module.exports = {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#09090b',
        surface: '#0f0f12',
        surfaceHover: '#161619',
        border: '#1f1f23',
        borderHover: '#3f3f46',
        muted: '#71717a',
        fg: '#e4e4e7',
        accent: {
          DEFAULT: '#4ade80',
          dim: 'rgba(74, 222, 128, 0.1)',
          faint: 'rgba(74, 222, 128, 0.05)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        display: ['"Space Grotesk"', 'Inter', 'sans-serif'],
        serif: ['Newsreader', 'Georgia', 'serif'], // 404 accent word only
      },
      maxWidth: {
        shell: '72rem',
      },
    },
  },
  plugins: [],
};
