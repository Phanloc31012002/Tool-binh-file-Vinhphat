# Lịch sử cập nhật — Công cụ bình

_Tác giả: Lộc (Code dạo) · Tester: Tân (1 cú) · Duẫn (CTL Offset)_

## v2.16.3 — PHÁT HÀNH BẢN SAVE PDF CTL

- PHÁT HÀNH BẢN SAVE PDF CTL

---

## v2.16.2 — Keo gáy A4 tối đa 21,2 × 30 cm (03/10/2026)

- **Tờ 65 × 86**: khung A4 tối đa **21,2 × 30 cm**. Phóng/thu đồng đều hai trục cho bài nằm vừa khung, canh giữa phần dư; không kéo méo để ép tỷ lệ nguồn vào khung. Giữ thứ tự trang và đăng ký A/B.
- **Tờ 65 × 43 / 43 × 32,5**: dùng khung riêng, thu đều cạnh tương ứng về tối đa **20,9 cm** nếu cần; không thu các trang nằm trên tờ lớn. A4 khung 21,2 × 30 xuống tờ nhỏ thành khoảng **20,9 × 29,575 cm**, không bóp riêng ngang. PON cắt và vị trí trang theo đúng khung của từng tờ; giữ kích thước giấy thực 64,8 × 41,8 / 42,8 × 31,3 cm.
- Tự trở 4 trang canh theo tâm ô cố định, không theo bounds tổng của hai bài có tỷ lệ khác nhau. Dấu cắt ở sát biên giấy vẫn có chiều dài, không biến thành điểm. Kiểm tra giới hạn khung/khổ giấy trước khi raster; nạp engine phiên bản 11. Chỉ cài local, chưa phát hành GitHub.
- Kiểm chứng: 30 bộ kiểm thử tự động qua; native Illustrator chạy bài mẫu A4 20 trang gồm A/B + tự trở 4 với bốn tỷ lệ nguồn khác nhau, đo cùng scale X/Y, đúng tâm ô, A/B và PON, nguồn không chọn giữ nguyên. Chạy thêm A5 tự trở 4 ở khổ nhập 15 × 21,15 cm, thu đều cạnh dài xuống 20,9 cm và kiểm tra ghi chú/PON nằm trong tờ nhỏ.

---

## v2.16.1 — CTL lưu bộ AI/JPG/ZIP, Keo gáy không bóp, raster 500 ppi (03/10/2026)

- **Lưu CTL Offset**: thêm ô **Nội dung sau RUỘT N / BÌA**. Mỗi tờ xuất `.ai`, `.jpg` và `.zip` cùng tên vào thư mục đã chọn; ZIP chứa đúng hai file AI + JPG, vẫn giữ hai file rời. A/B chung một AI hai artboard và một JPG toàn bài (**Use Artboards tắt**). Giữ các nút theo khổ vừa dàn, không đổi lưu PDF ở tab khác.
- JPG dùng Export As native: **CMYK, Quality 10 Maximum, Baseline Standard, 300 ppi, Type Optimized (Hinted), Embed ICC Profile**. Kiểm tra native trên máy hiện tại nhúng **U.S. Web Coated (SWOP) v2**. JPG giữ 300 ppi theo xác nhận riêng, không tăng cùng raster xử lý bài.
- Nén ZIP chạy nền sau khi xuất, không chặn Illustrator trong lúc nén. Tên tiếng Việt/ký tự hợp lệ được truyền như dữ liệu, không ghép vào lệnh shell; lệnh không dài theo số ruột. Không ghi đè AI/JPG/ZIP có sẵn. Xuất JPG/nén lỗi thì giữ AI đã lưu và các JPG hoàn tất, báo rõ lỗi; ZIP chỉ đổi sang tên cuối sau khi kiểm tra đủ hai file. Chỉ copy/group/dịch nguyên cụm trên bản sao, không thay đổi tài liệu nguồn.
- **Keo gáy**: bỏ ép ngang/dọc riêng. Phóng/thu đồng đều hai trục, giữ tỷ lệ; kiểm tra toàn bộ trang trước khi tạo artboard/raster. Sai tỷ lệ với khổ nhập thì báo số trang và giữ nguồn; kiểm tra khung nguồn với dung sai 0,2 mm, không tự thêm viền trắng lớn. Sau raster vẫn dùng cùng tỷ lệ hai trục, tính đến làm tròn pixel, không báo sai giữa chừng khi phóng nguồn nhỏ. Không thu nhỏ thêm để vừa tờ, không đổi thứ tự trang, A/B hay khổ PON. Nạp engine phiên bản 10.
- **Raster xử lý bài**: thống nhất **500 ppi** cho nút Raster, logic raster/clip và các bước raster khi dàn card, catalogue, CTL, keo gáy, theo mẫu; cập nhật thông báo/tooltip. Helper chung ép 500 ppi cả với caller cũ. Ảnh có sẵn ở luồng vốn bỏ qua raster vẫn được giữ, không nội suy lại để giả tăng chất lượng.
- Kiểm chứng native Illustrator 28: lưu/mở lại AI bìa và ruột A/B, đủ vector/raster/PON/ghi chú, nguồn không đổi; đọc JPG xác nhận CMYK, Baseline, 300 ppi, chất lượng tối đa và ICC SWOP. Nén/mở ZIP, so hai nội dung byte-for-byte với file rời; thử tên Unicode/ký tự đặc biệt, trùng file, thiếu JPG và lỗi xử lý. Đo nút Raster/entry JSX/helper chung đều 500 ppi, Keo gáy giữ hai trục đồng đều và từ chối tỷ lệ sai trước raster. Chỉ cài local, chưa phát hành GitHub.

---

## v2.16.0 — phát hanh test ok

- phát hanh test ok

---

## v2.15.20 — KTS ghép nhiều kích thước, sửa canvas CTL và lưu AI theo cụm (03/10/2026)

