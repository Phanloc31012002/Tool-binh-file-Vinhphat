# Kế hoạch sửa theo soát mã — v2.19.0

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sửa gom một lần các phát hiện N1–N5, Q1, Q2, Q4, Q5, Q6, Q8 của `docs/SOAT_MA_2026-10-22.md` và thêm tuỳ chọn "Đo khổ theo bảng Transform", giao thành v2.19.0.

**Architecture:** Mọi lệnh đo khổ qua một hàm chung `dcKhungThanhPham(item)` (đúng khung Transform của Illustrator) khi cờ `dcDoTheoKhungTransform` bật; panel truyền cờ + đường dẫn extension bằng một tiền tố ExtendScript duy nhất (`evalJsx`). Dọn dẹp chỉ đụng object do tool tạo (gắn `note`), cấp chỗ tờ mới né cả bài cũ, ghép cặp dùng chung một hàm theo hàng. Lỗi luôn trả `ERR:`.

**Tech Stack:** ExtendScript ES3 (`DanCardCEP/jsx/*.jsx`), CEP panel ES5 (`DanCardCEP/js/main.js`, `index.html`), test Node (`node tests/<file>.test.js`, bộ giả lập `tests/illustrator_geometry_mock.js`, chạy cả bộ bằng `/tmp/claude-0/-home-claude/d9992321-e19a-5172-bbff-6694fe347302/scratchpad/run_tests.sh`).

**Spec:** `docs/SOAT_MA_2026-10-22.md` (mục N1–N5, Q1, Q2, Q4, Q5, Q6, Q8) + lời anh Lộc: tool phải đo được "theo khung Transform".

## Global Constraints

- Chữ trên panel, thông báo, comment: tiếng Việt có dấu. Không đổi header SVG "Code dạo".
- Không xoá/huỷ dữ liệu người dùng khi chưa chắc: chỉ xoá object do tool tạo (có `note` nhận dạng) hoặc bản sao do tool vừa tạo.
- Chuỗi trả về panel: thành công `OK: …`, lỗi/huỷ bỏ dở `ERR: …`; huỷ ở hộp thoại trước khi đụng tài liệu `OK: Đã hủy, chưa thay đổi gì.` Không dùng `alert` để báo lỗi đầu vào trong các lệnh có kết quả trả về panel.
- Dung sai khổ dùng chung `DC_DUNG_SAI_KHO_MM = 0.5` (mm); câu lỗi về khổ luôn in số đo được.
- `panel_copy.test.js` là snapshot: đổi control thì cập nhật `controlHash`/`controlCount` trong cùng task, ghi rõ trong commit.
- Mỗi task: viết test trước, chạy thấy FAIL, sửa, chạy PASS, chạy cả bộ, commit. Không sửa `%APPDATA%`.

## Review Focus

1. File đang có kết quả Dàn Card cũ **chưa gắn note** (dàn bằng bản ≤ 2.18): lượt đầu sau cập nhật phải giữ nguyên chúng và báo số object giữ lại — kiểm ở Task 4.
2. Object được chọn là **con trong group** cấp trên cùng: group cha không được xoá — kiểm ở Task 4.
3. Khung Transform của **clip group có mask là compound path** và của **group chỉ bọc một clip group**: phải ra đúng khung mask — kiểm ở Task 1.
4. Thiếu `assets/icon.ai` lẫn file cũ ở Downloads: ghi chú CTL vẫn điền, kết quả `OK:` kèm câu thiếu icon — kiểm ở Task 2.
5. Dàn KTS lần 3 sau hai lượt đã xoá khung: tờ mới không được đè lên bài cũ còn nằm trên canvas — kiểm ở Task 6.

---

### Task 1: Đo khổ chung theo khung Transform (Q1)

**Files:**
- Modify: `DanCardCEP/jsx/dan_card_lib.jsx` (đầu file: hằng + hàm chung; `visibleUnion` trong `_dcDanCore` ~1732; `boundsOf` của KTS ~5358, Tự trở ~6465, Tự trở nhiều khổ ~7700, Resize ~28473; `measuredSize` KTS ~5429–5451)
- Modify: `DanCardCEP/jsx/dan_be_bridge.jsx` (`visibleBoundsOf` trong render ~1027; `geometricBoundsOf` cho Bài ở prepare ~447 giữ nguyên cho Khuôn)
- Modify: `DanCardCEP/index.html` (checkbox chung), `DanCardCEP/js/main.js` (`evalJsx`, lưu `localStorage`)
- Test: `tests/do_khung_transform.test.js`, cập nhật `tests/panel_copy.test.js`, `tests/dan_be_panel.test.js` nếu đếm control

