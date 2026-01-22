import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@sharel_imported_files';

export interface StoredFile {
  id: string;
  name: string;
  size: string;
  sizeBytes: number;
  uri: string;
  mimeType?: string;
  type: 'file';
  timestamp: number;
}

class FileStorageService {
  async saveFiles(files: StoredFile[]): Promise<void> {
    try {
      const existing = await this.getFiles();
      const merged = [...existing, ...files];
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch (error) {
      console.error('Error saving files:', error);
      throw error;
    }
  }

  async getFiles(): Promise<StoredFile[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting files:', error);
      return [];
    }
  }

  async removeFile(fileId: string): Promise<void> {
    try {
      const files = await this.getFiles();
      const filtered = files.filter(f => f.id !== fileId);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error removing file:', error);
      throw error;
    }
  }

  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing files:', error);
      throw error;
    }
  }
}

export default new FileStorageService();
