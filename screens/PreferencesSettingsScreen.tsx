import { useState, useEffect } from "react";
import { StyleSheet, View, Pressable, Switch, Modal, ScrollView, TextInput, Alert } from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Svg, { Path, Circle, Rect } from "react-native-svg";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";
import type { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { useTheme } from "@/hooks/useTheme";
import AsyncStorage from '@react-native-async-storage/async-storage';

type PreferencesSettingsScreenProps = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, "PreferencesSettings">;
};

type ShareMethod = 'p2p' | 'hotspot';

const STORAGE_KEYS = {
  AUTO_ACCEPT: '@preferences_auto_accept',
  CONFIRM_BEFORE_SEND: '@preferences_confirm_send',
  VIBRATION: '@preferences_vibration',
  NOTIFICATION_SOUND: '@preferences_notification_sound',
  SAVE_TO_GALLERY: '@preferences_save_to_gallery',
  DEFAULT_FOLDER: '@preferences_default_folder',
  CREATE_SUBFOLDERS: '@preferences_create_subfolders',
  DEVICE_NAME: '@preferences_device_name',
  DEVICE_VISIBILITY: '@preferences_device_visibility',
  WIFI_DIRECT: '@preferences_wifi_direct',
  DEFAULT_SHARE_METHOD: '@preferences_default_share_method',
};

const RadioButton = ({ selected, color }: { selected: boolean; color: string }) => (
  <View style={[styles.radioOuter, { borderColor: selected ? color : "#666666" }]}>
    {selected ? <View style={[styles.radioInner, { backgroundColor: color }]} /> : null}
  </View>
);

const ShareMethodIcon = ({ method, color }: { method: ShareMethod; color: string }) => {
  if (method === 'p2p') {
    return (
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Circle cx="6" cy="12" r="3" stroke={color} strokeWidth={1.5} />
        <Circle cx="18" cy="6" r="3" stroke={color} strokeWidth={1.5} />
        <Circle cx="18" cy="18" r="3" stroke={color} strokeWidth={1.5} />
        <Path d="M9 10.5L15 7.5M9 13.5L15 16.5" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      </Svg>
    );
  }
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3V7M12 3L9 5M12 3L15 5" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M5 12H19M5 12C3.89543 12 3 12.8954 3 14V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V14C21 12.8954 20.1046 12 19 12M5 12V10C5 8.89543 5.89543 8 7 8H17C18.1046 8 19 8.89543 19 10V12" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Circle cx="8" cy="16" r="1" fill={color} />
      <Circle cx="12" cy="16" r="1" fill={color} />
    </Svg>
  );
};

