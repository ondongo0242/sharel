export interface ThemeColors {
  text: string;
  textSecondary: string;
  buttonText: string;
  tabIconDefault: string;
  tabIconSelected: string;
  link: string;
  primary: string;
  secondary: string;
  accent: string;
  border: string;
  backgroundRoot: string;
  backgroundDefault: string;
  backgroundSecondary: string;
  backgroundTertiary: string;
  success: string;
  error: string;
  warning: string;
  purple: string;
  pink: string;
  shadow: string;
}

export interface AnimatedBackgroundConfig {
  type: 'none' | 'gradient' | 'particles' | 'waves' | 'aurora' | 'bubbles';
  colors: string[];
  speed?: 'slow' | 'medium' | 'fast';
  opacity?: number;
}

export interface ThemeConfig {
  id: string;
  name: string;
  isDark: boolean;
  colors: ThemeColors;
  animatedBackground?: AnimatedBackgroundConfig;
  previewGradient?: string[];
}
