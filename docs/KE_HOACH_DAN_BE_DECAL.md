# Kế hoạch và thiết kế: Dàn bế decal theo biên dạng thật (v2.17.0)

_Lõi tìm bố cục `DanCardCEP/js/dan_be_nester.js` (lõi Dàn bế 10) · cập nhật 21/10/2026_

## 1. Bài toán

Decal bế được rất nhiều hình dạng (tròn, tim, giọt nước, sao, khiên, mũ cong, muỗng,
con vật, compound có lỗ…). Không thể viết riêng cách dàn cho từng loại rồi code từng cái
vào tool. Vì vậy lõi mới **không nhận diện tên hình** và **không cài sẵn tọa độ hay số
con** cho mẫu nào: mọi quyết định đều tính từ **đường bế thật** (điểm neo/tay nắm đã làm
phẳng với sai số rất nhỏ) của khuôn đang dàn.

Ba mục tiêu, theo thứ tự ưu tiên:

1. **Nhiều con nhất** trên tờ.
2. **Gọn, đẹp mắt**: hàng thẳng, ít đổi kiểu hàng, so le đều, khối cân giữa tờ.
3. **Dịch cả cụm** qua trái/phải (và từng hàng) để thêm con, né PON mà vẫn đủ mọi điều kiện.

## 2. Điều kiện bắt buộc (rút ra từ các bộ test)

Các bộ test trong `tests/` là kết quả của nhiều lần thử – thất bại – sửa. Lõi mới phải giữ
đủ các điều kiện đó:

| # | Điều kiện | Cách lõi mới bảo đảm | Bộ test liên quan |
|---|-----------|----------------------|-------------------|
| 1 | Khe giữa hai khuôn ≥ khe nhập, đo theo **đường bế thật** (cong hay thẳng), khe 0 thì chạm nhưng không chồng | Bảng tiếp xúc có cộng khe + dự phòng sai số làm phẳng đường cong; bước cuối khép khe bằng tiếp xúc chính xác | `positive_gap`, `zero_gap`, `zero_contact_guard`, `arch_gap`, `rows` |
| 2 | Toàn bộ khuôn nằm trong lề tờ | Mọi hàng/khối đặt trong khung trừ lề; kiểm tra lại ở chốt chặn | tất cả bộ Dàn bế |
| 3 | Né PON tính **từ mép chấm** (bán kính chấm + khoảng né), chấm không lọt vào trong khuôn | Kiểm tra theo đa giác thật của khuôn; con nào không né được thì bỏ, rồi dịch khối/dải để giữ nhiều con nhất | `nester`, `centering`, `multiband`, `rows` |
| 4 | Không chồng, không lọt vào lỗ của compound | Tiếp xúc tính trên cả đường ngoài; chốt chặn kiểm tra chứa nhau | `irregular`, `rows` |
| 5 | Giữ nguyên kích thước, điểm neo, tay nắm; chỉ xoay 0/90/180/270 và tịnh tiến | Lõi chỉ trả về hướng xoay + vị trí, không sửa dữ liệu nguồn | `variable_sizes`, `arch_gap`, `multiband` |
| 6 | Kết quả không đổi khi file nguồn đặt khuôn xoay hướng khác, path bắt đầu ở điểm khác hay đổi chiều | Lấy **hướng chuẩn theo hình học** của khuôn trước khi tìm | `multiband` (4 hướng), `alternating` |
| 7 | Nhiều bài chung một khuôn: dàn một lần, mỗi bài một **cụm liền**, chênh tối đa 1 con (v2.18.0, trước đó chia xoay vòng) | Nhận diện khuôn giống hệt (chỉ khác tọa độ/điểm đầu/chiều path/xoay 90°) rồi gán bài bằng chia đôi đệ quy theo thứ tự đọc | `alternating`, `rows`, `zones_unit` |
| 8 | Khuôn khác nhau trên cùng tờ: mỗi khuôn một khu, gần bằng nhau, lấp đầy, bài nào cũng có mặt (v2.18.0, trước đó luân phiên cân bằng tuyệt đối) | Bộ chia khu `dan_be_zones.js`: xem `docs/THIET_KE_DAN_BE_CHIA_KHU.md` | `zones`, `irregular`, `variable_sizes`, `rows` |
| 9 | Canh giữa tờ; nếu PON chặn thì ghi rõ "Canh tâm bị giới hạn bởi vùng né PON" | Canh đúng khung thật; bị chặn thì giữ đúng tâm một trục, trục kia lệch ít nhất | `centering`, `arch_gap`, `multiband` |
| 10 | Không ít con hơn các mốc đã chứng minh (lưới hàng an toàn, mốc 30 con vòm 40 × 70 khe 5 mm, mốc xưởng…) | Lõi mới tìm rộng hơn; bộ tìm cũ vẫn chạy **thi đua** | `multiband`, `arch_gap`, `irregular`, `rows` |
| 11 | Thời gian hữu hạn; khuôn tí hon hàng nghìn con vẫn nhanh | Khối lượng tìm cố định theo cỡ bài; bài rất nhiều con dùng chế độ tìm gọn | `alternating` (khuôn 2 mm: >10.000 con < 2,5 giây), các giới hạn 20–60 giây |
| 12 | Chạy lại cùng đầu vào ra cùng kết quả | Không phụ thuộc may rủi thời gian; hạn giờ chỉ là chốt an toàn | `rows` (ổn định), `multiband` |

