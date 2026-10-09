# Ke Hoach Trien Khai Ban Do Tram Khong Gian Chien Thuat (Tactical Space Map)

> **Dành cho nhân sự thực thi:** Yêu cầu sử dụng kỹ năng `executing-plans` (triển khai trực tiếp) để hoàn thành từng tác vụ. Các bước sử dụng cú pháp checkbox (`- [ ]`) để theo dõi tiến độ.

**Goal:** Xây dựng và tích hợp hoàn chỉnh bản đồ trạm không gian chiến thuật phong cách CS:GO (3 làn: Mid, Site A Long/Short, Site B Tunnels/Room) bằng bộ tài nguyên Kenney Modular Space Kit trong lớp `Arena`.

**Architecture:** Sử dụng lưới module 4m x 4m lắp ráp sàn kim loại, tường ngăn hành lang 4.25m, cổng laser và vật cản che chắn; tối ưu hóa qua `THREE.InstancedMesh`; đăng ký chính xác hộp va chạm `THREE.Box3` để phục vụ cơ chế cản tầm nhìn (`hasLineOfSight`), trượt tường (`moveCharacter`) và tìm đường A* (`findNavigationPath`).

**Tech Stack:** Three.js, JavaScript ES Modules, GLTF/GLB Loader, Kenney Modular Space Kit.

