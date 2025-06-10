import { Quiz, QuizConfig } from "../types";
import { generateQuizWithGemini } from "./geminiService";
import { GEMINI_MODEL_ID } from "../constants"; 
import { logger } from './logService';

export const generateQuizWithSelectedModel = async (
  content: string | { base64Data: string; mimeType: string },
  config: QuizConfig,
  titleSuggestion?: string
): Promise<Omit<Quiz, 'id' | 'createdAt'>> => {
  try {
    // Use config.selectedModel instead of config.model
    if (config.selectedModel === GEMINI_MODEL_ID) { 
      const quizData = await generateQuizWithGemini(content, config, titleSuggestion);
      return quizData;
    } else {
      // Handle other models or throw an error if the model isn't supported
      const errorMessage = `Unsupported model: ${config.selectedModel}`;
      logger.error(errorMessage, 'aiQuizService', { config });
      throw new Error(errorMessage);
    }
  } catch (error) {
    // Use config.selectedModel here as well for consistent error logging
    logger.error(`Error in generateQuizWithSelectedModel using ${config.selectedModel || 'unknown model'}`, 'aiQuizService', { config }, error as Error);
    throw error;
  }
};