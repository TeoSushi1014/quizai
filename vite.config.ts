import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import dotenv from 'dotenv';
import react from '@vitejs/plugin-react';

dotenv.config();

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    
    return {
      base: "/quizai/",
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(''),
        'process.env.GEMINI_API_KEY': JSON.stringify(''),
        'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(''),
        'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || 'https://jbuqonmeorldgiwvdror.supabase.co'),
        'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpidXFvbm1lb3JsZGdpd3Zkcm9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzMTY2MDQsImV4cCI6MjA2Mzg5MjYwNH0.vcMUnOgSPAgpigUOkkcopk5XH5AMyNjM772oUqTJGfo')
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks: {
              vendor: ['react', 'react-dom'],
              router: ['react-router-dom'],
              ui: ['@headlessui/react', 'framer-motion'],
              markdown: ['react-markdown', 'remark-gfm', 'rehype-katex'],
              utils: ['localforage', 'mammoth', 'pdfjs-dist']
            }
          }
        },
        sourcemap: mode === 'development'
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, 'src'),
        }
      }
    };
});
