import CryptoJS from "crypto-js";

export const ENCRYPTED_PREFIX = "DRAFT_ENC_V1:";

/**
 * Returns true if the draft content is encrypted with DRAFT_ENC_V1.
 */
export function isEncryptedDraft(content: string): boolean {
  return content.trimStart().startsWith(ENCRYPTED_PREFIX);
}

/**
 * Derives a per-article key from DRAFT_MASTER_KEY and article slug.
 */
export function deriveArticleKey(masterKey: string, slug: string): string {
  const hmac = CryptoJS.HmacSHA256(
    CryptoJS.enc.Utf8.parse(slug),
    CryptoJS.enc.Utf8.parse(masterKey),
  );
  return hmac.toString(CryptoJS.enc.Hex);
}

/**
 * Decrypts a DRAFT_ENC_V1 encrypted draft string using crypto-js.
 * Validates SIV integrity via HMAC-SHA256.
 */
export function decryptDraftContent(
  encryptedText: string,
  articleKey: string,
): string {
  const trimmed = encryptedText.trim();
  if (!trimmed.startsWith(ENCRYPTED_PREFIX)) {
    throw new Error(
      `Invalid draft format: missing "${ENCRYPTED_PREFIX}" prefix`,
    );
  }

  const payloadBase64 = trimmed.slice(ENCRYPTED_PREFIX.length);
  const rawWords = CryptoJS.enc.Base64.parse(payloadBase64);

  if (rawWords.sigBytes < 32 || rawWords.sigBytes % 16 !== 0) {
    throw new Error("Invalid payload: data is corrupted or truncated");
  }

  // First 16 bytes (4 words) are the IV
  const ivWords = rawWords.words.slice(0, 4);
  const iv = CryptoJS.lib.WordArray.create(ivWords, 16);

  // Remaining bytes are the ciphertext
  const ciphertextWords = rawWords.words.slice(4);
  const ciphertextSigBytes = rawWords.sigBytes - 16;
  const ciphertext = CryptoJS.lib.WordArray.create(
    ciphertextWords,
    ciphertextSigBytes,
  );

  // Compute AES-256 key: SHA-256("aes-key:" + articleKey)
  const aesKey = CryptoJS.SHA256(
    CryptoJS.enc.Utf8.parse("aes-key:" + articleKey),
  );

  // Decrypt AES-256-CBC with PKCS#7 padding
  const cipherParams = CryptoJS.lib.CipherParams.create({ ciphertext });
  const decryptedBytes = CryptoJS.AES.decrypt(cipherParams, aesKey, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  const decryptedText = decryptedBytes.toString(CryptoJS.enc.Utf8);
  if (!decryptedText) {
    throw new Error("Decryption failed: invalid key or corrupted payload");
  }

  // SIV verification: HMAC-SHA256(aesKey, decryptedText) first 16 bytes must match IV
  const expectedHmac = CryptoJS.HmacSHA256(
    CryptoJS.enc.Utf8.parse(decryptedText),
    aesKey,
  );
  const expectedIvHex = CryptoJS.lib.WordArray.create(
    expectedHmac.words.slice(0, 4),
    16,
  ).toString(CryptoJS.enc.Hex);
  const ivHex = iv.toString(CryptoJS.enc.Hex);

  if (expectedIvHex !== ivHex) {
    throw new Error("Integrity check failed: invalid key or corrupted draft");
  }

  return decryptedText;
}
