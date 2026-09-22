# Công cụ bình — DanCard CEP Panel

Panel mở rộng (CEP extension) cho Adobe Illustrator, hỗ trợ dàn bình các loại
ấn phẩm in ấn: card, decal, catalogue, offset khổ lớn, đổi tên hàng loạt và
nhập dữ liệu biến (variable data).

_Tác giả: Lộc (Code dạo) · Tester: Tân (1 cú) · Duẫn (CTL Offset)_

## Yêu cầu

- Adobe Illustrator (hỗ trợ CS6 → 2026+, host `ILST`).
- Windows (các script cài đặt là `.bat` / PowerShell).

## Cài lần đầu cho nhân viên

Không gửi cả thư mục mã nguồn này. Gửi file `CongCuBinh_CaiLanDau.zip` hoặc
thư mục `GUI_NHAN_VIEN_CAI_LAN_DAU` đã được đóng gói sẵn. Nhân viên chỉ cần
giải nén toàn bộ rồi bấm đúp
`CAI_DAT_CONG_CU_BINH.bat`; file đó tự bật `PlayerDebugMode` và cài panel.
Sau đó mở Illustrator: **Window > Extensions > Công cụ bình**.

**Các lần cập nhật sau**: khi đã cấu hình update online, máy sẽ tự kiểm tra
bản mới khi đăng nhập Windows và cập nhật lúc Illustrator đang đóng. Không cần
chép lại folder. Muốn cập nhật ngay, đóng Illustrator rồi bấm **CongCuBinh →
Cap nhat Cong cu binh** trong Start Menu; không cần khởi động lại Windows.
Nếu máy không có Internet, người quản lý gửi lại bộ cài mới khi cần.

> Lưu ý: đặt 2 file `.bat` cùng chỗ với thư mục `DanCardCEP`. Nếu Windows
> cảnh báo "Windows protected your PC" khi chạy `.bat`, bấm **More info** >
> **Run anyway** (file chỉ copy thư mục, không có gì độc hại).

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
├── GUI_NHAN_VIEN_CAI_LAN_DAU/  # Bộ cài gọn để gửi nhân viên (sinh tự động)
├── CongCuBinh_CaiLanDau.zip    # File ZIP gửi nhân viên (sinh tự động)
├── QuanLyNoiBo/                # Chỉ máy quản lý dùng: phát hành, GitHub, LAN sync
│   ├── PhatHanhCapNhat.bat      # Bấm một lần để tăng version, đóng gói, commit và push
│   ├── DongGoiNhanVien.ps1      # Tạo lại bộ cài gọn khi cần
│   ├── Publish-OnlineUpdate.ps1 # Tạo ZIP + latest.json cho kênh online
│   └── staff-sync/              # Cấu hình đồng bộ LAN/VPN
├── online/                     # Gói online mà máy nhân viên tự tải
├── updater/                    # Mã updater dùng khi phát hành
└── DanCardCEP/                 # Mã nguồn panel CEP
    ├── CSXS/manifest.xml        # Khai báo extension (host, kích thước panel...)
    ├── index.html                # Giao diện panel
    ├── css/style.css              # Style
    ├── js/main.js                  # Logic giao diện (gọi ExtendScript qua CSInterface)
    ├── jsx/dan_card_lib.jsx          # Toàn bộ logic dàn bình (ExtendScript)
    ├── assets/, fonts/                # Ảnh & font dùng trong panel
    └── LICH_SU_CAP_NHAT.md             # Changelog chi tiết từng bản
```

## Cập nhật / Changelog

Xem chi tiết từng phiên bản tại
[`DanCardCEP/LICH_SU_CAP_NHAT.md`](../DanCardCEP/LICH_SU_CAP_NHAT.md).

Phiên bản hiện tại: **v2.9.10**.

### Cập nhật online

Lần đầu trên mỗi máy chạy `CAI_DAT_CONG_CU_BINH.bat` trong bộ gửi nhân viên. Bộ cài đặt đặt updater tại
`%LOCALAPPDATA%\CongCuBinhUpdater`, tách riêng với panel để updater có thể thay
panel an toàn. Updater chỉ nhận manifest và gói qua HTTPS, kiểm SHA-256 trước
khi cài, và không thay file nếu Illustrator đang mở. Bộ cài thêm lối tắt
**CongCuBinh → Cap nhat Cong cu binh** trong Start Menu để kiểm tra thủ công
ngay khi cần. Nó tự
tạo tác vụ khi đăng nhập Windows; nếu máy chặn Task Scheduler, nó dùng Startup
của user.

Kênh phát hành được cấu hình một lần trong
`..\updater\update-config.json`, bằng GitHub Contents API cho `latest.json` trong
thư mục `..\online\`. Sau đó, từ thư mục `QuanLyNoiBo`,
một lần trên máy tạo bản phát hành, chạy:

```powershell
.\Configure-OnlineUpdate.ps1 -GitHubRepository "tai-khoan/DanCardUpdates"
```

Sau đó,
mỗi phiên bản chỉ cần chạy:

```powershell
.\Publish-OnlineUpdate.ps1 -GitHubRepository "tai-khoan/DanCardUpdates"
```

Script tạo hai file trong thư mục `online/` (`DanCardCEP-<version>.zip` và
`latest.json`). Commit và push hai file này cùng mã nguồn lên nhánh `main`.
Máy khách tự tải đúng gói và kiểm hash trước khi cập nhật.

### Phát hành bản mới

Mỗi lần cần cập nhật, chỉ sửa chức năng trong source rồi bấm đúp
`PhatHanhCapNhat.bat`. Script hỏi một mô tả ngắn, tự tăng version, tạo ZIP và
`latest.json`, commit rồi push lên GitHub. Không tự sửa `online/`, version trong
manifest hay file cấu hình updater.

### Đồng bộ thẳng tới AppData máy nhân viên

Nếu các máy cùng mạng LAN/VPN, không cần để nhân viên tải gì: điền tên máy và
tên profile Windows vào [`staff-sync/staff-machines.json`](staff-sync/staff-machines.json),
rồi chạy một lần:

```powershell
.\Enable-StaffAutoSync.ps1
```

Máy quản lý sẽ theo dõi folder `DanCardCEP` và đẩy bản mới thẳng tới
`%APPDATA%\Adobe\CEP\extensions\DanCardCEP` của từng nhân viên. Cơ chế dùng
folder tạm và bản sao lưu để không làm mất bản đang chạy. Xem chi tiết quyền
mạng và cách điền danh sách tại [`staff-sync/README.md`](staff-sync/README.md).

## Xử lý sự cố

- **Cài xong vẫn thấy bản cũ**: đóng hẳn Illustrator (không chỉ đóng panel)
  trước khi chạy `CAI_DAT_CONG_CU_BINH.bat` hoặc cập nhật thủ công, vì
  Illustrator giữ bản cũ trong bộ nhớ.
- **Panel không hiện trong Window > Extensions**: chạy lại
  `CAI_DAT_CONG_CU_BINH.bat`; file này tự bật PlayerDebugMode.
- **Lỗi khi dàn**: panel hiển thị thông báo tiếng Việt rõ ràng (object nào
  sai, kích thước hiện tại vs kích thước cần) ngay trong ô kết quả.

## Liên hệ

Zalo: 0853147500
