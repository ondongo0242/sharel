import { Platform } from "react-native";
import * as FileSystem from "expo-file-system";

let nearbyConnections: any = null;

if (Platform.OS !== "web") {
  try {
    nearbyConnections = require("expo-nearby-connections");
  } catch (error) {
    console.warn("expo-nearby-connections not available");
  }
}

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
const SERVICE_ID = "SHAREIT_P2P";

class NearbyConnectionsService {
  private myPeerId: string | null = null;
  private peers: Map<string, Peer> = new Map();
  private transfers: Map<string, FileTransfer> = new Map();
  private receivingFiles: Map<string, ReceivingFile> = new Map();
  private listeners: Array<() => void> = [];
  private isSupported: boolean = Platform.OS !== "web" && nearbyConnections !== null;
  private listenersInitialized: boolean = false;

  private onPeersChange: ((peers: Peer[]) => void) | null = null;
  private onTransfersChange: ((transfers: FileTransfer[]) => void) | null = null;
  private onConnectionRequest: ((peerId: string, name: string) => void) | null = null;
  private onConnected: ((peerId: string) => void) | null = null;
  private onDisconnectedCallback: ((peerId: string) => void) | null = null;

  constructor() {
  }

  private ensureListenersInitialized() {
    if (this.listenersInitialized) return;
    this.initializeListeners();
  }

  private initializeListeners() {
    if (!this.isSupported || !nearbyConnections || this.listenersInitialized) return;

    try {
      if (
        typeof nearbyConnections.onPeerFound !== 'function' ||
        typeof nearbyConnections.onPeerLost !== 'function' ||
        typeof nearbyConnections.onInvitationReceived !== 'function' ||
        typeof nearbyConnections.onConnectionResult !== 'function' ||
        typeof nearbyConnections.onDisconnected !== 'function' ||
        typeof nearbyConnections.onTextReceived !== 'function'
      ) {
        console.warn("NearbyConnections listener methods are not available");
        return;
      }

      const peerFoundListener = nearbyConnections.onPeerFound(({ peerId, name }: any) => {
      console.log(`Peer found: ${name} (${peerId})`);
      this.peers.set(peerId, {
        peerId,
        name,
        status: "discovered",
      });
      this.notifyPeersChange();
    });

    const peerLostListener = nearbyConnections.onPeerLost(({ peerId }: any) => {
      console.log(`Peer lost: ${peerId}`);
      this.peers.delete(peerId);
      this.notifyPeersChange();
    });

    const invitationListener = nearbyConnections.onInvitationReceived(({ peerId, name }: any) => {
      console.log(`Invitation received from ${name} (${peerId})`);
      this.peers.set(peerId, {
        peerId,
        name,
        status: "connecting",
      });
      this.notifyPeersChange();
      
      if (this.onConnectionRequest) {
        this.onConnectionRequest(peerId, name);
      }
    });

    const connectionResultListener = nearbyConnections.onConnectionResult(({ peerId, status }: any) => {
      console.log(`Connection result for ${peerId}: ${status}`);
      const peer = this.peers.get(peerId);
      if (peer) {
        peer.status = status === "CONNECTED" ? "connected" : "disconnected";
        this.notifyPeersChange();
        
        if (status === "CONNECTED" && this.onConnected) {
          this.onConnected(peerId);
        }
      }
    });

    const disconnectedListener = nearbyConnections.onDisconnected(({ peerId }: any) => {
      console.log(`Disconnected from ${peerId}`);
      const peer = this.peers.get(peerId);
      if (peer) {
        peer.status = "disconnected";
        this.notifyPeersChange();
      }
      
      if (this.onDisconnectedCallback) {
        this.onDisconnectedCallback(peerId);
      }
    });

    const textReceivedListener = nearbyConnections.onTextReceived(({ peerId, text }: any) => {
      try {
        const data: FileChunkData = JSON.parse(text);
        this.handleFileChunk(peerId, data);
      } catch (error) {
        console.error("Error parsing received text:", error);
      }
    });

      this.listeners.push(
        peerFoundListener,
        peerLostListener,
        invitationListener,
        connectionResultListener,
        disconnectedListener,
        textReceivedListener
      );

      this.listenersInitialized = true;
      console.log("NearbyConnections listeners initialized successfully");
    } catch (error) {
      console.error("Error initializing NearbyConnections listeners:", error);
    }
  }

