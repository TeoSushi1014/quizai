import { GoogleGenAI, GenerateContentResponse, Part, Content } from "@google/genai";
import { Question, QuizConfig, Quiz, Language } from "../types";
import { GEMINI_TEXT_MODEL, GEMINI_MODEL_ID } from "../constants";
import { logger } from './logService';
import { getTranslator } from "../i18n"; // Import getTranslator

// Helper function to detect if content appears to be a formatted quiz
export const isFormattedQuiz = (content: string): boolean => {
  if (!content || typeof content !== 'string') return false;
  
  // Check for common quiz question patterns
  const questionPatterns = [
    // Match "Question X:" or "Câu X:" pattern (with or without a space after the number)
    /(?:Question|Câu)\s*\d+\s*[:)]/i,
    // Match line starting with number followed by period or parenthesis (e.g., "1. " or "1)")
    /^\s*\d+\s*[.)]\s*\S+/m,
    // Match questions inside text with "Question X:" or "Câu X:" pattern
    /\b(?:Question|Câu)\s*\d+\s*[:)]/i
  ];
  
  // Check for option patterns (A, B, C, D or similar)
  const optionPatterns = [
    // Match options with "A." format
    /[A-D]\s*\.\s*\S+/i,
    // Match options with "A)" format
    /[A-D]\s*\)\s*\S+/i,
    // Check for multiple sequential options (A followed by B, B followed by C, etc.)
    /[A]\s*[.)].*?[B]\s*[.)]/is,
    /[B]\s*[.)].*?[C]\s*[.)]/is,
    /[C]\s*[.)].*?[D]\s*[.)]/is
  ];
  
  // Check if we have at least one question pattern
  const hasQuestionFormat = questionPatterns.some(pattern => pattern.test(content));
  
  // Check if we have sufficient option patterns (need at least 2 option pattern matches)
  const optionMatches = optionPatterns.filter(pattern => pattern.test(content)).length;
  const hasOptionFormat = optionMatches >= 2;
  
  // Return true if we have both question and option patterns
  return hasQuestionFormat && hasOptionFormat;
  return hasQuestionFormat && hasOptionFormat;
};

let geminiAI: GoogleGenAI | null = null;

const initializeGeminiAI = (): GoogleGenAI => {
  if (!geminiAI) {
    const apiKeyFromEnv = process.env.GEMINI_API_KEY;
    
    if (typeof apiKeyFromEnv !== 'string' || !apiKeyFromEnv) {
      const errorMessage = "Google Gemini API Key (process.env.GEMINI_API_KEY) not set or not available to the client. Quiz generation may fail.";
      logger.error(errorMessage, "GeminiServiceInit");
      throw new Error(errorMessage); 
    }
    logger.info("Gemini AI SDK Initializing with API Key from process.env.GEMINI_API_KEY.", "GeminiServiceInit");
    geminiAI = new GoogleGenAI({ apiKey: apiKeyFromEnv });
  }
  return geminiAI;
};

