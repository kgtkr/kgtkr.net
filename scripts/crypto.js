import CryptoJS from "crypto-js";
import fs from "node:fs";

const mode = process.argv[2]; // 'encrypt' or 'decrypt'
const file = process.argv[3];
const key = process.argv[4];

if (!mode || !file || !key) {
  console.error("Usage: node crypto.js <encrypt|decrypt> <file> <key>");
  process.exit(1);
}

const content = fs.readFileSync(file, "utf8");

if (mode === "encrypt") {
  const encrypted = CryptoJS.AES.encrypt(content, key).toString();
  process.stdout.write(encrypted);
} else if (mode === "decrypt") {
  const decrypted = CryptoJS.AES.decrypt(content, key).toString(CryptoJS.enc.Utf8);
  process.stdout.write(decrypted);
} else {
  console.error("Invalid mode: " + mode);
  process.exit(1);
}