export default function PreferencesSettingsScreen({ navigation }: PreferencesSettingsScreenProps) {
  const { t } = useTranslation();
  const { theme, accentColor } = useTheme();

  const [autoAccept, setAutoAccept] = useState(false);
  const [confirmBeforeSend, setConfirmBeforeSend] = useState(true);
  const [vibration, setVibration] = useState(true);
  const [notificationSound, setNotificationSound] = useState(true);
  const [saveToGallery, setSaveToGallery] = useState(true);
  const [createSubfolders, setCreateSubfolders] = useState(true);
  const [deviceVisibility, setDeviceVisibility] = useState(true);
  const [wifiDirect, setWifiDirect] = useState(true);
  const [showDeviceNameModal, setShowDeviceNameModal] = useState(false);
  const [showShareMethodModal, setShowShareMethodModal] = useState(false);
  const [deviceName, setDeviceName] = useState("Mon appareil");
  const [defaultShareMethod, setDefaultShareMethod] = useState<ShareMethod>('p2p');

  const backgroundColor = theme.backgroundRoot;
  const textPrimary = theme.text;
  const textSecondary = theme.textSecondary;
  const iconColor = theme.textSecondary;
  const cardBg = theme.backgroundSecondary;
  const modalBg = theme.backgroundDefault;

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const savedMethod = await AsyncStorage.getItem(STORAGE_KEYS.DEFAULT_SHARE_METHOD);
        if (savedMethod === 'p2p' || savedMethod === 'hotspot') {
          setDefaultShareMethod(savedMethod);
        }
        const savedDeviceName = await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_NAME);
        if (savedDeviceName) {
          setDeviceName(savedDeviceName);
        }
      } catch (error) {
        console.log('Error loading preferences:', error);
      }
    };
    loadPreferences();
  }, []);

  const handleSaveDeviceName = async () => {
    if (deviceName.trim()) {
      await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_NAME, deviceName);
      setShowDeviceNameModal(false);
    } else {
      Alert.alert(t('common.error'), t('preferences.deviceNameEmpty'));
    }
  };

  const handleSelectShareMethod = async (method: ShareMethod) => {
    setDefaultShareMethod(method);
    await AsyncStorage.setItem(STORAGE_KEYS.DEFAULT_SHARE_METHOD, method);
    setShowShareMethodModal(false);
  };

  const getShareMethodLabel = (method: ShareMethod): string => {
    switch (method) {
      case 'p2p': return t('preferences.wifiDirectP2P');
      case 'hotspot': return t('preferences.hotspotLocal');
      default: return t('preferences.wifiDirectP2P');
    }
  };

  const getShareMethodDescription = (method: ShareMethod): string => {
    switch (method) {
      case 'p2p': return t('preferences.wifiDirectDesc');
      case 'hotspot': return t('preferences.hotspotDesc');
      default: return '';
    }
  };

  const renderSettingCard = (
    icon: keyof typeof Feather.glyphMap,
    title: string,
    subtitle: string,
    rightElement: React.ReactNode,
    onPress?: () => void
  ) => (
    <Pressable
      style={({ pressed }) => [
        styles.settingCard,
        { backgroundColor: cardBg, opacity: pressed && onPress ? 0.8 : 1 }
      ]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={[styles.iconContainer, { backgroundColor: theme.backgroundTertiary }]}>
        <Feather name={icon} size={20} color={accentColor} />
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
          {t('preferences.defaultShareMethod').toUpperCase()}
        </ThemedText>
        
        <Pressable
          style={({ pressed }) => [
            styles.shareMethodCard,
            { backgroundColor: cardBg, opacity: pressed ? 0.8 : 1 }
          ]}
          onPress={() => setShowShareMethodModal(true)}
        >
          <View style={styles.shareMethodContent}>
            <View style={[styles.shareMethodIconContainer, { backgroundColor: accentColor + '20' }]}>
              <ShareMethodIcon method={defaultShareMethod} color={accentColor} />
            </View>
            <View style={styles.shareMethodInfo}>
              <ThemedText style={[styles.shareMethodLabel, { color: textPrimary }]}>
                {getShareMethodLabel(defaultShareMethod)}
              </ThemedText>
              <ThemedText style={[styles.shareMethodDesc, { color: textSecondary }]}>
                {getShareMethodDescription(defaultShareMethod)}
              </ThemedText>
            </View>
          </View>
          <Feather name="chevron-right" size={20} color={textSecondary} />
        </Pressable>

        <ThemedText style={[styles.sectionTitle, { color: textSecondary }]}>
          {t('preferences.transfer').toUpperCase()}
        </ThemedText>

        <View style={styles.settingsGroup}>
          {renderSettingCard(
            "check-circle",
            t('settings.autoAcceptContacts'),
            t('settings.autoAcceptContactsDesc'),
            renderToggle(autoAccept, setAutoAccept)
          )}
          {renderSettingCard(
            "alert-circle",
            t('settings.confirmBeforeSend'),
            t('settings.confirmBeforeSendDesc'),
            renderToggle(confirmBeforeSend, setConfirmBeforeSend)
          )}
        </View>

        <ThemedText style={[styles.sectionTitle, { color: textSecondary }]}>
          {t('preferences.reception').toUpperCase()}
        </ThemedText>

        <View style={styles.settingsGroup}>
          {renderSettingCard(
            "image",
            t('settings.saveToGallery'),
            t('settings.saveToGalleryDesc'),
            renderToggle(saveToGallery, setSaveToGallery)
          )}
          {renderSettingCard(
            "folder-plus",
            t('settings.createSubfolders'),
            t('settings.createSubfoldersDesc'),
            renderToggle(createSubfolders, setCreateSubfolders)
          )}
        </View>

        <ThemedText style={[styles.sectionTitle, { color: textSecondary }]}>
          {t('preferences.connection').toUpperCase()}
        </ThemedText>

        <View style={styles.settingsGroup}>
          {renderSettingCard(
            "smartphone",
            t('settings.deviceName'),
            deviceName,
            renderChevron(),
            () => setShowDeviceNameModal(true)
          )}
          {renderSettingCard(
            "eye",
            t('settings.deviceVisibility'),
            t('settings.deviceVisibilityDesc'),
            renderToggle(deviceVisibility, setDeviceVisibility)
          )}
          {renderSettingCard(
            "wifi",
            t('settings.wifiDirect'),
            t('settings.wifiDirectDesc'),
            renderToggle(wifiDirect, setWifiDirect)
          )}
        </View>

        <ThemedText style={[styles.sectionTitle, { color: textSecondary }]}>
          {t('preferences.notifications').toUpperCase()}
        </ThemedText>

        <View style={styles.settingsGroup}>
          {renderSettingCard(
            "volume-2",
            t('settings.notificationSound'),
            t('settings.notificationSoundDesc'),
            renderToggle(notificationSound, setNotificationSound)
          )}
          {renderSettingCard(
            "smartphone",
            t('settings.vibration'),
            t('settings.vibrationDesc'),
            renderToggle(vibration, setVibration)
          )}
        </View>
      </ScreenScrollView>

      <Modal visible={showDeviceNameModal} transparent animationType="fade" onRequestClose={() => setShowDeviceNameModal(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowDeviceNameModal(false)} />
          <View style={[styles.modalContent, { backgroundColor: modalBg }]}>
            <ThemedText style={[styles.modalTitle, { color: textPrimary }]}>
              {t('settings.deviceName')}
            </ThemedText>
            <TextInput
              style={[styles.input, { color: textPrimary, borderColor: theme.border, backgroundColor: theme.backgroundSecondary }]}
              value={deviceName}
              onChangeText={setDeviceName}
              placeholder={t('preferences.enterDeviceName')}
              placeholderTextColor={textSecondary}
            />
            <View style={styles.modalButtons}>
              <Pressable style={styles.modalButton} onPress={() => setShowDeviceNameModal(false)}>
                <ThemedText style={[styles.cancelText, { color: textSecondary }]}>
                  {t('common.cancel')}
                </ThemedText>
              </Pressable>
              <Pressable style={styles.modalButton} onPress={handleSaveDeviceName}>
                <ThemedText style={[styles.saveText, { color: accentColor }]}>
                  {t('common.save')}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showShareMethodModal} transparent animationType="fade" onRequestClose={() => setShowShareMethodModal(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowShareMethodModal(false)} />
          <View style={[styles.modalContent, { backgroundColor: modalBg }]}>
            <ThemedText style={[styles.modalTitle, { color: textPrimary }]}>
              {t('preferences.selectShareMethod')}
            </ThemedText>
            
            <Pressable
              style={({ pressed }) => [styles.methodOption, { opacity: pressed ? 0.6 : 1 }]}
              onPress={() => handleSelectShareMethod('p2p')}
            >
              <RadioButton selected={defaultShareMethod === 'p2p'} color={accentColor} />
              <View style={[styles.methodIconContainer, { backgroundColor: accentColor + '20' }]}>
                <ShareMethodIcon method="p2p" color={accentColor} />
              </View>
              <View style={styles.methodTextContainer}>
                <ThemedText style={[styles.methodTitle, { color: textPrimary }]}>{t('preferences.wifiDirectP2P')}</ThemedText>
                <ThemedText style={[styles.methodDesc, { color: textSecondary }]}>{t('preferences.wifiDirectDesc')}</ThemedText>
              </View>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.methodOption, { opacity: pressed ? 0.6 : 1 }]}
              onPress={() => handleSelectShareMethod('hotspot')}
            >
              <RadioButton selected={defaultShareMethod === 'hotspot'} color={accentColor} />
              <View style={[styles.methodIconContainer, { backgroundColor: accentColor + '20' }]}>
                <ShareMethodIcon method="hotspot" color={accentColor} />
              </View>
              <View style={styles.methodTextContainer}>
                <ThemedText style={[styles.methodTitle, { color: textPrimary }]}>{t('preferences.hotspotLocal')}</ThemedText>
                <ThemedText style={[styles.methodDesc, { color: textSecondary }]}>{t('preferences.hotspotDesc')}</ThemedText>
              </View>
            </Pressable>

            <Pressable style={styles.cancelButtonLarge} onPress={() => setShowShareMethodModal(false)}>
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
    gap: Spacing.sm,
  },
  settingCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
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
  shareMethodCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  shareMethodContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: Spacing.md,
  },
  shareMethodIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  shareMethodInfo: {
    flex: 1,
  },
  shareMethodLabel: {
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 4,
  },
  shareMethodDesc: {
    fontSize: 14,
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
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    fontSize: 16,
    marginBottom: Spacing.lg,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.md,
  },
  modalButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: "500",
  },
  saveText: {
    fontSize: 16,
    fontWeight: "600",
  },
  methodOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  methodIconContainer: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  methodTextContainer: {
    flex: 1,
  },
  methodTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  methodDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  cancelButtonLarge: {
    alignItems: "center",
    paddingVertical: Spacing.md,
    marginTop: Spacing.md,
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
