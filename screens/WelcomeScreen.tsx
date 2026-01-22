import React, { useEffect } from "react";
import { View, StyleSheet, Text } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Spacing } from "@/constants/theme";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";

type WelcomeScreenNavigationProp = NativeStackNavigationProp<any, "Welcome">;

interface Props {
  navigation?: WelcomeScreenNavigationProp;
  onContinue?: () => void;
}

export default function WelcomeScreen({ navigation, onContinue }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (onContinue) {
        onContinue();
      }
    }, 2500);

    return () => clearTimeout(timer);
  }, [onContinue]);

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
        
        <View style={styles.appNameContainer}>
          <Text style={styles.appName}>
            Share<Text style={styles.appNameAccent}>l</Text>
          </Text>
        </View>
      </View>
      
      <View style={styles.sloganContainer}>
        <Text style={styles.slogan}>{t("welcome.slogan")}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  centerContent: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  logoContainer: {
    width: 120,
    height: 120,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
    borderRadius: 28,
    overflow: "hidden",
  },
  logo: {
    width: 120,
    height: 120,
  },
  appNameContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  appName: {
    fontSize: 36,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: 1,
  },
  appNameAccent: {
    color: "#0EA5E9",
  },
  sloganContainer: {
    paddingHorizontal: Spacing["2xl"],
    marginBottom: Spacing["2xl"],
  },
  slogan: {
    fontSize: 16,
    fontWeight: "500",
    color: "#64748B",
    textAlign: "center",
    letterSpacing: 0.5,
  },
});
