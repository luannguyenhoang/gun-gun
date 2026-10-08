# ĐẶC TẢ THIẾT KẾ: CHẾ ĐỘ ĐỐI KHÁNG CHIA TEAM VÀ TẦM NHÌN HÌNH QUẠT (TDM & DYNAMIC VISION CONE)

## 1. TỔNG QUAN VÀ MỤC TIÊU
Tài liệu này quy định kiến trúc và đặc tả kỹ thuật chi tiết cho chế độ chơi mới: **Đối Kháng Chia Đội (Team Deathmatch - TDM)** cùng cơ chế **Tầm Nhìn Hình Quạt Động (Dynamic Vision Cone / Fog of War)** trên nền tảng Three.js của trò chơi Gun-Gun (Zombie Arena).

### 1.1. Mục tiêu cốt lõi
- Xây dựng chế độ đối kháng 2 phe: Đội Xanh (Blue) và Đội Đỏ (Red).
- Hỗ trợ cả chơi ngoại tuyến (Offline) luyện tập với Bot AI chia 2 phe và sẵn sàng đồng bộ qua mạng phòng chơi nhiều người (Multiplayer P2P).
- Luật thi đấu: Đấu đội tính điểm (Team Deathmatch) chạm mốc 20 mạng hạ gục để giành chiến thắng, cơ chế tự động hồi sinh sau 3 giây.
- Cơ chế tầm nhìn hình quạt theo loại vũ khí và kính ngắm:
  + Shotgun (Súng săn): Tầm nhìn ngắn, góc quạt cực rộng bao quát cận chiến.
  + Súng trường (Rifle): Tầm nhìn và góc mở cân bằng.
  + Súng ngắm (Sniper): Tầm nhìn cực xa khi mở tâm ngắm (ADS), kèm hiệu ứng góc nhìn đường hầm (Tunnel Vision - thu cực hẹp góc hai bên sườn và sau lưng để cân bằng trò chơi).
  + Xung quanh ngoài vùng chiếu sáng sẽ bị phủ bóng tối và đối thủ ngoài góc quạt sẽ hoàn toàn vô hình.

---

## 2. CƠ CHẾ TẦM NHÌN HÌNH QUẠT ĐỘNG (DYNAMIC VISION CONE & FOG OF WAR)

### 2.1. Bảng thông số tầm nhìn theo vũ khí và trạng thái ngắm

Mỗi loại vũ khí được định nghĩa các thông số:
- `visionRange`: Khoảng cách xa nhất của luồng sáng (mét trên tọa độ thế giới).
- `visionAngle`: Góc mở hình quạt của luồng sáng (độ).
- `proximityRadius`: Bán kính quầng sáng quan sát cận cảnh xung quanh chân người chơi (mét).

Chi tiết thông số từng nhóm vũ khí:

| Nhóm vũ khí | Bắn từ hông (Hipfire) Tầm xa | Bắn từ hông Góc mở | Bắn từ hông Cận cảnh | Ngắm tâm (ADS) Tầm xa | Ngắm tâm (ADS) Góc mở | Ngắm tâm (ADS) Cận cảnh | Ghi chú cân bằng |
|---|---|---|---|---|---|---|---|
| **Shotgun** (Scatter, Breacher, Heavy) | 12.0m | 110 độ | 2.5m | 16.0m | 75 độ | 1.8m | Làm chủ cận chiến, góc quét cực rộng |
| **Pistol / SMG** (Blaster, Striker) | 17.0m | 85 độ | 2.2m | 22.0m | 65 độ | 1.5m | Độ cơ động cao, cự ly trung bình |
| **Rifle / Carbine** (Repeater, Carbine) | 20.0m | 75 độ | 2.0m | 26.0m (1x) / 34.0m (2x) / 42.0m (4x) | 55 độ (1x) / 35 độ (2x) / 22 độ (4x) | 1.8m -> 0.8m | Cân bằng, góc hẹp dần khi tăng độ thu phóng kính ngắm |
| **Sniper / DMR** (Sniper, Railgun) | 24.0m | 60 độ | 1.8m | 38.0m (2x) / 50.0m (4x) / 65.0m (8x) | 28 độ (2x) / 18 độ (4x) / 12 độ (8x) | 1.0m -> 0.4m | Soi cực xa nhưng gần như mù hoàn toàn 2 bên sườn và sau lưng |

