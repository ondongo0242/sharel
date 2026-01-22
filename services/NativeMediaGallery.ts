import { NativeModules, Platform } from 'react-native';

const { MediaGalleryModule } = NativeModules;

export interface MediaItem {
  id: string;
  uri: string;
  path: string;
  filename: string;
  fileSize: number;
  creationTime: number;
  mimeType: string;
  mediaType: 'image' | 'video' | 'audio';
  duration?: number;
  width?: number;
  height?: number;
  artist?: string;
  album?: string;
}

export interface Album {
  id: string;
  name: string;
  count: number;
  thumbnailUri: string;
}

export interface MediaCounts {
  images: number;
  videos: number;
  audio: number;
  timestamp: number;
}

class NativeMediaGalleryService {
  isAvailable(): boolean {
    return Platform.OS === 'android' && !!MediaGalleryModule;
  }

  async getImages(limit: number = 100, offset: number = 0): Promise<MediaItem[]> {
    if (!this.isAvailable()) {
      return [];
    }
    return MediaGalleryModule.getImages(limit, offset);
  }

  async getVideos(limit: number = 100, offset: number = 0): Promise<MediaItem[]> {
    if (!this.isAvailable()) {
      return [];
    }
    return MediaGalleryModule.getVideos(limit, offset);
  }

  async getAudio(limit: number = 100, offset: number = 0): Promise<MediaItem[]> {
    if (!this.isAvailable()) {
      return [];
    }
    return MediaGalleryModule.getAudio(limit, offset);
  }

  async getMediaCounts(): Promise<MediaCounts> {
    if (!this.isAvailable()) {
      return { images: 0, videos: 0, audio: 0, timestamp: 0 };
    }
    return MediaGalleryModule.getMediaCounts();
  }

  async getAlbums(): Promise<Album[]> {
    if (!this.isAvailable()) {
      return [];
    }
    return MediaGalleryModule.getAlbums();
  }

  async getAlbumImages(albumId: string, limit: number = 100, offset: number = 0): Promise<MediaItem[]> {
    if (!this.isAvailable()) {
      return [];
    }
    return MediaGalleryModule.getAlbumImages(albumId, limit, offset);
  }
}

export const nativeMediaGallery = new NativeMediaGalleryService();
export default nativeMediaGallery;
