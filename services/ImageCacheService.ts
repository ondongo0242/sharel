import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from './LoggerService';
import { nativeFileExplorer } from './NativeFileExplorer';
import { nativeImageManipulator } from './NativeImageManipulator';

interface CacheEntry {
  uri: string;
  size: number;
  lastAccessed: number;
  createdAt: number;
}

interface CacheMetadata {
  entries: Record<string, CacheEntry>;
  totalSize: number;
  lastCleanup: number;
}

interface ThumbnailOptions {
  width: number;
  height: number;
  quality?: number;
}

const CACHE_CONFIG = {
  MEMORY_CACHE_SIZE: 100,
  DISK_CACHE_MAX_SIZE: 200 * 1024 * 1024,
  DISK_CACHE_TARGET_SIZE: 150 * 1024 * 1024,
  THUMBNAIL_QUALITY: 0.7,
  CLEANUP_INTERVAL: 2 * 60 * 1000,
  CACHE_METADATA_KEY: '@image_cache_metadata_v2',
  DEFAULT_THUMBNAIL_SIZE: { width: 150, height: 150 },
  AGGRESSIVE_CLEANUP_THRESHOLD: 0.9,
  LRU_BATCH_SIZE: 20,
  MAX_CONCURRENT_OPERATIONS: 3,
};

class ImageCacheServiceClass {
  private memoryCache: Map<string, string> = new Map();
  private memoryCacheOrder: string[] = [];
  private diskCachePath: string = '';
  private thumbnailCachePath: string = '';
  private metadata: CacheMetadata = {
    entries: {},
    totalSize: 0,
    lastCleanup: 0,
  };
  private isInitialized = false;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private pendingOperations: Map<string, Promise<string | null>> = new Map();
  private isCleaningUp = false;
  private cleanupLock: Promise<void> = Promise.resolve();

  async initialize(): Promise<void> {
    if (this.isInitialized || Platform.OS === 'web') return;

    try {
      logger.info('ImageCache', 'Initializing image cache service');

      if (Platform.OS === 'android' && nativeFileExplorer.isAvailable()) {
        const rootPath = await nativeFileExplorer.getRootPath();
        this.diskCachePath = `/data/data/${require('expo-constants').default?.expoConfig?.android?.package || 'com.sharel.app'}/cache/image_cache/`;
        this.thumbnailCachePath = `/data/data/${require('expo-constants').default?.expoConfig?.android?.package || 'com.sharel.app'}/cache/thumbnails/`;
      }

      await this.ensureDirectories();
      await this.loadMetadata();
      this.startCleanupTimer();

      this.isInitialized = true;
      logger.info('ImageCache', 'Image cache initialized', {
        diskCachePath: this.diskCachePath,
        totalCacheSize: this.formatSize(this.metadata.totalSize),
        entriesCount: Object.keys(this.metadata.entries).length,
      });
    } catch (error) {
      logger.error('ImageCache', 'Failed to initialize image cache', error);
    }
  }

  private async ensureDirectories(): Promise<void> {
    try {
      if (Platform.OS === 'android' && nativeFileExplorer && nativeFileExplorer.isAvailable && nativeFileExplorer.isAvailable()) {
        const diskExists = await nativeFileExplorer.exists(this.diskCachePath);
        if (!diskExists) {
          await nativeFileExplorer.makeDirectory(this.diskCachePath);
          logger.debug('ImageCache', 'Created disk cache directory');
        }

        const thumbExists = await nativeFileExplorer.exists(this.thumbnailCachePath);
        if (!thumbExists) {
          await nativeFileExplorer.makeDirectory(this.thumbnailCachePath);
          logger.debug('ImageCache', 'Created thumbnail cache directory');
        }
      }
    } catch (error) {
      logger.error('ImageCache', 'Failed to ensure directories', error);
    }
  }

