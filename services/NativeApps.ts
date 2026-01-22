import { NativeModules, Platform } from 'react-native';

const { AppsModule } = NativeModules;

export interface InstalledApp {
  id: string;
  packageName: string;
  appName: string;
  versionName?: string;
  size: number;
  firstInstallTime: number;
  lastUpdateTime?: number;
  sourceDir: string;
  isSystemApp: boolean;
  isNew: boolean;
  isInstalled: boolean;
}

export interface ApkFile {
  id: string;
  name: string;
  filename: string;
  path: string;
  uri: string;
  size: number;
  lastModified: number;
  mimeType: string;
  isInstalled: boolean;
  type: string;
}

export interface AppInfo {
  packageName: string;
  appName: string;
  versionName: string;
  versionCode: number;
  firstInstallTime: number;
  lastUpdateTime: number;
  size: number;
  sourceDir: string;
  isSystemApp: boolean;
}

class NativeAppsService {
  isAvailable(): boolean {
    return Platform.OS === 'android' && !!AppsModule;
  }

  async getInstalledApps(): Promise<InstalledApp[]> {
    if (!this.isAvailable()) {
      return [];
    }
    return AppsModule.getInstalledApps();
  }

  async getAllApps(includeSystem: boolean = false): Promise<InstalledApp[]> {
    if (!this.isAvailable()) {
      return [];
    }
    return AppsModule.getAllApps(includeSystem);
  }

  async getAppsCount(): Promise<number> {
    if (!this.isAvailable()) {
      return 0;
    }
    return AppsModule.getAppsCount();
  }

  async getAppIcon(packageName: string, size: number = 64): Promise<string | null> {
    if (!this.isAvailable()) {
      return null;
    }
    return AppsModule.getAppIcon(packageName, size);
  }

  async getAppIconsBatch(packageNames: string[], size: number = 64): Promise<Record<string, string>> {
    if (!this.isAvailable()) {
      return {};
    }
    return AppsModule.getAppIconsBatch(packageNames, size);
  }

  async getApkFiles(): Promise<ApkFile[]> {
    if (!this.isAvailable()) {
      return [];
    }
    return AppsModule.getApkFiles();
  }

  async getRecentlyInstalledApps(days: number = 7): Promise<InstalledApp[]> {
    if (!this.isAvailable()) {
      return [];
    }
    return AppsModule.getRecentlyInstalledApps(days);
  }

  async getAppInfo(packageName: string): Promise<AppInfo | null> {
    if (!this.isAvailable()) {
      return null;
    }
    try {
      return await AppsModule.getAppInfo(packageName);
    } catch {
      return null;
    }
  }

  async clearIconCache(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }
    return AppsModule.clearIconCache();
  }
}

export const nativeApps = new NativeAppsService();
export default nativeApps;
