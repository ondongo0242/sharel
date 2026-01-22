import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '@/i18n';
import { ThemeId, themes, getThemeConfig } from '@/constants/themes';
import { AnimatedBackgroundConfig } from '@/constants/themes/types';

export type ThemeMode = 'system' | ThemeId;
export type AccentColor = 'green' | 'blue' | 'purple' | 'orange' | 'pink' | 'red' | 'cyan' | 'yellow';
export type Language = 'fr' | 'en' | 'es' | 'de' | 'it' | 'pt' | 'ar' | 'ja' | 'ko' | 'zh';

export const AccentColors: Record<AccentColor, { name: string; color: string }> = {
  green: { name: 'green', color: '#22C55E' },
  blue: { name: 'blue', color: '#3B82F6' },
  purple: { name: 'purple', color: '#8B5CF6' },
  orange: { name: 'orange', color: '#F97316' },
  pink: { name: 'pink', color: '#EC4899' },
  red: { name: 'red', color: '#EF4444' },
  cyan: { name: 'cyan', color: '#06B6D4' },
  yellow: { name: 'yellow', color: '#EAB308' },
};

export const Languages: Record<Language, string> = {
  fr: 'Français',
  en: 'English',
  es: 'Español',
  de: 'Deutsch',
  it: 'Italiano',
  pt: 'Português',
  ar: 'العربية',
  ja: '日本語',
  ko: '한국어',
  zh: '中文',
};

export const ThemeOptions: { id: ThemeMode; labelKey: string }[] = [
  { id: 'system', labelKey: 'themes.system' },
  { id: 'light', labelKey: 'themes.light' },
  { id: 'dark', labelKey: 'themes.dark' },
  { id: 'ocean', labelKey: 'themes.ocean' },
  { id: 'sunset', labelKey: 'themes.sunset' },
  { id: 'forest', labelKey: 'themes.forest' },
  { id: 'aurora', labelKey: 'themes.aurora' },
  { id: 'midnight', labelKey: 'themes.midnight' },
  { id: 'sakura', labelKey: 'themes.sakura' },
  { id: 'lavender', labelKey: 'themes.lavender' },
];

interface AppearanceContextType {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  accentColor: AccentColor;
  setAccentColor: (color: AccentColor) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  highContrast: boolean;
  setHighContrast: (enabled: boolean) => void;
  effectiveColorScheme: 'light' | 'dark';
  effectiveThemeId: ThemeId;
  accentColorValue: string;
  isDark: boolean;
  animatedBackground?: AnimatedBackgroundConfig;
}

const AppearanceContext = createContext<AppearanceContextType | undefined>(undefined);

const STORAGE_KEYS = {
  THEME_MODE: '@appearance_theme_mode',
  ACCENT_COLOR: '@appearance_accent_color',
  LANGUAGE: '@appearance_language',
  HIGH_CONTRAST: '@appearance_high_contrast',
};

interface AppearanceProviderProps {
  children: ReactNode;
}

export function AppearanceProvider({ children }: AppearanceProviderProps) {
  const systemColorScheme = useSystemColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('light');
  const [accentColor, setAccentColorState] = useState<AccentColor>('green');
  const [language, setLanguageState] = useState<Language>('fr');
  const [highContrast, setHighContrastState] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  useEffect(() => {
    if (isLoaded) {
      i18n.changeLanguage(language);
    }
  }, [language, isLoaded]);

  const loadPreferences = async () => {
    try {
      const [savedTheme, savedAccent, savedLang, savedContrast] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.THEME_MODE),
        AsyncStorage.getItem(STORAGE_KEYS.ACCENT_COLOR),
        AsyncStorage.getItem(STORAGE_KEYS.LANGUAGE),
        AsyncStorage.getItem(STORAGE_KEYS.HIGH_CONTRAST),
      ]);

      if (savedTheme) setThemeModeState(savedTheme as ThemeMode);
      if (savedAccent) setAccentColorState(savedAccent as AccentColor);
      if (savedLang) {
        setLanguageState(savedLang as Language);
        i18n.changeLanguage(savedLang);
      }
      if (savedContrast !== null) setHighContrastState(savedContrast === 'true');
    } catch (error) {
      console.error('Failed to load appearance preferences:', error);
    } finally {
      setIsLoaded(true);
    }
  };

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.THEME_MODE, mode);
    } catch (error) {
      console.error('Failed to save theme mode:', error);
    }
  };

  const setAccentColor = async (color: AccentColor) => {
    setAccentColorState(color);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ACCENT_COLOR, color);
    } catch (error) {
      console.error('Failed to save accent color:', error);
    }
  };

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);
    i18n.changeLanguage(lang);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.LANGUAGE, lang);
    } catch (error) {
      console.error('Failed to save language:', error);
    }
  };

  const setHighContrast = async (enabled: boolean) => {
    setHighContrastState(enabled);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.HIGH_CONTRAST, String(enabled));
    } catch (error) {
      console.error('Failed to save high contrast:', error);
    }
  };

  const getEffectiveThemeId = (): ThemeId => {
    if (themeMode === 'system') {
      return systemColorScheme === 'dark' ? 'dark' : 'light';
    }
    return themeMode as ThemeId;
  };

  const effectiveThemeId = getEffectiveThemeId();
  const themeConfig = getThemeConfig(effectiveThemeId);
  const effectiveColorScheme: 'light' | 'dark' = themeConfig.isDark ? 'dark' : 'light';
  const accentColorValue = AccentColors[accentColor].color;
  const isDark = themeConfig.isDark;
  const animatedBackground = themeConfig.animatedBackground;

  if (!isLoaded) {
    return null;
  }

  return (
    <AppearanceContext.Provider
      value={{
        themeMode,
        setThemeMode,
        accentColor,
        setAccentColor,
        language,
        setLanguage,
        highContrast,
        setHighContrast,
        effectiveColorScheme,
        effectiveThemeId,
        accentColorValue,
        isDark,
        animatedBackground,
      }}
    >
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance() {
  const context = useContext(AppearanceContext);
  if (context === undefined) {
    throw new Error('useAppearance must be used within an AppearanceProvider');
  }
  return context;
}
