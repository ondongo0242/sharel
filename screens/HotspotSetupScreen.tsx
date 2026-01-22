import React, { useState, useEffect, useCallback } from "react";
import { View, StyleSheet, Pressable, Text, Platform, ActivityIndicator, Dimensions, PermissionsAndroid, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HomeStackParamList } from "@/navigation/HomeStackNavigator";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import HotspotService, { HotspotInfo } from "@/services/HotspotService";
import { logger } from "@/services/LoggerService";
import Svg, { Path, Circle, Rect, Line } from "react-native-svg";
import { CameraView, useCameraPermissions, BarcodeScanningResult } from "expo-camera";
import * as QRCode from "qrcode";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  interpolate,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";

type HotspotSetupScreenNavigationProp = NativeStackNavigationProp<HomeStackParamList, "HotspotSetup">;

interface Props {
  navigation: HotspotSetupScreenNavigationProp;
  route: any;
}

type SetupMode = "sender" | "receiver";
type SetupStep = "permissions" | "ready" | "scanning";

interface PermissionCheck {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
  status: "checking" | "granted" | "denied";
  action?: () => Promise<boolean>;
  actionLabel?: string;
}

interface QRCodeMatrix {
  size: number;
  data: boolean[][];
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const QR_SIZE = Math.min(SCREEN_WIDTH * 0.6, 220);
const FIXED_HEADER_HEIGHT = 200;
const SCAN_FRAME_SIZE = Math.min(SCREEN_WIDTH * 0.7, 280);
const BOTTOM_SHEET_MIN_HEIGHT = 180;
const BOTTOM_SHEET_MAX_HEIGHT = SCREEN_HEIGHT * 0.55;
const HEADER_HEIGHT = Platform.OS === "ios" ? 100 : 70;

const HotspotIcon = ({ color, size = 80 }: { color: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 80 80" fill="none">
    <Circle cx="40" cy="40" r="8" fill={color} />
    <Path d="M25 25C31.5 18.5 48.5 18.5 55 25" stroke={color} strokeWidth={3} strokeLinecap="round" />
    <Path d="M18 18C28 8 52 8 62 18" stroke={color} strokeWidth={3} strokeLinecap="round" />
    <Path d="M25 55C31.5 61.5 48.5 61.5 55 55" stroke={color} strokeWidth={3} strokeLinecap="round" />
    <Path d="M18 62C28 72 52 72 62 62" stroke={color} strokeWidth={3} strokeLinecap="round" />
  </Svg>
);

const QRCodeDisplay = ({ matrix, size, color, backgroundColor }: { 
  matrix: QRCodeMatrix; 
  size: number; 
  color: string;
  backgroundColor: string;
}) => {
  const cellSize = size / matrix.size;
  
  return (
    <View style={[styles.qrCodeContainer, { backgroundColor, width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {matrix.data.map((row, rowIndex) =>
          row.map((cell, colIndex) =>
            cell ? (
              <Rect
                key={`${rowIndex}-${colIndex}`}
                x={colIndex * cellSize}
                y={rowIndex * cellSize}
                width={cellSize}
                height={cellSize}
                fill={color}
              />
            ) : null
          )
        )}
      </Svg>
    </View>
  );
};

const SonarAnimation = ({ size, color }: { size: number; color: string }) => {
  const pulse1 = useSharedValue(0);
  const pulse2 = useSharedValue(0);
  const pulse3 = useSharedValue(0);
  const rotation = useSharedValue(0);

  useEffect(() => {
    pulse1.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );
    
    setTimeout(() => {
      pulse2.value = withRepeat(
        withTiming(1, { duration: 2000, easing: Easing.out(Easing.ease) }),
        -1,
        false
      );
    }, 666);
    
    setTimeout(() => {
      pulse3.value = withRepeat(
        withTiming(1, { duration: 2000, easing: Easing.out(Easing.ease) }),
        -1,
        false
      );
    }, 1333);

    rotation.value = withRepeat(
      withTiming(360, { duration: 4000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const pulse1Style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulse1.value, [0, 1], [0.3, 1]) }],
    opacity: interpolate(pulse1.value, [0, 0.5, 1], [0.8, 0.4, 0]),
  }));

  const pulse2Style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulse2.value, [0, 1], [0.3, 1]) }],
    opacity: interpolate(pulse2.value, [0, 0.5, 1], [0.8, 0.4, 0]),
  }));

  const pulse3Style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulse3.value, [0, 1], [0.3, 1]) }],
    opacity: interpolate(pulse3.value, [0, 0.5, 1], [0.8, 0.4, 0]),
  }));

  const radarStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View style={[styles.sonarContainer, { width: size, height: size }]}>
      <Animated.View style={[styles.sonarPulse, { width: size, height: size, borderColor: color }, pulse1Style]} />
      <Animated.View style={[styles.sonarPulse, { width: size, height: size, borderColor: color }, pulse2Style]} />
      <Animated.View style={[styles.sonarPulse, { width: size, height: size, borderColor: color }, pulse3Style]} />
      
      <View style={[styles.sonarCenter, { backgroundColor: color }]}>
        <Feather name="wifi" size={24} color="#FFFFFF" />
      </View>
      
      <Animated.View style={[styles.radarSweep, radarStyle]}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Path
            d={`M ${size/2} ${size/2} L ${size/2} 0 A ${size/2} ${size/2} 0 0 1 ${size} ${size/2} Z`}
            fill={`${color}20`}
          />
        </Svg>
      </Animated.View>
    </View>
  );
};

