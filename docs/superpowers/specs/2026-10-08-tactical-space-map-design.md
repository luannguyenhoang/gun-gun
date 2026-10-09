# Dac Ta Thiet Ke: Ban Do Tram Khong Gian Chien Thuat (Tactical Sci-Fi Space Map)

## 1. Tong quan & Muc tieu thiet ke

### 1.1 Muc tieu
- Xay dung mot ban do dau truong moi mang dam tinh chien thuat the thuc doi khang (Competitive Tactical Map), lay cam hung tu cau truc 3 lan kinh dien cua cac ban do CS:GO (Dust II / Mirage).
- Phat huy toi da gia tri cua co che goc nhin 50 do (Vision Cone), suong mu chien tranh (Fog of War) va chia se tam nhin dong doi (Team Shared Vision).
- Tan dung toi da bo tai nguyen 3D chat luong cao cua goi `kenney_modular-space-kit_1.0` de tao dung khong gian tram vu tru vien tuong (Sci-Fi Space Outpost).

### 1.2 Yeu cau ky thuat & Rang buoc
- Ho tro ca che do Dau khang 4v4 TDM va Che do Sinh ton Survival.
- Hieu nang cao: duy tri 60 FPS on dinh thong qua ky thuat gom luoi InstancedMesh cho cac khoi san va tuong lap lai.
- Tuong thich hoan toan voi thuat toan kiem tra cheng goc ban (Line of Sight - `hasLineOfSight`), truot va cham vat ly (`moveCharacter`) va tim duong A* cua Bot (`findNavigationPath`).
- Khong gay loi khi chay cong cu kiem tra ma nguon `tools/check-project.mjs`.

---

## 2. Cau truc bo cuc 3 lan (3-Lane Competitive Layout)

Kich thuoc tong the cua ban do duoc quy chuan theo he luoi module 4m x 4m:
- Dien tich toan san: 56m x 56m (toa do X tu -28 den +28, Z tu -28 den +28).
- Chieu cao tuong chuan: 4.25m (chan hoan toan goc ban va tam nhin tren mat phang XZ).

### 2.1 Phan khu 1: Can cu Xuat phat (Spawn Bases)
- **Blue Spawn (Can cu Doi Xanh - Phia Nam, Z: +20 den +26):**
  - Khu vuc phong thu an toan voi 4 diem xuat phat cua Doi Xanh.
  - Ba loi ra ro rang:
    - Cua Phai (West Gate): Dan vao Long A.
    - Cua Giua (Center Arch): Huong thang ra Mid Courtyard.
    - Cua Trai (East Gate): Dan vao duong ham B Tunnels.
- **Red Spawn (Can cu Doi Do - Phia Bac, Z: -26 den -20):**
  - Bo cuc doi xung phia Bac danh cho 4 thanh vien Doi Do.
  - Ba loi ra tuong ung: phong thu Long A, kiem soat Mid va giu cua ngach vao Site B.

### 2.2 Phan khu 2: Khong gian Trung tam (Mid Courtyard & Connectors)
- **Mid Courtyard (Dai lo trung lo):**
  - Truc duong thang noi lien hai can cu, co cac khoi tru may (`template-detail`) o giua lam vat can che chan.
  - Diem do sung tam xa kinh dien cho cac xa thu súng ngam (Sniper Peek).
- **Connector (Hanh lang re sang Site A):**
  - Duong ngach chien thuat noi truc tiep tu Mid vao khu vuc Lo phan ung Alpha (Site A).
  - La nut giao thong quyet dinh quyen kiem soat luong quay quan (Rotation) giua hai canh.
- **Vent / B Access (Cua thong sang Site B):**
  - Ngach cua hep dan tu Mid sang khu vuc Kho chua Beta (Site B).

### 2.3 Phan khu 3: Cu diem Lo phan ung Alpha (Reactor Alpha / Site A)
- **Long A (Hanh lang mo rong dai):**
  - Hanh lang thang dai voi goc cua 90 do, thich hop cho giao tranh tam trung va xa.
  - Co cac buc chan gac goc de phong thu.
- **Short A / Catwalk (Duong tiep can tu Mid):**
  - Loi di kep qua cong `gate-lasers`, cho phep doi cong tao the gong kim (Crossfire) danh vao Site A tu hai huong.
- **Alpha Core Platform (Khu trung tam A):**
  - Dat buc may moc nang cao va cot nang luong de nguoi choi co the an nap nap dan.

### 2.4 Phan khu 4: Cu diem Kho chua Beta (Storage Beta / Site B)
- **B Tunnels / Banana (Duong ham kin uon luon):**
  - Hanh lang hep voi 2 khuc cua gap 90 do, gioi han tam nhin cuc ngan, la dia ban ly tuong cho vu khi Shotgun va SMG.
- **B Site Room (Phong kho chua rong):**
  - Phong rong co bo tri cac khoi hang modular (`template-floor-layer-raised`) tao nen nhieu goc nap bat ngo (Off-angles).