const parseJsonFromMarkdown = <T,>(text: string): T | null => {
  let jsonStr = text.trim();
  const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
  const match = fenceRegex.exec(jsonStr);
  if (match && match[1]) {
    jsonStr = match[1].trim();
  }
  // Minimalistic cleaning for common AI artifacts if they are outside quoted strings
  // This is very basic; more robust cleaning might be needed if issues persist.
  jsonStr = jsonStr.replace(/侬/g, ''); 
  jsonStr = jsonStr.replace(/ܘ/g, ''); 
  jsonStr = jsonStr.replace(/对着/g, ''); 
  
  // Attempt to fix a very specific pattern of broken JSON strings due to newlines before closing quotes.
  // Example: "some text\n", -> "some text",
  // Example: "some text\n"} -> "some text"}
  // Example: "some text\n"] -> "some text"]
  jsonStr = jsonStr.replace(/"\s*```\s*([\]\},])/g, '"$1');
  jsonStr = jsonStr.replace(/"\s*```\s*(,"[^"]+")/g, '"$1');


  // Attempt to fix newlines within strings that break JSON.
  // This regex looks for a quoted string followed by a newline and then more unquoted text that seems like it should be part of the string.
  try {
    const patternString = "(\"[^\"\\\\]*(?:\\\\.[^\"\\\\]*)*\")\\s*\\n\\s*([a-zA-Z_][a-zA-Z0-9_]*(?:\\s+[a-zA-Z_][a-zA-Z0-9_]*)*\\s*)\"";
    const brokenStringRegex = new RegExp(patternString, "g");
    jsonStr = jsonStr.replace(brokenStringRegex, (_match, g1, g2) => `${g1.slice(0, -1)} ${g2.trim()}"`);
  } catch(e) {
    logger.warn("Error during string newline fixing regex replacement.", "GeminiServiceParse", undefined, e as Error);
  }

  // Remove trailing commas before closing braces or brackets
  jsonStr = jsonStr.replace(/,\s*([\}\]])/g, '$1');

  // Attempt to fix bad escapes (backslash not followed by a valid escape char)
  try {
    // This regex looks for a backslash NOT followed by a known escape character or unicode/hex escape.
    // If found, it doubles the backslash. This is risky and might need refinement.
    jsonStr = jsonStr.replace(/\\(?![bfnrtv"\\/]|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2})/g, '\\\\');
  } catch (e) {
    logger.warn("Error during bad escape fixing regex replacement.", "GeminiServiceParse", undefined, e as Error);
  }


  try {
    return JSON.parse(jsonStr) as T;
  } catch (e: any) {
    logger.error(
      `Primary JSON.parse failed for Gemini response.`, "GeminiServiceParse", 
      { errorMsg: e.message, 
        cleanedJsonPreview: jsonStr.substring(0, 200), 
        originalTextPreview: text.substring(0,200) 
      }, e
    );
    // Fallback: try to find the start and end of the main JSON structure if surrounded by junk
    const jsonStartBracket = jsonStr.indexOf('[');
    const jsonStartBrace = jsonStr.indexOf('{');
    let actualJsonStart = -1;

    if (jsonStartBracket !== -1 && (jsonStartBrace === -1 || jsonStartBracket < jsonStartBrace)) {
      actualJsonStart = jsonStartBracket;
    } else if (jsonStartBrace !== -1) {
      actualJsonStart = jsonStartBrace;
    }

    if (actualJsonStart !== -1) {
        let openBrackets = 0, openBraces = 0, actualJsonEnd = -1, inString = false;
        const startingCharType = jsonStr[actualJsonStart];
        for (let i = actualJsonStart; i < jsonStr.length; i++) {
            const char = jsonStr[i];
            // Basic string state tracking (doesn't handle escaped quotes within strings perfectly but often good enough)
            if (char === '"') {
                if (i === 0 || jsonStr[i-1] !== '\\' || (jsonStr[i-1] === '\\' && i > 1 && jsonStr[i-2] === '\\')) { // check for unescaped quote
                    inString = !inString;
                }
            }
            if (inString) continue; // Skip brace/bracket counting if inside a string

            if (char === '{') openBraces++;
            else if (char === '}') openBraces--;
            else if (char === '[') openBrackets++;
            else if (char === ']') openBrackets--;

            if (startingCharType === '{' && openBraces === 0 && openBrackets === 0 && i >= actualJsonStart) {
                actualJsonEnd = i;
                break;
            }
            if (startingCharType === '[' && openBrackets === 0 && openBraces === 0 && i >= actualJsonStart) {
                actualJsonEnd = i;
                break;
            }
        }
        if (actualJsonEnd !== -1) {
            try {
                let potentialJson = jsonStr.substring(actualJsonStart, actualJsonEnd + 1);
                potentialJson = potentialJson.replace(/,\s*([\}\]])/g, '$1'); // Clean trailing commas again
                logger.info("Fallback parsing attempting with substring.", "GeminiServiceParse", { substringPreview: potentialJson.substring(0,200) });
                return JSON.parse(potentialJson) as T;
            } catch (e2: any) {
                logger.error("Fallback JSON.parse also failed (Gemini).", "GeminiServiceParse", { errorMsg: e2.message, substringAttempted: jsonStr.substring(actualJsonStart, actualJsonEnd + 1).substring(0,200) }, e2);
            }
        } else {
            logger.warn("Fallback parsing: Could not determine a valid JSON substring (Gemini).", "GeminiServiceParse");
        }
    } else {
        logger.warn("Fallback parsing: No JSON start characters ([ or {) found in the response (Gemini).", "GeminiServiceParse");
    }
    return null;
  }
};

