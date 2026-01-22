import { useState } from "react";
import { StyleSheet, View, Pressable, Switch, Modal, ScrollView, Dimensions } from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Svg, { Path, Circle, Rect, G, Defs, LinearGradient as SvgLinearGradient, Stop } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";
import type { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { useTheme } from "@/hooks/useTheme";
import { 
  useAppearance, 
  AccentColors, 
  Languages, 
  ThemeMode,
  AccentColor,
  Language,
  ThemeOptions,
} from "@/contexts/AppearanceContext";
import { themes, ThemeId } from "@/constants/themes";
import { Feather } from "@expo/vector-icons";

type GeneralSettingsScreenProps = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, "GeneralSettings">;
};

type ModalType = 'language' | 'theme' | 'accent' | 'textsize' | null;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const THEME_CARD_WIDTH = (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.md * 2) / 3;
const THEME_CARD_HEIGHT = THEME_CARD_WIDTH * 1.4;

const FlagIcon = ({ countryCode }: { countryCode: Language }) => {
  const size = 24;

  switch (countryCode) {
    case 'fr':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect x="2" y="4" width="6.67" height="16" fill="#0055A4" rx="2" />
          <Rect x="8.67" y="4" width="6.67" height="16" fill="#FFFFFF" />
          <Rect x="15.33" y="4" width="6.67" height="16" fill="#EF4135" rx="2" />
        </Svg>
      );
    case 'en':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect x="2" y="4" width="20" height="16" fill="#012169" rx="2" />
          <Path d="M2 4 L22 20 M22 4 L2 20" stroke="#FFFFFF" strokeWidth="3" />
          <Path d="M2 4 L22 20 M22 4 L2 20" stroke="#C8102E" strokeWidth="1.5" />
          <Path d="M12 4 V20 M2 12 H22" stroke="#FFFFFF" strokeWidth="5" />
          <Path d="M12 4 V20 M2 12 H22" stroke="#C8102E" strokeWidth="3" />
        </Svg>
      );
    case 'es':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect x="2" y="4" width="20" height="4" fill="#AA151B" rx="2" ry="2" />
          <Rect x="2" y="8" width="20" height="8" fill="#F1BF00" />
          <Rect x="2" y="16" width="20" height="4" fill="#AA151B" rx="2" ry="2" />
        </Svg>
      );
    case 'de':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect x="2" y="4" width="20" height="5.33" fill="#000000" rx="2" ry="2" />
          <Rect x="2" y="9.33" width="20" height="5.33" fill="#DD0000" />
          <Rect x="2" y="14.67" width="20" height="5.33" fill="#FFCE00" rx="2" ry="2" />
        </Svg>
      );
    case 'it':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect x="2" y="4" width="6.67" height="16" fill="#009246" rx="2" />
          <Rect x="8.67" y="4" width="6.67" height="16" fill="#FFFFFF" />
          <Rect x="15.33" y="4" width="6.67" height="16" fill="#CE2B37" rx="2" />
        </Svg>
      );
    case 'pt':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect x="2" y="4" width="8" height="16" fill="#006600" rx="2" />
          <Rect x="10" y="4" width="12" height="16" fill="#FF0000" rx="2" />
          <Circle cx="10" cy="12" r="4" fill="#FFCC00" />
        </Svg>
      );
    case 'ar':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect x="2" y="4" width="20" height="5.33" fill="#CE1126" rx="2" ry="2" />
          <Rect x="2" y="9.33" width="20" height="5.33" fill="#FFFFFF" />
          <Rect x="2" y="14.67" width="20" height="5.33" fill="#000000" rx="2" ry="2" />
        </Svg>
      );
    case 'ja':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect x="2" y="4" width="20" height="16" fill="#FFFFFF" rx="2" />
          <Circle cx="12" cy="12" r="5" fill="#BC002D" />
        </Svg>
      );
    case 'ko':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect x="2" y="4" width="20" height="16" fill="#FFFFFF" rx="2" />
          <Circle cx="12" cy="12" r="4" fill="#C60C30" />
          <Path d="M12 8 A4 4 0 0 1 12 16" fill="#003478" />
        </Svg>
      );
    case 'zh':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect x="2" y="4" width="20" height="16" fill="#DE2910" rx="2" />
          <Path d="M6 8 L6.5 9.5 L8 9.5 L6.75 10.5 L7.25 12 L6 11 L4.75 12 L5.25 10.5 L4 9.5 L5.5 9.5 Z" fill="#FFDE00" />
        </Svg>
      );
    default:
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect x="2" y="4" width="20" height="16" fill="#CCCCCC" rx="2" />
        </Svg>
      );
  }
};

