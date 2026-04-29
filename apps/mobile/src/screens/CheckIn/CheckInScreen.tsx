import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";
import NetInfo from "@react-native-community/netinfo";
import { useAuth } from "../../contexts/AuthContext";
import { checkinDB } from "../../services/offlineSync/checkinDatabase";
import { checkinSyncManager } from "../../services/offlineSync/checkinSyncManager";
import { deviceIdManager } from "../../services/deviceIdManager";
import { verifyQrCodeJwt, isQrExpired } from "../../services/qrVerification";
import { api } from "../../services/api";


const { width } = Dimensions.get("window");

// Sound instance for QR scan feedback
let scanSound: Audio.Sound | null = null;

// Initialize sound on app start
const initializeSound = async () => {
  try {
    // Set audio mode for sound effects
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: false,
    });

    // Load sound file
    const { sound } = await Audio.Sound.createAsync(
      require("../../../assets/sounds/tic-tic.mp3"),
      { shouldPlay: false }
    );
    scanSound = sound;
    console.log("🔊 Scan sound loaded successfully");
  } catch (error) {
    console.warn(
      "⚠️ Could not load scan sound file, using vibration fallback",
      error
    );
  }
};

// Sound feedback function - "tic tic" từ sound file
const playScanSound = async () => {
  try {
    // Try to play sound file first
    if (scanSound) {
      await scanSound.setPositionAsync(0); // Reset to beginning
      await scanSound.playAsync();
      console.log("🔊 Playing tic-tic sound from file");
    } else {
      // Fallback to Web Audio API (for web)
      if (typeof window !== 'undefined' && window.AudioContext) {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

        // First beep
        const oscillator1 = audioContext.createOscillator();
        const gainNode1 = audioContext.createGain();

        oscillator1.connect(gainNode1);
        gainNode1.connect(audioContext.destination);

        oscillator1.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator1.type = 'sine';
        gainNode1.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode1.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

        oscillator1.start(audioContext.currentTime);
        oscillator1.stop(audioContext.currentTime + 0.1);

        // Second beep (tic-tic)
        setTimeout(() => {
          const oscillator2 = audioContext.createOscillator();
          const gainNode2 = audioContext.createGain();

          oscillator2.connect(gainNode2);
          gainNode2.connect(audioContext.destination);

          oscillator2.frequency.setValueAtTime(800, audioContext.currentTime);
          oscillator2.type = 'sine';
          gainNode2.gain.setValueAtTime(0.1, audioContext.currentTime);
          gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

          oscillator2.start(audioContext.currentTime);
          oscillator2.stop(audioContext.currentTime + 0.1);
        }, 150);

        console.log("🔊 Playing generated tic-tic sound");
      } else {
        // Final fallback: vibration
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setTimeout(() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }, 100);
        console.log("📳 Using vibration fallback");
      }
    }
  } catch (error) {
    // Final fallback
    console.log("🔊 Scan sound feedback");
  }
};

interface ScanResult {
  data: string;
}

