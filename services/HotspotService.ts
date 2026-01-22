import { Platform } from "react-native";
import * as FileSystem from "expo-file-system";
import * as Location from "expo-location";
import nativeHotspot, { HotspotInfo as NativeHotspotInfo } from "./NativeHotspot";
import { logger } from "./LoggerService";

export interface Peer {
  peerId: string;
  name: string;
  status: "discovered" | "connecting" | "connected" | "disconnected";
  ipAddress?: string;
}

export interface FileTransfer {
  id: string;
  fileName: string;
  fileSize: number;
  progress: number;
  status: "pending" | "transferring" | "completed" | "failed";
  peerId: string;
}

export interface HotspotInfo {
  ssid: string;
  password: string;
  ipAddress: string;
  port: number;
  qrCode?: string;
}

const DEFAULT_PORT = 8080;

class HotspotService {
  private myPeerId: string | null = null;
  private peers: Map<string, Peer> = new Map();
  private transfers: Map<string, FileTransfer> = new Map();
  private hotspotInfo: HotspotInfo | null = null;
  private isServerRunning: boolean = false;
  private subscriptions: (() => void)[] = [];

  private onPeersChange: ((peers: Peer[]) => void) | null = null;
  private onTransfersChange: ((transfers: FileTransfer[]) => void) | null = null;
  private onConnectionRequest: ((peerId: string, name: string) => void) | null = null;
  private onConnected: ((peerId: string) => void) | null = null;
  private onDisconnectedCallback: ((peerId: string) => void) | null = null;
  private onFileReceivedCallback: ((fileName: string, filePath: string, fileSize: number) => void) | null = null;

  constructor() {
    if (Platform.OS === "android") {
      this.setupNativeListeners();
    }
  }

  private setupNativeListeners() {
    const hotspotUnsub = nativeHotspot.onHotspotStateChanged((event) => {
      console.log("Hotspot state changed:", event);
      if (event.event === "stopped") {
        this.hotspotInfo = null;
        this.isServerRunning = false;
      }
    });
    this.subscriptions.push(hotspotUnsub);

    const fileReceivedUnsub = nativeHotspot.onFileReceived((event) => {
      console.log("File received:", event);
      if (this.onFileReceivedCallback) {
        this.onFileReceivedCallback(event.fileName, event.filePath, event.fileSize);
      }

      const transfer: FileTransfer = {
        id: `received-${Date.now()}`,
        fileName: event.fileName,
        fileSize: event.fileSize,
        progress: 100,
        status: "completed",
        peerId: "remote",
      };
      this.transfers.set(transfer.id, transfer);
      this.notifyTransfersChange();
    });
    this.subscriptions.push(fileReceivedUnsub);

    const progressUnsub = nativeHotspot.onTransferProgress((event) => {
      console.log("Transfer progress:", event);
    });
    this.subscriptions.push(progressUnsub);

    const clientUnsub = nativeHotspot.onClientConnected((event) => {
      console.log("Client connected:", event);
      const peerId = `client-${event.clientIp}`;
      const peer: Peer = {
        peerId,
        name: event.clientIp,
        status: "connected",
        ipAddress: event.clientIp,
      };
      this.peers.set(peerId, peer);
      this.notifyPeersChange();

      if (this.onConnected) {
        this.onConnected(peerId);
      }
    });
    this.subscriptions.push(clientUnsub);
  }

  async requestRequiredPermissions(): Promise<boolean> {
    if (Platform.OS !== "android") {
      return true;
    }

    try {
      const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
      
      if (locationStatus !== "granted") {
        console.warn("Location permission denied - required for hotspot");
        return false;
      }
      
      return true;
    } catch (error) {
      console.error("Error requesting permissions:", error);
      return false;
    }
  }

