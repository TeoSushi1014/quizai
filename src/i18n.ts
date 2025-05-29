
import { Language } from './types';
import * as commonTranslations from './i18n/modules/common';
import * as dashboardTranslations from './i18n/modules/dashboard';
import * as quizCreationTranslations from './i18n/modules/quizCreation';
import * as quizTakingTranslations from './i18n/modules/quizTaking';
import * as settingsTranslations from './i18n/modules/settings';

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

type TranslationKey = keyof typeof translations.en;

export const getTranslator = (lang: Language) => {
  const t = (key: TranslationKey, params?: Record<string, string | number>): string => {
    let translationSet = translations[lang] || translations.en;
    let text = translationSet[key] || translations.en[key];

    if (text === undefined) {
      console.warn(`Translation key "${key}" not found for language "${lang}" or fallback "en".`);
      return key;
    }

    if (params) {
      Object.keys(params).forEach(paramKey => {
        const regex = new RegExp(`{${paramKey}}`, 'g');
        text = text.replace(regex, String(params[paramKey]));
      });
    }
    return text;
  };
  return t;
};