**Interfaces:**
- Produces (lib, cấp toàn cục): `var DC_DUNG_SAI_KHO_MM = 0.5;` `var dcDoTheoKhungTransform = true;` `function dcKhungThanhPham(item)` → `[l,t,r,b]` hoặc `null`. Quy tắc: `item` là GroupItem `clipped` → `geometricBounds` của pageItem con trực tiếp có `clipping === true` (kể cả CompoundPathItem; không có thì `item.geometricBounds`); GroupItem không clip mà có đúng 1 pageItem con → đệ quy vào con; còn lại `item.geometricBounds`. Nếu `app.preferences.getBooleanPreference("includeStrokeInBounds")` là true thì dùng `visibleBounds` thay `geometricBounds` ở mọi nhánh. Mọi truy cập bọc try/catch.
- Produces (lib): `function dcDoKhung(item, legacy)` → `dcDoTheoKhungTransform ? (dcKhungThanhPham(item) || legacy(item)) : legacy(item)`.
- Produces (main.js): `function evalJsx(expr, cb)` = `cs.evalScript(jsxPrelude() + expr, cb)`; `jsxPrelude()` trả `"var dcDoTheoKhungTransform = <true|false>; var dcExtensionRoot = '<extensionRoot>'; "` (dùng `jsStr`). Thay mọi `cs.evalScript(` trong main.js bằng `evalJsx(`.
- Panel: checkbox `id="doTheoTransform"` nhãn "Đo khổ theo bảng Transform (khung clip, như Illustrator hiện)", mặc định tick, nhớ bằng `localStorage["dc.doTheoTransform"]`, đặt trong khối tuỳ chọn chung đầu panel (cùng chỗ với các tuỳ chọn hiện có của KTS; nếu không có khối chung thì đặt ngay trên nút Dàn KTS).

- [ ] **Step 1: Viết test `tests/do_khung_transform.test.js`** — nạp lib vào `vm` với context `{ app: { preferences: { getBooleanPreference: () => false } } }`; dựng object giả: (a) clip group mask path 92×56 mm, nội dung 90×54 → `dcKhungThanhPham` ra khung mask; (b) mask là `CompoundPathItem` → ra khung compound; (c) group bọc 1 clip group → ra khung mask bên trong; (d) path thường → `geometricBounds`; (e) preference true → `visibleBounds`; (f) `dcDoKhung(item, legacy)` với cờ false gọi `legacy`. Thêm kiểm `main.js` không còn chuỗi `cs.evalScript(` ngoài định nghĩa `evalJsx`, và `index.html` có `id="doTheoTransform"`.
- [ ] **Step 2: Chạy `node tests/do_khung_transform.test.js`** — FAIL: `dcKhungThanhPham is not a function`.
- [ ] **Step 3: Thêm hằng + `dcKhungThanhPham` + `dcDoKhung` ở đầu `dan_card_lib.jsx`** (trước `function dcDan`).
- [ ] **Step 4: Nối vào các lệnh.** Dàn Card: đầu `visibleUnion(item, acc)` thêm `if (dcDoTheoKhungTransform) { var khung = dcKhungThanhPham(item); if (khung) { merge(khung); return; } }`. KTS/Tự trở/Tự trở nhiều khổ/Resize/Catalogue (`:18791`): `boundsOf` → `return dcDoKhung(item, legacyBoundsOf)`. Bridge render `visibleBoundsOf(item)`: nếu `typeof dcKhungThanhPham === "function" && typeof dcDoTheoKhungTransform !== "undefined" && dcDoTheoKhungTransform` thì trả `dcKhungThanhPham(item)` trước khi rơi về visibleBounds. KTS `measuredSize`: so hai mặt bằng `DC_DUNG_SAI_KHO_MM * MM`, câu lỗi `"Hai mặt của mẫu N phải cùng kích thước: trước A×B mm, sau C×D mm (lệch quá 0,5 mm)."` (số 1 chữ số lẻ, dấu phẩy).
- [ ] **Step 5: main.js: `jsxPrelude()`, `evalJsx`, thay `cs.evalScript(` → `evalJsx(`; checkbox + localStorage; `index.html` thêm control.** Cập nhật snapshot `panel_copy.test.js`.
- [ ] **Step 6: Chạy test mới + cả bộ** — PASS.
- [ ] **Step 7: Commit** `Đo khổ theo khung Transform dùng chung (Q1)`.

