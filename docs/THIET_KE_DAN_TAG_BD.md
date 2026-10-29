# Thiết kế: tab Dàn tag BD (v2.20.0 — đã làm, chờ anh Lộc test trong Illustrator)

_Chốt với anh Lộc chiều 22/10/2026 (hướng 1 — tối ưu toàn bộ) · yêu cầu gốc của anh hai (xưởng Bình Dương) ·
mẫu đối chiếu: 5 file PDF `1088 - 29…33 - … hop … - cm - 17.pdf` anh Lộc gửi._

## 1. Mục tiêu

Xưởng Bình Dương in card ghép chung tờ: **mỗi ô = một card 9,2 × 5,6 cm đã tràn** (56 × 92 mm). Tag (thẻ treo)
nhiều khổ khác nhau được **ghép thành khối** đúng bội số ô card để thả vào tờ card. Anh hai đang bình tay hằng ngày.

Tab mới **Dàn tag BD** làm ba việc:

1. Nhận tag đã tràn đang chọn trong Illustrator kèm **số lượng** (500 hoặc bội của 1000).
2. **Ghép khối tối ưu**: tổng số ô card ít nhất có thể, mọi nhát cắt là nhát thẳng xuyên suốt (dao công nghiệp hạ
   được), khe 0 mm, xoay tuỳ ý (0°/90°).
3. Đóng **artboard trước/sau** cho từng khối để người bình kiểm tra, rồi **xuất PDF 2 trang** đặt tên như Auto Save.

Ngoài phạm vi: bình khối vào tờ 64,4 × 100,8 (anh hai tự thả), số lượng lẻ ngoài 500/bội 1000, tag khổ lớn hơn tờ.

## 2. Luật nghiệp vụ (đã chốt)

| Việc | Luật |
|---|---|
| Ô card | 56 × 92 mm **đã tràn** (anh Lộc: "9.2x5.6 là card đã tràn, cũng là kt tối đa của 1 con card"). |
| Khối | `a` ô theo cạnh 56 × `b` ô theo cạnh 92 → **khổ đã tràn 56a × 92b mm = khổ artboard** (anh Lộc: "artboard kt đã tràn luôn"). Tờ 644 × 1008 = 7 × 92 by 18 × 56 nên `a ≤ 18`, `b ≤ 7`. Tên file ghi khổ trừ 2 mm: 112 × 460 → "110 x 458" (đúng 5 file mẫu). |
| Khổ tag | Khổ đã tràn, đo theo **khung Transform** (`dcKhungThanhPham`), như mọi lệnh khác từ v2.19. |
| Mặt | Hàng có 2 object: trái = trước, phải = sau. Hàng chỉ có cột trái: tag 1 mặt (mặt sau để trống). Luật y như Auto Save. |
| Số lượng | `500` → **bài 500**, 1 vị trí. `k × 1000` → **bài 1000**, `k` vị trí (2000 = 2 con, 10 000 = 10 con). Số khác → lỗi "Số lượng phải là 500 hoặc bội của 1000". Hai bài **không bao giờ chung khối**. |
| Khe | 0 mm giữa các tag trong khối (anh Lộc: "0mm luôn"). |
| Xoay | 0° hoặc 90°, tuỳ tool. Mặt sau xoay ngược (`-góc`), vị trí lật ngang — đúng quy ước KTS / Dàn bế 2 mặt. |
| Dấu cắt | Nét đen 3 mm, 0,5 pt, nằm **trên đường cắt**, ở hai đầu mỗi nhát cắt, hướng vào trong (đúng kiểu file mẫu: `x 0..2,76 tại y = 91`). Mặt sau lật ngang theo. |
| Tối ưu | **Ít ô nhất** là tiêu chí số 1. Bằng ô: ít khối hơn → ít nhát cắt hơn → nhiều cặp con cùng tag kề nhau hơn. |
| Chứng nhận | `cận dưới = ceil(Σ diện tích tag / (56 × 92))`. Bằng cận dưới → "N/N ô — không thể ít hơn". Lớn hơn → "N ô, tối thiểu lý thuyết M" (không nhận bừa là tối ưu tuyệt đối). |
| Tên PDF | `<Mã> - <STT> - <hộp> hop <W-2> x <H-2>[ - ghi chú] - <cm/km> - <ngày>.pdf` (đúng 5 file mẫu: "50 hop 110 x 458"); **hộp = 10 cho bài 1000, 5 cho bài 500** (tool đã nhân số con trong khối). |
| Nguồn | Không sửa, không xoá tag gốc. Artboard cũ giữ nguyên (bài 500 dàn trước, bài 1000 dàn sau, cùng nằm trên canvas). |

