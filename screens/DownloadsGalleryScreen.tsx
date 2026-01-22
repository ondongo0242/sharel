import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Text,
  FlatList,
  Platform,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HomeStackParamList } from "@/navigation/HomeStackNavigator";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as FileSystem from "expo-file-system";
import { useFocusEffect } from "@react-navigation/native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type DownloadsGalleryScreenNavigationProp = NativeStackNavigationProp<
  HomeStackParamList,
  "DownloadsGallery"
>;

interface Props {
  navigation: DownloadsGalleryScreenNavigationProp;
}

interface DownloadItem {
  id: string;
  name: string;
  size: number;
  uri: string;
  modificationTime: number;
  type: string;
}

interface DownloadFolder {
  id: string;
  name: string;
  fileCount: number;
}

type TabType = "all" | "folders" | "received";

export default function DownloadsGalleryScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [folders, setFolders] = useState<DownloadFolder[]>([]);
  const [receivedDownloads, setReceivedDownloads] = useState<DownloadItem[]>([]);
  const [loading, setLoading] = useState(true);

  const getFileIcon = (filename: string): keyof typeof Feather.glyphMap => {
    const ext = filename.toLowerCase().split(".").pop();
    switch (ext) {
      case "pdf":
        return "file-text";
      case "doc":
      case "docx":
        return "file-text";
      case "xls":
      case "xlsx":
        return "grid";
      case "ppt":
      case "pptx":
        return "monitor";
      case "jpg":
      case "jpeg":
      case "png":
      case "gif":
        return "image";
      case "mp4":
      case "avi":
      case "mkv":
        return "video";
      case "mp3":
      case "wav":
      case "flac":
        return "music";
      case "zip":
      case "rar":
      case "7z":
        return "archive";
      case "apk":
        return "package";
      default:
        return "file";
    }
  };

  const getFileColor = (filename: string): string => {
    const ext = filename.toLowerCase().split(".").pop();
    switch (ext) {
      case "pdf":
        return "#EF4444";
      case "doc":
      case "docx":
        return "#3B82F6";
      case "xls":
      case "xlsx":
        return "#22C55E";
      case "jpg":
      case "jpeg":
      case "png":
      case "gif":
        return "#4ADE80";
      case "mp4":
      case "avi":
      case "mkv":
        return "#A78BFA";
      case "mp3":
      case "wav":
        return "#FB7185";
      case "zip":
      case "rar":
        return "#60A5FA";
      case "apk":
        return "#60A5FA";
      default:
        return "#818CF8";
    }
  };

  const loadDownloads = useCallback(async () => {
    if (Platform.OS === "web") {
      const mockDownloads: DownloadItem[] = [
        { id: 'dl-1', name: 'vacation_photo.jpg', size: 2457600, uri: '', modificationTime: Date.now() - 86400000, type: 'jpg' },
        { id: 'dl-2', name: 'music_mix.mp3', size: 8388608, uri: '', modificationTime: Date.now() - 172800000, type: 'mp3' },
        { id: 'dl-3', name: 'video_clip.mp4', size: 52428800, uri: '', modificationTime: Date.now() - 259200000, type: 'mp4' },
        { id: 'dl-4', name: 'app_installer.apk', size: 31457280, uri: '', modificationTime: Date.now() - 345600000, type: 'apk' },
        { id: 'dl-5', name: 'archive_backup.zip', size: 104857600, uri: '', modificationTime: Date.now() - 432000000, type: 'zip' },
      ];
      setDownloads(mockDownloads);
      setFolders([
        { id: 'folder-1', name: 'Images', fileCount: 1 },
        { id: 'folder-2', name: 'Audio', fileCount: 1 },
        { id: 'folder-3', name: 'Videos', fileCount: 1 },
        { id: 'folder-4', name: 'Apps', fileCount: 1 },
        { id: 'folder-5', name: 'Archives', fileCount: 1 },
      ]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const downloadDir = "/storage/emulated/0/Download/";
      const sharelDir = "/storage/emulated/0/Sharel/";

      const allDownloads: DownloadItem[] = [];

      const downloadDirInfo = await FileSystem.getInfoAsync(downloadDir);
      if (downloadDirInfo.exists) {
        const files = await FileSystem.readDirectoryAsync(downloadDir);

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const fileInfo = await FileSystem.getInfoAsync(downloadDir + file);
          allDownloads.push({
            id: `download-${i}`,
            name: file,
            size: (fileInfo as any).size || 0,
            uri: downloadDir + file,
            modificationTime: (fileInfo as any).modificationTime || Date.now(),
            type: file.split(".").pop() || "unknown",
          });
        }
      }

      setDownloads(allDownloads);

      const sharelDirInfo = await FileSystem.getInfoAsync(sharelDir);
      if (sharelDirInfo.exists) {
        const files = await FileSystem.readDirectoryAsync(sharelDir);

        const receivedFiles: DownloadItem[] = [];
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const fileInfo = await FileSystem.getInfoAsync(sharelDir + file);
          receivedFiles.push({
            id: `received-${i}`,
            name: file,
            size: (fileInfo as any).size || 0,
            uri: sharelDir + file,
            modificationTime: (fileInfo as any).modificationTime || Date.now(),
            type: file.split(".").pop() || "unknown",
          });
        }
        setReceivedDownloads(receivedFiles);
      }

      setFolders([
        { id: "1", name: "Téléchargements", fileCount: allDownloads.length },
        { id: "2", name: "Sharel", fileCount: receivedDownloads.length },
      ]);
    } catch (error) {
      console.error("Error loading downloads:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDownloads();
    }, [loadDownloads])
  );

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const renderDownloadItem = ({ item }: { item: DownloadItem }) => (
    <Pressable style={styles.downloadItem}>
      <View style={[styles.downloadIconContainer, { backgroundColor: `${getFileColor(item.name)}20` }]}>
        <Feather name={getFileIcon(item.name)} size={24} color={getFileColor(item.name)} />
      </View>
      <View style={styles.downloadInfo}>
        <Text style={styles.downloadName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.downloadMeta}>
          {formatSize(item.size)} - {formatDate(item.modificationTime)}
        </Text>
      </View>
      <Pressable style={styles.downloadMoreButton}>
        <Feather name="more-vertical" size={20} color="#94A3B8" />
      </Pressable>
    </Pressable>
  );

  const renderFolderItem = ({ item }: { item: DownloadFolder }) => (
    <Pressable style={styles.folderItem}>
      <View style={styles.folderIconContainer}>
        <Feather name="folder" size={24} color="#818CF8" />
      </View>
      <View style={styles.folderInfo}>
        <Text style={styles.folderName}>{item.name}</Text>
        <Text style={styles.folderCount}>
          {item.fileCount} {item.fileCount === 1 ? "fichier" : "fichiers"}
        </Text>
      </View>
      <Feather name="chevron-right" size={20} color="#94A3B8" />
    </Pressable>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIllustration}>
        <View style={[styles.emptyCard, { backgroundColor: "#EDE9FE" }]}>
          <View style={styles.emptyCardLines}>
            <View style={[styles.emptyLine, { backgroundColor: "#C4B5FD" }]} />
            <View style={[styles.emptyLine, styles.emptyLineShort, { backgroundColor: "#C4B5FD" }]} />
            <View style={[styles.emptyLine, styles.emptyLineMedium, { backgroundColor: "#C4B5FD" }]} />
          </View>
        </View>
        <View style={styles.emptyPerson}>
          <View style={styles.emptyPersonHead} />
          <View style={styles.emptyPersonBody} />
          <View style={styles.emptyBubble}>
            <Feather name="alert-circle" size={12} color="#64748B" />
          </View>
        </View>
      </View>
      <Text style={styles.emptyText}>Pas de téléchargement</Text>
    </View>
  );

  const renderAllTab = () => {
    if (downloads.length === 0) {
      return renderEmptyState();
    }

    return (
      <FlatList
        data={downloads}
        renderItem={renderDownloadItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  const renderFoldersTab = () => {
    return (
      <FlatList
        data={folders}
        renderItem={renderFolderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyState}
      />
    );
  };

  const renderReceivedTab = () => {
    if (receivedDownloads.length === 0) {
      return renderEmptyState();
    }

    return (
      <FlatList
        data={receivedDownloads}
        renderItem={renderDownloadItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color="#0F172A" />
        </Pressable>
        <Text style={styles.headerTitle}>Téléchargements</Text>
        <View style={styles.headerIcons}>
          <Pressable style={styles.headerIcon}>
            <Feather name="search" size={22} color="#0F172A" />
          </Pressable>
          <Pressable style={styles.headerIcon}>
            <Feather name="edit" size={22} color="#0F172A" />
          </Pressable>
        </View>
      </View>

      <View style={styles.tabsContainer}>
        <Pressable
          style={[styles.tab, activeTab === "all" && styles.tabActive]}
          onPress={() => setActiveTab("all")}
        >
          <Text style={[styles.tabText, activeTab === "all" && styles.tabTextActive]}>
            TOUT
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === "folders" && styles.tabActive]}
          onPress={() => setActiveTab("folders")}
        >
          <Text style={[styles.tabText, activeTab === "folders" && styles.tabTextActive]}>
            DOSSIERS
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === "received" && styles.tabActive]}
          onPress={() => setActiveTab("received")}
        >
          <Text style={[styles.tabText, activeTab === "received" && styles.tabTextActive]}>
            REÇU
          </Text>
        </Pressable>
      </View>

      <View style={[styles.content, { paddingBottom: insets.bottom + 80 }]}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#818CF8" />
            <Text style={styles.loadingText}>Chargement des téléchargements...</Text>
          </View>
        ) : (
          <>
            {activeTab === "all" && renderAllTab()}
            {activeTab === "folders" && renderFoldersTab()}
            {activeTab === "received" && renderReceivedTab()}
          </>
        )}
      </View>

      <Pressable style={[styles.fab, { bottom: insets.bottom + 90, backgroundColor: "#818CF8" }]}>
        <Feather name="download" size={24} color="#FFF" />
      </Pressable>
    </View>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "600",
    color: "#0F172A",
  },
  headerIcons: {
    flexDirection: "row",
    gap: 4,
  },
  headerIcon: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  tabsContainer: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: "#0F172A",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#94A3B8",
    letterSpacing: 0.5,
  },
  tabTextActive: {
    color: "#0F172A",
    fontWeight: "600",
  },
  adBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 12,
  },
  adIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  adContent: {
    flex: 1,
  },
  adTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
    marginBottom: 2,
  },
  adLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  adLabelText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748B",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  adSubtitle: {
    fontSize: 12,
    color: "#64748B",
  },
  adButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  adButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: "#64748B",
  },
  downloadItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  downloadIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  downloadInfo: {
    flex: 1,
  },
  downloadName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0F172A",
    marginBottom: 2,
  },
  downloadMeta: {
    fontSize: 13,
    color: "#64748B",
  },
  downloadMoreButton: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  folderItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  folderIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#EDE9FE",
    justifyContent: "center",
    alignItems: "center",
  },
  folderInfo: {
    flex: 1,
  },
  folderName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0F172A",
    marginBottom: 2,
  },
  folderCount: {
    fontSize: 13,
    color: "#64748B",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyIllustration: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 24,
    gap: -20,
  },
  emptyCard: {
    width: 100,
    height: 140,
    borderRadius: 12,
    padding: 16,
    justifyContent: "flex-end",
    zIndex: 1,
  },
  emptyCardLines: {
    gap: 8,
  },
  emptyLine: {
    height: 8,
    borderRadius: 4,
  },
  emptyLineShort: {
    width: "60%",
  },
  emptyLineMedium: {
    width: "80%",
  },
  emptyPerson: {
    alignItems: "center",
    zIndex: 2,
  },
  emptyPersonHead: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FBBF24",
    marginBottom: -4,
  },
  emptyPersonBody: {
    width: 50,
    height: 60,
    backgroundColor: "#FBBF24",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  emptyBubble: {
    position: "absolute",
    top: -10,
    right: -20,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  emptyText: {
    fontSize: 16,
    color: "#64748B",
    textAlign: "center",
  },
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
});
