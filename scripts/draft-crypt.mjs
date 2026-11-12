#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import child_process from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

export const ENCRYPTED_PREFIX = "DRAFT_ENC_V1:";

/**
 * Loads DRAFT_MASTER_KEY from process.env.
 */
export function loadMasterKey() {
  return process.env.DRAFT_MASTER_KEY || null;
}

/**
 * Derives per-article key from masterKey and slug.
 */
export function deriveArticleKey(masterKey, slug) {
  return crypto
    .createHmac("sha256", masterKey)
    .update(slug, "utf8")
    .digest("hex");
}

/**
 * Encrypts draft plaintext deterministically (SIV-like scheme using HMAC-SHA256 derived IV).
 */
export function encryptDraftContent(plaintext, articleKey) {
  const normalized = plaintext.replace(/\r\n/g, "\n");
  const aesKey = crypto
    .createHash("sha256")
    .update("aes-key:" + articleKey, "utf8")
    .digest();
  const iv = crypto
    .createHmac("sha256", aesKey)
    .update(normalized, "utf8")
    .digest()
    .subarray(0, 16);
  const cipher = crypto.createCipheriv("aes-256-cbc", aesKey, iv);
  const ciphertext = Buffer.concat([
    cipher.update(normalized, "utf8"),
    cipher.final(),
  ]);
  return (
    ENCRYPTED_PREFIX + Buffer.concat([iv, ciphertext]).toString("base64") + "\n"
  );
}

/**
 * Decrypts draft ciphertext and verifies SIV integrity.
 */
export function decryptDraftContent(encryptedText, articleKey) {
  const trimmed = encryptedText.trim();
  if (!trimmed.startsWith(ENCRYPTED_PREFIX)) {
    throw new Error(`Missing ${ENCRYPTED_PREFIX} prefix`);
  }
  const payloadBase64 = trimmed.slice(ENCRYPTED_PREFIX.length);
  const raw = Buffer.from(payloadBase64, "base64");
  if (raw.length < 32 || raw.length % 16 !== 0) {
    throw new Error("Invalid encrypted payload size");
  }
  const iv = raw.subarray(0, 16);
  const ciphertext = raw.subarray(16);
  const aesKey = crypto
    .createHash("sha256")
    .update("aes-key:" + articleKey, "utf8")
    .digest();
  const decipher = crypto.createDecipheriv("aes-256-cbc", aesKey, iv);
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");

  const expectedIv = crypto
    .createHmac("sha256", aesKey)
    .update(decrypted, "utf8")
    .digest()
    .subarray(0, 16);
  if (!crypto.timingSafeEqual(iv, expectedIv)) {
    throw new Error("Integrity check failed: invalid key or corrupted draft");
  }
  return decrypted;
}

function readStdin() {
  return fs.readFileSync(0, "utf8");
}

function getGitConfig(key) {
  try {
    return child_process
      .execFileSync("git", ["config", "--get", key], {
        cwd: repoRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      })
      .trim();
  } catch {
    return null;
  }
}

function setGitConfig(key, value) {
  child_process.execFileSync("git", ["config", key, value], {
    cwd: repoRoot,
    stdio: "inherit",
  });
}

function configureGitFilters({ quiet = false } = {}) {
  try {
    child_process.execFileSync("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd: repoRoot,
      stdio: "ignore",
    });
  } catch {
    return false;
  }

  const desired = [
    ["filter.draft-crypt.clean", "node scripts/draft-crypt.mjs clean %f"],
    ["filter.draft-crypt.smudge", "node scripts/draft-crypt.mjs smudge %f"],
    ["filter.draft-crypt.required", "true"],
    ["diff.draft-crypt.textconv", "node scripts/draft-crypt.mjs textconv"],
  ];

  let changed = false;
  for (const [key, val] of desired) {
    if (getGitConfig(key) !== val) {
      setGitConfig(key, val);
      changed = true;
    }
  }

  if (changed || !quiet) {
    console.log(
      "[draft-crypt] Git filter and diff driver configured successfully.",
    );
  }
  return true;
}

const command = process.argv[2];

