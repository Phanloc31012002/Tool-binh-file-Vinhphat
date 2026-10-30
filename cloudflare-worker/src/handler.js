// Logic của Worker cập nhật, tách riêng để test bằng Node (tests/update_channel.test.js).
//
//  /health          → "ok" (không cần mã)
//  /latest.json     → manifest bản mới nhất
//  /pkg/<zip>       → gói cập nhật (ZIP nằm trong tài nguyên tĩnh của Worker, binding ASSETS)
//
// Kênh mã chung: khi batBuocMa = true, /latest.json và /pkg/ chỉ trả cho request có header X-CCB-Key
// đúng mã chung; sai/thiếu mã → 403. Khi batBuocMa = false (chuyển tiếp) thì ai cũng tải được, để máy
// nhân viên còn updater cũ (chưa có mã) nhận bản đầu tiên mang mã về.

const PKG_PATH = /^\/pkg\/DanCardCEP-\d+\.\d+\.\d+\.zip$/;

function sameText(a, b) {
  // So sánh không dừng sớm ở ký tự sai đầu tiên (không lộ mã qua thời gian phản hồi).
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function createHandler({ latestJson, updateKey = "", batBuocMa = false }) {
  const jsonHeaders = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, max-age=0",
  };
  const khoa = batBuocMa === true && typeof updateKey === "string" && updateKey.length > 0;

  function coMa(request) {
    return sameText(request.headers.get("X-CCB-Key") || "", updateKey);
  }
  function tuChoi() {
    return new Response(JSON.stringify({ error: "Thiếu hoặc sai mã cập nhật." }), { status: 403, headers: jsonHeaders });
  }

  return async function handle(request, env) {
    const url = new URL(request.url);
    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }
    if (url.pathname === "/health") {
      return new Response("ok", { headers: { "Cache-Control": "no-store" } });
    }
    if (url.pathname === "/latest.json") {
      if (khoa && !coMa(request)) return tuChoi();
      return new Response(latestJson, { headers: jsonHeaders });
    }
    if (PKG_PATH.test(url.pathname)) {
      if (khoa && !coMa(request)) return tuChoi();
      if (!env || !env.ASSETS) return new Response("Not found", { status: 404 });
      // Chỉ chuyển đường dẫn sang tài nguyên tĩnh, không chuyển header (mã) đi tiếp.
      const res = await env.ASSETS.fetch(new Request(url.origin + url.pathname, { method: "GET" }));
      if (!res.ok) return new Response("Not found", { status: 404 });
      const headers = new Headers(res.headers);
      headers.set("Cache-Control", "private, no-store");
      return new Response(res.body, { status: 200, headers });
    }
    return new Response("Not found", { status: 404 });
  };
}
