import React, { useState, useMemo } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Text,
  FlatList,
  TextInput,
  useColorScheme,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { getThemeColors } from "@/constants/theme";

interface FileItem {
  name: string;
  isDirectory: boolean;
  uri: string;
  size: number;
  modificationTime: number;
}

interface AdvancedSearchModalProps {
  visible: boolean;
  files: FileItem[];
  onClose: () => void;
  onSelectFile: (file: FileItem) => void;
  renderFileItem: (props: { item: FileItem }) => React.ReactNode;
  keyExtractor: (item: FileItem) => string;
  getItemLayout: (data: any, index: number) => any;
}

type FileCategory = "all" | "documents" | "media" | "images" | "videos" | "audio" | "archives";

const getCategoryIcon = (category: FileCategory): keyof typeof Feather.glyphMap => {
  switch (category) {
    case "documents": return "file-text";
    case "media": return "folder";
    case "images": return "image";
    case "videos": return "play-circle";
    case "audio": return "music";
    case "archives": return "archive";
    default: return "file";
  }
};

const getFileCategory = (filename: string): FileCategory => {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  
  if (["jpg", "jpeg", "png", "gif", "bmp", "webp", "heic"].includes(ext)) return "images";
  if (["mp4", "avi", "mkv", "mov", "wmv", "3gp", "webm"].includes(ext)) return "videos";
  if (["mp3", "wav", "flac", "aac", "m4a", "ogg", "wma"].includes(ext)) return "audio";
  if (["pdf", "doc", "docx", "txt", "rtf", "xls", "xlsx", "ppt", "pptx"].includes(ext)) return "documents";
  if (["zip", "rar", "7z", "tar", "gz", "bz2"].includes(ext)) return "archives";
  
  return "all";
};

export default function AdvancedSearchModal({
  visible,
  files,
  onClose,
  onSelectFile,
  renderFileItem,
  keyExtractor,
  getItemLayout,
}: AdvancedSearchModalProps) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = getThemeColors(colorScheme === "dark");
  const { t } = useTranslation();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<FileCategory>("all");

  const categories: { id: FileCategory; label: string }[] = [
    { id: "all", label: t("common.files") || "Tous" },
    { id: "documents", label: t("fileExplorer.documents") || "Documents" },
    { id: "images", label: t("fileExplorer.images") || "Images" },
    { id: "videos", label: t("fileExplorer.videos") || "Vidéos" },
    { id: "audio", label: t("fileExplorer.audio") || "Audio" },
    { id: "archives", label: t("fileExplorer.archives") || "Archives" },
  ];

  const filteredFiles = useMemo(() => {
    let results = files;

    if (selectedCategory !== "all") {
      results = results.filter(file => {
        if (file.isDirectory) return false;
        return getFileCategory(file.name) === selectedCategory;
      });
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      results = results.filter(file =>
        file.name.toLowerCase().includes(query)
      );
    }

    return results;
  }, [files, searchQuery, selectedCategory]);

  if (!visible) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={onClose} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={colors.text} />
        </Pressable>
        <TextInput
          style={[styles.searchInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
          placeholder={t("fileExplorer.searchPlaceholder") || "Rechercher..."}
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoFocus
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery("")} style={styles.clearButton}>
            <Feather name="x" size={22} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>

      <View style={[styles.filterRibbon, { borderBottomColor: colors.border }]}>
        <FlatList
          horizontal
          data={categories}
          renderItem={({ item }) => (
            <Pressable
              style={[
                styles.filterButton,
                {
                  backgroundColor:
                    selectedCategory === item.id ? colors.primary : colors.card,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => setSelectedCategory(item.id)}
            >
              <Feather
                name={getCategoryIcon(item.id)}
                size={16}
                color={selectedCategory === item.id ? "#FFFFFF" : colors.text}
              />
              <Text
                style={[
                  styles.filterText,
                  {
                    color: selectedCategory === item.id ? "#FFFFFF" : colors.text,
                  },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          )}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
        />
      </View>

      {searchQuery.length > 0 || selectedCategory !== "all" ? (
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
          <View style={styles.emptyContainer}>
            <Feather name="search" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {t("fileExplorer.noResults") || "Aucun résultat"}
            </Text>
          </View>
        )
      ) : (
        <View style={styles.emptyContainer}>
          <Feather name="search" size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {t("fileExplorer.enterSearchTerm") || "Entrez un terme de recherche"}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  backButton: {
    padding: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 15,
  },
  clearButton: {
    padding: 8,
  },
  filterRibbon: {
    borderBottomWidth: 1,
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  filterText: {
    fontSize: 13,
    fontWeight: "500",
  },
  searchResults: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: "500",
  },
});