const JSON_OUTPUT_SCHEMA_INSTRUCTION = (language: string) => `
CRITICAL JSON Output Schema (MUST follow strictly):
{
  "title": "string (creative and relevant quiz title in ${language || 'English'}, or use original title if preserving a formatted quiz)",
  "questions": [
    {
      "id": "string (unique identifier, e.g., 'q1', 'q2'. Make this reasonably unique.)",
      "questionText": "string (If preserving a formatted quiz: use the EXACT original question text including any numbering like 'Question 1:' or 'Câu 1:'. Otherwise: create a clear, unambiguous multiple-choice question in ${language || 'English'}. This string MUST be formatted using Markdown, including lists, bolding, and LaTeX for math like $inline_math$ or $$block_math$$ where appropriate. Do not truncate.)",
      "options": ["string (A JSON array of EXACTLY 4 distinct option strings. If preserving a formatted quiz: use the exact original options, preserving their order as A, B, C, D. Each option string MUST be formatted using Markdown. CRITICAL: Each option MUST be a complete, valid JSON string, properly quoted (e.g., \\"Option Text\\"), and NOT TRUNCATED. All string content, including special characters and internal quotes, MUST be correctly escaped (e.g., \\"Option with \\\\\\"quote\\\\\\" inside\\"). Options in the array MUST be separated by commas. ABSOLUTELY NO extraneous text, unquoted characters, or non-JSON content should appear.)",
      ],
      "correctAnswer": "string (If preserving a formatted quiz with provided answers: use the exact correct answer from the original. If preserving a quiz without answers: research to find the correct answer. Otherwise for new quizzes: select one option as the correct answer. Must exactly match one of the option strings in the options array.)",
      "explanation": "string (Detailed explanation in ${language || 'English'}, formatted using Markdown. For preserved formatted quizzes: provide explanation if available in original, otherwise create a brief explanation of why the answer is correct. For new quizzes: ideally 2-4 concise sentences explaining why the answer is correct and why distractors are wrong. Refer to source content if possible. This field can ALSO include supplementary information as requested by custom user prompts. Ensure this string is valid JSON content, formatted with Markdown, and not truncated.)"
    }
  ]
}
`;

