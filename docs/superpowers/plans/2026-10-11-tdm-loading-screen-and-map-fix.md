# Kế Hoạch Triển Khai: Sửa Lỗi Mất Map TDM & Xây Dựng Màn Hình Chờ Tải Trận Đối Kháng 4v4 (LoL Style)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khắc phục triệt để lỗi mất map/đen map trong chế độ Đối Kháng TDM (`SpaceArena`), đồng thời xây dựng màn hình chờ tải trận đối kháng 4v4 phong cách Liên Minh Huyền Thoại (Versus Loading Screen) với 8 thẻ bài nhân vật 2 đội Xanh - Đỏ, hiển thị tiến trình tải 0% - 100%, pre-warm tài nguyên Three.js trước khi vào trận.

**Architecture:** 
1. `src/world/space-arena.js` & `src/world/arena-base.js`: Nâng cấp hệ thống ánh sáng, bổ sung sàn nền kim loại PBR chống đen map, và bảo vệ cache geometry/material không bị dispose sai cách.
2. `src/ui/th_versus_loading.js`: Module quản lý màn hình chờ tải trận đối kháng phong cách LoL 4v4 với 8 thẻ bài (Đội Xanh vs Đội Đỏ), thanh tiến trình và mẹo chiến thuật.
3. `styles/style.css`: Quy chuẩn thẩm mỹ Cyber/Sci-Fi cao cấp cho thẻ bài, khung viền kim loại Neon/Ruby, thanh tiến trình loading.
4. `src/app/main.js`: Tích hợp flow chuyển cảnh qua màn hình chờ khi bắt đầu trận đấu TDM.

**Tech Stack:** Three.js, Vanilla JS (ES Modules), Vanilla CSS, HTML5 Canvas.

## Global Constraints
- 100% tiếng Việt.
- Tuyệt đối không tạo icon, chèn icon vào giao diện.
- Sử dụng tiền tố `th_` cho các class/field/file/hàm mới.

---

### Task 1: Sửa Triệt Để Lỗi Mất Map & Tối Đen Trong SpaceArena

**Files:**
- Modify: `src/world/space-arena.js`
- Modify: `src/world/arena-base.js`

- [x] **Step 1: Khắc phục hàm clearScene trong arena-base.js**
  - Không dispose `geometry` và `material` của các mesh chia sẻ trong `this.models` khi chuyển arena.
- [x] **Step 2: Nâng cấp ánh sáng và vật liệu sàn trong space-arena.js**
  - Tăng cường `AmbientLight` (lên `0xddeeff`, intensity `0.75`).
  - Tăng cường `HemisphereLight` (`0x88bbdd`, `0x223344`, intensity `0.65`).
  - Bổ sung tấm sàn nền phẳng cơ sở (Backing Ground Plane) kích thước 64m x 64m ở `y = -0.04` bằng vật liệu PBR kim loại xanh xám `0x1e293b` để không bao giờ bị lộ khoảng trống đen.
  - Cấu hình lại vật liệu của `instancedFloor` sang PBR `MeshStandardMaterial` kim loại phản quang cao cấp kèm màu sắc phân tầng.
- [x] **Step 3: Kiểm tra cú pháp và build thử nghiệm**
  - Chạy `node --check src/world/space-arena.js src/world/arena-base.js`.

---

### Task 2: Xây Dựng Component Màn Hình Chờ Tải Trận Đối Kháng 4v4 (LoL Style)

**Files:**
- Create: `src/ui/th_versus_loading.js`
- Modify: `index.html`
- Modify: `styles/style.css`

- [x] **Step 1: Viết module th_versus_loading.js**
  - Định nghĩa class `TH_VersusLoadingScreen` với các phương thức:
    * `start(options)`: Khởi tạo DOM 8 thẻ bài (4 Đội Xanh vs 4 Đội Đỏ).
    * Hiển thị: Avatar chân dung 3D lớn của nhân vật, Tên người chơi/Bot, Danh hiệu ("BẠN (CHỦ PHÒNG)", "CHIẾN BINH BOT"), Tên súng chính kèm hình ảnh minh họa, % tải riêng từng thẻ bài (0% -> 100%).
    * Khu vực trung tâm: Thanh tiến trình tổng toàn trận (Loading bar 0% -> 100%) và dòng mẹo chiến thuật ngẫu nhiên.
    * Cơ chế đếm % mượt mà trong ~2.4 giây, tự động kích hoạt callback `onComplete()` và fade-out khi đạt 100%.
- [x] **Step 2: Thêm CSS màn hình loading thẻ bài vào style.css**
  - Khung viền kim loại Neon Hextech cho Đội Xanh (`.th_versus-card.blue`).
  - Khung viền kim loại Ruby Crimson cho Đội Đỏ (`.th_versus-card.red`).
  - Khung viền Vàng Hoàng Gia nổi bật cho người chơi chính (`.is-local-player`).
  - Hiệu ứng phát sáng và đổ bóng PBR cao cấp, typography hiện đại.
- [x] **Step 3: Khai báo thẻ container #th-versus-loading-screen trong index.html**
  - Tạo động trong DOM bởi `TH_VersusLoadingScreen`.

---

### Task 3: Tích Hợp Flow Loading Vào Game Khi Bắt Đầu Trận Đấu TDM

**Files:**
- Modify: `src/app/main.js`

- [x] **Step 1: Khởi tạo instance th_versusLoading trong main.js**
  - Import `TH_VersusLoadingScreen` từ `../ui/th_versus_loading.js`.
- [x] **Step 2: Tích hợp vào startTDM() và các nút Bắt Đầu / Chơi Đơn**
  - Khi bắt đầu trận đấu TDM:
    * Kích hoạt `th_versusLoading.start(...)`.
    * Trong thời gian 2.4s màn hình chờ chạy: Thực hiện `switchArena('TDM')`, nạp dữ liệu bot, gọi `this.renderer.compile(this.scene, this.camera)` để làm nóng shader.
    * Khi màn hình chờ fade-out: Bật HUD và cho phép người chơi điều khiển vào trận ngay lập tức.
- [x] **Step 3: Tăng version cache-busting trong index.html và main.js**

---

### Task 4: Kiểm Thử Toàn Diện & Tinh Chỉnh

**Files:**
- Verify toàn bộ gameplay và giao diện

- [x] **Step 1: Kiểm tra cú pháp toàn bộ file qua node --check**
- [x] **Step 2: Đảm bảo không phát sinh lỗi runtime**
