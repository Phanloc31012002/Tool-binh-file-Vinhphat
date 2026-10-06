// Dùng đường viền/PON do bộ test tích hợp Illustrator thực sự đọc được.
const fs = require("fs");
const path = require("path");
const engine = require("../DanCardCEP/js/dan_be_nester");
const prefix = process.argv[2] || "dan_be_native";
if (!/^dan_be_[a-z_]+$/.test(prefix)) throw new Error("Invalid fixture prefix");
const file = path.join(__dirname, "../tmp/" + prefix + "_payload.json");
const raw = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
if (!raw.startsWith("OKJSON:")) throw new Error(raw);
const input = JSON.parse(raw.slice(7));
const plan = engine.nest(input);
if (!plan.ok) throw new Error(plan.error);
fs.writeFileSync(
  path.join(__dirname, "../tmp/" + prefix + "_plan.json"),
  JSON.stringify({ jobId: input.jobId, plan }, null, 2),
);
console.log(
  JSON.stringify({
    sheet: input.sheet,
    count: plan.count,
    counts: plan.counts,
    detail: plan.detail,
  }),
);
