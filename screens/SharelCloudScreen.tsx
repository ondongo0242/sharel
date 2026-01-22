import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Text,
  Alert,
  FlatList,
  Modal,
  TextInput,
  Animated,
  ActivityIndicator,
  ScrollView,
  Platform,
  Linking,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HomeStackParamList } from "@/navigation/HomeStackNavigator";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import TGBoxApiService, { TGBoxFile, TGBoxFolder } from "@/services/TGBoxApiService";
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

type SharelCloudScreenNavigationProp = NativeStackNavigationProp<
  HomeStackParamList,
  "SharelCloud"
>;

interface Props {
  navigation: SharelCloudScreenNavigationProp;
}

type SortOption = "name" | "date" | "size" | "type";
type SortOrder = "asc" | "desc";

const ITEM_HEIGHT = 64;

const getFileExtension = (name: string): string => {
  const parts = name.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
};

const getFileIcon = (file: TGBoxFile): keyof typeof Feather.glyphMap => {
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

const getFileIconColor = (file: TGBoxFile): string => {
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
  item: TGBoxFile;
  onPress: (item: TGBoxFile) => void;
}

const FileItemComponent = memo(({ item, onPress }: FileItemComponentProps) => {
  const handlePress = useCallback(() => {
    onPress(item);
  }, [item, onPress]);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.fileItem,
        pressed && styles.fileItemPressed,
      ]}
      onPress={handlePress}
    >
      <View style={styles.fileIconContainer}>
        <Feather
          name={getFileIcon(item)}
          size={28}
          color={getFileIconColor(item)}
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

export default function SharelCloudScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [currentFolderId, setCurrentFolderId] = useState<string>(TGBoxApiService.getRootFolderId());
  const [currentFolder, setCurrentFolder] = useState<TGBoxFolder | null>(null);
  const [files, setFiles] = useState<TGBoxFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [folderHistory, setFolderHistory] = useState<string[]>([TGBoxApiService.getRootFolderId()]);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [newFolderName, setNewFolderName] = useState("");
  const [showApiConfig, setShowApiConfig] = useState(false);
  const [prodUrl, setProdUrl] = useState("");
  const [devUrl, setDevUrl] = useState("");
  const [useProduction, setUseProduction] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  
  const filterMenuAnim = useRef(new Animated.Value(0)).current;
  const moreMenuAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const initApp = async () => {
      await TGBoxApiService.loadApiConfig();
      loadApiConfig();
      setConfigLoaded(true);
      
      // Check if user is authenticated
      try {
        const { data } = await (await import('@/lib/supabase')).supabase.auth.getSession();
        if (data.session?.user) {
          setIsAuthenticated(true);
          TGBoxApiService.setUserInfo(data.session.user.id, data.session.user.email || '');
          // Auto-load files when user is authenticated
          loadFolderContents(TGBoxApiService.getRootFolderId());
        }
      } catch (err) {
        console.error('Error checking auth:', err);
      }
      setAuthChecked(true);
    };
    initApp();
  }, []);

  const loadApiConfig = async () => {
    const config = TGBoxApiService.getApiConfig();
    if (config) {
      setProdUrl(config.prodUrl);
      setDevUrl(config.devUrl);
      setUseProduction(config.useProduction);
    }
  };

  useEffect(() => {
    Animated.timing(filterMenuAnim, {
      toValue: showFilterMenu ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [showFilterMenu, filterMenuAnim]);

  useEffect(() => {
    Animated.timing(moreMenuAnim, {
      toValue: showMoreMenu ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [showMoreMenu, moreMenuAnim]);

  const loadFolderInfo = async (folderId: string) => {
    try {
      const folder = await TGBoxApiService.getFolderInfo(folderId);
      setCurrentFolder(folder);
    } catch (err) {
      console.error("Error loading folder info:", err);
    }
  };

  const loadFolderContents = async (folderId: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const items = await TGBoxApiService.getFolderContents(folderId);
      const sortedItems = sortFileItems(items || [], sortBy, sortOrder);
      setFiles(sortedItems);
    } catch (err: any) {
      const msg = err?.message || "Erreur lors du chargement des fichiers";
      setError(msg);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const sortFileItems = useCallback((items: TGBoxFile[], sort: SortOption, order: SortOrder): TGBoxFile[] => {
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

  useEffect(() => {
    if (files.length > 0) {
      const sortedItems = sortFileItems(files, sortBy, sortOrder);
      setFiles(sortedItems);
    }
  }, [sortBy, sortOrder]);

  const handleFilePress = useCallback((file: TGBoxFile) => {
    if (file.isDirectory) {
      setFolderHistory(prev => [...prev, file.id]);
      setCurrentFolderId(file.id);
      loadFolderInfo(file.id);
    } else {
      Alert.alert(
        file.name,
        `Taille: ${formatFileSize(file.size)}\nModifie: ${formatDate(file.modificationTime)}`,
        [
          { text: "Annuler", style: "cancel" },
          { 
            text: "Ouvrir", 
            onPress: async () => {
              try {
                const url = await TGBoxApiService.getDownloadUrl(file.id);
                if (url) {
                  await Linking.openURL(url);
                } else {
                  Alert.alert("Erreur", "Impossible d'ouvrir ce fichier");
                }
              } catch (err) {
                Alert.alert("Erreur", "Impossible d'ouvrir le fichier");
              }
            }
          },
          { 
            text: "Telecharger", 
            onPress: async () => {
              try {
                const url = await TGBoxApiService.getDownloadUrl(file.id);
                if (url) {
                  Alert.alert("Telechargement", "Le lien de téléchargement est prêt.\nUtilise ton gestionnaire de fichiers pour télécharger.");
                } else {
                  Alert.alert("Erreur", "Impossible de telecharger ce fichier");
                }
              } catch (err) {
                Alert.alert("Erreur", "Erreur lors du téléchargement");
              }
            }
          },
        ]
      );
    }
  }, []);

  const handleBack = useCallback(() => {
    if (folderHistory.length > 1) {
      const newHistory = folderHistory.slice(0, -1);
      setFolderHistory(newHistory);
      setCurrentFolderId(newHistory[newHistory.length - 1]);
    } else {
      navigation.goBack();
    }
  }, [folderHistory, navigation]);

  const handleCreateFolder = useCallback(async () => {
    if (!newFolderName.trim()) {
      Alert.alert("Erreur", "Veuillez entrer un nom de dossier");
      return;
    }

    try {
      await TGBoxApiService.createFolder(newFolderName.trim(), currentFolderId);
      setShowCreateModal(false);
      setNewFolderName("");
      loadFolderContents(currentFolderId);
      Alert.alert("Succes", "Dossier cree avec succes");
    } catch (err: any) {
      Alert.alert("Erreur", err.message || "Impossible de creer le dossier");
    }
  }, [currentFolderId, newFolderName]);

  const getCurrentFolderName = useCallback(() => {
    if (currentFolder) {
      return currentFolder.name;
    }
    return "Mon espace Sharel";
  }, [currentFolder]);

  const getBreadcrumb = useCallback(() => {
    if (folderHistory.length <= 1) {
      return "Cloud";
    }
    return `Cloud > ${currentFolder?.name || "..."}`;
  }, [folderHistory, currentFolder]);

  const filteredFiles = useMemo(() => {
    if (!searchQuery) return files;
    const query = searchQuery.toLowerCase();
    return files.filter(file => file.name.toLowerCase().includes(query));
  }, [files, searchQuery]);

  const renderFileItem = useCallback(({ item }: { item: TGBoxFile }) => (
    <FileItemComponent item={item} onPress={handleFilePress} />
  ), [handleFilePress]);

  const keyExtractor = useCallback((item: TGBoxFile) => item.id, []);

  const getItemLayout = useCallback((_: any, index: number) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  }), []);

  const handleRefresh = useCallback(() => {
    TGBoxApiService.clearCache(currentFolderId);
    loadFolderContents(currentFolderId);
  }, [currentFolderId]);

  const toggleSortBy = useCallback((option: SortOption) => {
    if (sortBy === option) {
      setSortOrder(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortBy(option);
      setSortOrder("asc");
    }
  }, [sortBy]);

  const handleUploadFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: false,
      });

      if (result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setLoading(true);
        try {
          await TGBoxApiService.uploadFile(file.uri, file.name, currentFolderId);
          loadFolderContents(currentFolderId);
          Alert.alert("Succès", `${file.name} a été téléchargé avec succès`);
        } catch (err: any) {
          Alert.alert("Erreur", err.message || "Erreur lors de l'upload du fichier");
        } finally {
          setLoading(false);
        }
      }
    } catch (err: any) {
      console.error("Document picker error:", err);
    }
  }, [currentFolderId]);

  const handleUploadPhoto = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets.length > 0) {
        const photo = result.assets[0];
        const filename = `photo_${Date.now()}.jpg`;
        setLoading(true);
        try {
          await TGBoxApiService.uploadFile(photo.uri, filename, currentFolderId);
          loadFolderContents(currentFolderId);
          Alert.alert("Succès", "Photo téléchargée avec succès");
        } catch (err: any) {
          Alert.alert("Erreur", err.message || "Erreur lors de l'upload");
        } finally {
          setLoading(false);
        }
      }
    } catch (err: any) {
      console.error("Image picker error:", err);
    }
  }, [currentFolderId]);

  // Show login prompt if not authenticated
  if (authChecked && !isAuthenticated) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.emptyContainer}>
          <Feather name="lock" size={64} color="#BDBDBD" />
          <Text style={styles.emptyText}>Authentification requise</Text>
          <Text style={styles.emptySubtext}>Veuillez vous connecter pour accéder à votre espace Sharel</Text>
          <Pressable 
            style={styles.retryButton} 
            onPress={() => navigation.navigate('Login' as never)}
          >
            <Feather name="log-in" size={18} color="#FFFFFF" />
            <Text style={styles.retryButtonText}>Se connecter</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#424242" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {getCurrentFolderName()}
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
            style={styles.headerIcon}
            onPress={() => setShowFilterMenu(!showFilterMenu)}
          >
            <Feather name="filter" size={22} color="#424242" />
          </Pressable>
          <Pressable 
            style={styles.headerIcon}
            onPress={() => setShowMoreMenu(!showMoreMenu)}
          >
            <Feather name="more-vertical" size={22} color="#424242" />
          </Pressable>
        </View>
      </View>

      <View style={styles.breadcrumbContainer}>
        <Text style={styles.breadcrumbText} numberOfLines={1}>
          {getBreadcrumb()}
        </Text>
        <View style={styles.cloudIndicator}>
          <Feather name="cloud" size={16} color="#10B981" />
        </View>
      </View>

      {(showFilterMenu || showMoreMenu) ? (
        <Pressable 
          style={styles.menuOverlay}
          onPress={() => {
            setShowFilterMenu(false);
            setShowMoreMenu(false);
          }}
        >
          {showFilterMenu ? (
            <Animated.View 
              style={[
                styles.dropdownMenu,
                styles.filterDropdown,
                { opacity: filterMenuAnim, transform: [{ scale: filterMenuAnim }] }
              ]}
            >
              <Pressable style={styles.dropdownItem} onPress={() => toggleSortBy("name")}>
                <Feather name="type" size={18} color="#424242" />
                <Text style={styles.dropdownItemText}>Nom</Text>
                {sortBy === "name" ? (
                  <Feather name={sortOrder === "asc" ? "arrow-up" : "arrow-down"} size={16} color="#2196F3" />
                ) : null}
              </Pressable>
              <Pressable style={styles.dropdownItem} onPress={() => toggleSortBy("date")}>
                <Feather name="calendar" size={18} color="#424242" />
                <Text style={styles.dropdownItemText}>Date</Text>
                {sortBy === "date" ? (
                  <Feather name={sortOrder === "asc" ? "arrow-up" : "arrow-down"} size={16} color="#2196F3" />
                ) : null}
              </Pressable>
              <Pressable style={styles.dropdownItem} onPress={() => toggleSortBy("size")}>
                <Feather name="hard-drive" size={18} color="#424242" />
                <Text style={styles.dropdownItemText}>Taille</Text>
                {sortBy === "size" ? (
                  <Feather name={sortOrder === "asc" ? "arrow-up" : "arrow-down"} size={16} color="#2196F3" />
                ) : null}
              </Pressable>
              <Pressable style={styles.dropdownItem} onPress={() => toggleSortBy("type")}>
                <Feather name="file" size={18} color="#424242" />
                <Text style={styles.dropdownItemText}>Type</Text>
                {sortBy === "type" ? (
                  <Feather name={sortOrder === "asc" ? "arrow-up" : "arrow-down"} size={16} color="#2196F3" />
                ) : null}
              </Pressable>
            </Animated.View>
          ) : null}

          {showMoreMenu ? (
            <Animated.View 
              style={[
                styles.dropdownMenu,
                styles.moreDropdown,
                { opacity: moreMenuAnim, transform: [{ scale: moreMenuAnim }] }
              ]}
            >
              <Pressable 
                style={styles.dropdownItem}
                onPress={() => {
                  setShowMoreMenu(false);
                  handleRefresh();
                }}
              >
                <Feather name="refresh-cw" size={18} color="#424242" />
                <Text style={styles.dropdownItemText}>Actualiser</Text>
              </Pressable>
              <View style={styles.dropdownDivider} />
              <Pressable 
                style={styles.dropdownItem}
                onPress={() => {
                  setShowMoreMenu(false);
                  TGBoxApiService.clearCache();
                  Alert.alert("Cache", "Cache vide avec succes");
                }}
              >
                <Feather name="trash-2" size={18} color="#424242" />
                <Text style={styles.dropdownItemText}>Vider le cache</Text>
              </Pressable>
              <View style={styles.dropdownDivider} />
              <Pressable 
                style={styles.dropdownItem}
                onPress={() => {
                  setShowMoreMenu(false);
                  setShowApiConfig(true);
                }}
              >
                <Feather name="settings" size={18} color="#424242" />
                <Text style={styles.dropdownItemText}>Config API</Text>
              </Pressable>
            </Animated.View>
          ) : null}
        </Pressable>
      ) : null}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      ) : error ? (
        <View style={styles.emptyContainer}>
          <Feather name="cloud-off" size={64} color="#BDBDBD" />
          <Text style={styles.emptyText}>Erreur de connexion</Text>
          <Text style={styles.emptySubtext}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={handleRefresh}>
            <Feather name="refresh-cw" size={18} color="#FFFFFF" />
            <Text style={styles.retryButtonText}>Reessayer</Text>
          </Pressable>
        </View>
      ) : !configLoaded ? (
        <View style={styles.emptyContainer}>
          <Feather name="cloud" size={64} color="#10B981" />
          <Text style={styles.emptyText}>Configuration en cours</Text>
          <Text style={styles.emptySubtext}>Patientez...</Text>
        </View>
      ) : files.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Feather name="cloud" size={64} color="#10B981" />
          <Text style={styles.emptyText}>Dossier vide</Text>
          <Text style={styles.emptySubtext}>
            Aucun fichier ou dossier vide.{"\n"}Cliquez sur Charger ou +.
          </Text>
          <Pressable style={styles.retryButton} onPress={() => {
            loadFolderContents(currentFolderId);
            loadFolderInfo(currentFolderId);
          }}>
            <Feather name="download" size={18} color="#FFFFFF" />
            <Text style={styles.retryButtonText}>Charger les fichiers</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={files}
          renderItem={renderFileItem}
          keyExtractor={keyExtractor}
          getItemLayout={getItemLayout}
          style={styles.fileList}
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
          initialNumToRender={15}
          maxToRenderPerBatch={15}
          windowSize={5}
          removeClippedSubviews={true}
          onRefresh={handleRefresh}
          refreshing={loading}
        />
      )}

      {showUploadMenu && (
        <Pressable 
          style={StyleSheet.absoluteFill}
          onPress={() => setShowUploadMenu(false)}
        />
      )}

      {showUploadMenu ? (
        <View style={[styles.uploadMenuContainer, { bottom: insets.bottom + 80 }]}>
          <Pressable 
            style={styles.uploadMenuItem}
            onPress={() => {
              setShowUploadMenu(false);
              handleUploadFile();
            }}
          >
            <Feather name="file" size={24} color="#10B981" />
            <Text style={styles.uploadMenuText}>Fichier</Text>
          </Pressable>
          <Pressable 
            style={styles.uploadMenuItem}
            onPress={() => {
              setShowUploadMenu(false);
              handleUploadPhoto();
            }}
          >
            <Feather name="image" size={24} color="#10B981" />
            <Text style={styles.uploadMenuText}>Photo</Text>
          </Pressable>
          <Pressable 
            style={styles.uploadMenuItem}
            onPress={() => {
              setShowUploadMenu(false);
              setShowCreateModal(true);
            }}
          >
            <Feather name="folder-plus" size={24} color="#10B981" />
            <Text style={styles.uploadMenuText}>Dossier</Text>
          </Pressable>
        </View>
      ) : null}

      <Pressable 
        style={[styles.fab, { bottom: insets.bottom + 20 }]}
        onPress={() => setShowUploadMenu(!showUploadMenu)}
      >
        <Feather name="plus" size={28} color="#FFFFFF" />
      </Pressable>

      <Modal
        visible={showSearchModal}
        animationType="slide"
        onRequestClose={() => setShowSearchModal(false)}
      >
        <View style={[styles.searchModal, { paddingTop: insets.top }]}>
          <View style={styles.searchHeader}>
            <Pressable onPress={() => {
              setShowSearchModal(false);
              setSearchQuery("");
            }}>
              <Feather name="arrow-left" size={24} color="#424242" />
            </Pressable>
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher des fichiers..."
              placeholderTextColor="#9E9E9E"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {searchQuery.length > 0 ? (
              <Pressable onPress={() => setSearchQuery("")}>
                <Feather name="x" size={22} color="#757575" />
              </Pressable>
            ) : null}
          </View>
          
          {searchQuery.length > 0 ? (
            filteredFiles.length > 0 ? (
              <FlatList
                data={filteredFiles}
                renderItem={renderFileItem}
                keyExtractor={keyExtractor}
                getItemLayout={getItemLayout}
                style={styles.searchResults}
                contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
                initialNumToRender={15}
                maxToRenderPerBatch={15}
                windowSize={5}
                removeClippedSubviews={true}
              />
            ) : (
              <View style={styles.emptySearchContainer}>
                <Feather name="search" size={48} color="#BDBDBD" />
                <Text style={styles.emptySearchText}>Aucun resultat</Text>
              </View>
            )
          ) : (
            <View style={styles.emptySearchContainer}>
              <Feather name="search" size={48} color="#BDBDBD" />
              <Text style={styles.emptySearchText}>Entrez un terme de recherche</Text>
            </View>
          )}
        </View>
      </Modal>

      <Modal
        visible={showCreateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.createModal, { marginTop: insets.top }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nouveau dossier</Text>
              <Pressable onPress={() => setShowCreateModal(false)}>
                <Feather name="x" size={24} color="#757575" />
              </Pressable>
            </View>

            <View style={styles.createIconContainer}>
              <View style={styles.createIconCircle}>
                <Feather name="folder-plus" size={32} color="#10B981" />
              </View>
            </View>

            <TextInput
              style={styles.createInput}
              placeholder="Nom du dossier"
              placeholderTextColor="#9E9E9E"
              value={newFolderName}
              onChangeText={setNewFolderName}
              autoFocus
            />

            <View style={styles.createActions}>
              <Pressable
                style={styles.createCancelButton}
                onPress={() => {
                  setShowCreateModal(false);
                  setNewFolderName("");
                }}
              >
                <Text style={styles.createCancelText}>Annuler</Text>
              </Pressable>
              <Pressable
                style={styles.createConfirmButton}
                onPress={handleCreateFolder}
              >
                <Text style={styles.createConfirmText}>Creer</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showApiConfig}
        transparent
        animationType="fade"
        onRequestClose={() => setShowApiConfig(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.createModal, { marginTop: insets.top }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Config API TGBox</Text>
              <Pressable onPress={() => setShowApiConfig(false)}>
                <Feather name="x" size={24} color="#757575" />
              </Pressable>
            </View>

            <ScrollView style={styles.configScroll}>
              <Text style={styles.configLabel}>URL Production</Text>
              <TextInput
                style={styles.createInput}
                placeholder="https://api.tgbox.io"
                placeholderTextColor="#9E9E9E"
                value={prodUrl}
                onChangeText={setProdUrl}
              />

              <Text style={styles.configLabel}>URL Développement (Replit)</Text>
              <TextInput
                style={styles.createInput}
                placeholder="https://...replit.dev"
                placeholderTextColor="#9E9E9E"
                value={devUrl}
                onChangeText={setDevUrl}
              />

              <View style={styles.configToggle}>
                <Text style={styles.configToggleText}>Mode Production</Text>
                <Pressable 
                  style={[styles.toggleButton, useProduction && styles.toggleActive]}
                  onPress={() => setUseProduction(!useProduction)}
                >
                  <Text style={styles.toggleText}>{useProduction ? "ON" : "OFF"}</Text>
                </Pressable>
              </View>
            </ScrollView>

            <View style={styles.createActions}>
              <Pressable
                style={styles.createCancelButton}
                onPress={() => setShowApiConfig(false)}
              >
                <Text style={styles.createCancelText}>Annuler</Text>
              </Pressable>
              <Pressable
                style={styles.createConfirmButton}
                onPress={async () => {
                  await TGBoxApiService.saveApiConfig({
                    prodUrl,
                    devUrl,
                    useProduction,
                  });
                  Alert.alert("Succes", "Configuration API sauvegardee");
                  setShowApiConfig(false);
                  handleRefresh();
                }}
              >
                <Text style={styles.createConfirmText}>Sauvegarder</Text>
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
    gap: 8,
  },
  headerIcon: {
    padding: 8,
  },
  breadcrumbContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#F0FDF4",
    borderBottomWidth: 1,
    borderBottomColor: "#D1FAE5",
  },
  breadcrumbText: {
    fontSize: 13,
    color: "#059669",
    flex: 1,
  },
  cloudIndicator: {
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
    width: 40,
    height: 40,
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
    backgroundColor: "#10B981",
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
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    zIndex: 10,
  },
  uploadMenuContainer: {
    position: "absolute",
    right: 20,
    flexDirection: "column-reverse",
    alignItems: "center",
    gap: 12,
    zIndex: 9,
  },
  uploadMenuItem: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    gap: 4,
  },
  uploadMenuText: {
    fontSize: 11,
    color: "#10B981",
    fontWeight: "500",
    marginTop: 2,
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
  createIconContainer: {
    alignItems: "center",
    paddingVertical: 20,
  },
  createIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#D1FAE5",
    justifyContent: "center",
    alignItems: "center",
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
    backgroundColor: "#10B981",
    alignItems: "center",
  },
  createConfirmText: {
    fontSize: 15,
    color: "#FFFFFF",
    fontWeight: "500",
  },
});
