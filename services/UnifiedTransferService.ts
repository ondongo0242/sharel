import { Platform } from "react-native";
import WifiDirectService from "./WifiDirectService";
import MultipeerService from "./MultipeerService";
import HotspotService from "./HotspotService";
import { logger } from "./LoggerService";

export type TransferMethod = "wifidirect" | "multipeer" | "hotspot" | "auto";

export interface Peer {
  peerId: string;
  name: string;
  status: "discovered" | "connecting" | "connected" | "disconnected";
  method?: TransferMethod;
  ipAddress?: string;
  deviceAddress?: string;
}

export interface FileTransfer {
  id: string;
  fileName: string;
  fileSize: number;
  progress: number;
  status: "pending" | "transferring" | "completed" | "failed";
  peerId: string;
  method?: TransferMethod;
}

export interface TransferCapabilities {
  wifidirect: boolean;
  multipeer: boolean;
  hotspot: boolean;
}

class UnifiedTransferService {
  private currentMethod: TransferMethod = "auto";
  private capabilities: TransferCapabilities;

  private onPeersChange: ((peers: Peer[]) => void) | null = null;
  private onTransfersChange: ((transfers: FileTransfer[]) => void) | null = null;
  private onConnectionRequest: ((peerId: string, name: string) => void) | null = null;
  private onConnected: ((peerId: string) => void) | null = null;
  private onDisconnectedCallback: ((peerId: string) => void) | null = null;

  constructor() {
    this.capabilities = {
      wifidirect: WifiDirectService.isWifiDirectSupported(),
      multipeer: MultipeerService.isMultipeerSupported(),
      hotspot: HotspotService.isHotspotSupported(),
    };

    this.initializeServiceListeners();
  }

  private initializeServiceListeners() {
    WifiDirectService.setOnPeersChange((peers) => {
      if (this.currentMethod === "wifidirect" || this.currentMethod === "auto") {
        const mappedPeers: Peer[] = peers.map(p => ({
          peerId: p.peerId,
          name: p.name,
          status: p.status,
          method: "wifidirect" as TransferMethod,
          deviceAddress: p.deviceAddress,
        }));
        if (this.onPeersChange) {
          this.onPeersChange(mappedPeers);
        }
      }
    });

    WifiDirectService.setOnTransfersChange((transfers) => {
      if (this.currentMethod === "wifidirect" || this.currentMethod === "auto") {
        const mappedTransfers: FileTransfer[] = transfers.map(t => ({
          ...t,
          method: "wifidirect" as TransferMethod
        }));
        if (this.onTransfersChange) {
          this.onTransfersChange(mappedTransfers);
        }
      }
    });

    WifiDirectService.setOnConnectionRequest((peerId, name) => {
      if (this.onConnectionRequest) {
        this.onConnectionRequest(peerId, name);
      }
    });

    WifiDirectService.setOnConnected((peerId) => {
      if (this.onConnected) {
        this.onConnected(peerId);
      }
    });

    WifiDirectService.setOnDisconnected((peerId) => {
      if (this.onDisconnectedCallback) {
        this.onDisconnectedCallback(peerId);
      }
    });

    MultipeerService.setOnPeersChange((peers) => {
      if (this.currentMethod === "multipeer" || this.currentMethod === "auto") {
        const mappedPeers = peers.map(p => ({ ...p, method: "multipeer" as TransferMethod }));
        if (this.onPeersChange) {
          this.onPeersChange(mappedPeers);
        }
      }
    });

    MultipeerService.setOnTransfersChange((transfers) => {
      if (this.currentMethod === "multipeer" || this.currentMethod === "auto") {
        const mappedTransfers = transfers.map(t => ({ ...t, method: "multipeer" as TransferMethod }));
        if (this.onTransfersChange) {
          this.onTransfersChange(mappedTransfers);
        }
      }
    });

    HotspotService.setOnPeersChange((peers) => {
      if (this.currentMethod === "hotspot" || this.currentMethod === "auto") {
        const mappedPeers = peers.map(p => ({ ...p, method: "hotspot" as TransferMethod }));
        if (this.onPeersChange) {
          this.onPeersChange(mappedPeers);
        }
      }
    });

    HotspotService.setOnTransfersChange((transfers) => {
      if (this.currentMethod === "hotspot" || this.currentMethod === "auto") {
        const mappedTransfers = transfers.map(t => ({ ...t, method: "hotspot" as TransferMethod }));
        if (this.onTransfersChange) {
          this.onTransfersChange(mappedTransfers);
        }
      }
    });
  }

