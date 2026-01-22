import React, { useEffect, useRef, useState, useCallback } from "react";
import { StyleSheet, Platform, AppState, AppStateStatus, View, NativeModules } from "react-native";
import { NavigationContainer, DefaultTheme, DarkTheme, Theme, NavigationState } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import * as NavigationBar from "expo-navigation-bar";

import "@/i18n";
import MainTabNavigator from "@/navigation/MainTabNavigator";
import WelcomeScreen from "@/screens/WelcomeScreen";
import StoragePermissionScreen from "@/screens/StoragePermissionScreen";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppearanceProvider, useAppearance } from "@/contexts/AppearanceContext";
import { MediaPlayerProvider } from "@/contexts/MediaPlayerContext";
import MediaPlayerModals from "@/components/MediaPlayerModals";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { getThemeColors } from "@/constants/themes";
import { logger } from "@/services/LoggerService";
import { gestureService } from "@/services/GestureService";
import { imageCacheService } from "@/services/ImageCacheService";
import { TGBoxAuthService } from "@/services/TGBoxAuthService";
import { AuthService } from "@/services/AuthService";
import TGBoxApiService from "@/services/TGBoxApiService";

const checkNativeModules = () => {
  if (Platform.OS !== 'android') return;
  
  const modules = [
    'HotspotModule',
    'HttpServerModule', 
    'WifiDirectModule',
    'StorageModule',
    'LogModule',
    'FileExplorerModule',
    'MediaGalleryModule',
    'ContactsModule',
    'AppsModule'
  ];
  
  const status: Record<string, boolean> = {};
  modules.forEach(name => {
    status[name] = !!NativeModules[name];
  });
  
  console.log('[SHAREL] Native Modules Status:', JSON.stringify(status, null, 2));
  
  const missing = modules.filter(name => !NativeModules[name]);
  if (missing.length > 0) {
    console.error('[SHAREL] MISSING NATIVE MODULES:', missing.join(', '));
    console.error('[SHAREL] Please rebuild the app with: eas build --platform android --profile preview');
  } else {
    console.log('[SHAREL] All native modules loaded successfully');
  }
  
  return status;
};

const applyImmersiveMode = async () => {
  if (Platform.OS === "android") {
    try {
      await NavigationBar.setPositionAsync("absolute");
      await NavigationBar.setBackgroundColorAsync("transparent");
      await NavigationBar.setVisibilityAsync("hidden");
      await NavigationBar.setBehaviorAsync("overlay-swipe");
      await SystemUI.setBackgroundColorAsync("transparent");
    } catch (error) {
      console.warn("Immersive mode setup:", error);
    }
  }
};

function ThemedStatusBar() {
  const { isDark } = useAppearance();
  return <StatusBar style={isDark ? "light" : "dark"} hidden={Platform.OS === "android"} />;
}

function ThemedNavigationContainer({ children }: { children: React.ReactNode }) {
  const { isDark, accentColorValue, effectiveThemeId } = useAppearance();
  const themeColors = getThemeColors(effectiveThemeId);

  const lightTheme: Theme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: accentColorValue,
      background: themeColors.backgroundRoot,
      card: themeColors.backgroundDefault,
      text: themeColors.text,
      border: themeColors.border,
      notification: accentColorValue,
    },
  };

  const darkTheme: Theme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: accentColorValue,
      background: themeColors.backgroundRoot,
      card: themeColors.backgroundDefault,
      text: themeColors.text,
      border: themeColors.border,
      notification: accentColorValue,
    },
  };

  const handleNavigationStateChange = useCallback((_state: NavigationState | undefined) => {
    applyImmersiveMode();
  }, []);

  return (
    <NavigationContainer 
      theme={isDark ? darkTheme : lightTheme}
      onStateChange={handleNavigationStateChange}
    >
      {children}
    </NavigationContainer>
  );
}

function ThemedRoot({ children }: { children: React.ReactNode }) {
  const { effectiveThemeId, animatedBackground } = useAppearance();
  const themeColors = getThemeColors(effectiveThemeId);
  
  return (
    <View style={[styles.root, { backgroundColor: themeColors.backgroundRoot }]}>
      <AnimatedBackground config={animatedBackground} />
      {children}
    </View>
  );
}

