/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#e6f2ff',
          100: '#b3d9ff',
          200: '#80bfff',
          300: '#4da6ff',
          400: '#1a8cff',
          500: '#0052CC',  // Primary brand color
          600: '#0047b3',
          700: '#003d99',
          800: '#003280',
          900: '#002866',
        },
      },
    },
  },
  plugins: [],
}