### 2.2. Kỹ thuật hiển thị mặt nạ bóng tối (2D Canvas Darkness Mask)
- **Lớp phủ (Overlay)**: Sử dụng một thẻ `<canvas id="vision-cone-canvas">` nằm ngay phía trên `game-canvas` và bên dưới lớp giao diện HUD UI, kích thước đồng bộ tuyệt đối với độ phân giải của màn hình.
- **Quy trình vẽ trên mỗi khung hình**:
  1. `ctx.clearRect(0, 0, width, height)`: Xóa khung hình cũ.
  2. `ctx.fillStyle = 'rgba(6, 9, 14, 0.92)'`: Tô toàn bộ canvas bằng màu bóng tối quân sự với độ mờ 92%.
  3. `ctx.globalCompositeOperation = 'destination-out'`: Kích hoạt chế độ khoét thủng lớp bóng tối.
  4. Chuyển tọa độ 3D của nhân vật chính trên mặt đất sang tọa độ 2D trên màn hình thông qua hàm `project(camera)`.
  5. Khoét hình quạt góc nhìn:
     - Tính góc bắt đầu: `startAngle = screenAimAngle - (visionAngleRad / 2)`.
     - Tính góc kết thúc: `endAngle = screenAimAngle + (visionAngleRad / 2)`.
     - Tạo dải màu xuyên tâm (Radial Gradient) từ tâm ra mép xa: tâm trong suốt 100%, mép ngoài vươn ra mờ dần để ánh sáng chuyển tiếp mềm mại.
     - Vẽ cung tròn hình quạt từ tâm.
  6. Khoét vùng sáng cận cảnh quanh chân:
     - Vẽ hình tròn với bán kính `screenProximityRadius` quanh tâm nhân vật với dải màu Radial Gradient mềm mại.
  7. Khôi phục `ctx.globalCompositeOperation = 'source-over'`.

### 2.3. Thuật toán ẩn/hiện đối thủ (Visibility Culling)
- **Chu kỳ tính toán**: Thực hiện trong hàm cập nhật logic trước khi Three.js dựng khung hình.
- **Thuật toán kiểm tra đối thủ**:
  ```javascript
  // Kiểm tra tính hữu hình của đối thủ đối với người chơi quan sát
  function computeEntityVisibility(observer, target, visionConfig) {
      // 1. Nếu là đồng đội cùng phe: Luôn luôn hiển thị để dễ phối hợp tác chiến
      if (observer.team === target.team) {
          return true;
      }

      const dx = target.position.x - observer.position.x;
      const dz = target.position.z - observer.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      // 2. Kiểm tra vùng cận cảnh xung quanh chân
      if (dist <= visionConfig.proximityRadius) {
          return true;
      }

      // 3. Nếu vượt quá tầm xa chiếu sáng tối đa: Ẩn đối thủ
      if (dist > visionConfig.visionRange) {
          return false;
      }

      // 4. Kiểm tra góc lệch hình quạt trên mặt phẳng XZ
      const angleToTarget = Math.atan2(dx, dz); // Hướng từ người quan sát tới mục tiêu
      let angleDiff = Math.abs(angleToTarget - observer.aimYaw);
      while (angleDiff > Math.PI) angleDiff = Math.abs(angleDiff - 2 * Math.PI);

      const halfCone = (visionConfig.visionAngle * Math.PI / 180) / 2;
      return angleDiff <= halfCone;
  }
  ```
- **Xử lý khi bị ẩn (Invisible State)**:
  - `target.mesh.visible = false`.
  - `target.healthbar.visible = false`.
  - Không hiện tên và không hiện trên radar ngoài rìa màn hình.
- **Hiệu ứng tia đạn trong bóng tối**:
  - Khi đối thủ đang ẩn nấp bắn súng trong bóng tối, tia đạn (Bullet Tracers) và tia lửa nòng (Muzzle Sparks) vẫn được hiển thị bình thường để người chơi nhìn thấy hướng bắn và phán đoán vị trí địch.

---

## 3. KIẾN TRÚC PHÂN HỆ ĐỐI KHÁNG (TEAM DEATHMATCH SUBSYSTEM)

