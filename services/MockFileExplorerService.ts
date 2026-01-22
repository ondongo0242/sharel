import { Platform } from 'react-native';

export interface MockFileItem {
  name: string;
  isDirectory: boolean;
  uri: string;
  size: number;
  modificationTime: number;
}

interface MockFolderStructure {
  [key: string]: MockFileItem[];
}

const MOCK_FOLDER_STRUCTURE: MockFolderStructure = {
  root: [
    { name: "DCIM", isDirectory: true, uri: "", size: 0, modificationTime: Date.now() - 86400000 },
    { name: "Download", isDirectory: true, uri: "", size: 0, modificationTime: Date.now() - 172800000 },
    { name: "Documents", isDirectory: true, uri: "", size: 0, modificationTime: Date.now() - 259200000 },
    { name: "Music", isDirectory: true, uri: "", size: 0, modificationTime: Date.now() - 345600000 },
    { name: "Movies", isDirectory: true, uri: "", size: 0, modificationTime: Date.now() - 432000000 },
    { name: "Pictures", isDirectory: true, uri: "", size: 0, modificationTime: Date.now() - 518400000 },
    { name: "Android", isDirectory: true, uri: "", size: 0, modificationTime: Date.now() - 604800000 },
    { name: "Sharel", isDirectory: true, uri: "", size: 0, modificationTime: Date.now() - 691200000 },
  ],
  DCIM: [
    { name: "Camera", isDirectory: true, uri: "", size: 0, modificationTime: Date.now() - 86400000 },
    { name: "Screenshots", isDirectory: true, uri: "", size: 0, modificationTime: Date.now() - 172800000 },
  ],
  Pictures: [
    { name: "Camera", isDirectory: true, uri: "", size: 0, modificationTime: Date.now() - 86400000 },
    { name: "Screenshots", isDirectory: true, uri: "", size: 0, modificationTime: Date.now() - 172800000 },
    { name: "Wallpapers", isDirectory: true, uri: "", size: 0, modificationTime: Date.now() - 259200000 },
  ],
  Camera: [
    { name: "IMG_20241201_120000.jpg", isDirectory: false, uri: "", size: 3145728, modificationTime: Date.now() - 86400000 },
    { name: "IMG_20241130_180000.jpg", isDirectory: false, uri: "", size: 2621440, modificationTime: Date.now() - 172800000 },
    { name: "IMG_20241125_093000.jpg", isDirectory: false, uri: "", size: 4194304, modificationTime: Date.now() - 432000000 },
    { name: "VID_20241128_140000.mp4", isDirectory: false, uri: "", size: 52428800, modificationTime: Date.now() - 259200000 },
  ],
  Screenshots: [
    { name: "Screenshot_20241201_093045.png", isDirectory: false, uri: "", size: 524288, modificationTime: Date.now() - 86400000 },
    { name: "Screenshot_20241130_154512.png", isDirectory: false, uri: "", size: 786432, modificationTime: Date.now() - 172800000 },
  ],
  Download: [
    { name: "document_important.pdf", isDirectory: false, uri: "", size: 1048576, modificationTime: Date.now() - 86400000 },
    { name: "presentation.pptx", isDirectory: false, uri: "", size: 4194304, modificationTime: Date.now() - 172800000 },
    { name: "fichier_excel.xlsx", isDirectory: false, uri: "", size: 524288, modificationTime: Date.now() - 259200000 },
    { name: "application.apk", isDirectory: false, uri: "", size: 52428800, modificationTime: Date.now() - 345600000 },
    { name: "archive.zip", isDirectory: false, uri: "", size: 10485760, modificationTime: Date.now() - 432000000 },
    { name: "music_album.zip", isDirectory: false, uri: "", size: 157286400, modificationTime: Date.now() - 518400000 },
  ],
  Music: [
    { name: "Playlists", isDirectory: true, uri: "", size: 0, modificationTime: Date.now() - 86400000 },
    { name: "Albums", isDirectory: true, uri: "", size: 0, modificationTime: Date.now() - 172800000 },
    { name: "chanson_favorite.mp3", isDirectory: false, uri: "", size: 8388608, modificationTime: Date.now() - 86400000 },
    { name: "album_complet.flac", isDirectory: false, uri: "", size: 41943040, modificationTime: Date.now() - 172800000 },
    { name: "podcast_episode.m4a", isDirectory: false, uri: "", size: 15728640, modificationTime: Date.now() - 259200000 },
  ],
  Playlists: [
    { name: "workout_mix.m3u", isDirectory: false, uri: "", size: 1024, modificationTime: Date.now() - 86400000 },
    { name: "chill_vibes.m3u", isDirectory: false, uri: "", size: 2048, modificationTime: Date.now() - 172800000 },
  ],
  Movies: [
    { name: "vacances_2024.mp4", isDirectory: false, uri: "", size: 524288000, modificationTime: Date.now() - 86400000 },
    { name: "tutoriel.mkv", isDirectory: false, uri: "", size: 209715200, modificationTime: Date.now() - 172800000 },
    { name: "clip_court.3gp", isDirectory: false, uri: "", size: 5242880, modificationTime: Date.now() - 259200000 },
  ],
  Documents: [
    { name: "Travail", isDirectory: true, uri: "", size: 0, modificationTime: Date.now() - 86400000 },
    { name: "Personnel", isDirectory: true, uri: "", size: 0, modificationTime: Date.now() - 172800000 },
    { name: "notes.txt", isDirectory: false, uri: "", size: 4096, modificationTime: Date.now() - 86400000 },
    { name: "rapport.docx", isDirectory: false, uri: "", size: 262144, modificationTime: Date.now() - 172800000 },
    { name: "budget_2024.xlsx", isDirectory: false, uri: "", size: 131072, modificationTime: Date.now() - 259200000 },
  ],
  Travail: [
    { name: "projet_alpha.docx", isDirectory: false, uri: "", size: 524288, modificationTime: Date.now() - 86400000 },
    { name: "reunion_notes.txt", isDirectory: false, uri: "", size: 8192, modificationTime: Date.now() - 172800000 },
    { name: "presentation_client.pptx", isDirectory: false, uri: "", size: 8388608, modificationTime: Date.now() - 259200000 },
  ],
  Personnel: [
    { name: "cv_2024.pdf", isDirectory: false, uri: "", size: 262144, modificationTime: Date.now() - 86400000 },
    { name: "lettre_motivation.docx", isDirectory: false, uri: "", size: 65536, modificationTime: Date.now() - 172800000 },
  ],
  Sharel: [
    { name: "Downloads", isDirectory: true, uri: "", size: 0, modificationTime: Date.now() - 86400000 },
    { name: "Photos", isDirectory: true, uri: "", size: 0, modificationTime: Date.now() - 172800000 },
    { name: "Videos", isDirectory: true, uri: "", size: 0, modificationTime: Date.now() - 259200000 },
    { name: "Audio", isDirectory: true, uri: "", size: 0, modificationTime: Date.now() - 345600000 },
    { name: "Documents", isDirectory: true, uri: "", size: 0, modificationTime: Date.now() - 432000000 },
  ],
  Android: [
    { name: "data", isDirectory: true, uri: "", size: 0, modificationTime: Date.now() - 86400000 },
    { name: "media", isDirectory: true, uri: "", size: 0, modificationTime: Date.now() - 172800000 },
    { name: "obb", isDirectory: true, uri: "", size: 0, modificationTime: Date.now() - 259200000 },
  ],
};

