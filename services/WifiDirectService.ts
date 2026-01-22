import { Platform, PermissionsAndroid, NativeEventEmitter, NativeModules } from "react-native";
import * as FileSystem from "expo-file-system";
import NetInfo from "@react-native-community/netinfo";
import { logger } from "./LoggerService";
import { nativeWifiDirect } from "./NativeWifiDirect";

const { WifiDirectModule } = NativeModules;
let wifiP2P: any = null;
let useNativeModule: boolean = false;

if (Platform.OS === "android") {
  if (WifiDirectModule) {
    useNativeModule = true;
    logger.info('WiFiDirect', 'Using native Kotlin WifiDirectModule');
  } else {
    try {
      wifiP2P = require("react-native-wifi-p2p-reborn");
      logger.info('WiFiDirect', 'Using react-native-wifi-p2p-reborn fallback');
    } catch (error) {
      console.warn("react-native-wifi-p2p-reborn not available:", error);
    }
  }
}

export interface WifiDirectPeer {
  peerId: string;
  name: string;
  deviceAddress: string;
  status: "discovered" | "connecting" | "connected" | "disconnected";
  isGroupOwner?: boolean;
}

export interface WifiDirectTransfer {
  id: string;
  fileName: string;
  fileSize: number;
  progress: number;
  status: "pending" | "transferring" | "completed" | "failed";
  peerId: string;
}

export interface ConnectionInfo {
  isConnected: boolean;
  isGroupOwner: boolean;
  groupOwnerAddress: string;
}

const SERVICE_PORT = 8988;
const BUFFER_SIZE = 1024 * 1024; // 1MB chunks for streaming

class WifiDirectService {
  private myDeviceAddress: string | null = null;
  private myDeviceName: string | null = null;
  private peers: Map<string, WifiDirectPeer> = new Map();
  private transfers: Map<string, WifiDirectTransfer> = new Map();
  private isSupported: boolean = Platform.OS === "android" && (useNativeModule || wifiP2P !== null);
  private isInitialized: boolean = false;
  private connectionInfo: ConnectionInfo | null = null;
  private serverSocket: any = null;
  private deviceInfoResolvers: Array<(address: string) => void> = [];
  private nativeEventSubscription: (() => void) | null = null;

  private onPeersChange: ((peers: WifiDirectPeer[]) => void) | null = null;
  private onTransfersChange: ((transfers: WifiDirectTransfer[]) => void) | null = null;
  private onConnectionRequest: ((peerId: string, name: string) => void) | null = null;
  private onConnected: ((peerId: string) => void) | null = null;
  private onDisconnectedCallback: ((peerId: string) => void) | null = null;

  constructor() {}

