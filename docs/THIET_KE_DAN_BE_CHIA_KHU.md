# Thiết kế: Dàn trộn nhiều mẫu theo khu (dự kiến v2.18.0)

_Đã chốt với anh Lộc ngày 21/10/2026 · lõi `DanCardCEP/js/dan_be_nester.js` + bộ chia khu mới `dan_be_zones.js`_

## 1. Mục tiêu

Khi dàn **nhiều mẫu khác nhau trên một tờ**, bản v2.17 vẫn dùng bộ tìm cũ: các mẫu xen kẽ
nhau, số con chia đều tuyệt đối, chỉ phủ khoảng 42–58 % tờ (dàn riêng từng mẫu phủ 54–83 %).
Bản này thay bằng **bộ chia khu** tự suy nghĩ cách chia tờ, với ba yêu cầu của anh Lộc:

1. **Lấp đầy tờ**: nhiều con nhất có thể.
2. **Không lộn xộn**: con cùng mẫu luôn nằm gần nhau thành cụm/khu; khách nhìn gọn, dễ phân loại.
3. **Số con các mẫu gần bằng nhau**: chia đều trước; dư hoặc thiếu do lấp chỗ trống thì chấp nhận.

Ước lượng thô (khe 2 mm, khu cách 5 mm, chưa khép khu, chưa lấp kẽ): tròn 25 + tim + sao 48 → ~65–69 con;
card 92×56 + tròn 30: 23 → ~40–54; lá + mèo + thỏ: 30 → ~43–45; vòm + trăng + giọt + xương: 32 → ~42–49.

## 2. Panel

Dưới tick có sẵn **"Dàn nhiều mẫu vào một tờ"**:

- Khi tick ô đó, hiện thêm tick **"Chia khu cách nhau"**, **mặc định tắt**.
- Bật tick đó thì hiện ô **"Khoảng cách khu (mm)"**, mặc định **5**.
- Gợi ý ngắn: "Không tick: các khu cách nhau bằng khe thường."
- Trong lúc tính, ô kết quả hiện **"Đang suy nghĩ… phương án x/y"** và cập nhật dần; panel không đứng im cả lượt.

Không tick "Dàn nhiều mẫu vào một tờ" (mỗi mẫu một tờ) thì không đổi gì so với v2.17.

## 3. Luật dàn

Gọi các mẫu có **đường bế giống hệt nhau** là một **nhóm khuôn**. "Giống hệt" là trùng nhau sau khi
bỏ qua vị trí trên artboard, điểm bắt đầu path, chiều path, thứ tự group/compound và xoay 0/90/180/270.

| Trường hợp | Cách dàn |
|---|---|
| Tất cả mẫu cùng một nhóm khuôn | Dàn **y như một mẫu** (lõi xếp hàng lồng hiện tại, vị trí các con không đổi). Chỉ đổi cách gán bài: mỗi bài một **cụm liền nhau**, chênh nhau tối đa 1 con. Không chừa khoảng cách khu. |
| Có từ 2 nhóm khuôn trở lên | **Chia khu**: mỗi nhóm khuôn một khu. Trong khu dàn như một mẫu, các bài cùng khuôn chia thành cụm liền nhau. |
| Khoảng cách giữa hai khu | Tick bật: `max(ô mm, khe)`, mặc định 5 mm. Tick tắt: bằng khe thường giữa 2 khuôn. Luôn đo giữa **đường bế thật** gần nhất của hai khu. |
| Số con | Chia đều theo **bài** trước, được nhiều nhất bao nhiêu thì lấy bấy nhiêu. Chỗ còn dư cho mẫu đang ít con trước, sau đó cho mẫu nào vừa. **Bài nào cũng phải có mặt.** |

Hai luật cũ (đánh số theo bảng điều kiện trong `docs/KE_HOACH_DAN_BE_DECAL.md`) được thay theo yêu cầu mới:

- Luật cũ #7 "nhiều bài chung một khuôn: chia **xoay vòng** A-B-C" → **gom cụm**, vẫn chênh tối đa 1 con.
- Luật cũ #8 "khuôn khác nhau: luân phiên, **cân bằng tuyệt đối**" → **chia khu**, gần bằng nhau.

