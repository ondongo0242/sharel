import { useAppearance } from "@/contexts/AppearanceContext";
import { getThemeColors } from "@/constants/themes";
import { ThemeColors } from "@/constants/themes/types";

function applyHighContrast(colors: ThemeColors, isDark: boolean): ThemeColors {
  if (isDark) {
    return {
      ...colors,
      text: "#FFFFFF",
      textSecondary: "#E0E0E0",
      buttonText: "#FFFFFF",
      tabIconDefault: "#CCCCCC",
      backgroundRoot: "#000000",
      backgroundDefault: "#0A0A0A",
      backgroundSecondary: "#1A1A1A",
      backgroundTertiary: "#2A2A2A",
      border: "#555555",
      link: "#6EB5FF",
      success: "#00E676",
      error: "#FF5252",
      warning: "#FFD740",
    };
  } else {
    return {
      ...colors,
      text: "#000000",
      textSecondary: "#1A1A1A",
      buttonText: "#000000",
      tabIconDefault: "#333333",
      backgroundRoot: "#FFFFFF",
      backgroundDefault: "#FAFAFA",
      backgroundSecondary: "#F0F0F0",
      backgroundTertiary: "#E0E0E0",
      border: "#333333",
      link: "#0044CC",
      success: "#006B35",
      error: "#CC0000",
      warning: "#996600",
    };
  }
}

export function useTheme() {
  const { effectiveThemeId, effectiveColorScheme, accentColorValue, highContrast, animatedBackground } = useAppearance();
  const isDark = effectiveColorScheme === "dark";
  let themeColors = getThemeColors(effectiveThemeId);
  
  if (highContrast) {
    themeColors = applyHighContrast(themeColors, isDark);
  }
  
  const theme = {
    ...themeColors,
    accent: accentColorValue,
    primary: accentColorValue,
  };

  return {
    theme,
    isDark,
    accentColor: accentColorValue,
    highContrast,
    animatedBackground: highContrast ? undefined : animatedBackground,
    themeId: effectiveThemeId,
  };
}
