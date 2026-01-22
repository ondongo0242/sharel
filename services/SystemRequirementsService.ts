import { Platform, Linking, Alert, PermissionsAndroid } from "react-native";
import * as Location from "expo-location";
import * as IntentLauncher from "expo-intent-launcher";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import Constants from "expo-constants";

export interface SystemRequirements {
  wifi: boolean;
  bluetooth: boolean;
  location: boolean;
  permissions: {
    location: boolean;
    nearbyDevices: boolean;
    bluetooth: boolean;
    wifiDirect: boolean;
  };
}

export type TransferMethod = "wifidirect" | "multipeer" | "hotspot" | "auto";

class SystemRequirementsService {
  private requirements: SystemRequirements = {
    wifi: false,
    bluetooth: false,
    location: false,
    permissions: {
      location: false,
      nearbyDevices: false,
      bluetooth: false,
      wifiDirect: false,
    },
  };

  private listeners: Array<() => void> = [];
  private netInfoUnsubscribe: (() => void) | null = null;
  private onRequirementsChange: ((requirements: SystemRequirements) => void) | null = null;
  private lastNetState: NetInfoState | null = null;

  async checkAllRequirements(method: TransferMethod, isReceiver: boolean = false): Promise<SystemRequirements> {
    const requiredChecks = this.getRequiredChecks(method, isReceiver);
    
    let wifiStatus = this.requirements.wifi;
    let bluetoothStatus = this.requirements.bluetooth;
    let locationStatus = this.requirements.location;
    let locationPermission = this.requirements.permissions.location;
    let nearbyPermission = this.requirements.permissions.nearbyDevices;
    let bluetoothPermission = this.requirements.permissions.bluetooth;
    let wifiDirectPermission = this.requirements.permissions.wifiDirect;
    
    if (requiredChecks.includes("wifi")) {
      wifiStatus = await this.checkWiFi();
    }
    if (requiredChecks.includes("bluetooth")) {
      bluetoothStatus = await this.checkBluetooth();
    }
    if (requiredChecks.includes("location")) {
      locationStatus = await this.checkLocation();
    }
    if (requiredChecks.includes("locationPermission")) {
      locationPermission = await this.checkLocationPermission();
    }
    if (requiredChecks.includes("nearbyPermission")) {
      nearbyPermission = await this.checkNearbyDevicesPermission();
    }
    if (requiredChecks.includes("bluetoothPermission")) {
      bluetoothPermission = await this.checkBluetoothPermission();
    }
    if (requiredChecks.includes("wifiDirectPermission")) {
      wifiDirectPermission = await this.checkWifiDirectPermission();
    }

    this.requirements = {
      wifi: wifiStatus,
      bluetooth: bluetoothStatus,
      location: locationStatus,
      permissions: {
        location: locationPermission,
        nearbyDevices: nearbyPermission,
        bluetooth: bluetoothPermission,
        wifiDirect: wifiDirectPermission,
      },
    };

    this.notifyRequirementsChange();
    return this.requirements;
  }

  async checkWiFi(): Promise<boolean> {
    try {
      const state = await NetInfo.fetch();
      this.lastNetState = state;
      
      if (Platform.OS === "web") {
        return state.isConnected === true;
      }
      
      if (Platform.OS === "android") {
        const details = state.details as any;
        
        if (details && typeof details.isWifiEnabled === "boolean") {
          console.log("WiFi enabled check (Android):", details.isWifiEnabled);
          return details.isWifiEnabled;
        }
        
        if (state.type === "wifi") {
          console.log("WiFi detected via connection type (connected to a network)");
          return true;
        }
        
        if (state.type === "cellular" || state.type === "none" || state.type === "unknown") {
          console.log("WiFi might be enabled but not connected - assuming enabled for Wi-Fi Direct");
          return true;
        }
        
        console.log("WiFi check fallback: type=" + state.type);
        return true;
      }
      
      if (Platform.OS === "ios") {
        if (state.type === "wifi") {
          console.log("iOS: WiFi connection detected");
          return true;
        }
        return state.isConnected === true;
      }
      
      return state.type === "wifi" || state.isConnected === true;
    } catch (error) {
      console.error("Error checking WiFi:", error);
      return true;
    }
  }

