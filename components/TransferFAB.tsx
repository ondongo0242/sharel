import React, { useState } from "react";
import { View, StyleSheet, Pressable, Text, Modal, TouchableWithoutFeedback, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Spacing, BorderRadius } from "@/constants/theme";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
} from "react-native-reanimated";

interface TransferFABProps {
  onSendP2P: () => void;
  onReceiveP2P: () => void;
  onSendHotspot: () => void;
  onReceiveHotspot: () => void;
  tabBarHeight?: number;
}

type TransferOption = {
  id: string;
  label: string;
  sublabel: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  onPress: () => void;
};

export default function TransferFAB({
  onSendP2P,
  onReceiveP2P,
  onSendHotspot,
  onReceiveHotspot,
  tabBarHeight = 80,
}: TransferFABProps) {
  const { theme, accentColor } = useTheme();
  const insets = useSafeAreaInsets();
  const [isExpanded, setIsExpanded] = useState(false);
  
  const rotation = useSharedValue(0);
  const menuScale = useSharedValue(0);
  const menuOpacity = useSharedValue(0);

  const options: TransferOption[] = [
    {
      id: "send-p2p",
      label: "Envoyer",
      sublabel: "Wi-Fi Direct (P2P)",
      icon: "send",
      color: "#4ADE80",
      onPress: onSendP2P,
    },
    {
      id: "receive-p2p",
      label: "Recevoir",
      sublabel: "Wi-Fi Direct (P2P)",
      icon: "download",
      color: "#60A5FA",
      onPress: onReceiveP2P,
    },
    {
      id: "send-hotspot",
      label: "Envoyer",
      sublabel: "Hotspot",
      icon: "upload-cloud",
      color: "#A78BFA",
      onPress: onSendHotspot,
    },
    {
      id: "receive-hotspot",
      label: "Recevoir",
      sublabel: "Hotspot",
      icon: "download-cloud",
      color: "#FB7185",
      onPress: onReceiveHotspot,
    },
  ];

  const toggleMenu = () => {
    if (isExpanded) {
      closeMenu();
    } else {
      openMenu();
    }
  };

  const openMenu = () => {
    setIsExpanded(true);
    rotation.value = withSpring(45, { damping: 15, stiffness: 300 });
    menuScale.value = withSpring(1, { damping: 18, stiffness: 280 });
    menuOpacity.value = withTiming(1, { duration: 200 });
  };

  const closeMenu = () => {
    rotation.value = withSpring(0, { damping: 15, stiffness: 300 });
    menuScale.value = withSpring(0, { damping: 18, stiffness: 280 });
    menuOpacity.value = withTiming(0, { duration: 150 });
    setTimeout(() => setIsExpanded(false), 150);
  };

  const handleOptionPress = (option: TransferOption) => {
    closeMenu();
    setTimeout(() => {
      option.onPress();
    }, 200);
  };

  const fabAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const menuAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: menuScale.value }],
    opacity: menuOpacity.value,
  }));

  const bottomOffset = tabBarHeight + Spacing.md;

  return (
    <>
      <Pressable
        onPress={toggleMenu}
        style={[
          styles.fab,
          {
            backgroundColor: accentColor,
            bottom: bottomOffset,
            right: Spacing.lg,
          },
        ]}
      >
        <Animated.View style={fabAnimatedStyle}>
          <Feather name="plus" size={28} color="#FFFFFF" />
        </Animated.View>
      </Pressable>

      {isExpanded ? (
        <Modal
          transparent
          visible={isExpanded}
          animationType="none"
          onRequestClose={closeMenu}
        >
          <TouchableWithoutFeedback onPress={closeMenu}>
            <View style={styles.overlay}>
              <TouchableWithoutFeedback>
                <Animated.View
                  style={[
                    styles.menuContainer,
                    {
                      backgroundColor: theme.backgroundDefault,
                      bottom: bottomOffset + 70,
                      right: Spacing.lg,
                    },
                    menuAnimatedStyle,
                  ]}
                >
                  <View style={styles.menuHeader}>
                    <Text style={[styles.menuTitle, { color: theme.text }]}>
                      Mode de transfert
                    </Text>
                  </View>

                  <View style={[styles.menuDivider, { backgroundColor: theme.border }]} />

                  <View style={styles.optionsGrid}>
                    {options.map((option) => (
                      <Pressable
                        key={option.id}
                        onPress={() => handleOptionPress(option)}
                        style={({ pressed }) => [
                          styles.optionItem,
                          {
                            backgroundColor: pressed
                              ? theme.backgroundSecondary
                              : "transparent",
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.optionIcon,
                            { backgroundColor: `${option.color}20` },
                          ]}
                        >
                          <Feather name={option.icon} size={22} color={option.color} />
                        </View>
                        <View style={styles.optionTextContainer}>
                          <Text style={[styles.optionLabel, { color: theme.text }]}>
                            {option.label}
                          </Text>
                          <Text
                            style={[styles.optionSublabel, { color: theme.textSecondary }]}
                          >
                            {option.sublabel}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>

                  <View style={[styles.menuDivider, { backgroundColor: theme.border }]} />

                  <View style={styles.menuFooter}>
                    <View style={styles.methodInfo}>
                      <Feather name="info" size={14} color={theme.textSecondary} />
                      <Text style={[styles.methodInfoText, { color: theme.textSecondary }]}>
                        P2P: connexion directe{"\n"}Hotspot: via point d'acces
                      </Text>
                    </View>
                  </View>
                </Animated.View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 100,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  menuContainer: {
    position: "absolute",
    width: 280,
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
    elevation: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  menuHeader: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  menuDivider: {
    height: 1,
    marginHorizontal: Spacing.md,
  },
  optionsGrid: {
    padding: Spacing.sm,
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: 12,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  optionTextContainer: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  optionSublabel: {
    fontSize: 12,
    marginTop: 2,
  },
  menuFooter: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  methodInfo: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  methodInfoText: {
    fontSize: 11,
    lineHeight: 16,
    flex: 1,
  },
});
