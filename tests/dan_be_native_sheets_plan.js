// Chỉ chạy khi được bật: dùng dữ liệu mẫu hình tròn 5 cm/PON đã ghi lại từ Illustrator thật.
// Chỉ sinh dữ liệu test đã được ignore; không đưa vào bất kỳ bộ cài nào.
const fs = require("fs");
const path = require("path");
const engine = require("../DanCardCEP/js/dan_be_nester");
const inputText = fs
  .readFileSync(
    path.join(__dirname, "../tmp/dan_be_circle_payload.json"),
    "utf8",
  )
  .replace(/^\uFEFF/, "");
if (!inputText.startsWith("OKJSON:"))
  throw new Error("Missing actual Illustrator circle payload.");
const input = JSON.parse(inputText.slice(7));
const small = JSON.parse(JSON.stringify(input.types[0]));
for (const group of small.groups)
  for (const ring of group)
    for (const point of ring) {
      point[0] *= 0.6;
      point[1] *= 0.6;
    }
input.types = [input.types[0], small];
const sheets = input.types.map((type, modelIndex) => {
  const plan = engine.nest({ ...input, types: [type] });
  if (!plan.ok) throw new Error(plan.error);
  return {
    modelIndex,
    slots: plan.slots.map((s) => ({ ...s, mi: modelIndex })),
  };
});
const mixed = engine.nest(input);
if (!mixed.ok) throw new Error(mixed.error);
const data = { input, separate: { sheets }, mixed: mixed.slots };
fs.writeFileSync(
  path.join(__dirname, "../tmp/dan_be_native_sheets_plan_2_15_2.json"),
  JSON.stringify(data),
);
console.log(
  JSON.stringify({
    separateCounts: sheets.map((s) => s.slots.length),
    mixedCount: mixed.count,
    mixedCounts: mixed.counts,
  }),
);
