import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Text,
  Platform,
  FlatList,
  Animated,
  Dimensions,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { HomeStackParamList } from "@/navigation/HomeStackNavigator";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Device from "expo-device";
import UnifiedTransferService, { FileTransfer, TransferMethod } from "@/services/UnifiedTransferService";
import { useTranslation } from "react-i18next";

type TransferRoomScreenNavigationProp = NativeStackNavigationProp<HomeStackParamList, "TransferRoom">;
type TransferRoomScreenRouteProp = RouteProp<HomeStackParamList, "TransferRoom">;

interface Props {
  navigation: TransferRoomScreenNavigationProp;
  route: TransferRoomScreenRouteProp;
}

interface FileTransferItem {
  id: string;
  name: string;
  size: string;
  sizeBytes: number;
  progress: number;
  status: "pending" | "transferring" | "completed" | "paused" | "failed";
  uri?: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const getFileIcon = (fileName: string): keyof typeof Feather.glyphMap => {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  
  if (["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(ext)) {
    return "image";
  }
  if (["mp4", "mov", "avi", "mkv", "webm", "flv"].includes(ext)) {
    return "video";
  }
  if (["mp3", "wav", "ogg", "flac", "aac", "m4a"].includes(ext)) {
    return "music";
  }
  if (["pdf"].includes(ext)) {
    return "file-text";
  }
  if (["doc", "docx", "txt", "rtf"].includes(ext)) {
    return "file-text";
  }
  if (["xls", "xlsx", "csv"].includes(ext)) {
    return "grid";
  }
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) {
    return "archive";
  }
  if (["apk"].includes(ext)) {
    return "package";
  }
  
  return "file";
};

const getFileIconColor = (fileName: string): string => {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  
  if (["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(ext)) {
    return "#EC4899";
  }
  if (["mp4", "mov", "avi", "mkv", "webm", "flv"].includes(ext)) {
    return "#8B5CF6";
  }
  if (["mp3", "wav", "ogg", "flac", "aac", "m4a"].includes(ext)) {
    return "#F59E0B";
  }
  if (["pdf"].includes(ext)) {
    return "#EF4444";
  }
  if (["doc", "docx", "txt", "rtf"].includes(ext)) {
    return "#3B82F6";
  }
  if (["xls", "xlsx", "csv"].includes(ext)) {
    return "#10B981";
  }
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) {
    return "#6366F1";
  }
  if (["apk"].includes(ext)) {
    return "#22C55E";
  }
  
  return "#64748B";
};

export default function TransferRoomScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { selectedFiles, peerName, peerId, isHost } = route.params;
  const insets = useSafeAreaInsets();
  const [files, setFiles] = useState<FileTransferItem[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  const [transferSpeed, setTransferSpeed] = useState("0 MB/s");
  const [transferredSize, setTransferredSize] = useState("0 MB");
  const [totalSize, setTotalSize] = useState("0 MB");
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const isPausedRef = useRef(false);
  const isTransferringRef = useRef(false);
  const transferStartTimeRef = useRef(Date.now());
  
  const progressAnimation = useRef(new Animated.Value(0)).current;
  const pulseAnimation = useRef(new Animated.Value(1)).current;
  
  const localDeviceName = Device.modelName || Device.modelId || t("common.myDevice");
  const lightTheme = Colors.light;

  useEffect(() => {
    const isHotspotMode = peerId.startsWith("hotspot_");
    if (isHotspotMode) {
      UnifiedTransferService.setCurrentMethod("hotspot");
      console.log("[TransferRoom] Hotspot mode detected, setting transfer method to hotspot");
    }
    
    if (isHost && selectedFiles.length > 0) {
      const initialFiles: FileTransferItem[] = selectedFiles.map((file) => ({
        ...file,
        progress: 0,
        status: "pending" as const,
      }));
      setFiles(initialFiles);
      
      const total = selectedFiles.reduce((acc, file) => acc + file.sizeBytes, 0);
      setTotalSize(formatBytes(total));
    }
    
    UnifiedTransferService.setOnTransfersChange((transfers: FileTransfer[]) => {
      updateTransferProgress(transfers);
    });
    
    UnifiedTransferService.setOnDisconnected((disconnectedPeerId: string) => {
      if (disconnectedPeerId === peerId) {
        Alert.alert(
          t("discover.disconnected"),
          t("discover.unableToConnect"),
          [{ text: "OK", onPress: () => navigation.navigate("Home") }]
        );
      }
    });
    
    if (isHost && selectedFiles.length > 0) {
      startRealTransfer();
    }
    
    startPulseAnimation();
    
    return () => {
      UnifiedTransferService.setOnTransfersChange(() => {});
    };
  }, []);

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnimation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const updateTransferProgress = (transfers: FileTransfer[]) => {
    if (transfers.length === 0 && !isHost) {
      return;
    }
    
    if (isHost) {
      setFiles((prevFiles) => {
        return prevFiles.map((file) => {
          const transfer = transfers.find((t) => t.id === file.id || t.fileName === file.name);
          if (transfer) {
            return {
              ...file,
              progress: transfer.progress,
              status: transfer.status as FileTransferItem["status"],
            };
          }
          return file;
        });
      });
    } else {
      const newFiles: FileTransferItem[] = transfers.map((transfer) => ({
        id: transfer.id,
        name: transfer.fileName,
        size: formatBytes(transfer.fileSize),
        sizeBytes: transfer.fileSize,
        progress: transfer.progress,
        status: transfer.status as FileTransferItem["status"],
      }));
      setFiles(newFiles);
    }
    
    let totalBytes = 0;
    let completedBytes = 0;
    
    if (isHost) {
      totalBytes = selectedFiles.reduce((acc, file) => acc + file.sizeBytes, 0);
      transfers.forEach((transfer) => {
        const file = selectedFiles.find((f) => f.name === transfer.fileName);
        if (file) {
          completedBytes += (file.sizeBytes * transfer.progress) / 100;
        }
      });
    } else {
      transfers.forEach((transfer) => {
        totalBytes += transfer.fileSize;
        completedBytes += (transfer.fileSize * transfer.progress) / 100;
      });
    }
    
    const currentProgress = totalBytes > 0 ? (completedBytes / totalBytes) * 100 : 0;
    setOverallProgress(Math.min(currentProgress, 100));
    setTransferredSize(formatBytes(completedBytes));
    setTotalSize(formatBytes(totalBytes));
    
    const inProgressTransfer = transfers.find((t) => t.status === "transferring");
    
    if (inProgressTransfer) {
      const elapsed = Date.now() - transferStartTimeRef.current;
      if (elapsed > 0 && completedBytes > 0) {
        const speed = (completedBytes / elapsed) * 1000;
        setTransferSpeed(formatBytes(speed) + "/s");
      }
    }
    
    const completedTransfers = transfers.filter((t) => t.status === "completed").length;
    const totalExpected = isHost ? selectedFiles.length : transfers.length;
    if (completedTransfers === totalExpected && totalExpected > 0) {
      setOverallProgress(100);
    }
    
    Animated.timing(progressAnimation, {
      toValue: currentProgress / 100,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const startRealTransfer = async () => {
    if (isTransferringRef.current) {
      return;
    }
    isTransferringRef.current = true;
    transferStartTimeRef.current = Date.now();
    
    let successCount = 0;
    let failCount = 0;
    
    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        if (isPausedRef.current) {
          await new Promise<void>((resolve) => {
            const checkPause = () => {
              if (!isPausedRef.current) {
                resolve();
              } else {
                setTimeout(checkPause, 100);
              }
            };
            checkPause();
          });
        }
        
        const file = selectedFiles[i];
        setCurrentFileIndex(i);
        
        setFiles((prevFiles) => {
          const newFiles = [...prevFiles];
          if (newFiles[i]) {
            newFiles[i] = {
              ...newFiles[i],
              status: "transferring",
            };
          }
          return newFiles;
        });
        
        try {
          await UnifiedTransferService.sendFile(
            peerId,
            file.name,
            file.sizeBytes,
            file.uri || ""
          );
          
          successCount++;
          setFiles((prevFiles) => {
            const newFiles = [...prevFiles];
            if (newFiles[i]) {
              newFiles[i] = {
                ...newFiles[i],
                status: "completed",
                progress: 100,
              };
            }
            return newFiles;
          });
        } catch (error) {
          console.error("Error sending file:", error);
          failCount++;
          setFiles((prevFiles) => {
            const newFiles = [...prevFiles];
            if (newFiles[i]) {
              newFiles[i] = {
                ...newFiles[i],
                status: "failed",
              };
            }
            return newFiles;
          });
          
          Alert.alert(
            "Erreur de transfert",
            `Impossible d'envoyer ${file.name}: ${error instanceof Error ? error.message : "Erreur inconnue"}`,
            [{ text: "OK" }]
          );
        }
      }
      
      if (successCount === selectedFiles.length) {
        setOverallProgress(100);
      } else if (failCount > 0 && successCount > 0) {
        Alert.alert(
          "Transfert partiel",
          `${successCount} fichier(s) envoye(s), ${failCount} echoue(s).`,
          [{ text: "OK" }]
        );
      }
    } finally {
      isTransferringRef.current = false;
    }
  };

  const handlePauseResume = () => {
    const newPaused = !isPaused;
    setIsPaused(newPaused);
    isPausedRef.current = newPaused;
    
    if (!newPaused) {
      setFiles((prevFiles) =>
        prevFiles.map((file) =>
          file.status === "paused" ? { ...file, status: "transferring" } : file
        )
      );
    } else {
      setFiles((prevFiles) =>
        prevFiles.map((file) =>
          file.status === "transferring" ? { ...file, status: "paused" } : file
        )
      );
    }
  };

  const handleCancel = () => {
    navigation.navigate("Home");
  };

  const completedCount = files.filter((f) => f.status === "completed").length;
  const isComplete = completedCount === files.length && files.length > 0;

  const renderFileItem = ({ item, index }: { item: FileTransferItem; index: number }) => {
    const iconName = getFileIcon(item.name);
    const iconColor = getFileIconColor(item.name);
    
    return (
      <View style={[styles.fileItem, { backgroundColor: lightTheme.backgroundDefault }]}>
        <View style={[styles.fileIconContainer, { backgroundColor: `${iconColor}15` }]}>
          <Feather name={iconName} size={20} color={iconColor} />
        </View>
        
        <View style={styles.fileInfo}>
          <Text style={[styles.fileName, { color: lightTheme.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.fileMetaRow}>
            <Text style={[styles.fileSize, { color: lightTheme.textSecondary }]}>
              {item.size}
            </Text>
            {item.status === "transferring" && (
              <Text style={[styles.fileProgress, { color: lightTheme.primary }]}>
                {Math.round(item.progress)}%
              </Text>
            )}
          </View>
          
          {(item.status === "transferring" || item.status === "paused") && (
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBar, { backgroundColor: lightTheme.backgroundTertiary }]}>
                <View
                  style={[
                    styles.progressFill,
                    { 
                      width: `${item.progress}%`,
                      backgroundColor: item.status === "paused" ? lightTheme.warning : lightTheme.primary,
                    },
                  ]}
                />
              </View>
            </View>
          )}
        </View>
        
        <View style={styles.fileStatusIcon}>
          {item.status === "completed" ? (
            <View style={[styles.statusBadge, { backgroundColor: `${lightTheme.success}15` }]}>
              <Feather name="check" size={16} color={lightTheme.success} />
            </View>
          ) : item.status === "transferring" ? (
            <Animated.View style={[styles.statusBadge, { backgroundColor: `${lightTheme.primary}15`, transform: [{ scale: pulseAnimation }] }]}>
              <Feather name="arrow-up" size={16} color={lightTheme.primary} />
            </Animated.View>
          ) : item.status === "paused" ? (
            <View style={[styles.statusBadge, { backgroundColor: `${lightTheme.warning}15` }]}>
              <Feather name="pause" size={16} color={lightTheme.warning} />
            </View>
          ) : item.status === "failed" ? (
            <View style={[styles.statusBadge, { backgroundColor: `${lightTheme.error}15` }]}>
              <Feather name="x" size={16} color={lightTheme.error} />
            </View>
          ) : (
            <View style={[styles.statusBadge, { backgroundColor: lightTheme.backgroundTertiary }]}>
              <Feather name="clock" size={16} color={lightTheme.textSecondary} />
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: lightTheme.backgroundRoot }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable 
          onPress={handleCancel}
          style={({ pressed }) => [
            styles.backButton,
            { backgroundColor: pressed ? lightTheme.backgroundSecondary : "transparent" }
          ]}
        >
          <Feather name="x" size={24} color={lightTheme.text} />
        </Pressable>
        <Text style={[styles.title, { color: lightTheme.text }]}>Transfert</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.devicesContainer}>
        <View style={styles.deviceColumn}>
          <View style={[styles.deviceAvatar, { backgroundColor: isHost ? `${lightTheme.primary}15` : `${lightTheme.secondary}15` }]}>
            <Feather name="smartphone" size={28} color={isHost ? lightTheme.primary : lightTheme.secondary} />
          </View>
          <Text style={[styles.deviceName, { color: lightTheme.text }]} numberOfLines={1}>
            {isHost ? localDeviceName : peerName}
          </Text>
          <Text style={[styles.deviceRole, { color: lightTheme.textSecondary }]}>
            Expediteur
          </Text>
        </View>
        
        <View style={styles.transferIndicator}>
          <View style={[styles.transferLine, { backgroundColor: lightTheme.border }]} />
          <Animated.View 
            style={[
              styles.transferArrow,
              { 
                backgroundColor: isComplete ? lightTheme.success : lightTheme.primary,
                transform: [{ scale: pulseAnimation }]
              }
            ]}
          >
            <Feather 
              name={isComplete ? "check" : "arrow-right"} 
              size={16} 
              color="#FFFFFF" 
            />
          </Animated.View>
          <View style={[styles.transferLine, { backgroundColor: lightTheme.border }]} />
        </View>
        
        <View style={styles.deviceColumn}>
          <View style={[styles.deviceAvatar, { backgroundColor: isHost ? `${lightTheme.secondary}15` : `${lightTheme.primary}15` }]}>
            <Feather name="smartphone" size={28} color={isHost ? lightTheme.secondary : lightTheme.primary} />
          </View>
          <Text style={[styles.deviceName, { color: lightTheme.text }]} numberOfLines={1}>
            {isHost ? peerName : localDeviceName}
          </Text>
          <Text style={[styles.deviceRole, { color: lightTheme.textSecondary }]}>
            Receveur
          </Text>
        </View>
      </View>

      <View style={[styles.statsContainer, { backgroundColor: lightTheme.backgroundDefault }]}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: lightTheme.text }]}>
            {transferredSize}
          </Text>
          <Text style={[styles.statLabel, { color: lightTheme.textSecondary }]}>
            / {totalSize}
          </Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: lightTheme.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: lightTheme.primary }]}>
            {transferSpeed}
          </Text>
          <Text style={[styles.statLabel, { color: lightTheme.textSecondary }]}>
            Vitesse
          </Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: lightTheme.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: lightTheme.text }]}>
            {completedCount}/{files.length}
          </Text>
          <Text style={[styles.statLabel, { color: lightTheme.textSecondary }]}>
            Fichiers
          </Text>
        </View>
      </View>

      <View style={styles.overallProgressContainer}>
        <View style={styles.progressHeader}>
          <Text style={[styles.progressTitle, { color: lightTheme.text }]}>
            Progression globale
          </Text>
          <Text style={[styles.progressPercent, { color: lightTheme.primary }]}>
            {Math.round(overallProgress)}%
          </Text>
        </View>
        <View style={[styles.overallProgressBar, { backgroundColor: lightTheme.backgroundTertiary }]}>
          <Animated.View
            style={[
              styles.overallProgressFill,
              {
                backgroundColor: isComplete ? lightTheme.success : lightTheme.primary,
                width: progressAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0%", "100%"],
                }),
              },
            ]}
          />
        </View>
      </View>

      <View style={styles.filesSection}>
        <Text style={[styles.sectionTitle, { color: lightTheme.text }]}>
          {isHost ? "Fichiers a envoyer" : "Fichiers recus"} ({files.length})
        </Text>
        {!isHost && files.length === 0 ? (
          <View style={styles.waitingContainer}>
            <Animated.View style={{ transform: [{ scale: pulseAnimation }] }}>
              <Feather name="download-cloud" size={48} color={lightTheme.primary} />
            </Animated.View>
            <Text style={[styles.waitingTitle, { color: lightTheme.text }]}>
              En attente de fichiers...
            </Text>
            <Text style={[styles.waitingText, { color: lightTheme.textSecondary }]}>
              L'expediteur va bientot commencer le transfert
            </Text>
          </View>
        ) : (
          <FlatList
            data={files}
            renderItem={renderFileItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.filesList}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      <View style={[styles.footer, { backgroundColor: lightTheme.backgroundDefault, paddingBottom: insets.bottom + Spacing.lg }]}>
        {isComplete ? (
          <Pressable
            onPress={() => navigation.navigate("Home")}
            style={({ pressed }) => [
              styles.actionButton,
              { 
                backgroundColor: lightTheme.success,
                opacity: pressed ? 0.9 : 1 
              }
            ]}
          >
            <Feather name="check-circle" size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>
              {isHost ? "Envoi termine" : "Reception terminee"}
            </Text>
          </Pressable>
        ) : isHost ? (
          <View style={styles.actionButtons}>
            <Pressable
              onPress={handlePauseResume}
              style={({ pressed }) => [
                styles.controlButton,
                { 
                  backgroundColor: isPaused ? lightTheme.success : lightTheme.warning,
                  opacity: pressed ? 0.9 : 1 
                }
              ]}
            >
              <Feather 
                name={isPaused ? "play" : "pause"} 
                size={20} 
                color="#FFFFFF" 
              />
            </Pressable>
            
            <Pressable
              onPress={handleCancel}
              style={({ pressed }) => [
                styles.cancelButton,
                { 
                  backgroundColor: lightTheme.backgroundSecondary,
                  opacity: pressed ? 0.9 : 1 
                }
              ]}
            >
              <Text style={[styles.cancelButtonText, { color: lightTheme.error }]}>
                Annuler
              </Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={handleCancel}
            style={({ pressed }) => [
              styles.cancelButton,
              { 
                backgroundColor: lightTheme.backgroundSecondary,
                opacity: pressed ? 0.9 : 1,
                flex: 1,
              }
            ]}
          >
            <Text style={[styles.cancelButtonText, { color: lightTheme.error }]}>
              Annuler la reception
            </Text>
          </Pressable>
        )}
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
  devicesContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xl,
  },
  deviceColumn: {
    alignItems: "center",
    width: 100,
  },
  deviceAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  deviceName: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 2,
  },
  deviceRole: {
    fontSize: 12,
  },
  transferIndicator: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
  },
  transferLine: {
    flex: 1,
    height: 2,
  },
  transferArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  statsContainer: {
    flexDirection: "row",
    marginHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: "100%",
  },
  overallProgressContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: "700",
  },
  overallProgressBar: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  overallProgressFill: {
    height: "100%",
    borderRadius: 4,
  },
  filesSection: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  filesList: {
    gap: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  fileItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  fileIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  fileMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  fileSize: {
    fontSize: 12,
  },
  fileProgress: {
    fontSize: 12,
    fontWeight: "600",
  },
  progressBarContainer: {
    marginTop: 6,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  fileStatusIcon: {
    width: 32,
    alignItems: "center",
  },
  statusBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: BorderRadius.md,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  actionButtons: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  waitingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.xl,
  },
  waitingTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: Spacing.md,
  },
  waitingText: {
    fontSize: 14,
    textAlign: "center",
  },
});
