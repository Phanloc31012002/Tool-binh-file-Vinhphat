# Công cụ bình — DanCard CEP Panel

Panel mở rộng (CEP extension) cho Adobe Illustrator, hỗ trợ dàn bình các loại
ấn phẩm in ấn: card, decal, catalogue, offset khổ lớn, đổi tên hàng loạt và
nhập dữ liệu biến (variable data).

## Yêu cầu

- Adobe Illustrator (hỗ trợ CS6 → 2026+, host `ILST`).
- Windows.

## Cài đặt

1. Trên trang GitHub này, bấm **Code > Download ZIP** (hoặc `git clone`) rồi
   giải nén ra một thư mục bất kỳ.
2. Đóng hẳn Adobe Illustrator nếu đang mở.
3. Bật chế độ debug cho extension bằng cách mở **PowerShell** hoặc
   **Command Prompt** và chạy lần lượt (copy đúng như dưới, chỉ cần chạy 1
   lần cho mỗi máy):

   ```bat
   reg add "HKCU\Software\Adobe\CSXS.9"  /v PlayerDebugMode /t REG_SZ /d 1 /f
   reg add "HKCU\Software\Adobe\CSXS.10" /v PlayerDebugMode /t REG_SZ /d 1 /f
   reg add "HKCU\Software\Adobe\CSXS.11" /v PlayerDebugMode /t REG_SZ /d 1 /f
   reg add "HKCU\Software\Adobe\CSXS.12" /v PlayerDebugMode /t REG_SZ /d 1 /f
   ```

4. Copy toàn bộ thư mục `DanCardCEP` (đã giải nén ở bước 1) vào:

   ```
   %APPDATA%\Adobe\CEP\extensions\DanCardCEP
   ```

   (Dán đường dẫn trên vào thanh địa chỉ File Explorer để đi tới đúng chỗ.)
5. Mở Illustrator: **Window > Extensions > Công cụ bình**.

> Nếu Windows cảnh báo khi chạy lệnh `reg add`, đó là do thay đổi cấu hình hệ
> thống ở mức tài khoản người dùng hiện tại (HKCU), không ảnh hưởng máy khác
> và không cài thêm phần mềm nào.

## Cập nhật lên bản mới

Panel không tự động tải bản mới nếu bạn cài thủ công theo cách trên. Muốn lên
bản mới, tải lại ZIP mới nhất từ GitHub và lặp lại bước 4 (ghi đè thư mục
`DanCardCEP` cũ) sau khi đã đóng Illustrator.

Xem các thay đổi của từng bản tại
[`DanCardCEP/LICH_SU_CAP_NHAT.md`](DanCardCEP/LICH_SU_CAP_NHAT.md).

## Tính năng

Panel gồm 7 tab:

| Tab | Chức năng |
|---|---|
| **Dàn file** | Accordion gồm **Dàn Card** (6 loại card, hỗ trợ card đôi 18.4×5.6, voucher ghép card) và **Dàn Decal** (17 khổ: 1.5, 2, 2.5, rồi 3–9.5 cm mỗi 0.5 cm), tự raster/clip/resize theo khung. |
| **Dàn theo mẫu** | **Học mẫu**: học bố cục từ 1 bản đã dàn tay (1 hoặc 2 mặt), gồm vị trí, kích thước và góc xoay của từng ô. **Áp mẫu** có hai chế độ: mặc định mỗi nguồn tạo một artboard và nhân vào các ô; tick chọn nhiều mẫu thì các nguồn lần lượt vào từng ô, thiếu nguồn bù bằng con cuối rồi gần cuối. Dùng được với hình tròn và artwork xoay khác nhau. |
| **Catalogue** | Dàn trang catalogue đóng gáy giữa, khổ A4 hoặc A5 (hoặc khổ tùy chỉnh nhỏ hơn), tự nhớ pon riêng theo từng khổ. |
| **CTL Offset** | Dàn bình cho in offset khổ lớn 65×86: **Đóng ghim giữa** (bìa TT4 + ruột AB tự trở) và **Keo gáy** (mỗi tay 16 trang, dàn AB tuần tự). |
| **Đổi tên** | Đổi tên hàng loạt object: tiền tố, số/chữ thường/HOA, vị trí bắt đầu, đệm số 0, hướng đếm trên/dưới, lặp nhãn. |
| **Variable** | Mở công cụ Variable Importer — nhập dữ liệu CSV/TXT (giữ dấu tiếng Việt) để tạo nhiều bản từ 1 template. |
| **Auto Save** | Rà các hàng từ trên xuống: hàng có 2 object là trước/sau và xuất PDF 2 trang; hàng có 1 object là card một mặt, tên file thêm ` - 1 mat` trước `cm/km`. Tool kiểm tra trùng tên file trước khi xuất. Kèm nút **Clip 9.2 × 5.6 (tự xoay)** để cắt khung nhanh. |

Nút **Raster** trên header: raster nhanh object đang chọn (CMYK, 450 ppi, nền
trong suốt). Cạnh đó là nút **Clip**: cắt object đang chọn theo khung KT nhập
vào (cm/mm/in), canh giữa.

### Dàn Catalogue A4/A5

1. Trong Illustrator, chọn các trang theo thứ tự đọc (trái → phải, trên →
   dưới).
2. Số trang phải là bội số của 4.
3. Mở tab **Catalogue**, chọn **Dàn Catalogue A4** hoặc **A5**.
4. Lần đầu tiên, chọn file pon (`.ai`) của đúng khổ — tool sẽ nhớ đường dẫn
   cho các lần sau.

## Cấu trúc dự án

```
DanCard_Setup_23/
├── DanCardCEP/                 # Mã nguồn panel CEP
│   ├── CSXS/manifest.xml        # Khai báo extension (host, kích thước panel...)
│   ├── index.html                # Giao diện panel
│   ├── css/style.css              # Style
│   ├── js/main.js                  # Logic giao diện (gọi ExtendScript qua CSInterface)
│   ├── jsx/dan_card_lib.jsx          # Toàn bộ logic dàn bình (ExtendScript)
│   ├── assets/, fonts/                # Ảnh & font dùng trong panel
│   └── LICH_SU_CAP_NHAT.md             # Changelog chi tiết từng bản
├── online/                     # Gói bản phát hành + latest.json
└── updater/                    # Script cập nhật tự động (dùng khi cài qua bộ cài đóng gói)
```

## Xử lý sự cố

- **Cài xong vẫn thấy bản cũ**: đóng hẳn Illustrator (không chỉ đóng panel)
  trước khi copy đè thư mục `DanCardCEP`, vì Illustrator giữ bản cũ trong bộ
  nhớ.
- **Panel không hiện trong Window > Extensions**: kiểm tra lại 4 lệnh
  `reg add` ở bước cài đặt đã chạy thành công chưa, và thư mục
  `%APPDATA%\Adobe\CEP\extensions\DanCardCEP` đã có đủ file
  (`index.html`, `CSXS\manifest.xml`, ...).
- **Lỗi khi dàn**: panel hiển thị thông báo tiếng Việt rõ ràng (object nào
  sai, kích thước hiện tại vs kích thước cần) ngay trong ô kết quả.

## Liên hệ

Zalo: 0853147500