### Task 2: Icon ghi chú theo thư mục extension (N1)

**Files:**
- Modify: `DanCardCEP/jsx/dan_card_lib.jsx` (`loadNoteIconTemplate` ở CTL ~21131 và Keo gáy ~23515; alert/kết quả cuối ~21651, ~23720)
- Test: `tests/note_icon_path.test.js`

**Interfaces:**
- Produces (lib, toàn cục): `var dcJsxFolder` = `new File($.fileName).parent` (try/catch, null nếu lỗi); `function dcNoteIconFile()` → `File` tồn tại đầu tiên trong: `dcExtensionRoot + "/assets/icon.ai"` (nếu biến có), `dcJsxFolder.parent + "/assets/icon.ai"`, `"C:/Users/ADMIN/Downloads/icon.ai"`; không có → `null`.
- `loadNoteIconTemplate()` (cả hai bản): `var f = dcNoteIconFile(); if (!f) return null;` — không throw; phần còn lại giữ. `duplicateNoteIcon()` đã xử lý template null. Khi `note` có mà template null: nối vào thông báo cuối `" Không có icon ghi chú (thiếu DanCardCEP/assets/icon.ai); ghi chú vẫn được điền."`.

- [ ] **Step 1: Viết test** — nạp lib với `File` giả (`exists` theo bảng đường dẫn, `fsName`); `dcExtensionRoot` có → chọn `assets/icon.ai`; không có gì → `null`; cắt riêng thân `loadNoteIconTemplate` (slice như `ctl_a5_notes.test.js`) với `dcNoteIconFile` trả null → trả `null`, không throw. Kiểm lib không còn chuỗi `new File("C:/Users/ADMIN/Downloads/icon.ai")` ngoài `dcNoteIconFile`.
- [ ] **Step 2: Chạy** — FAIL.
- [ ] **Step 3: Sửa như Interfaces.**
- [ ] **Step 4: Chạy test + cả bộ** — PASS.
- [ ] **Step 5: Commit** `Icon ghi chú lấy trong assets, thiếu thì bỏ qua (N1)`.

### Task 3: Dàn Card tự sửa khổ trên bản sao (N2)

**Files:**
- Modify: `DanCardCEP/jsx/dan_card_lib.jsx` (`autoFixByBackground` ~1551; vòng kiểm khổ ~1870–1884; `protectSel` ~1912)
- Test: `tests/dan_card_autofix.test.js`

**Interfaces:**
- `autoFixByBackground(item, wantWmm, wantHmm)` → `{ ok, item }`: làm việc trên `item.duplicate()`; sau mỗi chiến lược đo lại bằng `visSizeMM`; khớp trong `TOL` → `item.remove()`, trả `{ok:true, item: bảnMới}`; cả hai không khớp → xoá bản sao/raster vừa tạo, trả `{ok:false, item}` và `item` nguyên trạng. Vòng gọi chỉ còn `var fix = …; if (fix.ok) { rows[ri][ci].o = fix.item; continue; } badInfo.push(…)`.
- `protectSel` dựng từ `rows[*][*].o` (object hiện tại sau sửa), không từ `sel`.

- [ ] **Step 1: Viết test** — cắt `autoFixByBackground` + `findFrameBounds` + `visSizeMM`/`visibleUnion` ra context có `doc.rasterize` giả (trả object mới kích thước cho trước, đánh dấu nguồn `removed`), `MM`; ca 1: không khớp → nguồn `removed === false`, `ok === false`, không còn object rác (`created.every(o => o.removed)`); ca 2: khớp → `ok === true`, nguồn `removed === true`.
- [ ] **Step 2: Chạy** — FAIL (nguồn bị huỷ ở ca 1).
- [ ] **Step 3: Sửa.**
- [ ] **Step 4: Chạy test + cả bộ** — PASS.
- [ ] **Step 5: Commit** `Dàn Card: tự sửa khổ trên bản sao, không huỷ nguồn (N2)`.

