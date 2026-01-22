import { useState, useEffect, useCallback } from "react";
import { StyleSheet, View, Pressable, Switch, Platform } from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";
import type { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { useTheme } from "@/hooks/useTheme";
import { 
  gestureService, 
  ShakeAction, 
  ShakeSensitivity, 
  GestureSettings,
} from "@/services/GestureService";
import { logger } from "@/services/LoggerService";

type GesturesSettingsScreenProps = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, "GesturesSettings">;
};

interface ShakeActionOption {
  value: ShakeAction;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  description: string;
}

interface SensitivityOption {
  value: ShakeSensitivity;
  label: string;
  description: string;
}

const SHAKE_ACTIONS: ShakeActionOption[] = [
  { value: 'discover_devices', label: 'Discover Devices', icon: 'search', description: 'Search for nearby devices' },
  { value: 'quick_send', label: 'Quick Send', icon: 'send', description: 'Open file selection' },
  { value: 'generate_qr', label: 'Generate QR', icon: 'grid', description: 'Show your QR code' },
  { value: 'cancel_transfer', label: 'Cancel Transfer', icon: 'x-circle', description: 'Cancel ongoing transfer' },
  { value: 'invisible_mode', label: 'Invisible Mode', icon: 'eye-off', description: 'Hide from discovery' },
  { value: 'none', label: 'Disabled', icon: 'minus', description: 'Do nothing on shake' },
];

const SENSITIVITY_OPTIONS: SensitivityOption[] = [
  { value: 'low', label: 'Low', description: 'Requires a strong shake' },
  { value: 'medium', label: 'Medium', description: 'Recommended setting' },
  { value: 'high', label: 'High', description: 'Very sensitive to movement' },
];

