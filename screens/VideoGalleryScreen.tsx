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
import * as MediaLibrary from "expo-media-library";
import { Image } from "expo-image";
import { useFocusEffect } from "@react-navigation/native";
import { useOpenMedia } from "@/hooks/useOpenMedia";
import { MockupDataService } from "@/services/MockupDataService";
import { MediaCacheService } from "@/services/MediaCacheService";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const VIDEO_ITEM_WIDTH = (SCREEN_WIDTH - 48) / 2;

type VideoGalleryScreenNavigationProp = NativeStackNavigationProp<
  HomeStackParamList,
  "VideoGallery"
>;

interface Props {
  navigation: VideoGalleryScreenNavigationProp;
}

interface VideoItem {
  id: string;
  uri: string;
  filename: string;
  duration: number;
  creationTime: number;
  modificationTime: number;
  albumId?: string;
}

interface VideoAlbum {
  id: string;
  title: string;
  assetCount: number;
  thumbnailUri: string;
}

interface DateGroup {
  date: string;
  videos: VideoItem[];
}

type TabType = "all" | "folders" | "received";

export default function VideoGalleryScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { open } = useOpenMedia();
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [albums, setAlbums] = useState<VideoAlbum[]>([]);
  const [receivedVideos, setReceivedVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [permission, requestPermission] = MediaLibrary.usePermissions();

  const loadVideos = useCallback(async (forceRefresh = false) => {
    if (Platform.OS === "web") {
      try {
        setLoading(true);
        const mockVideos = MockupDataService.getVideos();
        const videoItems: VideoItem[] = mockVideos.map((vid) => ({
          id: vid.id,
          uri: vid.uri,
          filename: vid.name,
          duration: vid.duration,
          creationTime: vid.createdAt,
          modificationTime: vid.createdAt,
        }));
        setVideos(videoItems);
        setAlbums([
          { id: 'album-1', title: 'Videos', assetCount: mockVideos.length, thumbnailUri: mockVideos[0]?.uri || '' },
        ]);
      } catch (error) {
        console.error("Error loading mock videos:", error);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!forceRefresh && MediaCacheService.isCacheValid('videos')) {
      const cachedVideos = MediaCacheService.getCachedVideos();
      if (cachedVideos && cachedVideos.length > 0) {
        const videoItems: VideoItem[] = cachedVideos.map((item) => ({
          id: item.id,
          uri: item.uri,
          filename: item.filename,
          duration: item.duration || 0,
          creationTime: item.creationTime * 1000,
          modificationTime: item.modificationTime * 1000,
          albumId: (item as any).albumId,
        }));
        setVideos(videoItems);
        setLoading(false);
        return;
      }
    }

    try {
      setLoading(true);

      const result = await MediaCacheService.getVideos(500, undefined, forceRefresh);
      const videoItems: VideoItem[] = result.items.map((item) => ({
        id: item.id,
        uri: item.uri,
        filename: item.filename,
        duration: item.duration || 0,
        creationTime: item.creationTime * 1000,
        modificationTime: item.modificationTime * 1000,
        albumId: (item as any).albumId,
      }));

      setVideos(videoItems);

      const albumsResult = await MediaLibrary.getAlbumsAsync({
        includeSmartAlbums: false,
      });

      const videoAlbums: VideoAlbum[] = [];

      for (const album of albumsResult) {
        const albumAssets = await MediaLibrary.getAssetsAsync({
          album: album,
          mediaType: ["video"],
          first: 1,
        });

        if (albumAssets.totalCount > 0) {
          videoAlbums.push({
            id: album.id,
            title: album.title,
            assetCount: albumAssets.totalCount,
            thumbnailUri: albumAssets.assets[0]?.uri || "",
          });
        }
      }

      videoAlbums.sort((a, b) => b.assetCount - a.assetCount);
      setAlbums(videoAlbums);

      const sharelAlbum = albumsResult.find(
        (album) =>
          album.title.toLowerCase().includes("sharel") ||
          album.title.toLowerCase().includes("shareit") ||
          album.title.toLowerCase().includes("received")
      );

      if (sharelAlbum) {
        const sharelAssets = await MediaLibrary.getAssetsAsync({
          album: sharelAlbum,
          mediaType: ["video"],
          sortBy: [[MediaLibrary.SortBy.creationTime, false]],
          first: 100,
        });

        const sharelVideos: VideoItem[] = sharelAssets.assets.map((asset) => ({
          id: asset.id,
          uri: asset.uri,
          filename: asset.filename,
          duration: asset.duration,
          creationTime: asset.creationTime * 1000,
          modificationTime: asset.modificationTime * 1000,
          albumId: asset.albumId,
        }));

        setReceivedVideos(sharelVideos);
      }
    } catch (error) {
      console.error("Error loading videos:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'web' || permission?.granted) {
        loadVideos(false);
      }
    }, [permission?.granted, loadVideos])
  );

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Aujourd'hui";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Hier";
    } else {
      return date.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    }
  };

  const groupVideosByDate = (videoList: VideoItem[]): DateGroup[] => {
    const groups: { [key: string]: VideoItem[] } = {};

    videoList.forEach((video) => {
      const dateKey = new Date(video.creationTime).toDateString();
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(video);
    });

    return Object.entries(groups)
      .map(([dateKey, vids]) => ({
        date: formatDate(new Date(dateKey).getTime()),
        videos: vids,
      }))
      .sort(
        (a, b) =>
          new Date(b.videos[0].creationTime).getTime() -
          new Date(a.videos[0].creationTime).getTime()
      );
  };

  const handleVideoPress = useCallback((video: VideoItem) => {
    open({
      uri: video.uri,
      name: video.filename,
      size: 0,
      metadata: {
        duration: video.duration,
      },
    });
  }, [open]);

  const renderVideoItem = ({ item }: { item: VideoItem }) => (
    <Pressable style={styles.videoItem} onPress={() => handleVideoPress(item)}>
      <View style={styles.thumbnailContainer}>
        <Image
          source={{ uri: item.uri }}
          style={styles.thumbnail}
          contentFit="cover"
        />
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>{formatDuration(item.duration)}</Text>
        </View>
        <View style={styles.playOverlay}>
          <View style={styles.playButton}>
            <Feather name="play" size={20} color="#FFF" />
          </View>
        </View>
      </View>
    </Pressable>
  );

  const renderAlbumItem = ({ item }: { item: VideoAlbum }) => (
    <Pressable style={styles.albumItem}>
      <View style={styles.albumThumbnailContainer}>
        {item.thumbnailUri ? (
          <Image
            source={{ uri: item.thumbnailUri }}
            style={styles.albumThumbnail}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.albumThumbnail, styles.emptyAlbum]}>
            <Feather name="video" size={32} color="#94A3B8" />
          </View>
        )}
        <View style={styles.albumPlayOverlay}>
          <Feather name="play" size={24} color="#FFF" />
        </View>
      </View>
      <Text style={styles.albumTitle} numberOfLines={1}>
        {item.title}
      </Text>
      <Text style={styles.albumCount}>{item.assetCount}</Text>
    </Pressable>
  );

  const renderDateSection = ({ item }: { item: DateGroup }) => (
    <View style={styles.dateSection}>
      <Text style={styles.dateSectionTitle}>{item.date}</Text>
      <View style={styles.dateVideosGrid}>
        {item.videos.map((video) => (
          <View key={video.id} style={styles.gridVideoWrapper}>
            {renderVideoItem({ item: video })}
          </View>
        ))}
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIllustration}>
        <View style={styles.emptyCard}>
          <View style={styles.emptyCardLines}>
            <View style={styles.emptyLine} />
            <View style={[styles.emptyLine, styles.emptyLineShort]} />
            <View style={[styles.emptyLine, styles.emptyLineMedium]} />
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
      <Text style={styles.emptyText}>Pas de vidéo</Text>
    </View>
  );

  const renderAllTab = () => {
    const groupedVideos = groupVideosByDate(videos);

    if (videos.length === 0) {
      return renderEmptyState();
    }

    return (
      <FlatList
        data={groupedVideos}
        renderItem={renderDateSection}
        keyExtractor={(item) => item.date}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  const renderFoldersTab = () => {
    if (albums.length === 0) {
      return renderEmptyState();
    }

    return (
      <FlatList
        data={albums}
        renderItem={renderAlbumItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.albumRow}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  const renderReceivedTab = () => {
    if (receivedVideos.length === 0) {
      return renderEmptyState();
    }

    const groupedVideos = groupVideosByDate(receivedVideos);

    return (
      <FlatList
        data={groupedVideos}
        renderItem={renderDateSection}
        keyExtractor={(item) => item.date}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  if (Platform.OS !== 'web') {
    if (!permission) {
      return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      );
    }

    if (!permission.granted) {
      return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
          <View style={styles.header}>
            <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
              <Feather name="arrow-left" size={24} color="#0F172A" />
            </Pressable>
            <Text style={styles.headerTitle}>Vidéos</Text>
            <View style={styles.headerIcons}>
              <Pressable style={styles.headerIcon}>
                <Feather name="search" size={22} color="#0F172A" />
              </Pressable>
              <Pressable style={styles.headerIcon}>
                <Feather name="edit" size={22} color="#0F172A" />
              </Pressable>
            </View>
          </View>

          <View style={styles.permissionContainer}>
            <View style={styles.permissionIconContainer}>
              <Feather name="video" size={48} color="#3B82F6" />
            </View>
            <Text style={styles.permissionTitle}>Accès aux vidéos requis</Text>
            <Text style={styles.permissionText}>
              Pour afficher vos vidéos, veuillez autoriser l'accès à votre bibliothèque média.
            </Text>
            <Pressable style={styles.permissionButton} onPress={requestPermission}>
              <Text style={styles.permissionButtonText}>Autoriser l'accès</Text>
            </Pressable>
          </View>
        </View>
      );
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color="#0F172A" />
        </Pressable>
        <Text style={styles.headerTitle}>Vidéos</Text>
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
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loadingText}>Chargement des vidéos...</Text>
          </View>
        ) : (
          <>
            {activeTab === "all" && renderAllTab()}
            {activeTab === "folders" && renderFoldersTab()}
            {activeTab === "received" && renderReceivedTab()}
          </>
        )}
      </View>

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
    backgroundColor: "#EFF6FF",
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
    backgroundColor: "#3B82F6",
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
  dateSection: {
    marginBottom: 24,
  },
  dateSectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748B",
    marginBottom: 12,
  },
  dateVideosGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  gridVideoWrapper: {
    width: VIDEO_ITEM_WIDTH,
  },
  videoItem: {
    width: "100%",
  },
  thumbnailContainer: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#E2E8F0",
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  durationBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#FFFFFF",
  },
  playOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  albumRow: {
    justifyContent: "space-between",
    marginBottom: 16,
  },
  albumItem: {
    width: VIDEO_ITEM_WIDTH,
  },
  albumThumbnailContainer: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#E2E8F0",
    marginBottom: 8,
  },
  albumThumbnail: {
    width: "100%",
    height: "100%",
  },
  emptyAlbum: {
    justifyContent: "center",
    alignItems: "center",
  },
  albumPlayOverlay: {
    position: "absolute",
    bottom: 8,
    right: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  albumTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
    marginBottom: 2,
  },
  albumCount: {
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
    backgroundColor: "#DBEAFE",
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
    backgroundColor: "#93C5FD",
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
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  fabBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#EF4444",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  fabBadgeText: {
    fontSize: 8,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  permissionIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#0F172A",
    marginBottom: 12,
    textAlign: "center",
  },
  permissionText: {
    fontSize: 15,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  permissionButton: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