- **Dàn KTS**: tick **Dàn nhiều mẫu vào một tờ** để ghép các kích thước khác nhau chung tờ. Đo riêng từng mẫu, thử nhiều cách xếp/xoay 0°/90° và tận dụng ô trống theo đúng kích thước; không quy tất cả mẫu về ô lớn nhất, không thu nhỏ bài. Tự nhân bản, số con giữa các mẫu chênh tối đa 1. Nếu không ghép được ít nhất một con mỗi mẫu thì báo trước khi tạo kết quả. Tìm kiếm có giới hạn, không cam kết tối ưu tuyệt đối.
- Bài hai mặt vẫn khóa cặp **trái = trước, phải = sau** theo hàng. Mặt sau dùng chung sơ đồ vị trí đã chọn, đối xứng trái–phải, không lật gương chữ/hình. Canh giữa theo ô chung để sai số đo nhỏ của hai mặt không làm lệch đăng ký. Giữ lề 3 mm, khe 0 mm, chế độ cùng kích thước cũ và xóa artboard cũ chỉ khi dàn thành công.
- **CTL bấm ghim/keo gáy**: đọc biên canvas thực từ phần đầu file AI đã lưu thay vì mặc định ±7200 pt, vẫn bắt đầu tại vị trí nguồn. Kiểm tra/tạo đủ khung trước khi raster hoặc thay PON; lỗi biên/tạo khung thì dọn riêng khung mới, giữ nguồn. Trả lại chế độ tọa độ của người dùng.
- **Keo gáy A5 tự trở 8 trang** 14,5 × 20,7 cm dùng đúng artboard **64,8 × 41,8 cm**: bài 58 × 41,4 cm vừa tờ, không bị điều kiện cộng dư lề PON đẩy lên khổ lớn. Nét PON sát biên được giới hạn trong tờ, không bóp bài. Nếu bài thực sự không vừa thì vẫn dùng khổ lớn. Ghi chú/nút Lưu AI lấy đúng khổ kết quả.
- **Lưu AI CTL**: trên tài liệu tạm, gom bài + PON + ghi chú của mỗi artboard thành một cụm và dịch vị trí **một lần cho cả cụm**, rồi trả nhóm về layer tương ứng. Không snap từng object nữa. Bỏ group nguồn rỗng do raster; chỉ mở khóa bản sao/layer tạm, không group, di chuyển hay mở khóa nguồn. Illustrator vẫn phải copy object qua tài liệu tạm; chưa đo tăng tốc trên bài sản xuất lớn. Giữ bìa/ruột thành file riêng, A/B chung file AI, không ghi đè file có sẵn.
- Kiểm chứng: 27 file kiểm thử tự động; KTS chạy native một/hai mặt với 3 kích thước 90 × 50, 60 × 40, 75 × 65 mm ra 25 con (9–8–8), đo không chồng bài, đủ lề, đúng đối xứng và nguồn không đổi. CTL chạy trên bản sao file canvas lệch gốc, cả hai kiểu dàn thành công; hai ca vượt biên bị chặn trước raster và giữ nguồn. Lưu/mở lại 3 AI bìa/ruột tự trở/ruột A+B, kiểm tra bài/PON/ghi chú và nguồn không đổi. Chỉ cài local, chưa phát hành GitHub.

---

## v2.15.19 — XUẤT TEST OK

- XUẤT TEST OK

---

## v2.15.18 — Keo gáy đồng bộ khổ giấy/PON, A5 tự trở 4 trang (03/10/2026)

- Keo gáy dùng cùng khổ artboard thực với Đóng ghim giữa: form 65 × 86 = **85,8 × 63,8 cm**, form 65 × 43 = **64,8 × 41,8 cm**. Bỏ khổ cũ 85,9 × 62,6 / 64,9 × 41,9 lấy từ bounds ngoài của PON.
- Đồng bộ độ dài/nét PON giấy và đặt tim hai nét tại đúng từng góc artboard, không lùi vào nửa stroke như trước. Mỗi tờ vẫn có bốn dấu góc (8 nét).
- Form A5 AB 32 trang / TT16 thêm dấu cắt trên và dưới tại biên cột 1 và 3: **thêm 4 nét**, tổng 16 nét cắt/tờ, để chia cụm 2 trang. Giữ thứ tự trang, xoay và đối xứng A/B; không vẽ nét xuyên artwork.
- A5 tự trở 4 trang dùng form **43 × 32,5**, artboard thực **42,8 × 31,3 cm**, khe giữa 5 mm như Bấm ghim. A4 tự trở 4 vẫn dùng form 65 × 43. Kiểm tra vừa giấy trước khi raster/tạo artboard; PON cắt sát biên giữ cả stroke trong tờ.
- Ghi chú A5 4 trang chuyển sang dải trắng trên khi lề trái không đủ, đo kích thước chữ/icon và thu chữ khi cần, không đè vào bài. Ô ghi chú hiện tên form nhỏ đúng; nút Lưu AI lấy đúng khổ mới từ artboard. Không đổi định dạng lưu AI hay vị trí bắt đầu dàn.
- Nút Keo gáy nạp script phiên bản 8, tránh dùng engine cũ. Đạt 25 file kiểm thử tự động và 6 lần thử trực tiếp trong Illustrator: A5 4 trang thường/tối đa/nguồn ngang, A5 60 trang, A4 32 trang và A5 40 trang khổ tràn. Đo khổ giấy/PON bốn góc, đủ bốn nét chia cụm, bài/ghi chú không chồng lấn hoặc tràn tờ, A/B đối diện đúng, giữ object ngoài selection và trả lại trạng thái app. Đã xem ảnh render; cài local, chưa phát hành GitHub.

---

## v2.15.17 — Copy ghi chú trong Dàn theo mẫu, CTL Offset lưu AI (03/10/2026)

- Chuyển toàn bộ Copy ghi chú từ Dàn KTS sang mục thu gọn/mở rộng **Copy ghi chú** trong tab **Dàn theo mẫu**, đặt sau Áp mẫu và trước Lưu PDF. Mặc định thu gọn.
- Giữ ô F1, F2… và hai nút **Điền ghi chú bài 1 mặt** (artboard 1, 2, 3…) / **Điền ghi chú bài 2 mặt** (artboard 1, 3, 5…). Để trống vẫn copy nguyên ghi chú; không đổi logic JSX.
- Thông báo tiến trình/kết quả/lỗi hiện ngay trong mục mới, không chạy sang tab Dàn KTS. Hai nút cùng khóa trong lúc xử lý và mở lại khi có kết quả.
- Đổi riêng nút lưu trong tab **CTL Offset** (Đóng ghim giữa + Keo gáy) thành **Lưu AI** theo khổ vừa dàn. Bìa/từng ruột vẫn ra file riêng; hai artboard A/B của cùng ruột nằm chung một `.ai`, giữ tên artboard, layer, object và ghi chú có thể chỉnh sửa. Các tab khác vẫn lưu PDF.
- Lưu AI thuần có nén, nhúng ảnh liên kết và profile màu, không tạo kèm phần PDF. Giữ cơ chế kiểm tra khổ, không ghi đè file có sẵn, xóa riêng đầu ra chưa hoàn tất khi lỗi và trả lại trạng thái tài liệu nguồn. Không group/di chuyển/undo trên nguồn; chưa thay cơ chế copy từng object nên không cam kết hết thời gian chờ trên file lớn.
- Không đổi vị trí/bắt đầu PON hoặc cách dàn CTL theo yêu cầu bỏ số 2. Nút lưu nạp script phiên bản 3 để thay engine PDF cũ.
- Kiểm thử vị trí/ID không trùng, mở–thu accordion, gọi đúng chế độ một/hai mặt, tiền tố và thông báo; giữ kiểm thử sao chép ghi chú hiện tại. Lưu và mở lại trực tiếp 3 file AI trong Illustrator (bìa, ruột tự trở, ruột A/B), kiểm tra đủ artboard/kích thước/tên, vector/raster/PON/ghi chú và nguồn không thay đổi. Bản sửa cài local, chưa phát hành GitHub.

