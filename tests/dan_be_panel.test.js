const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// Chạy thử đúng các hàm hỗ trợ và hàm xử lý click của code thật, không cần khởi động
// các tab không liên quan, hiệu ứng động hay Illustrator. Không sao chép phần cài đặt nào.
const main = fs.readFileSync(
  path.join(__dirname, "../DanCardCEP/js/main.js"),
  "utf8",
);
const html = fs.readFileSync(
  path.join(__dirname, "../DanCardCEP/index.html"),
  "utf8",
);
function between(start, end) {
  const a = main.indexOf(start);
  const b = main.indexOf(end, a + start.length);
  assert(a >= 0 && b > a, "Production panel block anchors must remain valid.");
  return main.slice(a, b);
}
const production =
  between("  function jsStr(s)", "  function loadResizeJsx()") +
  between(
    '  var btnDanBe = document.getElementById("btnDanBe");',
    "  var btnCopyToiUuNote =",
  );
const clone = (value) => JSON.parse(JSON.stringify(value));

function panel(options = {}) {
  const expressions = [];
  const timers = [];
  const statuses = [];
  const nestCalls = [];
  const nodes = {
    btnDanBe: {
      disabled: false,
      addEventListener(type, fn) {
        assert.strictEqual(type, "click");
        this.click = fn;
      },
    },
    outDanBe: {},
    beGap: { value: options.gap === undefined ? "1.25" : options.gap },
    beMargin: { value: options.margin === undefined ? "5.5" : options.margin },
    bePonClear: { value: options.pon === undefined ? "8.75" : options.pon },
    bePaperW: { value: options.paperW === undefined ? "33" : options.paperW },
    bePaperH: { value: options.paperH === undefined ? "35.4" : options.paperH },
    bePonTop: { value: options.top === undefined ? "10" : options.top },
    bePonBottom: {
      value: options.bottom === undefined ? "10" : options.bottom,
    },
    bePonLeft: { value: options.left === undefined ? "10" : options.left },
    bePonRight: { value: options.right === undefined ? "10" : options.right },
    beMultiPerArtboard: { checked: options.multi === true },
    beTwoSided: { checked: options.twoSided === true },
  };
  const context = vm.createContext({
    document: { getElementById: (id) => nodes[id] || null },
    cs: {
      getSystemPath: () => "C:\\Users\\ADMIN\\Extensions\\Lộc's tool",
      evalScript(expression, callback) {
        expressions.push({ expression, callback });
      },
    },
    SystemPath: { EXTENSION: "extension" },
    show(element, message) {
      assert.strictEqual(element, nodes.outDanBe);
      statuses.push(String(message));
    },
    showCountResult(element, message) {
      assert.strictEqual(element, nodes.outDanBe);
      statuses.push(String(message));
    },
    window: {
      setTimeout(fn, delay) {
        assert.strictEqual(
          delay,
          20,
          "Search must yield once for status repaint.",
        );
        timers.push(fn);
      },
    },
    // Engine Illustrator thường trực đang hoạt động bình thường: việc chạy script được sinh ra
    // không được nạp lại file hay gọi bất kỳ thao tác Illustrator nào không liên quan.
    dcDanToiUu() {},
    dcCopyToiUuNoteToOddArtboards() {},
    dcCopyToiUuNoteToAllArtboards() {},
    dcDanToiUuVersion: 22,
    dcDanBeNestingVersion: 10,
    dcDanBePrepare(...args) {
      context.prepareArguments = args;
    },
    dcDanBeRender(...args) {
      context.renderArguments = args;
    },
    $: {
      evalFile() {
        throw new Error("Unexpected Illustrator file reload.");
      },
    },
  });
  if (!options.missingNester) {
    context.window.DanBeNester = {
      nest(payload) {
        assert.strictEqual(
          expressions.length,
          1,
          "Contour search runs in Chromium, before any native render call.",
        );
        nestCalls.push(clone(payload));
        if (options.nest) return options.nest(payload, nestCalls.length);
        if (options.throwNester) throw new Error("bounded test search failure");
        return options.result === undefined
          ? {
              ok: true,
              count: 2,
              slots: [
                { mi: 0, vi: 1, x: 3.25, y: 5, angle: 90 },
                { mi: 0, vi: 3, x: 12, y: 17, angle: 270 },
              ],
              detail: "Né PON: C:\\Khuôn\\Bài 'đã tràn'\n2 con",
              mode: 'lồng khuôn "90° / 270°"',
            }
          : options.result;
      },
    };
  }
  vm.runInContext(production, context, {
    filename: "production-main-dan-be.js",
  });
  return {
    context,
    nodes,
    expressions,
    timers,
    statuses,
    nestCalls,
    click() {
      nodes.btnDanBe.click();
    },
    prepare(response) {
      assert.strictEqual(expressions.length, 1);
      vm.runInContext(expressions[0].expression, context);
      expressions[0].callback(response);
    },
    tick() {
      assert.strictEqual(timers.length, 1);
      timers.shift()();
    },
    render(response) {
      assert.strictEqual(expressions.length, 2);
      vm.runInContext(expressions[1].expression, context);
      expressions[1].callback(response);
    },
  };
}