// Updated system instruction based on user's "roles.ts" and "prompt_builder.ts"
const buildGeminiSystemInstruction = (_config: QuizConfig): string => {
    // Using config parameter is optional as it's now handled in buildGeminiPrompt
    return `You are an expert quiz creator for students. Your role is to:

1. Create high-quality multiple choice questions based on the provided content.
2. Each question MUST have EXACTLY 4 multiple-choice options (A, B, C, D).
3. Format all content using Markdown syntax for better readability.
4. For each question, provide:
   - A clear question text formatted with proper Markdown
   - Exactly 4 answer options (no more, no less)
   - The correct answer clearly identified
   - A detailed explanation that teaches the concept
   
5. IMPORTANT ROLE - FORMATTED QUIZ HANDLING: 
   If the user uploads a properly formatted quiz file, you MUST:
   - Use that quiz EXACTLY as provided without creating new questions
   - Keep the exact format, content, and options from the original quiz
   - Preserve all question numbering and formatting (e.g., "Question 1:" or "Câu 1:")
   - Preserve all option letters (A, B, C, D) and their exact content
   - Example: If content has "Câu 1: 1+1=? A. 2 B. 3 C. 4 D. 5", output this exact question and options
   - If answers are provided (e.g., "Answer: A"), use them
   - If answers are not provided, research to add the correct answers
   - Add explanations for each answer if not already included

IMPORTANT ROLE - FORMAT DETECTION:
If the user provides a properly formatted multiple-choice quiz file, you MUST:
- Use that quiz exactly as provided without creating new questions
- Keep the format, content, and options exactly the same
- For example, if the provided content has questions like:
  "Question 1: 1+1=?
   A. 2
   B. 3
   C. 4
   D. 5"
  You MUST use these exact questions and options in your output
- If the correct answers are provided, use them
- If correct answers are not provided, research and provide the correct answers
- Never create new questions when a properly formatted quiz is detected

FORMAT REQUIREMENTS:
- Use Markdown formatting for better readability (e.g., **bold**, *italic*, lists).
- Use **bold text** for emphasis.
- Use bullet lists for organizing information.
- Use > blockquotes for important notes.
- For math formulas, use proper LaTeX syntax with $...$ for inline and $$...$$ for block equations.
- NUMBER each question clearly (this is for conceptual structure; the JSON output will have question objects in an array).

EXPECTED OUTPUT FORMAT (This describes the conceptual structure that your JSON output should represent for each question object within the main JSON):
### Question {number} (This conceptual title should be mapped to the 'questionText' field in the JSON)

{question text with proper markdown} (This is the content for 'questionText' field)

A. {option A} (These are for the 'options' array in JSON)
B. {option B}
C. {option C}
D. {option D}

Correct Answer: {letter} (The 'correctAnswer' field in JSON should contain the full text of the correct option string, not just the letter)

**Explanation:**
{detailed explanation using markdown} (This is for the 'explanation' field in JSON)

IMPORTANT REQUIREMENTS FOR JSON:
- Always create EXACTLY 4 options (A, B, C, D) for each multiple-choice question. These go into the 'options' array.
- Make sure incorrect options are plausible but clearly incorrect upon analysis.
- All answers must be mutually exclusive with no ambiguity.
- Ensure questions test understanding, not just memorization.
- The entire output MUST be a single, valid JSON object, adhering to the schema specified in the user prompt.
- All string values (questionText, options, correctAnswer, explanation) must be valid JSON strings, with internal quotes and special characters properly escaped (e.g., "Option with a \\"quote\\""). For LaTeX, backslashes must be doubled (e.g., \\\\sqrt{x}).
- Do not truncate any JSON strings or the overall JSON structure.

USER CUSTOMIZATION:
Review the 'USER-PROVIDED INSTRUCTIONS' block in the user prompt.
IF IT CONTAINS TEXT:
    - These instructions DEFINE the *content, style, tone, and focus* for quiz elements. They OVERRIDE general guidelines.
    - Integrate any requested supplementary information (e.g., IPA, etymology) into the 'explanation' field, alongside the core explanation.
ELSE (if empty or states no custom instructions):
    - Generate the quiz based on general guidelines and the source content, prioritizing core requirements.
`;
};