---

## v2.15.16 — Keo gáy A5 ghép 32 trang trên cùng tờ AB (03/10/2026)

- A4 giữ form 16 trang/tờ AB. A5 tự nhận theo khổ một trang đến 15 × 21,15 cm, ghép hai tay 16 trang liên tiếp lên cùng một cặp artboard A/B: 1–32, rồi 33–64… Không dùng form gấp 32 mới và không thêm trang trắng.
- Giữ nguyên thứ tự trang của form A4 trong từng tay; xoay cụm để vừa tờ lớn 65 × 86. Mặt B đảo vị trí hai cụm và góc xoay để lật ngang đúng cặp trang, không lật gương chữ/hình. Hỗ trợ nguồn nhập ngang như 20 × 14 cm.
- Luôn dàn phần AB trước; phần dư A5 làm tự trở 16 trang rồi 8/4 trang. Ví dụ 48 trang = AB 32 + TT16; 60 trang = AB 32 + TT16 + TT8 + TT4. Phần dư 12 vẫn giữ thứ tự lồng TT8/TT4 cũ.
- PON cắt bám theo lưới hai cụm, không vẽ nét vào giữa artwork. TT8 A5 dùng tờ 65 × 43 khi cả bài và PON vừa; nếu phần tràn vượt tờ nhỏ thì dùng tờ lớn, không tự bóp bài.
- Thêm ghi chú và nút lưu PDF cho TT16; mỗi cặp AB vẫn lưu chung một PDF, tờ tự trở lưu riêng. Lập dữ liệu PDF trước khi trả lại chế độ tọa độ artboard, tránh mất nút lưu PDF.
- Kiểm tra toàn bộ vị trí canvas trước khi raster; tạo artboard lỗi thì dọn khung mới, giữ khung nguồn. Chỉ xóa artboard cũ sau khi dàn thành công. Nút Keo gáy nạp script phiên bản 7 thay cho engine cũ.
- Kiểm chứng trực tiếp trên 6 tài liệu thử riêng trong Illustrator: A5 32/60 trang, khổ tràn 15 × 21,15, nguồn ngang, TT16 riêng và A4 32 trang; kiểm tra trang đối diện, góc xoay raster, PON, ghi chú và dữ liệu PDF. Đạt 23 file kiểm thử tự động. Bản sửa cài local, chưa phát hành GitHub.

---

## v2.15.15 — Đặt PON tiếp mà không xóa layer (03/10/2026)

- Dấu cắt tự động không còn bỏ qua toàn bộ layer PON: chỉ nhận diện nét PON do tool tạo, vẫn xử lý bài/ảnh/group nằm trong cùng layer.
- Dùng lại layer `Dau cat tu dong`, giữ dấu cũ và thêm dấu cho bài mới. Bấm lại cùng vị trí không tạo nét trùng; hỗ trợ dấu cũ chưa có nhãn nhận diện.
- Tạm mở khóa layer để vẽ, khôi phục trạng thái khóa và layer đang làm việc; chuẩn hóa tọa độ khi xử lý nhiều artboard. Lỗi tạo nét chỉ dọn nét mới của lượt lỗi, không xóa PON cũ.
- Thêm kiểm tra phiên bản script khi bấm Đánh dấu cắt để nạp bản sửa thay cho engine cũ.
- Kiểm chứng trực tiếp trong Illustrator: 8 ca đặt liên tục/đặt lại, bài trong layer PON, dấu cũ/mới được chọn kèm, layer khóa/ẩn và artboard khác; giữ nguyên bài và dấu cũ. Đạt toàn bộ 22 file kiểm thử tự động. Bản sửa cài local, chưa phát hành GitHub.

---

## v2.15.14 — Giới hạn canvas và chỉ giữ artboard kết quả mới (03/10/2026)

- Artboard đầu bắt đầu ở góc trên trái vùng canvas như KTS, theo lựa chọn mới thay cho vị trí file PON. Chạy ngang rồi xuống hàng; chừa 10 mm giữa các tờ, tránh artboard và bài nguồn. PON vẫn quyết định khổ tờ và vị trí tương đối các dấu.
- Giữ cặp trước–sau cạnh nhau, canh mép trên và tính bước hàng theo tờ cao hơn nếu hai PON khác khổ. Bỏ xếp cố định 15 tờ mỗi cột; giữ nguyên slot, hướng artwork và chế độ nhiều mẫu.
- Lập kế hoạch đủ tờ trước khi tạo; hết chỗ thì giữ kết quả cũ. Tạo artboard lỗi thì dọn artboard mới và báo lỗi, không bỏ tờ âm thầm. Đọc tối đa 1 MB metadata AI để bù gốc tọa độ canvas; file chưa lưu/không đọc được dùng gốc KTS cũ với kiểm tra lỗi tạo artboard. Không tạo artboard dò hoặc đổi gốc thước trong tài liệu nguồn.
- Các luồng bắt đầu từ góc canvas (KTS, Dàn bế, Offset tự trở/AB/nhiều khổ, Dàn theo mẫu): dàn xong thành công mới xóa toàn bộ artboard cũ, chỉ giữ artboard vừa tạo và chọn tờ đầu. Bước dọn chỉ xóa khung, không thêm thao tác xóa object/layer nguồn. Dàn lỗi giữ artboard cũ; nếu Illustrator không xóa được khung nào thì báo rõ, không xóa kết quả mới.
- Vá lỗi Offset tự trở một khổ gọi hàm PON giấy chưa được định nghĩa. Tạo đủ PON ở bốn góc như các nhánh KTS và Offset nhiều khổ trước khi dọn artboard.
- Kiểm chứng trực tiếp trong Illustrator bằng tài liệu thử riêng: 7 ca Dàn theo mẫu (gốc thước, một/hai mặt, nhiều mẫu, 26 tờ xuống hàng, 14 cặp khác khổ, hết canvas giữ kết quả cũ), cùng 9 ca dọn artboard KTS/Offset/Bế và lỗi đầu vào. Không chạy xóa artboard trên bài thật đang mở.
- Đạt toàn bộ 21 file kiểm thử tự động; đã cài bản 2.15.14 vào CEP trên máy này sau khi sao lưu bản 2.15.13. Chưa phát hành lên GitHub.

