import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { FileExplorerModule } = NativeModules;

export interface FileItem {
  name: string;
  uri: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modificationTime: number;
  isHidden?: boolean;
  canRead?: boolean;
  canWrite?: boolean;
  extension?: string;
  mimeType?: string;
  parentPath?: string;
}

export interface CopyMoveResult {
  success: boolean;
  source: string;
  destination?: string;
  error?: string;
}

export interface BatchResult {
  results: CopyMoveResult[];
  successCount: number;
  failCount: number;
}

export interface StorageStats {
  totalSpace: number;
  freeSpace: number;
  usedSpace: number;
  usedPercentage: number;
}

export interface FileSystemEvent {
  type: 'create' | 'delete' | 'rename' | 'copy' | 'move';
  path?: string;
  oldPath?: string;
  newPath?: string;
  source?: string;
  destination?: string;
}

export type SortOption = 'name' | 'date' | 'size' | 'type';
export type SortOrder = 'asc' | 'desc';

export interface AllFileCounts {
  images: number;
  videos: number;
  audio: number;
  documents: number;
  apk: number;
  zip: number;
  downloads: number;
  others: number;
  timestamp: number;
}

class NativeFileExplorerService {
  private eventEmitter: NativeEventEmitter | null = null;

  constructor() {
    if (Platform.OS === 'android' && FileExplorerModule) {
      this.eventEmitter = new NativeEventEmitter(FileExplorerModule);
    }
  }

  isAvailable(): boolean {
    return Platform.OS === 'android' && !!FileExplorerModule;
  }

  async getRootPath(): Promise<string> {
    if (!this.isAvailable()) {
      return '/storage/emulated/0';
    }
    return FileExplorerModule.getRootPath();
  }

