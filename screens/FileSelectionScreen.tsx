import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { View, StyleSheet, Pressable, Text, ScrollView, FlatList, Alert, Platform, Image as RNImage, useWindowDimensions, LayoutAnimation, UIManager, TextInput, Modal, ActivityIndicator, PermissionsAndroid } from "react-native";
import { Feather } from "@expo/vector-icons";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HomeStackParamList } from "@/navigation/HomeStackNavigator";
import { Image } from "expo-image";
import * as MediaLibrary from "expo-media-library";
import * as Contacts from "expo-contacts";
import RecentFilesService from "@/services/RecentFilesService";
import FileStorageService, { StoredFile } from "@/services/FileStorageService";
import { MediaCacheService } from "@/services/MediaCacheService";
import { MockupDataService } from "@/services/MockupDataService";
import { useMediaPlayer } from "@/contexts/MediaPlayerContext";
import { MediaFile } from "@/types/media";
import * as FileSystem from "expo-file-system";
import { useTranslation } from "react-i18next";
import { nativeFileExplorer, AllFileCounts } from "@/services/NativeFileExplorer";
import nativeStorage from "@/services/NativeStorage";
import { nativeMediaGallery } from "@/services/NativeMediaGallery";
import { nativeContacts } from "@/services/NativeContacts";
import { nativeApps } from "@/services/NativeApps";
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming,
  withSequence,
  runOnJS,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  Layout
} from "react-native-reanimated";
import SwipeablePager, { SwipeablePagerRef } from "@/components/SwipeablePager";
import { useTheme } from "@/hooks/useTheme";
import { ThemeColors } from "@/constants/themes/types";

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

let ExpoAndroidAppList: any = null;
if (Platform.OS === 'android') {
  try {
    ExpoAndroidAppList = require('expo-android-app-list').ExpoAndroidAppList;
  } catch (e) {
    console.log('expo-android-app-list not available');
  }
}

type FileSelectionScreenNavigationProp = NativeStackNavigationProp<HomeStackParamList, "FileSelection">;

interface Props {
  navigation: FileSelectionScreenNavigationProp;
}

interface AppItem {
  id: string;
  name: string;
  size: string;
  sizeBytes: number;
  icon?: any;
  isInstalled?: boolean;
  isSelected?: boolean;
  uri?: string;
  mimeType?: string;
  type?: "app" | "photo" | "video" | "file" | "contact" | "audio" | "recent";
  phoneNumbers?: string[];
  emails?: string[];
  category?: string;
  isNew?: boolean;
  firstInstallTime?: number;
}

interface SelectedItem extends AppItem {
  globalKey: string;
}

const TAB_IDS = {
  CONTACTS: "CONTACTS",
  FILES: "FICHIERS",
  APPLICATIONS: "APPLICATIONS",
  VIDEOS: "VIDÉOS",
  PHOTOS: "PHOTOS",
  MUSIC: "MUSIQUES",
} as const;

const TAB_ORDER = [TAB_IDS.CONTACTS, TAB_IDS.FILES, TAB_IDS.APPLICATIONS, TAB_IDS.VIDEOS, TAB_IDS.PHOTOS, TAB_IDS.MUSIC];

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const globalCacheRef = {
  contacts: { items: [] as AppItem[], loaded: false },
  files: { items: [] as AppItem[], loaded: false },
  applications: { items: [] as AppItem[], loaded: false },
  videos: { items: [] as AppItem[], loaded: false },
  photos: { items: [] as AppItem[], loaded: false },
  music: { items: [] as AppItem[], loaded: false },
  apkFiles: { items: [] as AppItem[], loaded: false },
};