---

## v2.15.4 — Khổ bế tùy chỉnh và PON tự tạo (02/10/2026)

- Bỏ chọn/import file PON trong Dàn bế. Thêm hai ô khổ giấy (cm), mặc định **33 × 35,4 cm**; bên dưới là bốn ô theo thứ tự **trên / dưới / trái / phải** (mm), mặc định **10 / 10 / 10 / 10**.
- Tự tạo bốn chấm PON tròn **5 mm** (0,5 × 0,5 cm), đen 100K, không viền. Các khoảng nhập đo từ **mép artboard đến tâm chấm**; né PON vẫn đo từ mép chấm. Khổ giấy và PON áp dụng cho toàn bộ tờ/cặp hai mặt trong lượt chạy.
- Đặt tờ đầu như Dàn KTS: bắt đầu ở góc trên trái canvas, cách biên canvas 10 mm; đi từ trái sang phải, né artboard và bài nguồn, hết ngang tự xuống hàng. Cặp hai mặt luôn đi cùng hàng, hỗ trợ giới hạn Large Canvas.
- Kiểm tra toàn bộ vị trí trước khi tạo đầu ra; khổ vượt canvas, PON ra ngoài tờ/chồng nhau hoặc số nhập sai sẽ báo lỗi. Không mở/đóng file PON và không sửa bài gốc.
- Giữ khe khuôn, lề, né PON, một/hai mặt, tờ riêng/gộp mẫu và lõi nesting hiện tại. Không thay đổi KTS, CTL hay các chức năng khác.
- Kiểm chứng trực tiếp trong Illustrator bằng tài liệu thử riêng: khổ mặc định 33 × 35,4 cm và khổ đổi 32 × 34 cm với bốn khoảng PON khác nhau; tạo cặp trước/sau, đủ bốn chấm 5 mm mỗi mặt, tâm chấm đúng số nhập và tờ đầu đúng vị trí KTS. Không lưu đè bài gốc.

---

## v2.15.3 — Dàn bế tag hai mặt (02/10/2026)

- Thêm tick **Dàn bế 2 mặt (tag)**. Nguồn được chọn theo từng hàng, thứ tự trái → phải: **Khuôn → mặt trước → mặt sau**. Nếu không chọn object, dùng ba layer **Khuôn bế**, **Mặt trước**, **Mặt sau** cùng số mẫu.
- Khóa từng bộ ba trước khi dàn; thiếu mặt, hàng không rõ hoặc vị trí trái/phải trùng nhau sẽ báo lỗi, không đoán ghép sang mẫu khác.
- Chỉ tối ưu bố cục khuôn một lần. Mỗi tờ tạo cặp artboard trước/sau để **lật ngang như KTS**; mặt sau dùng đúng mẫu, vị trí đối xứng và góc xoay ngược. Không lật gương chữ/hình.
- Khuôn mặt sau là ảnh phản chiếu hình học của khuôn mặt trước đã xoay, kể cả hình lõm/bất đối xứng. PON cũng đối xứng theo tờ và giữ nguyên kích thước chấm. Mỗi mặt giữ layer Khuôn, Bài và PON riêng.
- Giữ chế độ một mặt mặc định, mỗi mẫu một tờ riêng hoặc tick gộp nhiều mẫu. Hai mặt dùng chung số con/tờ, không đếm đôi; file PON chỉ hỏi một lần cho cả lượt.
- Không đổi lõi nesting, khe/lề/né PON, KTS hay CTL. Có kiểm thử bộ ba, nguồn ba layer, bốn góc xoay, đúng mẫu trước/sau, biên khuôn/PON đối xứng và thu hồi đầu ra khi lỗi ở bất kỳ mặt nào.
- Kiểm chứng trong Illustrator trên tài liệu thử riêng: hai mẫu khuôn lõm/bất đối xứng, tám tag với đủ bốn góc xoay; chế độ riêng tạo bốn artboard, chế độ gộp tạo hai. Kiểm tra từng đỉnh khuôn, hướng artwork mặt sau và PON lệch vị trí giữa các góc. Không sửa/lưu đè bài gốc.

---

## v2.15.2 — Khóa cặp KTS và tờ riêng cho từng mẫu bế (02/10/2026)

- Dàn KTS hai mặt: gom hàng nguồn theo kích thước object rồi khóa trái = trước, phải = sau. Lệch Y rất nhỏ không còn đảo vai hai mặt; nguồn không rõ cặp sẽ báo lỗi trước khi dàn.
- Mặt trước và mặt sau dùng chung danh sách mẫu/vị trí đã khóa, giữ nguyên xoay và đối xứng in hai mặt. Không cần khóa layer nguồn bằng tay.
- Dàn bế mặc định mỗi mẫu một artboard, nhân bản đầy tờ riêng. Thêm tick **Dàn nhiều mẫu vào một tờ** để dùng lại cách gộp/luân phiên các mẫu.
- Chỉ chọn file PON một lần cho cả lượt; mỗi tờ giữ đủ bốn chấm, layer Khuôn và Bài riêng. Tái dùng kết quả tính khi biên khuôn giống hệt, cập nhật trạng thái giữa các mẫu.
- Kiểm tra toàn bộ bố cục trước khi vẽ; nếu tạo tờ/layer/bản sao bị lỗi, chỉ thu hồi đầu ra vừa tạo trong lượt đó, không xóa bài nguồn.
- Không đổi lõi dàn biên khuôn, khe/lề/né PON, CTL hay Dàn Offset. Bổ sung kiểm thử đảo mặt, vị trí đối xứng, tờ riêng/tờ gộp và phục hồi khi lỗi.
- Kiểm chứng trực tiếp trong Illustrator trên tài liệu thử riêng: 7 cặp KTS qua cả hai chế độ (147 vị trí đối xứng khi tách mẫu, 21 khi gộp); Dàn bế hai mẫu tròn tạo tờ riêng 42/108 con hoặc tờ gộp 47 con, đúng tâm khuôn và đủ PON. Không lưu đè bài gốc.

