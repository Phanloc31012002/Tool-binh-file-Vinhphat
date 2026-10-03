const assert = require("assert");
const fs = require("fs");
const path = require("path");
const prefix = process.argv[2] || "dan_be_native";
if (!/^dan_be_[a-z_]+$/.test(prefix)) throw new Error("Invalid fixture prefix");
const read = (name) =>
  JSON.parse(
    fs
      .readFileSync(path.join(__dirname, "../tmp/", name), "utf8")
      .replace(/^\uFEFF/, ""),
  );
const audit = read(prefix + "_audit.json"),
  data = read(prefix + "_plan.json");
const MM = 2.834645669,
  [left, top, right, bottom] = audit.rect;
const near = (a, b) => Math.abs(a - b) < 0.002 * MM;
assert.strictEqual(audit.cuts.length, data.plan.count);
assert.strictEqual(audit.arts.length, data.plan.count);
assert.strictEqual(audit.dots.length, 4);
const payloadText = fs
  .readFileSync(
    path.join(__dirname, "../tmp/", prefix + "_payload.json"),
    "utf8",
  )
  .replace(/^\uFEFF/, "");
assert(payloadText.startsWith("OKJSON:"));
const payload = JSON.parse(payloadText.slice(7));
assert(
  near(right - left, payload.sheet.widthMm * MM) &&
    near(top - bottom, payload.sheet.heightMm * MM),
  "Native sheet size differs from chosen PON",
);
for (const dot of payload.sheet.dots) {
  assert(
    audit.dots.some(
      (b) =>
        near((b[0] + b[2]) / 2, left + dot.x * MM) &&
        near((b[1] + b[3]) / 2, bottom + dot.y * MM) &&
        near((b[2] - b[0]) / 2, dot.r * MM),
    ),
    "PON moved or resized during render",
  );
}
const available = audit.cuts.slice();
for (const s of data.plan.slots) {
  const x = left + s.x * MM,
    y = bottom + s.y * MM;
  const i = available.findIndex((b) => near(b[0], x) && near(b[3], y));
  assert(
    i >= 0,
    "Illustrator placement differs from the computed cut position",
  );
  const b = available.splice(i, 1)[0];
  assert(
    b[0] >= left + 4 * MM - 0.01 &&
      b[3] >= bottom + 4 * MM - 0.01 &&
      b[2] <= right - 4 * MM + 0.01 &&
      b[1] <= top - 4 * MM + 0.01,
    "Native cut exceeds margin",
  );
  assert(
    audit.arts.some(
      (a) =>
        near((a[0] + a[2]) / 2, (b[0] + b[2]) / 2) &&
        near((a[1] + a[3]) / 2, (b[1] + b[3]) / 2),
    ),
    "Artwork is not centred on its die",
  );
}
console.log(
  `Native Illustrator: ${data.plan.count} positions, artwork centres, 4 PON and 4 mm margins verified.`,
);
