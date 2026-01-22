import { MediaFile, MediaType, getMediaType, getMimeType } from '@/types/media';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  PLAYBACK_HISTORY: '@media_playback_history',
  LAST_POSITION: '@media_last_position_',
  FAVORITES: '@media_favorites',
  PLAYLISTS: '@media_playlists',
};

type OpenMediaCallback = (file: MediaFile) => void;

class MediaPlayerServiceClass {
  private listeners: Map<MediaType, OpenMediaCallback[]> = new Map();
  private history: MediaFile[] = [];
  private favorites: Set<string> = new Set();

  constructor() {
    this.loadHistory();
    this.loadFavorites();
  }

  registerListener(type: MediaType, callback: OpenMediaCallback) {
    const existing = this.listeners.get(type) || [];
    this.listeners.set(type, [...existing, callback]);

    return () => {
      const callbacks = this.listeners.get(type) || [];
      this.listeners.set(type, callbacks.filter(cb => cb !== callback));
    };
  }

  async openFile(uri: string, name: string, additionalProps?: Partial<MediaFile>): Promise<void> {
    const type = getMediaType(name);
    if (!type) {
      console.warn('Unsupported file type:', name);
      return;
    }

    const file: MediaFile = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      uri,
      name,
      type,
      mimeType: getMimeType(name),
      size: additionalProps?.size || 0,
      ...additionalProps,
    };

    this.addToHistory(file);

    const callbacks = this.listeners.get(type) || [];
    for (const callback of callbacks) {
      callback(file);
    }
  }

  async openMediaFile(file: MediaFile): Promise<void> {
    this.addToHistory(file);

    const callbacks = this.listeners.get(file.type) || [];
    for (const callback of callbacks) {
      callback(file);
    }
  }

  private async addToHistory(file: MediaFile) {
    this.history = [file, ...this.history.filter(f => f.uri !== file.uri)].slice(0, 100);
    await this.saveHistory();
  }

  private async loadHistory() {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PLAYBACK_HISTORY);
      if (data) {
        this.history = JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading history:', error);
    }
  }

  private async saveHistory() {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PLAYBACK_HISTORY, JSON.stringify(this.history));
    } catch (error) {
      console.error('Error saving history:', error);
    }
  }

  getHistory(): MediaFile[] {
    return this.history;
  }

  async clearHistory(): Promise<void> {
    this.history = [];
    await AsyncStorage.removeItem(STORAGE_KEYS.PLAYBACK_HISTORY);
  }

  async savePosition(fileId: string, position: number): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_POSITION + fileId, String(position));
    } catch (error) {
      console.error('Error saving position:', error);
    }
  }

  async getPosition(fileId: string): Promise<number> {
    try {
      const position = await AsyncStorage.getItem(STORAGE_KEYS.LAST_POSITION + fileId);
      return position ? parseFloat(position) : 0;
    } catch (error) {
      console.error('Error getting position:', error);
      return 0;
    }
  }

  async toggleFavorite(fileId: string): Promise<boolean> {
    if (this.favorites.has(fileId)) {
      this.favorites.delete(fileId);
    } else {
      this.favorites.add(fileId);
    }
    await this.saveFavorites();
    return this.favorites.has(fileId);
  }

  isFavorite(fileId: string): boolean {
    return this.favorites.has(fileId);
  }

  private async loadFavorites() {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.FAVORITES);
      if (data) {
        this.favorites = new Set(JSON.parse(data));
      }
    } catch (error) {
      console.error('Error loading favorites:', error);
    }
  }

  private async saveFavorites() {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify([...this.favorites]));
    } catch (error) {
      console.error('Error saving favorites:', error);
    }
  }

  formatDuration(seconds: number): string {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export const MediaPlayerService = new MediaPlayerServiceClass();