export default function GesturesSettingsScreen({ navigation }: GesturesSettingsScreenProps) {
  const { theme, accentColor } = useTheme();
  const { t } = useTranslation();
  const [settings, setSettings] = useState<GestureSettings>(gestureService.getSettings());
  const [showActionPicker, setShowActionPicker] = useState(false);
  const [showSensitivityPicker, setShowSensitivityPicker] = useState(false);

  useEffect(() => {
    gestureService.initialize();
    setSettings(gestureService.getSettings());
    logger.logUIEvent('GesturesSettings', 'Screen opened');
  }, []);

  const updateSetting = useCallback(async (key: keyof GestureSettings, value: any) => {
    const newSettings = { [key]: value };
    await gestureService.saveSettings(newSettings);
    setSettings(gestureService.getSettings());
    logger.logGestureEvent('Setting changed', key, { newValue: value });
  }, []);

  const selectedAction = SHAKE_ACTIONS.find(a => a.value === settings.shakeAction);
  const selectedSensitivity = SENSITIVITY_OPTIONS.find(s => s.value === settings.shakeSensitivity);

  const renderSection = (title: string, children: React.ReactNode) => (
    <View style={styles.section}>
      <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
        {title}
      </ThemedText>
      <View style={[styles.sectionContent, { backgroundColor: theme.backgroundDefault }]}>
        {children}
      </View>
    </View>
  );

  const renderSettingRow = (
    icon: keyof typeof Feather.glyphMap,
    title: string,
    subtitle?: string,
    rightElement?: React.ReactNode,
    onPress?: () => void
  ) => (
    <Pressable
      style={[styles.settingRow, { borderBottomColor: theme.border }]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={[styles.iconContainer, { backgroundColor: accentColor + '20' }]}>
        <Feather name={icon} size={20} color={accentColor} />
      </View>
      <View style={styles.settingTextContainer}>
        <ThemedText style={[styles.settingTitle, { color: theme.text }]}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText style={[styles.settingSubtitle, { color: theme.textSecondary }]}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {rightElement}
      {onPress ? (
        <Feather name="chevron-right" size={20} color={theme.textSecondary} />
      ) : null}
    </Pressable>
  );

  const renderToggle = (value: boolean, onValueChange: (value: boolean) => void) => (
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: theme.border, true: accentColor }}
      thumbColor={Platform.OS === 'ios' ? undefined : '#fff'}
    />
  );

  return (
    <ScreenScrollView style={{ backgroundColor: theme.backgroundRoot }}>
      <View style={styles.container}>
        {renderSection('Shake Phone', <>
          {renderSettingRow(
            'smartphone',
            'Enable Shake Detection',
            'Perform actions by shaking your phone',
            renderToggle(settings.shakeEnabled, (v) => updateSetting('shakeEnabled', v))
          )}

          {settings.shakeEnabled ? (
            <>
              {renderSettingRow(
                selectedAction?.icon || 'zap',
                'Shake Action',
                selectedAction?.description,
                <ThemedText style={[styles.valueText, { color: accentColor }]}>
                  {selectedAction?.label}
                </ThemedText>,
                () => setShowActionPicker(!showActionPicker)
              )}

              {showActionPicker ? (
                <View style={[styles.pickerContainer, { backgroundColor: theme.backgroundRoot }]}>
                  {SHAKE_ACTIONS.map((action) => (
                    <Pressable
                      key={action.value}
                      style={[
                        styles.pickerOption,
                        { borderBottomColor: theme.border },
                        settings.shakeAction === action.value && { backgroundColor: accentColor + '15' },
                      ]}
                      onPress={() => {
                        updateSetting('shakeAction', action.value);
                        setShowActionPicker(false);
                      }}
                    >
                      <View style={[styles.pickerIconContainer, { backgroundColor: accentColor + '20' }]}>
                        <Feather name={action.icon} size={18} color={accentColor} />
                      </View>
                      <View style={styles.pickerTextContainer}>
                        <ThemedText style={[styles.pickerOptionTitle, { color: theme.text }]}>
                          {action.label}
                        </ThemedText>
                        <ThemedText style={[styles.pickerOptionSubtitle, { color: theme.textSecondary }]}>
                          {action.description}
                        </ThemedText>
                      </View>
                      {settings.shakeAction === action.value ? (
                        <Feather name="check" size={20} color={accentColor} />
                      ) : null}
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {renderSettingRow(
                'sliders',
                'Sensitivity',
                selectedSensitivity?.description,
                <ThemedText style={[styles.valueText, { color: accentColor }]}>
                  {selectedSensitivity?.label}
                </ThemedText>,
                () => setShowSensitivityPicker(!showSensitivityPicker)
              )}

              {showSensitivityPicker ? (
                <View style={[styles.pickerContainer, { backgroundColor: theme.backgroundRoot }]}>
                  {SENSITIVITY_OPTIONS.map((option) => (
                    <Pressable
                      key={option.value}
                      style={[
                        styles.pickerOption,
                        { borderBottomColor: theme.border },
                        settings.shakeSensitivity === option.value && { backgroundColor: accentColor + '15' },
                      ]}
                      onPress={() => {
                        updateSetting('shakeSensitivity', option.value);
                        setShowSensitivityPicker(false);
                      }}
                    >
                      <View style={styles.pickerTextContainer}>
                        <ThemedText style={[styles.pickerOptionTitle, { color: theme.text }]}>
                          {option.label}
                        </ThemedText>
                        <ThemedText style={[styles.pickerOptionSubtitle, { color: theme.textSecondary }]}>
                          {option.description}
                        </ThemedText>
                      </View>
                      {settings.shakeSensitivity === option.value ? (
                        <Feather name="check" size={20} color={accentColor} />
                      ) : null}
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {renderSettingRow(
                'pause-circle',
                'Disable During Transfer',
                'Prevent accidental actions while transferring',
                renderToggle(settings.disableShakeDuringTransfer, (v) => updateSetting('disableShakeDuringTransfer', v))
              )}
            </>
          ) : null}
        </>)}

        {renderSection('Touch Gestures', <>
          {renderSettingRow(
            'maximize-2',
            'Double Tap',
            'Pause/Resume transfer',
            renderToggle(settings.doubleTapAction !== 'none', (v) => updateSetting('doubleTapAction', v ? 'pause_resume_transfer' : 'none'))
          )}

          {renderSettingRow(
            'arrow-left',
            'Swipe Left',
            'Delete file from list',
            renderToggle(settings.swipeLeftAction !== 'none', (v) => updateSetting('swipeLeftAction', v ? 'delete' : 'none'))
          )}

          {renderSettingRow(
            'arrow-right',
            'Swipe Right',
            'Share file externally',
            renderToggle(settings.swipeRightAction !== 'none', (v) => updateSetting('swipeRightAction', v ? 'share' : 'none'))
          )}

          {renderSettingRow(
            'more-horizontal',
            'Long Press',
            'Multi-select files',
            renderToggle(settings.longPressAction !== 'none', (v) => updateSetting('longPressAction', v ? 'multi_select' : 'none'))
          )}
        </>)}

        {renderSection('Screen Orientation', <>
          {renderSettingRow(
            'rotate-cw',
            'Lock Orientation',
            'Prevent auto-rotation during transfers',
            renderToggle(settings.rotationLockEnabled, (v) => updateSetting('rotationLockEnabled', v))
          )}
        </>)}

        <View style={styles.infoContainer}>
          <Feather name="info" size={16} color={theme.textSecondary} />
          <ThemedText style={[styles.infoText, { color: theme.textSecondary }]}>
            Shake your phone to quickly perform actions. Adjust sensitivity based on your preference.
          </ThemedText>
        </View>
      </View>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  section: {
    marginTop: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.sm,
  },
  sectionContent: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 0.5,
    gap: Spacing.md,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingTextContainer: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  settingSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  valueText: {
    fontSize: 14,
    fontWeight: '500',
  },
  pickerContainer: {
    marginHorizontal: Spacing.sm,
    marginVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 0.5,
    gap: Spacing.md,
  },
  pickerIconContainer: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerTextContainer: {
    flex: 1,
  },
  pickerOptionTitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  pickerOptionSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    marginHorizontal: Spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});
