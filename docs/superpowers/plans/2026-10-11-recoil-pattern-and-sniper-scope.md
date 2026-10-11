# Kế Hoạch Triển Khai Cơ Chế Nảy Tâm Có Quy Luật & Kính Ngắm Bắn Tỉa

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triển khai cơ chế nảy tâm có quy luật (Recoil Spray Pattern) giúp người chơi có thể ghìm tâm khi sấy SMG/AR, đồng thời nâng cấp súng bắn tỉa với nón tầm nhìn co hẹp 9°, camera trượt xa 20m và hiệu ứng kính ngắm Mil-dot Sniper Scope chuyên dụng.

**Architecture:** Mở rộng `applyKickbackAndShake` trong `player.js` với bộ đếm nhịp sấy theo chu kỳ chữ 7; nâng cấp camera lead và zoom trong `updateCamera`; tinh chỉnh nón tầm nhìn trong `vision-cone.js`; bổ sung lớp phủ DOM Scope Overlay trong `ui.js`.

**Tech Stack:** Three.js, Canvas 2D, Vanilla JS, CSS3.

**Spec:** [docs/superpowers/specs/2026-10-11-recoil-pattern-and-sniper-scope-design.md](file:///c:/Users/adim/OneDrive/Documents/CODE/gun-gun/docs/superpowers/specs/2026-10-11-recoil-pattern-and-sniper-scope-design.md)

## Global Constraints
- 100% tiếng Việt trong toàn bộ mã nguồn giao diện và mô tả.
- Tuyệt đối không tạo icon hoặc chèn icon mới vào giao diện.
- Sử dụng tiền tố `th_` cho các trường hoặc hàm mới bổ sung.
- Không gây ảnh hưởng đến hiệu năng 60 FPS hoặc rác bộ nhớ (Zero Allocation GC).

## Review Focus
- Khi nhả chuột phải ngắm tỉa, kính ngắm và camera phải hồi về trạng thái bình thường mượt mà, không bị giật khung hình.
- Khi ngừng bắn sấy đạn quá 0.28s, bộ đếm nhịp sấy phải reset về 0 để phát bắn tiếp theo bắt đầu lại từ viên số 1.
- Hiệu ứng kính ngắm Sniper Scope chỉ xuất hiện khi người chơi cầm súng bắn tỉa (`awp`, `blaster_n`, `blaster_o`), không kích hoạt khi cầm súng trường, shotgun hay súng lục.

---

### Task 1: Nâng cấp Nón Tầm Nhìn & Camera Lead Cho Súng Bắn Tỉa
**Files:**
- Modify: `src/gameplay/combat/vision-cone.js:30-43`
- Modify: `src/gameplay/player/player.js:3220-3238`

**Interfaces:**
- Consumes: Cấu hình súng qua `getWeaponVisionConfig`, `updateCamera`.
- Produces: Vision cone góc hẹp 9.0°, camera lead 20.0m khi bật ADS súng bắn tỉa.

- [x] **Step 1: Cập nhật góc nón tầm nhìn súng tỉa trong `vision-cone.js`**
  - Khi `isADS` và là súng bắn tỉa: góc mở `visionAngle: 9.0°`, tầm nhìn `visionRange: 60.0m`, `proximityRadius: 0.5m`.
- [x] **Step 2: Cập nhật nhận diện súng bắn tỉa và Camera Pan Lead trong `player.js:updateCamera`**
  - Nhận diện đúng súng ngắm qua id `awp`, `blaster_n`, `blaster_o` hoặc category chứa `SNIPER` / `BẮN TỈA`.
  - Khi `isADS`: `maxLead = 20.0m`, dịch camera về hướng ngắm với hệ số `0.72`, `targetZoom: 1.25`.

---

### Task 2: Triển Khai Hệ Thống Nảy Tâm Có Quy Luật (Recoil Spray Pattern)
**Files:**
- Modify: `src/gameplay/combat/weapons.js:320-475` (tăng `cursorKick` cho SMG & AR)
- Modify: `src/gameplay/player/player.js:2594-2605` (hàm `applyKickbackAndShake`)

**Interfaces:**
- Consumes: Nhịp bắn của súng qua `applyKickbackAndShake`.
- Produces: Quỹ đạo nảy tâm `cursorKick` có quy luật (viên 1-4 thẳng đứng, 5-10 lệch phải, 11-20 lệch trái, 21+ rung ngang).

- [x] **Step 1: Tăng độ nảy tâm súng SMG & AR trong `WEAPON_CONFIGS`**
  - `repeater` (Blaster-D): cursorKick tăng từ 2.3 -> 3.8.
  - `mac10` (Blaster-H): cursorKick tăng từ 2.2 -> 3.5.
  - `blaster_e` (Storm): cursorKick tăng từ 3.1 -> 4.0.
  - `shotgun` / `blaster_f` (Enforcer): cursorKick tăng từ 3.5 -> 4.3.
- [x] **Step 2: Cập nhật thuật toán tính độ nảy có quy luật trong `player.js`**
  - Thêm thuộc tính `this.th_sprayShotCount = 0;` và `this.th_lastShotTime = 0;`.
  - Trong `applyKickbackAndShake`: nếu `now - this.th_lastShotTime > 0.28s`, reset `th_sprayShotCount = 0`.
  - Tính toán `xOffset` và `yOffset` theo chu kỳ chữ 7.

---

### Task 3: Triển Khai Giao Diện Kính Ngắm Mil-Dot Sniper Scope Overlay
**Files:**
- Modify: `src/ui/ui.js:460-500`

**Interfaces:**
- Consumes: Trạng thái `player.isADS` và loại vũ khí hiện tại.
- Produces: Lớp phủ `#th_sniper_scope_overlay` hiển thị ống ngắm quang học chuyên dụng khi ngắm súng bắn tỉa.

- [x] **Step 1: Tạo cấu trúc DOM và CSS cho `#th_sniper_scope_overlay`**
  - Vòng tròn quang học trung tâm với viền đen blackout xung quanh.
  - Vạch chia mil-dot và tâm chữ thập thanh mảnh.
- [x] **Step 2: Cập nhật hiển thị scope overlay trong vòng lặp cập nhật UI**
  - Khi cầm súng bắn tỉa và `isADS = true`, bật hiển thị overlay; ngược lại ẩn đi.

---

### Task 4: Kiểm Thử Toàn Diện Với Browser Subagent & Xác Thực Trực Quan
**Files:**
- Test runtime: Browser Subagent kiểm thử trên `http://localhost:8080`

- [x] **Step 1: Kiểm thử kính ngắm súng bắn tỉa**
  - Cầm súng bắn tỉa BLASTER-N VORTEX SNIPER.
  - Nhấp giữ chuột phải ngắm: xác nhận camera pan xa 20m, nón tầm nhìn co hẹp còn 9°, kính ngắm Sniper Scope hiển thị sắc nét.
- [x] **Step 2: Kiểm thử độ giật ghìm tâm SMG**
  - Cầm súng tiểu liên BLASTER-D REPEATER.
  - Giữ chuột trái sấy liên thanh: xác nhận tâm nảy theo quy luật chữ 7 rõ ràng và đầm tay.
  - Xác nhận console 0 lỗi runtime.