  private handleFileChunk(peerId: string, data: FileChunkData) {
    const { type, fileId } = data;

    if (type === "file_start") {
      const { fileName, fileSize, totalChunks } = data;
      if (!fileName || !fileSize || !totalChunks) return;

      const transfer: FileTransfer = {
        id: fileId,
        fileName,
        fileSize,
        progress: 0,
        status: "transferring",
        peerId,
      };

      this.receivingFiles.set(fileId, {
        fileName,
        fileSize,
        totalChunks,
        receivedChunks: new Map(),
        transfer,
      });

      this.transfers.set(fileId, transfer);
      this.notifyTransfersChange();
    } else if (type === "file_chunk") {
      const { chunkIndex, data: chunkData } = data;
      const receivingFile = this.receivingFiles.get(fileId);
      
      if (!receivingFile || chunkIndex === undefined || !chunkData) return;

      receivingFile.receivedChunks.set(chunkIndex, chunkData);
      
      const progress = (receivingFile.receivedChunks.size / receivingFile.totalChunks) * 100;
      receivingFile.transfer.progress = progress;
      
      this.transfers.set(fileId, receivingFile.transfer);
      this.notifyTransfersChange();
    } else if (type === "file_complete") {
      const receivingFile = this.receivingFiles.get(fileId);
      if (!receivingFile) return;

      this.saveReceivedFile(fileId, receivingFile);
    }
  }

