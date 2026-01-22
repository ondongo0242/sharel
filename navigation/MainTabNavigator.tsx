import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { StyleSheet, Platform } from "react-native";
import { getFocusedRouteNameFromRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import HomeStackNavigator from "@/navigation/HomeStackNavigator";
import DiscoverStackNavigator from "@/navigation/DiscoverStackNavigator";
import ProfileStackNavigator from "@/navigation/ProfileStackNavigator";
import { useTheme } from "@/hooks/useTheme";

export type MainTabParamList = {
  HomeTab: undefined;
  DiscoverTab: undefined;
  MeTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabNavigator() {
  const { t } = useTranslation();
  const { theme, isDark, accentColor } = useTheme();
  const insets = useSafeAreaInsets();

  const androidBottomPadding = Platform.OS === "android" ? Math.max(insets.bottom, 16) : 8;
  const tabBarHeight = Platform.OS === "android" ? 60 + androidBottomPadding : 60;

  const tabBarBaseStyle = {
    position: "absolute" as const,
    backgroundColor: theme.backgroundDefault,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    height: tabBarHeight,
    paddingBottom: androidBottomPadding,
    paddingTop: 8,
  };

  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      screenOptions={{
        tabBarActiveTintColor: accentColor,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: tabBarBaseStyle,
        tabBarBackground: () => null,
        headerShown: false,
        lazy: false,
        freezeOnBlur: true,
      }}
      detachInactiveScreens={false}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={({ route }) => {
          const routeName = getFocusedRouteNameFromRoute(route) ?? "Home";
          const hideTabBar = ["FileSelection", "FileExplorer", "Preparation", "Connection", "DeviceDiscovery", "TransferRoom", "FileTransfer", "Receive", "SharelCloud"].includes(routeName);
          
          return {
            title: t('tabs.home'),
            tabBarIcon: ({ color, size }) => (
              <Feather name="home" size={size} color={color} />
            ),
            tabBarStyle: hideTabBar
              ? { display: "none" }
              : tabBarBaseStyle,
          };
        }}
      />
      <Tab.Screen
        name="DiscoverTab"
        component={DiscoverStackNavigator}
        options={{
          title: t('tabs.discover'),
          tabBarIcon: ({ color, size }) => (
            <Feather name="radio" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="MeTab"
        component={ProfileStackNavigator}
        options={({ route }) => {
          const routeName = getFocusedRouteNameFromRoute(route) ?? "Profile";
          const hideTabBar = ["GeneralSettings", "PreferencesSettings", "PrivacySecuritySettings", "NotificationsSettings", "StorageDataSettings", "SharelCloudSettings", "GesturesSettings"].includes(routeName);
          
          return {
            title: t('tabs.profile'),
            tabBarIcon: ({ color, size }) => (
              <Feather name="user" size={size} color={color} />
            ),
            tabBarStyle: hideTabBar
              ? { display: "none" }
              : tabBarBaseStyle,
          };
        }}
      />
    </Tab.Navigator>
  );
}