  async checkBluetooth(): Promise<boolean> {
    if (Platform.OS === "web") {
      return false;
    }
    
    if (Platform.OS === "android") {
      try {
        const androidVersion = Platform.Version as number;
        
        if (androidVersion >= 31) {
          const bluetoothScan = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN
          );
          const bluetoothConnect = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
          );
          
          if (!bluetoothScan || !bluetoothConnect) {
            console.log("Bluetooth permissions not granted, assuming Bluetooth may be disabled");
            return false;
          }
        }
        
        return true;
      } catch (error) {
        console.error("Error checking Bluetooth:", error);
        return true;
      }
    }
    
    return true;
  }

  async promptEnableBluetooth(): Promise<boolean> {
    if (Platform.OS === "android") {
      try {
        await IntentLauncher.startActivityAsync(
          IntentLauncher.ActivityAction.BLUETOOTH_SETTINGS
        );
        return true;
      } catch (error) {
        console.error("Error opening Bluetooth settings:", error);
        Alert.alert(
          "Activer le Bluetooth",
          "Veuillez activer le Bluetooth manuellement dans les parametres de votre appareil.",
          [{ text: "OK" }]
        );
        return false;
      }
    } else if (Platform.OS === "ios") {
      Alert.alert(
        "Activer le Bluetooth",
        "Veuillez activer le Bluetooth dans les Reglages de votre appareil.",
        [
          { text: "Annuler", style: "cancel" },
          { text: "Ouvrir Reglages", onPress: () => Linking.openSettings() },
        ]
      );
      return false;
    }
    return false;
  }

  async promptEnableWifi(): Promise<boolean> {
    if (Platform.OS === "android") {
      try {
        if (Platform.Version >= 29) {
          await IntentLauncher.startActivityAsync("android.settings.panel.action.WIFI");
        } else {
          await IntentLauncher.startActivityAsync(
            IntentLauncher.ActivityAction.WIFI_SETTINGS
          );
        }
        return true;
      } catch (error) {
        console.error("Error opening WiFi settings:", error);
        Alert.alert(
          "Activer le Wi-Fi",
          "Veuillez activer le Wi-Fi manuellement dans les parametres de votre appareil.",
          [{ text: "OK" }]
        );
        return false;
      }
    } else if (Platform.OS === "ios") {
      Alert.alert(
        "Activer le Wi-Fi",
        "Veuillez activer le Wi-Fi dans les Reglages de votre appareil.",
        [
          { text: "Annuler", style: "cancel" },
          { text: "Ouvrir Reglages", onPress: () => Linking.openSettings() },
        ]
      );
      return false;
    }
    return false;
  }

  async promptEnableLocation(): Promise<boolean> {
    if (Platform.OS === "android") {
      try {
        await IntentLauncher.startActivityAsync(
          IntentLauncher.ActivityAction.LOCATION_SOURCE_SETTINGS
        );
        return true;
      } catch (error) {
        console.error("Error opening Location settings:", error);
        Alert.alert(
          "Activer la Localisation",
          "Veuillez activer la localisation manuellement dans les parametres de votre appareil.",
          [{ text: "OK" }]
        );
        return false;
      }
    } else if (Platform.OS === "ios") {
      Alert.alert(
        "Activer la Localisation",
        "Veuillez activer la localisation dans les Reglages > Confidentialite > Localisation.",
        [
          { text: "Annuler", style: "cancel" },
          { text: "Ouvrir Reglages", onPress: () => Linking.openSettings() },
        ]
      );
      return false;
    }
    return false;
  }

  async checkLocation(): Promise<boolean> {
    if (Platform.OS === "android") {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== "granted") {
          return false;
        }
        
        const providerStatus = await Location.getProviderStatusAsync();
        return providerStatus.locationServicesEnabled;
      } catch (error) {
        console.error("Error checking location:", error);
        return false;
      }
    }
    return true;
  }

  async checkLocationPermission(): Promise<boolean> {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      return status === "granted";
    } catch (error) {
      console.error("Error checking location permission:", error);
      return false;
    }
  }

  async checkWifiDirectPermission(): Promise<boolean> {
    if (Platform.OS !== "android") {
      return false;
    }

    try {
      const locationGranted = await this.checkLocationPermission();
      if (!locationGranted) {
        console.log("Wi-Fi Direct: Location permission not granted");
        return false;
      }

      const androidVersion = Platform.Version as number;

      if (androidVersion >= 33) {
        const nearbyWifi = await PermissionsAndroid.check(
          "android.permission.NEARBY_WIFI_DEVICES" as any
        );
        console.log("NEARBY_WIFI_DEVICES permission:", nearbyWifi);
        if (!nearbyWifi) {
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error("Error checking Wi-Fi Direct permissions:", error);
      return false;
    }
  }

  async requestWifiDirectPermission(): Promise<boolean> {
    if (Platform.OS !== "android") {
      return false;
    }

    try {
      const locationGranted = await this.requestLocationPermission();
      if (!locationGranted) {
        console.log("Wi-Fi Direct: Failed to get location permission");
        return false;
      }

      const androidVersion = Platform.Version as number;
      const permissions: string[] = [
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      ];

      if (androidVersion >= 33) {
        permissions.push("android.permission.NEARBY_WIFI_DEVICES" as any);
      }

      const results = await PermissionsAndroid.requestMultiple(permissions as any);

      const allGranted = Object.values(results).every(
        (result) => result === PermissionsAndroid.RESULTS.GRANTED
      );

      console.log("Wi-Fi Direct permissions result:", results, "allGranted:", allGranted);

      this.requirements.permissions.wifiDirect = allGranted;
      this.notifyRequirementsChange();

      return allGranted;
    } catch (error) {
      console.error("Error requesting Wi-Fi Direct permissions:", error);
      return false;
    }
  }

  async checkNearbyDevicesPermission(): Promise<boolean> {
    if (Platform.OS === "android") {
      const locationGranted = await this.checkLocationPermission();
      if (!locationGranted) {
        console.log("Nearby: Location permission not granted");
        return false;
      }
      
      const androidVersion = Platform.Version as number;
      
      if (androidVersion >= 31) {
        try {
          const bluetoothScan = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN
          );
          const bluetoothConnect = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
          );
          const bluetoothAdvertise = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE
          );
          
          console.log("Bluetooth permissions:", { bluetoothScan, bluetoothConnect, bluetoothAdvertise });
          
          if (!bluetoothScan || !bluetoothConnect || !bluetoothAdvertise) {
            return false;
          }
        } catch (error) {
          console.error("Error checking Bluetooth permissions:", error);
          return false;
        }
      }
      
      if (androidVersion >= 33) {
        try {
          const nearbyWifi = await PermissionsAndroid.check(
            "android.permission.NEARBY_WIFI_DEVICES" as any
          );
          console.log("Nearby WiFi Devices permission:", nearbyWifi);
          if (!nearbyWifi) {
            return false;
          }
        } catch (error) {
          console.warn("Error checking NEARBY_WIFI_DEVICES:", error);
        }
      }
      
      return true;
    }
    return true;
  }
  
  async checkBluetoothPermission(): Promise<boolean> {
    if (Platform.OS !== "android") {
      return true;
    }
    
    const androidVersion = Platform.Version as number;
    
    if (androidVersion >= 31) {
      try {
        const bluetoothScan = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN
        );
        const bluetoothConnect = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
        );
        const bluetoothAdvertise = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE
        );
        
        return bluetoothScan && bluetoothConnect && bluetoothAdvertise;
      } catch (error) {
        console.error("Error checking Bluetooth permissions:", error);
        return false;
      }
    }
    
    return true;
  }
  
  async requestBluetoothPermissions(): Promise<boolean> {
    if (Platform.OS !== "android") {
      return true;
    }
    
    const androidVersion = Platform.Version as number;
    
    if (androidVersion >= 31) {
      try {
        const permissions = [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
        ];
        
        const results = await PermissionsAndroid.requestMultiple(permissions);
        
        const allGranted = 
          results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
          results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED &&
          results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE] === PermissionsAndroid.RESULTS.GRANTED;
        
        console.log("Bluetooth permissions request result:", results, "allGranted:", allGranted);
        
        this.requirements.permissions.bluetooth = allGranted;
        this.notifyRequirementsChange();
        
        return allGranted;
      } catch (error) {
        console.error("Error requesting Bluetooth permissions:", error);
        return false;
      }
    }
    
    return true;
  }
  
  async requestNearbyDevicesPermission(): Promise<boolean> {
    if (Platform.OS !== "android") {
      return true;
    }
    
    const locationGranted = await this.requestLocationPermission();
    if (!locationGranted) {
      console.log("Nearby: Failed to get location permission");
      return false;
    }
    
    const bluetoothGranted = await this.requestBluetoothPermissions();
    if (!bluetoothGranted) {
      console.log("Nearby: Failed to get Bluetooth permissions");
      return false;
    }
    
    const androidVersion = Platform.Version as number;
    
    if (androidVersion >= 33) {
      try {
        const result = await PermissionsAndroid.request(
          "android.permission.NEARBY_WIFI_DEVICES" as any,
          {
            title: "Permission Appareils a Proximite",
            message: "Sharel a besoin de cette permission pour detecter et se connecter aux appareils a proximite pour le partage de fichiers.",
            buttonPositive: "Autoriser",
            buttonNegative: "Refuser",
          }
        );
        
        const granted = result === PermissionsAndroid.RESULTS.GRANTED;
        console.log("NEARBY_WIFI_DEVICES permission result:", result, "granted:", granted);
        
        this.requirements.permissions.nearbyDevices = granted;
        this.notifyRequirementsChange();
        
        return granted;
      } catch (error) {
        console.warn("Error requesting NEARBY_WIFI_DEVICES:", error);
      }
    }
    
    this.requirements.permissions.nearbyDevices = true;
    this.notifyRequirementsChange();
    return true;
  }

  async requestLocationPermission(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const granted = status === "granted";
      
      this.requirements.permissions.location = granted;
      this.notifyRequirementsChange();
      
      return granted;
    } catch (error) {
      console.error("Error requesting location permission:", error);
      return false;
    }
  }

  async openWiFiSettings(): Promise<void> {
    if (Platform.OS === "android") {
      try {
        if (Platform.Version >= 29) {
          await IntentLauncher.startActivityAsync("android.settings.panel.action.WIFI");
        } else {
          await IntentLauncher.startActivityAsync(
            IntentLauncher.ActivityAction.WIFI_SETTINGS
          );
        }
      } catch (error) {
        console.error("Error opening WiFi settings:", error);
        try {
          await IntentLauncher.startActivityAsync(
            IntentLauncher.ActivityAction.WIFI_SETTINGS
          );
        } catch (fallbackError) {
          Alert.alert(
            "Paramètres",
            "Veuillez activer le Wi-Fi dans Paramètres > Wi-Fi",
            [{ text: "OK" }]
          );
        }
      }
    } else if (Platform.OS === "ios") {
      Alert.alert(
        "Activer le Wi-Fi",
        "Veuillez activer le Wi-Fi dans Réglages > Wi-Fi",
        [
          { text: "Annuler", style: "cancel" },
          { text: "Ouvrir Réglages", onPress: () => Linking.openSettings() },
        ]
      );
    }
  }

  async openWifiDirectSettings(): Promise<void> {
    if (Platform.OS === "android") {
      try {
        await IntentLauncher.startActivityAsync(
          "android.settings.WIFI_P2P_SETTINGS" as any
        );
      } catch (error) {
        console.error("Error opening Wi-Fi Direct settings:", error);
        try {
          await IntentLauncher.startActivityAsync(
            IntentLauncher.ActivityAction.WIFI_SETTINGS
          );
        } catch (fallbackError) {
          Alert.alert(
            "Paramètres",
            "Veuillez activer Wi-Fi Direct dans Paramètres > Wi-Fi > Wi-Fi Direct",
            [{ text: "OK" }]
          );
        }
      }
    }
  }

  async openBluetoothSettings(): Promise<void> {
    if (Platform.OS === "android") {
      try {
        if (Platform.Version >= 29) {
          await IntentLauncher.startActivityAsync("android.settings.panel.action.INTERNET_CONNECTIVITY");
        } else {
          await IntentLauncher.startActivityAsync(
            IntentLauncher.ActivityAction.BLUETOOTH_SETTINGS
          );
        }
      } catch (error) {
        console.error("Error opening Bluetooth settings:", error);
        try {
          await IntentLauncher.startActivityAsync(
            IntentLauncher.ActivityAction.BLUETOOTH_SETTINGS
          );
        } catch (fallbackError) {
          Alert.alert(
            "Paramètres",
            "Veuillez activer le Bluetooth dans Paramètres > Bluetooth",
            [{ text: "OK" }]
          );
        }
      }
    } else if (Platform.OS === "ios") {
      Alert.alert(
        "Activer le Bluetooth",
        "Veuillez activer le Bluetooth dans Réglages > Bluetooth",
        [
          { text: "Annuler", style: "cancel" },
          { text: "Ouvrir Réglages", onPress: () => Linking.openSettings() },
        ]
      );
    }
  }

  async openLocationSettings(): Promise<void> {
    if (Platform.OS === "android") {
      try {
        await IntentLauncher.startActivityAsync(
          IntentLauncher.ActivityAction.LOCATION_SOURCE_SETTINGS
        );
      } catch (error) {
        console.error("Error opening location settings:", error);
        Alert.alert(
          "Paramètres",
          "Veuillez activer la localisation dans Paramètres > Localisation",
          [{ text: "OK" }]
        );
      }
    } else if (Platform.OS === "ios") {
      Alert.alert(
        "Activer la localisation",
        "Veuillez activer la localisation dans Réglages > Confidentialité > Localisation",
        [
          { text: "Annuler", style: "cancel" },
          { text: "Ouvrir Réglages", onPress: () => Linking.openSettings() },
        ]
      );
    }
  }

  async enableWiFi(): Promise<boolean> {
    if (Platform.OS === "android") {
      await this.openWiFiSettings();
      return false;
    } else {
      await this.openWiFiSettings();
      return false;
    }
  }

  async enableBluetooth(): Promise<boolean> {
    if (Platform.OS === "android") {
      await this.openBluetoothSettings();
      return false;
    } else {
      await this.openBluetoothSettings();
      return false;
    }
  }

  async enableLocation(): Promise<boolean> {
    if (Platform.OS === "android") {
      await this.openLocationSettings();
      return false;
    } else {
      await this.openLocationSettings();
      return false;
    }
  }

  getRequiredChecks(method: TransferMethod, isReceiver: boolean): string[] {
    const platform = Platform.OS;
    
    if (method === "wifidirect") {
      if (platform === "android") {
        // P2P Wi-Fi Direct mode
        // Sender: needs wifi, location, and nearby permissions to create group and generate QR
        // Receiver: needs wifi, location, and nearby permissions to scan QR and connect
        // Both need the same base permissions, but receiver also needs camera
        const basePermissions = [
          "wifi",
          "location",
          "locationPermission",
          "nearbyPermission",
        ];
        
        // Bluetooth is optional for Wi-Fi Direct but helps with discovery
        // Only add if not causing issues
        return basePermissions;
      } else {
        return [];
      }
    } else if (method === "multipeer") {
      if (platform === "ios") {
        return ["wifi", "bluetooth"];
      } else {
        return [];
      }
    } else if (method === "hotspot") {
      if (platform === "android") {
        if (isReceiver) {
          return ["wifi"];
        } else {
          const senderRequirements = ["wifi", "location", "locationPermission"];
          if (Platform.Version >= 33) {
            senderRequirements.push("nearbyPermission");
          }
          return senderRequirements;
        }
      } else if (platform === "ios") {
        return ["wifi"];
      } else {
        return ["wifi"];
      }
    }
    
    return [];
  }
  
  getInfoChecks(method: TransferMethod, isReceiver: boolean): string[] {
    return [];
  }
  
  getBluetoothRequiredMethods(): TransferMethod[] {
    return ["multipeer"];
  }

  areRequirementsMet(method: TransferMethod, isReceiver: boolean): boolean {
    const required = this.getRequiredChecks(method, isReceiver);
    
    for (const check of required) {
      switch (check) {
        case "wifi":
          if (!this.requirements.wifi) return false;
          break;
        case "bluetooth":
          if (!this.requirements.bluetooth) return false;
          break;
        case "location":
          if (!this.requirements.location) return false;
          break;
        case "locationPermission":
          if (!this.requirements.permissions.location) return false;
          break;
        case "nearbyPermission":
          if (!this.requirements.permissions.nearbyDevices) return false;
          break;
        case "bluetoothPermission":
          if (!this.requirements.permissions.bluetooth) return false;
          break;
        case "wifiDirectPermission":
          if (!this.requirements.permissions.wifiDirect) return false;
          break;
      }
    }
    
    return true;
  }

  getSuggestedMethod(senderPlatform: string, receiverPlatform: string): TransferMethod {
    if (senderPlatform === "android" && receiverPlatform === "android") {
      return "wifidirect";
    } else if (senderPlatform === "ios" && receiverPlatform === "ios") {
      return "multipeer";
    } else {
      return "hotspot";
    }
  }

  setOnRequirementsChange(callback: (requirements: SystemRequirements) => void) {
    this.onRequirementsChange = callback;
  }

  private notifyRequirementsChange() {
    if (this.onRequirementsChange) {
      this.onRequirementsChange(this.requirements);
    }
  }

  getCurrentRequirements(): SystemRequirements {
    return { ...this.requirements };
  }

  subscribeToNetworkChanges() {
    if (this.netInfoUnsubscribe) {
      this.netInfoUnsubscribe();
    }
    
    const unsubscribe = NetInfo.addEventListener(state => {
      this.lastNetState = state;
      let wifiEnabled = true;
      
      if (Platform.OS === "web") {
        wifiEnabled = state.isConnected === true;
      } else if (Platform.OS === "android") {
        const details = state.details as any;
        if (details && typeof details.isWifiEnabled === "boolean") {
          wifiEnabled = details.isWifiEnabled;
        } else {
          wifiEnabled = true;
        }
        console.log("NetInfo change: type=" + state.type + ", wifiEnabled=" + wifiEnabled);
      } else if (Platform.OS === "ios") {
        wifiEnabled = state.type === "wifi" || state.isConnected === true;
      }
      
      if (this.requirements.wifi !== wifiEnabled) {
        console.log("WiFi status changed: " + this.requirements.wifi + " -> " + wifiEnabled);
        this.requirements.wifi = wifiEnabled;
        this.notifyRequirementsChange();
      }
    });
    
    this.netInfoUnsubscribe = unsubscribe;
    this.listeners.push(unsubscribe);
    return unsubscribe;
  }

  cleanup() {
    this.listeners.forEach(unsubscribe => unsubscribe());
    this.listeners = [];
    this.netInfoUnsubscribe = null;
    this.onRequirementsChange = null;
  }
}

export default new SystemRequirementsService();
