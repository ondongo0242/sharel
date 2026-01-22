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
import { useOpenMedia } from "@/hooks/useOpenMedia";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type DocumentsGalleryScreenNavigationProp = NativeStackNavigationProp<
  HomeStackParamList,
  "DocumentsGallery"
>;

interface Props {
  navigation: DocumentsGalleryScreenNavigationProp;
}

interface DocumentItem {
  id: string;
  name: string;
  size: number;
  uri: string;
  modificationTime: number;
  type: string;
}

interface DocumentFolder {
  id: string;
  name: string;
  documentCount: number;
}

type TabType = "all" | "folders" | "received";

const DOCUMENT_EXTENSIONS = [".pdf", ".doc", ".docx", ".txt", ".xls", ".xlsx", ".ppt", ".pptx", ".odt", ".rtf"];

export default function DocumentsGalleryScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { open } = useOpenMedia();
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [folders, setFolders] = useState<DocumentFolder[]>([]);
  const [receivedDocuments, setReceivedDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);

  const getDocumentIcon = (filename: string): keyof typeof Feather.glyphMap => {
    const ext = filename.toLowerCase().split(".").pop();
    switch (ext) {
      case "pdf":
        return "file-text";
      case "doc":
      case "docx":
      case "odt":
      case "rtf":
        return "file-text";
      case "xls":
      case "xlsx":
        return "grid";
      case "ppt":
      case "pptx":
        return "monitor";
      case "txt":
        return "file";
      default:
        return "file-text";
    }
  };

  const getDocumentColor = (filename: string): string => {
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
      case "ppt":
      case "pptx":
        return "#F97316";
      default:
        return "#FBBF24";
    }
  };

  const loadDocuments = useCallback(async () => {
    if (Platform.OS === "web") {
      const mockDocuments: DocumentItem[] = [
        { id: 'doc-1', name: 'Rapport Annuel 2024.pdf', size: 2097152, uri: '', modificationTime: Date.now() - 86400000, type: 'pdf' },
        { id: 'doc-2', name: 'Presentation Projet.docx', size: 1048576, uri: '', modificationTime: Date.now() - 172800000, type: 'docx' },
        { id: 'doc-3', name: 'Notes Reunion.txt', size: 4096, uri: '', modificationTime: Date.now() - 259200000, type: 'txt' },
        { id: 'doc-4', name: 'Budget 2024.xlsx', size: 524288, uri: '', modificationTime: Date.now() - 345600000, type: 'xlsx' },
        { id: 'doc-5', name: 'Contract.pdf', size: 3145728, uri: '', modificationTime: Date.now() - 432000000, type: 'pdf' },
      ];
      setDocuments(mockDocuments);
      setFolders([
        { id: 'folder-1', name: 'PDF', documentCount: 2 },
        { id: 'folder-2', name: 'Word', documentCount: 1 },
        { id: 'folder-3', name: 'Excel', documentCount: 1 },
        { id: 'folder-4', name: 'Textes', documentCount: 1 },
      ]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const downloadDir = "/storage/emulated/0/Download/";
      const sharelDir = "/storage/emulated/0/Sharel/";

      const allDocuments: DocumentItem[] = [];

      const downloadDirInfo = await FileSystem.getInfoAsync(downloadDir);
      if (downloadDirInfo.exists) {
        const files = await FileSystem.readDirectoryAsync(downloadDir);
        const docFiles = files.filter((file) =>
          DOCUMENT_EXTENSIONS.some((ext) => file.toLowerCase().endsWith(ext))
        );

        for (let i = 0; i < docFiles.length; i++) {
          const file = docFiles[i];
          const fileInfo = await FileSystem.getInfoAsync(downloadDir + file);
          allDocuments.push({
            id: `doc-${i}`,
            name: file,
            size: (fileInfo as any).size || 0,
            uri: downloadDir + file,
            modificationTime: (fileInfo as any).modificationTime || Date.now(),
            type: file.split(".").pop() || "unknown",
          });
        }
      }

      setDocuments(allDocuments);

      const sharelDirInfo = await FileSystem.getInfoAsync(sharelDir);
      if (sharelDirInfo.exists) {
        const files = await FileSystem.readDirectoryAsync(sharelDir);
        const docFiles = files.filter((file) =>
          DOCUMENT_EXTENSIONS.some((ext) => file.toLowerCase().endsWith(ext))
        );

        const receivedDocs: DocumentItem[] = [];
        for (let i = 0; i < docFiles.length; i++) {
          const file = docFiles[i];
          const fileInfo = await FileSystem.getInfoAsync(sharelDir + file);
          receivedDocs.push({
            id: `received-${i}`,
            name: file,
            size: (fileInfo as any).size || 0,
            uri: sharelDir + file,
            modificationTime: (fileInfo as any).modificationTime || Date.now(),
            type: file.split(".").pop() || "unknown",
          });
        }
        setReceivedDocuments(receivedDocs);
      }

      setFolders([
        { id: "1", name: "Téléchargements", documentCount: allDocuments.length },
        { id: "2", name: "Sharel", documentCount: receivedDocuments.length },
      ]);
    } catch (error) {
      console.error("Error loading documents:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDocuments();
    }, [loadDocuments])
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

  const handleDocumentPress = useCallback((doc: DocumentItem) => {
    open({
      uri: doc.uri,
      name: doc.name,
      size: doc.size,
    });
  }, [open]);

  const renderDocumentItem = ({ item }: { item: DocumentItem }) => (
    <Pressable style={styles.documentItem} onPress={() => handleDocumentPress(item)}>
      <View style={[styles.documentIconContainer, { backgroundColor: `${getDocumentColor(item.name)}20` }]}>
        <Feather name={getDocumentIcon(item.name)} size={24} color={getDocumentColor(item.name)} />
      </View>
      <View style={styles.documentInfo}>
        <Text style={styles.documentName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.documentMeta}>
          {formatSize(item.size)} - {formatDate(item.modificationTime)}
        </Text>
      </View>
      <Pressable style={styles.documentMoreButton}>
        <Feather name="more-vertical" size={20} color="#94A3B8" />
      </Pressable>
    </Pressable>
  );

  const renderFolderItem = ({ item }: { item: DocumentFolder }) => (
    <Pressable style={styles.folderItem}>
      <View style={styles.folderIconContainer}>
        <Feather name="folder" size={24} color="#FBBF24" />
      </View>
      <View style={styles.folderInfo}>
        <Text style={styles.folderName}>{item.name}</Text>
        <Text style={styles.folderCount}>
          {item.documentCount} {item.documentCount === 1 ? "document" : "documents"}
        </Text>
      </View>
      <Feather name="chevron-right" size={20} color="#94A3B8" />
    </Pressable>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIllustration}>
        <View style={[styles.emptyCard, { backgroundColor: "#FEF3C7" }]}>
          <View style={styles.emptyCardLines}>
            <View style={[styles.emptyLine, { backgroundColor: "#FDE68A" }]} />
            <View style={[styles.emptyLine, styles.emptyLineShort, { backgroundColor: "#FDE68A" }]} />
            <View style={[styles.emptyLine, styles.emptyLineMedium, { backgroundColor: "#FDE68A" }]} />
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
      <Text style={styles.emptyText}>Pas de document</Text>
    </View>
  );

  const renderAllTab = () => {
    if (documents.length === 0) {
      return renderEmptyState();
    }

    return (
      <FlatList
        data={documents}
        renderItem={renderDocumentItem}
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
    if (receivedDocuments.length === 0) {
      return renderEmptyState();
    }

    return (
      <FlatList
        data={receivedDocuments}
        renderItem={renderDocumentItem}
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
        <Text style={styles.headerTitle}>Documents</Text>
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
            <ActivityIndicator size="large" color="#FBBF24" />
            <Text style={styles.loadingText}>Chargement des documents...</Text>
          </View>
        ) : (
          <>
            {activeTab === "all" && renderAllTab()}
            {activeTab === "folders" && renderFoldersTab()}
            {activeTab === "received" && renderReceivedTab()}
          </>
        )}
      </View>

      <Pressable style={[styles.fab, { bottom: insets.bottom + 90, backgroundColor: "#FBBF24" }]}>
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
  documentItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  documentIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0F172A",
    marginBottom: 2,
  },
  documentMeta: {
    fontSize: 13,
    color: "#64748B",
  },
  documentMoreButton: {
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
    backgroundColor: "#FEF3C7",
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