const buildGeminiPrompt = (
    content: string | { base64Data: string; mimeType: string },
    config: QuizConfig,
    titleSuggestion?: string
): { requestContents: Content; sourceContentSnippet: string; systemInstructionString: string } => {
    let sourceContentSnippet = "";
    const parts: Part[] = [];
    
    const systemInstructionString = buildGeminiSystemInstruction(config);

    const lang = config.language || 'English';
    const t = getTranslator(lang === 'Vietnamese' ? 'vi' : 'en');

    const difficultyDescriptions = {
      'Easy': t('step2DifficultyEasy'),
      'Medium': t('step2DifficultyMedium'),
      'Hard': t('step2DifficultyHard'),
      'AI-Determined': t('step2DifficultyAIDetermined')
    };

    const difficultyDesc = difficultyDescriptions[config.difficulty as keyof typeof difficultyDescriptions] || difficultyDescriptions['AI-Determined'];
    
    const numQuestionsText = config.numQuestions > 0 ? config.numQuestions.toString() : t('step2NumQuestionsAIPlaceholder');

    const contentGuidance = t('step1PasteTextLabel'); // Generic, actual content comes next

    let prompt = `You are an expert quiz creator. Your task is to create a high-quality quiz based on the provided content.\n\n`;
    prompt += `${contentGuidance}\n\n`;
    prompt += `${t('step2DifficultyLabel')}: ${difficultyDesc}\n`;
    prompt += `${t('step2NumQuestionsLabel')}: ${numQuestionsText}\n\n`;
    prompt += `${t('step2LanguageLabel')}: ${lang}\n\n`;

    prompt += `REQUIREMENTS:\n`;
    prompt += `- Use Markdown formatting throughout for better readability.\n`;
    prompt += `- EVERY question MUST have EXACTLY 4 multiple choice options (A, B, C, D).\n`;
    prompt += `- Present questions in clear, concise language.\n`;
    prompt += `- Provide detailed explanations for answers that teach the concept.\n\n`;
    
    prompt += `FORMATTED QUIZ DETECTION:\n`;
    prompt += `- CRITICAL INSTRUCTION: If the content contains a properly formatted multiple-choice quiz (like "Question 1: 1+1=? A. 2 B. 3 C. 4 D. 5"), use that quiz EXACTLY as provided.\n`;
    prompt += `- DO NOT create new questions or modify existing ones if a formatted quiz is detected.\n`;
    prompt += `- Preserve the exact wording of all questions and options (A, B, C, D).\n`;
    prompt += `- Keep question numbering and formatting exactly as in the original (e.g., "Question 1:" or "Câu 1:").\n`;
    prompt += `- If correct answers are provided in the original (e.g., with "Answer: A" or similar), use them.\n`;
    prompt += `- If correct answers are not provided, research to determine and add the correct answers.\n`;
    prompt += `- Generate explanations only if they're not already included in the original quiz.\n\n`;
    
    prompt += `MARKDOWN FORMAT:\n`;
    prompt += `- Use ### for conceptual question titles (map to 'questionText' in JSON).\n`;
    prompt += `- Use **bold** for emphasis.\n`;
    prompt += `- Use proper lists for options conceptually (map to 'options' array in JSON).\n`;
    prompt += `- Format math with $...$ (inline) and $$...$$ (block).\n`;
    prompt += `- Use blockquotes > for important notes.\n\n`;

    // Check if this is a prompt-only generation
    const isPromptOnlyModeForInstructions = typeof content === 'string' && 
                         content === "Generate quiz from user prompt." && 
                         config.customUserPrompt && 
                         config.customUserPrompt.trim().length > 0;

    if (isPromptOnlyModeForInstructions && config.customUserPrompt) {
      // For prompt-only mode, the customUserPrompt is the primary source for quiz generation
      prompt += `USER-PROVIDED PROMPT (PRIMARY SOURCE):\n${config.customUserPrompt.trim()}\n\n`;
      prompt += `This is a prompt-only request. The user has not provided any source content. Instead, generate a quiz based ENTIRELY on the user's prompt above.\n`;
      prompt += `Create appropriate multiple-choice questions that fulfill the requirements in the user's prompt.\n\n`;
    } else if (config.customUserPrompt && config.customUserPrompt.trim()) {
      // Regular mode with source content and supplementary prompt
      prompt += `USER-PROVIDED INSTRUCTIONS (OVERRIDE general guidelines if conflicting, otherwise supplement):\n${config.customUserPrompt.trim()}\n\n`;
    } else {
      prompt += `USER-PROVIDED INSTRUCTIONS: No specific user instructions provided. Default quiz generation guidelines apply, strictly adhering to core requirements.\n\n`;
    }

    prompt += `Based on the content below, and all prior instructions, create a quiz. The quiz title suggestion is: "${titleSuggestion || 'AI Suggested Title'}".\n\n`;
    prompt += `STRICTLY ADHERE to this JSON Output Schema:\n${JSON_OUTPUT_SCHEMA_INSTRUCTION(lang)}\n\n`;
    prompt += `CONTENT TO PROCESS:\n`;


    // Check if this is a prompt-only mode again for content handling
    const isPromptOnlyModeForContent = typeof content === 'string' && 
                         content === "Generate quiz from user prompt." && 
                         config.customUserPrompt && 
                         config.customUserPrompt.trim().length > 0;

    if (isPromptOnlyModeForContent && config.customUserPrompt) {
        // For prompt-only mode, use the customUserPrompt as the sourceContentSnippet
        sourceContentSnippet = `AI Prompt: ${config.customUserPrompt.substring(0, 500)}` + 
                               (config.customUserPrompt.length > 500 ? "..." : "");
        // In prompt-only mode, we don't need to include the placeholder content
        parts.push({ text: prompt });
    } else if (typeof content === 'string') {
        sourceContentSnippet = content.substring(0, 500) + (content.length > 500 ? "..." : "");
        parts.push({ text: `${prompt}"""${content}"""` });
    } else {
        sourceContentSnippet = `Image content (${content.mimeType})`;
        parts.push({ text: prompt }); // Text prompt first
        parts.push({ inlineData: { data: content.base64Data, mimeType: content.mimeType } }); // Then image
    }
    return { requestContents: { parts }, sourceContentSnippet, systemInstructionString };
};


