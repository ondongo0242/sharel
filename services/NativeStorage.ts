import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { StorageModule } = NativeModules;

export interface SharelFolderResult {
  success: boolean;
  path: string;
  alreadyExists: boolean;
}

export interface SharelFolderInfo {
  path: string;
  exists: boolean;
  isDirectory: boolean;
}

export interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  lastModified: number;
}

export interface SaveFileResult {
  success: boolean;
  path: string;
  size: number;
}

export interface StorageInfo {
  totalSpace: number;
  freeSpace: number;
  usedSpace: number;
  sharelFolderSize: number;
  sharelPath: string;
  sharelExists: boolean;
}

export interface AndroidVersionInfo {
  sdkVersion: number;
  release: string;
  requiresManageStorage: boolean;
}

export interface StorageEvent {
  event: 'folder_created' | 'permission_result' | 'directories_initialized';
  path?: string;
  granted?: boolean;
  paths?: AppDirectories;
}

export interface AppDirectories {
  dataPath?: string;
  dataCachePath?: string;
  dataLogsPath?: string;
  mediaPath?: string;
  mediaLogsPath?: string;
  cachePath?: string;
  cacheLogsPath?: string;
  packageName?: string;
}

export interface AppDirectoriesInfo {
  dataPath?: string;
  dataExists?: boolean;
  mediaPath?: string;
  mediaExists?: boolean;
  cachePath?: string;
  cacheExists?: boolean;
  packageName?: string;
}

export interface InitAppDirectoriesResult {
  success: boolean;
  paths: AppDirectories;
  packageName: string;
}

class NativeStorageService {
  private storageEmitter: NativeEventEmitter | null = null;

  constructor() {
    if (Platform.OS === 'android' && StorageModule) {
      this.storageEmitter = new NativeEventEmitter(StorageModule);
    }
  }

  isAvailable(): boolean {
    return Platform.OS === 'android' && !!StorageModule;
  }

  async hasManageStoragePermission(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }
    return StorageModule.hasManageStoragePermission();
  }

  async requestManageStoragePermission(): Promise<boolean> {
    if (!this.isAvailable()) {
      throw new Error('Storage module is only available on Android');
    }
    return StorageModule.requestManageStoragePermission();
  }

  async openStoragePermissionSettings(): Promise<boolean> {
    if (!this.isAvailable()) {
      throw new Error('Storage module is only available on Android');
    }
    return StorageModule.openStoragePermissionSettings();
  }

  async createSharelFolder(): Promise<SharelFolderResult> {
    if (!this.isAvailable()) {
      throw new Error('Storage module is only available on Android');
    }
    return StorageModule.createSharelFolder();
  }

  async getSharelFolderPath(): Promise<SharelFolderInfo> {
    if (!this.isAvailable()) {
      throw new Error('Storage module is only available on Android');
    }
    return StorageModule.getSharelFolderPath();
  }

  async listSharelFolder(): Promise<FileInfo[]> {
    if (!this.isAvailable()) {
      throw new Error('Storage module is only available on Android');
    }
    return StorageModule.listSharelFolder();
  }

  async saveFileToSharel(
    sourcePath: string,
    fileName: string,
    subfolder: string = ''
  ): Promise<SaveFileResult> {
    if (!this.isAvailable()) {
      throw new Error('Storage module is only available on Android');
    }
    return StorageModule.saveFileToSharel(sourcePath, fileName, subfolder);
  }

  async deleteFileFromSharel(filePath: string): Promise<boolean> {
    if (!this.isAvailable()) {
      throw new Error('Storage module is only available on Android');
    }
    return StorageModule.deleteFileFromSharel(filePath);
  }

  async getStorageInfo(): Promise<StorageInfo> {
    if (!this.isAvailable()) {
      throw new Error('Storage module is only available on Android');
    }
    return StorageModule.getStorageInfo();
  }

  async getAndroidVersion(): Promise<AndroidVersionInfo> {
    if (!this.isAvailable()) {
      throw new Error('Storage module is only available on Android');
    }
    return StorageModule.getAndroidVersion();
  }

  async initializeAppDirectories(): Promise<InitAppDirectoriesResult> {
    if (!this.isAvailable()) {
      return {
        success: false,
        paths: {},
        packageName: '',
      };
    }
    return StorageModule.initializeAppDirectories();
  }

  async getAppDirectories(): Promise<AppDirectoriesInfo> {
    if (!this.isAvailable()) {
      return {};
    }
    return StorageModule.getAppDirectories();
  }

  async ensureSharelFolderExists(): Promise<SharelFolderResult> {
    if (!this.isAvailable()) {
      throw new Error('Storage module is only available on Android');
    }

    const hasPermission = await this.hasManageStoragePermission();
    
    if (!hasPermission) {
      const granted = await this.requestManageStoragePermission();
      if (!granted) {
        throw new Error('MANAGE_EXTERNAL_STORAGE permission not granted');
      }
    }

    return this.createSharelFolder();
  }

  async initializeStorage(): Promise<{
    permissionGranted: boolean;
    folderCreated: boolean;
    folderPath: string;
  }> {
    if (!this.isAvailable()) {
      return {
        permissionGranted: false,
        folderCreated: false,
        folderPath: '',
      };
    }

    const versionInfo = await this.getAndroidVersion();
    
    if (!versionInfo.requiresManageStorage) {
      const result = await this.createSharelFolder();
      return {
        permissionGranted: true,
        folderCreated: result.success,
        folderPath: result.path,
      };
    }

    const hasPermission = await this.hasManageStoragePermission();
    
    if (!hasPermission) {
      return {
        permissionGranted: false,
        folderCreated: false,
        folderPath: '',
      };
    }

    const result = await this.createSharelFolder();
    return {
      permissionGranted: true,
      folderCreated: result.success,
      folderPath: result.path,
    };
  }

  onStorageEvent(callback: (event: StorageEvent) => void): () => void {
    if (!this.storageEmitter) {
      return () => {};
    }
    const subscription = this.storageEmitter.addListener('onStorageEvent', callback);
    return () => subscription.remove();
  }
}

export const nativeStorage = new NativeStorageService();
export default nativeStorage;