---

## 3. Co che tuong tac Tam nhin 50 do & Suong mu Fog of War

### 3.1 Kê goc va Kiem tra goc chet (Angle Holding & Corner Clearing)
- Boi vi goc nhin mac dinh duoc thu hep con 50 do, moi khuc cua hanh lang 90 do deu tao ra mot vung mu hoan toan phia sau vach tuong.
- Nguoi phong thu co the dung ke goc truoc. Nguoi tan cong buoc phai lia tam chuot de soi luong sang den pin vao tung goc truoc khi buoc qua cua.

### 3.2 Phoi hop hoa luc cheo canh (Teammate Crossfire)
- Nho he thong chia se tam nhin dong doi (Team Shared Vision), hai thanh vien co the phan cong:
  - Mot nguoi canh huong Long A.
  - Mot nguoi canh huong Short A tu Connector.
- Suong mu se duoc khoet sang cho ca hai huong va hien thi len man hinh cung nhu radar cua toan doi.

### 3.3 Chan tam nhin vat ly (Line of Sight Raycast)
- Tat ca vach tuong `template-wall` cao 4.25m duoc them vao mang `this.colliders`.
- Ham `hasLineOfSight(fromPos, toPos)` se kiem tra tia va cham, chan hoan toan tam nhin va khong cho phep phat hien doi thu xuyen qua vach tuong.

---

## 4. Kien truc ky thuat & Danh muc tai nguyen

### 4.1 Danh sach tai nguyen nạp trong `Arena.loadModels`
Cac tep GLB duoc trich xuat tu `kenney_modular-space-kit_1.0` vao thu muc `assets/models/space/`:
1. `space/template-floor` (San kim loai tieu chuan 4m x 4m)
2. `space/template-floor-detail` (San co hoa tiet ky thuat 4m x 4m)
3. `space/template-wall` (Tuong thang tieu chuan rong 4m, cao 4.25m)
4. `space/template-wall-corner` (Tuong goc 90 do)
5. `space/template-wall-half` (Tuong thap / vat can nua nguoi)
6. `space/gate` (Cong vòm khong gian rong 4m)
7. `space/gate-lasers` (Cong vom laser bao ve rong 4m)
8. `space/template-detail` (Tru may / console dieu khien lam vat can che chan)
9. `space/template-floor-layer-raised` (Buc nang cao / thung hang modular)
10. `space/cables` (Day cap dien trang tri tren san)

### 4.2 Toi uu hoa bang `THREE.InstancedMesh`
- San duoc chia thanh ma tran 14x14 o (tong 196 o san) gop chung vao 1 `InstancedMesh`.
- Cac doan tuong bien va tuong ngan hanh lang duoc gop chung vao `InstancedMesh` cua `template-wall` de giam thieu Draw Calls.

### 4.3 Xu ly Vat ly & AI Bot Navigation
- Dang ky chinh xac hop toa do `THREE.Box3` cho moi doan tuong va vat can vao `this.colliders`.
- Thuat toan `findNavigationPath` su dung cac toa do trung tam cua luoi module de bot di chuyen muot ma doc theo cac hanh lang ma khong bi mac ket.

### 4.4 Chieu sang moi truong (Sci-Fi Atmospheric Lighting)
- Anh sang nen AmbientLight xanh den tram: `0x141f36`.
- Den DirectionalLight chieu xien gia lap anh sang mat troi chieu qua cua so vom tram vu tru.
- Den PointLight neon dac trung:
  - Can cu Doi Xanh: anh sang xanh Cyan (`0x00d0ff`).
  - Can cu Doi Do: anh sang do Cam bao dong (`0xff3b30`).
  - Dai sanh Mid: anh sang trang vang ky thuat (`0xffeedd`).

---

## 5. Ke hoach xac thuc & Tieu chi nghiem thu

1. **Kiem tra dong bo du an (`npm run check`):**
   - Kiem tra toan bo 211+ tep tin, dam bao cac asset `space/*.glb` duoc khai bao chinh xac trong `arena.js`.
2. **Kiem tra hien thi 3D:**
   - Ban do hien thi day du he thong san, tuong ngan, cong laser va cac khoi che chan.
   - Goc nhin camera Isometric/Top-down quan sat ro rang ben trong cac phong va hanh lang khong bi mai che che khuat.
3. **Kiem tra co che goc nhin & Suong mu:**
   - Goc quet 50 do hoat dong chuan xac khi xoay goc aimYaw.
   - Suong mu 40% phu kin cac phong toi khi chua co dong doi soi toi.
   - Khi bot hoac nguoi choi soi den pin vao cua ngach, doi thu dung sau vach lo dien tren ca man hinh va radar.
4. **Kiem tra van hanh tran dau:**
   - Bot Doi Xanh va Doi Do di chuyen tuan tra doc theo 3 lan duong (Mid, Long A, B Tunnels).
   - Tran dau TDM 4v4 dien ra can bang va kich tinh.
