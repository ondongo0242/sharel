import React from "react";
import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";

interface StorageBarProps {
  usedGB: number;
  totalGB: number;
}

export function StorageBar({ usedGB, totalGB }: StorageBarProps) {
  const { theme, isDark } = useTheme();
  const percentage = (usedGB / totalGB) * 100;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText style={styles.label}>Stockage interne</ThemedText>
        <ThemedText style={styles.value}>
          {usedGB.toFixed(1)} GB / {totalGB} GB
        </ThemedText>
      </View>
      <View style={[styles.barBackground, { backgroundColor: theme.backgroundTertiary }]}>
        <LinearGradient
          colors={isDark ? [Colors.dark.primary, Colors.dark.secondary] : [Colors.light.primary, Colors.light.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.barFill, { width: `${percentage}%` }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontSize: 15,
    fontWeight: "500",
  },
  value: {
    fontSize: 13,
    opacity: 0.7,
  },
  barBackground: {
    height: 8,
    borderRadius: BorderRadius.xs,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: BorderRadius.xs,
  },
});
