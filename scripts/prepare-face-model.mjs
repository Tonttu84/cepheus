import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import child_process from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

function ensurePowershellExecutionPolicy() {
  if (process.platform === "win32") {
    try {
      child_process.spawnSync("reg.exe", [
        "add",
        "HKCU\\Software\\Microsoft\\PowerShell\\1\\ShellIds\\Microsoft.PowerShell",
        "/v",
        "ExecutionPolicy",
        "/t",
        "REG_SZ",
        "/d",
        "RemoteSigned",
        "/f",
      ]);
    } catch {
      // ignore
    }
  }
}

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task";

// Pinned integrity constants for Google's MediaPipe Face Landmarker (float16) task model.
// Source: https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task
// Taken from public/mediapipe/face_landmarker.task verified in browser tests on 2026-11-14.
export const EXPECTED_MODEL_SIZE_BYTES = 3_758_596;
export const EXPECTED_MODEL_SHA256 =
  "64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff";

const MAX_RETRIES = 3;
const TIMEOUT_MS = 30_000;

const publicDir = path.join(rootDir, "public", "mediapipe");
const wasmDestDir = path.join(publicDir, "wasm");
const wasmSrcDir = path.join(
  rootDir,
  "node_modules",
  "@mediapipe",
  "tasks-vision",
  "wasm"
);
const modelDestPath = path.join(publicDir, "face_landmarker.task");
const legacySha256Path = path.join(publicDir, "face_landmarker.task.sha256");

function computeSha256(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(fileBuffer).digest("hex");
}

function verifyModelIntegrity(filePath) {
  if (!fs.existsSync(filePath)) {
    return { ok: false, reason: `File does not exist: ${filePath}` };
  }
  const stat = fs.statSync(filePath);
  if (stat.size !== EXPECTED_MODEL_SIZE_BYTES) {
    return {
      ok: false,
      reason: `Size mismatch: expected ${EXPECTED_MODEL_SIZE_BYTES} bytes, got ${stat.size} bytes`,
    };
  }
  const actualHash = computeSha256(filePath);
  if (actualHash !== EXPECTED_MODEL_SHA256) {
    return {
      ok: false,
      reason: `SHA-256 hash mismatch: expected ${EXPECTED_MODEL_SHA256}, got ${actualHash}`,
    };
  }
  return { ok: true, size: stat.size, hash: actualHash };
}

function cleanLegacySha256File() {
  if (fs.existsSync(legacySha256Path)) {
    try {
      fs.unlinkSync(legacySha256Path);
    } catch {
      // ignore
    }
  }
}

function copyWasmAssets() {
  if (!fs.existsSync(wasmSrcDir)) {
    throw new Error(
      `Source wasm directory not found: ${wasmSrcDir}. Please ensure @mediapipe/tasks-vision is installed.`
    );
  }

  fs.mkdirSync(wasmDestDir, { recursive: true });
  const entries = fs.readdirSync(wasmSrcDir);
  let copiedCount = 0;

  for (const entry of entries) {
    const srcFile = path.join(wasmSrcDir, entry);
    const destFile = path.join(wasmDestDir, entry);
    const srcStat = fs.statSync(srcFile);

    if (srcStat.isFile()) {
      if (
        !fs.existsSync(destFile) ||
        fs.statSync(destFile).size !== srcStat.size
      ) {
        fs.copyFileSync(srcFile, destFile);
        copiedCount++;
      }
    }
  }

  console.log(
    `WASM assets verified in ${wasmDestDir} (${copiedCount} updated/copied, total ${entries.length}).`
  );
}

async function fetchWithTimeout(url, options = {}, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function downloadModelAttempt(attempt) {
  const tempFile = `${modelDestPath}.tmp.${Date.now()}`;
  try {
    console.log(`Download attempt ${attempt} of ${MAX_RETRIES}...`);
    const response = await fetchWithTimeout(MODEL_URL);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch model: HTTP ${response.status} ${response.statusText}`
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(tempFile, buffer);

    // Verify downloaded temporary file against pinned constants
    const check = verifyModelIntegrity(tempFile);
    if (!check.ok) {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
      throw new Error(
        `Downloaded model failed integrity check (${check.reason}).`
      );
    }

    // Rename only after integrity check passes
    fs.renameSync(tempFile, modelDestPath);

    console.log(
      `Model downloaded and verified successfully: ${check.size} bytes, SHA-256: ${check.hash}`
    );
  } catch (err) {
    if (fs.existsSync(tempFile)) {
      try {
        fs.unlinkSync(tempFile);
      } catch {
        // ignore
      }
    }
    throw err;
  }
}

async function downloadModelWithRetry() {
  fs.mkdirSync(publicDir, { recursive: true });
  cleanLegacySha256File();

  if (fs.existsSync(modelDestPath)) {
    const check = verifyModelIntegrity(modelDestPath);
    if (check.ok) {
      console.log(
        `Face landmarker model already intact: ${modelDestPath} (${check.size} bytes, SHA-256: ${check.hash})`
      );
      return;
    }
    // Delete corrupt/mismatched model file and fail
    try {
      fs.unlinkSync(modelDestPath);
    } catch {
      // ignore unlink error
    }
    throw new Error(
      `Existing face landmarker model file failed integrity check (${check.reason}). Deleted corrupt file.`
    );
  }

  console.log(`Downloading Face Landmarker model from: ${MODEL_URL}`);
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await downloadModelAttempt(attempt);
      return;
    } catch (err) {
      lastError = err;
      console.warn(`Attempt ${attempt} failed: ${err.message}`);
      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      }
    }
  }

  throw new Error(
    `Failed to download model after ${MAX_RETRIES} attempts. Last error: ${lastError?.message}`
  );
}

async function main() {
  ensurePowershellExecutionPolicy();
  copyWasmAssets();
  await downloadModelWithRetry();
  console.log("MediaPipe assets prepared successfully.");
}

// Run main if called directly
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error("Error preparing MediaPipe assets:", err.message);
    process.exit(1);
  });
}
