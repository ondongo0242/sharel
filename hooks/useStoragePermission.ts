import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import nativeStorage, {
  SharelFolderResult,
  StorageInfo,
  AndroidVersionInfo,
} from '@/services/NativeStorage';

export interface StoragePermissionState {
  isLoading: boolean;
  hasPermission: boolean;
  requiresPermission: boolean;
  folderExists: boolean;
  folderPath: string;
  androidVersion: AndroidVersionInfo | null;
  storageInfo: StorageInfo | null;
  error: string | null;
}

export interface StoragePermissionActions {
  requestPermission: () => Promise<boolean>;
  openSettings: () => Promise<boolean>;
  createFolder: () => Promise<SharelFolderResult | null>;
  initializeStorage: () => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function useStoragePermission(): StoragePermissionState & StoragePermissionActions {
  const [state, setState] = useState<StoragePermissionState>({
    isLoading: true,
    hasPermission: false,
    requiresPermission: false,
    folderExists: false,
    folderPath: '',
    androidVersion: null,
    storageInfo: null,
    error: null,
  });

  const checkStatus = useCallback(async () => {
    if (Platform.OS !== 'android' || !nativeStorage.isAvailable()) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        hasPermission: true,
        requiresPermission: false,
      }));
      return;
    }

    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const androidVersion = await nativeStorage.getAndroidVersion();
      const hasStoragePermission = await nativeStorage.hasManageStoragePermission();
      const folderInfo = await nativeStorage.getSharelFolderPath();
      const storageInfo = hasStoragePermission 
        ? await nativeStorage.getStorageInfo().catch(() => null) 
        : null;

      setState({
        isLoading: false,
        hasPermission: hasStoragePermission,
        requiresPermission: androidVersion.requiresManageStorage,
        folderExists: folderInfo.exists,
        folderPath: folderInfo.path,
        androidVersion,
        storageInfo: storageInfo,
        error: null,
      });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!nativeStorage.isAvailable()) {
      return true;
    }

    try {
      const granted = await nativeStorage.requestManageStoragePermission();
      await checkStatus();
      return granted;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to request permission',
      }));
      return false;
    }
  }, [checkStatus]);

  const openSettings = useCallback(async (): Promise<boolean> => {
    if (!nativeStorage.isAvailable()) {
      return false;
    }

    try {
      const result = await nativeStorage.openStoragePermissionSettings();
      await checkStatus();
      return result;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to open settings',
      }));
      return false;
    }
  }, [checkStatus]);

  const createFolder = useCallback(async (): Promise<SharelFolderResult | null> => {
    if (!nativeStorage.isAvailable()) {
      return null;
    }

    try {
      const result = await nativeStorage.createSharelFolder();
      await checkStatus();
      return result;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to create folder',
      }));
      return null;
    }
  }, [checkStatus]);

  const initializeStorage = useCallback(async (): Promise<boolean> => {
    if (!nativeStorage.isAvailable()) {
      return false;
    }

    try {
      const hasPermission = await nativeStorage.hasManageStoragePermission();
      
      if (!hasPermission) {
        const granted = await nativeStorage.requestManageStoragePermission();
        if (!granted) {
          await checkStatus();
          return false;
        }
      }

      const result = await nativeStorage.createSharelFolder();
      await checkStatus();
      return result.success;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to initialize storage',
      }));
      return false;
    }
  }, [checkStatus]);

  const refresh = useCallback(async (): Promise<void> => {
    await checkStatus();
  }, [checkStatus]);

  return {
    ...state,
    requestPermission,
    openSettings,
    createFolder,
    initializeStorage,
    refresh,
  };
}

export default useStoragePermission;
