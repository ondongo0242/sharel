import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { WifiDirectModule } = NativeModules;

export interface WifiP2pDevice {
  deviceName: string;
  deviceAddress: string;
  status: number;
  isGroupOwner: boolean;
  primaryDeviceType?: string;
}

export interface WifiP2pConnectionInfo {
  isGroupOwner: boolean;
  groupFormed: boolean;
  groupOwnerAddress: string;
}

export interface WifiDirectEvent {
  event: 'wifiP2pStateChanged' | 'peersChanged' | 'connected' | 'disconnected' | 'thisDeviceChanged' | 'error';
  isEnabled?: boolean;
  peers?: WifiP2pDevice[];
  isGroupOwner?: boolean;
  groupFormed?: boolean;
  groupOwnerAddress?: string;
  deviceName?: string;
  deviceAddress?: string;
  status?: number;
  message?: string;
}

export const WifiP2pDeviceStatus = {
  CONNECTED: 0,
  INVITED: 1,
  FAILED: 2,
  AVAILABLE: 3,
  UNAVAILABLE: 4,
};

class NativeWifiDirectService {
  private eventEmitter: NativeEventEmitter | null = null;
  private isInitialized = false;
  private initializationError: string | null = null;

  constructor() {
    if (Platform.OS === 'android' && WifiDirectModule) {
      this.eventEmitter = new NativeEventEmitter(WifiDirectModule);
    }
  }

  isAvailable(): boolean {
    return Platform.OS === 'android' && !!WifiDirectModule;
  }

  isReady(): boolean {
    return this.isAvailable() && this.isInitialized;
  }

  getInitializationError(): string | null {
    return this.initializationError;
  }

  async initialize(): Promise<{ success: boolean; isSupported: boolean; error?: string }> {
    if (!this.isAvailable()) {
      this.initializationError = 'Wi-Fi Direct is not available on this platform';
      return { success: false, isSupported: false, error: this.initializationError };
    }

    try {
      const result = await WifiDirectModule.initialize();
      this.isInitialized = result.success;
      this.initializationError = result.success ? null : 'Failed to initialize Wi-Fi Direct';
      return result;
    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown error during initialization';
      console.error('Failed to initialize Wi-Fi Direct:', errorMessage);
      this.isInitialized = false;
      this.initializationError = errorMessage;
      return { success: false, isSupported: false, error: errorMessage };
    }
  }

  async checkPermissions(): Promise<{ hasPermissions: boolean; requiresNearbyWifi: boolean }> {
    if (!this.isAvailable()) {
      return { hasPermissions: false, requiresNearbyWifi: false };
    }
    return WifiDirectModule.checkPermissions();
  }

  async startReceiver(): Promise<boolean> {
    if (!this.isAvailable() || !this.isInitialized) {
      return false;
    }
    return WifiDirectModule.startReceiver();
  }

  async stopReceiver(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }
    return WifiDirectModule.stopReceiver();
  }

  async discoverPeers(): Promise<boolean> {
    if (!this.isAvailable()) {
      throw new Error('Wi-Fi Direct is not available on this platform');
    }
    if (!this.isInitialized) {
      throw new Error(`Wi-Fi Direct not initialized. ${this.initializationError || 'Call initialize() first.'}`);
    }
    
    try {
      return await WifiDirectModule.discoverPeers();
    } catch (error: any) {
      throw new Error(error?.message || 'Failed to discover peers');
    }
  }

  async stopDiscovery(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }
    try {
      return await WifiDirectModule.stopDiscovery();
    } catch (error) {
      console.error('Failed to stop discovery:', error);
      return false;
    }
  }

  async connect(deviceAddress: string): Promise<boolean> {
    if (!this.isAvailable()) {
      throw new Error('Wi-Fi Direct is not available on this platform');
    }
    if (!this.isInitialized) {
      throw new Error(`Wi-Fi Direct not initialized. ${this.initializationError || 'Call initialize() first.'}`);
    }
    if (!deviceAddress) {
      throw new Error('Device address is required');
    }
    
    try {
      return await WifiDirectModule.connect(deviceAddress);
    } catch (error: any) {
      throw new Error(error?.message || 'Failed to connect to device');
    }
  }

  async disconnect(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }
    return WifiDirectModule.disconnect();
  }

  async getConnectionInfo(): Promise<WifiP2pConnectionInfo | null> {
    if (!this.isAvailable()) {
      return null;
    }
    return WifiDirectModule.getConnectionInfo();
  }

  async isWifiP2pEnabled(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }
    return WifiDirectModule.isWifiP2pEnabled();
  }

  async getDiscoveredPeers(): Promise<WifiP2pDevice[]> {
    if (!this.isAvailable()) {
      return [];
    }
    return WifiDirectModule.getDiscoveredPeers();
  }

  async cleanup(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }
    try {
      const result = await WifiDirectModule.cleanup();
      this.isInitialized = false;
      this.initializationError = null;
      return result;
    } catch (error) {
      console.error('Failed to cleanup Wi-Fi Direct:', error);
      this.isInitialized = false;
      return false;
    }
  }

  onWifiDirectEvent(callback: (event: WifiDirectEvent) => void): () => void {
    if (!this.eventEmitter) {
      return () => {};
    }
    const subscription = this.eventEmitter.addListener('onWifiDirectEvent', callback);
    return () => subscription.remove();
  }

  getDeviceStatusText(status: number): string {
    switch (status) {
      case WifiP2pDeviceStatus.CONNECTED:
        return 'Connecte';
      case WifiP2pDeviceStatus.INVITED:
        return 'Invite';
      case WifiP2pDeviceStatus.FAILED:
        return 'Echec';
      case WifiP2pDeviceStatus.AVAILABLE:
        return 'Disponible';
      case WifiP2pDeviceStatus.UNAVAILABLE:
        return 'Indisponible';
      default:
        return 'Inconnu';
    }
  }
}

export const nativeWifiDirect = new NativeWifiDirectService();
export default nativeWifiDirect;