---

## v2.15.1 — Dọn Dàn bế cũ và tách nạp script (02/10/2026)

- Bỏ bộ tính Dàn bế cũ `dcDanBe()` và mã phiên bản `dcDanBeVersion` khỏi `dan_card_lib.jsx`; nút Dàn bế chỉ dùng luồng mới.
- Tách kiểm tra/nạp thư viện chung và cầu nối Dàn bế: chỉ nạp lại JSX đang thiếu hoặc cũ, không phụ thuộc hàm Dàn bế đã bỏ.
- Bỏ mục **Dàn Decal** cũ trong tab Dàn file, handler nút và bảng tọa độ/hàm JSX chỉ phục vụ mục đó. Dàn decal theo khuôn tiếp tục dùng **Dàn tối ưu → Dàn bế**.
- Giữ nguyên các phần CTL, Dàn KTS/Offset, Raster, Clip, Resize và các chức năng khác. Không xóa file ghi nhớ PON của người dùng.
- Bổ sung kiểm thử nạp script độc lập và chạy lại bộ kiểm thử Dàn bế. Không xóa bản sao lưu, file AI thử hoặc dữ liệu nguồn.

---

## v2.15.0 — Dàn bế theo biên khuôn thật (02/10/2026)

- Tách thành `js/dan_be_nester.js` (tính bố cục trong CEP) và `jsx/dan_be_bridge.jsx` (đọc/vẽ trong Illustrator). Luồng mới: đọc khuôn/PON → tìm cách xếp → tạo kết quả.
- Tự thử xoay 0°/90°/180°/270°, xếp xen kẽ, tận dụng chỗ lõm và vùng trống; kiểm tra giao nhau và khoảng cách theo đường khuôn, không chỉ theo hình chữ nhật bao ngoài.
- Giữ các ô nhập: khe giữa hai khuôn mặc định **2 mm**, khuôn cách mép tờ **4 mm**, né PON **7,5 mm tính từ mép chấm**. Khe không tự cộng phần tràn artwork.
- Mỗi lần chạy hỏi file PON AI, đọc khổ artboard và vị trí bốn chấm. Giữ khuôn và bài ở layer riêng; artwork đã tràn được nhân bản, xoay và canh tâm theo khuôn.
- Cải thiện tìm bố cục hình tròn và hình dạng bất quy tắc, cân bằng nhiều loại bài; thử xoay/đổi vị trí cụm sát mép để tăng lề mà không giảm số con.
- Đã thử trực tiếp trên bản sao trong Illustrator: mẫu thìa **10 con**, lề nhỏ nhất khoảng **14,79 mm** sau chỉnh bố cục; tròn 5 cm **42 con** trên tờ PON 33 × 35,4 cm với khe 1 mm, lề 4 mm và né PON 7,5 mm. Mẫu lá đạt **50 con** trong kiểm thử hồi quy.
- Kiểm thử thêm khuôn giả lập mèo, thỏ, sao lõm, hình có lỗ, hình L và nhiều loại trộn chung; có kiểm tra khe, lề, né PON độc lập.
- Giới hạn: đây là bộ tìm kiếm nhiều phương án, chưa bảo đảm số con lớn nhất tuyệt đối với mọi khuôn. Cần đường khuôn vector đóng hợp lệ; đường cong được lấy mẫu để tính hình học.

---

## v2.14.0 — vá lại "in"

- vá lại "in"

---

## v2.13.21 — cài lại cho máy nv

- cài lại cho máy nv

---

## v2.13.20 — Dựng lại lưới, PON và bóp của CTL Offset

- \*Khổ artboard cố định, không co theo khổ trang\*\*
- Trước đây artboard tính từ khổ trang nhập nên nhập 13×20 cm ra artboard 81,27×55,87 cm — một khổ giấy không có thật. Nay chỉ còn ba tờ cố định: **42,8×31,3** (bìa A5), **64,8×41,8** (tự trở 8 A5, TT4), **85,8×63,8** (ruột A5, A4 main).
- Bài canh giữa theo chiều ngang tờ. Khổ trang chỉ quyết định bài nằm thế nào trên tờ, không đổi khổ tờ.
- Trang quá lớn không lọt tờ thì báo lỗi rõ (dư bao nhiêu mm theo chiều nào), không âm thầm phình artboard ra.
- \*Lưới họ A5 tì vào mép dưới artboard\*\*
- Mọi khổ trang từ A5 trở xuống (≤ 15 × 21,15 cm) đều neo lưới vào mép dưới, lề thừa dồn lên trên. PON đáy vì vậy luôn bắt đầu từ đáy tờ với bất kỳ khổ trang nào.
- Nhờ đó khổ tối đa 15 × 21,15 cm chạy được. Trước đây lề nhíp 24 mm cộng cứng làm bài cao 63,9 cm, dư đúng 1 mm so với tờ 63,8 cm nên bị chặn.
- Họ A4 giữ nguyên cách treo từ mép trên xuống với lề nhíp cố định.
- \*Hằng số lưới giải lại từ ba khổ form chuẩn\*\*
- Các số 0,1766805 / 3,351722 / −0,647805 / 13,176 / 24,351972 mm là sai số đo từ file mẫu chứ không phải thiết kế. Giải ngược từ ba khổ chuẩn với trang A5 14,9 × 21,15 cm ra số nguyên: lề hông 0 / 22 / 3 mm, lề trên+dưới 15 / 0 / 27 mm.
- Bỏ lề âm −0,65 mm của ruột A5 và bỏ luôn `fitLift`. Trước đây lưới lòi khỏi artboard 0,65 mm nên PON đáy vẽ ra ngoài giấy, phải nhấc artwork lên bù.
- \*PON cắt\*\*
- Thêm mốc ở biên trang bên trong mỗi nửa để cắt ra cụm 2 rồi xếp lại: ruột A5 từ 26 lên **44 nét**, tự trở 8 A5 từ 18 lên **22 nét**.
- Mọi giao điểm đều là chữ L đủ (nét dọc quay vào rãnh trống kèm chân ngang), kể cả chỗ giao khe giữa với khe hàng 15 mm — trước đây chỗ đó chỉ có chân ngang.
- Bỏ các số bù lắt nhắt `coverOuterLift` 0,2 mm và `coverBottomOutset` 0,3 mm; dấu nay nằm đúng trên đường cắt.
- Thêm luật chung: không nét nào được nằm ngoài artboard. Mốc lọt ra ngoài bị kéo về mép và số lượng được báo trong dòng kết quả.
- Số nét báo ra nay đếm thật, không còn trả số cứng 12 / 10.
- \*PON giấy\*\*
- Cùng khổ giấy thì cùng kiểu dấu. Trước đây trên cùng tờ 65×86, job A4 vẽ nét dọc 21,091 pt / nét 3,971 còn job A5 vẽ 21,53 pt / nét 1,997. Nay chỉ còn hai bộ: form lớn 18,766 / 21,091 / 3,971, form nhỏ 14,173 / 14,106 / 1,995.
- \*Gọn lại phần code\*\*
- Năm loại form gom về **một bản mô tả** mỗi loại (số cột, số hàng, khe, lề nhíp, tờ giấy, kiểu neo). Lưới danh định và cả hai loại PON đều sinh ra từ bản mô tả đó, thay cho năm nhánh code riêng.
- Ba đoạn bóp viết trùng nhau ở ba chỗ gom về một hàm `squeezeAboutCentre`.
- `dcRunSignature8` từ 2.292 xuống 2.103 dòng.
- \*Phần A4\*\*
- Topology PON của A4 giữ nguyên: A4 main 20 nét, TT4 10 nét, trùng khớp từng nét so với bản cũ khi cùng lưới; PON giấy không đổi.
- Riêng khổ artboard A4 nay cũng cố định như A5 (85,8×63,8 và 64,8×41,8) thay vì tính động theo khổ trang.

