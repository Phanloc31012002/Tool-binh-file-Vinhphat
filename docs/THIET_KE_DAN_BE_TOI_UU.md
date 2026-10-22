# Thiết kế: Dàn bế "duyệt hết phương án" — tối ưu có chứng minh cho chữ nhật, tự cải tiến cho mọi hình

_Chốt với anh Lộc 22/10/2026 · nền: lõi xếp hàng lồng (`dan_be_nester.js`) và bộ chia khu (`dan_be_zones.js`) của v2.18.0_

## 1. Yêu cầu (lời anh Lộc)

- Bản hiện tại còn chưa tối ưu: ví dụ bỏ 1 con dọc cạnh PON để né PON và thêm được 2 con ngang phía trên.
  Tool phải **tự tính hết các phương án** và tự giải quyết các mâu thuẫn quanh chữ "tối ưu".
- Áp dụng cho **mọi hình**, không riêng chữ nhật.
- **Không giới hạn thời gian**; panel hiện tiến độ và có nút **Dừng** (dừng thì giữ kết quả tốt nhất tới lúc đó).
- **Nhiều con luôn thắng**; cùng số con mới xét gọn đẹp. Tool tự quyết, không hỏi lại, không cần bảng quy trình dài.

Số đo hiện trạng (tờ 33 × 35,4 cm, lề 4, PON 4 góc, khe 2 mm): chữ nhật đang thiếu 1–4 con so với tối ưu
guillotine không tính PON — card 92 × 56: 18 → 19; 50 × 30: 63 → 67; 70 × 40: 32 → 35; 60 × 35: 44 → 48;
100 × 40: 22 → 25; 45 × 25: 82 → 86; 38 × 22: 111 → 114.

## 2. Hai tầng

### 2.1 Tầng chữ nhật — tối ưu có chứng minh (`dan_be_rect.js`, mới)

**Nhận biết chữ nhật/bo góc.** Khuôn một đường bế, lồi; mọi lát cắt ngang ở phần giữa rộng bằng khung bao
(sai số 0,05 mm); chỉ 4 góc được vát/bo, bán kính ≤ nửa cạnh ngắn. Dàn như chữ nhật `W × H` (khung bao).
Không nhận → bỏ qua tầng này.

**Bài toán.** Cạnh hiệu dụng `a = W + khe`, `b = H + khe`; tờ hiệu dụng `(Wd + khe) × (Hd + khe)` (vùng dùng
được đã trừ lề). Hai hướng đặt (0°/90°). Vùng né PON = đĩa bán kính `r + né` quanh từng chấm.

**Duyệt hết theo khối.** Quy hoạch động theo tọa độ chuẩn có vị trí thật:
- Tập mốc `X` = {`x0 + i·a + j·b` ≤ Wd} với `x0` ∈ {0} ∪ {mép phải vùng né PON của các chấm bên trái} và
  đối xứng từ mép phải; tương tự `Y`. Chỉ giữ mốc trong vùng dùng được.
- Trạng thái = ô `(x0, y0, x1, y1)` với tọa độ thuộc `X × Y`. Giá trị `f(ô)` = số con nhiều nhất trong ô:
  1. **Lưới một hướng** neo ở một trong 4 góc ô (ngang hoặc dọc, 8 cách): đếm con không đè vùng né PON.
  2. **Cắt guillotine** dọc hoặc ngang tại mọi mốc trong ô: `f(ô1) + f(ô2)`.
  3. **5 khối xoay vòng** (không guillotine): hai mốc `x` và hai mốc `y` trong ô, 4 khối quanh + 1 khối giữa;
     chỉ xét ở ô gốc (cả tờ) và các ô cấp 1 để giữ số trạng thái hữu hạn.
- Nhớ kết quả từng ô (memo). Cắt tỉa bằng cận trên Barnes của ô: nếu tổng đã bằng cận trên thì không xét
  tiếp. Số trạng thái ~ (|X|²·|Y|²)/4, với |X|, |Y| ≤ 60 → vài giây; khuôn tí hon (hàng nghìn con) giới hạn
  mốc bằng cách gộp mốc cách nhau < 0,25 mm.
- Cùng số con: ít khối hơn, ít đổi hướng hơn, rồi thứ tự duyệt (tất định).

**Chứng minh.** Cận trên `UB = min(Barnes(tờ hiệu dụng), ⌊(diện tích dùng được − diện tích vùng né PON
giao vùng dùng được) / (a·b)⌋)`. Báo cáo:
- `count == UB`: _"19/19 con — không cách nào nhiều hơn."_
- `count < UB`: _"19 con — tốt nhất trong mọi cách chia khối, cận trên 20."_

**Đầu ra.** Danh sách con `{vi, x, y}` → dựng lại thành slot, canh giữa, chốt chặn hình học như mọi phương án.

### 2.2 Tầng tự cải tiến — mọi hình (`dan_be_improve.js`, mới)

**Xuất phát.** Bố cục tốt nhất hiện có: lõi xếp hàng lồng, tầng chữ nhật (nếu có), hoặc bố cục chia khu.

