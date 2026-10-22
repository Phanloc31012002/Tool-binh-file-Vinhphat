# CTL Offset theo khung Transform — thiết kế (22/10/2026)

> **Trạng thái 22/10 15:54:** chỉ làm mục 1 (không raster, đo Transform) — đã giao bản thử. Mục 2 (họ A6,
> lớp khổ theo vừa tờ) và mục 3 (khổ ngang) **huỷ** theo anh Lộc: "ko cần làm a6 và ngang đâu".

Yêu cầu của anh Lộc (chat 22/10, 14:49–15:25), gộp ba việc trên cùng hai lệnh **Đóng ghim giữa**
(`dcRunSignature8`) và **Keo gáy** (`dcRunKeoGay`) của tab CTL Offset, cộng Catalogue dùng chung
bước chuẩn bị trang:

1. **Không raster trước khi dàn.** Trang ruột/bìa được đặt lên tờ **nguyên vector**, đo và canh
   bằng **khung Transform** của Illustrator (`dcKhungThanhPham`), không phụ thuộc tick "Transform".
   Nút Raster ở header vẫn còn để ai cần thì raster tay; Dàn Card giữ bước tự sửa khổ (chỉ chạy
   khi object sai khổ) vì không phải "raster trước khi dàn".
2. **Nhiều loại kích thước, thêm họ A6 và nhỏ hơn A6.** Họ khổ chọn theo "trang có vừa mọi form
   của họ đó không" (thử A6 → A5 → A4), thay ngưỡng cố định `≤150 × 211,5`. Trang nhỏ hơn A6
   dùng form A6 (ô theo đúng khổ trang, chỉ dư lề).
3. **Khổ ngang** (trang rộng hơn cao, gáy ở cạnh ngắn): giữ nguyên tờ, số trang/tờ và ô của họ
   khổ; cặp trang xoay cho đúng gáy. Bỏ cách cũ xoay trang ngang thành đứng (cách đó chỉ để tha
   thứ việc nhập 21,15 × 15 thay 15 × 21,15; nay nhập rộng > cao nghĩa là sách ngang thật).

Anh Lộc duyệt phương án mặc định cho ba câu hỏi mở (15:22 "xuất thử đi nhé để test"): A6 ruột
AB = 4 tay 16 (64 trang/tờ); khổ ngang theo quy tắc ở mục 3; chỉ bốn khổ tờ hiện có của xưởng.
Kết quả xuất bản thử vào `DanCard_Setup_23`, chưa push, anh test rồi mới quyết.

## Hiện trạng (đọc code 22/10)

- Hai họ: `IS_SMALL_A5 = cạnh ngắn ≤ 150 && cạnh dài ≤ 211,5` → họ A5; còn lại họ A4 (Keo gáy
  thêm trần `212 × 300`). Không có mốc dưới: trang 10 × 13 chạy form A5 với lề rất rộng.
- Đóng ghim: `formSpec(type)` là nguồn duy nhất cho 5 form (SMALL4, SMALL8, SMALL16/SMALLAB,
  TT4, TT8/AB): `cols/rows/rotated/gutter/rowGap/sheet/anchor/trimCut/pon/midAxis/rowSeam/
  cornerLegs/pageAxes`. `nominalGridFor` dựng lưới, PON giấy/PON cắt sinh từ lưới — **không còn
  import file PON**. Bộ chia form: A5 theo dư mod 32 (`smallOrder`), A4 mod 16 (`ttOrder`).
  Đặt bài: `placeFace4` (2 cặp xoay ±90), `placeFace8` (2 hàng, hàng trên xoay 180),
  `placeSmallFace16` (2 panel 4×2 xoay ±90). Bóp 1 mm/tờ theo trục vuông góc gáy.
- Keo gáy: `dcKeoGayPlan(N, smallA5)` + 4 khổ giấy (`ponAB 858×625`, `ponMain 858×638`,
  `ponTT4 648×418`, `ponSmall4 428×313`), khối SIG16 `dcKeoGayPackedGrid`, thu về cạnh 20,9 trên
  tờ nhỏ (`dcKeoGayFrameForPaper`).
- Chuẩn bị trang (cả CTL, Keo gáy, 5 lệnh Catalogue): đo `sizeMM` → `dcFlattenForImposition`
  (raster 500 ppi) → `resize`/`transform` về khổ nhập. Vị trí/canh giữa đọc `geometricBounds`
  của raster.

## Thiết kế

### 1. Chuẩn bị trang không raster, đo theo Transform

Hàm chung mới (khối "ĐO KHỔ DÙNG CHUNG" đầu lib):

