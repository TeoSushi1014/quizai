import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import dotenv from 'dotenv';
import react from '@vitejs/plugin-react';

dotenv.config();

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const isProduction = mode === 'production';
    
    return {
      base: mode === 'development' ? '/' : '/quizai/',
      plugins: [
        react()
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(''),
        'process.env.GEMINI_API_KEY': JSON.stringify(''),
        'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(''),
        'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || 'https://jbuqonmeorldgiwvdror.supabase.co'),
        'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpidXFvbm1lb3JsZGdpd3Zkcm9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzMTY2MDQsImV4cCI6MjA2Mzg5MjYwNH0.vcMUnOgSPAgpigUOkkcopk5XH5AMyNjM772oUqTJGfo')
      },
      build: {
        // Use terser for better minification if available
        minify: 'terser',
        terserOptions: {
          compress: {
            drop_console: isProduction,
            drop_debugger: isProduction
          }
        },
        // Improve chunk size warning limit
        chunkSizeWarningLimit: 1000,
        rollupOptions: {
          output: {
            // More granular manual chunking for better cache efficiency
            manualChunks: {
              vendor: ['react', 'react-dom', 'react-router-dom'],
              ui: ['@headlessui/react', 'framer-motion'],
              markdown: ['react-markdown', 'remark-gfm', 'rehype-katex'],
              math: ['katex', 'react-katex', 'remark-math', 'rehype-katex'],
              i18n: ['i18next', 'react-i18next'],
              utils: ['localforage', 'mammoth', 'pdfjs-dist']
            }
          }
        },
        sourcemap: mode === 'development',
        // Cache assets during build
        assetsInlineLimit: 4096,
        // Improve CSS code splitting
        cssCodeSplit: true
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, 'src'),
        }
      },
      optimizeDeps: {
        // Improve dependency pre-bundling
        include: [
          'react', 
          'react-dom', 
          'react-router-dom',
          '@headlessui/react',
          'framer-motion',
          'i18next',
          'react-i18next'
        ],
        // Force prebundle the following dependencies
        force: true
      },
      server: {
        fs: {
          strict: false
        },
        // Warmup frequently accessed files to reduce initial load time
        warmup: {
          clientFiles: [
            './src/App.tsx',
            './src/components/ui.tsx',
            './src/components/ThemeToggle.tsx'
          ]
        }
      },
      // Reduce deprecation warnings
      esbuild: {
        legalComments: 'none'
      },
    };
});
