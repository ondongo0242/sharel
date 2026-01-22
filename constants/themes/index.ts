import { ThemeConfig, ThemeColors, AnimatedBackgroundConfig } from './types';
import { lightTheme } from './light';
import { darkTheme } from './dark';
import { oceanTheme } from './ocean';
import { sunsetTheme } from './sunset';
import { forestTheme } from './forest';
import { auroraTheme } from './aurora';
import { midnightTheme } from './midnight';
import { sakuraTheme } from './sakura';
import { lavenderTheme } from './lavender';

export type { ThemeConfig, ThemeColors, AnimatedBackgroundConfig };

export type ThemeId = 'light' | 'dark' | 'ocean' | 'sunset' | 'forest' | 'aurora' | 'midnight' | 'sakura' | 'lavender';

export const themes: Record<ThemeId, ThemeConfig> = {
  light: lightTheme,
  dark: darkTheme,
  ocean: oceanTheme,
  sunset: sunsetTheme,
  forest: forestTheme,
  aurora: auroraTheme,
  midnight: midnightTheme,
  sakura: sakuraTheme,
  lavender: lavenderTheme,
};

export const themesList: ThemeConfig[] = Object.values(themes);

export function getThemeColors(themeId: ThemeId): ThemeColors {
  return themes[themeId]?.colors || lightTheme.colors;
}

export function getThemeConfig(themeId: ThemeId): ThemeConfig {
  return themes[themeId] || lightTheme;
}

export { lightTheme, darkTheme, oceanTheme, sunsetTheme, forestTheme, auroraTheme, midnightTheme, sakuraTheme, lavenderTheme };
