import { NativeModules, Platform } from 'react-native';

const { ImageManipulatorModule } = NativeModules;

export interface ImageResult {
  uri: string;
  width: number;
  height: number;
  base64?: string;
}

export interface ImageInfo {
  uri: string;
  width: number;
  height: number;
  mimeType: string;
}

export interface ResizeAction {
  resize: { width?: number; height?: number };
}

export interface RotateAction {
  rotate: number;
}

export interface FlipAction {
  flip: { horizontal?: boolean; vertical?: boolean };
}

export interface CropAction {
  crop: { originX: number; originY: number; width: number; height: number };
}

export type ImageAction = ResizeAction | RotateAction | FlipAction | CropAction;

export interface SaveOptions {
  format?: 'jpeg' | 'png';
  compress?: number;
  base64?: boolean;
}

class NativeImageManipulatorService {
  isAvailable(): boolean {
    return Platform.OS === 'android' && !!ImageManipulatorModule;
  }

  async manipulate(
    uri: string,
    actions: ImageAction[],
    saveOptions?: SaveOptions
  ): Promise<ImageResult> {
    if (!this.isAvailable()) {
      throw new Error('ImageManipulator is only available on Android');
    }
    return ImageManipulatorModule.manipulate(uri, actions, saveOptions || {});
  }

  async resize(uri: string, width: number, height: number): Promise<ImageResult> {
    if (!this.isAvailable()) {
      throw new Error('ImageManipulator is only available on Android');
    }
    return ImageManipulatorModule.resize(uri, width, height);
  }

  async rotate(uri: string, degrees: number): Promise<ImageResult> {
    if (!this.isAvailable()) {
      throw new Error('ImageManipulator is only available on Android');
    }
    return ImageManipulatorModule.rotate(uri, degrees);
  }

  async flip(
    uri: string,
    horizontal: boolean = false,
    vertical: boolean = false
  ): Promise<ImageResult> {
    if (!this.isAvailable()) {
      throw new Error('ImageManipulator is only available on Android');
    }
    return ImageManipulatorModule.flip(uri, horizontal, vertical);
  }

  async crop(
    uri: string,
    originX: number,
    originY: number,
    width: number,
    height: number
  ): Promise<ImageResult> {
    if (!this.isAvailable()) {
      throw new Error('ImageManipulator is only available on Android');
    }
    return ImageManipulatorModule.crop(uri, originX, originY, width, height);
  }

  async compress(uri: string, quality: number): Promise<ImageResult> {
    if (!this.isAvailable()) {
      throw new Error('ImageManipulator is only available on Android');
    }
    return ImageManipulatorModule.compress(uri, Math.round(quality * 100));
  }

  async getImageInfo(uri: string): Promise<ImageInfo> {
    if (!this.isAvailable()) {
      throw new Error('ImageManipulator is only available on Android');
    }
    return ImageManipulatorModule.getImageInfo(uri);
  }
}

export const nativeImageManipulator = new NativeImageManipulatorService();
export default nativeImageManipulator;
