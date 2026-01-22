import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const getHotspotModule = () => NativeModules.HotspotModule;
const getHttpServerModule = () => NativeModules.HttpServerModule;

export interface HotspotInfo {
  ssid: string;
  password: string;
  ipAddress: string;
  port: number;
  isActive: boolean;
}

export interface WifiConnectionResult {
  connected: boolean;
  ssid: string;
  ipAddress: string;
  port: number;
  warning?: string;
}

export interface FileReceivedEvent {
  fileName: string;
  filePath: string;
  fileSize: number;
}

export interface TransferProgressEvent {
  fileName: string;
  progress: number;
}

export interface ClientConnectedEvent {
  clientIp: string;
}

export interface WifiConnectionChangedEvent {
  event: 'connected' | 'disconnected';
  ssid?: string;
}

class NativeHotspotService {
  private hotspotEmitter: NativeEventEmitter | null = null;
  private httpEmitter: NativeEventEmitter | null = null;
  private moduleCheckAttempts: number = 0;
  private maxModuleCheckAttempts: number = 5;

  constructor() {
    this.initializeEmitters();
  }

  private initializeEmitters(): void {
    if (Platform.OS === 'android') {
      const HotspotModule = getHotspotModule();
      const HttpServerModule = getHttpServerModule();
      
      if (HotspotModule) {
        this.hotspotEmitter = new NativeEventEmitter(HotspotModule);
        console.log('[NativeHotspot] HotspotModule loaded successfully');
      } else {
        console.warn('[NativeHotspot] HotspotModule is NOT available at init');
      }
      if (HttpServerModule) {
        this.httpEmitter = new NativeEventEmitter(HttpServerModule);
        console.log('[NativeHotspot] HttpServerModule loaded successfully');
      } else {
        console.warn('[NativeHotspot] HttpServerModule is NOT available at init');
      }
    }
  }

  isModuleAvailable(): boolean {
    if (Platform.OS !== 'android') {
      return false;
    }
    const HotspotModule = getHotspotModule();
    const available = !!HotspotModule && !!HotspotModule.startLocalHotspot;
    console.log('[NativeHotspot] isModuleAvailable:', available, 'HotspotModule:', !!HotspotModule);
    return available;
  }

