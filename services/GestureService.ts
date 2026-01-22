import { Platform, NativeModules } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from './LoggerService';
import { nativeSensors, SensorData } from './NativeSensors';

export type ShakeAction = 
  | 'cancel_transfer'
  | 'discover_devices'
  | 'quick_send'
  | 'generate_qr'
  | 'invisible_mode'
  | 'none';

export type ShakeSensitivity = 'low' | 'medium' | 'high';

export type GestureAction = 
  | 'pause_resume_transfer'
  | 'delete'
  | 'share'
  | 'multi_select'
  | 'none';

export interface GestureSettings {
  shakeEnabled: boolean;
  shakeAction: ShakeAction;
  shakeSensitivity: ShakeSensitivity;
  disableShakeDuringTransfer: boolean;
  doubleTapAction: GestureAction;
  swipeLeftAction: GestureAction;
  swipeRightAction: GestureAction;
  longPressAction: GestureAction;
  rotationLockEnabled: boolean;
}

export interface GestureEvent {
  type: 'shake' | 'rotation' | 'double_tap' | 'swipe_left' | 'swipe_right' | 'long_press';
  timestamp: number;
  data?: any;
}

type GestureCallback = (event: GestureEvent) => void;

const STORAGE_KEYS = {
  SHAKE_ENABLED: '@gestures_shake_enabled',
  SHAKE_ACTION: '@gestures_shake_action',
  SHAKE_SENSITIVITY: '@gestures_shake_sensitivity',
  DISABLE_SHAKE_DURING_TRANSFER: '@gestures_disable_shake_transfer',
  DOUBLE_TAP_ACTION: '@gestures_double_tap',
  SWIPE_LEFT_ACTION: '@gestures_swipe_left',
  SWIPE_RIGHT_ACTION: '@gestures_swipe_right',
  LONG_PRESS_ACTION: '@gestures_long_press',
  ROTATION_LOCK: '@gestures_rotation_lock',
};

const SHAKE_THRESHOLDS: Record<ShakeSensitivity, number> = {
  low: 2.5,
  medium: 1.8,
  high: 1.2,
};

const SHAKE_COOLDOWN = 1000;
const SHAKE_SAMPLES_REQUIRED = 3;

class GestureServiceClass {
  private settings: GestureSettings = {
    shakeEnabled: true,
    shakeAction: 'discover_devices',
    shakeSensitivity: 'medium',
    disableShakeDuringTransfer: true,
    doubleTapAction: 'pause_resume_transfer',
    swipeLeftAction: 'delete',
    swipeRightAction: 'share',
    longPressAction: 'multi_select',
    rotationLockEnabled: false,
  };

  private listeners: Map<string, GestureCallback[]> = new Map();
  private accelerometerSubscription: { remove: () => void } | null = null;
  private orientationSubscription: ScreenOrientation.Subscription | null = null;
  private isInitialized = false;
  private isTransferActive = false;
  private lastShakeTime = 0;
  private shakeCount = 0;
  private lastAcceleration: SensorData | null = null;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      logger.info('GestureService', 'Initializing gesture service');
      await this.loadSettings();
      
      if (Platform.OS !== 'web') {
        await this.startAccelerometer();
        await this.startOrientationListener();
      }

