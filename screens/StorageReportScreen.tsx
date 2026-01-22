import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { HomeStackParamList } from "@/navigation/HomeStackNavigator";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface StorageCategory {
  id: string;
  labelKey: string;
  color: string;
  size: string;
  sizeBytes: number;
}

interface FileItem {
  id: string;
  name: string;
  path: string;
  size: string;
  sizeBytes: number;
  icon: string;
}

const STORAGE_DATA: StorageCategory[] = [
  { id: "photos", labelKey: "storageAnalyzer.photos", color: "#4CAF50", size: "209.6MB", sizeBytes: 219676672 },
  { id: "apk", labelKey: "storageAnalyzer.apk", color: "#2196F3", size: "377.7MB", sizeBytes: 396056576 },
  { id: "videos", labelKey: "storageAnalyzer.videos", color: "#9C27B0", size: "145.1MB", sizeBytes: 152166400 },
  { id: "documents", labelKey: "storageAnalyzer.documents", color: "#00BCD4", size: "29.6MB", sizeBytes: 31037030 },
  { id: "music", labelKey: "storageAnalyzer.music", color: "#E91E63", size: "76.2MB", sizeBytes: 79899238 },
  { id: "others", labelKey: "storageAnalyzer.others", color: "#607D8B", size: "48.31GB", sizeBytes: 51883950489 },
];

const ALL_FILES: FileItem[] = [
  { id: "1", name: "AirDroid", path: "/storage/emulated/0/AirDroid", size: "156MB", sizeBytes: 163577856, icon: "folder" },
  { id: "2", name: "Alarms", path: "/storage/emulated/0/Alarms", size: "2.3MB", sizeBytes: 2411724, icon: "folder" },
  { id: "3", name: "Download", path: "/storage/emulated/0/Download", size: "1.2GB", sizeBytes: 1288490188, icon: "folder" },
  { id: "4", name: "DCIM", path: "/storage/emulated/0/DCIM", size: "4.5GB", sizeBytes: 4831838208, icon: "folder" },
];

const JUNK_FILES: FileItem[] = [
  { id: "j1", name: "cache_temp_001.tmp", path: "/storage/emulated/0/.cache", size: "45.2MB", sizeBytes: 47395430, icon: "trash-2" },
  { id: "j2", name: "log_backup.old", path: "/storage/emulated/0/logs", size: "12.8MB", sizeBytes: 13421772, icon: "trash-2" },
  { id: "j3", name: "thumbnail_cache", path: "/storage/emulated/0/.thumbnails", size: "320MB", sizeBytes: 335544320, icon: "trash-2" },
];

const NEW_FILES: FileItem[] = [
  { id: "n1", name: "application-f4b87d35-af71-4...", path: "/storage/emulated/0/Download", size: "79.8MB", sizeBytes: 83685785, icon: "file" },
  { id: "n2", name: "IMG_20251208_142355.jpg", path: "/storage/emulated/0/DCIM/Camera", size: "4.2MB", sizeBytes: 4404019, icon: "image" },
];

