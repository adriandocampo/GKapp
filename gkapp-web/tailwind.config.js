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
          page: '#0c0b09',
          card: 'rgba(22, 20, 16, 0.85)',
          elevated: 'rgba(22, 20, 16, 0.6)',
          border: 'rgba(185, 165, 135, 0.10)',
          'border-hover': 'rgba(185, 165, 135, 0.20)',
          'text-primary': '#f1ede7',
          'text-secondary': '#baa587',
          'text-tertiary': '#997b66',
          accent: '#e8ac65',
          'accent-hover': '#ecbd83',
          'accent-muted': 'rgba(232, 172, 101, 0.15)',
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
