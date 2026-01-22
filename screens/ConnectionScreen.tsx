import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Text,
  Platform,
  ActivityIndicator,
  Dimensions,
  Alert,
  FlatList,
  ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { HomeStackParamList } from "@/navigation/HomeStackNavigator";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Device from "expo-device";
import UnifiedTransferService, { Peer } from "@/services/UnifiedTransferService";
import DeviceTypeService from "@/services/DeviceTypeService";
import { logger } from "@/services/LoggerService";
import { useTranslation } from "react-i18next";
import Svg, { Rect } from "react-native-svg";
import * as QRCode from "qrcode";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";

interface QRCodeMatrix {
  size: number;
  data: boolean[][];
}

type ConnectionScreenNavigationProp = NativeStackNavigationProp<HomeStackParamList, "Connection">;
type ConnectionScreenRouteProp = RouteProp<HomeStackParamList, "Connection">;

interface Props {
  navigation: ConnectionScreenNavigationProp;
  route: ConnectionScreenRouteProp;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const RADAR_SIZE = Math.min(SCREEN_WIDTH * 0.7, 280);

export default function ConnectionScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { selectedFiles, senderDeviceType, receiverDeviceType, transferMethod } = route.params;
  const insets = useSafeAreaInsets();
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [deviceName, setDeviceName] = useState("");
  const [qrMatrix, setQrMatrix] = useState<QRCodeMatrix | null>(null);
  const [myPeerId, setMyPeerId] = useState<string | null>(null);
  