const validateAndFixQuestions = (questions: Question[], currentLanguage: Language): Question[] => {
  const t = getTranslator(currentLanguage);
  return questions.map((question, qIndex) => {
    let currentOptions = Array.isArray(question.options) ? [...question.options] : [];
    let currentCorrectAnswer = question.correctAnswer;

    // Ensure each option is a string
    currentOptions = currentOptions.map(opt => typeof opt === 'string' ? opt : String(opt));
    if(typeof currentCorrectAnswer !== 'string') {
        currentCorrectAnswer = String(currentCorrectAnswer);
    }

    if (currentOptions.length < 4) {
      const needed = 4 - currentOptions.length;
      for (let i = 0; i < needed; i++) {
        // Ensure unique placeholder options
        currentOptions.push(t('reviewNewOptionDefault', { index: currentOptions.length + 1 + qIndex*10 }));
      }
    } else if (currentOptions.length > 4) {
      const originalCorrectAnswerText = currentCorrectAnswer;
      let tempOptions = currentOptions.slice(0, 4);
      
      if (!tempOptions.includes(originalCorrectAnswerText)) {
        // Correct answer was truncated. Add it back, replacing the last option of the truncated list.
        // Ensure the options are distinct before replacing.
        const distinctTempOptions = Array.from(new Set(tempOptions.slice(0, 3)));
        tempOptions = [...distinctTempOptions];
        while(tempOptions.length < 3) {
            tempOptions.push(t('reviewNewOptionDefault', { index: tempOptions.length + 1 + qIndex * 10 + 100}));
        }
        tempOptions.push(originalCorrectAnswerText); // Add the correct answer as the 4th option
        if (tempOptions.length > 4) tempOptions = tempOptions.slice(tempOptions.length - 4); // ensure it's 4
        currentCorrectAnswer = originalCorrectAnswerText;
      }
      currentOptions = tempOptions;
    }
    
    // Final check: ensure correctAnswer is one of the options. If not, default to the first.
    if (!currentOptions.includes(currentCorrectAnswer) && currentOptions.length > 0) {
        logger.warn(`Correct answer for Q${qIndex+1} ('${currentCorrectAnswer}') was not in the final 4 options. Defaulting to first option.`, "GeminiServiceValidation", { options: currentOptions, originalCorrect: question.correctAnswer });
        currentCorrectAnswer = currentOptions[0];
    } else if (currentOptions.length === 0) { // Should not happen due to padding
        currentCorrectAnswer = t('error'); // Fallback if options array is empty
        currentOptions = [t('error'), t('error'), t('error'), t('error')]; // Pad to prevent further errors
    }

    return {
      ...question,
      options: currentOptions,
      correctAnswer: currentCorrectAnswer,
    };
  });
};


