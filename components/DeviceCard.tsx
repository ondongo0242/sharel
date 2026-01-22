import React from "react";
import { Pressable, StyleSheet, View, Image } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

export interface Device {
  id: string;
  name: string;
  model: string;
  avatar: number;
  status: "available" | "connecting" | "connected";
}

interface DeviceCardProps {
  device: Device;
  onPress: () => void;
}

const avatarImages = [
  require("../assets/images/avatars/avatar-circle.png"),
  require("../assets/images/avatars/avatar-triangle.png"),
  require("../assets/images/avatars/avatar-square.png"),
];

export function DeviceCard({ device, onPress }: DeviceCardProps) {
  const { theme } = useTheme();

  const statusColors = {
    available: theme.success,
    connecting: theme.warning,
    connected: theme.primary,
  };

  const statusLabels = {
    available: "Disponible",
    connecting: "Connexion...",
    connected: "Connecté",
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.backgroundDefault,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Image source={avatarImages[device.avatar]} style={styles.avatar} />
      <View style={styles.info}>
        <ThemedText style={styles.name}>{device.name}</ThemedText>
        <ThemedText style={styles.model}>{device.model}</ThemedText>
      </View>
      <View style={[styles.statusBadge, { backgroundColor: `${statusColors[device.status]}20` }]}>
        <View style={[styles.statusDot, { backgroundColor: statusColors[device.status] }]} />
        <ThemedText style={[styles.statusText, { color: statusColors[device.status] }]}>
          {statusLabels[device.status]}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.lg,
    marginRight: Spacing.md,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  model: {
    fontSize: 14,
    opacity: 0.6,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.xs,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
  },
});
