# Kế Hoạch Nâng Cấp Chuyển Đổi & Ghi Nhớ Chế Độ Chơi

> **Dành cho kỹ sư thực thi:** BẮT BUỘC SỬ DỤNG: superpowers:executing-plans để thực thi kế hoạch này theo từng nhiệm vụ. Các bước sử dụng cú pháp checkbox (`- [ ]`).

**Mục tiêu:** Tạo danh sách chọn chế độ chơi một chạm trực quan khi bấm vào thẻ chế độ chơi tại sảnh chính và ghi nhớ chế độ vào `localStorage` (`th_saved_game_mode`) để không bị reset về mặc định khi tải lại trang.

**Kiến trúc:** Bổ sung popover menu danh sách chọn chế độ `.th_mode-select-popover` ngay trên thẻ chế độ chơi `#btn-mode-card`, kết nối với hàm chuyển đổi `_th_applyMode`, đồng bộ hóa dữ liệu phòng chờ P2P/Supabase và lưu trữ trạng thái bền vững với `localStorage`.

**Công nghệ:** HTML5, Vanilla CSS, JavaScript ES Modules, LocalStorage API, Three.js WebGL.

## Ràng Buộc Bắt Buộc (Global Constraints)
- Luôn trả lời bằng tiếng Việt.
- Tuyệt đối không tạo icon, không chèn icon/emoji vào giao diện người dùng.
- Sử dụng tiền tố `th_` cho các field, method, class mới: `th_saved_game_mode`, `th_mode-select-popover`, `th_toggleModePopover`, v.v.

---

### Nhiệm vụ 1: Ghi nhớ và nạp chế độ chơi qua LocalStorage
**Tệp:**
- Chỉnh sửa: `src/app/main.js`
- Chỉnh sửa: `src/ui/home.js`

- [x] **Bước 1: Nạp chế độ đã lưu khi khởi tạo game trong `src/app/main.js`**
  - Đọc `localStorage.getItem('th_saved_game_mode')`. Nếu có giá trị hợp lệ (`SURVIVAL`, `TDM`, `FPS_SOLO`), gán cho `this.selectedGameMode`.
- [x] **Bước 2: Lưu vào LocalStorage mỗi khi chế độ thay đổi trong `src/ui/home.js`**
  - Trong hàm `applyMode(mode, team)`, lưu `localStorage.setItem('th_saved_game_mode', mode)`.
  - Khởi tạo giá trị `this.selectedMode` từ `localStorage.getItem('th_saved_game_mode') || 'SURVIVAL'`.
- [x] **Bước 3: Kiểm tra cú pháp JavaScript**
  - Chạy: `node --check src/app/main.js src/ui/home.js`

---

### Nhiệm vụ 2: Xây dựng Danh sách chọn chế độ chơi Popover (.th_mode-select-popover)
**Tệp:**
- Chỉnh sửa: `index.html`
- Chỉnh sửa: `styles/style.css`
- Chỉnh sửa: `src/ui/home.js`

- [x] **Bước 1: Thêm cấu trúc HTML danh sách chọn chế độ vào `index.html`**
  - Thêm container `#th-mode-popover` ngay cạnh thẻ `#btn-mode-card`.
  - Bao gồm 3 tùy chọn dạng danh sách rõ ràng:
    + VÔ TẬN ZOMBIE (Sinh tồn đợt quái · 1-4 người)
    + ĐỐI KHÁNG 4V4 (TDM) (Chia 2 phe Đội Xanh vs Đội Đỏ)
    + GÓC NHÌN THỨ NHẤT (FPS) (Bắn súng góc nhìn thứ nhất solo / bạn bè)
  - Hoàn toàn dùng text thuần túy, có nhãn trạng thái `[ĐANG CHỌN]`, không chứa bất kỳ icon nào.
- [x] **Bước 2: Thêm CSS cho `.th_mode-select-popover` trong `styles/style.css`**
  - Định dạng hiển thị phía trên thẻ chế độ chơi, bo góc, nền tối cao cấp ăn khớp với chủ đề game.
  - Hiệu ứng hover nổi bật, trạng thái `.active` viền sáng và nhãn đánh dấu trực quan.
- [x] **Bước 3: Gắn logic tương tác mở/đóng và chọn một chạm trong `src/ui/home.js`**
  - Bấm vào `#btn-mode-card` sẽ toggle hiển thị popover `#th-mode-popover`.
  - Bấm vào 1 mục trong danh sách: gọi `applyMode(mode, team)`, cập nhật nhãn `[ĐANG CHỌN]`, và tự động đóng popover.
  - Lắng nghe sự kiện click bên ngoài hoặc bấm phím `Esc` để tự động đóng popover.
- [x] **Bước 4: Kiểm tra cú pháp JavaScript**
  - Chạy: `node --check src/ui/home.js`

---

### Nhiệm vụ 3: Đồng bộ toàn diện hiển thị sảnh phòng chờ khi đổi chế độ
**Tệp:**
- Chỉnh sửa: `src/ui/home.js`
- Chỉnh sửa: `src/network/network.js`
- Chỉnh sửa: `src/ui/lobby.js`

- [x] **Bước 1: Đảm bảo đồng bộ ngay lập tức khi Host chuyển chế độ**
  - Khi chủ phòng đổi chế độ qua popover, gọi `this.game.network.setMode(mode)`.
  - Gọi ngay `this.game.roomLobby.update(...)` để sảnh 3D lập tức chuyển sang đúng số slot (4 slot Co-op hoặc 8 slot TDM 4v4).
- [x] **Bước 2: Cập nhật nhãn và trạng thái trên thẻ chế độ để luôn khớp với sảnh**
  - Đảm bảo không còn hiện tượng thẻ ghi Zombie nhưng sảnh lại là Đội Xanh / Đội Đỏ.
- [x] **Bước 3: Kiểm tra cú pháp JavaScript**
  - Chạy: `node --check src/ui/lobby.js src/ui/home.js src/network/network.js`

---

### Nhiệm vụ 4: Kiểm thử và hoàn thiện
- [x] **Bước 1: Chạy `node --check` toàn bộ các tệp mã nguồn**
- [x] **Bước 2: Kiểm tra chức năng ghi nhớ trên trình duyệt**
- [x] **Bước 3: Báo cáo kết quả chi tiết bằng tiếng Việt**