export const generateQuizWithGemini = async (
  content: string | { base64Data: string; mimeType: string },
  config: QuizConfig,
  titleSuggestion?: string
): Promise<Omit<Quiz, 'id' | 'createdAt'>> => {
  logger.info("Attempting to generate quiz with Gemini", "GeminiService", { model: GEMINI_TEXT_MODEL, lang: config.language });
  
  // Check if this is a prompt-only generation (content will be minimal, focus on customUserPrompt)
  const isPromptOnlyModeForLogging = typeof content === 'string' && 
                         content === "Generate quiz from user prompt." && 
                         config.customUserPrompt && 
                         config.customUserPrompt.trim().length > 0;
                         
  if (isPromptOnlyModeForLogging) {
    logger.info("Prompt-only mode detected - using customUserPrompt as primary source", "GeminiService", {
      promptPreview: config.customUserPrompt?.substring(0, 100),
      promptOnlyMode: true
    });
  }
  // Check if the content is a formatted quiz (only for text content and not in prompt-only mode)
  else if (typeof content === 'string' && isFormattedQuiz(content)) {
    // Extract information about the quiz: count questions & options
    const questionMatches = content.match(/(?:Question|Câu)\s*\d+|^\s*\d+\s*[.)]/gmi) || [];
    const optionMatches = content.match(/[A-D]\s*[.)]\s*\S+/gi) || [];
    
    logger.info("Formatted quiz detected - will preserve exact format", "GeminiService", { 
      contentPreview: content.substring(0, 100),
      formattedQuiz: true,
      questionCount: questionMatches.length,
      optionCount: optionMatches.length
    });
    // We will still use the AI to process the quiz, but with instructions to preserve the format
  }
  
  const genAIInstance = initializeGeminiAI(); 
  const { requestContents, sourceContentSnippet, systemInstructionString } = buildGeminiPrompt(content, config, titleSuggestion);

  try {
    const response: GenerateContentResponse = await genAIInstance.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: requestContents,
      config: {
        responseMimeType: "application/json", // Request JSON output
        systemInstruction: systemInstructionString, // Provide system instruction
        // Add other parameters like temperature, topK, topP if needed, but systemInstruction and responseMimeType are key for structured output.
      }
    });
    const textResponse = response.text || '';
    logger.info("Received response from Gemini", "GeminiService", { responsePreview: textResponse.substring(0, 200) });
    const parsedQuizData = parseJsonFromMarkdown<Omit<Quiz, 'id' | 'createdAt' | 'sourceContentSnippet'>>(textResponse);

    if (!parsedQuizData || !parsedQuizData.questions || !parsedQuizData.title || !Array.isArray(parsedQuizData.questions) || parsedQuizData.questions.length === 0) {
      logger.error("Failed to parse quiz data or data is incomplete/invalid structure (Gemini).", "GeminiService", { parsedDataPreview: JSON.stringify(parsedQuizData)?.substring(0,200) }); 
      throw new Error("Gemini AI failed to generate quiz in the expected format or returned an empty/invalid quiz. Please check the console for the raw AI response and parsing attempts.");
    }
    
    const currentLanguage = (config.language === 'Vietnamese' ? 'vi' : 'en') as Language;
    const questionsWithCorrectOptions = validateAndFixQuestions(parsedQuizData.questions, currentLanguage);

    const validatedQuestionsFinal = questionsWithCorrectOptions.map((q, index) => {
        const questionId = q.id || `gq${index + 1}-${Date.now()}`;
        return { ...q, id: questionId, explanation: q.explanation || getTranslator(currentLanguage)('resultsNoExplanation') };
    });

    logger.info("Successfully generated and validated quiz from Gemini.", "GeminiService", { title: parsedQuizData.title, questionCount: validatedQuestionsFinal.length });
    return { ...parsedQuizData, questions: validatedQuestionsFinal, sourceContentSnippet };
  } catch (error) {
    logger.error("Error generating quiz with Gemini", "GeminiService", undefined, error as Error);
    let detailedMessage = `Failed to generate quiz with Gemini. An unexpected error occurred. Please try again later.`;
    if (error instanceof Error) {
        const errorMessage = error.message; 
        const lowerErrorMessage = errorMessage.toLowerCase();
        if (lowerErrorMessage.includes("api key not valid") || lowerErrorMessage.includes("api_key_invalid") || lowerErrorMessage.includes("process.env.api_key not set") || lowerErrorMessage.includes("api_key is not configured") || lowerErrorMessage.includes("process.env.gemini_api_key")) {
            detailedMessage = "Invalid or Missing Gemini API Key (process.env.API_KEY). Please ensure the environment variable is correctly configured and accessible.";
        } else if (lowerErrorMessage.includes("deadline exceeded")) {
            detailedMessage = "The Gemini AI took too long to respond. This might be due to complex content or a temporary issue. Please try again or simplify the content.";
        } else if (lowerErrorMessage.includes("quota")) {
            detailedMessage = "Gemini API quota exceeded. Please check your Google AI Platform quotas or try again later.";
        } else if (lowerErrorMessage.includes("500") || lowerErrorMessage.includes("unknown") || lowerErrorMessage.includes("rpc failed") || lowerErrorMessage.includes("xhr error")) {
            detailedMessage = "An unexpected error occurred while communicating with the AI service (Server Error or Network Issue). Please check your internet connection and try again in a few moments. If the problem persists, the AI service might be temporarily unavailable.";
        } else if (lowerErrorMessage.includes("ai failed to generate quiz") || lowerErrorMessage.includes("empty/invalid quiz")) {
            detailedMessage = errorMessage; 
        }
    }
    throw new Error(detailedMessage);
  }
};

