# Kế hoạch triển khai: Dàn trộn nhiều mẫu theo khu (v2.18.0)

> **Cho người/agent thực hiện:** BẮT BUỘC dùng superpowers:subagent-driven-development (khuyên dùng) hoặc
> superpowers:executing-plans để làm theo từng task. Các bước dùng ô `- [ ]` để đánh dấu.

**Mục tiêu:** Khi tick "Dàn nhiều mẫu vào một tờ", tool tự gom con cùng mẫu thành cụm/khu, lấp đầy tờ
và chia gần đều; có tick "Chia khu cách nhau" (mặc định tắt) để chừa 5 mm giữa các khu.

**Kiến trúc:** File mới `DanCardCEP/js/dan_be_zones.js` chứa bộ chia khu thuần JS (không đụng Illustrator).
Nó dùng lõi xếp hàng lồng có sẵn qua một đối tượng `core` do `dan_be_nester.js` mở ra. `nest()` tự nhận
biết: một nhóm khuôn thì dàn như một mẫu rồi gom cụm bài; từ hai nhóm khuôn trở lên thì chạy bộ chia khu.
Bộ chia khu là một "job" chạy từng bước nên panel hiện được tiến độ (`nestAsync`).

**Công nghệ:** JavaScript ES5 cho panel CEP (Chromium), test chạy bằng Node 22 (`node tests/<tên>.test.js`).

**Spec:** `docs/THIET_KE_DAN_BE_CHIA_KHU.md` (đã duyệt 21/10/2026). Đọc spec trước khi làm.

## Ràng buộc chung

- Code trong `DanCardCEP/js/` viết kiểu ES5: `var`, `function`, không arrow/let/const/template string.
- Mọi chữ trên panel và mọi chú thích code viết tiếng Việt có dấu.
- Chỉ xoay 0/90/180/270 và tịnh tiến. Không được sửa `input` truyền vào (test so `JSON.stringify` trước/sau).
- Tất định: không dùng `Math.random`; khối lượng tìm cố định theo độ khó. Thời gian chỉ dùng cho chốt an toàn
  35 000 ms của job chia khu.
- Khoảng cách khu `s`: `input.zoneGapMm > 0` thì `s = max(zoneGapMm, gapMm)`, còn lại `s = gapMm`.
- Panel: tick `beZoneSplit` mặc định **không tick**; ô `beZoneGap` mặc định `"5"`; hợp lệ khi là số 0–50.
- Kết quả `nest()` giữ định dạng cũ `{ok, slots:[{mi, vi, x, y, angle}], count, counts, mode, detail,
  centering:{exact, offsetXmm, offsetYmm}}`; chia khu thêm `zones`. Toạ độ slot tính trên tờ (đã cộng lề).
- Canh giữa theo khung **vật lý** (đúng như `formatRows`): báo `centering` khớp sai số 1e-8 với khung bao
  dựng lại từ đường bế; không PON chặn thì lệch < 0,001 mm; bị PON chặn thì ít nhất một trục đúng tâm và
  `detail` có câu "Canh tâm bị giới hạn bởi vùng né PON."
- Khuôn không vừa tờ ở cả 4 hướng: trả đúng lỗi của bộ cũ ("Khuôn loại N không vừa khổ tờ…", `ok: false`).
- 41 test hiện có phải qua sau mỗi task; chỉ được sửa các khẳng định về luật cũ #7/#8 (xoay vòng, cân bằng
  tuyệt đối khác khuôn) ở đúng task làm đổi luật đó.
- Không sửa phần SVG động "Code dạo" ở đầu panel; không sửa bản cài trong %APPDATA%.
- Chạy toàn bộ test: `cd /home/claude/repo && for t in tests/*.test.js; do node "$t" >/dev/null 2>&1 || echo "FAIL $t"; done`
  (không in dòng FAIL nào là đạt).

## Trọng tâm khi review

1. Một mẫu rất to trộn với mẫu rất nhỏ (card 92×56 + tròn 10): khu mẫu to chỉ được vài con, mẫu nào cũng phải có mặt. → test ở Task 7.
2. Một nhóm khuôn có 4 bài, trộn với khuôn khác: cỡ cụm từng bài chênh ≤ 1 trong khu, mỗi bài một cụm liền. → test ở Task 7.
3. Khe 0 (chạm nhưng không chồng), tắt tick: hai khu chạm nhau đúng biên mà không chồng vùng tô. → test ở Task 7.
4. Chấm PON nằm giữa các cạnh tờ (không chỉ 4 góc): khép khu và canh giữa vẫn né PON. → test ở Task 5.
5. Rất nhiều mẫu (8 khuôn nhỏ): không quá 30 giây, mẫu nào cũng có mặt hoặc báo cứu hộ rõ ràng. → test ở Task 7.

---

### Task 1: Mở lõi cho bộ chia khu

**Files:**
- Modify: `DanCardCEP/js/dan_be_nester.js` (`verifyGeometry` ~dòng 1885, `RowNest.plan` ~dòng 3480, phần `return {…}` cuối file)
- Create: `tests/dan_be_zone_core.test.js`

**Interfaces:**
- Produces:
  - `verifyGeometry(plan, variants, rw, rh, dots, gap, step, zoneGap)`: tham số thứ 8 tuỳ chọn. Khi `zoneGap > gap`
    và hai phần tử plan có `zone` (số) khác nhau thì cặp đó phải cách ≥ `zoneGap` (cộng dự phòng cong như `gap`).
    Bỏ trống `zoneGap` thì hành vi y như cũ.
  - `RowNest.plan(input, groups, curveError, budgetMs, deadlineAt, effort)`: `effort === "quick"` dùng
    `{ pairSamples: 0, templates: 3, phases: 4, compose: false, tune: 0, evaluate: 6, refine: 1, fill: 0, fillMs: 0 }`.
  - `planCutterRect(groups, curveErrorMm, rect, dots, gapMm, ponClearMm, effort)` →
    `{ count, slots: [{ vi, x, y }] }`. `rect = { w, h }` (mm); `dots = [{ x, y, r }]` toạ độ trong khung; slot
    toạ độ trong khung, `vi` theo hướng của `groups`. `"full"` chạy hai lượt hướng chuẩn `[turn, turn+2]` như
    `nest()`; `"quick"` một lượt. Chỉ trả phương án qua `verifyRowSlots`; không có thì `{count: 0, slots: []}`.
  - `DanBeNester._core = { planCutterRect, verifyGeometry, cutterVariants, canonicalTurn, rotateGroups,
    normalizeGroups, sameGroups, boundsOfGroups, nestLegacy }`.
  - `VERSION` lên 11.