## 3. Panel (tab "Dàn tag BD", `data-tab="tagbd"`, `id="pane-tagbd"`)

```
Chọn tag đã tràn: trái = trước, phải = sau; hàng 1 object = tag 1 mặt.
Số lượng [1000]   [Thêm vào danh sách]
┌ Danh sách ───────────────────────────────┐
│ # │ Khổ (mm)   │ Mặt │ SL    │ Bài  │ Con │ ✕ │
│ 1 │ 112 × 72   │ 2   │ 2000  │ 1000 │ 2   │ ✕ │
│ Bài 500: 2 tag · Bài 1000: 3 tag = 6 con    │
└──────────────────────────────────────────┘
[Xoá danh sách]        [Dàn tag]
(ô kết quả: "Đang suy nghĩ… x/y" → "OK: Bài 1000: 1 khối 2 × 5 ô (112 × 460), 10/10 ô — không thể ít hơn…")
── Xuất PDF (hiện khi tài liệu có artboard "TagBD") ──
Mã [1088]  STT bắt đầu [1]  Đệm số 0 [2]
Cán màng [cm ▾]  Ngày đặt in [22]
Thư mục lưu [            ] [Chọn…]
Xem trước: 1088 - 01 - 10 hop 110 x 458 - cm - 22.pdf
[Xuất PDF các khối]
```

- **Thêm vào danh sách**: đọc selection (JSX `dcDanTagBdDocTag`), ghép hàng trước/sau, đo khổ, đăng ký object vào
  bảng nguồn trong engine ExtendScript (`dcDanTagBdNguon[id]`), trả JSON về panel; panel ghi `{id, w, h, twoSided,
  qty}` vào danh sách (giữ trong bộ nhớ panel, không ghi file). Số lượng sai → báo đỏ, không thêm.
- Mỗi dòng có nút ✕ để bỏ. **Xoá danh sách** xoá hết.
- **Dàn tag**: panel gọi lõi `DanTagBd.pack` (JS, chạy trong Chromium của CEP, có tiến độ "Đang suy nghĩ… x/y"),
  rồi gọi JSX `dcDanTagBdVe(json)` để đóng artboard. Xong thì **xoá danh sách** (đã tiêu thụ) và hiện khối Xuất PDF.
- **Xuất PDF các khối**: JSX `dcDanTagBdXuatPdf(json)` tìm mọi cặp artboard tên `TagBD <k> - … - truoc/sau`, xuất mỗi
  cặp một PDF 2 trang. STT tăng theo thứ tự `k`. File trùng tên/đã tồn tại → lỗi trước khi xuất file nào.
- Mọi chữ tiếng Việt có dấu; kết quả `OK:` / `ERR:` như các tab khác.

## 4. Lõi ghép khối — `DanCardCEP/js/dan_tag_bd.js` (`window.DanTagBd`, Node `module.exports`)

### 4.1 Vào / ra

```
pack({ tags: [{ id, w, h, qty, name }], budgetMs? })
→ { ok: true, jobs: [ { bai, hop, blocks: [ { cols, rows, w, h, cells, places: [{ id, copy, x, y, w, h, rot }],
                                              cuts: [{ axis, at, from, to }] } ],
                        cells, lowerBound, proven } ],
     detail }   hoặc { ok: false, error }
```

