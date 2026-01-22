import { AuthService } from './AuthService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const CACHE_DURATION = 60000;
const ROOT_FOLDER_ID = "root";

// Token NimbusLink TGBox
const TGBOX_API_TOKEN = 'tgb_app_XFUyIOaGSBV7oDLUz1i6VGfEhMZRrM6RAR0W_006Njy'.trim();

// Default API URLs
const DEFAULT_PROD_URL = 'https://api.tgbox.io';
const DEFAULT_DEV_URL = 'https://803bfeec-2bed-4256-bda7-beb3a5007350-00-3h7e07u8zd8li.kirk.replit.dev';
const API_CONFIG_STORAGE_KEY = 'tgbox_api_config';

export interface TGBoxFile {
  id: string;
  name: string;
  isDirectory: boolean;
  size: number;
  modificationTime: number;
  mimeType?: string;
  parentId?: string;
  path: string;
}

export interface TGBoxFolder {
  id: string;
  name: string;
  path: string;
  parentId?: string;
  itemCount?: number;
}

export interface TGBoxStorageInfo {
  usedBytes: number;
  totalBytes: number;
  usedGB: number;
  totalGB: number;
  usedPercent: number;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface ApiConfig {
  prodUrl: string;
  devUrl: string;
  useProduction: boolean;
}

class TGBoxApiServiceClass {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private currentUserId: string | null = null;
  private currentUserEmail: string | null = null;
  private apiConfig: ApiConfig | null = null;

