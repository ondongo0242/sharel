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
import TGBoxApiService from "@/services/TGBoxApiService";

type SharelCloudSettingsScreenProps = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, "SharelCloudSettings">;
};

type SyncFrequency = 'realtime' | 'hourly' | 'daily';
type LinkExpiry = '1day' | '7days' | '30days' | 'never';

const RadioButton = ({ selected, color }: { selected: boolean; color: string }) => (
  <View style={[styles.radioOuter, { borderColor: selected ? color : "#666666" }]}>
    {selected ? <View style={[styles.radioInner, { backgroundColor: color }]} /> : null}
  </View>
);

const CloudIcon = ({ color }: { color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path d="M18 10H16.74C16.3659 8.55186 15.5045 7.27434 14.3002 6.37157C13.0959 5.4688 11.6198 4.99445 10.1146 5.02361C8.60945 5.05278 7.15388 5.58377 5.98691 6.53271C4.81993 7.48165 4.00953 8.79238 3.69 10.25C2.6504 10.4152 1.71499 10.9588 1.05255 11.7759C0.390115 12.593 0.045776 13.6261 0.0813929 14.68C0.117009 15.7339 0.530118 16.7395 1.24622 17.5072C1.96232 18.275 2.93252 18.7518 3.98 18.85H18C19.0609 18.85 20.0783 18.4285 20.8284 17.6784C21.5786 16.9282 22 15.9109 22 14.85C22 13.7891 21.5786 12.7717 20.8284 12.0216C20.0783 11.2714 19.0609 10.85 18 10.85V10Z" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const SyncIcon = ({ color }: { color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path d="M23 4V10H17" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M1 20V14H7" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M3.51 9.00001C4.01717 7.56679 4.87913 6.28543 6.01547 5.27543C7.1518 4.26543 8.52547 3.55978 10.0083 3.22427C11.4911 2.88877 13.0348 2.93436 14.4952 3.35679C15.9556 3.77921 17.2853 4.56473 18.36 5.64001L23 10M1 14L5.64 18.36C6.71475 19.4353 8.04437 20.2208 9.50481 20.6432C10.9652 21.0657 12.5089 21.1112 13.9917 20.7757C15.4745 20.4402 16.8482 19.7346 17.9845 18.7246C19.1209 17.7146 19.9828 16.4332 20.49 15" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const LinkIcon = ({ color }: { color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path d="M10 13C10.4295 13.5741 10.9774 14.0492 11.6066 14.3929C12.2357 14.7367 12.9315 14.9411 13.6467 14.9923C14.3618 15.0435 15.0796 14.9404 15.7513 14.6898C16.4231 14.4392 17.0331 14.047 17.54 13.54L20.54 10.54C21.4508 9.59699 21.9548 8.33397 21.9434 7.02299C21.932 5.71201 21.4061 4.45794 20.4791 3.5309C19.5521 2.60386 18.298 2.07802 16.987 2.06661C15.676 2.0552 14.413 2.55918 13.47 3.47L11.75 5.18" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M14 11C13.5705 10.4259 13.0226 9.95078 12.3934 9.60704C11.7642 9.2633 11.0684 9.05889 10.3533 9.00768C9.63816 8.95646 8.92037 9.05964 8.24861 9.31023C7.57685 9.56082 6.96684 9.95296 6.45996 10.46L3.45996 13.46C2.54917 14.403 2.04519 15.666 2.05659 16.977C2.068 18.288 2.59384 19.5421 3.52088 20.4691C4.44792 21.3961 5.70199 21.922 7.01297 21.9334C8.32395 21.9448 9.58697 21.4408 10.53 20.53L12.24 18.82" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const BackupIcon = ({ color }: { color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path d="M19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H16L21 8V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21Z" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M17 21V13H7V21" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M7 3V8H15" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const CreditCardIcon = ({ color }: { color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Rect x="1" y="4" width="22" height="16" rx="2" stroke={color} strokeWidth={1.5} />
    <Path d="M1 10H23" stroke={color} strokeWidth={1.5} />
  </Svg>
);

export default function SharelCloudSettingsScreen({ navigation }: SharelCloudSettingsScreenProps) {
  const { t } = useTranslation();
  const { theme, accentColor } = useTheme();

  const [usedCloud, setUsedCloud] = useState("45.2 GB");
  const [totalCloud, setTotalCloud] = useState("250 GB");
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [syncFrequency, setSyncFrequency] = useState<SyncFrequency>('realtime');
  const [backgroundSync, setBackgroundSync] = useState(true);
  const [linkExpiry, setLinkExpiry] = useState<LinkExpiry>('7days');
  const [passwordProtect, setPasswordProtect] = useState(false);
  const [autoBackup, setAutoBackup] = useState(true);
  const [lastBackup, setLastBackup] = useState("Aujourd'hui, 14:30");
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showExpiryModal, setShowExpiryModal] = useState(false);
  const [showApiConfig, setShowApiConfig] = useState(false);
  const [prodUrl, setProdUrl] = useState("");
  const [devUrl, setDevUrl] = useState("");
  const [useProduction, setUseProduction] = useState(false);

  const backgroundColor = theme.backgroundRoot;
  const textPrimary = theme.text;
  const textSecondary = theme.textSecondary;
  const iconColor = theme.textSecondary;
  const modalBg = theme.backgroundDefault;

  const getSyncLabel = (freq: SyncFrequency): string => {
    switch (freq) {
      case 'realtime': return t('cloud.syncRealtime');
      case 'hourly': return t('cloud.syncHourly');
      case 'daily': return t('cloud.syncDaily');
      default: return t('cloud.syncRealtime');
    }
  };

  const getExpiryLabel = (expiry: LinkExpiry): string => {
    switch (expiry) {
      case '1day': return t('cloud.expiry1Day');
      case '7days': return t('cloud.expiry7Days');
      case '30days': return t('cloud.expiry30Days');
      case 'never': return t('cloud.expiryNever');
      default: return t('cloud.expiry7Days');
    }
  };

  const renderIcon = (iconType: string) => {
    switch (iconType) {
      case 'cloud': return <CloudIcon color={iconColor} />;
      case 'sync': return <SyncIcon color={iconColor} />;
      case 'link': return <LinkIcon color={iconColor} />;
      case 'backup': return <BackupIcon color={iconColor} />;
      case 'card': return <CreditCardIcon color={iconColor} />;
      default: return <Feather name="cloud" size={20} color={iconColor} />;
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

  const usedPercentage = Math.round((parseFloat(usedCloud) / parseFloat(totalCloud)) * 100);

  useEffect(() => {
    loadApiConfig();
  }, []);

  const loadApiConfig = async () => {
    const config = TGBoxApiService.getApiConfig();
    if (config) {
      setProdUrl(config.prodUrl);
      setDevUrl(config.devUrl);
      setUseProduction(config.useProduction);
    }
  };

  return (
    <>
      <ScreenScrollView 
        style={[styles.scrollView, { backgroundColor }]}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={[styles.cloudCard, { backgroundColor: theme.backgroundSecondary }]}>
          <View style={styles.cloudHeader}>
            <View style={[styles.cloudIconContainer, { backgroundColor: accentColor + '20' }]}>
              <Feather name="cloud" size={28} color={accentColor} />
            </View>
            <View style={styles.cloudInfo}>
              <ThemedText style={[styles.cloudTitle, { color: textPrimary }]}>
                Sharel Cloud
              </ThemedText>
              <ThemedText style={[styles.cloudSubtitle, { color: textSecondary }]}>
                {usedCloud} / {totalCloud}
              </ThemedText>
            </View>
          </View>
          <View style={styles.cloudBar}>
            <View style={[styles.cloudBarFill, { backgroundColor: accentColor, width: `${usedPercentage}%` }]} />
          </View>
          <Pressable style={[styles.manageButton, { borderColor: accentColor }]}>
            <ThemedText style={[styles.manageButtonText, { color: accentColor }]}>
              {t('cloud.manageSubscription')}
            </ThemedText>
          </Pressable>
        </View>

        <ThemedText style={[styles.sectionTitle, { color: textSecondary }]}>
          {t('cloud.synchronization').toUpperCase()}
        </ThemedText>

        <View style={styles.settingsGroup}>
          {renderSettingItem(
            "sync",
            t('cloud.enableSync'),
            t('cloud.enableSyncDesc'),
            renderToggle(syncEnabled, setSyncEnabled)
          )}
          {renderSettingItem(
            "sync",
            t('cloud.syncFrequency'),
            getSyncLabel(syncFrequency),
            renderChevron(),
            () => setShowSyncModal(true)
          )}
          {renderSettingItem(
            "sync",
            t('cloud.backgroundSync'),
            t('cloud.backgroundSyncDesc'),
            renderToggle(backgroundSync, setBackgroundSync)
          )}
          {renderSettingItem(
            "cloud",
            t('cloud.syncedFolders'),
            t('cloud.syncedFoldersDesc'),
            renderChevron(),
            () => {}
          )}
        </View>

        <ThemedText style={[styles.sectionTitle, { color: textSecondary }]}>
          {t('cloud.sharing').toUpperCase()}
        </ThemedText>

        <View style={styles.settingsGroup}>
          {renderSettingItem(
            "link",
            t('cloud.activeLinks'),
            t('cloud.activeLinksDesc'),
            renderChevron(),
            () => {}
          )}
          {renderSettingItem(
            "link",
            t('cloud.linkExpiry'),
            getExpiryLabel(linkExpiry),
            renderChevron(),
            () => setShowExpiryModal(true)
          )}
          {renderSettingItem(
            "link",
            t('cloud.passwordProtect'),
            t('cloud.passwordProtectDesc'),
            renderToggle(passwordProtect, setPasswordProtect)
          )}
        </View>

        <ThemedText style={[styles.sectionTitle, { color: textSecondary }]}>
          {t('cloud.backup').toUpperCase()}
        </ThemedText>

        <View style={styles.settingsGroup}>
          {renderSettingItem(
            "backup",
            t('cloud.autoBackup'),
            t('cloud.autoBackupDesc'),
            renderToggle(autoBackup, setAutoBackup)
          )}
          {renderSettingItem(
            "backup",
            t('cloud.lastBackup'),
            lastBackup,
            renderChevron(),
            () => {}
          )}
          {renderSettingItem(
            "backup",
            t('cloud.restoreBackup'),
            t('cloud.restoreBackupDesc'),
            renderChevron(),
            () => {}
          )}
        </View>

        <ThemedText style={[styles.sectionTitle, { color: textSecondary }]}>
          {t('cloud.billing').toUpperCase()}
        </ThemedText>

        <View style={styles.settingsGroup}>
          {renderSettingItem(
            "card",
            t('cloud.billingHistory'),
            t('cloud.billingHistoryDesc'),
            renderChevron(),
            () => {}
          )}
        </View>

        <ThemedText style={[styles.sectionTitle, { color: textSecondary }]}>
          API CONFIGURATION
        </ThemedText>

        <View style={styles.settingsGroup}>
          {renderSettingItem(
            "card",
            "TGBox API Config",
            useProduction ? "Production Mode (Prod)" : "Development Mode (Replit)",
            renderChevron(),
            () => setShowApiConfig(true)
          )}
        </View>
      </ScreenScrollView>

      <Modal visible={showSyncModal} transparent animationType="fade" onRequestClose={() => setShowSyncModal(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowSyncModal(false)} />
          <View style={[styles.modalContent, { backgroundColor: modalBg }]}>
            <ThemedText style={[styles.modalTitle, { color: textPrimary }]}>
              {t('cloud.selectSyncFrequency')}
            </ThemedText>
            
            {(['realtime', 'hourly', 'daily'] as SyncFrequency[]).map((freq) => (
              <Pressable
                key={freq}
                style={({ pressed }) => [styles.modalOption, { opacity: pressed ? 0.6 : 1 }]}
                onPress={() => {
                  setSyncFrequency(freq);
                  setShowSyncModal(false);
                }}
              >
                <RadioButton selected={syncFrequency === freq} color={accentColor} />
                <ThemedText style={[styles.modalOptionText, { color: textPrimary }]}>
                  {getSyncLabel(freq)}
                </ThemedText>
              </Pressable>
            ))}

            <Pressable style={styles.cancelButtonLarge} onPress={() => setShowSyncModal(false)}>
              <ThemedText style={[styles.cancelText, { color: accentColor }]}>{t('common.cancel')}</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={showExpiryModal} transparent animationType="fade" onRequestClose={() => setShowExpiryModal(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowExpiryModal(false)} />
          <View style={[styles.modalContent, { backgroundColor: modalBg }]}>
            <ThemedText style={[styles.modalTitle, { color: textPrimary }]}>
              {t('cloud.selectLinkExpiry')}
            </ThemedText>
            
            {(['1day', '7days', '30days', 'never'] as LinkExpiry[]).map((expiry) => (
              <Pressable
                key={expiry}
                style={({ pressed }) => [styles.modalOption, { opacity: pressed ? 0.6 : 1 }]}
                onPress={() => {
                  setLinkExpiry(expiry);
                  setShowExpiryModal(false);
                }}
              >
                <RadioButton selected={linkExpiry === expiry} color={accentColor} />
                <ThemedText style={[styles.modalOptionText, { color: textPrimary }]}>
                  {getExpiryLabel(expiry)}
                </ThemedText>
              </Pressable>
            ))}

            <Pressable style={styles.cancelButtonLarge} onPress={() => setShowExpiryModal(false)}>
              <ThemedText style={[styles.cancelText, { color: accentColor }]}>{t('common.cancel')}</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={showApiConfig} transparent animationType="fade" onRequestClose={() => setShowApiConfig(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowApiConfig(false)} />
          <View style={[styles.apiModalContent, { backgroundColor: modalBg }]}>
            <ThemedText style={[styles.modalTitle, { color: textPrimary }]}>
              TGBox API Configuration
            </ThemedText>
            
            <ScrollView style={styles.apiConfigScroll}>
              <ThemedText style={[styles.apiLabel, { color: textPrimary }]}>URL Production</ThemedText>
              <TextInput
                style={[styles.apiInput, { color: textPrimary, borderColor: theme.border }]}
                placeholderTextColor={textSecondary}
                placeholder="https://api.tgbox.io"
                value={prodUrl}
                onChangeText={setProdUrl}
              />

              <ThemedText style={[styles.apiLabel, { color: textPrimary }]}>URL Développement (Replit)</ThemedText>
              <TextInput
                style={[styles.apiInput, { color: textPrimary, borderColor: theme.border }]}
                placeholderTextColor={textSecondary}
                placeholder="https://...replit.dev"
                value={devUrl}
                onChangeText={setDevUrl}
              />

              <View style={styles.apiToggle}>
                <ThemedText style={[styles.apiToggleLabel, { color: textPrimary }]}>Mode Production</ThemedText>
                <Pressable 
                  style={[styles.toggleButton, { borderColor: accentColor, backgroundColor: useProduction ? accentColor : 'transparent' }]}
                  onPress={() => setUseProduction(!useProduction)}
                >
                  <ThemedText style={[styles.toggleButtonText, { color: useProduction ? modalBg : accentColor }]}>
                    {useProduction ? 'ON' : 'OFF'}
                  </ThemedText>
                </Pressable>
              </View>
            </ScrollView>

            <View style={styles.apiActions}>
              <Pressable style={[styles.cancelButton, { borderColor: accentColor }]} onPress={() => setShowApiConfig(false)}>
                <ThemedText style={[styles.cancelButtonText, { color: accentColor }]}>Annuler</ThemedText>
              </Pressable>
              <Pressable 
                style={[styles.confirmButton, { backgroundColor: accentColor }]} 
                onPress={async () => {
                  await TGBoxApiService.saveApiConfig({ prodUrl, devUrl, useProduction });
                  Alert.alert("Succes", "Config API sauvegardee");
                  setShowApiConfig(false);
                }}
              >
                <ThemedText style={styles.confirmButtonText}>Sauvegarder</ThemedText>
              </Pressable>
            </View>
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
  cloudCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  cloudHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  cloudIconContainer: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  cloudInfo: {
    flex: 1,
  },
  cloudTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 4,
  },
  cloudSubtitle: {
    fontSize: 14,
  },
  cloudBar: {
    height: 8,
    backgroundColor: "rgba(128,128,128,0.3)",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: Spacing.lg,
  },
  cloudBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  manageButton: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    alignItems: "center",
  },
  manageButtonText: {
    fontSize: 15,
    fontWeight: "600",
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
  apiModalContent: {
    width: "85%",
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    maxHeight: "70%",
  },
  apiConfigScroll: {
    marginVertical: Spacing.lg,
  },
  apiLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  apiInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    fontSize: 14,
  },
  apiToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(128,128,128,0.2)",
  },
  apiToggleLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  toggleButton: {
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    minWidth: 60,
  },
  toggleButtonText: {
    fontSize: 12,
    fontWeight: "600",
  },
  apiActions: {
    flexDirection: "row",
    gap: Spacing.md,
    justifyContent: "space-between",
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  confirmButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