## 3. Thuật toán "xếp hàng lồng"

```
Khuôn thật ──► hướng chuẩn ──► 4 hướng xoay + bảng tiếp xúc
      │
      ▼
 Mẫu hàng (đơn / cặp đối đầu 180° / cặp lồng sóng / cặp vuông góc)
      │
      ▼
 Khối hàng (thẳng, so le, zigzag, thuận/ngược) ──► Ghép dải đáy/đỉnh
      │
      ▼
 Dịch từng hàng ──► chấm có PON ──► Dịch cả cụm né PON ──► dịch & canh giữa khối
      │
      ▼
 Khép đúng khe (tiếp xúc chính xác) ──► Lấp chỗ trống ──► Chốt chặn độc lập ──► thi đua bộ cũ
```

**Bước 1 – Chuẩn bị khuôn.** Lấy hướng chuẩn theo hình học (khung ngang, trọng tâm thấp nhất),
dựng 4 hướng xoay. Với từng cặp hướng, tính **bảng tiếp xúc**: khuôn B đặt bên phải/bên trên
khuôn A phải lùi tối thiểu bao nhiêu để giữ đủ khe, theo đường bế thật (bao nở theo khe +
dự phòng sai số cong).

**Bước 2 – Mẫu hàng.** Từ bảng tiếp xúc tạo các kiểu hàng lặp lại: một hướng; cặp hai hướng
(đối đầu 180°, lồng sóng cùng hướng lệch cao thấp, vuông góc) với độ lệch dọc được dò rồi
tinh chỉnh để hàng dày nhất. Giữ mỗi hướng một mẫu đơn, vài mẫu cặp dày nhất, và luôn giữ
một mẫu đối đầu 180° (hai đầu hàng quay phần bo/vát ra ngoài nên dễ né PON).

**Bước 3 – Khối hàng.** Chồng các hàng lồng sát nhau (hàng sau hạ tới khi chạm khe hàng trước)
theo nhiều cách: thẳng cột, so le (độ lệch tốt nhất và độ lệch giữ đủ số con), zigzag, và
**thuận/ngược** (hàng xoay 180° xen kẽ). Mỗi cách thử nhiều pha ngang.

**Bước 4 – Ghép dải.** Phần thân dùng kiểu hàng dày nhất; 1–3 hàng sát đáy hoặc sát đỉnh được
thay bằng dải kiểu khác (ví dụ thân đứng + dải nằm) để tận dụng phần tờ còn dư. Pha của dải
được dò riêng hàng đầu để dải **lồng khít** vào hàng bên dưới (lồng khít hay không quyết định
cả dải có thêm được một hàng).

**Bước 5 – Dịch từng hàng và dịch cả cụm.** Dịch ngang từng hàng (giữ kiểu hàng) để các hàng trên
hạ thấp hơn hoặc thêm con, rồi thêm hàng vào phần đỉnh vừa dư. Sau đó **dịch nguyên dải trên/dưới
qua trái/phải** so với phần còn lại và chấm bằng **số con thật sau khi né PON** — đây là bước
"di chuyển cả cụm" để giữ con ở góc tờ. Cuối cùng dịch cả khối trong phần lề dư để ít con chạm
PON nhất, rồi canh giữa tờ.

**Bước 6 – Khép khe và lấp chỗ trống.** Dựng lại bố cục bằng tiếp xúc chính xác (đúng khe nhập,
neo theo tâm tờ); trượt thêm con vào chỗ trống từ bốn phía nếu còn vừa và né được PON.

**Bước 7 – Chọn phương án.** Thử cả hàng chạy ngang và chạy dọc tờ. Với ngân sách thường của panel
(3 giây) chạy thêm lượt thứ hai với khuôn xoay 180°: cùng không gian bố cục nhưng thứ tự xét
mẫu khác, bù chỗ lượt đầu bỏ sót khi nhiều mẫu bằng điểm nhau. Chọn **nhiều con nhất**; bằng
con thì chọn **gọn hơn** (ít đổi kiểu hàng, so le đều, ít con lấp lẻ, lề cân hai bên).

