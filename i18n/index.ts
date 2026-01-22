import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { Platform } from 'react-native';
import * as Localization from 'expo-localization';

import fr from './locales/fr.json';
import en from './locales/en.json';
import es from './locales/es.json';
import de from './locales/de.json';
import it from './locales/it.json';
import pt from './locales/pt.json';
import ar from './locales/ar.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import zh from './locales/zh.json';

const resources = {
  fr: { translation: fr },
  en: { translation: en },
  es: { translation: es },
  de: { translation: de },
  it: { translation: it },
  pt: { translation: pt },
  ar: { translation: ar },
  ja: { translation: ja },
  ko: { translation: ko },
  zh: { translation: zh },
};

const getDeviceLanguage = (): string => {
  const DEFAULT_LANG = 'fr';
  
  try {
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.language) {
        const browserLang = navigator.language;
        return browserLang ? browserLang.split('-')[0] : DEFAULT_LANG;
      }
      return DEFAULT_LANG;
    }
    
    const locale = (Localization as any).locale as string | undefined;
    if (locale && typeof locale === 'string' && locale.length > 0) {
      const langCode = locale.split('-')[0];
      return langCode || DEFAULT_LANG;
    }
    
    const locales = Localization.getLocales?.();
    if (locales && locales.length > 0 && locales[0].languageCode) {
      return locales[0].languageCode;
    }
    
    return DEFAULT_LANG;
  } catch (error) {
    console.warn('Error getting device language:', error);
    return DEFAULT_LANG;
  }
};

const deviceLanguage = getDeviceLanguage();

i18n
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v4',
    resources,
    lng: deviceLanguage || 'fr',
    fallbackLng: 'fr',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
