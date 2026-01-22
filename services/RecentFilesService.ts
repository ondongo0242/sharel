import { Platform } from "react-native";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system";
import { MediaCacheService } from "./MediaCacheService";
import { MockupDataService } from "./MockupDataService";
import { nativeFileExplorer } from "./NativeFileExplorer";

export interface RecentFile {
  id: string;
  filename: string;
  uri: string;
  type: "image" | "video" | "audio" | "document";
  size: number;
  modificationTime: number;
  thumbnailUri?: string;
}

export interface AlbumWithFiles {
  id: string;
  title: string;
  assetCount: number;
  files: RecentFile[];
  latestDate: number;
  icon: string;
  color: string;
}

class RecentFilesService {
  private hasPermission: boolean = false;
  private initialized: boolean = false;
  private lastMediaCountsRefresh: number = 0;
  private cachedMediaCounts: { images: number; videos: number; audio: number } | null = null;
  private cachedDocumentCounts: { documents: number; apk: number; zip: number; others: number } | null = null;
  private loadingMediaCounts: Promise<{ images: number; videos: number; audio: number }> | null = null;
  private loadingDocumentCounts: Promise<{ documents: number; apk: number; zip: number; others: number }> | null = null;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    if (Platform.OS === 'web') {
      await MockupDataService.initialize();
      this.initialized = true;
      return;
    }

