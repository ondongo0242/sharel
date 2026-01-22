import React, { useState, useEffect, useCallback } from "react";
import { View, StyleSheet, Pressable, Text, Platform, Dimensions, Alert, Modal, TouchableWithoutFeedback } from "react-native";
import { Feather } from "@expo/vector-icons";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HomeStackParamList } from "@/navigation/HomeStackNavigator";
import { nativeStorage } from "@/services/NativeStorage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/hooks/useTheme";
import TransferFAB from "@/components/TransferFAB";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolate,
  FadeIn,
  FadeOut,
  SlideInUp,
  SlideOutUp,
} from "react-native-reanimated";
import RecentFilesService, { RecentFile } from "@/services/RecentFilesService";
import { Image } from "expo-image";
import { AuthService, UserProfile } from "@/services/AuthService";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// File icon utilities
const getFileExtension = (name?: string): string => {
  if (!name) return "";
  const parts = name.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
};

const getFileIcon = (name?: string): keyof typeof Feather.glyphMap => {
  const ext = getFileExtension(name);
  if (["jpg", "jpeg", "png", "gif", "bmp", "webp", "heic"].includes(ext)) return "image";
  if (["mp4", "avi", "mkv", "mov", "wmv", "3gp", "webm"].includes(ext)) return "video";
  if (["mp3", "wav", "flac", "aac", "m4a", "ogg", "wma"].includes(ext)) return "music";
  if (["pdf", "doc", "docx", "txt", "rtf", "xls", "xlsx", "ppt", "pptx"].includes(ext)) return "file-text";
  if (["zip", "rar", "7z", "tar", "gz", "bz2"].includes(ext)) return "archive";
  if (["apk", "xapk"].includes(ext)) return "package";
  if (["js", "ts", "jsx", "tsx", "py", "java", "cpp", "c", "h", "json", "xml", "html", "css"].includes(ext)) return "code";
  return "file";
};

