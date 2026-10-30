// Sinh nội dung cho Worker cập nhật ngay trước `wrangler deploy`:
//  - generated/latest.js : manifest (online/latest.json), mã chung và chế độ khoá của kênh;
//  - generated/assets/   : tài nguyên tĩnh của Worker — gói ZIP bản đang phát hành nằm ở pkg/.
// Mã chung đọc từ QuanLyNoiBo/kenh-cap-nhat.json (không có trong Git); generated/ cũng không có trong Git.
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = process.env.DANCARD_ROOT ? resolve(process.env.DANCARD_ROOT) : resolve(here, "..");
const workerDir = resolve(root, "cloudflare-worker");
const sourcePath = resolve(root, "online", "latest.json");
const outputPath = resolve(workerDir, "generated", "latest.js");
const assetsDir = resolve(workerDir, "generated", "assets");
const kenhPath = resolve(root, "QuanLyNoiBo", "kenh-cap-nhat.json");

function readJson(text) {
  return JSON.parse(String(text).replace(/^﻿/, ""));
}

const parsed = readJson(await readFile(sourcePath, "utf8"));
if (parsed.product !== "com.locdev.dancard" || !/^\d+\.\d+\.\d+$/.test(String(parsed.version))) {
  throw new Error("online/latest.json is not a valid DanCard update manifest.");
}

let updateKey = "";
let batBuocMa = false;
if (existsSync(kenhPath)) {
  const kenh = readJson(await readFile(kenhPath, "utf8"));
  updateKey = String(kenh.updateKey || "");
  if (!/^[0-9a-f]{64}$/.test(updateKey)) throw new Error("QuanLyNoiBo/kenh-cap-nhat.json: updateKey không hợp lệ.");
  batBuocMa = kenh.batBuocMa === true;
}

// Tài nguyên tĩnh: luôn tạo thư mục (wrangler cần), chỉ giữ ZIP của bản đang phát hành.
await rm(resolve(assetsDir, "pkg"), { recursive: true, force: true });
await mkdir(resolve(assetsDir, "pkg"), { recursive: true });
await writeFile(resolve(assetsDir, "README.txt"), "Tài nguyên của Worker cập nhật Công cụ bình (sinh tự động).\n", "utf8");

const pkgMatch = /^https:\/\/[^/]+\/pkg\/(DanCardCEP-\d+\.\d+\.\d+\.zip)$/.exec(String(parsed.packageUrl || ""));
let pkgNote = "gói vẫn tải từ GitHub (bản phát hành trước kênh mã chung)";
if (pkgMatch) {
  const zipName = pkgMatch[1];
  const zipSource = resolve(root, "online", zipName);
  if (!existsSync(zipSource)) throw new Error(`Không thấy online/${zipName} để đưa lên Worker.`);
  const hash = createHash("sha256").update(await readFile(zipSource)).digest("hex").toUpperCase();
  if (hash !== String(parsed.sha256).toUpperCase()) throw new Error(`SHA-256 của online/${zipName} không khớp latest.json.`);
  await copyFile(zipSource, resolve(assetsDir, "pkg", zipName));
  pkgNote = `gói ${zipName} nằm trên Worker`;
}
if (batBuocMa && !updateKey) throw new Error("Kênh đã khoá nhưng chưa có mã chung.");

const latestJson = JSON.stringify(parsed);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  `export const latestJson = ${JSON.stringify(latestJson)};\n` +
    `export const updateKey = ${JSON.stringify(updateKey)};\n` +
    `export const batBuocMa = ${batBuocMa ? "true" : "false"};\n`,
  "utf8",
);
const cheDo = !updateKey ? "chưa có mã chung" : batBuocMa ? "ĐÃ KHOÁ (chỉ máy có mã)" : "chuyển tiếp (ai cũng tải được)";
console.log(`Worker: v${parsed.version}, ${pkgNote}, kênh ${cheDo}.`);
