"use strict";
// Không phải test: vẽ bố cục Dàn tag BD của các ca mẫu ra SVG (tmp/tagbd_<ca>.svg) + JSON để
// duyệt bằng mắt. Chạy: node tests/dan_tag_bd_preview.js
const fs = require("node:fs");
const path = require("node:path");
const E = require("../DanCardCEP/js/dan_tag_bd");

const tag = (id, w, h, qty) => ({ id, name: id, w, h, qty });
const cases = {
  file30_fitclub: [tag("fitclub", 92, 56, 1000), tag("bold", 112, 36, 1000)],
  file31_2x5: [tag("chic", 56, 91, 1000), tag("coffee", 56, 91, 1000), tag("hoantien", 112, 71, 2000), tag("htmotor", 112, 75, 3000)],
  file32_2x4: [tag("huongdan", 112, 72, 4000), tag("hoantien", 112, 80, 1000)],
  file33_3x1: [tag("oao", 112, 92, 1000), tag("thetich", 56, 92, 500)],
  vidu_anhhai: [tag("tag92x70", 92, 70, 1000), tag("tag90x40", 90, 40, 1000)],
  nhan_10000: [tag("hd", 112, 72, 10000)],
  hai_khoi: [tag("A", 112, 184, 1000), tag("B", 112, 92, 1000), tag("C", 56, 92, 1000)],
  tron_8tag: [tag("a", 112, 72, 1000), tag("b", 56, 91, 2000), tag("c", 92, 56, 1000), tag("d", 70, 40, 3000), tag("e", 112, 80, 1000), tag("f", 100, 60, 1000), tag("g", 80, 80, 2000), tag("h", 120, 100, 1000)],
};

const palette = ["#f4a261", "#8ecae6", "#b5e48c", "#f9c74f", "#cdb4db", "#ffafcc", "#90be6d", "#a8dadc", "#e9c46a", "#bde0fe"];
function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
}
function svgFor(name, result) {
  const S = 2.2; // px / mm
  const gap = 12;
  let x = gap,
    rowH = 0,
    y = 40,
    maxW = 0;
  const parts = [];
  const colors = {};
  let ci = 0;
  for (const job of result.jobs) {
    for (const b of job.blocks) {
      const W = b.w * S,
        H = b.h * S;
      if (x + W > 1500) {
        x = gap;
        y += rowH + 30;
        rowH = 0;
      }
      parts.push(`<text x="${x}" y="${y - 6}" font-size="12" font-family="sans-serif">Bài ${job.bai} · ${b.cols} × ${b.rows} ô (${b.w} × ${b.h} mm)</text>`);
      parts.push(`<rect x="${x}" y="${y}" width="${W}" height="${H}" fill="#fff" stroke="#222" stroke-width="1.5"/>`);
      for (let c = 1; c < b.cols; c++) parts.push(`<line x1="${x + c * 56 * S}" y1="${y}" x2="${x + c * 56 * S}" y2="${y + H}" stroke="#bbb" stroke-dasharray="4 4"/>`);
      for (let r = 1; r < b.rows; r++) parts.push(`<line x1="${x}" y1="${y + r * 92 * S}" x2="${x + W}" y2="${y + r * 92 * S}" stroke="#bbb" stroke-dasharray="4 4"/>`);
      for (const p of b.places) {
        if (!colors[p.id]) colors[p.id] = palette[ci++ % palette.length];
        parts.push(`<rect x="${x + p.x * S}" y="${y + p.y * S}" width="${p.w * S}" height="${p.h * S}" fill="${colors[p.id]}" stroke="#333" stroke-width="0.8"/>`);
        const label = `${p.id} ${p.rot ? "↻" : ""}`;
        parts.push(`<text x="${x + (p.x + p.w / 2) * S}" y="${y + (p.y + p.h / 2) * S + 4}" font-size="10" text-anchor="middle" font-family="sans-serif">${esc(label)}</text>`);
      }
      for (const c of b.cuts) {
        const L = Math.min(3, c.to - c.from);
        if (c.axis === "V") {
          parts.push(`<line x1="${x + c.at * S}" y1="${y + c.from * S}" x2="${x + c.at * S}" y2="${y + (c.from + L) * S}" stroke="#d00" stroke-width="2"/>`);
          parts.push(`<line x1="${x + c.at * S}" y1="${y + (c.to - L) * S}" x2="${x + c.at * S}" y2="${y + c.to * S}" stroke="#d00" stroke-width="2"/>`);
          parts.push(`<line x1="${x + c.at * S}" y1="${y + c.from * S}" x2="${x + c.at * S}" y2="${y + c.to * S}" stroke="#d00" stroke-width="0.6" stroke-dasharray="2 3"/>`);
        } else {
          parts.push(`<line x1="${x + c.from * S}" y1="${y + c.at * S}" x2="${x + (c.from + L) * S}" y2="${y + c.at * S}" stroke="#d00" stroke-width="2"/>`);
          parts.push(`<line x1="${x + (c.to - L) * S}" y1="${y + c.at * S}" x2="${x + c.to * S}" y2="${y + c.at * S}" stroke="#d00" stroke-width="2"/>`);
          parts.push(`<line x1="${x + c.from * S}" y1="${y + c.at * S}" x2="${x + c.to * S}" y2="${y + c.at * S}" stroke="#d00" stroke-width="0.6" stroke-dasharray="2 3"/>`);
        }
      }
      x += W + gap * 2;
      rowH = Math.max(rowH, H);
      maxW = Math.max(maxW, x);
    }
  }
  const total = y + rowH + 40;
  const head = `<text x="${gap}" y="18" font-size="13" font-weight="bold" font-family="sans-serif">${esc(name)} — ${esc(result.detail)}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.max(maxW, 900)}" height="${total}" style="background:#fafafa">${head}${parts.join("")}</svg>`;
}

const outDir = path.join(__dirname, "..", "tmp");
fs.mkdirSync(outDir, { recursive: true });
for (const [name, tags] of Object.entries(cases)) {
  const t = Date.now();
  const result = E.pack({ tags });
  const ms = Date.now() - t;
  if (!result.ok) {
    console.log(name, "ERR", result.error);
    continue;
  }
  fs.writeFileSync(path.join(outDir, `tagbd_${name}.json`), JSON.stringify(result, null, 1));
  fs.writeFileSync(path.join(outDir, `tagbd_${name}.svg`), svgFor(name, result));
  console.log(name, ms + " ms:", result.detail);
}
