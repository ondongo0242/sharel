import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { SensorsModule } = NativeModules;

export interface SensorData {
  x: number;
  y: number;
  z: number;
  timestamp: number;
}

type SensorSubscription = { remove: () => void };

class NativeSensorsService {
  private eventEmitter: NativeEventEmitter | null = null;
  private accelerometerSubscription: SensorSubscription | null = null;
  private gyroscopeSubscription: SensorSubscription | null = null;
  private magnetometerSubscription: SensorSubscription | null = null;

  constructor() {
    if (Platform.OS === 'android' && SensorsModule) {
      this.eventEmitter = new NativeEventEmitter(SensorsModule);
    }
  }

  isAvailable(): boolean {
    return Platform.OS === 'android' && !!SensorsModule;
  }

  async isAccelerometerAvailable(): Promise<boolean> {
    if (!this.isAvailable()) return false;
    return SensorsModule.isAccelerometerAvailable();
  }

  async isGyroscopeAvailable(): Promise<boolean> {
    if (!this.isAvailable()) return false;
    return SensorsModule.isGyroscopeAvailable();
  }

  async isMagnetometerAvailable(): Promise<boolean> {
    if (!this.isAvailable()) return false;
    return SensorsModule.isMagnetometerAvailable();
  }

  setAccelerometerUpdateInterval(intervalMs: number): void {
    if (this.isAvailable()) {
      SensorsModule.setAccelerometerUpdateInterval(intervalMs);
    }
  }

  setGyroscopeUpdateInterval(intervalMs: number): void {
    if (this.isAvailable()) {
      SensorsModule.setGyroscopeUpdateInterval(intervalMs);
    }
  }

  setMagnetometerUpdateInterval(intervalMs: number): void {
    if (this.isAvailable()) {
      SensorsModule.setMagnetometerUpdateInterval(intervalMs);
    }
  }

  subscribeToAccelerometer(callback: (data: SensorData) => void): SensorSubscription {
    if (!this.isAvailable() || !this.eventEmitter) {
      return { remove: () => {} };
    }

    this.accelerometerSubscription?.remove();

    SensorsModule.startAccelerometer().catch(() => {});

    this.accelerometerSubscription = this.eventEmitter.addListener(
      'onAccelerometerData',
      callback
    );

    return {
      remove: () => {
        this.accelerometerSubscription?.remove();
        this.accelerometerSubscription = null;
        SensorsModule.stopAccelerometer().catch(() => {});
      },
    };
  }

  subscribeToGyroscope(callback: (data: SensorData) => void): SensorSubscription {
    if (!this.isAvailable() || !this.eventEmitter) {
      return { remove: () => {} };
    }

    this.gyroscopeSubscription?.remove();

    SensorsModule.startGyroscope().catch(() => {});

    this.gyroscopeSubscription = this.eventEmitter.addListener(
      'onGyroscopeData',
      callback
    );

    return {
      remove: () => {
        this.gyroscopeSubscription?.remove();
        this.gyroscopeSubscription = null;
        SensorsModule.stopGyroscope().catch(() => {});
      },
    };
  }

  subscribeToMagnetometer(callback: (data: SensorData) => void): SensorSubscription {
    if (!this.isAvailable() || !this.eventEmitter) {
      return { remove: () => {} };
    }

    this.magnetometerSubscription?.remove();

    SensorsModule.startMagnetometer().catch(() => {});

    this.magnetometerSubscription = this.eventEmitter.addListener(
      'onMagnetometerData',
      callback
    );

    return {
      remove: () => {
        this.magnetometerSubscription?.remove();
        this.magnetometerSubscription = null;
        SensorsModule.stopMagnetometer().catch(() => {});
      },
    };
  }

  stopAll(): void {
    this.accelerometerSubscription?.remove();
    this.gyroscopeSubscription?.remove();
    this.magnetometerSubscription?.remove();
    this.accelerometerSubscription = null;
    this.gyroscopeSubscription = null;
    this.magnetometerSubscription = null;

    if (this.isAvailable()) {
      SensorsModule.stopAccelerometer().catch(() => {});
      SensorsModule.stopGyroscope().catch(() => {});
      SensorsModule.stopMagnetometer().catch(() => {});
    }
  }
}

export const nativeSensors = new NativeSensorsService();
export default nativeSensors;
