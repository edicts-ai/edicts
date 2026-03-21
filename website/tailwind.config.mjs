/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0a0a0f',
        'bg-surface': '#13131a',
        'bg-surface-hover': '#1c1c26',
        'border-subtle': '#2a2a35',
        'text-primary': '#ededf0',
        'text-secondary': '#9494a0',
        accent: '#d4a843',
        'accent-hover': '#e0bc5f',
        'accent-muted': 'rgba(212, 168, 67, 0.12)',
        'code-bg': '#0f1117',
        success: '#34d399',
        danger: '#f87171',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
