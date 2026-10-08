# KẾ HOẠCH TRIỂN KHAI: CHẾ ĐỘ ĐỐI KHÁNG CHIA TEAM VÀ TẦM NHÌN HÌNH QUẠT (TDM & DYNAMIC VISION CONE)

> **Dành cho kỹ sư triển khai:** Kỹ năng thực thi kế hoạch: `superpowers:executing-plans` (hoặc `superpowers:subagent-driven-development`). Các bước sử dụng cú pháp checkbox (`- [ ]`) để theo dõi tiến độ.
> **Lưu ý quy tắc đặc thù:** Không tạo file test tự động theo quy định dự án (sử dụng `npm run check` và kiểm tra thực tế trên trình duyệt). Không tự động commit git. Đặt tên biến/hàm bằng tiếng Anh, chú thích mã nguồn bằng tiếng Việt. Không sử dụng biểu tượng cảm xúc (emoji/icon).

**Mục tiêu:** Xây dựng chế độ đối kháng 4v4 chia 2 phe (Team Xanh vs Team Đỏ) chạm mốc 20 mạng để chiến thắng, cùng hệ thống tầm nhìn hình quạt động (Dynamic Vision Cone / Fog of War) thay đổi theo loại vũ khí và độ ngắm tâm.

**Kiến trúc:** 
Tách biệt module tầm nhìn (`src/gameplay/combat/vision-cone.js`) và module quản lý đối kháng (`src/gameplay/combat/tdm.js`). Hệ thống mặt nạ bóng tối 2D Canvas Overlay (`#vision-cone-canvas`) thực hiện khoét luồng sáng hình quạt kết hợp thuật toán loại trừ tầm nhìn (Visibility Culling) trên không gian XZ. Tích hợp lựa chọn chế độ chơi từ Menu chính vào vòng lặp `main.js` mà không làm ảnh hưởng đến chế độ Sinh tồn Zombie hiện có.

**Công nghệ sử dụng:** HTML5 Canvas 2D Context, Three.js, JavaScript ES Modules, CSS3.

**Tài liệu đặc tả:** `docs/superpowers/specs/2026-10-08-team-deathmatch-vision-cone-design.md`

## Các ràng buộc toàn cục
- Không tạo file test mới (Not create file test).
- Sử dụng tiếng Anh để đặt tên biến, thuộc tính, hàm và class (Use English to name the value).
- Chú thích mã nguồn hoàn toàn bằng tiếng Việt.
- Không sử dụng biểu tượng cảm xúc (emoji) trong mã nguồn hoặc giao diện.
- Không tự động commit git (Do not auto commit to git).
- Mốc điểm chiến thắng TDM: 20 mạng hạ gục. Thời gian hồi sinh: 3.0 giây. Thời gian khiên bất tử: 1.5 giây.
- Tầm nhìn: Shotgun (tầm 12m, góc 110 độ), Rifle (tầm 20m, góc 75 độ), Sniper (tầm 24m Hipfire, 38m - 65m khi ADS với góc hẹp 12 - 28 độ).

## Trọng tâm kiểm tra chất lượng (Review Focus)
1. Thao tác bật/tắt ngắm (ADS): Luồng sáng hình quạt và góc nhìn phải chuyển đổi mượt mà bằng phép nội suy (lerp), không bị giật khung hình.
2. Đối thủ đi ra khỏi góc quạt và bán kính chân: Cả model 3D, thanh máu và tên trên radar phải biến mất hoàn toàn, không để lộ bóng.
3. Đồng đội cùng phe: Luôn luôn nhìn thấy được, đạn của đồng đội bắn xuyên qua nhau mà không gây sát thương.
4. Bot AI hai phe: Tự động di chuyển tuần tra, phát hiện mục tiêu theo tầm nhìn và tự động hồi sinh sau 3 giây khi bị tiêu diệt.
5. Chuyển đổi giữa chế độ Sinh tồn Zombie và Đối kháng TDM: Không phát sinh lỗi xung đột tài nguyên hoặc rò rỉ bộ nhớ.

---

### Nhiệm vụ 1: Xây dựng Phân hệ Cấu hình Tầm nhìn và Mặt nạ Bóng tối (Vision Cone Overlay)

**Các tệp tin:**
- Tạo mới: `src/gameplay/combat/vision-cone.js`
- Chỉnh sửa: `index.html` (thêm thẻ canvas `#vision-cone-canvas`), `styles/main.css`

