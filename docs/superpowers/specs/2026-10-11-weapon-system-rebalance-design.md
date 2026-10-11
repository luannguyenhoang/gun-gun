# Bản Thiết Kế Tái Cấu Trúc & Cân Bằng Toàn Diện Hệ Thống Vũ Khí (18 Khẩu Kenney Blaster)

**Ngày lập:** 2026-10-11  
**Trạng thái:** Chờ phê duyệt (Pending Approval)  
**Tác giả:** Antigravity AI  

---

## 1. Bối cảnh & Mục tiêu (Intent & The Why)
Trong phiên bản hiện tại, một số vũ khí đang bị dán nhãn và phân loại sai lệch so với ngoại hình mô hình 3D thực tế:
- Súng dáng dài như `blaster_f` (Enforcer) bị gán là Shotgun.
- Súng lục nhỏ gọn như `blaster_c` (Phantom) hoặc súng lục hạng nặng `blaster_i` (Sharpshooter) bị dán nhãn súng trường / súng ngắm.
- Súng thân hộp cận chiến `blaster_m` (Guardian) lại bị gắn nhãn súng bắn tỉa bán tự động.
- Hệ quả: Hệ thống nón tầm nhìn (Vision Cone), cơ chế tản đạn (spread/recoil), cự ly chiến đấu và cảm giác bắn bị đảo lộn, làm giảm tính chiến thuật và độ thỏa mãn khi người chơi chọn trang bị.

**Mục tiêu chính:**
1. Phân loại chuẩn xác 18 mẫu súng theo đúng hình dáng 3D thực tế của Kenney Blaster Kit (từ A đến R).
2. Phân chia chuẩn xác nhóm Vũ khí Chính (Primary) và Vũ khí Phụ (Secondary / Súng lục).
3. Thiết lập bảng chỉ số cân bằng chiến thuật (TTK, sát thương, tốc độ bắn, độ giật, băng đạn, tầm đạn, cự ly hiệu quả) lấy cảm hứng từ các tựa game bắn súng chiến thuật (CS:GO, Valorant, Apex).
4. Đồng bộ hóa với hệ thống Nón Tầm Nhìn (Vision Cone Overlay): Shotgun góc rộng cự ly gần, Sniper tầm cực xa góc hẹp (tunnel vision), Rifle cân bằng, SMG cơ động.
5. Cập nhật hình thái đường đạn (`getBulletType`) và nhãn hiển thị trong Kho Vũ Khí (Showroom).

**Quy tắc bắt buộc:**
- 100% tiếng Việt trong toàn bộ giao diện và mô tả.
- Tuyệt đối không tạo icon hoặc chèn icon mới vào giao diện.
- Sử dụng tiền tố `th_` cho các hàm/field/biến bổ sung mới.

---

## 2. Ma Trận Phân Loại 18 Mẫu Súng Kenney Blaster

