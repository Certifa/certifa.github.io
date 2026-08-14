import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://certifa.net',
  integrations: [sitemap()],
  output: 'static',
  build: {
    // Astro inlines small stylesheets into the HTML by default, which a
    // Content-Security-Policy without 'unsafe-inline' silently drops: the
    // <style> tag is in the DOM but produces no stylesheet. That is what left
    // the contact page unstyled while every other page was fine, since only
    // its CSS fell under the inlining threshold. Always emit a real file.
    inlineStylesheets: 'never',
  },
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
      wrap: true,
    },
  },
});