### 3.1. Lớp quản lý trung tâm: `TDMManager` (`src/gameplay/combat/tdm.js`)

Lớp này quản lý toàn bộ vòng đời của trận đấu đối kháng:
- **Các trạng thái vòng đời (Lifecycle States)**:
  + `WAITING`: Chờ người chơi chọn phe hoặc sẵn sàng vào trận.
  + `ACTIVE`: Trận đấu đang diễn ra.
  + `MATCH_OVER`: Trận đấu kết thúc khi một đội chạm mốc 20 điểm hạ gục.
- **Thuộc tính cốt lõi**:
  + `targetKills`: 20 mạng hạ gục.
  + `scoreBlue`: Điểm hạ gục của Đội Xanh.
  + `scoreRed`: Điểm hạ gục của Đội Đỏ.
  + `playerTeam`: Phe của người chơi chính (`blue` hoặc `red`).
  + `blueMembers`: Danh sách thành viên phe Xanh (Bao gồm Người chơi và các Bot đồng minh).
  + `redMembers`: Danh sách thành viên phe Đỏ (Các Bot đối thủ hoặc đối thủ qua mạng).
  + `spawnPointsBlue`: Tập hợp các vị trí xuất phát của phe Xanh (phía Tây Nam bản đồ).
  + `spawnPointsRed`: Tập hợp các vị trí xuất phát của phe Đỏ (phía Đông Bắc bản đồ).
  + `respawnDuration`: 3.0 giây.
- **Các phương thức chính**:
  + `startMatch(playerTeam, teamSize = 4)`: Khởi tạo bản đồ, đặt lại tỷ số 0 - 0, sinh các Bot AI cho 2 phe và đưa tất cả về điểm xuất phát tương ứng.
  + `update(delta)`: Cập nhật trạng thái trận đấu, bộ đếm thời gian hồi sinh, kiểm tra điều kiện chiến thắng.
  + `onKill(killer, victim)`:
    - Cộng điểm cho phe của `killer`.
    - Đẩy sự kiện vào hệ thống thông báo hạ gục (Kill Feed).
    - Kích hoạt đồng hồ hồi sinh 3 giây cho `victim`.
    - Nếu điểm số đạt 20: Gọi hàm `endMatch(winningTeam)`.
  + `respawnEntity(entity)`:
    - Chọn điểm xuất phát ngẫu nhiên thuộc khu vực phe nhà.
    - Phục hồi 100% Máu (Health) và 100% Giáp (Shield).
    - Cung cấp 1.5 giây hiệu ứng Khiên Bất Tử (Invulnerability) để chống việc bị bắn hạ ngay khi vừa xuất hiện (spawn camp).
  + `cleanup()`: Xóa sạch các Bot TDM và trả lại trạng thái nguyên bản cho Scene Three.js.

### 3.2. Cơ chế bắn và sát thương đồng minh (Friendly Fire)
- Trong hệ thống chiến đấu `weapons.js`:
  + Trước khi trừ máu mục tiêu, kiểm tra: `if (shooter.team && target.team && shooter.team === target.team) return;`
  + Bỏ qua hoàn toàn sát thương giữa các thành viên cùng phe.
  + Chỉ gây sát thương lên đối thủ khác phe.

### 3.3. Hệ thống Trí tuệ Nhân tạo cho Bot TDM (`TDMBotController`)
- **Phân loại hành vi**:
  1. `PATROL` (Tuần tra): Di chuyển linh hoạt giữa các vị trí chốt trên bản đồ để tìm kiếm đối thủ khác phe.
  2. `ENGAGE` (Tác chiến): Khi phát hiện đối thủ trong góc nhìn của mình:
     - Căn chỉnh khoảng cách tối ưu theo vũ khí đang trang bị (Shotgun: áp sát dưới 8m; Rifle: giữ cự ly 14-18m; Sniper: giữ khoảng cách trên 22m).
     - Xoay người về hướng mục tiêu và khai hỏa theo nhịp hợp lý.
  3. `DOWNED / DEAD` (Gục / Bị hạ): Khi máu <= 0, dừng mọi hành động, đếm ngược 3 giây rồi tự động hồi sinh ở căn cứ đội nhà.

---

## 4. GIAO DIỆN NGƯỜI DÙNG VÀ TRẢI NGHIỆM (UI / UX)