```
dcChuanBiTrangDan(doc, item, rongMm, caoMm) → item
```
- Khung = `dcKhungThanhPham(item)`; không đo được → throw "Trang N: không đo được khung Transform".
- Phóng về khổ nhập bằng `item.transform(app.getScaleMatrix(sx, sy), true, true, true, true, 100,
  Transformation.CENTER)` theo trục tài liệu (như Keo gáy đang làm), **nét co giãn theo** (tham số
  changeLineWidths = trung bình sx, sy) để trang phóng 2× không bị nét mảnh. Khung đã đúng khổ
  (lệch ≤ 0,05 mm) thì không đụng. Trả về chính object; không tạo RasterItem.
- Mọi phép đo trong `dcRunSignature8`, `dcRunKeoGay`, 5 lệnh Catalogue (`sizeMM`, `centerAt`,
  `centerItem`, `buildPairGroup`, `squeezeAboutCentre`, `centerGroupAt`, kiểm khổ) đi qua
  `dcKhungThanhPham(x) || geometricBounds` — không còn `visibleBounds`/`clipMaskBounds` của riêng
  lệnh. Lý do: group đã clip trong Illustrator có `geometricBounds` gộp cả phần bị che.
- `dcFlattenForImposition` chỉ còn được gọi ở Dàn Card tự sửa khổ (nếu có) — test khẳng định
  không còn lời gọi trong ba nhóm lệnh trên.
- Tick "Transform" ở header: **mặc định BẬT** (vẫn tắt được để so sánh). CTL/Keo gáy/Catalogue/
  Clip/Auto Save không đọc tick nữa.

### 2. Lớp khổ (size class) thay cờ `IS_SMALL_A5`

```
dcCtlLopKho(rongMm, caoMm) → { ten: "A6"|"A5"|"A4", ngang: bool, forms: {...}, sucChua: 64|32|16,
                               lyDoBo: ["A6: tờ 42,8 × 31,3 thiếu ngang 12 mm", ...] }
```
- Thử theo thứ tự A6 → A5 → A4. Một họ **đạt** khi mọi form của họ (bìa, các tự trở, AB) dựng
  được lưới danh định không tràn tờ (dùng đúng phép tính `nominalGridFor` không kèm rect, dung sai
  0,5 mm, có cả `trimCut` của SMALL8). Không họ nào đạt → `ERR` liệt kê từng họ thiếu bao nhiêu mm
  ở tờ nào (ví dụ 15,2 × 21,5: "A5: tờ 85,8 × 62,5 thiếu ngang 2,2 mm" → chạy A4).
- Giữ nguyên tên form A4/A5 hiện có (TT4, TT8, AB, SMALL4, SMALL8, SMALL16, SMALLAB) để nút
  "Lưu AI/JPG/ZIP theo khổ" (`dcCtlOffsetPdfPlan`, `ctl_package.js`) và test cũ không đổi.
- `IS_SMALL_A5` chỉ còn là bí danh `LOP.ten === "A5"` cho vài câu chữ.

### 3. Họ A6 (và nhỏ hơn A6)

Form mới trong `formSpec`, cùng từ vựng cũ; PON theo tờ (`small` cho 428/648, `large` cho 858):

| Form | Tờ (mm) | cols×rows | rotated | gutter | rowGap | anchor | Trang/tờ |
|---|---|---|---|---|---|---|---|
| `A6_4` (bìa/TT4, như SMALL4) | 428 × 313 | 2×2 | true | 5 | 0 | bottom | 4 tự trở |
| `A6_8` (TT8, như SMALL8) | 648 × 418 | 4×2 | false | 8 | 0 | bottom | 8 tự trở |
| `A6_16` (TT16, như SMALL16) | 858 × 638 | 4×4 | true | 6 | 15 | bottom | 16 tự trở |
| `A6_AB` | 858 × 625 | 8×4 | false | 6 | 15 | bottom | **64** = 4 khối 4×2 |

Kiểm số với A6 chuẩn 105 × 148: `A6_4` 2·148+5 = 301 × 2·105 = 210 trong 428 × 313 ✓; `A6_8`
4·105+8 = 428 × 2·148 = 296 trong 648 × 418 ✓ (tờ 428 × 313 không chứa 4 cột, dùng tờ của SMALL8);
`A6_16` 4·148+6 = 598 × 4·105+15 = 435 trong 858 × 638 ✓; `A6_AB` 8·105+6 = 846 × 4·148+15 = 607
trong 858 × 625 ✓. Khối 4×2 không xoay của `A6_AB` chính là khối 2×4 xoay của SMALLAB nhìn theo
chiều kia (2 cặp × 2 hàng cặp), nên bộ đặt khối dùng chung với khổ ngang (mục 4).
Allowance của họ A6 do chính phép "vừa tờ" quyết định: trang 10,7 × 15 cần 862 mm ngang ở `A6_AB`
→ không vừa → rơi về A5, thông báo nêu lý do.
- Bộ chia: tổng quát hoá `smallOrder`/`ttOrder` thành "dư r (mod sức chứa) chia thành các form
  tự trở của họ, nhỏ trước, rồi AB": họ A6 sức chứa 64, form tự trở [4, 8, 16]; dư 32/48/… dùng
  nhiều lượt TT16 (máy gấp vẫn tay 16).