**Giao diện & Phương thức:**
- Cung cấp:
  + `getWeaponVisionConfig(weapon, isADS, opticTier)`: Trả về `{ visionRange, visionAngle, proximityRadius }`.
  + Class `VisionConeOverlay`:
    - `constructor(canvasElement, camera)`
    - `resize(width, height)`
    - `update(observerPlayer, delta)`
    - `render(observerPlayer, isTDMMode)`
    - `clear()`

- [ ] **Bước 1: Thêm thẻ Canvas `#vision-cone-canvas` vào `index.html` và cấu hình CSS**
  Đặt thẻ canvas ngay sau `#game-canvas` và trước `#hud`:
  ```html
  <canvas id="vision-cone-canvas"></canvas>
  ```
  Trong `styles/main.css`: Định vị tuyệt đối `pointer-events: none; position: fixed; inset: 0; z-index: 15; width: 100%; height: 100%;`.

- [ ] **Bước 2: Xây dựng bảng cấu hình tầm nhìn theo vũ khí trong `src/gameplay/combat/vision-cone.js`**
  Hiện thực hàm `getWeaponVisionConfig(weapon, isADS, opticTier)` trả về đúng các giá trị theo bảng trong tài liệu đặc tả:
  - Shotgun: range 12.0m / angle 110 deg (ADS: 16.0m / 75 deg).
  - Pistol / SMG: range 17.0m / angle 85 deg (ADS: 22.0m / 65 deg).
  - Rifle: range 20.0m / angle 75 deg (ADS: 26m-42m / 55-22 deg tùy opticTier).
  - Sniper: range 24.0m / angle 60 deg (ADS: 38m-65m / 28-12 deg tùy opticTier).

- [ ] **Bước 3: Hiện thực lớp `VisionConeOverlay` trong `src/gameplay/combat/vision-cone.js`**
  - Quản lý 2D canvas context.
  - Nội suy mượt mà các thông số `currentRange`, `currentAngle`, `currentProximity` theo thời gian thực (lerp speed 12.0) khi chuyển trạng thái Hipfire <-> ADS.
  - Vẽ lớp phủ tối màu đen xanh `rgba(6, 9, 14, 0.92)` và dùng `destination-out` kết hợp Radial Gradient để khoét hình quạt cùng quầng sáng chân.

- [ ] **Bước 4: Kiểm tra tính đúng đắn cấu trúc dự án**
  Chạy lệnh: `npm run check`
  Kết quả mong đợi: `OK: module imports, HTML, configured models...`

---

### Nhiệm vụ 2: Hiện thực Thuật toán Loại trừ Tầm nhìn (Visibility Culling) và Tích hợp vào Main Loop

**Các tệp tin:**
- Chỉnh sửa: `src/gameplay/combat/vision-cone.js`
- Chỉnh sửa: `src/app/main.js`

**Giao diện & Phương thức:**
- Cung cấp:
  + `checkEntityVisibility(observer, target, visionConfig)`: Trả về boolean `true` (nhìn thấy) hoặc `false` (bị che khuất).
  + `applyVisibilityCulling(observer, entities, visionConfig)`: Tự động bật/tắt `mesh.visible`, `healthbar.visible`.

- [ ] **Bước 1: Hiện thực hàm `checkEntityVisibility` trong `src/gameplay/combat/vision-cone.js`**
  - Nếu `observer.team === target.team`: Trả về `true` (đồng đội luôn hiển thị).
  - Nếu khoảng cách 2D XZ `<= visionConfig.proximityRadius`: Trả về `true`.
  - Nếu khoảng cách `> visionConfig.visionRange`: Trả về `false`.
  - Tính góc lệch `Math.atan2(dx, dz) - observer.aimYaw`, chuẩn hóa về `[-PI, PI]`. Nếu `|angleDiff| <= coneAngle / 2`: Trả về `true`, ngược lại `false`.

- [ ] **Bước 2: Hiện thực hàm `applyVisibilityCulling` trong `src/gameplay/combat/vision-cone.js`**
  Lặp qua danh sách đối thủ, gọi `checkEntityVisibility`. Cập nhật thuộc tính `mesh.visible`, `healthbar.container?.style` hoặc Three.js healthbar mesh tương ứng.

- [ ] **Bước 3: Tích hợp `VisionConeOverlay` vào `CyberArenaGame` trong `src/app/main.js`**
  - Khởi tạo `this.visionCone = new VisionConeOverlay(document.getElementById('vision-cone-canvas'), this.camera);`.
  - Trong hàm `animate()`: Nếu `this.gameMode === 'TDM'`, gọi `this.visionCone.update(this.player, delta)`, vẽ mặt nạ và thực hiện culling cho các đối thủ. Nếu ở chế độ khác, xóa sạch canvas.
  - Xử lý sự kiện resize cửa sổ để cập nhật kích thước canvas.