const DEFAULT_FILES: MockFileItem[] = [
  { name: "fichier_exemple.txt", isDirectory: false, uri: "", size: 1024, modificationTime: Date.now() - 86400000 },
  { name: "image.jpg", isDirectory: false, uri: "", size: 2097152, modificationTime: Date.now() - 172800000 },
];

class MockFileExplorerService {
  private basePath = "/storage/emulated/0";

  isAvailable(): boolean {
    return Platform.OS === "web";
  }

  private getFolderName(path: string): string {
    const cleanPath = path.replace("file://", "").replace(/\/$/, "");
    const segments = cleanPath.split("/").filter(Boolean);
    
    if (segments.length <= 3) {
      return "root";
    }
    
    return segments[segments.length - 1];
  }

  private buildUri(basePath: string, fileName: string): string {
    const cleanBase = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
    return `${cleanBase}/${fileName}`;
  }

  async listFiles(path: string): Promise<MockFileItem[]> {
    const folderName = this.getFolderName(path);
    const items = MOCK_FOLDER_STRUCTURE[folderName] || DEFAULT_FILES;
    
    return items.map(item => ({
      ...item,
      uri: this.buildUri(path, item.name),
    }));
  }

  async listFilesWithStats(
    path: string,
    showHidden: boolean = false,
    sortBy: 'name' | 'date' | 'size' | 'type' = 'name',
    sortOrder: 'asc' | 'desc' = 'asc'
  ): Promise<MockFileItem[]> {
    let files = await this.listFiles(path);
    
    if (!showHidden) {
      files = files.filter(f => !f.name.startsWith('.'));
    }
    
    files.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
          break;
        case 'date':
          comparison = a.modificationTime - b.modificationTime;
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'type':
          const extA = a.name.split('.').pop() || '';
          const extB = b.name.split('.').pop() || '';
          comparison = extA.localeCompare(extB);
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return files;
  }

  async createDirectory(path: string): Promise<{ success: boolean; path: string }> {
    return { success: true, path };
  }

  async createFile(path: string): Promise<{ success: boolean; path: string }> {
    return { success: true, path };
  }

  async deleteFile(path: string): Promise<boolean> {
    return true;
  }

  async deleteMultiple(paths: string[]): Promise<{ results: any[]; successCount: number; failCount: number }> {
    return {
      results: paths.map(p => ({ success: true, source: p })),
      successCount: paths.length,
      failCount: 0,
    };
  }

  async rename(oldPath: string, newPath: string): Promise<{ success: boolean; oldPath: string; newPath: string }> {
    return { success: true, oldPath, newPath };
  }

  async copyFile(sourcePath: string, destPath: string): Promise<{ success: boolean; source: string; destination: string }> {
    return { success: true, source: sourcePath, destination: destPath };
  }

  async moveFile(sourcePath: string, destPath: string): Promise<{ success: boolean; source: string; destination: string }> {
    return { success: true, source: sourcePath, destination: destPath };
  }

  async copyMultiple(sourcePaths: string[], destFolder: string): Promise<{ results: any[]; successCount: number; failCount: number }> {
    return {
      results: sourcePaths.map(p => ({ success: true, source: p, destination: `${destFolder}/${p.split('/').pop()}` })),
      successCount: sourcePaths.length,
      failCount: 0,
    };
  }

  async moveMultiple(sourcePaths: string[], destFolder: string): Promise<{ results: any[]; successCount: number; failCount: number }> {
    return {
      results: sourcePaths.map(p => ({ success: true, source: p, destination: `${destFolder}/${p.split('/').pop()}` })),
      successCount: sourcePaths.length,
      failCount: 0,
    };
  }

  async hasStoragePermission(): Promise<boolean> {
    return true;
  }

  async getRootPath(): Promise<string> {
    return this.basePath;
  }
}

export const mockFileExplorer = new MockFileExplorerService();
export default mockFileExplorer;
