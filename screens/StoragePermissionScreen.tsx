import React, { useEffect, useCallback, useState } from "react";
import { View, StyleSheet, Text, Pressable, Platform, AppState, AppStateStatus, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Spacing } from "@/constants/theme";
import { useTranslation } from "react-i18next";
import { useStoragePermission } from "@/hooks/useStoragePermission";

interface Props {
  onComplete: () => void;
}

export default function StoragePermissionScreen({ onComplete }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);
  const {
    isLoading,
    hasPermission,
    requiresPermission,
    folderExists,
    requestPermission,
    createFolder,
    refresh,
  } = useStoragePermission();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (Platform.OS !== "android" || !requiresPermission) {
      onComplete();
      return;
    }

    if (hasPermission && folderExists) {
      onComplete();
    }
  }, [isLoading, hasPermission, folderExists, requiresPermission, onComplete]);

  useEffect(() => {
    if (isLoading || isCreatingFolder) {
      return;
    }

    const handleFolderCreation = async () => {
      if (hasPermission && !folderExists) {
        setIsCreatingFolder(true);
        setFolderError(null);
        try {
          const result = await createFolder();
          if (result?.success) {
            onComplete();
          } else {
            setFolderError(t("permissions.folderError", "Could not create folder. Please try again."));
          }
        } catch (error) {
          setFolderError(t("permissions.folderError", "Could not create folder. Please try again."));
        } finally {
          setIsCreatingFolder(false);
        }
      }
    };

    handleFolderCreation();
  }, [isLoading, isCreatingFolder, hasPermission, folderExists, createFolder, onComplete, t]);

  useEffect(() => {
    const handleAppStateChange = async (nextState: AppStateStatus) => {
      if (nextState === "active") {
        await refresh();
      }
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription.remove();
  }, [refresh]);

  const handleRequestPermission = useCallback(async () => {
    setFolderError(null);
    await requestPermission();
  }, [requestPermission]);

  const handleRetryFolderCreation = useCallback(async () => {
    setFolderError(null);
    setIsCreatingFolder(true);
    try {
      const result = await createFolder();
      if (result?.success) {
        onComplete();
      } else {
        setFolderError(t("permissions.folderError", "Could not create folder. Please try again."));
      }
    } catch (error) {
      setFolderError(t("permissions.folderError", "Could not create folder. Please try again."));
    } finally {
      setIsCreatingFolder(false);
    }
  }, [createFolder, onComplete, t]);

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingBottom: insets.bottom + Spacing["4xl"] }]}>
        <View style={styles.centerContent}>
          <View style={styles.iconContainer}>
            <Feather name="folder" size={48} color="#0EA5E9" />
          </View>
          <Text style={styles.loadingText}>{t("common.loading", "Loading...")}</Text>
        </View>
      </View>
    );
  }

  if (Platform.OS !== "android" || !requiresPermission) {
    return null;
  }

  if (hasPermission && isCreatingFolder) {
    return (
      <View style={[styles.container, { paddingBottom: insets.bottom + Spacing["4xl"] }]}>
        <View style={styles.centerContent}>
          <View style={styles.iconContainer}>
            <ActivityIndicator size="large" color="#0EA5E9" />
          </View>
          <Text style={styles.loadingText}>{t("permissions.creatingFolder", "Creating Sharel folder...")}</Text>
        </View>
      </View>
    );
  }

  if (hasPermission && folderError) {
    return (
      <View style={[styles.container, { paddingBottom: insets.bottom + Spacing["4xl"] }]}>
        <View style={styles.centerContent}>
          <View style={[styles.iconContainer, { backgroundColor: "#FEF2F2" }]}>
            <Feather name="alert-circle" size={48} color="#EF4444" />
          </View>
          <Text style={styles.title}>{t("permissions.folderErrorTitle", "Folder Creation Failed")}</Text>
          <Text style={styles.description}>{folderError}</Text>
        </View>
        <View style={styles.buttonContainer}>
          <Pressable style={styles.primaryButton} onPress={handleRetryFolderCreation}>
            <Feather name="refresh-cw" size={20} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>{t("common.retry", "Try Again")}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (hasPermission && folderExists) {
    return null;
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + Spacing["4xl"] }]}>
      <View style={styles.centerContent}>
        <View style={styles.logoContainer}>
          <Image
            source={require("@/assets/images/sharel-logo.png")}
            style={styles.logo}
            contentFit="contain"
          />
        </View>

        <View style={styles.iconContainer}>
          <Feather name="folder-plus" size={56} color="#0EA5E9" />
        </View>

        <Text style={styles.title}>
          {t("permissions.storageTitle", "Storage Permission Required")}
        </Text>

        <Text style={styles.description}>
          {t(
            "permissions.storageDescription",
            "Sharel needs access to your storage to create a folder for received files. This allows you to easily find and manage your shared files."
          )}
        </Text>

        <View style={styles.benefitsList}>
          <View style={styles.benefitItem}>
            <Feather name="check-circle" size={20} color="#22C55E" />
            <Text style={styles.benefitText}>
              {t("permissions.benefit1", "Save received files to Downloads/Sharel")}
            </Text>
          </View>
          <View style={styles.benefitItem}>
            <Feather name="check-circle" size={20} color="#22C55E" />
            <Text style={styles.benefitText}>
              {t("permissions.benefit2", "Access files from any file manager")}
            </Text>
          </View>
          <View style={styles.benefitItem}>
            <Feather name="check-circle" size={20} color="#22C55E" />
            <Text style={styles.benefitText}>
              {t("permissions.benefit3", "Keep your files organized")}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <Pressable style={styles.primaryButton} onPress={handleRequestPermission}>
          <Feather name="settings" size={20} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>
            {t("permissions.grantAccess", "Grant Storage Access")}
          </Text>
        </Pressable>

        <Text style={styles.note}>
          {t(
            "permissions.noteRequired",
            "This permission is required to save and share files. After enabling, return to the app."
          )}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: Spacing.xl,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  logoContainer: {
    width: 80,
    height: 80,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
    borderRadius: 20,
    overflow: "hidden",
  },
  logo: {
    width: 80,
    height: 80,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#F0F9FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  loadingText: {
    fontSize: 16,
    color: "#64748B",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0F172A",
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  description: {
    fontSize: 16,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.md,
  },
  benefitsList: {
    width: "100%",
    gap: Spacing.md,
  },
  benefitItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  benefitText: {
    fontSize: 15,
    color: "#334155",
    flex: 1,
  },
  buttonContainer: {
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    backgroundColor: "#0EA5E9",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderRadius: 16,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  note: {
    fontSize: 13,
    color: "#94A3B8",
    textAlign: "center",
    marginTop: Spacing.sm,
  },
});
