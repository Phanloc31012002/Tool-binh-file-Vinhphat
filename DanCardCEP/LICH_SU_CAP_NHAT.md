# Lịch sử cập nhật — Công cụ bình

_Tác giả: Lộc (Code dạo) · Tester: Tân (1 cú) · Duẫn (CTL Offset)_

## v2.10.4 — test thông báo qua cloudflare

- test thông báo qua cloudflare

---

## v2.10.3 — Test Thông báo Window

- Test Thông báo Window

---

## v2.10.2 — Thêm chức năng nếu có cập nhật sẽ thông báo tại window

- Thêm chức năng nếu có cập nhật sẽ thông báo tại window

---

## v2.10.1 — vá lỗi hiển thị panel

- vá lỗi hiển thị panel

---

## v2.10.0 — Thêm chức năng save PDF từng artboard

- Save PDF từng artboard:
- Có chọn được save 1 mặt hay 2 mặt
- Có tự động đánh số File 1, File 2,...
- Nhập tiêu đề đứng sau File 1, File2,...

---

## v2.9.11 — Bản vá đặt Pon

- Vá lỗi đặt pon khi đánh Pon vượt mép

---

## v2.9.10 — Chỉnh sửa loại Pon cho card cắt

- Các loại card cắt sẽ dùng cùng Pon khổ 33x35.4 vì dupicate pon quá lâu có khi là lỗi nên sẽ mất rất nhiều thời gian.
- Pon khổ 33x35.4 sẽ dùng chung 1 loại là Pon trăng ko có bất cứ gì trên đó.

---

## v2.9.9 — thêm chức năng cho tự động đánh Pon

- Thêm ô nhập Khoảng cách từ Pon đến bài.

---

## v2.9.8 — update tu ve Pon cat

- Phát triển thêm chế độ tự động đánh Pon cắt cho bài cần cắt.

---

## v2.9.7 — Ban va dantheomau

- Chỉnh sửa các vấn đề về dàn hình tròn, hình vuông, cân bằng và đi sâu vào snapShot.

---

## v2.9.6 — Khoi phuc 2 che do dan theo mau

- Khôi phục 2 chế độ dàn theo mẫu mà đã làm từ trước vì lỡ thay thế 2 chế độ với nhau để test.

---

## v2.9.5 — Them icon va tien do cap nhat

- Phát hành tự động qua PhatHanhCapNhat.bat.

---

## v2.9.4 — Nhận bản mới không chờ cache GitHub Raw

- Updater đọc `latest.json` qua GitHub Contents API, tránh cache tối đa năm
  phút của GitHub Raw khi vừa publish bản mới.
- Bộ cài tự đổi cấu hình GitHub Raw cũ sang API ở lần cài tiếp theo.

---

## v2.9.3 — Kiểm nghiệm thủ công bằng CMD

- Bản phát hành thử nghiệm không thay đổi chức năng panel, dùng để kiểm tra
  lối tắt CMD cập nhật thủ công trong Start Menu.

---

## v2.9.2 — Kiểm nghiệm cập nhật online

- Bản phát hành thử nghiệm không thay đổi chức năng panel, dùng để xác nhận
  toàn bộ luồng tải ZIP, xác minh SHA-256 và thay bản cũ tự động.

---

## v2.9.1 — Cập nhật ngay không cần đăng xuất

- Bộ cài tạo lối tắt **Cập nhật Công cụ bình** trong Start Menu. Đóng hẳn
  Illustrator rồi bấm lối tắt này để kiểm tra và cài bản mới ngay, không cần
  khởi động lại hoặc đăng xuất Windows.
- Updater đọc được `latest.json` từ GitHub Raw trên cả Windows PowerShell 5,
  kể cả khi file có UTF-8 BOM.
- Nếu Windows chặn Task Scheduler, updater tự chạy từ Startup của user khi
  đăng nhập Windows.

---

## v2.9.0 — Cập nhật online an toàn

- Thêm updater Windows độc lập với panel: kiểm tra `latest.json` qua HTTPS,
  tải ZIP mới, xác minh SHA-256 và chỉ thay panel khi Illustrator đã đóng.
- Bản cũ được sao lưu trước khi thay; nếu cài gói mới không hoàn tất thì tự
  khôi phục bản cũ.
- Bộ cài lần đầu đặt updater tại `%LOCALAPPDATA%\CongCuBinhUpdater` và tạo
  tác vụ kiểm tra lúc đăng nhập khi đã cấu hình URL phát hành.
- Thêm `Configure-OnlineUpdate.ps1` để gắn GitHub Release một lần, cùng
  `Publish-OnlineUpdate.ps1` để tạo đúng ZIP và `latest.json` cho mỗi bản.
- Thêm đồng bộ LAN từ máy quản lý thẳng tới AppData từng nhân viên: theo dõi
  folder nguồn, staging + backup rồi thay bản mới; nhân viên không cần tải
  file hoặc chạy `install.bat`.

---

## v2.8.0 — Dàn nhiều mẫu nguồn vào một artboard

**Dàn theo mẫu:**

- Mỗi artboard không còn nhân một object cho toàn bộ cụm. Nếu mẫu đã học có
  `n` slot thì `n` nguồn được gán lần lượt vào `n` slot theo thứ tự từ trên
  xuống, trái sang phải.