  selectBestMethod(forcedMethod?: TransferMethod): TransferMethod {
    if (forcedMethod && forcedMethod !== "auto") {
      if (forcedMethod === "wifidirect" && this.capabilities.wifidirect) {
        console.log("Using forced method: wifidirect");
        return forcedMethod;
      } else if (forcedMethod === "multipeer" && this.capabilities.multipeer) {
        console.log("Using forced method: multipeer");
        return forcedMethod;
      } else if (forcedMethod === "hotspot" && this.capabilities.hotspot) {
        console.log("Using forced method: hotspot");
        return forcedMethod;
      }
      console.log("Forced method " + forcedMethod + " not available, falling back...");
    }

    if (Platform.OS === "android") {
      if (this.capabilities.hotspot) {
        console.log("Android: selecting Hotspot method (default)");
        return "hotspot";
      } else if (this.capabilities.wifidirect) {
        console.log("Android: Hotspot not available, falling back to Wi-Fi Direct");
        return "wifidirect";
      } else {
        console.log("Android: No method available, defaulting to hotspot");
        return "hotspot";
      }
    } else if (Platform.OS === "ios") {
      if (this.capabilities.multipeer) {
        console.log("iOS: selecting multipeer method");
        return "multipeer";
      } else {
        console.log("iOS: multipeer not supported, falling back to hotspot");
        return "hotspot";
      }
    } else if (this.capabilities.hotspot) {
      console.log("Other platform: selecting hotspot method");
      return "hotspot";
    }

    console.log("No method available, defaulting to hotspot");
    return "hotspot";
  }
  
  refreshCapabilities(): void {
    this.capabilities = {
      wifidirect: WifiDirectService.isWifiDirectSupported(),
      multipeer: MultipeerService.isMultipeerSupported(),
      hotspot: HotspotService.isHotspotSupported(),
    };
    console.log("Transfer capabilities refreshed:", this.capabilities);
  }
  
  getMethodAvailabilityReport(): string {
    const reports: string[] = [];
    
    if (Platform.OS === "android") {
      if (this.capabilities.wifidirect) {
        reports.push("Wi-Fi Direct: Disponible - Transfert sans limite de taille");
      } else {
        reports.push("Wi-Fi Direct: Non disponible (module manquant ou permissions refusees)");
      }
    }
    
    if (Platform.OS === "ios") {
      if (this.capabilities.multipeer) {
        reports.push("Multipeer Connectivity: Disponible");
      } else {
        reports.push("Multipeer Connectivity: Non disponible");
      }
    }
    
    if (this.capabilities.hotspot) {
      reports.push("Hotspot: Disponible");
    } else {
      reports.push("Hotspot: Non disponible");
    }
    
    return reports.join("\n");
  }

  async initialize(): Promise<boolean> {
    if (Platform.OS === "android") {
      try {
        return await WifiDirectService.initialize();
      } catch (error: any) {
        logger.error('Connection', 'Failed to initialize Wi-Fi Direct', { error: error?.message || String(error) });
        throw error;
      }
    }
    return true;
  }

