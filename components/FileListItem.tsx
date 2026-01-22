import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";

export interface FileItem {
  id: string;
  name: string;
  size: string;
  type: "image" | "document" | "audio" | "video" | "other";
  isSelected?: boolean;
}

interface FileListItemProps {
  file: FileItem;
  onPress: () => void;
}

const fileIcons = {
  image: "image",
  document: "file-text",
  audio: "music",
  video: "video",
  other: "file",
} as const;

export function FileListItem({ file, onPress }: FileListItemProps) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: pressed
            ? `${theme.border}1A`
            : "transparent",
        },
      ]}
    >
      <View style={styles.checkbox}>
        <Feather
          name={file.isSelected ? "check-circle" : "circle"}
          size={24}
          color={file.isSelected ? theme.primary : theme.tabIconDefault}
        />
      </View>
      <View style={[styles.iconContainer, { backgroundColor: `${theme.primary}20` }]}>
        <Feather name={fileIcons[file.type]} size={20} color={theme.primary} />
      </View>
      <View style={styles.details}>
        <ThemedText style={styles.name} numberOfLines={1}>
          {file.name}
        </ThemedText>
        <ThemedText style={styles.size}>{file.size}</ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    height: 72,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E2E8F0",
  },
  checkbox: {
    marginRight: Spacing.md,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  details: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: "500",
    marginBottom: 2,
  },
  size: {
    fontSize: 13,
    opacity: 0.6,
  },
});
