/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        primary: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Helvetica', 'Arial', 'sans-serif', '"Apple Color Emoji"', '"Segoe UI Emoji"'],
      },
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.25s cubic-bezier(0.23, 1, 0.32, 1) forwards',
        'fade-in-up': 'fadeInUp 0.25s cubic-bezier(0.23, 1, 0.32, 1) forwards',
        'scale-in': 'scaleIn 0.15s cubic-bezier(0.23, 1, 0.32, 1) forwards',
        'slide-in-right': 'slideInRight 0.35s cubic-bezier(0.23, 1, 0.32, 1) forwards',
        'slide-in-up': 'slideInUp 0.25s cubic-bezier(0.23, 1, 0.32, 1) forwards',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        fadeInUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        slideInRight: {
          from: { opacity: '0', transform: 'translateX(20px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        slideInUp: {
          from: { transform: 'translateY(100%)', opacity: '0.8' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  // Optimize for production to reduce CSS size
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
  // In production, purge unused styles more aggressively
  future: {
    hoverOnlyWhenSupported: true,
    respectDefaultRingColorOpacity: true,
  },
  // Disable variants we don't use to reduce CSS size
  corePlugins: {
    // Example of disabling unused plugins
    // Remove any of these you actually use
    // container: false,
    // objectFit: false,
    // objectPosition: false,
  },
  // Enable JIT mode for smaller CSS output
  mode: 'jit',
}