export const extractTextFromImageWithGemini = async (
  imageData: { base64Data: string; mimeType: string }
): Promise<string | null> => {
  logger.info("Attempting to extract text from image with Gemini", "GeminiServiceImage", { mimeType: imageData.mimeType });
  const genAIInstance = initializeGeminiAI();
  const imagePart: Part = { inlineData: { data: imageData.base64Data, mimeType: imageData.mimeType } };
  const textPart: Part = { text: "Extract all visible text from this image. Respond with only the extracted text, without any additional commentary, formatting, or markdown. Just return the raw text content found in the image." };
  const contents: Content = { parts: [imagePart, textPart] };

  try {
    const response: GenerateContentResponse = await genAIInstance.models.generateContent({
      model: GEMINI_TEXT_MODEL, // Using the standard text model for multimodal input
      contents: contents,
    });
    const textResponse = response.text || '';
    logger.info("Successfully extracted text from image.", "GeminiServiceImage", { textLength: textResponse.trim().length });
    return textResponse.trim();
  } catch (error) {
    logger.error("Error extracting text from image with Gemini", "GeminiServiceImage", undefined, error as Error);
    if (error instanceof Error) {
        const lowerErrorMessage = error.message.toLowerCase();
        if (lowerErrorMessage.includes("api key not valid") || lowerErrorMessage.includes("api_key_invalid") || lowerErrorMessage.includes("api_key is not configured") || lowerErrorMessage.includes("process.env.api_key not set") || lowerErrorMessage.includes("process.env.gemini_api_key")) {
            throw new Error("Invalid or Missing Gemini API Key (process.env.API_KEY) for text extraction. Please ensure the environment variable is correctly configured and accessible.");
        } else if (lowerErrorMessage.includes("500") || lowerErrorMessage.includes("unknown") || lowerErrorMessage.includes("rpc failed") || lowerErrorMessage.includes("xhr error")) {
            throw new Error("Failed to extract text from image due to a server or network error. Please try again.");
        }
    }
    return null; 
  }
};