- [ ] **Bước 1: Viết test hỏng** `tests/dan_be_zone_core.test.js`:

```js
const core = require("../DanCardCEP/js/dan_be_nester")._core;
const sq = (x, y) => [[[[x, y], [x + 10, y], [x + 10, y + 10], [x, y + 10]]]];
const variants = core.cutterVariants(core.normalizeGroups(sq(0, 0)), 0);
// hai ô 10×10 cách nhau 3 mm, khe 2
const plan = (zb) => [{ v: 0, x: 0, y: 0, zone: 0 }, { v: 0, x: 13, y: 0, zone: zb }];
assert.equal(core.verifyGeometry(plan(0), variants, 40, 20, [], 2, 1, 5), true, "cùng khu: chỉ cần khe");
assert.equal(core.verifyGeometry(plan(1), variants, 40, 20, [], 2, 1, 5), false, "khác khu: phải ≥ 5 mm");
assert.equal(core.verifyGeometry(plan(1), variants, 40, 20, [], 2, 1), true, "không có zoneGap: như cũ");
const far = [{ v: 0, x: 0, y: 0, zone: 0 }, { v: 0, x: 16, y: 0, zone: 1 }];
assert.equal(core.verifyGeometry(far, variants, 40, 20, [], 2, 1, 5), true, "khác khu cách 6 mm: đạt");
// tròn 30 trong khung 100 × 64, khe 2: đủ 6 con, nằm trong khung, qua chốt chặn
const circle = require("./dan_be_circle_fixture").curveFor(30);
const r = core.planCutterRect(circle, 0.00025, { w: 100, h: 64 }, [], 2, 7.5, "full");
assert.ok(r.count >= 6);
r.slots.forEach((s) => assert.ok(s.x >= -1e-9 && s.y >= -1e-9 && s.x + 30 <= 100 + 1e-6 && s.y + 30 <= 64 + 1e-6));
const quick = core.planCutterRect(circle, 0.00025, { w: 100, h: 64 }, [{ x: 0, y: 0, r: 2.5 }], 2, 7.5, "quick");
assert.ok(quick.count >= 4 && quick.count <= r.count, "chấm PON ở góc khung làm mất tối đa vài con");
```

- [ ] **Bước 2:** `node tests/dan_be_zone_core.test.js` → hỏng vì `_core` chưa có.
- [ ] **Bước 3:** Cài đặt các phần trong mục Produces. `planCutterRect` dựng `input` giả:
  `{ sheet: { widthMm: rect.w, heightMm: rect.h, dots }, marginMm: 0, gapMm, ponClearMm, budgetMs: 3000 }`.
- [ ] **Bước 4:** Test mới đạt, chạy toàn bộ test: không có FAIL.
- [ ] **Bước 5:** Commit `Lõi dàn bế: mở planCutterRect và khe khu cho bộ chia khu`.

### Task 2: Nhận nhóm khuôn và gom cụm bài

**Files:**
- Create: `DanCardCEP/js/dan_be_zones.js` (bọc UMD giống `dan_be_nester.js`, gắn `root.DanBeZones`)
- Create: `tests/dan_be_zones_unit.test.js`

**Interfaces:**
- Consumes: `_core.normalizeGroups`, `_core.sameGroups`, `_core.rotateGroups` (Task 1).
- Produces:
  - `groupCutters(types, core)` → `[{ groups, members: [{ type, rel }], curveErrorMm, area }]`, theo thứ tự xuất hiện.
    `groups` = khuôn đã chuẩn hoá của bài đầu nhóm. `rel` ∈ 0..3 thoả
    `sameGroups(normalize(rotate(types[type].groups, rel*90)), groups)`. Bài có đường bế hỏng: ném
    `Error("Không đọc được đường bế kín của loại " + (i+1) + ".")`.
  - `clusterSizes(n, m)` → mảng m số, phần tử i = `floor(n/m) + (i < n % m ? 1 : 0)`.
  - `assignClusters(points, sizes)` → mảng nhãn (chỉ số trong `sizes`) cho từng điểm `{x, y}`.

```text
assignClusters — chia đôi đệ quy (tất định):
  rec(chỉ số điểm, danh sách nhãn):
    1 nhãn → gán hết.
    nhãn trái = ceil(k/2) nhãn đầu; nL = tổng sizes của nhãn trái.
    trục = x nếu khung bao các điểm rộng ≥ cao, ngược lại y.
    sắp điểm theo (trục, trục kia, chỉ số gốc); nL điểm đầu → rec(trái), còn lại → rec(phải).
```

- [ ] **Bước 1: Viết test hỏng** (dùng `L.heart()` của `tests/dan_be_shape_library.js`):

