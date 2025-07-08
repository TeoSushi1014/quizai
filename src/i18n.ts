import { Language } from './types';
import * as commonTranslations from './i18n/modules/common';
import * as dashboardTranslations from './i18n/modules/dashboard';
import * as quizCreationTranslations from './i18n/modules/quizCreation';
import * as quizTakingTranslations from './i18n/modules/quizTaking';
import * as settingsTranslations from './i18n/modules/settings';
import { logger } from './services/logService';

export const translations = {
  en: {
    ...commonTranslations.en,
    ...dashboardTranslations.en,
    ...quizCreationTranslations.en,
    ...quizTakingTranslations.en,
    ...settingsTranslations.en,
  },
  vi: {
    ...commonTranslations.vi,
    ...dashboardTranslations.vi,
    ...quizCreationTranslations.vi,
    ...quizTakingTranslations.vi,
    ...settingsTranslations.vi,
  },
};

export type TranslationKey = keyof typeof translations.en;

export const getTranslator = (lang: Language) => {
  const t = (key: TranslationKey, params?: Record<string, string | number>): string => {
    let translationSet = translations[lang] || translations.en;
    let text = translationSet[key] || translations.en[key];

    if (text === undefined) {
      logger.warn(`Translation key not found`, 'i18n', {
        key,
        language: lang,
        fallbackLanguage: 'en'
      });
      return key;
    }

    if (params) {
      Object.keys(params).forEach(paramKey => {
        // Escape the paramKey to ensure it's treated as a literal string in the regex
        // and that the curly braces are also escaped for the RegExp constructor.
        const escapedParamKey = String(paramKey).replace(/[.*+?^${}()|[\\\]]/g, '\\$&');
        const regex = new RegExp(`\\{${escapedParamKey}\\}`, 'g'); // Escape curly braces here
        text = text.replace(regex, String(params[paramKey]));
      });
    }
    return text;
  };
  return t;
};