  async initialize(): Promise<boolean> {
    if (!this.isSupported) {
      logger.warn('WiFiDirect', 'Wi-Fi Direct not supported on this platform');
      throw new Error("Wi-Fi Direct n'est pas disponible. Cette fonctionnalite necessite un build natif (APK). Veuillez utiliser le mode Hotspot ou installer l'application en APK.");
    }

    if (this.isInitialized) {
      logger.debug('WiFiDirect', 'Already initialized');
      return true;
    }

    try {
      logger.info('WiFiDirect', 'Initializing Wi-Fi Direct...');
      
      const permissionsGranted = await this.requestPermissions();
      if (!permissionsGranted) {
        logger.error('WiFiDirect', 'Permissions not granted');
        throw new Error("Les permissions requises n'ont pas ete accordees. Veuillez autoriser l'acces a la localisation et aux appareils a proximite.");
      }
      logger.info('WiFiDirect', 'Permissions granted');

      if (useNativeModule) {
        const result = await nativeWifiDirect.initialize();
        if (!result.success) {
          throw new Error(result.error || "Echec de l'initialisation du module natif Wi-Fi Direct");
        }
        this.setupNativeEventListeners();
        logger.info('WiFiDirect', 'Native Kotlin Wi-Fi Direct initialized successfully');
      } else if (wifiP2P) {
        await wifiP2P.initialize();
        this.setupEventListeners();
        logger.info('WiFiDirect', 'react-native-wifi-p2p Wi-Fi Direct initialized successfully');
      } else {
        throw new Error("Aucun module Wi-Fi Direct disponible");
      }

      this.isInitialized = true;

      return true;
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      logger.error('WiFiDirect', 'Failed to initialize', { error: errorMessage });
      
      if (errorMessage.includes("Wi-Fi Direct") || errorMessage.includes("permission")) {
        throw error;
      }
      
      if (errorMessage.toLowerCase().includes("wifi") || errorMessage.toLowerCase().includes("disabled")) {
        throw new Error("Wi-Fi Direct necessite que le Wi-Fi et la localisation soient actives. Veuillez les activer dans les parametres de votre appareil.");
      }
      
      if (errorMessage.toLowerCase().includes("busy") || errorMessage.toLowerCase().includes("already")) {
        throw new Error("Wi-Fi Direct est occupe. Veuillez desactiver et reactiver le Wi-Fi, puis reessayez.");
      }
      
      throw new Error(`Impossible d'initialiser Wi-Fi Direct: ${errorMessage}. Verifiez que le Wi-Fi et la localisation sont actives.`);
    }
  }

  getInitializationError(): string | null {
    if (!this.isSupported) {
      return "Wi-Fi Direct n'est pas disponible sur cette plateforme.";
    }
    if (!useNativeModule && !wifiP2P) {
      return "Le module Wi-Fi Direct n'est pas charge. Un build natif (APK) est necessaire.";
    }
    return null;
  }

  private async requestPermissions(): Promise<boolean> {
    if (Platform.OS !== "android") {
      return false;
    }

    try {
      const apiLevel = Platform.Version;
      const permissions: string[] = [
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      ];

      if (apiLevel >= 33) {
        permissions.push("android.permission.NEARBY_WIFI_DEVICES" as any);
      }

      const results = await PermissionsAndroid.requestMultiple(permissions as any);

      const allGranted = Object.values(results).every(
        (result) => result === PermissionsAndroid.RESULTS.GRANTED
      );

      if (!allGranted) {
        console.warn("Some Wi-Fi Direct permissions were denied");
      }

      return allGranted;
    } catch (error) {
      console.error("Error requesting permissions:", error);
      return false;
    }
  }

