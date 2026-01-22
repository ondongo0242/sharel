import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Linking,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/hooks/useTheme";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HomeStackParamList } from "@/navigation/HomeStackNavigator";
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withSequence,
} from "react-native-reanimated";
import Svg, { Rect } from "react-native-svg";
import { Spacing } from "@/constants/theme";

type ShareSharelScreenNavigationProp = NativeStackNavigationProp<
  HomeStackParamList,
  "ShareSharel"
>;

interface Props {
  navigation: ShareSharelScreenNavigationProp;
}

interface QRCodeProps {
  size?: number;
  primaryColor: string;
  backgroundColor: string;
}

const QRCodePlaceholder = ({ size = 180, primaryColor, backgroundColor }: QRCodeProps) => {
  return (
    <View style={{ backgroundColor, padding: 12, borderRadius: 12 }}>
      <Svg width={size} height={size} viewBox="0 0 200 200">
        <Rect x="10" y="10" width="60" height="60" fill={primaryColor} rx="4" />
        <Rect x="20" y="20" width="40" height="40" fill={backgroundColor} rx="2" />
        <Rect x="30" y="30" width="20" height="20" fill={primaryColor} rx="1" />
        
        <Rect x="130" y="10" width="60" height="60" fill={primaryColor} rx="4" />
        <Rect x="140" y="20" width="40" height="40" fill={backgroundColor} rx="2" />
        <Rect x="150" y="30" width="20" height="20" fill={primaryColor} rx="1" />
        
        <Rect x="10" y="130" width="60" height="60" fill={primaryColor} rx="4" />
        <Rect x="20" y="140" width="40" height="40" fill={backgroundColor} rx="2" />
        <Rect x="30" y="150" width="20" height="20" fill={primaryColor} rx="1" />
        
        <Rect x="80" y="10" width="15" height="15" fill={primaryColor} />
        <Rect x="100" y="10" width="15" height="15" fill={primaryColor} />
        <Rect x="80" y="35" width="15" height="15" fill={primaryColor} />
        <Rect x="100" y="55" width="15" height="15" fill={primaryColor} />
        
        <Rect x="10" y="80" width="15" height="15" fill={primaryColor} />
        <Rect x="30" y="100" width="15" height="15" fill={primaryColor} />
        <Rect x="55" y="80" width="15" height="15" fill={primaryColor} />
        
        <Rect x="130" y="80" width="15" height="15" fill={primaryColor} />
        <Rect x="150" y="100" width="15" height="15" fill={primaryColor} />
        <Rect x="175" y="80" width="15" height="15" fill={primaryColor} />
        
        <Rect x="80" y="80" width="40" height="40" fill={primaryColor} rx="4" />
        <Rect x="90" y="90" width="20" height="20" fill={backgroundColor} rx="2" />
        
        <Rect x="80" y="130" width="15" height="15" fill={primaryColor} />
        <Rect x="100" y="150" width="15" height="15" fill={primaryColor} />
        <Rect x="80" y="175" width="15" height="15" fill={primaryColor} />
        
        <Rect x="130" y="130" width="15" height="15" fill={primaryColor} />
        <Rect x="150" y="145" width="15" height="15" fill={primaryColor} />
        <Rect x="130" y="165" width="15" height="15" fill={primaryColor} />
        <Rect x="165" y="130" width="15" height="15" fill={primaryColor} />
        <Rect x="175" y="155" width="15" height="15" fill={primaryColor} />
        <Rect x="150" y="175" width="15" height="15" fill={primaryColor} />
        <Rect x="175" y="175" width="15" height="15" fill={primaryColor} />
      </Svg>
    </View>
  );
};

interface ShareOption {
  id: string;
  icon: keyof typeof Feather.glyphMap;
  label: string;
  color: string;
  bgColor: string;
  onPress: () => void;
}

