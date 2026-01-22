import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const VAULT_CONFIG_KEY = '@vault_config';
const VAULT_FILES_KEY = '@vault_files';
const VAULT_LOCK_KEY = '@vault_lock';
const SECURE_PASSWORD_KEY = 'vault_password_hash';
const SECURE_RECOVERY_KEY = 'vault_recovery_answer';

export type LockType = 'pin' | 'password' | 'pattern';

export interface VaultConfig {
  isConfigured: boolean;
  lockType: LockType;
  securityQuestion: string;
  appLockEnabled: boolean;
  appLockDelayMinutes: number;
  createdAt: number;
  lastAccessedAt: number;
}

export interface VaultFile {
  id: string;
  name: string;
  uri: string;
  originalUri: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'app' | 'contact' | 'other';
  size: number;
  mimeType: string;
  addedAt: number;
  thumbnailUri?: string;
}

export interface VaultLockState {
  isLocked: boolean;
  lastUnlockedAt: number | null;
  failedAttempts: number;
  lockedUntil: number | null;
}

const SECURITY_QUESTIONS = [
  "Quel est le nom de votre premier animal de compagnie ?",
  "Dans quelle ville êtes-vous né(e) ?",
  "Quel est le nom de jeune fille de votre mère ?",
  "Quel était le nom de votre école primaire ?",
  "Quel est votre plat préféré ?",
  "Quel est le prénom de votre meilleur(e) ami(e) d'enfance ?",
  "Quelle est votre couleur préférée ?",
  "Quel est le nom de votre premier professeur ?",
];

class VaultServiceClass {
  private config: VaultConfig | null = null;
  private lockState: VaultLockState | null = null;
  private files: VaultFile[] = [];
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const [configStr, filesStr, lockStr] = await Promise.all([
        AsyncStorage.getItem(VAULT_CONFIG_KEY),
        AsyncStorage.getItem(VAULT_FILES_KEY),
        AsyncStorage.getItem(VAULT_LOCK_KEY),
      ]);

      if (configStr) {
        this.config = JSON.parse(configStr);
      }

      if (filesStr) {
        this.files = JSON.parse(filesStr);
      }

      if (lockStr) {
        this.lockState = JSON.parse(lockStr);
      } else {
        this.lockState = {
          isLocked: true,
          lastUnlockedAt: null,
          failedAttempts: 0,
          lockedUntil: null,
        };
      }