  private setupEventListeners() {
    if (!wifiP2P) return;

    try {
      wifiP2P.subscribeOnPeersUpdates(({ devices }: { devices: any[] }) => {
        console.log("Peers updated:", devices?.length || 0);
        
        const currentConnectedPeers = new Set(
          Array.from(this.peers.values())
            .filter(p => p.status === "connected")
            .map(p => p.deviceAddress)
        );

        this.peers.clear();

        if (devices && Array.isArray(devices)) {
          devices.forEach((device) => {
            const wasConnected = currentConnectedPeers.has(device.deviceAddress);
            this.peers.set(device.deviceAddress, {
              peerId: device.deviceAddress,
              name: device.deviceName || "Unknown Device",
              deviceAddress: device.deviceAddress,
              status: wasConnected ? "connected" : "discovered",
              isGroupOwner: device.isGroupOwner,
            });
          });
        }

        this.notifyPeersChange();
      });

      wifiP2P.subscribeOnConnectionInfoUpdates((info: any) => {
        console.log("Connection info updated:", info);
        
        if (info && info.groupFormed) {
          this.connectionInfo = {
            isConnected: true,
            isGroupOwner: info.isGroupOwner,
            groupOwnerAddress: info.groupOwnerAddress,
          };

          const connectedPeerId = info.groupOwnerAddress || "connected-peer";
          
          this.peers.forEach((peer, address) => {
            if (address === connectedPeerId || info.isGroupOwner) {
              peer.status = "connected";
            }
          });

          if (!this.peers.has(connectedPeerId) && !info.isGroupOwner) {
            this.peers.set(connectedPeerId, {
              peerId: connectedPeerId,
              name: "Connected Device",
              deviceAddress: connectedPeerId,
              status: "connected",
              isGroupOwner: true,
            });
          }

          this.notifyPeersChange();

          if (this.onConnected) {
            this.onConnected(connectedPeerId);
          }

          if (info.isGroupOwner) {
            this.startFileServer();
          }
        } else {
          this.connectionInfo = null;
          this.peers.forEach((peer) => {
            if (peer.status === "connected") {
              peer.status = "disconnected";
              if (this.onDisconnectedCallback) {
                this.onDisconnectedCallback(peer.peerId);
              }
            }
          });
          this.notifyPeersChange();
        }
      });

      wifiP2P.subscribeOnThisDeviceChanged((device: any) => {
        logger.info('WiFiDirect', 'This device changed', { 
          deviceAddress: device?.deviceAddress, 
          deviceName: device?.deviceName 
        });
        if (device && device.deviceAddress) {
          this.myDeviceAddress = device.deviceAddress;
          this.myDeviceName = device.deviceName || null;
          
          this.deviceInfoResolvers.forEach(resolve => resolve(device.deviceAddress));
          this.deviceInfoResolvers = [];
        }
      });

    } catch (error) {
      logger.error('WiFiDirect', 'Error setting up event listeners', { error: String(error) });
    }
  }

  private setupNativeEventListeners() {
    this.nativeEventSubscription = nativeWifiDirect.onWifiDirectEvent((event) => {
      logger.debug('WiFiDirect', 'Native event received', { event: event.event });
      
      switch (event.event) {
        case 'peersChanged':
          if (event.peers) {
            const currentConnectedPeers = new Set(
              Array.from(this.peers.values())
                .filter(p => p.status === "connected")
                .map(p => p.deviceAddress)
            );

            this.peers.clear();
            event.peers.forEach((device) => {
              const wasConnected = currentConnectedPeers.has(device.deviceAddress);
              this.peers.set(device.deviceAddress, {
                peerId: device.deviceAddress,
                name: device.deviceName || "Unknown Device",
                deviceAddress: device.deviceAddress,
                status: wasConnected ? "connected" : "discovered",
                isGroupOwner: device.isGroupOwner,
              });
            });
            this.notifyPeersChange();
          }
          break;
          
        case 'connected':
          if (event.groupFormed) {
            this.connectionInfo = {
              isConnected: true,
              isGroupOwner: event.isGroupOwner || false,
              groupOwnerAddress: event.groupOwnerAddress || "",
            };

            const connectedPeerId = event.groupOwnerAddress || "connected-peer";
            
            this.peers.forEach((peer, address) => {
              if (address === connectedPeerId || event.isGroupOwner) {
                peer.status = "connected";
              }
            });

            if (!this.peers.has(connectedPeerId) && !event.isGroupOwner) {
              this.peers.set(connectedPeerId, {
                peerId: connectedPeerId,
                name: "Connected Device",
                deviceAddress: connectedPeerId,
                status: "connected",
                isGroupOwner: true,
              });
            }

            this.notifyPeersChange();

            if (this.onConnected) {
              this.onConnected(connectedPeerId);
            }

            if (event.isGroupOwner) {
              this.startFileServer();
            }
          }
          break;
          
        case 'disconnected':
          this.connectionInfo = null;
          this.peers.forEach((peer) => {
            if (peer.status === "connected") {
              peer.status = "disconnected";
              if (this.onDisconnectedCallback) {
                this.onDisconnectedCallback(peer.peerId);
              }
            }
          });
          this.notifyPeersChange();
          break;
          
        case 'thisDeviceChanged':
          if (event.deviceAddress) {
            this.myDeviceAddress = event.deviceAddress;
            this.myDeviceName = event.deviceName || null;
            this.deviceInfoResolvers.forEach(resolve => resolve(event.deviceAddress!));
            this.deviceInfoResolvers = [];
          }
          break;
          
        case 'error':
          logger.error('WiFiDirect', 'Native error event', { message: event.message });
          break;
      }
    });
  }