- `w, h` mm đã tràn; `qty` 500 hoặc bội 1000. `x, y` tính từ góc trên trái khối, `rot` 0 hoặc 90 (sau khi xoay,
  `w, h` là khổ đã xoay). `cuts`: `axis` "V" (nhát dọc tại x = `at`, chạy y `from..to`) hoặc "H".
- Hằng: `CELL_W = 56`, `CELL_H = 92`, `MAX_COLS = 18`, `MAX_ROWS = 7`, `EPS = 0.01` mm.

### 4.2 Thuật toán (hướng 1 — tối ưu toàn bộ)

1. **Tách bài**: bài 500 ← tag `qty = 500` (1 con); bài 1000 ← tag `qty = k·1000` (`k` con). Mỗi bài một bài toán
   độc lập.
2. **Cận dưới** `LB = ceil(Σ w·h / 5152 − 1e-9)`. Tag không lọt bất kỳ khối hợp lệ nào (kể cả xoay) → lỗi rõ.
3. **Một khối**: duyệt mọi khổ khối `(a, b)` theo số ô tăng dần (bằng ô thì khối "vuông" hơn trước); với mỗi khổ
   chạy **bộ xếp guillotine**; khổ đầu tiên xếp được cho `T1` ô.
4. **Nhiều khối** (chỉ khi `T1 > LB`): với tổng ô `T` từ `LB` tới `T1 − 1`, thử chia thành 2 khối (3 khối khi số
   loại tag ≤ 6): phân hoạch theo **loại tag** (mọi con cùng tag về cùng khối) và các cách chia tham lam (xếp đầy
   khối 1 theo diện tích giảm dần, phần còn lại sang khối 2, kể cả tách con cùng tag). Mỗi phần phải xếp được vào
   một khổ có số ô bằng phần tương ứng của `T`. Có kết quả ở `T` nhỏ nhất thì dừng.
5. **Bộ xếp guillotine** (`packInto(pieces, W, H)`): DFS trên danh sách hình chữ nhật trống. Lấy hình trống đầu
   (dưới-trái), thử từng **loại** con còn lại (gộp con giống hệt) với 2 hướng xoay, đặt vào góc dưới-trái, chia
   phần còn lại theo 2 cách (dọc trước / ngang trước); nhánh cuối cùng là bỏ trống hình đó. Cắt tỉa: diện tích con
   còn lại > diện tích trống → quay lui; nhớ trạng thái đã thất bại (khoá = hình trống đã chuẩn hoá + số con còn lại
   từng loại). Thứ tự thử: con lớn trước, **cùng loại với con vừa đặt** trước (để con nhân bản nằm kề nhau). Ngân
   sách 40 000 nút mỗi lần gọi; hết ngân sách coi như "không xếp được trong giới hạn" (ghi vào `detail`).
6. **Chọn bố cục** khi bằng ô: ít khối → ít nhát cắt (đếm từ cây guillotine) → nhiều cặp kề nhau cùng tag. Bộ xếp
   thu tối đa 24 bố cục khác nhau cho khổ đã chọn rồi chấm.
7. **Nhát cắt**: sinh từ cây guillotine; bỏ nhát mà hai bên đều là chỗ trống. Nhát nào cũng chạy suốt hình chữ nhật
   cha của nó (dao thẳng hạ được).
8. **Kiểm độc lập** (`verify(job)`): mọi con nằm trong khối, không chồng nhau (khe ≥ 0), mỗi cạnh con không trùng
   mép khối phải nằm trên một nhát cắt, nhát cắt không xuyên qua con nào, đủ số con mỗi tag. Sai → loại phương án.
9. **Thời gian**: `budgetMs` mặc định 4000 (từ 29/10: 6000, xem 4.3); hết giờ thì trả phương án tốt nhất đang có và ghi rõ trong `detail`.
   `packAsync(input, onProgress, done)` chạy từng bước bằng `setTimeout` để panel hiện tiến độ; `pack` đồng bộ cho
   test. Cùng đầu vào → cùng kết quả (không ngẫu nhiên).