    const hasPermission = await MediaCacheService.checkPermission();
    this.hasPermission = hasPermission;
    this.initialized = true;
  }

  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === "web") {
      return true;
    }

    try {
      const hasPermission = await MediaCacheService.requestPermission();
      this.hasPermission = hasPermission;
      return hasPermission;
    } catch (error) {
      console.error("Error requesting media permissions:", error);
      return false;
    }
  }

  async getRecentFiles(limit: number = 10): Promise<RecentFile[]> {
    if (Platform.OS === 'web') {
      return this.getWebMockRecentFiles(limit);
    }

    if (!this.hasPermission) {
      const granted = await this.requestPermissions();
      if (!granted) {
        return [];
      }
    }

    try {
      const recentFiles: RecentFile[] = [];
      const seenIds = new Set<string>();
      const fetchCount = Math.max(limit * 3, 30);

      const fetchFromAlbums = async (): Promise<MediaLibrary.Asset[]> => {
        const albumAssets: MediaLibrary.Asset[] = [];
        try {
          const albums = await MediaLibrary.getAlbumsAsync();
          const priorityAlbumNames = ['Camera', 'DCIM', 'Screenshots', 'Download', 'Downloads', 'Pictures', 'WhatsApp Images'];
          
          for (const albumName of priorityAlbumNames) {
            const album = albums.find(a => 
              a.title.toLowerCase() === albumName.toLowerCase() ||
              a.title.toLowerCase().includes(albumName.toLowerCase())
            );
            
            if (album) {
              try {
                const assets = await MediaLibrary.getAssetsAsync({
                  album: album,
                  sortBy: [[MediaLibrary.SortBy.modificationTime, false]],
                  first: 10,
                  mediaType: ["photo", "video"],
                });
                albumAssets.push(...assets.assets);
              } catch (e) {
                console.log(`Error fetching from album ${albumName}:`, e);
              }
            }
          }
        } catch (e) {
          console.log("Error fetching albums:", e);
        }
        return albumAssets;
      };

      const [photosResult, videosResult, audioResult, albumAssets] = await Promise.all([
        MediaLibrary.getAssetsAsync({
          mediaType: ["photo"],
          sortBy: [[MediaLibrary.SortBy.modificationTime, false]],
          first: fetchCount,
        }),
        MediaLibrary.getAssetsAsync({
          mediaType: ["video"],
          sortBy: [[MediaLibrary.SortBy.modificationTime, false]],
          first: Math.floor(fetchCount / 2),
        }),
        MediaLibrary.getAssetsAsync({
          mediaType: ["audio"],
          sortBy: [[MediaLibrary.SortBy.modificationTime, false]],
          first: Math.floor(fetchCount / 3),
        }),
        fetchFromAlbums(),
      ]);

      const addAsset = (asset: MediaLibrary.Asset, type: "image" | "video" | "audio") => {
        if (seenIds.has(asset.id)) return;
        seenIds.add(asset.id);
        
        const modTime = asset.modificationTime || asset.creationTime || Date.now();
        
        recentFiles.push({
          id: asset.id,
          filename: asset.filename,
          uri: asset.uri,
          type,
          size: 0,
          modificationTime: modTime,
          thumbnailUri: type !== "audio" ? asset.uri : undefined,
        });
      };

      for (const asset of albumAssets) {
        const type = asset.mediaType === "video" ? "video" : "image";
        addAsset(asset, type);
      }

      for (const asset of photosResult.assets) {
        addAsset(asset, "image");
      }

      for (const asset of videosResult.assets) {
        addAsset(asset, "video");
      }

      for (const asset of audioResult.assets) {
        addAsset(asset, "audio");
      }

      recentFiles.sort((a, b) => b.modificationTime - a.modificationTime);

      return recentFiles.slice(0, limit);
    } catch (error) {
      console.error("Error loading recent files:", error);
      return [];
    }
  }

  private getWebMockRecentFiles(limit: number): RecentFile[] {
    const images = MockupDataService.getImages();
    const videos = MockupDataService.getVideos();
    const audio = MockupDataService.getAudio();

    const recentFiles: RecentFile[] = [
      ...images.slice(0, 3).map(img => ({
        id: img.id,
        filename: img.name,
        uri: img.uri,
        type: "image" as const,
        size: img.size,
        modificationTime: img.createdAt,
        thumbnailUri: img.uri,
      })),
      ...videos.slice(0, 2).map(vid => ({
        id: vid.id,
        filename: vid.name,
        uri: vid.uri,
        type: "video" as const,
        size: vid.size,
        modificationTime: vid.createdAt,
        thumbnailUri: vid.thumbnail,
      })),
      ...audio.slice(0, 2).map(aud => ({
        id: aud.id,
        filename: aud.name,
        uri: aud.uri,
        type: "audio" as const,
        size: aud.size,
        modificationTime: aud.createdAt,
      })),
    ];

    recentFiles.sort((a, b) => b.modificationTime - a.modificationTime);
    return recentFiles.slice(0, limit);
  }

  async getMediaCounts(): Promise<{
    images: number;
    videos: number;
    audio: number;
  }> {
    if (this.loadingMediaCounts) {
      return this.loadingMediaCounts;
    }

    const now = Date.now();
    if (this.cachedMediaCounts && (now - this.lastMediaCountsRefresh) < 30000) {
      return this.cachedMediaCounts;
    }

    this.loadingMediaCounts = this._loadMediaCounts();
    
    try {
      const counts = await this.loadingMediaCounts;
      this.cachedMediaCounts = counts;
      this.lastMediaCountsRefresh = now;
      return counts;
    } finally {
      this.loadingMediaCounts = null;
    }
  }

  private async _loadMediaCounts(): Promise<{ images: number; videos: number; audio: number }> {
    if (Platform.OS === 'web') {
      return MockupDataService.getMediaCounts();
    }

    try {
      return await MediaCacheService.getMediaCounts();
    } catch (error) {
      console.error("Error getting media counts:", error);
      return { images: 0, videos: 0, audio: 0 };
    }
  }

  async getDocumentCounts(): Promise<{
    documents: number;
    apk: number;
    zip: number;
    others: number;
  }> {
    if (this.loadingDocumentCounts) {
      return this.loadingDocumentCounts;
    }

    const now = Date.now();
    if (this.cachedDocumentCounts && (now - this.lastMediaCountsRefresh) < 30000) {
      return this.cachedDocumentCounts;
    }

    this.loadingDocumentCounts = this._loadDocumentCounts();
    
    try {
      const counts = await this.loadingDocumentCounts;
      this.cachedDocumentCounts = counts;
      return counts;
    } finally {
      this.loadingDocumentCounts = null;
    }
  }

  private async _loadDocumentCounts(): Promise<{ documents: number; apk: number; zip: number; others: number }> {
    if (Platform.OS === "web") {
      return MockupDataService.getDocumentCounts();
    }

    try {
      if (nativeFileExplorer.isAvailable()) {
        const counts = await nativeFileExplorer.getAllFileCounts(false);
        return {
          documents: counts.documents,
          apk: counts.apk,
          zip: counts.zip,
          others: counts.others,
        };
      }

      return { documents: 0, apk: 0, zip: 0, others: 0 };
    } catch (error) {
      console.error("Error getting document counts:", error);
      return { documents: 0, apk: 0, zip: 0, others: 0 };
    }
  }

  async getAllRecentFiles(limit: number = 10): Promise<RecentFile[]> {
    try {
      const mediaLimit = Math.max(Math.ceil(limit * 0.8), limit - 2);
      const docLimit = Math.max(Math.floor(limit * 0.2), 2);
      
      const [mediaFiles, documentFiles] = await Promise.all([
        this.getRecentFiles(mediaLimit + 5),
        this.getRecentDocuments(docLimit + 2),
      ]);

      const allFiles = [...mediaFiles, ...documentFiles];
      allFiles.sort((a, b) => b.modificationTime - a.modificationTime);

      return allFiles.slice(0, limit);
    } catch (error) {
      console.error("Error getting all recent files:", error);
      return [];
    }
  }

  private async getRecentDocuments(limit: number = 5): Promise<RecentFile[]> {
    if (Platform.OS === "web") {
      const docs = MockupDataService.getDocuments();
      return docs.slice(0, limit).map(doc => ({
        id: doc.id,
        filename: doc.name,
        uri: doc.uri,
        type: "document" as const,
        size: doc.size,
        modificationTime: doc.createdAt,
      }));
    }

    try {
      const documentsDir = FileSystem.documentDirectory;
      if (!documentsDir) return [];

      const files = await FileSystem.readDirectoryAsync(documentsDir);
      const recentDocs: RecentFile[] = [];

      for (const file of files.slice(0, limit)) {
        try {
          const fileUri = documentsDir + file;
          const fileInfo = await FileSystem.getInfoAsync(fileUri);
          
          if (fileInfo.exists && !fileInfo.isDirectory) {
            recentDocs.push({
              id: file,
              filename: file,
              uri: fileUri,
              type: "document",
              size: fileInfo.size || 0,
              modificationTime: fileInfo.modificationTime || 0,
            });
          }
        } catch (error) {
          console.log("Error reading file info:", error);
        }
      }

      return recentDocs;
    } catch (error) {
      console.error("Error getting recent documents:", error);
      return [];
    }
  }

  clearCache(): void {
    this.cachedMediaCounts = null;
    this.cachedDocumentCounts = null;
    this.lastMediaCountsRefresh = 0;
  }

  async getRecentFilesGroupedByAlbum(maxAlbums: number = 10, filesPerAlbum: number = 10): Promise<AlbumWithFiles[]> {
    if (Platform.OS === 'web') {
      return this.getWebMockAlbums();
    }

    if (!this.hasPermission) {
      const granted = await this.requestPermissions();
      if (!granted) {
        return [];
      }
    }

    try {
      const albums = await MediaLibrary.getAlbumsAsync();
      
      const albumColorMap: { [key: string]: { color: string; icon: string } } = {
        'whatsapp': { color: '#25D366', icon: 'message-circle' },
        'telegram': { color: '#0088CC', icon: 'send' },
        'screenshot': { color: '#2ECC71', icon: 'image' },
        'camera': { color: '#3B82F6', icon: 'camera' },
        'dcim': { color: '#3B82F6', icon: 'camera' },
        'download': { color: '#5C7CFA', icon: 'download' },
        'pictures': { color: '#9B59B6', icon: 'image' },
        'facebook': { color: '#1877F2', icon: 'facebook' },
        'instagram': { color: '#E4405F', icon: 'instagram' },
        'twitter': { color: '#1DA1F2', icon: 'twitter' },
        'tiktok': { color: '#000000', icon: 'play-circle' },
        'snapchat': { color: '#FFFC00', icon: 'camera' },
        'music': { color: '#FF6B6B', icon: 'music' },
        'video': { color: '#9B59B6', icon: 'video' },
        'movies': { color: '#9B59B6', icon: 'film' },
        'documents': { color: '#F39C12', icon: 'file-text' },
      };

      const getAlbumStyle = (title: string): { color: string; icon: string } => {
        const lowerTitle = title.toLowerCase();
        for (const [key, style] of Object.entries(albumColorMap)) {
          if (lowerTitle.includes(key)) {
            return style;
          }
        }
        return { color: '#64748B', icon: 'folder' };
      };

      const albumsWithFiles: AlbumWithFiles[] = [];

      const albumsToFetch = albums
        .filter(album => album.assetCount > 0)
        .sort((a, b) => b.assetCount - a.assetCount)
        .slice(0, maxAlbums + 5);

      const albumPromises = albumsToFetch.map(async (album) => {
        try {
          const assets = await MediaLibrary.getAssetsAsync({
            album: album,
            sortBy: [[MediaLibrary.SortBy.modificationTime, false]],
            first: filesPerAlbum,
            mediaType: ["photo", "video"],
          });

          if (assets.assets.length === 0) return null;

          const style = getAlbumStyle(album.title);
          
          const files: RecentFile[] = assets.assets.map(asset => ({
            id: asset.id,
            filename: asset.filename,
            uri: asset.uri,
            type: asset.mediaType === "video" ? "video" as const : "image" as const,
            size: 0,
            modificationTime: asset.modificationTime || asset.creationTime || Date.now(),
            thumbnailUri: asset.uri,
          }));

          const latestDate = Math.max(...files.map(f => f.modificationTime));

          return {
            id: album.id,
            title: album.title,
            assetCount: album.assetCount,
            files,
            latestDate,
            icon: style.icon,
            color: style.color,
          };
        } catch (e) {
          console.log(`Error fetching album ${album.title}:`, e);
          return null;
        }
      });

      const results = await Promise.all(albumPromises);
      
      for (const result of results) {
        if (result) {
          albumsWithFiles.push(result);
        }
      }

      albumsWithFiles.sort((a, b) => b.latestDate - a.latestDate);

      return albumsWithFiles.slice(0, maxAlbums);
    } catch (error) {
      console.error("Error loading albums with files:", error);
      return [];
    }
  }

  private getWebMockAlbums(): AlbumWithFiles[] {
    const images = MockupDataService.getImages();
    const videos = MockupDataService.getVideos();

    return [
      {
        id: 'screenshots',
        title: 'Screenshots',
        assetCount: 12,
        files: images.slice(0, 4).map(img => ({
          id: img.id,
          filename: img.name,
          uri: img.uri,
          type: 'image' as const,
          size: img.size,
          modificationTime: img.createdAt,
          thumbnailUri: img.uri,
        })),
        latestDate: Date.now(),
        icon: 'image',
        color: '#2ECC71',
      },
      {
        id: 'whatsapp',
        title: 'WhatsApp Images',
        assetCount: 156,
        files: images.slice(0, 4).map(img => ({
          id: 'wa_' + img.id,
          filename: img.name,
          uri: img.uri,
          type: 'image' as const,
          size: img.size,
          modificationTime: img.createdAt - 3600000,
          thumbnailUri: img.uri,
        })),
        latestDate: Date.now() - 3600000,
        icon: 'message-circle',
        color: '#25D366',
      },
      {
        id: 'telegram',
        title: 'Telegram',
        assetCount: 45,
        files: images.slice(0, 3).map(img => ({
          id: 'tg_' + img.id,
          filename: img.name,
          uri: img.uri,
          type: 'image' as const,
          size: img.size,
          modificationTime: img.createdAt - 7200000,
          thumbnailUri: img.uri,
        })),
        latestDate: Date.now() - 7200000,
        icon: 'send',
        color: '#0088CC',
      },
      {
        id: 'camera',
        title: 'Camera',
        assetCount: 234,
        files: [...images.slice(0, 2), ...videos.slice(0, 2)].map((item, index) => ({
          id: 'cam_' + item.id,
          filename: item.name,
          uri: item.uri,
          type: index < 2 ? 'image' as const : 'video' as const,
          size: item.size,
          modificationTime: item.createdAt - 86400000,
          thumbnailUri: item.uri,
        })),
        latestDate: Date.now() - 86400000,
        icon: 'camera',
        color: '#3B82F6',
      },
      {
        id: 'download',
        title: 'Download',
        assetCount: 28,
        files: images.slice(0, 4).map(img => ({
          id: 'dl_' + img.id,
          filename: img.name,
          uri: img.uri,
          type: 'image' as const,
          size: img.size,
          modificationTime: img.createdAt - 172800000,
          thumbnailUri: img.uri,
        })),
        latestDate: Date.now() - 172800000,
        icon: 'download',
        color: '#5C7CFA',
      },
    ];
  }
}

export default new RecentFilesService();