function MainApp() {
  const appStateRef = useRef<AppStateStatus | null>(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const [showStoragePermission, setShowStoragePermission] = useState(false);
  const immersiveIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    appStateRef.current = AppState.currentState;
    applyImmersiveMode();
    
    const moduleStatus = checkNativeModules();
    
    logger.initialize().then(() => {
      logger.info('App', '====== SHAREL APP STARTED ======');
      logger.info('App', 'Platform', { os: Platform.OS, version: Platform.Version });
      
      if (Platform.OS === 'android' && moduleStatus) {
        logger.info('NativeModules', 'Module status check', moduleStatus);
        const missing = Object.entries(moduleStatus).filter(([_, v]) => !v).map(([k]) => k);
        if (missing.length > 0) {
          logger.error('NativeModules', 'MISSING MODULES - App needs rebuild', { missing });
        } else {
          logger.info('NativeModules', 'All modules loaded OK');
        }
      }
      
      gestureService.initialize().then(() => {
        logger.info('App', 'Gesture service initialized');
      }).catch(err => {
        logger.error('App', 'Gesture service init failed', { error: String(err) });
      });
      
      imageCacheService.initialize().then(() => {
        logger.info('App', 'Image cache service initialized');
      }).catch(err => {
        logger.error('App', 'Image cache init failed', { error: String(err) });
      });

      TGBoxApiService.loadApiConfig().then(() => {
        logger.info('App', 'TGBox API config loaded');
      }).catch(err => {
        logger.error('App', 'TGBox config error', { error: String(err) });
      });

      TGBoxAuthService.initializeTGBox().then(success => {
        if (success) {
          logger.info('App', 'TGBox initialized successfully');
        } else {
          logger.warn('App', 'TGBox initialization pending auth');
        }
      }).catch(err => {
        logger.error('App', 'TGBox init error', { error: String(err) });
      });
    }).catch(err => {
      console.error('[SHAREL] Logger init failed:', err);
    });

    if (Platform.OS === "android") {
      immersiveIntervalRef.current = setInterval(() => {
        if (appStateRef.current === "active") {
          applyImmersiveMode();
        }
      }, 2000);
    }

    const subscription = AppState.addEventListener("change", handleAppStateChange);

    return () => {
      if (subscription) {
        subscription.remove();
      }
      if (immersiveIntervalRef.current) {
        clearInterval(immersiveIntervalRef.current);
      }
    };
  }, []);

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    try {
      if (nextAppState === "active") {
        applyImmersiveMode();
        setTimeout(applyImmersiveMode, 100);
        setTimeout(applyImmersiveMode, 500);
      }
      appStateRef.current = nextAppState;
    } catch (error) {
      console.warn("App state change error:", error);
    }
  };

  const handleWelcomeContinue = () => {
    setShowWelcome(false);
    if (Platform.OS === "android") {
      setShowStoragePermission(true);
    }
  };

  const handleStoragePermissionComplete = () => {
    setShowStoragePermission(false);
  };

  if (showWelcome) {
    return (
      <GestureHandlerRootView style={styles.root}>
        <ThemedRoot>
          <WelcomeScreen onContinue={handleWelcomeContinue} />
          <ThemedStatusBar />
        </ThemedRoot>
      </GestureHandlerRootView>
    );
  }

  if (showStoragePermission && Platform.OS === "android") {
    return (
      <GestureHandlerRootView style={styles.root}>
        <ThemedRoot>
          <StoragePermissionScreen onComplete={handleStoragePermissionComplete} />
          <ThemedStatusBar />
        </ThemedRoot>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemedRoot>
        <KeyboardProvider>
          <MediaPlayerProvider>
            <ThemedNavigationContainer>
              <MainTabNavigator />
            </ThemedNavigationContainer>
            <MediaPlayerModals />
          </MediaPlayerProvider>
          <ThemedStatusBar />
        </KeyboardProvider>
      </ThemedRoot>
    </GestureHandlerRootView>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AppearanceProvider>
          <MainApp />
        </AppearanceProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