```js
const Z = require("../DanCardCEP/js/dan_be_zones");
const core = require("../DanCardCEP/js/dan_be_nester")._core;
const heart = L.heart().groups, star = L.star(5, 26, 11).groups;
const turned = core.rotateGroups(heart, 90).map((g) => g.map((c) => c.slice(3).concat(c.slice(0, 3)).reverse()));
const groups = Z.groupCutters([{ groups: heart }, { groups: star }, { groups: turned }], core);
assert.deepEqual(groups.map((g) => g.members.map((m) => m.type)), [[0, 2], [1]]);
const m = groups[0].members[1];
assert.ok(core.sameGroups(core.normalizeGroups(core.rotateGroups(turned, m.rel * 90)), groups[0].groups));
assert.deepEqual(Z.clusterSizes(23, 5), [5, 5, 5, 4, 4]);
const grid = []; for (let y = 0; y < 3; y++) for (let x = 0; x < 4; x++) grid.push({ x: x * 10, y: y * 10 });
const labels = Z.assignClusters(grid, [4, 4, 4]);
[0, 1, 2].forEach((k) => {
  const mine = grid.filter((_, i) => labels[i] === k);
  assert.equal(mine.length, 4);
  const box = { x0: Math.min(...mine.map((p) => p.x)), x1: Math.max(...mine.map((p) => p.x)),
    y0: Math.min(...mine.map((p) => p.y)), y1: Math.max(...mine.map((p) => p.y)) };
  grid.forEach((p, i) => { if (labels[i] !== k) assert.ok(!(p.x >= box.x0 && p.x <= box.x1 && p.y >= box.y0 && p.y <= box.y1), "cụm không lẫn"); });
});
assert.deepEqual(Z.assignClusters(grid, [4, 4, 4]), labels, "tất định");
```

- [ ] **Bước 2:** chạy → hỏng (chưa có module).
- [ ] **Bước 3:** cài đặt ba hàm.
- [ ] **Bước 4:** test đạt; toàn bộ test không FAIL.
- [ ] **Bước 5:** Commit `Chia khu: nhận nhóm khuôn và gom cụm bài`.

### Task 3: Cùng một khuôn thì gom cụm bài thay cho xoay vòng