  private async loadMetadata(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(CACHE_CONFIG.CACHE_METADATA_KEY);
      if (stored) {
        this.metadata = JSON.parse(stored);
        await this.validateMetadata();
      }
    } catch (error) {
      logger.error('ImageCache', 'Failed to load metadata', error);
      this.metadata = { entries: {}, totalSize: 0, lastCleanup: 0 };
    }
  }

  private async saveMetadata(): Promise<void> {
    try {
      await AsyncStorage.setItem(CACHE_CONFIG.CACHE_METADATA_KEY, JSON.stringify(this.metadata));
    } catch (error) {
      logger.error('ImageCache', 'Failed to save metadata', error);
    }
  }

  private async validateMetadata(): Promise<void> {
    const invalidKeys: string[] = [];
    let recalculatedSize = 0;

    for (const [key, entry] of Object.entries(this.metadata.entries)) {
      try {
        if (Platform.OS === 'android' && nativeFileExplorer.isAvailable()) {
          const exists = await nativeFileExplorer.exists(entry.uri);
          if (!exists) {
            invalidKeys.push(key);
          } else {
            recalculatedSize += entry.size;
          }
        } else {
          invalidKeys.push(key);
        }
      } catch {
        invalidKeys.push(key);
      }
    }

    if (invalidKeys.length > 0) {
      invalidKeys.forEach(key => delete this.metadata.entries[key]);
      this.metadata.totalSize = recalculatedSize;
      await this.saveMetadata();
      logger.info('ImageCache', 'Cleaned invalid entries', { removed: invalidKeys.length });
    }
  }

  private generateCacheKey(uri: string, options?: ThumbnailOptions): string {
    const base = uri.replace(/[^a-zA-Z0-9]/g, '_').slice(-100);
    if (options) {
      return `${base}_${options.width}x${options.height}`;
    }
    return base;
  }

  getFromMemoryCache(uri: string): string | null {
    const key = this.generateCacheKey(uri);
    const cached = this.memoryCache.get(key);
    
    if (cached) {
      const index = this.memoryCacheOrder.indexOf(key);
      if (index > -1) {
        this.memoryCacheOrder.splice(index, 1);
        this.memoryCacheOrder.push(key);
      }
      logger.debug('ImageCache', 'Memory cache hit', { key });
      return cached;
    }
    
    return null;
  }

  addToMemoryCache(uri: string, cachedUri: string): void {
    const key = this.generateCacheKey(uri);
    
    while (this.memoryCache.size >= CACHE_CONFIG.MEMORY_CACHE_SIZE) {
      const oldestKey = this.memoryCacheOrder.shift();
      if (oldestKey) {
        this.memoryCache.delete(oldestKey);
      }
    }

    this.memoryCache.set(key, cachedUri);
    this.memoryCacheOrder.push(key);
  }

  async getFromDiskCache(uri: string): Promise<string | null> {
    if (Platform.OS === 'web') return null;

    const key = this.generateCacheKey(uri);
    const entry = this.metadata.entries[key];

    if (entry) {
      try {
        if (Platform.OS === 'android' && nativeFileExplorer.isAvailable()) {
          const exists = await nativeFileExplorer.exists(entry.uri);
          if (exists) {
            entry.lastAccessed = Date.now();
            logger.debug('ImageCache', 'Disk cache hit', { key });
            return entry.uri;
          }
        }
      } catch {
        delete this.metadata.entries[key];
      }
    }

    return null;
  }

  async cacheImage(sourceUri: string): Promise<string | null> {
    if (Platform.OS === 'web') return sourceUri;

    const key = this.generateCacheKey(sourceUri);

    if (this.pendingOperations.has(key)) {
      return this.pendingOperations.get(key)!;
    }

    const operation = this.performCacheImage(sourceUri, key);
    this.pendingOperations.set(key, operation);

    try {
      const result = await operation;
      return result;
    } finally {
      this.pendingOperations.delete(key);
    }
  }

  private async performCacheImage(sourceUri: string, key: string): Promise<string | null> {
    try {
      const memCached = this.getFromMemoryCache(sourceUri);
      if (memCached) return memCached;

      const diskCached = await this.getFromDiskCache(sourceUri);
      if (diskCached) {
        this.addToMemoryCache(sourceUri, diskCached);
        return diskCached;
      }

      if (!sourceUri.startsWith('http://') && !sourceUri.startsWith('https://')) {
        this.addToMemoryCache(sourceUri, sourceUri);
        return sourceUri;
      }

      const destPath = `${this.diskCachePath}${key}.jpg`;

      try {
        // Fallback for fetch in environments where it might not be globally available
        const fetchApi = typeof fetch !== 'undefined' ? fetch : (typeof global.fetch !== 'undefined' ? global.fetch : null);
        
        if (!fetchApi) {
          logger.warn('ImageCache', 'fetch is undefined, using source directly');
          return sourceUri;
        }
        
        const response = await fetchApi(sourceUri);
        if (response.ok) {
          const blob = await response.blob();
          const size = blob.size;

          this.metadata.entries[key] = {
            uri: destPath,
            size,
            lastAccessed: Date.now(),
            createdAt: Date.now(),
          };
          this.metadata.totalSize += size;

          await this.saveMetadata();
          this.addToMemoryCache(sourceUri, sourceUri);

          logger.debug('ImageCache', 'Image cached to memory', {
            key,
            size: this.formatSize(size),
          });

          if (this.metadata.totalSize > CACHE_CONFIG.DISK_CACHE_MAX_SIZE) {
            this.scheduleCleanup();
          }

          return sourceUri;
        }
      } catch (fetchError) {
        logger.debug('ImageCache', 'Fetch failed, using source directly', { sourceUri });
      }

      return sourceUri;
    } catch (error) {
      logger.error('ImageCache', 'Failed to cache image', { sourceUri, error });
      return sourceUri;
    }
  }

  async generateThumbnail(
    sourceUri: string,
    options: ThumbnailOptions = CACHE_CONFIG.DEFAULT_THUMBNAIL_SIZE
  ): Promise<string | null> {
    if (Platform.OS === 'web') return sourceUri;

    const key = this.generateCacheKey(sourceUri, options);

    if (this.pendingOperations.has(key)) {
      return this.pendingOperations.get(key)!;
    }

    const operation = this.performGenerateThumbnail(sourceUri, key, options);
    this.pendingOperations.set(key, operation);

    try {
      const result = await operation;
      return result;
    } finally {
      this.pendingOperations.delete(key);
    }
  }

  private async performGenerateThumbnail(
    sourceUri: string,
    key: string,
    options: ThumbnailOptions
  ): Promise<string | null> {
    try {
      const memCached = this.memoryCache.get(key);
      if (memCached) return memCached;

      const entry = this.metadata.entries[key];
      if (entry && Platform.OS === 'android' && nativeFileExplorer.isAvailable()) {
        const exists = await nativeFileExplorer.exists(entry.uri);
        if (exists) {
          entry.lastAccessed = Date.now();
          this.addToMemoryCache(sourceUri, entry.uri);
          return entry.uri;
        }
      }

      if (Platform.OS === 'android' && nativeImageManipulator.isAvailable()) {
        try {
          const result = await nativeImageManipulator.resize(sourceUri, options.width, options.height);

          const destPath = `${this.thumbnailCachePath}${key}.jpg`;
          if (nativeFileExplorer.isAvailable()) {
            await nativeFileExplorer.copyFile(result.uri, destPath);
          }

          const size = 0;

          this.metadata.entries[key] = {
            uri: result.uri,
            size,
            lastAccessed: Date.now(),
            createdAt: Date.now(),
          };
          this.metadata.totalSize += size;

          await this.saveMetadata();
          this.memoryCache.set(key, result.uri);
          this.memoryCacheOrder.push(key);

          logger.debug('ImageCache', 'Thumbnail generated via native', {
            key,
            dimensions: `${options.width}x${options.height}`,
          });

          return result.uri;
        } catch (nativeError) {
          logger.warn('ImageCache', 'Native thumbnail generation failed', { error: nativeError });
        }
      }

      return sourceUri;
    } catch (error) {
      logger.error('ImageCache', 'Failed to generate thumbnail', { sourceUri, error });
      return sourceUri;
    }
  }

  async preloadImages(uris: string[]): Promise<void> {
    logger.info('ImageCache', 'Preloading images', { count: uris.length });

    const batchSize = 5;
    for (let i = 0; i < uris.length; i += batchSize) {
      const batch = uris.slice(i, i + batchSize);
      await Promise.all(batch.map(uri => this.cacheImage(uri)));
    }

    logger.info('ImageCache', 'Preloading complete');
  }

  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, CACHE_CONFIG.CLEANUP_INTERVAL);
  }

  private scheduleCleanup(): void {
    setTimeout(() => this.performCleanup(), 1000);
  }

  private async performCleanup(): Promise<void> {
    if (this.isCleaningUp) return;
    if (this.metadata.totalSize <= CACHE_CONFIG.DISK_CACHE_TARGET_SIZE) return;

    await this.cleanupLock;
    
    let resolveCleanup: () => void;
    this.cleanupLock = new Promise(resolve => { resolveCleanup = resolve; });
    
    this.isCleaningUp = true;
    const startTime = Date.now();
    
    try {
      const usageRatio = this.metadata.totalSize / CACHE_CONFIG.DISK_CACHE_MAX_SIZE;
      const isAggressive = usageRatio >= CACHE_CONFIG.AGGRESSIVE_CLEANUP_THRESHOLD;
      
      logger.info('ImageCache', `Starting ${isAggressive ? 'aggressive' : 'normal'} cache cleanup`, {
        currentSize: this.formatSize(this.metadata.totalSize),
        targetSize: this.formatSize(CACHE_CONFIG.DISK_CACHE_TARGET_SIZE),
        usagePercent: Math.round(usageRatio * 100),
      });

      const entries = Object.entries(this.metadata.entries).sort(
        ([, a], [, b]) => a.lastAccessed - b.lastAccessed
      );

      let freedSize = 0;
      const toDelete: string[] = [];
      const targetSize = isAggressive 
        ? CACHE_CONFIG.DISK_CACHE_TARGET_SIZE * 0.7 
        : CACHE_CONFIG.DISK_CACHE_TARGET_SIZE;

      for (const [key, entry] of entries) {
        if (this.metadata.totalSize - freedSize <= targetSize) break;
        
        try {
          if (Platform.OS === 'android' && nativeFileExplorer.isAvailable()) {
            await nativeFileExplorer.deleteFile(entry.uri);
          }
          freedSize += entry.size;
          toDelete.push(key);
        } catch (error) {
          logger.debug('ImageCache', 'Failed to delete entry', { key });
        }
      }

      toDelete.forEach(key => {
        delete this.metadata.entries[key];
        this.memoryCache.delete(key);
        const orderIndex = this.memoryCacheOrder.indexOf(key);
        if (orderIndex > -1) {
          this.memoryCacheOrder.splice(orderIndex, 1);
        }
      });

      this.metadata.totalSize -= freedSize;
      this.metadata.lastCleanup = Date.now();
      await this.saveMetadata();

      const duration = Date.now() - startTime;
      logger.info('ImageCache', 'Cache cleanup complete', {
        freedSize: this.formatSize(freedSize),
        removedEntries: toDelete.length,
        newSize: this.formatSize(this.metadata.totalSize),
        durationMs: duration,
      });
    } finally {
      this.isCleaningUp = false;
      resolveCleanup!();
    }
  }

  async clearCache(): Promise<void> {
    try {
      logger.info('ImageCache', 'Clearing all cache');

      this.memoryCache.clear();
      this.memoryCacheOrder = [];

      if (Platform.OS === 'android' && nativeFileExplorer.isAvailable()) {
        try {
          await nativeFileExplorer.deleteFile(this.diskCachePath);
          await nativeFileExplorer.deleteFile(this.thumbnailCachePath);
        } catch {
        }
        await this.ensureDirectories();
      }

      this.metadata = {
        entries: {},
        totalSize: 0,
        lastCleanup: Date.now(),
      };
      await this.saveMetadata();

      logger.info('ImageCache', 'Cache cleared');
    } catch (error) {
      logger.error('ImageCache', 'Failed to clear cache', error);
    }
  }

  async getCacheStats(): Promise<{
    memoryEntries: number;
    diskEntries: number;
    diskSize: number;
    diskSizeFormatted: string;
    maxSize: number;
    maxSizeFormatted: string;
    usagePercent: number;
  }> {
    return {
      memoryEntries: this.memoryCache.size,
      diskEntries: Object.keys(this.metadata.entries).length,
      diskSize: this.metadata.totalSize,
      diskSizeFormatted: this.formatSize(this.metadata.totalSize),
      maxSize: CACHE_CONFIG.DISK_CACHE_MAX_SIZE,
      maxSizeFormatted: this.formatSize(CACHE_CONFIG.DISK_CACHE_MAX_SIZE),
      usagePercent: Math.round((this.metadata.totalSize / CACHE_CONFIG.DISK_CACHE_MAX_SIZE) * 100),
    };
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  }

  async setMaxCacheSize(sizeInMB: number): Promise<void> {
    CACHE_CONFIG.DISK_CACHE_MAX_SIZE = sizeInMB * 1024 * 1024;
    CACHE_CONFIG.DISK_CACHE_TARGET_SIZE = (sizeInMB * 0.8) * 1024 * 1024;
    
    logger.info('ImageCache', 'Max cache size updated', {
      maxSize: this.formatSize(CACHE_CONFIG.DISK_CACHE_MAX_SIZE),
    });

    if (this.metadata.totalSize > CACHE_CONFIG.DISK_CACHE_MAX_SIZE) {
      await this.performCleanup();
    }
  }

  cleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.memoryCache.clear();
    this.memoryCacheOrder = [];
    this.isInitialized = false;
    logger.info('ImageCache', 'Image cache service cleaned up');
  }
}

export const imageCacheService = new ImageCacheServiceClass();
export default imageCacheService;
