import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    
    const geminiApiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    
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
