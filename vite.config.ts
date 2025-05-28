import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

export default defineConfig(({ mode }) => {
    // Also load from Vite's method which handles .env.[mode] files
    const env = loadEnv(mode, process.cwd(), '');
    
    // Try multiple sources for API key with priorities:
    // 1. dotenv loaded vars from .env
    // 2. env vars from loadEnv (which handles .env.[mode] files)
    // 3. process.env directly (for CI/CD)
    const geminiApiKey = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY;
    
    console.log("Building with Gemini API Key:", geminiApiKey ? "Found" : "Not found");
    
    return {
      base: "/quizai/",
      define: {
        'process.env.API_KEY': JSON.stringify(geminiApiKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(geminiApiKey)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
