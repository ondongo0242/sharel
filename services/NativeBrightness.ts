import { NativeModules, Platform } from 'react-native';

const { BrightnessModule } = NativeModules;

class NativeBrightnessService {
  isAvailable(): boolean {
    return Platform.OS === 'android' && !!BrightnessModule;
  }

  async getBrightness(): Promise<number> {
    if (!this.isAvailable()) {
      return 0.5;
    }
    return BrightnessModule.getBrightness();
  }

  async setBrightness(brightness: number): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }
    return BrightnessModule.setBrightness(brightness);
  }

  async getSystemBrightness(): Promise<number> {
    if (!this.isAvailable()) {
      return 0.5;
    }
    return BrightnessModule.getSystemBrightnessAsync();
  }

  async setSystemBrightness(brightness: number): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }
    return BrightnessModule.setSystemBrightnessAsync(brightness);
  }

  async useSystemBrightness(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }
    return BrightnessModule.useSystemBrightness();
  }

  async isUsingSystemBrightness(): Promise<boolean> {
    if (!this.isAvailable()) {
      return true;
    }
    return BrightnessModule.isUsingSystemBrightness();
  }

  async requestWriteSettingsPermission(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }
    return BrightnessModule.requestWriteSettingsPermission();
  }

  async hasWriteSettingsPermission(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }
    return BrightnessModule.hasWriteSettingsPermissionAsync();
  }
}

export const nativeBrightness = new NativeBrightnessService();
export default nativeBrightness;
