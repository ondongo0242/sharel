import { Platform, NativeModules, AppState, AppStateStatus } from 'react-native';
import * as Device from 'expo-device';
import NetInfo from '@react-native-community/netinfo';
import { nativeFileExplorer } from './NativeFileExplorer';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: any;
  sessionId: string;
  elapsedMs?: number;
}

export interface LogConfig {
  isProduction: boolean;
  minLogLevel: LogLevel;
}

export const SHAREL_FOLDERS = {
  ROOT: 'Sharel',
  TGBOX: 'Sharel/TGBOX',
  SHAREL: 'Sharel/files',
  LOG: 'Sharel/logs',
};

const { StorageModule, LogModule } = NativeModules;

class LoggerService {
  private logs: LogEntry[] = [];
  private logFilePath: string = '';
  private sharelBasePath: string = '';
  private externalSharelPath: string = '';
  private isInitialized: boolean = false;
  private maxLogEntries: number = 1000;
  private isWeb: boolean = Platform.OS === 'web';
  private writeBuffer: string[] = [];
  private isWriting: boolean = false;
  private hasMediaLibraryPermission: boolean = false;
  private sessionId: string = '';
  private appStartTime: number = 0;
  private nativeLoggerAvailable: boolean = false;
  private isProduction: boolean = !__DEV__;
  private minLogLevel: LogLevel = 'info';

  private appStateSubscription: any = null;
  private networkSubscription: any = null;
  private eventCounts: Map<string, number> = new Map();
  private lastNetworkState: string = '';

  constructor() {
    this.sessionId = this.generateSessionId();
    this.appStartTime = Date.now();
    
    if (!this.isWeb && Platform.OS === 'android') {
      const packageName = require('expo-constants').default?.expoConfig?.android?.package || 'com.sharel.app';
      this.sharelBasePath = `/data/data/${packageName}/files/${SHAREL_FOLDERS.ROOT}`;
      this.logFilePath = `/data/data/${packageName}/files/${SHAREL_FOLDERS.LOG}/sharel_log.txt`;
    }
    
    this.nativeLoggerAvailable = Platform.OS === 'android' && !!LogModule;
  }

