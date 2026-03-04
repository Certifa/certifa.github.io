/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#06060e',
        'bg-secondary': '#0a0a0f',
        accent: '#00e5ff',
        accent2: '#8b5cf6',
        'text-base': '#c8cad0',
        'text-bright': '#eaedf3',
        'text-dim': '#555a6e',
        green: '#22d37e',
      },
      fontFamily: {
        mono: ['"Space Mono"', 'Courier New', 'monospace'],
        sans: ['Outfit', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 20px rgba(0, 229, 255, 0.3)',
        'glow-lg': '0 0 40px rgba(0, 229, 255, 0.2)',
        card: '0 4px 32px rgba(0, 0, 0, 0.5)',
      },
    },
  },
  plugins: [],
};