**Spec:** [2026-10-08-tactical-space-map-design.md](file:///d:/game/gun-gun/docs/superpowers/specs/2026-10-08-tactical-space-map-design.md)

## Global Constraints

- Không tạo file test mới (Not create file test).
- Không tự động commit git (Do not auto commit to git).
- Luôn trả lời và chú thích mã nguồn bằng tiếng Việt.
- Đặt tên hàm, biến, thuộc tính bằng tiếng Anh (English).
- Không sử dụng icon hoặc emoji.
- Không sửa đổi mã nguồn cơ sở của Three.js gốc.

## Review Focus

1. Kiểm tra tải tài nguyên GLB: Đảm bảo toàn bộ 10 mô hình modular space được nạp đầy đủ qua `check-project.mjs`.
2. Kiểm tra va chạm (Collision): Người chơi và bot không thể đi xuyên qua các vách tường module hoặc bị kẹt tại các góc 90 độ.
3. Kiểm tra cản tầm nhìn (Line of Sight): Tường cao 4.25m phải cản hoàn toàn tia nhìn thẳng, kẻ địch nấp sau vách tường không bị lộ diện khi chưa có luồng sáng rọi tới.
4. Kiểm tra điều hướng Bot (A* Pathfinding): Bot hai đội có thể di chuyển trơn tru qua cả 3 làn đường (Mid, Long A, B Tunnels) mà không bị xoay tròn hay khựng lại.
5. Kiểm tra tầm nhìn camera: Góc quay từ trên cao (Y=26) nhìn rõ mọi ngóc ngách, không bị cản trở bởi mái che.

---

### Task 1: Khai báo và nạp tài nguyên Modular Space trong `Arena.loadModels`

**Files:**
- Modify: `src/world/arena.js:20-60`

**Interfaces:**
- Consumes: Thư mục `assets/models/space/` chứa các tệp GLB và Textures.
- Produces: `this.models['space/...']` sẵn sàng cho việc nhân bản và dựng cảnh.

- [x] **Step 1: Cập nhật danh sách `modelNames` trong `Arena.loadModels`**
  Thêm danh sách các model modular space vào mảng `modelNames`:
  - `space/template-floor`
  - `space/template-floor-detail`
  - `space/template-wall`
  - `space/template-wall-corner`
  - `space/template-wall-half`
  - `space/gate`
  - `space/gate-lasers`
  - `space/template-detail`
  - `space/template-floor-layer-raised`
  - `space/cables`

- [x] **Step 2: Chạy kiểm tra tính toàn vẹn tài nguyên dự án**
  Chạy lệnh: `npm run check`
  Kết quả mong đợi: `OK: module imports, HTML, configured models and GLB dependencies` không có lỗi thiếu tệp nào.

---

### Task 2: Thiết lập hệ thống Chiếu sáng Không gian (Sci-Fi Lighting)

**Files:**
- Modify: `src/world/arena.js:61-96`

**Interfaces:**
- Consumes: `this.scene` của Three.js.
- Produces: Hệ thống ánh sáng trạm không gian chuyên dụng `setupLighting()`.

- [x] **Step 1: Cập nhật `setupLighting` trong `Arena`**
  - AmbientLight tông màu xanh thẫm trạm vũ trụ: `0x162238`, cường độ 0.75.
  - DirectionalLight ánh sáng xiên qua cửa vòm vũ trụ: `0xddeeff`, cường độ 1.4, hỗ trợ đổ bóng shadow camera bao phủ 56m x 56m (`d = 30`).
  - PointLight nhận diện phe phái:
    - Sân Đội Xanh (Nam): ánh sáng xanh neon Cyan `0x00d0ff` tại `[0, 5, 24]`.
    - Sân Đội Đỏ (Bắc): ánh sáng đỏ cam báo động `0xff3b30` tại `[0, 5, -24]`.
    - Sảnh Mid (Giữa): ánh sáng trắng ấm `0xffeedd` tại `[0, 5, 0]`.
    - Khu vực Reactor A: ánh sáng tím huỳnh quang `0xb026ff` tại `[-16, 5, 0]`.
    - Khu vực Storage B: ánh sáng vàng công nghiệp `0xffaa00` tại `[16, 5, 0]`.

- [x] **Step 2: Chạy kiểm tra cú pháp**
  Chạy lệnh: `npm run check`
  Kết quả mong đợi: Hoàn thành với mã thoát 0.

---

### Task 3: Xây dựng Sàn Module và Tường bao ngoại vi (Floor Grid & Perimeter Walls)

**Files:**
- Modify: `src/world/arena.js:116-260`

**Interfaces:**
- Consumes: `this.models['space/template-floor']`, `this.models['space/template-floor-detail']`, `this.models['space/template-wall']`, `this.models['space/template-wall-corner']`.
- Produces: `InstancedMesh` của sàn và tường bao, cập nhật `this.colliders` biên.

- [x] **Step 1: Tái cấu trúc `buildFloorAndWalls`**
  - Thiết lập kích thước bản đồ `halfSize = 28`, bước lưới `gridStep = 4`.
  - Tạo `InstancedMesh` cho sàn (14 x 14 = 196 ô): xen kẽ `template-floor` và `template-floor-detail` tại các vị trí cứ điểm quan trọng.
  - Tạo `InstancedMesh` cho 4 vách tường bao chu vi ngoài cùng tại `X = ±28` và `Z = ±28`, kết hợp với các góc `space/template-wall-corner`.
  - Đăng ký các hộp va chạm `THREE.Box3` bao quanh 4 phía biên vào `this.colliders`.

- [x] **Step 2: Chạy kiểm tra cú pháp**
  Chạy lệnh: `npm run check`
  Kết quả mong đợi: Hoàn thành với mã thoát 0.

---

### Task 4: Xây dựng Kiến trúc 3 Làn Nội thất (Mid, Site A, Site B, Spawns & Connectors)

**Files:**
- Modify: `src/world/arena.js:343-403`

**Interfaces:**
- Consumes: Toàn bộ model modular space và phương thức `placeInstance(name, pos, rot, scale, addCollider)`.
- Produces: Địa hình nội thất hoàn chỉnh với đầy đủ vật cản che chắn và vách ngăn choke points.

- [x] **Step 1: Xây dựng Khu Vực Trung Tâm (Mid Courtyard & Connectors)**
  - Dựng hai dãy tường dọc tạo thành trục hành lang Mid từ `Z = -16` đến `Z = 16`, bề rộng 8m.
  - Đặt cổng vòm `space/gate` tại 2 đầu cửa Mid.
  - Đặt 2 trụ máy che chắn `space/template-detail` tại trung tâm Mid để cung cấp vị trí nấp.
  - Mở ngách rẽ Connector sang Site A tại tọa độ `X = -8, Z = 0`.
  - Mở ngách rẽ Vent sang Site B tại tọa độ `X = 8, Z = 0`.

- [x] **Step 2: Xây dựng Khu Cứ Điểm A (Reactor Alpha / Long A + Short A)**
  - Dựng hành lang Long A ở cánh Tây (`X = -20`): đường thẳng nối dài từ Sân Nam lên Sân Bắc với khúc cua 90 độ.
  - Dựng bục lò phản ứng trung tâm A với các bục nâng `space/template-floor-layer-raised` và cổng `space/gate-lasers`.
  - Đặt các vách chắn so le để tạo góc chết (Blind Corners) phát huy tối đa góc nhìn 50 độ.

- [x] **Step 3: Xây dựng Khu Cứ Điểm B (Storage Beta / B Tunnels + Room)**
  - Dựng hành lang B Tunnels uốn lượn hình chữ Z ở cánh Đông (`X = 20`).
  - Dựng phòng kho B rộng 16m x 16m với các khối container máy móc làm vật cản che chắn hỏa lực tầm gần.

- [x] **Step 4: Chạy kiểm tra cú pháp**
  Chạy lệnh: `npm run check`
  Kết quả mong đợi: Hoàn thành với mã thoát 0.

---

### Task 5: Cập nhật Cổng Xuất phát, Cứ điểm Hồi sinh và Tích hợp TDM

**Files:**
- Modify: `src/world/arena.js:261-342`
- Modify: `src/gameplay/combat/tdm.js:80-140`

**Interfaces:**
- Consumes: Cấu trúc tọa độ các căn cứ Đội Xanh (Nam) và Đội Đỏ (Bắc).
- Produces: Danh sách cổng spawn `this.portals` và tọa độ xuất phát chuẩn của chế độ TDM.

- [x] **Step 1: Cập nhật `buildSpawnPortals` trong `Arena`**
  - Đặt các cổng xuất phát đối xứng:
    - 4 cổng căn cứ Đội Xanh tại `Z = 24` (phân bổ theo các hướng Long A, Mid, B Tunnels).
    - 4 cổng căn cứ Đội Đỏ tại `Z = -24` (đối xứng tương ứng).
  - Tích hợp hiệu ứng ánh sáng phát quang và vòng xoáy vortex cho từng cổng.

- [x] **Step 2: Cập nhật tọa độ hồi sinh người chơi và Bot trong `TDMManager`**
  - Đội Xanh xuất phát tại tọa độ `Z = 22` đến `24`.
  - Đội Đỏ xuất phát tại tọa độ `Z = -22` đến `-24`.

- [x] **Step 3: Chạy kiểm tra toàn bộ mã nguồn**
  Chạy lệnh: `npm run check`
  Kết quả mong đợi: Hoàn thành với mã thoát 0.

---

### Task 6: Kiểm tra và Nghiệm thu Toàn diện (Verification & Acceptance)

**Files:**
- Verify: `src/world/arena.js`
- Verify: `src/gameplay/combat/tdm.js`
- Verify: `tools/check-project.mjs`

- [x] **Step 1: Kiểm tra tính nhất quán mã nguồn**
  Chạy: `node tools/check-project.mjs`
  Kết quả mong đợi: Không có lỗi import, không có lỗi thiếu model hay texture.

- [x] **Step 2: Kiểm thử thời gian thực trên trình duyệt**
  - Khởi động trận đấu TDM 4v4.
  - Kiểm tra di chuyển không bị kẹt góc ở các khúc cua Long A, Mid và B Tunnels.
  - Kiểm tra sương mù và luồng sáng 50 độ: góc khuất sau vách tường được che chắn kín đáo, kẻ địch chỉ lộ diện khi đi vào luồng sáng của bản thân hoặc đồng đội.
  - Kiểm tra chấm đỏ hiển thị chính xác trên Radar khi đồng đội soi thấy kẻ địch.