---

## v2.13.19 — Khóa ruột A5 vào artboard khi bóp tâm

- Sửa riêng ruột A5 16/32 trang: khi bóp từng cụm 2 trang quanh tâm, cụm ruột đầu được nâng đúng phần mép còn vượt (0,147805 mm với tờ 1). Bài không còn tràn đáy artboard.
- Không đổi kích thước/artboard, không đổi lưới PON giấy hay PON cắt, và không kéo PON theo ruột. Khe đóng ghim vẫn là khe.
- Giữ nguyên topology PON L của mẫu A5 65×86: mốc ở đầu/cuối cụm 2 trang và khe 15 mm. Không tự ý thêm mốc tại seam từng trang khi chưa đổi quy cách PON.

---

## v2.13.18 — PON đáy A5 65×86 và bóp tâm cụm 2 trang

- PON cắt đáy của form A5 65×86 nay dài đúng 4 mm và kết thúc tại tâm PON giấy/baseline artboard, khớp file mẫu; không còn dừng sớm 0,352 mm trùng với đáy ruột đã bóp.
- A5 ruột 16/32 trang bóp từng cụm 2 trang quanh tâm cụm. Khe giữa vẫn là khe (không có đường cắt qua), và PON giấy/PON cắt vẫn đứng yên trên lưới khổ gốc.
- Đã đối chiếu form 43×32.5: giữ nguyên đủ 12 PON cắt của mẫu, không thêm hoặc dịch PON bìa.

---

## v2.13.17 — Khóa PON CTL Offset vào lưới gốc

- Tất cả group/resize/translate của CTL Offset nay ghi thẳng vào layer bài, không còn phụ thuộc `activeLayer` trong lúc ruột đang bóp.
- Sau khi dàn, bóp và thêm ghi chú xong, tool đối chiếu lại tọa độ PON giấy/PON cắt với lưới danh nghĩa ban đầu, khôi phục nếu có thay đổi bất thường, rồi khóa và đưa hai layer PON lên trên cùng.
- Giữ nguyên tọa độ/topology PON 65×86 A5 của hai file mẫu: PON không nhận bất kỳ độ bóp nào theo `sheetNo`.

---

## v2.13.16 — Không đưa PON cũ vào ruột khi chạy lại CTL Offset

- Xóa đúng hai layer PON do CTL Offset tạo (`Pon CTL Offset tu dong` và `Pon cat CTL Offset tu dong`) trước khi đọc selection/raster nguồn.
- Nhờ vậy PON của lần dàn trước không thể bị raster hóa rồi bóp cùng ruột, trong khi PON mới vẫn đứng ở lưới khổ gốc.
- Tăng mã nạp ExtendScript để Illustrator bắt buộc đọc bản sửa này trong engine đang mở.

---

## v2.13.15 — Sửa lỗi nạp ExtendScript

- Đổi tên đơn vị inch thành `"in"` trong toàn bộ object JavaScript. Illustrator ExtendScript coi `in` không có dấu nháy là từ khóa dành riêng, khiến CTL Offset không thể nạp.

---

## v2.13.14 — Nạp lại lưới CTL Offset sau overwrite

- Tăng mã nạp CTL Offset để Illustrator bắt buộc đọc lại phần dàn bình đã khôi phục, không dùng hàm cũ còn giữ trong bộ nhớ ExtendScript.
- Giữ nguyên quy tắc v2.13.13: artboard/PON lấy từ lưới khổ gốc; chỉ artwork ruột bóp dần; A5 16/32 trang giữ nguyên khe 15 mm.
- PON giấy giữ quy tắc CTL Offset: tâm bốn nét nằm trên biên artboard; khổ artboard không đổi.

---

## v2.13.13 — Lưới PON CTL Offset theo khổ gốc

- Thay toàn bộ khổ artboard cố định bằng một lưới danh nghĩa theo đúng kích thước 1 trang nhập. Khổ nhỏ hơn A4/A5 vẫn tự tính artboard, PON giấy và PON cắt theo bố cục tương ứng.
- Quy tắc luồng được khóa lại: bìa ở đúng khổ gốc; mỗi ruột bóp dần 1 mm/tờ trên artwork; PON cắt, PON giấy và artboard luôn giữ lưới khổ gốc trước bóp.
- A5 ruột 16/32 trang bóp riêng từng block 2 trang, ghim cạnh trong để khe 15 mm không đổi. Với trang rộng 15 cm, ruột 1 co đúng còn 14.95 cm thay vì 14.9756 cm.
- A4 TT4/TT8/A-B bỏ hoàn toàn công thức làm PON chạy theo `sheetNo`; TT8/A-B có lại bốn PON ngắn ở hàng giữa, không hề tạo đường cắt dài qua khe đóng ghim.
- PON cắt A5 bìa/ruột dùng cùng lưới danh nghĩa; form 65×86 giữ đủ topology 36 nét của file mẫu. PON chỉ đảo hướng khi đầu nét chuẩn bị vượt mép artboard.
- Ghi chú A5 dùng vùng trống đo từ hai file mẫu (bìa và ruột chính); SMALL8 đặt nhãn ngoài giấy vì không có vùng trống an toàn trong lưới.