export const CheckInScreen: React.FC<{ navigation: any }> = ({
  navigation,
}) => {
  const { user, logout } = useAuth();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(true);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastResult, setLastResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Initialize database and network monitoring
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize database
        await checkinDB.init();

        // Get device ID
        const deviceId = await deviceIdManager.getDeviceId();
        console.log("Device initialized with ID:", deviceId);

        // Initialize sound for QR scanning feedback
        await initializeSound();

        // Monitor network status
        const unsubscribe = NetInfo.addEventListener((state) => {
          const online =
            state.type !== "none" && state.isConnected === true;
          setIsOnline(online);
          console.log("Network status:", online ? "Online" : "Offline");

          // Auto-sync when coming back online (SyncManager will check for pending records)
          if (online) {
            console.log("Network restored, attempting auto-sync...");
            checkinSyncManager.syncWhenOnline();
          }
        });

        return unsubscribe;
      } catch (error) {
        console.error("Error initializing app:", error);
        Alert.alert("Error", "Failed to initialize check-in system");
      }
    };

    const unsubscribeInit = initializeApp();

    return () => {
      unsubscribeInit.then((unsub) => unsub?.());
      checkinSyncManager.destroy();
      checkinDB.close();

      // Cleanup sound
      if (scanSound) {
        scanSound.unloadAsync();
        scanSound = null;
      }
    };
  }, []);

  // Update pending count periodically
  useEffect(() => {
    const updatePendingCount = async () => {
      const count = await checkinDB.getPendingCount();
      setPendingCount(count);
    };

    updatePendingCount();
    const interval = setInterval(updatePendingCount, 5000);

    return () => clearInterval(interval);
  }, []);

  // Request camera permission
  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  // Handle QR code scan
  const handleQrScanned = async (scannedData: string) => {
    // Prevent duplicate scans
    if (
      !isScanning ||
      isProcessing ||
      lastScanned === scannedData
    ) {
      return;
    }

    // Play "tic tic" sound khi scan QR
    await playScanSound();

    setLastScanned(scannedData);
    setIsScanning(false);
    setIsProcessing(true);
    setLastResult(null);

    try {
      // 1. Basic QR format validation
      if (!scannedData.includes(".") || scannedData.split(".").length !== 3) {
        throw new Error("Invalid QR code format");
      }

      // 2. Check if expired
      if (isQrExpired(scannedData)) {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Error
        );
        setLastResult({
          type: "error",
          message: "QR code expired",
        });
        throw new Error("QR code expired");
      }

      // 3. Verify JWT signature and extract payload
      const payload = await verifyQrCodeJwt(scannedData);
      // console.log(" QR signature verified:", payload);

      // 4. Check local dedup (SQLite)
      const alreadyCheckedIn = await checkinDB.hasCheckin(
        payload.sub
      );
      if (alreadyCheckedIn) {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Error
        );
        setLastResult({
          type: "error",
          message: " Already checked in",
        });
        throw new Error("Registration already checked in");
      }

      // 5. Save to local database
      const deviceId = await deviceIdManager.getDeviceId();
      const now = new Date().toISOString();

      await checkinDB.insertCheckin(
        scannedData,
        payload.sub,
        deviceId,
        now
      );

      // console.log(" Saved to local database");

      // 6. Try online check-in if connected
      let studentName = "Sinh viên";
      if (isOnline) {
        try {
          const response = await api.post("/checkins", {
            qrCode: scannedData,
            deviceId,
          });
          // console.log(response.data)
          if (response.data?.student?.fullName) {
            studentName = response.data.student.fullName;
            console.log("Online check-in successful:", studentName);
          }

          // Online thành công → mark synced=1 để không sync lại
          await checkinDB.markSynced(scannedData);
        } catch (error: any) {
          // If online check-in fails, it's ok - we have local record
          console.warn("Online check-in failed (will sync later):", error);
        }
      }

      // 7. Show success feedback
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );

      setLastResult({
        type: "success",
        message: `🎉 Chào mừng ${studentName}!`,
      });

      // Update pending count
      const count = await checkinDB.getPendingCount();
      setPendingCount(count);

      // Reset scanner after 1.5-2 seconds for next person
      setTimeout(() => {
        setLastScanned(null);
        setIsScanning(true);
        setLastResult(null);
      }, 1500);
    } catch (error: any) {
      // Log friendly message instead of ugly error
      console.warn(" QR scan failed:", error.message);

      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Error
      );

      setLastResult({
        type: "error",
        message: error.message || " Invalid QR code",
      });

      // Reset after 2 seconds
      setTimeout(() => {
        setLastScanned(null);
        setIsScanning(true);
        setLastResult(null);
      }, 2000);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle manual sync
  const handleManualSync = async () => {
    if (pendingCount === 0) {
      Alert.alert("Info", "No pending check-ins to sync");
      return;
    }

    if (!isOnline) {
      Alert.alert("Error", "Device is offline. Please check your connection.");
      return;
    }

    try {
      await checkinSyncManager.syncWhenOnline();
      const count = await checkinDB.getPendingCount();
      setPendingCount(count);
      Alert.alert("Success", "Sync completed");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Sync failed");
    }
  };

  const handleLogout = async () => {
    Alert.alert("Confirm", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await logout();
          navigation.replace("Login");
        },
      },
    ]);
  };

  if (!permission?.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>📷 Camera Permission Required</Text>
        <Text style={styles.subtitle}>
          This app needs camera access to scan QR codes
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={requestPermission}
        >
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera View */}
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        onBarcodeScanned={(result) => {
          if (result.data) {
            handleQrScanned(result.data);
          }
        }}
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
      >
        {/* Scanning Overlay */}
        <View style={styles.scannerOverlay}>
          <View style={styles.scannerFrame} />
          <Text style={styles.scannerText}>
            {isProcessing
              ? " Processing..."
              : "Align QR code within frame"}
          </Text>
        </View>

        {/* Result Display */}
        {lastResult && (
          <View style={[
            styles.resultBox,
            lastResult.type === "success"
              ? styles.resultSuccess
              : styles.resultError,
          ]}>
            <Text style={styles.resultText}>{lastResult.message}</Text>
          </View>
        )}
      </CameraView>

      {/* Bottom Control Panel */}
      <View style={styles.controlPanel}>
        {/* Network Status */}
        <View style={styles.statusBar}>
          <View style={styles.statusItem}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isOnline ? "#10b981" : "#ef4444" },
              ]}
            />
            <Text style={styles.statusText}>
              {isOnline ? "Online" : "Offline"}
            </Text>
          </View>

          {/* Pending Count */}
          {pendingCount > 0 && (
            <View style={styles.statusItem}>
              <Text style={styles.pendingBadge}>{pendingCount}</Text>
              <Text style={styles.statusText}>Pending sync</Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, pendingCount === 0 && styles.buttonDisabled]}
            onPress={handleManualSync}
            disabled={pendingCount === 0 || !isOnline}
          >
            <Text style={styles.buttonText}>
              🔄 Sync {pendingCount > 0 ? `(${pendingCount})` : ""}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.logoutButton]}
            onPress={handleLogout}
          >
            <Text style={styles.buttonText}> Logout</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  camera: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  scannerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 200,
  },
  scannerFrame: {
    width: width * 0.7,
    height: width * 0.7,
    borderWidth: 2,
    borderColor: "#10b981",
    borderRadius: 12,
    backgroundColor: "transparent",
  },
  scannerText: {
    color: "#fff",
    fontSize: 14,
    marginTop: 16,
    textAlign: "center",
  },
  resultBox: {
    position: "absolute",
    bottom: 250,
    left: 16,
    right: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  resultSuccess: {
    backgroundColor: "rgba(16, 185, 129, 0.9)",
  },
  resultError: {
    backgroundColor: "rgba(239, 68, 68, 0.9)",
  },
  resultText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  controlPanel: {
    backgroundColor: "#1f2937",
    paddingTop: 16,
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  statusBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 16,
    paddingVertical: 8,
    backgroundColor: "#111827",
    borderRadius: 8,
  },
  statusItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    color: "#d1d5db",
    fontSize: 12,
  },
  pendingBadge: {
    backgroundColor: "#3b82f6",
    color: "#fff",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    fontSize: 11,
    fontWeight: "bold",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8,
  },
  button: {
    flex: 1,
    backgroundColor: "#3b82f6",
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonDisabled: {
    backgroundColor: "#6b7280",
  },
  logoutButton: {
    backgroundColor: "#ef4444",
  },
  buttonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: "#d1d5db",
    textAlign: "center",
    paddingHorizontal: 32,
    marginBottom: 24,
  },
});