      this.isInitialized = true;
      logger.info('GestureService', 'Gesture service initialized', {
        shakeEnabled: this.settings.shakeEnabled,
        shakeAction: this.settings.shakeAction,
        shakeSensitivity: this.settings.shakeSensitivity,
      });
    } catch (error) {
      logger.error('GestureService', 'Failed to initialize gesture service', error);
    }
  }

  private async loadSettings(): Promise<void> {
    try {
      const [
        shakeEnabled,
        shakeAction,
        shakeSensitivity,
        disableShakeDuringTransfer,
        doubleTapAction,
        swipeLeftAction,
        swipeRightAction,
        longPressAction,
        rotationLock,
      ] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.SHAKE_ENABLED),
        AsyncStorage.getItem(STORAGE_KEYS.SHAKE_ACTION),
        AsyncStorage.getItem(STORAGE_KEYS.SHAKE_SENSITIVITY),
        AsyncStorage.getItem(STORAGE_KEYS.DISABLE_SHAKE_DURING_TRANSFER),
        AsyncStorage.getItem(STORAGE_KEYS.DOUBLE_TAP_ACTION),
        AsyncStorage.getItem(STORAGE_KEYS.SWIPE_LEFT_ACTION),
        AsyncStorage.getItem(STORAGE_KEYS.SWIPE_RIGHT_ACTION),
        AsyncStorage.getItem(STORAGE_KEYS.LONG_PRESS_ACTION),
        AsyncStorage.getItem(STORAGE_KEYS.ROTATION_LOCK),
      ]);

      this.settings = {
        shakeEnabled: shakeEnabled !== 'false',
        shakeAction: (shakeAction as ShakeAction) || 'discover_devices',
        shakeSensitivity: (shakeSensitivity as ShakeSensitivity) || 'medium',
        disableShakeDuringTransfer: disableShakeDuringTransfer !== 'false',
        doubleTapAction: (doubleTapAction as GestureAction) || 'pause_resume_transfer',
        swipeLeftAction: (swipeLeftAction as GestureAction) || 'delete',
        swipeRightAction: (swipeRightAction as GestureAction) || 'share',
        longPressAction: (longPressAction as GestureAction) || 'multi_select',
        rotationLockEnabled: rotationLock === 'true',
      };

      logger.debug('GestureService', 'Settings loaded', this.settings);
    } catch (error) {
      logger.error('GestureService', 'Failed to load settings', error);
    }
  }

  async saveSettings(newSettings: Partial<GestureSettings>): Promise<void> {
    try {
      const updates: Promise<void>[] = [];

      if (newSettings.shakeEnabled !== undefined) {
        this.settings.shakeEnabled = newSettings.shakeEnabled;
        updates.push(AsyncStorage.setItem(STORAGE_KEYS.SHAKE_ENABLED, String(newSettings.shakeEnabled)));
      }

      if (newSettings.shakeAction !== undefined) {
        this.settings.shakeAction = newSettings.shakeAction;
        updates.push(AsyncStorage.setItem(STORAGE_KEYS.SHAKE_ACTION, newSettings.shakeAction));
      }

      if (newSettings.shakeSensitivity !== undefined) {
        this.settings.shakeSensitivity = newSettings.shakeSensitivity;
        updates.push(AsyncStorage.setItem(STORAGE_KEYS.SHAKE_SENSITIVITY, newSettings.shakeSensitivity));
      }

      if (newSettings.disableShakeDuringTransfer !== undefined) {
        this.settings.disableShakeDuringTransfer = newSettings.disableShakeDuringTransfer;
        updates.push(AsyncStorage.setItem(STORAGE_KEYS.DISABLE_SHAKE_DURING_TRANSFER, String(newSettings.disableShakeDuringTransfer)));
      }

      if (newSettings.doubleTapAction !== undefined) {
        this.settings.doubleTapAction = newSettings.doubleTapAction;
        updates.push(AsyncStorage.setItem(STORAGE_KEYS.DOUBLE_TAP_ACTION, newSettings.doubleTapAction));
      }

      if (newSettings.swipeLeftAction !== undefined) {
        this.settings.swipeLeftAction = newSettings.swipeLeftAction;
        updates.push(AsyncStorage.setItem(STORAGE_KEYS.SWIPE_LEFT_ACTION, newSettings.swipeLeftAction));
      }

      if (newSettings.swipeRightAction !== undefined) {
        this.settings.swipeRightAction = newSettings.swipeRightAction;
        updates.push(AsyncStorage.setItem(STORAGE_KEYS.SWIPE_RIGHT_ACTION, newSettings.swipeRightAction));
      }

      if (newSettings.longPressAction !== undefined) {
        this.settings.longPressAction = newSettings.longPressAction;
        updates.push(AsyncStorage.setItem(STORAGE_KEYS.LONG_PRESS_ACTION, newSettings.longPressAction));
      }

      if (newSettings.rotationLockEnabled !== undefined) {
        this.settings.rotationLockEnabled = newSettings.rotationLockEnabled;
        updates.push(AsyncStorage.setItem(STORAGE_KEYS.ROTATION_LOCK, String(newSettings.rotationLockEnabled)));
      }

      await Promise.all(updates);
      logger.info('GestureService', 'Settings saved', newSettings);
    } catch (error) {
      logger.error('GestureService', 'Failed to save settings', error);
    }
  }

  private async startAccelerometer(): Promise<void> {
    try {
      if (Platform.OS === 'android' && nativeSensors.isAvailable()) {
        const available = await nativeSensors.isAccelerometerAvailable();
        if (!available) {
          logger.warn('GestureService', 'Native accelerometer not available');
          return;
        }

        nativeSensors.setAccelerometerUpdateInterval(100);
        this.accelerometerSubscription = nativeSensors.subscribeToAccelerometer(this.handleAccelerometerData);
        logger.info('GestureService', 'Native accelerometer started');
      } else {
        logger.warn('GestureService', 'Sensors module not available on this platform');
      }
    } catch (error) {
      logger.error('GestureService', 'Failed to start accelerometer', error);
    }
  }

  private handleAccelerometerData = (data: SensorData): void => {
    if (!this.settings.shakeEnabled) return;
    if (this.settings.disableShakeDuringTransfer && this.isTransferActive) return;
    if (this.settings.shakeAction === 'none') return;

    const now = Date.now();
    if (now - this.lastShakeTime < SHAKE_COOLDOWN) return;

    if (this.lastAcceleration) {
      const deltaX = Math.abs(data.x - this.lastAcceleration.x);
      const deltaY = Math.abs(data.y - this.lastAcceleration.y);
      const deltaZ = Math.abs(data.z - this.lastAcceleration.z);
      const totalDelta = deltaX + deltaY + deltaZ;

      const threshold = SHAKE_THRESHOLDS[this.settings.shakeSensitivity];

      if (totalDelta > threshold) {
        this.shakeCount++;
        
        if (this.shakeCount >= SHAKE_SAMPLES_REQUIRED) {
          this.triggerShake();
          this.shakeCount = 0;
          this.lastShakeTime = now;
        }
      } else {
        if (now - this.lastShakeTime > 300) {
          this.shakeCount = Math.max(0, this.shakeCount - 1);
        }
      }
    }

    this.lastAcceleration = data;
  };

  private triggerShake(): void {
    logger.info('GestureService', 'Shake detected', {
      action: this.settings.shakeAction,
    });

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    const event: GestureEvent = {
      type: 'shake',
      timestamp: Date.now(),
      data: { action: this.settings.shakeAction },
    };

    this.emitEvent('shake', event);
  }

  private async startOrientationListener(): Promise<void> {
    try {
      this.orientationSubscription = ScreenOrientation.addOrientationChangeListener(
        this.handleOrientationChange
      );
      logger.info('GestureService', 'Orientation listener started');
    } catch (error) {
      logger.error('GestureService', 'Failed to start orientation listener', error);
    }
  }

  private handleOrientationChange = (event: ScreenOrientation.OrientationChangeEvent): void => {
    logger.debug('GestureService', 'Orientation changed', {
      orientation: event.orientationInfo.orientation,
    });

    const gestureEvent: GestureEvent = {
      type: 'rotation',
      timestamp: Date.now(),
      data: { orientation: event.orientationInfo.orientation },
    };

    this.emitEvent('rotation', gestureEvent);
  };

  addListener(eventType: string, callback: GestureCallback): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(callback);

    return () => {
      const callbacks = this.listeners.get(eventType);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  private emitEvent(eventType: string, event: GestureEvent): void {
    const callbacks = this.listeners.get(eventType);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          logger.error('GestureService', 'Error in gesture callback', error);
        }
      });
    }

    const allCallbacks = this.listeners.get('all');
    if (allCallbacks) {
      allCallbacks.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          logger.error('GestureService', 'Error in gesture callback', error);
        }
      });
    }
  }

  setTransferActive(active: boolean): void {
    this.isTransferActive = active;
    logger.debug('GestureService', 'Transfer active state changed', { active });
  }

  getSettings(): GestureSettings {
    return { ...this.settings };
  }

  async lockOrientation(lock: ScreenOrientation.OrientationLock): Promise<void> {
    if (Platform.OS === 'web') return;
    
    try {
      await ScreenOrientation.lockAsync(lock);
      logger.info('GestureService', 'Orientation locked', { lock });
    } catch (error) {
      logger.error('GestureService', 'Failed to lock orientation', error);
    }
  }

  async unlockOrientation(): Promise<void> {
    if (Platform.OS === 'web') return;
    
    try {
      await ScreenOrientation.unlockAsync();
      logger.info('GestureService', 'Orientation unlocked');
    } catch (error) {
      logger.error('GestureService', 'Failed to unlock orientation', error);
    }
  }

  async getCurrentOrientation(): Promise<ScreenOrientation.Orientation | null> {
    if (Platform.OS === 'web') return null;
    
    try {
      return await ScreenOrientation.getOrientationAsync();
    } catch (error) {
      logger.error('GestureService', 'Failed to get orientation', error);
      return null;
    }
  }

  triggerManualGesture(type: GestureEvent['type'], data?: any): void {
    const event: GestureEvent = {
      type,
      timestamp: Date.now(),
      data,
    };

    this.emitEvent(type, event);
    logger.debug('GestureService', 'Manual gesture triggered', { type, data });
  }

  cleanup(): void {
    if (this.accelerometerSubscription) {
      this.accelerometerSubscription.remove();
      this.accelerometerSubscription = null;
    }

    if (this.orientationSubscription) {
      this.orientationSubscription.remove();
      this.orientationSubscription = null;
    }

    if (Platform.OS === 'android' && nativeSensors.isAvailable()) {
      nativeSensors.stopAll();
    }

    this.listeners.clear();
    this.isInitialized = false;
    logger.info('GestureService', 'Gesture service cleaned up');
  }
}

export const gestureService = new GestureServiceClass();
export default gestureService;