---

## v2.13.12 — Chốt ba form CTL Offset A5 theo file mẫu

- Khóa artboard theo tâm bốn PON giấy: A5 4 trang = 42.8 × 31.3 cm, A5 8 trang = 64.8 × 41.8 cm, A5 16 trang/A-B = 85.8 × 63.8 cm. Hai form có số lẻ vẫn giữ trị số chính xác trong file để Illustrator hiển thị đúng kích thước mẫu.
- PON cắt bìa A5 42.8 × 31.3 khớp 12 nét của file mẫu, gồm hai chân ngang ở khe 5 mm và hai mốc đáy lệch ra 0.3 mm; không có đường cắt qua hàng giữa.
- PON cắt ruột A5 85.8 × 63.8 khớp 34 nét của file mẫu: đủ cả hai chân trái/phải ở tim khe dọc, bảy mốc đầu trên, hai mép khe ngang 15 mm và ba mốc đáy trung tâm. Khe ngang vẫn là khe gấp/xả, không phải đường cắt.
- A5 8 trang dùng lưới trim 20.9 cm/hàng trong artboard 64.8 × 41.8; nguồn A5 cao 21.15 cm giữ phần bleed chồng 1.25 mm ở hai mép ngoài và 2.5 mm ở khe hàng.
- Xác nhận A4 riêng biệt: TT4 vẫn 64.8 × 41.8, TT8/A-B vẫn 85.8 × 63.8; PON cắt bám mép bài sau bóp 1 mm/tờ, không thêm PON ở khe ngang đóng ghim.

---

## v2.13.11 — PON bám bài A4 sau bóp

- Giữ nguyên bóp 1 mm/tờ của CTL Offset A4; trang 20 cm thành 19.95 cm ở nửa cụm là đúng quy cách bóp.
- PON cắt TT4, TT8 và A/B A4 nay tính theo mép thực sau bóp: hai mép ngoài vào squeeze/2, hai mép khe giữa ra squeeze/2. PON không còn lệch tổng 2 mm so với bài.
- Kích thước artboard và PON giấy không đổi: 65×86 A4 vẫn là 85.8 × 63.8 cm, tâm bốn PON giấy nằm trên biên artboard.

---

## v2.13.10 — Sửa form A4 65×86

- Artboard CTL Offset A4 65×86 là 85.8 × 63.8 cm, không còn dùng chiều cao 62.5 cm của form cũ.
- Bỏ dịch 2 mm ở hai mốc ngoài của PON cắt A4 65×86: PON nay bám đúng mép cụm bài.
- Với PON giấy của Dàn Offset và CTL Offset, biên artboard luôn đi qua tâm của cả bốn nét PON, đúng mốc kích thước trong Illustrator.

---

## v2.13.9 — CTL Offset A5 khớp hai form mẫu

- Dàn 65×86 A5 được dựng lại đúng form mẫu: lưới 4×4 xoay, khe dọc 6 mm và khe ngang 15 mm; khe ngang là vùng xả/gấp, không phải đường cắt.
- PON cắt 65×86 bám đúng 31 mốc của form mẫu: bảy mốc đầu trên, các mốc ở hai phía khe ngang và ba mốc đáy trung tâm; không đánh PON ở đường chia trang không cần cắt.
- PON cắt 43×32.5 dùng đúng hai dấu L ngoài và ba mốc trong khe 5 mm, không thêm PON vào đường chia hàng.
- Tách PON giấy hai form: 43×32.5 dùng góc 3 mm/1 pt; 65×86 dùng góc 18.766 × 21.53 pt/1.997 pt. Cả hai lấy biên artboard làm tâm nét PON.
- Bỏ PON ngang giữa của form A4 65×86 vì đó là khe gấp/đóng ghim, không phải đường cắt.

---

## v2.13.8 — Chuẩn hoá PON cắt CTL Offset theo mép xả

- Tách rõ đường chia bố cục và mép có PON: không còn tự đánh PON cắt ở đường chia hàng của 43×32.5, 65×43 và 65×86 A5.
- Khôi phục năm mốc dọc của form A4 65×43 (hai mép ngoài và ba mốc khe dọc), không đánh dấu trên khe ngang giữa hai hàng.
- Form A5 65×86 giữ ba mốc khe giữa, bổ sung hai mốc giữa từng panel ở đầu trên/dưới; bỏ các mốc sai trên mép hàng.
- PON mặc định hướng ra ngoài; chỉ lật vào trong khi đầu nét sẽ chạm mép artboard.

---

## v2.13.7 — Hoàn thiện PON cắt ngang A5

- A5 có PON ở hai đầu mọi đường cắt ngang của lưới; chỉ đánh dấu, không vẽ đè đường cắt lên bài.
- Sửa hướng PON góc ngoài phía trên của form 43×32.5 để luôn hướng ra ngoài cụm bài.

---

## v2.13.6 — Hoàn nguyên PON CTL Offset, sửa ghi chú CTL KTS

- Hoàn nguyên kiểu PON CTL Offset sau phần thử theo ảnh KTS; giữ bộ PON trước đó.
- Ghi chú Catalogue/CTL KTS bám vùng trống ngay phía trên cụm bài, không bám cố định theo mép giấy.

---

## v2.13.5 — Hoàn tất PON cắt ngang CTL Offset

- Mỗi đường cắt ngang giữa hai hàng có dấu PON ở cả mép trái và mép phải của cụm bài.
- Áp dụng cho 43×32.5, 65×43, 65×86 tự trở và A/B, cho cả nhánh A5 lẫn A4.

---

## v2.13.4 — PON cắt CTL Offset theo kiểu KTS

- Hai biên ngoài của mọi khổ CTL Offset dùng dấu L cùng kích thước và hướng như PON cắt KTS.
- Mốc cắt ở các khe giữa vẫn theo đúng lưới từng kiểu dàn; PON giấy 4 góc không thay đổi.

---

## v2.13.3 — Rà PON CTL Offset và ghi chú A5

- PON cắt 65×86 A5 (tự trở và A/B) có đủ hai biên ngoài cùng ba mốc khe giữa.
- PON cắt 43×32.5 có đủ mốc cắt dưới; PON 65×86 A4 bỏ độ lệch 2 mm ở hai biên ngoài.
- Tất cả ghi chú CTL KTS A5 dùng đúng vị trí trong artboard đã chuẩn hoá ở dàn A4.