  const radarRotation = useSharedValue(0);
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.6);
  
  const lightTheme = Colors.light;

  useEffect(() => {
    initializeDeviceName();
    
    UnifiedTransferService.setOnPeersChange((updatedPeers) => {
      setPeers(updatedPeers);
    });

    UnifiedTransferService.setOnConnectionRequest((peerId, name) => {
      Alert.alert(
        t('discover.connectionRequest'),
        t('discover.wantsToConnect', { name }),
        [
          {
            text: t('common.refuse'),
            onPress: () => UnifiedTransferService.rejectConnectionFrom(peerId),
            style: "cancel",
          },
          {
            text: t('common.accept'),
            onPress: () => handleAcceptConnection(peerId),
          },
        ]
      );
    });

    UnifiedTransferService.setOnConnected((peerId) => {
      const peer = peers.find((p) => p.peerId === peerId);
      navigation.navigate("TransferRoom", {
        selectedFiles,
        peerName: peer?.name || t('common.device'),
        peerId,
        isHost: true,
      });
    });

    startDiscovery();

    return () => {
      stopDiscovery();
    };
  }, []);

  const initializeDeviceName = async () => {
    try {
      const deviceModel = Device.modelName || Device.modelId || Platform.select({
        ios: "iPhone",
        android: "Android",
        default: t('common.device'),
      }) || t('common.myDevice');
      setDeviceName(deviceModel);
      return deviceModel;
    } catch (error) {
      console.error("Error getting device name:", error);
      setDeviceName(t('common.myDevice'));
      return t('common.myDevice');
    }
  };

  const generateQRCode = useCallback((peerId: string, name: string, hotspotInfo?: { ssid: string; password: string; ipAddress: string; port: number }) => {
    try {
      const totalSize = selectedFiles.reduce((acc: number, f: any) => {
        const size = f.sizeBytes || (typeof f.size === 'number' ? f.size : 0);
        return acc + size;
      }, 0);
      
      const methodToUse = transferMethod || "wifidirect";
      const isHotspotMethod = methodToUse === "hotspot" || !!hotspotInfo;
      
      let qrPayload: any;
      
      if (isHotspotMethod && hotspotInfo) {
        qrPayload = {
          v: 1,
          type: "sharel_hotspot",
          ssid: hotspotInfo.ssid,
          password: hotspotInfo.password,
          ip: hotspotInfo.ipAddress,
          port: hotspotInfo.port,
        };
      } else {
        qrPayload = {
          v: 1,
          type: "sharel_send",
          peerId: peerId,
          name: name,
        };
      }
      
      logger.debug("Connection", "QR payload", qrPayload);
      
      const qrData = QRCode.create(JSON.stringify(qrPayload), {
        errorCorrectionLevel: "L",
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
  }, [selectedFiles, transferMethod]);

  const startDiscovery = async () => {
    try {
      setIsDiscovering(true);
      startRadarAnimation();
      
      let methodToUse: "wifidirect" | "multipeer" | "hotspot" | undefined = transferMethod;
      
      if (!methodToUse || methodToUse === "auto") {
        const localDeviceType = DeviceTypeService.getLocalDeviceType();
        if (localDeviceType === "android") {
          methodToUse = "hotspot";
        } else if (localDeviceType === "ios") {
          methodToUse = "multipeer";
        }
      }
      
      console.log('[ConnectionScreen] Starting advertising with method:', methodToUse);
      const result = await UnifiedTransferService.startAdvertising(deviceName || t('common.device'), methodToUse);
      
      const peerId = result?.peerId || `${Platform.OS}_${Date.now()}`;
      setMyPeerId(peerId);
      
      if (methodToUse === "hotspot") {
        const hotspotInfo = UnifiedTransferService.getHotspotInfo();
        console.log('[ConnectionScreen] Hotspot info for QR:', hotspotInfo);
        if (hotspotInfo) {
          generateQRCode(peerId, deviceName || t('common.device'), hotspotInfo);
        } else {
          console.warn('[ConnectionScreen] Hotspot started but no info available');
          generateQRCode(peerId, deviceName || t('common.device'));
        }
      } else {
        generateQRCode(peerId, deviceName || t('common.device'));
      }
    } catch (error: any) {
      console.error("Error starting advertising:", error);
      const errorMessage = error?.message || t('discover.startDiscoveryError');
      Alert.alert(
        "Probleme de connexion", 
        errorMessage,
        [
          { text: "Retour", onPress: () => navigation.goBack() },
          { 
            text: "Reessayer", 
            onPress: () => {
              setIsDiscovering(false);
              setTimeout(startDiscovery, 500);
            }
          },
        ]
      );
      setIsDiscovering(false);
    }
  };

  const stopDiscovery = async () => {
    try {
      await UnifiedTransferService.stopAdvertising();
    } catch (error) {
      console.log("Error stopping advertising:", error);
    }
    setIsDiscovering(false);
  };

  const handleConnectToPeer = async (peer: Peer) => {
    try {
      await UnifiedTransferService.connectToPeer(peer.peerId);
    } catch (error) {
      console.error("Error connecting to peer:", error);
      Alert.alert(t('common.error'), t('discover.unableToConnect'));
    }
  };

  const handleAcceptConnection = async (peerId: string) => {
    try {
      await UnifiedTransferService.acceptConnectionFrom(peerId);
    } catch (error) {
      console.error("Error accepting connection:", error);
      Alert.alert(t('common.error'), t('discover.unableToConnect'));
    }
  };

  const startRadarAnimation = () => {
    radarRotation.value = withRepeat(
      withTiming(360, { duration: 3000, easing: Easing.linear }),
      -1,
      false
    );

    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.3, { duration: 1500, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 1500, easing: Easing.in(Easing.ease) })
      ),
      -1,
      false
    );

    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.2, { duration: 1500 }),
        withTiming(0.6, { duration: 1500 })
      ),
      -1,
      false
    );
  };

  const radarAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${radarRotation.value}deg` }],
  }));

  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const renderPeer = ({ item }: { item: Peer }) => (
    <Pressable
      style={[
        styles.peerItem,
        item.status === "connected" && styles.peerItemConnected,
        item.status === "connecting" && styles.peerItemConnecting,
      ]}
      onPress={() => {
        if (item.status === "discovered") {
          handleConnectToPeer(item);
        }
      }}
      disabled={item.status !== "discovered"}
    >
      <View style={[styles.peerIcon, { backgroundColor: `${lightTheme.primary}15` }]}>
        <Feather
          name="smartphone"
          size={24}
          color={item.status === "connected" ? lightTheme.success : lightTheme.primary}
        />
      </View>

      <View style={styles.peerInfo}>
        <Text style={[styles.peerName, { color: lightTheme.text }]}>{item.name}</Text>
        <Text style={[styles.peerStatus, { color: lightTheme.textSecondary }]}>
          {item.status === "discovered" && t('discover.tapToConnect')}
          {item.status === "connecting" && t('discover.connectingStatus')}
          {item.status === "connected" && t('discover.connected')}
          {item.status === "disconnected" && t('discover.disconnected')}
        </Text>
      </View>

      {item.status === "connecting" ? (
        <ActivityIndicator size="small" color={lightTheme.primary} />
      ) : item.status === "connected" ? (
        <Feather name="check-circle" size={24} color={lightTheme.success} />
      ) : (
        <Feather name="chevron-right" size={24} color={lightTheme.textSecondary} />
      )}
    </Pressable>
  );

  return (
    <View style={[styles.container, { backgroundColor: lightTheme.backgroundRoot }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable 
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [
            styles.backButton,
            { backgroundColor: pressed ? lightTheme.backgroundSecondary : "transparent" }
          ]}
        >
          <Feather name="arrow-left" size={24} color={lightTheme.text} />
        </Pressable>
        <Text style={[styles.title, { color: lightTheme.text }]}>{t('discover.searchingDevices')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.filesInfo}>
          <Feather name="file" size={16} color={lightTheme.textSecondary} />
          <Text style={[styles.filesInfoText, { color: lightTheme.textSecondary }]}>
            {t('discover.filesToSend', { count: selectedFiles.length })}
          </Text>
        </View>

        <View style={styles.radarSection}>
          {qrMatrix ? (
            <View style={styles.qrContainer}>
              <View style={styles.qrWrapper}>
                <Svg
                  width={200}
                  height={200}
                  viewBox={`0 0 ${qrMatrix.size} ${qrMatrix.size}`}
                >
                  <Rect x="0" y="0" width={qrMatrix.size} height={qrMatrix.size} fill="#FFFFFF" />
                  {qrMatrix.data.map((row, rowIndex) =>
                    row.map((cell, colIndex) =>
                      cell ? (
                        <Rect
                          key={`${rowIndex}-${colIndex}`}
                          x={colIndex}
                          y={rowIndex}
                          width={1}
                          height={1}
                          fill={lightTheme.text}
                        />
                      ) : null
                    )
                  )}
                </Svg>
              </View>
              <Text style={[styles.qrLabel, { color: lightTheme.text }]}>
                {t('discover.scanToConnect') || "Scannez pour vous connecter"}
              </Text>
            </View>
          ) : (
            <View style={styles.radarContainer}>
              <Animated.View style={[styles.pulse, pulseAnimatedStyle, { backgroundColor: `${lightTheme.primary}30` }]} />
              <Animated.View style={[styles.radar, radarAnimatedStyle]}>
                <View style={[styles.radarLine, { backgroundColor: lightTheme.primary }]} />
              </Animated.View>
              <View style={[styles.radarCenter, { backgroundColor: lightTheme.primary }]}>
                <Feather name="radio" size={32} color="#FFFFFF" />
              </View>
            </View>
          )}
          
          <Text style={[styles.searchingText, { color: lightTheme.text }]}>
            {isDiscovering ? t('discover.searchingInProgress') : t('discover.waiting')}
          </Text>
          <Text style={[styles.instruction, { color: lightTheme.textSecondary }]}>
            {t('discover.ensureReceiverMode')}
          </Text>
        </View>

        {peers.length > 0 ? (
          <View style={styles.peersSection}>
            <Text style={[styles.peersTitle, { color: lightTheme.text }]}>
              {t('discover.devicesFoundCount', { count: peers.length })}
            </Text>
            <FlatList
              data={peers}
              renderItem={renderPeer}
              keyExtractor={(item) => item.peerId}
              contentContainerStyle={styles.peersList}
              showsVerticalScrollIndicator={false}
            />
          </View>
        ) : isDiscovering ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: lightTheme.textSecondary }]}>
              {t('discover.noDevicesYet')}
            </Text>
          </View>
        ) : null}
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
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  filesInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  filesInfoText: {
    fontSize: 14,
  },
  radarSection: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
  radarContainer: {
    width: RADAR_SIZE,
    height: RADAR_SIZE,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  pulse: {
    position: "absolute",
    width: RADAR_SIZE,
    height: RADAR_SIZE,
    borderRadius: RADAR_SIZE / 2,
  },
  radar: {
    position: "absolute",
    width: RADAR_SIZE * 0.9,
    height: RADAR_SIZE * 0.9,
    justifyContent: "center",
    alignItems: "center",
  },
  radarLine: {
    position: "absolute",
    width: 2,
    height: RADAR_SIZE * 0.45,
    top: 0,
    left: "50%",
    marginLeft: -1,
    borderRadius: 1,
    opacity: 0.7,
  },
  radarCenter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  searchingText: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  instruction: {
    fontSize: 14,
    textAlign: "center",
  },
  peersSection: {
    flex: 1,
    paddingTop: Spacing.lg,
  },
  peersTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  peersList: {
    gap: 8,
  },
  peerItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.backgroundDefault,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  peerItemConnected: {
    borderColor: Colors.light.success,
    backgroundColor: "#F0FDF4",
  },
  peerItemConnecting: {
    borderColor: Colors.light.primary,
    backgroundColor: "#EFF6FF",
  },
  peerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  peerInfo: {
    flex: 1,
    gap: 2,
  },
  peerName: {
    fontSize: 16,
    fontWeight: "600",
  },
  peerStatus: {
    fontSize: 13,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
  qrContainer: {
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  qrWrapper: {
    padding: Spacing.md,
    backgroundColor: "#FFFFFF",
    borderRadius: BorderRadius.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  qrLabel: {
    marginTop: Spacing.md,
    fontSize: 14,
    fontWeight: "500",
  },
});
