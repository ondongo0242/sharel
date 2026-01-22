import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { MockupDataService } from './MockupDataService';
import { nativeFileExplorer, AllFileCounts } from './NativeFileExplorer';

const CACHE_KEYS = {
  MEDIA_COUNTS: '@media_counts_cache',
  DOCUMENT_COUNTS: '@document_counts_cache',
  IMAGES_CACHE: '@images_cache',
  VIDEOS_CACHE: '@videos_cache',
  AUDIO_CACHE: '@audio_cache',
  LAST_REFRESH: '@media_last_refresh',
  ALL_FILE_COUNTS: '@all_file_counts_cache',
};

const CACHE_TTL = 5 * 60 * 1000;
const PAGE_SIZE = 30;
const INITIAL_PAGE_SIZE = 20;

export interface CachedMediaItem {
  id: string;
  uri: string;
  filename: string;
  mediaType: 'photo' | 'video' | 'audio';
  duration?: number;
  width?: number;
  height?: number;
  fileSize?: number;
  creationTime: number;
  modificationTime?: number;
  albumId?: string;
}

export interface MediaCounts {
  images: number;
  videos: number;
  audio: number;
}

export interface DocumentCounts {
  documents: number;
  apk: number;
  zip: number;
  others: number;
}

interface CacheData<T> {
  data: T;
  timestamp: number;
}

interface MediaCache {
  items: CachedMediaItem[];
  hasMore: boolean;
  endCursor?: string;
  timestamp: number;
}

class MediaCacheServiceClass {
  private countsCache: MediaCounts | null = null;
  private documentCountsCache: DocumentCounts | null = null;
  private allFileCountsCache: AllFileCounts | null = null;
  private lastCountsRefresh = 0;
  private mediaPermissionGranted = false;
  private permissionChecked = false;
  private loadingPromises: Map<string, Promise<any>> = new Map();
  private preloadComplete = false;
  private preloadPromise: Promise<void> | null = null;
  
  private photosCache: MediaCache | null = null;
  private videosCache: MediaCache | null = null;
  private audioCache: MediaCache | null = null;

  constructor() {
    this.preloadPromise = this.preloadFromStorage();
  }

  private async preloadFromStorage(): Promise<void> {
    if (Platform.OS === 'web') {
      this.preloadComplete = true;
      return;
    }

    try {
      const [countsCached] = await Promise.all([
        this.loadCacheFromStorage<MediaCounts>(CACHE_KEYS.MEDIA_COUNTS),
      ]);

      if (countsCached) {
        this.countsCache = countsCached;
        this.lastCountsRefresh = Date.now() - CACHE_TTL + 60000;
      }
    } catch (error) {
      console.log('Preload from storage error:', error);
    }
    
    this.preloadComplete = true;
  }

  async waitForPreload(): Promise<void> {
    if (this.preloadPromise) {
      await this.preloadPromise;
    }
  }

  async checkPermission(): Promise<boolean> {
    if (Platform.OS === 'web') {
      return true;
    }

    if (this.permissionChecked) {
      return this.mediaPermissionGranted;
    }

    try {
      const { status } = await MediaLibrary.getPermissionsAsync();
      this.mediaPermissionGranted = status === 'granted';
      this.permissionChecked = true;
      return this.mediaPermissionGranted;
    } catch (error) {
      console.error('Error checking media permission:', error);
      return false;
    }
  }