const payload = {
  jobId: 'danbe_C:\\Khuôn\\Lộc\'s "bài"',
  gapMm: 1.25,
  marginMm: 5.5,
  ponClearMm: 8.75,
  sheet: { widthMm: 330, heightMm: 354, dots: [{ x: 10, y: 10, r: 2.5 }] },
  types: [
    {
      groups: [
        [
          [
            [0, 0],
            [10, 0],
            [10, 10],
            [0, 10],
          ],
        ],
      ],
    },
  ],
};
const prepared = "OKJSON:" + JSON.stringify(payload);

{
  const p = panel();
  p.click();
  assert.strictEqual(p.nodes.btnDanBe.disabled, true);
  p.prepare(prepared);
  assert.deepStrictEqual(clone(p.context.prepareArguments), [
    "1.25",
    "5.5",
    "8.75",
    false,
    "33",
    "35.4",
    "10",
    "10",
    "10",
    "10",
  ]);
  assert.strictEqual(
    p.nestCalls.length,
    0,
    "Search must wait for the repaint yield.",
  );
  assert.strictEqual(p.nodes.btnDanBe.disabled, true);
  p.tick();
  assert.deepStrictEqual(
    p.nestCalls,
    [payload],
    "Prepared geometry is parsed and passed intact.",
  );
  assert.strictEqual(p.nodes.btnDanBe.disabled, true);
  p.render("OK:[[COUNT:2]] Dàn bế xong.");
  const [jobId, slotsText, reportText] = p.context.renderArguments;
  assert.strictEqual(
    jobId,
    payload.jobId,
    "Native expression preserves quotes, slashes, and Unicode.",
  );
  assert.deepStrictEqual(JSON.parse(slotsText), [
    { mi: 0, vi: 1, x: 3.25, y: 5, angle: 90 },
    { mi: 0, vi: 3, x: 12, y: 17, angle: 270 },
  ]);
  assert.deepStrictEqual(JSON.parse(reportText), {
    detail: "Né PON: C:\\Khuôn\\Bài 'đã tràn'\n2 con",
    mode: 'lồng khuôn "90° / 270°"',
  });
  assert.strictEqual(p.nodes.btnDanBe.disabled, false);
  assert.strictEqual(p.statuses.at(-1), "OK:[[COUNT:2]] Dàn bế xong.");
}

{
  const p = panel({
    gap: "",
    margin: "",
    pon: "",
    paperW: "",
    paperH: "",
    top: "",
    bottom: "",
    left: "",
    right: "",
  });
  p.click();
  p.prepare("ERR: Khổ giấy không hợp lệ.");
  assert.deepStrictEqual(clone(p.context.prepareArguments), [
    "2",
    "4",
    "7.5",
    false,
    "33",
    "35.4",
    "10",
    "10",
    "10",
    "10",
  ]);
  assert.strictEqual(p.nodes.btnDanBe.disabled, false);
  assert.strictEqual(p.statuses.at(-1), "ERR: Khổ giấy không hợp lệ.");
  assert.strictEqual(p.timers.length, 0);
}

{
  const p = panel({
    paperW: "42",
    paperH: "29,7",
    top: "0",
    bottom: "15.5",
    left: "12",
    right: "9",
  });
  p.click();
  // Chốt giá trị cả sáu ô ngay lúc click, kể cả khi người dùng sửa trong lúc đang chuẩn bị.
  for (const id of [
    "bePaperW",
    "bePaperH",
    "bePonTop",
    "bePonBottom",
    "bePonLeft",
    "bePonRight",
  ]) {
    p.nodes[id].value = "999";
  }
  p.prepare("ERR: Test only");
  assert.deepStrictEqual(clone(p.context.prepareArguments), [
    "1.25",
    "5.5",
    "8.75",
    false,
    "42",
    "29,7",
    "0",
    "15.5",
    "12",
    "9",
  ]);
  assert(p.statuses[0].includes("khổ giấy nhập"));
  assert(!p.statuses[0].includes("chọn file"));
}

