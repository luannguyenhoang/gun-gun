# Kế Hoạch Triển Khai Tái Cấu Trúc & Cân Bằng Toàn Diện Hệ Thống Vũ Khí

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cân bằng lại toàn diện 18 mẫu súng theo đúng hình dáng 3D thực tế của Kenney Blaster Kit, phân loại chuẩn xác nhóm chính/phụ, điều chỉnh thông số chiến thuật (damage, tốc độ bắn, độ giật, đạn) và nón tầm nhìn vision cone để mang lại trải nghiệm bắn súng thỏa mãn nhất.

**Architecture:** Chuẩn hóa dữ liệu `WEAPON_CONFIGS`, `SECONDARY_WEAPON_IDS`, `getBulletType` trong `src/gameplay/combat/weapons.js`; đồng bộ thuật toán tính nón tầm nhìn `getWeaponVisionConfig` trong `src/gameplay/combat/vision-cone.js`; kiểm tra hiển thị tab kho vũ khí trong `src/ui/showroom.js` và tương thích ngược loadout.

**Tech Stack:** Three.js, ES6 Modules, Canvas 2D (Vision Cone Overlay), DOM UI Vanilla JS.

**Spec:** [docs/superpowers/specs/2026-10-11-weapon-system-rebalance-design.md](file:///c:/Users/adim/OneDrive/Documents/CODE/gun-gun/docs/superpowers/specs/2026-10-11-weapon-system-rebalance-design.md)

## Global Constraints
- 100% tiếng Việt trong toàn bộ mã nguồn giao diện, tên và mô tả.
- Tuyệt đối không tạo icon hoặc chèn icon mới vào giao diện.
- Sử dụng tiền tố `th_` cho các trường hoặc hàm mới bổ sung.
- Giữ nguyên các ID súng gốc (`blaster`, `blaster_c`, `shotgun`, `blaster_m`, v.v.) để bảo toàn dữ liệu lưu trữ nâng cấp và trang bị của người chơi.

## Review Focus
- Trường hợp người chơi có file lưu cũ đang trang bị `blaster_c` hoặc `blaster_i` ở slot `primary`: Cần kiểm tra loadout tự thích ứng mượt mà.
- Khẩu `blaster_f` (Enforcer) chuyển từ shotgun sang súng trường: Phải đổi `pellets: 1`, bỏ đạn shotgun, chuyển đạn sang `rifle` trong `getBulletType`.
- Khẩu `blaster_m` (Breacher) và `blaster_l` (Double-barrel) chuyển thành shotgun: Phải thiết lập `pellets > 1`, đạn chùm tán xạ, nón tầm nhìn rộng 75°.
- Khẩu `awp` / `blaster_n` và `blaster_o`: Phải có tầm nhìn siêu xa khi ngắm ADS và góc nhìn co hẹp chuẩn Sniper/DMR (14°-18°).
- Không xuất hiện bất kỳ lỗi console Three.js / JS runtime nào khi đổi súng, nạp đạn hoặc bắn trong trận.

---

### Task 1: Cập nhật định nghĩa và cân bằng toàn diện cấu hình 18 vũ khí
**Files:**
- Modify: `src/gameplay/combat/weapons.js:196-850`

**Interfaces:**
- Consumes: Cấu hình `WEAPON_CONFIGS`, `SECONDARY_WEAPON_IDS`, `getBulletType`.
- Produces: 18 cấu hình vũ khí chuẩn xác tên, category, slotType, chỉ số (damage, fireRate, magSize, reloadTime, pellets, spread, recoil).

- [x] **Step 1: Cập nhật nhóm Súng lục / Vũ khí phụ (Secondary)**
  - `blaster` (Alpha): Lục tiêu chuẩn cơ bản.
  - `blaster_b` (Striker): Lục tác chiến liên thanh nhẹ.
  - `blaster_c` (Phantom): SÚNG LỤC BÁN TỰ ĐỘNG, slot phụ, tốc độ nạp đạn 0.95s, sát thương 30.
  - `mac10` / `blaster_h` (Viper): Tiểu liên cơ động slot phụ, fireRate 0.11s, magSize 32.
  - `blaster_i` (Magnum): SÚNG LỤC CỠ LỚN (Hand Cannon), slot phụ, sát thương 52, crit x2.4, magSize 7.
  - `pew` / `blaster_k` (Cyber Laser): SÚNG LỤC LASER, slot phụ, chính xác cao, reloadTime 0.9s.

- [x] **Step 2: Cập nhật nhóm Tiểu liên SMG & Súng trường AR (Primary)**
  - `repeater` / `blaster_d`: TIỂU LIÊN SMG CAO TỐC, magSize 35, fireRate 0.13s, damage 20.
  - `blaster_e` (Storm MK-II): SÚNG TRƯỜNG TÁC CHIẾN, damage 34, fireRate 0.18s, magSize 30, range 25m.
  - `shotgun` / `blaster_f` (Enforcer): SÚNG TRƯỜNG TẦM XA, `pellets: 1`, damage 38, fireRate 0.22s, magSize 25, range 28m, độ chính xác cao.
  - `plasma` / `blaster_j` (Plasma Rifle): SÚNG TRƯỜNG NĂNG LƯỢNG, damage 44, fireRate 0.24s, magSize 24.

- [x] **Step 3: Cập nhật nhóm Shotgun cận chiến (Primary)**
  - `scatter` / `blaster_g` (Scatter-V): SHOTGUN TÁN XẠ, pellets 8, damage 15/viên, fireRate 0.75s, range 11m, tản đạn rộng.
  - `blaster_l` (Double Barrel): SHOTGUN HAI NÒNG, pellets 10, damage 14/viên, magSize 2, fireRate 0.32s, reloadTime 1.35s.
  - `blaster_m` (Breacher): SHOTGUN CHIẾN THUẬT, pellets 6, damage 18/viên, magSize 6, fireRate 0.65s, range 13m.

- [x] **Step 4: Cập nhật nhóm Bắn tỉa Sniper & DMR (Primary)**
  - `awp` / `blaster_n` (Vortex Sniper): SÚNG BẮN TỈA HẠNG NẶNG, damage 130, magSize 5, fireRate 1.35s, pierceCount 2, range 38m.
  - `blaster_o` (Titan DMR): SÚNG BẮN TỈA BÁN TỰ ĐỘNG, damage 65, magSize 12, fireRate 0.42s, range 32m.

- [x] **Step 5: Cập nhật nhóm Vũ khí Hạng Nặng (Primary)**
  - `blaster_q` (Vulcan Minigun): SÚNG MÁY GATLING, damage 15, fireRate 0.09s, magSize 80, reloadTime 2.8s.
  - `rocket` / `blaster_p` (RPG Devastator): SÚNG PHÓNG LỰU HẠNG NẶNG, damage 135, magSize 2.
  - `blaster_r` (Omega Cannon): PHÁO LƯỢNG TỬ TẬN THẾ, damage 165, magSize 3.

- [x] **Step 6: Cập nhật `SECONDARY_WEAPON_IDS` và `getBulletType(w)`**
  - Thêm `blaster_c`, `blaster_i` vào `SECONDARY_WEAPON_IDS`.
  - Hàm `getBulletType`:
    - `shotgun` bullet type: các súng có `pellets > 1`, hoặc `blaster_g`, `blaster_l`, `blaster_m`.
    - `sniper` bullet type: `blaster_n` (`awp`), `blaster_o`.
    - `rifle` bullet type: `blaster_e`, `blaster_f`, `blaster_d`.
    - `plasma` bullet type: `blaster_j`.
    - `pistol` bullet type: `blaster_a`, `blaster_b`, `blaster_c`, `mac10`, `blaster_i`, `pew`.

---

### Task 2: Đồng bộ hóa cấu hình Nón Tầm Nhìn (Vision Cone Overlay)
**Files:**
- Modify: `src/gameplay/combat/vision-cone.js:10-64`

**Interfaces:**
- Consumes: Cấu hình vũ khí qua hàm `getWeaponVisionConfig(weapon, isADS, opticTier)`.
- Produces: Bộ thông số `{ visionRange, visionAngle, proximityRadius }` chuẩn xác theo chiến thuật từng dòng súng.

- [x] **Step 1: Cập nhật logic phân loại nhóm vũ khí trong `getWeaponVisionConfig`**
  - Nhóm Shotgun (`pellets > 1`, hoặc id `scatter`, `blaster_g`, `blaster_l`, `blaster_m`, hoặc cat chứa `SHOTGUN`, `SĂN`):
    - Hip: `visionRange: 13.0`, `visionAngle: 75.0`
    - ADS: `visionRange: 17.0`, `visionAngle: 55.0`
  - Nhóm Sniper & DMR (id `awp`, `blaster_n`, `blaster_o`, hoặc cat chứa `BẮN TỈA`, `SNIPER`, `DMR`):
    - Hip: `visionRange: 24.0`, `visionAngle: 42.0`
    - ADS: `visionRange: 45.0 - 60.0`, `visionAngle: 14.0 - 18.0` (tùy theo opticTier kính ngắm)
  - Nhóm Súng trường AR & Carbine (id `blaster_e`, `blaster_f`, `plasma`, hoặc cat chứa `SÚNG TRƯỜNG`, `CARBINE`):
    - Hip: `visionRange: 21.0`, `visionAngle: 50.0`
    - ADS: `visionRange: 30.0 - 38.0`, `visionAngle: 32.0`
  - Nhóm Súng lục & SMG (id `blaster`, `blaster_b`, `blaster_c`, `repeater`, `mac10`, `blaster_i`, `pew`):
    - Hip: `visionRange: 18.0`, `visionAngle: 55.0`
    - ADS: `visionRange: 24.0`, `visionAngle: 40.0`
  - Nhóm Heavy Minigun & Rocket (id `blaster_q`, `rocket`, `blaster_r`):
    - Hip: `visionRange: 20.0`, `visionAngle: 48.0`
    - ADS: `visionRange: 28.0`, `visionAngle: 35.0`

---

### Task 3: Cập nhật Kho Vũ Khí (Showroom UI) & Loadout Tương Thích Ngược
**Files:**
- Modify: `src/ui/showroom.js:50-105`
- Modify: `src/gameplay/combat/weapons.js:834-850`

**Interfaces:**
- Consumes: Cấu hình súng với `slotType` mới.
- Produces: UI kho vũ khí hiển thị đúng số lượng súng chính (12 khẩu) và súng phụ (6 khẩu), nhãn danh mục chuẩn, không bị nhầm lẫn trang bị.

- [x] **Step 1: Tương thích ngược loadout cho người chơi**
  - Đảm bảo trong hàm khởi tạo loadout (`getSavedLoadout`), nếu slot `primary` đang giữ súng thuộc `SECONDARY_WEAPON_IDS` (như `blaster_c` hoặc `blaster_i`), tự động chuyển súng đó sang slot `secondary` (nếu slot phụ chưa có) hoặc khôi phục slot chính về súng chính mặc định (`blaster_e` / `repeater`).
- [x] **Step 2: Cập nhật số đếm thống kê và nhãn danh mục trong Showroom**
  - Đảm bảo thẻ súng hiển thị đúng danh mục mới: `SHOTGUN CHIẾN THUẬT`, `SÚNG TRƯỜNG TẦM XA`, `SÚNG LỤC BÁN TỰ ĐỘNG`, `SÚNG LỤC CỠ LỚN`, v.v.
  - Kiểm tra tab lọc `VŨ KHÍ CHÍNH` (12 thẻ) và `VŨ KHÍ PHỤ` (6 thẻ).

---

### Task 4: Kiểm Thử Toàn Diện Với Browser Subagent & Xác Thực Trải Nghiệm Gameplay
**Files:**
- Test runtime: Browser Subagent kiểm thử trên `http://localhost:8080`

- [x] **Step 1: Kiểm thử giao diện Kho Vũ Khí**
  - Mở giao diện Kho vũ khí trong game.
  - Chuyển đổi giữa 2 tab Vũ khí chính và Vũ khí phụ.
  - Xác nhận:
    - Tab Vũ khí chính có đủ 12 khẩu: BLASTER-D, E, F, G, J, L, M, N, O, P, Q, R.
    - Tab Vũ khí phụ có đủ 6 khẩu: BLASTER-A, B, C, H, I, K.
    - Không có bất kỳ thẻ súng nào bị sai tên hoặc thiếu ảnh.
- [x] **Step 2: Kiểm thử gameplay trong đấu trường**
  - Trang bị thử Shotgun (`blaster_g` hoặc `blaster_m`): bắn thấy đạn chùm tỏa ra, góc nhìn rộng 75°.
  - Trang bị thử Sniper (`blaster_n`): chuột phải ngắm thấy tầm nhìn phóng cực xa và góc thu hẹp chuẩn bắn tỉa.
  - Trang bị thử Súng trường tầm xa (`blaster_f`): bắn đơn phát đầm tay, độ chính xác cao.
  - Xác nhận console không phát sinh bất kỳ lỗi JavaScript nào.
