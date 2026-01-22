import React, { useState, useEffect, useCallback } from "react";
import { View, StyleSheet, Pressable, Text, ScrollView, TextInput, Platform, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HomeStackParamList } from "@/navigation/HomeStackNavigator";
import { Paths } from "expo-file-system";
import Svg, { Circle } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import RecentFilesService, { AlbumWithFiles, RecentFile } from "@/services/RecentFilesService";

type FileBrowserScreenNavigationProp = NativeStackNavigationProp<HomeStackParamList, "FileBrowser">;

interface Props {
  navigation: FileBrowserScreenNavigationProp;
}

interface CategoryItem {
  id: string;
  nameKey: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  count: number;
  badge?: number;
}

export default function FileBrowserScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [storageInfo, setStorageInfo] = useState({ 
    usedPercent: 96, 
    usedGB: 50.42,
    totalGB: 52.19,
    cleanKB: 624
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [recentAlbums, setRecentAlbums] = useState<AlbumWithFiles[]>([]);
  const [loadingAlbums, setLoadingAlbums] = useState(true);

  const loadRecentAlbums = useCallback(async () => {
    try {
      setLoadingAlbums(true);
      await RecentFilesService.initialize();
      const albums = await RecentFilesService.getRecentFilesGroupedByAlbum(8, 6);
      setRecentAlbums(albums);
    } catch (error) {
      console.error("Error loading recent albums:", error);
    } finally {
      setLoadingAlbums(false);
    }
  }, []);

  useEffect(() => {
    loadStorageInfo();
    loadRecentAlbums();
  }, [loadRecentAlbums]);

  const loadStorageInfo = async () => {
    if (Platform.OS === 'web') {
      return;
    }

    try {
      const freeDiskStorage = Paths.availableDiskSpace;
      const totalDiskCapacity = Paths.totalDiskSpace;
      
      if (freeDiskStorage && totalDiskCapacity) {
        const usedBytes = totalDiskCapacity - freeDiskStorage;
        const usedPercent = Math.round((usedBytes / totalDiskCapacity) * 100);
        const usedGB = usedBytes / (1024 * 1024 * 1024);
        const totalGB = totalDiskCapacity / (1024 * 1024 * 1024);
        
        setStorageInfo({ 
          usedPercent, 
          usedGB, 
          totalGB,
          cleanKB: Math.round(freeDiskStorage / 1024)
        });
      }
    } catch (error) {
      console.error("Error loading storage info:", error);
    }
  };

  const categories: CategoryItem[] = [
    { id: '1', nameKey: 'fileBrowser.music', icon: 'music', color: '#FF6B6B', count: 66 },
    { id: '2', nameKey: 'fileBrowser.applications', icon: 'grid', color: '#4ECDC4', count: 1 },
    { id: '3', nameKey: 'fileBrowser.videos', icon: 'video', color: '#9B59B6', count: 130 },
    { id: '4', nameKey: 'fileBrowser.photos', icon: 'image', color: '#2ECC71', count: 796, badge: 2 },
    { id: '5', nameKey: 'fileBrowser.documents', icon: 'file-text', color: '#F39C12', count: 170 },
    { id: '6', nameKey: 'fileBrowser.converter', icon: 'repeat', color: '#E74C3C', count: 0 },
    { id: '7', nameKey: 'fileBrowser.vault', icon: 'lock', color: '#27AE60', count: 0 },
    { id: '8', nameKey: 'fileBrowser.download', icon: 'download', color: '#5C7CFA', count: 0 },
  ];

  const formatDate = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const oneDay = 24 * 60 * 60 * 1000;
    
    if (diff < oneDay) {
      return t('common.today');
    } else if (diff < 2 * oneDay) {
      return t('common.yesterday') || 'Hier';
    } else {
      const date = new Date(timestamp);
      return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
    }
  };

  const CircularProgress = ({ percent, size = 80 }: { percent: number; size?: number }) => {
    const strokeWidth = 8;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset = circumference - (percent / 100) * circumference;

    return (
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle
            stroke="#FFE5E5"
            fill="none"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
          />
          <Circle
            stroke="#EF4444"
            fill="none"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            rotation="-90"
            origin={`${size / 2}, ${size / 2}`}
          />
        </Svg>
        <View style={styles.circleTextContainer}>
          <Text style={styles.circlePercentText}>{percent}%</Text>
        </View>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.searchContainer}>
        <Feather name="search" size={18} color="#94A3B8" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('fileBrowser.searchLocalFiles')}
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.categoriesGrid}>
        {categories.map((category) => (
          <Pressable 
            key={category.id} 
            style={styles.categoryItem}
            onPress={() => console.log('Category:', category.nameKey)}
          >
            <View style={[styles.categoryIcon, { backgroundColor: category.color }]}>
              <Feather name={category.icon} size={30} color="#FFF" />
              {category.badge ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{category.badge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.categoryName} numberOfLines={1}>{t(category.nameKey)}</Text>
            <Text style={styles.categoryCount}>{category.count}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.divider} />

      <Pressable 
        style={styles.storageCard}
        onPress={() => navigation.navigate("FileExplorer")}
      >
        <View style={styles.storageLeft}>
          <View style={styles.storageIconContainer}>
            <Feather name="smartphone" size={24} color="#3B82F6" />
          </View>
        </View>

        <View style={styles.storageCenter}>
          <Text style={styles.storageTitle}>{t('storage.internalStorage')}</Text>
          <View style={styles.storageBarContainer}>
            <View style={styles.storageBarBackground}>
              <View 
                style={[
                  styles.storageBarFill, 
                  { width: `${storageInfo.usedPercent}%` }
                ]} 
              />
            </View>
          </View>
          <Text style={styles.storageText}>
            {storageInfo.usedGB.toFixed(2)}GB/{storageInfo.totalGB.toFixed(2)}GB
          </Text>
        </View>

        <View style={styles.storageRight}>
          <Feather name="chevron-right" size={20} color="#94A3B8" />
        </View>
      </Pressable>

      <Pressable style={styles.storageAnalyzeButton}>
        <Feather name="search" size={18} color="#64748B" />
        <Text style={styles.analyzeText}>{t('common.analyze')}</Text>
      </Pressable>

      <View style={styles.cleanSection}>
        <View style={styles.cleanLeft}>
          <CircularProgress percent={storageInfo.usedPercent} size={72} />
        </View>
        <View style={styles.cleanCenter}>
          <Text style={styles.cleanTitle}>
            {t('common.clean')} <Text style={styles.cleanSize}>{storageInfo.cleanKB}KB</Text>
          </Text>
          <Text style={styles.cleanSubtext}>{t('storage.usedGb', { used: storageInfo.usedGB.toFixed(2) })}</Text>
        </View>
        <Pressable style={styles.cleanButton}>
          <Text style={styles.cleanButtonText}>{t('common.clean')}</Text>
        </Pressable>
      </View>

      <View style={styles.recentSection}>
        <Text style={styles.recentTitle}>{t('fileBrowser.recentFiles')}</Text>

        {loadingAlbums ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#3B82F6" />
          </View>
        ) : recentAlbums.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name="folder" size={40} color="#94A3B8" />
            <Text style={styles.emptyText}>{t('common.noFiles') || 'Aucun fichier récent'}</Text>
          </View>
        ) : (
          recentAlbums.map((album) => (
            <View key={album.id} style={styles.recentCategory}>
              <View style={styles.recentCategoryHeader}>
                <View style={[styles.categoryIconSmall, { backgroundColor: album.color }]}>
                  <Feather name={album.icon as keyof typeof Feather.glyphMap} size={18} color="#FFF" />
                </View>
                <Text style={styles.recentCategoryName}>{album.title}</Text>
                {album.files.length > 4 ? (
                  <View style={styles.moreCount}>
                    <Text style={styles.moreCountText}>{album.assetCount - album.files.length}+</Text>
                  </View>
                ) : null}
              </View>
              
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                style={styles.thumbnailScroll}
                contentContainerStyle={styles.thumbnailScrollContent}
              >
                {album.files.map((file, index) => (
                  <Pressable 
                    key={file.id} 
                    style={styles.thumbnail}
                    onPress={() => console.log('Open file:', file.filename)}
                  >
                    {file.thumbnailUri ? (
                      <Image 
                        source={{ uri: file.thumbnailUri }}
                        style={styles.thumbnailImage}
                        contentFit="cover"
                        transition={200}
                      />
                    ) : (
                      <View style={styles.thumbnailPlaceholder}>
                        <Feather 
                          name={file.type === 'video' ? 'video' : 'image'} 
                          size={28} 
                          color="#64748B" 
                        />
                      </View>
                    )}
                    {file.type === 'video' ? (
                      <View style={styles.videoOverlay}>
                        <Feather name="play" size={14} color="#FFF" />
                      </View>
                    ) : null}
                  </Pressable>
                ))}
              </ScrollView>
              
              <Text style={styles.recentDate}>{formatDate(album.latestDate)}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.spacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingTop: 52,
    backgroundColor: "#FFFFFF",
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#000",
    flex: 1,
    textAlign: "center",
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
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E2E8F0",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#0F172A",
    padding: 0,
  },
  categoriesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  categoryItem: {
    width: "25%",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  categoryIcon: {
    width: 68,
    height: 68,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#EF4444",
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: "#F1F5F9",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  categoryName: {
    fontSize: 12,
    fontWeight: "500",
    color: "#0F172A",
    textAlign: "center",
    marginBottom: 2,
  },
  categoryCount: {
    fontSize: 11,
    color: "#94A3B8",
    textAlign: "center",
  },
  divider: {
    height: 8,
    backgroundColor: "#E2E8F0",
    marginVertical: 4,
  },
  storageCard: {
    backgroundColor: "#FFF",
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
  },
  storageLeft: {
    marginRight: 12,
  },
  storageIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#DBEAFE",
    justifyContent: "center",
    alignItems: "center",
  },
  storageCenter: {
    flex: 1,
    gap: 3,
  },
  storageTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#0F172A",
  },
  storageBarContainer: {
    marginVertical: 3,
  },
  storageBarBackground: {
    height: 5,
    backgroundColor: "#FFE5E5",
    borderRadius: 2.5,
    overflow: "hidden",
  },
  storageBarFill: {
    height: "100%",
    backgroundColor: "#EF4444",
    borderRadius: 2.5,
  },
  storageText: {
    fontSize: 11,
    fontWeight: "400",
    color: "#64748B",
  },
  storageRight: {
    marginLeft: 8,
  },
  storageAnalyzeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 8,
  },
  analyzeText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#64748B",
  },
  cleanSection: {
    backgroundColor: "#FFF",
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
  },
  cleanLeft: {
    marginRight: 14,
  },
  circleTextContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  circlePercentText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#EF4444",
  },
  cleanCenter: {
    flex: 1,
    gap: 3,
  },
  cleanTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },
  cleanSize: {
    color: "#EF4444",
  },
  cleanSubtext: {
    fontSize: 12,
    color: "#64748B",
  },
  cleanButton: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
  },
  cleanButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  recentSection: {
    marginTop: 12,
    paddingHorizontal: 16,
  },
  recentTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  recentCategory: {
    backgroundColor: "#FFF",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  recentCategoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  categoryIconSmall: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  recentCategoryName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
    marginLeft: 10,
    flex: 1,
  },
  recentCount: {
    fontSize: 12,
    color: "#94A3B8",
    marginRight: 4,
  },
  recentArrow: {
    marginLeft: 2,
  },
  thumbnailScroll: {
    marginBottom: 10,
  },
  thumbnailScrollContent: {
    paddingRight: 4,
  },
  thumbnail: {
    marginRight: 8,
    position: "relative",
  },
  thumbnailImage: {
    width: 80,
    height: 100,
    borderRadius: 8,
    backgroundColor: "#E2E8F0",
  },
  thumbnailPlaceholder: {
    width: 80,
    height: 100,
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  videoOverlay: {
    position: "absolute",
    bottom: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  moreCount: {
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  moreCountText: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "500",
  },
  recentDate: {
    fontSize: 12,
    color: "#94A3B8",
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: "#94A3B8",
  },
  spacer: {
    height: 80,
  },
});