  private getCacheKey(endpoint: string, params?: Record<string, string>): string {
    const paramString = params ? JSON.stringify(params) : "";
    return `${endpoint}:${paramString}`;
  }

  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data as T;
    }
    if (cached) {
      this.cache.delete(key);
    }
    return null;
  }

  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  clearCache(folderId?: string): void {
    if (folderId) {
      const keysToDelete: string[] = [];
      this.cache.forEach((_, key) => {
        if (key.includes(folderId)) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach(key => this.cache.delete(key));
    } else {
      this.cache.clear();
    }
  }

  private async ensureUserInfo(): Promise<void> {
    if (this.currentUserEmail) return; // Only need email for API calls

    try {
      const user = await AuthService.getUser();
      if (user) {
        this.currentUserId = user.id;
        this.currentUserEmail = user.email || '';
      } else {
        // If not authenticated, user must set email manually via setUserInfo
        console.warn('[TGBoxApi] User not authenticated, waiting for manual user info');
      }
    } catch (error) {
      console.error('[TGBoxApi] Error getting user info:', error);
    }
  }

  async loadApiConfig(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(API_CONFIG_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.apiConfig = {
          prodUrl: parsed.prodUrl?.trim() || DEFAULT_PROD_URL,
          devUrl: parsed.devUrl?.trim() || DEFAULT_DEV_URL,
          useProduction: parsed.useProduction || false,
        };
      } else {
        this.apiConfig = {
          prodUrl: DEFAULT_PROD_URL,
          devUrl: DEFAULT_DEV_URL,
          useProduction: false, // Default to dev since prod is not hosted yet
        };
      }
    } catch (error) {
      console.error('[TGBoxApi] Error loading config:', error);
      this.apiConfig = {
        prodUrl: DEFAULT_PROD_URL,
        devUrl: DEFAULT_DEV_URL,
        useProduction: false,
      };
    }
  }

  async saveApiConfig(config: Partial<ApiConfig>): Promise<void> {
    try {
      if (!this.apiConfig) await this.loadApiConfig();
      const updated = { 
        ...this.apiConfig, 
        ...config,
        prodUrl: config.prodUrl?.trim() || this.apiConfig?.prodUrl,
        devUrl: config.devUrl?.trim() || this.apiConfig?.devUrl,
      } as ApiConfig;
      await AsyncStorage.setItem(API_CONFIG_STORAGE_KEY, JSON.stringify(updated));
      this.apiConfig = updated;
      this.clearCache();
      console.log('[TGBoxApi] Config saved:', updated);
    } catch (error) {
      console.error('[TGBoxApi] Error saving config:', error);
    }
  }

  getApiConfig(): ApiConfig | null {
    return this.apiConfig;
  }

  private getBaseUrl(): string {
    if (!this.apiConfig) {
      console.warn('[TGBoxApi] Config not loaded, using dev URL');
      return DEFAULT_DEV_URL;
    }
    return this.apiConfig.useProduction ? this.apiConfig.prodUrl : this.apiConfig.devUrl;
  }

  private async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
    body?: any,
  ): Promise<T | null> {
    try {
      await this.ensureUserInfo();

      if (!TGBOX_API_TOKEN) {
        console.error('[TGBoxApi] API Token not configured');
        return null;
      }

      if (!this.apiConfig) {
        await this.loadApiConfig();
      }

      const headers: Record<string, string> = {
        'Authorization': `Bearer ${TGBOX_API_TOKEN.trim()}`,
        'Content-Type': 'application/json',
      };

      // Use email as ID if userId is not available
      const userId = this.currentUserId || this.currentUserEmail;
      if (userId) {
        headers['X-App-User-ID'] = userId.trim();
      }
      if (this.currentUserEmail) {
        headers['X-App-User-Email'] = this.currentUserEmail.trim();
      }

      const baseUrl = this.getBaseUrl()?.trim() || '';
      if (!baseUrl) {
        console.error('[TGBoxApi] Base URL not configured');
        return null;
      }
      const url = `${baseUrl}${endpoint}`;
      const options: RequestInit = {
        method,
        headers,
      };

      if (body && (method === 'POST' || method === 'PATCH')) {
        options.body = JSON.stringify(body);
      }

      console.log(`[TGBoxApi] ${method} ${endpoint} (${this.apiConfig?.useProduction ? 'PROD' : 'DEV'})`, {
        url,
        hasToken: !!TGBOX_API_TOKEN,
        tokenLength: TGBOX_API_TOKEN?.length,
        headers: {
          Authorization: headers['Authorization'] ? `Bearer ${TGBOX_API_TOKEN?.substring(0, 10)}...` : 'MISSING',
          'X-App-User-ID': headers['X-App-User-ID'] || 'MISSING',
          'X-App-User-Email': headers['X-App-User-Email'] || 'MISSING',
        }
      });

      // Add timeout to prevent infinite hanging
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      
      clearTimeout(timeout);

      if (!response.ok) {
        let errorMsg = response.statusText;
        try {
          const errorBody = await response.json();
          errorMsg = errorBody.message || errorBody.error || errorMsg;
        } catch (e) {}
        console.error(`[TGBoxApi] Error ${response.status}: ${errorMsg} | URL: ${url}`);
        
        // Fallback logic: if prod fails and we're in prod mode, try dev
        if (this.apiConfig?.useProduction && (response.status >= 500 || response.status === 401)) {
          console.log('[TGBoxApi] Prod failed, attempting fallback to dev...');
          this.apiConfig.useProduction = false;
          return this.makeRequest(endpoint, method, body);
        }
        return null;
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('[TGBoxApi] Request error:', {
        message: error?.message,
        name: error?.name,
        type: error?.constructor?.name,
        url: url,
      });
      // Fallback logic: if prod fails with network error, try dev
      if (this.apiConfig?.useProduction) {
        console.log('[TGBoxApi] Network error on prod, attempting fallback to dev...');
        this.apiConfig.useProduction = false;
        return this.makeRequest(endpoint, method, body);
      }
      throw error;  // Re-throw so caller sees the error
    }
  }

  async getFolderContents(folderId: string = ROOT_FOLDER_ID): Promise<TGBoxFile[]> {
    const cacheKey = this.getCacheKey("folder_contents", { folderId });
    const cached = this.getFromCache<TGBoxFile[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const endpoint = folderId === ROOT_FOLDER_ID 
        ? '/api/folders' 
        : `/api/folders/${folderId}/contents`;

      const response = await this.makeRequest<any>(endpoint);

      if (!response) {
        console.log('[TGBoxApi] Using fallback empty list for:', endpoint);
        return [];
      }
      console.log('[TGBoxApi] Got response for', endpoint, ':', response);

      // Handle both API response formats
      const itemsList = Array.isArray(response) ? response : (response.items || response.data || []);
      
      const items: TGBoxFile[] = itemsList.map((item: any) => ({
        id: item.id || item.file_id || '',
        name: item.name || item.file_name || '',
        isDirectory: item.is_directory || item.type === 'folder' || item.children !== undefined,
        size: item.size || 0,
        modificationTime: item.modified_at ? new Date(item.modified_at).getTime() : Date.now(),
        mimeType: item.mime_type,
        parentId: folderId,
        path: item.path || `/${item.name}`,
      }));

      console.log(`[TGBoxApi] Loaded ${items.length} items from folder ${folderId}`);
      this.setCache(cacheKey, items);
      return items;
    } catch (error) {
      console.error("[TGBoxApi] Error getting folder contents:", error);
      return [];
    }
  }

  async getStorageInfo(): Promise<TGBoxStorageInfo> {
    const cacheKey = this.getCacheKey("storage_info");
    const cached = this.getFromCache<TGBoxStorageInfo>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.makeRequest<any>('/api/storage/info');

      const info: TGBoxStorageInfo = {
        usedBytes: response?.used_bytes || 0,
        totalBytes: response?.total_bytes || (5 * 1024 * 1024 * 1024),
        usedGB: (response?.used_bytes || 0) / (1024 * 1024 * 1024),
        totalGB: (response?.total_bytes || (5 * 1024 * 1024 * 1024)) / (1024 * 1024 * 1024),
        usedPercent: response?.used_percent || 0,
      };

      this.setCache(cacheKey, info);
      return info;
    } catch (error) {
      console.error("[TGBoxApi] Storage Info Error:", error);
      return {
        usedBytes: 0,
        totalBytes: 5 * 1024 * 1024 * 1024,
        usedGB: 0,
        totalGB: 5,
        usedPercent: 0,
      };
    }
  }

  async getFolderInfo(folderId: string): Promise<TGBoxFolder | null> {
    const cacheKey = this.getCacheKey("folder_info", { folderId });
    const cached = this.getFromCache<TGBoxFolder>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      if (folderId === ROOT_FOLDER_ID) {
        return {
          id: ROOT_FOLDER_ID,
          name: "Mon espace Sharel",
          path: "/",
          itemCount: 0,
        };
      }

      const response = await this.makeRequest<any>(`/api/folders/${folderId}`);

      if (!response) {
        return null;
      }

      const folder: TGBoxFolder = {
        id: response.id || folderId,
        name: response.name || '',
        path: response.path || '/',
        parentId: response.parent_id,
        itemCount: response.item_count || 0,
      };

      this.setCache(cacheKey, folder);
      return folder;
    } catch (error) {
      console.error("[TGBoxApi] Folder Info Error:", error);
      return null;
    }
  }

  async searchFiles(query: string, folderId?: string): Promise<TGBoxFile[]> {
    const cacheKey = this.getCacheKey("search", { query, folderId: folderId || "" });
    const cached = this.getFromCache<TGBoxFile[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const params = new URLSearchParams({
        q: query,
        ...(folderId && { folder_id: folderId }),
      });

      const response = await this.makeRequest<any>(`/api/search?${params.toString()}`);

      if (!response) {
        return [];
      }

      const items: TGBoxFile[] = (response.results || response.items || []).map((item: any) => ({
        id: item.id || item.file_id || '',
        name: item.name || item.file_name || '',
        isDirectory: item.is_directory || item.type === 'folder',
        size: item.size || 0,
        modificationTime: item.modified_at ? new Date(item.modified_at).getTime() : Date.now(),
        mimeType: item.mime_type,
        parentId: item.parent_id || folderId,
        path: item.path || `/${item.name}`,
      }));

      this.setCache(cacheKey, items);
      return items;
    } catch (error) {
      console.error("[TGBoxApi] Search Error:", error);
      return [];
    }
  }

  async createFolder(name: string, parentId: string = ROOT_FOLDER_ID): Promise<TGBoxFolder | null> {
    try {
      const response = await this.makeRequest<any>(
        '/api/folders',
        'POST',
        {
          name,
          parent_id: parentId === ROOT_FOLDER_ID ? null : parentId,
        }
      );

      if (!response) {
        return null;
      }

      const folder: TGBoxFolder = {
        id: response.id || '',
        name: response.name || name,
        path: response.path || `/${name}`,
        parentId: response.parent_id,
      };

      this.clearCache(parentId);
      console.log("[TGBoxApi] Created folder:", folder.name);
      return folder;
    } catch (error) {
      console.error("[TGBoxApi] Create Folder Error:", error);
      throw error;
    }
  }

  async deleteItem(itemId: string, isDirectory: boolean): Promise<boolean> {
    try {
      const endpoint = isDirectory 
        ? `/api/folders/${itemId}`
        : `/api/files/${itemId}`;

      const response = await this.makeRequest<any>(endpoint, 'DELETE');

      if (response) {
        this.clearCache();
        console.log("[TGBoxApi] Deleted item:", itemId);
        return true;
      }
      return false;
    } catch (error) {
      console.error("[TGBoxApi] Delete Error:", error);
      throw error;
    }
  }

  async renameItem(itemId: string, newName: string, isDirectory: boolean): Promise<boolean> {
    try {
      const endpoint = isDirectory 
        ? `/api/folders/${itemId}`
        : `/api/files/${itemId}`;

      const response = await this.makeRequest<any>(
        endpoint,
        'PATCH',
        { name: newName }
      );

      if (response) {
        this.clearCache();
        console.log("[TGBoxApi] Renamed item:", itemId);
        return true;
      }
      return false;
    } catch (error) {
      console.error("[TGBoxApi] Rename Error:", error);
      throw error;
    }
  }

  async moveItem(itemId: string, targetFolderId: string, isDirectory: boolean): Promise<boolean> {
    try {
      const endpoint = isDirectory 
        ? `/api/folders/${itemId}`
        : `/api/files/${itemId}`;

      const response = await this.makeRequest<any>(
        endpoint,
        'PATCH',
        { parent_id: targetFolderId }
      );

      if (response) {
        this.clearCache();
        console.log("[TGBoxApi] Moved item:", itemId);
        return true;
      }
      return false;
    } catch (error) {
      console.error("[TGBoxApi] Move Error:", error);
      throw error;
    }
  }

  async getDownloadUrl(fileId: string): Promise<string | null> {
    try {
      const response = await this.makeRequest<any>(`/api/files/${fileId}/download-url`);
      return response?.url || null;
    } catch (error) {
      console.error("[TGBoxApi] Download URL Error:", error);
      return null;
    }
  }

  async uploadFile(fileUri: string, fileName: string, parentId: string): Promise<any> {
    try {
      const formData = new FormData();
      const file = {
        uri: fileUri,
        type: 'application/octet-stream',
        name: fileName,
      };
      formData.append('file', file as any);
      formData.append('parent_id', parentId === ROOT_FOLDER_ID ? 'null' : parentId);

      const baseUrl = this.apiConfig?.useProduction ? this.apiConfig.prodUrl : this.apiConfig?.devUrl;
      const response = await fetch(`${baseUrl}/api/files/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TGBOX_API_TOKEN}`,
          'X-App-User-ID': this.currentUserEmail || '',
          'X-App-User-Email': this.currentUserEmail || '',
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      this.clearCache(parentId);
      console.log("[TGBoxApi] File uploaded:", fileName);
      return await response.json();
    } catch (error) {
      console.error("[TGBoxApi] Upload Error:", error);
      throw error;
    }
  }

  async getStreamingUrl(fileId: string): Promise<string | null> {
    try {
      const response = await this.makeRequest<any>(`/api/files/${fileId}/stream`);
      return response?.stream_url || response?.url || null;
    } catch (error) {
      console.error("[TGBoxApi] Streaming URL Error:", error);
      return null;
    }
  }

  async addFile(file: TGBoxFile): Promise<void> {
    try {
      await this.makeRequest<any>(
        '/api/files',
        'POST',
        {
          name: file.name,
          size: file.size,
          parent_id: file.parentId,
          mime_type: file.mimeType,
        }
      );
      this.clearCache(file.parentId);
      console.log("[TGBoxApi] Added file:", file.name);
    } catch (error) {
      console.error("[TGBoxApi] Add File Error:", error);
    }
  }

  getRootFolderId(): string {
    return ROOT_FOLDER_ID;
  }

  setUserInfo(userId: string, userEmail: string): void {
    this.currentUserId = userId;
    this.currentUserEmail = userEmail;
  }
}

const TGBoxApiServiceInstance = new TGBoxApiServiceClass();
export default TGBoxApiServiceInstance;
