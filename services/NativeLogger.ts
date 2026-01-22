import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { LogModule } = NativeModules;

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  tag: string;
  message: string;
  data?: string;
}

export interface LogInfo {
  logPath: string;
  logDirectory: string;
  logFileSize: number;
  recentLogsCount: number;
  isInitialized: boolean;
}

export interface InitResult {
  success: boolean;
  logPath: string;
  logDirectory: string;
}

class NativeLoggerService {
  private logEmitter: NativeEventEmitter | null = null;
  private initialized: boolean = false;

  constructor() {
    if (Platform.OS === 'android' && LogModule) {
      this.logEmitter = new NativeEventEmitter(LogModule);
    }
  }

  isAvailable(): boolean {
    return Platform.OS === 'android' && !!LogModule;
  }

  async initialize(): Promise<InitResult | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const result = await LogModule.initialize();
      this.initialized = result.success;
      return result;
    } catch (error) {
      console.error('[NativeLogger] Failed to initialize:', error);
      return null;
    }
  }

  async log(level: LogLevel, tag: string, message: string, data?: any): Promise<boolean> {
    if (!this.isAvailable()) {
      this.fallbackLog(level, tag, message, data);
      return false;
    }

    try {
      const dataStr = data ? JSON.stringify(data) : null;
      await LogModule.log(level, tag, message, dataStr);
      return true;
    } catch (error) {
      this.fallbackLog(level, tag, message, data);
      return false;
    }
  }

  private fallbackLog(level: LogLevel, tag: string, message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] [${tag}] ${message}`;
    switch (level) {
      case 'debug':
        console.log(logMessage, data || '');
        break;
      case 'info':
        console.info(logMessage, data || '');
        break;
      case 'warn':
        console.warn(logMessage, data || '');
        break;
      case 'error':
        console.error(logMessage, data || '');
        break;
    }
  }

  debug(tag: string, message: string, data?: any): void {
    if (this.isAvailable()) {
      const dataStr = data ? JSON.stringify(data) : null;
      LogModule.debug(tag, message, dataStr);
    }
    this.fallbackLog('debug', tag, message, data);
  }

  info(tag: string, message: string, data?: any): void {
    if (this.isAvailable()) {
      const dataStr = data ? JSON.stringify(data) : null;
      LogModule.info(tag, message, dataStr);
    }
    this.fallbackLog('info', tag, message, data);
  }

  warn(tag: string, message: string, data?: any): void {
    if (this.isAvailable()) {
      const dataStr = data ? JSON.stringify(data) : null;
      LogModule.warn(tag, message, dataStr);
    }
    this.fallbackLog('warn', tag, message, data);
  }

  error(tag: string, message: string, data?: any): void {
    if (this.isAvailable()) {
      const dataStr = data ? JSON.stringify(data) : null;
      LogModule.error(tag, message, dataStr);
    }
    this.fallbackLog('error', tag, message, data);
  }

  async flush(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      await LogModule.flush();
      return true;
    } catch (error) {
      console.error('[NativeLogger] Failed to flush:', error);
      return false;
    }
  }

  async getRecentLogs(limit: number = 100): Promise<LogEntry[]> {
    if (!this.isAvailable()) {
      return [];
    }

    try {
      return await LogModule.getRecentLogs(limit);
    } catch (error) {
      console.error('[NativeLogger] Failed to get recent logs:', error);
      return [];
    }
  }

  async getLogFilePath(): Promise<string | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      return await LogModule.getLogFilePath();
    } catch (error) {
      console.error('[NativeLogger] Failed to get log file path:', error);
      return null;
    }
  }

  async getLogFileContent(): Promise<string> {
    if (!this.isAvailable()) {
      return '';
    }

    try {
      return await LogModule.getLogFileContent();
    } catch (error) {
      console.error('[NativeLogger] Failed to get log file content:', error);
      return '';
    }
  }

  async clearLogs(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      await LogModule.clearLogs();
      return true;
    } catch (error) {
      console.error('[NativeLogger] Failed to clear logs:', error);
      return false;
    }
  }

  async getLogInfo(): Promise<LogInfo | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      return await LogModule.getLogInfo();
    } catch (error) {
      console.error('[NativeLogger] Failed to get log info:', error);
      return null;
    }
  }

  logTransferStart(transferId: string, files: Array<{ name: string; size: number }>, targetDevice: string): void {
    this.info('Transfer', 'Transfer started', {
      transferId,
      fileCount: files.length,
      totalSize: files.reduce((acc, f) => acc + f.size, 0),
      files: files.map((f) => ({ name: f.name, size: f.size })),
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
      this.info('FileOperation', `${operation} successful`, { fileName });
    } else {
      this.error('FileOperation', `${operation} failed`, { fileName, error: error?.message });
    }
  }

  logAppEvent(event: string, details?: any): void {
    this.info('App', event, details);
  }

  logNavigation(screen: string, params?: any): void {
    this.debug('Navigation', `Navigated to ${screen}`, params);
  }

  logPermission(permission: string, granted: boolean): void {
    this.info('Permission', `${permission}: ${granted ? 'granted' : 'denied'}`);
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

export const nativeLogger = new NativeLoggerService();
export default nativeLogger;