  async hasStoragePermission(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }
    return FileExplorerModule.hasStoragePermission();
  }

  async listFiles(path: string, showHidden: boolean = false): Promise<FileItem[]> {
    if (!this.isAvailable()) {
      return [];
    }
    return FileExplorerModule.listFiles(path, showHidden);
  }

  async listFilesWithStats(
    path: string,
    showHidden: boolean = false,
    sortBy: SortOption = 'name',
    sortOrder: SortOrder = 'asc'
  ): Promise<FileItem[]> {
    if (!this.isAvailable()) {
      return [];
    }
    return FileExplorerModule.listFilesWithStats(path, showHidden, sortBy, sortOrder);
  }

  async getFileInfo(path: string): Promise<FileItem> {
    if (!this.isAvailable()) {
      throw new Error('FileExplorer module is only available on Android');
    }
    return FileExplorerModule.getFileInfo(path);
  }

  async createDirectory(path: string): Promise<{ success: boolean; path: string }> {
    if (!this.isAvailable()) {
      throw new Error('FileExplorer module is only available on Android');
    }
    return FileExplorerModule.createDirectory(path);
  }

  async createFile(path: string): Promise<{ success: boolean; path: string }> {
    if (!this.isAvailable()) {
      throw new Error('FileExplorer module is only available on Android');
    }
    return FileExplorerModule.createFile(path);
  }

  async deleteFile(path: string): Promise<boolean> {
    if (!this.isAvailable()) {
      throw new Error('FileExplorer module is only available on Android');
    }
    return FileExplorerModule.deleteFile(path);
  }

  async deleteMultiple(paths: string[]): Promise<BatchResult> {
    if (!this.isAvailable()) {
      throw new Error('FileExplorer module is only available on Android');
    }
    return FileExplorerModule.deleteMultiple(paths);
  }

  async rename(oldPath: string, newPath: string): Promise<{ success: boolean; oldPath: string; newPath: string }> {
    if (!this.isAvailable()) {
      throw new Error('FileExplorer module is only available on Android');
    }
    return FileExplorerModule.rename(oldPath, newPath);
  }

  async copyFile(sourcePath: string, destPath: string): Promise<CopyMoveResult> {
    if (!this.isAvailable()) {
      throw new Error('FileExplorer module is only available on Android');
    }
    return FileExplorerModule.copyFile(sourcePath, destPath);
  }

  async moveFile(sourcePath: string, destPath: string): Promise<CopyMoveResult> {
    if (!this.isAvailable()) {
      throw new Error('FileExplorer module is only available on Android');
    }
    return FileExplorerModule.moveFile(sourcePath, destPath);
  }

  async copyMultiple(sourcePaths: string[], destFolder: string): Promise<BatchResult> {
    if (!this.isAvailable()) {
      throw new Error('FileExplorer module is only available on Android');
    }
    return FileExplorerModule.copyMultiple(sourcePaths, destFolder);
  }

  async moveMultiple(sourcePaths: string[], destFolder: string): Promise<BatchResult> {
    if (!this.isAvailable()) {
      throw new Error('FileExplorer module is only available on Android');
    }
    return FileExplorerModule.moveMultiple(sourcePaths, destFolder);
  }

  async searchFiles(rootPath: string, query: string, maxResults: number = 100): Promise<FileItem[]> {
    if (!this.isAvailable()) {
      return [];
    }
    return FileExplorerModule.searchFiles(rootPath, query, maxResults);
  }

  async getFolderSize(path: string): Promise<number> {
    if (!this.isAvailable()) {
      return 0;
    }
    return FileExplorerModule.getFolderSize(path);
  }

  async getStorageStats(): Promise<StorageStats> {
    if (!this.isAvailable()) {
      return { totalSpace: 0, freeSpace: 0, usedSpace: 0, usedPercentage: 0 };
    }
    return FileExplorerModule.getStorageStats();
  }

  async getFilesByType(rootPath: string, fileType: string, limit: number = 1000): Promise<FileItem[]> {
    if (!this.isAvailable()) {
      return [];
    }
    return FileExplorerModule.getFilesByType(rootPath, fileType, limit);
  }

  async getRecentFiles(rootPath: string, limit: number = 50): Promise<FileItem[]> {
    if (!this.isAvailable()) {
      return [];
    }
    return FileExplorerModule.getRecentFiles(rootPath, limit);
  }

  async exists(path: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }
    return FileExplorerModule.exists(path);
  }

  async isDirectory(path: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }
    return FileExplorerModule.isDirectory(path);
  }

  async getMimeType(filename: string): Promise<string> {
    if (!this.isAvailable()) {
      return 'application/octet-stream';
    }
    return FileExplorerModule.getMimeTypeForFile(filename);
  }

  onFileSystemChange(callback: (event: FileSystemEvent) => void): () => void {
    if (!this.eventEmitter) {
      return () => {};
    }
    const subscription = this.eventEmitter.addListener('onFileSystemChange', callback);
    return () => subscription.remove();
  }

  async getAllFileCounts(forceRefresh: boolean = false): Promise<AllFileCounts> {
    if (!this.isAvailable()) {
      return {
        images: 0,
        videos: 0,
        audio: 0,
        documents: 0,
        apk: 0,
        zip: 0,
        downloads: 0,
        others: 0,
        timestamp: 0,
      };
    }
    return FileExplorerModule.getAllFileCounts(forceRefresh);
  }

  async clearFileCountsCache(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }
    return FileExplorerModule.clearFileCountsCache();
  }

  async readFileAsString(path: string): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('FileExplorer module is only available on Android');
    }
    return FileExplorerModule.readFileAsString(path);
  }

  async writeFileAsString(path: string, content: string): Promise<boolean> {
    if (!this.isAvailable()) {
      throw new Error('FileExplorer module is only available on Android');
    }
    return FileExplorerModule.writeFileAsString(path, content);
  }

  async appendToFile(path: string, content: string): Promise<boolean> {
    if (!this.isAvailable()) {
      throw new Error('FileExplorer module is only available on Android');
    }
    return FileExplorerModule.appendToFile(path, content);
  }

  async makeDirectory(path: string): Promise<boolean> {
    if (!this.isAvailable()) {
      throw new Error('FileExplorer module is only available on Android');
    }
    return FileExplorerModule.makeDirectory(path);
  }
}

export const nativeFileExplorer = new NativeFileExplorerService();
export default nativeFileExplorer;
