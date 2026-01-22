import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Text,
  Alert,
  Platform,
  FlatList,
  NativeModules,
  Modal,
  TextInput,
  Animated,
  ActivityIndicator,
  BackHandler,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HomeStackParamList } from "@/navigation/HomeStackNavigator";
import * as IntentLauncher from "expo-intent-launcher";
import * as Sharing from "expo-sharing";
import { Spacing } from "@/constants/theme";
import { nativeFileExplorer, FileItem as NativeFileItem } from "@/services/NativeFileExplorer";
import { mockFileExplorer } from "@/services/MockFileExplorerService";
import SelectionActionBar from "@/components/SelectionActionBar";
import BreadcrumbNav from "@/components/BreadcrumbNav";
import FileThumbnail from "@/components/FileThumbnail";
import AdvancedSearchModal from "@/components/AdvancedSearchModal";
import { useTranslation } from "react-i18next";
import { useColorScheme } from "react-native";
import { getThemeColors } from "@/constants/theme";

type ClipboardOperation = "copy" | "cut" | null;
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { StorageModule } = NativeModules;

type FileExplorerScreenNavigationProp = NativeStackNavigationProp<
  HomeStackParamList,
  "FileExplorer"
>;

interface Props {
  navigation: FileExplorerScreenNavigationProp;
}

interface FileItem {
  name: string;
  isDirectory: boolean;
  uri: string;
  size: number;
  modificationTime: number;
}

type SortOption = "name" | "date" | "size" | "type";
type SortOrder = "asc" | "desc";

const ANDROID_ROOT = "file:///storage/emulated/0/";
const ANDROID_ROOT_PATH = "/storage/emulated/0";
const ITEM_HEIGHT = 64;

const isWebPlatform = Platform.OS === "web";

const getFileExtension = (name: string): string => {
  const parts = name.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
};

const getFileIcon = (file: FileItem): keyof typeof Feather.glyphMap => {
  if (file.isDirectory) return "folder";
  const ext = getFileExtension(file.name);
  if (["jpg", "jpeg", "png", "gif", "bmp", "webp", "heic"].includes(ext)) return "image";
  if (["mp4", "avi", "mkv", "mov", "wmv", "3gp", "webm"].includes(ext)) return "video";
  if (["mp3", "wav", "flac", "aac", "m4a", "ogg", "wma"].includes(ext)) return "music";
  if (["pdf", "doc", "docx", "txt", "rtf", "xls", "xlsx", "ppt", "pptx"].includes(ext)) return "file-text";
  if (["zip", "rar", "7z", "tar", "gz", "bz2"].includes(ext)) return "archive";
  if (["apk", "xapk"].includes(ext)) return "package";
  if (["js", "ts", "jsx", "tsx", "py", "java", "cpp", "c", "h", "json", "xml", "html", "css"].includes(ext)) return "code";
  return "file";
};

const getFileIconColor = (file: FileItem): string => {
  if (file.isDirectory) return "#FFB74D";
  const ext = getFileExtension(file.name);
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


interface FileItemComponentProps {
  item: FileItem;
  onPress: (item: FileItem) => void;
  onLongPress: (item: FileItem) => void;
  isSelectionMode: boolean;
  isSelected: boolean;
  onSelect: (item: FileItem) => void;
}

const FileItemComponent = memo(({ item, onPress, onLongPress, isSelectionMode, isSelected, onSelect }: FileItemComponentProps) => {
  const handlePress = useCallback(() => {
    if (isSelectionMode) {
      onSelect(item);
    } else {
      onPress(item);
    }
  }, [item, onPress, isSelectionMode, onSelect]);

  const handleLongPress = useCallback(() => {
    onLongPress(item);
  }, [item, onLongPress]);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.fileItem,
        pressed && styles.fileItemPressed,
        isSelected && styles.fileItemSelected,
      ]}
      onPress={handlePress}
      onLongPress={handleLongPress}
      delayLongPress={300}
    >
      {isSelectionMode ? (
        <View style={styles.fileCheckboxContainer}>
          <View style={[styles.fileCheckbox, isSelected && styles.fileCheckboxChecked]}>
            {isSelected ? <Feather name="check" size={16} color="#FFFFFF" /> : null}
          </View>
        </View>
      ) : null}
      <View style={styles.fileIconContainer}>
        <FileThumbnail
          uri={item.uri}
          filename={item.name}
          isDirectory={item.isDirectory}
          size={item.size}
        />
      </View>
      <View style={styles.fileInfo}>
        <Text style={styles.fileName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.fileDetails}>
          {item.isDirectory ? "Dossier" : formatFileSize(item.size)}
        </Text>
      </View>
      <View style={styles.fileDateContainer}>
        <Text style={styles.fileDate}>{formatDate(item.modificationTime)}</Text>
      </View>
    </Pressable>
  );
});

FileItemComponent.displayName = "FileItemComponent";

const fileCache = new Map<string, { files: FileItem[]; timestamp: number }>();
const CACHE_DURATION = 30000;

