import React from "react";
import { Platform } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";

import ProfileScreen from "@/screens/ProfileScreen";
import GeneralSettingsScreen from "@/screens/GeneralSettingsScreen";
import PreferencesSettingsScreen from "@/screens/PreferencesSettingsScreen";
import PrivacySecuritySettingsScreen from "@/screens/PrivacySecuritySettingsScreen";
import NotificationsSettingsScreen from "@/screens/NotificationsSettingsScreen";
import StorageDataSettingsScreen from "@/screens/StorageDataSettingsScreen";
import SharelCloudSettingsScreen from "@/screens/SharelCloudSettingsScreen";
import GesturesSettingsScreen from "@/screens/GesturesSettingsScreen";
import { useTheme } from "@/hooks/useTheme";
import { getCommonScreenOptions } from "@/navigation/screenOptions";
import { useAppearance } from "@/contexts/AppearanceContext";

export type ProfileStackParamList = {
  Profile: undefined;
  GeneralSettings: undefined;
  PreferencesSettings: undefined;
  PrivacySecuritySettings: undefined;
  NotificationsSettings: undefined;
  StorageDataSettings: undefined;
  SharelCloudSettings: undefined;
  GesturesSettings: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export default function ProfileStackNavigator() {
  const { theme, isDark } = useTheme();
  const { effectiveColorScheme } = useAppearance();
  const { t } = useTranslation();
  
  const isEffectiveDark = effectiveColorScheme === 'dark';
  const bgColor = theme.backgroundRoot;

  const settingsScreenOptions = {
    headerBackTitle: "",
    headerTransparent: true,
    headerBlurEffect: isEffectiveDark ? "dark" as const : "light" as const,
    headerShadowVisible: false,
    headerTintColor: theme.text,
    headerLargeTitle: Platform.OS === 'ios',
    headerLargeTitleShadowVisible: false,
    headerLargeTitleStyle: {
      color: theme.text,
    },
    headerStyle: {
      backgroundColor: Platform.OS === 'android' ? bgColor : undefined,
    },
    contentStyle: {
      backgroundColor: bgColor,
    },
    tabBarStyle: { display: 'none' } as any,
  };

  return (
    <Stack.Navigator screenOptions={getCommonScreenOptions({ theme, isDark })}>
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="GeneralSettings"
        component={GeneralSettingsScreen}
        options={{
          ...settingsScreenOptions,
          headerTitle: t('settings.general'),
        }}
      />
      <Stack.Screen
        name="PreferencesSettings"
        component={PreferencesSettingsScreen}
        options={{
          ...settingsScreenOptions,
          headerTitle: t('profile.preferences'),
        }}
      />
      <Stack.Screen
        name="PrivacySecuritySettings"
        component={PrivacySecuritySettingsScreen}
        options={{
          ...settingsScreenOptions,
          headerTitle: t('profile.privacySecurity'),
        }}
      />
      <Stack.Screen
        name="NotificationsSettings"
        component={NotificationsSettingsScreen}
        options={{
          ...settingsScreenOptions,
          headerTitle: t('profile.notificationsSounds'),
        }}
      />
      <Stack.Screen
        name="StorageDataSettings"
        component={StorageDataSettingsScreen}
        options={{
          ...settingsScreenOptions,
          headerTitle: t('profile.storageData'),
        }}
      />
      <Stack.Screen
        name="SharelCloudSettings"
        component={SharelCloudSettingsScreen}
        options={{
          ...settingsScreenOptions,
          headerTitle: t('profile.sharelCloud'),
        }}
      />
      <Stack.Screen
        name="GesturesSettings"
        component={GesturesSettingsScreen}
        options={{
          ...settingsScreenOptions,
          headerTitle: 'Gestures & Shortcuts',
        }}
      />
    </Stack.Navigator>
  );
}