  async waitForModuleAvailable(timeoutMs: number = 5000): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return false;
    }
    
    const startTime = Date.now();
    const checkInterval = 200;
    
    while (Date.now() - startTime < timeoutMs) {
      if (this.isModuleAvailable()) {
        if (!this.hotspotEmitter) {
          this.initializeEmitters();
        }
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      this.moduleCheckAttempts++;
      console.log(`[NativeHotspot] Waiting for module... attempt ${this.moduleCheckAttempts}`);
    }
    
    console.error('[NativeHotspot] Module not available after timeout');
    return false;
  }

  isHttpModuleAvailable(): boolean {
    if (Platform.OS !== 'android') {
      return false;
    }
    const HttpServerModule = getHttpServerModule();
    return !!HttpServerModule && !!HttpServerModule.startServer;
  }

  async connectToWifi(ssid: string, password: string, ipAddress: string, port: number): Promise<WifiConnectionResult> {
    if (Platform.OS !== 'android') {
      throw new Error('WiFi connection is only available on Android');
    }
    const HotspotModule = getHotspotModule();
    if (!HotspotModule?.connectToWifi) {
      throw new Error('WiFi connection module not available. Please rebuild the app.');
    }
    return HotspotModule.connectToWifi(ssid, password, ipAddress, port);
  }

  async disconnectFromWifi(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return true;
    }
    const HotspotModule = getHotspotModule();
    if (!HotspotModule?.disconnectFromWifi) {
      return true;
    }
    return HotspotModule.disconnectFromWifi();
  }

  onWifiConnectionChanged(callback: (event: WifiConnectionChangedEvent) => void): () => void {
    if (!this.hotspotEmitter) {
      return () => {};
    }
    const subscription = this.hotspotEmitter.addListener('onWifiConnectionChanged', callback);
    return () => subscription.remove();
  }

  async startLocalHotspot(): Promise<HotspotInfo> {
    if (Platform.OS !== 'android') {
      throw new Error('Hotspot is only available on Android');
    }
    
    const moduleAvailable = await this.waitForModuleAvailable(3000);
    const HotspotModule = getHotspotModule();
    
    if (!moduleAvailable || !HotspotModule) {
      console.error('[NativeHotspot] HotspotModule is null - native module not loaded');
      throw new Error('HotspotModule not available. Please rebuild the app with: npx expo prebuild --clean && npx expo run:android');
    }
    if (!HotspotModule.startLocalHotspot) {
      console.error('[NativeHotspot] startLocalHotspot method not found on HotspotModule');
      throw new Error('startLocalHotspot method not available. Please rebuild the app.');
    }
    return HotspotModule.startLocalHotspot();
  }

  async stopLocalHotspot(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      throw new Error('Hotspot is only available on Android');
    }
    const HotspotModule = getHotspotModule();
    if (!HotspotModule?.stopLocalHotspot) {
      console.error('[NativeHotspot] HotspotModule or stopLocalHotspot not available');
      return false;
    }
    return HotspotModule.stopLocalHotspot();
  }

  async isHotspotActive(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return false;
    }
    const HotspotModule = getHotspotModule();
    if (!HotspotModule?.isHotspotActive) {
      return false;
    }
    return HotspotModule.isHotspotActive();
  }

  async getHotspotInfo(): Promise<HotspotInfo | null> {
    if (Platform.OS !== 'android') {
      return null;
    }
    const HotspotModule = getHotspotModule();
    if (!HotspotModule?.getHotspotInfo) {
      return null;
    }
    return HotspotModule.getHotspotInfo();
  }

  onHotspotStateChanged(callback: (event: { event: string }) => void): () => void {
    if (!this.hotspotEmitter) {
      return () => {};
    }
    const subscription = this.hotspotEmitter.addListener('onHotspotStateChanged', callback);
    return () => subscription.remove();
  }

  async startServer(port: number = 8080): Promise<boolean> {
    if (Platform.OS !== 'android') {
      throw new Error('HTTP Server is only available on Android');
    }
    const HttpServerModule = getHttpServerModule();
    if (!HttpServerModule?.startServer) {
      console.error('[NativeHotspot] HttpServerModule or startServer not available');
      throw new Error('HttpServerModule not available. Please rebuild the app.');
    }
    return HttpServerModule.startServer(port);
  }

  async stopServer(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      throw new Error('HTTP Server is only available on Android');
    }
    const HttpServerModule = getHttpServerModule();
    if (!HttpServerModule?.stopServer) {
      console.error('[NativeHotspot] HttpServerModule or stopServer not available');
      return false;
    }
    return HttpServerModule.stopServer();
  }

  async isServerRunning(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return false;
    }
    const HttpServerModule = getHttpServerModule();
    if (!HttpServerModule?.isServerRunning) {
      return false;
    }
    return HttpServerModule.isServerRunning();
  }

  async getDownloadDirectory(): Promise<string> {
    if (Platform.OS !== 'android') {
      throw new Error('HTTP Server is only available on Android');
    }
    const HttpServerModule = getHttpServerModule();
    if (!HttpServerModule?.getDownloadDirectory) {
      throw new Error('HttpServerModule not available. Please rebuild the app.');
    }
    return HttpServerModule.getDownloadDirectory();
  }

  onFileReceived(callback: (event: FileReceivedEvent) => void): () => void {
    if (!this.httpEmitter) {
      return () => {};
    }
    const subscription = this.httpEmitter.addListener('onFileReceived', callback);
    return () => subscription.remove();
  }

  onTransferProgress(callback: (event: TransferProgressEvent) => void): () => void {
    if (!this.httpEmitter) {
      return () => {};
    }
    const subscription = this.httpEmitter.addListener('onTransferProgress', callback);
    return () => subscription.remove();
  }

  onClientConnected(callback: (event: ClientConnectedEvent) => void): () => void {
    if (!this.httpEmitter) {
      return () => {};
    }
    const subscription = this.httpEmitter.addListener('onClientConnected', callback);
    return () => subscription.remove();
  }
}

export const nativeHotspot = new NativeHotspotService();
export default nativeHotspot;
