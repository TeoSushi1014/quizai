
import { Quiz, QuizConfig } from "../types";
import { generateQuizWithGemini } from "./geminiService";
import { GEMINI_MODEL_ID } from "../constants"; 

export const generateQuizWithSelectedModel = async (
  content: string | { base64Data: string; mimeType: string },
  config: QuizConfig,
  titleSuggestion?: string
): Promise<Omit<Quiz, 'id' | 'createdAt'>> => {
  // Since only Gemini is supported, we can call it directly.
  // The config.selectedModel will always be 'gemini'.
  if (config.selectedModel !== GEMINI_MODEL_ID) {
    // This case should ideally not happen if QuizCreatePage defaults correctly
    console.warn(`Unsupported model selected: ${config.selectedModel}. Defaulting to Gemini.`);
  }
  return generateQuizWithGemini(content, config, titleSuggestion);
};