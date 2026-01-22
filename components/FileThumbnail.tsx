import React, { useState } from "react";
import { View, Image, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";

interface FileThumbnailProps {
  uri: string;
  filename: string;
  isDirectory: boolean;
  size: number;
}

const getFileExtension = (name: string): string => {
  const parts = name.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
};

const getThumbnailBackground = (filename: string, isDirectory: boolean): string => {
  if (isDirectory) return "#FFB74D";
  
  const ext = getFileExtension(filename);
  if (["jpg", "jpeg", "png", "gif", "bmp", "webp", "heic"].includes(ext)) return "#4CAF50";
  if (["mp4", "avi", "mkv", "mov", "wmv", "3gp", "webm"].includes(ext)) return "#E91E63";
  if (["mp3", "wav", "flac", "aac", "m4a", "ogg", "wma"].includes(ext)) return "#9C27B0";
  if (["pdf", "doc", "docx", "txt", "rtf", "xls", "xlsx", "ppt", "pptx"].includes(ext)) return "#2196F3";
  if (["zip", "rar", "7z", "tar", "gz", "bz2"].includes(ext)) return "#FF9800";
  if (["apk", "xapk"].includes(ext)) return "#00BCD4";
  if (["js", "ts", "jsx", "tsx", "py", "java", "cpp", "c", "h", "json", "xml", "html", "css"].includes(ext)) return "#00BCD4";
  return "#757575";
};

const getThumbnailIcon = (filename: string, isDirectory: boolean): keyof typeof Feather.glyphMap => {
  if (isDirectory) return "folder";
  
  const ext = getFileExtension(filename);
  if (["jpg", "jpeg", "png", "gif", "bmp", "webp", "heic"].includes(ext)) return "image";
  if (["mp4", "avi", "mkv", "mov", "wmv", "3gp", "webm"].includes(ext)) return "play-circle";
  if (["mp3", "wav", "flac", "aac", "m4a", "ogg", "wma"].includes(ext)) return "music";
  if (["pdf", "doc", "docx", "txt", "rtf", "xls", "xlsx", "ppt", "pptx"].includes(ext)) return "file-text";
  if (["zip", "rar", "7z", "tar", "gz", "bz2"].includes(ext)) return "archive";
  if (["apk", "xapk"].includes(ext)) return "package";
  if (["js", "ts", "jsx", "tsx", "py", "java", "cpp", "c", "h", "json", "xml", "html", "css"].includes(ext)) return "code";
  return "file";
};

export default function FileThumbnail({
  uri,
  filename,
  isDirectory,
  size,
}: FileThumbnailProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const ext = getFileExtension(filename);
  const isImage = ["jpg", "jpeg", "png", "gif", "bmp", "webp", "heic"].includes(ext);
  const isVideo = ["mp4", "avi", "mkv", "mov", "wmv", "3gp", "webm"].includes(ext);
  const backgroundColor = getThumbnailBackground(filename, isDirectory);
  const icon = getThumbnailIcon(filename, isDirectory);

  // For images, try to load the actual image
  if (isImage && !isDirectory) {
    return (
      <View style={[styles.thumbnail, { backgroundColor }]}>
        {!imageError && (
          <Image
            source={{ uri }}
            style={styles.imagePreview}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        )}
        {(!imageLoaded || imageError) && (
          <Feather
            name={icon}
            size={32}
            color="#FFFFFF"
          />
        )}
      </View>
    );
  }

  // For videos, show play button overlay
  if (isVideo) {
    return (
      <View style={[styles.thumbnail, { backgroundColor }]}>
        <Feather name="play" size={32} color="#FFFFFF" />
      </View>
    );
  }

  // For other file types, show icon on colored background
  return (
    <View style={[styles.thumbnail, { backgroundColor }]}>
      <Feather
        name={icon}
        size={32}
        color="#FFFFFF"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  imagePreview: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
  },
});
