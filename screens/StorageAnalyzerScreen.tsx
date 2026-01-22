import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
} from "react-native";
import { useNavigation, NavigationProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { HomeStackParamList } from "@/navigation/HomeStackNavigator";

interface CategoryItem {
  id: string;
  labelKey: string;
  selected: boolean;
}

const CATEGORIES: CategoryItem[] = [
  { id: "large", labelKey: "storageAnalyzer.largeFiles", selected: true },
  { id: "redundant", labelKey: "storageAnalyzer.redundantFiles", selected: true },
  { id: "new", labelKey: "storageAnalyzer.newFiles", selected: false },
  { id: "all", labelKey: "storageAnalyzer.allFiles", selected: true },
  { id: "junk", labelKey: "storageAnalyzer.junkFiles", selected: true },
  { id: "duplicate", labelKey: "storageAnalyzer.duplicateFiles", selected: true },
];

const SCAN_PATHS = [
  "/storage/emulated/0/Android/media/com.whatsapp/Wha...",
  "/storage/emulated/0/DCIM/Camera",
  "/storage/emulated/0/Download",
  "/storage/emulated/0/Pictures",
  "/storage/emulated/0/Documents",
  "/storage/emulated/0/Music",
];

export default function StorageAnalyzerScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp<HomeStackParamList>>();
  const insets = useSafeAreaInsets();
  
  const [categories, setCategories] = useState(CATEGORIES);
  const [isScanning, setIsScanning] = useState(true);
  const [currentPath, setCurrentPath] = useState(SCAN_PATHS[0]);
  const [scanProgress, setScanProgress] = useState(0);

  const scannerY = useSharedValue(0);
  const scannerOpacity = useSharedValue(0.6);
  const folderScale = useSharedValue(1);

  useEffect(() => {
    scannerY.value = withRepeat(
      withSequence(
        withTiming(80, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );

    scannerOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1000 }),
        withTiming(0.4, { duration: 1000 })
      ),
      -1,
      true
    );

    folderScale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    return () => {
      cancelAnimation(scannerY);
      cancelAnimation(scannerOpacity);
      cancelAnimation(folderScale);
    };
  }, []);

  useEffect(() => {
    if (!isScanning) return;

    const pathInterval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * SCAN_PATHS.length);
      setCurrentPath(SCAN_PATHS[randomIndex]);
    }, 800);

    const progressInterval = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 100) {
          setIsScanning(false);
          return 100;
        }
        return prev + Math.random() * 3;
      });
    }, 100);

    return () => {
      clearInterval(pathInterval);
      clearInterval(progressInterval);
    };
  }, [isScanning]);

  useEffect(() => {
    if (!isScanning && scanProgress >= 100) {
      const selectedCategories = categories
        .filter((c) => c.selected)
        .map((c) => c.id);
      
      setTimeout(() => {
        navigation.navigate("StorageReport" as any, { categories: selectedCategories });
      }, 500);
    }
  }, [isScanning, scanProgress, categories, navigation]);

  const toggleCategory = useCallback((id: string) => {
    setCategories((prev) =>
      prev.map((cat) =>
        cat.id === id ? { ...cat, selected: !cat.selected } : cat
      )
    );
  }, []);

  const scannerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scannerY.value }],
    opacity: scannerOpacity.value,
  }));

  const folderAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: folderScale.value }],
  }));

  const goBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return (
    <View style={[styles.container, { backgroundColor: theme.primary }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable onPress={goBack} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>{t("storageAnalyzer.title")}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.scannerContainer}>
        <View style={styles.scanFrame}>
          <View style={[styles.cornerTL, styles.corner]} />
          <View style={[styles.cornerTR, styles.corner]} />
          <View style={[styles.cornerBL, styles.corner]} />
          <View style={[styles.cornerBR, styles.corner]} />
          
          <Animated.View style={[styles.folderContainer, folderAnimatedStyle]}>
            <View style={styles.folderIcon}>
              <View style={styles.folderTab} />
              <View style={styles.folderBody}>
                <View style={styles.folderLines}>
                  <View style={styles.folderLine} />
                  <View style={styles.folderLine} />
                  <View style={styles.folderLine} />
                </View>
              </View>
            </View>
          </Animated.View>

          <Animated.View style={[styles.scanLine, scannerAnimatedStyle]} />
        </View>
      </View>

      <Text style={styles.currentPath} numberOfLines={1}>
        {currentPath}
      </Text>

      <View style={styles.categoriesCard}>
        {categories.map((category) => (
          <Pressable
            key={category.id}
            style={styles.categoryRow}
            onPress={() => toggleCategory(category.id)}
          >
            <View
              style={[
                styles.checkbox,
                {
                  backgroundColor: category.selected
                    ? theme.primary
                    : "transparent",
                  borderColor: category.selected
                    ? theme.primary
                    : theme.textSecondary,
                },
              ]}
            >
              {category.selected ? (
                <Feather name="check" size={14} color="#FFFFFF" />
              ) : null}
            </View>
            <Text
              style={[
                styles.categoryLabel,
                { color: theme.text },
              ]}
            >
              {t(category.labelKey)}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={[styles.bottomSafe, { paddingBottom: insets.bottom }]} />
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
  scannerContainer: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
  },
  scanFrame: {
    width: 180,
    height: 180,
    justifyContent: "center",
    alignItems: "center",
  },
  corner: {
    position: "absolute",
    width: 30,
    height: 30,
    borderColor: "rgba(255,255,255,0.5)",
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 8,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 8,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 8,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 8,
  },
  folderContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  folderIcon: {
    width: 100,
    height: 80,
    alignItems: "center",
  },
  folderTab: {
    width: 40,
    height: 12,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    alignSelf: "flex-start",
    marginLeft: 10,
  },
  folderBody: {
    width: 100,
    height: 68,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 8,
    marginTop: -2,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 15,
  },
  folderLines: {
    width: "100%",
    gap: 8,
  },
  folderLine: {
    height: 4,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 2,
  },
  scanLine: {
    position: "absolute",
    left: 20,
    right: 20,
    height: 3,
    backgroundColor: "#40E0D0",
    borderRadius: 2,
    shadowColor: "#40E0D0",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
  },
  currentPath: {
    ...Typography.small,
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
    paddingHorizontal: Spacing["2xl"],
    marginBottom: Spacing["2xl"],
  },
  categoriesCard: {
    marginHorizontal: Spacing.xl,
    backgroundColor: "#FFFFFF",
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.lg,
  },
  categoryLabel: {
    ...Typography.body,
  },
  bottomSafe: {
    flex: 1,
  },
});
