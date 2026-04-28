import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";

// Load keys
const PRIVATE_KEY = fs.readFileSync(
  path.join(__dirname, "src/keys/private_key.pem"),
  "utf-8"
);
const PUBLIC_KEY = fs.readFileSync(
  path.join(__dirname, "src/keys/public_key.pem"),
  "utf-8"
);

// Test QR generation and verification
const testQrGeneration = () => {
  console.log("🧪 Testing QR Code Generation & Verification\n");

  // Sample data
  const registrationId = "reg_123456789";
  const workshopId = "workshop_123";
  const userId = "user_456";
  const workshopStartsAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow

  // Generate QR
  const exp = Math.floor(workshopStartsAt.getTime() / 1000) + 2 * 60 * 60;
  const payload = {
    sub: registrationId,
    workshopId,
    userId,
    type: "workshop_qr",
    exp,
  };

  const qrCode = jwt.sign(payload, PRIVATE_KEY, { algorithm: "RS256" });
  console.log("✅ Generated QR Code:");
  console.log(qrCode);
  console.log();

  // Verify QR
  try {
    const decoded = jwt.verify(qrCode, PUBLIC_KEY, {
      algorithms: ["RS256"],
      ignoreExpiration: false,
    }) as any;

    console.log("✅ QR Verification Successful:");
    console.log("Registration ID:", decoded.sub);
    console.log("Workshop ID:", decoded.workshopId);
    console.log("User ID:", decoded.userId);
    console.log("Type:", decoded.type);
    console.log("Expires:", new Date(decoded.exp * 1000).toISOString());
    console.log();

    // Test expiration
    const expiredPayload = {
      ...payload,
      exp: Math.floor(Date.now() / 1000) - 60, // 1 minute ago
    };
    const expiredQr = jwt.sign(expiredPayload, PRIVATE_KEY, { algorithm: "RS256" });

    try {
      jwt.verify(expiredQr, PUBLIC_KEY, {
        algorithms: ["RS256"],
        ignoreExpiration: false,
      });
      console.log("❌ ERROR: Expired QR should have failed verification");
    } catch (error: any) {
      if (error.name === "TokenExpiredError") {
        console.log("✅ Expired QR correctly rejected:", error.message);
      } else {
        console.log("❌ Unexpected error with expired QR:", error.message);
      }
    }

    // Test invalid signature
    const invalidQr = qrCode.replace(/.$/, "x");
    try {
      jwt.verify(invalidQr, PUBLIC_KEY, {
        algorithms: ["RS256"],
        ignoreExpiration: false,
      });
      console.log("❌ ERROR: Invalid signature should have failed verification");
    } catch (error: any) {
      console.log("✅ Invalid signature correctly rejected:", error.message);
    }

  } catch (error: any) {
    console.log("❌ QR Verification Failed:", error.message);
  }

  console.log("\n🎉 QR Code Test Complete");
};

// Run test
testQrGeneration();