export default function StorageReportScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const route = useRoute<RouteProp<HomeStackParamList, "StorageReport">>();

  const [storagePercent] = useState(93);
  const [totalStorage] = useState("48.76GB");

  const circleProgress = useSharedValue(0);

  useEffect(() => {
    circleProgress.value = withTiming(storagePercent / 100, {
      duration: 1500,
      easing: Easing.out(Easing.cubic),
    });
  }, [storagePercent]);

  const size = 90;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const animatedCircleProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - circleProgress.value),
  }));

  const goBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleClean = useCallback(() => {
    // TODO: Implement actual cleanup
  }, []);

  const renderStorageLegend = () => (
    <View style={styles.legendContainer}>
      {STORAGE_DATA.slice(0, 3).map((item) => (
        <View key={item.id} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: item.color }]} />
          <View>
            <Text style={[styles.legendLabel, { color: theme.text }]}>
              {t(item.labelKey)}
            </Text>
            <Text style={[styles.legendSize, { color: theme.textSecondary }]}>
              {item.size}
            </Text>
          </View>
        </View>
      ))}
      {STORAGE_DATA.slice(3).map((item) => (
        <View key={item.id} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: item.color }]} />
          <View>
            <Text style={[styles.legendLabel, { color: theme.text }]}>
              {t(item.labelKey)}
            </Text>
            <Text style={[styles.legendSize, { color: theme.textSecondary }]}>
              {item.size}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );

  const renderFileItem = (item: FileItem, showIcon: boolean = true) => (
    <View key={item.id} style={styles.fileItem}>
      {showIcon ? (
        <View style={[styles.fileIconContainer, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name={item.icon as any} size={20} color={theme.primary} />
        </View>
      ) : null}
      <View style={styles.fileInfo}>
        <Text style={[styles.fileName, { color: theme.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[styles.filePath, { color: theme.textSecondary }]} numberOfLines={1}>
          {item.path}
        </Text>
      </View>
      <Text style={[styles.fileSize, { color: theme.textSecondary }]}>
        {item.size}
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.primary }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable onPress={goBack} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>{t("storageAnalyzer.reportTitle")}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.storageCard, { backgroundColor: theme.backgroundDefault }]}>
          <Text style={[styles.storageTitle, { color: theme.text }]}>
            {t("storageAnalyzer.phoneStorage")}
          </Text>
          
          <View style={styles.storageRow}>
            <View style={styles.circleContainer}>
              <Svg width={size} height={size}>
                <Circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke={theme.backgroundSecondary}
                  strokeWidth={strokeWidth}
                  fill="none"
                />
                <AnimatedCircle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke="#9C27B0"
                  strokeWidth={strokeWidth}
                  fill="none"
                  strokeDasharray={circumference}
                  animatedProps={animatedCircleProps}
                  strokeLinecap="round"
                  rotation="-90"
                  origin={`${size / 2}, ${size / 2}`}
                />
              </Svg>
              <View style={styles.circleCenter}>
                <Text style={[styles.percentText, { color: theme.text }]}>
                  {storagePercent}%
                </Text>
              </View>
            </View>
            {renderStorageLegend()}
          </View>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconContainer, { backgroundColor: "#E3F2FD" }]}>
              <Feather name="file" size={20} color="#2196F3" />
            </View>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              {t("storageAnalyzer.allFiles")}
            </Text>
            <Text style={[styles.sectionSize, { color: theme.textSecondary }]}>
              {totalStorage}
            </Text>
          </View>
          
          {ALL_FILES.slice(0, 2).map((item) => renderFileItem(item))}
          
          <Pressable style={[styles.detailsButton, { backgroundColor: theme.backgroundSecondary }]}>
            <Text style={[styles.detailsButtonText, { color: theme.primary }]}>
              {t("storageAnalyzer.details")}
            </Text>
          </Pressable>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconContainer, { backgroundColor: "#FFEBEE" }]}>
              <Feather name="trash-2" size={20} color="#F44336" />
            </View>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              {t("storageAnalyzer.junkFiles")}
            </Text>
            <Text style={[styles.sectionSize, { color: theme.textSecondary }]}>
              377.9MB
            </Text>
          </View>
          
          <Text style={[styles.analyzeMoreText, { color: theme.textSecondary }]}>
            {t("storageAnalyzer.analyzeMore")}
          </Text>
          
          <Pressable 
            style={[styles.cleanButton, { backgroundColor: theme.backgroundSecondary }]}
            onPress={handleClean}
          >
            <Text style={[styles.cleanButtonText, { color: theme.primary }]}>
              {t("storageAnalyzer.clean")}
            </Text>
          </Pressable>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconContainer, { backgroundColor: "#E3F2FD" }]}>
              <Feather name="clock" size={20} color="#2196F3" />
            </View>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              {t("storageAnalyzer.newFiles")}
            </Text>
            <Text style={[styles.sectionSize, { color: theme.textSecondary }]}>
              5.91GB
            </Text>
          </View>
          
          {NEW_FILES.map((item) => renderFileItem(item))}
        </View>
      </ScrollView>
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
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  backButton: {
    padding: Spacing.sm,
    marginLeft: -Spacing.sm,
  },
  headerTitle: {
    flex: 1,
    ...Typography.h3,
    color: "#FFFFFF",
    textAlign: "center",
    marginRight: 24,
  },
  headerSpacer: {
    width: 24,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.lg,
  },
  storageCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
  },
  storageTitle: {
    ...Typography.bodyMedium,
    marginBottom: Spacing.lg,
  },
  storageRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  circleContainer: {
    position: "relative",
    marginRight: Spacing.lg,
  },
  circleCenter: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  percentText: {
    ...Typography.h4,
  },
  legendContainer: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    width: "30%",
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.xs,
  },
  legendLabel: {
    ...Typography.caption,
  },
  legendSize: {
    fontSize: 11,
  },
  sectionCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  sectionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  sectionTitle: {
    flex: 1,
    ...Typography.bodyMedium,
  },
  sectionSize: {
    ...Typography.small,
  },
  fileItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  fileIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    ...Typography.body,
  },
  filePath: {
    ...Typography.caption,
    marginTop: 2,
  },
  fileSize: {
    ...Typography.small,
    marginLeft: Spacing.sm,
  },
  detailsButton: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  detailsButtonText: {
    ...Typography.bodyMedium,
  },
  analyzeMoreText: {
    ...Typography.small,
    marginBottom: Spacing.md,
  },
  cleanButton: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  cleanButtonText: {
    ...Typography.bodyMedium,
  },
});
