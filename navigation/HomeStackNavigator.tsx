import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "../screens/HomeScreen";
import FileBrowserScreen from "../screens/FileBrowserScreen";
import FileExplorerScreen from "../screens/FileExplorerScreen";
import FileSelectionScreen from "../screens/FileSelectionScreen";
import DeviceDiscoveryScreen from "../screens/DeviceDiscoveryScreen";
import FileTransferScreen from "../screens/FileTransferScreen";
import ReceiveScreen from "../screens/ReceiveScreen";
import PreparationScreen from "../screens/PreparationScreen";
import ConnectionScreen from "../screens/ConnectionScreen";
import TransferRoomScreen from "../screens/TransferRoomScreen";
import HotspotSetupScreen from "../screens/HotspotSetupScreen";
import AuthScreen from "../screens/AuthScreen";
import VideoGalleryScreen from "../screens/VideoGalleryScreen";
import PhotoGalleryScreen from "../screens/PhotoGalleryScreen";
import MusicGalleryScreen from "../screens/MusicGalleryScreen";
import AppsGalleryScreen from "../screens/AppsGalleryScreen";
import DocumentsGalleryScreen from "../screens/DocumentsGalleryScreen";
import DownloadsGalleryScreen from "../screens/DownloadsGalleryScreen";
import ZipGalleryScreen from "../screens/ZipGalleryScreen";
import MessagesScreen from "../screens/MessagesScreen";
import ShareSharelScreen from "../screens/ShareSharelScreen";
import AppShareHotspotScreen from "../screens/AppShareHotspotScreen";
import SharelCloudScreen from "../screens/SharelCloudScreen";
import StorageAnalyzerScreen from "../screens/StorageAnalyzerScreen";
import StorageReportScreen from "../screens/StorageReportScreen";
import VaultScreen from "../screens/VaultScreen";
import { useTheme } from "../hooks/useTheme";
import { getCommonScreenOptions } from "./screenOptions";
export type HomeStackParamList = {
  Home: undefined;
  Auth: undefined;
  Vault: undefined;
  FileBrowser: {
    category?: string;
  };
  FileExplorer: undefined;
  VideoGallery: undefined;
  PhotoGallery: undefined;
  MusicGallery: undefined;
  AppsGallery: undefined;
  DocumentsGallery: undefined;
  DownloadsGallery: undefined;
  ZipGallery: undefined;
  Messages: undefined;
  FileSelection: undefined;
  Preparation: {
    selectedFiles?: Array<{
      id: string;
      name: string;
      size: string;
      sizeBytes: number;
      uri?: string;
    }>;
    mode?: "send" | "receive";
  };
  Connection: {
    selectedFiles: Array<{
      id: string;
      name: string;
      size: string;
      sizeBytes: number;
      uri?: string;
    }>;
    senderDeviceType?: string;
    receiverDeviceType?: string;
    transferMethod?: "wifidirect" | "multipeer" | "hotspot" | "auto";
  };
  DeviceDiscovery: {
    selectedFiles: Array<{
      id: string;
      name: string;
      size: string;
      sizeBytes: number;
      uri?: string;
    }>;
    transferMethod?: "nearby" | "multipeer" | "hotspot" | "auto";
  };
  TransferRoom: {
    selectedFiles: Array<{
      id: string;
      name: string;
      size: string;
      sizeBytes: number;
      uri?: string;
    }>;
    peerName: string;
    peerId: string;
    isHost: boolean;
  };
  FileTransfer: {
    peerId: string;
    peerName: string;
    selectedFiles: Array<{
      id: string;
      name: string;
      size: string;
      sizeBytes: number;
      uri?: string;
    }>;
  };
  Receive: {
    transferMethod?: "wifidirect" | "multipeer" | "hotspot" | "auto";
  };
  ShareSharel: undefined;
  AppShareHotspot: undefined;
  SharelCloud: undefined;
  HotspotSetup: {
    mode?: "sender" | "receiver";
    selectedFiles?: Array<{
      id: string;
      name: string;
      size: string;
      sizeBytes: number;
      uri?: string;
    }>;
  };
  StorageAnalyzer: undefined;
  StorageReport: {
    categories?: string[];
  };
};

const Stack = createNativeStackNavigator<HomeStackParamList>();

export default function HomeStackNavigator() {
  const { theme, isDark } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        ...getCommonScreenOptions({ theme, isDark }),
      }}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="FileBrowser"
        component={FileBrowserScreen}
        options={{ 
          headerTitle: "Fichiers",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="FileExplorer"
        component={FileExplorerScreen}
        options={{ 
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="FileSelection"
        component={FileSelectionScreen}
        options={{ 
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="Preparation"
        component={PreparationScreen}
        options={{ 
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="Connection"
        component={ConnectionScreen}
        options={{ 
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="DeviceDiscovery"
        component={DeviceDiscoveryScreen}
        options={{ 
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="TransferRoom"
        component={TransferRoomScreen}
        options={{ 
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="FileTransfer"
        component={FileTransferScreen}
        options={{ 
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="Receive"
        component={ReceiveScreen}
        options={{ 
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="Auth"
        component={AuthScreen}
        options={{ 
          headerShown: false,
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      />
      <Stack.Screen
        name="VideoGallery"
        component={VideoGalleryScreen}
        options={{ 
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="PhotoGallery"
        component={PhotoGalleryScreen}
        options={{ 
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="MusicGallery"
        component={MusicGalleryScreen}
        options={{ 
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="AppsGallery"
        component={AppsGalleryScreen}
        options={{ 
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="DocumentsGallery"
        component={DocumentsGalleryScreen}
        options={{ 
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="DownloadsGallery"
        component={DownloadsGalleryScreen}
        options={{ 
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="ZipGallery"
        component={ZipGalleryScreen}
        options={{ 
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="Messages"
        component={MessagesScreen}
        options={{ 
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="ShareSharel"
        component={ShareSharelScreen}
        options={{ 
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="AppShareHotspot"
        component={AppShareHotspotScreen}
        options={{ 
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="SharelCloud"
        component={SharelCloudScreen}
        options={{ 
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="HotspotSetup"
        component={HotspotSetupScreen}
        options={{ 
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="StorageAnalyzer"
        component={StorageAnalyzerScreen}
        options={{ 
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="StorageReport"
        component={StorageReportScreen}
        options={{ 
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="Vault"
        component={VaultScreen}
        options={{ 
          headerShown: false,
          presentation: "modal",
        }}
      />
    </Stack.Navigator>
  );
}