- Chọn nhiều hơn `n` nguồn sẽ tự chia thành các lô `n` nguồn và tạo artboard
  tiếp theo; mỗi lô vẫn giữ đúng từng loại, không thay thế nguồn cũ.
- Lô thiếu nguồn được bù bằng bản sao của **con cuối**, rồi **con gần cuối**.
  Ví dụ 5 slot với A, B, C sẽ thành A–B–C–C–B.
- Mỗi nguồn chỉ raster một lần trong artboard, rồi mới xoay, resize và clip
  theo slot của nó. Nguồn gốc không bị sửa.
- Bản hai mặt áp cùng logic theo cặp nguồn ở hai cột (trái=trước,
  phải=sau); chặn chạy khi mẫu trước/sau có số slot khác nhau.

---

## v2.7.0 — Ổn định Auto Save, Dàn theo mẫu và dàn bình

**Auto Save PDF:**

- Rà selection theo hàng từ **trên xuống dưới**, rồi trái sang phải. Mỗi hàng
  chỉ nhận **1 object (một mặt)** hoặc **2 object (trước + sau)**.
- Card một mặt được xuất PDF một trang và tự chèn ` - 1 mat` trước phần
  `cm/km` trong tên file. Card hai mặt vẫn xuất PDF hai trang.
- Kiểm tra STT, số đệm, object không có khung hợp lệ, tên file trùng, file PDF
  đã tồn tại và đường dẫn quá dài trước khi xuất; vì vậy không còn xuất dở
  dang một phần danh sách.
- Sửa nút chọn thư mục lưu và lỗi CEP gọi nhầm hàm khi panel còn dùng bộ nhớ
  cũ. Sau khi cài bản mới cần đóng hẳn Illustrator rồi mở lại để nạp script.

**Dàn theo mẫu:**

- Học và áp theo **từng ô mẫu**, gồm vị trí, kích thước và góc xoay; không
  còn ép toàn bộ artwork về cùng một hướng.
- Hỗ trợ artwork là Raster/Placed không có ma trận xoay: lấy hướng đang nhìn
  thấy làm góc 0 rồi áp đúng góc đã học. Dùng được với hình tròn và mẫu có
  các ô xoay 180°.
- Chặn dàn khi số object mặt trước/mặt sau không khớp hoặc pon/artboard mẫu
  không hợp lệ.

**Catalogue, CTL Offset và Keo gáy:**

- Nhận diện chính xác RasterItem, PlacedItem và group ảnh đã clip (kể cả mask
  Compound Path). Những object này được giữ nguyên, không raster lần nữa.
- Vector, chữ và group lẫn vector được raster một lần theo khung thật; nếu
  raster lỗi, tool dừng và báo lỗi thay vì tiếp tục tạo bình sai.

---

## v2.6.0 — Auto Save PDF, Clip, giao diện mới

**Tab Auto Save (mới):**

- Chọn (n×2) object → tự lưu mỗi con card thành **1 file PDF 2 trang**
  (trang 1 mặt trước, trang 2 mặt sau). File gốc KHÔNG bị sửa: mỗi con được
  nhân đôi sang tài liệu tạm, tạo 2 artboard vừa khít rồi xuất PDF.
- Tên file theo mẫu: `1088 - {STT} - {số} hộp - {cm/km} - {ngày}.pdf`.
  Ô **Mã 1088 khoá cứng**, chữ cam đậm. STT tự tăng, có đệm số 0, xem trước
  tên file trực tiếp.
- Dropdown **cm (cán màng) / km (không màng)**. Nút **"Chọn…"** mở hộp chọn
  thư mục lưu; chỉ lưu đúng folder đã chọn, không tự tạo folder mới.
- Nút **Clip 9.2 × 5.6 (tự xoay)**: cắt object đang chọn thành khung
  9.2×5.6 cm, canh giữa; object đứng dọc thì tự xoay khung thành 5.6×9.2.
- Thứ tự con sắp theo **mép trên** (gom hàng), đúng thứ tự dù card cao thấp
  khác nhau.

**Nút Clip (header, cạnh Raster):**

- Clip từng object thành khung KT nhập vào (cm/mm/in), canh giữa. Dùng sau
  khi tự bấm Raster.

**Khác:**

- **Raster đổi 400 → 450 ppi** (CMYK, nền trong suốt).
- **Giao diện tông xanh-đen (slate)** mới; scrollbar mảnh, ẩn thanh cuộn
  ngang, bỏ nút mũi tên thô; các bảng kết quả hiển thị gọn hơn.
