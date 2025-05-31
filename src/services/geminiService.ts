
import { GoogleGenAI, GenerateContentResponse, Part, Content } from "@google/genai";
import { Question, QuizConfig, Quiz, AIModelType } from "../types";
import { GEMINI_TEXT_MODEL, GEMINI_MODEL_ID } from "../constants";
import { logger } from './logService';

let geminiAI: GoogleGenAI | null = null;

const initializeGeminiAI = (): GoogleGenAI => {
  if (!geminiAI) {
    // API_KEY is now sourced directly from process.env.API_KEY.
    // This environment variable is made available to the client-side bundle via vite.config.ts.
    const apiKeyFromEnv = process.env.API_KEY;
    
    if (typeof apiKeyFromEnv !== 'string' || !apiKeyFromEnv) {
      const errorMessage = "Google Gemini API Key (process.env.API_KEY) not set or not available to the client. Quiz generation may fail.";
      logger.error(errorMessage, "GeminiServiceInit");
      // Visual alert is in App.tsx based on isGeminiKeyAvailable context value,
      // which should reflect if process.env.API_KEY was successfully passed.
      throw new Error(errorMessage); 
    }
    logger.info("Gemini AI SDK Initializing with API Key from process.env.API_KEY.", "GeminiServiceInit");
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
  jsonStr = jsonStr.replace(/侬/g, ''); 
  jsonStr = jsonStr.replace(/ܘ/g, ''); 
  jsonStr = jsonStr.replace(/对着/g, ''); 
  jsonStr = jsonStr.replace(/"\s*```\s*([\]\},])/g, '"$1');
  jsonStr = jsonStr.replace(/"\s*```\s*(,"[^"]+")/g, '"$1');
  try {
    const patternString = "(\"[^\"\\\\]*(?:\\\\.[^\"\\\\]*)*\")\\s*\\n\\s*([a-zA-Z_][a-zA-Z0-9_]*(?:\\s+[a-zA-Z_][a-zA-Z0-9_]*)*\\s*)\"";
    const brokenStringRegex = new RegExp(patternString, "g");
    jsonStr = jsonStr.replace(brokenStringRegex, (_match, g1, g2) => `${g1.slice(0, -1)} ${g2.trim()}"`);
  } catch(e) {
    logger.warn("Error during string newline fixing regex replacement.", "GeminiServiceParse", undefined, e as Error);
  }
  jsonStr = jsonStr.replace(/,\s*([\}\]])/g, '$1');
  try {
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
    // Fallback parsing
    const jsonStartBracket = jsonStr.indexOf('[');
    const jsonStartBrace = jsonStr.indexOf('{');
    let actualJsonStart = -1;
    if (jsonStartBracket !== -1 && (jsonStartBrace === -1 || jsonStartBracket < jsonStartBrace)) actualJsonStart = jsonStartBracket;
    else if (jsonStartBrace !== -1) actualJsonStart = jsonStartBrace;

    if (actualJsonStart !== -1) {
        let openBrackets = 0, openBraces = 0, actualJsonEnd = -1, inString = false;
        const startingCharType = jsonStr[actualJsonStart];
        for (let i = actualJsonStart; i < jsonStr.length; i++) {
            const char = jsonStr[i];
            if (char === '"') { if (i === 0 || jsonStr[i-1] !== '\\' || (jsonStr[i-1] === '\\' && i > 1 && jsonStr[i-2] === '\\')) inString = !inString; }
            if (inString) continue; 
            if (char === '{') openBraces++; else if (char === '}') openBraces--;
            else if (char === '[') openBrackets++; else if (char === ']') openBrackets--;
            if (startingCharType === '{' && openBraces === 0 && openBrackets === 0 && i >= actualJsonStart) { actualJsonEnd = i; break; }
            if (startingCharType === '[' && openBrackets === 0 && openBraces === 0 && i >= actualJsonStart) { actualJsonEnd = i; break; }
        }
        if (actualJsonEnd !== -1) {
            try {
                let potentialJson = jsonStr.substring(actualJsonStart, actualJsonEnd + 1);
                potentialJson = potentialJson.replace(/,\s*([\}\]])/g, '$1');
                logger.info("Fallback parsing attempting with substring.", "GeminiServiceParse", { substringPreview: potentialJson.substring(0,200) });
                return JSON.parse(potentialJson) as T;
            } catch (e2: any) {
                logger.error("Fallback JSON.parse also failed (Gemini).", "GeminiServiceParse", { errorMsg: e2.message, substringAttempted: jsonStr.substring(actualJsonStart, actualJsonEnd + 1).substring(0,200) }, e2);
            }
        } else logger.warn("Fallback parsing: Could not determine a valid JSON substring (Gemini).", "GeminiServiceParse");
    } else logger.warn("Fallback parsing: No JSON start characters ([ or {) found in the response (Gemini).", "GeminiServiceParse");
    return null;
  }
};

