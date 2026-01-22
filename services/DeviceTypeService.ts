import { Platform } from "react-native";
import * as Device from "expo-device";

export type DeviceType = "android" | "ios" | "web" | "pc";
export type TransferMethodType = "wifidirect" | "multipeer" | "hotspot";

export interface DeviceInfo {
  type: DeviceType;
  name: string;
  icon: string;
  displayName: string;
}

class DeviceTypeService {
  getLocalDeviceType(): DeviceType {
    if (Platform.OS === "android") {
      return "android";
    } else if (Platform.OS === "ios") {
      return "ios";
    } else if (Platform.OS === "web") {
      return "web";
    } else {
      return "pc";
    }
  }

  getLocalDeviceInfo(): DeviceInfo {
    const type = this.getLocalDeviceType();
    const deviceModel = Device.modelName || Device.modelId || "";

    switch (type) {
      case "android":
        return {
          type: "android",
          name: deviceModel || "Android",
          icon: "smartphone",
          displayName: "Android"
        };
      case "ios":
        return {
          type: "ios",
          name: deviceModel || "iPhone",
          icon: "smartphone",
          displayName: "iOS"
        };
      case "web":
        return {
          type: "web",
          name: "Navigateur Web",
          icon: "globe",
          displayName: "Web"
        };
      case "pc":
        return {
          type: "pc",
          name: "Ordinateur",
          icon: "monitor",
          displayName: "PC"
        };
    }
  }

  getDeviceTypeInfo(type: DeviceType): DeviceInfo {
    switch (type) {
      case "android":
        return {
          type: "android",
          name: "Android",
          icon: "smartphone",
          displayName: "Android"
        };
      case "ios":
        return {
          type: "ios",
          name: "iOS",
          icon: "smartphone",
          displayName: "iOS"
        };
      case "web":
        return {
          type: "web",
          name: "Navigateur Web",
          icon: "globe",
          displayName: "Web"
        };
      case "pc":
        return {
          type: "pc",
          name: "Ordinateur",
          icon: "monitor",
          displayName: "PC"
        };
    }
  }

  getBestTransferMethod(
    senderType: DeviceType,
    receiverType: DeviceType
  ): TransferMethodType {
    if (senderType === "android" && receiverType === "android") {
      return "wifidirect";
    } else if (senderType === "ios" && receiverType === "ios") {
      return "multipeer";
    } else {
      return "hotspot";
    }
  }

  getTransferMethodDescription(
    senderType: DeviceType,
    receiverType: DeviceType
  ): string {
    const method = this.getBestTransferMethod(senderType, receiverType);
    
    if (method === "wifidirect") {
      return "Transfert via Wi-Fi Direct (Android → Android) - Sans limite de taille";
    } else if (method === "multipeer") {
      return "Transfert via Multipeer Connectivity (iOS → iOS)";
    } else {
      return "Transfert via Hotspot + HTTP (Cross-platform)";
    }
  }

  getAvailableReceiverTypes(senderType: DeviceType): DeviceType[] {
    return ["android", "ios", "web", "pc"];
  }

  isTransferMethodSupported(
    senderType: DeviceType,
    receiverType: DeviceType
  ): boolean {
    const method = this.getBestTransferMethod(senderType, receiverType);
    
    if (method === "wifidirect") {
      return Platform.OS === "android";
    } else if (method === "multipeer") {
      return Platform.OS === "ios";
    } else if (method === "hotspot") {
      return Platform.OS !== "web";
    }
    
    return false;
  }

  getDeviceName(): string {
    const deviceModel = Device.modelName || Device.modelId;
    if (deviceModel) {
      return deviceModel;
    }
    
    return Platform.select({
      ios: "iPhone",
      android: "Android",
      default: "Appareil",
    }) || "Mon Appareil";
  }

  getRequiredChecksForTransfer(
    senderType: DeviceType,
    receiverType: DeviceType,
    isReceiver: boolean
  ): string[] {
    const method = this.getBestTransferMethod(senderType, receiverType);
    
    if (method === "wifidirect") {
      return ["wifi", "location", "locationPermission", "wifiDirectPermission"];
    } else if (method === "multipeer") {
      return ["wifi", "bluetooth"];
    } else if (method === "hotspot") {
      if (isReceiver) {
        return ["wifi"];
      } else {
        return ["wifi", "hotspotCapability"];
      }
    }
    
    return [];
  }
}

export default new DeviceTypeService();