### Task 4: Dàn Card chỉ dọn object của tool (N3)

**Files:**
- Modify: `DanCardCEP/jsx/dan_card_lib.jsx` (`removeSecondArtboard` ~1105, `clearOldArtboardContent` ~1206, `groupAndCenter` ~2154, `importPonCore` chỗ gán `dupped`, text ghi chú offset ~2222, nhánh voucher `clearOldArtboardContent` ~2514 và group/ghi chú của nó, `doneMsg` ~2238)
- Test: `tests/dan_card_cleanup.test.js`

**Interfaces:**
- Hằng toàn cục `var DC_NOTE_DAN_CARD = "DANCARD_DAN_CARD_OUTPUT";` Mọi object tool tạo trong Dàn Card (group kết quả mỗi mặt, PON duplicate từ file pon, textFrame ghi chú offset) gán `.note = DC_NOTE_DAN_CARD`.
- `clearOldArtboardContent(d, protectList)` → `{ removed, kept }`: duyệt object cấp trên cùng trên layer không khoá/ẩn; xoá object có `note === DC_NOTE_DAN_CARD` (bất kể vị trí); object khác có tâm trong khung bao chung artboard thì **không xoá**, đếm vào `kept`; bỏ qua object trong `protectList` hoặc là **tổ tiên** của một object trong `protectList` (so bằng `===` hoặc `uuid` nếu có). `removeSecondArtboard(d)` xoá artboard 2 và chỉ object có note trong vùng đó, trả `{ removed, kept }`.
- `doneMsg` thêm `"\nGiữ lại N object không do tool tạo trong vùng artboard (kết quả cũ dàn bằng bản trước thì xoá tay)."` khi `kept > 0`.

- [ ] **Step 1: Viết test** — cắt `clearOldArtboardContent`/`removeSecondArtboard` ra context với doc giả (layers/pageItems/artboards như `illustrator_geometry_mock`, thêm `note`, `parent`): (a) object có note bị xoá, object lạ trong artboard giữ và đếm `kept`; (b) chọn con trong group → group cha giữ; (c) object ở layer khoá giữ. Kiểm chuỗi: `groupAndCenter` có `grp.note = DC_NOTE_DAN_CARD`.
- [ ] **Step 2: Chạy** — FAIL.
- [ ] **Step 3: Sửa.**
- [ ] **Step 4: Chạy test + cả bộ** — PASS.
- [ ] **Step 5: Commit** `Dàn Card: chỉ dọn object do tool tạo, giữ object lạ và báo số (N3)`.

### Task 5: Ghép cặp theo hàng dùng chung (N5, Q5 một phần, Q8)

**Files:**
- Modify: `DanCardCEP/jsx/dan_card_lib.jsx` (Dàn Card ghép cặp ~1811–1831 + `warn(...); return;` → `return "ERR: …"`; Tự trở ~6530–6574)
- Modify: `DanCardCEP/jsx/dan_be_bridge.jsx` (`dcDanBeTripleModels` → `dcDanBeRowGroups(selection, size, epsilon)`; một mặt ~771–813; `findLayer` ~652)
- Test: `tests/pairing_shared.test.js`, cập nhật `tests/dan_be_bridge.test.js` nếu đổi tên