const JSON_OUTPUT_SCHEMA_INSTRUCTION = (language: string) => `
        CRITICAL JSON Output Schema (MUST follow strictly):
        {
          "title": "string (creative and relevant quiz title in ${language || 'English'})",
          "questions": [
            {
              "id": "string (unique identifier, e.g., 'q1', 'q2'. Make this reasonably unique.)",
              "questionText": "string (clear, unambiguous multiple-choice question in ${language || 'English'}. Do not truncate.)",
              "options": ["string (A JSON array of 3-5 distinct, plausible option strings in ${language || 'English'}. CRITICAL: Each option MUST be a complete, valid JSON string, properly quoted (e.g., \\"Option Text\\"), and NOT TRUNCATED. All string content, including special characters and internal quotes, MUST be correctly escaped (e.g., \\"Option with \\\\\\"quote\\\\\\" inside\\"). Options in the array MUST be separated by commas. ABSOLUTELY NO extraneous text, unquoted characters, or non-JSON content should appear: 1) between the closing quote of one option and the comma, 2) between the comma and the opening quote of the next option, or 3) between the closing quote of the last option and the closing square bracket ']'.)"],
              "correctAnswer": "string (The exact text of the correct option from the 'options' array. All in ${language || 'English'})",
              "explanation": "string (Detailed explanation in ${language || 'English'}, ideally 2-4 concise sentences. Explain correctness and why distractors are wrong. Refer to source content if possible. This field can ALSO include supplementary information as requested by custom user prompts, such as IPA transcriptions, etymologies, or example sentences, integrated naturally with the main explanation. Ensure this string is valid JSON content and not truncated.)"
            }
          ]
        }
`;

