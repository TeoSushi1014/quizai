import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import dotenv from 'dotenv';
import react from '@vitejs/plugin-react';

// Load environment variables from .env file
dotenv.config();

export default defineConfig(({ mode }) => {
    // Also load from Vite's method which handles .env.[mode] files
    const env = loadEnv(mode, process.cwd(), '');
    
    // Determine the effective Gemini API key placeholder
    let geminiApiKeyFromProcessEnv = process.env.GEMINI_API_KEY;
    const defaultPlaceholder = 'AIzaSyDDcYcb1JB-NKFRDC28KK0yVH_Z3GX9lU0'; // Consistent default placeholder
    let effectiveGeminiApiKey: string;

    if (typeof geminiApiKeyFromProcessEnv === 'string' && geminiApiKeyFromProcessEnv.trim() !== '') {
        effectiveGeminiApiKey = geminiApiKeyFromProcessEnv;
        console.log(
            "Using Gemini API Key placeholder from environment variable process.env.GEMINI_API_KEY:",
            effectiveGeminiApiKey
        );
    } else {
        if (geminiApiKeyFromProcessEnv !== undefined && geminiApiKeyFromProcessEnv !== null) { // It was set but empty or not a valid string
             console.warn(
                `Warning: process.env.GEMINI_API_KEY was set to an invalid value ('${geminiApiKeyFromProcessEnv}'). ` +
                `Using default placeholder: '${defaultPlaceholder}'. ` +
                "Ensure process.env.GEMINI_API_KEY is a non-empty string placeholder."
            );
        } else { // It was not set at all
            console.warn(
                "Warning: Environment variable process.env.GEMINI_API_KEY was not set. " +
                `Using default placeholder: '${defaultPlaceholder}'. ` +
                "For production or specific configurations, it's recommended to set process.env.GEMINI_API_KEY to your desired placeholder (e.g., in your .env file or build environment)."
            );
        }
        effectiveGeminiApiKey = defaultPlaceholder;
    }
    
    return {
      base: "/quizai/",
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(effectiveGeminiApiKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(effectiveGeminiApiKey),
        'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(effectiveGeminiApiKey),
        // Add Supabase environment variables
        'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || 'https://jbuqonmeorldgiwvdror.supabase.co'),
        'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpidXFvbm1lb3JsZGdpd3Zkcm9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzMTY2MDQsImV4cCI6MjA2Mzg5MjYwNH0.vcMUnOgSPAgpigUOkkcopk5XH5AMyNjM772oUqTJGfo')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, 'src'),
        }
      }
    };
});
