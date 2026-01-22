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

type ZipGalleryScreenNavigationProp = NativeStackNavigationProp<
  HomeStackParamList,
  "ZipGallery"
>;

interface Props {
  navigation: ZipGalleryScreenNavigationProp;
}

interface ZipItem {
  id: string;
  name: string;
  size: number;
  uri: string;
  modificationTime: number;
  type: string;
}

interface ZipFolder {
  id: string;
  name: string;
  fileCount: number;
}

type TabType = "all" | "folders" | "received";

const ZIP_EXTENSIONS = [".zip", ".rar", ".7z", ".tar", ".gz", ".tar.gz", ".bz2"];

export default function ZipGalleryScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [zipFiles, setZipFiles] = useState<ZipItem[]>([]);
  const [folders, setFolders] = useState<ZipFolder[]>([]);
  const [receivedZipFiles, setReceivedZipFiles] = useState<ZipItem[]>([]);
  const [loading, setLoading] = useState(true);

  const getZipIcon = (filename: string): keyof typeof Feather.glyphMap => {
    const ext = filename.toLowerCase().split(".").pop();
    switch (ext) {
      case "zip":
        return "archive";
      case "rar":
        return "archive";
      case "7z":
        return "archive";
      case "tar":
      case "gz":
        return "archive";
      default:
        return "archive";
    }
  };

  const loadZipFiles = useCallback(async () => {
    if (Platform.OS === "web") {
      const mockZipFiles: ZipItem[] = [
        { id: 'zip-1', name: 'photos_backup.zip', size: 157286400, uri: '', modificationTime: Date.now() - 86400000, type: 'zip' },
        { id: 'zip-2', name: 'project_files.rar', size: 52428800, uri: '', modificationTime: Date.now() - 172800000, type: 'rar' },
      ];
      setZipFiles(mockZipFiles);
      setFolders([
        { id: 'folder-1', name: 'Backups', fileCount: 1 },
        { id: 'folder-2', name: 'Projects', fileCount: 1 },
      ]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const documentDir = FileSystem.documentDirectory || "";
      const downloadDir = documentDir + "downloads/";
      const sharelDir = documentDir + "Sharel/";

      const allZipFiles: ZipItem[] = [];

      const downloadDirInfo = await FileSystem.getInfoAsync(downloadDir);
      if (downloadDirInfo.exists) {
        const files = await FileSystem.readDirectoryAsync(downloadDir);
        const zipFilesFound = files.filter((file) =>
          ZIP_EXTENSIONS.some((ext) => file.toLowerCase().endsWith(ext))
        );

        for (let i = 0; i < zipFilesFound.length; i++) {
          const file = zipFilesFound[i];
          const fileInfo = await FileSystem.getInfoAsync(downloadDir + file);
          allZipFiles.push({
            id: `zip-${i}`,
            name: file,
            size: (fileInfo as any).size || 0,
            uri: downloadDir + file,
            modificationTime: (fileInfo as any).modificationTime || Date.now(),
            type: file.split(".").pop() || "zip",
          });
        }
      }

      setZipFiles(allZipFiles);

      const sharelDirInfo = await FileSystem.getInfoAsync(sharelDir);
      if (sharelDirInfo.exists) {
        const files = await FileSystem.readDirectoryAsync(sharelDir);
        const zipFilesFound = files.filter((file) =>
          ZIP_EXTENSIONS.some((ext) => file.toLowerCase().endsWith(ext))
        );

        const receivedZips: ZipItem[] = [];
        for (let i = 0; i < zipFilesFound.length; i++) {
          const file = zipFilesFound[i];
          const fileInfo = await FileSystem.getInfoAsync(sharelDir + file);
          receivedZips.push({
            id: `received-${i}`,
            name: file,
            size: (fileInfo as any).size || 0,
            uri: sharelDir + file,
            modificationTime: (fileInfo as any).modificationTime || Date.now(),
            type: file.split(".").pop() || "zip",
          });
        }
        setReceivedZipFiles(receivedZips);
      }

      setFolders([
        { id: "1", name: "Téléchargements", fileCount: allZipFiles.length },
        { id: "2", name: "Sharel", fileCount: receivedZipFiles.length },
      ]);
    } catch (error) {
      console.error("Error loading zip files:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadZipFiles();
    }, [loadZipFiles])
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

  const renderZipItem = ({ item }: { item: ZipItem }) => (
    <Pressable style={styles.zipItem}>
      <View style={styles.zipIconContainer}>
        <Feather name={getZipIcon(item.name)} size={24} color="#60A5FA" />
      </View>
      <View style={styles.zipInfo}>
        <Text style={styles.zipName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.zipMeta}>
          {formatSize(item.size)} - {formatDate(item.modificationTime)}
        </Text>
      </View>
      <View style={styles.zipActions}>
        <Pressable style={styles.extractButton}>
          <Text style={styles.extractButtonText}>Extraire</Text>
        </Pressable>
        <Pressable style={styles.zipMoreButton}>
          <Feather name="more-vertical" size={20} color="#94A3B8" />
        </Pressable>
      </View>
    </Pressable>
  );

  const renderFolderItem = ({ item }: { item: ZipFolder }) => (
    <Pressable style={styles.folderItem}>
      <View style={styles.folderIconContainer}>
        <Feather name="folder" size={24} color="#60A5FA" />
      </View>
      <View style={styles.folderInfo}>
        <Text style={styles.folderName}>{item.name}</Text>
        <Text style={styles.folderCount}>
          {item.fileCount} {item.fileCount === 1 ? "archive" : "archives"}
        </Text>
      </View>
      <Feather name="chevron-right" size={20} color="#94A3B8" />
    </Pressable>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIllustration}>
        <View style={[styles.emptyCard, { backgroundColor: "#EFF6FF" }]}>
          <View style={styles.emptyCardLines}>
            <View style={[styles.emptyLine, { backgroundColor: "#BFDBFE" }]} />
            <View style={[styles.emptyLine, styles.emptyLineShort, { backgroundColor: "#BFDBFE" }]} />
            <View style={[styles.emptyLine, styles.emptyLineMedium, { backgroundColor: "#BFDBFE" }]} />
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
      <Text style={styles.emptyText}>Pas d'archive</Text>
    </View>
  );

  const renderAllTab = () => {
    if (zipFiles.length === 0) {
      return renderEmptyState();
    }

    return (
      <FlatList
        data={zipFiles}
        renderItem={renderZipItem}
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
    if (receivedZipFiles.length === 0) {
      return renderEmptyState();
    }

    return (
      <FlatList
        data={receivedZipFiles}
        renderItem={renderZipItem}
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
        <Text style={styles.headerTitle}>Archives Zip</Text>
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
            <ActivityIndicator size="large" color="#60A5FA" />
            <Text style={styles.loadingText}>Chargement des archives...</Text>
          </View>
        ) : (
          <>
            {activeTab === "all" && renderAllTab()}
            {activeTab === "folders" && renderFoldersTab()}
            {activeTab === "received" && renderReceivedTab()}
          </>
        )}
      </View>

      <Pressable style={[styles.fab, { bottom: insets.bottom + 90, backgroundColor: "#60A5FA" }]}>
        <Feather name="plus" size={24} color="#FFF" />
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
  zipItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  zipIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
  },
  zipInfo: {
    flex: 1,
  },
  zipName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0F172A",
    marginBottom: 2,
  },
  zipMeta: {
    fontSize: 13,
    color: "#64748B",
  },
  zipActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  extractButton: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  extractButtonText: {
    color: "#60A5FA",
    fontSize: 12,
    fontWeight: "600",
  },
  zipMoreButton: {
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
    backgroundColor: "#EFF6FF",
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
