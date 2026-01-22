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
import { useFocusEffect } from "@react-navigation/native";
import { useOpenMedia } from "@/hooks/useOpenMedia";
import { MockupDataService } from "@/services/MockupDataService";
import { MediaCacheService } from "@/services/MediaCacheService";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type MusicGalleryScreenNavigationProp = NativeStackNavigationProp<
  HomeStackParamList,
  "MusicGallery"
>;

interface Props {
  navigation: MusicGalleryScreenNavigationProp;
}

interface MusicItem {
  id: string;
  uri: string;
  filename: string;
  duration: number;
  creationTime: number;
  modificationTime: number;
  albumId?: string;
}

interface MusicAlbum {
  id: string;
  title: string;
  assetCount: number;
}

interface Playlist {
  id: string;
  name: string;
  songCount: number;
  icon: keyof typeof Feather.glyphMap;
}

type TabType = "all" | "received" | "playlists" | "folders";

export default function MusicGalleryScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { openAudio } = useOpenMedia();
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [music, setMusic] = useState<MusicItem[]>([]);
  const [albums, setAlbums] = useState<MusicAlbum[]>([]);
  const [receivedMusic, setReceivedMusic] = useState<MusicItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [permission, requestPermission] = MediaLibrary.usePermissions();

  const playlists: Playlist[] = [
    { id: "1", name: "Mes favoris", songCount: 0, icon: "heart" },
    { id: "2", name: "Récemment ajoutés", songCount: 0, icon: "clock" },
    { id: "3", name: "Les plus joués", songCount: 0, icon: "trending-up" },
  ];

  const loadMusic = useCallback(async () => {
    if (Platform.OS === "web") {
      try {
        setLoading(true);
        const mockAudio = MockupDataService.getAudio();
        const musicItems: MusicItem[] = mockAudio.map((aud) => ({
          id: aud.id,
          uri: aud.uri,
          filename: aud.name,
          duration: aud.duration,
          creationTime: aud.createdAt,
          modificationTime: aud.createdAt,
        }));
        setMusic(musicItems);
        setAlbums([
          { id: 'album-1', title: 'Music', assetCount: mockAudio.length },
        ]);
      } catch (error) {
        console.error("Error loading mock music:", error);
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      setLoading(true);

      const result = await MediaCacheService.getAudio(500);
      const musicItems: MusicItem[] = result.items.map((item) => ({
        id: item.id,
        uri: item.uri,
        filename: item.filename,
        duration: item.duration || 0,
        creationTime: item.creationTime * 1000,
        modificationTime: item.modificationTime * 1000,
        albumId: item.albumId,
      }));

      setMusic(musicItems);

      const albumsResult = await MediaLibrary.getAlbumsAsync({
        includeSmartAlbums: false,
      });

      const musicAlbums: MusicAlbum[] = [];

      for (const album of albumsResult) {
        const albumAssets = await MediaLibrary.getAssetsAsync({
          album: album,
          mediaType: ["audio"],
          first: 1,
        });

        if (albumAssets.totalCount > 0) {
          musicAlbums.push({
            id: album.id,
            title: album.title,
            assetCount: albumAssets.totalCount,
          });
        }
      }

      musicAlbums.sort((a, b) => b.assetCount - a.assetCount);
      setAlbums(musicAlbums);

      const sharelAlbum = albumsResult.find(
        (album) =>
          album.title.toLowerCase().includes("sharel") ||
          album.title.toLowerCase().includes("shareit") ||
          album.title.toLowerCase().includes("received")
      );

      if (sharelAlbum) {
        const sharelAssets = await MediaLibrary.getAssetsAsync({
          album: sharelAlbum,
          mediaType: ["audio"],
          sortBy: [[MediaLibrary.SortBy.creationTime, false]],
          first: 100,
        });

        const sharelMusic: MusicItem[] = sharelAssets.assets.map((asset) => ({
          id: asset.id,
          uri: asset.uri,
          filename: asset.filename,
          duration: asset.duration,
          creationTime: asset.creationTime * 1000,
          modificationTime: asset.modificationTime * 1000,
          albumId: asset.albumId,
        }));

        setReceivedMusic(sharelMusic);
      }
    } catch (error) {
      console.error("Error loading music:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'web' || permission?.granted) {
        loadMusic();
      }
    }, [permission?.granted, loadMusic])
  );

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getArtistFromFilename = (filename: string): string => {
    const parts = filename.split(" - ");
    if (parts.length > 1) {
      return parts[0].trim();
    }
    return "Artiste inconnu";
  };

  const getTitleFromFilename = (filename: string): string => {
    const withoutExt = filename.replace(/\.[^/.]+$/, "");
    const parts = withoutExt.split(" - ");
    if (parts.length > 1) {
      return parts.slice(1).join(" - ").trim();
    }
    return withoutExt;
  };

  const handleMusicPress = useCallback((item: MusicItem, allMusic: MusicItem[]) => {
    const index = allMusic.findIndex(m => m.id === item.id);
    const queueOptions = allMusic.map(m => ({
      uri: m.uri,
      name: m.filename,
      size: 0,
      metadata: {
        title: getTitleFromFilename(m.filename),
        artist: getArtistFromFilename(m.filename),
        duration: m.duration,
      },
    }));
    openAudio(
      {
        uri: item.uri,
        name: item.filename,
        size: 0,
        metadata: {
          title: getTitleFromFilename(item.filename),
          artist: getArtistFromFilename(item.filename),
          duration: item.duration,
        },
      },
      queueOptions,
      index >= 0 ? index : 0
    );
  }, [openAudio]);

  const renderMusicItem = ({ item }: { item: MusicItem }, allMusic: MusicItem[]) => (
    <Pressable style={styles.musicItem} onPress={() => handleMusicPress(item, allMusic)}>
      <View style={styles.musicIconContainer}>
        <Feather name="music" size={24} color="#FB7185" />
      </View>
      <View style={styles.musicInfo}>
        <Text style={styles.musicTitle} numberOfLines={1}>
          {getTitleFromFilename(item.filename)}
        </Text>
        <Text style={styles.musicArtist} numberOfLines={1}>
          {getArtistFromFilename(item.filename)}
        </Text>
      </View>
      <Text style={styles.musicDuration}>{formatDuration(item.duration)}</Text>
      <Pressable style={styles.musicMoreButton}>
        <Feather name="more-vertical" size={20} color="#94A3B8" />
      </Pressable>
    </Pressable>
  );

  const renderAlbumItem = ({ item }: { item: MusicAlbum }) => (
    <Pressable style={styles.folderItem}>
      <View style={styles.folderIconContainer}>
        <Feather name="folder" size={24} color="#FB7185" />
      </View>
      <View style={styles.folderInfo}>
        <Text style={styles.folderTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.folderCount}>
          {item.assetCount} {item.assetCount === 1 ? "titre" : "titres"}
        </Text>
      </View>
      <Feather name="chevron-right" size={20} color="#94A3B8" />
    </Pressable>
  );

  const renderPlaylistItem = ({ item }: { item: Playlist }) => (
    <Pressable style={styles.playlistItem}>
      <View style={[styles.playlistIconContainer, { backgroundColor: "#FFF1F2" }]}>
        <Feather name={item.icon} size={24} color="#FB7185" />
      </View>
      <View style={styles.playlistInfo}>
        <Text style={styles.playlistTitle}>{item.name}</Text>
        <Text style={styles.playlistCount}>
          {item.songCount} {item.songCount === 1 ? "titre" : "titres"}
        </Text>
      </View>
      <Feather name="chevron-right" size={20} color="#94A3B8" />
    </Pressable>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIllustration}>
        <View style={[styles.emptyCard, { backgroundColor: "#FFF1F2" }]}>
          <View style={styles.emptyCardLines}>
            <View style={[styles.emptyLine, { backgroundColor: "#FECDD3" }]} />
            <View style={[styles.emptyLine, styles.emptyLineShort, { backgroundColor: "#FECDD3" }]} />
            <View style={[styles.emptyLine, styles.emptyLineMedium, { backgroundColor: "#FECDD3" }]} />
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
      <Text style={styles.emptyText}>Pas de musique</Text>
    </View>
  );

  const renderAllTab = () => {
    if (music.length === 0) {
      return renderEmptyState();
    }

    return (
      <FlatList
        data={music}
        renderItem={({ item }) => renderMusicItem({ item }, music)}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  const renderReceivedTab = () => {
    if (receivedMusic.length === 0) {
      return renderEmptyState();
    }

    return (
      <FlatList
        data={receivedMusic}
        renderItem={({ item }) => renderMusicItem({ item }, receivedMusic)}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  const renderPlaylistsTab = () => {
    return (
      <FlatList
        data={playlists}
        renderItem={renderPlaylistItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyState}
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
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  if (Platform.OS !== 'web') {
    if (!permission) {
      return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
          <ActivityIndicator size="large" color="#FB7185" />
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
            <Text style={styles.headerTitle}>Musiques</Text>
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
            <View style={[styles.permissionIconContainer, { backgroundColor: "#FFF1F2" }]}>
              <Feather name="music" size={48} color="#FB7185" />
            </View>
            <Text style={styles.permissionTitle}>Accès aux musiques requis</Text>
            <Text style={styles.permissionText}>
              Pour afficher vos musiques, veuillez autoriser l'accès à votre bibliothèque média.
            </Text>
            <Pressable style={[styles.permissionButton, { backgroundColor: "#FB7185" }]} onPress={requestPermission}>
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
        <Text style={styles.headerTitle}>Musiques</Text>
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
          style={[styles.tab, activeTab === "received" && styles.tabActive]}
          onPress={() => setActiveTab("received")}
        >
          <Text style={[styles.tabText, activeTab === "received" && styles.tabTextActive]}>
            REÇU
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === "playlists" && styles.tabActive]}
          onPress={() => setActiveTab("playlists")}
        >
          <Text style={[styles.tabText, activeTab === "playlists" && styles.tabTextActive]}>
            PLAYLISTS
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
      </View>

      <View style={[styles.content, { paddingBottom: insets.bottom + 80 }]}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FB7185" />
            <Text style={styles.loadingText}>Chargement des musiques...</Text>
          </View>
        ) : (
          <>
            {activeTab === "all" && renderAllTab()}
            {activeTab === "received" && renderReceivedTab()}
            {activeTab === "playlists" && renderPlaylistsTab()}
            {activeTab === "folders" && renderFoldersTab()}
          </>
        )}
      </View>

      <Pressable style={[styles.fab, { bottom: insets.bottom + 90, backgroundColor: "#FB7185" }]}>
        <Feather name="shuffle" size={24} color="#FFF" />
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
    fontSize: 12,
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
  musicItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  musicIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFF1F2",
    justifyContent: "center",
    alignItems: "center",
  },
  musicInfo: {
    flex: 1,
  },
  musicTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0F172A",
    marginBottom: 2,
  },
  musicArtist: {
    fontSize: 13,
    color: "#64748B",
  },
  musicDuration: {
    fontSize: 13,
    color: "#94A3B8",
    marginRight: 4,
  },
  musicMoreButton: {
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
    backgroundColor: "#FFF1F2",
    justifyContent: "center",
    alignItems: "center",
  },
  folderInfo: {
    flex: 1,
  },
  folderTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0F172A",
    marginBottom: 2,
  },
  folderCount: {
    fontSize: 13,
    color: "#64748B",
  },
  playlistItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  playlistIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  playlistInfo: {
    flex: 1,
  },
  playlistTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0F172A",
    marginBottom: 2,
  },
  playlistCount: {
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