**Interfaces:**
- Bridge: `function dcDanBeRowGroups(selection, size, epsilon)` → mảng nhóm `[rec0, rec1, …]` theo hàng, trái → phải; lỗi throw với câu theo `size`: 2 → `"Hãy chọn số object chẵn theo hàng: mỗi hàng Khuôn bên trái, Bài bên phải."`; 3 → câu hiện có. `dcDanBeTripleModels(selection, eps)` = map `dcDanBeRowGroups(selection, 3, eps)` → `{khuon, bai, sau}`. Một mặt: `models = dcDanBeRowGroups(sel, 2, EPS).map(g → {khuon: g[0], bai: g[1]})` (viết vòng for ES3).
- Lib Tự trở: thay khối gom hàng + ghép (0,1) bằng `dcKtsPairSourceRecords(raw, 0.01)` (raw đã có `item, cx, cy, bounds`); `try/catch` → `return "ERR: " + e.message`.
- Lib Dàn Card 2 mặt: records `{ item: sel[i], bounds: clipBounds(sel[i]), cx, cy }` → `dcKtsPairSourceRecords` → `rows.push([{o: p.front.item, x, y}, {o: p.back.item, x, y}])`; lỗi → `return "ERR: " + e.message`; nhánh lẻ → `return "ERR: Số object lẻ - in 2 mặt cần mỗi hàng 2 (trước+sau)."`.
- `findLayer`: vai `front`/`back` so theo từ nguyên (`(" " + n + " ").indexOf(" back ") >= 0` hoặc `"mat sau"`), không còn `indexOf("back")` khớp "background".

- [ ] **Step 1: Viết test** — bridge: 3 hàng × 2 object, hàng giữa lệch Y 0,02 pt, đảo thứ tự chọn → `dcDanBeRowGroups(sel, 2)` ra đúng cặp; hàng lẻ → throw câu size 2; `findLayer`-logic: layer "Background" không nhận vai back (cắt `normalise` + `findLayer` hoặc gọi qua prepare với doc giả). Lib: Tự trở không còn `rowTolerance` (grep), và `dcKtsPairSourceRecords` được gọi trong `_dcDanCore` và trong Tự trở (grep số lần ≥ 3).
- [ ] **Step 2: Chạy** — FAIL.
- [ ] **Step 3: Sửa.**
- [ ] **Step 4: Chạy test + cả bộ** — PASS.
- [ ] **Step 5: Commit** `Ghép cặp trước/sau theo hàng dùng chung cho Tự trở, Dàn Card, Dàn bế 1 mặt (N5)`.

### Task 6: Tờ mới né cả bài cũ trên canvas (N4)

**Files:**
- Modify: `DanCardCEP/jsx/dan_card_lib.jsx` (hàm chung mới; KTS ~5860–5883; Tự trở ~7116–7137; Tự trở nhiều khổ ~8192–8208)
- Modify: `DanCardCEP/jsx/dan_be_bridge.jsx` (render: `boards` truyền vào `dcDanBeOutputPositions` ~1098)
- Test: `tests/canvas_old_artwork.test.js`

**Interfaces:**
- Lib toàn cục: `function dcVungBaiCu(doc, canvasRect, skipItems)` → mảng `[l,t,r,b]` của mọi pageItem cấp trên cùng (mọi layer, kể cả khoá/ẩn layer thì bỏ qua layer ẩn, lấy layer khoá) có `geometricBounds`, trừ item trong `skipItems` (so `===`/`uuid`) và trừ item phủ ≥ 92 % canvas. Ba lệnh KTS/Tự trở: `occupiedRects = occupiedRects.concat(dcVungBaiCu(doc, canvasRect, sourceItems))` ngay sau khi gom artboard, trước khi thêm `sourceBounds`.
- Bridge: hàm cục bộ `oldArtworkRects(skipItems)` cùng quy tắc (bridge không phụ thuộc lib), nối vào `boards` trước `dcDanBeOutputPositions`.

- [ ] **Step 1: Viết test** — dùng `illustrator()` + `c.dcDanToiUu("33","35.4",false,false)` 3 lượt liên tiếp trên cùng doc (mỗi lượt xoá khung cũ như hiện tại): tờ lượt 3 không chồng khung bao bài lượt 1 (`rectsOverlap` độc lập trong test); bài cũ `removed === false`. Bridge: `dcDanBeOutputPositions` với `boards` chứa rect bài cũ → tờ mới không chồng (đã có helper trong `dan_be_canvas.test.js`).
- [ ] **Step 2: Chạy** — FAIL (lượt 3 đè bài lượt 1).
- [ ] **Step 3: Sửa.**
- [ ] **Step 4: Chạy test + cả bộ** — PASS.
- [ ] **Step 5: Commit** `Tờ mới né cả bài cũ còn trên canvas (N4)`.