**Files:**
- Modify: `DanCardCEP/js/dan_be_nester.js` (`nest()` ~dòng 3628, `formatRows` ~dòng 3599, thêm `zonesModule()`)
- Modify: `DanCardCEP/index.html` (thêm `<script src="./js/dan_be_zones.js"></script>` ngay trước dòng nạp `dan_be_nester.js`)
- Modify tests: `tests/dan_be_rows.test.js` (ca "bài cùng khuôn"), `tests/dan_be_alternating.test.js` (khối "Three artwork
  types share one triangle cutter"), `tests/dan_be_nester.test.js` (`balancedDesigns`)
- Test: `tests/dan_be_zones_unit.test.js`

**Interfaces:**
- Consumes: `groupCutters`, `clusterSizes`, `assignClusters` (Task 2).
- Produces: `zonesModule()` trong nester: `window.DanBeZones` nếu có, nếu không thì `require("./dan_be_zones.js")`
  khi có `require`, nếu không thì `null`. `nest()` với nhiều bài **cùng một nhóm khuôn**: chạy đúng nhánh xếp hàng
  + thi đua bộ cũ như hiện tại trên `groups` của nhóm, rồi gán bài bằng `assignClusters` (tâm khung bao từng con,
  `clusterSizes(count, số bài)`), `vi` của bài = `(vi + rel) % 4`, `angle = vi*90`. Nếu bộ cũ thắng thì đổi `vi`
  của nó về hướng khuôn đại diện (`(vi − rel + 4) % 4`) trước khi gán lại. `mode` đổi phần đuôi thành
  `" + gom cụm các bài cùng khuôn"`.

- [ ] **Bước 1: Viết test hỏng** trong `tests/dan_be_zones_unit.test.js`:

```js
const f = require("./dan_be_fixtures");
const inputFor = (list) => f.input(list[0], { types: list.map((g) => ({ groups: g, curveErrorMm: L.heart().curveErrorMm })) });
// 3 bài cùng khuôn tim, bài 3 đặt xoay 90° trong file: vị trí trùng dàn 1 mẫu, mỗi bài một cụm
const one = nester.nest(inputFor([heart]));
const three = nester.nest(inputFor([heart, heart, turned]));
const key = (s) => `${s.x.toFixed(6)},${s.y.toFixed(6)}`;
assert.deepEqual(three.slots.map(key).sort(), one.slots.map(key).sort(), "vị trí y như dàn một mẫu");
assert.ok(Math.max(...three.counts) - Math.min(...three.counts) <= 1);
three.slots.forEach((s) => assert.equal(s.angle, s.vi * 90));
// khung bao tâm của bài k không chứa tâm con của bài khác
[0, 1, 2].forEach((k) => assertClusterBoxClean(three, k));
```

  `assertClusterBoxClean(result, k)` viết trong file test: tâm khung bao vật lý từng con (dựng lại từ đường bế),
  khung bao các tâm của bài `k` không chứa tâm nào của bài khác.
- [ ] **Bước 2:** chạy → hỏng (đang xoay vòng).
- [ ] **Bước 3:** cài đặt như Produces.
- [ ] **Bước 4:** sửa test cũ đúng luật mới, giữ nguyên mọi kiểm tra khác:
  - `dan_be_rows.test.js` "bài cùng khuôn": `mode` khớp `/gom cụm các bài cùng khuôn/`; thay vòng `s.mi === i % 3`
    bằng kiểm tra cụm (cùng tiêu chí `assertClusterBoxClean`, viết lại trong file đó); giữ chênh ≤ 1.
  - `dan_be_alternating.test.js`: thay `s.mi === i % 3` bằng kiểm tra cụm; giữ `s.vi === s.angle / 90` và chênh ≤ 1.
  - `dan_be_nester.test.js` `balancedDesigns`: thay "cyclic artwork slot" bằng kiểm tra cụm; giữ "equal alternation" (chênh ≤ 1).
- [ ] **Bước 5:** test mới và toàn bộ test đạt. Commit `Dàn bế: nhiều bài cùng khuôn gom cụm thay cho xoay vòng`.

### Task 4: Hồ sơ khuôn, cây chia khu và ước lượng kích thước khu

**Files:**
- Modify: `DanCardCEP/js/dan_be_zones.js`
- Test: `tests/dan_be_zones_unit.test.js`

**Interfaces:**
- Consumes: `_core.planCutterRect` (Task 1), kết quả `groupCutters` (Task 2).
- Produces:
  - `profileCutter(cutter, W, H, gap, ponClear, core)` → `{ boxes: [{x0, y0, x1, y1}] }`, khung bao từng con của
    `planCutterRect(cutter.groups, cutter.curveErrorMm, {w: W, h: H}, [], gap, ponClear, "quick")`, dời về góc
    trên-trái của bố cục.
  - `makeEstimator(profile)` → `f(w, h)` = số khung có `x1 ≤ w + 1e-9` và `y1 ≤ h + 1e-9`.
  - `enumerateTrees(cutters)` → mảng cây; lá `{ leaf: c }`, nút `{ dir: "H" | "V", kids: [...] }`. `"H"` xếp các
    con từ trên xuống, `"V"` từ trái sang. Quy tắc sinh (bỏ trùng theo chuỗi khoá, tối đa 200 cây, thứ tự cố định):
    - G ≤ 4: một tầng, mọi hoán vị × {H, V}. G ≥ 5: các thứ tự theo diện tích tăng, giảm và mọi vòng xoay của hai thứ tự đó, × {H, V}.
    - G ≥ 3: hai tầng. Chia các khuôn thành 2 phần không rỗng có thứ tự (G ≤ 4: mọi cách; G ≥ 5: hai cách xen kẽ theo
      diện tích), ngoài {H, V}, trong vuông góc với ngoài, các khuôn trong một phần xếp diện tích giảm dần; phần có
      đúng 1 khuôn là lá.
  - `sizeTree(tree, W, H, ests, cutters, s)` → `{ total, minPer, counts: [theo khuôn], extents }` với `extents` là
    `Map` nút → mảng độ dài cấp cho từng con theo trục của nút.

```text
need(node, N, cross, axis): độ dài nhỏ nhất theo 'axis' để mọi bài trong node có ≥ N con, khi bề kia = cross.
  lá c: nhỏ nhất L với est_c(rộng, cao) ≥ m_c·N (rộng/cao lấy theo axis); tìm trong các mép x1/y1 đã sắp.
  nút cùng trục: Σ need(kid) + (k−1)·s.
  nút vuông góc: nhỏ nhất L (tìm nhị phân, bước 0,25 mm) với Σ need(kid, N, L, trục kia) + (k−1)·s ≤ cross.
sizeTree: N* = N lớn nhất (tìm nhị phân) mà need(gốc) ≤ span; extents con = need(con, N*).
  Phần dư = span − Σ − (k−1)·s (đúng spec "dư cho mẫu đang ít con trước, sau đó cho mẫu nào vừa"):
  xét các con theo số con mỗi bài tăng dần (hoà thì con đứng trước); con đầu tiên mà dồn hết phần dư vào
  thì số con tăng → cấp cho con đó; không con nào tăng thì để dư. Con là nút trong: gọi đệ quy trên khung của nó.
  minPer = min_c floor(counts_c / m_c). Không đạt N = 1 thì N* = 0 (cây vẫn được chấm, minPer có thể = 0).
  Số ranh giới của cây = Σ (k − 1) trên mọi nút; dùng để xếp hạng (ít hơn đứng trước).
```

- [ ] **Bước 1: Viết test hỏng:**

```js
// ước lượng giả: ô 10×10 và ô 20×20 xếp lưới khít, khe khu 0
const unit = (k) => ({ boxes: [...Array(10)].flatMap((_, r) => [...Array(10)].map((_, c) =>
  ({ x0: c * k, y0: r * k, x1: (c + 1) * k, y1: (r + 1) * k }))) });
const ests = [Z.makeEstimator(unit(10)), Z.makeEstimator(unit(20))];
const cutters = [{ members: [{}] }, { members: [{}] }];
assert.equal(ests[0](35, 20), 6);
assert.equal(Z.enumerateTrees(cutters).length, 4);
assert.equal(Z.enumerateTrees([0, 1, 2].map(() => ({ members: [{}], area: 1 }))).length, 24);
assert.equal(Z.enumerateTrees([0, 1, 2, 3].map(() => ({ members: [{}], area: 1 }))).length, 76);
const sz = Z.sizeTree({ dir: "H", kids: [{ leaf: 0 }, { leaf: 1 }] }, 100, 110, ests, cutters, 0);
// N* = 20: khuôn 0 cần 2 hàng (cao 20), khuôn 1 cần 4 hàng × 5 con (cao 80); dư 10 → hai khuôn bằng
// 20 con/bài, khuôn 0 đứng trước và thêm được 1 hàng → [30, 20]
assert.deepEqual(sz.counts, [30, 20]);
assert.equal(sz.minPer, 20);
```

- [ ] **Bước 2:** chạy → hỏng.
- [ ] **Bước 3:** cài đặt. **Bước 4:** đạt; toàn bộ test không FAIL. **Bước 5:** Commit `Chia khu: hồ sơ khuôn, cây chia khu, ước lượng`.

### Task 5: Dàn thật một cây chia khu (đặt lá, khép khu)

**Files:**
- Modify: `DanCardCEP/js/dan_be_zones.js`
- Create: `tests/dan_be_zone_checker.js` (bộ đo độc lập cho test, không dùng code của panel)
- Create: `tests/dan_be_zone_fixtures.js` với `standardInput(types, extra)`: tờ 330 × 354, PON 4 góc cách mép 10 mm r 2,5,
  khe 2, lề 4, né 7,5, `resolutionMm` 0,25, `budgetMs` 3000; `extra.midEdgeDots` thêm PON giữa 4 cạnh
  (165, 10), (165, 344), (10, 177), (320, 177); các khoá khác của `extra` ghi đè trường cùng tên.
- Test: `tests/dan_be_zones_unit.test.js`

**Interfaces:**
- Consumes: `planCutterRect`, `verifyGeometry` với `zoneGap`, `cutterVariants` (Task 1); `sizeTree` (Task 4).
- Produces:
  - `makeContext(input, cutters, core)` → `ctx` với: `W, H` (vùng dùng được), `margin`, `gap`, `s`, `dots`
    (toạ độ vùng dùng được, `radius = r + ponClear`), `variants` (khuôn `c` hướng `vi` ở chỉ số `c*4 + vi`),
    `planLeaf(c, rect, effort)` (có nhớ đệm theo khuôn, cỡ khung làm tròn 0,001 mm, vị trí chấm so với khung, effort),
    `verify(pieces)` = `verifyGeometry` với `zone = c`, `gap`, `zoneGap = s`, `step = 1`.
  - Mảnh dàn: `{ c, vi, x, y }` (toạ độ vùng dùng được, `vi` theo khuôn đại diện); khung bao lấy từ `ctx.variants`.
  - `realizeTree(tree, sizing, ctx, effort)` → `{ pieces, counts }` hoặc `null` khi có khuôn không được con nào.
  - `approachShift(prev, next, axis, ctx)` → δ ≥ 0 (mm) để dời `next` về phía `prev` theo `axis` ("x"|"y").

```text
realizeNode(nút, khung):
  lá: ctx.planLeaf(c, khung) rồi dời theo gốc khung.
  nút: con trừ con cuối nhận độ dài extents; con cuối nhận phần còn lại tới hết khung.
    Với mỗi con: đặt trong khung [con trỏ, con trỏ + độ dài]; con đầu thì "kéo sát mép đầu khung";
    con sau thì dời về con trước δ = approachShift(các mảnh trước, mảnh con này).
    con trỏ = mép cuối thật của các mảnh con này + s.
approachShift (trục y; trục x đổi vai x/y):
  cột rộng 0,1 mm; chia nhỏ mỗi cạnh đường bế để hai điểm liên tiếp cách ≤ 0,05 mm.
  low[i] = y lớn nhất của 'prev' trong cột i; high[i] = y nhỏ nhất của 'next' trong cột i.
  lowD[i] = max_k low[i+k] + sqrt(max(0, s² − (max(0,|k|−1)·0,1)²)), |k| ≤ ceil(s/0,1)+1.
  δ = min_i (high[i] − lowD[i]) − 0,002, kẹp ≥ 0.
  Kiểm tra ctx.verify(prev ∪ next đã dời); hỏng thì lùi δ 0,05 mm, tối đa 10 lần, vẫn hỏng thì δ = 0.
"Kéo sát mép đầu khung": δ0 = mép đầu mảnh − mép đầu khung; thử dời, ctx.verify hỏng thì giảm nửa, tối đa 6 lần.
```

- [ ] **Bước 1: Viết test hỏng.** `tests/dan_be_zone_checker.js` export:
  - `outline(groups, slot)`: đường bế đặt đúng chỗ của một slot (xoay `slot.angle`, góc trên-trái khung bao ở `x, y`);
  - `cutterGroupsOf(input)`: mảng các mảng chỉ số bài cùng nhóm khuôn (tự so đường bế đã chuẩn hoá ở cả 4 hướng);
  - `checkLayout(input, result, zoneGapMm)`: ném lỗi khi ra ngoài lề, chạm vùng né PON (tính từ mép chấm), cùng nhóm
    khuôn < khe, khác nhóm < khoảng cách khu, chồng vùng tô hoặc lọt lỗ;
  - `clusterCount(input, result, typeIndex)`: số cụm liền của một bài theo tiêu chí "kề nhau" ở spec mục 8;
  - `assertSeparable(input, result)`: ném lỗi khi có hai nhóm khuôn mà tâm các con không tách được bằng một đường ngang hoặc dọc;
  - `centreError(input, result)`: `[lệch x, lệch y]` của khung bao vật lý so với tâm tờ.
  Test mới (`toResult(out, input, cutters)` viết trong file test: mảnh → slot tờ với `x + lề`, `y + lề`,
  `mi` = bài đầu của khuôn, `vi = (vi + rel) % 4`, `angle = vi * 90`):

```js
// tim trên, sao dưới, khe 2, khu cách 5; PON 4 góc và giữa 4 cạnh
const input = fx.standardInput([L.heart(), L.star(5, 26, 11)], { zoneGapMm: 5, midEdgeDots: true });
const cutters = Z.groupCutters(input.types, core), ctx = Z.makeContext(input, cutters, core);
const ests = cutters.map((c) => Z.makeEstimator(Z.profileCutter(c, ctx.W, ctx.H, ctx.gap, input.ponClearMm, core)));
const tree = { dir: "H", kids: [{ leaf: 0 }, { leaf: 1 }] };
const out = Z.realizeTree(tree, Z.sizeTree(tree, ctx.W, ctx.H, ests, cutters, ctx.s), ctx, "quick");
assert.ok(out && out.counts[0] > 0 && out.counts[1] > 0);
assert.equal(ctx.verify(out.pieces), true);
checker.checkLayout(input, toResult(out, input, cutters), 5);   // đo độc lập
// khép khu giữa tờ (xa mọi chấm PON): hàng tim (khuôn 0) ở trên, hàng sao (khuôn 1) đặt dư thêm 5 mm phía dưới
const prev = row(0, 100, 0), next = row(1, bottomOf(prev) + ctx.s + 5, 0); // row(c, y, vi): 3 con từ x = 100, cách nhau 10 mm
const d = Z.approachShift(prev, next, "y", ctx);
assert.ok(d >= 4.99, "dời được ít nhất phần dư 5 mm");
const dist = checker.minDistance(input, toSlots(prev), toSlots(shifted(next, 0, -d)));   // đo độc lập trên đường bế
assert.ok(dist >= ctx.s - 1e-6 && dist <= ctx.s + 0.1, "khép sát đúng khoảng cách khu");
```

  (`row`, `bottomOf`, `shifted`, `toSlots` là hàm nhỏ trong file test; `checker.minDistance(input, slotsA, slotsB)`
  thêm vào checker: khoảng cách nhỏ nhất giữa hai tập slot, đo trên đường bế thật.)
- [ ] **Bước 2:** chạy → hỏng. **Bước 3:** cài đặt. **Bước 4:** đạt; toàn bộ test không FAIL.
- [ ] **Bước 5:** Commit `Chia khu: dàn thật cây chia khu và khép khu theo đường bế`.

### Task 6: Lấp chỗ trống bằng lưới của chính khu

**Files:**
- Modify: `DanCardCEP/js/dan_be_zones.js`
- Test: `tests/dan_be_zones_unit.test.js`

**Interfaces:**
- Consumes: `ctx`, mảnh dàn (Task 5).
- Produces: `fillGaps(pieces, ctx)` → số con thêm được (sửa `pieces` tại chỗ).

```text
Với từng khuôn c theo thứ tự cây:
  vectơ lưới = mọi (viA → viB, dx, dy) giữa hai mảnh của c có khung bao cách nhau ≤ gap + 0,5·min(rộng, cao),
  làm tròn 0,001, bỏ trùng.
  Duyệt mảnh của c theo (y, x) (mảnh mới thêm vào cuối hàng đợi): thử mảnh + vectơ có viA = vi của mảnh.
  Ứng viên đạt khi ctx.verify(ứng viên + các mảnh có khung bao cách ứng viên ≤ max(gap, s) + 1).
Tổng ứng viên thử tối đa 2000.
```

- [ ] **Bước 1: Viết test hỏng:** dàn một khu tròn 30, bỏ 3 con ở giữa, `fillGaps` phải thêm lại ≥ 3 con và
  `ctx.verify` đạt; gọi lần hai trả 0.
- [ ] **Bước 2:** hỏng. **Bước 3:** cài đặt. **Bước 4:** đạt; toàn bộ test không FAIL.
- [ ] **Bước 5:** Commit `Chia khu: lấp chỗ trống bằng lưới của chính khu`.

### Task 7: Job chia khu, canh giữa, cứu hộ, `nest()` và `nestAsync()`

**Files:**
- Modify: `DanCardCEP/js/dan_be_zones.js`, `DanCardCEP/js/dan_be_nester.js` (`nest()`, thêm `nestAsync`)
- Modify: `tests/dan_be_zone_fixtures.js` (thêm `mixedSets()`); Create: `tests/dan_be_zones.test.js` (bộ test tích hợp)
- Modify tests: `dan_be_rows.test.js` ("khác khuôn"), `dan_be_irregular.test.js` ("Two distinct irregular types"),
  `dan_be_mixed.test.js` (`checkMixed`), `dan_be_variable_sizes.test.js` ("Distinct scaled cutters"),
  `dan_be_centering.test.js` (khẳng định `[12, 12]`)

**Interfaces:**
- Consumes: mọi hàm của Task 2–6.
- Produces:
  - `createJob(input, core)` → `{ step() }`; `step()` trả `{ done, progress: { done, total }, result }`. Mỗi bước làm
    tối đa một lần `planLeaf`. Các pha: hồ sơ từng khuôn → sinh, ước lượng, xếp hạng cây → dàn thật `K` cây đầu
    (`"quick"`, `K` = 4 với 2 khuôn, 6 với 3–4, 5 với ≥ 5) → dàn lại cây thắng (`"full"`) → lấp chỗ trống, gán bài,
    canh giữa, chốt chặn, đóng gói kết quả. Quá 35 000 ms thì thôi dàn thêm cây, lấy cây tốt nhất đã có.
  - Mỗi cây dàn thật phải qua `ctx.verify` và mọi bài ≥ 1 con, không thì loại. Chọn cây theo: tổng con giảm dần,
    `minPer` giảm dần, số ranh giới tăng dần, thứ tự sinh. Dàn lại cây thắng bằng `"full"`; nếu ít con hơn bản
    `"quick"` hoặc không qua `ctx.verify` thì giữ bản `"quick"`. Gán bài trong từng khu bằng `assignClusters` với
    `clusterSizes(số con của khu, số bài của khuôn)`; `vi` của bài = `(vi + rel) % 4`.
  - `runJob(job)` → kết quả (gọi `step()` tới khi xong).
  - `centerLayout(pieces, ctx)` → `{ dx, dy, exact }`, theo quy tắc canh giữa trong "Ràng buộc chung": thử đúng tâm;
    không được thì giữ đúng tâm một trục, trục kia tìm nhị phân phần dời lớn nhất còn qua `ctx.verify`; không được
    nữa thì không dời.
  - `nest(input)` trong nester: kiểm tra đầu vào như cũ; `groupCutters` ≥ 2 nhóm → `runJob(createJob(input, _core))`;
    lỗi bất ngờ thì dùng `nestLegacy(input)` và thêm vào đầu `detail` (hoặc `error`): "Chia khu không xếp đủ mọi
    mẫu, tạm dùng cách dàn xen kẽ cũ. ". Khuôn không vừa tờ: trả nguyên kết quả `nestLegacy(input)` (lỗi "loại N").
  - `nestAsync(input, onProgress, onDone)`: chia khu thì chạy từng `step()` qua `setTimeout(…, 0)` và gọi
    `onProgress(progress)` sau mỗi bước; trường hợp khác thì `setTimeout` rồi `onDone(nest(input))`.
  - Kết quả chia khu: `mode = "dàn chia khu theo mẫu"`; `zones = [{ cutter, types, count }]`; `detail` dạng
    "Dàn chia khu theo mẫu: 61 con (loại 1: 20, loại 2: 21, loại 3: 20). 3 khu dải ngang, khu cách nhau 5.00 mm, khe
    2.00 mm theo đường bế thật; lấp thêm 3 con; đã nghĩ 24 cách chia, dàn thật 6 cách trong 8421 ms." (cây một tầng
    H/V ghi "dải ngang"/"dải dọc", hai tầng ghi "2 tầng"; khi không có khu cách nhau thì ghi "các khu cách nhau bằng khe").
  - Không cây nào cho mọi bài ≥ 1 con hoặc qua chốt chặn: trả `nestLegacy(input)` với câu cứu hộ ở đầu `detail`
    (hoặc ở đầu `error` khi bộ cũ trả `ok: false`).