  private async saveReceivedFile(fileId: string, receivingFile: ReceivingFile) {
    try {
      const chunks: string[] = [];
      for (let i = 0; i < receivingFile.totalChunks; i++) {
        const chunk = receivingFile.receivedChunks.get(i);
        if (!chunk) {
          throw new Error(`Missing chunk ${i}`);
        }
        chunks.push(chunk);
      }

      const base64Data = chunks.join("");
      const filePath = FileSystem.documentDirectory + receivingFile.fileName;
      
      await FileSystem.writeAsStringAsync(filePath, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });

      receivingFile.transfer.status = "completed";
      receivingFile.transfer.progress = 100;
      this.transfers.set(fileId, receivingFile.transfer);
      this.notifyTransfersChange();

      this.receivingFiles.delete(fileId);
      console.log(`File saved to: ${filePath}`);
    } catch (error) {
      console.error("Error saving file:", error);
      receivingFile.transfer.status = "failed";
      this.transfers.set(fileId, receivingFile.transfer);
      this.notifyTransfersChange();
    }
  }

  async startAdvertising(deviceName: string): Promise<string> {
    if (!this.isSupported || !nearbyConnections) {
      throw new Error("Nearby Connections not available on this platform");
    }
    
    this.ensureListenersInitialized();
    
    try {
      const peerId = await nearbyConnections.startAdvertise(SERVICE_ID, nearbyConnections.Strategy.P2P_STAR);
      this.myPeerId = peerId;
      console.log(`Started advertising with service ID ${SERVICE_ID} as ${deviceName} (${peerId})`);
      return peerId;
    } catch (error) {
      console.error("Error starting advertising:", error);
      throw error;
    }
  }

  async stopAdvertising(): Promise<void> {
    if (!this.isSupported || !nearbyConnections) return;
    
    try {
      await nearbyConnections.stopAdvertise();
      console.log("Stopped advertising");
    } catch (error) {
      console.error("Error stopping advertising:", error);
      throw error;
    }
  }

  async startDiscovering(deviceName: string): Promise<string> {
    if (!this.isSupported || !nearbyConnections) {
      throw new Error("Nearby Connections not available on this platform");
    }
    
    this.ensureListenersInitialized();
    
    try {
      const peerId = await nearbyConnections.startDiscovery(SERVICE_ID, nearbyConnections.Strategy.P2P_STAR);
      this.myPeerId = peerId;
      console.log(`Started discovery with service ID ${SERVICE_ID} as ${deviceName} (${peerId})`);
      return peerId;
    } catch (error) {
      console.error("Error starting discovery:", error);
      throw error;
    }
  }

  async stopDiscovering(): Promise<void> {
    if (!this.isSupported || !nearbyConnections) return;
    
    try {
      await nearbyConnections.stopDiscovery();
      console.log("Stopped discovery");
    } catch (error) {
      console.error("Error stopping discovery:", error);
      throw error;
    }
  }

  async connectToPeer(peerId: string): Promise<void> {
    if (!this.isSupported || !nearbyConnections) {
      throw new Error("Nearby Connections not available on this platform");
    }
    
    try {
      const peer = this.peers.get(peerId);
      if (peer) {
        peer.status = "connecting";
        this.notifyPeersChange();
      }
      
      await nearbyConnections.requestConnection(peerId);
      console.log(`Connection requested to ${peerId}`);
    } catch (error) {
      console.error("Error requesting connection:", error);
      throw error;
    }
  }

  async acceptConnectionFrom(peerId: string): Promise<void> {
    if (!this.isSupported || !nearbyConnections) {
      throw new Error("Nearby Connections not available on this platform");
    }
    
    try {
      await nearbyConnections.acceptConnection(peerId);
      console.log(`Connection accepted from ${peerId}`);
    } catch (error) {
      console.error("Error accepting connection:", error);
      throw error;
    }
  }

  async rejectConnectionFrom(peerId: string): Promise<void> {
    if (!this.isSupported || !nearbyConnections) return;
    
    try {
      await nearbyConnections.rejectConnection(peerId);
      this.peers.delete(peerId);
      this.notifyPeersChange();
      console.log(`Connection rejected from ${peerId}`);
    } catch (error) {
      console.error("Error rejecting connection:", error);
      throw error;
    }
  }

  async disconnectFrom(peerId: string): Promise<void> {
    if (!this.isSupported || !nearbyConnections) return;
    
    try {
      await nearbyConnections.disconnect(peerId);
      console.log(`Disconnected from ${peerId}`);
    } catch (error) {
      console.error("Error disconnecting:", error);
      throw error;
    }
  }

  async sendMessage(peerId: string, message: string): Promise<void> {
    if (!this.isSupported || !nearbyConnections) {
      throw new Error("Nearby Connections not available on this platform");
    }
    
    try {
      await nearbyConnections.sendText(peerId, message);
      console.log(`Message sent to ${peerId}: ${message}`);
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  }

  async sendFile(
    peerId: string,
    fileName: string,
    fileSize: number,
    fileUri: string
  ): Promise<void> {
    if (!this.isSupported || !nearbyConnections) {
      throw new Error("Nearby Connections not available on this platform");
    }
    
    if (!fileUri) {
      throw new Error("File URI is required");
    }

    try {
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

      if (fileSize > 10 * 1024 * 1024) {
        throw new Error("File size must be less than 10MB due to memory limitations");
      }

      let localUri = fileUri;
      if (fileUri.startsWith("content://")) {
        const tempPath = FileSystem.cacheDirectory + fileName;
        await FileSystem.copyAsync({
          from: fileUri,
          to: tempPath,
        });
        localUri = tempPath;
      }

      const base64 = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const chunks = base64.match(new RegExp(`.{1,${CHUNK_SIZE}}`, "g")) || [];
      const totalChunks = chunks.length;

      await nearbyConnections.sendText(
        peerId,
        JSON.stringify({
          type: "file_start",
          fileId,
          fileName,
          fileSize,
          totalChunks,
        })
      );

      for (let i = 0; i < chunks.length; i++) {
        await nearbyConnections.sendText(
          peerId,
          JSON.stringify({
            type: "file_chunk",
            fileId,
            chunkIndex: i,
            data: chunks[i],
          })
        );

        const progress = ((i + 1) / totalChunks) * 100;
        transfer.progress = progress;
        this.transfers.set(fileId, transfer);
        this.notifyTransfersChange();
      }

      await nearbyConnections.sendText(
        peerId,
        JSON.stringify({
          type: "file_complete",
          fileId,
        })
      );

      transfer.status = "completed";
      transfer.progress = 100;
      this.transfers.set(fileId, transfer);
      this.notifyTransfersChange();

      console.log(`File sent: ${fileName}`);
    } catch (error) {
      console.error("Error sending file:", error);
      const transfer = Array.from(this.transfers.values()).find(
        (t) => t.fileName === fileName && t.peerId === peerId
      );
      if (transfer) {
        transfer.status = "failed";
        this.transfers.set(transfer.id, transfer);
        this.notifyTransfersChange();
      }
      throw error;
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

  isNearbyConnectionsSupported(): boolean {
    return this.isSupported;
  }

  cleanup() {
    this.listeners.forEach((unsubscribe) => unsubscribe());
    this.listeners = [];
    this.peers.clear();
    this.transfers.clear();
    this.receivingFiles.clear();
    this.myPeerId = null;
    this.listenersInitialized = false;
  }
}

export default new NearbyConnectionsService();