      this.isInitialized = true;
    } catch (error) {
      console.error('Error initializing VaultService:', error);
    }
  }

  getSecurityQuestions(): string[] {
    return SECURITY_QUESTIONS;
  }

  async isConfigured(): Promise<boolean> {
    await this.initialize();
    return this.config?.isConfigured ?? false;
  }

  async getConfig(): Promise<VaultConfig | null> {
    await this.initialize();
    return this.config;
  }

  async getLockState(): Promise<VaultLockState> {
    await this.initialize();
    return this.lockState || {
      isLocked: true,
      lastUnlockedAt: null,
      failedAttempts: 0,
      lockedUntil: null,
    };
  }

  private async hashPassword(password: string): Promise<string> {
    const digest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      password + 'sharel_vault_salt'
    );
    return digest;
  }

  private async saveSecurely(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  }

  private async getSecurely(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return await AsyncStorage.getItem(key);
    } else {
      return await SecureStore.getItemAsync(key);
    }
  }

  async configureVault(
    lockType: LockType,
    password: string,
    securityQuestion: string,
    securityAnswer: string
  ): Promise<boolean> {
    try {
      const passwordHash = await this.hashPassword(password);
      const answerHash = await this.hashPassword(securityAnswer.toLowerCase().trim());

      await this.saveSecurely(SECURE_PASSWORD_KEY, passwordHash);
      await this.saveSecurely(SECURE_RECOVERY_KEY, answerHash);

      const config: VaultConfig = {
        isConfigured: true,
        lockType,
        securityQuestion,
        appLockEnabled: false,
        appLockDelayMinutes: 0,
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
      };

      await AsyncStorage.setItem(VAULT_CONFIG_KEY, JSON.stringify(config));
      this.config = config;

      this.lockState = {
        isLocked: true,
        lastUnlockedAt: null,
        failedAttempts: 0,
        lockedUntil: null,
      };
      await AsyncStorage.setItem(VAULT_LOCK_KEY, JSON.stringify(this.lockState));

      return true;
    } catch (error) {
      console.error('Error configuring vault:', error);
      return false;
    }
  }

  async verifyPassword(password: string): Promise<boolean> {
    try {
      const storedHash = await this.getSecurely(SECURE_PASSWORD_KEY);
      if (!storedHash) return false;

      const inputHash = await this.hashPassword(password);
      return storedHash === inputHash;
    } catch (error) {
      console.error('Error verifying password:', error);
      return false;
    }
  }

  async unlock(password: string): Promise<{ success: boolean; error?: string }> {
    await this.initialize();

    if (this.lockState?.lockedUntil && Date.now() < this.lockState.lockedUntil) {
      const remainingSeconds = Math.ceil((this.lockState.lockedUntil - Date.now()) / 1000);
      return { 
        success: false, 
        error: `Trop de tentatives. Réessayez dans ${remainingSeconds} secondes.` 
      };
    }

    const isValid = await this.verifyPassword(password);

    if (isValid) {
      this.lockState = {
        isLocked: false,
        lastUnlockedAt: Date.now(),
        failedAttempts: 0,
        lockedUntil: null,
      };
      await AsyncStorage.setItem(VAULT_LOCK_KEY, JSON.stringify(this.lockState));

      if (this.config) {
        this.config.lastAccessedAt = Date.now();
        await AsyncStorage.setItem(VAULT_CONFIG_KEY, JSON.stringify(this.config));
      }

      return { success: true };
    } else {
      const failedAttempts = (this.lockState?.failedAttempts || 0) + 1;
      let lockedUntil: number | null = null;

      if (failedAttempts >= 5) {
        lockedUntil = Date.now() + 5 * 60 * 1000;
      } else if (failedAttempts >= 3) {
        lockedUntil = Date.now() + 30 * 1000;
      }

      this.lockState = {
        isLocked: true,
        lastUnlockedAt: this.lockState?.lastUnlockedAt || null,
        failedAttempts,
        lockedUntil,
      };
      await AsyncStorage.setItem(VAULT_LOCK_KEY, JSON.stringify(this.lockState));

      return { 
        success: false, 
        error: `Mot de passe incorrect. ${5 - failedAttempts} tentatives restantes.` 
      };
    }
  }

  async lock(): Promise<void> {
    if (this.lockState) {
      this.lockState.isLocked = true;
      await AsyncStorage.setItem(VAULT_LOCK_KEY, JSON.stringify(this.lockState));
    }
  }

  async verifySecurityAnswer(answer: string): Promise<boolean> {
    try {
      const storedHash = await this.getSecurely(SECURE_RECOVERY_KEY);
      if (!storedHash) return false;

      const inputHash = await this.hashPassword(answer.toLowerCase().trim());
      return storedHash === inputHash;
    } catch (error) {
      console.error('Error verifying security answer:', error);
      return false;
    }
  }

  async resetPassword(
    securityAnswer: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> {
    const isAnswerValid = await this.verifySecurityAnswer(securityAnswer);
    
    if (!isAnswerValid) {
      return { success: false, error: 'Réponse de sécurité incorrecte.' };
    }

    try {
      const passwordHash = await this.hashPassword(newPassword);
      await this.saveSecurely(SECURE_PASSWORD_KEY, passwordHash);

      this.lockState = {
        isLocked: true,
        lastUnlockedAt: null,
        failedAttempts: 0,
        lockedUntil: null,
      };
      await AsyncStorage.setItem(VAULT_LOCK_KEY, JSON.stringify(this.lockState));

      return { success: true };
    } catch (error) {
      console.error('Error resetting password:', error);
      return { success: false, error: 'Une erreur est survenue.' };
    }
  }

  async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> {
    const isValid = await this.verifyPassword(currentPassword);
    
    if (!isValid) {
      return { success: false, error: 'Mot de passe actuel incorrect.' };
    }

    try {
      const passwordHash = await this.hashPassword(newPassword);
      await this.saveSecurely(SECURE_PASSWORD_KEY, passwordHash);
      return { success: true };
    } catch (error) {
      console.error('Error changing password:', error);
      return { success: false, error: 'Une erreur est survenue.' };
    }
  }

  async changeLockType(newType: LockType, password: string): Promise<boolean> {
    const isValid = await this.verifyPassword(password);
    if (!isValid || !this.config) return false;

    try {
      this.config.lockType = newType;
      await AsyncStorage.setItem(VAULT_CONFIG_KEY, JSON.stringify(this.config));
      return true;
    } catch (error) {
      console.error('Error changing lock type:', error);
      return false;
    }
  }

  async setAppLock(enabled: boolean, delayMinutes: number = 0): Promise<boolean> {
    if (!this.config) return false;

    try {
      this.config.appLockEnabled = enabled;
      this.config.appLockDelayMinutes = delayMinutes;
      await AsyncStorage.setItem(VAULT_CONFIG_KEY, JSON.stringify(this.config));
      return true;
    } catch (error) {
      console.error('Error setting app lock:', error);
      return false;
    }
  }

  async getFiles(): Promise<VaultFile[]> {
    await this.initialize();
    return this.files;
  }

  async addFile(file: Omit<VaultFile, 'id' | 'addedAt'>): Promise<VaultFile> {
    await this.initialize();

    const newFile: VaultFile = {
      ...file,
      id: `vault_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      addedAt: Date.now(),
    };

    this.files.push(newFile);
    await AsyncStorage.setItem(VAULT_FILES_KEY, JSON.stringify(this.files));

    return newFile;
  }

  async addFiles(files: Array<Omit<VaultFile, 'id' | 'addedAt'>>): Promise<VaultFile[]> {
    await this.initialize();

    const newFiles: VaultFile[] = files.map((file) => ({
      ...file,
      id: `vault_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      addedAt: Date.now(),
    }));

    this.files.push(...newFiles);
    await AsyncStorage.setItem(VAULT_FILES_KEY, JSON.stringify(this.files));

    return newFiles;
  }

  async removeFile(fileId: string): Promise<boolean> {
    await this.initialize();

    const index = this.files.findIndex((f) => f.id === fileId);
    if (index === -1) return false;

    this.files.splice(index, 1);
    await AsyncStorage.setItem(VAULT_FILES_KEY, JSON.stringify(this.files));

    return true;
  }

  async removeFiles(fileIds: string[]): Promise<number> {
    await this.initialize();

    const initialCount = this.files.length;
    this.files = this.files.filter((f) => !fileIds.includes(f.id));
    await AsyncStorage.setItem(VAULT_FILES_KEY, JSON.stringify(this.files));

    return initialCount - this.files.length;
  }

  getFilesByType(type: VaultFile['type']): VaultFile[] {
    return this.files.filter((f) => f.type === type);
  }

  async clearVault(): Promise<boolean> {
    try {
      this.files = [];
      this.config = null;
      this.lockState = null;
      this.isInitialized = false;

      await Promise.all([
        AsyncStorage.removeItem(VAULT_CONFIG_KEY),
        AsyncStorage.removeItem(VAULT_FILES_KEY),
        AsyncStorage.removeItem(VAULT_LOCK_KEY),
        Platform.OS !== 'web' ? SecureStore.deleteItemAsync(SECURE_PASSWORD_KEY) : AsyncStorage.removeItem(SECURE_PASSWORD_KEY),
        Platform.OS !== 'web' ? SecureStore.deleteItemAsync(SECURE_RECOVERY_KEY) : AsyncStorage.removeItem(SECURE_RECOVERY_KEY),
      ]);

      return true;
    } catch (error) {
      console.error('Error clearing vault:', error);
      return false;
    }
  }
}

export const VaultService = new VaultServiceClass();
export default VaultService;
