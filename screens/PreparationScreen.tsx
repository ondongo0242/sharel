import React, { useState, useEffect } from "react";
import { View, StyleSheet, Pressable, Text, Platform, ActivityIndicator, Alert, Dimensions } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HomeStackParamList } from "@/navigation/HomeStackNavigator";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import SystemRequirementsService, { SystemRequirements, TransferMethod } from "@/services/SystemRequirementsService";
import DeviceTypeService, { DeviceType } from "@/services/DeviceTypeService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Camera } from "expo-camera";
import { useTheme } from "@/hooks/useTheme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const STORAGE_KEYS = {
  DEFAULT_SHARE_METHOD: '@preferences_default_share_method',
};

type PreparationScreenNavigationProp = NativeStackNavigationProp<HomeStackParamList, "Preparation">;

interface Props {
  navigation: PreparationScreenNavigationProp;
  route: any;
}

type RequirementStatus = "checking" | "ok" | "error" | "not_required";

interface RequirementCheck {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
  status: RequirementStatus;
  isRequired: boolean;
  action?: () => void;
  actionLabel?: string;
}

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function PreparationScreen({ navigation, route }: Props) {
  const selectedFiles = route.params?.selectedFiles || [];
  const mode = route.params?.mode || "send";
  const { theme, accentColor } = useTheme();
  const insets = useSafeAreaInsets();
  const [isChecking, setIsChecking] = useState(true);
  const [requirements, setRequirements] = useState<SystemRequirements | null>(null);
  const [checks, setChecks] = useState<RequirementCheck[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<TransferMethod>("auto");
  
  const localDeviceType = DeviceTypeService.getLocalDeviceType();
  const [senderDeviceType, setSenderDeviceType] = useState<DeviceType>(localDeviceType);
  const [receiverDeviceType, setReceiverDeviceType] = useState<DeviceType>(localDeviceType);
  const [userPreferredMethod, setUserPreferredMethod] = useState<string | null>(null);
  const [isLoadingPreference, setIsLoadingPreference] = useState(true);
  const [cameraPermissionGranted, setCameraPermissionGranted] = useState(false);

  useEffect(() => {
    const loadPreference = async () => {
      try {
        const savedMethod = await AsyncStorage.getItem(STORAGE_KEYS.DEFAULT_SHARE_METHOD);
        setUserPreferredMethod(savedMethod);
      } catch (error) {
        console.error("Error loading share method preference:", error);
      } finally {
        setIsLoadingPreference(false);
      }
    };
    loadPreference();
  }, []);

  useEffect(() => {
    if (mode === "receive") {
      setReceiverDeviceType(localDeviceType);
      setSenderDeviceType(localDeviceType);
    } else {
      setSenderDeviceType(localDeviceType);
      setReceiverDeviceType(localDeviceType);
    }
  }, [mode, localDeviceType]);

  useEffect(() => {
    if (isLoadingPreference) return;
    
    let method: TransferMethod;
    
    if (userPreferredMethod === "hotspot") {
      navigation.replace("HotspotSetup", { 
        selectedFiles,
        mode: mode === "send" ? "sender" : "receiver"
      });
      return;
    } else if (userPreferredMethod === "p2p" || userPreferredMethod === "wifidirect") {
      method = "wifidirect" as TransferMethod;
    } else {
      method = DeviceTypeService.getBestTransferMethod(senderDeviceType, receiverDeviceType) as TransferMethod;
    }
    
    console.log('[PreparationScreen] Selected transfer method:', method, 'userPreferred:', userPreferredMethod);
    
    setSelectedMethod(method);
    initializeChecks(method);
    checkAllRequirements(method);
    
    const unsubscribe = SystemRequirementsService.subscribeToNetworkChanges();
    
    return () => {
      unsubscribe();
      SystemRequirementsService.cleanup();
    };
  }, [senderDeviceType, receiverDeviceType, userPreferredMethod, isLoadingPreference]);

  useEffect(() => {
    if (!selectedMethod || selectedMethod === "auto") return;
    
    const pendingChecks = checks.filter(check => check.isRequired && check.status !== "ok");
    if (pendingChecks.length === 0) return;
    
    const pollingInterval = 2000;
    
    const interval = setInterval(() => {
      checkAllRequirements(selectedMethod);
    }, pollingInterval);
    
    return () => {
      clearInterval(interval);
    };
  }, [selectedMethod, checks]);

  useEffect(() => {
    if (requirements) {
      updateChecksStatus();
    }
  }, [requirements, cameraPermissionGranted]);

  const initializeChecks = (method: TransferMethod) => {
    const isReceiver = mode === "receive";
    const requiredChecks = SystemRequirementsService.getRequiredChecks(method, isReceiver);
    const baseChecks: RequirementCheck[] = [];

    if (requiredChecks.includes("wifi")) {
      baseChecks.push({
        id: "wifi",
        title: "Activer le WLAN",
        description: "Se connecter via WLAN pour le transfert",
        icon: "wifi",
        status: "checking",
        isRequired: true,
        action: async () => {
          await SystemRequirementsService.promptEnableWifi();
          setTimeout(() => checkAllRequirements(method), 1500);
        },
        actionLabel: "ACTIVER",
      });
    }

    if (requiredChecks.includes("bluetooth")) {
      baseChecks.push({
        id: "bluetooth",
        title: "Activer le Bluetooth",
        description: "Requis pour la decouverte d'appareils",
        icon: "bluetooth",
        status: "checking",
        isRequired: true,
        action: async () => {
          await SystemRequirementsService.promptEnableBluetooth();
          setTimeout(() => checkAllRequirements(method), 1500);
        },
        actionLabel: "ACTIVER",
      });
    }

    if (requiredChecks.includes("location")) {
      baseChecks.push({
        id: "location",
        title: "Activer la localisation",
        description: "Requise par le systeme pour le scan",
        icon: "map-pin",
        status: "checking",
        isRequired: true,
        action: async () => {
          await SystemRequirementsService.promptEnableLocation();
          setTimeout(() => checkAllRequirements(method), 1500);
        },
        actionLabel: "ACTIVER",
      });
    }

    if (requiredChecks.includes("locationPermission")) {
      baseChecks.push({
        id: "locationPermission",
        title: "Permission localisation",
        description: "Autorisation requise pour detecter les appareils",
        icon: "shield",
        status: "checking",
        isRequired: true,
        action: async () => {
          const granted = await SystemRequirementsService.requestLocationPermission();
          if (granted) {
            await checkAllRequirements(method);
          }
        },
        actionLabel: "AUTORISER",
      });
    }

    if (requiredChecks.includes("bluetoothPermission")) {
      baseChecks.push({
        id: "bluetoothPermission",
        title: "Permission Bluetooth",
        description: "Autorisation requise pour le scan Bluetooth",
        icon: "bluetooth",
        status: "checking",
        isRequired: true,
        action: async () => {
          const granted = await SystemRequirementsService.requestBluetoothPermissions();
          if (granted) {
            await checkAllRequirements(method);
          }
        },
        actionLabel: "AUTORISER",
      });
    }

    if (requiredChecks.includes("nearbyPermission")) {
      baseChecks.push({
        id: "nearbyPermission",
        title: "Permission Appareils Proches",
        description: "Autorisation pour detecter les appareils a proximite",
        icon: "radio",
        status: "checking",
        isRequired: true,
        action: async () => {
          const granted = await SystemRequirementsService.requestNearbyDevicesPermission();
          if (granted) {
            await checkAllRequirements(method);
          }
        },
        actionLabel: "AUTORISER",
      });
    }

    if (mode === "receive" && Platform.OS !== "web") {
      baseChecks.push({
        id: "cameraPermission",
        title: "Permission Camera",
        description: "Autorisation requise pour scanner les QR codes",
        icon: "camera",
        status: "checking",
        isRequired: true,
        action: async () => {
          const { status } = await Camera.requestCameraPermissionsAsync();
          if (status === "granted") {
            await checkAllRequirements(method);
          }
        },
        actionLabel: "AUTORISER",
      });
    }

    setChecks(baseChecks);
  };

  const checkAllRequirements = async (method: TransferMethod) => {
    setIsChecking(true);
    try {
      const isReceiver = mode === "receive";
      const reqs = await SystemRequirementsService.checkAllRequirements(method, isReceiver);
      setRequirements(reqs);
      
      if (isReceiver && Platform.OS !== "web") {
        const { status } = await Camera.getCameraPermissionsAsync();
        setCameraPermissionGranted(status === "granted");
      }
    } catch (error) {
      console.error("Error checking requirements:", error);
    } finally {
      setIsChecking(false);
    }
  };

  const updateChecksStatus = () => {
    if (!requirements) return;

    setChecks(prevChecks =>
      prevChecks.map(check => {
        let status: RequirementStatus = "checking";

        switch (check.id) {
          case "wifi":
            status = requirements.wifi ? "ok" : "error";
            break;
          case "bluetooth":
            status = requirements.bluetooth ? "ok" : "error";
            break;
          case "location":
            status = requirements.location ? "ok" : "error";
            break;
          case "locationPermission":
            status = requirements.permissions.location ? "ok" : "error";
            break;
          case "bluetoothPermission":
            status = requirements.permissions.bluetooth ? "ok" : "error";
            break;
          case "nearbyPermission":
            status = requirements.permissions.nearbyDevices ? "ok" : "error";
            break;
          case "cameraPermission":
            status = cameraPermissionGranted ? "ok" : "error";
            break;
        }

        return { ...check, status };
      })
    );
  };

  const handleContinue = () => {
    console.log('[PreparationScreen] Continuing with method:', selectedMethod);
    
    if (mode === "receive") {
      if (selectedMethod === "hotspot") {
        navigation.replace("HotspotSetup", { mode: "receiver" });
      } else {
        navigation.navigate("Receive", { transferMethod: selectedMethod });
      }
    } else {
      if (selectedMethod === "hotspot") {
        navigation.replace("HotspotSetup", { 
          selectedFiles,
          mode: "sender" 
        });
      } else {
        navigation.navigate("Connection", { 
          selectedFiles,
          senderDeviceType: senderDeviceType,
          receiverDeviceType: receiverDeviceType,
          transferMethod: selectedMethod,
        });
      }
    }
  };

  const allRequiredMet = checks
    .filter(check => check.isRequired)
    .every(check => check.status === "ok");

  const pendingChecks = checks.filter(check => check.status !== "ok");

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable 
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [
            styles.backButton,
            { backgroundColor: pressed ? theme.backgroundSecondary : "transparent" }
          ]}
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]}>Preparations</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.illustrationContainer}>
        <Image
          source={require("@/assets/generated_images/preparation_illustration.png")}
          style={styles.illustration}
          contentFit="contain"
        />
      </View>

      <View style={styles.bottomSection}>
        {pendingChecks.length > 0 ? (
          <View style={styles.checksContainer}>
            {pendingChecks.map((check, index) => (
              <View key={check.id}>
                <Pressable
                  onPress={check.action}
                  style={({ pressed }) => [
                    styles.checkItem,
                    { opacity: pressed ? 0.7 : 1 }
                  ]}
                >
                  <View style={[styles.checkIconContainer, { backgroundColor: `${accentColor}15` }]}>
                    <Feather name={check.icon} size={20} color={accentColor} />
                  </View>
                  <View style={styles.checkText}>
                    <View style={styles.checkTitleRow}>
                      <Text style={[styles.checkTitle, { color: theme.text }]}>
                        {check.title}
                      </Text>
                      {check.status === "checking" ? (
                        <ActivityIndicator size={14} color={theme.textSecondary} />
                      ) : (
                        <Feather name="chevron-up" size={16} color={theme.textSecondary} />
                      )}
                    </View>
                    <Text style={[styles.checkDescription, { color: theme.textSecondary }]}>
                      {check.description}
                    </Text>
                  </View>
                  <Pressable
                    onPress={check.action}
                    style={styles.actionButton}
                  >
                    <Text style={[styles.actionButtonText, { color: accentColor }]}>
                      {check.actionLabel}
                    </Text>
                  </Pressable>
                </Pressable>
                {index < pendingChecks.length - 1 && (
                  <View style={[styles.separator, { backgroundColor: theme.border }]} />
                )}
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.readyContainer}>
            <View style={[styles.readyBadge, { backgroundColor: `${theme.success}15` }]}>
              <Feather name="check-circle" size={20} color={theme.success} />
              <Text style={[styles.readyText, { color: theme.success }]}>
                Tout est pret !
              </Text>
            </View>
          </View>
        )}

        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
          <Pressable
            onPress={handleContinue}
            disabled={!allRequiredMet || isChecking}
            style={({ pressed }) => [
              styles.continueButton,
              {
                backgroundColor: allRequiredMet && !isChecking ? accentColor : theme.backgroundTertiary,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            {isChecking ? (
              <ActivityIndicator color={allRequiredMet ? "#FFFFFF" : theme.textSecondary} />
            ) : (
              <Text style={[styles.continueText, { color: allRequiredMet ? "#FFFFFF" : theme.textSecondary }]}>
                Suivant
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
  },
  illustrationContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  illustration: {
    width: "100%",
    height: 220,
  },
  bottomSection: {
    paddingHorizontal: Spacing.lg,
  },
  checksContainer: {
    marginBottom: Spacing.lg,
  },
  checkItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    gap: 12,
  },
  checkIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  checkText: {
    flex: 1,
    gap: 2,
  },
  checkTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  checkTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  checkDescription: {
    fontSize: 13,
  },
  actionButton: {
    paddingHorizontal: 4,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  separator: {
    height: 1,
    marginLeft: 52,
  },
  readyContainer: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
  readyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  readyText: {
    fontSize: 15,
    fontWeight: "600",
  },
  footer: {
    paddingTop: Spacing.md,
  },
  continueButton: {
    paddingVertical: 16,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  continueText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
