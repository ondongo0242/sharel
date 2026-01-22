import { useState } from "react";
import { StyleSheet, View, Pressable, Switch, Modal, ScrollView } from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Svg, { Path, Circle } from "react-native-svg";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";
import type { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { useTheme } from "@/hooks/useTheme";

type NotificationsSettingsScreenProps = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, "NotificationsSettings">;
};

type SoundOption = 'default' | 'bubble' | 'ding' | 'pop' | 'none';
type VibrationPattern = 'short' | 'medium' | 'long';

const RadioButton = ({ selected, color }: { selected: boolean; color: string }) => (
  <View style={[styles.radioOuter, { borderColor: selected ? color : "#666666" }]}>
    {selected ? <View style={[styles.radioInner, { backgroundColor: color }]} /> : null}
  </View>
);

const BellIcon = ({ color }: { color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path d="M18 8C18 6.4087 17.3679 4.88258 16.2426 3.75736C15.1174 2.63214 13.5913 2 12 2C10.4087 2 8.88258 2.63214 7.75736 3.75736C6.63214 4.88258 6 6.4087 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M13.73 21C13.5542 21.3031 13.3019 21.5547 12.9982 21.7295C12.6946 21.9044 12.3504 21.9965 12 21.9965C11.6496 21.9965 11.3054 21.9044 11.0018 21.7295C10.6982 21.5547 10.4458 21.3031 10.27 21" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const VolumeIcon = ({ color }: { color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path d="M11 5L6 9H2V15H6L11 19V5Z" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M15.54 8.46C16.4774 9.39764 17.0039 10.6692 17.0039 11.995C17.0039 13.3208 16.4774 14.5924 15.54 15.53" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M19.07 4.93C20.9447 6.80528 21.9979 9.34836 21.9979 12C21.9979 14.6516 20.9447 17.1947 19.07 19.07" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const VibrateIcon = ({ color }: { color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path d="M2 8V16M6 6V18M18 6V18M22 8V16" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    <Path d="M10 4H14C15.1046 4 16 4.89543 16 6V18C16 19.1046 15.1046 20 14 20H10C8.89543 20 8 19.1046 8 18V6C8 4.89543 8.89543 4 10 4Z" stroke={color} strokeWidth={1.5} />
  </Svg>
);

const MoonIcon = ({ color }: { color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path d="M21 12.79C20.8427 14.4922 20.2039 16.1144 19.1583 17.4668C18.1127 18.8192 16.7035 19.8458 15.0957 20.4265C13.4879 21.0073 11.7479 21.1181 10.0795 20.7461C8.41104 20.3741 6.88302 19.5345 5.67425 18.3258C4.46548 17.117 3.62593 15.589 3.25391 13.9205C2.88189 12.2521 2.99268 10.5121 3.57345 8.90427C4.15421 7.29645 5.18083 5.88734 6.53321 4.84175C7.88559 3.79616 9.5078 3.15731 11.21 3C10.2134 4.34827 9.73387 6.00945 9.85853 7.68141C9.98319 9.35338 10.7038 10.9251 11.8894 12.1106C13.0749 13.2962 14.6466 14.0168 16.3186 14.1415C17.9906 14.2661 19.6517 13.7866 21 12.79Z" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export default function NotificationsSettingsScreen({ navigation }: NotificationsSettingsScreenProps) {
  const { t } = useTranslation();
  const { theme, accentColor } = useTheme();

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [transferReceived, setTransferReceived] = useState(true);
  const [transferComplete, setTransferComplete] = useState(true);
  const [newDeviceDetected, setNewDeviceDetected] = useState(true);
  const [connectionRequest, setConnectionRequest] = useState(true);
  const [transferErrors, setTransferErrors] = useState(true);
  const [appUpdates, setAppUpdates] = useState(true);
  const [notificationSound, setNotificationSound] = useState<SoundOption>('default');
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [vibrationPattern, setVibrationPattern] = useState<VibrationPattern>('medium');
  const [doNotDisturb, setDoNotDisturb] = useState(false);
  const [showSoundModal, setShowSoundModal] = useState(false);
  const [showVibrationModal, setShowVibrationModal] = useState(false);

  const backgroundColor = theme.backgroundRoot;
  const textPrimary = theme.text;
  const textSecondary = theme.textSecondary;
  const iconColor = theme.textSecondary;
  const modalBg = theme.backgroundDefault;

  const getSoundLabel = (option: SoundOption): string => {
    switch (option) {
      case 'default': return t('notifications.soundDefault');
      case 'bubble': return t('notifications.soundBubble');
      case 'ding': return t('notifications.soundDing');
      case 'pop': return t('notifications.soundPop');
      case 'none': return t('notifications.soundNone');
      default: return t('notifications.soundDefault');
    }
  };

  const getVibrationLabel = (pattern: VibrationPattern): string => {
    switch (pattern) {
      case 'short': return t('notifications.vibrationShort');
      case 'medium': return t('notifications.vibrationMedium');
      case 'long': return t('notifications.vibrationLong');
      default: return t('notifications.vibrationMedium');
    }
  };

  const renderIcon = (iconType: string) => {
    switch (iconType) {
      case 'bell': return <BellIcon color={iconColor} />;
      case 'volume': return <VolumeIcon color={iconColor} />;
      case 'vibrate': return <VibrateIcon color={iconColor} />;
      case 'moon': return <MoonIcon color={iconColor} />;
      default: return <Feather name="bell" size={20} color={iconColor} />;
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
          {t('notifications.general').toUpperCase()}
        </ThemedText>

        <View style={styles.settingsGroup}>
          {renderSettingItem(
            "bell",
            t('notifications.enableNotifications'),
            t('notifications.enableNotificationsDesc'),
            renderToggle(notificationsEnabled, setNotificationsEnabled)
          )}
          {renderSettingItem(
            "moon",
            t('notifications.doNotDisturb'),
            t('notifications.doNotDisturbDesc'),
            renderToggle(doNotDisturb, setDoNotDisturb)
          )}
        </View>

        <ThemedText style={[styles.sectionTitle, { color: textSecondary }]}>
          {t('notifications.events').toUpperCase()}
        </ThemedText>

        <View style={styles.settingsGroup}>
          {renderSettingItem(
            "bell",
            t('notifications.transferReceived'),
            t('notifications.transferReceivedDesc'),
            renderToggle(transferReceived, setTransferReceived)
          )}
          {renderSettingItem(
            "bell",
            t('notifications.transferComplete'),
            t('notifications.transferCompleteDesc'),
            renderToggle(transferComplete, setTransferComplete)
          )}
          {renderSettingItem(
            "bell",
            t('notifications.newDeviceDetected'),
            t('notifications.newDeviceDetectedDesc'),
            renderToggle(newDeviceDetected, setNewDeviceDetected)
          )}
          {renderSettingItem(
            "bell",
            t('notifications.connectionRequest'),
            t('notifications.connectionRequestDesc'),
            renderToggle(connectionRequest, setConnectionRequest)
          )}
          {renderSettingItem(
            "bell",
            t('notifications.transferErrors'),
            t('notifications.transferErrorsDesc'),
            renderToggle(transferErrors, setTransferErrors)
          )}
          {renderSettingItem(
            "bell",
            t('notifications.appUpdates'),
            t('notifications.appUpdatesDesc'),
            renderToggle(appUpdates, setAppUpdates)
          )}
        </View>

        <ThemedText style={[styles.sectionTitle, { color: textSecondary }]}>
          {t('notifications.sounds').toUpperCase()}
        </ThemedText>

        <View style={styles.settingsGroup}>
          {renderSettingItem(
            "volume",
            t('notifications.notificationSound'),
            getSoundLabel(notificationSound),
            renderChevron(),
            () => setShowSoundModal(true)
          )}
        </View>

        <ThemedText style={[styles.sectionTitle, { color: textSecondary }]}>
          {t('notifications.vibrations').toUpperCase()}
        </ThemedText>

        <View style={styles.settingsGroup}>
          {renderSettingItem(
            "vibrate",
            t('notifications.enableVibration'),
            t('notifications.enableVibrationDesc'),
            renderToggle(vibrationEnabled, setVibrationEnabled)
          )}
          {renderSettingItem(
            "vibrate",
            t('notifications.vibrationPattern'),
            getVibrationLabel(vibrationPattern),
            renderChevron(),
            () => setShowVibrationModal(true)
          )}
        </View>
      </ScreenScrollView>

      <Modal visible={showSoundModal} transparent animationType="fade" onRequestClose={() => setShowSoundModal(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowSoundModal(false)} />
          <View style={[styles.modalContent, { backgroundColor: modalBg }]}>
            <ThemedText style={[styles.modalTitle, { color: textPrimary }]}>
              {t('notifications.selectSound')}
            </ThemedText>
            
            {(['default', 'bubble', 'ding', 'pop', 'none'] as SoundOption[]).map((option) => (
              <Pressable
                key={option}
                style={({ pressed }) => [styles.modalOption, { opacity: pressed ? 0.6 : 1 }]}
                onPress={() => {
                  setNotificationSound(option);
                  setShowSoundModal(false);
                }}
              >
                <RadioButton selected={notificationSound === option} color={accentColor} />
                <ThemedText style={[styles.modalOptionText, { color: textPrimary }]}>
                  {getSoundLabel(option)}
                </ThemedText>
              </Pressable>
            ))}

            <Pressable style={styles.cancelButtonLarge} onPress={() => setShowSoundModal(false)}>
              <ThemedText style={[styles.cancelText, { color: accentColor }]}>{t('common.cancel')}</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={showVibrationModal} transparent animationType="fade" onRequestClose={() => setShowVibrationModal(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowVibrationModal(false)} />
          <View style={[styles.modalContent, { backgroundColor: modalBg }]}>
            <ThemedText style={[styles.modalTitle, { color: textPrimary }]}>
              {t('notifications.selectVibration')}
            </ThemedText>
            
            {(['short', 'medium', 'long'] as VibrationPattern[]).map((pattern) => (
              <Pressable
                key={pattern}
                style={({ pressed }) => [styles.modalOption, { opacity: pressed ? 0.6 : 1 }]}
                onPress={() => {
                  setVibrationPattern(pattern);
                  setShowVibrationModal(false);
                }}
              >
                <RadioButton selected={vibrationPattern === pattern} color={accentColor} />
                <ThemedText style={[styles.modalOptionText, { color: textPrimary }]}>
                  {getVibrationLabel(pattern)}
                </ThemedText>
              </Pressable>
            ))}

            <Pressable style={styles.cancelButtonLarge} onPress={() => setShowVibrationModal(false)}>
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
