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
        navy: { DEFAULT: token('navy'), soft: token('navy-soft'), muted: token('navy-muted') },
        accent: token('accent'),
      },
      fontFamily: {
        sans: ['"Inter Variable"', '"Noto Sans Malayalam"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: { card: '8px' },
      boxShadow: {
        card: '0 2px 6px rgb(15 42 74 / 0.05), 0 10px 24px rgb(15 42 74 / 0.04)',
        lift: '0 14px 32px rgb(15 42 74 / 0.14)',
        button: '0 4px 10px rgb(37 99 235 / 0.22)',
        'button-hover': '0 8px 18px rgb(37 99 235 / 0.28)',
      },
      backgroundImage: {
        hero: 'linear-gradient(115deg, rgb(15 42 74) 0%, rgb(29 78 216) 58%, rgb(13 148 136) 100%)',
      },
    },
  },
  plugins: [],
};