export default function FileExplorerScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = getThemeColors(colorScheme === "dark");
  const { t } = useTranslation();
  const [currentPath, setCurrentPath] = useState<string>("");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(!isWebPlatform);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [pathHistory, setPathHistory] = useState<string[]>([]);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [showHiddenFiles, setShowHiddenFiles] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [createItemType, setCreateItemType] = useState<"file" | "folder">("folder");
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [clipboardFiles, setClipboardFiles] = useState<FileItem[]>([]);
  const [clipboardOperation, setClipboardOperation] = useState<ClipboardOperation>(null);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameItem, setRenameItem] = useState<FileItem | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [operationLoading, setOperationLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  
  const filterMenuAnim = useRef(new Animated.Value(0)).current;
  const moreMenuAnim = useRef(new Animated.Value(0)).current;
  const filterChevronAnim = useRef(new Animated.Value(0)).current;
  const moreChevronAnim = useRef(new Animated.Value(0)).current;
  const loadingRef = useRef(false);
  const currentPathRef = useRef(currentPath);

  useEffect(() => {
    currentPathRef.current = currentPath;
  }, [currentPath]);

  useEffect(() => {
    initializeFileSystem();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (permissionDenied) {
        initializeFileSystem();
      }
    });
    return unsubscribe;
  }, [navigation, permissionDenied]);

  useEffect(() => {
    if (currentPath) {
      loadFiles(currentPath);
    }
  }, [currentPath, sortBy, sortOrder, showHiddenFiles]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(filterMenuAnim, {
        toValue: showFilterMenu ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(filterChevronAnim, {
        toValue: showFilterMenu ? 1 : 0,
        damping: 15,
        stiffness: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [showFilterMenu, filterMenuAnim, filterChevronAnim]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(moreMenuAnim, {
        toValue: showMoreMenu ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(moreChevronAnim, {
        toValue: showMoreMenu ? 1 : 0,
        damping: 15,
        stiffness: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [showMoreMenu, moreMenuAnim, moreChevronAnim]);

  const checkManageStoragePermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== "android") {
      return true;
    }

    try {
      if (StorageModule && StorageModule.hasManageStoragePermission) {
        return await StorageModule.hasManageStoragePermission();
      }
      return await nativeFileExplorer.hasStoragePermission();
    } catch (error) {
      console.error("Error checking MANAGE_EXTERNAL_STORAGE permission:", error);
      return false;
    }
  }, []);

  const requestManageStoragePermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== "android") {
      return true;
    }

    try {
      const hasPermission = await checkManageStoragePermission();
      if (hasPermission) {
        return true;
      }

      if (StorageModule && StorageModule.requestManageStoragePermission) {
        try {
          await StorageModule.requestManageStoragePermission();
          await new Promise(resolve => setTimeout(resolve, 500));
          return await checkManageStoragePermission();
        } catch (error) {
          console.error("Error requesting permission via StorageModule:", error);
        }
      }

      return new Promise((resolve) => {
        Alert.alert(
          "Acces aux fichiers requis",
          "Pour utiliser l'explorateur de fichiers, vous devez autoriser l'acces a tous les fichiers.\n\n1. Appuyez sur 'Ouvrir les parametres'\n2. Activez 'Autoriser l'acces pour gerer tous les fichiers'",
          [
            { 
              text: "Annuler", 
              style: "cancel",
              onPress: () => resolve(false)
            },
            {
              text: "Ouvrir les parametres",
              onPress: async () => {
                try {
                  await IntentLauncher.startActivityAsync(
                    IntentLauncher.ActivityAction.MANAGE_APP_ALL_FILES_ACCESS_PERMISSION,
                    { data: "package:com.sharel.app" }
                  );
                } catch (error) {
                  console.error("Error opening settings:", error);
                }
                await new Promise(r => setTimeout(r, 1000));
                const recheckPermission = await checkManageStoragePermission();
                resolve(recheckPermission);
              },
            },
          ]
        );
      });
    } catch (error) {
      console.error("Error requesting MANAGE_EXTERNAL_STORAGE permission:", error);
      return false;
    }
  }, [checkManageStoragePermission]);

  const initializeFileSystem = useCallback(async () => {
    if (isWebPlatform) {
      setCurrentPath(ANDROID_ROOT);
      setPathHistory([ANDROID_ROOT]);
      setLoading(false);
      return;
    }

    try {
      const granted = await requestManageStoragePermission();

      if (!granted) {
        setLoading(false);
        setPermissionDenied(true);
        return;
      }

      setPermissionDenied(false);
      setCurrentPath(ANDROID_ROOT);
      setPathHistory([ANDROID_ROOT]);
      setLoading(false);
    } catch (error) {
      console.error("Error initializing file system:", error);
      setLoading(false);
      setPermissionDenied(true);
    }
  }, [requestManageStoragePermission]);

  const sortFileItems = useCallback((items: FileItem[], sort: SortOption, order: SortOrder): FileItem[] => {
    return [...items].sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;

      let comparison = 0;
      switch (sort) {
        case "name":
          comparison = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
          break;
        case "date":
          comparison = a.modificationTime - b.modificationTime;
          break;
        case "size":
          comparison = a.size - b.size;
          break;
        case "type":
          const extA = getFileExtension(a.name);
          const extB = getFileExtension(b.name);
          comparison = extA.localeCompare(extB);
          break;
      }

      return order === "asc" ? comparison : -comparison;
    });
  }, []);

  const loadFiles = useCallback(async (path: string, silent = false) => {
    if (loadingRef.current) return;
    
    const cacheKey = `${path}-${showHiddenFiles}`;
    const cached = fileCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      const sortedItems = sortFileItems(cached.files, sortBy, sortOrder);
      setFiles(sortedItems);
      if (!silent) setLoading(false);
      return;
    }

    loadingRef.current = true;
    if (!silent) setLoading(true);
    setLoadingProgress(0);

    try {
      if (isWebPlatform) {
        const mockFiles = await mockFileExplorer.listFilesWithStats(path, showHiddenFiles, sortBy, sortOrder);
        setFiles(mockFiles);
        setLoading(false);
        loadingRef.current = false;
        return;
      }

      const nativePath = path.replace("file://", "");
      
      if (nativeFileExplorer.isAvailable()) {
        const nativeFiles = await nativeFileExplorer.listFilesWithStats(
          nativePath,
          showHiddenFiles,
          sortBy,
          sortOrder
        );
        
        if (currentPathRef.current !== path) {
          loadingRef.current = false;
          return;
        }

        const fileItems: FileItem[] = nativeFiles.map((f: NativeFileItem) => ({
          name: f.name,
          isDirectory: f.isDirectory,
          uri: f.uri,
          size: f.size,
          modificationTime: f.modificationTime,
        }));

        fileCache.set(cacheKey, { files: fileItems, timestamp: Date.now() });
        setFiles(fileItems);
        setLoading(false);
        loadingRef.current = false;
      } else {
        setFiles([]);
        setLoading(false);
        loadingRef.current = false;
      }
    } catch (error) {
      console.error("Error loading files:", error);
      setFiles([]);
      setLoading(false);
      loadingRef.current = false;
    }
  }, [showHiddenFiles, sortBy, sortOrder, sortFileItems]);

  const getMimeType = useCallback((filename: string): string => {
    const ext = getFileExtension(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      bmp: "image/bmp",
      webp: "image/webp",
      heic: "image/heic",
      mp4: "video/mp4",
      avi: "video/x-msvideo",
      mkv: "video/x-matroska",
      mov: "video/quicktime",
      wmv: "video/x-ms-wmv",
      "3gp": "video/3gpp",
      webm: "video/webm",
      mp3: "audio/mpeg",
      wav: "audio/wav",
      flac: "audio/flac",
      aac: "audio/aac",
      m4a: "audio/mp4",
      ogg: "audio/ogg",
      wma: "audio/x-ms-wma",
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      txt: "text/plain",
      rtf: "application/rtf",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ppt: "application/vnd.ms-powerpoint",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      zip: "application/zip",
      rar: "application/x-rar-compressed",
      "7z": "application/x-7z-compressed",
      tar: "application/x-tar",
      gz: "application/gzip",
      bz2: "application/x-bzip2",
      apk: "application/vnd.android.package-archive",
      xapk: "application/vnd.android.package-archive",
      json: "application/json",
      xml: "application/xml",
      html: "text/html",
      css: "text/css",
      js: "application/javascript",
    };
    return mimeTypes[ext] || "application/octet-stream";
  }, []);

  const openFileWithIntent = useCallback(async (file: FileItem) => {
    if (Platform.OS !== "android") {
      try {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(file.uri);
        } else {
          Alert.alert("Erreur", "Impossible d'ouvrir ce fichier");
        }
      } catch (error) {
        console.error("Error opening file:", error);
        Alert.alert("Erreur", "Impossible d'ouvrir ce fichier");
      }
      return;
    }

    try {
      const mimeType = getMimeType(file.name);
      
      await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
        data: file.uri,
        type: mimeType,
        flags: 1,
      });
    } catch (error) {
      console.error("Error opening file with intent:", error);
      try {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(file.uri);
        } else {
          Alert.alert("Erreur", "Aucune application disponible pour ouvrir ce type de fichier");
        }
      } catch (shareError) {
        Alert.alert("Erreur", "Impossible d'ouvrir ce fichier");
      }
    }
  }, [getMimeType]);

  const handleFilePress = useCallback((file: FileItem) => {
    if (file.isDirectory) {
      setPathHistory(prev => [...prev, file.uri]);
      setCurrentPath(file.uri);
      loadFiles(file.uri, true); // Préchargement silencieux pour fluidité
    } else {
      openFileWithIntent(file);
    }
  }, [openFileWithIntent, loadFiles]);

  useEffect(() => {
    const backAction = () => {
      if (pathHistory.length > 1) {
        const newHistory = pathHistory.slice(0, -1);
        const prevPath = newHistory[newHistory.length - 1];
        setPathHistory(newHistory);
        setCurrentPath(prevPath);
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction
    );

    return () => backHandler.remove();
  }, [pathHistory]);

  const handleBack = useCallback(() => {
    if (pathHistory.length > 1) {
      const newHistory = pathHistory.slice(0, -1);
      const prevPath = newHistory[newHistory.length - 1];
      setPathHistory(newHistory);
      setCurrentPath(prevPath);
    } else {
      navigation.goBack();
    }
  }, [pathHistory, navigation]);

  const handleCreateItem = useCallback(async () => {
    if (!newItemName.trim()) {
      Alert.alert("Erreur", "Veuillez entrer un nom");
      return;
    }

    if (isWebPlatform) {
      Alert.alert(t("common.error") || "Info", t("fileExplorer.createOnAndroidOnly") || "Creation de fichiers disponible uniquement sur Android");
      setShowCreateModal(false);
      setNewItemName("");
      return;
    }

    setCreateLoading(true);
    try {
      const nativePath = currentPath.replace("file://", "");
      const newPath = nativePath.endsWith("/")
        ? `${nativePath}${newItemName}`
        : `${nativePath}/${newItemName}`;

      console.log("Creating", createItemType, "at:", newPath);
      
      if (createItemType === "folder") {
        const result = await nativeFileExplorer.createDirectory(newPath);
        console.log("Create directory result:", result);
      } else {
        const result = await nativeFileExplorer.createFile(newPath);
        console.log("Create file result:", result);
      }

      const cacheKey = `${currentPath}-${showHiddenFiles}`;
      fileCache.delete(cacheKey);

      setShowCreateModal(false);
      setNewItemName("");
      setCreateLoading(false);
      
      setTimeout(() => {
        loadFiles(currentPath);
      }, 300);
      
      Alert.alert(
        "Succes",
        `${createItemType === "folder" ? "Dossier" : "Fichier"} cree avec succes`
      );
    } catch (error) {
      console.error("Error creating item:", error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      Alert.alert("Erreur", `Impossible de creer l'element: ${errorMsg}`);
      setCreateLoading(false);
    }
  }, [currentPath, newItemName, createItemType, showHiddenFiles, loadFiles]);

  const getCurrentFolderName = useCallback(() => {
    if (Platform.OS === "android" || isWebPlatform) {
      if (currentPath === ANDROID_ROOT || currentPath === "file:///storage/emulated/0") {
        return "Stockage interne";
      }
      const pathWithoutProtocol = currentPath.replace("file://", "");
      const segments = pathWithoutProtocol.split("/").filter(Boolean);
      return segments[segments.length - 1] || "Stockage interne";
    }
    const segments = currentPath.split("/").filter(Boolean);
    return segments[segments.length - 1] || "Racine";
  }, [currentPath]);

  const handleBreadcrumbNavigate = useCallback((path: string, historyIndex: number) => {
    if (historyIndex >= 0) {
      const newHistory = pathHistory.slice(0, historyIndex + 1);
      setPathHistory(newHistory);
      setCurrentPath(path);
    } else {
      setPathHistory([path]);
      setCurrentPath(path);
    }
  }, [pathHistory]);

  const filteredFiles = useMemo(() => {
    if (!searchQuery) return files;
    const query = searchQuery.toLowerCase();
    return files.filter(file => file.name.toLowerCase().includes(query));
  }, [files, searchQuery]);

  const handleLongPress = useCallback((item: FileItem) => {
    if (!isSelectionMode) {
      setIsSelectionMode(true);
      setSelectedFiles(new Set([item.uri]));
    }
  }, [isSelectionMode]);

  const handleSelect = useCallback((item: FileItem) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(item.uri)) {
        newSet.delete(item.uri);
      } else {
        newSet.add(item.uri);
      }
      if (newSet.size === 0) {
        setIsSelectionMode(false);
      }
      return newSet;
    });
  }, []);

  const renderFileItem = useCallback(({ item }: { item: FileItem }) => (
    <FileItemComponent 
      item={item} 
      onPress={handleFilePress}
      onLongPress={handleLongPress}
      isSelectionMode={isSelectionMode}
      isSelected={selectedFiles.has(item.uri)}
      onSelect={handleSelect}
    />
  ), [handleFilePress, handleLongPress, isSelectionMode, selectedFiles, handleSelect]);

  const keyExtractor = useCallback((item: FileItem) => item.uri, []);

  const getItemLayout = useCallback((_: any, index: number) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  }), []);

  const handleRefresh = useCallback(() => {
    const cacheKey = `${currentPath}-${showHiddenFiles}`;
    fileCache.delete(cacheKey);
    loadFiles(currentPath);
  }, [currentPath, showHiddenFiles, loadFiles]);

  const toggleSortBy = useCallback((option: SortOption) => {
    if (sortBy === option) {
      setSortOrder(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortBy(option);
      setSortOrder("asc");
    }
  }, [sortBy]);

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedFiles(new Set());
  }, []);

  const getSelectedItems = useCallback((): FileItem[] => {
    return files.filter(file => selectedFiles.has(file.uri));
  }, [files, selectedFiles]);

  const handleSelectAll = useCallback(() => {
    if (selectedFiles.size === files.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(files.map(f => f.uri)));
    }
  }, [files, selectedFiles.size]);

  const handleCopy = useCallback(() => {
    const items = getSelectedItems();
    setClipboardFiles(items);
    setClipboardOperation("copy");
    exitSelectionMode();
    Alert.alert("Copie", `${items.length} element(s) copie(s)`);
  }, [getSelectedItems, exitSelectionMode]);

  const handleCut = useCallback(() => {
    const items = getSelectedItems();
    setClipboardFiles(items);
    setClipboardOperation("cut");
    exitSelectionMode();
    Alert.alert("Couper", `${items.length} element(s) coupe(s)`);
  }, [getSelectedItems, exitSelectionMode]);

  const handlePaste = useCallback(async () => {
    if (clipboardFiles.length === 0 || !clipboardOperation) {
      Alert.alert("Erreur", "Rien a coller");
      return;
    }

    if (isWebPlatform) {
      Alert.alert(t("common.error") || "Info", t("fileExplorer.pasteOnAndroidOnly") || "Coller disponible uniquement sur Android");
      return;
    }

    setOperationLoading(true);

    try {
      const sourcePaths = clipboardFiles.map(item => item.uri.replace("file://", ""));
      const destFolder = currentPath.replace("file://", "");

      let result;
      if (clipboardOperation === "copy") {
        result = await nativeFileExplorer.copyMultiple(sourcePaths, destFolder);
      } else {
        result = await nativeFileExplorer.moveMultiple(sourcePaths, destFolder);
      }

      const cacheKey = `${currentPath}-${showHiddenFiles}`;
      fileCache.delete(cacheKey);
      
      if (clipboardOperation === "cut") {
        setClipboardFiles([]);
        setClipboardOperation(null);
      }

      loadFiles(currentPath);
      
      if (result.failCount > 0) {
        Alert.alert("Resultat", `${result.successCount} colles, ${result.failCount} erreurs`);
      } else {
        Alert.alert("Succes", `${result.successCount} element(s) colle(s)`);
      }
    } catch (error) {
      console.error("Error pasting:", error);
      Alert.alert("Erreur", "Impossible de coller les elements");
    } finally {
      setOperationLoading(false);
    }
  }, [clipboardFiles, clipboardOperation, currentPath, showHiddenFiles, loadFiles]);

  const handleDelete = useCallback(async () => {
    const items = getSelectedItems();

    if (isWebPlatform) {
      Alert.alert(t("common.error") || "Info", t("fileExplorer.deleteOnAndroidOnly") || "Suppression disponible uniquement sur Android");
      exitSelectionMode();
      return;
    }
    
    Alert.alert(
      "Supprimer",
      `Voulez-vous supprimer ${items.length} element(s) ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            setOperationLoading(true);

            try {
              const paths = items.map(item => item.uri.replace("file://", ""));
              const result = await nativeFileExplorer.deleteMultiple(paths);

              const cacheKey = `${currentPath}-${showHiddenFiles}`;
              fileCache.delete(cacheKey);
              exitSelectionMode();
              loadFiles(currentPath);

              if (result.failCount > 0) {
                Alert.alert("Resultat", `${result.successCount} supprimes, ${result.failCount} erreurs`);
              } else {
                Alert.alert("Succes", `${result.successCount} element(s) supprime(s)`);
              }
            } catch (error) {
              console.error("Error deleting:", error);
              Alert.alert("Erreur", "Impossible de supprimer les elements");
            } finally {
              setOperationLoading(false);
            }
          },
        },
      ]
    );
  }, [getSelectedItems, currentPath, showHiddenFiles, exitSelectionMode, loadFiles]);

  const handleRenameStart = useCallback(() => {
    const items = getSelectedItems();
    if (items.length === 1) {
      setRenameItem(items[0]);
      setRenameValue(items[0].name);
      setShowRenameModal(true);
      exitSelectionMode();
    }
  }, [getSelectedItems, exitSelectionMode]);

  const handleRenameConfirm = useCallback(async () => {
    if (!renameItem || !renameValue.trim()) {
      Alert.alert("Erreur", "Veuillez entrer un nom valide");
      return;
    }

    if (isWebPlatform) {
      Alert.alert(t("common.error") || "Info", t("fileExplorer.renameOnAndroidOnly") || "Renommer disponible uniquement sur Android");
      setShowRenameModal(false);
      setRenameItem(null);
      setRenameValue("");
      return;
    }

    setOperationLoading(true);
    try {
      const oldPath = renameItem.uri.replace("file://", "");
      const parentPath = oldPath.substring(0, oldPath.lastIndexOf("/"));
      const newPath = `${parentPath}/${renameValue}`;

      await nativeFileExplorer.rename(oldPath, newPath);

      const cacheKey = `${currentPath}-${showHiddenFiles}`;
      fileCache.delete(cacheKey);
      setShowRenameModal(false);
      setRenameItem(null);
      setRenameValue("");
      loadFiles(currentPath);
      Alert.alert("Succes", "Element renomme");
    } catch (error) {
      console.error("Error renaming:", error);
      Alert.alert("Erreur", "Impossible de renommer l'element");
    } finally {
      setOperationLoading(false);
    }
  }, [renameItem, renameValue, currentPath, showHiddenFiles, loadFiles]);

  const handleShare = useCallback(async () => {
    const items = getSelectedItems();
    if (items.length === 0) return;

    if (isWebPlatform) {
      Alert.alert(t("common.error") || "Info", t("fileExplorer.shareOnAndroidOnly") || "Partage disponible uniquement sur Android");
      return;
    }

    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert("Erreur", "Le partage n'est pas disponible sur cet appareil");
        return;
      }

      for (const item of items) {
        if (!item.isDirectory) {
          await Sharing.shareAsync(item.uri);
        }
      }
      exitSelectionMode();
    } catch (error) {
      console.error("Error sharing:", error);
      Alert.alert("Erreur", "Impossible de partager les fichiers");
    }
  }, [getSelectedItems, exitSelectionMode]);

  const filterChevronRotation = filterChevronAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const moreChevronRotation = moreChevronAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {isSelectionMode ? (
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#424242" />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {selectedFiles.size} selectionne{selectedFiles.size > 1 ? "s" : ""}
            </Text>
          </View>
          <Pressable style={styles.headerIcon} onPress={exitSelectionMode}>
            <Feather name="x" size={24} color="#424242" />
          </Pressable>
        </View>
      ) : (
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#424242" />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Explorateur
            </Text>
          </View>
          <View style={styles.headerIcons}>
            <Pressable 
              style={styles.headerIcon}
              onPress={() => setShowSearchModal(true)}
            >
              <Feather name="search" size={22} color="#424242" />
            </Pressable>
            <Pressable 
              style={styles.headerIconWithChevron}
              onPress={() => setShowFilterMenu(!showFilterMenu)}
            >
              <Feather name="sliders" size={22} color="#424242" />
              <Animated.View style={{ transform: [{ rotate: filterChevronRotation }] }}>
                <Feather name="chevron-down" size={16} color="#424242" />
              </Animated.View>
            </Pressable>
            <Pressable 
              style={styles.headerIconWithChevron}
              onPress={() => setShowMoreMenu(!showMoreMenu)}
            >
              <Feather name="more-vertical" size={22} color="#424242" />
              <Animated.View style={{ transform: [{ rotate: moreChevronRotation }] }}>
                <Feather name="chevron-down" size={16} color="#424242" />
              </Animated.View>
            </Pressable>
          </View>
        </View>
      )}

      <BreadcrumbNav
        currentPath={currentPath}
        onNavigate={handleBreadcrumbNavigate}
        pathHistory={pathHistory}
      />

      {showFilterMenu && (
        <Pressable 
          style={styles.menuOverlay}
          onPress={() => setShowFilterMenu(false)}
        >
          <Animated.View 
            style={[
              styles.dropdownMenu,
              styles.filterDropdown,
              {
                opacity: filterMenuAnim,
                transform: [{
                  translateY: filterMenuAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-10, 0]
                  })
                }]
              }
            ]}
          >
            <Pressable
              style={styles.dropdownItem}
              onPress={() => toggleSortBy("name")}
            >
              <Feather name="type" size={20} color="#424242" />
              <Text style={styles.dropdownItemText}>Nom</Text>
              {sortBy === "name" && (
                <Feather 
                  name={sortOrder === "asc" ? "arrow-up" : "arrow-down"} 
                  size={18} 
                  color="#2196F3" 
                />
              )}
            </Pressable>

            <Pressable
              style={styles.dropdownItem}
              onPress={() => toggleSortBy("date")}
            >
              <Feather name="calendar" size={20} color="#424242" />
              <Text style={styles.dropdownItemText}>Date</Text>
              {sortBy === "date" && (
                <Feather 
                  name={sortOrder === "asc" ? "arrow-up" : "arrow-down"} 
                  size={18} 
                  color="#2196F3" 
                />
              )}
            </Pressable>

            <Pressable
              style={styles.dropdownItem}
              onPress={() => toggleSortBy("size")}
            >
              <Feather name="database" size={20} color="#424242" />
              <Text style={styles.dropdownItemText}>Taille</Text>
              {sortBy === "size" && (
                <Feather 
                  name={sortOrder === "asc" ? "arrow-up" : "arrow-down"} 
                  size={18} 
                  color="#2196F3" 
                />
              )}
            </Pressable>

            <View style={styles.dropdownDivider} />

            <Pressable
              style={styles.dropdownItem}
              onPress={() => {
                setShowHiddenFiles(!showHiddenFiles);
                setShowFilterMenu(false);
              }}
            >
              <Feather name="eye-off" size={20} color="#424242" />
              <Text style={styles.dropdownItemText}>Fichiers caches</Text>
              <View style={[
                styles.checkbox,
                showHiddenFiles && styles.checkboxChecked
              ]}>
                {showHiddenFiles && (
                  <Feather name="check" size={14} color="#FFFFFF" />
                )}
              </View>
            </Pressable>
          </Animated.View>
        </Pressable>
      )}

      {showMoreMenu && (
        <Pressable 
          style={styles.menuOverlay}
          onPress={() => setShowMoreMenu(false)}
        >
          <Animated.View 
            style={[
              styles.dropdownMenu,
              styles.moreDropdown,
              {
                opacity: moreMenuAnim,
                transform: [{
                  translateY: moreMenuAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-10, 0]
                  })
                }]
              }
            ]}
          >
            <Pressable 
              style={styles.dropdownItem}
              onPress={() => {
                handleRefresh();
                setShowMoreMenu(false);
              }}
            >
              <Feather name="refresh-cw" size={20} color="#424242" />
              <Text style={styles.dropdownItemText}>Actualiser</Text>
            </Pressable>
            <Pressable 
              style={styles.dropdownItem}
              onPress={() => {
                setShowMoreMenu(false);
                setCreateItemType("folder");
                setShowCreateModal(true);
              }}
            >
              <Feather name="folder-plus" size={20} color="#424242" />
              <Text style={styles.dropdownItemText}>Nouveau dossier</Text>
            </Pressable>
            <Pressable 
              style={styles.dropdownItem}
              onPress={() => {
                setShowMoreMenu(false);
                setCreateItemType("file");
                setShowCreateModal(true);
              }}
            >
              <Feather name="file-plus" size={20} color="#424242" />
              <Text style={styles.dropdownItemText}>Nouveau fichier</Text>
            </Pressable>
            <View style={styles.dropdownDivider} />
            <Pressable style={styles.dropdownItem}>
              <Feather name="star" size={20} color="#424242" />
              <Text style={styles.dropdownItemText}>Favoris</Text>
            </Pressable>
            <Pressable style={styles.dropdownItem}>
              <Feather name="info" size={20} color="#424242" />
              <Text style={styles.dropdownItemText}>Details</Text>
            </Pressable>
          </Animated.View>
        </Pressable>
      )}

      {isWebPlatform ? (
        loading && files.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2196F3" />
            <Text style={styles.loadingText}>Chargement...</Text>
          </View>
        ) : files.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name="folder-minus" size={48} color="#BDBDBD" />
            <Text style={styles.emptyText}>Dossier vide</Text>
            <Text style={styles.emptySubtext}>
              Ce dossier ne contient aucun fichier ou sous-dossier.
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredFiles}
            renderItem={renderFileItem}
            keyExtractor={keyExtractor}
            getItemLayout={getItemLayout}
            style={styles.fileList}
            contentContainerStyle={{ paddingBottom: insets.bottom + (isSelectionMode ? 200 : 80) }}
            initialNumToRender={15}
            maxToRenderPerBatch={15}
            windowSize={5}
            removeClippedSubviews={true}
            updateCellsBatchingPeriod={50}
            onRefresh={handleRefresh}
            refreshing={loading && files.length > 0}
          />
        )
      ) : permissionDenied ? (
        <View style={styles.emptyContainer}>
          <Feather name="lock" size={48} color="#BDBDBD" />
          <Text style={styles.emptyText}>Permission refusee</Text>
          <Text style={styles.emptySubtext}>
            L'application a besoin de l'acces complet aux fichiers pour naviguer dans le stockage.
          </Text>
          <Pressable style={styles.retryButton} onPress={initializeFileSystem}>
            <Feather name="settings" size={20} color="#FFFFFF" />
            <Text style={styles.retryButtonText}>Autoriser l'acces</Text>
          </Pressable>
        </View>
      ) : loading && files.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Chargement...</Text>
          {loadingProgress > 0 && (
            <Text style={styles.loadingProgressText}>{loadingProgress}%</Text>
          )}
        </View>
      ) : files.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Feather name="folder-minus" size={48} color="#BDBDBD" />
          <Text style={styles.emptyText}>Dossier vide</Text>
          <Text style={styles.emptySubtext}>
            Ce dossier ne contient aucun fichier ou sous-dossier.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredFiles}
          renderItem={renderFileItem}
          keyExtractor={keyExtractor}
          getItemLayout={getItemLayout}
          style={styles.fileList}
          contentContainerStyle={{ paddingBottom: insets.bottom + (isSelectionMode ? 200 : 80) }}
          initialNumToRender={15}
          maxToRenderPerBatch={15}
          windowSize={5}
          removeClippedSubviews={true}
          updateCellsBatchingPeriod={50}
          onRefresh={handleRefresh}
          refreshing={loading && files.length > 0}
        />
      )}

      {!isSelectionMode ? (
        <Pressable
          style={[styles.fab, { bottom: insets.bottom + 20 }]}
          onPress={() => setShowCreateModal(true)}
        >
          <Feather name="plus" size={28} color="#FFFFFF" />
        </Pressable>
      ) : null}

      {isSelectionMode ? (
        <SelectionActionBar
          selectedCount={selectedFiles.size}
          totalCount={files.length}
          hasClipboard={clipboardFiles.length > 0 && clipboardOperation !== null}
          clipboardCount={clipboardFiles.length}
          isSingleSelection={selectedFiles.size === 1}
          onSelectAll={handleSelectAll}
          onCopy={handleCopy}
          onCut={handleCut}
          onPaste={handlePaste}
          onRename={handleRenameStart}
          onShare={handleShare}
          onDelete={handleDelete}
          onCancel={exitSelectionMode}
          isLoading={operationLoading}
        />
      ) : null}

      <AdvancedSearchModal
        visible={showSearchModal}
        files={files}
        onClose={() => {
          setShowSearchModal(false);
          setSearchQuery("");
        }}
        onSelectFile={handleFilePress}
        renderFileItem={renderFileItem}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
      />

      <Modal
        visible={showCreateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.createModal, { marginTop: insets.top }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nouvel element</Text>
              <Pressable onPress={() => setShowCreateModal(false)}>
                <Feather name="x" size={24} color="#757575" />
              </Pressable>
            </View>

            <View style={styles.createTypeSelector}>
              <Pressable
                style={[
                  styles.createTypeButton,
                  createItemType === "folder" && styles.createTypeButtonActive
                ]}
                onPress={() => setCreateItemType("folder")}
              >
                <Feather 
                  name="folder" 
                  size={20} 
                  color={createItemType === "folder" ? "#2196F3" : "#757575"} 
                />
                <Text style={[
                  styles.createTypeText,
                  createItemType === "folder" && styles.createTypeTextActive
                ]}>
                  Dossier
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.createTypeButton,
                  createItemType === "file" && styles.createTypeButtonActive
                ]}
                onPress={() => setCreateItemType("file")}
              >
                <Feather 
                  name="file" 
                  size={20} 
                  color={createItemType === "file" ? "#2196F3" : "#757575"} 
                />
                <Text style={[
                  styles.createTypeText,
                  createItemType === "file" && styles.createTypeTextActive
                ]}>
                  Fichier
                </Text>
              </Pressable>
            </View>

            <TextInput
              style={styles.createInput}
              placeholder={`Nom du ${createItemType === "folder" ? "dossier" : "fichier"}`}
              placeholderTextColor="#9E9E9E"
              value={newItemName}
              onChangeText={setNewItemName}
              autoFocus
            />

            <View style={styles.createActions}>
              <Pressable
                style={styles.createCancelButton}
                onPress={() => {
                  setShowCreateModal(false);
                  setNewItemName("");
                }}
              >
                <Text style={styles.createCancelText}>Annuler</Text>
              </Pressable>
              <Pressable
                style={[styles.createConfirmButton, createLoading && styles.createConfirmButtonDisabled]}
                onPress={handleCreateItem}
                disabled={createLoading}
              >
                <Text style={styles.createConfirmText}>
                  {createLoading ? "Creation..." : "Creer"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showRenameModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRenameModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.createModal, { marginTop: insets.top }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Renommer</Text>
              <Pressable onPress={() => setShowRenameModal(false)}>
                <Feather name="x" size={24} color="#757575" />
              </Pressable>
            </View>
            <TextInput
              style={[styles.createInput, { marginTop: 16 }]}
              placeholder="Nouveau nom"
              placeholderTextColor="#9E9E9E"
              value={renameValue}
              onChangeText={setRenameValue}
              autoFocus
            />
            <View style={styles.createActions}>
              <Pressable
                style={styles.createCancelButton}
                onPress={() => {
                  setShowRenameModal(false);
                  setRenameItem(null);
                  setRenameValue("");
                }}
              >
                <Text style={styles.createCancelText}>Annuler</Text>
              </Pressable>
              <Pressable
                style={styles.createConfirmButton}
                onPress={handleRenameConfirm}
                disabled={operationLoading}
              >
                <Text style={styles.createConfirmText}>
                  {operationLoading ? "..." : "Renommer"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
    backgroundColor: "#FFFFFF",
  },
  backButton: {
    padding: 8,
    marginRight: 4,
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#212121",
  },
  headerIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  headerIcon: {
    padding: 8,
  },
  headerIconWithChevron: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    gap: 2,
  },
  breadcrumbContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#FAFAFA",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  breadcrumbText: {
    fontSize: 13,
    color: "#757575",
    flex: 1,
  },
  progressText: {
    fontSize: 12,
    color: "#2196F3",
    marginLeft: 8,
  },
  menuOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  dropdownMenu: {
    position: "absolute",
    top: 100,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    paddingVertical: 8,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    minWidth: 180,
  },
  filterDropdown: {
    right: 56,
  },
  moreDropdown: {
    right: 16,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  dropdownItemText: {
    fontSize: 15,
    color: "#424242",
    flex: 1,
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: "#E0E0E0",
    marginVertical: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#BDBDBD",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: "#2196F3",
    borderColor: "#2196F3",
  },
  fileList: {
    flex: 1,
  },
  fileItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    height: ITEM_HEIGHT,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
    backgroundColor: "#FFFFFF",
  },
  fileItemPressed: {
    backgroundColor: "#F5F5F5",
  },
  fileIconContainer: {
    width: 56,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  fileInfo: {
    flex: 1,
    justifyContent: "center",
  },
  fileName: {
    fontSize: 15,
    fontWeight: "400",
    color: "#212121",
    marginBottom: 2,
  },
  fileDetails: {
    fontSize: 12,
    color: "#757575",
  },
  fileDateContainer: {
    alignItems: "flex-end",
    marginLeft: 12,
  },
  fileDate: {
    fontSize: 12,
    color: "#9E9E9E",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: "#757575",
  },
  loadingProgressText: {
    fontSize: 14,
    color: "#2196F3",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    color: "#757575",
    fontWeight: "500",
  },
  emptySubtext: {
    fontSize: 14,
    color: "#9E9E9E",
    textAlign: "center",
    lineHeight: 20,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2196F3",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
    marginTop: 8,
  },
  retryButtonText: {
    fontSize: 15,
    color: "#FFFFFF",
    fontWeight: "500",
  },
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#2196F3",
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  searchModal: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  searchHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#F5F5F5",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#212121",
    paddingVertical: 8,
  },
  searchResults: {
    flex: 1,
  },
  emptySearchContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
    gap: 16,
  },
  emptySearchText: {
    fontSize: 16,
    color: "#757575",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  createModal: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    width: "100%",
    maxWidth: 400,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#212121",
  },
  createTypeSelector: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  createTypeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    gap: 8,
  },
  createTypeButtonActive: {
    backgroundColor: "#E3F2FD",
    borderColor: "#2196F3",
  },
  createTypeText: {
    fontSize: 15,
    color: "#757575",
  },
  createTypeTextActive: {
    color: "#2196F3",
    fontWeight: "500",
  },
  createInput: {
    marginHorizontal: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    fontSize: 15,
    color: "#212121",
  },
  createActions: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 12,
  },
  createCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    alignItems: "center",
  },
  createCancelText: {
    fontSize: 15,
    color: "#757575",
  },
  createConfirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#2196F3",
    alignItems: "center",
  },
  createConfirmButtonDisabled: {
    opacity: 0.6,
  },
  createConfirmText: {
    fontSize: 15,
    color: "#FFFFFF",
    fontWeight: "500",
  },
  fileItemSelected: {
    backgroundColor: "#E3F2FD",
  },
  fileCheckboxContainer: {
    marginRight: 8,
  },
  fileCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#BDBDBD",
    justifyContent: "center",
    alignItems: "center",
  },
  fileCheckboxChecked: {
    backgroundColor: "#2196F3",
    borderColor: "#2196F3",
  },
  selectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
    backgroundColor: "#E3F2FD",
  },
  selectionCount: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#1565C0",
    marginLeft: 8,
  },
  selectionActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  selectionAction: {
    padding: 8,
  },
  pasteButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2196F3",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  pasteButtonText: {
    fontSize: 13,
    color: "#FFFFFF",
    fontWeight: "500",
  },
});