  async startAdvertising(deviceName: string, method?: TransferMethod): Promise<string> {
    const selectedMethod = this.selectBestMethod(method);
    this.currentMethod = selectedMethod;

    logger.logConnectionEvent('Starting advertising', undefined, deviceName, { method: selectedMethod });

    try {
      switch (selectedMethod) {
        case "wifidirect":
          await WifiDirectService.initialize();
          const wifiDirectAddress = await WifiDirectService.createGroup();
          logger.logConnectionEvent('Wi-Fi Direct group created', wifiDirectAddress, deviceName, { method: 'wifidirect' });
          return wifiDirectAddress;
        case "multipeer":
          const multiId = await MultipeerService.startAdvertising(deviceName);
          logger.logConnectionEvent('Advertising started', multiId, deviceName, { method: 'multipeer' });
          return multiId;
        case "hotspot":
          const info = await HotspotService.startHotspot(deviceName);
          logger.logConnectionEvent('Hotspot started', info.ipAddress, deviceName, { ssid: info.ssid, password: info.password });
          return info.ipAddress;
        default:
          throw new Error(`Unsupported method: ${selectedMethod}`);
      }
    } catch (error) {
      logger.error('Connection', 'Failed to start advertising', { error, method: selectedMethod, deviceName });
      throw error;
    }
  }

  async stopAdvertising(): Promise<void> {
    switch (this.currentMethod) {
      case "wifidirect":
        await WifiDirectService.removeGroup();
        break;
      case "multipeer":
        await MultipeerService.stopAdvertising();
        break;
      case "hotspot":
        await HotspotService.stopHotspot();
        break;
    }
  }

  async startDiscovering(deviceName: string, method?: TransferMethod): Promise<string> {
    const selectedMethod = this.selectBestMethod(method);
    this.currentMethod = selectedMethod;

    logger.logConnectionEvent('Starting discovery', undefined, deviceName, { method: selectedMethod });

    try {
      switch (selectedMethod) {
        case "wifidirect":
          await WifiDirectService.initialize();
          const wifiDirectId = await WifiDirectService.startDiscovering();
          logger.logConnectionEvent('Wi-Fi Direct discovery started', wifiDirectId, deviceName, { method: 'wifidirect' });
          return wifiDirectId;
        case "multipeer":
          const multiId = await MultipeerService.startDiscovering(deviceName);
          logger.logConnectionEvent('Discovery started', multiId, deviceName, { method: 'multipeer' });
          return multiId;
        case "hotspot":
          throw new Error("Hotspot discovery requires manual connection. Use connectToHotspot instead.");
        default:
          throw new Error(`Unsupported method: ${selectedMethod}`);
      }
    } catch (error) {
      logger.error('Connection', 'Failed to start discovery', { error, method: selectedMethod, deviceName });
      throw error;
    }
  }

  async stopDiscovering(): Promise<void> {
    switch (this.currentMethod) {
      case "wifidirect":
        await WifiDirectService.stopDiscovering();
        break;
      case "multipeer":
        await MultipeerService.stopDiscovering();
        break;
      case "hotspot":
        await HotspotService.disconnectFromHotspot();
        break;
    }
  }

  async connectToPeer(peerId: string): Promise<void> {
    switch (this.currentMethod) {
      case "wifidirect":
        await WifiDirectService.connectToPeer(peerId);
        break;
      case "multipeer":
        await MultipeerService.connectToPeer(peerId);
        break;
      case "hotspot":
        throw new Error("Hotspot connections are established differently. Use connectToHotspot instead.");
    }
  }

  async acceptConnectionFrom(peerId: string): Promise<void> {
    switch (this.currentMethod) {
      case "wifidirect":
        break;
      case "multipeer":
        await MultipeerService.acceptConnectionFrom(peerId);
        break;
      case "hotspot":
        break;
    }
  }

  async rejectConnectionFrom(peerId: string): Promise<void> {
    switch (this.currentMethod) {
      case "wifidirect":
        break;
      case "multipeer":
        await MultipeerService.rejectConnectionFrom(peerId);
        break;
      case "hotspot":
        break;
    }
  }

