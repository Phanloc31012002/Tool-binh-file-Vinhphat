# Đồng bộ trực tiếp tới AppData máy nhân viên

Điền từng máy vào `staff-machines.json`:

```json
{
  "machines": [
    { "computer": "PC-KE-TOAN", "profile": "ketoan" },
    { "computer": "PC-THIET-KE", "profile": "thietke" }
  ]
}
```

- `computer`: tên máy trong mạng LAN hoặc DNS nội bộ.
- `profile`: tên thư mục tại `C:\Users\<profile>` trên máy đó.
- Máy chạy sync phải có quyền ghi vào `\\<computer>\c$\Users\<profile>\AppData\Roaming`.

Sau khi điền danh sách, chạy một lần trên máy quản lý:

```powershell
.\Enable-StaffAutoSync.ps1
```

Script sẽ chạy lúc đăng nhập Windows, kiểm tra folder `DanCardCEP` mỗi 2 phút.
Khi có thay đổi ổn định trong 30 giây, nó đẩy bản mới theo staging + backup tới
từng máy. Nhân viên không cần tải file hay bấm `install.bat`; bản mới có hiệu
lực ở lần Illustrator của họ mở lại.

Nếu tài khoản Windows hiện tại chưa có quyền vào các ổ `C$` từ xa, chạy thủ công
và nhập tài khoản có quyền mạng:

```powershell
$cred = Get-Credential
.\Start-StaffAutoSync.ps1 -Credential $cred
```