const buildGeminiPrompt = (
    content: string | { base64Data: string; mimeType: string },
    config: QuizConfig,
    titleSuggestion?: string
): { requestContents: Content; sourceContentSnippet: string; systemInstructionString: string } => {
    let sourceContentSnippet = "";
    const parts: Part[] = [];
    let systemInstructionString = `You are a rigorous educational AI agent whose mission is to generate quizzes that fully and exhaustively reflect the original input content provided by the user (such as a 50-question test file).

Your task is non-negotiable:
✅ You must generate a set of quiz questions that matches the scope, depth, and quantity of the original material.
✅ If the input file has 50 questions or covers 50 topics, your output must match or exceed that number — never less.

Absolutely no assumptions are allowed about content reduction, simplification, or condensation.

Before returning your response, perform the following internal steps (not visible to the user):
1. Parse and extract every distinct question, topic, or learning objective from the input.
2. Generate a quiz item for each of them — ensuring one-to-one or one-to-many coverage.
3. Validate each question for alignment with the original content.
4. Confirm that the total number of output quiz items is not lower than the total input topics/questions.
5. If you cannot meet the above criteria for any reason, do not respond until all conditions are satisfied.

This quiz MUST BE MULTIPLE-CHOICE.
Output format MUST be a single, valid JSON object. No other text or markdown outside this JSON object.
The quiz, including all titles, questions, options, and explanations, MUST be in ${config.language || 'English'}.

Your behavior regarding quiz content and style MUST BE guided by the user's specific instructions, if provided.

PRIMARY TASK MODIFICATION BASED ON USER INPUT:
Review the 'USER-PROVIDED INSTRUCTIONS' block located within these System Instructions.

IF THE 'USER-PROVIDED INSTRUCTIONS' BLOCK CONTAINS TEXT:
  - These user instructions define the REQUIRED *content, style, tone, and focus* for all quiz elements (questions, options, explanations).
  - These instructions take ABSOLUTE PRECEDENCE. They OVERRIDE any conflicting general guidelines or suggestions found elsewhere regarding quiz content and style.
  - Your main task becomes: meticulously implement these user instructions to shape the quiz.
  - If user instructions request specific textual additions related to a question (e.g., IPA transcriptions, etymologies, example sentences), you SHOULD integrate these naturally within the 'explanation' field for the relevant question. This is in addition to the core explanation of why the answer is correct and why distractors are wrong. Ensure the primary explanation remains clear and complete.
  - However, you MUST still strictly adhere to the required JSON output format and structure, and ensure all questions are multiple-choice.

ELSE (if the 'USER-PROVIDED INSTRUCTIONS' block is empty or explicitly states no custom instructions):
  - Generate the quiz based on the general guidelines and the provided source content, strictly adhering to your core mission and non-negotiable task regarding content coverage and quantity.

---
BEGIN USER-PROVIDED INSTRUCTIONS:
${config.customUserPrompt && config.customUserPrompt.trim() ? config.customUserPrompt.trim() : "No specific user instructions provided beyond quiz configuration. Default quiz generation guidelines apply, strictly adhering to your core mission and non-negotiable task regarding content coverage and quantity."}
END USER-PROVIDED INSTRUCTIONS
---

Regardless of custom instructions, always ensure the output JSON format is strictly correct and complete, and all questions are multiple-choice.
Ensure there is NO extraneous text or characters between JSON properties or after string values before the expected comma or closing brace/bracket.
Each string value, especially within arrays like 'options', must be a COMPLETE, valid JSON string, properly quoted, and escaped. Pay EXTREME attention to not truncating strings or omitting closing quotes/brackets.
Every part of the JSON response, especially strings, must be correctly formatted and escaped. Check for and remove any accidental truncation or data leakage between fields.
Strictly follow JSON formatting, especially for strings, arrays, and preventing truncation. All detailed JSON schema and quality guidelines are provided in the main prompt (the part that includes the source content and specific output requirements).`;

    const quizTitleInstruction = titleSuggestion ? `The quiz title should be relevant to "${titleSuggestion}".` : "Suggest a creative and relevant title for this quiz.";
    const aiModeInstruction = config.difficulty === 'AI-Determined' ?
        `Determine the optimal number of multiple-choice questions (aim for ${config.numQuestions > 0 ? config.numQuestions : 'between 5 and 10, but adjust based on content length/complexity'}) and their difficulty levels based on the provided content. Strive for a balanced mix of difficulties if appropriate.` :
        `The quiz should have exactly ${config.numQuestions} multiple-choice questions. The difficulty for all questions should be ${config.difficulty}. `;
    const hasCustomPrompt = !!(config.customUserPrompt && config.customUserPrompt.trim());
    let mainInstructionsPreamble: string;
    if (hasCustomPrompt) {
        mainInstructionsPreamble = `
IMPORTANT: Your primary guide for quiz *content, style, tone, and focus* is the 'USER-PROVIDED INSTRUCTIONS' block found in the System Instructions for this task. You MUST meticulously follow them.
The instructions below define the REQUIRED *structural and formatting* aspects for the quiz output.
ALL questions MUST be multiple-choice.
The quiz, including all titles, questions, options, and explanations, MUST be in ${config.language || 'English'}.
${quizTitleInstruction}
${aiModeInstruction}
`;
    } else {
        mainInstructionsPreamble = `
General multiple-choice quiz generation guidelines:
The quiz, including all titles, questions, options, and explanations, MUST be in ${config.language || 'English'}.
${quizTitleInstruction}
${aiModeInstruction}
ALL questions MUST be multiple-choice.
`;
    }
    const mainContentInstructions = `
        ${mainInstructionsPreamble}
        ${JSON_OUTPUT_SCHEMA_INSTRUCTION(config.language || 'English')}
        Key Quality Guidelines (Always Apply for JSON Structure and Validity):
        1.  Questions: Clear and unambiguous multiple-choice questions. Each question must have 3-5 distinct, plausible options.
        2.  Options Array: The "options" field MUST be a valid JSON array of strings. Each string option within the 'options' array must be a COMPLETE, valid JSON string, properly quoted, and NOT TRUNCATED. All string content must be correctly escaped (e.g., internal quotes as \\"). Ensure each option is correctly terminated by a quote, followed by a comma (if not the last item) or the closing square bracket (']'). Incomplete or truncated strings, or strings with unescaped internal quotes, will break the JSON. Do NOT leave strings unterminated or malformed. ABSOLUTELY NO unquoted text or non-JSON characters should be inserted between elements of this array, or between the last element and the closing ']'."
        3.  Explanations: Concise (ideally 2-4 sentences for the core part), comprehensive, explaining correctness and incorrectness for options. If custom instructions request additional information (like IPA), include it here as well. Ensure explanations are valid JSON string content and not truncated.
        4.  Language: Strictly in ${config.language || 'English'}.
        5.  Completeness: All required JSON fields must be present for each question.
        6.  String Integrity: All string values within the JSON must be properly escaped and not contain raw newlines or characters that break JSON. This is especially critical for strings within arrays. Ensure every string is fully formed and terminated. For LaTeX content within string values, a single LaTeX backslash (e.g., in \\sqrt) MUST be represented as a double backslash (e.g., \\\\sqrt) in the JSON string value so that it's a valid JSON string and parses correctly.
        7.  Strict JSON Adherence: Your entire response must be a single, valid JSON object with no surrounding text or markdown. Ensure no truncation, especially within string values or arrays. There should be no characters between a string value and the following comma or closing brace/bracket. Double-check for any truncated strings or missing closing quotes/brackets, especially if the content is long or contains special characters.
        8.  Internal Cleanliness: Ensure no non-JSON characters (e.g., stray unicode characters, incomplete markdown markers like \`\`\`) are present *within* the JSON structure itself, particularly not after string values or before closing delimiters like ']' or '}'.
        9.  Array Element Purity: When constructing JSON arrays (e.g., the "options" array), ensure that only valid JSON elements (typically strings in quotes) are present. DO NOT include any unquoted text, extraneous phrases, or non-JSON data between valid array elements, or between the last valid element and the closing square bracket (']'). For example, an array like \`"options": ["Option A", "Option B" extraneous text here, "Option C"]\` is INVALID. It MUST be \`"options": ["Option A", "Option B", "Option C"]\`. Any text within an array must be part of a properly quoted and comma-separated string element.
        10. Handling Response Length Limits: It is CRITICAL that the entire JSON response is valid. If the content to be included in a field, especially the 'explanation' field, is very long and risks exceeding response limits, you MUST prioritize JSON validity. This means:
            a. Shorten the content of the field (e.g., the explanation) to ensure it fits, RATHER THAN truncating the JSON structure itself or a string value mid-way.
            b. Ensure the shortened content is still a valid, properly quoted JSON string (e.g., "A shorter but complete explanation.").
            c. Never allow an unterminated string or an incomplete JSON object/array. If you must cut content, do it within the text of a field and ensure that field is still correctly formatted as a JSON string with a closing quote.
    `;
    const effectiveMainContentInstructions = mainContentInstructions;
    if (typeof content === 'string') {
        sourceContentSnippet = content.substring(0, 500) + (content.length > 500 ? "..." : "");
        parts.push({ text: `Source Text: """${content}"""\n\nInstructions for multiple-choice quiz generation: """${effectiveMainContentInstructions}"""` });
    } else {
        sourceContentSnippet = `Image content (${content.mimeType})`;
        parts.push({ inlineData: { data: content.base64Data, mimeType: content.mimeType } });
        parts.push({ text: `Instructions for multiple-choice quiz based on the preceding image: """${effectiveMainContentInstructions}"""` });
    }
    return { requestContents: { parts }, sourceContentSnippet, systemInstructionString };
};

