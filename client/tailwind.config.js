/** Colours come from CSS variables (src/styles/index.css) so the theme is changed in one place. */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: token('primary-50'),
          100: token('primary-100'),
          200: token('primary-200'),
          500: token('primary-500'),
          600: token('primary-600'),
          DEFAULT: token('primary-700'),
          700: token('primary-700'),
          800: token('primary-800'),
          900: token('primary-900'),
        },
        canvas: token('canvas'),
        surface: token('surface'),
        line: token('line'),
        ink: { DEFAULT: token('ink'), soft: token('ink-soft'), muted: token('ink-muted') },
        success: { DEFAULT: token('success'), soft: token('success-soft') },
        warning: { DEFAULT: token('warning'), soft: token('warning-soft') },
        danger: { DEFAULT: token('danger'), soft: token('danger-soft') },
        chart: { billed: token('chart-billed'), collected: token('chart-collected') },
      },
      fontFamily: {
        sans: ['"Inter Variable"', '"Noto Sans Malayalam"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: { card: '10px' },
      boxShadow: {
        card: '0 1px 2px rgb(28 36 51 / 0.04)',
        lift: '0 8px 24px rgb(28 36 51 / 0.10)',
      },
    },
  },
  plugins: [],
};