export default function FileSelectionScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();
  const { openMedia, setImageGallery, setImageIndex, setImageViewerVisible } = useMediaPlayer();
  const { theme, isDark, accentColor } = useTheme();
  const pagerRef = useRef<SwipeablePagerRef>(null);
  
  const themedStyles = useMemo(() => createThemedStyles(theme, accentColor), [theme, accentColor]);
  
  const getTabLabel = useCallback((tabId: string): string => {
    switch (tabId) {
      case TAB_IDS.CONTACTS: return t('fileSelection.contacts');
      case TAB_IDS.FILES: return t('fileSelection.files');
      case TAB_IDS.APPLICATIONS: return t('fileSelection.applications');
      case TAB_IDS.VIDEOS: return t('fileSelection.videos');
      case TAB_IDS.PHOTOS: return t('fileSelection.photos');
      case TAB_IDS.MUSIC: return t('fileSelection.music');
      default: return tabId;
    }
  }, [t]);
  
  const [activeTabIndex, setActiveTabIndex] = useState(2);
  const [filter, setFilter] = useState<"installed" | "not-installed">("installed");
  const [loading, setLoading] = useState(false);
  const [mediaPermission, setMediaPermission] = useState(false);
  const [contactsPermission, setContactsPermission] = useState(false);
  const [sectionsExpanded, setSectionsExpanded] = useState<{ [key: string]: boolean }>({ 
    nouveau: true, 
    applications: true 
  });
  const [showSelectedMenu, setShowSelectedMenu] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchIndexing, setSearchIndexing] = useState(false);
  const tabScrollViewRef = useRef<ScrollView>(null);
  const searchIndexRef = useRef<Map<string, AppItem & { category: string }>>(new Map());
  const searchCacheRef = useRef<Map<string, { [category: string]: AppItem[] }>>(new Map());
  const initializedRef = useRef(false);
  
  const [contactsItems, setContactsItems] = useState<AppItem[]>([]);
  const [filesItems, setFilesItems] = useState<AppItem[]>([]);
  const [applicationsItems, setApplicationsItems] = useState<AppItem[]>([]);
  const [videosItems, setVideosItems] = useState<AppItem[]>([]);
  const [photosItems, setPhotosItems] = useState<AppItem[]>([]);
  const [musicItems, setMusicItems] = useState<AppItem[]>([]);
  const [apkFilesItems, setApkFilesItems] = useState<AppItem[]>([]);
  
  const [globalSelections, setGlobalSelections] = useState<Map<string, SelectedItem>>(new Map());
  const [photoSubTab, setPhotoSubTab] = useState<"coffre-fort" | "recents" | "dossiers">("dossiers");
  const [photoAlbums, setPhotoAlbums] = useState<{id: string; name: string; count: number; items: AppItem[]}[]>([]);
  const [expandedAlbums, setExpandedAlbums] = useState<{ [key: string]: boolean }>({});
  
  const [fileCounts, setFileCounts] = useState<AllFileCounts>({ images: 0, videos: 0, audio: 0, documents: 0, apk: 0, zip: 0, downloads: 0, others: 0, timestamp: 0 });
  const [storageStats, setStorageStats] = useState({ totalSpace: 0, usedSpace: 0, freeSpace: 0, usedPercentage: 0 });
  const [filesTabLoading, setFilesTabLoading] = useState(false);
  const [filesTabLoaded, setFilesTabLoaded] = useState(false);

  const numColumns = 4;
  const numColumnsPhotos = 3;
  const itemGap = 4;
  
  const itemWidth = useMemo(() => {
    const totalContainerPadding = 24 + 16 + 2;
    const totalGaps = itemGap * (numColumns - 1);
    const availableWidth = screenWidth - totalContainerPadding - totalGaps;
    return Math.floor(availableWidth / numColumns);
  }, [screenWidth]);

  const photoItemWidth = useMemo(() => {
    const totalContainerPadding = 32;
    const totalGaps = itemGap * (numColumnsPhotos - 1);
    const availableWidth = screenWidth - totalContainerPadding - totalGaps;
    return Math.floor(availableWidth / numColumnsPhotos);
  }, [screenWidth]);

  const globalSelectedCount = useMemo(() => {
    return globalSelections.size;
  }, [globalSelections]);

  const getAllSelectedItems = useCallback((): SelectedItem[] => {
    return Array.from(globalSelections.values());
  }, [globalSelections]);

  const getTotalSelectedSize = useCallback(() => {
    const totalBytes = getAllSelectedItems().reduce((sum, item) => sum + (item.sizeBytes || 0), 0);
    return formatFileSize(totalBytes);
  }, [getAllSelectedItems]);

  const createGlobalKey = (category: string, itemId: string): string => {
    return `${category}::${itemId}`;
  };

  const parseGlobalKey = (globalKey: string): { category: string; itemId: string } => {
    const [category, ...idParts] = globalKey.split('::');
    return { category, itemId: idParts.join('::') };
  };

  const activeTab = TAB_ORDER[activeTabIndex];

  const getItemsForTab = useCallback((tabId: string): AppItem[] => {
    switch (tabId) {
      case TAB_IDS.CONTACTS: return contactsItems;
      case TAB_IDS.FILES: return filesItems;
      case TAB_IDS.APPLICATIONS: return filter === "not-installed" ? apkFilesItems : applicationsItems;
      case TAB_IDS.VIDEOS: return videosItems;
      case TAB_IDS.PHOTOS: return photosItems;
      case TAB_IDS.MUSIC: return musicItems;
      default: return [];
    }
  }, [contactsItems, filesItems, applicationsItems, videosItems, photosItems, musicItems, apkFilesItems, filter]);

  const setItemsForTab = useCallback((tabId: string, items: AppItem[]) => {
    switch (tabId) {
      case TAB_IDS.CONTACTS: 
        setContactsItems(items);
        globalCacheRef.contacts = { items, loaded: true };
        break;
      case TAB_IDS.FILES: 
        setFilesItems(items);
        globalCacheRef.files = { items, loaded: true };
        break;
      case TAB_IDS.APPLICATIONS: 
        setApplicationsItems(items);
        globalCacheRef.applications = { items, loaded: true };
        break;
      case TAB_IDS.VIDEOS: 
        setVideosItems(items);
        globalCacheRef.videos = { items, loaded: true };
        break;
      case TAB_IDS.PHOTOS: 
        setPhotosItems(items);
        globalCacheRef.photos = { items, loaded: true };
        break;
      case TAB_IDS.MUSIC: 
        setMusicItems(items);
        globalCacheRef.music = { items, loaded: true };
        break;
    }
  }, []);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      requestAllPermissions();
      loadAllContent();
    }
  }, []);

  useEffect(() => {
    const tabIndex = activeTabIndex;
    if (tabScrollViewRef.current) {
      const tabWidth = 120;
      const scrollPosition = Math.max(0, (tabIndex * tabWidth) - (screenWidth / 2) + (tabWidth / 2));
      tabScrollViewRef.current?.scrollTo({
        x: scrollPosition,
        animated: true,
      });
    }
  }, [activeTabIndex, screenWidth]);

  const requestAllPermissions = async () => {
    if (Platform.OS === 'web') return;
    
    try {
      // Request media permission via Android PermissionsAndroid for build compatibility
      if (Platform.OS === 'android') {
        const androidVersion = Platform.Version as number;
        
        // For Android 13+ use granular media permissions
        if (androidVersion >= 33) {
          const permissions = [
            PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
            PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
            PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO,
          ];
          
          const results = await PermissionsAndroid.requestMultiple(permissions);
          const allGranted = Object.values(results).every(
            r => r === PermissionsAndroid.RESULTS.GRANTED
          );
          setMediaPermission(allGranted);
        } else {
          // For older Android versions
          const result = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
          );
          setMediaPermission(result === PermissionsAndroid.RESULTS.GRANTED);
        }
        
        // Request contacts permission
        const contactsResult = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_CONTACTS
        );
        setContactsPermission(contactsResult === PermissionsAndroid.RESULTS.GRANTED);
      } else {
        // iOS fallback - use expo plugins
        const mediaStatus = await MediaLibrary.getPermissionsAsync();
        if (!mediaStatus.granted && mediaStatus.canAskAgain) {
          const { status } = await MediaLibrary.requestPermissionsAsync();
          setMediaPermission(status === 'granted');
        } else {
          setMediaPermission(mediaStatus.granted);
        }

        const contactsStatus = await Contacts.getPermissionsAsync();
        if (!contactsStatus.granted && contactsStatus.canAskAgain) {
          const { status } = await Contacts.requestPermissionsAsync();
          setContactsPermission(status === 'granted');
        } else {
          setContactsPermission(contactsStatus.granted);
        }
      }
    } catch (error) {
      console.error("Error requesting permissions:", error);
    }
  };

  const requestMediaPermission = async () => {
    if (Platform.OS === 'android') {
      const androidVersion = Platform.Version as number;
      
      if (androidVersion >= 33) {
        const permissions = [
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO,
        ];
        
        const results = await PermissionsAndroid.requestMultiple(permissions);
        const allGranted = Object.values(results).every(
          r => r === PermissionsAndroid.RESULTS.GRANTED
        );
        setMediaPermission(allGranted);
        return allGranted;
      } else {
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
        );
        const granted = result === PermissionsAndroid.RESULTS.GRANTED;
        setMediaPermission(granted);
        return granted;
      }
    } else {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      setMediaPermission(status === 'granted');
      return status === 'granted';
    }
  };

  const requestContactsPermission = async () => {
    if (Platform.OS === 'android') {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_CONTACTS
      );
      const granted = result === PermissionsAndroid.RESULTS.GRANTED;
      setContactsPermission(granted);
      return granted;
    } else {
      const { status } = await Contacts.requestPermissionsAsync();
      setContactsPermission(status === 'granted');
      return status === 'granted';
    }
  };

  const loadAllContent = async () => {
    setLoading(true);
    
    const [apps, photos, videos, music, contacts, files, apks] = await Promise.all([
      loadApplications(),
      loadPhotos(),
      loadVideos(),
      loadMusic(),
      loadContacts(),
      loadStoredFiles(),
      loadApkFiles(),
    ]);
    
    setApplicationsItems(apps);
    globalCacheRef.applications = { items: apps, loaded: true };
    
    setPhotosItems(photos);
    globalCacheRef.photos = { items: photos, loaded: true };
    
    setVideosItems(videos);
    globalCacheRef.videos = { items: videos, loaded: true };
    
    setMusicItems(music);
    globalCacheRef.music = { items: music, loaded: true };
    
    setContactsItems(contacts);
    globalCacheRef.contacts = { items: contacts, loaded: true };
    
    setFilesItems(files);
    globalCacheRef.files = { items: files, loaded: true };
    
    setApkFilesItems(apks);
    globalCacheRef.apkFiles = { items: apks, loaded: true };
    
    setLoading(false);
  };

  const loadStoredFiles = async (): Promise<AppItem[]> => {
    try {
      const storedFiles = await FileStorageService.getFiles();
      return storedFiles.map(file => ({
        id: file.id,
        name: file.name,
        size: file.size,
        sizeBytes: file.sizeBytes,
        uri: file.uri,
        mimeType: file.mimeType,
        isSelected: false,
        type: "file" as const,
      }));
    } catch (error) {
      console.error("Error loading stored files:", error);
      return [];
    }
  };

  const loadApkFiles = async (): Promise<AppItem[]> => {
    if (Platform.OS === 'web') {
      return MockupDataService.getApps('not-installed').map(app => ({
        id: app.id,
        name: app.name,
        size: formatFileSize(app.size),
        sizeBytes: app.size,
        icon: app.icon,
        isInstalled: false,
        isSelected: false,
        type: 'app' as const,
        uri: app.uri,
        mimeType: 'application/vnd.android.package-archive',
      }));
    }

    try {
      if (nativeApps.isAvailable()) {
        const apkFiles = await nativeApps.getApkFiles();
        return apkFiles.map(apk => ({
          id: apk.id,
          name: apk.name,
          size: formatFileSize(apk.size),
          sizeBytes: apk.size,
          uri: apk.uri,
          isInstalled: false,
          isSelected: false,
          type: 'app' as const,
          mimeType: apk.mimeType,
        }));
      }
      
      const apkItems: AppItem[] = [];
      
      const downloadDir = "/storage/emulated/0/Download/";
      const sharelDir = "/storage/emulated/0/Sharel/";
      const externalDownload = "/storage/emulated/0/Download/";
      
      const directories = [downloadDir, sharelDir, externalDownload];
      
      for (const dir of directories) {
        try {
          const dirInfo = await FileSystem.getInfoAsync(dir);
          if (dirInfo.exists) {
            const files = await FileSystem.readDirectoryAsync(dir);
            const apkFilesInDir = files.filter(file => 
              file.toLowerCase().endsWith('.apk') || 
              file.toLowerCase().endsWith('.xapk') ||
              file.toLowerCase().endsWith('.apks') ||
              file.toLowerCase().endsWith('.apkm')
            );
            
            for (const file of apkFilesInDir) {
              try {
                const fileInfo = await FileSystem.getInfoAsync(dir + file);
                const size = (fileInfo as any).size || 0;
                apkItems.push({
                  id: `apk-${dir}-${file}`,
                  name: file.replace(/\.(apk|xapk|apks|apkm)$/i, ''),
                  size: formatFileSize(size),
                  sizeBytes: size,
                  uri: dir + file,
                  isInstalled: false,
                  isSelected: false,
                  type: 'app' as const,
                  mimeType: 'application/vnd.android.package-archive',
                });
              } catch (e) {
                console.log('Error reading APK file:', file);
              }
            }
          }
        } catch (e) {
          console.log('Directory not accessible:', dir);
        }
      }
      
      return apkItems;
    } catch (error) {
      console.error("Error loading APK files:", error);
      return [];
    }
  };

  const toggleSection = (section: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSectionsExpanded(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const NEW_APP_THRESHOLD_DAYS = 7;
  
  const isRecentlyInstalled = (installTime: number): boolean => {
    if (!installTime) return false;
    const now = Date.now();
    const thresholdMs = NEW_APP_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
    return (now - installTime) <= thresholdMs;
  };

  const loadApplications = async (): Promise<AppItem[]> => {
    if (Platform.OS === 'web') {
      const mockApps = MockupDataService.getApps(filter);
      return mockApps.map(app => ({
        id: app.id,
        name: app.name,
        size: formatFileSize(app.size),
        sizeBytes: app.size,
        icon: app.icon,
        isInstalled: app.isInstalled,
        isSelected: false,
        type: 'app' as const,
        isNew: app.isNew,
        firstInstallTime: app.firstInstallTime,
      }));
    }

    try {
      if (nativeApps.isAvailable()) {
        const apps = await nativeApps.getInstalledApps();
        
        const appItems: AppItem[] = apps.map((app) => {
          const apkSize = app.size || 0;
          const apkPath = app.sourceDir || '';
          const firstInstallTime = app.firstInstallTime || 0;
          const isNew = isRecentlyInstalled(firstInstallTime);
          
          return {
            id: app.packageName,
            name: app.appName || app.packageName,
            size: apkSize > 0 ? formatFileSize(apkSize) : "",
            sizeBytes: apkSize,
            icon: undefined,
            uri: apkPath ? `file://${apkPath}` : undefined,
            isInstalled: true,
            isSelected: false,
            type: "app" as const,
            isNew: isNew,
            firstInstallTime: firstInstallTime,
          };
        });

        loadAppIconsBatchNative(appItems);
        return appItems;
      }
      
      if (!ExpoAndroidAppList) return [];
      
      const apps = await ExpoAndroidAppList.getAll();
      
      const appItems: AppItem[] = apps.map((app: any) => {
        const apkSize = app.size || 0;
        const apkPath = app.sourceDir || app.apkPath || '';
        const firstInstallTime = app.firstInstallTime || 0;
        const isNew = isRecentlyInstalled(firstInstallTime);
        
        return {
          id: app.packageName,
          name: app.appName || app.packageName,
          size: apkSize > 0 ? formatFileSize(apkSize) : "",
          sizeBytes: apkSize,
          icon: undefined,
          uri: apkPath ? `file://${apkPath}` : undefined,
          isInstalled: true,
          isSelected: false,
          type: "app" as const,
          isNew: isNew,
          firstInstallTime: firstInstallTime,
        };
      });

      loadAppIconsBatch(appItems);

      return appItems;
    } catch (error) {
      console.error("Error loading applications:", error);
      return [];
    }
  };

  const loadAppIconsBatchNative = async (appItems: AppItem[]) => {
    if (!nativeApps.isAvailable()) return;
    
    const BATCH_SIZE = 20;
    const updatedItems = [...appItems];
    
    for (let i = 0; i < appItems.length; i += BATCH_SIZE) {
      const batch = appItems.slice(i, i + BATCH_SIZE);
      const packageNames = batch.map(app => app.id);
      
      try {
        const icons = await nativeApps.getAppIconsBatch(packageNames, 64);
        
        batch.forEach((app, batchIndex) => {
          const index = i + batchIndex;
          const icon = icons[app.id];
          if (icon) {
            updatedItems[index] = {
              ...updatedItems[index],
              icon: `data:image/png;base64,${icon}`,
            };
          }
        });

        setApplicationsItems(prevItems => {
          return prevItems.map((item, idx) => {
            if (idx >= i && idx < i + BATCH_SIZE && updatedItems[idx]?.icon) {
              return { ...item, icon: updatedItems[idx].icon };
            }
            return item;
          });
        });
      } catch (error) {
        console.error("Error loading app icons batch:", error);
      }
    }

    globalCacheRef.applications = { items: updatedItems, loaded: true };
  };

  const loadAppIconsBatch = async (appItems: AppItem[]) => {
    if (!ExpoAndroidAppList) return;
    
    const BATCH_SIZE = 10;
    const updatedItems = [...appItems];
    
    for (let i = 0; i < appItems.length; i += BATCH_SIZE) {
      const batch = appItems.slice(i, i + BATCH_SIZE);
      
      await Promise.all(
        batch.map(async (app, batchIndex) => {
          const index = i + batchIndex;
          try {
            const icon = await ExpoAndroidAppList.getAppIcon(app.id, 64);
            if (icon) {
              updatedItems[index] = {
                ...updatedItems[index],
                icon: `data:image/png;base64,${icon}`,
              };
            }
          } catch (error) {
          }
        })
      );

      setApplicationsItems(prevItems => {
        return prevItems.map((item, idx) => {
          if (idx >= i && idx < i + BATCH_SIZE && updatedItems[idx]?.icon) {
            return { ...item, icon: updatedItems[idx].icon };
          }
          return item;
        });
      });
    }

    globalCacheRef.applications = { items: updatedItems, loaded: true };
  };

  const loadPhotos = async (): Promise<AppItem[]> => {
    if (Platform.OS === 'web') {
      const mockImages = MockupDataService.getImages();
      return mockImages.map(img => ({
        id: img.id,
        name: img.name,
        size: formatFileSize(img.size),
        sizeBytes: img.size,
        uri: img.uri,
        isSelected: false,
        type: 'photo' as const,
      }));
    }

    const hasPermission = mediaPermission || await requestMediaPermission();
    if (!hasPermission) {
      return [];
    }

    try {
      if (nativeMediaGallery.isAvailable()) {
        const items = await nativeMediaGallery.getImages(100, 0);
        return items.map((item) => ({
          id: item.id,
          name: item.filename,
          size: item.fileSize ? formatFileSize(item.fileSize) : "",
          sizeBytes: item.fileSize || 0,
          uri: item.uri,
          isSelected: false,
          type: "photo" as const,
        }));
      }
      const result = await MediaCacheService.getPhotos(100);
      return result.items.map((item) => ({
        id: item.id,
        name: item.filename,
        size: item.fileSize ? formatFileSize(item.fileSize) : "",
        sizeBytes: item.fileSize || 0,
        uri: item.uri,
        isSelected: false,
        type: "photo" as const,
      }));
    } catch (error) {
      console.error("Error loading photos:", error);
      return [];
    }
  };

  const loadVideos = async (): Promise<AppItem[]> => {
    if (Platform.OS === 'web') {
      const mockVideos = MockupDataService.getVideos();
      return mockVideos.map(vid => {
        const mins = Math.floor(vid.duration / 60);
        const secs = Math.floor(vid.duration % 60);
        const durationText = `${mins}:${secs.toString().padStart(2, '0')}`;
        return {
          id: vid.id,
          name: vid.name,
          size: `${durationText} - ${formatFileSize(vid.size)}`,
          sizeBytes: vid.size,
          uri: vid.uri,
          isSelected: false,
          type: 'video' as const,
        };
      });
    }

    const hasPermission = mediaPermission || await requestMediaPermission();
    if (!hasPermission) {
      return [];
    }

    try {
      if (nativeMediaGallery.isAvailable()) {
        const items = await nativeMediaGallery.getVideos(100, 0);
        return items.map((item) => {
          const duration = item.duration || 0;
          const mins = Math.floor(duration / 60);
          const secs = Math.floor(duration % 60);
          const durationText = `${mins}:${secs.toString().padStart(2, '0')}`;
          return {
            id: item.id,
            name: item.filename,
            size: item.fileSize ? `${durationText} - ${formatFileSize(item.fileSize)}` : durationText,
            sizeBytes: item.fileSize || 0,
            uri: item.uri,
            isSelected: false,
            type: "video" as const,
          };
        });
      }
      const result = await MediaCacheService.getVideos(100);
      return result.items.map((item) => {
        const duration = item.duration || 0;
        const mins = Math.floor(duration / 60);
        const secs = Math.floor(duration % 60);
        const durationText = `${mins}:${secs.toString().padStart(2, '0')}`;
        return {
          id: item.id,
          name: item.filename,
          size: item.fileSize ? `${durationText} - ${formatFileSize(item.fileSize)}` : durationText,
          sizeBytes: item.fileSize || 0,
          uri: item.uri,
          isSelected: false,
          type: "video" as const,
        };
      });
    } catch (error) {
      console.error("Error loading videos:", error);
      return [];
    }
  };

  const loadMusic = async (): Promise<AppItem[]> => {
    if (Platform.OS === 'web') {
      const mockAudio = MockupDataService.getAudio();
      return mockAudio.map(aud => {
        const mins = Math.floor(aud.duration / 60);
        const secs = Math.floor(aud.duration % 60);
        const durationText = `${mins}:${secs.toString().padStart(2, '0')}`;
        return {
          id: aud.id,
          name: aud.name,
          size: `${durationText} - ${formatFileSize(aud.size)}`,
          sizeBytes: aud.size,
          uri: aud.uri,
          isSelected: false,
          type: 'audio' as const,
        };
      });
    }

    const hasPermission = mediaPermission || await requestMediaPermission();
    if (!hasPermission) {
      return [];
    }

    try {
      if (nativeMediaGallery.isAvailable()) {
        const items = await nativeMediaGallery.getAudio(100, 0);
        return items.map((item) => {
          const duration = item.duration || 0;
          const mins = Math.floor(duration / 60);
          const secs = Math.floor(duration % 60);
          const durationText = `${mins}:${secs.toString().padStart(2, '0')}`;
          return {
            id: item.id,
            name: item.filename,
            size: item.fileSize ? `${durationText} - ${formatFileSize(item.fileSize)}` : durationText,
            sizeBytes: item.fileSize || 0,
            uri: item.uri,
            isSelected: false,
            type: "audio" as const,
          };
        });
      }
      const result = await MediaCacheService.getAudio(100);
      return result.items.map((item) => {
        const duration = item.duration || 0;
        const mins = Math.floor(duration / 60);
        const secs = Math.floor(duration % 60);
        const durationText = `${mins}:${secs.toString().padStart(2, '0')}`;
        return {
          id: item.id,
          name: item.filename,
          size: item.fileSize ? `${durationText} - ${formatFileSize(item.fileSize)}` : durationText,
          sizeBytes: item.fileSize || 0,
          uri: item.uri,
          isSelected: false,
          type: "audio" as const,
        };
      });
    } catch (error) {
      console.error("Error loading music:", error);
      return [];
    }
  };

  const loadContacts = async (): Promise<AppItem[]> => {
    if (Platform.OS === 'web') {
      return [
        { id: 'contact-1', name: 'Marie Dupont', size: '+33 6 12 34 56 78', sizeBytes: 0, isSelected: false, type: 'contact', phoneNumbers: ['+33 6 12 34 56 78'], emails: ['marie@example.com'] },
        { id: 'contact-2', name: 'Jean Martin', size: '+33 6 23 45 67 89', sizeBytes: 0, isSelected: false, type: 'contact', phoneNumbers: ['+33 6 23 45 67 89'], emails: ['jean@example.com'] },
        { id: 'contact-3', name: 'Sophie Bernard', size: '+33 6 34 56 78 90', sizeBytes: 0, isSelected: false, type: 'contact', phoneNumbers: ['+33 6 34 56 78 90'], emails: ['sophie@example.com'] },
        { id: 'contact-4', name: 'Pierre Dubois', size: '+33 6 45 67 89 01', sizeBytes: 0, isSelected: false, type: 'contact', phoneNumbers: ['+33 6 45 67 89 01'], emails: ['pierre@example.com'] },
        { id: 'contact-5', name: 'Claire Petit', size: '+33 6 56 78 90 12', sizeBytes: 0, isSelected: false, type: 'contact', phoneNumbers: ['+33 6 56 78 90 12'], emails: ['claire@example.com'] },
      ];
    }

    const hasPermission = contactsPermission || await requestContactsPermission();
    if (!hasPermission) {
      return [];
    }

    try {
      if (nativeContacts.isAvailable()) {
        const contacts = await nativeContacts.getAllContacts();
        return contacts.map((contact) => {
          const phoneNumbers = contact.phoneNumbers?.map(p => p.number) || [];
          const emails = contact.emails?.map(e => e.email) || [];
          
          return {
            id: contact.id,
            name: contact.name || t('fileSelection.noNameContact'),
            size: phoneNumbers.length > 0 ? phoneNumbers[0] : t('fileSelection.noNumber'),
            sizeBytes: 0,
            isSelected: false,
            type: "contact" as const,
            phoneNumbers,
            emails,
          };
        });
      }
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
      });

      const contactItems: AppItem[] = data.map((contact) => {
        const phoneNumbers = contact.phoneNumbers?.map(p => p.number || '') || [];
        const emails = contact.emails?.map(e => e.email || '') || [];
        
        return {
          id: contact.id,
          name: contact.name || t('fileSelection.noNameContact'),
          size: phoneNumbers.length > 0 ? phoneNumbers[0] : t('fileSelection.noNumber'),
          sizeBytes: 0,
          isSelected: false,
          type: "contact" as const,
          phoneNumbers,
          emails,
        };
      });

      return contactItems;
    } catch (error) {
      console.error("Error loading contacts:", error);
      return [];
    }
  };

  const openFileExplorer = () => {
    navigation.navigate("FileExplorer");
  };

  const loadFilesTabData = useCallback(async () => {
    if (filesTabLoading) return;
    setFilesTabLoading(true);
    try {
      if (Platform.OS === 'android') {
        const [counts, storage] = await Promise.all([
          nativeFileExplorer.getAllFileCounts(false),
          nativeStorage.getStorageInfo(),
        ]);
        setFileCounts(counts);
        if (storage) {
          const totalGB = storage.totalSpace / (1024 * 1024 * 1024);
          const usedGB = storage.usedSpace / (1024 * 1024 * 1024);
          const usedPercentage = totalGB > 0 ? (usedGB / totalGB) * 100 : 0;
          setStorageStats({
            totalSpace: storage.totalSpace,
            usedSpace: storage.usedSpace,
            freeSpace: storage.freeSpace,
            usedPercentage,
          });
        }
      } else {
        const freeSpaceInfo = await FileSystem.getFreeDiskStorageAsync();
        const totalSpaceInfo = await FileSystem.getTotalDiskCapacityAsync();
        const usedSpace = totalSpaceInfo - freeSpaceInfo;
        const usedPercentage = totalSpaceInfo > 0 ? (usedSpace / totalSpaceInfo) * 100 : 0;
        setStorageStats({
          totalSpace: totalSpaceInfo,
          usedSpace: usedSpace,
          freeSpace: freeSpaceInfo,
          usedPercentage,
        });
      }
    } catch (error) {
      console.error("Error loading files tab data:", error);
    } finally {
      setFilesTabLoading(false);
      setFilesTabLoaded(true);
    }
  }, [filesTabLoading]);

  useEffect(() => {
    if (activeTab === TAB_IDS.FILES && !filesTabLoading && !filesTabLoaded) {
      loadFilesTabData();
    }
  }, [activeTab, loadFilesTabData, filesTabLoading, filesTabLoaded]);

  const formatStorageSize = useCallback((bytes: number): string => {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(2)}GB`;
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0KB";
    const mb = bytes / (1024 * 1024);
    const kb = bytes / 1024;
    return mb >= 1 ? `${mb.toFixed(1)}MB` : `${kb.toFixed(1)}KB`;
  };

  const updateItemSelection = useCallback((tabId: string, itemId: string, isSelected: boolean) => {
    const updateFn = (prevItems: AppItem[]) => 
      prevItems.map(item => item.id === itemId ? { ...item, isSelected } : item);
    
    switch (tabId) {
      case TAB_IDS.CONTACTS: setContactsItems(updateFn); break;
      case TAB_IDS.FILES: setFilesItems(updateFn); break;
      case TAB_IDS.APPLICATIONS: 
        if (filter === "not-installed") {
          setApkFilesItems(updateFn);
        } else {
          setApplicationsItems(updateFn);
        }
        break;
      case TAB_IDS.VIDEOS: setVideosItems(updateFn); break;
      case TAB_IDS.PHOTOS: setPhotosItems(updateFn); break;
      case TAB_IDS.MUSIC: setMusicItems(updateFn); break;
    }
  }, [filter]);

  const toggleItemSelection = useCallback((item: AppItem, tabId: string) => {
    const globalKey = createGlobalKey(tabId, item.id);
    const newIsSelected = !item.isSelected;
    
    setGlobalSelections(prev => {
      const newSelections = new Map(prev);
      
      if (newSelections.has(globalKey)) {
        newSelections.delete(globalKey);
      } else {
        const selectedItem: SelectedItem = {
          ...item,
          category: tabId,
          globalKey: globalKey,
        };
        newSelections.set(globalKey, selectedItem);
      }
      
      return newSelections;
    });

    updateItemSelection(tabId, item.id, newIsSelected);
  }, [updateItemSelection]);

  const removeFromGlobalSelection = useCallback((globalKey: string) => {
    setGlobalSelections(prev => {
      const newSelections = new Map(prev);
      newSelections.delete(globalKey);
      return newSelections;
    });

    const { category, itemId } = parseGlobalKey(globalKey);
    updateItemSelection(category, itemId, false);
  }, [updateItemSelection]);

  const toggleSectionSelection = (sectionType: 'nouveau' | 'applications') => {
    const items = applicationsItems;
    const sectionItems = sectionType === 'nouveau' 
      ? items.filter(item => item.isNew)
      : items.filter(item => !item.isNew);
    
    const allSelected = sectionItems.every(item => item.isSelected);
    
    setGlobalSelections(prev => {
      const newSelections = new Map(prev);
      
      sectionItems.forEach(item => {
        const globalKey = createGlobalKey(TAB_IDS.APPLICATIONS, item.id);
        if (allSelected) {
          newSelections.delete(globalKey);
        } else {
          const selectedItem: SelectedItem = {
            ...item,
            category: TAB_IDS.APPLICATIONS,
            globalKey: globalKey,
          };
          newSelections.set(globalKey, selectedItem);
        }
      });
      
      return newSelections;
    });

    setApplicationsItems(prevItems => {
      return prevItems.map(item => {
        const isInSection = sectionType === 'nouveau' ? item.isNew : !item.isNew;
        if (isInSection) {
          return { ...item, isSelected: !allSelected };
        }
        return item;
      });
    });
  };

  const clearAllSelections = () => {
    setGlobalSelections(new Map());
    
    setContactsItems(prev => prev.map(item => ({ ...item, isSelected: false })));
    setFilesItems(prev => prev.map(item => ({ ...item, isSelected: false })));
    setApplicationsItems(prev => prev.map(item => ({ ...item, isSelected: false })));
    setVideosItems(prev => prev.map(item => ({ ...item, isSelected: false })));
    setPhotosItems(prev => prev.map(item => ({ ...item, isSelected: false })));
    setMusicItems(prev => prev.map(item => ({ ...item, isSelected: false })));
    setApkFilesItems(prev => prev.map(item => ({ ...item, isSelected: false })));
  };

  const handleNext = () => {
    const selectedItems = getAllSelectedItems();
    
    if (selectedItems.length === 0) {
      Alert.alert(
        t('fileSelection.noFileSelected'),
        t('fileSelection.selectAtLeastOne'),
        [{ text: "OK" }]
      );
      return;
    }
    
    const selectedFilesData = selectedItems.map(item => ({
      id: item.id,
      name: item.name,
      size: item.size,
      sizeBytes: item.sizeBytes,
      uri: item.uri || '',
    }));
    
    navigation.navigate("Preparation", { selectedFiles: selectedFilesData });
  };

  const handleLongPress = useCallback((item: AppItem, allItems?: AppItem[]) => {
    if (!item.uri) return;

    const mediaFile: MediaFile = {
      id: item.id,
      uri: item.uri,
      name: item.name,
      type: item.type === 'video' ? 'video' : item.type === 'audio' ? 'audio' : item.type === 'photo' ? 'image' : 'video',
      mimeType: item.mimeType || (item.type === 'video' ? 'video/mp4' : item.type === 'audio' ? 'audio/mpeg' : 'image/jpeg'),
      size: item.sizeBytes,
    };

    if (item.type === 'photo' && allItems) {
      const imageItems = allItems.filter(i => i.type === 'photo' && i.uri);
      const imageFiles: MediaFile[] = imageItems.map(i => ({
        id: i.id,
        uri: i.uri!,
        name: i.name,
        type: 'image' as const,
        mimeType: i.mimeType || 'image/jpeg',
        size: i.sizeBytes,
      }));
      const currentIndex = imageItems.findIndex(i => i.id === item.id);
      setImageGallery(imageFiles);
      setImageIndex(currentIndex >= 0 ? currentIndex : 0);
      setImageViewerVisible(true);
    } else {
      openMedia(mediaFile);
    }
  }, [openMedia, setImageGallery, setImageIndex, setImageViewerVisible]);

  const onPageSelected = useCallback((index: number) => {
    setActiveTabIndex(index);
  }, []);

  const onTabPress = useCallback((index: number) => {
    setActiveTabIndex(index);
    pagerRef.current?.setPage(index);
  }, []);

  const getIconName = (type?: string): any => {
    switch (type) {
      case "app": return "smartphone";
      case "photo": return "image";
      case "video": return "video";
      case "file": return "file";
      case "audio": return "music";
      case "contact": return "user";
      default: return "package";
    }
  };

  const getIconColor = useCallback((name: string): string => {
    const colors = [theme.primary, theme.success, theme.warning, theme.error, theme.purple, theme.pink];
    const index = name.length % colors.length;
    return colors[index];
  }, [theme]);

  const getCategoryLabel = (category?: string): string => {
    switch (category) {
      case TAB_IDS.APPLICATIONS: return t('fileSelection.categoryApplications');
      case TAB_IDS.PHOTOS: return t('fileSelection.categoryPhotos');
      case TAB_IDS.VIDEOS: return t('fileSelection.categoryVideos');
      case TAB_IDS.MUSIC: return t('fileSelection.categoryMusic');
      case TAB_IDS.CONTACTS: return t('fileSelection.categoryContacts');
      case TAB_IDS.FILES: return t('fileSelection.categoryFiles');
      default: return t('fileSelection.categoryFiles');
    }
  };

  const getCategoryColor = useCallback((category?: string): { border: string; bg: string; text: string; icon: string } => {
    switch (category) {
      case TAB_IDS.APPLICATIONS: 
        return { border: theme.purple, bg: theme.backgroundSecondary, text: theme.purple, icon: theme.purple };
      case TAB_IDS.PHOTOS: 
        return { border: theme.success, bg: theme.backgroundSecondary, text: theme.success, icon: theme.success };
      case TAB_IDS.VIDEOS: 
        return { border: theme.warning, bg: theme.backgroundSecondary, text: theme.warning, icon: theme.warning };
      case TAB_IDS.MUSIC: 
        return { border: theme.pink, bg: theme.backgroundSecondary, text: theme.pink, icon: theme.pink };
      case TAB_IDS.CONTACTS: 
        return { border: theme.link, bg: theme.backgroundSecondary, text: theme.link, icon: theme.link };
      case TAB_IDS.FILES: 
        return { border: accentColor, bg: theme.backgroundSecondary, text: accentColor, icon: accentColor };
      default: 
        return { border: theme.textSecondary, bg: theme.backgroundSecondary, text: theme.textSecondary, icon: theme.textSecondary };
    }
  }, [theme, accentColor]);

  const groupedSelectedItems = useMemo(() => {
    const allItems = getAllSelectedItems();
    const grouped: { [key: string]: SelectedItem[] } = {};
    
    allItems.forEach(item => {
      const category = item.category || t('fileSelection.categoryOthers');
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(item);
    });
    
    return grouped;
  }, [getAllSelectedItems]);

  const renderGridItemContent = (item: AppItem, tabId: string, allItems?: AppItem[]) => {
    const canPlay = item.type === 'video' || item.type === 'audio';
    const itemsForLongPress = allItems || getItemsForTab(tabId);
    return (
      <AnimatedPressable 
        style={themedStyles.gridItem}
        onPress={() => toggleItemSelection(item, tabId)}
        onLongPress={canPlay ? () => handleLongPress(item, itemsForLongPress) : undefined}
        delayLongPress={300}
      >
        <View style={themedStyles.gridIconContainer}>
          {item.icon && item.type === "app" ? (
            <Image source={{ uri: item.icon }} style={themedStyles.gridIcon} />
          ) : item.uri && (item.type === "photo" || item.type === "video") ? (
            <Image source={{ uri: item.uri }} style={themedStyles.gridIcon} />
          ) : item.type === "audio" ? (
            <View style={[themedStyles.gridIconPlaceholder, themedStyles.musicIconContainer]}>
              <Feather name="music" size={28} color={theme.buttonText} />
            </View>
          ) : (
            <View style={[themedStyles.gridIconPlaceholder, { backgroundColor: getIconColor(item.name) }]}>
              <Feather name={getIconName(item.type)} size={28} color={theme.buttonText} />
            </View>
          )}
          {canPlay ? (
            <View style={themedStyles.playIndicator}>
              <Feather name="play" size={12} color={theme.buttonText} />
            </View>
          ) : null}
          {item.isSelected ? (
            <View style={themedStyles.gridCheckbox}>
              <Feather name="check-circle" size={20} color={accentColor} />
            </View>
          ) : null}
        </View>
        <Text style={themedStyles.gridName} numberOfLines={1}>{item.name}</Text>
        <Text style={themedStyles.gridSize}>{item.size}</Text>
      </AnimatedPressable>
    );
  };

  const renderListItem = (item: AppItem, tabId: string, allItems?: AppItem[]) => {
    const canPlay = item.type === 'video' || item.type === 'audio';
    const itemsForLongPress = allItems || getItemsForTab(tabId);
    return (
      <Pressable 
        key={item.id}
        style={themedStyles.appItem}
        onPress={() => toggleItemSelection(item, tabId)}
        onLongPress={canPlay ? () => handleLongPress(item, itemsForLongPress) : undefined}
        delayLongPress={300}
      >
        <View style={themedStyles.appIconContainer}>
          {item.icon && item.type === "app" ? (
            <Image source={{ uri: item.icon }} style={themedStyles.appIcon} />
          ) : item.uri && (item.type === "photo" || item.type === "video") ? (
            <Image source={{ uri: item.uri }} style={themedStyles.appIcon} />
          ) : item.type === "audio" ? (
            <View style={[themedStyles.appIconPlaceholder, themedStyles.musicIconContainerSmall]}>
              <Feather name="music" size={24} color={theme.buttonText} />
            </View>
          ) : (
            <View style={[themedStyles.appIconPlaceholder, { backgroundColor: getIconColor(item.name) }]}>
              <Feather name={getIconName(item.type)} size={24} color={theme.buttonText} />
            </View>
          )}
          {canPlay ? (
            <View style={themedStyles.playIndicatorSmall}>
              <Feather name="play" size={10} color={theme.buttonText} />
            </View>
          ) : null}
        </View>
        
        <View style={themedStyles.appInfo}>
          <Text style={themedStyles.appName} numberOfLines={1}>{item.name}</Text>
          <Text style={themedStyles.appSize}>{item.size}</Text>
        </View>

        <View style={themedStyles.checkbox}>
          {item.isSelected ? (
            <View style={themedStyles.checkboxChecked}>
              <Feather name="check" size={14} color={theme.buttonText} />
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  };

  const toggleAlbumExpanded = (albumId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedAlbums(prev => ({ ...prev, [albumId]: !prev[albumId] }));
  };

  const renderPhotoGridItem = (item: AppItem, tabId: string, allItems: AppItem[]) => {
    return (
      <AnimatedPressable 
        style={themedStyles.photoGridItem}
        onPress={() => toggleItemSelection(item, tabId)}
        onLongPress={() => handleLongPress(item, allItems)}
        delayLongPress={300}
      >
        <View style={themedStyles.photoGridIconContainer}>
          <Image source={{ uri: item.uri }} style={themedStyles.photoGridIcon} />
          {item.isSelected ? (
            <View style={themedStyles.photoGridCheckbox}>
              <Feather name="check-circle" size={22} color={accentColor} />
            </View>
          ) : (
            <View style={themedStyles.photoGridCheckboxEmpty} />
          )}
        </View>
      </AnimatedPressable>
    );
  };

  const groupPhotosByFolder = (items: AppItem[]) => {
    const folders: { [key: string]: AppItem[] } = {
      'Captures d\'écran': [],
      'Caméra': [],
      'Downloads': [],
      'Autres': [],
    };
    
    items.forEach(item => {
      const name = item.name.toLowerCase();
      if (name.includes('screenshot') || name.includes('capture')) {
        folders['Captures d\'écran'].push(item);
      } else if (name.includes('img_') || name.includes('photo') || name.includes('dcim')) {
        folders['Caméra'].push(item);
      } else if (name.includes('download')) {
        folders['Downloads'].push(item);
      } else {
        folders['Autres'].push(item);
      }
    });

    return Object.entries(folders)
      .filter(([_, folderItems]) => folderItems.length > 0)
      .map(([name, folderItems]) => ({
        id: name,
        name,
        count: folderItems.length,
        items: folderItems,
      }));
  };

  const renderPhotoFolders = (items: AppItem[], tabId: string) => {
    const folders = groupPhotosByFolder(items);
    
    return folders.map(folder => (
      <View key={folder.id} style={themedStyles.photoFolderCard}>
        <Pressable 
          style={themedStyles.photoFolderHeader}
          onPress={() => toggleAlbumExpanded(folder.id)}
        >
          <Feather 
            name={expandedAlbums[folder.id] ? "chevron-down" : "chevron-right"} 
            size={20} 
            color={theme.text} 
          />
          <Text style={themedStyles.photoFolderName}>{folder.name} ({folder.count})</Text>
          <View style={themedStyles.photoFolderRadio} />
        </Pressable>
        
        {expandedAlbums[folder.id] ? (
          <View style={themedStyles.photoFolderGrid}>
            {folder.items.slice(0, 9).map((item) => (
              <View key={item.id} style={[themedStyles.photoFolderGridItem, { width: photoItemWidth }]}>
                {renderPhotoGridItem(item, tabId, folder.items)}
              </View>
            ))}
          </View>
        ) : null}
      </View>
    ));
  };

  const DOCUMENT_TYPES = [
    { id: 'all', label: 'TOUT', icon: 'file', color: '#607D8B' },
    { id: 'pdf', label: 'Pdf', icon: 'file-text', color: '#F44336' },
    { id: 'xlsx', label: 'Xlsx', icon: 'file-text', color: '#4CAF50' },
    { id: 'pptx', label: 'Pptx', icon: 'file-text', color: '#FF9800' },
    { id: 'txt', label: 'Txt', icon: 'file-text', color: '#2196F3' },
    { id: 'docx', label: 'Docx', icon: 'file-text', color: '#2196F3' },
    { id: 'wps', label: 'Wps', icon: 'file-text', color: '#9C27B0' },
  ];

  const handleDocumentTypePress = useCallback((docType: string) => {
    navigation.navigate("FileExplorer", { filterType: docType } as any);
  }, [navigation]);

  const renderTabContent = (tabId: string, items: AppItem[]) => {
    if (tabId === TAB_IDS.FILES) {
      const usedGB = storageStats.usedSpace / (1024 * 1024 * 1024);
      const totalGB = storageStats.totalSpace / (1024 * 1024 * 1024);
      const isAndroid = Platform.OS === 'android';
      
      return (
        <ScrollView 
          style={themedStyles.filesContainer} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={themedStyles.filesScrollContent}
        >
          {filesTabLoading ? (
            <View style={themedStyles.filesLoadingContainer}>
              <ActivityIndicator size="large" color={accentColor} />
              <Text style={themedStyles.filesLoadingText}>Chargement...</Text>
            </View>
          ) : (
            <>
              {isAndroid ? (
                <>
                  <View style={themedStyles.filesSection}>
                    <Text style={themedStyles.filesSectionTitle}>Documents</Text>
                    <View style={themedStyles.documentsGrid}>
                      {DOCUMENT_TYPES.map((docType) => (
                        <Pressable
                          key={docType.id}
                          style={themedStyles.documentTypeCard}
                          onPress={() => handleDocumentTypePress(docType.id)}
                        >
                          <View style={[themedStyles.documentTypeIcon, { backgroundColor: docType.color }]}>
                            <Feather name={docType.icon as any} size={24} color="#FFFFFF" />
                          </View>
                          <Text style={themedStyles.documentTypeLabel}>{docType.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <Pressable 
                    style={themedStyles.filesRowCard}
                    onPress={() => handleDocumentTypePress('zip')}
                  >
                    <View style={[themedStyles.filesRowIcon, { backgroundColor: '#2196F3' }]}>
                      <Feather name="archive" size={24} color="#FFFFFF" />
                    </View>
                    <View style={themedStyles.filesRowInfo}>
                      <Text style={themedStyles.filesRowTitle}>Zip</Text>
                      <Text style={themedStyles.filesRowSubtitle}>zip, rar, iso, 7z</Text>
                    </View>
                    <Feather name="chevron-right" size={20} color={theme.textSecondary} />
                  </Pressable>

                  <Pressable 
                    style={themedStyles.filesRowCard}
                    onPress={() => handleDocumentTypePress('large')}
                  >
                    <View style={[themedStyles.filesRowIcon, { backgroundColor: '#FF9800' }]}>
                      <Feather name="folder" size={24} color="#FFFFFF" />
                    </View>
                    <View style={themedStyles.filesRowInfo}>
                      <Text style={themedStyles.filesRowTitle}>Fichiers volumineux</Text>
                      <Text style={themedStyles.filesRowSubtitle}>Plus grand que 50 Mo</Text>
                    </View>
                    <Feather name="chevron-right" size={20} color={theme.textSecondary} />
                  </Pressable>
                </>
              ) : (
                <View style={themedStyles.filesSection}>
                  <View style={themedStyles.emptyState}>
                    <View style={themedStyles.emptyStateIconContainer}>
                      <Feather name="smartphone" size={48} color={theme.purple} />
                    </View>
                    <Text style={themedStyles.emptyStateTitle}>
                      Lancez l'app dans Expo Go sur Android pour accéder à l'explorateur de fichiers
                    </Text>
                  </View>
                </View>
              )}

              <Pressable 
                style={themedStyles.filesStorageCard}
                onPress={isAndroid ? openFileExplorer : undefined}
              >
                <View style={themedStyles.filesStorageHeader}>
                  <View style={[themedStyles.filesRowIcon, { backgroundColor: accentColor }]}>
                    <Feather name="hard-drive" size={24} color="#FFFFFF" />
                  </View>
                  <View style={themedStyles.filesStorageInfo}>
                    <Text style={themedStyles.filesRowTitle}>Espace de stockage interne partagé</Text>
                    <Text style={themedStyles.filesStorageSize}>
                      <Text style={{ color: accentColor }}>{usedGB.toFixed(2)}GB</Text>/{totalGB.toFixed(2)}GB
                    </Text>
                  </View>
                  {isAndroid ? (
                    <Feather name="chevron-right" size={20} color={theme.textSecondary} />
                  ) : null}
                </View>
                <View style={themedStyles.filesStorageBarContainer}>
                  <View 
                    style={[
                      themedStyles.filesStorageBarFill, 
                      { 
                        width: `${Math.min(storageStats.usedPercentage, 100)}%`,
                        backgroundColor: storageStats.usedPercentage > 80 ? theme.error : accentColor 
                      }
                    ]} 
                  />
                </View>
              </Pressable>
            </>
          )}
        </ScrollView>
      );
    }

    if (items.length === 0) {
      return (
        <View style={themedStyles.emptyState}>
          <View style={themedStyles.emptyStateIconContainer}>
            <Feather name="inbox" size={64} color={theme.purple} />
          </View>
          <Text style={themedStyles.emptyStateTitle}>{t('fileSelection.noContent')}</Text>
        </View>
      );
    }

    if (tabId === TAB_IDS.APPLICATIONS && filter === "not-installed") {
      return (
        <FlatList
          data={items}
          renderItem={({ item }) => renderListItem(item, tabId, items)}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={themedStyles.listContent}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={5}
        />
      );
    }

    if (tabId === TAB_IDS.APPLICATIONS) {
      const newApps = items.filter(item => item.isNew);
      const regularApps = items;
      
      return (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={themedStyles.sectionsContainer}>
          {newApps.length > 0 ? (
            <View style={themedStyles.sectionCard}>
              <View style={themedStyles.sectionHeader}>
                <Pressable 
                  style={themedStyles.sectionHeaderLeft}
                  onPress={() => toggleSection('nouveau')}
                >
                  <Feather 
                    name={sectionsExpanded.nouveau ? "chevron-down" : "chevron-right"} 
                    size={20} 
                    color={theme.text} 
                  />
                  <Text style={themedStyles.sectionTitle}>{t('fileSelection.new')} ({newApps.length})</Text>
                </Pressable>
                <Pressable onPress={() => toggleSectionSelection('nouveau')}>
                  <View style={[
                    themedStyles.sectionRadio,
                    newApps.every(app => app.isSelected) && themedStyles.sectionRadioSelected
                  ]}>
                    {newApps.every(app => app.isSelected) ? (
                      <Feather name="check" size={14} color={theme.buttonText} />
                    ) : null}
                  </View>
                </Pressable>
              </View>
              {sectionsExpanded.nouveau ? (
                <View style={themedStyles.gridContainer}>
                  {newApps.map((item) => (
                    <View key={item.id} style={[themedStyles.gridItemWrapper, { width: itemWidth }]}>
                      {renderGridItemContent(item, tabId, newApps)}
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
          
          {regularApps.length > 0 ? (
            <View style={themedStyles.sectionCard}>
              <View style={themedStyles.sectionHeader}>
                <Pressable 
                  style={themedStyles.sectionHeaderLeft}
                  onPress={() => toggleSection('applications')}
                >
                  <Feather 
                    name={sectionsExpanded.applications ? "chevron-down" : "chevron-right"} 
                    size={20} 
                    color={theme.text} 
                  />
                  <Text style={themedStyles.sectionTitle}>{t('fileSelection.categoryApplications')} ({regularApps.length})</Text>
                </Pressable>
                <Pressable onPress={() => toggleSectionSelection('applications')}>
                  <View style={[
                    themedStyles.sectionRadio,
                    regularApps.every(app => app.isSelected) && themedStyles.sectionRadioSelected
                  ]}>
                    {regularApps.every(app => app.isSelected) ? (
                      <Feather name="check" size={14} color={theme.buttonText} />
                    ) : null}
                  </View>
                </Pressable>
              </View>
              {sectionsExpanded.applications ? (
                <View style={themedStyles.gridContainer}>
                  {regularApps.map((item) => (
                    <View key={item.id} style={[themedStyles.gridItemWrapper, { width: itemWidth }]}>
                      {renderGridItemContent(item, tabId, regularApps)}
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      );
    }

    if (tabId === TAB_IDS.PHOTOS) {
      return (
        <View style={{ flex: 1 }}>
          <View style={themedStyles.photoSubTabsContainer}>
            <Pressable 
              style={[themedStyles.photoSubTab, photoSubTab === "coffre-fort" && themedStyles.photoSubTabActive]}
              onPress={() => setPhotoSubTab("coffre-fort")}
            >
              <Text style={[themedStyles.photoSubTabText, photoSubTab === "coffre-fort" && themedStyles.photoSubTabTextActive]}>
                Coffre-fort
              </Text>
            </Pressable>
            <Pressable 
              style={[themedStyles.photoSubTab, photoSubTab === "recents" && themedStyles.photoSubTabActive]}
              onPress={() => setPhotoSubTab("recents")}
            >
              <Text style={[themedStyles.photoSubTabText, photoSubTab === "recents" && themedStyles.photoSubTabTextActive]}>
                Récent(es)
              </Text>
            </Pressable>
            <Pressable 
              style={[themedStyles.photoSubTab, photoSubTab === "dossiers" && themedStyles.photoSubTabActive]}
              onPress={() => setPhotoSubTab("dossiers")}
            >
              <Text style={[themedStyles.photoSubTabText, photoSubTab === "dossiers" && themedStyles.photoSubTabTextActive]}>
                Dossiers
              </Text>
            </Pressable>
          </View>
          
          {photoSubTab === "dossiers" ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={themedStyles.photoFoldersContainer}>
              {renderPhotoFolders(items, tabId)}
            </ScrollView>
          ) : (
            <FlatList
              data={items}
              renderItem={({ item }) => (
                <View style={[themedStyles.photoGridItemWrapper, { width: photoItemWidth }]}>
                  {renderPhotoGridItem(item, tabId, items)}
                </View>
              )}
              keyExtractor={(item) => item.id}
              numColumns={numColumnsPhotos}
              key={`photo-grid-${numColumnsPhotos}`}
              columnWrapperStyle={themedStyles.photoGridRow}
              contentContainerStyle={themedStyles.photoGridContent}
              showsVerticalScrollIndicator={false}
              removeClippedSubviews={true}
              maxToRenderPerBatch={12}
              windowSize={5}
            />
          )}
        </View>
      );
    }

    if (tabId === TAB_IDS.VIDEOS) {
      return (
        <FlatList
          data={items}
          renderItem={({ item }) => (
            <View style={themedStyles.flatListGridItemWrapper}>
              {renderGridItemContent(item, tabId, items)}
            </View>
          )}
          keyExtractor={(item) => item.id}
          numColumns={numColumns}
          key={`grid-${numColumns}`}
          columnWrapperStyle={themedStyles.gridRow}
          contentContainerStyle={themedStyles.gridContent}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          maxToRenderPerBatch={12}
          windowSize={5}
        />
      );
    }

    return (
      <FlatList
        data={items}
        renderItem={({ item }) => renderListItem(item, tabId, items)}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={5}
      />
    );
  };

  const buildSearchIndex = useCallback(async () => {
    if (searchIndexing) return;
    
    setSearchIndexing(true);
    try {
      searchIndexRef.current.clear();
      searchCacheRef.current.clear();
      
      const allData = [
        { category: TAB_IDS.APPLICATIONS, items: applicationsItems },
        { category: TAB_IDS.PHOTOS, items: photosItems },
        { category: TAB_IDS.VIDEOS, items: videosItems },
        { category: TAB_IDS.MUSIC, items: musicItems },
        { category: TAB_IDS.CONTACTS, items: contactsItems },
        { category: TAB_IDS.FILES, items: filesItems },
      ];
      
      allData.forEach(({ category, items }) => {
        items.forEach(item => {
          const indexKey = `${category}::${item.id}`;
          searchIndexRef.current.set(indexKey, { ...item, category });
        });
      });
    } finally {
      setSearchIndexing(false);
    }
  }, [applicationsItems, photosItems, videosItems, musicItems, contactsItems, filesItems]);

  const getFileExtension = useCallback((filename: string): string => {
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
  }, []);

  const getFileCategory = useCallback((mimeType?: string, filename?: string): string => {
    const ext = filename ? getFileExtension(filename) : '';
    
    if (mimeType?.startsWith('application/pdf') || ext === 'pdf') return 'pdf';
    if (mimeType?.includes('word') || ['doc', 'docx'].includes(ext)) return 'word';
    if (mimeType?.includes('excel') || mimeType?.includes('spreadsheet') || ['xls', 'xlsx', 'csv'].includes(ext)) return 'excel';
    if (mimeType?.includes('powerpoint') || mimeType?.includes('presentation') || ['ppt', 'pptx'].includes(ext)) return 'powerpoint';
    if (mimeType?.startsWith('text/') || ['txt', 'md', 'json', 'xml', 'html', 'css', 'js'].includes(ext)) return 'text';
    if (mimeType?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) return 'image';
    if (mimeType?.startsWith('video/') || ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv'].includes(ext)) return 'video';
    if (mimeType?.startsWith('audio/') || ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'].includes(ext)) return 'audio';
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive';
    if (['apk'].includes(ext)) return 'app';
    
    return 'other';
  }, [getFileExtension]);

  const performSearch = useCallback((query: string) => {
    if (!query.trim()) {
      return {};
    }

    const cachedResult = searchCacheRef.current.get(query.toLowerCase());
    if (cachedResult) {
      return cachedResult;
    }

    const searchTerm = query.toLowerCase().trim();
    const searchTerms = searchTerm.split(/\s+/).filter(t => t.length > 0);
    const results: { [category: string]: AppItem[] } = {};
    
    searchIndexRef.current.forEach((item, key) => {
      const nameLower = item.name.toLowerCase();
      const sizeLower = item.size.toLowerCase();
      const categoryLower = item.category?.toLowerCase() || '';
      const fileCategory = item.type === 'file' ? getFileCategory(item.mimeType, item.name) : '';
      
      let matchScore = 0;
      
      for (const term of searchTerms) {
        if (nameLower.includes(term)) matchScore += 3;
        if (sizeLower.includes(term)) matchScore += 1;
        if (categoryLower.includes(term)) matchScore += 2;
        
        if (item.type === "app" && (term === "app" || term === "application" || term === "apk")) matchScore += 2;
        if (item.type === "video" && (term === "video" || term === "vid" || term === "mp4" || term === "film")) matchScore += 2;
        if (item.type === "audio" && (term === "music" || term === "musique" || term === "mp3" || term === "audio" || term === "son")) matchScore += 2;
        if (item.type === "photo" && (term === "photo" || term === "image" || term === "jpg" || term === "png" || term === "picture")) matchScore += 2;
        if (item.type === "contact" && (term === "contact" || term === "user" || term === "personne")) matchScore += 2;
        
        if (item.type === "file") {
          if ((term === "pdf" || term === "document") && fileCategory === 'pdf') matchScore += 3;
          if ((term === "word" || term === "doc" || term === "docx") && fileCategory === 'word') matchScore += 3;
          if ((term === "excel" || term === "xls" || term === "xlsx" || term === "tableur") && fileCategory === 'excel') matchScore += 3;
          if ((term === "powerpoint" || term === "ppt" || term === "pptx" || term === "presentation") && fileCategory === 'powerpoint') matchScore += 3;
          if ((term === "text" || term === "texte" || term === "txt") && fileCategory === 'text') matchScore += 3;
          if ((term === "archive" || term === "zip" || term === "rar") && fileCategory === 'archive') matchScore += 3;
          if (term === "fichier" || term === "file") matchScore += 1;
        }
      }
      
      if (matchScore > 0) {
        const category = item.category || t('fileSelection.categoryOthers');
        if (!results[category]) {
          results[category] = [];
        }
        results[category].push({ ...item, matchScore } as any);
      }
    });

    Object.keys(results).forEach(cat => {
      results[cat].sort((a: any, b: any) => (b.matchScore || 0) - (a.matchScore || 0));
    });

    searchCacheRef.current.set(searchTerm, results);
    return results;
  }, [getFileCategory, t]);

  const searchResults = useMemo(() => {
    return performSearch(searchQuery);
  }, [searchQuery, performSearch]);

  const handleOpenSearch = useCallback(async () => {
    setShowSearchModal(true);
    
    if (!searchIndexing) {
      buildSearchIndex();
    }
  }, [buildSearchIndex, searchIndexing]);

  return (
    <View style={themedStyles.container}>
      <View style={themedStyles.header}>
        <Pressable onPress={() => navigation.goBack()} style={themedStyles.backButton}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <Text style={themedStyles.headerTitle}>{t('fileSelection.title')}</Text>
        <Pressable style={themedStyles.searchButton} onPress={handleOpenSearch}>
          <Feather name="search" size={24} color={theme.text} />
        </Pressable>
      </View>

      <View style={themedStyles.tabsWrapper}>
        <ScrollView 
          ref={tabScrollViewRef}
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={themedStyles.tabsContainer}
          contentContainerStyle={themedStyles.tabsContent}
        >
          {TAB_ORDER.map((tabId, index) => (
            <Pressable 
              key={tabId}
              onPress={() => onTabPress(index)}
              style={themedStyles.tab}
            >
              <Text style={[
                themedStyles.tabText,
                activeTabIndex === index && themedStyles.tabTextActive
              ]}>
                {getTabLabel(tabId)}
              </Text>
              {activeTabIndex === index ? (
                <View style={themedStyles.tabIndicator} />
              ) : null}
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {activeTab === TAB_IDS.APPLICATIONS ? (
        <View style={themedStyles.filterContainer}>
          <Pressable 
            style={[
              themedStyles.filterButton, 
              filter === "installed" && themedStyles.filterButtonActive
            ]}
            onPress={() => setFilter("installed")}
          >
            <Text style={[
              themedStyles.filterText,
              filter === "installed" && themedStyles.filterTextActive
            ]}>
              {t('fileSelection.installed')}
            </Text>
          </Pressable>
          <Pressable 
            style={[
              themedStyles.filterButton, 
              filter === "not-installed" && themedStyles.filterButtonActive
            ]}
            onPress={() => setFilter("not-installed")}
          >
            <Text style={[
              themedStyles.filterText,
              filter === "not-installed" && themedStyles.filterTextActive
            ]}>
              {t('fileSelection.notInstalled')}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <SwipeablePager
        ref={pagerRef}
        style={themedStyles.pagerView}
        initialPage={2}
        onPageSelected={onPageSelected}
      >
        {TAB_ORDER.map((tabId) => (
          <View key={tabId} style={themedStyles.pageContainer}>
            {renderTabContent(tabId, tabId === TAB_IDS.APPLICATIONS && filter === "not-installed" ? apkFilesItems : getItemsForTab(tabId))}
          </View>
        ))}
      </SwipeablePager>

      <View style={themedStyles.footer}>
        <Pressable 
          style={themedStyles.footerCountContainer}
          onPress={() => globalSelectedCount > 0 && setShowSelectedMenu(true)}
        >
          {globalSelectedCount > 0 ? (
            <Feather name="chevron-up" size={18} color={theme.textSecondary} style={themedStyles.footerArrow} />
          ) : null}
          <Text style={themedStyles.footerCount}>
            {t('fileSelection.filesSelectedCount', { count: globalSelectedCount })}
          </Text>
        </Pressable>
        
        <Pressable 
          style={[
            themedStyles.nextButton,
            globalSelectedCount === 0 && themedStyles.nextButtonDisabled
          ]}
          disabled={globalSelectedCount === 0}
          onPress={handleNext}
        >
          <Text style={themedStyles.nextButtonText}>Suivant</Text>
        </Pressable>
      </View>

      {showSelectedMenu ? (
        <Animated.View 
          style={themedStyles.selectedMenuOverlay}
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
        >
          <Pressable 
            style={themedStyles.selectedMenuBackdrop} 
            onPress={() => setShowSelectedMenu(false)}
          />
          <Animated.View 
            style={themedStyles.selectedMenuContainer}
            entering={SlideInDown.duration(300).springify().damping(18)}
            exiting={SlideOutDown.duration(250)}
          >
            <View style={themedStyles.selectedMenuHeader}>
              <Pressable 
                onPress={() => setShowSelectedMenu(false)}
                style={themedStyles.selectedMenuHeaderButton}
              >
                <Feather name="chevron-down" size={24} color={theme.text} />
              </Pressable>
              <Text style={themedStyles.selectedMenuTitle}>
                {globalSelectedCount} fichier(s) - {getTotalSelectedSize()}
              </Text>
              <Pressable onPress={clearAllSelections} style={themedStyles.selectedMenuHeaderButton}>
                <Feather name="trash-2" size={20} color={theme.error} />
              </Pressable>
            </View>

            <ScrollView style={themedStyles.selectedMenuList} showsVerticalScrollIndicator={false}>
              {Object.entries(groupedSelectedItems).map(([category, categoryItems]) => (
                <View key={category}>
                  <View style={themedStyles.selectedMenuCategoryHeader}>
                    <Text style={themedStyles.selectedMenuCategoryTitle}>
                      {getCategoryLabel(category)} ({categoryItems.length})
                    </Text>
                  </View>
                  {categoryItems.map(item => (
                    <View 
                      key={item.globalKey} 
                      style={themedStyles.selectedMenuItem}
                    >
                      <View style={themedStyles.selectedMenuItemIcon}>
                        {item.icon && item.type === "app" ? (
                          <RNImage source={{ uri: item.icon }} style={themedStyles.selectedMenuIcon} />
                        ) : item.uri && (item.type === "photo" || item.type === "video") ? (
                          <RNImage source={{ uri: item.uri }} style={themedStyles.selectedMenuIcon} />
                        ) : (
                          <View style={[themedStyles.selectedMenuIconPlaceholder, { backgroundColor: getIconColor(item.name) }]}>
                            <Feather name={getIconName(item.type)} size={24} color={theme.buttonText} />
                          </View>
                        )}
                      </View>
                      <View style={themedStyles.selectedMenuItemInfo}>
                        <Text style={themedStyles.selectedMenuItemName} numberOfLines={1}>{item.name}</Text>
                        <Text style={themedStyles.selectedMenuItemSize}>{item.size}</Text>
                      </View>
                      <Pressable 
                        onPress={() => removeFromGlobalSelection(item.globalKey)}
                        style={themedStyles.removeItemButton}
                      >
                        <Feather name="x-circle" size={22} color={theme.textSecondary} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ))}
            </ScrollView>

            <View style={themedStyles.selectedMenuFooter}>
              <Text style={themedStyles.selectedMenuFooterCount}>
                {globalSelectedCount} fichier(s) - {getTotalSelectedSize()}
              </Text>
              <Pressable 
                style={themedStyles.sendButton}
                onPress={() => {
                  setShowSelectedMenu(false);
                  handleNext();
                }}
              >
                <Text style={themedStyles.sendButtonText}>{t('fileSelection.send')}</Text>
              </Pressable>
            </View>
          </Animated.View>
        </Animated.View>
      ) : null}

      <Modal
        visible={showSearchModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => {
          setShowSearchModal(false);
          setSearchQuery("");
        }}
      >
        <View style={themedStyles.searchModal}>
          <View style={themedStyles.searchHeader}>
            <Pressable 
              onPress={() => {
                setShowSearchModal(false);
                setSearchQuery("");
              }} 
              style={themedStyles.searchBackButton}
            >
              <Feather name="arrow-left" size={24} color={theme.text} />
            </Pressable>
            <View style={themedStyles.searchInputContainer}>
              <Feather name="search" size={20} color={theme.textSecondary} />
              <TextInput
                style={themedStyles.searchInput}
                placeholder={t('fileSelection.searchPlaceholder')}
                placeholderTextColor={theme.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
                returnKeyType="search"
              />
              {searchQuery.length > 0 ? (
                <Pressable onPress={() => setSearchQuery("")}>
                  <Feather name="x-circle" size={20} color={theme.textSecondary} />
                </Pressable>
              ) : null}
            </View>
          </View>

          <ScrollView style={themedStyles.searchContent} showsVerticalScrollIndicator={false}>
            {searchIndexing ? (
              <View style={themedStyles.searchEmptyState}>
                <Feather name="loader" size={48} color={accentColor} />
                <Text style={themedStyles.searchEmptyText}>
                  {t('fileSelection.indexing')}
                </Text>
                <Text style={themedStyles.searchEmptyHint}>
                  {t('fileSelection.preparingSearch')}
                </Text>
              </View>
            ) : searchQuery.trim() === "" ? (
              <View style={themedStyles.searchEmptyState}>
                <Feather name="search" size={48} color={theme.border} />
                <Text style={themedStyles.searchEmptyText}>
                  {t('fileSelection.typeToSearch')}
                </Text>
                <Text style={themedStyles.searchEmptyHint}>
                  {t('fileSelection.searchCategories')}
                </Text>
              </View>
            ) : Object.keys(searchResults).length === 0 ? (
              <View style={themedStyles.searchEmptyState}>
                <Feather name="search" size={48} color={theme.border} />
                <Text style={themedStyles.searchEmptyText}>{t('fileSelection.noResultsFound')}</Text>
                <Text style={themedStyles.searchEmptyHint}>
                  {t('fileSelection.tryAnotherTerm')}
                </Text>
              </View>
            ) : (
              Object.entries(searchResults).map(([category, categoryItems]) => {
                const colors = getCategoryColor(category);
                return (
                <View 
                  key={category} 
                  style={[
                    themedStyles.searchCategoryBox, 
                    { 
                      borderColor: colors.border,
                      shadowColor: colors.border,
                    }
                  ]}
                >
                  <View style={[themedStyles.searchCategoryHeader, { backgroundColor: colors.bg, borderBottomColor: colors.border }]}>
                    <Feather 
                      name={
                        category === TAB_IDS.APPLICATIONS ? "package" :
                        category === TAB_IDS.PHOTOS ? "image" :
                        category === TAB_IDS.VIDEOS ? "video" :
                        category === TAB_IDS.MUSIC ? "music" :
                        category === TAB_IDS.CONTACTS ? "user" :
                        "file"
                      } 
                      size={18} 
                      color={colors.icon} 
                    />
                    <Text style={[themedStyles.searchCategoryTitle, { color: colors.text }]}>
                      {getCategoryLabel(category)} ({categoryItems.length})
                    </Text>
                  </View>
                  <View style={themedStyles.searchCategoryContent}>
                    {categoryItems.slice(0, 10).map((item) => (
                      <Pressable 
                        key={item.id} 
                        style={themedStyles.searchResultItem}
                        onPress={() => {
                          toggleItemSelection(item, category);
                          setShowSearchModal(false);
                          setSearchQuery("");
                        }}
                      >
                        <View style={themedStyles.searchResultIcon}>
                          {item.icon && item.type === "app" ? (
                            <RNImage source={{ uri: item.icon }} style={themedStyles.searchIconImage} />
                          ) : item.uri && (item.type === "photo" || item.type === "video") ? (
                            <RNImage source={{ uri: item.uri }} style={themedStyles.searchIconImage} />
                          ) : (
                            <View style={[themedStyles.searchIconPlaceholder, { backgroundColor: getIconColor(item.name) }]}>
                              <Feather name={getIconName(item.type)} size={20} color={theme.buttonText} />
                            </View>
                          )}
                        </View>
                        <View style={themedStyles.searchResultInfo}>
                          <Text style={themedStyles.searchResultName} numberOfLines={1}>{item.name}</Text>
                          <Text style={themedStyles.searchResultSize} numberOfLines={1}>{item.size}</Text>
                        </View>
                        <View style={[
                          themedStyles.searchResultCheckbox,
                          globalSelections.has(createGlobalKey(category, item.id)) && themedStyles.searchResultCheckboxChecked
                        ]}>
                          {globalSelections.has(createGlobalKey(category, item.id)) ? (
                            <Feather name="check" size={14} color={theme.buttonText} />
                          ) : null}
                        </View>
                      </Pressable>
                    ))}
                    {categoryItems.length > 10 ? (
                      <Text style={themedStyles.searchMoreText}>
                        +{categoryItems.length - 10} autres résultats
                      </Text>
                    ) : null}
                  </View>
                </View>
              );})
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const createThemedStyles = (theme: ThemeColors, accentColor: string) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.backgroundDefault,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: theme.backgroundDefault,
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
    color: theme.text,
    flex: 1,
    textAlign: "center",
  },
  searchButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  tabsWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  tabsContainer: {
    maxHeight: 48,
  },
  tabsContent: {
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.textSecondary,
    letterSpacing: 0.3,
  },
  tabTextActive: {
    color: theme.text,
  },
  tabIndicator: {
    width: 24,
    height: 3,
    backgroundColor: accentColor,
    borderRadius: 2,
    marginTop: 6,
    alignSelf: "center",
  },
  filterContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 24,
    backgroundColor: theme.backgroundSecondary,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: theme.border,
  },
  filterButtonActive: {
    backgroundColor: theme.backgroundDefault,
    borderColor: accentColor,
  },
  filterText: {
    fontSize: 14,
    fontWeight: "500",
    color: theme.textSecondary,
  },
  filterTextActive: {
    color: accentColor,
    fontWeight: "600",
  },
  pagerView: {
    flex: 1,
  },
  pageContainer: {
    flex: 1,
  },
  sectionsContainer: {
    padding: 12,
    gap: 12,
  },
  sectionCard: {
    backgroundColor: theme.backgroundDefault,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: "hidden",
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.backgroundSecondary,
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.text,
  },
  sectionRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: theme.border,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionRadioSelected: {
    backgroundColor: accentColor,
    borderColor: accentColor,
  },
  appItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: theme.border,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: accentColor,
    justifyContent: "center",
    alignItems: "center",
  },
  appIconContainer: {
    width: 48,
    height: 48,
  },
  appIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  appIconPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  appInfo: {
    flex: 1,
    gap: 2,
  },
  appName: {
    fontSize: 14,
    fontWeight: "500",
    color: theme.text,
  },
  appSize: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  gridRow: {
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 8,
  },
  gridContent: {
    paddingVertical: 12,
  },
  listContent: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 8,
    paddingVertical: 8,
    justifyContent: "flex-start",
    gap: 4,
  },
  gridItem: {
    alignItems: "center",
    padding: 4,
    backgroundColor: theme.backgroundDefault,
    borderRadius: 12,
  },
  gridItemWrapper: {
  },
  flatListGridItemWrapper: {
    flex: 1,
    marginHorizontal: 4,
    marginBottom: 8,
  },
  gridIconContainer: {
    position: "relative",
    marginBottom: 6,
  },
  gridIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
  },
  gridIconPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  gridCheckbox: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: theme.backgroundDefault,
    borderRadius: 12,
    padding: 2,
  },
  playIndicator: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  playIndicatorSmall: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  musicIconContainer: {
    backgroundColor: theme.pink,
    width: 56,
    height: 56,
    borderRadius: 14,
  },
  musicIconContainerSmall: {
    backgroundColor: theme.pink,
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  gridName: {
    fontSize: 11,
    fontWeight: "400",
    color: theme.text,
    textAlign: "center",
    maxWidth: "100%",
  },
  gridSize: {
    fontSize: 10,
    color: theme.textSecondary,
    textAlign: "center",
    marginTop: 2,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingVertical: 64,
    gap: 12,
  },
  emptyStateIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.backgroundSecondary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: "400",
    color: theme.textSecondary,
  },
  filesContainer: {
    flex: 1,
    position: "relative",
  },
  filesScrollContent: {
    padding: 16,
    gap: 12,
  },
  filesLoadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 64,
    gap: 12,
  },
  filesLoadingText: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  filesSection: {
    backgroundColor: theme.backgroundDefault,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 16,
    gap: 12,
  },
  filesSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.text,
    marginBottom: 4,
  },
  documentsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    justifyContent: "flex-start",
  },
  documentTypeCard: {
    alignItems: "center",
    width: 64,
    gap: 8,
  },
  documentTypeIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  documentTypeLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: theme.text,
    textAlign: "center",
  },
  filesRowCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.backgroundDefault,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 16,
    gap: 12,
  },
  filesRowIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  filesRowInfo: {
    flex: 1,
    gap: 2,
  },
  filesRowTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.text,
  },
  filesRowSubtitle: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  filesStorageCard: {
    backgroundColor: theme.backgroundDefault,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 16,
    gap: 12,
  },
  filesStorageHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  filesStorageInfo: {
    flex: 1,
    gap: 2,
  },
  filesStorageSize: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  filesStorageBarContainer: {
    height: 6,
    backgroundColor: theme.backgroundTertiary,
    borderRadius: 3,
    overflow: "hidden",
  },
  filesStorageBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: accentColor,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 16,
  },
  addButtonText: {
    color: theme.buttonText,
    fontSize: 14,
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    backgroundColor: theme.backgroundDefault,
  },
  footerCountContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  footerArrow: {
    marginRight: 2,
  },
  footerCount: {
    fontSize: 13,
    fontWeight: "500",
    color: theme.textSecondary,
  },
  selectedMenuOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  selectedMenuBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  selectedMenuContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: "75%",
    backgroundColor: theme.backgroundDefault,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  selectedMenuHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  selectedMenuHeaderButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  selectedMenuTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.text,
    flex: 1,
    textAlign: "center",
  },
  selectedMenuCategoryHeader: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: theme.backgroundSecondary,
  },
  selectedMenuCategoryTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  selectedMenuList: {
    maxHeight: "100%",
  },
  selectedMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  selectedMenuItemIcon: {
    width: 44,
    height: 44,
  },
  selectedMenuIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  selectedMenuIconPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  selectedMenuItemInfo: {
    flex: 1,
    gap: 2,
  },
  selectedMenuItemName: {
    fontSize: 14,
    fontWeight: "500",
    color: theme.text,
  },
  selectedMenuItemSize: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  removeItemButton: {
    padding: 8,
  },
  selectedMenuFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    backgroundColor: theme.backgroundDefault,
  },
  selectedMenuFooterCount: {
    fontSize: 13,
    fontWeight: "500",
    color: theme.textSecondary,
  },
  sendButton: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: accentColor,
  },
  sendButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.buttonText,
  },
  nextButton: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: accentColor,
  },
  nextButtonDisabled: {
    backgroundColor: theme.border,
  },
  nextButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.buttonText,
  },
  searchModal: {
    flex: 1,
    backgroundColor: theme.backgroundDefault,
  },
  searchHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    gap: 12,
  },
  searchBackButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.backgroundSecondary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: theme.text,
    padding: 0,
  },
  searchContent: {
    flex: 1,
  },
  searchEmptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingVertical: 64,
    gap: 12,
  },
  searchEmptyText: {
    fontSize: 16,
    fontWeight: "500",
    color: theme.textSecondary,
    textAlign: "center",
    marginTop: 16,
  },
  searchEmptyHint: {
    fontSize: 13,
    color: theme.textSecondary,
    textAlign: "center",
    marginTop: 4,
  },
  searchCategoryBox: {
    margin: 16,
    backgroundColor: theme.backgroundDefault,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: accentColor,
    overflow: "hidden",
    shadowColor: accentColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  searchCategoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: theme.backgroundSecondary,
    borderBottomWidth: 2,
    borderBottomColor: accentColor,
  },
  searchCategoryTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: accentColor,
    flex: 1,
  },
  searchCategoryContent: {
    backgroundColor: theme.backgroundDefault,
  },
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  searchResultIcon: {
    width: 48,
    height: 48,
  },
  searchIconImage: {
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  searchIconPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  searchResultInfo: {
    flex: 1,
    gap: 4,
  },
  searchResultName: {
    fontSize: 14,
    fontWeight: "500",
    color: theme.text,
  },
  searchResultSize: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  searchResultCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.border,
    justifyContent: "center",
    alignItems: "center",
  },
  searchResultCheckboxChecked: {
    backgroundColor: accentColor,
    borderColor: accentColor,
  },
  searchMoreText: {
    fontSize: 13,
    fontWeight: "500",
    color: theme.textSecondary,
    textAlign: "center",
    paddingVertical: 12,
    fontStyle: "italic",
  },
  photoSubTabsContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    backgroundColor: theme.backgroundDefault,
  },
  photoSubTab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: theme.backgroundSecondary,
    borderWidth: 1,
    borderColor: theme.border,
  },
  photoSubTabActive: {
    backgroundColor: theme.text,
    borderColor: theme.text,
  },
  photoSubTabText: {
    fontSize: 13,
    fontWeight: "500",
    color: theme.textSecondary,
  },
  photoSubTabTextActive: {
    color: theme.backgroundDefault,
  },
  photoFoldersContainer: {
    padding: 16,
    gap: 8,
  },
  photoFolderCard: {
    backgroundColor: theme.backgroundDefault,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: "hidden",
  },
  photoFolderHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  photoFolderName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: theme.text,
  },
  photoFolderRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: theme.border,
  },
  photoFolderGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 4,
  },
  photoFolderGridItem: {
    marginBottom: 4,
  },
  photoGridRow: {
    paddingHorizontal: 16,
    gap: 4,
    marginBottom: 4,
  },
  photoGridContent: {
    paddingVertical: 12,
  },
  photoGridItemWrapper: {
    marginBottom: 4,
  },
  photoGridItem: {
    width: "100%",
    aspectRatio: 1,
  },
  photoGridIconContainer: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
  },
  photoGridIcon: {
    width: "100%",
    height: "100%",
  },
  photoGridCheckbox: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: theme.backgroundDefault,
    borderRadius: 12,
    padding: 1,
  },
  photoGridCheckboxEmpty: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.8)",
    backgroundColor: "rgba(0, 0, 0, 0.2)",
  },
});
