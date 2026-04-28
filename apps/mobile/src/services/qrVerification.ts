import { publicKeyPem } from "../keys/public_key";
import { QrPayload } from "../types/checkin";

/**
 * JWT Verification for QR Codes using RS256 (RSA)
 * Verifies signature locally without calling API
 *
 * Sử dụng atob() (có sẵn trên React Native) thay vì Buffer (Node.js only)
 */

interface JwtHeader {
  alg: string;
  typ: string;
}

interface JwtToken {
  header: JwtHeader;
  payload: QrPayload & { exp: number };
  signature: string;
}

// ─── Base64 URL Helpers (React Native compatible) ─────────────────────────────

/**
 * Decode base64url string (JWT standard encoding)
 * Dùng atob() có sẵn trong React Native thay vì Buffer (Node.js)
 */
function base64UrlDecode(str: string): string {
  // Convert base64url → base64 standard
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");

  // Pad with '=' to make length divisible by 4
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }

  return atob(base64);
}

/**
 * Convert base64url string to Uint8Array (for signature verification)
 */
function base64UrlToUint8Array(str: string): Uint8Array {
  const binaryString = base64UrlDecode(str);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Convert PEM public key to CryptoKey for SubtleCrypto verification
 */
async function importPublicKey(pem: string): Promise<CryptoKey> {
  // Remove PEM headers and whitespace
  const pemContents = pem
    .replace("-----BEGIN PUBLIC KEY-----", "")
    .replace("-----END PUBLIC KEY-----", "")
    .replace(/\s/g, "");

  // Decode base64 to binary
  const binaryString = atob(pemContents);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Import as RSA public key
  return crypto.subtle.importKey(
    "spki",
    bytes.buffer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["verify"]
  );
}

// ─── JWT Decode ───────────────────────────────────────────────────────────────

/**
 * Decode JWT into header, payload, and signature
 */
function decodeJwt(token: string): JwtToken {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format");
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  try {
    const header = JSON.parse(base64UrlDecode(headerB64));
    const payload = JSON.parse(base64UrlDecode(payloadB64));

    return {
      header,
      payload,
      signature: signatureB64,
    };
  } catch (error) {
    throw new Error("Failed to decode JWT");
  }
}

// ─── JWT Signature Verification ───────────────────────────────────────────────

/**
 * Verify JWT RS256 signature using Web Crypto API (SubtleCrypto)
 * Hermes (React Native 0.81+) hỗ trợ globalThis.crypto.subtle
 */
async function verifyJwtSignature(token: string): Promise<boolean> {
  // Kiểm tra SubtleCrypto có sẵn không
  if (typeof crypto === "undefined" || !crypto.subtle) {
    console.warn(
      "⚠️ SubtleCrypto not available — skipping RSA signature verification"
    );
    return true; // Fallback: chấp nhận (vẫn check exp + type)
  }

  try {
    const [headerB64, payloadB64, signatureB64] = token.split(".");

    // Import public key
    const publicKey = await importPublicKey(publicKeyPem);

    // Message = header.payload (UTF-8 encoded)
    const message = `${headerB64}.${payloadB64}`;
    const encoder = new TextEncoder();
    const messageBytes = encoder.encode(message);

    // Signature from base64url
    const signatureBytes = base64UrlToUint8Array(signatureB64);

    // Verify RSA-SHA256 signature
    const isValid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      publicKey,
      signatureBytes as any,
      messageBytes as any
    );

    return isValid;
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse and verify QR code JWT locally
 * Returns decoded payload if valid, throws if invalid
 */
export async function verifyQrCodeJwt(
  qrCode: string
): Promise<QrPayload & { exp: number }> {
  try {
    // Decode JWT
    const jwt = decodeJwt(qrCode);

    // Check algorithm is RS256
    if (jwt.header.alg !== "RS256") {
      throw new Error("Invalid JWT algorithm");
    }

    // Check type is workshop_qr
    if (jwt.payload.type !== "workshop_qr") {
      throw new Error("Invalid QR type");
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (jwt.payload.exp < now) {
      throw new Error("QR code expired");
    }

    // Verify RSA signature
    const isValid = await verifyJwtSignature(qrCode);
    if (!isValid) {
      throw new Error("Mã QR không hợp lệ (chữ ký sai)");
    }

    return jwt.payload;
  } catch (error: any) {
    throw new Error(`QR verification failed: ${error.message}`);
  }
}

/**
 * Extract registration ID from QR code without full verification
 * Used for checking duplicates before full validation
 */
export function extractRegistrationId(qrCode: string): string | null {
  try {
    const jwt = decodeJwt(qrCode);
    return jwt.payload.sub; // registration ID
  } catch {
    return null;
  }
}

/**
 * Check if QR code is expired
 */
export function isQrExpired(qrCode: string): boolean {
  try {
    const jwt = decodeJwt(qrCode);
    const now = Math.floor(Date.now() / 1000);
    return jwt.payload.exp < now;
  } catch {
    return true; // Consider invalid QR as expired
  }
}

/**
 * Extract student name from QR payload (if available in JWT)
 * Note: This would come from server response, not from JWT
 */
export function getQrPayloadInfo(qrCode: string): {
  registrationId: string;
  workshopId: string;
  userId: string;
  expiresAt: Date;
} | null {
  try {
    const jwt = decodeJwt(qrCode);
    return {
      registrationId: jwt.payload.sub,
      workshopId: jwt.payload.workshopId,
      userId: jwt.payload.userId,
      expiresAt: new Date(jwt.payload.exp * 1000),
    };
  } catch {
    return null;
  }
}
