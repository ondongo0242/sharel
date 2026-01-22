import { useState, useEffect } from "react";
import { StyleSheet, View, Pressable, Switch, Modal, ScrollView, Alert } from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Svg, { Path, Circle, Rect } from "react-native-svg";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";
import type { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { useTheme } from "@/hooks/useTheme";

type StorageDataSettingsScreenProps = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, "StorageDataSettings">;
};

type CacheSize = '100MB' | '500MB' | '1GB' | '2GB';
type DataLimit = 'unlimited' | '1GB' | '5GB' | '10GB';

const RadioButton = ({ selected, color }: { selected: boolean; color: string }) => (
  <View style={[styles.radioOuter, { borderColor: selected ? color : "#666666" }]}>
    {selected ? <View style={[styles.radioInner, { backgroundColor: color }]} /> : null}
  </View>
);

const StorageIcon = ({ color }: { color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Rect x="4" y="4" width="16" height="6" rx="1" stroke={color} strokeWidth={1.5} />
    <Rect x="4" y="14" width="16" height="6" rx="1" stroke={color} strokeWidth={1.5} />
    <Circle cx="7" cy="7" r="1" fill={color} />
    <Circle cx="7" cy="17" r="1" fill={color} />
  </Svg>
);

const TrashIcon = ({ color }: { color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path d="M3 6H5H21" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M8 6V4C8 3.44772 8.44772 3 9 3H15C15.5523 3 16 3.44772 16 4V6" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M19 6V20C19 20.5523 18.5523 21 18 21H6C5.44772 21 5 20.5523 5 20V6" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const FolderIcon = ({ color }: { color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path d="M22 19C22 19.5304 21.7893 20.0391 21.4142 20.4142C21.0391 20.7893 20.5304 21 20 21H4C3.46957 21 2.96086 20.7893 2.58579 20.4142C2.21071 20.0391 2 19.5304 2 19V5C2 4.46957 2.21071 3.96086 2.58579 3.58579C2.96086 3.21071 3.46957 3 4 3H9L11 6H20C20.5304 6 21.0391 6.21071 21.4142 6.58579C21.7893 6.96086 22 7.46957 22 8V19Z" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const WifiIcon = ({ color }: { color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path d="M5 12.55C7.59 10.39 10.75 9.19 14 9.19C17.25 9.19 20.41 10.39 23 12.55" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M1 8.55C4.51 5.43 9.13 3.69 14 3.69C18.87 3.69 23.49 5.43 27 8.55" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M8.53 16.11C10.4 14.67 12.67 13.89 15 13.89C17.33 13.89 19.6 14.67 21.47 16.11" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    <Circle cx="12" cy="20" r="1" fill={color} />
  </Svg>
);

const DownloadIcon = ({ color }: { color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M7 10L12 15L17 10" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M12 15V3" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export default function StorageDataSettingsScreen({ navigation }: StorageDataSettingsScreenProps) {
  const { t } = useTranslation();
  const { theme, accentColor } = useTheme();

  const [usedSpace, setUsedSpace] = useState("2.4 GB");
  const [availableSpace, setAvailableSpace] = useState("12.6 GB");
  const [cacheSize, setCacheSize] = useState("156 MB");
  const [maxCacheSize, setMaxCacheSize] = useState<CacheSize>('500MB');
  const [autoClearCache, setAutoClearCache] = useState(true);
  const [mobileData, setMobileData] = useState(false);
  const [dataLimit, setDataLimit] = useState<DataLimit>('unlimited');
  const [warnBeforeData, setWarnBeforeData] = useState(true);
  const [autoDeleteOld, setAutoDeleteOld] = useState(false);
  const [showCacheSizeModal, setShowCacheSizeModal] = useState(false);
  const [showDataLimitModal, setShowDataLimitModal] = useState(false);

  const backgroundColor = theme.backgroundRoot;
  const textPrimary = theme.text;
  const textSecondary = theme.textSecondary;
  const iconColor = theme.textSecondary;
  const modalBg = theme.backgroundDefault;

  const getCacheSizeLabel = (size: CacheSize): string => {
    return size;
  };

  const getDataLimitLabel = (limit: DataLimit): string => {
    switch (limit) {
      case 'unlimited': return t('storageData.unlimited');
      default: return limit;
    }
  };

  const handleClearCache = () => {
    Alert.alert(
      t('storageData.clearCache'),
      t('storageData.clearCacheConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.confirm'), onPress: () => setCacheSize("0 MB") }
      ]
    );
  };

  const renderIcon = (iconType: string) => {
    switch (iconType) {
      case 'storage': return <StorageIcon color={iconColor} />;
      case 'trash': return <TrashIcon color={iconColor} />;
      case 'folder': return <FolderIcon color={iconColor} />;
      case 'wifi': return <WifiIcon color={iconColor} />;
      case 'download': return <DownloadIcon color={iconColor} />;
      default: return <Feather name="hard-drive" size={20} color={iconColor} />;
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

  const renderInfoBadge = (text: string) => (
    <View style={[styles.infoBadge, { backgroundColor: theme.backgroundTertiary }]}>
      <ThemedText style={[styles.infoBadgeText, { color: textSecondary }]}>{text}</ThemedText>
    </View>
  );

  return (
    <>
      <ScreenScrollView 
        style={[styles.scrollView, { backgroundColor }]}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={[styles.storageCard, { backgroundColor: theme.backgroundSecondary }]}>
          <View style={styles.storageHeader}>
            <Feather name="hard-drive" size={24} color={accentColor} />
            <ThemedText style={[styles.storageTitle, { color: textPrimary }]}>
              {t('storageData.deviceStorage')}
            </ThemedText>
          </View>
          <View style={styles.storageBar}>
            <View style={[styles.storageBarFill, { backgroundColor: accentColor, width: '20%' }]} />
          </View>
          <View style={styles.storageInfo}>
            <ThemedText style={[styles.storageInfoText, { color: textSecondary }]}>
              {t('storageData.used')}: {usedSpace}
            </ThemedText>
            <ThemedText style={[styles.storageInfoText, { color: textSecondary }]}>
              {t('storageData.available')}: {availableSpace}
            </ThemedText>
          </View>
        </View>

        <ThemedText style={[styles.sectionTitle, { color: textSecondary }]}>
          {t('storageData.cache').toUpperCase()}
        </ThemedText>

        <View style={styles.settingsGroup}>
          {renderSettingItem(
            "storage",
            t('storageData.appCache'),
            cacheSize,
            renderInfoBadge(cacheSize)
          )}
          {renderSettingItem(
            "storage",
            t('storageData.maxCacheSize'),
            maxCacheSize,
            renderChevron(),
            () => setShowCacheSizeModal(true)
          )}
          {renderSettingItem(
            "trash",
            t('storageData.autoClearCache'),
            t('storageData.autoClearCacheDesc'),
            renderToggle(autoClearCache, setAutoClearCache)
          )}
          {renderSettingItem(
            "trash",
            t('storageData.clearCacheNow'),
            t('storageData.clearCacheNowDesc'),
            renderChevron(),
            handleClearCache
          )}
        </View>

        <ThemedText style={[styles.sectionTitle, { color: textSecondary }]}>
          {t('storageData.mobileData').toUpperCase()}
        </ThemedText>

        <View style={styles.settingsGroup}>
          {renderSettingItem(
            "wifi",
            t('storageData.allowMobileData'),
            t('storageData.allowMobileDataDesc'),
            renderToggle(mobileData, setMobileData)
          )}
          {renderSettingItem(
            "wifi",
            t('storageData.monthlyLimit'),
            getDataLimitLabel(dataLimit),
            renderChevron(),
            () => setShowDataLimitModal(true)
          )}
          {renderSettingItem(
            "wifi",
            t('storageData.warnBeforeUsing'),
            t('storageData.warnBeforeUsingDesc'),
            renderToggle(warnBeforeData, setWarnBeforeData)
          )}
        </View>

        <ThemedText style={[styles.sectionTitle, { color: textSecondary }]}>
          {t('storageData.receivedFiles').toUpperCase()}
        </ThemedText>

        <View style={styles.settingsGroup}>
          {renderSettingItem(
            "folder",
            t('storageData.saveLocation'),
            "Sharel/Downloads",
            renderChevron(),
            () => {}
          )}
          {renderSettingItem(
            "trash",
            t('storageData.autoDeleteOld'),
            t('storageData.autoDeleteOldDesc'),
            renderToggle(autoDeleteOld, setAutoDeleteOld)
          )}
          {renderSettingItem(
            "download",
            t('storageData.exportFiles'),
            t('storageData.exportFilesDesc'),
            renderChevron(),
            () => {}
          )}
        </View>
      </ScreenScrollView>

      <Modal visible={showCacheSizeModal} transparent animationType="fade" onRequestClose={() => setShowCacheSizeModal(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowCacheSizeModal(false)} />
          <View style={[styles.modalContent, { backgroundColor: modalBg }]}>
            <ThemedText style={[styles.modalTitle, { color: textPrimary }]}>
              {t('storageData.selectMaxCache')}
            </ThemedText>
            
            {(['100MB', '500MB', '1GB', '2GB'] as CacheSize[]).map((size) => (
              <Pressable
                key={size}
                style={({ pressed }) => [styles.modalOption, { opacity: pressed ? 0.6 : 1 }]}
                onPress={() => {
                  setMaxCacheSize(size);
                  setShowCacheSizeModal(false);
                }}
              >
                <RadioButton selected={maxCacheSize === size} color={accentColor} />
                <ThemedText style={[styles.modalOptionText, { color: textPrimary }]}>
                  {getCacheSizeLabel(size)}
                </ThemedText>
              </Pressable>
            ))}

            <Pressable style={styles.cancelButtonLarge} onPress={() => setShowCacheSizeModal(false)}>
              <ThemedText style={[styles.cancelText, { color: accentColor }]}>{t('common.cancel')}</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={showDataLimitModal} transparent animationType="fade" onRequestClose={() => setShowDataLimitModal(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowDataLimitModal(false)} />
          <View style={[styles.modalContent, { backgroundColor: modalBg }]}>
            <ThemedText style={[styles.modalTitle, { color: textPrimary }]}>
              {t('storageData.selectDataLimit')}
            </ThemedText>
            
            {(['unlimited', '1GB', '5GB', '10GB'] as DataLimit[]).map((limit) => (
              <Pressable
                key={limit}
                style={({ pressed }) => [styles.modalOption, { opacity: pressed ? 0.6 : 1 }]}
                onPress={() => {
                  setDataLimit(limit);
                  setShowDataLimitModal(false);
                }}
              >
                <RadioButton selected={dataLimit === limit} color={accentColor} />
                <ThemedText style={[styles.modalOptionText, { color: textPrimary }]}>
                  {getDataLimitLabel(limit)}
                </ThemedText>
              </Pressable>
            ))}

            <Pressable style={styles.cancelButtonLarge} onPress={() => setShowDataLimitModal(false)}>
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
    marginBottom: Spacing.lg,
  },
  storageCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  storageHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  storageTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  storageBar: {
    height: 8,
    backgroundColor: "rgba(128,128,128,0.3)",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: Spacing.sm,
  },
  storageBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  storageInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  storageInfoText: {
    fontSize: 13,
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
  infoBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  infoBadgeText: {
    fontSize: 13,
    fontWeight: "500",
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