### 4.1. Chọn chế độ chơi tại Menu chính
- Bổ sung tab/nút chọn chế độ trên giao diện sảnh:
  + "SINH TỒN ZOMBIE" (Chế độ truyền thống theo từng đợt quái).
  + "ĐỐI KHÁNG CHIA TEAM (4V4 TDM)" (Chế độ đối kháng mới).
- Khi chọn chế độ TDM: Hiển thị hộp thoại lựa chọn phe (Gia nhập Đội Xanh hoặc Đội Đỏ) trước khi bấm "VÀO TRẬN".

### 4.2. Giao diện trong trận (TDM HUD)
- **Thanh tỷ số trên đầu màn hình**:
  + Bên trái: Biểu tượng và điểm số Đội Xanh (Màu xanh lam nổi bật).
  + Giữa: Mốc mục tiêu 20 Kills và đồng hồ thời gian trận đấu.
  + Bên phải: Biểu tượng và điểm số Đội Đỏ (Màu đỏ cam nổi bật).
- **Nhật ký hạ gục (Kill Feed - Góc trên bên phải)**:
  + Hiển thị dòng thông báo hạ gục động: `[Kẻ Hạ Gục] tiêu diệt [Nạn Nhân]`.
- **Màn hình chờ hồi sinh**:
  + Khi người chơi bị hạ, màn hình tối dần nhẹ và hiển thị thông báo:
    `BẠN ĐÃ BỊ HẠ GỤC - HỒI SINH TRONG [3 / 2 / 1] GIÂY...`

### 4.3. Màn hình Tổng kết Trận đấu (Match Result Modal)
- Khi một đội đạt mốc 20 điểm:
  + Nếu đội người chơi thắng: Hiển thị biểu ngữ `CHIẾN THẮNG! (VICTORY)`.
  + Nếu đội người chơi thua: Hiển thị biểu ngữ `THẤT BẠI! (DEFEAT)`.
  + Bảng chỉ số chi tiết: Tổng mạng hạ guc (Kills), Số lần bị hạ (Deaths), Danh hiệu MVP trận đấu.
  + Nút "ĐẤU LẠI" và nút "VỀ SẢNH CHÍNH".

---

## 5. TÍCH HỢP VÀ AN TOÀN HỆ THỐNG (SYSTEM INTEGRATION)

### 5.1. Không làm xáo trộn hệ thống Zombie Wave hiện tại
- Biến trạng thái: `game.gameMode`: `'SURVIVAL'` hoặc `'TDM'`.
- Khi ở chế độ `'SURVIVAL'`: Toàn bộ WaveManager, Zombie Spawner, Looting hoạt động nguyên bản như hiện tại; không bật mặt nạ bóng tối.
- Khi ở chế độ `'TDM'`: Tạm dừng WaveManager Zombie; khởi chạy TDMManager và kích hoạt Vision Cone Canvas.

### 5.2. Hiệu năng tính toán
- Canvas 2D Vision Mask được vẽ bằng các thao tác hình học cơ bản cực nhanh trên CPU/GPU 2D Context, không gây tụt khung hình (duy trì 60 FPS).
- Thuật toán Visibility Culling chỉ duyệt qua 8 nhân vật (4v4), thời gian tính toán dưới 0.05ms mỗi khung hình.

---

## 6. TIÊU CHÍ ĐÁNH GIÁ HOÀN THÀNH (ACCEPTANCE CRITERIA)

1. **Cơ chế Tầm nhìn**:
   - Màn hình có lớp bóng tối bao phủ đúng phong cách ảnh mẫu.
   - Cầm Shotgun góc nhìn cực rộng và tầm ngắn; cầm Rifle cân bằng; cầm Sniper ngắm tâm (ADS) soi rất xa nhưng hai bên sườn bị thu hẹp thành góc nhọn.
   - Đối thủ ngoài luồng sáng bị ẩn 100% (cả model 3D lẫn thanh máu).
2. **Cơ chế Đối kháng**:
   - Chia 2 phe Blue vs Red, không gây sát thương đồng đội.
   - Bot AI 2 phe tự động tìm nhau chiến đấu và tự động hồi sinh sau 3 giây.
   - Tỷ số cập nhật chính xác đến 20 mạng hạ gục và hiển thị màn hình tổng kết trận đấu.
