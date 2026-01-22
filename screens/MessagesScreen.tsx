import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HomeStackParamList } from "@/navigation/HomeStackNavigator";
import { useTheme } from "@/hooks/useTheme";
import { useTranslation } from "react-i18next";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type MessagesScreenNavigationProp = NativeStackNavigationProp<HomeStackParamList, "Messages">;

interface Props {
  navigation: MessagesScreenNavigationProp;
}

type TabType = "all" | "activity" | "official";

export default function MessagesScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { theme, accentColor } = useTheme();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>("all");

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIllustration}>
        <View style={[styles.phoneContainer, { backgroundColor: theme.backgroundSecondary }]}>
          <View style={[styles.phoneScreen, { backgroundColor: theme.backgroundDefault }]}>
            <View style={[styles.bellCircle, { backgroundColor: theme.backgroundTertiary }]}>
              <Feather name="bell" size={28} color={accentColor} />
            </View>
          </View>
        </View>
        <View style={styles.personContainer}>
          <View style={[styles.personHead, { backgroundColor: theme.warning }]} />
          <View style={[styles.personBody, { backgroundColor: theme.warning }]} />
        </View>
        <View style={[styles.yellowDot, { backgroundColor: theme.warning }]} />
      </View>
      <Text style={[styles.emptyText, { color: theme.textSecondary }]}>{t('messages.noMessages')}</Text>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.backgroundDefault }]}>
      <View style={[styles.header, { backgroundColor: theme.backgroundDefault }]}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>{t('messages.title')}</Text>
        <Pressable style={styles.menuButton}>
          <Feather name="more-vertical" size={24} color={theme.text} />
        </Pressable>
      </View>

      <View style={[styles.tabsContainer, { backgroundColor: theme.backgroundDefault, borderBottomColor: theme.border }]}>
        <Pressable
          style={[styles.tab, activeTab === "all" && styles.tabActive]}
          onPress={() => setActiveTab("all")}
        >
          <Text style={[styles.tabText, { color: theme.textSecondary }, activeTab === "all" && { color: theme.text }]}>
            {t('messages.all')}
          </Text>
          {activeTab === "all" ? <View style={[styles.tabIndicator, { backgroundColor: accentColor }]} /> : null}
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === "activity" && styles.tabActive]}
          onPress={() => setActiveTab("activity")}
        >
          <Text style={[styles.tabText, { color: theme.textSecondary }, activeTab === "activity" && { color: theme.text }]}>
            {t('messages.activity')}
          </Text>
          {activeTab === "activity" ? <View style={[styles.tabIndicator, { backgroundColor: accentColor }]} /> : null}
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === "official" && styles.tabActive]}
          onPress={() => setActiveTab("official")}
        >
          <Text style={[styles.tabText, { color: theme.textSecondary }, activeTab === "official" && { color: theme.text }]}>
            {t('messages.official')}
          </Text>
          {activeTab === "official" ? <View style={[styles.tabIndicator, { backgroundColor: accentColor }]} /> : null}
        </Pressable>
      </View>

      <View style={[styles.content, { paddingBottom: insets.bottom + 20 }]}>
        {renderEmptyState()}
      </View>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
  },
  menuButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  tabsContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    position: "relative",
  },
  tabActive: {},
  tabText: {
    fontSize: 14,
    fontWeight: "600",
  },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    left: 16,
    right: 16,
    height: 2,
    borderRadius: 1,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  emptyIllustration: {
    width: 200,
    height: 160,
    position: "relative",
    marginBottom: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  phoneContainer: {
    width: 80,
    height: 120,
    borderRadius: 12,
    padding: 8,
    position: "absolute",
    left: 40,
  },
  phoneScreen: {
    flex: 1,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  bellCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  personContainer: {
    position: "absolute",
    right: 30,
    bottom: 0,
    alignItems: "center",
  },
  personHead: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  personBody: {
    width: 40,
    height: 50,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -4,
  },
  yellowDot: {
    position: "absolute",
    left: 20,
    bottom: 30,
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
  },
});
