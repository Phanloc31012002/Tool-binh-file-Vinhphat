# DanCard update worker

Worker cập nhật của Công cụ bình (`https://dancard-update.an-ard--etup-23.workers.dev`).

- `/latest.json`: manifest của bản đang phát hành (sinh từ `online/latest.json`).
- `/pkg/DanCardCEP-x.y.z.zip`: gói cập nhật, nằm trong tài nguyên tĩnh của Worker
  (`cloudflare-worker/generated/assets/pkg`). Từ 2.20.5 gói không tải từ GitHub nữa,
  nên repo GitHub để Private được.
- `/health`: luôn trả `ok`.

## Kênh mã chung (từ 29/10/2026)

Mã chung nằm ở `QuanLyNoiBo/kenh-cap-nhat.json` (không có trong Git). `Publish-OnlineUpdate.ps1`
tạo mã ở lần phát hành đầu tiên và chép mã vào `update-config.json` bên trong gói ZIP; bộ cài nhân viên
(`DongGoiNhanVien.ps1`) cũng mang mã. Updater gửi mã trong header `X-CCB-Key`.

- `batBuocMa: false` (chuyển tiếp): ai cũng tải được, để máy còn updater cũ nhận bản mang mã về.
- `batBuocMa: true` (đã khoá): thiếu/sai mã → 403. Bật bằng `QuanLyNoiBo/KhoaKenhCapNhat.bat`,
  mở lại bằng `QuanLyNoiBo/MoKhoaKenhCapNhat.bat`.

`PhatHanhCapNhat.bat` chạy `node cloudflare-worker/build-latest.mjs` (sinh `generated/latest.js` có mã và
chế độ, chép ZIP vào `generated/assets/pkg`) rồi `npx wrangler deploy` sau mỗi lần phát hành.
Thư mục `generated/` không đưa lên Git. Test: `node tests/update_channel.test.js`.