  async startDiscovering(): Promise<string> {
    if (!this.isSupported) {
      throw new Error("Wi-Fi Direct not available");
    }

    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      if (useNativeModule) {
        await nativeWifiDirect.discoverPeers();
      } else if (wifiP2P) {
        await wifiP2P.startDiscoveringPeers();
      }
      console.log("Started discovering peers");
      return this.myDeviceAddress || "discovery-started";
    } catch (error) {
      console.error("Failed to start discovery:", error);
      throw error;
    }
  }

  async stopDiscovering(): Promise<void> {
    if (!this.isSupported) return;

    try {
      if (useNativeModule) {
        await nativeWifiDirect.stopDiscovery();
      } else if (wifiP2P) {
        await wifiP2P.stopDiscoveringPeers();
      }
      console.log("Stopped discovering peers");
    } catch (error) {
      console.error("Failed to stop discovery:", error);
    }
  }

  async connectToPeer(deviceAddress: string): Promise<void> {
    if (!this.isSupported) {
      throw new Error("Wi-Fi Direct not available");
    }

    const peer = this.peers.get(deviceAddress);
    if (peer) {
      peer.status = "connecting";
      this.notifyPeersChange();
    }

    try {
      if (useNativeModule) {
        await nativeWifiDirect.connect(deviceAddress);
      } else if (wifiP2P) {
        await wifiP2P.connect(deviceAddress);
      }
      console.log(`Connection initiated to ${deviceAddress}`);
    } catch (error) {
      console.error("Failed to connect:", error);
      if (peer) {
        peer.status = "disconnected";
        this.notifyPeersChange();
      }
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.isSupported) return;

    try {
      if (useNativeModule) {
        await nativeWifiDirect.disconnect();
      } else if (wifiP2P) {
        await wifiP2P.disconnect();
      }
      this.connectionInfo = null;
      
      this.peers.forEach((peer) => {
        if (peer.status === "connected") {
          peer.status = "disconnected";
          if (this.onDisconnectedCallback) {
            this.onDisconnectedCallback(peer.peerId);
          }
        }
      });
      
      this.notifyPeersChange();
      console.log("Disconnected from Wi-Fi Direct group");
    } catch (error) {
      console.error("Failed to disconnect:", error);
      throw error;
    }
  }

  private waitForDeviceAddress(timeout: number = 5000): Promise<string> {
    return new Promise((resolve, reject) => {
      if (this.myDeviceAddress) {
        resolve(this.myDeviceAddress);
        return;
      }

      const timer = setTimeout(() => {
        const index = this.deviceInfoResolvers.indexOf(resolve);
        if (index > -1) {
          this.deviceInfoResolvers.splice(index, 1);
        }
        reject(new Error("Timeout waiting for device address"));
      }, timeout);

      this.deviceInfoResolvers.push((address: string) => {
        clearTimeout(timer);
        resolve(address);
      });
    });
  }

  async createGroup(): Promise<string> {
    if (!this.isSupported) {
      throw new Error("Wi-Fi Direct not available");
    }

    try {
      if (useNativeModule) {
        await WifiDirectModule.createGroup();
      } else if (wifiP2P) {
        await wifiP2P.createGroup();
      } else {
        throw new Error("No Wi-Fi Direct module available");
      }
      console.log("Wi-Fi Direct group created, waiting for device info...");
      
      try {
        const deviceAddress = await this.waitForDeviceAddress(10000);
        console.log("Wi-Fi Direct group ready with address:", deviceAddress);
        return deviceAddress;
      } catch (timeoutError) {
        console.warn("Timeout waiting for device address, using fallback");
        if (this.myDeviceAddress) {
          return this.myDeviceAddress;
        }
        const fallbackId = `wifi-direct-${Date.now()}`;
        this.myDeviceAddress = fallbackId;
        return fallbackId;
      }
    } catch (error) {
      console.error("Failed to create group:", error);
      throw new Error("Impossible de creer le groupe Wi-Fi Direct. Verifiez que le Wi-Fi et la localisation sont actives.");
    }
  }

  getMyDeviceName(): string | null {
    return this.myDeviceName;
  }

  getMyDeviceAddress(): string | null {
    return this.myDeviceAddress;
  }

  async removeGroup(): Promise<void> {
    if (!this.isSupported) return;

    try {
      if (useNativeModule) {
        await WifiDirectModule.removeGroup();
      } else if (wifiP2P) {
        await wifiP2P.removeGroup();
      }
      console.log("Wi-Fi Direct group removed");
    } catch (error) {
      console.error("Failed to remove group:", error);
    }
  }

  private async startFileServer(): Promise<void> {
    if (!useNativeModule && !wifiP2P) return;

    try {
      console.log(`Starting file server on port ${SERVICE_PORT}`);
      
      wifiP2P.receiveFile(
        FileSystem.documentDirectory,
        SERVICE_PORT,
        (meta: { fileName: string; progress: number }) => {
          console.log(`Receiving file: ${meta.fileName}, progress: ${meta.progress}%`);
          
          const existingTransfer = Array.from(this.transfers.values()).find(
            t => t.fileName === meta.fileName && t.status === "transferring"
          );

          if (existingTransfer) {
            existingTransfer.progress = meta.progress;
            this.notifyTransfersChange();
          }
        }
      ).then((filePath: string) => {
        console.log(`File received and saved to: ${filePath}`);
        
        const fileName = filePath.split('/').pop() || 'received-file';
        const existingTransfer = Array.from(this.transfers.values()).find(
          t => t.fileName === fileName
        );

        if (existingTransfer) {
          existingTransfer.status = "completed";
          existingTransfer.progress = 100;
          this.notifyTransfersChange();
        }
      }).catch((error: Error) => {
        console.error("Error receiving file:", error);
      });

    } catch (error) {
      console.error("Failed to start file server:", error);
    }
  }

  async sendFile(
    peerId: string,
    fileName: string,
    fileSize: number,
    fileUri: string
  ): Promise<void> {
    if (!this.isSupported) {
      throw new Error("Wi-Fi Direct not available");
    }

    if (!this.connectionInfo) {
      throw new Error("Not connected to any peer");
    }

    const fileId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const transfer: WifiDirectTransfer = {
      id: fileId,
      fileName,
      fileSize,
      progress: 0,
      status: "transferring",
      peerId,
    };

    this.transfers.set(fileId, transfer);
    this.notifyTransfersChange();

    try {
      let localUri = fileUri;
      
      if (fileUri.startsWith("content://")) {
        const tempPath = FileSystem.cacheDirectory + fileName;
        await FileSystem.copyAsync({
          from: fileUri,
          to: tempPath,
        });
        localUri = tempPath;
      }

      const targetAddress = this.connectionInfo.isGroupOwner
        ? peerId
        : this.connectionInfo.groupOwnerAddress;

      console.log(`Sending file ${fileName} to ${targetAddress}`);

      await wifiP2P.sendFile(localUri, targetAddress, SERVICE_PORT, {
        onProgress: (progress: number) => {
          transfer.progress = progress;
          this.notifyTransfersChange();
        },
      });

      transfer.status = "completed";
      transfer.progress = 100;
      this.notifyTransfersChange();

      console.log(`File sent successfully: ${fileName}`);

    } catch (error) {
      console.error("Error sending file:", error);
      transfer.status = "failed";
      this.notifyTransfersChange();
      throw error;
    }
  }

  async receiveFile(): Promise<string> {
    if (!this.isSupported) {
      throw new Error("Wi-Fi Direct not available");
    }

    const receiveId = `receive-${Date.now()}`;

    try {
      const filePath = await wifiP2P.receiveFile(
        FileSystem.documentDirectory,
        SERVICE_PORT,
        (meta: { fileName: string; progress: number }) => {
          const existingTransfer = Array.from(this.transfers.values()).find(
            t => t.id === receiveId
          );

          if (existingTransfer) {
            existingTransfer.fileName = meta.fileName;
            existingTransfer.progress = meta.progress;
            this.notifyTransfersChange();
          } else {
            const transfer: WifiDirectTransfer = {
              id: receiveId,
              fileName: meta.fileName || "receiving...",
              fileSize: 0,
              progress: meta.progress,
              status: "transferring",
              peerId: "sender",
            };
            this.transfers.set(receiveId, transfer);
            this.notifyTransfersChange();
          }
        }
      );

      const transfer = this.transfers.get(receiveId);
      if (transfer) {
        transfer.status = "completed";
        transfer.progress = 100;
        this.notifyTransfersChange();
      }

      console.log(`File received: ${filePath}`);
      return filePath;

    } catch (error) {
      console.error("Error receiving file:", error);
      const transfer = this.transfers.get(receiveId);
      if (transfer) {
        transfer.status = "failed";
        this.notifyTransfersChange();
      }
      throw error;
    }
  }

  getConnectionInfo(): ConnectionInfo | null {
    return this.connectionInfo;
  }

  isConnected(): boolean {
    return this.connectionInfo?.isConnected || false;
  }

  isGroupOwner(): boolean {
    return this.connectionInfo?.isGroupOwner || false;
  }

  setOnPeersChange(callback: (peers: WifiDirectPeer[]) => void) {
    this.onPeersChange = callback;
  }

  setOnTransfersChange(callback: (transfers: WifiDirectTransfer[]) => void) {
    this.onTransfersChange = callback;
  }

  setOnConnectionRequest(callback: (peerId: string, name: string) => void) {
    this.onConnectionRequest = callback;
  }

  setOnConnected(callback: (peerId: string) => void) {
    this.onConnected = callback;
  }

  setOnDisconnected(callback: (peerId: string) => void) {
    this.onDisconnectedCallback = callback;
  }

  private notifyPeersChange() {
    if (this.onPeersChange) {
      this.onPeersChange(Array.from(this.peers.values()));
    }
  }

  private notifyTransfersChange() {
    if (this.onTransfersChange) {
      this.onTransfersChange(Array.from(this.transfers.values()));
    }
  }

  getPeers(): WifiDirectPeer[] {
    return Array.from(this.peers.values());
  }

  getConnectedPeers(): WifiDirectPeer[] {
    return Array.from(this.peers.values()).filter((p) => p.status === "connected");
  }

  getMyPeerId(): string | null {
    return this.myDeviceAddress;
  }

  isWifiDirectSupported(): boolean {
    return this.isSupported;
  }

  cleanup() {
    if (useNativeModule) {
      if (this.nativeEventSubscription) {
        this.nativeEventSubscription();
        this.nativeEventSubscription = null;
      }
      nativeWifiDirect.cleanup().catch(err => {
        console.warn("Error during native cleanup:", err);
      });
    } else if (wifiP2P) {
      try {
        wifiP2P.unsubscribeFromPeersUpdates();
        wifiP2P.unsubscribeFromConnectionInfoUpdates();
        wifiP2P.unsubscribeFromThisDeviceChanged();
      } catch (error) {
        console.warn("Error during cleanup:", error);
      }
    }
    
    this.peers.clear();
    this.transfers.clear();
    this.connectionInfo = null;
    this.isInitialized = false;
    this.myDeviceAddress = null;
  }
}

export default new WifiDirectService();