### 4.3 Cập nhật 29/10/2026 (lõi VERSION 5) — ca 20 tag ra 32 ô, bình tay 28 ô

Ca thật: 20 tag, mỗi tag 1000 (2 × 211 × 122, 102 × 52, 152 × 72, 54 × 54, 5 × 92 × 48, 8 × 92 × 52, 2 × 92 × 56).
Tool ra 1 khối 16 × 2 = 32 ô ("hết thời gian tìm 4 s"); anh Lộc bình tay 4 × 7 = 28 ô (644 × 224, bóp ≤ 1 mm).
Nguyên nhân và cách sửa:

1. **Xếp theo khổ, không theo tag.** 20 tag khác id nhưng chỉ 7 khổ; bộ xếp cũ coi mỗi tag là một loại nên thử lại
   cùng một bố cục cho mọi cách đổi chỗ hai tag cùng khổ → hết giờ. Giờ `packInto` gộp theo khổ, xếp xong mới gán
   tag thật vào chỗ (thứ tự đọc + thứ tự danh sách), góc xoay tính lại theo tag.
2. **Lấp hình trống nhỏ nhất trước** (thay vì trên-trái) và **khoá nhớ theo khổ hình trống** (bỏ toạ độ, w × h = h × w):
   các hình trống độc lập nên không mất bố cục nào, nhưng không còn dựng lại một bố cục theo hàng nghìn thứ tự.
3. **Chặn theo phần hao**: hình trống không con nào lọt bị bỏ (hao); phần phủ tối đa của hình = (tổng cạnh lớn
   nhất ≤ bề ngang) × (tổng cạnh lớn nhất ≤ chiều cao); còn con nhiều hơn phần phủ được → quay lui.
4. **Bóp mức 1 nhanh**: xếp mọi con ở khổ đã bớt 1 mm mỗi chiều, rồi "nở" về khổ thật theo cây cắt — chỗ trống
   hút trước, chỉ dãy thật sự thiếu mới bóp, chia theo sức co, mỗi con ≤ 1 mm. Một lần xếp thay cho hàng chục lần
   nới khối. Bóp mức 2 (cả cụm ăn thêm 1–2 mm) giữ cách cũ, chỉ thử khi khối ≤ 12 con.
5. **Pha bóp có giờ riêng, chạy sớm**: 1 khối nguyên khổ → 1 khối có bóp → nhiều khối nguyên khổ → nhiều khối có bóp;
   mỗi pha có hạn trong phần giờ của bài (30 % / 65 % / 82 % / 100 %), mỗi bài một phần giờ còn lại. `budgetMs`
   mặc định 6000.
6. **Ưu tiên không bóp**: so phương án theo ít ô → ít con bị bóp → ít khối → ít nhát cắt → ít xoay → nhiều cặp kề.
   Phương án bóp chỉ được nhận khi ít ô hơn thật phương án không bóp tốt nhất.

Kết quả ca thật: 1 khối 7 × 4 = 28 ô (392 × 368), 16 con bớt ≤ 1 mm, khoảng 1,5 s. Chạy so 50+ ca ngẫu nhiên với
lõi cũ: không ca nào nhiều ô hơn, nhiều ca ít ô hơn và nhanh hơn nhiều. Test: `tests/dan_tag_bd_engine.test.js` Phần 7.
Ngoài phạm vi: anh Lộc còn chồng tràn 2 mm giữa các tag cùng mẫu (cắt chung nét thành phẩm) — tool không làm vì
mất tràn giữa hai tag khác mẫu.

## 5. Cầu nối Illustrator — `DanCardCEP/jsx/dan_tag_bd_bridge.jsx` (`dcDanTagBdVersion = 1`)