Mọi luật hình học khác giữ nguyên: khe theo đường bế thật (kể cả khe 0), trong lề tờ, né PON tính
từ mép chấm, không lọt vào lỗ compound, chỉ xoay 0/90/180/270 và tịnh tiến, không sửa dữ liệu
nguồn, cùng đầu vào thì ra cùng kết quả.

## 4. Bộ chia khu suy nghĩ thế nào

Toạ độ tính trong vùng dùng được của tờ (đã trừ lề). `s` là khoảng cách khu, `g` là khe.

1. **Gom nhóm khuôn.** So từng cặp mẫu theo định nghĩa ở mục 3. Mỗi nhóm khuôn `c` có `m_c` bài.
2. **Tìm hiểu từng khuôn.** Dàn thử nhanh mỗi khuôn trên cả tờ bằng lõi xếp hàng lồng, theo hướng chuẩn
   của khuôn. Từ bố cục đó lập hàm ước lượng `f_c(rộng, cao)`: số con nằm gọn trong một khung cỡ đó.
3. **Nghĩ ra các cách chia khu.** Mỗi cách là một **cây cắt thẳng**: một lá là một khu của một nhóm
   khuôn; một nút chia khung theo chiều **ngang** (các khu chồng từ trên xuống) hoặc **dọc** (xếp từ trái
   sang), giữa hai phần con cách nhau `s`.
   - Một tầng: dải ngang hoặc dải dọc, đủ mọi thứ tự khi có ≤ 4 nhóm khuôn. Từ 5 nhóm trở lên chỉ lấy
     các thứ tự theo diện tích khuôn tăng/giảm dần và các vòng xoay của chúng.
   - Hai tầng (từ 3 nhóm khuôn): chia nhóm khuôn làm hai phần, tầng ngoài một chiều, tầng trong chiều kia.
4. **Ước lượng từng cách.** Tìm số con đều lớn nhất `N`: mỗi lá cần đủ chỗ cho `m_c × N` con, cộng các
   khoảng `s`, vẫn vừa khung (tìm nhị phân trên `N`). Phần dư lần lượt cho lá có ít con mỗi bài nhất nếu
   thêm được con, rồi tới lá nào thêm được. Xếp hạng các cách theo: tổng con, rồi số con của bài ít nhất,
   rồi ít ranh giới khu hơn, rồi thứ tự sinh ra.
   _Bổ sung sau soát mã (22/10/2026):_ mỗi cách còn được chấm ở vài mức `N` thấp hơn (tới 80 % mức đều
   lớn nhất đạt được trên mọi cách, tối đa 6 mức); ở các mức này phần dư cho lá thêm được nhiều con nhất
   mỗi mm. Nhờ vậy bớt một hàng/cột của mẫu lớn khi mẫu nhỏ nhờ đó chen được nhiều con hơn hẳn, mà
   không bài nào thiếu quá 20 % so với mức chia đều.
5. **Dàn thật** `K` cách đứng đầu (`K` = 4 với 2 nhóm khuôn, 6 với 3–4 nhóm, 5 với từ 5 nhóm). Dàn từng
   lá bằng lõi xếp hàng lồng trong đúng khung của nó, có chấm PON thật.
   - **Khép khu:** các phần con xếp nối tiếp. Phần sau được đẩy sát phần trước tới khi đường bế hai bên
     cách đúng `s`. Phép đo dùng biên dạng thật nở thêm `s` (theo từng cột hoặc hàng), nên hai khu được lồng
     vào nhau ở mép mà vẫn đủ `s`. Đẩy xong phải còn né PON và nằm trong lề; nếu không thì đẩy ít lại.
   - **Mở rộng khu cuối:** khoảng dư dồn về cuối khung; lá cuối của mỗi nút nhận luôn phần còn lại sau khi
     các lá trước đã khép, và bước lấp chỗ trống dùng lưới của chính lá đó để lấp phần dư (thay cho dàn lại
     tối đa 3 vòng như dự kiến ban đầu).
6. **Lấp chỗ trống.** Thử thêm con vào các kẽ còn lại. Một con mới chỉ được đặt **sát một con cùng nhóm
   khuôn**: cách con cùng khuôn ≥ `g`, cách khu khác ≥ `s`, né PON, trong lề, và **không làm hai nhóm khuôn
   hết tách được** bằng một đường ngang/dọc qua tâm các con (không bò sang chỗ trống của khu khác). Nhờ vậy
   cụm không bao giờ bị lẫn.
