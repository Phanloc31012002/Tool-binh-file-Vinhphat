import { latestJson } from "../generated/latest.js";

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, max-age=0",
  "Access-Control-Allow-Origin": "*"
};

export default {
  fetch(request) {
    const url = new URL(request.url);
    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }
    if (url.pathname === "/health") {
      return new Response("ok", { headers: { "Cache-Control": "no-store" } });
    }
    if (url.pathname !== "/latest.json") {
      return new Response("Not found", { status: 404 });
    }
    return new Response(latestJson, { headers });
  }
};
