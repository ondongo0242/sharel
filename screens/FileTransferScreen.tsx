import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Text,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { HomeStackParamList } from "@/navigation/HomeStackNavigator";
import NearbyConnectionsService, { FileTransfer } from "@/services/NearbyConnectionsService";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { useTranslation } from "react-i18next";

type FileTransferScreenNavigationProp = NativeStackNavigationProp<
  HomeStackParamList,
  "FileTransfer"
>;
type FileTransferScreenRouteProp = RouteProp<HomeStackParamList, "FileTransfer">;

interface Props {
  navigation: FileTransferScreenNavigationProp;
  route: FileTransferScreenRouteProp;
}

interface SelectedFile {
  id: string;
  name: string;
  size: string;
  sizeBytes: number;
  uri?: string;
}

export default function FileTransferScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { peerId, peerName, selectedFiles } = route.params;
  const [transfers, setTransfers] = useState<FileTransfer[]>([]);
  const [isTransferring, setIsTransferring] = useState(false);

  useEffect(() => {
    NearbyConnectionsService.setOnTransfersChange((updatedTransfers) => {
      setTransfers(updatedTransfers);
    });

    NearbyConnectionsService.setOnDisconnected((disconnectedPeerId) => {
      if (disconnectedPeerId === peerId) {
        navigation.goBack();
      }
    });

    return () => {
    };
  }, [peerId]);

  const startTransfer = async () => {
    setIsTransferring(true);
    
    for (const file of selectedFiles) {
      try {
        await NearbyConnectionsService.sendFile(
          peerId,
          file.name,
          file.sizeBytes,
          file.uri || ""
        );
      } catch (error) {
        console.error("Error sending file:", error);
      }
    }
  };

  const renderFile = ({ item }: { item: SelectedFile }) => {
    const transfer = transfers.find((t) => t.fileName === item.name);
    
    return (
      <View style={styles.fileItem}>
        <View style={styles.fileIcon}>
          <Feather name="file" size={32} color="#2563EB" />
        </View>

        <View style={styles.fileInfo}>
          <Text style={styles.fileName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.fileSize}>{item.size}</Text>

          {transfer ? (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${transfer.progress}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {Math.round(transfer.progress)}%
              </Text>
            </View>
          ) : null}
        </View>

        {transfer ? (
          transfer.status === "completed" ? (
            <Feather name="check-circle" size={24} color="#10B981" />
          ) : transfer.status === "failed" ? (
            <Feather name="x-circle" size={24} color="#EF4444" />
          ) : (
            <ActivityIndicator size="small" color="#2563EB" />
          )
        ) : null}
      </View>
    );
  };

  const allCompleted = transfers.length === selectedFiles.length && 
    transfers.every((t) => t.status === "completed");
  const anyFailed = transfers.some((t) => t.status === "failed");

  return (
    <ScreenScrollView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#000" />
        </Pressable>
        <Text style={styles.headerTitle}>{t('transfer.fileTransfer')}</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.connectionInfo}>
        <View style={styles.connectionIcon}>
          <Feather name="smartphone" size={32} color="#10B981" />
          <View style={styles.connectedBadge}>
            <Feather name="check" size={12} color="#FFF" />
          </View>
        </View>
        <Text style={styles.connectionText}>{t('transfer.connectedTo', { name: peerName })}</Text>
      </View>

      <View style={styles.filesContainer}>
        <Text style={styles.filesTitle}>
          {t('transfer.filesToSend', { count: selectedFiles.length })}
        </Text>
        <FlatList
          data={selectedFiles}
          renderItem={renderFile}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.filesList}
        />
      </View>

      <View style={styles.footer}>
        {!isTransferring ? (
          <Pressable style={styles.sendButton} onPress={startTransfer}>
            <Feather name="send" size={20} color="#FFF" />
            <Text style={styles.sendButtonText}>{t('transfer.sendFiles')}</Text>
          </Pressable>
        ) : allCompleted ? (
          <View style={styles.successContainer}>
            <Feather name="check-circle" size={48} color="#10B981" />
            <Text style={styles.successText}>{t('transfer.transferComplete')}</Text>
            <Pressable
              style={styles.doneButton}
              onPress={() => navigation.navigate("Home")}
            >
              <Text style={styles.doneButtonText}>{t('common.finish')}</Text>
            </Pressable>
          </View>
        ) : anyFailed ? (
          <View style={styles.errorContainer}>
            <Feather name="x-circle" size={48} color="#EF4444" />
            <Text style={styles.errorText}>{t('transfer.someFilesFailed')}</Text>
            <Pressable style={styles.retryButton} onPress={startTransfer}>
              <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.transferringContainer}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.transferringText}>{t('transfer.sendingInProgress')}</Text>
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
  connectionInfo: {
    alignItems: "center",
    padding: 24,
    gap: 12,
  },
  connectionIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F0FDF4",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  connectedBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFF",
  },
  connectionText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  filesContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  filesTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
    marginBottom: 12,
  },
  filesList: {
    gap: 8,
  },
  fileItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  fileIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
  },
  fileInfo: {
    flex: 1,
    gap: 4,
  },
  fileName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
  },
  fileSize: {
    fontSize: 13,
    color: "#64748B",
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: "#E2E8F0",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#2563EB",
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2563EB",
    width: 40,
    textAlign: "right",
  },
  footer: {
    padding: 16,
    backgroundColor: "#FFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  sendButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFF",
  },
  transferringContainer: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 16,
  },
  transferringText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#64748B",
  },
  successContainer: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 16,
  },
  successText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#10B981",
  },
  doneButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#10B981",
    marginTop: 8,
  },
  doneButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFF",
  },
  errorContainer: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 16,
  },
  errorText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#EF4444",
  },
  retryButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#EF4444",
    marginTop: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFF",
  },
});
