export default {
  plugins: {
    'tailwindcss/nesting': {},
    tailwindcss: {},
    autoprefixer: {},
    ...(process.env.NODE_ENV === 'production' ? {
      cssnano: {
        preset: ['default', { 
          discardComments: { removeAll: true },
          normalizeWhitespace: false,
          colormin: true,
          reduceIdents: false,
          // Disable media query merging as it can break mobile-first approaches
          mergeLonghand: true,
          // Only use safe CSS optimizations
          zindex: false,
        }]
      }
    } : {})
  },
}