- [ ] **Bước 1: Viết test hỏng.** Thêm vào `tests/dan_be_zone_fixtures.js` (đã có `standardInput` từ Task 5) hàm
  `mixedSets()` trả `[{ name, types: [{ groups, curveErrorMm }] }]`:
  1. tròn 25 (`circle_fixture.curveFor(25)`) + tim + sao 5 cánh `L.star(5, 26, 11)`;
  2. card `L.rect(92, 56)` + tròn 30;
  3. lá (`dan_be_fixtures.leaf()`) + mèo + thỏ (chép mảng từ `dan_be_irregular.test.js`);
  4. vòm 40 × 70 (`arch_fixture.curveFor(40, 70)`) + trăng khuyết + giọt nước + xương.
  `tests/dan_be_zones.test.js`, mỗi bộ chạy với `zoneGapMm` 0 và 5:

```js
const totals = { 0: 0, 5: 0 }, legacyTotal = { 0: 0, 5: 0 };
for (const set of mixedSets()) for (const zoneGapMm of [0, 5]) {
  const input = standardInput(set.types, { zoneGapMm }), before = JSON.stringify(input);
  const t0 = Date.now(), r = nester.nest(input), ms = Date.now() - t0;
  const legacy = nester.nestLegacy(standardInput(set.types));
  assert.equal(r.ok, true, r.error);
  assert.equal(JSON.stringify(input), before);
  assert.match(r.mode, /dàn chia khu theo mẫu/);
  r.counts.forEach((n) => assert.ok(n >= 1, "bài nào cũng có mặt"));
  set.types.forEach((_, k) => assert.equal(checker.clusterCount(input, r, k), 1, "mỗi bài một cụm liền"));
  checker.checkLayout(input, r, Math.max(zoneGapMm, input.gapMm));
  checker.assertSeparable(input, r);               // từng cặp nhóm khuôn tách được bằng đường ngang/dọc
  assert.ok(r.count > legacy.count, "nhiều con hơn cách cũ");
  assert.deepEqual(nester.nest(input).slots, r.slots, "chạy lại y hệt");
  assert.ok(ms <= 30000);
  totals[zoneGapMm] += r.count; legacyTotal[zoneGapMm] += legacy.count;
}
assert.ok(totals[0] >= 1.30 * legacyTotal[0]);
assert.ok(totals[5] >= 1.25 * legacyTotal[5]);
```

  Thêm các ca (mỗi ca dùng cùng khối khẳng định, trừ ngưỡng tổng):
  - **6 khuôn nhỏ** (spec mục 8.3): tròn 20 (`circle_fixture.curveFor(20)`), tim `L.heart(25, 23)`, sao `L.star(5, 13, 5.5)`,
    giọt nước `L.teardrop(20, 29)`, lục giác `L.regular(6, 12)`, chữ nhật `L.rect(20, 12)`.
  - **Trọng tâm review 1:** card 92 × 56 + tròn 10.
  - **Trọng tâm review 2:** 4 bài cùng khuôn tròn 30 (bản dời toạ độ/đảo chiều path) + tim: trong khu tròn, 4 bài chênh ≤ 1, mỗi bài một cụm.
  - **Trọng tâm review 3:** khe 0, `zoneGapMm` 0: tim + sao; `checkLayout` cho phép chạm, cấm chồng vùng tô.
  - **Trọng tâm review 5:** 8 khuôn nhỏ (6 khuôn trên + tam giác `L.triangle(26, 14)` + xương `L.bone(35, 15)`):
    ≤ 30 000 ms; mọi bài ≥ 1 con, hoặc câu cứu hộ đứng đầu `detail` (khi `ok`) hay `error` (khi không `ok`).
  - **Cứu hộ:** tờ 120 × 90 không PON, card 92 × 56 + tròn 60 (không có cách nào đặt đủ hai khuôn): câu cứu hộ đứng đầu
    `detail`/`error`, và `slots` (nếu có) trùng `nestLegacy` của cùng đầu vào. Khi bộ cũ trả `ok: false` thì `nest()` trả
    `ok: false`, `error` = câu cứu hộ + lỗi của bộ cũ.
  - **nestAsync:** bộ 1: `onProgress` được gọi ≥ 1 lần; `onDone` trả `slots`/`counts` trùng `nest()`.
  - **Không PON:** bộ 1 trên tờ không chấm: `centering.exact === true`, lệch < 0,001 mm (đo bằng `checker`).
