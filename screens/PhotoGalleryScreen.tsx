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
const PHOTO_ITEM_WIDTH = (SCREEN_WIDTH - 48) / 3;

type PhotoGalleryScreenNavigationProp = NativeStackNavigationProp<
  HomeStackParamList,
  "PhotoGallery"
>;

interface Props {
  navigation: PhotoGalleryScreenNavigationProp;
}

interface PhotoItem {
  id: string;
  uri: string;
  filename: string;
  creationTime: number;
  modificationTime: number;
  albumId?: string;
}

interface PhotoAlbum {
  id: string;
  title: string;
  assetCount: number;
  thumbnailUri: string;
}

interface DateGroup {
  date: string;
  photos: PhotoItem[];
}

type TabType = "all" | "folders" | "received";

export default function PhotoGalleryScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { openImage } = useOpenMedia();
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [albums, setAlbums] = useState<PhotoAlbum[]>([]);
  const [receivedPhotos, setReceivedPhotos] = useState<PhotoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [permission, requestPermission] = MediaLibrary.usePermissions();

  const loadPhotos = useCallback(async (forceRefresh = false) => {
    if (Platform.OS === "web") {
      try {
        setLoading(true);
        const mockImages = MockupDataService.getImages();
        const photoItems: PhotoItem[] = mockImages.map((img) => ({
          id: img.id,
          uri: img.uri,
          filename: img.name,
          creationTime: img.createdAt,
          modificationTime: img.createdAt,
        }));
        setPhotos(photoItems);
        setAlbums([
          { id: 'album-1', title: 'Photos', assetCount: mockImages.length, thumbnailUri: mockImages[0]?.uri || '' },
        ]);
      } catch (error) {
        console.error("Error loading mock photos:", error);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!forceRefresh && MediaCacheService.isCacheValid('photos')) {
      const cachedPhotos = MediaCacheService.getCachedPhotos();
      if (cachedPhotos && cachedPhotos.length > 0) {
        const photoItems: PhotoItem[] = cachedPhotos.map((item) => ({
          id: item.id,
          uri: item.uri,
          filename: item.filename,
          creationTime: item.creationTime * 1000,
          modificationTime: item.modificationTime * 1000,
          albumId: (item as any).albumId,
        }));
        setPhotos(photoItems);
        setLoading(false);
        return;
      }
    }

    try {
      setLoading(true);

      const result = await MediaCacheService.getPhotos(500, undefined, forceRefresh);
      const photoItems: PhotoItem[] = result.items.map((item) => ({
        id: item.id,
        uri: item.uri,
        filename: item.filename,
        creationTime: item.creationTime * 1000,
        modificationTime: item.modificationTime * 1000,
        albumId: (item as any).albumId,
      }));

      setPhotos(photoItems);

      const albumsResult = await MediaLibrary.getAlbumsAsync({
        includeSmartAlbums: false,
      });

      const photoAlbums: PhotoAlbum[] = [];

      for (const album of albumsResult) {
        const albumAssets = await MediaLibrary.getAssetsAsync({
          album: album,
          mediaType: ["photo"],
          first: 1,
        });

        if (albumAssets.totalCount > 0) {
          photoAlbums.push({
            id: album.id,
            title: album.title,
            assetCount: albumAssets.totalCount,
            thumbnailUri: albumAssets.assets[0]?.uri || "",
          });
        }
      }

      photoAlbums.sort((a, b) => b.assetCount - a.assetCount);
      setAlbums(photoAlbums);

      const sharelAlbum = albumsResult.find(
        (album) =>
          album.title.toLowerCase().includes("sharel") ||
          album.title.toLowerCase().includes("shareit") ||
          album.title.toLowerCase().includes("received")
      );

      if (sharelAlbum) {
        const sharelAssets = await MediaLibrary.getAssetsAsync({
          album: sharelAlbum,
          mediaType: ["photo"],
          sortBy: [[MediaLibrary.SortBy.creationTime, false]],
          first: 100,
        });

        const sharelPhotos: PhotoItem[] = sharelAssets.assets.map((asset) => ({
          id: asset.id,
          uri: asset.uri,
          filename: asset.filename,
          creationTime: asset.creationTime * 1000,
          modificationTime: asset.modificationTime * 1000,
          albumId: asset.albumId,
        }));

        setReceivedPhotos(sharelPhotos);
      }
    } catch (error) {
      console.error("Error loading photos:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'web' || permission?.granted) {
        loadPhotos(false);
      }
    }, [permission?.granted, loadPhotos])
  );

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

  const groupPhotosByDate = (photoList: PhotoItem[]): DateGroup[] => {
    const groups: { [key: string]: PhotoItem[] } = {};

    photoList.forEach((photo) => {
      const dateKey = new Date(photo.creationTime).toDateString();
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(photo);
    });

    return Object.entries(groups)
      .map(([dateKey, pics]) => ({
        date: formatDate(new Date(dateKey).getTime()),
        photos: pics,
      }))
      .sort(
        (a, b) =>
          new Date(b.photos[0].creationTime).getTime() -
          new Date(a.photos[0].creationTime).getTime()
      );
  };

  const handlePhotoPress = useCallback((photo: PhotoItem, allPhotos: PhotoItem[]) => {
    const index = allPhotos.findIndex(p => p.id === photo.id);
    const photoOptions = allPhotos.map(p => ({
      uri: p.uri,
      name: p.filename,
      size: 0,
    }));
    openImage(
      { uri: photo.uri, name: photo.filename },
      photoOptions,
      index >= 0 ? index : 0
    );
  }, [openImage]);

  const renderPhotoItem = ({ item }: { item: PhotoItem }, allPhotos: PhotoItem[]) => (
    <Pressable style={styles.photoItem} onPress={() => handlePhotoPress(item, allPhotos)}>
      <View style={styles.thumbnailContainer}>
        <Image
          source={{ uri: item.uri }}
          style={styles.thumbnail}
          contentFit="cover"
        />
      </View>
    </Pressable>
  );

  const renderAlbumItem = ({ item }: { item: PhotoAlbum }) => (
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
            <Feather name="image" size={32} color="#94A3B8" />
          </View>
        )}
        <View style={styles.albumCountOverlay}>
          <Text style={styles.albumCountText}>{item.assetCount}</Text>
        </View>
      </View>
      <Text style={styles.albumTitle} numberOfLines={1}>
        {item.title}
      </Text>
      <Text style={styles.albumCount}>{item.assetCount} photos</Text>
    </Pressable>
  );

  const renderDateSection = ({ item }: { item: DateGroup }, allPhotos: PhotoItem[]) => (
    <View style={styles.dateSection}>
      <Text style={styles.dateSectionTitle}>{item.date}</Text>
      <View style={styles.datePhotosGrid}>
        {item.photos.map((photo) => (
          <View key={photo.id} style={styles.gridPhotoWrapper}>
            {renderPhotoItem({ item: photo }, allPhotos)}
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
      <Text style={styles.emptyText}>Pas de photo</Text>
    </View>
  );

  const renderAllTab = () => {
    const groupedPhotos = groupPhotosByDate(photos);

    if (photos.length === 0) {
      return renderEmptyState();
    }

    return (
      <FlatList
        data={groupedPhotos}
        renderItem={({ item }) => renderDateSection({ item }, photos)}
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
    if (receivedPhotos.length === 0) {
      return renderEmptyState();
    }

    const groupedPhotos = groupPhotosByDate(receivedPhotos);

    return (
      <FlatList
        data={groupedPhotos}
        renderItem={({ item }) => renderDateSection({ item }, receivedPhotos)}
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
          <ActivityIndicator size="large" color="#4ADE80" />
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
            <Text style={styles.headerTitle}>Photos</Text>
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
              <Feather name="image" size={48} color="#4ADE80" />
            </View>
            <Text style={styles.permissionTitle}>Accès aux photos requis</Text>
            <Text style={styles.permissionText}>
              Pour afficher vos photos, veuillez autoriser l'accès à votre bibliothèque média.
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
        <Text style={styles.headerTitle}>Photos</Text>
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
            <ActivityIndicator size="large" color="#4ADE80" />
            <Text style={styles.loadingText}>Chargement des photos...</Text>
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
    backgroundColor: "#DCFCE7",
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
  dateSection: {
    marginBottom: 24,
  },
  dateSectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748B",
    marginBottom: 12,
  },
  datePhotosGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  gridPhotoWrapper: {
    width: PHOTO_ITEM_WIDTH,
  },
  photoItem: {
    width: "100%",
  },
  thumbnailContainer: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#E2E8F0",
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  albumRow: {
    justifyContent: "space-between",
    marginBottom: 16,
  },
  albumItem: {
    width: (SCREEN_WIDTH - 48) / 2,
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
  albumCountOverlay: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  albumCountText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
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
    backgroundColor: "#DCFCE7",
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
    backgroundColor: "#86EFAC",
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
    backgroundColor: "#DCFCE7",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#0F172A",
    marginBottom: 8,
    textAlign: "center",
  },
  permissionText: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  permissionButton: {
    backgroundColor: "#4ADE80",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
  },
  permissionButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