switch (command) {
  case "clean": {
    const stdin = readStdin();
    if (!stdin.trim() || stdin.trimStart().startsWith(ENCRYPTED_PREFIX)) {
      process.stdout.write(stdin);
      process.exit(0);
    }
    const file = process.argv[3] || "";
    const slug = path.basename(file, ".md");
    const masterKey = loadMasterKey();
    if (!masterKey) {
      console.error(
        `[draft-crypt] Error: DRAFT_MASTER_KEY is not set! Refusing to stage plaintext draft "${file}".`,
      );
      process.exit(1);
    }
    const articleKey = deriveArticleKey(masterKey, slug);
    const encrypted = encryptDraftContent(stdin, articleKey);
    process.stdout.write(encrypted);
    break;
  }

  case "smudge": {
    const stdin = readStdin();
    if (!stdin.trimStart().startsWith(ENCRYPTED_PREFIX)) {
      process.stdout.write(stdin);
      process.exit(0);
    }
    const masterKey = loadMasterKey();
    if (!masterKey) {
      // Leave encrypted in CI / checkouts without key
      process.stdout.write(stdin);
      process.exit(0);
    }
    const file = process.argv[3] || "";
    const slug = path.basename(file, ".md");
    try {
      const articleKey = deriveArticleKey(masterKey, slug);
      const decrypted = decryptDraftContent(stdin, articleKey);
      process.stdout.write(decrypted);
    } catch (err) {
      console.error(
        `[draft-crypt] Warning: Decryption failed for "${file}": ${err.message}. Leaving encrypted.`,
      );
      process.stdout.write(stdin);
    }
    break;
  }

  case "textconv": {
    const file = process.argv[3];
    if (!file || !fs.existsSync(file)) {
      process.exit(0);
    }
    const content = fs.readFileSync(file, "utf8");
    if (!content.trimStart().startsWith(ENCRYPTED_PREFIX)) {
      process.stdout.write(content);
      process.exit(0);
    }
    const masterKey = loadMasterKey();
    if (!masterKey) {
      process.stdout.write(content);
      process.exit(0);
    }
    const slug = path.basename(file, ".md");
    try {
      const articleKey = deriveArticleKey(masterKey, slug);
      const decrypted = decryptDraftContent(content, articleKey);
      process.stdout.write(decrypted);
    } catch {
      process.stdout.write(content);
    }
    break;
  }

  case "setup": {
    const quiet = process.argv.includes("--quiet");
    configureGitFilters({ quiet });
    break;
  }

  case "unlock": {
    configureGitFilters({ quiet: true });
    const masterKey = loadMasterKey();
    if (!masterKey) {
      console.error(
        "[draft-crypt] Error: DRAFT_MASTER_KEY environment variable is not set",
      );
      process.exit(1);
    }
    const draftsDir = path.join(repoRoot, "drafts");
    if (!fs.existsSync(draftsDir)) {
      console.log("[draft-crypt] drafts directory does not exist.");
      process.exit(0);
    }
    for (const f of fs.readdirSync(draftsDir)) {
      if (!f.endsWith(".md")) continue;
      const filePath = path.join(draftsDir, f);
      const content = fs.readFileSync(filePath, "utf8");
      if (content.trimStart().startsWith(ENCRYPTED_PREFIX)) {
        const slug = path.basename(f, ".md");
        const articleKey = deriveArticleKey(masterKey, slug);
        const decrypted = decryptDraftContent(content, articleKey);
        fs.writeFileSync(filePath, decrypted, "utf8");
        console.log(`[draft-crypt] Unlocked (decrypted): drafts/${f}`);
      } else {
        console.log(`[draft-crypt] Already plaintext: drafts/${f}`);
      }
    }
    break;
  }

  case "lock": {
    const masterKey = loadMasterKey();
    if (!masterKey) {
      console.error(
        "[draft-crypt] Error: DRAFT_MASTER_KEY environment variable is not set",
      );
      process.exit(1);
    }
    const draftsDir = path.join(repoRoot, "drafts");
    if (!fs.existsSync(draftsDir)) {
      console.log("[draft-crypt] drafts directory does not exist.");
      process.exit(0);
    }
    for (const f of fs.readdirSync(draftsDir)) {
      if (!f.endsWith(".md")) continue;
      const filePath = path.join(draftsDir, f);
      const content = fs.readFileSync(filePath, "utf8");
      if (!content.trimStart().startsWith(ENCRYPTED_PREFIX)) {
        const slug = path.basename(f, ".md");
        const articleKey = deriveArticleKey(masterKey, slug);
        const encrypted = encryptDraftContent(content, articleKey);
        fs.writeFileSync(filePath, encrypted, "utf8");
        console.log(`[draft-crypt] Locked (encrypted): drafts/${f}`);
      } else {
        console.log(`[draft-crypt] Already encrypted: drafts/${f}`);
      }
    }
    break;
  }

  case "status":
  case "key": {
    const targetSlug = process.argv[3];
    const masterKey = loadMasterKey();
    const draftsDir = path.join(repoRoot, "drafts");

    if (!fs.existsSync(draftsDir)) {
      console.log("[draft-crypt] No drafts directory found.");
      process.exit(0);
    }

    const files = fs
      .readdirSync(draftsDir)
      .filter(
        (f) =>
          f.endsWith(".md") &&
          (!targetSlug || path.basename(f, ".md") === targetSlug),
      );

    if (files.length === 0) {
      if (targetSlug) {
        if (masterKey) {
          const encKey = deriveArticleKey(masterKey, targetSlug);
          console.log(`Slug:    ${targetSlug}`);
          console.log(`enc_key: ${encKey}`);
          console.log(`URL:     /drafts/${targetSlug}?enc_key=${encKey}`);
          process.exit(0);
        }
        console.log(
          `[draft-crypt] No draft file found matching slug "${targetSlug}".`,
        );
      } else {
        console.log("[draft-crypt] No draft (*.md) files found in drafts/.");
      }
      process.exit(0);
    }

    for (const f of files) {
      const slug = path.basename(f, ".md");
      const filePath = path.join(draftsDir, f);
      const content = fs.readFileSync(filePath, "utf8");
      const isEnc = content.trimStart().startsWith(ENCRYPTED_PREFIX);
      console.log(`--- [drafts/${f}] ---`);
      console.log(
        `  Working tree: ${isEnc ? "Encrypted" : "Plaintext (decrypted)"}`,
      );

      if (masterKey) {
        const encKey = deriveArticleKey(masterKey, slug);
        console.log(`  enc_key:      ${encKey}`);
        console.log(`  Share URL:    /drafts/${slug}?enc_key=${encKey}`);
      } else {
        console.log(`  enc_key:      (DRAFT_MASTER_KEY is not set)`);
      }
    }
    break;
  }

  default: {
    console.error(`Usage: node scripts/draft-crypt.mjs <command> [args...]`);
    console.error(
      `Commands: clean, smudge, textconv, setup, unlock, lock, status, key`,
    );
    process.exit(1);
  }
}
