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
import { useFocusEffect } from "@react-navigation/native";
import { MockupDataService } from "@/services/MockupDataService";
import { Image } from "expo-image";
import { nativeFileExplorer } from "@/services/NativeFileExplorer";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type AppsGalleryScreenNavigationProp = NativeStackNavigationProp<
  HomeStackParamList,
  "AppsGallery"
>;

interface Props {
  navigation: AppsGalleryScreenNavigationProp;
}

interface AppItem {
  id: string;
  name: string;
  size: number;
  uri: string;
  modificationTime: number;
  icon?: string;
  isNew?: boolean;
}

interface AppPack {
  id: string;
  name: string;
  appCount: number;
  icon: keyof typeof Feather.glyphMap;
}

type TabType = "received" | "packs" | "installed";

export default function AppsGalleryScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>("received");
  const [receivedApps, setReceivedApps] = useState<AppItem[]>([]);
  const [installedApps, setInstalledApps] = useState<AppItem[]>([]);
  const [loading, setLoading] = useState(true);

  const appPacks: AppPack[] = [
    { id: "1", name: "Réseaux sociaux", appCount: 0, icon: "users" },
    { id: "2", name: "Productivité", appCount: 0, icon: "briefcase" },
    { id: "3", name: "Jeux", appCount: 0, icon: "play" },
    { id: "4", name: "Utilitaires", appCount: 0, icon: "tool" },
  ];

  const loadApps = useCallback(async () => {
    try {
      setLoading(true);

      if (Platform.OS === "web") {
        const mockApps = MockupDataService.getApps('installed');
        const appItems: AppItem[] = mockApps.map((app) => ({
          id: app.id,
          name: app.name,
          size: app.size,
          uri: '',
          modificationTime: app.firstInstallTime,
          icon: app.icon,
          isNew: app.isNew,
        }));
        
        const newApps = appItems.filter(app => app.isNew);
        const installedAppsData = appItems.filter(app => !app.isNew);
        
        setReceivedApps(newApps);
        setInstalledApps(installedAppsData);
        setLoading(false);
        return;
      }

      const downloadDir = "/storage/emulated/0/Download/";
      const sharelDir = "/storage/emulated/0/Sharel/";

      try {
        const downloadFiles = await nativeFileExplorer.listFiles(downloadDir);
        const apkFiles = downloadFiles.filter((file) => file.name.endsWith(".apk"));

        const downloadedApps = apkFiles.map((file, index) => ({
          id: `download-${index}`,
          name: file.name.replace(".apk", ""),
          size: file.size || 0,
          uri: file.path,
          modificationTime: file.modificationTime || Date.now(),
        }));
        setInstalledApps(downloadedApps);
      } catch (e) {
        console.log("No downloads folder or no APKs");
      }

      try {
        const sharelFiles = await nativeFileExplorer.listFiles(sharelDir);
        const apkFiles = sharelFiles.filter((file) => file.name.endsWith(".apk"));

        const received = apkFiles.map((file, index) => ({
          id: `received-${index}`,
          name: file.name.replace(".apk", ""),
          size: file.size || 0,
          uri: file.path,
          modificationTime: file.modificationTime || Date.now(),
        }));
        setReceivedApps(received);
      } catch (e) {
        console.log("No Sharel folder or no APKs");
      }
    } catch (error) {
      console.error("Error loading apps:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadApps();
    }, [loadApps])
  );

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const renderAppItem = ({ item }: { item: AppItem }) => (
    <Pressable style={styles.appItem}>
      <View style={styles.appIconContainer}>
        {item.icon ? (
          <Image 
            source={{ uri: item.icon }} 
            style={styles.appIcon}
            contentFit="contain"
          />
        ) : (
          <Feather name="package" size={28} color="#60A5FA" />
        )}
      </View>
      <View style={styles.appInfo}>
        <Text style={styles.appName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.appSize}>{formatSize(item.size)}</Text>
      </View>
      <Pressable style={styles.installButton}>
        <Text style={styles.installButtonText}>Partager</Text>
      </Pressable>
    </Pressable>
  );

  const renderPackItem = ({ item }: { item: AppPack }) => (
    <Pressable style={styles.packItem}>
      <View style={styles.packIconContainer}>
        <Feather name={item.icon} size={24} color="#60A5FA" />
      </View>
      <View style={styles.packInfo}>
        <Text style={styles.packName}>{item.name}</Text>
        <Text style={styles.packCount}>
          {item.appCount} {item.appCount === 1 ? "application" : "applications"}
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
      <Text style={styles.emptyText}>Pas d'application</Text>
    </View>
  );

  const renderReceivedTab = () => {
    if (receivedApps.length === 0) {
      return renderEmptyState();
    }

    return (
      <FlatList
        data={receivedApps}
        renderItem={renderAppItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  const renderPacksTab = () => {
    return (
      <FlatList
        data={appPacks}
        renderItem={renderPackItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          <Pressable style={styles.createPackButton}>
            <Feather name="plus" size={20} color="#60A5FA" />
            <Text style={styles.createPackText}>Créer un pack</Text>
          </Pressable>
        }
      />
    );
  };

  const renderInstalledTab = () => {
    if (installedApps.length === 0) {
      return renderEmptyState();
    }

    return (
      <FlatList
        data={installedApps}
        renderItem={renderAppItem}
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
        <Text style={styles.headerTitle}>Applications</Text>
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
          style={[styles.tab, activeTab === "received" && styles.tabActive]}
          onPress={() => setActiveTab("received")}
        >
          <Text style={[styles.tabText, activeTab === "received" && styles.tabTextActive]}>
            APPS REÇUES
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === "packs" && styles.tabActive]}
          onPress={() => setActiveTab("packs")}
        >
          <Text style={[styles.tabText, activeTab === "packs" && styles.tabTextActive]}>
            PACK APP
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === "installed" && styles.tabActive]}
          onPress={() => setActiveTab("installed")}
        >
          <Text style={[styles.tabText, activeTab === "installed" && styles.tabTextActive]}>
            APP INSTALLER
          </Text>
        </Pressable>
      </View>

      <View style={[styles.content, { paddingBottom: insets.bottom + 80 }]}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#60A5FA" />
            <Text style={styles.loadingText}>Chargement des applications...</Text>
          </View>
        ) : (
          <>
            {activeTab === "received" && renderReceivedTab()}
            {activeTab === "packs" && renderPacksTab()}
            {activeTab === "installed" && renderInstalledTab()}
          </>
        )}
      </View>

      <Pressable style={[styles.fab, { bottom: insets.bottom + 90, backgroundColor: "#60A5FA" }]}>
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
    fontSize: 11,
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
  appItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  appIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  appIcon: {
    width: 40,
    height: 40,
  },
  appInfo: {
    flex: 1,
  },
  appName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0F172A",
    marginBottom: 2,
  },
  appSize: {
    fontSize: 13,
    color: "#64748B",
  },
  installButton: {
    backgroundColor: "#60A5FA",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  installButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  packItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  packIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
  },
  packInfo: {
    flex: 1,
  },
  packName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0F172A",
    marginBottom: 2,
  },
  packCount: {
    fontSize: 13,
    color: "#64748B",
  },
  createPackButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EFF6FF",
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderStyle: "dashed",
  },
  createPackText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#60A5FA",
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
