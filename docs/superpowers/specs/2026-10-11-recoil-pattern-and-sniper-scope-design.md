# Bản Thiết Kế Cơ Chế Nảy Tâm Có Quy Luật (Recoil Spray Pattern) & Kính Ngắm Bắn Tỉa (Sniper Scope)

**Ngày lập:** 2026-10-11  
**Trạng thái:** Chờ phê duyệt (Pending Approval)  
**Tác giả:** Antigravity AI  

---

## 1. Bối cảnh & Mục tiêu (Intent & The Why)
Người chơi phản hồi rằng:
1. Súng bắn tỉa khi ngắm chuột phải (ADS) góc nhìn vẫn còn quá rộng, chưa có cảm giác nhìn xa vượt trội và chưa hỗ trợ tốt cho thao tác "vẩy súng ngắm" (flick shot).
2. Độ giật của các súng tiểu liên (SMG) và súng trường đang bị nhẹ, việc nảy tâm hiện tại chỉ là ngẫu nhiên (random noise) mà không có quy luật, khiến người chơi không thể rèn luyện kỹ năng ghìm tâm (spray control) như các tựa game bắn súng thể thao điện tử (CS:GO, Valorant).

**Mục tiêu chính:**
1. **Quy luật nảy tâm (Recoil Spray Pattern) cho từng dòng súng liên thanh:**
   - Đếm nhịp đạn liên tục (`th_sprayCount`), tự động hồi tâm khi ngừng bắn.
   - Quỹ đạo nảy theo hình mẫu chuẩn: Viên 1-4 giật thẳng đứng lên trên; Viên 5-10 nảy chếch sang phải; Viên 11-20 bẻ ngoặt sang trái; Viên 21+ dao động ngang ở đỉnh.
   - Tăng lực nảy tâm (`cursorKick`) và rung giật màn hình (`screenShake`) để người chơi cảm nhận rõ lực nảy và dùng chuột ghìm ngược lại.
2. **Kính ngắm & Tầm nhìn siêu xa cho súng bắn tỉa (Sniper Scope & Vision Lead):**
   - Thu hẹp nón tầm nhìn (Vision Cone) xuống 8° - 10° khi bật ADS (Tunnel vision siêu sắc nét), tầm nhìn kéo dài 55m - 65m.
   - Cập nhật camera trong `updateCamera`: nhận diện chính xác các khẩu bắn tỉa (`awp`, `blaster_n`, `blaster_o`), đẩy camera về phía con trỏ chuột tới 18m - 22m (Pan Lead) và thu phóng khung hình phù hợp.
   - Bổ sung lớp phủ kính ngắm bắn tỉa chuyên dụng (Mil-dot Sniper Scope Overlay): vòng tròn đen 4 góc, ống kính quang học ở giữa với vạch chia tầm nét thanh mảnh, bật mượt mà khi ngắm súng tỉa.

**Quy tắc bắt buộc:**
- 100% tiếng Việt trong toàn bộ mã nguồn giao diện và mô tả.
- Tuyệt đối không tạo icon hoặc chèn icon mới vào giao diện.

---

## 2. Thiết Kế Chi Tiết

### 2.1. Hệ Thống Nảy Tâm Có Quy Luật (Spray Pattern)
- Tệp tin: `src/gameplay/player/player.js` & `src/gameplay/combat/weapons.js`.
- Bổ sung biến theo dõi trên người chơi:
  - `this.th_sprayShotCount = 0;`
  - `this.th_lastShotTime = 0;`
- Khi hàm `applyKickbackAndShake(kickStrength, shakeStrength, weapon)` được kích hoạt:
  - Kiểm tra khoảng cách thời gian từ viên trước: nếu quá 0.28 giây, đặt lại `th_sprayShotCount = 0`.
  - Tăng `th_sprayShotCount++`.
  - Tính toán offset nảy tâm theo chỉ số viên đạn:
    - Viên 1-4: `xOffset = (Math.random() - 0.5) * 0.15; yOffset = -1.0;`
    - Viên 5-10: `xOffset = 0.55 + (Math.random() - 0.5) * 0.2; yOffset = -0.75;`
    - Viên 11-20: `xOffset = -0.65 + (Math.random() - 0.5) * 0.2; yOffset = -0.45;`
    - Viên > 20: `xOffset = Math.sin(this.th_sprayShotCount * 1.5) * 0.7; yOffset = -0.3;`
  - Nhân với hệ số `kickStrength` đặc thù của súng và áp vào `this.cursorKick`.
  - Lực giật SMG (`blaster_d`, `mac10`) và AR (`blaster_e`, `blaster_f`) tăng từ 2.2 -> 3.6 - 4.2 để tạo cảm giác giật thật tay.

### 2.2. Trải Nghiệm Bắn Tỉa (Sniper Vision Cone, Camera Lead & Scope Overlay)
- Tệp tin: `src/gameplay/combat/vision-cone.js`, `src/gameplay/player/player.js`, `src/ui/ui.js`.
- **Nón tầm nhìn:**
  - Nhóm súng ngắm khi ngắm ADS: `visionRange: 60.0m`, `visionAngle: 9.0°`, `proximityRadius: 0.5m`.
- **Camera Pan Lead:**
  - Trong `player.js:updateCamera`:
    - Nhận diện đúng súng ngắm qua id `awp`, `blaster_n`, `blaster_o` hoặc category chứa `SNIPER` / `BẮN TỈA`.
    - Khi `this.isADS`: `maxLead` đạt 20.0m, tỷ lệ dịch chuyển camera đạt 0.75 (thay vì 0.55), zoom out hoặc điều chỉnh fov giúp mở rộng tầm nhìn về phía trước.
- **Kính ngắm Sniper Scope Overlay:**
  - Tạo canvas/DOM overlay tối viền chuyên dụng `#th_sniper_scope_overlay` trong `src/ui/ui.js`.
  - Khi người chơi cầm súng bắn tỉa và bật chuột phải ngắm (`isADS`), lớp phủ kích hoạt với hiệu ứng mờ viền ngoài (vignette blackout) và tâm chữ thập mil-dot kỹ thuật số sắc nét.
  - Khi nhả chuột phải, ống ngắm tự động ẩn mượt mà.

---

## 3. Danh Sách Tệp Cần Thay Đổi
1. `src/gameplay/combat/vision-cone.js`: Tinh chỉnh góc ngắm bắn tỉa còn 9.0° và tầm nhìn 60m.
2. `src/gameplay/player/player.js`: Triển khai spray pattern có quy luật trong `applyKickbackAndShake` và nâng cấp camera lead trong `updateCamera`.
3. `src/gameplay/combat/weapons.js`: Tăng chỉ số giật `cursorKick` cho các khẩu SMG và AR liên thanh.
4. `src/ui/ui.js`: Bổ sung lớp phủ kính ngắm Mil-dot Sniper Scope khi người chơi ngắm súng bắn tỉa.
5. Kiểm thử bằng Browser Subagent để xác thực trải nghiệm bắn tỉa và ghìm tâm.