7. **Gán bài trong khu.** Chia đôi đệ quy theo cạnh dài hơn của cụm: mỗi lần tách các con theo toạ độ thành
   hai phần, đúng số con dành cho mỗi nửa nhóm bài. Kết quả là các cụm gọn, gần như hình chữ nhật, chênh
   tối đa 1 con. Luật này dùng cho cả trường hợp tất cả cùng một khuôn.
8. **Canh giữa** toàn bố cục trong tờ nếu PON cho phép; nếu không thì giữ lệch ít nhất và báo
   "Canh tâm bị giới hạn bởi vùng né PON", như hiện nay.
9. **Chốt chặn độc lập** trên đường bế thật: cùng nhóm khuôn ≥ `g`, khác nhóm ≥ `s`, trong lề, né PON,
   không chồng hay lọt lỗ. Cách nào không qua thì loại.
10. **Chọn** cách qua chốt chặn có tổng con nhiều nhất; bằng nhau thì lấy cách có bài ít nhất nhiều con hơn,
    rồi ít ranh giới khu hơn, rồi thứ tự cố định.

Cuối cùng, cách vừa chọn được dàn lại các lá với mức tìm đầy đủ như khi dàn một mẫu, rồi qua chốt chặn
lần nữa. Nếu lần dàn lại cho ít con hơn thì giữ kết quả cũ.

## 5. Thành phần và giao tiếp

| File | Thay đổi |
|---|---|
| `DanCardCEP/js/dan_be_zones.js` (mới) | Bộ chia khu: gom nhóm khuôn, hàm ước lượng, sinh và xếp hạng cây chia khu, dàn thật, khép khu, lấp chỗ trống, gán bài, chốt chặn hai mức khe. Không đụng tới Illustrator. |
| `DanCardCEP/js/dan_be_nester.js` | `nest()` điều phối theo bảng ở mục 3. Mở cho bộ chia khu các phần lõi cần dùng: dàn một khuôn trong một khung, chuẩn hoá, so khuôn, đo khoảng cách đường bế. Thêm `nestAsync(input, onProgress, onDone)`. |
| `DanCardCEP/index.html` | Tick "Chia khu cách nhau", ô "Khoảng cách khu (mm)", nạp `dan_be_zones.js` trước `dan_be_nester.js`. |
| `DanCardCEP/js/main.js` | Ẩn/hiện hai điều khiển mới, đọc giá trị, gọi `nestAsync` và hiện tiến độ. |
| `tests/` | Bộ test mới cho chia khu; sửa đúng phần luật #7/#8 trong các test cũ. |

Đầu vào `nest()` thêm một trường tuỳ chọn: `zoneGapMm`. Bỏ trống hoặc 0 nghĩa là các khu cách nhau
bằng khe. Kết quả giữ đúng định dạng cũ (`ok, slots[{mi, vi, x, y, angle}], count, counts, mode, detail,
centering`), nên phần vẽ trong Illustrator (`dcDanBeRender`), dàn 2 mặt và tách layer Khuôn/Bài/PON không
phải sửa. Có thêm `zones` (khuôn nào ở khu nào, bao nhiêu con) để báo cáo.

## 6. Thời gian và tiến độ

- Khối lượng tìm **cố định theo độ khó** (số nhóm khuôn, cỡ khuôn), không theo đồng hồ, nên máy nhanh hay
  chậm đều ra cùng kết quả. Hạn giờ 35 giây chỉ là chốt an toàn.
- Một nhóm khuôn: khoảng 3 giây như hiện nay. 2–3 nhóm: khoảng 5–15 giây. Nhiều nhóm hoặc hình phức tạp:
  tối đa khoảng 30 giây.
- Lượt dàn thử trong lúc xếp hạng dùng mức tìm gọn. Kết quả dàn một lá được nhớ lại theo (khuôn, cỡ khung,
  vị trí chấm PON so với khung) để không dàn lại.
- `nestAsync` chia việc thành từng bước nhỏ (mỗi bước là một lần dàn một lá) và nhường panel cập nhật
  "Đang suy nghĩ… phương án x/y" giữa các bước. `nest()` chạy cùng các bước đó liền một mạch, dùng cho test.

## 7. Khi có sự cố

