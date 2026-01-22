import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Text,
  FlatList,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { HomeStackParamList } from "@/navigation/HomeStackNavigator";
import UnifiedTransferService, { Peer } from "@/services/UnifiedTransferService";
import { TransferMethod } from "@/services/SystemRequirementsService";
import * as Device from "expo-device";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import Svg, { Rect } from "react-native-svg";
import * as QRCode from "qrcode";
import { logger } from "@/services/LoggerService";

type DeviceDiscoveryScreenNavigationProp = NativeStackNavigationProp<
  HomeStackParamList,
  "DeviceDiscovery"
>;
type DeviceDiscoveryScreenRouteProp = RouteProp<HomeStackParamList, "DeviceDiscovery">;

interface Props {
  navigation: DeviceDiscoveryScreenNavigationProp;
  route: DeviceDiscoveryScreenRouteProp;
}

interface QRCodeMatrix {
  size: number;
  data: boolean[][];
}

export default function DeviceDiscoveryScreen({ navigation, route }: Props) {
  const { selectedFiles, transferMethod: passedMethod } = route.params || { selectedFiles: [] };
  const [isAdvertising, setIsAdvertising] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [deviceName, setDeviceName] = useState("");
  const [myPeerId, setMyPeerId] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [transferMethod, setTransferMethod] = useState<TransferMethod>(passedMethod || "auto");
  const [qrMatrix, setQrMatrix] = useState<QRCodeMatrix | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [showQRCode, setShowQRCode] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    
    const initialize = async () => {
      const caps = UnifiedTransferService.getCapabilities();
      
      if (passedMethod && passedMethod !== "auto") {
        setTransferMethod(passedMethod);
      } else {
        const bestMethod = UnifiedTransferService.selectBestMethod();
        setTransferMethod(bestMethod);
      }
      
      const anySupported = caps.wifidirect || caps.multipeer || caps.hotspot;
      setIsSupported(anySupported);

      const name = await initializeDeviceName();
      
      if (anySupported && mountedRef.current) {
        UnifiedTransferService.setOnPeersChange((updatedPeers) => {
          if (mountedRef.current) {
            setPeers(updatedPeers);
          }
        });

        UnifiedTransferService.setOnConnected((peerId) => {
          if (!mountedRef.current) return;
          const peer = peers.find((p) => p.peerId === peerId);
          Alert.alert(
            "Connecte",
            `${peer?.name || "Un appareil"} s'est connecte`,
            [
              {
                text: "Envoyer",
                onPress: () => {
                  navigation.navigate("FileTransfer", {
                    peerId,
                    peerName: peer?.name || "Appareil",
                    selectedFiles,
                  });
                },
              },
            ]
          );
        });

        await startAdvertisingAuto(name, passedMethod || transferMethod);
      }
      
      if (mountedRef.current) {
        setIsInitializing(false);
      }
    };

    initialize();

    return () => {
      mountedRef.current = false;
      UnifiedTransferService.stopAdvertising().catch(err => 
        console.warn("Error stopping advertising on unmount:", err)
      );
    };
  }, []);

  useEffect(() => {
    if (myPeerId && transferMethod && deviceName) {
      generateQRCode();
    }
  }, [myPeerId, transferMethod, deviceName]);

  const initializeDeviceName = async (): Promise<string> => {
    try {
      const deviceModel = Device.modelName || Device.modelId || Platform.select({
        ios: "iPhone",
        android: "Android",
        default: "Appareil",
      }) || "Mon Appareil";
      setDeviceName(deviceModel);
      return deviceModel;
    } catch (error) {
      console.error("Error getting device name:", error);
      const fallbackName = Platform.select({
        ios: "iPhone",
        android: "Android",
        default: "Mon Appareil",
      }) || "Mon Appareil";
      setDeviceName(fallbackName);
      return fallbackName;
    }
  };

  const generateQRCode = () => {
    try {
      const qrPayload = {
        v: 1,
        type: "sharel_send",
        peerId: myPeerId,
        name: deviceName,
      };
      
      console.log("QR Payload generated:", qrPayload);
      
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
      setQrError(null);
    } catch (error) {
      console.error("Error generating QR code:", error);
      setQrError("Impossible de generer le QR code");
    }
  };

  const startAdvertisingAuto = async (name: string, method: TransferMethod) => {
    try {
      setIsAdvertising(true);
      const peerId = await UnifiedTransferService.startAdvertising(name, method);
      if (mountedRef.current) {
        setMyPeerId(peerId);
      }
    } catch (error) {
      console.error("Error starting advertising:", error);
      if (mountedRef.current) {
        setIsAdvertising(false);
        Alert.alert("Erreur", "Impossible de demarrer. Veuillez reessayer.");
      }
    }
  };

  const retryAdvertising = async () => {
    setIsInitializing(true);
    setQrError(null);
    setQrMatrix(null);
    
    try {
      await UnifiedTransferService.stopAdvertising();
    } catch (e) {
      console.warn("Error stopping before retry:", e);
    }
    
    await startAdvertisingAuto(deviceName, transferMethod);
    setIsInitializing(false);
  };

  const getMethodDescription = () => {
    if (transferMethod === "wifidirect") {
      return "Wi-Fi Direct (Android)";
    } else if (transferMethod === "multipeer") {
      return "Multipeer (iOS)";
    } else if (transferMethod === "hotspot") {
      return "Hotspot";
    }
    return "Auto";
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const getTotalSize = (): string => {
    const total = selectedFiles.reduce((acc, f) => acc + (f.size || 0), 0);
    return formatFileSize(total);
  };

  const renderQRCode = () => {
    if (!qrMatrix) return null;
    
    const qrSize = 200;
    const cellSize = qrSize / qrMatrix.size;
    const cells: React.ReactNode[] = [];
    
    for (let row = 0; row < qrMatrix.size; row++) {
      for (let col = 0; col < qrMatrix.size; col++) {
        if (qrMatrix.data[row][col]) {
          cells.push(
            <Rect
              key={`${row}-${col}`}
              x={col * cellSize}
              y={row * cellSize}
              width={cellSize}
              height={cellSize}
              fill="#000"
            />
          );
        }
      }
    }
    
    return (
      <View style={styles.qrContainer}>
        <View style={styles.qrBackground}>
          <Svg width={qrSize} height={qrSize} viewBox={`0 0 ${qrSize} ${qrSize}`}>
            {cells}
          </Svg>
        </View>
        <Text style={styles.qrLabel}>Le receveur doit scanner ce QR code</Text>
      </View>
    );
  };

  const renderPeer = ({ item }: { item: Peer }) => (
    <View
      style={[
        styles.peerItem,
        item.status === "connected" && styles.peerItemConnected,
      ]}
    >
      <View style={styles.peerIcon}>
        <Feather
          name="smartphone"
          size={28}
          color={item.status === "connected" ? "#10B981" : "#2563EB"}
        />
      </View>

      <View style={styles.peerInfo}>
        <Text style={styles.peerName}>{item.name}</Text>
        <Text style={styles.peerStatus}>
          {item.status === "discovered" && "Decouvert"}
          {item.status === "connecting" && "Connexion..."}
          {item.status === "connected" && "Connecte"}
          {item.status === "disconnected" && "Deconnecte"}
        </Text>
      </View>

      {item.status === "connecting" && (
        <ActivityIndicator size="small" color="#2563EB" />
      )}
      {item.status === "connected" && (
        <Feather name="check-circle" size={24} color="#10B981" />
      )}
    </View>
  );

  if (isInitializing) {
    return (
      <ScreenScrollView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#000" />
          </Pressable>
          <Text style={styles.headerTitle}>Envoi de fichiers</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Preparation...</Text>
          <Text style={styles.loadingSubtext}>Generation du QR code...</Text>
        </View>
      </ScreenScrollView>
    );
  }

  return (
    <ScreenScrollView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#000" />
        </Pressable>
        <Text style={styles.headerTitle}>Envoi de fichiers</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.filesCard}>
        <View style={styles.filesCardHeader}>
          <Feather name="file" size={20} color="#2563EB" />
          <Text style={styles.filesCardTitle}>
            {selectedFiles.length} fichier{selectedFiles.length > 1 ? "s" : ""} a envoyer
          </Text>
        </View>
        <Text style={styles.filesCardSize}>Taille totale: {getTotalSize()}</Text>
      </View>

      <View style={styles.infoCard}>
        <Feather name="info" size={20} color="#2563EB" />
        <View style={styles.infoContent}>
          <Text style={styles.infoTitle}>Mode: {getMethodDescription()}</Text>
          <Text style={styles.infoText}>
            {transferMethod === "wifidirect" && "Wi-Fi Direct - Sans limite de taille"}
            {transferMethod === "multipeer" && "Multipeer Connectivity (iOS)"}
            {transferMethod === "hotspot" && "Hotspot (tous appareils)"}
          </Text>
        </View>
      </View>

      <View style={styles.mainContent}>
        {isAdvertising && qrMatrix ? (
          <View style={styles.activeContainer}>
            {renderQRCode()}

            <View style={styles.statusCard}>
              <View style={styles.statusIndicator}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>En attente du receveur</Text>
              </View>
            </View>

            <View style={styles.deviceNameCard}>
              <Feather name="smartphone" size={20} color="#2563EB" />
              <Text style={styles.deviceNameText}>{deviceName}</Text>
            </View>

            <View style={styles.instructionsContainer}>
              <Text style={styles.instructionsTitle}>Instructions pour le receveur:</Text>
              <View style={styles.instructionItem}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>1</Text>
                </View>
                <Text style={styles.instructionText}>
                  Ouvrez Sharel sur l'autre appareil
                </Text>
              </View>
              <View style={styles.instructionItem}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>2</Text>
                </View>
                <Text style={styles.instructionText}>
                  Appuyez sur "Recevoir"
                </Text>
              </View>
              <View style={styles.instructionItem}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>3</Text>
                </View>
                <Text style={styles.instructionText}>
                  Scannez ce QR code
                </Text>
              </View>
            </View>

            {peers.length > 0 ? (
              <View style={styles.peersContainer}>
                <Text style={styles.peersTitle}>Appareils connectes ({peers.filter(p => p.status === "connected").length})</Text>
                <FlatList
                  data={peers.filter(p => p.status === "connected" || p.status === "connecting")}
                  renderItem={renderPeer}
                  keyExtractor={(item) => item.peerId}
                  contentContainerStyle={styles.peersList}
                  scrollEnabled={false}
                />
              </View>
            ) : null}

            <Pressable 
              style={styles.retryButton} 
              onPress={retryAdvertising}
            >
              <Feather name="refresh-cw" size={16} color="#64748B" />
              <Text style={styles.retryButtonText}>Regenerer le QR code</Text>
            </Pressable>
          </View>
        ) : qrError ? (
          <View style={styles.errorContainer}>
            <View style={styles.errorIconContainer}>
              <Feather name="alert-circle" size={48} color="#EF4444" />
            </View>
            <Text style={styles.errorTitle}>Erreur</Text>
            <Text style={styles.errorText}>{qrError}</Text>
            <Pressable style={styles.retryErrorButton} onPress={retryAdvertising}>
              <Feather name="refresh-cw" size={16} color="#FFF" />
              <Text style={styles.retryErrorButtonText}>Reessayer</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.loadingText}>Chargement...</Text>
          </View>
        )}
      </View>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
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
    color: "#000",
  },
  placeholder: {
    width: 40,
  },
  filesCard: {
    margin: 16,
    marginBottom: 8,
    padding: 16,
    backgroundColor: "#FFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  filesCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  filesCardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  filesCardSize: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 4,
    marginLeft: 28,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    gap: 12,
  },
  infoContent: {
    flex: 1,
    gap: 4,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E40AF",
  },
  infoText: {
    fontSize: 13,
    color: "#3B82F6",
    lineHeight: 18,
  },
  mainContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  loadingContainer: {
    alignItems: "center",
    gap: 16,
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  loadingSubtext: {
    fontSize: 14,
    color: "#64748B",
  },
  activeContainer: {
    alignItems: "center",
    gap: 20,
    width: "100%",
    maxWidth: 400,
  },
  qrContainer: {
    alignItems: "center",
    gap: 12,
  },
  qrBackground: {
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#2563EB",
  },
  qrLabel: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "500",
    textAlign: "center",
  },
  statusCard: {
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  statusIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#F59E0B",
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#B45309",
  },
  deviceNameCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  deviceNameText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2563EB",
  },
  instructionsContainer: {
    width: "100%",
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginTop: 8,
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
    marginBottom: 4,
  },
  instructionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFF",
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: "#64748B",
    lineHeight: 20,
  },
  peersContainer: {
    width: "100%",
    marginTop: 8,
  },
  peersTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
    marginBottom: 12,
  },
  peersList: {
    gap: 8,
  },
  peerItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  peerItemConnected: {
    borderColor: "#10B981",
    backgroundColor: "#F0FDF4",
  },
  peerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
  },
  peerInfo: {
    flex: 1,
    gap: 2,
  },
  peerName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#000",
  },
  peerStatus: {
    fontSize: 13,
    color: "#64748B",
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 8,
    marginTop: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748B",
  },
  errorContainer: {
    alignItems: "center",
    gap: 16,
    paddingVertical: 40,
  },
  errorIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#000",
  },
  errorText: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
  },
  retryErrorButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 8,
    marginTop: 8,
  },
  retryErrorButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFF",
  },
});