  async startHotspot(deviceName: string): Promise<HotspotInfo> {
    logger.info("Hotspot", `START [${deviceName}] platform=${Platform.OS}`);
    
    if (Platform.OS === "web") {
      throw new Error("Hotspot not available on web");
    }

    if (Platform.OS !== "android") {
      throw new Error("Hotspot available on Android only");
    }

    try {
      logger.debug("Hotspot", "Requesting location permission...");
      const permissionsGranted = await this.requestRequiredPermissions();
      
      if (!permissionsGranted) {
        throw new Error("Location permission required for hotspot");
      }

      logger.debug("Hotspot", "Calling native startLocalHotspot");
      const result = await nativeHotspot.startLocalHotspot();
      
      this.hotspotInfo = {
        ssid: result.ssid || `SHAREL_${deviceName}`,
        password: result.password || "",
        ipAddress: result.ipAddress || "192.168.43.1",
        port: DEFAULT_PORT,
      };

      this.myPeerId = `hotspot-${Date.now()}`;
      
      logger.info("Hotspot", "Native hotspot started", { 
        ssid: this.hotspotInfo.ssid,
        ipAddress: this.hotspotInfo.ipAddress,
        port: DEFAULT_PORT
      });

      await this.startHttpServer();
      logger.info("Hotspot", "HTTP server started successfully");
      
      return this.hotspotInfo;
    } catch (error: any) {
      logger.error("Hotspot", "START FAILED", error, {
        deviceName,
        platform: Platform.OS,
        nativeAvailable: !!nativeHotspot
      });
      throw error;
    }
  }

  async stopHotspot(): Promise<void> {
    if (Platform.OS !== "android") {
      this.hotspotInfo = null;
      this.myPeerId = null;
      this.peers.clear();
      this.notifyPeersChange();
      return;
    }

    try {
      await this.stopHttpServer();
      await nativeHotspot.stopLocalHotspot();
      
      this.hotspotInfo = null;
      this.myPeerId = null;
      this.peers.clear();
      this.notifyPeersChange();
    } catch (error) {
      console.error("Error stopping hotspot:", error);
    }
  }

  private connectedPort: number = DEFAULT_PORT;

  async connectToWifi(ssid: string, password: string, ipAddress: string, port: number = DEFAULT_PORT): Promise<{ connected: boolean }> {
    logger.debug("Hotspot", `CONNECT attempt ssid=${ssid} ip=${ipAddress}:${port}`);
    
    if (Platform.OS === "web") {
      throw new Error("Hotspot not available on web");
    }

    // On tente plusieurs fois car le hotspot peut mettre quelques secondes à devenir visible
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        attempts++;
        logger.info("Hotspot", `Connection attempt ${attempts}/${maxAttempts} for ${ssid}`);
        
        const result = await nativeHotspot.connectToWifi(ssid, password || "", ipAddress, port);
        
        if (result.connected) {
          const peerId = `server-${ipAddress}`;
          const peer: Peer = {
            peerId,
            name: ssid,
            status: "connected",
            ipAddress: ipAddress,
          };
          
          this.peers.set(peer.peerId, peer);
          this.notifyPeersChange();
          
          if (this.onConnected) {
            this.onConnected(peerId);
          }
          
          logger.info("Hotspot", "CONNECTED SUCCESS", { ssid, ip: ipAddress, port });
          return result;
        }
        
        logger.warn("Hotspot", `Attempt ${attempts} failed, retrying in 2s...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error: any) {
        logger.error("Hotspot", `Error during attempt ${attempts}`, error);
        if (attempts >= maxAttempts) throw error;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    return { connected: false };
  }

  getConnectedPort(): number {
    return this.connectedPort;
  }

  async disconnectFromHotspot(): Promise<void> {
    this.peers.clear();
    this.notifyPeersChange();
  }

  async sendFile(
    peerId: string,
    fileName: string,
    fileSize: number,
    fileUri: string
  ): Promise<void> {
    console.log("[HotspotService] Sending file:", fileName, "to:", peerId);

    const fileId = `file-${Date.now()}-${Math.random()}`;
    
    const transfer: FileTransfer = {
      id: fileId,
      fileName,
      fileSize,
      progress: 0,
      status: "transferring",
      peerId,
    };
    
    this.transfers.set(fileId, transfer);
    this.notifyTransfersChange();

    const peer = this.peers.get(peerId);
    if (!peer || !peer.ipAddress) {
      throw new Error("Peer not found or no IP address");
    }

    try {
      const serverUrl = `http://${peer.ipAddress}:${DEFAULT_PORT}/upload`;
      
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (!fileInfo.exists) {
        throw new Error("File does not exist");
      }

      const formData = new FormData();
      formData.append("filename", fileName);
      formData.append("file", {
        uri: fileUri,
        name: fileName,
        type: "application/octet-stream",
      } as any);

      const response = await fetch(serverUrl, {
        method: "POST",
        body: formData,
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.ok) {
        transfer.status = "completed";
        transfer.progress = 100;
      } else {
        throw new Error(`Upload failed with status ${response.status}`);
      }
      
      this.transfers.set(fileId, transfer);
      this.notifyTransfersChange();
    } catch (error: any) {
      console.error("Error sending file via hotspot:", error);
      transfer.status = "failed";
      this.transfers.set(fileId, transfer);
      this.notifyTransfersChange();
      throw error;
    }
  }

  private async startHttpServer(): Promise<void> {
    if (Platform.OS !== "android") {
      return;
    }

    try {
      await nativeHotspot.startServer(DEFAULT_PORT);
      this.isServerRunning = true;
      console.log("HTTP Server started on port", DEFAULT_PORT);
    } catch (error) {
      console.error("Failed to start HTTP server:", error);
      throw error;
    }
  }

  private async stopHttpServer(): Promise<void> {
    if (Platform.OS !== "android") {
      this.isServerRunning = false;
      return;
    }

    try {
      await nativeHotspot.stopServer();
      this.isServerRunning = false;
      console.log("HTTP Server stopped");
    } catch (error) {
      console.error("Failed to stop HTTP server:", error);
    }
  }

  async discoverHotspotServers(): Promise<Array<{ ssid: string; ip: string; port: number }>> {
    const discoveredServers: Array<{ ssid: string; ip: string; port: number }> = [];
    const standardHotspotIPs = ["192.168.43.1", "192.168.0.1", "10.0.0.1"];
    const port = DEFAULT_PORT;
    
    logger.debug("Hotspot", "Discovering hotspot servers...", { ips: standardHotspotIPs });
    
    for (const ip of standardHotspotIPs) {
      try {
        const response = await Promise.race([
          fetch(`http://${ip}:${port}/discover`, { method: "GET" }),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 2000))
        ]);
        
        if (response?.ok) {
          const data = await response.json();
          if (data.ssid && data.ip) {
            discoveredServers.push({
              ssid: data.ssid,
              ip: data.ip,
              port: data.port || port
            });
            logger.info("Hotspot", "Server discovered", { ssid: data.ssid, ip: data.ip });
          }
        }
      } catch (error) {
        logger.trace("Hotspot", `No server at ${ip}`);
      }
    }
    
