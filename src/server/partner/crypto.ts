import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/*
 * Field-level encryption for sensitive dealer data (bank account numbers).
 * AES-256-GCM with PARTNER_DATA_KEY (32 bytes, base64) from the environment.
 * Stored as "enc:v1:<iv>:<tag>:<ciphertext>" (base64url parts).
 */

function key() {
  const raw = process.env.PARTNER_DATA_KEY;
  if (!raw) throw new Error("PARTNER_DATA_KEY is not set — add a 32-byte base64 key to .env.local (see .env.example).");
  const buf = Buffer.from(raw, "base64");
  // Accept any length by hashing to 32 bytes, so a typo'd key fails loudly only on decrypt.
  return buf.length === 32 ? buf : createHash("sha256").update(buf).digest();
}

export const isEncrypted = (v: string) => v.startsWith("enc:v1:");

export function encryptField(plain: string): string {
  if (!plain || isEncrypted(plain)) return plain;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["enc", "v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(":");
}

export function decryptField(stored: string): string {
  if (!stored || !isEncrypted(stored)) return stored;
  const [, , iv, tag, data] = stored.split(":");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

/** "XXXXXXXX4321" — safe to show anywhere. Works on encrypted or plain values. */
export function maskAccount(stored: string): string {
  if (!stored) return "";
  let plain = stored;
  try {
    plain = decryptField(stored);
  } catch {
    return "••••";
  }
  const digits = plain.replace(/\s/g, "");
  return digits.length <= 4 ? digits : `${"X".repeat(Math.max(4, digits.length - 4))}${digits.slice(-4)}`;
}
