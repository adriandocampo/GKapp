/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        serif: ['Playfair Display', 'Georgia', 'serif'],
      },
      colors: {
        gk: {
          page: '#080c14',
          card: '#0f1419',
          elevated: '#141b24',
          border: '#1e293b',
          'border-hover': '#2d3a4a',
          'text-primary': '#f1f5f9',
          'text-secondary': '#94a3b8',
          'text-tertiary': '#64748b',
          accent: '#d4a574',
          'accent-hover': '#e8b87a',
          'accent-muted': 'rgba(212, 165, 116, 0.15)',
        },
        stat: {
          teal: '#5a9e8f',
          sky: '#6b9cc4',
          amber: '#c4a35a',
          indigo: '#7a85c4',
          emerald: '#5a9e7a',
          rose: '#c47a7a',
        },
      },
    },
  },
  plugins: [],
}