### Task 7: OK/ERR đúng trạng thái (Q4, Q5, Q6, Q2)

**Files:**
- Modify: `DanCardCEP/jsx/dan_card_lib.jsx` (CTL ~19292–19385, Keo gáy ~22656–22669; Dàn Card `dlg.show()` ~895, `num` ~898, `G` ~905, các `warn(...); return;` trong `_dcDanCore` và nhánh voucher; Clip header ~28014–28069)
- Modify: `DanCardCEP/index.html:248-251`
- Test: `tests/ket_qua_ok_err.test.js`

**Interfaces:**
- CTL/Keo gáy: mỗi `alert(msg); return "OK: (dừng)";` → `return "ERR: " + msg;` (bỏ `alert`, giữ `OK: (bỏ qua)` khi huỷ hộp thoại).
- Dàn Card: `if (dlg.show() !== 1) return "OK: Đã hủy, chưa thay đổi gì.";` `num(t, d)` nhận `"9,2"` (thay `,` → `.`); khi layout có `blockGap` và ô nhập khác giá trị đó → nối vào `doneMsg` `" Khe giữa khối theo layout: X mm (ô nhập bị bỏ qua)."`; mọi `warn(x); return;` trong `_dcDanCore` → `warn(x); return "ERR: " + x;`.
- Clip header: đếm riêng `clippedCount`/`keptCount` (clip group sẵn có giữ nguyên) → `"Đã clip A object thành W x H cm; B object đã có clip, giữ nguyên."`.
- `index.html` hint KTS: `"Khi ghép nhiều khổ: mẫu đã dàn được xóa khỏi nguồn, mẫu chưa dàn được giữ lại."`

- [ ] **Step 1: Viết test** — grep lib: không còn `"OK: (dừng)"`; cắt `num` → `num("9,2", 0) === 9.2`; `dcDan` với `Window` giả trả 0 (huỷ) → `"OK: Đã hủy, chưa thay đổi gì."`; `index.html` chứa câu hint mới; `panel_copy` nếu hash chữ đổi.
- [ ] **Step 2: Chạy** — FAIL.
- [ ] **Step 3: Sửa.**
- [ ] **Step 4: Chạy test + cả bộ** — PASS.
- [ ] **Step 5: Commit** `Trả ERR đúng lúc lỗi, OK đúng lúc xong (Q4, Q5, Q6, Q2)`.

### Task 8: Phát hành v2.19.0

**Files:**
- Modify: `DanCardCEP/CSXS/manifest.xml`, `DanCardCEP/index.html` (phiên bản), `DanCardCEP/LICH_SU_CAP_NHAT.md`, `README.md`, `docs/SOAT_MA_2026-10-22.md` (đánh dấu mục đã sửa), `online/latest.json`, `online/DanCardCEP-2.19.0.zip`
- Create: `DanCardCEP/assets/icon.ai` (anh Lộc chép từ Downloads; thiếu thì vẫn phát hành, tool bỏ qua icon)

- [ ] **Step 1: LICH_SU v2.19.0** — mỗi mục sửa một dòng, có cách dùng tuỳ chọn Transform. README: Raster 500 ppi, nút Resize, cấu trúc có `dan_be_zones.js`/`ctl_package.js`, bỏ `PhatHanhCapNhat.bat`; bỏ dòng "Chỉ cài local…", "PHÁT HÀNH SAU TEST".
- [ ] **Step 2: Chạy cả bộ test** — PASS, `panel_copy` khớp.
- [ ] **Step 3: Build** `python3 -I <scratchpad>/mix/build_release.py /home/claude/repo 2.19.0 "Sửa theo soát mã, đo khổ theo Transform" <desc-file>`; commit `Release v2.19.0: …`; **chưa** merge/push cho tới khi anh Lộc test trong Illustrator.
- [ ] **Step 4: Chép về máy anh Lộc** (`C:\Users\ADMIN\Downloads\DanCard_Setup_23`), nhắc: `CaiThuTaiMay.bat` → mở lại Illustrator → thử Dàn Card/KTS/CTL với file thật, chép `icon.ai` vào `DanCardCEP\assets\`; đạt thì push main + `HoanTatPhatHanh.bat`.