const ScanLineAnimation = () => {
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withRepeat(
      withSequence(
        withTiming(SCAN_FRAME_SIZE - 4, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.scanLine, animatedStyle]}>
      <View style={styles.scanLineGradient} />
    </Animated.View>
  );
};

export default function HotspotSetupScreen({ navigation, route }: Props) {
  const mode: SetupMode = route.params?.mode || "sender";
  const selectedFiles = route.params?.selectedFiles || [];
  
  const [step, setStep] = useState<SetupStep>("permissions");
  const [permissions, setPermissions] = useState<PermissionCheck[]>([]);
  const [hotspotInfo, setHotspotInfo] = useState<HotspotInfo | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrMatrix, setQrMatrix] = useState<QRCodeMatrix | null>(null);
  const [hasScanned, setHasScanned] = useState(false);
  
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  
  const lightTheme = Colors.light;

  const sheetTranslateY = useSharedValue(0);
  const sheetContext = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      sheetContext.value = sheetTranslateY.value;
    })
    .onUpdate((event) => {
      const newValue = sheetContext.value + event.translationY;
      const maxTranslate = BOTTOM_SHEET_MAX_HEIGHT - BOTTOM_SHEET_MIN_HEIGHT;
      sheetTranslateY.value = Math.max(-maxTranslate, Math.min(0, newValue));
    })
    .onEnd((event) => {
      const maxTranslate = BOTTOM_SHEET_MAX_HEIGHT - BOTTOM_SHEET_MIN_HEIGHT;
      const threshold = maxTranslate / 2;
      
      if (event.velocityY < -500) {
        sheetTranslateY.value = withSpring(-maxTranslate, { damping: 20, stiffness: 200 });
      } else if (event.velocityY > 500) {
        sheetTranslateY.value = withSpring(0, { damping: 20, stiffness: 200 });
      } else if (sheetTranslateY.value < -threshold) {
        sheetTranslateY.value = withSpring(-maxTranslate, { damping: 20, stiffness: 200 });
      } else {
        sheetTranslateY.value = withSpring(0, { damping: 20, stiffness: 200 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => {
    const maxTranslate = BOTTOM_SHEET_MAX_HEIGHT - BOTTOM_SHEET_MIN_HEIGHT;
    return {
      height: BOTTOM_SHEET_MIN_HEIGHT - sheetTranslateY.value,
      transform: [{ translateY: 0 }],
    };
  });

  const sonarSizeStyle = useAnimatedStyle(() => {
    const maxTranslate = BOTTOM_SHEET_MAX_HEIGHT - BOTTOM_SHEET_MIN_HEIGHT;
    const progress = Math.abs(sheetTranslateY.value) / maxTranslate;
    const minSize = 80;
    const maxSize = Math.min(SCREEN_WIDTH - 80, BOTTOM_SHEET_MAX_HEIGHT - 120);
    return {
      width: minSize + (maxSize - minSize) * progress,
      height: minSize + (maxSize - minSize) * progress,
    };
  });

  useEffect(() => {
    initializePermissions();
  }, [mode]);

  const generateQRCode = useCallback((info: HotspotInfo) => {
    try {
      const qrPayload = {
        ssid: info.ssid,
        password: info.password,
        ip: info.ipAddress,
        port: info.port,
        type: "sharel_hotspot",
        v: 1
      };
      
      logger.debug("HotspotSetup", "QR payload generated", qrPayload);
      
      // Using info.ssid as a fallback if JSON parsing fails on receiver
      const qrData = QRCode.create(JSON.stringify(qrPayload), {
        errorCorrectionLevel: "M",
      });
      
      const modules = qrData.modules;
      const size = modules.size;
      const data: boolean[][] = [];
      
      for (let row = 0; row < size; row++) {
        const rowData: boolean[] = [];
        for (let col = 0; col < size; col++) {
          rowData.push(modules.get(row, col) === 1);
        }
        data.push(rowData);
      }
      
      setQrMatrix({ size, data });
    } catch (error) {
      console.error("Error generating QR code:", error);
    }
  }, [selectedFiles]);

  const initializePermissions = async () => {
    let basePermissions: PermissionCheck[] = [];

    if (Platform.OS === "web") {
      if (mode === "sender") {
        await startHotspot();
        return;
      } else {
        basePermissions = [
          {
            id: "camera",
            title: "Camera",
            description: "Necessaire pour scanner le code QR",
            icon: "camera",
            status: "checking",
            action: requestCameraPermissionHandler,
            actionLabel: "AUTORISER",
          },
        ];
        setPermissions(basePermissions);
        await checkAllPermissions(basePermissions);
        return;
      }
    }

    if (mode === "sender") {
      basePermissions = [
        {
          id: "wifi",
          title: "Wi-Fi",
          description: "Requis pour creer le hotspot local",
          icon: "wifi",
          status: "granted",
          action: requestWifiPermission,
          actionLabel: "ACTIVER",
        },
      ];

      if (Platform.OS === "android") {
        basePermissions.push({
          id: "location",
          title: "Localisation",
          description: "Necessaire pour creer le hotspot",
          icon: "map-pin",
          status: "checking",
          action: requestLocationPermission,
          actionLabel: "AUTORISER",
        });
        
        if (Platform.Version >= 33) {
          basePermissions.push({
            id: "nearbyWifi",
            title: "Appareils Wi-Fi a proximite",
            description: "Requis par Android 13+ pour le hotspot",
            icon: "radio",
            status: "checking",
            action: requestNearbyWifiPermission,
            actionLabel: "AUTORISER",
          });
        }
      }
    } else {
      basePermissions = [
        {
          id: "camera",
          title: "Camera",
          description: "Necessaire pour scanner le code QR",
          icon: "camera",
          status: "checking",
          action: requestCameraPermissionHandler,
          actionLabel: "AUTORISER",
        },
      ];
      
      if (Platform.OS === "android") {
        basePermissions.push({
          id: "wifi",
          title: "Wi-Fi",
          description: "Requis pour se connecter au hotspot",
          icon: "wifi",
          status: "granted",
          action: requestWifiPermission,
          actionLabel: "ACTIVER",
        });
        basePermissions.push({
          id: "location",
          title: "Localisation",
          description: "Necessaire pour le scan Wi-Fi",
          icon: "map-pin",
          status: "checking",
          action: requestLocationPermission,
          actionLabel: "AUTORISER",
        });
      }
    }

    setPermissions(basePermissions);
    await checkAllPermissions(basePermissions);
  };

  const checkAllPermissions = async (perms: PermissionCheck[]) => {
    const updatedPerms = [...perms];
    
    for (let i = 0; i < updatedPerms.length; i++) {
      const perm = updatedPerms[i];
      const granted = await checkPermissionStatus(perm.id);
      updatedPerms[i] = { ...perm, status: granted ? "granted" : "denied" };
    }
    
    setPermissions(updatedPerms);
    
    const allGranted = updatedPerms.every(p => p.status === "granted");
    if (allGranted) {
      if (mode === "sender") {
        await startHotspot();
      } else {
        setStep("scanning");
      }
    }
  };

  const checkPermissionStatus = async (permId: string): Promise<boolean> => {
    try {
      switch (permId) {
        case "wifi":
          return true;
        case "camera":
          if (cameraPermission) {
            return cameraPermission.granted;
          }
          return false;
        case "location":
          if (Platform.OS !== "android") return true;
          const locationResult = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
          );
          return locationResult;
        case "nearbyWifi":
          if (Platform.OS === "android" && Platform.Version >= 33) {
            const nearbyResult = await PermissionsAndroid.check(
              "android.permission.NEARBY_WIFI_DEVICES" as any
            );
            return nearbyResult;
          }
          return true;
        default:
          return true;
      }
    } catch (error) {
      console.error("Error checking permission:", error);
      return false;
    }
  };

  const requestWifiPermission = async (): Promise<boolean> => {
    return true;
  };

  const requestCameraPermissionHandler = async (): Promise<boolean> => {
    try {
      const result = await requestCameraPermission();
      return result?.granted || false;
    } catch (error) {
      console.error("Error requesting camera permission:", error);
      return false;
    }
  };

  const requestLocationPermission = async (): Promise<boolean> => {
    if (Platform.OS !== "android") return true;
    
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: "Permission de localisation",
          message: "Sharel a besoin d'acceder a votre position pour le hotspot.",
          buttonPositive: "Autoriser",
          buttonNegative: "Refuser",
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (error) {
      console.error("Error requesting location permission:", error);
      return false;
    }
  };

  const requestNearbyWifiPermission = async (): Promise<boolean> => {
    if (Platform.OS !== "android" || Platform.Version < 33) return true;
    
    try {
      const granted = await PermissionsAndroid.request(
        "android.permission.NEARBY_WIFI_DEVICES" as any,
        {
          title: "Appareils Wi-Fi a proximite",
          message: "Sharel a besoin de cette permission pour creer le hotspot.",
          buttonPositive: "Autoriser",
          buttonNegative: "Refuser",
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (error) {
      console.error("Error requesting nearby wifi permission:", error);
      return false;
    }
  };

  const handlePermissionAction = async (permId: string) => {
    const perm = permissions.find(p => p.id === permId);
    if (!perm || !perm.action) return;

    setIsProcessing(true);
    const granted = await perm.action();
    setIsProcessing(false);
    
    const updatedPerms = permissions.map(p => 
      p.id === permId ? { ...p, status: granted ? "granted" : "denied" as const } : p
    );
    
    setPermissions(updatedPerms);

    const allGranted = updatedPerms.every(p => p.status === "granted");
    if (allGranted) {
      if (mode === "sender") {
        await startHotspot();
      } else {
        setStep("scanning");
      }
    }
  };

  const startHotspot = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      const deviceName = Math.random().toString(36).substring(2, 6).toUpperCase();
      logger.logHotspotEvent("UI: Starting hotspot", undefined, { deviceName, platform: Platform.OS, version: Platform.Version });
      console.log("[HotspotSetup] Starting hotspot with device name:", deviceName);
      
      const info = await HotspotService.startHotspot(deviceName);
      logger.logHotspotEvent("UI: Hotspot started successfully", info.ssid, info);
      console.log("[HotspotSetup] Hotspot started successfully:", JSON.stringify(info));
      
      setHotspotInfo(info);
      generateQRCode(info);
      setStep("ready");
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorCode = err?.code || "UNKNOWN";
      
      logger.error("Hotspot", "UI: HOTSPOT START FAILED", { 
        message: errorMessage, 
        code: errorCode,
        stack: err?.stack,
        fullError: JSON.stringify(err, Object.getOwnPropertyNames(err))
      });
      
      console.error("[HotspotSetup] Error starting hotspot:", err);
      console.error("[HotspotSetup] Error message:", errorMessage);
      console.error("[HotspotSetup] Error code:", errorCode);
      
      setError(`Impossible de demarrer le hotspot: ${errorMessage}`);
      
      let userMessage = "Une erreur s'est produite lors du demarrage du hotspot.";
      
      if (errorMessage.includes("INCOMPATIBLE_MODE") || errorMessage.includes("tethering")) {
        userMessage = "Veuillez desactiver le partage de connexion (hotspot) dans vos parametres avant de reessayer.";
      } else if (errorMessage.includes("PERMISSION") || errorMessage.includes("Location")) {
        userMessage = "Permission de localisation requise. Veuillez l'activer dans les parametres.";
      } else if (errorMessage.includes("LOCATION_DISABLED")) {
        userMessage = "La localisation doit etre activee pour creer le hotspot. Activez-la dans les parametres.";
      } else if (errorMessage.includes("NO_CHANNEL")) {
        userMessage = "Aucun canal WiFi disponible. Essayez de desactiver/reactiver le WiFi.";
      } else if (errorMessage.includes("TETHERING_DISALLOWED")) {
        userMessage = "Le partage de connexion est desactive par votre operateur ou la politique de l'appareil.";
      } else if (errorMessage.includes("GENERIC")) {
        userMessage = "Erreur generique. Verifiez qu'aucun autre hotspot n'est actif et que le WiFi est active.";
      } else {
        userMessage = `Erreur: ${errorMessage}`;
      }
      
      Alert.alert(
        "Hotspot non disponible",
        userMessage,
        [
          { text: "Reessayer", onPress: () => startHotspot() },
          { text: "Retour", onPress: () => navigation.goBack(), style: "cancel" },
        ]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBarcodeScanned = (result: BarcodeScanningResult) => {
    if (hasScanned) return;
    setHasScanned(true);

    const scannedData = result.data;
    logger.info("HotspotSetup", "QR Code scanned RAW", { data: scannedData });

    try {
      // Direct SSID fallback if it's not JSON
      if (scannedData.startsWith("AndroidShare_") || !scannedData.trim().startsWith("{")) {
        logger.info("HotspotSetup", "Detected plain SSID or legacy format", { data: scannedData });
        const connectionInfo = {
          ssid: scannedData.trim(),
          type: "sharel_hotspot",
          v: 1
        };
        promptConnection(connectionInfo);
        return;
      }

      const connectionInfo = JSON.parse(scannedData);
      logger.info("HotspotSetup", "Parsed QR connection info", connectionInfo);

      if (connectionInfo.type === "sharel_hotspot" || (connectionInfo.ssid && connectionInfo.password)) {
        promptConnection(connectionInfo);
        return;
      }

      Alert.alert(
        "Code QR non reconnu",
        "Ce code QR ne correspond pas a un emetteur Sharel.",
        [{ text: "OK", onPress: () => setHasScanned(false) }]
      );
    } catch (e) {
      logger.error("HotspotSetup", "QR scan failed to parse JSON", { 
        error: e instanceof Error ? e.message : String(e),
        data: scannedData 
      });
      
      // Fallback: treat as plain SSID if it matches our pattern
      if (scannedData.includes("AndroidShare")) {
        promptConnection({ ssid: scannedData });
      } else {
        Alert.alert(
          "Code QR invalide",
          "Le format du code QR n'est pas reconnu.",
          [{ text: "OK", onPress: () => setHasScanned(false) }]
        );
      }
    }
  };

  const promptConnection = (connectionInfo: any) => {
    Alert.alert(
      "Point d'acces detecte",
      `SSID: ${connectionInfo.ssid || "Inconnu"}${connectionInfo.files ? `\nFichiers: ${connectionInfo.files}` : ""}`,
      [
        { 
          text: "Annuler", 
          style: "cancel",
          onPress: () => setHasScanned(false)
        },
        {
          text: "Se connecter",
          onPress: () => handleConnectToHotspot(connectionInfo),
        },
      ]
    );
  };

  const handleConnectToHotspot = async (connectionInfo: any) => {
    try {
      console.log("[HotspotSetup] Connecting to hotspot:", connectionInfo);
      setIsProcessing(true);
      
      const ssid = connectionInfo.ssid;
      const password = connectionInfo.password || "";
      // Gateway par défaut critique : sans IP, le receveur ne peut pas joindre la room HTTP
      const ipAddress = connectionInfo.ipAddress || connectionInfo.ip || "192.168.43.1";
      const port = connectionInfo.port || 8080;
      
      logger.info("HotspotSetup", "Starting connection sequence", { ssid, ip: ipAddress });

      const result = await HotspotService.connectToWifi(ssid, password, ipAddress, port);
      
      if (result.connected) {
        const peerId = `server-${ipAddress}`;
        const peerName = ssid || "Hotspot";

        logger.info("HotspotSetup", "Connection established, joining room", { peerId });
        
        // Petit délai pour laisser le temps au réseau de se stabiliser sur Android
        setTimeout(() => {
          navigation.navigate("TransferRoom", {
            selectedFiles: [],
            peerId,
            peerName,
            isHost: false,
          });
        }, 500);
      } else {
        throw new Error("Native connection failed");
      }
    } catch (error) {
      logger.error("HotspotSetup", "Global connection failure", error);
      setIsProcessing(false);
      Alert.alert(
        "Connexion Impossible",
        "Le point d'accès n'a pas pu être rejoint. Assurez-vous que l'envoyeur est toujours sur l'écran du QR Code.",
        [{ text: "Réessayer", onPress: () => setHasScanned(false) }]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleContinueToRoom = () => {
    if (hotspotInfo) {
      const peerId = `hotspot_${hotspotInfo.ssid}_${Date.now()}`;
      const peerName = hotspotInfo.ssid || "Hotspot";
      
      navigation.navigate("TransferRoom", {
        selectedFiles,
        peerId,
        peerName,
        isHost: true,
      });
    }
  };

  const pendingPermissions = permissions.filter(p => p.status !== "granted");

  const renderPermissionsStep = () => (
    <View style={styles.bottomSection}>
      <View style={styles.checksContainer}>
        {pendingPermissions.map((perm, index) => (
          <View key={perm.id}>
            <Pressable
              onPress={() => handlePermissionAction(perm.id)}
              disabled={isProcessing}
              style={({ pressed }) => [
                styles.checkItem,
                { opacity: pressed ? 0.7 : 1 }
              ]}
            >
              <View style={[styles.checkIconContainer, { backgroundColor: `${lightTheme.primary}15` }]}>
                {perm.status === "checking" ? (
                  <ActivityIndicator size={20} color={lightTheme.primary} />
                ) : (
                  <Feather name={perm.icon} size={20} color={lightTheme.primary} />
                )}
              </View>
              <View style={styles.checkText}>
                <View style={styles.checkTitleRow}>
                  <Text style={[styles.checkTitle, { color: lightTheme.text }]}>
                    {perm.title}
                  </Text>
                  {perm.status === "granted" ? (
                    <Feather name="check-circle" size={16} color={lightTheme.success} />
                  ) : (
                    <Feather name="chevron-right" size={16} color={lightTheme.textSecondary} />
                  )}
                </View>
                <Text style={[styles.checkDescription, { color: lightTheme.textSecondary }]}>
                  {perm.description}
                </Text>
              </View>
              {perm.status !== "granted" ? (
                <Pressable
                  onPress={() => handlePermissionAction(perm.id)}
                  disabled={isProcessing}
                  style={styles.actionButton}
                >
                  {isProcessing ? (
                    <ActivityIndicator size="small" color={lightTheme.primary} />
                  ) : (
                    <Text style={[styles.actionButtonText, { color: lightTheme.primary }]}>
                      {perm.actionLabel}
                    </Text>
                  )}
                </Pressable>
              ) : null}
            </Pressable>
            {index < pendingPermissions.length - 1 ? (
              <View style={[styles.separator, { backgroundColor: lightTheme.border }]} />
            ) : null}
          </View>
        ))}
      </View>

      {error ? (
        <View style={[styles.errorContainer, { backgroundColor: `${lightTheme.warning}15` }]}>
          <Feather name="info" size={20} color={lightTheme.warning} />
          <Text style={[styles.errorText, { color: lightTheme.warning }]}>{error}</Text>
        </View>
      ) : null}
    </View>
  );

  const renderSenderReady = () => (
    <View style={styles.contentSection}>
      <View style={[styles.qrCard, { backgroundColor: lightTheme.backgroundSecondary }]}>
        {qrMatrix ? (
          <>
            <View style={styles.qrWrapper}>
              <QRCodeDisplay 
                matrix={qrMatrix} 
                size={QR_SIZE} 
                color={lightTheme.text}
                backgroundColor="#FFFFFF"
              />
            </View>
            <Text style={[styles.qrLabel, { color: lightTheme.text }]}>
              Scannez ce code avec l'appareil recepteur
            </Text>
          </>
        ) : (
          <ActivityIndicator size="large" color={lightTheme.primary} />
        )}
        
        {hotspotInfo ? (
          <View style={styles.hotspotInfoContainer}>
            <View style={styles.hotspotInfoRow}>
              <Text style={[styles.hotspotInfoLabel, { color: lightTheme.textSecondary }]}>SSID:</Text>
              <Text style={[styles.hotspotInfoValue, { color: lightTheme.text }]}>{hotspotInfo.ssid}</Text>
            </View>
            <View style={styles.hotspotInfoRow}>
              <Text style={[styles.hotspotInfoLabel, { color: lightTheme.textSecondary }]}>Mot de passe:</Text>
              <Text style={[styles.hotspotInfoValue, { color: lightTheme.text }]}>{hotspotInfo.password}</Text>
            </View>
          </View>
        ) : null}
      </View>

      {error ? (
        <View style={[styles.infoContainer, { backgroundColor: `${lightTheme.warning}15` }]}>
          <Feather name="info" size={18} color={lightTheme.warning} />
          <Text style={[styles.infoText, { color: lightTheme.warning }]}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.footer}>
        <Pressable
          onPress={handleContinueToRoom}
          style={({ pressed }) => [
            styles.continueButton,
            {
              backgroundColor: lightTheme.primary,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          <Text style={[styles.continueText, { color: "#FFFFFF" }]}>
            Aller a la salle de transfert
          </Text>
        </Pressable>
      </View>
    </View>
  );

  const renderReceiverScanning = () => (
    <GestureHandlerRootView style={styles.fullScreenScanning}>
      <View style={styles.fullCameraContainer}>
        {Platform.OS !== "web" ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ["qr"],
            }}
            onBarcodeScanned={hasScanned ? undefined : handleBarcodeScanned}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "#1a1a2e" }]} />
        )}
        
        <View style={styles.fullCameraOverlay}>
          <View style={styles.overlayTop} />
          <View style={styles.overlayMiddle}>
            <View style={styles.overlaySide} />
            <View style={styles.scanFrameContainer}>
              <View style={styles.scanFrame}>
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
                <ScanLineAnimation />
              </View>
            </View>
            <View style={styles.overlaySide} />
          </View>
          <View style={styles.overlayBottom} />
        </View>
      </View>

      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.bottomSheet, { backgroundColor: lightTheme.backgroundRoot }, sheetStyle]}>
          <View style={styles.sheetHandle}>
            <View style={[styles.handleBar, { backgroundColor: lightTheme.border }]} />
          </View>
          
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: lightTheme.text }]}>
              RECHERCHE DES DESTINATAIRES
            </Text>
          </View>

          <View style={styles.sonarWrapper}>
            <Animated.View style={sonarSizeStyle}>
              <SonarAnimation size={200} color={lightTheme.primary} />
            </Animated.View>
          </View>
        </Animated.View>
      </GestureDetector>
    </GestureHandlerRootView>
  );

  return (
    <View style={[styles.container, { backgroundColor: lightTheme.backgroundRoot }]}>
      {step === "scanning" && mode === "receiver" ? (
        <>
          <View style={[styles.floatingHeader, { backgroundColor: "transparent" }]}>
            <Pressable 
              onPress={() => navigation.goBack()}
              style={({ pressed }) => [
                styles.backButton,
                { backgroundColor: pressed ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.3)" }
              ]}
            >
              <Feather name="arrow-left" size={24} color="#FFFFFF" />
            </Pressable>
            <Text style={[styles.floatingTitle, { color: "#FFFFFF" }]}>
              Scanner le code QR
            </Text>
            <View style={{ width: 40 }} />
          </View>
          {renderReceiverScanning()}
        </>
      ) : (
        <>
          <View style={styles.header}>
            <Pressable 
              onPress={() => navigation.goBack()}
              style={({ pressed }) => [
                styles.backButton,
                { backgroundColor: pressed ? lightTheme.backgroundSecondary : "transparent" }
              ]}
            >
              <Feather name="arrow-left" size={24} color={lightTheme.text} />
            </Pressable>
            <Text style={[styles.title, { color: lightTheme.text }]}>
              {mode === "sender" ? "Transfert par Hotspot" : "Scanner le code QR"}
            </Text>
            <View style={{ width: 40 }} />
          </View>

          {step === "permissions" ? (
            <>
              <View style={styles.fixedIllustrationContainer}>
                <HotspotIcon color={lightTheme.primary} size={100} />
                <Text style={[styles.illustrationText, { color: lightTheme.text }]}>
                  {mode === "sender" 
                    ? "Creer un Hotspot"
                    : "Scanner pour recevoir"}
                </Text>
                <Text style={[styles.illustrationSubtext, { color: lightTheme.textSecondary }]}>
                  {mode === "sender"
                    ? "Autorisez les permissions pour commencer"
                    : "Autorisez les permissions pour scanner le code QR"}
                </Text>
              </View>
              {renderPermissionsStep()}
            </>
          ) : null}

          {step === "ready" && mode === "sender" ? renderSenderReady() : null}
        </>
      )}
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
    paddingTop: Platform.OS === "ios" ? 60 : Spacing.xl,
    paddingBottom: Spacing.md,
  },
  floatingHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === "ios" ? 60 : Spacing.xl,
    paddingBottom: Spacing.md,
    zIndex: 100,
  },
  floatingTitle: {
    fontSize: 18,
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
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
  fixedIllustrationContainer: {
    height: FIXED_HEADER_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  illustrationText: {
    fontSize: 22,
    fontWeight: "700",
    marginTop: Spacing.md,
    textAlign: "center",
  },
  illustrationSubtext: {
    fontSize: 14,
    textAlign: "center",
    marginTop: Spacing.xs,
    lineHeight: 20,
  },
  bottomSection: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Platform.OS === "ios" ? 40 : Spacing.xl,
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
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  separator: {
    height: 1,
    marginLeft: 52,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  errorText: {
    fontSize: 14,
    flex: 1,
  },
  contentSection: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  qrCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    marginTop: Spacing.md,
  },
  qrWrapper: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: "#FFFFFF",
  },
  qrCodeContainer: {
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
  },
  qrLabel: {
    fontSize: 15,
    fontWeight: "500",
    marginTop: Spacing.lg,
    textAlign: "center",
  },
  hotspotInfoContainer: {
    marginTop: Spacing.lg,
    width: "100%",
    gap: Spacing.xs,
  },
  hotspotInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  hotspotInfoLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  hotspotInfoValue: {
    fontSize: 13,
    fontWeight: "600",
  },
  infoContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  infoText: {
    fontSize: 13,
    flex: 1,
  },
  footer: {
    marginTop: "auto",
    paddingTop: Spacing.lg,
    paddingBottom: Platform.OS === "ios" ? 40 : Spacing.xl,
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
  fullScreenScanning: {
    flex: 1,
  },
  fullCameraContainer: {
    flex: 1,
  },
  fullCameraOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayTop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  overlayMiddle: {
    flexDirection: "row",
    height: SCAN_FRAME_SIZE,
  },
  overlaySide: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  scanFrameContainer: {
    width: SCAN_FRAME_SIZE,
    height: SCAN_FRAME_SIZE,
    justifyContent: "center",
    alignItems: "center",
  },
  scanFrame: {
    width: SCAN_FRAME_SIZE,
    height: SCAN_FRAME_SIZE,
    position: "relative",
    overflow: "hidden",
  },
  corner: {
    position: "absolute",
    width: 50,
    height: 50,
    borderColor: "#00D4FF",
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
  scanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 4,
    top: 0,
  },
  scanLineGradient: {
    flex: 1,
    backgroundColor: "#00D4FF",
    shadowColor: "#00D4FF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 10,
  },
  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
    overflow: "hidden",
  },
  sheetHandle: {
    alignItems: "center",
    paddingVertical: 12,
  },
  handleBar: {
    width: 40,
    height: 5,
    borderRadius: 3,
  },
  sheetHeader: {
    alignItems: "center",
    paddingBottom: Spacing.md,
  },
  sheetTitle: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  sonarWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: Platform.OS === "ios" ? 40 : Spacing.xl,
  },
  sonarContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  sonarPulse: {
    position: "absolute",
    borderRadius: 1000,
    borderWidth: 2,
  },
  sonarCenter: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  radarSweep: {
    position: "absolute",
  },
});