- [ ] **Bước 2:** chạy → hỏng.
- [ ] **Bước 3:** cài đặt như Produces.
- [ ] **Bước 4:** sửa test cũ đúng luật mới (giữ mọi kiểm tra hình học và mốc số con tối thiểu):
  - `dan_be_rows.test.js` "khác khuôn": `mode` khớp `/dàn chia khu theo mẫu/`, bỏ chênh ≤ 1, thêm "mỗi bài ≥ 1 con".
  - `dan_be_irregular.test.js`: đổi tên ca thành "Two distinct irregular types in zones", bỏ "balanced distinct types",
    thêm "mỗi bài ≥ 1 con".
  - `dan_be_mixed.test.js` `checkMixed`: bỏ chênh ≤ 1, thêm "mỗi bài ≥ 1 con"; giữ hai khẳng định `balancedPlan` của bộ cũ.
  - `dan_be_variable_sizes.test.js`: bỏ "distinct cutter types remain balanced", thêm "mỗi bài ≥ 1 con".
  - `dan_be_centering.test.js`: bỏ `deepEqual(mixed.counts, [12, 12])`, thêm "mỗi bài ≥ 1 con"; giữ `exactPublicCentre(…, 24, …)`.
- [ ] **Bước 5:** test tích hợp và toàn bộ test đạt. Commit `Chia khu: job suy nghĩ, canh giữa, cứu hộ, nestAsync`.