- `dcDanTagBdDocTag()` → `OKJSON:{ tags: [{ id, w, h, twoSided, name }] }`. Gom hàng như Auto Save (cột trái/phải,
  dung sai 45 % chiều cao con thấp nhất, tối đa 2 object/hàng, object lẻ gần cột phải → lỗi). Khổ theo
  `dcKhungThanhPham` (dự phòng `clipMask`/`visibleBounds`). Đăng ký `dcDanTagBdNguon[id] = { front, back }`.
- `dcDanTagBdVe(planText)` → `OK:` / `ERR:`. Với mỗi khối: tìm chỗ trống trên canvas **dưới** mọi artboard hiện có
  (hàng mới, trái → phải, cách nhau 10 mm; cặp trước/sau cạnh nhau), tạo artboard `TagBD <k> - bai <500|1000> -
  <W-2> x <H-2> - truoc` và `… - sau`, layer `Tag BD <k> - trước/sau` (note `DANCARD_TAGBD_OUTPUT`), nhân bản tag
  theo `places` (xoay, dời theo khung Transform), mặt sau lật ngang + xoay ngược, tag 1 mặt để trống mặt sau, vẽ dấu
  cắt (note `DANCARD_TAGBD_MARK`). Lỗi giữa chừng → gỡ đúng artboard/layer vừa tạo, không đụng nguồn. `k` = số
  thứ tự tiếp theo sau các artboard TagBD đã có.
- `dcDanTagBdXuatPdf(optionsText)` → `OK: Đã lưu n/n PDF…`. Tìm cặp artboard theo tên; mỗi cặp một tài liệu tạm:
  nhân bản mọi object cấp trên cùng giao với artboard mặt trước sang trang 1, mặt sau sang trang 2 (đặt cách 20 mm),
  giữ đúng vị trí tương đối (đo trước/sau nhân bản từng object), `PDFSaveOptions` như Auto Save. Kiểm trùng tên và
  file đã tồn tại trước khi lưu file đầu tiên; lỗi một file thì xoá file dở dang đó và báo tiếp.
- `dcDanTagBdDemArtboard()` → số cặp TagBD trong tài liệu (panel dùng để hiện/ẩn khối Xuất PDF).

## 6. Kiểm thử

- `tests/dan_tag_bd_engine.test.js`: cận dưới; 1 tag 112 × 72 → khối 2 × 1 (2 ô) đúng ví dụ anh hai; 112 × 72 +
  92 × 40 → vẫn 2 ô; 2 × 5 ô mẫu file 31 (56 × 91 ×2 xoay, 112 × 71 ×2, 112 × 75 ×3) → ≤ 10 ô; 4 tag 112 × 72
  (4000) + 112 × 80 → 8 ô như file 32; số lượng sai → lỗi; tag lớn hơn tờ → lỗi; bài 500 và 1000 tách riêng; con
  nhân bản kề nhau; `verify` bắt bố cục chồng/không guillotine; cùng đầu vào chạy 2 lần ra cùng JSON; mỗi ca < 4 s.
- `tests/dan_tag_bd_bridge.test.js` (mock `illustrator_geometry_mock.js`): `dcDanTagBdDocTag` ghép hàng 2 mặt / 1
  mặt / lỗi; `dcDanTagBdVe` tạo đúng số artboard, khổ 56a × 92b, mặt sau lật ngang + xoay ngược, số dấu cắt, không
  xoá artboard cũ, lỗi giữa chừng gỡ sạch; `dcDanTagBdXuatPdf` đặt tên đúng mẫu `1088 - 01 - 10 hop 110 x 458 - cm
  - 22.pdf`, trùng tên → ERR trước khi lưu.
- `tests/dan_tag_bd_panel.test.js`: `index.html` có tab/pane/control; `main.js` nối nút; cập nhật snapshot
  `panel_copy.test.js`, `jsx_versions.test.js` (mốc `dcDanTagBdVersion`).
- Ảnh bố cục `tmp/tagbd_*.png` vẽ bằng Node (canvas thuần SVG → PNG) cho anh Lộc duyệt bằng mắt.