**Tập nước đi (tất định, hữu hạn):**
1. *Bỏ – dồn – nhét:* với từng con "vướng" (chạm vùng né PON, sát mép tờ, đầu/cuối hàng, mép dải, cạnh
   ranh giới khu): bỏ con; dồn hàng/cụm về phía vừa trống bằng khép theo đường bế thật (`approachShift`);
   nhét lại bằng lưới của chính khuôn (`fillGaps`) và bằng một hàng mới dàn trong dải vừa trống
   (`planCutterRect` mức quick). Giữ khi ≥ +1 con.
2. *Đổi hướng dải:* bỏ cả một hàng (đầu, cuối, hoặc hàng chạm PON); dàn lại dải vừa trống bằng
   `planCutterRect` (đủ mọi kiểu hàng của lõi). Giữ khi nhiều con hơn.
3. *Dịch cả cụm:* dời toàn khối hoặc một dải ±(0,5…khe + cạnh) qua trái/phải/lên/xuống để né PON rồi nhét
   thêm ở mép đối diện.
4. *Bỏ hai con kề nhau* ở chỗ vướng (tối đa 60 cặp mỗi vòng).

Vòng lặp: duyệt hết tập nước đi; có nước đi tăng con thì nhận và bắt đầu vòng mới từ bố cục mới; không có
thì **dừng — "hết cách"**. Mỗi nước đi được nhận chỉ sau khi qua chốt chặn hình học độc lập (khe, lề, PON,
khoảng cách khu); với trộn mẫu, nước đi làm hai nhóm khuôn hết tách được (ngang/dọc) bị loại.

**Cận trên cho mọi hình.** `⌊(diện tích dùng được − vùng né PON) / diện tích(khuôn nở nửa khe)⌋` — các con
nở nửa khe không được chồng nhau nên đây là cận trên đúng. Panel hiện _"63 con (tối đa lý thuyết 67)"_.

**Cùng số con:** giữ bố cục đang có (không đổi chỉ vì bằng con); tầng này không làm bố cục xấu đi khi
không tăng con.

### 2.3 Ghép vào tool

- Thứ tự trong `nest()`/`nestAsync()`: lõi hiện tại → (chữ nhật: tầng 2.1, lấy max) → tầng 2.2 → canh giữa →
  chốt chặn → kết quả. Trộn mẫu: tầng 2.1 dùng trong `planLeaf` cho khuôn chữ nhật (ước lượng và dàn thật
  đều đúng hơn), tầng 2.2 chạy trên cả tờ với luật tách khu.
- `nestAsync` báo tiến độ `{phase, done, total, count, bound, proven}`; panel hiện
  _"Đang tối ưu… 63 → 65 con (tối đa 67)"_ và nút **Dừng** (chỉ hiện khi đang tối ưu; bấm thì dừng ở bước
  kế tiếp, giữ bố cục tốt nhất đã chốt chặn). Không có hạn giờ; tầng 2.2 tự kết thúc khi hết cách.
- `detail` ghi: số con, cận trên, "không cách nào nhiều hơn" / "tốt nhất trong mọi cách chia khối" (chữ
  nhật) / "đã duyệt hết N nước đi" (hình khác), và tóm tắt các nước đi đã nhận (ví dụ "bỏ 1 con cạnh PON,
  thêm 2 con hàng trên").
- Kết quả giữ định dạng cũ; Illustrator không phải sửa.
- Tất định: không ngẫu nhiên, không phụ thuộc đồng hồ (bỏ hẳn hạn giờ của hai tầng mới; lõi cũ vẫn chạy
  trong ngân sách như trước).

## 3. Kiểm thử

1. **Chữ nhật, tờ không PON:** số con == tối ưu guillotine (đối chiếu DP độc lập trong test) cho 10 cỡ
   khuôn × khe 1 và 2; với tờ nhỏ (≤ 12 con) đối chiếu thêm với duyệt vét cạn độc lập.
2. **Chữ nhật, có PON 4 góc:** ≥ số con hiện tại ở mọi ca của bảng mục 1; ≥ tối ưu không PON − 4; báo cáo
   đúng "không cách nào nhiều hơn" khi == UB (kiểm UB bằng công thức độc lập trong test).
3. **Bo góc:** nhận là chữ nhật; tròn/bầu dục/tim không nhận.
4. **Mọi hình (44 biên dạng trong thư viện test × khe 1, 2):** sau tầng 2.2 không ca nào ít hơn trước; tổng
   tăng; cận trên hiển thị ≥ số con; chạy lại y hệt; mọi ca qua bộ đo độc lập.
5. **Ví dụ anh Lộc:** dựng ca chữ nhật có PON mà bỏ 1 con dọc + dồn → thêm 2 con ngang; tool phải đạt số con
   của phương án đó.
6. **Trộn mẫu:** 4 bộ mẫu của v2.18.0 — không ít hơn, mỗi bài vẫn một cụm, các nhóm khuôn vẫn tách được.
7. **Dừng:** gọi dừng giữa chừng → kết quả là bố cục tốt nhất đã chốt chặn, `ok: true`.
8. **Panel:** nút Dừng chỉ hiện khi đang tối ưu; chữ tiến độ đúng; 44 test hiện có vẫn qua.

## 4. Ngoài phạm vi

- Xoay góc lẻ; chứng minh tối ưu cho hình không phải chữ nhật (chỉ có cận trên); Web Worker.
