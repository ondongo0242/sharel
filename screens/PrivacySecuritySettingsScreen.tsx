import { useState } from "react";
import { StyleSheet, View, Pressable, Switch, Modal, ScrollView } from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Svg, { Path, Circle, Rect } from "react-native-svg";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";
import type { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { useTheme } from "@/hooks/useTheme";

type PrivacySecuritySettingsScreenProps = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, "PrivacySecuritySettings">;
};

type VisibilityOption = 'everyone' | 'contacts' | 'nobody';

const RadioButton = ({ selected, color }: { selected: boolean; color: string }) => (
  <View style={[styles.radioOuter, { borderColor: selected ? color : "#666666" }]}>
    {selected ? <View style={[styles.radioInner, { backgroundColor: color }]} /> : null}
  </View>
);

const ShieldIcon = ({ color }: { color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const LockIcon = ({ color }: { color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Rect x="3" y="11" width="18" height="11" rx="2" stroke={color} strokeWidth={1.5} />
    <Path d="M7 11V7C7 4.23858 9.23858 2 12 2C14.7614 2 17 4.23858 17 7V11" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    <Circle cx="12" cy="16" r="1.5" fill={color} />
  </Svg>
);

const EyeIcon = ({ color }: { color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={1.5} />
  </Svg>
);

const KeyIcon = ({ color }: { color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Circle cx="8" cy="15" r="4" stroke={color} strokeWidth={1.5} />
    <Path d="M11 12L21 2M21 2L21 6M21 2L17 2" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const HistoryIcon = ({ color }: { color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={1.5} />
    <Path d="M12 7V12L15 15" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export default function PrivacySecuritySettingsScreen({ navigation }: PrivacySecuritySettingsScreenProps) {
  const { t } = useTranslation();
  const { theme, accentColor } = useTheme();

  const [profileVisibility, setProfileVisibility] = useState<VisibilityOption>('everyone');
  const [onlineStatus, setOnlineStatus] = useState(true);
  const [lastSeen, setLastSeen] = useState(true);
  const [transferHistory, setTransferHistory] = useState(true);
  const [appLock, setAppLock] = useState(false);
  const [biometricLock, setBiometricLock] = useState(false);
  const [encryptTransfers, setEncryptTransfers] = useState(true);
  const [incognitoMode, setIncognitoMode] = useState(false);
  const [showVisibilityModal, setShowVisibilityModal] = useState(false);

  const backgroundColor = theme.backgroundRoot;
  const textPrimary = theme.text;
  const textSecondary = theme.textSecondary;
  const iconColor = theme.textSecondary;
  const cardBg = theme.backgroundSecondary;
  const modalBg = theme.backgroundDefault;

  const getVisibilityLabel = (option: VisibilityOption): string => {
    switch (option) {
      case 'everyone': return t('privacy.everyone');
      case 'contacts': return t('privacy.contactsOnly');
      case 'nobody': return t('privacy.nobody');
      default: return t('privacy.everyone');
    }
  };

  const renderIcon = (iconType: string) => {
    switch (iconType) {
      case 'shield': return <ShieldIcon color={iconColor} />;
      case 'lock': return <LockIcon color={iconColor} />;
      case 'eye': return <EyeIcon color={iconColor} />;
      case 'key': return <KeyIcon color={iconColor} />;
      case 'history': return <HistoryIcon color={iconColor} />;
      default: return <Feather name="shield" size={20} color={iconColor} />;
    }
  };

  const renderSettingItem = (
    icon: string,
    title: string,
    subtitle: string,
    rightElement: React.ReactNode,
    onPress?: () => void
  ) => (
    <Pressable
      style={({ pressed }) => [
        styles.settingItem,
        { opacity: pressed && onPress ? 0.6 : 1 }
      ]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={[styles.iconContainer, { backgroundColor: theme.backgroundTertiary }]}>
        {renderIcon(icon)}
      </View>
      <View style={styles.settingTextContainer}>
        <ThemedText style={[styles.settingTitle, { color: textPrimary }]}>{title}</ThemedText>
        <ThemedText style={[styles.settingSubtitle, { color: textSecondary }]} numberOfLines={2}>{subtitle}</ThemedText>
      </View>
      {rightElement}
    </Pressable>
  );

  const renderToggle = (value: boolean, onChange: (val: boolean) => void) => (
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ false: theme.border, true: accentColor }}
      thumbColor={theme.backgroundDefault}
      ios_backgroundColor={theme.border}
    />
  );

  const renderChevron = () => (
    <Feather name="chevron-right" size={20} color={textSecondary} />
  );

  return (
    <>
      <ScreenScrollView 
        style={[styles.scrollView, { backgroundColor }]}
        contentContainerStyle={styles.scrollContent}
      >
        <ThemedText style={[styles.sectionTitle, { color: textSecondary }]}>
          {t('privacy.privacy').toUpperCase()}
        </ThemedText>

        <View style={styles.settingsGroup}>
          {renderSettingItem(
            "eye",
            t('privacy.profileVisibility'),
            getVisibilityLabel(profileVisibility),
            renderChevron(),
            () => setShowVisibilityModal(true)
          )}
          {renderSettingItem(
            "eye",
            t('privacy.onlineStatus'),
            t('privacy.onlineStatusDesc'),
            renderToggle(onlineStatus, setOnlineStatus)
          )}
          {renderSettingItem(
            "history",
            t('privacy.lastSeen'),
            t('privacy.lastSeenDesc'),
            renderToggle(lastSeen, setLastSeen)
          )}
          {renderSettingItem(
            "history",
            t('privacy.transferHistory'),
            t('privacy.transferHistoryDesc'),
            renderToggle(transferHistory, setTransferHistory)
          )}
        </View>

        <ThemedText style={[styles.sectionTitle, { color: textSecondary }]}>
          {t('privacy.security').toUpperCase()}
        </ThemedText>

        <View style={styles.settingsGroup}>
          {renderSettingItem(
            "lock",
            t('privacy.appLock'),
            t('privacy.appLockDesc'),
            renderToggle(appLock, setAppLock)
          )}
          {renderSettingItem(
            "key",
            t('privacy.biometric'),
            t('privacy.biometricDesc'),
            renderToggle(biometricLock, setBiometricLock)
          )}
          {renderSettingItem(
            "shield",
            t('privacy.encryptTransfers'),
            t('privacy.encryptTransfersDesc'),
            renderToggle(encryptTransfers, setEncryptTransfers)
          )}
        </View>

        <ThemedText style={[styles.sectionTitle, { color: textSecondary }]}>
          {t('privacy.data').toUpperCase()}
        </ThemedText>

        <View style={styles.settingsGroup}>
          {renderSettingItem(
            "eye",
            t('privacy.incognitoMode'),
            t('privacy.incognitoModeDesc'),
            renderToggle(incognitoMode, setIncognitoMode)
          )}
          {renderSettingItem(
            "shield",
            t('privacy.blockedDevices'),
            t('privacy.blockedDevicesDesc'),
            renderChevron(),
            () => {}
          )}
          {renderSettingItem(
            "history",
            t('privacy.activeSessions'),
            t('privacy.activeSessionsDesc'),
            renderChevron(),
            () => {}
          )}
        </View>
      </ScreenScrollView>

      <Modal visible={showVisibilityModal} transparent animationType="fade" onRequestClose={() => setShowVisibilityModal(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowVisibilityModal(false)} />
          <View style={[styles.modalContent, { backgroundColor: modalBg }]}>
            <ThemedText style={[styles.modalTitle, { color: textPrimary }]}>
              {t('privacy.profileVisibility')}
            </ThemedText>
            
            {(['everyone', 'contacts', 'nobody'] as VisibilityOption[]).map((option) => (
              <Pressable
                key={option}
                style={({ pressed }) => [styles.modalOption, { opacity: pressed ? 0.6 : 1 }]}
                onPress={() => {
                  setProfileVisibility(option);
                  setShowVisibilityModal(false);
                }}
              >
                <RadioButton selected={profileVisibility === option} color={accentColor} />
                <ThemedText style={[styles.modalOptionText, { color: textPrimary }]}>
                  {getVisibilityLabel(option)}
                </ThemedText>
              </Pressable>
            ))}

            <Pressable style={styles.cancelButtonLarge} onPress={() => setShowVisibilityModal(false)}>
              <ThemedText style={[styles.cancelText, { color: accentColor }]}>{t('common.cancel')}</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
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
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
    marginLeft: Spacing.xs,
  },
  settingsGroup: {
    gap: Spacing.xs,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  settingTextContainer: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    width: "100%",
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: Spacing.lg,
    textAlign: "center",
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  modalOptionText: {
    fontSize: 16,
  },
  cancelButtonLarge: {
    alignItems: "center",
    paddingVertical: Spacing.md,
    marginTop: Spacing.md,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: "500",
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});