- Đặt bài: `placeSmallFace16` tổng quát thành `placePanels(face, pos, soKhoi)`: khối 4×2 xoay ±90
  (hoặc không xoay với họ A6 AB), vị trí theo lưới `nominalGridFor` (không hằng số riêng).
- Trang nhỏ hơn A6: cùng form A6, ô = khổ trang → chỉ dư lề. Không thêm họ A7.

### 4. Khổ ngang

Trang nhập `rộng > cao` → `LOP.ngang = true`. Với mỗi form của họ, lưới ngang = lưới đứng **chuyển
vị**: `rotated' = !rotated`, `gutter' = rowGap`, `rowGap' = gutter` (khe nằm giữa các CẶP TRANG vẫn
nằm giữa các cặp), cols/rows giữ nguyên, tờ giữ nguyên. Ô giữ đúng footprint (cạnh dài của trang
vẫn nằm theo trục cũ của tờ), nên số trang/tờ không đổi; chỉ hướng gáy đổi.
- Ví dụ A5 ngang 21 × 14,8: SMALL4 → 2 cặp xếp chồng trên 42,8 × 31,3 (420 × 301); SMALL8 →
  4 cặp dựng trên 64,8 × 41,8 (600 × 420, trimCut như cũ); SMALL16/AB → 4×4 ô không xoay, khe
  15 dọc giữa hai nửa cột, 6 ngang giữa hai nửa hàng (855 × 598).
- Đặt bài: cặp trang (2 trang chung gáy) là đơn vị. Cặp dựng (ô xoay) → xoay ±90 xen kẽ theo cột;
  cặp nằm (ô không xoay) → 0/180 xen kẽ theo hàng. Thứ tự trang trong cặp không đổi.
- Bóp: luôn theo trục vuông góc gáy của cặp, suy từ `rotated'`.
- PON cắt: `rowSeam`/`pageAxes`/`midAxis` suy từ vị trí cặp (đường giữa hai cặp = cắt, đường
  giữa hai trang của một cặp = gấp). Với họ đứng kết quả phải bằng đúng cờ hiện có (test).
- Không vừa tờ (ví dụ A4 ngang 30 × 20,9 trên 64,8 × 41,8 cần 425,6 > 418) → lỗi "quá lớn" nói rõ;
  không tự đổi tờ.
- Keo gáy: cùng quy tắc chuyển vị cho `dcKeoGayPackedGrid` và TT4/TT8.

### 5. Panel

- Nhãn nút Lưu theo khổ cho form A6 trong `ctl_package.js`; hint tab CTL nêu A6 64 trang/tờ và khổ
  ngang. Không thêm ô nhập mới.

## Kiểm thử

- **Mốc hình học (golden)** trước khi sửa: với mock Illustrator đã có trong `ctl_a5_geometry`,
  `ctl_geometry`, `keo_gay_a5`, ghi lại danh sách face + lưới (`nominalGridFor`) + vị trí đặt của
  A4 20,9 × 30 (bìa, 4/8/16 trang) và A5 14,8 × 21 (4/8/16/32) → file JSON trong `tests/fixtures/`;
  sau sửa phải khớp từng số (0,01 mm).
- Mới: `ctl_lop_kho` (chọn họ theo vừa tờ, thông báo lý do, 15,2 × 21,5 → A4), `ctl_a6_plan`
  (chia form 64/tờ, dư 4…60), `ctl_ngang_grid` (lưới chuyển vị, cờ PON, bóp), `ctl_khong_raster`
  (không gọi `dcFlattenForImposition`; đo qua `dcKhungThanhPham`; group clip có nội dung tràn vẫn
  canh đúng tâm khung), tick Transform mặc định bật.
- Sửa test cũ pin hành vi cũ: `ctl_a5_geometry` (dòng regex `SMALL_SOURCE_IS_LANDSCAPE`),
  `do_khung_transform` ("mặc định tắt"), `keo_gay_a5` (trần 21,2 × 30 → thông báo theo tờ).

## Giao theo giai đoạn (mỗi giai đoạn chép vào thư mục anh Lộc để xuất thử)

1. **GĐ1** — không raster + đo Transform trong CTL/Keo gáy/Catalogue; tick mặc định bật.
2. **GĐ2** — lớp khổ theo vừa tờ + họ A6.
3. **GĐ3** — khổ ngang.

## Rủi ro

- Vector không raster: trang có hiệu ứng/nét tràn ngoài khung Transform sẽ in tràn sang trang kề
  (raster trước đây cắt theo khung). Cách dùng: Clip theo khung Transform trước (nút Clip mới).
- Phóng vector không đồng đều (sx ≠ sy) làm méo chữ; giữ như cũ nhưng báo trong kết quả khi
  |sx − sy| > 0,5 %.
- Form A6 chưa từng chạy ở xưởng: anh Lộc kiểm số trên bản kẽm trước khi in thật.