- [ ] **Bước 4: Kiểm tra tính đúng đắn cấu trúc dự án**
  Chạy lệnh: `npm run check`
  Kết quả mong đợi: `OK: module imports, HTML, configured models...`

---

### Nhiệm vụ 3: Xây dựng Phân hệ Quản lý Đối kháng TDM và Bot AI Phân đội

**Các tệp tin:**
- Tạo mới: `src/gameplay/combat/tdm.js`
- Chỉnh sửa: `src/gameplay/combat/weapons.js`

**Giao diện & Phương thức:**
- Cung cấp:
  + Class `TDMManager`:
    - `constructor(game)`
    - `startMatch(playerTeam = 'blue', teamSize = 4)`
    - `update(delta)`
    - `onEntityKilled(victim, killer)`
    - `respawnEntity(entity)`
    - `endMatch(winningTeam)`
    - `cleanup()`
  + Class `TDMBot`: Quản lý logic AI cho từng bot chiến binh.

- [ ] **Bước 1: Thêm kiểm tra Friendly Fire trong `src/gameplay/combat/weapons.js`**
  Trong logic va chạm đạn và bom gây sát thương:
  Kiểm tra nếu người bắn và mục tiêu đều có thuộc tính `team` và `shooter.team === target.team`, bỏ qua sát thương.

- [ ] **Bước 2: Xây dựng class `TDMBot` trong `src/gameplay/combat/tdm.js`**
  - Quản lý model nhân vật, vũ khí trang bị theo phe.
  - Các trạng thái hành vi: `PATROL` (tuần tra qua các điểm chốt), `ENGAGE` (truy đuổi và nổ súng khi mục tiêu lọt vào tầm mắt), `RESPAWNING` (đếm ngược 3 giây).
  - Điều chỉnh cự ly chiến đấu phù hợp với vũ khí (Shotgun áp sát dưới 8m, Rifle giữ 14-18m, Sniper đứng từ 22m).

- [ ] **Bước 3: Xây dựng class `TDMManager` trong `src/gameplay/combat/tdm.js`**
  - Quản lý danh sách thành viên `teamBlue` và `teamRed`.
  - Điểm xuất phát của phe Xanh (tọa độ phía Tây Nam bản đồ) và phe Đỏ (tọa độ phía Đông Bắc bản đồ).
  - Bộ đếm tỷ số `scoreBlue` và `scoreRed`, kiểm tra điều kiện đạt 20 mạng -> Gọi `endMatch()`.
  - Cơ chế hồi sinh: Sau 3 giây đưa về điểm xuất phát của đội nhà, phục hồi đầy máu/giáp và kích hoạt 1.5 giây khiên bất tử (`invulnerability = 1.5`).

- [ ] **Bước 4: Kiểm tra tính đúng đắn cấu trúc dự án**
  Chạy lệnh: `npm run check`
  Kết quả mong đợi: `OK: module imports, HTML, configured models...`

---

### Nhiệm vụ 4: Xây dựng Giao diện TDM HUD, Killfeed và Màn hình Kết thúc Trận

**Các tệp tin:**
- Chỉnh sửa: `src/ui/ui.js`
- Chỉnh sửa: `index.html`
- Chỉnh sửa: `styles/main.css`

**Giao diện & Phương thức:**
- Cung cấp:
  + `showTDMScoreboard(scoreBlue, scoreRed, targetKills)`
  + `hideTDMScoreboard()`
  + `addTDMKillFeed(killerName, victimName, killerTeam)`
  + `showTDMRespawnCountdown(remainingSeconds)`
  + `hideTDMRespawnCountdown()`
  + `showTDMMatchResult(winnerTeam, playerTeam, stats)`

- [ ] **Bước 1: Bổ sung các phần tử HTML giao diện TDM vào `index.html`**
  - Header thanh tỷ số TDM: Điểm Đội Xanh, Mốc 20 Mạng, Điểm Đội Đỏ, Đồng hồ trận đấu.
  - Vùng hiển thị Kill Feed ở góc trên bên phải.
  - Khung thông báo hồi sinh đếm ngược giữa màn hình.
  - Hộp thoại kết quả trận đấu TDM (Chiến Thắng / Thất Bại) kèm bảng thông số Kills / Deaths và nút Đấu Lại / Về Sảnh.

- [ ] **Bước 2: Viết CSS tạo phong cách đồ họa quân sự cao cấp trong `styles/main.css`**
  - Tông màu xanh neon cho Đội Xanh (`#38bdf8`) và đỏ cam cho Đội Đỏ (`#f87171`).
  - Hiệu ứng đổ bóng mờ, viền phát sáng và kiểu chữ hiện đại phù hợp giao diện game.

