import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import dotenv from 'dotenv';
import react from '@vitejs/plugin-react';

// Load environment variables from .env file
dotenv.config();

export default defineConfig(({ mode }) => {
    // Also load from Vite's method which handles .env.[mode] files
    const env = loadEnv(mode, process.cwd(), '');
    
    // Per user instruction, process.env.GEMINI_API_KEY is set to a placeholder.
    // Use this value directly. This ensures that the placeholder is used and
    // the app does not accidentally pick up a real API key from other environment variables
    // (e.g., from .env files via the `env` object if process.env.GEMINI_API_KEY was unset).
    const geminiApiKey = process.env.GEMINI_API_KEY;
    
    console.log(
        "Building with Gemini API Key (should be placeholder from process.env.GEMINI_API_KEY):",
        geminiApiKey ? "Found" : "Not found/unset"
    );
    if (!geminiApiKey) {
        console.warn(
            "Warning: process.env.GEMINI_API_KEY is not set. " +
            "The application expects this to be a placeholder for the Gemini API key. " +
            "AI features may not work as expected if this is not provided by the environment or a .env file."
        );
    }
    
    return {
      base: "/quizai/",
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(geminiApiKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(geminiApiKey),
        'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(geminiApiKey)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, 'src'),
        }
      }
    };
});
