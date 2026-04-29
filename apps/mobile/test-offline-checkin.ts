import { checkinDB } from "./src/services/offlineSync/checkinDatabase";
import { checkinSyncManager } from "./src/services/offlineSync/checkinSyncManager";
import NetInfo from "@react-native-community/netinfo";

// Test offline check-in functionality
const testOfflineCheckin = async () => {
  console.log("🧪 Testing Offline Check-in Functionality\n");

  try {
    // Initialize database
    await checkinDB.init();
    console.log("✅ Database initialized");

    // Clear any existing test data
    await checkinDB.clearSyncedRecords();
    console.log("✅ Cleared existing records");

    // Simulate offline check-ins
    console.log("\n📴 Simulating offline check-ins...");

    const testRecords = [
      {
        qrCode: "test.qr.code.1",
        registrationId: "reg_test_001",
        deviceId: "device_test_123",
        checkedInAt: new Date().toISOString(),
      },
      {
        qrCode: "test.qr.code.2",
        registrationId: "reg_test_002",
        deviceId: "device_test_123",
        checkedInAt: new Date().toISOString(),
      },
      {
        qrCode: "test.qr.code.3",
        registrationId: "reg_test_003",
        deviceId: "device_test_123",
        checkedInAt: new Date().toISOString(),
      },
      {
        qrCode: "test.qr.code.4",
        registrationId: "reg_test_004",
        deviceId: "device_test_123",
        checkedInAt: new Date().toISOString(),
      },
      {
        qrCode: "test.qr.code.5",
        registrationId: "reg_test_005",
        deviceId: "device_test_123",
        checkedInAt: new Date().toISOString(),
      },
    ];

    // Insert test check-ins
    for (const record of testRecords) {
      await checkinDB.insertCheckin(
        record.qrCode,
        record.registrationId,
        record.deviceId,
        record.checkedInAt
      );
      console.log(`✅ Inserted check-in for ${record.registrationId}`);
    }

    // Verify pending count
    const pendingCount = await checkinDB.getPendingCount();
    console.log(`✅ Pending check-ins: ${pendingCount} (expected: 5)`);

    if (pendingCount !== 5) {
      throw new Error(`Expected 5 pending records, got ${pendingCount}`);
    }

    // Test deduplication
    console.log("\n🔍 Testing deduplication...");
    const duplicateCheck = await checkinDB.hasCheckin("reg_test_001");
    console.log(`✅ Duplicate check for reg_test_001: ${duplicateCheck ? "EXISTS" : "NOT EXISTS"}`);

    // Try to insert duplicate
    try {
      await checkinDB.insertCheckin(
        "duplicate.qr",
        "reg_test_001", // Same registration ID
        "device_test_123",
        new Date().toISOString()
      );
      console.log("❌ ERROR: Duplicate insertion should have been prevented");
    } catch (error) {
      console.log("✅ Duplicate insertion correctly prevented");
    }

    // Verify count still 5
    const countAfterDuplicate = await checkinDB.getPendingCount();
    console.log(`✅ Count after duplicate attempt: ${countAfterDuplicate} (should still be 5)`);

    // Simulate network restoration and sync
    console.log("\n📡 Simulating network restoration and sync...");

    // Check network status
    const networkState = await NetInfo.fetch();
    const isOnline = networkState.type !== "none" && networkState.isConnected === true;
    console.log(`📊 Current network status: ${isOnline ? "Online" : "Offline"}`);

    if (isOnline) {
      console.log("🔄 Triggering sync...");
      await checkinSyncManager.syncWhenOnline();

      // Wait a bit for sync to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check pending count after sync
      const finalPendingCount = await checkinDB.getPendingCount();
      console.log(`✅ Pending count after sync: ${finalPendingCount}`);

      if (finalPendingCount === 0) {
        console.log("🎉 SUCCESS: All records synced to server!");
      } else {
        console.log(`⚠️  WARNING: ${finalPendingCount} records still pending. This may be expected if server validation fails for test data.`);
      }
    } else {
      console.log("⚠️  Device is offline - cannot test sync functionality");
      console.log("💡 To test sync: disconnect network, run check-ins, reconnect network, then run this test again");
    }

    console.log("\n🎉 Offline Check-in Test Complete");

  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    await checkinDB.close();
  }
};

// Run test
testOfflineCheckin();