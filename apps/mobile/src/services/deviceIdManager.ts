import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";

const DEVICE_ID_KEY = "unihub_device_id";

/**
 * Device ID Manager
 * Generates and stores unique device ID for offline sync tracking
 */
export class DeviceIdManager {
  private static instance: DeviceIdManager;
  private deviceId: string | null = null;

  private constructor() {}

  static getInstance(): DeviceIdManager {
    if (!DeviceIdManager.instance) {
      DeviceIdManager.instance = new DeviceIdManager();
    }
    return DeviceIdManager.instance;
  }

  /**
   * Get or generate device ID
   */
  async getDeviceId(): Promise<string> {
    if (this.deviceId) {
      return this.deviceId;
    }

    try {
      // Try to get from secure store
      const stored = await SecureStore.getItemAsync(DEVICE_ID_KEY);
      if (stored) {
        this.deviceId = stored;
        return this.deviceId;
      }

      // Generate new device ID
      const newId = await this.generateDeviceId();
      await SecureStore.setItemAsync(DEVICE_ID_KEY, newId);
      this.deviceId = newId;
      return this.deviceId;
    } catch (error) {
      console.error("Error getting device ID:", error);
      // Fallback to temporary device ID
      return this.generateTemporaryDeviceId();
    }
  }

  /**
   * Generate unique device ID
   */
  private async generateDeviceId(): Promise<string> {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${timestamp}-${random}`
    );
    return `device_${hash.substring(0, 16)}`;
  }

  /**
   * Generate temporary device ID (when SecureStore fails)
   */
  private generateTemporaryDeviceId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `device_temp_${timestamp}_${random}`;
  }

  /**
   * Reset device ID (for testing or uninstall)
   */
  async resetDeviceId(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(DEVICE_ID_KEY);
      this.deviceId = null;
    } catch (error) {
      console.error("Error resetting device ID:", error);
    }
  }
}

export const deviceIdManager = DeviceIdManager.getInstance();
