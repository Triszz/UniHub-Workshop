import { checkinDB } from "./src/services/offlineSync/checkinDatabase";

// Test SQLite database operations
const testDatabase = async () => {
  console.log("🧪 Testing SQLite Database Operations\n");

  try {
    // Initialize database
    await checkinDB.init();
    console.log("✅ Database initialized");

    // Test insert
    const qrCode = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.test";
    const registrationId = "reg_test_123";
    const deviceId = "device_test_456";
    const checkedInAt = new Date().toISOString();

    await checkinDB.insertCheckin(qrCode, registrationId, deviceId, checkedInAt);
    console.log("✅ Check-in record inserted");

    // Test deduplication
    const alreadyExists = await checkinDB.hasCheckin(registrationId);
    console.log("✅ Deduplication check:", alreadyExists ? "EXISTS" : "NOT EXISTS");

    // Try to insert duplicate (should work but we'll check count)
    try {
      await checkinDB.insertCheckin(qrCode + "2", registrationId, deviceId, checkedInAt);
      console.log("❌ ERROR: Duplicate insertion should have failed");
    } catch (error) {
      console.log("✅ Duplicate insertion correctly prevented");
    }

    // Test pending count
    const pendingCount = await checkinDB.getPendingCount();
    console.log("✅ Pending records count:", pendingCount);

    // Test mark as synced
    await checkinDB.markSynced(qrCode);
    const newPendingCount = await checkinDB.getPendingCount();
    console.log("✅ After marking synced, pending count:", newPendingCount);

    console.log("\n🎉 Database Test Complete");

  } catch (error) {
    console.error("❌ Database test failed:", error);
  } finally {
    await checkinDB.close();
  }
};

// Run test
testDatabase();