---

## v2.13.1 — Bổ sung PON giấy và PON cắt A5

- Dàn Offset tự trở vẽ PON giấy đủ bốn góc trên layer riêng, với mọi khổ giấy nhập.
- CTL Offset A5 nạp lại bộ vẽ PON; khổ 65×43 có đủ năm mốc cắt ở đầu trên và dưới.

---

## v2.13.0 — Hoàn chỉnh dàn tự trở

- Hoàn chỉnh dàn tự trở

---

## v2.12.10 — Rút gọn Dàn Offset

- Bỏ lựa chọn AB trùng với Dàn KTS; Dàn Offset chỉ còn tự trở trên một artboard.

---

## v2.12.9 — Dàn Offset AB

- Dàn AB tạo artboard A (mặt trước) và B (mặt sau) cùng khổ giấy.
- Mỗi artboard có PON giấy ở đủ 4 góc theo chính kích thước nhập.
- Chọn AB lần đầu đặt sẵn khổ 85.8 × 63.8 cm; mỗi chế độ nhớ khổ giấy riêng.

---

## v2.12.8 — Clip kích thước không dừng cả selection bản vá

- Clip kích thước không dừng cả selection bản vá

---

## v2.12.7 — Clip kích thước không dừng cả selection

- Lỗi khi dò clip cha hoặc khung nền của một object không còn làm dừng toàn bộ lệnh Clip.
- Object đó dùng fallback; nếu vẫn không clip được, panel báo rõ object lỗi và vẫn xử lý các object còn lại.

---

## v2.12.6 — Thu gọn Dàn tối ưu

- Hai mục Dàn KTS và Dàn Offset trong tab Dàn tối ưu đều đóng khi panel vừa mở.

---

## v2.12.5 — Nhiều khổ không theo thứ tự chọn

- Với dàn Offset tự trở nhiều khổ, cặp không vừa bị bỏ qua để thử cặp kích thước khác.
- Bộ xếp chọn phương án có số cặp nhiều nhất, không dùng thứ tự chọn làm ưu tiên.

---

## v2.12.4 — Dàn Offset tự trở nhiều khổ

- Dàn chung các cặp có kích thước thành phẩm khác nhau trên một tờ tự trở.
- Tối đa số cặp đặt được, chỉ xóa cặp nguồn đã dàn; cặp còn lại giữ nguyên để chạy tờ sau.
- Bóp chỉ dùng khi tăng được số cặp; hai mặt của từng cặp vẫn kiểm tra khớp khung.

---

## v2.12.3 — Bản vá lỗi dàn, ctl, thêm chức nắng dàn offset

- Bản vá lỗi dàn, ctl, thêm chức nắng dàn offset

---

## v2.12.2 — Bản cải tiến bình ctl offset + kts ko cần dùng pon, linh hoạt trên mọi mặt trận a4 a5

- Bản cải tiến bình ctl offset + kts ko cần dùng pon, linh hoạt trên mọi mặt trận a4 a5

---

## v2.12.1 — Bản vá sửa lỗi raster + clip khi gặp file tào lao của khách.

- Raster đưa raster chuẩn nhất về phần clip
- Clip chuyển về giống như clip card nhưng vẫn có vài nhược điểm khi gặp file siêu chó.

---

## v2.12.0 — beta thêm chức năng tự động dàn tối ưu

- Dàn tối ưu nhất trên 1 tờ giấy với kích thước tùy chỉnh

---

## v2.10.20 — Thayy đổi chức năng cách dùng của dan theo mau cho chuẩn nhất sau khi dàn và nhanh hơn

- Bỏ snapshot từng con khi học mẫu ==> snap cả cụm rồi cắt từng con ra để xem
- Có thêm chức năng chọn con chuẩn khi học mẫu để đi chiều dàn cho đúng

---

## v2.10.19 — Bản vá cập nhật

- Bản vá cập nhật

---

## v2.10.18 — vá các vấn đề trong chức năng dàn theo mẫu, và thêm chức năng dàn theo hộp linh động trong autosave

- vá các vấn đề trong chức năng dàn theo mẫu, và thêm chức năng dàn theo hộp linh động trong autosave

---

## v2.10.17 — Khong group dau cat tu dong

- Cac net dau cat tu dong duoc ve truc tiep tren layer Dau cat tu dong, khong gom thanh mot group.

---

## v2.10.16 — Gom object truoc khi luu PDF

- Moi artboard duoc group tam, copy mot lan vao trang PDF nhe roi Undo ngay tren file goc. Khong luu AI goc, khong tao hoac doi artboard tam, va huy PDF do dang neu copy khong du.

---

## v2.10.15 — Ổn định lưu PDF artboard

- Lưu PDF bằng bản sao AI và artboard gốc, bỏ hoàn toàn nhánh tạo hoặc chỉnh artboard tạm gây lỗi 1200.

---

## v2.10.14 — Sửa lỗi 1200 khi lưu PDF

- Không gán lại artboardRect trong document tạm, tránh lỗi 1200 khi lưu PDF mặt trước và mặt sau.

---

## v2.10.13 — Tăng thời gian thông báo

- Thông báo cập nhật hiển thị khoảng 15 giây thay vì bị tắt sớm.

---

## v2.10.12 — Bỏ viền trắng tab

- Bỏ viền focus trắng dưới tab đang chọn và khôi phục lệnh dọn task cập nhật cũ.

---

## v2.10.11 — Sửa lưu PDF nhiều artboard

- Tạo sẵn toàn bộ artboard trong document tạm để tránh lỗi 1200 khi lưu PDF mặt trước và mặt sau.

---

## v2.10.10 — Sửa bước thay updater

- Sửa tham số PowerShell xung đột với biến hệ thống, bảo đảm updater tự thay file và dọn task cũ ổn định.

---

## v2.10.9 — Dọn task cập nhật cũ

- Xóa task kiểm tra cũ chạy PowerShell trực tiếp, chỉ giữ task chạy ẩn để không còn cửa sổ CMD chớp mỗi phút.

---

## v2.10.8 — Ẩn cửa sổ kiểm tra cập nhật

- Sửa tác vụ kiểm tra cập nhật mỗi phút chạy hoàn toàn ẩn, không hiện cửa sổ CMD hoặc PowerShell.

---

## v2.10.7 — test tiếp 2

- test tiếp 2

---

## v2.10.6 — test tiếp

- test tiếp

---

## v2.10.5 — test thông báo cloudflare

- test thông báo cloudflare

---

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
