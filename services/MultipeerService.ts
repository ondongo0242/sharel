import { Platform } from "react-native";
import * as FileSystem from "expo-file-system";

export interface Peer {
  peerId: string;
  name: string;
  status: "discovered" | "connecting" | "connected" | "disconnected";
}

export interface FileTransfer {
  id: string;
  fileName: string;
  fileSize: number;
  progress: number;
  status: "pending" | "transferring" | "completed" | "failed";
  peerId: string;
}

interface FileChunkData {
  type: "file_start" | "file_chunk" | "file_complete";
  fileId: string;
  fileName?: string;
  fileSize?: number;
  totalChunks?: number;
  chunkIndex?: number;
  data?: string;
}

interface ReceivingFile {
  fileName: string;
  fileSize: number;
  totalChunks: number;
  receivedChunks: Map<number, string>;
  transfer: FileTransfer;
}

const CHUNK_SIZE = 30000;
const SERVICE_TYPE = "shareit-transfer";

class MultipeerService {
  private myPeerId: string | null = null;
  private peers: Map<string, Peer> = new Map();
  private transfers: Map<string, FileTransfer> = new Map();
  private receivingFiles: Map<string, ReceivingFile> = new Map();
  private isSupported: boolean = Platform.OS === "ios";

  private onPeersChange: ((peers: Peer[]) => void) | null = null;
  private onTransfersChange: ((transfers: FileTransfer[]) => void) | null = null;
  private onConnectionRequest: ((peerId: string, name: string) => void) | null = null;
  private onConnected: ((peerId: string) => void) | null = null;
  private onDisconnectedCallback: ((peerId: string) => void) | null = null;

  constructor() {
    if (!this.isSupported) {
      console.warn("MultipeerService is only available on iOS");
    }
  }

  async startAdvertising(deviceName: string): Promise<string> {
    if (!this.isSupported) {
      throw new Error("Multipeer Connectivity not available on this platform");
    }
    
    console.warn("MultipeerService.startAdvertising - Not implemented yet (requires native module)");
    
    const peerId = `ios-${Date.now()}`;
    this.myPeerId = peerId;
    return peerId;
  }

  async stopAdvertising(): Promise<void> {
    if (!this.isSupported) return;
    
    console.warn("MultipeerService.stopAdvertising - Not implemented yet");
  }

  async startDiscovering(deviceName: string): Promise<string> {
    if (!this.isSupported) {
      throw new Error("Multipeer Connectivity not available on this platform");
    }
    
    console.warn("MultipeerService.startDiscovering - Not implemented yet (requires native module)");
    
    const peerId = `ios-${Date.now()}`;
    this.myPeerId = peerId;
    return peerId;
  }

  async stopDiscovering(): Promise<void> {
    if (!this.isSupported) return;
    
    console.warn("MultipeerService.stopDiscovering - Not implemented yet");
  }

  async connectToPeer(peerId: string): Promise<void> {
    if (!this.isSupported) {
      throw new Error("Multipeer Connectivity not available on this platform");
    }
    
    console.warn("MultipeerService.connectToPeer - Not implemented yet");
  }

  async acceptConnectionFrom(peerId: string): Promise<void> {
    if (!this.isSupported) {
      throw new Error("Multipeer Connectivity not available on this platform");
    }
    
    console.warn("MultipeerService.acceptConnectionFrom - Not implemented yet");
  }

  async rejectConnectionFrom(peerId: string): Promise<void> {
    if (!this.isSupported) return;
    
    console.warn("MultipeerService.rejectConnectionFrom - Not implemented yet");
  }

  async disconnectFrom(peerId: string): Promise<void> {
    if (!this.isSupported) return;
    
    console.warn("MultipeerService.disconnectFrom - Not implemented yet");
  }

  async sendMessage(peerId: string, message: string): Promise<void> {
    if (!this.isSupported) {
      throw new Error("Multipeer Connectivity not available on this platform");
    }
    
    console.warn("MultipeerService.sendMessage - Not implemented yet");
  }

  async sendFile(
    peerId: string,
    fileName: string,
    fileSize: number,
    fileUri: string
  ): Promise<void> {
    if (!this.isSupported) {
      throw new Error("Multipeer Connectivity not available on this platform");
    }
    
    console.warn("MultipeerService.sendFile - Not implemented yet (requires native module)");
    
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

  isMultipeerSupported(): boolean {
    return this.isSupported;
  }

  cleanup() {
    this.peers.clear();
    this.transfers.clear();
    this.receivingFiles.clear();
    this.myPeerId = null;
  }
}

export default new MultipeerService();
