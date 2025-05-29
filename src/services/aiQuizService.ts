
import { Quiz, QuizConfig } from "../types";
import { generateQuizWithGemini } from "./geminiService";
import { GEMINI_MODEL_ID } from "../constants"; 
import { logger } from './logService';

export const generateQuizWithSelectedModel = async (
  content: string | { base64Data: string; mimeType: string },
  config: QuizConfig,
  titleSuggestion?: string
): Promise<Omit<Quiz, 'id' | 'createdAt'>> => {
  
  if (config.selectedModel !== GEMINI_MODEL_ID) {
    logger.warn(`Unsupported model selected: ${config.selectedModel}. Defaulting to Gemini.`, 'aiQuizService', { selectedModel: config.selectedModel });
  }
  logger.info(`Generating quiz with model: ${GEMINI_MODEL_ID}`, 'aiQuizService', { titleSuggestion, config });
  try {
    const quizData = await generateQuizWithGemini(content, config, titleSuggestion);
    logger.info(`Quiz generated successfully by ${GEMINI_MODEL_ID}`, 'aiQuizService', { title: quizData.title, questionCount: quizData.questions.length });
    return quizData;
  } catch (error) {
    logger.error(`Error in generateQuizWithSelectedModel using ${GEMINI_MODEL_ID}`, 'aiQuizService', { config }, error as Error);
    throw error; // Re-throw to be handled by the caller
  }
};