  private setupAutoLogging(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }
    this.appStateSubscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      this.logAppLifecycle(`App state: ${state}`, { previousUptime: this.getUptimeFormatted() });
    });

    if (!this.isWeb && !this.networkSubscription) {
      try {
        this.networkSubscription = NetInfo.addEventListener(state => {
          const networkState = `${state.type}${state.isConnected ? '-connected' : '-disconnected'}`;
          if (networkState !== this.lastNetworkState) {
            this.logNetworkEvent('Network changed', {
              type: state.type,
              isConnected: state.isConnected,
              isInternetReachable: state.isInternetReachable,
            });
            this.lastNetworkState = networkState;
          }
        });
      } catch (e) {
        console.warn('[Logger] Failed to setup network listener:', e);
      }
    }
  }

  cleanup(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    if (this.networkSubscription) {
      this.networkSubscription();
      this.networkSubscription = null;
    }
  }

  private incrementEventCount(category: string): number {
    const count = (this.eventCounts.get(category) || 0) + 1;
    this.eventCounts.set(category, count);
    return count;
  }
  
  private generateSessionId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized || this.isWeb) return;

    try {
      console.log('[Logger] Initializing SHAREL Logger...');
      
      if (this.nativeLoggerAvailable) {
        try {
          await LogModule.initialize();
          console.log('[Logger] Native logger initialized');
        } catch (nativeError) {
          console.warn('[Logger] Native logger init failed:', nativeError);
        }
      }
      
      const folderResult = await this.createSharelFolders();
      console.log('[Logger] Folder creation result:', folderResult);

      if (folderResult.success) {
        try {
          const fileExists = await nativeFileExplorer.exists(this.logFilePath);
          if (fileExists) {
            const content = await nativeFileExplorer.readFileAsString(this.logFilePath);
            if (content) {
              const lines = content.split('\n').filter((l: string) => l.trim());
              this.logs = lines.slice(-this.maxLogEntries).map((line: string) => {
                try {
                  return JSON.parse(line);
                } catch {
                  return { timestamp: new Date().toISOString(), level: 'info' as LogLevel, category: 'Log', message: line };
                }
              });
            }
          }
        } catch (readError) {
          console.warn('[Logger] Could not read existing log file:', readError);
        }
      }

      this.isInitialized = true;
      
      this.setupAutoLogging();
      this.logSystemInfo();
      this.log('info', 'App', `SESSION STARTED [${this.sessionId}]`);
      this.log('info', 'Storage', `Log path: ${this.logFilePath}`);
      if (this.externalSharelPath) {
        this.log('info', 'Storage', `External path: ${this.externalSharelPath}`);
      }
      
      await this.initializeNativeDirectories();
      await this.logInitialNetworkState();
      
    } catch (error) {
      console.error('[Logger] Failed to initialize logger:', error);
      this.isInitialized = true;
    }
  }
  
  private async logSystemInfo(): Promise<void> {
    try {
      const deviceInfo = {
        brand: Device.brand || 'Unknown',
        modelName: Device.modelName || 'Unknown',
        osName: Device.osName,
        osVersion: Device.osVersion,
        platformApiLevel: Device.platformApiLevel || 'N/A',
        totalMemory: Device.totalMemory ? `${Math.round(Device.totalMemory / 1024 / 1024)} MB` : 'Unknown',
        deviceType: Device.deviceType,
        isDevice: Device.isDevice,
      };
      
      this.log('info', 'System', 'Device info', deviceInfo);
    } catch (error) {
      this.log('warn', 'System', 'Could not get device info', { error: String(error) });
    }
  }

  private async logInitialNetworkState(): Promise<void> {
    if (this.isWeb) return;
    try {
      const state = await NetInfo.fetch();
      const details = state.type === 'wifi' ? (state.details as any) : null;
      this.log('info', 'Network', 'Initial network state', {
        type: state.type,
        connected: state.isConnected,
        internetReachable: state.isInternetReachable,
        ssid: details?.ssid,
        ipAddress: details?.ipAddress,
      });
      this.lastNetworkState = `${state.type}${state.isConnected ? '-connected' : '-disconnected'}`;
    } catch (e) {}
  }
  
  private async initializeNativeDirectories(): Promise<void> {
    if (Platform.OS !== 'android' || !StorageModule) return;
    
    try {
      const result = await StorageModule.initializeAppDirectories();
      this.log('info', 'Storage', 'Native directories initialized', {
        success: result.success,
        dataPath: result.paths?.dataPath,
        mediaPath: result.paths?.mediaPath,
        cachePath: result.paths?.cachePath,
      });
      
      const hasPermission = await StorageModule.hasManageStoragePermission();
      this.log('info', 'Permission', 'MANAGE_EXTERNAL_STORAGE status', { granted: hasPermission });
      
      if (hasPermission) {
        try {
          const sharelResult = await StorageModule.createSharelFolder();
          this.log('info', 'Storage', 'Sharel root folder', {
            path: sharelResult.path,
            created: !sharelResult.alreadyExists,
            alreadyExists: sharelResult.alreadyExists,
          });
        } catch (folderError: any) {
          this.log('warn', 'Storage', 'Sharel folder creation skipped', { 
            reason: folderError.message || 'Permission required' 
          });
        }
      } else {
        this.log('info', 'Storage', 'Sharel folder creation deferred - permission will be requested via onboarding screen');
      }
      
    } catch (error: any) {
      this.log('error', 'Storage', 'Failed to initialize native directories', { error: error.message });
    }
  }

  async createSharelFolders(): Promise<{ success: boolean; paths: Record<string, string>; externalPath?: string }> {
    if (this.isWeb) {
      console.log('[Logger] Web platform - skipping folder creation');
      return { success: false, paths: {} };
    }

    const paths: Record<string, string> = {};
    const internalFolders = [SHAREL_FOLDERS.ROOT, SHAREL_FOLDERS.TGBOX, SHAREL_FOLDERS.SHAREL, SHAREL_FOLDERS.LOG];

    try {
      if (Platform.OS === 'android' && nativeFileExplorer.isAvailable()) {
        const packageName = require('expo-constants').default?.expoConfig?.android?.package || 'com.sharel.app';
        const baseDir = `/data/data/${packageName}/files/`;

        for (const folder of internalFolders) {
          const folderPath = `${baseDir}${folder}`;
          try {
            const exists = await nativeFileExplorer.exists(folderPath);
            
            if (!exists) {
              await nativeFileExplorer.makeDirectory(folderPath);
              console.log(`[Logger] Created internal folder: ${folderPath}`);
            } else {
              console.log(`[Logger] Folder already exists: ${folderPath}`);
            }
            
            paths[folder] = folderPath;
          } catch (folderError) {
            console.error(`[Logger] Error creating folder ${folder}:`, folderError);
          }
        }

        this.hasMediaLibraryPermission = true;
      }
      
      console.log('[Logger] All folders created successfully');
      return { success: true, paths, externalPath: this.externalSharelPath };
    } catch (error) {
      console.error('[Logger] Failed to create sharel folders:', error);
      return { success: false, paths };
    }
  }

  getSharelPath(folder: keyof typeof SHAREL_FOLDERS): string {
    if (this.isWeb) return '';
    if (Platform.OS === 'android') {
      const packageName = require('expo-constants').default?.expoConfig?.android?.package || 'com.sharel.app';
      return `/data/data/${packageName}/files/${SHAREL_FOLDERS[folder]}`;
    }
    return '';
  }

  private async saveToFile(entry: LogEntry): Promise<void> {
    if (this.isWeb || !this.logFilePath) return;

    const logLine = JSON.stringify(entry) + '\n';
    this.writeBuffer.push(logLine);
    
    if (this.isWriting) return;
    
    this.isWriting = true;
    try {
      while (this.writeBuffer.length > 0) {
        const batch = this.writeBuffer.splice(0, 10).join('');
        const fileInfo = await FileSystem.getInfoAsync(this.logFilePath);
        
        if (fileInfo.exists) {
          const existing = await FileSystem.readAsStringAsync(this.logFilePath);
          await FileSystem.writeAsStringAsync(this.logFilePath, existing + batch);
        } else {
          await FileSystem.writeAsStringAsync(this.logFilePath, batch);
        }
      }
    } catch (error) {
      console.warn('Failed to save logs to file:', error);
    } finally {
      this.isWriting = false;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error'];
    const minIdx = levels.indexOf(this.minLogLevel);
    return levels.indexOf(level) >= minIdx;
  }

  log(level: LogLevel, category: string, message: string, data?: any): void {
    if (!this.shouldLog(level)) return;

    // Prevent duplicate logs for common frequent events (e.g. Network/Lifecycle)
    const eventKey = `${category}:${message}`;
    const lastLogTime = this.eventCounts.get(eventKey + ":time") || 0;
    const nowMs = Date.now();
    
    // Throttle frequent identical logs to every 5 seconds, except errors
    if (level !== 'error' && (category === 'Network' || category === 'Lifecycle') && (nowMs - lastLogTime < 5000)) {
      return;
    }
    this.eventCounts.set(eventKey + ":time", nowMs);

    const now = new Date();
    const elapsed = Date.now() - this.appStartTime;
    const sanitizedData = data ? this.sanitizeData(data) : undefined;
    
    const entry: LogEntry = {
      timestamp: now.toISOString(),
      level,
      category,
      message,
      data: sanitizedData,
      sessionId: this.sessionId,
      elapsedMs: elapsed,
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogEntries) {
      this.logs = this.logs.slice(-this.maxLogEntries);
    }

    // Force full JSON output in both modes to ensure "everything" is seen as requested
    const timeStr = entry.timestamp.split('T')[1].substring(0, 8);
    const levelIcon = this.getLevelIcon(entry.level);
    const levelStr = entry.level.toUpperCase().padEnd(5);
    const catStr = entry.category.padEnd(12);
    // Use full JSON.stringify for data to ensure user sees everything
    const dataStr = entry.data ? ` | ${JSON.stringify(entry.data, null, 2)}` : '';
    const consoleMsg = `${levelIcon} [${timeStr}] [${levelStr}] [${catStr}] ${entry.message}${dataStr}`;
    
    // Always log full consoleMsg to ensure visibility of JSON
    if (this.isProduction) {
      this.logProductionEnhanced(consoleMsg);
    } else {
      switch (entry.level) {
        case 'debug':
        case 'trace':
          console.log(consoleMsg);
          break;
        case 'info':
          console.info(consoleMsg);
          break;
        case 'warn':
          console.warn(consoleMsg);
          break;
        case 'error':
          console.error(consoleMsg);
          break;
      }
    }

    if (!this.isWeb) {
      this.saveToFile(entry);
      this.logToNative(level, category, message, data);
    }
  }

  private logProductionEnhanced(fullMsg: string): void {
    // Determine level from the message or pass it as param if needed
    // For now, just logging to info/error based on typical production needs
    if (fullMsg.includes("[ERROR]")) {
      console.error(fullMsg);
    } else if (fullMsg.includes("[WARN]")) {
      console.warn(fullMsg);
    } else {
      console.info(fullMsg);
    }
  }

  private formatElapsed(ms: number): string {
    if (ms < 1000) return `+${ms}ms`;
    if (ms < 60000) return `+${(ms / 1000).toFixed(1)}s`;
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `+${mins}m${secs}s`;
  }

  private getLevelIcon(level: LogLevel): string {
    switch (level) {
      case 'debug': return '';
      case 'info': return '';
      case 'warn': return '';
      case 'error': return '';
      default: return '';
    }
  }
  
  private logToNative(level: LogLevel, tag: string, message: string, data?: any): void {
    if (!this.nativeLoggerAvailable) return;
    
    try {
      const dataStr = data ? JSON.stringify(data) : null;
      
      switch (level) {
        case 'debug':
          LogModule.debug(tag, message, dataStr);
          break;
        case 'info':
          LogModule.info(tag, message, dataStr);
          break;
        case 'warn':
          LogModule.warn(tag, message, dataStr);
          break;
        case 'error':
          LogModule.error(tag, message, dataStr);
          break;
      }
    } catch {
    }
  }

  private sanitizeData(data: any): any {
    try {
      if (data === null || data === undefined) return data;
      
      // Handle non-object types
      if (typeof data !== 'object') return data;

      return JSON.parse(JSON.stringify(data, (key, value) => {
        if (typeof value === 'function') return '[Function]';
        if (value instanceof Error) return { message: value.message, stack: value.stack };
        if (typeof value === 'bigint') return value.toString();
        // Prevent circular references or extremely large blobs if possible
        return value;
      }));
    } catch {
      return String(data);
    }
  }

  trace(category: string, message: string, data?: any): void {
    this.log('trace', category, message, data);
  }

  debug(category: string, message: string, data?: any): void {
    this.log('debug', category, message, data);
  }

  info(category: string, message: string, data?: any): void {
    this.log('info', category, message, data);
  }

  warn(category: string, message: string, data?: any): void {
    this.log('warn', category, message, data);
  }

  error(category: string, message: string, error?: Error | string, context?: any): void {
    if (error instanceof Error) {
      const stackLine = error.stack?.split('\n')[0] || error.message;
      this.log('error', category, `${message} -- ${stackLine}`, { 
        error: error.message,
        ...context 
      });
    } else {
      this.log('error', category, message, { error, ...context });
    }
  }

  logTransferStart(transferId: string, files: Array<{ name: string; size: number }>, targetDevice: string): void {
    this.info('Transfer', 'Transfer started', {
      transferId,
      fileCount: files.length,
      totalSize: files.reduce((acc, f) => acc + f.size, 0),
      files: files.map(f => ({ name: f.name, size: f.size })),
      targetDevice,
    });
  }

  logTransferProgress(transferId: string, fileName: string, progress: number, bytesTransferred: number): void {
    this.debug('Transfer', 'Transfer progress', {
      transferId,
      fileName,
      progress: `${(progress * 100).toFixed(2)}%`,
      bytesTransferred,
    });
  }

  logTransferComplete(transferId: string, totalFiles: number, totalBytes: number, durationMs: number): void {
    const speedMBps = totalBytes / 1024 / 1024 / (durationMs / 1000);
    this.info('Transfer', 'Transfer completed', {
      transferId,
      totalFiles,
      totalBytes,
      durationMs,
      averageSpeed: `${speedMBps.toFixed(2)} MB/s`,
    });
  }

  logTransferError(transferId: string, error: Error | string, context?: any): void {
    this.error('Transfer', 'Transfer error', {
      transferId,
      error: typeof error === 'string' ? error : { message: error.message, stack: error.stack },
      context,
    });
  }

  logConnectionEvent(event: string, peerId?: string, deviceName?: string, details?: any): void {
    this.info('Connection', event, {
      peerId,
      deviceName,
      details,
    });
  }

  logFileOperation(operation: string, fileName: string, success: boolean, error?: Error): void {
    if (success) {
      this.info('FileOp', `${operation} successful`, { fileName });
    } else {
      this.error('FileOp', `${operation} failed`, { fileName, error: error?.message });
    }
  }
  
  logPermissionEvent(permission: string, status: string, details?: any): void {
    this.info('Permission', `${permission}: ${status}`, details);
  }
  
  logStorageEvent(event: string, path?: string, details?: any): void {
    this.info('Storage', event, { path, ...details });
  }
  
  logNetworkEvent(event: string, details?: any): void {
    this.info('Network', event, details);
  }
  
  logHotspotEvent(event: string, ssid?: string, details?: any): void {
    this.info('Hotspot', event, { ssid, ...details });
  }
  
  logWifiDirectEvent(event: string, deviceName?: string, details?: any): void {
    this.info('WifiDirect', event, { deviceName, ...details });
  }
  
  logAppLifecycle(event: string, details?: any): void {
    this.info('Lifecycle', event, details);
  }
  
  logUIEvent(screen: string, action: string, details?: any): void {
    this.debug('UI', `[${screen}] ${action}`, details);
  }
  
  logPerformance(operation: string, durationMs: number, details?: any): void {
    const emoji = durationMs < 100 ? '' : durationMs < 500 ? '' : '';
    this.debug('Perf', `${operation} took ${durationMs}ms ${emoji}`, details);
  }
  
  logCacheEvent(event: string, details?: any): void {
    this.debug('Cache', event, details);
  }
  
  logGestureEvent(gesture: string, action?: string, details?: any): void {
    this.info('Gesture', `${gesture}${action ? ` -> ${action}` : ''}`, details);
  }
  
  getSessionId(): string {
    return this.sessionId;
  }
  
  getUptime(): number {
    return Date.now() - this.appStartTime;
  }
  
  getUptimeFormatted(): string {
    const uptime = this.getUptime();
    const seconds = Math.floor(uptime / 1000) % 60;
    const minutes = Math.floor(uptime / 60000) % 60;
    const hours = Math.floor(uptime / 3600000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }

  async getLogs(filter?: { level?: LogLevel; category?: string; limit?: number }): Promise<LogEntry[]> {
    let result = [...this.logs];

    if (filter?.level) {
      result = result.filter(log => log.level === filter.level);
    }

    if (filter?.category) {
      result = result.filter(log => log.category.toLowerCase().includes(filter.category!.toLowerCase()));
    }

    if (filter?.limit) {
      result = result.slice(-filter.limit);
    }

    return result;
  }

  async getLogsAsText(filter?: { level?: LogLevel; category?: string; limit?: number }): Promise<string> {
    const logs = await this.getLogs(filter);
    return logs.map(log => {
      const dataStr = log.data ? ` | Data: ${JSON.stringify(log.data)}` : '';
      return `[${log.timestamp}] [${log.level.toUpperCase()}] [${log.category}] ${log.message}${dataStr}`;
    }).join('\n');
  }

  async clearLogs(): Promise<void> {
    this.logs = [];
    if (!this.isWeb) {
      try {
        await FileSystem.deleteAsync(this.logFilePath, { idempotent: true });
      } catch (error) {
        console.warn('Failed to delete log file:', error);
      }
    }
    this.info('Logger', 'Logs cleared');
  }

  async exportLogs(): Promise<string | null> {
    if (this.isWeb || !FileSystem.documentDirectory) {
      return this.getLogsAsText();
    }

    try {
      const logsText = await this.getLogsAsText();
      const exportPath = `${FileSystem.documentDirectory}${SHAREL_FOLDERS.LOG}/export_${Date.now()}.txt`;
      await FileSystem.writeAsStringAsync(exportPath, logsText);
      return exportPath;
    } catch (error) {
      this.error('Logger', 'Failed to export logs', error);
      return null;
    }
  }

  getLogFilePath(): string {
    return this.logFilePath;
  }

  getSharelBasePath(): string {
    return this.sharelBasePath;
  }

  getExternalSharelPath(): string {
    return this.externalSharelPath;
  }

  isInitializedStatus(): boolean {
    return this.isInitialized;
  }

  async readLogFile(): Promise<string> {
    if (this.isWeb || !this.logFilePath) return '';
    
    try {
      const fileInfo = await FileSystem.getInfoAsync(this.logFilePath);
      if (fileInfo.exists) {
        return await FileSystem.readAsStringAsync(this.logFilePath);
      }
    } catch (error) {
      console.warn('Failed to read log file:', error);
    }
    return '';
  }
}

export const logger = new LoggerService();
export default logger;
