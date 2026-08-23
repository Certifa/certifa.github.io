import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://certifa.net',
  integrations: [
    sitemap({
      // The forwarding stubs under /tags and /skills exist only so old links
      // resolve. Listing them would point crawlers at 49 noindex redirects
      // and bury the 14 pages that are actually the site.
      filter: (page) => !page.includes('/tags/') && !page.includes('/skills'),
    }),
  ],
  output: 'static',
  // /skills was a real page from 2026-03-04 to 2026-05-04. Its content is
  // now the 'kit' section of the about page. Astro emits a meta-refresh
  // page for these in a static build, since Pages cannot issue a 301.
  redirects: {
    '/skills': '/about',
  },
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