export const generateQuizWithGemini = async (
  content: string | { base64Data: string; mimeType: string },
  config: QuizConfig,
  titleSuggestion?: string
): Promise<Omit<Quiz, 'id' | 'createdAt'>> => {
  logger.info("Attempting to generate quiz with Gemini", "GeminiService", { model: GEMINI_TEXT_MODEL, lang: config.language });
  const genAIInstance = initializeGeminiAI(); 
  const { requestContents, sourceContentSnippet, systemInstructionString } = buildGeminiPrompt(content, config, titleSuggestion);

  try {
    const response: GenerateContentResponse = await genAIInstance.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: requestContents,
      config: {
        responseMimeType: "application/json",
        systemInstruction: systemInstructionString,
      }
    });
    const textResponse = response.text || '';
    logger.info("Received response from Gemini", "GeminiService", { responsePreview: textResponse.substring(0, 200) });
    const parsedQuizData = parseJsonFromMarkdown<Omit<Quiz, 'id' | 'createdAt' | 'sourceContentSnippet'>>(textResponse);

    if (!parsedQuizData || !parsedQuizData.questions || !parsedQuizData.title || !Array.isArray(parsedQuizData.questions) || parsedQuizData.questions.length === 0) {
      logger.error("Failed to parse quiz data or data is incomplete/invalid structure (Gemini).", "GeminiService", { parsedDataPreview: JSON.stringify(parsedQuizData)?.substring(0,200) }); 
      throw new Error("Gemini AI failed to generate quiz in the expected format or returned an empty/invalid quiz. Please check the console for the raw AI response and parsing attempts.");
    }
    const validatedQuestions = parsedQuizData.questions.map((q, index) => {
        const questionId = q.id || `gq${index + 1}-${Date.now()}`;
        let options = q.options;
        if (!Array.isArray(q.options) || q.options.length < 2) {
            logger.warn(`Question ${questionId} has invalid options, providing defaults.`, "GeminiServiceValidation", { originalOptions: q.options });
            options = [`Generated Option A for ${questionId}`, `Generated Option B for ${questionId}`, `Generated Option C for ${questionId}`];
        }
        let correctAnswer = typeof q.correctAnswer === 'string' ? q.correctAnswer : '';
        if (!options.includes(correctAnswer) && options.length > 0) {
            logger.warn(`Correct answer for ${questionId} ('${q.correctAnswer}') not in options. Defaulting to first option.`, "GeminiServiceValidation", { options });
            correctAnswer = options[0];
        } else if (options.length === 0) {
            correctAnswer = "A model answer should be provided here.";
        }
        return { ...q, id: questionId, options, correctAnswer, explanation: q.explanation || "No explanation provided by AI. Consider regenerating or editing." };
    });
    logger.info("Successfully generated and validated quiz from Gemini.", "GeminiService", { title: parsedQuizData.title, questionCount: validatedQuestions.length });
    return { ...parsedQuizData, questions: validatedQuestions, sourceContentSnippet };
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
      model: GEMINI_TEXT_MODEL, // Standard model for text extraction as well
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

