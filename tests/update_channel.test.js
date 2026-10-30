"use strict";
// Kênh cập nhật mã chung (29/10/2026): Worker chỉ trả manifest + gói ZIP cho máy có mã khi kênh đã khoá;
// build-latest.mjs đưa ZIP bản đang phát hành vào tài nguyên Worker và nhúng mã/chế độ vào generated/.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { pathToFileURL } = require("node:url");

const repo = path.join(__dirname, "..");
const KEY = "ab".repeat(32);

function fakeAssets(files) {
  return {
    async fetch(req) {
      const p = new URL(req.url).pathname;
      if (req.headers.get("X-CCB-Key")) throw new Error("không được chuyển mã sang ASSETS");
      if (!files[p]) return new Response("nope", { status: 404 });
      return new Response(files[p], { status: 200, headers: { "Content-Type": "application/zip" } });
    },
  };
}
function get(handle, p, key, env) {
  const headers = key ? { "X-CCB-Key": key } : {};
  return handle(new Request("https://w.example.workers.dev" + p, { headers }), env);
}

(async () => {
  const { createHandler } = await import(pathToFileURL(path.join(repo, "cloudflare-worker", "src", "handler.js")).href);
  const latestJson = JSON.stringify({ product: "com.locdev.dancard", version: "2.20.5" });
  const env = { ASSETS: fakeAssets({ "/pkg/DanCardCEP-2.20.5.zip": "ZIPDATA" }) };

  // (a) Chuyển tiếp: ai cũng tải được (máy còn updater cũ chưa có mã).
  let h = createHandler({ latestJson, updateKey: KEY, batBuocMa: false });
  assert.equal((await get(h, "/latest.json", "", env)).status, 200);
  let r = await get(h, "/pkg/DanCardCEP-2.20.5.zip", "", env);
  assert.equal(r.status, 200);
  assert.equal(await r.text(), "ZIPDATA");

  // (b) Đã khoá: thiếu/sai mã → 403, đúng mã → 200; /health luôn mở; đường lạ → 404.
  h = createHandler({ latestJson, updateKey: KEY, batBuocMa: true });
  assert.equal((await get(h, "/latest.json", "", env)).status, 403);
  assert.equal((await get(h, "/latest.json", "cd".repeat(32), env)).status, 403);
  assert.equal((await get(h, "/latest.json", KEY.slice(1), env)).status, 403);
  r = await get(h, "/latest.json", KEY, env);
  assert.equal(r.status, 200);
  assert.equal(await r.text(), latestJson);
  assert.equal((await get(h, "/pkg/DanCardCEP-2.20.5.zip", "", env)).status, 403);
  r = await get(h, "/pkg/DanCardCEP-2.20.5.zip", KEY, env);
  assert.equal(r.status, 200);
  assert.equal(await r.text(), "ZIPDATA");
  assert.equal((await get(h, "/pkg/DanCardCEP-9.9.9.zip", KEY, env)).status, 404, "gói không có trên Worker");
  assert.equal((await get(h, "/README.txt", KEY, env)).status, 404, "chỉ mở đường /pkg/DanCardCEP-x.y.z.zip");
  assert.equal((await get(h, "/pkg/../README.txt", KEY, env)).status, 404);
  assert.equal((await get(h, "/health", "", env)).status, 200);
  const post = await h(new Request("https://w.example.workers.dev/latest.json", { method: "POST", headers: { "X-CCB-Key": KEY } }), env);
  assert.equal(post.status, 405);

  // (c) Khoá mà không có mã (cấu hình hỏng) thì không tự khoá chết: coi như chuyển tiếp.
  h = createHandler({ latestJson, updateKey: "", batBuocMa: true });
  assert.equal((await get(h, "/latest.json", "", env)).status, 200);

  // (d) build-latest.mjs trên một thư mục giả: chép đúng ZIP vào assets/pkg, nhúng mã + chế độ.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ccb-kenh-"));
  try {
    fs.mkdirSync(path.join(tmp, "online"), { recursive: true });
    fs.mkdirSync(path.join(tmp, "QuanLyNoiBo"), { recursive: true });
    const zip = Buffer.from("PK-fake-zip-2.20.5");
    fs.writeFileSync(path.join(tmp, "online", "DanCardCEP-2.20.5.zip"), zip);
    const sha = crypto.createHash("sha256").update(zip).digest("hex").toUpperCase();
    const manifest = {
      product: "com.locdev.dancard",
      version: "2.20.5",
      packageUrl: "https://dancard-update.example.workers.dev/pkg/DanCardCEP-2.20.5.zip",
      sha256: sha,
    };
    fs.writeFileSync(path.join(tmp, "online", "latest.json"), "﻿" + JSON.stringify(manifest));
    fs.writeFileSync(path.join(tmp, "QuanLyNoiBo", "kenh-cap-nhat.json"), JSON.stringify({ updateKey: KEY, batBuocMa: true }));
    // Rác của bản trước trong assets/pkg phải bị dọn.
    fs.mkdirSync(path.join(tmp, "cloudflare-worker", "generated", "assets", "pkg"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "cloudflare-worker", "generated", "assets", "pkg", "DanCardCEP-2.20.4.zip"), "old");
    const out = execFileSync(process.execPath, [path.join(repo, "cloudflare-worker", "build-latest.mjs")], {
      env: { ...process.env, DANCARD_ROOT: tmp },
      encoding: "utf8",
    });
    assert.match(out, /ĐÃ KHOÁ/);
    const pkgDir = path.join(tmp, "cloudflare-worker", "generated", "assets", "pkg");
    assert.deepEqual(fs.readdirSync(pkgDir), ["DanCardCEP-2.20.5.zip"]);
    assert.ok(fs.readFileSync(path.join(pkgDir, "DanCardCEP-2.20.5.zip")).equals(zip));
    const gen = await import(pathToFileURL(path.join(tmp, "cloudflare-worker", "generated", "latest.js")).href + "?a");
    assert.equal(gen.updateKey, KEY);
    assert.equal(gen.batBuocMa, true);
    assert.equal(JSON.parse(gen.latestJson).version, "2.20.5");

    // SHA-256 lệch → dừng, không deploy gói hỏng.
    fs.writeFileSync(path.join(tmp, "online", "DanCardCEP-2.20.5.zip"), "khac");
    assert.throws(() =>
      execFileSync(process.execPath, [path.join(repo, "cloudflare-worker", "build-latest.mjs")], {
        env: { ...process.env, DANCARD_ROOT: tmp },
        stdio: "pipe",
      }),
    );

    // Bản cũ (gói trên GitHub, chưa có kênh): vẫn build được như trước, không có mã, không khoá.
    fs.rmSync(path.join(tmp, "QuanLyNoiBo", "kenh-cap-nhat.json"));
    manifest.packageUrl = "https://raw.githubusercontent.com/a/b/main/online/DanCardCEP-2.20.4.zip";
    fs.writeFileSync(path.join(tmp, "online", "latest.json"), JSON.stringify(manifest));
    const out2 = execFileSync(process.execPath, [path.join(repo, "cloudflare-worker", "build-latest.mjs")], {
      env: { ...process.env, DANCARD_ROOT: tmp },
      encoding: "utf8",
    });
    assert.match(out2, /chưa có mã chung/);
    const gen2 = await import(pathToFileURL(path.join(tmp, "cloudflare-worker", "generated", "latest.js")).href + "?b");
    assert.equal(gen2.updateKey, "");
    assert.equal(gen2.batBuocMa, false);
    assert.deepEqual(fs.readdirSync(pkgDir), []);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  // (e) Updater gửi mã: header X-CCB-Key cho manifest và gói, chỉ khi cùng máy chủ với manifest.
  const updater = fs.readFileSync(path.join(repo, "updater", "DanCardUpdater.ps1"), "utf8");
  assert.match(updater, /\$manifestHeaders\['X-CCB-Key'\] = \$updateKey/);
  assert.match(updater, /\$request\.Headers\.Add\('X-CCB-Key', \$UpdateKey\)/);
  assert.match(updater, /\(\[Uri\]\$packageUrl\)\.Host -eq \(\[Uri\]\$manifestUrl\)\.Host/);
  // Chép gói theo tên file/thư mục, không cắt chuỗi FullName theo độ dài đường dẫn nguồn (TEMP dạng 8.3 làm
  // lệch → "Chép gói mới không hoàn tất", 30/10/2026).
  const copyFn = updater.slice(updater.indexOf("function Copy-DirectoryWithProgress"), updater.indexOf("function Schedule-UpdaterPayload"));
  const copyCode = copyFn.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n");
  assert.doesNotMatch(copyCode, /Substring/);
  assert.match(updater, /function Copy-DirectoryLevel/);
  // Gói ZIP lồng trong thư mục CongCuBinh\ để updater cũ đi nhánh tìm manifest.xml (đường dẫn đã chuẩn hoá).
  const publish = fs.readFileSync(path.join(repo, "QuanLyNoiBo", "Publish-OnlineUpdate.ps1"), "utf8");
  assert.match(publish, /\$packageStage = Join-Path \$stageRoot 'CongCuBinh'/);
  assert.match(publish, /Compress-Archive -LiteralPath \$packageStage/);
  // Mã chung không bao giờ nằm trong file cấu hình trong Git.
  const cfg = JSON.parse(fs.readFileSync(path.join(repo, "updater", "update-config.json"), "utf8").replace(/^﻿/, ""));
  assert.equal(cfg.updateKey, undefined, "updater/update-config.json trong Git không được chứa mã");
  // Worker có tài nguyên tĩnh và luôn chạy trước để kiểm tra mã.
  const wr = fs.readFileSync(path.join(repo, "wrangler.jsonc"), "utf8");
  assert.match(wr, /"run_worker_first":\s*true/);
  assert.match(wr, /"directory":\s*"cloudflare-worker\/generated\/assets"/);
  console.log("Kênh cập nhật mã chung (Worker + build-latest + updater): ok");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
