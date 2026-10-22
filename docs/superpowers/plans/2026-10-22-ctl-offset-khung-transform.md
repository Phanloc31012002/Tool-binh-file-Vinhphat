# Kế hoạch: CTL Offset theo khung Transform (3 giai đoạn)

Thiết kế: `docs/superpowers/specs/2026-10-22-ctl-offset-khung-transform-design.md`. Mỗi giai đoạn:
test đỏ → sửa → xanh → chạy bộ test liên quan → commit local (chưa push) → chép file đổi vào
`C:\Users\ADMIN\Downloads\DanCard_Setup_23` → báo anh Lộc xuất thử.

## GĐ0 — Mốc hình học (trước khi đụng code dàn)

- [x] `tests/ctl_golden.test.js`: dùng mock Illustrator sẵn có của `ctl_a5_geometry`/`ctl_geometry`/
  `keo_gay_a5` để ghi `faces` (type/label/row/top/bottom/leftFace/rightFace/sheetNo) + lưới
  `nominalGridFor` (cellW/H, content, gridLeft/Top/Bottom, colLines, rowLines) cho:
  Đóng ghim A4 20,9 × 30 (bìa + 12/16/32 trang), A5 14,8 × 21 (bìa + 4/8/16/32/60 trang);
  Keo gáy `dcKeoGayPlan` 16…256 A4/A5. Lần đầu ghi `tests/fixtures/ctl_golden.json`; lần sau so khớp
  0,01 mm. Commit fixture cùng test.

## GĐ1 — Không raster, đo Transform, tick mặc định bật

- [x] Lib: `dcChuanBiTrangDan(doc, item, rongMm, caoMm)` trong khối "ĐO KHỔ DÙNG CHUNG" (+ test đơn
  vị với mock `transform`/`getScaleMatrix`: đúng khổ → không đụng; sai khổ → ma trận đúng; không đo
  được → throw).
- [x] Đóng ghim: `prepareSignaturePages` dùng hàm mới; `sizeMM`/`centerAt`/`centerItem`/
  `buildPairGroup`/`centerGroupAt`/`squeezeAboutCentre`/`groupPages` đo bằng `dcKhungThanhPham`;
  bỏ `clipMaskBounds`/`visibleUnion` riêng; bỏ `flat.rotate(90)` chỉ khi GĐ3 (GĐ1 giữ swap cũ).
- [x] Keo gáy: `prepareKeoGayPages` không flatten; `sizeMM` → Transform.
- [x] Catalogue (5 chỗ 16560/17351/18211/18948/19521): thay flatten+resize bằng hàm mới.
- [x] `tests/ctl_khong_raster.test.js`: ba nhóm lệnh không chứa `dcFlattenForImposition(`;
  `dcFlattenForImposition` chỉ còn định nghĩa (+ Dàn Card nếu có); mock chạy `prepareSignaturePages`
  với group clip có nội dung tràn → tâm đặt = tâm khung Transform.
- [x] Panel: `hdrTransform` mặc định bật (`checked`, localStorage mặc định true); sửa
  `do_khung_transform` ("mặc định tắt" → bật) và hint tooltip.
- [x] Nâng `dcSignature8AutoPonVersion`, `dcKeoGayAutoPonVersion`, `dcCatalogueAutoVersion` +
  ngưỡng main.js; `jsx_versions`; `LICH_SU_CAP_NHAT`; `panel_copy` hash.
- [x] Chạy: ctl_golden, ctl_khong_raster, ctl_geometry, ctl_a5_geometry, ctl_a5_notes,
  ctl_canvas_origin, keo_gay_a5, catalogue*, do_khung_transform, jsx_versions, panel_copy.

## GĐ2 — Lớp khổ theo vừa tờ + họ A6 — **HUỶ** (anh Lộc 22/10 15:54: "ko cần làm a6 và ngang đâu")

- [ ] `dcCtlLopKho(w, h)` (lib, dùng chung Đóng ghim/Keo gáy) + `tests/ctl_lop_kho.test.js`
  (14,8 × 21 → A5; 20,9 × 30 → A4; 10,5 × 14,8 → A6; 9 × 13 → A6; 15,2 × 21,5 → A4 kèm lý do A5;
  60 × 80 → ERR).
- [ ] `formSpec` thêm `A6_4/A6_8/A6_16/A6_AB`; bộ chia tổng quát `chiaForm(nRuot, lop)` thay hai
  nhánh; `placePanels` thay `placeSmallFace16` (SMALLAB = 2 khối xoay; A6_AB = 4 khối không xoay);
  `solo`, ghi chú, alert theo `lop`.
- [ ] Keo gáy: `dcKeoGayPlan(N, lop)` sức chứa 16/32/64, khối = sức chứa/16; `ponFor`,
  `dcKeoGayFrameForPaper`, thông báo theo tờ.
- [ ] `ctl_package.js` nhãn form A6; hint tab CTL.
- [ ] `tests/ctl_a6_plan.test.js`; golden A4/A5 vẫn khớp.

## GĐ3 — Khổ ngang — **HUỶ** (cùng lý do)

- [ ] `formSpec(type, ngang)` chuyển vị (rotated/gutter↔rowGap); bỏ `SMALL_SOURCE_IS_LANDSCAPE`
  (sửa regex `ctl_a5_geometry`).
- [ ] Bộ đặt theo cặp trang: cặp dựng ±90 theo cột, cặp nằm 0/180 theo hàng; bóp theo trục gáy;
  cờ PON cắt suy từ cặp (họ đứng phải ra đúng cờ cũ — test).
- [ ] Keo gáy chuyển vị tương ứng.
- [ ] `tests/ctl_ngang_grid.test.js`; golden vẫn khớp.