  async requestPermission(): Promise<boolean> {
    if (Platform.OS === 'web') {
      return true;
    }

    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      this.mediaPermissionGranted = status === 'granted';
      this.permissionChecked = true;
      return this.mediaPermissionGranted;
    } catch (error) {
      console.error('Error requesting media permission:', error);
      return false;
    }
  }

  async getMediaCounts(forceRefresh = false): Promise<MediaCounts> {
    if (!forceRefresh && this.countsCache && !this.preloadComplete) {
      return this.countsCache;
    }

    const cacheKey = 'media_counts';
    
    if (this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey)!;
    }

    const loadPromise = this._getMediaCountsInternal(forceRefresh);
    this.loadingPromises.set(cacheKey, loadPromise);

    try {
      const result = await loadPromise;
      return result;
    } finally {
      this.loadingPromises.delete(cacheKey);
    }
  }

  private async _getMediaCountsInternal(forceRefresh = false): Promise<MediaCounts> {
    if (Platform.OS === 'web') {
      return MockupDataService.getMediaCounts();
    }

    const now = Date.now();
    if (!forceRefresh && this.countsCache && (now - this.lastCountsRefresh) < CACHE_TTL) {
      return this.countsCache;
    }

    if (Platform.OS === 'android' && nativeFileExplorer.isAvailable()) {
      try {
        const counts = await this.getAllFileCountsNative(forceRefresh);
        if (counts.timestamp > 0) {
          this.countsCache = {
            images: counts.images,
            videos: counts.videos,
            audio: counts.audio,
          };
          return this.countsCache;
        }
      } catch (error) {
        console.log('Native media counts failed, falling back to MediaLibrary:', error);
      }
    }

    const hasPermission = await this.checkPermission();
    if (!hasPermission) {
      return { images: 0, videos: 0, audio: 0 };
    }

    try {
      const [imagesResult, videosResult, audioResult] = await Promise.all([
        MediaLibrary.getAssetsAsync({ mediaType: 'photo', first: 1 }),
        MediaLibrary.getAssetsAsync({ mediaType: 'video', first: 1 }),
        MediaLibrary.getAssetsAsync({ mediaType: 'audio', first: 1 }),
      ]);

      this.countsCache = {
        images: imagesResult.totalCount,
        videos: videosResult.totalCount,
        audio: audioResult.totalCount,
      };
      this.lastCountsRefresh = now;

      await this.saveCacheToStorage(CACHE_KEYS.MEDIA_COUNTS, this.countsCache);

      return this.countsCache;
    } catch (error) {
      console.error('Error getting media counts:', error);
      
      const cached = await this.loadCacheFromStorage<MediaCounts>(CACHE_KEYS.MEDIA_COUNTS);
      if (cached) {
        this.countsCache = cached;
        return cached;
      }

      return { images: 0, videos: 0, audio: 0 };
    }
  }

  async getDocumentCounts(forceRefresh = false): Promise<DocumentCounts> {
    if (Platform.OS === 'web') {
      return MockupDataService.getDocumentCounts();
    }

    const now = Date.now();
    if (!forceRefresh && this.documentCountsCache && (now - this.lastCountsRefresh) < CACHE_TTL) {
      return this.documentCountsCache;
    }

    if (Platform.OS === 'android' && nativeFileExplorer.isAvailable()) {
      try {
        const counts = await this.getAllFileCountsNative(forceRefresh);
        if (counts.timestamp > 0) {
          this.documentCountsCache = {
            documents: counts.documents,
            apk: counts.apk,
            zip: counts.zip,
            others: counts.others,
          };
          return this.documentCountsCache;
        }
      } catch (error) {
        console.log('Native document counts failed, falling back:', error);
      }
    }

    try {
      const cached = await this.loadCacheFromStorage<DocumentCounts>(CACHE_KEYS.DOCUMENT_COUNTS);
      if (cached) {
        this.documentCountsCache = cached;
        return cached;
      }
    } catch (error) {
      console.error('Error loading document counts cache:', error);
    }

    return { documents: 0, apk: 0, zip: 0, others: 0 };
  }

  async getAllFileCountsNative(forceRefresh = false): Promise<AllFileCounts> {
    const emptyResult: AllFileCounts = {
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
    
    if (Platform.OS !== 'android' || !nativeFileExplorer.isAvailable()) {
      return emptyResult;
    }

    const cacheKey = 'native_file_counts';
    
    if (this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey)!;
    }

    const now = Date.now();
    if (!forceRefresh && this.allFileCountsCache && 
        this.allFileCountsCache.timestamp > 0 && 
        (now - this.allFileCountsCache.timestamp) < CACHE_TTL) {
      return this.allFileCountsCache;
    }

    if (!forceRefresh && !this.allFileCountsCache) {
      try {
        const cached = await this.loadCacheFromStorage<AllFileCounts>(CACHE_KEYS.ALL_FILE_COUNTS);
        if (cached && cached.timestamp > 0 && (now - cached.timestamp) < CACHE_TTL * 2) {
          this.allFileCountsCache = cached;
          return cached;
        }
      } catch (error) {
        console.log('Error loading native counts from storage:', error);
      }
    }

    const loadPromise = nativeFileExplorer.getAllFileCounts(forceRefresh);
    this.loadingPromises.set(cacheKey, loadPromise);

    try {
      const counts = await loadPromise;
      
      if (!counts || counts.timestamp === 0) {
        this.allFileCountsCache = null;
        return emptyResult;
      }
      
      this.allFileCountsCache = counts;
      
      this.countsCache = {
        images: counts.images,
        videos: counts.videos,
        audio: counts.audio,
      };
      this.documentCountsCache = {
        documents: counts.documents,
        apk: counts.apk,
        zip: counts.zip,
        others: counts.others,
      };
      this.lastCountsRefresh = now;
      
      await this.saveCacheToStorage(CACHE_KEYS.ALL_FILE_COUNTS, counts);
      await this.saveCacheToStorage(CACHE_KEYS.MEDIA_COUNTS, this.countsCache);
      await this.saveCacheToStorage(CACHE_KEYS.DOCUMENT_COUNTS, this.documentCountsCache);
      
      return counts;
    } finally {
      this.loadingPromises.delete(cacheKey);
    }
  }

  async getPhotos(limit = PAGE_SIZE, after?: string, forceRefresh = false): Promise<{ items: CachedMediaItem[]; hasMore: boolean; endCursor?: string }> {
    if (Platform.OS === 'web') {
      const mockImages = MockupDataService.getImages();
      return {
        items: mockImages.map(img => ({
          id: img.id,
          uri: img.uri,
          filename: img.name,
          mediaType: 'photo' as const,
          width: img.width,
          height: img.height,
          fileSize: img.size,
          creationTime: img.createdAt,
        })),
        hasMore: false,
      };
    }

    const now = Date.now();
    if (!forceRefresh && !after && this.photosCache && (now - this.photosCache.timestamp) < CACHE_TTL) {
      return {
        items: this.photosCache.items,
        hasMore: this.photosCache.hasMore,
        endCursor: this.photosCache.endCursor,
      };
    }

    const hasPermission = await this.checkPermission();
    if (!hasPermission) {
      return { items: [], hasMore: false };
    }

    try {
      const result = await MediaLibrary.getAssetsAsync({
        mediaType: 'photo',
        first: limit,
        after,
        sortBy: [[MediaLibrary.SortBy.creationTime, false]],
      });

      const items: CachedMediaItem[] = result.assets.map(asset => ({
        id: asset.id,
        uri: asset.uri,
        filename: asset.filename,
        mediaType: 'photo' as const,
        width: asset.width,
        height: asset.height,
        fileSize: (asset as any).fileSize,
        creationTime: asset.creationTime,
      }));

      if (!after) {
        this.photosCache = {
          items,
          hasMore: result.hasNextPage,
          endCursor: result.endCursor,
          timestamp: now,
        };
      }

      return {
        items,
        hasMore: result.hasNextPage,
        endCursor: result.endCursor,
      };
    } catch (error) {
      console.error('Error getting photos:', error);
      return { items: [], hasMore: false };
    }
  }

  async getVideos(limit = PAGE_SIZE, after?: string, forceRefresh = false): Promise<{ items: CachedMediaItem[]; hasMore: boolean; endCursor?: string }> {
    if (Platform.OS === 'web') {
      const mockVideos = MockupDataService.getVideos();
      return {
        items: mockVideos.map(vid => ({
          id: vid.id,
          uri: vid.uri,
          filename: vid.name,
          mediaType: 'video' as const,
          duration: vid.duration,
          fileSize: vid.size,
          creationTime: vid.createdAt,
        })),
        hasMore: false,
      };
    }

    const now = Date.now();
    if (!forceRefresh && !after && this.videosCache && (now - this.videosCache.timestamp) < CACHE_TTL) {
      return {
        items: this.videosCache.items,
        hasMore: this.videosCache.hasMore,
        endCursor: this.videosCache.endCursor,
      };
    }

    const hasPermission = await this.checkPermission();
    if (!hasPermission) {
      return { items: [], hasMore: false };
    }

    try {
      const result = await MediaLibrary.getAssetsAsync({
        mediaType: 'video',
        first: limit,
        after,
        sortBy: [[MediaLibrary.SortBy.creationTime, false]],
      });

      const items: CachedMediaItem[] = result.assets.map(asset => ({
        id: asset.id,
        uri: asset.uri,
        filename: asset.filename,
        mediaType: 'video' as const,
        duration: asset.duration,
        fileSize: (asset as any).fileSize,
        creationTime: asset.creationTime,
      }));

      if (!after) {
        this.videosCache = {
          items,
          hasMore: result.hasNextPage,
          endCursor: result.endCursor,
          timestamp: now,
        };
      }

      return {
        items,
        hasMore: result.hasNextPage,
        endCursor: result.endCursor,
      };
    } catch (error) {
      console.error('Error getting videos:', error);
      return { items: [], hasMore: false };
    }
  }

  async getAudio(limit = PAGE_SIZE, after?: string, forceRefresh = false): Promise<{ items: CachedMediaItem[]; hasMore: boolean; endCursor?: string }> {
    if (Platform.OS === 'web') {
      const mockAudio = MockupDataService.getAudio();
      return {
        items: mockAudio.map(aud => ({
          id: aud.id,
          uri: aud.uri,
          filename: aud.name,
          mediaType: 'audio' as const,
          duration: aud.duration,
          fileSize: aud.size,
          creationTime: aud.createdAt,
        })),
        hasMore: false,
      };
    }

    const now = Date.now();
    if (!forceRefresh && !after && this.audioCache && (now - this.audioCache.timestamp) < CACHE_TTL) {
      return {
        items: this.audioCache.items,
        hasMore: this.audioCache.hasMore,
        endCursor: this.audioCache.endCursor,
      };
    }

    const hasPermission = await this.checkPermission();
    if (!hasPermission) {
      return { items: [], hasMore: false };
    }

    try {
      const result = await MediaLibrary.getAssetsAsync({
        mediaType: 'audio',
        first: limit,
        after,
        sortBy: [[MediaLibrary.SortBy.creationTime, false]],
      });

      const items: CachedMediaItem[] = result.assets.map(asset => ({
        id: asset.id,
        uri: asset.uri,
        filename: asset.filename,
        mediaType: 'audio' as const,
        duration: asset.duration,
        fileSize: (asset as any).fileSize,
        creationTime: asset.creationTime,
      }));

      if (!after) {
        this.audioCache = {
          items,
          hasMore: result.hasNextPage,
          endCursor: result.endCursor,
          timestamp: now,
        };
      }

      return {
        items,
        hasMore: result.hasNextPage,
        endCursor: result.endCursor,
      };
    } catch (error) {
      console.error('Error getting audio:', error);
      return { items: [], hasMore: false };
    }
  }

  async clearCache(): Promise<void> {
    this.countsCache = null;
    this.documentCountsCache = null;
    this.allFileCountsCache = null;
    this.lastCountsRefresh = 0;
    this.photosCache = null;
    this.videosCache = null;
    this.audioCache = null;
    
    try {
      await Promise.all([
        AsyncStorage.removeItem(CACHE_KEYS.MEDIA_COUNTS),
        AsyncStorage.removeItem(CACHE_KEYS.DOCUMENT_COUNTS),
        AsyncStorage.removeItem(CACHE_KEYS.IMAGES_CACHE),
        AsyncStorage.removeItem(CACHE_KEYS.VIDEOS_CACHE),
        AsyncStorage.removeItem(CACHE_KEYS.AUDIO_CACHE),
        AsyncStorage.removeItem(CACHE_KEYS.LAST_REFRESH),
      ]);
      
      if (nativeFileExplorer.isAvailable()) {
        await nativeFileExplorer.clearFileCountsCache();
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  clearPhotosCache(): void {
    this.photosCache = null;
  }

  clearVideosCache(): void {
    this.videosCache = null;
  }

  clearAudioCache(): void {
    this.audioCache = null;
  }

  clearCountsCache(): void {
    this.countsCache = null;
    this.lastCountsRefresh = 0;
  }

  isCacheValid(type: 'photos' | 'videos' | 'audio'): boolean {
    const now = Date.now();
    switch (type) {
      case 'photos':
        return this.photosCache !== null && (now - this.photosCache.timestamp) < CACHE_TTL;
      case 'videos':
        return this.videosCache !== null && (now - this.videosCache.timestamp) < CACHE_TTL;
      case 'audio':
        return this.audioCache !== null && (now - this.audioCache.timestamp) < CACHE_TTL;
      default:
        return false;
    }
  }

  appendToPhotosCache(items: CachedMediaItem[], hasMore: boolean, endCursor?: string): void {
    if (this.photosCache) {
      this.photosCache.items = [...this.photosCache.items, ...items];
      this.photosCache.hasMore = hasMore;
      this.photosCache.endCursor = endCursor;
    }
  }

  appendToVideosCache(items: CachedMediaItem[], hasMore: boolean, endCursor?: string): void {
    if (this.videosCache) {
      this.videosCache.items = [...this.videosCache.items, ...items];
      this.videosCache.hasMore = hasMore;
      this.videosCache.endCursor = endCursor;
    }
  }

  appendToAudioCache(items: CachedMediaItem[], hasMore: boolean, endCursor?: string): void {
    if (this.audioCache) {
      this.audioCache.items = [...this.audioCache.items, ...items];
      this.audioCache.hasMore = hasMore;
      this.audioCache.endCursor = endCursor;
    }
  }

  getCachedPhotos(): CachedMediaItem[] | null {
    return this.photosCache?.items ?? null;
  }

  getCachedVideos(): CachedMediaItem[] | null {
    return this.videosCache?.items ?? null;
  }

  getCachedAudio(): CachedMediaItem[] | null {
    return this.audioCache?.items ?? null;
  }

  private async saveCacheToStorage<T>(key: string, data: T): Promise<void> {
    try {
      const cacheData: CacheData<T> = {
        data,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(key, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error saving to cache:', error);
    }
  }

  private async loadCacheFromStorage<T>(key: string): Promise<T | null> {
    try {
      const stored = await AsyncStorage.getItem(key);
      if (stored) {
        const cacheData: CacheData<T> = JSON.parse(stored);
        if (Date.now() - cacheData.timestamp < CACHE_TTL * 2) {
          return cacheData.data;
        }
      }
    } catch (error) {
      console.error('Error loading from cache:', error);
    }
    return null;
  }
}

export const MediaCacheService = new MediaCacheServiceClass();