  async disconnectFrom(peerId: string): Promise<void> {
    switch (this.currentMethod) {
      case "wifidirect":
        await WifiDirectService.disconnect();
        break;
      case "multipeer":
        await MultipeerService.disconnectFrom(peerId);
        break;
      case "hotspot":
        await HotspotService.disconnectFromHotspot();
        break;
    }
  }

  async sendFile(
    peerId: string,
    fileName: string,
    fileSize: number,
    fileUri: string
  ): Promise<void> {
    const transferId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    logger.logTransferStart(transferId, [{ name: fileName, size: fileSize }], peerId);
    
    try {
      switch (this.currentMethod) {
        case "wifidirect":
          await WifiDirectService.sendFile(peerId, fileName, fileSize, fileUri);
          break;
        case "multipeer":
          await MultipeerService.sendFile(peerId, fileName, fileSize, fileUri);
          break;
        case "hotspot":
          await HotspotService.sendFile(peerId, fileName, fileSize, fileUri);
          break;
        default:
          throw new Error(`No active transfer method`);
      }
      
      const duration = Date.now() - startTime;
      logger.logTransferComplete(transferId, 1, fileSize, duration);
    } catch (error) {
      logger.logTransferError(transferId, error instanceof Error ? error : new Error(String(error)), {
        method: this.currentMethod,
        peerId,
        fileName,
        fileSize,
      });
      throw error;
    }
  }

  async receiveFile(): Promise<string | null> {
    if (this.currentMethod === "wifidirect") {
      return await WifiDirectService.receiveFile();
    }
    return null;
  }

  async connectToHotspot(ssid: string, password: string, ipAddress: string): Promise<string> {
    this.currentMethod = "hotspot";
    return await HotspotService.connectToHotspot(ssid, password, ipAddress);
  }

