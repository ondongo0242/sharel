import React, { useState, useEffect } from "react";
import { View, StyleSheet, ActivityIndicator, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from "react-native-reanimated";
import { ThemedText } from "@/components/ThemedText";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { DeviceCard, Device } from "@/components/DeviceCard";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

export default function DiscoverScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [isScanning, setIsScanning] = useState(true);
  const [devices, setDevices] = useState<Device[]>([]);
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withTiming(1.3, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );

    setTimeout(() => {
      setDevices([
        {
          id: "1",
          name: "iPhone 14 Pro",
          model: "Apple",
          avatar: 0,
          status: "available",
        },
        {
          id: "2",
          name: "Galaxy Tab S9",
          model: "Samsung",
          avatar: 1,
          status: "available",
        },
      ]);
      setIsScanning(false);
    }, 2000);
  }, []);

  const radarStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleRefresh = () => {
    setIsScanning(true);
    setDevices([]);
    setTimeout(() => {
      setDevices([
        {
          id: "1",
          name: "iPhone 14 Pro",
          model: "Apple",
          avatar: 0,
          status: "available",
        },
      ]);
      setIsScanning(false);
    }, 2000);
  };

  const handleDevicePress = (device: Device) => {
    console.log("Connect to device:", device.name);
  };

  const getDevicesFoundText = (count: number): string => {
    if (count === 1) {
      return t('discover.devicesFound', { count });
    }
    return t('discover.devicesFound_plural', { count });
  };

  return (
    <ScreenScrollView style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={styles.content}>
        {isScanning ? (
          <View style={styles.radarContainer}>
            <Animated.View
              style={[
                styles.radarCircle,
                { backgroundColor: `${theme.primary}10`, borderColor: `${theme.primary}30` },
              ]}
            />
            <Animated.View
              style={[
                styles.radarCircle,
                styles.radarCircleOuter,
                radarStyle,
                { backgroundColor: `${theme.primary}05`, borderColor: `${theme.primary}20` },
              ]}
            />
            <View style={[styles.radarCenter, { backgroundColor: theme.primary }]}>
              <Feather name="radio" size={32} color={theme.backgroundDefault} />
            </View>
            <ThemedText style={styles.scanningText}>{t('discover.scanning')}</ThemedText>
          </View>
        ) : null}

        {devices.length > 0 ? (
          <View style={styles.deviceList}>
            <ThemedText style={styles.sectionTitle}>
              {getDevicesFoundText(devices.length)}
            </ThemedText>
            {devices.map((device) => (
              <DeviceCard key={device.id} device={device} onPress={() => handleDevicePress(device)} />
            ))}
          </View>
        ) : !isScanning ? (
          <View style={[styles.emptyState, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="smartphone" size={48} color={theme.tabIconDefault} />
            <ThemedText style={styles.emptyText}>{t('discover.noDevices')}</ThemedText>
            <ThemedText style={styles.emptySubtext}>
              {t('discover.ensureAppOpen')}
            </ThemedText>
            <Pressable
              onPress={handleRefresh}
              style={({ pressed }) => [
                styles.refreshButton,
                { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Feather name="refresh-cw" size={18} color={theme.backgroundDefault} />
              <ThemedText style={[styles.refreshText, { color: theme.backgroundDefault }]}>{t('common.retry')}</ThemedText>
            </Pressable>
          </View>
        ) : null}
      </View>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  radarContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: Spacing["4xl"],
  },
  radarCircle: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
  },
  radarCircleOuter: {
    width: 240,
    height: 240,
    borderRadius: 120,
  },
  radarCenter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  scanningText: {
    marginTop: 140,
    fontSize: 16,
    fontWeight: "500",
  },
  deviceList: {
    gap: Spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing["3xl"],
    borderRadius: BorderRadius.sm,
    marginTop: Spacing["4xl"],
  },
  emptyText: {
    marginTop: Spacing.md,
    fontSize: 16,
    fontWeight: "500",
  },
  emptySubtext: {
    marginTop: Spacing.sm,
    fontSize: 14,
    opacity: 0.6,
    textAlign: "center",
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing["2xl"],
    paddingHorizontal: Spacing["2xl"],
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xs,
    gap: Spacing.sm,
  },
  refreshText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
