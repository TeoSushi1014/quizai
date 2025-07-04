import { Quiz, Question, QuizConfig } from '../types';
import { translations } from '../i18n';

const getDifficultyAbbreviation = (difficulty?: QuizConfig['difficulty']): string => {
  if (!difficulty) return "NB";
  switch (difficulty) {
    case 'Easy': return "NB";
    case 'Medium': return "TH";
    case 'Hard': return "VD";
    case 'AI-Determined': return "NB";
    default: return "NB";
  }
};

type TFunction = (key: keyof typeof translations.en, params?: Record<string, string | number>) => string;

const getOptionLetter = (index: number) => String.fromCharCode(65 + index);

const formatQuestionTextAndOptions = (question: Question, questionIndex: number, t: TFunction, overallDifficultyAbbr: string, markCorrect: boolean = false): string => {
  const qText = question.questionText;
  let difficultyMarker = overallDifficultyAbbr; 

  const existingMarkerMatch = qText.match(/\(?\[?([A-Z]{2,3})[\]\)]?\.?\s/i);
  if (existingMarkerMatch && existingMarkerMatch[1]) {
    difficultyMarker = existingMarkerMatch[1].toUpperCase();
  }
  
  let questionLine = `${t('azotaFormatQuestionPrefix')} ${questionIndex}.(${difficultyMarker}) ${qText}\n`;
  
  question.options.forEach((option, optIndex) => {
    const isCorrect = option === question.correctAnswer;
    const prefix = markCorrect && isCorrect ? '*' : '';
    questionLine += `${prefix}${getOptionLetter(optIndex)}. ${option}\t`;
    if ((optIndex + 1) % 2 === 0 && optIndex < question.options.length - 1 && question.options.length > 2) { 
       questionLine = questionLine.trimEnd() + '\n'; 
    } else {
       questionLine = questionLine.trimEnd() + '  '; 
    }
  });
  questionLine = questionLine.trim() + '\n';
  return questionLine;
};

const formatExplanationBlock = (question: Question, questionIndex: number, t: TFunction, overallDifficultyAbbr: string, includeAnswerInExplanation: boolean = false): string => {
  const explanationSolutionMarker = t('azotaFormatExplanationSolutionMarker');
  const explanationMethodMarker = t('azotaFormatExplanationMethodMarker');
  
  const explanationParts = question.explanation.split(explanationSolutionMarker);
  const phuongPhap = (explanationParts[0]?.replace(explanationMethodMarker, '').trim()) || "";
  const cachGiai = (explanationParts[1]?.trim()) || (!phuongPhap ? question.explanation.trim() : "");

  let explanationText = `${t('azotaFormatQuestionPrefix')} ${questionIndex} (${overallDifficultyAbbr}):\n`;
  if (phuongPhap) {
    explanationText += `${t('azotaFormatExplanationMethod')} ${phuongPhap}\n`;
  }
  explanationText += `${t('azotaFormatExplanationSolution')} ${cachGiai || t('resultsNoExplanation')}\n`;
  
  if (includeAnswerInExplanation) {
    const correctOptionIndex = question.options.findIndex(opt => opt === question.correctAnswer);
    if (correctOptionIndex !== -1) {
      explanationText += `${t('azotaFormatChooseAnswer')} ${getOptionLetter(correctOptionIndex)}\n`;
    }
  }
  return explanationText;
};

export const formatQuizToAzotaStyle1 = (quiz: Quiz, t: TFunction): string => {
  let output = "";
  const overallDifficultyAbbr = getDifficultyAbbreviation(quiz.config?.difficulty);

  let overallQuestionIndex = 1;

  if (quiz.questions.length > 0) {
    output += `${t('azotaFormatMCQSection')}\n`;
    quiz.questions.forEach(q => {
      output += formatQuestionTextAndOptions(q, overallQuestionIndex++, t, overallDifficultyAbbr);
      output += '\n';
    });
  }

  output += `${t('azotaFormatEndOfQuiz')}\n`;
  output += `${t('azotaFormatAnswerTableTitle')}\n`;
  let answerKeyIndex = 1;
  quiz.questions.forEach((q) => {
    const correctOptionIndex = q.options.findIndex(opt => opt === q.correctAnswer);
    if (correctOptionIndex !== -1) {
      output += `${answerKeyIndex++}${getOptionLetter(correctOptionIndex)} `;
    }
  });
  output = output.trim() + '\n\n';

  output += `${t('azotaFormatExplanationSectionTitle')}\n`;
  let explanationIndex = 1;
  quiz.questions.forEach((q) => { 
    output += formatExplanationBlock(q, explanationIndex++, t, getDifficultyAbbreviation(quiz.config?.difficulty));
    output += '\n';
  });

  return output;
};

export const formatQuizToAzotaStyle2 = (quiz: Quiz, t: TFunction): string => {
  let output = "";
  const overallDifficultyAbbr = getDifficultyAbbreviation(quiz.config?.difficulty);
  let overallQuestionIndex = 1;

  if (quiz.questions.length > 0) {
    output += `${t('azotaFormatMCQSection')}\n`; // All questions are MCQs
    quiz.questions.forEach(q => {
      output += formatQuestionTextAndOptions(q, overallQuestionIndex, t, overallDifficultyAbbr);
      output += `${t('azotaFormatExplanationTitle')}\n`;
      output += formatExplanationBlock(q, overallQuestionIndex, t, overallDifficultyAbbr, true);
      output += '\n';
      overallQuestionIndex++;
    });
  }

  // Removed OpenEndedQuestions section
  return output;
};

export const formatQuizToAzotaStyle4 = (quiz: Quiz, t: TFunction): string => {
  let output = "";
  const overallDifficultyAbbr = getDifficultyAbbreviation(quiz.config?.difficulty);
  let overallQuestionIndex = 1;

  if (quiz.questions.length > 0) {
    output += `${t('azotaFormatMCQSection')}\n`; // All questions are MCQs
    quiz.questions.forEach(q => {
      output += formatQuestionTextAndOptions(q, overallQuestionIndex++, t, overallDifficultyAbbr, true); // Mark correct answer inline
      output += '\n';
    });
  }

  // Removed OpenEndedQuestions section
  return output;
};