### Task 8: Panel — tick "Chia khu cách nhau", ô khoảng cách, tiến độ

**Files:**
- Modify: `DanCardCEP/index.html` (ngay sau gợi ý "Mặc định mỗi mẫu một tờ; tick để gộp.")
- Modify: `DanCardCEP/js/main.js` (khối Dàn bế quanh dòng 2280–2470)
- Modify: `tests/dan_be_panel.test.js`

**Interfaces:**
- Consumes: `DanBeNester.nestAsync` (Task 7).
- Produces (HTML, đúng id và chữ):

```html
<div id="beZoneOpt" class="field hidden">
  <label class="check"><input type="checkbox" id="beZoneSplit" /><span>Chia khu cách nhau</span></label>
  <label id="beZoneGapField" class="field hidden" for="beZoneGap">
    <span class="label">Khoảng cách khu (mm)</span>
    <input id="beZoneGap" class="num" type="text" value="5" inputmode="decimal" />
  </label>
  <p class="hint">Không tick: các khu cách nhau bằng khe thường.</p>
</div>
```

  - `syncBeZoneOptions()` đặt **ngoài** khối `var btnDanBe … var btnCopyToiUuNote` (để harness test không chạy nó):
    `beZoneOpt` hiện khi `beMultiPerArtboard` tick; `beZoneGapField` hiện khi thêm `beZoneSplit` tick. Gắn vào sự kiện
    `change` của hai ô và gọi một lần lúc khởi tạo.
  - Trong click Dàn bế: chỉ khi `beMulti` và `beZoneSplit` đều tick mới đọc `beZoneGap` (đổi `,` thành `.`). Không phải số
    hữu hạn trong 0–50 thì `show(outDanBe, "ERR: Khoảng cách khu phải là số từ 0 đến 50 mm.")`, không gọi
    `evalScript`. Hợp lệ thì gán `payload.zoneGapMm` sau khi parse payload (chỉ ở chế độ gộp một tờ). Không tick thì
    không thêm trường nào vào payload.
  - `searchPlan` ở chế độ gộp một tờ: có `nestAsync` thì gọi nó, mỗi lần tiến độ
    `show(outDanBe, "Đang suy nghĩ… phương án " + p.done + "/" + p.total)`, xong thì xử lý kết quả như nhánh cũ;
    không có `nestAsync` thì giữ đúng nhánh `nest()` cũ. Chế độ mỗi mẫu một tờ không đổi.