const LanguageIcon = ({ color }: { color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path
      d="M5 8L2 8M5 8L8 8M5 8L5 6M8 8C8 8 7 12 5 14C3 16 2 17 2 17M8 8C8 8 10 12 12 14M2 17L6 14M6 14L8 17M6 14L12 14"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path d="M14 10L17.5 19L21 10" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M15 16H20" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
  </Svg>
);

const ThemeIcon = ({ color }: { color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path d="M4 6H6M4 12H8M4 18H6" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    <Path d="M10 4H18C19.1046 4 20 4.89543 20 6V18C20 19.1046 19.1046 20 18 20H10C8.89543 20 8 19.1046 8 18V6C8 4.89543 8.89543 4 10 4Z" stroke={color} strokeWidth={1.5} />
    <Path d="M14 4V20" stroke={color} strokeWidth={1.5} />
  </Svg>
);

const AccentIcon = ({ color, accentColor }: { color: string; accentColor: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={1.5} />
    <Circle cx="12" cy="8" r="2.5" fill={accentColor} />
    <Circle cx="8" cy="14" r="2.5" fill="#3B82F6" />
    <Circle cx="16" cy="14" r="2.5" fill="#8B5CF6" />
  </Svg>
);

const ContrastIcon = ({ color }: { color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={1.5} />
    <Path d="M12 3V21" stroke={color} strokeWidth={1.5} />
    <Path d="M12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21" fill={color} />
  </Svg>
);

const TextSizeIcon = ({ color }: { color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path d="M4 7H20M4 7L8 17M4 7L8 17M20 7L16 17M20 7L16 17" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M3 20H21" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
  </Svg>
);

const MotionIcon = ({ color }: { color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const RadioButton = ({ selected, color }: { selected: boolean; color: string }) => (
  <View style={[styles.radioOuter, { borderColor: selected ? color : "#666666" }]}>
    {selected ? <View style={[styles.radioInner, { backgroundColor: color }]} /> : null}
  </View>
);

interface ThemePreviewCardProps {
  themeId: ThemeMode;
  isSelected: boolean;
  onSelect: () => void;
  label: string;
  accentColor: string;
}

const ThemePreviewCard = ({ themeId, isSelected, onSelect, label, accentColor }: ThemePreviewCardProps) => {
  const getPreviewColors = (): readonly [string, string, ...string[]] => {
    if (themeId === 'system') {
      return ['#F8FAFC', '#E2E8F0', '#0F172A'];
    }
    const themeConfig = themes[themeId as ThemeId];
    if (themeConfig?.previewGradient) {
      return themeConfig.previewGradient as readonly [string, string, ...string[]];
    }
    return [themeConfig?.colors.backgroundRoot || '#FFFFFF', themeConfig?.colors.backgroundSecondary || '#F1F5F9', themeConfig?.colors.primary || '#3B82F6'];
  };

  const getIconColor = (): string => {
    if (themeId === 'system') {
      return '#64748B';
    }
    const themeConfig = themes[themeId as ThemeId];
    return themeConfig?.isDark ? '#FFFFFF' : '#0F172A';
  };

  const previewColors = getPreviewColors();
  const iconColor = getIconColor();

  const getThemeIconName = (): keyof typeof Feather.glyphMap => {
    switch (themeId) {
      case 'system': return 'smartphone';
      case 'light': return 'sun';
      case 'dark': return 'moon';
      case 'ocean': return 'droplet';
      case 'sunset': return 'sunrise';
      case 'forest': return 'feather';
      case 'aurora': return 'wind';
      case 'midnight': return 'star';
      case 'sakura': return 'heart';
      case 'lavender': return 'cloud';
      default: return 'circle';
    }
  };

  return (
    <Pressable 
      onPress={onSelect}
      style={({ pressed }) => [
        styles.themeCard,
        isSelected && { borderColor: accentColor, borderWidth: 2 },
        { opacity: pressed ? 0.8 : 1 }
      ]}
    >
      <LinearGradient
        colors={previewColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.themeCardGradient}
      >
        <View style={styles.themeCardIconContainer}>
          <Feather name={getThemeIconName()} size={24} color={iconColor} />
        </View>
        {isSelected ? (
          <View style={[styles.themeCardCheck, { backgroundColor: accentColor }]}>
            <Feather name="check" size={12} color="#FFFFFF" />
          </View>
        ) : null}
      </LinearGradient>
      <ThemedText style={styles.themeCardLabel} numberOfLines={1}>
        {label}
      </ThemedText>
    </Pressable>
  );
};

export default function GeneralSettingsScreen({ navigation }: GeneralSettingsScreenProps) {
  const { t } = useTranslation();
  const { theme, isDark, accentColor: themeAccent } = useTheme();
  const { 
    themeMode, 
    setThemeMode,
    accentColor, 
    setAccentColor,
    language,
    setLanguage,
    highContrast, 
    setHighContrast,
    accentColorValue,
  } = useAppearance();

  const [activeModal, setActiveModal] = useState<ModalType>(null);

  const backgroundColor = theme.backgroundRoot;
  const textPrimary = theme.text;
  const textSecondary = theme.textSecondary;
  const iconColor = theme.textSecondary;
  const modalBg = theme.backgroundDefault;
  const overlayBg = "rgba(0,0,0,0.5)";

  const getThemeModeLabel = (mode: ThemeMode): string => {
    return t(`themes.${mode}`);
  };

  const getColorLabel = (colorKey: string): string => {
    return t(`colors.${colorKey}`);
  };

  const [textSize, setTextSize] = useState<'small' | 'normal' | 'large' | 'xlarge'>('normal');
  const [reducedMotion, setReducedMotion] = useState(false);

  const getTextSizeLabel = (size: string): string => {
    switch (size) {
      case 'small': return t('settings.textSizeSmall');
      case 'normal': return t('settings.textSizeNormal');
      case 'large': return t('settings.textSizeLarge');
      case 'xlarge': return t('settings.textSizeXLarge');
      default: return t('settings.textSizeNormal');
    }
  };

  const settingsItems = [
    { 
      id: "language",
      icon: "language" as const, 
      title: t('settings.language'), 
      subtitle: Languages[language],
      type: "modal" as const,
      modalType: "language" as ModalType
    },
    { 
      id: "accent",
      icon: "accent" as const, 
      title: t('settings.accent'), 
      subtitle: getColorLabel(accentColor),
      type: "modal" as const,
      modalType: "accent" as ModalType
    },
    { 
      id: "contrast",
      icon: "contrast" as const, 
      title: t('settings.highContrast'), 
      subtitle: t('settings.highContrastDesc'),
      type: "toggle" as const,
      modalType: null
    },
    { 
      id: "textsize",
      icon: "textsize" as const, 
      title: t('settings.textSize'), 
      subtitle: getTextSizeLabel(textSize),
      type: "modal" as const,
      modalType: "textsize" as ModalType
    },
    { 
      id: "motion",
      icon: "motion" as const, 
      title: t('settings.reducedMotion'), 
      subtitle: t('settings.reducedMotionDesc'),
      type: "toggle" as const,
      modalType: null
    },
  ];

  const renderIcon = (iconName: string) => {
    switch (iconName) {
      case "language":
        return <LanguageIcon color={iconColor} />;
      case "theme":
        return <ThemeIcon color={iconColor} />;
      case "accent":
        return <AccentIcon color={iconColor} accentColor={accentColorValue} />;
      case "contrast":
        return <ContrastIcon color={iconColor} />;
      case "textsize":
        return <TextSizeIcon color={iconColor} />;
      case "motion":
        return <MotionIcon color={iconColor} />;
      default:
        return null;
    }
  };

  const handleItemPress = (item: typeof settingsItems[0]) => {
    if (item.type === "modal" && item.modalType) {
      setActiveModal(item.modalType);
    }
  };

  const closeModal = () => setActiveModal(null);

  const handleLanguageSelect = (lang: Language) => {
    setLanguage(lang);
    closeModal();
  };

  const handleThemeSelect = (mode: ThemeMode) => {
    setThemeMode(mode);
  };

  const handleAccentSelect = (color: AccentColor) => {
    setAccentColor(color);
    closeModal();
  };

  const handleTextSizeSelect = (size: 'small' | 'normal' | 'large' | 'xlarge') => {
    setTextSize(size);
    closeModal();
  };

  const renderLanguageModal = () => (
    <Modal visible={activeModal === 'language'} transparent animationType="fade" onRequestClose={closeModal}>
      <View style={[styles.modalOverlay, { backgroundColor: overlayBg }]}>
        <Pressable style={styles.modalBackdrop} onPress={closeModal} />
        <View style={[styles.modalContent, { backgroundColor: modalBg }]}>
          <ThemedText style={[styles.modalTitle, { color: textPrimary }]}>{t('settings.selectLanguage')}</ThemedText>
          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            {(Object.entries(Languages) as [Language, string][]).map(([id, name]) => (
              <Pressable
                key={id}
                style={({ pressed }) => [styles.modalOption, { opacity: pressed ? 0.6 : 1 }]}
                onPress={() => handleLanguageSelect(id)}
              >
                <RadioButton selected={language === id} color={accentColorValue} />
                <View style={styles.flagContainer}>
                  <FlagIcon countryCode={id} />
                </View>
                <ThemedText style={[styles.modalOptionText, { color: textPrimary }]}>{name}</ThemedText>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable style={styles.cancelButton} onPress={closeModal}>
            <ThemedText style={[styles.cancelText, { color: accentColorValue }]}>{t('common.cancel')}</ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );

  const renderAccentModal = () => (
    <Modal visible={activeModal === 'accent'} transparent animationType="fade" onRequestClose={closeModal}>
      <View style={[styles.modalOverlay, { backgroundColor: overlayBg }]}>
        <Pressable style={styles.modalBackdrop} onPress={closeModal} />
        <View style={[styles.modalContent, { backgroundColor: modalBg }]}>
          <ThemedText style={[styles.modalTitle, { color: textPrimary }]}>{t('settings.selectAccent')}</ThemedText>
          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            {(Object.entries(AccentColors) as [AccentColor, { name: string; color: string }][]).map(([id, { color }]) => (
              <Pressable
                key={id}
                style={({ pressed }) => [styles.modalOption, { opacity: pressed ? 0.6 : 1 }]}
                onPress={() => handleAccentSelect(id)}
              >
                <RadioButton selected={accentColor === id} color={color} />
                <View style={[styles.colorDot, { backgroundColor: color }]} />
                <ThemedText style={[styles.modalOptionText, { color: textPrimary }]}>{getColorLabel(id)}</ThemedText>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable style={styles.cancelButton} onPress={closeModal}>
            <ThemedText style={[styles.cancelText, { color: accentColorValue }]}>{t('common.cancel')}</ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );

  return (
    <>
      <ScreenScrollView 
        style={[styles.scrollView, { backgroundColor }]}
        contentContainerStyle={styles.scrollContent}
      >
        <ThemedText style={[styles.sectionTitle, { color: textSecondary }]}>
          {t('settings.theme')}
        </ThemedText>

        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.themesScrollContent}
          style={styles.themesScroll}
        >
          {ThemeOptions.map((option) => (
            <ThemePreviewCard
              key={option.id}
              themeId={option.id}
              isSelected={themeMode === option.id}
              onSelect={() => handleThemeSelect(option.id)}
              label={t(option.labelKey)}
              accentColor={accentColorValue}
            />
          ))}
        </ScrollView>

        <ThemedText style={[styles.sectionTitle, { color: textSecondary, marginTop: Spacing["2xl"] }]}>
          {t('settings.appearance')}
        </ThemedText>

        <View style={styles.settingsList}>
          {settingsItems.map((item) => (
            <Pressable
              key={item.id}
              style={({ pressed }) => [
                styles.settingItem,
                { opacity: pressed && item.type !== "toggle" ? 0.6 : 1 }
              ]}
              onPress={() => handleItemPress(item)}
              disabled={item.type === "toggle"}
            >
              <View style={styles.iconContainer}>
                {renderIcon(item.icon)}
              </View>
              <View style={styles.textContainer}>
                <ThemedText style={[styles.settingTitle, { color: textPrimary }]}>
                  {item.title}
                </ThemedText>
                <ThemedText style={[styles.settingSubtitle, { color: textSecondary }]}>
                  {item.subtitle}
                </ThemedText>
              </View>
              {item.type === "toggle" ? (
                <Switch
                  value={item.id === "contrast" ? highContrast : reducedMotion}
                  onValueChange={item.id === "contrast" ? setHighContrast : setReducedMotion}
                  trackColor={{ false: theme.border, true: accentColorValue }}
                  thumbColor={theme.backgroundDefault}
                  ios_backgroundColor={theme.border}
                />
              ) : null}
            </Pressable>
          ))}
        </View>
      </ScreenScrollView>

      {renderLanguageModal()}
      {renderAccentModal()}
      {activeModal === 'textsize' && (
        <Modal visible={true} transparent animationType="fade" onRequestClose={closeModal}>
          <View style={[styles.modalOverlay, { backgroundColor: overlayBg }]}>
            <Pressable style={styles.modalBackdrop} onPress={closeModal} />
            <View style={[styles.modalContent, { backgroundColor: modalBg }]}>
              <ThemedText style={[styles.modalTitle, { color: textPrimary }]}>{t('settings.selectTextSize')}</ThemedText>
              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                {(['small', 'normal', 'large', 'xlarge'] as const).map((size) => (
                  <Pressable
                    key={size}
                    style={({ pressed }) => [styles.modalOption, { opacity: pressed ? 0.6 : 1 }]}
                    onPress={() => handleTextSizeSelect(size)}
                  >
                    <RadioButton selected={textSize === size} color={accentColorValue} />
                    <ThemedText style={[styles.modalOptionText, { color: textPrimary }]}>{getTextSizeLabel(size)}</ThemedText>
                  </Pressable>
                ))}
              </ScrollView>
              <Pressable style={styles.cancelButton} onPress={closeModal}>
                <ThemedText style={[styles.cancelText, { color: accentColorValue }]}>{t('common.cancel')}</ThemedText>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing["3xl"],
  },
  pageTitle: {
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: 0.37,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "400",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.lg,
    marginTop: Spacing.lg,
    marginLeft: Spacing.xs,
  },
  themesScroll: {
    marginHorizontal: -Spacing.lg,
  },
  themesScrollContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  themeCard: {
    width: THEME_CARD_WIDTH,
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  themeCardGradient: {
    width: '100%',
    height: THEME_CARD_HEIGHT,
    borderRadius: BorderRadius.md - 2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  themeCardIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeCardCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeCardLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  settingsList: {
    gap: 0,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    minHeight: 60,
  },
  iconContainer: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  textContainer: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 17,
    fontWeight: "400",
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    width: "100%",
    maxHeight: "70%",
    borderRadius: BorderRadius.md,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  modalScroll: {
    maxHeight: 350,
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: Spacing.lg,
  },
  modalOptionText: {
    fontSize: 16,
    fontWeight: "400",
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  flagContainer: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  colorDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: Spacing.sm,
  },
  cancelButton: {
    alignItems: "center",
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: "500",
  },
});
