// Phase 7: PurgeCSS to strip unused selectors from src/index.css.
//
// Only active in production builds (`vite build` / `NODE_ENV=production`).
// `vite dev` keeps the full stylesheet so iterations stay fast and we never
// hide a missing-class bug behind purging.
//
// Safelist strategy: CONSERVATIVE. We'd rather keep a few unused selectors
// than break a runtime-only class. When tightening the safelist, do it in
// a dedicated PR with screenshot diffs of every stage + every panel.

const purgeCss = require('@fullhuman/postcss-purgecss').default || require('@fullhuman/postcss-purgecss');

module.exports = ({ env } = {}) => {
  // Vite passes env='development' for dev server, env='production' for build.
  const isProd = env === 'production' || process.env.NODE_ENV === 'production';
  if (!isProd) return { plugins: [] };

  return {
    plugins: [
      purgeCss({
        content: [
          './index.html',
          './src/**/*.{ts,tsx,js,jsx,html}',
        ],
        // Default extractor splits on non-word characters; tweak to also
        // accept BEM modifiers (-- and __) and the kebab-case we actually use.
        defaultExtractor: (content) => content.match(/[A-Za-z0-9_-]+/g) || [],
        safelist: {
          // Always keep (string literal or regex):
          standard: [
            // Root layout
            'app-shell',
            'app-canvas-stage',
            // Generic state classes used across many components
            'active',
            'affordable',
            'expanding',
            'expanded',
            'locked',
            'open',
            'owned',
            'seen',
            'show',
            'unlocked',
            'visible',
            'hidden',
            // Transitional / animation states
            'stage-revealing',
          ],
          // Whitelist patterns matching class NAMES (not selectors as a whole).
          deep: [
            // BEM modifier suffixes that get appended via template literals
            /--active$/,
            /--filled$/,
            /--locked$/,
            /--open$/,
            /--me$/,
            /--completed$/,
            /--on$/,
            /--off$/,
            /--free$/,
            /--unlocked$/,
            /--selected$/,
            /--highlighted$/,
            /--disabled$/,
            // Numeric BEM variants (entity-glyph dots/satellites/auras/cuts)
            /entity-glyph__(aura|cut|dot|satellite)--\d+$/,
            // Rarity variants
            /--(common|uncommon|rare|epic|legendary|mythic)$/,
            // Stage-specific variants
            /^stage-\d+/,
            /-stage-\d+$/,
            // Animation/transition state-classes
            /^anim-/,
            /^transition-/,
          ],
          // Greedy: only for class families with predictable runtime composition
          // that the extractor genuinely can't see. Everything else relies on
          // the extractor finding literal class names in .ts/.tsx.
          greedy: [
            // Toasts/animations whose classes are appended by JS at runtime
            /^float-/,
            /^toast-/,
            // Stage transitions add classes via setState() that may not appear
            // verbatim in JSX (composed via dictionaries)
            /^stage-/,
            // BEM containers commonly composed dynamically
            /^entity-glyph/,
          ],
          // Preserve all @keyframes; classes that use animation: name ... may
          // reference these dynamically.
          keyframes: true,
          // Preserve all CSS custom properties (--name).
          variables: true,
        },
      }),
    ],
  };
};