    return discoveredServers;
  }

  async generateQRCode(info: HotspotInfo): Promise<string> {
    const data = JSON.stringify({
      ssid: info.ssid,
      password: info.password,
      ip: info.ipAddress,
      port: info.port,
      type: "sharel_hotspot",
      v: 1
    });
    
    return data;
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

  setOnFileReceived(callback: (fileName: string, filePath: string, fileSize: number) => void) {
    this.onFileReceivedCallback = callback;
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

  getPeers(): Peer[] {
    return Array.from(this.peers.values());
  }

  getConnectedPeers(): Peer[] {
    return Array.from(this.peers.values()).filter((p) => p.status === "connected");
  }

  getMyPeerId(): string | null {
    return this.myPeerId;
  }

  getHotspotInfo(): HotspotInfo | null {
    return this.hotspotInfo;
  }

  isHotspotSupported(): boolean {
    if (Platform.OS !== "android") {
      return false;
    }
    const moduleAvailable = nativeHotspot.isModuleAvailable();
    console.log("[HotspotService] isHotspotSupported check - moduleAvailable:", moduleAvailable);
    return Platform.OS === "android";
  }

  async waitForHotspotReady(timeoutMs: number = 5000): Promise<boolean> {
    if (Platform.OS !== "android") {
      return false;
    }
    return nativeHotspot.waitForModuleAvailable(timeoutMs);
  }

  isHotspotActive(): boolean {
    return this.hotspotInfo !== null && this.isServerRunning;
  }

  cleanup() {
    this.subscriptions.forEach(unsub => unsub());
    this.subscriptions = [];
    this.peers.clear();
    this.transfers.clear();
    this.hotspotInfo = null;
    this.myPeerId = null;
    this.isServerRunning = false;
  }
}

export default new HotspotService();