- [ ] **Bước 3: Hiện thực các phương thức điều khiển giao diện TDM trong `src/ui/ui.js`**
  Hiện thực `updateTDMScore(blue, red)`, `addKillFeed(killer, victim, isEnemy)`, `setRespawnCountdown(seconds)` và `showTDMResult(isVictory, stats, onRestart, onHome)`.

- [ ] **Bước 4: Kiểm tra tính đúng đắn cấu trúc dự án**
  Chạy lệnh: `npm run check`
  Kết quả mong đợi: `OK: module imports, HTML, configured models...`

---

### Nhiệm vụ 5: Tích hợp Lựa chọn Chế độ chơi tại Menu Chính và Vòng đời Trận đấu

**Các tệp tin:**
- Chỉnh sửa: `src/ui/home.js`
- Chỉnh sửa: `src/app/main.js`

**Giao diện & Phương thức:**
- Cung cấp:
  + Chọn chế độ chơi: Sinh Tồn Zombie vs Đối Kháng 4v4 TDM.
  + Điều hướng khởi động trận đấu `startTDMGame(team)` trong `main.js`.
  + Tự động dọn dẹp và trả về trạng thái Menu khi rời trận hoặc kết thúc.

- [ ] **Bước 1: Bổ sung nút chọn chế độ chơi trong `src/ui/home.js` và `index.html`**
  - Thêm cụm nút chuyển đổi chế độ ở Menu chính:
    + Nút "SINH TỒN ZOMBIE"
    + Nút "ĐỐI KHÁNG 4V4 (TDM)"
  - Khi bấm "ĐỐI KHÁNG 4V4", mở hộp thoại chọn phe: "Gia nhập Đội Xanh" hoặc "Gia nhập Đội Đỏ" và nút "BẮT ĐẦU CHIẾN ĐẤU".

- [ ] **Bước 2: Tích hợp khởi chạy chế độ TDM trong `src/app/main.js`**
  - Thêm phương thức `startTDM(playerTeam)`:
    + Đặt `this.gameMode = 'TDM'`.
    + Ẩn thanh HUD wave zombie, hiển thị TDM scoreboard.
    + Tạm dừng `this.waveManager`.
    + Khởi tạo `this.tdmManager.startMatch(playerTeam, 4)`.
  - Trong phương thức `returnToMenu()`:
    + Dọn dẹp `this.tdmManager.cleanup()`.
    + Khôi phục `this.gameMode = 'SURVIVAL'`.
    + Xóa sạch lớp phủ Vision Cone.

- [ ] **Bước 3: Đảm bảo khả năng tương thích và sẵn sàng mở rộng P2P Multiplayer**
  Đảm bảo dữ liệu `player.team` được đính kèm vào network state trong trường hợp phòng chơi kích hoạt chế độ đối kháng.

- [ ] **Bước 4: Kiểm tra tính đúng đắn cấu trúc dự án**
  Chạy lệnh: `npm run check`
  Kết quả mong đợi: `OK: module imports, HTML, configured models...`

---

### Nhiệm vụ 6: Đánh giá Hoàn thành và Kiểm tra Toàn diện

**Các tệp tin:**
- Kiểm tra toàn bộ mã nguồn liên quan.

- [ ] **Bước 1: Kiểm tra cú pháp và liên kết module toàn dự án**
  Chạy lệnh: `npm run check`
  Kết quả mong đợi: Không có lỗi import, không thiếu file asset hoặc cú pháp lỗi.

- [ ] **Bước 2: Kiểm tra nghiệm thu cơ chế Tầm nhìn (Vision Cone)**
  - Kiểm tra các loại súng: Shotgun cho góc mở rộng và tầm ngắn; Rifle cân bằng; Sniper soi xa và bị thu hẹp góc (Tunnel vision).
  - Kiểm tra đối thủ ngoài góc quạt và bán kính chân bị ẩn hoàn toàn.

- [ ] **Bước 3: Kiểm tra nghiệm thu cơ chế Đối kháng (TDM)**
  - Đội Xanh và Đội Đỏ không bắn gây thương tích cho đồng đội.
  - Bot AI 2 phe tự động giao chiến, hạ gục cộng điểm chính xác.
  - Đếm ngược hồi sinh 3 giây và trạng thái khiên bất tử hoạt động chuẩn xác.
  - Trận đấu dừng khi một bên đạt 20 mạng và hiển thị kết quả.