{
  const p = panel({
    paperW: "33'); injectedNativeCode(); ('",
    right: '10\\\"\n',
  });
  p.click();
  p.prepare("ERR: Test only");
  assert.strictEqual(
    p.context.prepareArguments[4],
    "33'); injectedNativeCode(); ('",
  );
  assert.strictEqual(p.context.prepareArguments[9], '10\\\"\n');
}

{
  const p = panel();
  for (const id of [
    "bePaperW",
    "bePaperH",
    "bePonTop",
    "bePonBottom",
    "bePonLeft",
    "bePonRight",
  ])
    delete p.nodes[id];
  p.click();
  p.prepare("ERR: Test only");
  assert.deepStrictEqual(clone(p.context.prepareArguments).slice(4), [
    "33",
    "35.4",
    "10",
    "10",
    "10",
    "10",
  ]);
}

{
  const block = html.slice(
    html.indexOf('id="acc-toiuuDie"'),
    html.indexOf("<!-- Accordion: DÀN OFFSET -->"),
  );
  const ids = [
    "bePaperW",
    "bePaperH",
    "bePonTop",
    "bePonBottom",
    "bePonLeft",
    "bePonRight",
  ];
  const values = ["33", "35.4", "10", "10", "10", "10"];
  let previous = -1;
  ids.forEach((id, index) => {
    const position = block.indexOf('id="' + id + '"');
    assert(
      position > previous,
      "Six editable controls must preserve the user-requested order.",
    );
    previous = position;
    assert.match(
      block,
      new RegExp(
        '<input id="' +
          id +
          '"[^>]*type="text"[^>]*value="' +
          values[index].replace(".", "\\.") +
          '"',
      ),
    );
  });
  const offsetRow = block.slice(
    block.lastIndexOf(
      '<div class="field-row">',
      block.indexOf('for="bePonTop"'),
    ),
    block.indexOf("</div>", block.indexOf('for="bePonTop"')),
  );
  for (const id of ids.slice(2))
    assert(
      offsetRow.includes('id="' + id + '"'),
      "All four PON offsets must remain in one left-to-right row.",
    );
  const copy = block
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const hints = [...block.matchAll(/<p class="hint">([\s\S]*?)<\/p>/g)]
    .map((match) =>
      match[1]
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .join(" ");
  assert(
    hints.length < 500,
    "Dàn bế notes should stay concise without removing controls.",
  );
  assert.match(hints, /Khuôn\s*→\s*Bài/);
  assert.match(hints, /Khuôn\s*→\s*Trước\s*→\s*Sau/i);
  assert.match(hints, /PON tròn\s*5\s*mm/i);
  assert.match(hints, /đường bế/);
  assert.match(hints, /mép chấm/);
  assert.match(hints, /lật ngang/i);
  assert.match(hints, /không lật gương/i);
  assert.match(hints, /mặc định mỗi mẫu một tờ/i);
  assert.match(
    copy,
    /mép tờ\s*(?:đến|→|[–-])\s*tâm chấm/i,
    "Shortened instructions must still distinguish sheet-edge to dot-center offsets.",
  );
  for (const [id, value, unit] of [
    ["bePaperW", "33", "cm"],
    ["bePaperH", "35.4", "cm"],
    ["bePonTop", "10", "mm"],
    ["bePonBottom", "10", "mm"],
    ["bePonLeft", "10", "mm"],
    ["bePonRight", "10", "mm"],
    ["beGap", "2", "mm"],
    ["beMargin", "4", "mm"],
    ["bePonClear", "7.5", "mm"],
  ]) {
    const idOccurrences =
      block.match(new RegExp('\\bid="' + id + '"', "g")) || [];
    assert.strictEqual(
      idOccurrences.length,
      1,
      "Copy edits must retain exactly one editable " + id + " control.",
    );
    const label = block.match(
      new RegExp('<label\\b[^>]*for="' + id + '"[^>]*>([\\s\\S]*?)</label>'),
    );
    assert(
      label,
      "The visible numeric label must remain associated with " + id + ".",
    );
    assert.match(
      label[1],
      new RegExp("\\(" + unit + "\\)"),
      "The unit for " + id + " must remain visible.",
    );
    assert.match(
      label[1],
      new RegExp(
        '<input id="' +
          id +
          '"[^>]*type="text"[^>]*value="' +
          value.replace(".", "\\.") +
          '"[^>]*inputmode="decimal"',
      ),
      "Shortening instructions must not change numeric defaults or editable input modes.",
    );
  }
  for (const [id, labelText] of [
    ["beTwoSided", "Dàn bế 2 mặt (tag)"],
    ["beMultiPerArtboard", "Dàn nhiều mẫu vào một tờ"],
  ]) {
    const input = block.match(
      new RegExp('<input\\b[^>]*id="' + id + '"[^>]*>'),
    );
    assert(input, "Keep the independent " + id + " option visible.");
    assert.match(input[0], /type="checkbox"/);
    assert(
      !/\bchecked\b/.test(input[0]),
      "Single-faced and separate-model defaults must remain unchanged.",
    );
    assert(
      block.includes("<span>" + labelText + "</span>"),
      "Do not replace the checkbox with instructions only.",
    );
  }
  assert(!block.includes("Chọn PON AI"));
  assert(block.includes('<span class="btn-label">Dàn bế</span>'));
}

for (const response of ["OKJSON:{invalid", "", "ERR: Không đọc được khuôn."]) {
  const p = panel();
  p.click();
  p.prepare(response);
  assert.strictEqual(
    p.nodes.btnDanBe.disabled,
    false,
    "Prepare failure restores the button.",
  );
  assert.strictEqual(p.nestCalls.length, 0);
  assert.strictEqual(p.timers.length, 0);
  assert.strictEqual(p.expressions.length, 1);
}

{
  const p = panel({ missingNester: true });
  p.click();
  p.prepare(prepared);
  assert.strictEqual(p.nodes.btnDanBe.disabled, false);
  assert.strictEqual(p.timers.length, 0);
  assert.match(p.statuses.at(-1), /^ERR:/);
}

for (const options of [
  { throwNester: true },
  { result: { ok: false, error: "Không còn vùng hợp lệ." } },
  { result: null },
]) {
  const p = panel(options);
  p.click();
  p.prepare(prepared);
  p.tick();
  assert.strictEqual(
    p.nodes.btnDanBe.disabled,
    false,
    "Search failure restores the button.",
  );
  assert.strictEqual(p.expressions.length, 1, "Failed search must not render.");
  assert.match(p.statuses.at(-1), /^ERR:/);
}

{
  const p = panel();
  p.click();
  p.prepare(prepared);
  p.tick();
  p.render("ERR: Không thể tạo layer đầu ra.");
  assert.strictEqual(p.nodes.btnDanBe.disabled, false);
  assert.strictEqual(p.statuses.at(-1), "ERR: Không thể tạo layer đầu ra.");
}

// Mỗi JSX được nạp độc lập. Không yêu cầu dcDanBe/version kiểu cũ nào.
for (const scenario of [
  { remove: [], expected: [] },
  { remove: ["dcDanToiUu"], expected: ["dan_card_lib.jsx"] },
  { remove: ["dcDanBePrepare"], expected: ["dan_be_bridge.jsx"] },
  { remove: ["dcDanBeRender"], expected: ["dan_be_bridge.jsx"] },
  { remove: ["dcDanBeNestingVersion"], expected: ["dan_be_bridge.jsx"] },
  {
    remove: ["dcDanToiUu", "dcDanBePrepare"],
    expected: ["dan_card_lib.jsx", "dan_be_bridge.jsx"],
  },
  { remove: [], bridgeVersion: 6, expected: ["dan_be_bridge.jsx"] },
  { remove: [], bridgeVersion: 8, expected: ["dan_be_bridge.jsx"] },
  { remove: [], bridgeVersion: 9, expected: ["dan_be_bridge.jsx"] },
  { remove: [], libraryVersion: 15, expected: ["dan_card_lib.jsx"] },
  { remove: [], libraryVersion: 21, expected: ["dan_card_lib.jsx"] },
]) {
  const p = panel();
  const loaded = [];
  p.context.$.evalFile = (filename) => loaded.push(filename.split("/").at(-1));
  for (const name of scenario.remove) delete p.context[name];
  if (scenario.bridgeVersion !== undefined)
    p.context.dcDanBeNestingVersion = scenario.bridgeVersion;
  if (scenario.libraryVersion !== undefined)
    p.context.dcDanToiUuVersion = scenario.libraryVersion;
  vm.runInContext(vm.runInContext("loadDanToiUuJsx()", p.context), p.context);
  assert.deepStrictEqual(
    loaded,
    scenario.expected,
    "Load only the JSX whose functions/version are missing.",
  );
}

// Mặc định: mỗi mẫu một tờ, kể cả khi hình bế giống hệt nhau. PON chỉ được
// chuẩn bị một lần; chỉ đường viền trùng khớp mới được dùng lại cùng kế hoạch dàn bế cục bộ.
const multiPayload = clone(payload);
multiPayload.types.push(clone(payload.types[0]));
multiPayload.types.push({
  groups: [
    [
      [
        [0, 0],
        [12, 0],
        [12, 10],
        [0, 10],
      ],
    ],
  ],
});
{
  const p = panel();
  p.click();
  p.prepare("OKJSON:" + JSON.stringify(multiPayload));
  for (let i = 0; i < 3; i++) {
    assert.strictEqual(p.nodes.btnDanBe.disabled, true);
    assert.strictEqual(
      p.expressions.length,
      1,
      "Do not render a partial batch.",
    );
    p.tick();
  }
  assert.strictEqual(
    p.nestCalls.length,
    2,
    "Identical cutter contours reuse a plan.",
  );
  assert(p.nestCalls.every((input) => input.types.length === 1));
  assert.deepStrictEqual(p.nestCalls[1].types, [multiPayload.types[2]]);
  assert(p.statuses.some((status) => status.includes("mẫu 2/3")));
  p.render("OK: Đã tạo 3 artboard riêng; tổng 6 con.");
  const layout = JSON.parse(p.context.renderArguments[1]);
  assert.strictEqual(layout.sheets.length, 3);
  for (let i = 0; i < 3; i++) {
    assert.strictEqual(layout.sheets[i].modelIndex, i);
    assert(
      layout.sheets[i].slots.every((slot) => slot.mi === i),
      "Map local model 0 back to the correct original.",
    );
  }
  assert.strictEqual(p.nodes.btnDanBe.disabled, false);
}
{
  const p = panel({ multi: true });
  p.click();
  // Chốt trạng thái checkbox ngay lúc click, không phải sau bước chuẩn bị bên Illustrator.
  p.nodes.beMultiPerArtboard.checked = false;
  p.prepare("OKJSON:" + JSON.stringify(multiPayload));
  p.tick();
  assert.deepStrictEqual(
    p.nestCalls,
    [multiPayload],
    "Tick preserves the existing mixed-model search.",
  );
  p.render("OK:[[COUNT:2]] Dàn chung.");
  assert(
    Array.isArray(JSON.parse(p.context.renderArguments[1])),
    "Mixed mode uses the compatible single-sheet protocol.",
  );
}
{
  const p = panel({
    nest(input, call) {
      return call === 2
        ? { ok: false, error: "Mẫu tiếp theo quá lớn." }
        : { ok: true, slots: [{ mi: 0, vi: 0, x: 4, y: 4 }] };
    },
  });
  p.click();
  p.prepare(
    "OKJSON:" +
      JSON.stringify({
        ...multiPayload,
        types: [multiPayload.types[0], multiPayload.types[2]],
      }),
  );
  p.tick();
  p.tick();
  assert.strictEqual(p.nodes.btnDanBe.disabled, false);
  assert.strictEqual(
    p.expressions.length,
    1,
    "A later model failure must not produce earlier sheets.",
  );
  assert.match(p.statuses.at(-1), /^ERR:/);
}
for (const badPayload of [null, { types: [] }, {}]) {
  const p = panel();
  p.click();
  p.prepare("OKJSON:" + JSON.stringify(badPayload));
  assert.strictEqual(p.nodes.btnDanBe.disabled, false);
  assert.strictEqual(p.timers.length, 0);
}
{
  const p = panel({ result: { ok: true, slots: [] } });
  p.click();
  p.prepare(prepared);
  p.tick();
  assert.strictEqual(p.nodes.btnDanBe.disabled, false);
  assert.strictEqual(p.expressions.length, 1);
}

for (const multi of [false, true]) {
  const p = panel({ twoSided: true, multi });
  p.click();
  p.nodes.beTwoSided.checked = false;
  p.prepare("OKJSON:" + JSON.stringify({ ...multiPayload, twoSided: true }));
  assert.deepStrictEqual(clone(p.context.prepareArguments), [
    "1.25",
    "5.5",
    "8.75",
    true,
    "33",
    "35.4",
    "10",
    "10",
    "10",
    "10",
  ]);
  for (let i = 0; i < (multi ? 1 : 3); i++) p.tick();
  assert.strictEqual(
    p.expressions.length,
    2,
    "One native render batch handles both faces, not two independent nesting searches.",
  );
  p.render("OK: Đã tạo cặp trước/sau.");
  assert(p.statuses.some((s) => /hai mặt|cặp trước\/sau/.test(s)));
  assert.strictEqual(p.nodes.btnDanBe.disabled, false);
}
console.log(
  "Production Dàn bế panel: version loading, editable inputs, single/duplex and separate/mixed sheets, exact-contour reuse, model remapping and failure recovery passed.",
);
