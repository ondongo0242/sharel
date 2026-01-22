import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";
import Svg, { Circle } from "react-native-svg";

interface StorageCircleProps {
  title: string;
  usedGB: number;
  totalGB: number;
  onActionPress?: () => void;
  actionLabel?: string;
}

export function StorageCircle({ 
  title, 
  usedGB, 
  totalGB, 
  onActionPress,
  actionLabel 
}: StorageCircleProps) {
  const { theme } = useTheme();
  const percentage = (usedGB / totalGB) * 100;
  const size = 60;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  
  const getProgressColor = () => {
    if (percentage >= 90) return theme.error;
    if (percentage >= 75) return theme.warning;
    return theme.success;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault, shadowColor: theme.shadow }]}>
      <View style={styles.leftSection}>
        <View style={styles.circleContainer}>
          <Svg width={size} height={size}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={theme.border}
              strokeWidth={strokeWidth}
              fill="none"
            />
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={getProgressColor()}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              rotation="-90"
              origin={`${size / 2}, ${size / 2}`}
            />
          </Svg>
          <View style={styles.percentageContainer}>
            <ThemedText style={[styles.percentage, { color: getProgressColor() }]}>
              {Math.round(percentage)}%
            </ThemedText>
          </View>
        </View>
        <View style={styles.textContainer}>
          <ThemedText style={styles.title}>{title}</ThemedText>
          <ThemedText style={styles.storage}>
            {Math.round(totalGB - usedGB)}GB disponible sur {Math.round(totalGB)}GB
          </ThemedText>
        </View>
      </View>
      {onActionPress && actionLabel && (
        <Pressable 
          onPress={onActionPress}
          style={({ pressed }) => [
            styles.actionButton,
            { opacity: pressed ? 0.7 : 1 }
          ]}
        >
          <ThemedText style={[styles.actionText, { color: theme.primary }]}>{actionLabel}</ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
    borderRadius: 12,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  leftSection: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  circleContainer: {
    position: "relative",
  },
  percentageContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  percentage: {
    fontSize: 14,
    fontWeight: "700",
  },
  textContainer: {
    flex: 1,
    gap: Spacing.xs,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
  },
  storage: {
    fontSize: 13,
    opacity: 0.6,
  },
  actionButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  actionText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