| Mã hiệu ID | Model GLB | Tên hiển thị mới | Phân loại chuẩn | Slot | Cơ chế bắn & Đặc tính nổi bật |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `blaster` | `blaster-a.glb` | BLASTER-A ALPHA | SÚNG LỤC TIÊU CHUẨN | Phụ | Bán tự động, độ chính xác ổn định, khởi đầu |
| `blaster_b` | `blaster-b.glb` | BLASTER-B STRIKER | SÚNG LỤC TÁC CHIẾN | Phụ | Bán tự động nhanh, độ giật thấp, băng đạn khá |
| `blaster_c` | `blaster-c.glb` | BLASTER-C PHANTOM | SÚNG LỤC BÁN TỰ ĐỘNG | Phụ | Nhỏ gọn, tốc độ rút súng và thay đạn cực nhanh |
| `blaster_d` | `blaster-d.glb` | BLASTER-D REPEATER | TIỂU LIÊN SMG CAO TỐC | Chính | Tự động hoàn toàn, xả đạn nhanh, cự ly gần |
| `blaster_e` | `blaster-e.glb` | BLASTER-E STORM MK-II | SÚNG TRƯỜNG TÁC CHIẾN | Chính | Đa dụng tầm trung, hỏa lực ổn định (Assault Rifle) |
| `blaster_f` | `blaster-f.glb` | BLASTER-F ENFORCER | SÚNG TRƯỜNG TẦM XA | Chính | Nòng dài, độ chính xác cao, sát thương từng phát tốt |
| `blaster_g` | `blaster-g.glb` | BLASTER-G SCATTER-V | SHOTGUN TÁN XẠ | Chính | Nòng loa hình nón, 8 mảnh đạn, quét sạch cận chiến |
| `mac10` | `blaster-h.glb` | BLASTER-H VIPER | TIỂU LIÊN CƠ ĐỘNG (SMG) | Phụ | Siêu tốc độ, bắn áp chế cận chiến kiểu Machine Pistol |
| `blaster_i` | `blaster-i.glb` | BLASTER-I MAGNUM | SÚNG LỤC CỠ LỚN (HAND CANNON)| Phụ | Uy lực cực mạnh, giật cao, sát thương chí mạng lớn |
| `plasma` | `blaster-j.glb` | BLASTER-J PLASMA RIFLE | SÚNG TRƯỜNG NĂNG LƯỢNG | Chính | Bắn đạn plasma năng lượng cao, đạn bay nhanh |
| `pew` | `blaster-k.glb` | BLASTER-K CYBER LASER | SÚNG LỤC LASER | Phụ | Nhanh, chính xác tuyệt đối, thời gian nạp cực ngắn |
| `blaster_l` | `blaster-l.glb` | BLASTER-L DOUBLE BARREL | SHOTGUN HAI NÒNG | Chính | 2 nòng song song, xả 2 phát cực mạnh liên tiếp |
| `blaster_m` | `blaster-m.glb` | BLASTER-M BREACHER | SHOTGUN CHIẾN THUẬT | Chính | Thân hộp cứng cáp, 6 mảnh đạn, bắn đầm tay |
| `awp` | `blaster-n.glb` | BLASTER-N VORTEX SNIPER | SÚNG BẮN TỈA HẠNG NẶNG | Chính | Nòng siêu dài, 1-2 phát hạ gục, xuyên thấu 2 mục tiêu |
| `blaster_o` | `blaster-o.glb` | BLASTER-O TITAN DMR | SÚNG BẮN TỈA BÁN TỰ ĐỘNG | Chính | Bắn tỉa liên thanh tầm xa, nhịp bắn ổn định |
| `rocket` | `blaster-p.glb` | BLASTER-P RPG DEVASTATOR | SÚNG PHÓNG LỰU HẠNG NẶNG | Chính | Nổ lan diện rộng, sát thương công phá lớn |
| `blaster_q` | `blaster-q.glb` | BLASTER-Q VULCAN MINIGUN | SÚNG MÁY GATLING | Chính | Băng đạn 80 viên, tốc độ bắn cực nhanh, kìm chân |
| `blaster_r` | `blaster-r.glb` | BLASTER-R OMEGA CANNON | PHÁO LƯỢNG TỬ TẬN THẾ | Chính | Hỏa lực tối thượng, bán kính nổ cực rộng |

---

## 3. Bảng Cân Bằng Thông Số Chiến Thuật Chi Tiết

### 3.1. Nhóm Súng Lục (Secondary Weapons)
- **BLASTER-A (Alpha):** Damage: 26, FireRate: 0.35s, Mag: 15, Reload: 1.1s, Range: 18m, Recoil: Thấp.
- **BLASTER-B (Striker):** Damage: 22, FireRate: 0.22s (Full-auto), Mag: 20, Reload: 1.1s, Range: 16m.
- **BLASTER-C (Phantom):** Damage: 30, FireRate: 0.28s, Mag: 14, Reload: 0.95s, Range: 20m.
- **BLASTER-H (Viper):** Damage: 16, FireRate: 0.11s, Mag: 32, Reload: 1.15s, Range: 14m (SMG Slot phụ).
- **BLASTER-I (Magnum):** Damage: 52, FireRate: 0.48s, Mag: 7, Reload: 1.4s, Range: 22m, Crit: x2.4.
- **BLASTER-K (Cyber Laser):** Damage: 24, FireRate: 0.25s, Mag: 18, Reload: 0.9s, Range: 19m.

### 3.2. Nhóm Tiểu Liên SMG (Primary Weapons)
- **BLASTER-D (Repeater SMG):** Damage: 20, FireRate: 0.13s (RPM ~460), Mag: 35, Reload: 1.25s, Range: 16m, Di chuyển linh hoạt, tản đạn vừa.

### 3.3. Nhóm Shotgun Cận Chiến (Primary Weapons)
- **BLASTER-G (Scatter-V):** Pellets: 8 viên, Damage: 15/viên (Tổng 120 dmg max), FireRate: 0.75s, Mag: 8, Reload: 1.6s, Range: 11m, Tán đạn rộng 9.5°.
- **BLASTER-L (Double Barrel):** Pellets: 10 viên, Damage: 14/viên (Tổng 140 dmg max), FireRate: 0.32s, Mag: 2, Reload: 1.35s, Range: 9m, Bộc phát cực khủng.
- **BLASTER-M (Breacher):** Pellets: 6 viên, Damage: 18/viên (Tổng 108 dmg max), FireRate: 0.65s, Mag: 6, Reload: 1.5s, Range: 13m, Độ chụm đạn tốt hơn.