- [ ] **Bước 1: Viết test hỏng** trong `tests/dan_be_panel.test.js`: thêm node `beZoneSplit`, `beZoneGap` vào harness
  (thiếu thì coi như không tick). Ca mới:
  - `multi` + `zoneSplit` + gap `"5"` → `nestCalls[0].zoneGapMm === 5`;
  - `multi` + `zoneSplit` + gap `"abc"` → trạng thái cuối là câu lỗi trên, `expressions.length === 0`;
  - `multi` không `zoneSplit` → payload truyền vào y hệt payload chuẩn bị;
  - mock có `nestAsync` gọi `onProgress({ done: 1, total: 3 })` rồi `onDone(kết quả)` → có trạng thái
    "Đang suy nghĩ… phương án 1/3" và vẽ đúng slot.
  - Kiểm tra tĩnh `index.html`: có đủ id trên, `beZoneSplit` không có `checked`, `beZoneGap` value `"5"`, hai khối có class `hidden`.
- [ ] **Bước 2:** hỏng. **Bước 3:** cài đặt. **Bước 4:** đạt; toàn bộ test không FAIL.
- [ ] **Bước 5:** Commit `Panel Dàn bế: tick chia khu cách nhau và tiến độ suy nghĩ`.

### Task 9: Ảnh duyệt, tài liệu, chuẩn bị phát hành v2.18.0

**Files:**
- Create: ảnh duyệt `chia_khu_tat_tick.png`, `chia_khu_bat_tick.png` trong thư mục tạm (không commit)
- Modify: `DanCardCEP/LICH_SU_CAP_NHAT.md`, `docs/KE_HOACH_DAN_BE_DECAL.md` (bảng điều kiện #7, #8 và mục 5),
  `README.md` (danh sách test)

- [ ] **Bước 1:** Xuất ảnh 4 bộ mẫu ở mục 1 của spec (tô màu theo bài, viền chấm PON), cả tắt tick và bật tick 5 mm,
  kèm số con cũ → mới. Gửi anh Lộc duyệt bằng mắt. **Dừng ở đây cho tới khi anh đồng ý.**
- [ ] **Bước 2:** Viết mục `## v2.18.0 — Dàn trộn nhiều mẫu theo khu` trong lịch sử cập nhật (4–6 gạch đầu dòng, dùng số đo thật),
  sửa bảng điều kiện #7/#8 và mục 5 của `KE_HOACH_DAN_BE_DECAL.md`, thêm test mới vào `README.md`.
- [ ] **Bước 3:** Toàn bộ test đạt (in ra tổng số test qua). Commit `Tài liệu v2.18.0: dàn trộn nhiều mẫu theo khu`.
- [ ] **Bước 4:** Phát hành theo quy trình cũ (nâng phiên bản manifest/index, ZIP + `latest.json`, đẩy GitHub), ghi các
  file vào thư mục `C:\Users\ADMIN\Downloads\DanCard_Setup_23` của anh Lộc khi anh cho phép, nhắc anh bấm file hoàn
  tất phát hành để cập nhật Cloudflare Worker.