export default function ShareSharelScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { theme, isDark, accentColor } = useTheme();
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withSpring(1.02, { damping: 4, stiffness: 80 }),
        withSpring(1, { damping: 4, stiffness: 80 })
      ),
      -1,
      true
    );
  }, []);

  const qrAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const handleBluetoothShare = () => {
    if (Platform.OS === "web") {
      Alert.alert(
        t("shareSharel.notAvailable", "Non disponible"),
        t("shareSharel.bluetoothWebError", "Le partage Bluetooth n'est pas disponible sur le web. Utilisez l'application native.")
      );
      return;
    }
    Alert.alert(
      t("shareSharel.bluetoothShare", "Partage Bluetooth"),
      t("shareSharel.bluetoothInstructions", "Pour partager Sharel par Bluetooth:\n\n1. Activez le Bluetooth\n2. L'APK sera envoy\u00e9 directement\n\nCette fonctionnalit\u00e9 n\u00e9cessite l'APK natif.")
    );
  };

  const handleHotspotShare = () => {
    navigation.navigate("AppShareHotspot");
  };

  const handleShareViaMessage = () => {
    const message = t("shareSharel.shareMessage");
    if (Platform.OS === "web") {
      window.open(`sms:?body=${encodeURIComponent(message)}`, "_blank");
    } else {
      Linking.openURL(`sms:?body=${encodeURIComponent(message)}`);
    }
  };

  const handleShareOnStatus = () => {
    const url = "https://sharel.app";
    if (Platform.OS === "web") {
      window.open(`https://wa.me/?text=${encodeURIComponent(url)}`, "_blank");
    } else {
      Linking.openURL(`whatsapp://send?text=${encodeURIComponent(url)}`);
    }
  };

  const handleLikeOnFacebook = () => {
    Linking.openURL("https://facebook.com/sharelapp");
  };

  const handleFollowOnX = () => {
    Linking.openURL("https://x.com/sharelapp");
  };

  const nearbyOptions: ShareOption[] = [
    {
      id: "bluetooth",
      icon: "bluetooth",
      label: t("shareSharel.bluetooth"),
      color: theme.buttonText,
      bgColor: theme.primary,
      onPress: handleBluetoothShare,
    },
    {
      id: "hotspot",
      icon: "wifi",
      label: t("shareSharel.hotspot"),
      color: theme.buttonText,
      bgColor: theme.warning,
      onPress: handleHotspotShare,
    },
  ];

  const remoteOptions: ShareOption[] = [
    {
      id: "message",
      icon: "message-circle",
      label: t("shareSharel.shareViaMessage"),
      color: theme.link,
      bgColor: isDark ? `${theme.link}20` : `${theme.link}15`,
      onPress: handleShareViaMessage,
    },
    {
      id: "status",
      icon: "phone",
      label: t("shareSharel.shareOnStatus"),
      color: theme.success,
      bgColor: isDark ? `${theme.success}20` : `${theme.success}15`,
      onPress: handleShareOnStatus,
    },
    {
      id: "facebook",
      icon: "thumbs-up",
      label: t("shareSharel.likeOnFacebook"),
      color: theme.link,
      bgColor: isDark ? `${theme.link}20` : `${theme.link}15`,
      onPress: handleLikeOnFacebook,
    },
    {
      id: "twitter",
      icon: "at-sign",
      label: t("shareSharel.followOnX"),
      color: theme.text,
      bgColor: theme.backgroundSecondary,
      onPress: handleFollowOnX,
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 12,
            backgroundColor: accentColor,
          },
        ]}
      >
        <Pressable 
          style={[styles.backButton, { backgroundColor: `${theme.backgroundDefault}33` }]} 
          onPress={() => navigation.goBack()}
        >
          <Feather name="arrow-left" size={24} color={theme.buttonText} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.buttonText }]} numberOfLines={1}>
          {t("shareSharel.title")}
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={[styles.scrollView, { backgroundColor: theme.backgroundRoot }]}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.qrSection,
            { backgroundColor: theme.backgroundDefault },
          ]}
          entering={FadeIn.duration(400)}
        >
          <Animated.View style={[styles.qrWrapper, qrAnimatedStyle]}>
            <QRCodePlaceholder 
              size={180} 
              primaryColor={theme.text} 
              backgroundColor={theme.backgroundDefault} 
            />
          </Animated.View>
          <Text style={[styles.qrLabel, { color: theme.textSecondary }]}>
            {t("shareSharel.scanQR")}
          </Text>
        </Animated.View>

        <Animated.View
          style={styles.section}
          entering={FadeInDown.delay(100).duration(400)}
        >
          <View
            style={[
              styles.sectionHeader,
              { backgroundColor: theme.backgroundSecondary },
            ]}
          >
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
              {t("shareSharel.inviteNearby")}
            </Text>
          </View>

          <View style={styles.nearbyButtons}>
            {nearbyOptions.map((option) => (
              <Pressable
                key={option.id}
                style={({ pressed }) => [
                  styles.nearbyButton,
                  { backgroundColor: option.bgColor, opacity: pressed ? 0.8 : 1 },
                ]}
                onPress={option.onPress}
              >
                <Feather name={option.icon} size={22} color={option.color} />
                <Text style={[styles.nearbyButtonText, { color: option.color }]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        <Animated.View
          style={styles.section}
          entering={FadeInDown.delay(200).duration(400)}
        >
          <View
            style={[
              styles.sectionHeader,
              { backgroundColor: theme.backgroundSecondary },
            ]}
          >
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
              {t("shareSharel.inviteRemote")}
            </Text>
          </View>

          <View
            style={[
              styles.remoteList,
              { backgroundColor: theme.backgroundDefault },
            ]}
          >
            {remoteOptions.map((option, index) => (
              <Pressable
                key={option.id}
                style={({ pressed }) => [
                  styles.remoteItem,
                  pressed && { backgroundColor: theme.backgroundSecondary },
                  index < remoteOptions.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: theme.border,
                  },
                ]}
                onPress={option.onPress}
              >
                <View
                  style={[
                    styles.remoteIconContainer,
                    { backgroundColor: option.bgColor },
                  ]}
                >
                  <Feather name={option.icon} size={20} color={option.color} />
                </View>
                <Text style={[styles.remoteLabel, { color: theme.text }]}>
                  {option.label}
                </Text>
                <Feather
                  name="chevron-right"
                  size={20}
                  color={theme.textSecondary}
                />
              </Pressable>
            ))}
          </View>
        </Animated.View>
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
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginHorizontal: Spacing.md,
  },
  headerRight: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  qrSection: {
    borderRadius: 16,
    padding: Spacing.xl,
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  qrWrapper: {
    marginBottom: Spacing.md,
  },
  qrLabel: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    marginBottom: Spacing.sm,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  nearbyButtons: {
    flexDirection: "row",
    gap: 12,
  },
  nearbyButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    borderRadius: 12,
    gap: 10,
  },
  nearbyButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  remoteList: {
    borderRadius: 12,
    overflow: "hidden",
  },
  remoteItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    gap: 14,
  },
  remoteIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  remoteLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
  },
});