### 3.4. Nhóm Súng Trường AR / Carbine (Primary Weapons)
- **BLASTER-E (Storm MK-II):** Damage: 34, FireRate: 0.18s, Mag: 30, Reload: 1.35s, Range: 25m, Chuẩn Assault Rifle đa năng.
- **BLASTER-F (Enforcer):** Damage: 38, FireRate: 0.22s, Mag: 25, Reload: 1.4s, Range: 28m, Độ giật thẳng đứng, bắn tầm xa tốt.
- **BLASTER-J (Plasma Rifle):** Damage: 44, FireRate: 0.24s, Mag: 24, Reload: 1.3s, Range: 26m, Đạn năng lượng xanh tím.

### 3.5. Nhóm Bắn Tỉa Sniper & DMR (Primary Weapons)
- **BLASTER-N (Vortex Sniper):** Damage: 130 (1-shot đối phương yếu máu / 2-shot chắc chắn), FireRate: 1.35s, Mag: 5, Reload: 2.1s, Pierce: 2 mục tiêu, Range: 38m, Độ giật nảy tâm lớn.
- **BLASTER-O (Titan DMR):** Damage: 65, FireRate: 0.42s, Mag: 12, Reload: 1.55s, Pierce: 1, Range: 32m, Bắn bán tự động đầm tay.

### 3.6. Nhóm Hỏa Lực Hạng Nặng (Primary Weapons)
- **BLASTER-Q (Vulcan Minigun):** Damage: 15, FireRate: 0.09s, Mag: 80, Reload: 2.8s, Range: 25m, Tản đạn nở to khi bắn liên tục.
- **BLASTER-P (RPG Devastator):** Damage: 135 (Nổ lan bán kính 3.8m), FireRate: 1.8s, Mag: 2, Reload: 2.3s, Range: 28m.
- **BLASTER-R (Omega Cannon):** Damage: 165 (Nổ lan bán kính 4.5m), FireRate: 2.2s, Mag: 3, Reload: 2.5s, Range: 32m.

---

## 4. Cấu Hình Nón Tầm Nhìn (Vision Cone) Theo Dòng Súng
Đồng bộ hàm `getWeaponVisionConfig` trong `src/gameplay/combat/vision-cone.js`:

1. **Shotgun (`blaster_g`, `blaster_l`, `blaster_m`):**
   - Không ngắm (Hip): Tầm nhìn 13m, Góc mở 75° (Bao quát cực rộng xung quanh).
   - Bật ngắm (ADS): Tầm nhìn 17m, Góc mở 55°.
2. **Sniper (`blaster_n`, `blaster_o`):**
   - Không ngắm (Hip): Tầm nhìn 24m, Góc mở 42°.
   - Bật ngắm (ADS): Tầm nhìn 45m - 60m (tùy kính ngắm), Góc mở 14° - 18° (Hiệu ứng hẹp góc tập trung cao độ).
3. **Assault Rifle / Carbine (`blaster_e`, `blaster_f`, `blaster_j`):**
   - Không ngắm (Hip): Tầm nhìn 21m, Góc mở 50°.
   - Bật ngắm (ADS): Tầm nhìn 30m - 38m, Góc mở 32°.
4. **SMG & Súng Lục (`blaster`, `blaster_b`, `blaster_c`, `blaster_d`, `blaster_h`, `blaster_i`, `blaster_k`):**
   - Không ngắm (Hip): Tầm nhìn 18m, Góc mở 55°.
   - Bật ngắm (ADS): Tầm nhìn 24m, Góc mở 40°.
5. **Vũ khí hạng nặng (`blaster_q`, `blaster_p`, `blaster_r`):**
   - Không ngắm (Hip): Tầm nhìn 20m, Góc mở 48°.
   - Bật ngắm (ADS): Tầm nhìn 28m, Góc mở 35°.

---

## 5. Danh Sách Tệp Cần Thay Đổi
1. `src/gameplay/combat/weapons.js`:
   - Cập nhật toàn bộ `WEAPON_CONFIGS` (tên, phân loại category, thông số sát thương, đạn, tốc độ, giật).
   - Cập nhật `SECONDARY_WEAPON_IDS`: đưa `blaster_c`, `blaster_i` vào nhóm súng phụ; giữ `blaster_f`, `blaster_m` ở nhóm súng chính.
   - Cập nhật hàm `getBulletType(w)`: shotgun gồm `blaster_g`, `blaster_l`, `blaster_m`; sniper gồm `blaster_n`, `blaster_o`.
2. `src/gameplay/combat/vision-cone.js`:
   - Chuẩn hóa hàm `getWeaponVisionConfig(weapon, isADS, opticTier)` theo đúng ID và Category mới.
3. `src/ui/showroom.js`:
   - Đồng bộ hiển thị bộ lọc (Vũ khí chính / Vũ khí phụ / Trang bị khác) và cập nhật số lượng thống kê.
4. Kiểm thử với Browser Subagent để đảm bảo mọi loại súng hiển thị đúng tên, đúng tab, bắn mượt và không có lỗi console.