const getFileIconColor = (name?: string): string => {
  const ext = getFileExtension(name);
  if (["jpg", "jpeg", "png", "gif", "bmp", "webp", "heic"].includes(ext)) return "#4CAF50";
  if (["mp4", "avi", "mkv", "mov", "wmv", "3gp", "webm"].includes(ext)) return "#E91E63";
  if (["mp3", "wav", "flac", "aac", "m4a", "ogg", "wma"].includes(ext)) return "#9C27B0";
  if (["pdf", "doc", "docx", "txt", "rtf", "xls", "xlsx", "ppt", "pptx"].includes(ext)) return "#2196F3";
  if (["zip", "rar", "7z", "tar", "gz", "bz2"].includes(ext)) return "#FF9800";
  if (["apk", "xapk"].includes(ext)) return "#4CAF50";
  if (["js", "ts", "jsx", "tsx", "py", "java", "cpp", "c", "h", "json", "xml", "html", "css"].includes(ext)) return "#00BCD4";
  return "#607D8B";
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const formatDate = (timestamp: number): string => {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type HomeScreenNavigationProp = NativeStackNavigationProp<HomeStackParamList, "Home">;

interface Props {
  navigation: HomeScreenNavigationProp;
}

interface FileCategory {
  id: string;
  name: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  bgColor: string;
  count: number;
  type: "images" | "documents" | "audio" | "videos" | "zip" | "apk" | "downloads" | "vault" | "others";
}

interface GroupedAlbum {
  id: string;
  title: string;
  icon: string;
  color: string;
  files: RecentFile[];
  latestDate: number;
}

export default function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { theme, isDark, accentColor } = useTheme();
  const [storageInfo, setStorageInfo] = useState({ 
    usedPercent: 0, 
    freeGB: 0, 
    totalGB: 0 
  });
  const [sharelStorageInfo] = useState({ 
    usedPercent: 0, 
    usedGB: 0, 
    totalGB: 250 
  });
  const [recentAlbums, setRecentAlbums] = useState<GroupedAlbum[]>([]);
  const [mediaCounts, setMediaCounts] = useState({ images: 0, videos: 0, audio: 0 });
  const [documentCounts, setDocumentCounts] = useState({ documents: 0, apk: 0, zip: 0, others: 0 });
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showPlusMenu, setShowPlusMenu] = useState(false);

  const bellScale = useSharedValue(1);
  const connectButtonScale = useSharedValue(1);
  const scrollY = useSharedValue(0);
  const menuScale = useSharedValue(0);
  const menuOpacity = useSharedValue(0);
  const plusMenuScale = useSharedValue(0);
  const plusMenuOpacity = useSharedValue(0);
  const storageBarWidth = useSharedValue(0);
  const [storageLoaded, setStorageLoaded] = useState(false);

  const checkAuthStatus = useCallback(async () => {
    try {
      const session = await AuthService.getSession();
      setIsAuthenticated(!!session);
      
      if (session) {
        const profile = await AuthService.getUserProfile();
        setUserProfile(profile);
      } else {
        setUserProfile(null);
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      setIsAuthenticated(false);
      setUserProfile(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      checkAuthStatus();
    }, [checkAuthStatus])
  );

  useEffect(() => {
    const initializeAndLoad = async () => {
      await RecentFilesService.initialize();
      loadStorageInfo();
      loadRecentFiles();
      loadMediaCounts();
      loadDocumentCounts();
    };
    
    initializeAndLoad();

    const authSubscription = AuthService.onAuthStateChange((session) => {
      setIsAuthenticated(!!session);
      if (session) {
        AuthService.getUserProfile().then(setUserProfile);
      } else {
        setUserProfile(null);
      }
    });

    bellScale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 800 }),
        withTiming(1, { duration: 800 })
      ),
      -1,
      false
    );

    connectButtonScale.value = withRepeat(
      withSequence(
        withSpring(1.08, { damping: 2, stiffness: 100 }),
        withSpring(1, { damping: 2, stiffness: 100 })
      ),
      -1,
      false
    );

    return () => {
      authSubscription.data.subscription.unsubscribe();
    };
  }, []);

  const loadStorageInfo = async () => {
    if (Platform.OS === 'web') {
      setStorageLoaded(true);
      storageBarWidth.value = withTiming(10, { duration: 1000 });
      return;
    }

    try {
      if (nativeStorage.isAvailable()) {
        const info = await nativeStorage.getStorageInfo();
        
        if (info && info.totalSpace > 0) {
          const usedBytes = info.usedSpace;
          const usedPercent = Math.round((usedBytes / info.totalSpace) * 100);
          const freeGB = Math.round(info.freeSpace / (1024 * 1024 * 1024) * 10) / 10;
          const totalGB = Math.round(info.totalSpace / (1024 * 1024 * 1024) * 10) / 10;
          
          setStorageInfo({ usedPercent, freeGB, totalGB });
          setStorageLoaded(true);
          storageBarWidth.value = withTiming(usedPercent, { duration: 1200 });
          return;
        }
      }
      
      setStorageLoaded(true);
      storageBarWidth.value = withTiming(10, { duration: 1000 });
    } catch (error) {
      console.error("Error loading storage info:", error);
      setStorageLoaded(true);
      storageBarWidth.value = withTiming(10, { duration: 1000 });
    }
  };

  const loadRecentFiles = async () => {
    try {
      const cached = await AsyncStorage.getItem('@cache_recent_albums');
      if (cached) setRecentAlbums(JSON.parse(cached));

      const albums = await RecentFilesService.getRecentFilesGroupedByAlbum(5, 4);
      const mappedAlbums: GroupedAlbum[] = albums.map(album => ({
        id: album.id,
        title: album.title,
        icon: album.icon,
        color: album.color,
        files: album.files,
        latestDate: album.latestDate,
      }));
      setRecentAlbums(mappedAlbums);
      await AsyncStorage.setItem('@cache_recent_albums', JSON.stringify(mappedAlbums));
    } catch (error) {
      console.error("Error loading recent files:", error);
    }
  };

  const loadMediaCounts = async () => {
    try {
      // Basic cache check
      const cached = await AsyncStorage.getItem('@cache_media_counts');
      if (cached) setMediaCounts(JSON.parse(cached));

      const counts = await RecentFilesService.getMediaCounts();
      setMediaCounts(counts);
      await AsyncStorage.setItem('@cache_media_counts', JSON.stringify(counts));
    } catch (error) {
      console.error("Error loading media counts:", error);
    }
  };

  const loadDocumentCounts = async () => {
    try {
      const cached = await AsyncStorage.getItem('@cache_doc_counts');
      if (cached) setDocumentCounts(JSON.parse(cached));

      const counts = await RecentFilesService.getDocumentCounts();
      setDocumentCounts(counts);
      await AsyncStorage.setItem('@cache_doc_counts', JSON.stringify(counts));
    } catch (error) {
      console.error("Error loading document counts:", error);
    }
  };

  const handleUserIconPress = () => {
    if (isAuthenticated) {
      setShowUserMenu(true);
      menuScale.value = withSpring(1, { damping: 15, stiffness: 300 });
      menuOpacity.value = withTiming(1, { duration: 200 });
    } else {
      navigation.navigate("Auth");
    }
  };

  const closeUserMenu = () => {
    menuScale.value = withSpring(0, { damping: 15, stiffness: 300 });
    menuOpacity.value = withTiming(0, { duration: 150 });
    setTimeout(() => setShowUserMenu(false), 150);
  };

  const plusMenuTranslateY = useSharedValue(-20);
  
  const openPlusMenu = () => {
    setShowPlusMenu(true);
    plusMenuTranslateY.value = withTiming(0, { duration: 150 });
    plusMenuOpacity.value = withTiming(1, { duration: 150 });
  };

  const closePlusMenu = () => {
    plusMenuTranslateY.value = withTiming(-20, { duration: 120 });
    plusMenuOpacity.value = withTiming(0, { duration: 120 });
    setTimeout(() => setShowPlusMenu(false), 120);
  };

  const handleSignOut = async () => {
    closeUserMenu();
    const result = await AuthService.signOut();
    if (result.success) {
      setIsAuthenticated(false);
      setUserProfile(null);
      Alert.alert(t('profile.logout'), t('auth.logoutSuccess'));
    } else {
      Alert.alert(t('common.error'), result.error || t('auth.logoutError'));
    }
  };

  const handleAccountSettings = () => {
    closeUserMenu();
    navigation.navigate("Profile" as any);
  };

  const handleDashboard = () => {
    closeUserMenu();
    Alert.alert(t('common.dashboard'), t('common.comingSoon'));
  };

  const menuAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: menuScale.value }],
    opacity: menuOpacity.value,
  }));

  const plusMenuWrapperAnimatedStyle = useAnimatedStyle(() => ({
    opacity: plusMenuOpacity.value,
    transform: [{ translateY: plusMenuTranslateY.value }],
  }));

  const bellAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: bellScale.value }],
    };
  });

  const connectButtonAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: connectButtonScale.value }],
    };
  });

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const actionButtonsAnimatedStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      scrollY.value,
      [0, 100],
      [0, 1],
      Extrapolate.CLAMP
    );
    
    const translateY = interpolate(
      progress,
      [0, 1],
      [0, -80],
      Extrapolate.CLAMP
    );
    
    const translateX = interpolate(
      progress,
      [0, 1],
      [0, -SCREEN_WIDTH * 0.28],
      Extrapolate.CLAMP
    );
    
    const scale = interpolate(
      progress,
      [0, 1],
      [1, 0.5],
      Extrapolate.CLAMP
    );
    
    const opacity = interpolate(
      scrollY.value,
      [0, 60, 100],
      [1, 0.5, 0],
      Extrapolate.CLAMP
    );
    
    return {
      transform: [{ translateY }, { translateX }, { scale }],
      opacity,
      pointerEvents: progress > 0.8 ? 'none' : 'auto',
    };
  });
  
  const headerButtonsAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [40, 100],
      [0, 1],
      Extrapolate.CLAMP
    );
    
    return {
      opacity,
      pointerEvents: opacity > 0.5 ? 'auto' : 'none',
    };
  });
  
  const headerLogoGroupAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, 60],
      [1, 0],
      Extrapolate.CLAMP
    );
    
    return {
      opacity,
      pointerEvents: opacity > 0.5 ? 'auto' : 'none',
    };
  });

  const headerLogoAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, 200],
      [1, 0],
      Extrapolate.CLAMP
    );
    
    return {
      opacity,
    };
  });

  const storageBarAnimatedStyle = useAnimatedStyle(() => {
    return {
      width: `${storageBarWidth.value}%`,
    };
  });

  const categories: FileCategory[] = [
    { 
      id: "1", 
      name: t('categories.videos'), 
      icon: "video", 
      color: "#FFFFFF", 
      bgColor: "#A78BFA",
      count: mediaCounts.videos,
      type: "videos"
    },
    { 
      id: "2", 
      name: t('categories.photos'), 
      icon: "image", 
      color: "#FFFFFF", 
      bgColor: "#4ADE80",
      count: mediaCounts.images,
      type: "images"
    },
    { 
      id: "3", 
      name: t('categories.music'), 
      icon: "music", 
      color: "#FFFFFF", 
      bgColor: "#FB7185",
      count: mediaCounts.audio,
      type: "audio"
    },
    { 
      id: "4", 
      name: t('categories.apps'), 
      icon: "grid", 
      color: "#FFFFFF", 
      bgColor: "#60A5FA",
      count: documentCounts.apk,
      type: "apk"
    },
    { 
      id: "5", 
      name: t('categories.documents'), 
      icon: "file-text", 
      color: "#FFFFFF", 
      bgColor: "#FBBF24",
      count: documentCounts.documents,
      type: "documents"
    },
    { 
      id: "6", 
      name: t('categories.downloads'), 
      icon: "download", 
      color: "#FFFFFF", 
      bgColor: "#818CF8",
      count: 0,
      type: "downloads"
    },
    { 
      id: "7", 
      name: t('categories.zip'), 
      icon: "archive", 
      color: "#FFFFFF", 
      bgColor: "#60A5FA",
      count: documentCounts.zip,
      type: "zip"
    },
    { 
      id: "8", 
      name: t('categories.vault'), 
      icon: "lock", 
      color: "#FFFFFF", 
      bgColor: "#4ADE80",
      count: 0,
      type: "vault"
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: theme.backgroundRoot }]}>
        <View style={styles.headerLeftSlot}>
          <Animated.View style={[styles.headerLogoGroup, headerLogoGroupAnimatedStyle]}>
            <Pressable 
              style={[
                styles.greenIconButton,
                isAuthenticated && styles.authenticatedIconButton
              ]}
              onPress={handleUserIconPress}
            >
              {isAuthenticated && userProfile ? (
                <Text style={styles.userInitial}>
                  {userProfile.username?.charAt(0).toUpperCase() || userProfile.full_name?.charAt(0).toUpperCase() || 'U'}
                </Text>
              ) : (
                <Feather name="user" size={18} color="#FFFFFF" />
              )}
              {isAuthenticated ? (
                <View style={styles.authenticatedBadge}>
                  <Feather name="check" size={8} color="#FFFFFF" />
                </View>
              ) : null}
            </Pressable>
            <Text style={styles.appTitle}>
              <Text style={[styles.appTitleNormal, { color: theme.text }]}>share</Text>
              <Text style={[styles.appTitleAccent, { color: theme.error }]}>l</Text>
            </Text>
          </Animated.View>

          <Animated.View style={[styles.headerActionButtons, headerButtonsAnimatedStyle]}>
            <Pressable 
              style={styles.headerActionBtn}
              onPress={() => navigation.navigate("FileSelection")}
            >
              <View style={[styles.headerActionCircle, { backgroundColor: accentColor }]}>
                <Feather name="send" size={18} color="#FFF" />
              </View>
              <Text style={[styles.headerActionLabel, { color: theme.textSecondary }]}>{t('common.send')}</Text>
            </Pressable>

            <Pressable 
              style={styles.headerActionBtn}
              onPress={() => navigation.navigate("Preparation", { mode: "receive" })}
            >
              <View style={[styles.headerActionCircle, { backgroundColor: accentColor }]}>
                <Feather name="download" size={18} color="#FFF" />
              </View>
              <Text style={[styles.headerActionLabel, { color: theme.textSecondary }]}>{t('common.receive')}</Text>
            </Pressable>

            <Pressable 
              style={styles.headerActionBtn}
              onPress={() => navigation.navigate("FileBrowser", { category: "all" })}
            >
              <View style={[styles.headerActionCircle, { backgroundColor: accentColor }]}>
                <Feather name="folder" size={18} color="#FFF" />
              </View>
              <Text style={[styles.headerActionLabel, { color: theme.textSecondary }]}>{t('common.files')}</Text>
            </Pressable>
          </Animated.View>
        </View>

        <View style={styles.headerRightIcons}>
          <Pressable 
            style={styles.headerIcon}
            onPress={() => navigation.navigate("Messages")}
          >
            <Feather name="bell" size={22} color={theme.text} />
            <View style={[styles.notificationBadge, { backgroundColor: theme.error }]}>
              <Text style={styles.badgeText}>1</Text>
            </View>
          </Pressable>

          <Pressable 
            style={styles.headerIcon}
            onPress={openPlusMenu}
          >
            <Feather name="plus-circle" size={24} color={theme.text} />
          </Pressable>
        </View>
      </View>

      {showUserMenu ? (
        <Modal
          transparent
          visible={showUserMenu}
          animationType="none"
          onRequestClose={closeUserMenu}
        >
          <TouchableWithoutFeedback onPress={closeUserMenu}>
            <View style={styles.menuOverlay}>
              <TouchableWithoutFeedback>
                <Animated.View 
                  style={[
                    styles.userMenuContainer, 
                    { top: insets.top + 70, backgroundColor: theme.backgroundDefault },
                    menuAnimatedStyle
                  ]}
                >
                  <View style={[styles.userMenuHeader, { backgroundColor: theme.backgroundSecondary }]}>
                    <View style={[styles.userMenuAvatarContainer, { backgroundColor: accentColor }]}>
                      <Text style={styles.userMenuInitial}>
                        {userProfile?.username?.charAt(0).toUpperCase() || userProfile?.full_name?.charAt(0).toUpperCase() || 'U'}
                      </Text>
                    </View>
                    <View style={styles.userMenuInfo}>
                      <Text style={[styles.userMenuName, { color: theme.text }]} numberOfLines={1}>
                        {userProfile?.full_name || t('common.user')}
                      </Text>
                      <Text style={[styles.userMenuUsername, { color: theme.textSecondary }]} numberOfLines={1}>
                        @{userProfile?.username || 'sharel_user'}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.userMenuDivider, { backgroundColor: theme.border }]} />

                  <Pressable 
                    style={({ pressed }) => [styles.userMenuItem, pressed && { backgroundColor: theme.backgroundSecondary }]}
                    onPress={handleDashboard}
                  >
                    <View style={[styles.userMenuItemIcon, { backgroundColor: accentColor }]}>
                      <Feather name="grid" size={16} color="#FFFFFF" />
                    </View>
                    <Text style={[styles.userMenuItemText, { color: theme.text }]}>{t('common.dashboard')}</Text>
                    <Feather name="chevron-right" size={18} color={theme.textSecondary} />
                  </Pressable>

                  <Pressable 
                    style={({ pressed }) => [styles.userMenuItem, pressed && { backgroundColor: theme.backgroundSecondary }]}
                    onPress={handleAccountSettings}
                  >
                    <View style={[styles.userMenuItemIcon, { backgroundColor: theme.success }]}>
                      <Feather name="settings" size={16} color="#FFFFFF" />
                    </View>
                    <Text style={[styles.userMenuItemText, { color: theme.text }]}>{t('common.accountSettings')}</Text>
                    <Feather name="chevron-right" size={18} color={theme.textSecondary} />
                  </Pressable>

                  <View style={[styles.userMenuDivider, { backgroundColor: theme.border }]} />

                  <Pressable 
                    style={({ pressed }) => [styles.userMenuItem, pressed && { backgroundColor: theme.backgroundSecondary }]}
                    onPress={handleSignOut}
                  >
                    <View style={[styles.userMenuItemIcon, { backgroundColor: theme.error }]}>
                      <Feather name="log-out" size={16} color="#FFFFFF" />
                    </View>
                    <Text style={[styles.userMenuItemText, { color: theme.error }]}>{t('profile.logout')}</Text>
                  </Pressable>
                </Animated.View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      ) : null}

      {showPlusMenu ? (
        <Modal
          transparent
          visible={showPlusMenu}
          animationType="none"
          onRequestClose={closePlusMenu}
        >
          <TouchableWithoutFeedback onPress={closePlusMenu}>
            <View style={styles.menuOverlay}>
              <TouchableWithoutFeedback>
                <Animated.View style={[styles.plusMenuWrapper, { top: insets.top + 60 }, plusMenuWrapperAnimatedStyle]}>
                  <View style={[styles.plusMenuTriangle, { borderBottomColor: isDark ? 'rgba(50, 50, 50, 0.85)' : 'rgba(255, 255, 255, 0.85)' }]} />
                  <View 
                    style={[
                      styles.plusMenuContainer, 
                      { backgroundColor: isDark ? 'rgba(50, 50, 50, 0.85)' : 'rgba(255, 255, 255, 0.85)' }
                    ]}
                  >
                  <Pressable 
                    style={({ pressed }) => [styles.plusMenuItem, pressed && { backgroundColor: theme.backgroundSecondary }]}
                    onPress={() => { closePlusMenu(); }}
                  >
                    <Feather name="user-plus" size={20} color={theme.text} />
                    <Text style={[styles.plusMenuItemText, { color: theme.text }]}>{t('common.invite')}</Text>
                  </Pressable>

                  <Pressable 
                    style={({ pressed }) => [styles.plusMenuItem, pressed && { backgroundColor: theme.backgroundSecondary }]}
                    onPress={() => { closePlusMenu(); navigation.navigate("Preparation", { mode: "receive" }); }}
                  >
                    <Feather name="maximize" size={20} color={theme.text} />
                    <Text style={[styles.plusMenuItemText, { color: theme.text }]}>{t('common.scanQRCode')}</Text>
                  </Pressable>

                  <Pressable 
                    style={({ pressed }) => [styles.plusMenuItem, pressed && { backgroundColor: theme.backgroundSecondary }]}
                    onPress={() => { closePlusMenu(); }}
                  >
                    <Feather name="monitor" size={20} color={theme.text} />
                    <Text style={[styles.plusMenuItemText, { color: theme.text }]}>{t('common.connectPC')}</Text>
                    <View style={[styles.newBadge, { backgroundColor: theme.error }]}>
                      <Text style={styles.newBadgeText}>{t('common.new')}</Text>
                    </View>
                  </Pressable>

                  <Pressable 
                    style={({ pressed }) => [styles.plusMenuItem, pressed && { backgroundColor: theme.backgroundSecondary }]}
                    onPress={() => { closePlusMenu(); }}
                  >
                    <Feather name="smartphone" size={20} color={theme.text} />
                    <Text style={[styles.plusMenuItemText, { color: theme.text }]}>{t('common.connectiOS')}</Text>
                    <View style={[styles.newBadge, { backgroundColor: theme.error }]}>
                      <Text style={styles.newBadgeText}>{t('common.new')}</Text>
                    </View>
                  </Pressable>

                  <Pressable 
                    style={({ pressed }) => [styles.plusMenuItem, pressed && { backgroundColor: theme.backgroundSecondary }]}
                    onPress={() => { closePlusMenu(); }}
                  >
                    <Feather name="grid" size={20} color={theme.text} />
                    <Text style={[styles.plusMenuItemText, { color: theme.text }]}>{t('common.shareKaiOS')}</Text>
                  </Pressable>

                  <Pressable 
                    style={({ pressed }) => [styles.plusMenuItem, pressed && { backgroundColor: theme.backgroundSecondary }]}
                    onPress={() => { closePlusMenu(); }}
                  >
                    <Feather name="copy" size={20} color={theme.text} />
                    <Text style={[styles.plusMenuItemText, { color: theme.text }]}>{t('common.phoneClone')}</Text>
                    <View style={[styles.newBadge, { backgroundColor: theme.error }]}>
                      <Text style={styles.newBadgeText}>{t('common.new')}</Text>
                    </View>
                  </Pressable>

                  <Pressable 
                    style={({ pressed }) => [styles.plusMenuItem, pressed && { backgroundColor: theme.backgroundSecondary }]}
                    onPress={() => { closePlusMenu(); }}
                  >
                    <Feather name="users" size={20} color={theme.text} />
                    <Text style={[styles.plusMenuItemText, { color: theme.text }]}>{t('common.groupShare')}</Text>
                  </Pressable>

                  <Pressable 
                    style={({ pressed }) => [styles.plusMenuItem, pressed && { backgroundColor: theme.backgroundSecondary }]}
                    onPress={() => { closePlusMenu(); navigation.navigate("ShareSharel"); }}
                  >
                    <Feather name="share-2" size={20} color={theme.text} />
                    <Text style={[styles.plusMenuItemText, { color: theme.text }]}>{t('common.shareSharel')}</Text>
                  </Pressable>
                </View>
                </Animated.View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      ) : null}

      <Animated.ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.contentContainer, { paddingTop: insets.top + 70, paddingBottom: insets.bottom + 80 }]}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.actionsContainer, { backgroundColor: theme.backgroundRoot }, actionButtonsAnimatedStyle]}>
        <Pressable 
          style={styles.actionButton} 
          onPress={() => navigation.navigate("FileSelection")}
        >
          <View style={[styles.actionCircle, { backgroundColor: accentColor }]}>
            <Feather name="send" size={32} color="#FFF" />
          </View>
          <Text style={[styles.actionLabel, { color: theme.text }]}>Envoyer</Text>
        </Pressable>

        <Pressable 
          style={styles.actionButton} 
          onPress={() => navigation.navigate("Preparation", { mode: "receive" })}
        >
          <View style={[styles.actionCircle, { backgroundColor: accentColor }]}>
            <Feather name="download" size={32} color="#FFF" />
          </View>
          <Text style={[styles.actionLabel, { color: theme.text }]}>Recevoir</Text>
        </Pressable>

        <Pressable 
          style={styles.actionButton} 
          onPress={() => navigation.navigate("FileBrowser", { category: "all" })}
        >
          <View style={[styles.sharelActionCircle]}>
            <Image 
              source={require('@/assets/images/sharel-logo.png')} 
              style={styles.sharelLogoButton}
              contentFit="contain"
            />
          </View>
          <Text style={[styles.actionLabel, { color: theme.text }]}>Sharel</Text>
        </Pressable>
        </Animated.View>

        <View style={styles.sectionContainer}>
        <View style={[styles.categoriesWrapper, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.categoriesGrid}>
            {(categoriesExpanded ? categories : categories.slice(0, 8)).map((category) => (
              <Pressable 
                key={category.id} 
                style={styles.categoryItem}
                onPress={() => {
                  switch (category.type) {
                    case "videos":
                      navigation.navigate("VideoGallery");
                      break;
                    case "images":
                      navigation.navigate("PhotoGallery");
                      break;
                    case "audio":
                      navigation.navigate("MusicGallery");
                      break;
                    case "apk":
                      navigation.navigate("AppsGallery");
                      break;
                    case "documents":
                      navigation.navigate("DocumentsGallery");
                      break;
                    case "zip":
                      navigation.navigate("ZipGallery");
                      break;
                    case "downloads":
                      navigation.navigate("DownloadsGallery");
                      break;
                    case "vault":
                      navigation.navigate("Vault");
                      break;
                    default:
                      navigation.navigate("FileBrowser", { category: category.type });
                  }
                }}
              >
                <View style={[styles.categoryIcon, { backgroundColor: category.bgColor }]}>
                  <Feather name={category.icon} size={28} color={category.color} />
                </View>
                <Text style={[styles.categoryName, { color: theme.text }]}>{category.name}</Text>
                <Text style={[styles.categoryCount, { color: theme.textSecondary }]}>{category.count}</Text>
              </Pressable>
            ))}
          </View>
          {categories.length > 8 ? (
            <Pressable 
              style={[styles.expandButton, { backgroundColor: theme.backgroundSecondary }]}
              onPress={() => setCategoriesExpanded(!categoriesExpanded)}
            >
              <Feather 
                name={categoriesExpanded ? "chevron-up" : "chevron-down"} 
                size={24} 
                color={theme.textSecondary} 
              />
              <Text style={[styles.expandButtonText, { color: theme.textSecondary }]}>
                {categoriesExpanded ? "Voir moins" : `Voir plus (${categories.length - 8})`}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.sectionContainer}>
        <View style={styles.storageWrapper}>
          <Pressable 
            style={[styles.storageCardNew, { backgroundColor: theme.backgroundDefault }]}
            onPress={() => navigation.navigate("FileExplorer")}
          >
            <View style={styles.storageIconContainer}>
              <View style={[styles.storageIconCircle, { backgroundColor: isDark ? theme.backgroundTertiary : '#DBEAFE' }]}>
                <Feather name="smartphone" size={24} color={accentColor} />
              </View>
            </View>

            <View style={styles.storageContentNew}>
              <View style={styles.storageTitleRow}>
                <Text style={[styles.storageTitleNew, { color: theme.text }]}>{t('storage.deviceStorage')}</Text>
                <Feather name="chevron-right" size={18} color={theme.textSecondary} />
              </View>
              <View style={[styles.progressBarContainer, { backgroundColor: theme.backgroundTertiary }]}>
                <Animated.View 
                  style={[
                    styles.progressBarFill, 
                    { 
                      backgroundColor: storageInfo.usedPercent > 80 ? theme.error : accentColor
                    },
                    storageBarAnimatedStyle
                  ]} 
                />
              </View>
              <Text style={[styles.storageDetailNew, { color: theme.textSecondary }]}>
                {((storageInfo.totalGB - storageInfo.freeGB)).toFixed(2)}GB/{storageInfo.totalGB.toFixed(2)}GB
              </Text>
            </View>

            <Pressable 
              style={styles.analyzeButton}
              onPress={(e) => {
                e.stopPropagation();
                navigation.navigate("StorageAnalyzer");
              }}
            >
              <Feather name="search" size={20} color={accentColor} />
              <Text style={[styles.analyzeButtonText, { color: accentColor }]}>{t('common.analyze')}</Text>
            </Pressable>
          </Pressable>

          <Pressable 
            style={[styles.storageCardNew, { backgroundColor: theme.backgroundDefault }]}
            onPress={() => navigation.navigate("SharelCloud")}
          >
            <View style={styles.storageIconContainer}>
              <View style={[styles.storageIconCircle, { backgroundColor: isDark ? theme.backgroundTertiary : '#DCFCE7' }]}>
                <Feather name="cloud" size={24} color={theme.success} />
              </View>
            </View>

            <View style={styles.storageContentNew}>
              <View style={styles.storageTitleRow}>
                <Text style={[styles.storageTitleNew, { color: theme.text }]}>Mon espace Sharel</Text>
                <Feather name="chevron-right" size={18} color={theme.textSecondary} />
              </View>
              <View style={[styles.progressBarContainer, { backgroundColor: theme.backgroundTertiary }]}>
                <View 
                  style={[
                    styles.progressBarFill, 
                    { 
                      width: `${sharelStorageInfo.usedPercent}%`,
                      backgroundColor: theme.success
                    }
                  ]} 
                />
              </View>
              <Text style={[styles.storageDetailNew, { color: theme.textSecondary }]}>
                {sharelStorageInfo.usedGB.toFixed(2)}GB/{sharelStorageInfo.totalGB}GB
              </Text>
            </View>

            <Pressable style={styles.analyzeButton}>
              <Feather name="settings" size={20} color={theme.textSecondary} />
              <Text style={[styles.analyzeButtonText, { color: theme.textSecondary }]}>Gérer</Text>
            </Pressable>
          </Pressable>
        </View>
      </View>

      <View style={styles.sectionContainer}>
        <View style={[styles.recentWrapper, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.recentHeader}>
            <Text style={[styles.recentTitle, { color: theme.text }]}>FICHIERS RÉCENTS</Text>
            <Pressable 
              style={styles.recentViewAll}
              onPress={() => navigation.navigate("FileExplorer")}
            >
              <Feather name="eye" size={16} color={theme.textSecondary} />
              <Feather name="chevron-right" size={16} color={theme.textSecondary} />
            </Pressable>
          </View>

          {recentAlbums.length === 0 ? (
            <View style={styles.emptyRecent}>
              <Feather name="inbox" size={28} color={theme.textSecondary} />
              <Text style={[styles.emptyRecentText, { color: theme.textSecondary }]}>Aucun fichier récent</Text>
            </View>
          ) : (
            <View style={styles.recentAlbumsContainer}>
              {recentAlbums.map((album) => (
                <View key={album.id} style={styles.albumGroup}>
                  <View style={styles.albumHeader}>
                    <View style={[styles.albumIconCircle, { backgroundColor: album.color }]}>
                      <Feather name={album.icon as any} size={20} color="#FFF" />
                    </View>
                    <View style={styles.albumInfo}>
                      <Text style={[styles.albumTitle, { color: theme.text }]}>
                        {album.title}
                      </Text>
                      <Text style={[styles.albumDate, { color: theme.textSecondary }]}>
                        Aujourd'hui
                      </Text>
                    </View>
                  </View>
                  <View style={styles.filesGrid}>
                    {album.files.slice(0, 4).map((file, idx) => (
                      <Pressable
                        key={`${album.id}-${idx}`}
                        style={styles.fileThumbnail}
                        onPress={() => navigation.navigate("FileExplorer")}
                      >
                        {file.thumbnailUri ? (
                          <Image
                            source={{ uri: file.thumbnailUri }}
                            style={styles.thumbnailImage}
                            contentFit="cover"
                          />
                        ) : (
                          <View style={[styles.thumbnailPlaceholder, { backgroundColor: theme.backgroundTertiary }]}>
                            <Feather 
                              name={getFileIcon(file.filename)}
                              size={24}
                              color={getFileIconColor(file.filename)}
                            />
                          </View>
                        )}
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
      </Animated.ScrollView>

      <TransferFAB
        onSendP2P={() => {
          navigation.navigate("Preparation", { 
            selectedFiles: [],
            mode: "send" 
          });
        }}
        onReceiveP2P={() => {
          navigation.navigate("Preparation", { 
            mode: "receive" 
          });
        }}
        onSendHotspot={() => {
          navigation.navigate("HotspotSetup", { 
            selectedFiles: [],
            mode: "sender" 
          });
        }}
        onReceiveHotspot={() => {
          navigation.navigate("HotspotSetup", { 
            mode: "receiver" 
          });
        }}
        tabBarHeight={Platform.OS === "android" ? 60 + Math.max(insets.bottom, 16) : 68}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F7",
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingTop: 0,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: "#F5F5F7",
    zIndex: 100,
  },
  headerLeftSlot: {
    flex: 1,
    position: "relative",
    height: 56,
  },
  headerLogoGroup: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerActionButtons: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  headerActionBtn: {
    alignItems: "center",
    gap: 3,
  },
  headerActionCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
  },
  headerActionLabel: {
    fontSize: 10,
    fontWeight: "500",
    color: "#6B7280",
  },
  bellButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  appTitle: {
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  appTitleNormal: {
    color: "#000000",
    fontWeight: "900",
  },
  appTitleAccent: {
    color: "#EF4444",
    fontWeight: "900",
    fontStyle: "italic",
  },
  headerRightIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  greenIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
  },
  headerIcon: {
    padding: 8,
    position: "relative",
  },
  notificationBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "#EF4444",
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  connectButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#3B82F6",
    borderRadius: 20,
  },
  connectButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  actionsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: "#F5F5F7",
    zIndex: 150,
  },
  actionButton: {
    alignItems: "center",
    gap: 8,
  },
  actionCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  fileBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  fileBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "#0F172A",
  },
  sectionContainer: {
    paddingVertical: 12,
    alignItems: "center",
  },
  categoriesWrapper: {
    width: "96%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
  },
  categoriesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  categoryItem: {
    width: (SCREEN_WIDTH * 0.96 - 40 - 48) / 4,
    alignItems: "center",
    gap: 4,
  },
  categoryIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  categoryName: {
    fontSize: 11,
    fontWeight: "600",
    color: "#1F1F1F",
    textAlign: "center",
  },
  categoryCount: {
    fontSize: 10,
    fontWeight: "500",
    color: "#9CA3AF",
    textAlign: "center",
  },
  expandButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
    paddingVertical: 10,
    backgroundColor: "#F5F5F7",
    borderRadius: 12,
  },
  expandButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  storageWrapper: {
    width: "96%",
    gap: 12,
  },
  recentWrapper: {
    width: "96%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
  },
  recentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  recentTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0F172A",
  },
  recentViewAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  recentItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  recentThumbnail: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  recentThumbnailImage: {
    width: "100%",
    height: "100%",
  },
  recentFileName: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
    color: "#334155",
  },
  emptyRecent: {
    paddingVertical: 20,
    alignItems: "center",
    gap: 4,
  },
  emptyRecentText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#94A3B8",
  },
  emptyRecentSubtext: {
    fontSize: 12,
    fontWeight: "400",
    color: "#CBD5E1",
  },
  recentCategoriesGrid: {
    gap: 12,
  },
  recentCategoryBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    gap: 12,
  },
  recentCategoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  recentCategoryInfo: {
    flex: 1,
    gap: 2,
  },
  recentCategoryTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },
  recentCategoryCount: {
    fontSize: 12,
    fontWeight: "400",
    color: "#64748B",
  },
  recentFileItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  recentFileIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  recentFileInfo: {
    flex: 1,
    gap: 4,
  },
  recentFileNameText: {
    fontSize: 13,
    fontWeight: "500",
  },
  recentFileDetailText: {
    fontSize: 12,
    fontWeight: "400",
  },
  recentFileDateText: {
    fontSize: 12,
    fontWeight: "400",
    minWidth: 70,
    textAlign: "right",
  },
  recentAlbumsContainer: {
    gap: 24,
  },
  albumGroup: {
    gap: 12,
  },
  albumHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  albumIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  albumInfo: {
    flex: 1,
    gap: 2,
  },
  albumTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  albumDate: {
    fontSize: 12,
    fontWeight: "400",
  },
  filesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  fileThumbnail: {
    width: "48%",
    aspectRatio: 1,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#F0F0F0",
  },
  thumbnailImage: {
    width: "100%",
    height: "100%",
  },
  thumbnailPlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  authenticatedIconButton: {
    backgroundColor: "#3B82F6",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  userInitial: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  authenticatedBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#22C55E",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  userMenuContainer: {
    position: "absolute",
    left: 16,
    width: 280,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 16,
    overflow: "hidden",
  },
  userMenuHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
    backgroundColor: "#F8FAFC",
  },
  userMenuAvatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
  },
  userMenuInitial: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  userMenuInfo: {
    flex: 1,
    gap: 2,
  },
  userMenuName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  userMenuUsername: {
    fontSize: 13,
    fontWeight: "500",
    color: "#64748B",
  },
  userMenuDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
  },
  userMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  userMenuItemPressed: {
    backgroundColor: "#F1F5F9",
  },
  userMenuItemIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  userMenuItemText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: "#0F172A",
  },
  plusMenuWrapper: {
    position: "absolute",
    right: 16,
    alignItems: "flex-end",
  },
  plusMenuTriangle: {
    width: 0,
    height: 0,
    marginRight: 12,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 10,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  plusMenuContainer: {
    width: 260,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 16,
    paddingVertical: 8,
  },
  plusMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
  },
  plusMenuItemPressed: {
    backgroundColor: "#F1F5F9",
  },
  plusMenuItemText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: "#1F2937",
  },
  newBadge: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  newBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  storageCardNew: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  storageIconContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  storageIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#DBEAFE",
    justifyContent: "center",
    alignItems: "center",
  },
  storageContentNew: {
    flex: 1,
    gap: 6,
  },
  storageTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  storageTitleNew: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0F172A",
  },
  progressBarContainer: {
    width: "100%",
    height: 6,
    backgroundColor: "#E5E7EB",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  storageDetailNew: {
    fontSize: 13,
    fontWeight: "500",
    color: "#64748B",
  },
  analyzeButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    gap: 4,
  },
  analyzeButtonText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#64748B",
  },
  sharelActionCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  sharelLogoButton: {
    width: 44,
    height: 44,
    tintColor: "#FFFFFF",
  },
});