- Không chia được khu nào để **bài nào cũng có mặt**, hoặc không cách nào qua chốt chặn: dùng cách dàn
  xen kẽ cũ và ghi rõ trong báo cáo: "Chia khu không xếp đủ mọi mẫu, tạm dùng cách dàn xen kẽ cũ."
- Ô khoảng cách khu nhập sai (không phải số, âm, hoặc > 50 mm): panel báo lỗi, không dàn.
- Lỗi bất ngờ trong bộ chia khu: bắt lỗi, dùng cách cũ, báo rõ, không làm treo panel.

## 8. Kiểm thử và tiêu chí đạt

Bộ test mới `tests/dan_be_zones.test.js`, có bộ đo hình học độc lập riêng như các test hiện có:

1. **Nhận nhóm khuôn**: cùng khuôn nhưng file đặt xoay 90°, path bắt đầu ở điểm khác hay đổi chiều vẫn là một nhóm.
2. **Cùng một khuôn, 3 bài**: vị trí các con trùng hệt khi dàn một mẫu; mỗi bài một cụm liền; chênh ≤ 1 con.
3. **Trộn khuôn**: 4 bộ ở mục 1, thêm bộ 2 khuôn có 2 bài chung khuôn, thêm bộ 5–6 khuôn nhỏ; mỗi bộ chạy
   cả tick tắt và tick bật (5 mm). Mỗi ca phải đạt:
   - bài nào cũng có mặt;
   - mỗi bài là **một cụm liền**: hai con là "kề nhau" khi khung bao cách nhau ≤ khe + một nửa cạnh dài nhất
     của con lớn hơn;
   - hai nhóm khuôn bất kỳ **tách được bằng một đường thẳng ngang hoặc dọc**: tâm mọi con của nhóm này nằm
     một phía, tâm mọi con của nhóm kia nằm phía còn lại (không xen nhau);
   - khoảng cách trên đường bế thật: cùng nhóm ≥ khe, khác nhóm ≥ khoảng cách khu; trong lề; né PON;
   - **nhiều con hơn** cách dàn cũ với cùng đầu vào;
   - chạy hai lần ra **y hệt**; mỗi ca ≤ 30 giây.
4. **Tổng cộng** trên 4 bộ của mục 1: hơn cách cũ ít nhất **30 %** khi tắt tick, **25 %** khi bật tick 5 mm.
5. **Cứu hộ**: tờ quá nhỏ cho mọi mẫu → trả về cách cũ kèm thông báo.
6. **nestAsync**: gọi tiến độ ít nhất một lần với ca trộn khuôn; kết quả trùng `nest()`.
7. **Panel**: có hai điều khiển mới, tiếng Việt, tick mặc định tắt, chỉ hiện khi tick "Dàn nhiều mẫu vào một tờ".
8. **41 test hiện có** vẫn qua. Chỉ sửa các khẳng định về luật #7/#8: `rows` (xoay vòng, cân bằng khác khuôn),
   `alternating` (gán xoay vòng), `irregular` và `mixed` (cân bằng tuyệt đối). Mọi kiểm tra hình học và mốc số
   con giữ nguyên.

Trước khi phát hành, xuất ảnh các tờ trộn mẫu để anh Lộc xem bằng mắt.

## 9. Ngoài phạm vi lần này

- Xoay góc lẻ (ngoài 0/90/180/270).
- Nhập số lượng riêng cho từng mẫu và tự chia ra nhiều tờ.
- Nhét con của mẫu này vào kẽ trong khu của mẫu khác: trái luật "không lộn xộn".
- Chạy bằng Web Worker: panel không có cờ cho phép file:// nên dùng chia bước bằng `setTimeout`.

## 10. Rủi ro

| Rủi ro | Cách giảm |
|---|---|
| Chạy lâu vì dàn thật nhiều lá | Mức tìm gọn khi xếp hạng, nhớ kết quả theo khung, giới hạn `K` theo độ khó |
| Ước lượng lệch so với dàn thật | Dàn thật `K` cách đứng đầu chứ không tin một ước lượng |
| Khép khu đẩy con vào vùng né PON | Kiểm tra PON sau khi đẩy, đẩy ít lại nếu cần; chốt chặn cuối cùng |
| Nhiều mẫu lớn trên tờ nhỏ, không đủ chỗ | Cứu hộ bằng cách cũ, báo rõ |