**Bước 8 – An toàn và thi đua.** Phương án được kiểm tra lại bằng **chốt chặn hình học độc lập**
(khe liên tục giữa các đường bế, lề, PON) trước khi trả về. Bộ tìm cũ (silhouette) chạy với thời
gian còn lại và chỉ được chọn khi **nhiều con hơn**.

## 4. Kết quả đo

Tờ 33 × 35,4 cm, lề 4 mm, PON 5 mm cách mép 10 mm (né 7,5 mm từ mép chấm), ngân sách 3 giây
như panel. So với bản v2.16.20 (bộ tìm cũ):

| | Bản cũ | Bản mới |
|---|---|---|
| Tổng số con, 44 biên dạng × khe 1 và 2 mm (88 ca) | 4.390 | **4.692 (+6,9%)** |
| Số ca nhiều hơn / bằng / ít hơn | – | **68 / 20 / 0** |
| Thời gian trung bình mỗi tờ (máy thử) | ~5 giây | ~3,4 giây |
| Ca chậm nhất | 56 giây | ~10 giây |

Khuôn tròn thực tế của xưởng (khe 1 mm):

| Khuôn tròn | 2,5 cm | 3 cm | 4 cm | 5 cm | 6 cm | 7,5 cm | 8 cm |
|---|---|---|---|---|---|---|---|
| Khuôn xưởng | 162 | 114 | 63 | 42 | 27 | 18 | 14 |
| Bản cũ | 154 | 108 | 63 | 42 | 25 | 16 | 16 |
| **Bản mới** | **174** | **118** | **67** | **42** | **28** | **18** | **16** |

Khuôn xưởng 2,5 cm làm trên tờ 33 × 35 cm; bản mới trên đúng tờ 33 × 35 cm cũng được 174 con.

Một số biên dạng khác (khe 1 mm, cũ → mới): tim 49 → 55, giọt nước 49 → 54, sao 5 cánh 64 → 75,
mũi tên 54 → 68, tam giác 119 → 130, hình thang 94 → 99, trăng khuyết 83 → 89, mũ cong 94 → 101,
mèo 44 → 50, thỏ 50 → 54. Khuôn chữ L lồng ghép: bộ cũ vẫn tốt hơn (71 con) nên tool chọn bộ cũ.

## 5. Giới hạn và việc tiếp theo

- **Chưa chạy trong Illustrator thật** ở lần cập nhật này: số liệu trên đo bằng bộ test Node với
  biên dạng mô phỏng và các khuôn lấy từ file thật đã có trong `tests/`.
- Khuôn **khác nhau** trên cùng tờ: từ v2.18.0 dùng bộ chia khu (`docs/THIET_KE_DAN_BE_CHIA_KHU.md`);
  bộ tìm cũ chỉ còn là phương án cứu hộ khi không chia khu được.
- Đây là tìm kiếm có kiểm chứng, không cam kết tối ưu toán học tuyệt đối cho mọi biên dạng.
  Hình lồng ghép phức tạp (kiểu chữ L) đôi khi bộ cũ tìm được nhiều hơn — đã có thi đua nên
  tool không bao giờ chọn phương án ít con hơn bộ cũ trong cùng lần chạy.
- Mỗi tờ mất khoảng 2–5 giây (khuôn cong nhiều điểm có thể tới ~10 giây); panel tạm đứng trong
  lúc tính, như bản cũ.

### Thử trong Illustrator

1. Tắt hẳn Illustrator, cập nhật thư mục `DanCardCEP`, mở lại; chân panel phải hiện **v2.17.0**.
2. Dàn thử: khuôn tròn 3/4/5 cm (so với số con khuôn xưởng), tim hoặc giọt nước, và khuôn lạ
   nhất đang có; thử cả khe 1 mm và 2 mm.
3. Kiểm tra: số con, khe giữa các khuôn, khoảng cách tới chấm PON, canh giữa tờ, Khuôn/Bài
   đúng layer. Ca nào chưa ưng, gửi kèm file AI để thêm vào bộ test.

## 6. Chạy kiểm thử

```sh
node tests/dan_be_rows.test.js          # lõi xếp hàng lồng: khuôn xưởng, biên dạng tổng quát
node tests/dan_be_multiband.test.js     # vòm 40 × 70 khe 5 mm, bất biến 4 hướng xoay
node tests/dan_be_alternating.test.js   # tam giác/hình thang, khuôn tí hon, bài chung khuôn
node tests/dan_be_centering.test.js     # canh giữa và báo PON chặn tâm
```

Chạy toàn bộ: `for t in tests/*.test.js; do node "$t" || echo "FAIL $t"; done`