- Bấm/Tab vào ô nhập nào thì **tự bôi đen** để gõ đè nhanh.
- Sửa lỗi truyền đường dẫn Windows (dấu `\` bị nuốt) khiến lưu sai folder;
  hỗ trợ path có khoảng trắng và dấu ngoặc.
- Xác nhận **CTL Offset**: object đã là hình (RasterItem/PlacedItem) thì
  KHÔNG raster lại, giữ nguyên chất lượng.
- Kèm **macro Corel (VBA)**: raster bitmap CMYK 450 dpi nền trong suốt,
  tuỳ chọn tự xuất PDF (tên = tên file .cdr, dùng setting PDF của Corel).

---

## v2.5.6 — Cập nhật khuôn decal 2, 2.5 và 9 cm

- Đổi bộ 268 tâm đang gán nhầm từ **2.5 cm** sang **2 cm**.
- Thêm đúng **162 tâm** của khuôn **2.5 cm** mới; PDF lưu mỗi vòng hai lần nên chỉ giữ một tâm thật.
- Thay 12 tâm khuôn **9 cm** bằng toạ độ vector gốc trong PDF; danh sách CEP sắp từ 1.5 → 2 → 2.5 → 3... cm.

---

## v2.5.5 — Tất cả toạ độ decal là tâm vòng tròn

- Chuẩn hoá toàn bộ kích thước `.5`: mỗi `[x, y]` là tâm thật của một vòng
  tròn trong file PDF khuôn, tính từ góc trên-trái artboard.
- Không còn dùng trung điểm giữa hai vòng tròn hoặc cộng/trừ bán kính. Đã áp
  dụng lại cho 1.5, 2.5, 5.5 và 8.5 cm.

---

## v2.5.4 — Lấy trực tiếp lưới PDF 1.5 cm

- Bỏ tâm trung điểm gây lệch **0.125 cm**.
- Dùng thẳng 464 tâm vòng tròn trong `khuon decal tròn 1.5cm.pdf` theo thứ tự
  trên → dưới, trái → phải.

---

## v2.5.3 — Sửa tâm dàn theo khuôn `.5`

- Khuôn **1.5 cm**: lấy điểm giữa của hai đường tròn tương ứng, thay vì lệch
  sang một đường; giữ **464 chỗ**.
- Khuôn **8.5 cm**: đọc lại file khuôn mới, thay bố cục cũ 12 chỗ bằng **14
  chỗ** và đặt đúng tâm giữa hai đường tròn.
- Rà lại các khuôn `.5` khác: 2.5 và 5.5 đã dùng tâm giữa hai đường; 3.5,
  4.5, 6.5, 7.5 và 9.5 giữ tọa độ khớp khuôn hiện có.

---

## v2.5.2 — Đồng bộ khuôn 1.5 cm

- Đọc trực tiếp path vector của khuôn 1.5 cm mới và đồng bộ bộ tâm decal:
  **454 → 464 chỗ**.
- Bổ sung 10 tâm ở mép phải, đồng thời bỏ 1 tâm thừa ở hàng cuối để dàn khớp
  lưới khuôn.

---

## v2.5.1 — Đủ cỡ decal trên CEP

- Đồng bộ CEP với toàn bộ bộ tọa độ decal đã có: **1.5, 2.5, rồi 3–9.5 cm
  mỗi 0.5 cm**.
- Danh sách cỡ decal hiển thị theo thứ tự tăng dần từ trên xuống dưới, kèm số
  chỗ tương ứng.

---

## v2.5.0 — Nòng nâng, đạn vọt trời, cả cụm vỡ & ghép lại

**Cải tiến màn xe tăng (tester mặc định)**

- **Nòng pháo nâng chếch lên** trước khi bắn (có giật khi khai hoả).
- **Đạn bắn thẳng lên** vượt khỏi panel, mất hút, rồi **rơi thẳng từ trên
  xuống** trúng chữ (thay cho vòng cung ngắn).
- **Cả cụm "Tân 1 cú"** cùng vỡ (mỗi chữ 10 mảnh) khi trúng.
- Mảnh **rơi xuống đất nằm đó (không biến mất)**, sau đó **bay lên ghép lại**
  thành cụm chữ, gradient chạy tiếp. Vòng lặp ~12s.

---

## v2.4.1 — Tinh chỉnh màn xe tăng cho mượt & trúng chữ

**Sửa / cải tiến**

- Sửa toạ độ vụ nổ dùng offset (miễn nhiễm co giãn giao diện) -> nổ **trúng ngay
  chữ Tân**, không lệch.
- Xe tăng **dừng cách chữ một khoảng** bên phải, nòng không còn đè lên "1 cú".
- Vụ nổ **to & rõ hơn** (flash + tia lửa toả đều + khói), lửa cháy gom quanh chữ,
  khói đầu nòng dịu lại; rung cả cụm chữ khi trúng.

---

## v2.4.0 — Xe tăng bắn chữ "Tân" (vòng lặp hoành tráng)

**Giao diện (tester mặc định)**

- Thêm màn **xe tăng** (SVG) chạy từ mép phải vào, dừng lại **bắn** vào chữ Tân:
  khói đầu nòng -> **đạn bay vòng cung** lên rồi rơi xuống -> **nổ** (particle
  flash + tia lửa + khói) -> **cháy** tại chỗ -> chữ **Tân 1 cú nứt vỡ (xám
  cháy) rơi xuống** -> xe tăng **lùi về** mép phải -> chữ **tự ghép lại** với
  gradient chạy như cũ -> **lặp vô hạn** (chu kỳ ~12s).
- Toàn bộ nổ/khói/lửa vẽ bằng **canvas particle** (không dùng Phaser, không phụ
  thuộc ảnh/mạng ngoài). Hiệu ứng **điện vẫn chạy** song song.

---

## v2.3.2 — Gỡ Saitama, trả "Tân 1 cú" về cũ

**Sửa**

- Bỏ toàn bộ hiệu ứng stickman Saitama + chữ Tân vỡ mảnh. Cụm **"Tân 1 cú"** trở
  lại đúng như cũ: chữ gradient + "1 cú" + hiệu ứng điện. (UFO Duẫn ở tab CTL
  Offset giữ nguyên.)

---

## v2.3.1 — Saitama vẽ bằng SVG (đẹp hơn)

**Giao diện**

- Thay stickman ghép từ ô vuông bằng **hình SVG Saitama** vẽ nét mượt: đầu hói,
  mặt "vô cảm", đồ vàng, áo choàng trắng bay, găng đỏ. Tay đấm là group SVG co
  -> duỗi hết cỡ. Nhìn gọn và đẹp hơn.

---

## v2.3.0 — Stickman Saitama đấm chữ "Tân"

**Giao diện (tester mặc định)**

- Thêm **stickman Saitama** (đầu xanh, đồ vàng, áo choàng trắng bay) bên trái
  chữ Tân: lấy đà rồi **đấm một phát** theo vòng lặp ~4.2s.
- Khi trúng: **sóng xung kích** lan ra + tia lửa toé; chữ **Tân hoá màu xám xi
  măng** rồi **bể rã thành từng mảnh** rơi xuống.
- **Phục hồi**: chữ Tân hiện lại với **gradient chạy bình thường** như cũ.
- **Hiệu ứng điện vẫn giữ** nguyên chạy song song.

---

## v2.2.3 — Credits không tràn khi thu hẹp panel

**Sửa**

- Khu Author/Tester giờ **tự xuống dòng** (wrap) và co gap linh hoạt khi kéo
  panel hẹp lại -> cụm **TESTER (UFO Duẫn) không bị đẩy tràn** ra ngoài mép phải
  nữa, luôn hiển thị đủ hiệu ứng.

---

## v2.2.2 — Duẫn: hiện đủ dấu ngã, hết cắt

**Sửa**

- Chữ **Duẫn** hết bị cắt **mép trên (mất dấu ~)**: tăng line-height + thêm
  đệm trên cho dấu thanh, hạ chữ xuống một chút.
- Dùng **gradient riêng** cho chữ (bỏ background-attachment:fixed của
  rainbow-text — thứ làm chữ lệch/cắt khi tô màu vào chữ).

---

## v2.2.1 — Duẫn: hiện lâu hơn + nhiễu rồi tắt

**Sửa / thêm**

- Chữ **Duẫn hiện lâu hơn** (kéo chu kỳ 4.6 -> 6.5s, giữ chữ gần như suốt).
- Trước khi tắt có pha **nhiễu (glitch)**: giật ngang, chớp, lệch màu — rồi mới
  tắt kiểu tivi.
- Nới khung UFO (104 -> 120px) cho **hết cắt chữ**.

---

## v2.2.0 — UFO Duẫn: nâng cấp đẹp & ảo

**Giao diện**

- UFO giờ **lượn nghiêng lắc**, có **quầng sáng** mờ phía sau, đèn bụng **đổi
  màu** chạy vòng, vòm kính có điểm sáng, người ngoài hành tinh **nhấp nháy mắt**
  và nhô lên.
- Tia chiếu thêm **hạt sáng lấp lánh rơi** xuống, **vũng sáng** loang nơi tia
  chạm, và **vòng sóng** lan ra liên tục.
- Chữ **Duẫn** hiện ra **lung linh** (glow + phóng nhẹ), vẫn tắt kiểu **tivi**.

---

## v2.1.1 — Duẫn: tắt kiểu TV + hết bị cắt chữ

**Sửa**

- Hiệu ứng biến mất của chữ **Duẫn** đổi thành kiểu **tắt tivi**: dẹp thành một
  vạch ngang sáng rồi co lại thành chấm và tắt.
- Nới rộng khung UFO (74 -> 96px) để **không cắt mất chữ** Duẫn.

---

## v2.1.0 — UFO chiếu tia hiện chữ "Duẫn"

**Giao diện (tab CTL Offset)**

- Tester "Duẫn" giờ có **con UFO** bay bồng bềnh phía trên, chiếu **tia sáng**
  xuống. Chu kỳ ~4.4s: bật tia -> chữ **Duẫn hiện ra** (phóng to, rõ dần); tắt
  tia -> chữ **biến mất** (mờ + tan). Hoàn toàn bằng CSS animation.
- UFO có vòm kính + người ngoài hành tinh mắt đen, 3 đèn bụng nhấp nháy; chữ
  Duẫn vẫn giữ màu gradient chạy.

---

## v2.0.5 — Vòng Lộc sát hình mẫu hơn

**Giao diện**

- Tia **dày & dài hơn** (360 tia, đa số dài), mảnh hơn -> viền rực như ảnh.
- Thêm **quầng sáng nền** ấm bên trái / lạnh bên phải -> cả vòng như phát sáng.
- Đốm nhiều hơn (150), tụ thành **vành bokeh** ôm sát vòng.
- Vòng tròn **mảnh & nét** hơn, bớt trắng.

---

## v2.0.4 — Bớt trắng ở vòng

**Giao diện**

- Giảm mạnh phần trắng: vòng tròn giờ **chủ đạo là màu** (đỏ/cam/vàng bên trái,
  xanh bên phải); **trắng chỉ hiện tại vùng cục sáng vừa quét**, nền không còn
  trắng cả vòng. Chấm chói đầu cục nhỏ lại, gốc tia bớt trắng.

---

## v2.0.3 — Dời "Code dạo" lại gần hào quang

**Giao diện**

- Đẩy chữ **Code dạo** sang trái ~3mm (lề trái 34 → 23px) cho gần vòng hào
  quang hơn.

---

## v2.0.2 — Cục sáng chạy vòng

**Giao diện**

- Thêm **1 cục sáng chạy vòng quanh** đường tròn: chạy tới đâu thì tia + vòng +
  đốm ở đó **rực sáng mạnh nhất**, vệt phía sau **mờ dần** (nơi cục chưa tới /
  đã đi xa giữ độ sáng nền thấp hơn).
- Có chấm chói dẫn đầu tại đầu cục; vòng trắng và quầng màu dày/sáng hơn ở vùng
  cục đang quét.

---

## v2.0.1 — Vòng Lộc làm lại giống hình mẫu

**Giao diện**

- Vẽ lại hiệu ứng cho **giống ảnh gốc**: rất nhiều **tia bắn thẳng ra ngoài**
  quanh vòng, độ dài ngẫu nhiên (viền lởm chởm), mỗi tia tự "thở" sáng-mờ và
  đổi độ dài liên tục.
- **Vòng tròn trắng sáng nét** ở giữa (lõi trắng + quầng màu theo góc).
- Bên trong rải **đốm vuông + tròn** nhiều màu, trôi nhẹ và nhấp nháy.
- Màu: trái ấm (vàng → cam → đỏ → hồng), phải lạnh (tím xanh → xanh dương).

---

## v2.0.0 — Fix tia bị đứt đuôi

**Sửa**

- Tia sáng không còn bị **cắt cụt đuôi nhọn**: phóng to khung canvas (104 →
  168px) để chứa trọn ngọn tia, giữ nguyên cỡ vòng tròn + chữ Lộc.
- Kẹp độ dài tia và tầm bay của đốm trong mép canvas an toàn (`RMAX`) để không
  vật nào bị cắt ở rìa.

---

## v1.9.9 — Vòng Lộc: ánh sáng chạy theo quỹ đạo

**Giao diện**

- Đổi cách vẽ vòng tia sáng: thay vì hạt tạo hình tròn, giờ có các **"runner"
  quét vòng quanh** theo quỹ đạo tròn; **chạy tới đâu, vòng + tia + đốm ở đó
  rực sáng tới đó** rồi mờ dần phía sau (đúng như hình mẫu).
- Tia hướng ra ngoài phân bố đều quanh vòng, chỉ bừng sáng khi runner quét qua;
  màu vẫn ấm bên trái, lạnh bên phải.

---

## v1.9.8 — Dời "Code dạo" khỏi vòng Lộc

**Giao diện**

- Đẩy chữ **Code dạo** sang phải (thêm lề trái) và nâng lên trên lớp canvas
  để không bị vòng tia sáng che.

---

## v1.9.7 — Chỉnh vòng Lộc hiện đủ

**Giao diện**

- Thu nhỏ vòng tia sáng (canvas 132 → 104px) để hiện trọn hình tròn.
- Đẩy ô **AUTHOR** sang phải (thêm lề trái) để vòng không bị cắt mép trái panel.
- Tăng khoảng cách AUTHOR ↔ TESTER (gap 24 → 56px) để tia không lan sang chữ
  tester.

---

## v1.9.6 — Vòng tia sáng quanh chữ "Lộc"

**Giao diện**

- Chữ **Lộc** (author) đổi thành hiệu ứng **vòng tròn tia sáng nổ** (canvas):
  nhiều tia + đốm vuông/tròn chạy quỹ đạo ngẫu nhiên liên tục toả ra ngoài,
  vòng tròn phát sáng, chữ Lộc glow ở giữa.
- Màu theo hình mẫu: nửa **trái ấm** (vàng → cam → đỏ → hồng), nửa **phải lạnh**
  (tím xanh → xanh dương). Render bằng `requestAnimationFrame`, tự co theo DPR.

---

## v1.9.5 — Chữ nút gradient sặc sỡ

**Giao diện**

- Chữ trong các nút chính (Dàn card, Dàn Decal, Học mẫu, Áp mẫu, Dàn
  Catalogue, CTL Offset, Đổi tên, Variable...) đổi thành **gradient nhiều màu
  chạy động** (hồng → cam → vàng → xanh lá → xanh dương → tím), chữ đậm 800,
  có viền sáng nhẹ cho nổi bật.
- Bọc text mỗi nút chính trong `<span class="btn-label">` để áp gradient mà
  không ảnh hưởng viền conic xoay sẵn có.

---

## v1.9.4 — Thêm tab "Dàn theo mẫu"

**Thêm mới**

- Tab mới **"Dàn theo mẫu"** nằm giữa **Dàn file** và **Catalogue**, tích hợp
  2 tool JSX rời (`1_hoc_mau.jsx` + `2_ap_mau.jsx`) vào panel.
- **Học mẫu** (`dcHocMau`): chọn tất cả bản đã dàn tay của 1 con mẫu, học bố
  cục 1 mặt hoặc 2 mặt (mặt trước / mặt sau, học 2 lần). Đọc góc xoay qua
  matrix RasterItem, lưu bố cục vào file tạm `Folder.temp/dan_theo_mau_tmp.txt`.
- **Áp mẫu** (`dcApMau`): chọn các con nguồn, tool raster + resize mỗi con về
  khổ mẫu rồi dàn theo bố cục đã học. 2 mặt: đặt nguồn 2 cột (trái = trước,
  phải = sau), tạo hết artboard theo thứ tự rồi mới dàn, hỏi pon 2 lần.
- Logic giữ nguyên từ 2 file gốc; chỉ bọc thành hàm và trả chuỗi `OK:` / `ERR:`
  để panel hiển thị kết quả.

---

## v1.9.3 — Raster clip trước khi raster

**Sửa / cải tiến**

- Nút **Raster** luôn bọc object được chọn qua một clipping group ngoài theo
  khung group/clip cha, rồi mới raster. Áp dụng cả với object thường, group và
  clip group.
- Raster giữ CMYK, 400 ppi và nền trong suốt; object gốc chỉ bị thay khi
  Illustrator đã tạo raster thành công.
- Bỏ các nhánh thử nghiệm đọc Transform, khung W × H nhập tay và autoFix khỏi
  nút Raster.

---

## v1.9.2 — Card raster như CTL, card đôi, Keo gáy, cảnh báo sai KT

**Thêm**

- **Keo gáy** (tab CTL Offset): dán keo gáy, mỗi tay 16 trang liên tiếp dàn AB
  (không bóp, không khe, cách mép trên 2.37cm). Phần dư cuối tự trở (TT8/TT4).
  Tab CTL Offset chia 2 phần mở rộng: Đóng ghim giữa + Keo gáy.
- **Card đôi 18.4×5.6** (layout 9.2×5.6): tự nhận card rộng gấp đôi, chiếm 2 chỗ.
  Ưu tiên dải 2 dưới, rồi khối 12 (cột phải→trái, hàng 1+2, xoay đứng). Nhân bản
  đều k = 20/(nhỏ + đôi×2), tối đa 5 chỗ đôi, con cùng mẫu gom liền nhau. Panel
  báo số con đôi nhận diện (18.4×5.6).
- **Cảnh báo sai kích thước**: đo sau raster (trước resize), nếu có con lệch khổ
  thì vẫn dàn xong nhưng hộp thoại kết quả báo "CÓ N CON SAI KÍCH THƯỚC - xem kỹ
  trước khi OK", và ô thông báo panel cũng ghi rõ.

**Sửa / cải tiến**

- **Card raster như CTL cho MỌI loại**: raster 400ppi theo khung (card clip →
  khung mask giữ mép) → resize về đúng khổ → ra 1 ảnh phẳng, rồi mới dàn. Bỏ
  bước bọc clip sau raster. Toàn bộ raster nâng lên 400ppi.
- **Card để dọc tự xoay về ngang** theo chiều đã chọn; card 2 mặt xoay ngược
  chiều nhau (trước/sau).
- **Các accordion không mở rộng sẵn** - mặc định thu gọn, bấm mới mở.
- **Ô thông báo panel** chữ to hơn, in đậm, màu nền/chữ rõ theo trạng thái.

---

## v1.9.1 — Variable Importer: giữ dấu tiếng Việt

**Sửa**

- Khi nạp CSV/TXT UTF-8, Variable Importer tự **chuẩn hóa Unicode NFC** trước
  khi tạo dữ liệu Variables. Các chữ tiếng Việt được lưu dạng ký tự + dấu tách
  rời (ví dụ `a` + dấu ngã) nay được ghép về dạng chuẩn, nên không còn hiện mất
  dấu trong Illustrator.

---

## v1.9 — Card raster & card đôi, Keo gáy

**Thêm**

- **Card đôi 18.4×5.6** (layout 9.2×5.6): tool tự nhận card rộng gấp đôi và
  xếp chiếm 2 chỗ. Ưu tiên dải 2 dưới trước, rồi khối 12 (cột phải→trái,
  hàng 1+2, xoay đứng, 2 mặt ngược chiều). Nhân bản đều: mỗi mẫu (đôi/nhỏ)
  ra cùng số bản, k = 20 / (số nhỏ + số đôi×2). Card đôi tối đa 5 chỗ đôi.
  Con cùng mẫu gom liền nhau cho dễ đếm. Panel báo số con đôi nhận diện.
- **Keo gáy** (tab CTL Offset): dán keo gáy, tuần tự — mỗi tay 16 trang liên
  tiếp, dàn AB (không bóp, không khe, cách mép trên 2.37cm). Phần dư cuối
  tự trở (TT8/TT4). Bìa tự dàn tay. Pon 65×86 + pon TT4 65×43.
- Tab **CTL Offset** chia 2 phần mở rộng: **Đóng ghim giữa** + **Keo gáy**.

**Sửa / cải tiến**

- **Card: raster rồi clip** cho MỌI loại (như CTL): raster 400ppi theo khung
  nội dung thật → clip về đúng kích thước chọn. Nâng toàn bộ raster lên 400ppi
  (card + catalogue + offset + keo gáy).
- **Card để dọc tự xoay về ngang**: card nào nằm lệch chiều đã chọn thì tự clip
  đúng chiều rồi xoay về chuẩn. Card 2 mặt xoay ngược chiều nhau (trước/sau).

---

## v1.8 — CTL Offset, Catalogue khổ tùy chỉnh, Decal 7cm

**Thêm**

- Tab mới **CTL Offset** — dàn bình bài AB + tự trở cho **in offset khổ lớn 65×68**:
  - Bìa = 4 trang ngoài cùng làm tự trở TT4 (khổ 65×43); phần ruột chia theo
    dư khi chia 16 (dư 12 = TT4 + TT8; dư 8 = TT8; dư 4 = TT4), còn lại là các
    tờ AB (16 trang/tờ, 2 mặt).
  - Đóng gáy giữa lồng nhau; tờ AB đặt 4 cụm-4-con đúng vị trí (A: C3|C1, B: C2|C4).
  - Kích thước 1 trang + "Có bìa" nhập ngay trên panel.
  - Nhập kích thước bìa/ruột: **bóp theo tờ** (bìa không bóp, ruột 1 → -0.1cm,
    ruột 2 → -0.2cm...), bóp đều giữ tâm mỗi cụm.
  - Pon riêng cho mỗi khổ: pon chính (65×86) cho TT8/AB, pon riêng (65×43) cho TT4.
    Pon nằm trên cùng, nhớ đường dẫn theo khổ.
  - Ghi chú "RUỘT N" (+ chữ thêm) và ghi chú bìa; TT4 chữ dọc.
  - Khi mở tab CTL Offset, tên tester đổi thành **Duẫn**.
- **Catalogue khổ tùy chỉnh** (nhỏ hơn A4 / nhỏ hơn A5): chọn "Khổ khác" trong
  từng mục, nhập kích thước đích (cm) ngay trên panel. Nhớ pon riêng theo từng khổ.
- **Decal tròn 7cm** (20 chỗ) thêm vào tab Dàn Decal.

**Sửa**

- Tab Catalogue gọn lại: mỗi mục (A4 / A5) dùng 1 dropdown chọn khổ + ô nhập,
  thay vì nhiều nút rời.
- Sửa lỗi A5: 1 cột chỉ 12 dòng (trước để 16 gây tràn).

---

## v1.7 — Dàn Catalogue A4/A5

**Thêm**

- Tab **Catalogue** với nút chạy dàn trang khổ **A4** và **A5 dọc**.
- Đóng gói hai script catalogue cùng CEP, nên extension không còn phụ thuộc vào file JSX ở thư mục Downloads.

---

Ghi lại các thay đổi qua từng bản, để tiện theo dõi đã sửa/thêm gì.

---

## v1.6 — Báo lỗi rõ ràng

**Sửa**

- Mọi lỗi khi dàn giờ hiện **thông báo tiếng Việt rõ ràng** ngay ô kết quả
  trên panel (màu vàng/cam), thay vì mã lỗi khó hiểu (vd "Error 45...").
- **Sai kích thước**: báo rõ object nào sai, KT hiện tại vs KT cần.
- Thêm bảng dịch mã lỗi ExtendScript sang tiếng Việt.
- Chống crash khi object không hợp lệ trong lúc đo kích thước (bọc an toàn
  visibleUnion / visSizeMM + try-catch tổng cho dcDan).
- Nhánh voucher: mọi lỗi (sai KT, số lượng không chia hết) đều báo rõ.

## v1.5 — Giao diện đẹp hơn

**Thêm**

- Tên **Lộc** và **Tân** chạy **gradient cầu vồng 7 màu** động (như hiệu ứng
  chữ chạy gradient trong mẫu sama).
- 3 tab đổi màu sáng hơn: tab đang chọn có nền gradient hồng-cam + gạch chân.

---

## v1.4 — Gộp tab + thêm công cụ

**Thêm**

- Tab **Dàn file**: gộp Dàn Card + Dàn Decal thành 1 tab, dạng
  **accordion** (mở/thu bằng mũi tên ▼/▶).
- Tab **Đổi tên**: đổi tên hàng loạt object (tiền tố, số/chữ thường/HOA,
  vị trí bắt đầu, đệm số 0, hướng đếm trên/dưới).
- Tab **Variable**: nút mở công cụ Variable Importer (nhập dữ liệu biến,
  tạo nhiều bản từ template) — chạy giao diện gốc.

---

## v1.3 — Decal đa khổ + chia mẫu

**Thêm**

- Tab **Decal** hỗ trợ 5 khổ: 3cm (114 chỗ), 4cm (63 chỗ), 5cm (42 chỗ),
  6cm (27 chỗ), 8cm (14 chỗ).
- Chọn nhiều object → **chia đều theo thứ tự** (vd 27 chỗ, 2 mẫu → 14/13):
  mẫu 1 điền nửa đầu, mẫu 2 điền nửa sau.
- Mỗi object tự **clip theo hình tròn** đúng kích thước của nó.

**Sửa**

- **Tọa độ tâm decal**: trước đo lệch 3cm (nửa bán kính) ở trục X.
  Nay đo đúng tâm thật, khớp với số Transform panel của Illustrator
  (hình đầu tiên = 4.3 × 5.2 cm).
- **Lỗi bắt chọn lại file pon**: file nhớ đường dẫn dùng dấu `=` gây đọc sai
  khi key/đường dẫn có dấu chấm. Nay đổi sang dấu TAB → chọn pon **1 lần**
  cho mỗi khổ (33×35.4 / 33×35), mọi cỡ decal **dùng chung**, không hỏi lại.

**Đổi tên**

- Panel đổi từ "Dàn Card" → **"Công cụ bình"** (vì giờ dàn cả card lẫn decal).

---

## v1.2 — Tab Decal (bản đầu)

**Thêm**

- Giao diện **2 tab**: [Dàn Card] [Decal], chuyển qua lại.
- Tab Decal: dàn object vào tọa độ 27 vòng tròn 6cm (đọc từ file khuôn mẫu).
- Import pon + copy artboard cho decal (giống card).
- **Bù ruler origin**: dịch pon + decal cho khớp artboard (sửa lỗi
  "pon với artboard mỗi thứ một chỗ").
- Xử lý object trước khi dàn giống card: đo KT, raster nếu sai, clip, expand.

---

## v1.1 — Giao diện + font

**Thêm**

- Header vẽ bằng CSS (không dùng ảnh): tên tác giả + tester.
- Nhúng 4 font: Lộc (thư pháp), Code dạo (pixel), Tân (thư pháp), 1 cú.
- File **install.bat** + **bat_debug_mode.bat**: cài bằng bấm đúp,
  không cần vào regedit hay copy tay.

**Đổi**

- "GOKU" → "1 cú".

---

## v1.0 — CEP bản đầu

**Thêm**

- Chuyển tool dàn card từ script (.jsx) sang **CEP extension** (panel gắn
  trong Illustrator, Window > Extensions).
- Port toàn bộ logic dàn card: 6 loại card, clip, import pon, rasterize
  background, ghép cặp, căn giữa — giữ nguyên từ bản script.
- Panel chọn loại card (radio) + nút Dàn, thay cho dialog ScriptUI cũ.

---

# Giai đoạn trước CEP — bản script (.jsx)

_Thời kỳ tool còn chạy dạng file script, mở qua File > Scripts._

## Tối ưu tốc độ dàn

**Tìm ra nguyên nhân chậm (đo thời gian từng bước)**

- Đo được: khúc "mở + nhập pon" chiếm ~92% thời gian (38s / 42s tổng).
- Đào sâu: KHÔNG phải do `app.open` (chỉ 0.5s), mà do **duplicate 96 object
  pon** vào file card nặng (31.536 object) — mỗi thao tác thêm object bắt
  Illustrator cập nhật cả cây 31k object.
- Kết luận: đổi công cụ (C++, .exe, CEP) đều không giúp — nút thắt nằm ở
  Illustrator cập nhật document nặng.

**Thử các cách tăng tốc**

- Cách 1 (group pon rồi duplicate 1 lần): giảm 37.5s → 24.6s.
- Cách giữ tab pon mở: bỏ (app.open vốn không chậm).
- Cách copy/paste: nhanh trên doc trống (0.2s) nhưng vào file nặng vẫn chậm.
- Chốt: giữ cách 1 (group duplicate) — nhanh nhất trong điều kiện dàn tại chỗ.

## Sửa lỗi lớn

- **Kích thước voucher sai** (đo 375mm thay vì 152×72): do object là group
  có background đúng KT nhưng nội dung tràn ra. Sửa bằng `autoFixByBackground`
  — tìm background khớp KT rồi rasterize theo đó.
- **Lỗi 'AOoC'** (Error 54 / 1200) khi thao tác document sau khi mở/đóng pon:
  bỏ `userInteractionLevel`, lấy lại document theo tên (tránh tham chiếu cũ).
- **Bounds sai do path ẩn**: dùng `visibleUnion` — chỉ tính object thật nhìn
  thấy, bỏ path trong suốt.
- **Lệch ruler origin** giữa file pon và file đang mở: dịch pon cho khớp
  artboard sau khi import.

## Tính năng đã xây (bản script)

- 6 loại card với công thức slot riêng (2 mặt trước/sau).
- Tự động import pon + tạo/xóa artboard theo pon.
- Dialog 2 bước chọn loại card + kiểu voucher.
- File config (`dan_card_config.txt`) nhớ đường dẫn pon cho từng loại.
- Voucher 15.2×7.2 (có thể ghép thêm card 9.2×5.6).
- Công cụ phụ: đổi tên hàng loạt (rename_selection).

---

_Ghi chú: mỗi lần cập nhật chỉ cần bấm đúp `install.bat` để cài bản mới._