  async connectWithPayload(payload: {
    method: TransferMethod;
    peerId: string;
    name: string;
    platform?: string;
    ssid?: string;
    password?: string;
    ip?: string;
    port?: number;
    deviceAddress?: string;
  }, deviceName: string): Promise<{ success: boolean; peerId: string; peerName: string }> {
    const { method, peerId, name: peerName, ssid, password, ip, deviceAddress } = payload;
    
    logger.logConnectionEvent('Connecting with payload', peerId, deviceName, { method, peerName, deviceAddress });
    
    this.currentMethod = method === "auto" ? this.selectBestMethod() : method;
    
    try {
      if (method === "hotspot" && ssid && password && ip) {
        const port = payload.port || 8080;
        await HotspotService.connectToHotspot(ssid, password, ip, port);
        logger.logConnectionEvent('Connected via hotspot', peerId, deviceName, { ssid, ip, port });
        return { success: true, peerId: `hotspot_${ssid}_${Date.now()}`, peerName: peerName || ssid };
      }
      
      switch (this.currentMethod) {
        case "wifidirect":
          await WifiDirectService.initialize();
          
          const maxRetries = 8;
          const retryDelay = 2000;
          
          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            logger.logConnectionEvent('Discovery attempt', undefined, deviceName, { attempt, maxRetries, targetAddress: deviceAddress });
            
            try {
              await WifiDirectService.stopDiscovering();
            } catch (e) {
              console.log("Stop discovery before retry:", e);
            }
            
            await WifiDirectService.startDiscovering();
            
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            
            const peers = WifiDirectService.getPeers();
            console.log(`Discovery attempt ${attempt}: Found ${peers.length} peers:`, peers.map(p => ({ name: p.name, addr: p.deviceAddress })));
            
            const normalizeAddress = (addr: string) => addr?.toLowerCase().replace(/[:-]/g, '');
            const targetPeer = peers.find(p => {
              const peerAddr = normalizeAddress(p.deviceAddress);
              const peerIdNorm = normalizeAddress(p.peerId);
              const targetAddr = normalizeAddress(deviceAddress || '');
              const targetPeerId = normalizeAddress(peerId || '');
              
              return (
                (targetAddr && peerAddr && peerAddr === targetAddr) ||
                (targetAddr && peerIdNorm && peerIdNorm === targetAddr) ||
                (targetPeerId && peerIdNorm && peerIdNorm === targetPeerId) ||
                (targetPeerId && peerAddr && peerAddr === targetPeerId) ||
                p.name.toLowerCase().includes(peerName.toLowerCase()) ||
                peerName.toLowerCase().includes(p.name.toLowerCase())
              );
            });
            
            if (targetPeer) {
              logger.logConnectionEvent('Peer found, connecting', targetPeer.peerId, deviceName, { peerName: targetPeer.name, deviceAddress: targetPeer.deviceAddress });
              await WifiDirectService.connectToPeer(targetPeer.peerId);
              return { success: true, peerId: targetPeer.peerId, peerName: targetPeer.name };
            }
            
            if (attempt < maxRetries) {
              logger.logConnectionEvent('Peer not found, retrying', undefined, deviceName, { attempt, peersFound: peers.length });
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
          
          throw new Error(`Appareil "${peerName}" non trouve apres ${maxRetries} tentatives. Verifiez que le Wi-Fi et la localisation sont actives sur les deux appareils.`);
          
        case "multipeer":
          await MultipeerService.startDiscovering(deviceName);
          
          for (let attempt = 1; attempt <= 5; attempt++) {
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            const peers = MultipeerService.getPeers();
            const targetPeer = peers.find(p => p.peerId === peerId || p.name === peerName);
            
            if (targetPeer) {
              await MultipeerService.connectToPeer(targetPeer.peerId);
              return { success: true, peerId: targetPeer.peerId, peerName: targetPeer.name };
            }
          }
          
          throw new Error(`Peer ${peerName} not found`);
          
        default:
          throw new Error(`Unsupported method: ${this.currentMethod}`);
      }
    } catch (error) {
      logger.error('Connection', 'Failed to connect with payload', { error, method, peerId, peerName });
      throw error;
    }
  }

  getHotspotInfo() {
    return HotspotService.getHotspotInfo();
  }

  getWifiDirectConnectionInfo() {
    return WifiDirectService.getConnectionInfo();
  }

  isWifiDirectConnected(): boolean {
    return WifiDirectService.isConnected();
  }

  isWifiDirectGroupOwner(): boolean {
    return WifiDirectService.isGroupOwner();
  }

  getCurrentMethod(): TransferMethod {
    return this.currentMethod;
  }

  getCapabilities(): TransferCapabilities {
    return { ...this.capabilities };
  }

  getPeers(): Peer[] {
    switch (this.currentMethod) {
      case "wifidirect":
        return WifiDirectService.getPeers().map(p => ({
          peerId: p.peerId,
          name: p.name,
          status: p.status,
          method: "wifidirect" as TransferMethod,
          deviceAddress: p.deviceAddress,
        }));
      case "multipeer":
        return MultipeerService.getPeers().map(p => ({ ...p, method: "multipeer" as TransferMethod }));
      case "hotspot":
        return HotspotService.getPeers().map(p => ({ ...p, method: "hotspot" as TransferMethod }));
      default:
        return [];
    }
  }

  getConnectedPeers(): Peer[] {
    return this.getPeers().filter(p => p.status === "connected");
  }

  getMyPeerId(): string | null {
    switch (this.currentMethod) {
      case "wifidirect":
        return WifiDirectService.getMyPeerId();
      case "multipeer":
        return MultipeerService.getMyPeerId();
      case "hotspot":
        return HotspotService.getMyPeerId();
      default:
        return null;
    }
  }

  setOnPeersChange(callback: (peers: Peer[]) => void) {
    this.onPeersChange = callback;
  }

  setOnTransfersChange(callback: (transfers: FileTransfer[]) => void) {
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

  setCurrentMethod(method: TransferMethod) {
    this.currentMethod = method;
    console.log(`Transfer method set to: ${method}`);
  }

  cleanup() {
    WifiDirectService.cleanup();
    MultipeerService.cleanup();
    HotspotService.cleanup();
  }
}

export default new UnifiedTransferService();
