import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Text,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
  Dimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { HomeStackParamList } from "@/navigation/HomeStackNavigator";
import UnifiedTransferService from "@/services/UnifiedTransferService";
import { TransferMethod } from "@/services/SystemRequirementsService";
import * as Device from "expo-device";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions, BarcodeScanningResult } from "expo-camera";
import { useTranslation } from "react-i18next";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { GestureDetector, Gesture } from "react-native-gesture-handler";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

type ReceiveScreenNavigationProp = NativeStackNavigationProp<
  HomeStackParamList,
  "Receive"
>;

type ReceiveScreenRouteProp = RouteProp<HomeStackParamList, "Receive">;

interface Props {
  navigation: ReceiveScreenNavigationProp;
  route: ReceiveScreenRouteProp;
}

const isCameraSupported = Platform.OS !== "web";

export default function ReceiveScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { theme, accentColor } = useTheme();
  const insets = useSafeAreaInsets();
  const transferMethod = route.params?.transferMethod || "wifidirect";
  const isP2PMode = transferMethod !== "hotspot";
  
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [hasScanned, setHasScanned] = useState(false);
  const [scannedInfo, setScannedInfo] = useState<any>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [hasRequestedPermission, setHasRequestedPermission] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const mountedRef = useRef(true);
  
  const SHEET_MIN_HEIGHT = 180;
  const SHEET_MAX_HEIGHT = SCREEN_HEIGHT * 0.55;
  const sheetTranslateY = useSharedValue(SHEET_MAX_HEIGHT - SHEET_MIN_HEIGHT);
  const sheetContext = useSharedValue({ y: 0 });
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.6);
  
  const sheetGesture = Gesture.Pan()
    .onStart(() => {
      sheetContext.value = { y: sheetTranslateY.value };
    })
    .onUpdate((event) => {
      const newY = sheetContext.value.y + event.translationY;
      sheetTranslateY.value = Math.max(0, Math.min(SHEET_MAX_HEIGHT - SHEET_MIN_HEIGHT, newY));
    })
    .onEnd((event) => {
      const shouldExpand = event.velocityY < -500 || sheetTranslateY.value < (SHEET_MAX_HEIGHT - SHEET_MIN_HEIGHT) / 2;
      sheetTranslateY.value = withTiming(shouldExpand ? 0 : SHEET_MAX_HEIGHT - SHEET_MIN_HEIGHT, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      });
    });
  
  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslateY.value }],
  }));
  
  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  useEffect(() => {
    mountedRef.current = true;
    initializeDeviceName();

    if (isCameraSupported && permission && !permission.granted && permission.canAskAgain && !hasRequestedPermission) {
      setHasRequestedPermission(true);
      requestPermission();
    }
    
    if (isP2PMode && permission?.granted && !isConnecting) {
      setIsSearching(true);
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.4, { duration: 1000, easing: Easing.out(Easing.ease) }),
          withTiming(1, { duration: 1000, easing: Easing.in(Easing.ease) })
        ),
        -1,
        false
      );
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.2, { duration: 1000, easing: Easing.out(Easing.ease) }),
          withTiming(0.6, { duration: 1000, easing: Easing.in(Easing.ease) })
        ),
        -1,
        false
      );
    }

    return () => {
      mountedRef.current = false;
    };
  }, [permission, hasRequestedPermission, isP2PMode, isConnecting]);

  const initializeDeviceName = async () => {
    try {
      const deviceModel = Device.modelName || Device.modelId || Platform.select({
        ios: "iPhone",
        android: "Android",
        default: t('common.device'),
      }) || t('common.myDevice');
      setDeviceName(deviceModel);
    } catch (error) {
      console.error("Error getting device name:", error);
      setDeviceName(Platform.select({
        ios: "iPhone",
        android: "Android",
        default: t('common.myDevice'),
      }) || t('common.myDevice'));
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const handleBarcodeScanned = (result: BarcodeScanningResult) => {
    if (hasScanned) return;
    setHasScanned(true);

    const scannedData = result.data;
    console.log("[RECV_SCAN_01] ========== QR SCAN START ==========");
    console.log("[RECV_SCAN_02] Raw data:", scannedData);
    console.log("[RECV_SCAN_03] Data length:", scannedData.length);
    console.log("[RECV_SCAN_04] First 100 chars:", scannedData.substring(0, 100));
    console.log("[RECV_SCAN_05] Last 50 chars:", scannedData.substring(scannedData.length - 50));

    try {
      const connectionInfo = JSON.parse(scannedData);
      console.log("[RECV_PARSE_01] JSON parse SUCCESS");
      console.log("[RECV_PARSE_02] Parsed payload:", JSON.stringify(connectionInfo, null, 2));
      console.log("[RECV_PARSE_03] type:", connectionInfo.type, "| v:", connectionInfo.v);
      console.log("[RECV_PARSE_04] totalSize type:", typeof connectionInfo.totalSize, "| value:", connectionInfo.totalSize);
      
      if (typeof connectionInfo.totalSize === 'string') {
        console.warn("[RECV_PARSE_WARN] totalSize is STRING - this is corrupted data! Fixing...");
        connectionInfo.totalSize = 0;
      }

      // Handle P2P mode (Wi-Fi Direct)
      if (connectionInfo.type === "sharel_send" && connectionInfo.v === 1) {
        setScannedInfo(connectionInfo);
        
        Alert.alert(
          t('receive.senderDetected'),
          t('receive.wantsToSend', { name: connectionInfo.name, count: connectionInfo.files }) + `\n\n${t('receive.size')}: ${formatFileSize(connectionInfo.totalSize || 0)}`,
          [
            { 
              text: t('common.cancel'), 
              style: "cancel",
              onPress: () => {
                setHasScanned(false);
                setScannedInfo(null);
              }
            },
            {
              text: t('common.accept'),
              onPress: () => handleConnectToSender(connectionInfo),
            },
          ]
        );
        return;
      }

      // Handle Hotspot mode - use handleConnectToSender which properly uses UnifiedTransferService
      if (connectionInfo.type === "sharel_hotspot" && connectionInfo.v === 1) {
        console.log("[RECV_HOTSPOT_01] Hotspot QR detected - SSID:", connectionInfo.ssid);
        console.log("[RECV_HOTSPOT_02] Sender name:", connectionInfo.name || "UNDEFINED");
        console.log("[RECV_HOTSPOT_03] Files:", connectionInfo.files, "| Size:", connectionInfo.totalSize);
        console.log("[RECV_HOTSPOT_04] IP:", connectionInfo.ip, "| Port:", connectionInfo.port);
        
        const senderName = connectionInfo.name || connectionInfo.ssid || "Appareil";
        const enrichedPayload = { ...connectionInfo, name: senderName };
        setScannedInfo(enrichedPayload);
        
        Alert.alert(
          t('receive.senderDetected'),
          t('receive.wantsToSend', { name: senderName, count: connectionInfo.files }) + `\n\n${t('receive.size')}: ${formatFileSize(connectionInfo.totalSize || 0)}\n\nSSID: ${connectionInfo.ssid}`,
          [
            { 
              text: t('common.cancel'), 
              style: "cancel",
              onPress: () => {
                setHasScanned(false);
                setScannedInfo(null);
              }
            },
            {
              text: t('common.accept'),
              onPress: () => handleConnectToSender(enrichedPayload),
            },
          ]
        );
        return;
      }

      // Legacy hotspot QR format (without sharel type marker)
      if (connectionInfo.ssid && connectionInfo.password && connectionInfo.ip) {
        const legacyPayload = {
          ...connectionInfo,
          method: "hotspot" as TransferMethod,
          type: "sharel_hotspot",
          name: connectionInfo.name || connectionInfo.ssid,
          files: connectionInfo.files || 0,
          totalSize: connectionInfo.totalSize || 0,
        };
        setScannedInfo(legacyPayload);
        
        Alert.alert(
          t('receive.accessPointDetected'),
          `SSID: ${connectionInfo.ssid}`,
          [
            { 
              text: t('common.cancel'), 
              style: "cancel",
              onPress: () => setHasScanned(false)
            },
            {
              text: t('common.connect'),
              onPress: () => handleConnectToSender(legacyPayload),
            },
          ]
        );
        return;
      }

      console.log("[RECV_PARSE_FAIL] QR recognized but no matching type");
      console.log("[RECV_PARSE_FAIL] Expected types: sharel_send, sharel_hotspot, or legacy (ssid+password+ip)");
      console.log("[RECV_PARSE_FAIL] Got type:", connectionInfo.type, "| Has ssid:", !!connectionInfo.ssid);
      Alert.alert(
        t('receive.unrecognizedQr'),
        t('receive.invalidSenderQr') + `\n\nDebug: type=${connectionInfo.type}, v=${connectionInfo.v}`,
        [{ text: "OK", onPress: () => setHasScanned(false) }]
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("[RECV_SCAN_ERR] ========== JSON PARSE FAILED ==========");
      console.error("[RECV_SCAN_ERR] Error:", errorMessage);
      console.error("[RECV_SCAN_ERR] Raw data that failed:", scannedData);
      console.error("[RECV_SCAN_ERR] Is valid JSON check:", scannedData.startsWith('{') && scannedData.endsWith('}'));
      Alert.alert(
        t('receive.invalidQrCode'),
        t('receive.unableToReadQr') + `\n\nErreur: ${errorMessage.substring(0, 100)}`,
        [{ text: "OK", onPress: () => setHasScanned(false) }]
      );
    }
  };

  const handleConnectToSender = async (connectionInfo: any) => {
    console.log("[RECV_CONN_01] === STARTING CONNECTION ===");
    console.log("[RECV_CONN_02] Connection info received:", JSON.stringify(connectionInfo, null, 2));
    
    setIsConnecting(true);
    setConnectionStatus(t('discover.connectingStatus'));

    try {
      const payload = {
        method: connectionInfo.method as TransferMethod,
        peerId: connectionInfo.peerId,
        deviceAddress: connectionInfo.deviceAddress || connectionInfo.peerId,
        name: connectionInfo.name,
        platform: connectionInfo.platform,
        ssid: connectionInfo.ssid,
        password: connectionInfo.password,
        ip: connectionInfo.ip,
        port: connectionInfo.port,
      };

      console.log("[RECV_CONN_03] Payload for UnifiedTransferService:", JSON.stringify(payload, null, 2));
      console.log("[RECV_CONN_04] Device name (receiver):", deviceName);
      setConnectionStatus(t('receive.searchingSender'));
      
      const result = await UnifiedTransferService.connectWithPayload(payload, deviceName);
      
      console.log("[RECV_CONN_05] Connection result:", JSON.stringify(result, null, 2));
      
      if (!mountedRef.current) {
        console.log("[RECV_CONN_06] Component unmounted, aborting");
        return;
      }

      if (result.success) {
        console.log("[RECV_CONN_07] Connection SUCCESS - peerId:", result.peerId, "| peerName:", result.peerName);
        setConnectionStatus(t('discover.connected'));
        
        navigation.navigate("TransferRoom", {
          peerId: result.peerId,
          peerName: result.peerName,
          selectedFiles: [],
          isHost: false,
        });
      } else {
        console.log("[RECV_CONN_08] Connection returned but not successful");
      }
    } catch (error) {
      console.error("[RECV_CONN_ERR] Error connecting to sender:", error);
      console.error("[RECV_CONN_ERR] Error details:", error instanceof Error ? error.message : String(error));
      if (mountedRef.current) {
        const errorMessage = error instanceof Error ? error.message : t('errors.unknownError');
        
        Alert.alert(
          t('receive.connectionError'),
          t('receive.unableToConnectSender', { error: errorMessage }),
          [
            { 
              text: t('common.retry'), 
              onPress: () => {
                setHasScanned(false);
                setIsConnecting(false);
                setScannedInfo(null);
                setConnectionStatus("");
              }
            }
          ]
        );
      }
    }
  };


  const handleRequestPermission = async () => {
    if (permission?.canAskAgain) {
      const result = await requestPermission();
      if (!result.granted && !result.canAskAgain && Platform.OS !== "web") {
        try {
          await Linking.openSettings();
        } catch (error) {
          console.log("Cannot open settings:", error);
        }
      }
    } else if (Platform.OS !== "web") {
      try {
        await Linking.openSettings();
      } catch (error) {
        console.log("Cannot open settings:", error);
      }
    }
  };

  const renderContent = () => {
    if (!isCameraSupported) {
      return (
        <View style={[styles.fullScreenMessage, { backgroundColor: theme.backgroundDefault }]}>
          <View style={[styles.messageIconContainer, { backgroundColor: `${accentColor}15` }]}>
            <Feather name="smartphone" size={48} color={accentColor} />
          </View>
          <Text style={[styles.messageTitle, { color: theme.text }]}>
            {t('receive.cameraNotAvailable') || "Camera non disponible"}
          </Text>
          <Text style={[styles.messageText, { color: theme.textSecondary }]}>
            {t('receive.useAndroidDevice') || "Utilisez l'application sur un appareil Android pour scanner les QR codes."}
          </Text>
        </View>
      );
    }

    if (!permission) {
      return (
        <View style={[styles.fullScreenMessage, { backgroundColor: theme.backgroundDefault }]}>
          <ActivityIndicator size="large" color={accentColor} />
        </View>
      );
    }

    if (!permission.granted) {
      return (
        <View style={[styles.fullScreenMessage, { backgroundColor: theme.backgroundDefault }]}>
          <View style={[styles.permissionIconContainer, { backgroundColor: `${accentColor}15` }]}>
            <Feather name="camera" size={48} color={accentColor} />
          </View>
          <Text style={[styles.messageTitle, { color: theme.text }]}>
            {t('receive.cameraAccessRequired')}
          </Text>
          <Pressable 
            style={[styles.permissionButton, { backgroundColor: accentColor }]} 
            onPress={handleRequestPermission}
          >
            <Feather name="camera" size={20} color="#FFF" />
            <Text style={styles.permissionButtonText}>
              {permission.canAskAgain ? t('receive.allowCamera') : t('receive.openSettings')}
            </Text>
          </Pressable>
        </View>
      );
    }

    if (isConnecting) {
      return (
        <View style={[styles.fullScreenMessage, { backgroundColor: theme.backgroundDefault }]}>
          <ActivityIndicator size="large" color={accentColor} />
          <Text style={[styles.messageTitle, { color: theme.text }]}>
            {connectionStatus || t('discover.connectingStatus')}
          </Text>
          <Text style={[styles.messageText, { color: theme.textSecondary }]}>
            {t('receive.connectingTo', { name: scannedInfo?.name || t('common.device') })}
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.cameraWrapper}>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ["qr"],
          }}
          onBarcodeScanned={hasScanned ? undefined : handleBarcodeScanned}
        />
        <View style={styles.cameraOverlay}>
          <View style={styles.scanFrame}>
            <View style={[styles.corner, styles.cornerTL, { borderColor: accentColor }]} />
            <View style={[styles.corner, styles.cornerTR, { borderColor: accentColor }]} />
            <View style={[styles.corner, styles.cornerBL, { borderColor: accentColor }]} />
            <View style={[styles.corner, styles.cornerBR, { borderColor: accentColor }]} />
          </View>
        </View>
      </View>
    );
  };

  const renderP2PBottomSheet = () => {
    if (!isP2PMode || !permission?.granted || isConnecting) return null;
    
    return (
      <GestureDetector gesture={sheetGesture}>
        <Animated.View 
          style={[
            styles.bottomSheet, 
            { backgroundColor: theme.backgroundSecondary },
            sheetAnimatedStyle
          ]}
        >
          <View style={styles.sheetHandle}>
            <View style={[styles.handleBar, { backgroundColor: theme.textSecondary }]} />
          </View>
          
          <View style={styles.sheetContent}>
            <View style={styles.sounderContainer}>
              <Animated.View 
                style={[
                  styles.sounderPulse,
                  { backgroundColor: accentColor },
                  pulseAnimatedStyle
                ]}
              />
              <Animated.View 
                style={[
                  styles.sounderPulseOuter,
                  { borderColor: accentColor },
                  pulseAnimatedStyle
                ]}
              />
              <View style={[styles.sounderCore, { backgroundColor: accentColor }]}>
                <Feather name="wifi" size={28} color="#FFF" />
              </View>
            </View>
            
            <Text style={[styles.searchingTitle, { color: theme.text }]}>
              {t('discover.searching')}
            </Text>
            <Text style={[styles.searchingSubtitle, { color: theme.textSecondary }]}>
              {t('receive.scanSenderQr')}
            </Text>
            
            <View style={styles.instructionsList}>
              <View style={styles.instructionItem}>
                <View style={[styles.instructionNumber, { backgroundColor: `${accentColor}20` }]}>
                  <Text style={[styles.instructionNumberText, { color: accentColor }]}>1</Text>
                </View>
                <Text style={[styles.instructionText, { color: theme.textSecondary }]}>
                  {t('receive.step1')}
                </Text>
              </View>
              <View style={styles.instructionItem}>
                <View style={[styles.instructionNumber, { backgroundColor: `${accentColor}20` }]}>
                  <Text style={[styles.instructionNumberText, { color: accentColor }]}>2</Text>
                </View>
                <Text style={[styles.instructionText, { color: theme.textSecondary }]}>
                  {t('receive.step2')}
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>
      </GestureDetector>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm, backgroundColor: `${theme.backgroundDefault}CC` }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>{t('receive.title')}</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        {renderContent()}
      </View>
      
      {renderP2PBottomSheet()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  cameraWrapper: {
    flex: 1,
    position: "relative",
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  scanFrame: {
    width: 250,
    height: 250,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 50,
    height: 50,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 16,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 16,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 16,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 16,
  },
  fullScreenMessage: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    padding: 32,
  },
  messageIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  permissionIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  messageTitle: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  messageText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
  },
  permissionButton: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
    gap: 8,
    marginTop: 8,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFF",
  },
  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingHorizontal: 20,
    minHeight: 180,
    maxHeight: "55%",
  },
  sheetHandle: {
    alignItems: "center",
    paddingVertical: 8,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  sheetContent: {
    alignItems: "center",
    paddingVertical: 16,
    gap: 12,
  },
  sounderContainer: {
    width: 100,
    height: 100,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  sounderPulse: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  sounderPulseOuter: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
  },
  sounderCore: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  searchingTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 8,
  },
  searchingSubtitle: {
    fontSize: 14,
    textAlign: "center",
  },
  instructionsList: {
    width: "100%",
    marginTop: 16,
    gap: 12,
  },
  instructionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  instructionNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  instructionNumberText: {
    fontSize: 14,
    fontWeight: "600",
  },
  instructionText: {
    fontSize: 14,
    flex: 1,
  },
});
