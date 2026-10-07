# Zombie Arena

Game trình duyệt dùng Three.js và PeerJS. Không cần bước build: chạy HTTP server ở thư mục gốc rồi mở `index.html`.

## Chạy local

```sh
python tools/dev-server.py
```

Mở `http://localhost:8080`. Biến môi trường `PORT` đổi cổng. Server phục vụ thư mục gốc và API phòng cũ; multiplayer trong game hiện dùng PeerJS.

## Cấu trúc

- `index.html`: trang vào game và DOM giao diện.
- `src/app/`: khởi tạo game, vòng lặp và kết nối các hệ thống.
- `src/gameplay/player/`: điều khiển và cấu hình nhân vật.
- `src/gameplay/combat/`: súng, zombie, sát thương và bom.
- `src/gameplay/loot/`: vật phẩm rơi, hòm đồ và túi đồ.
- `src/world/`: bản đồ, va chạm và tìm đường.
- `src/ui/`: HUD, menu, sảnh và kho trang bị.
- `src/network/`: phòng PeerJS và đồng bộ người chơi.
- `src/rendering/`: hiệu ứng, thanh máu 3D và chất lượng hiển thị.
- `src/audio/`: âm thanh.
- `styles/`: CSS, giữ thứ tự tải trong HTML vì có các lớp ghi đè giao diện.
- `assets/`: model, ảnh xem trước, âm thanh và giấy phép.
- `vendor/`: thư viện bên thứ ba và giấy phép đi kèm.
- `backend/`: dịch vụ phòng Python; `api/` giữ vị trí entrypoint do Vercel yêu cầu.
- `tools/`: server phát triển và kiểm tra đường dẫn/tài nguyên.
- `tests/unit/`: kiểm thử logic; `tests/browser/`: kiểm thử Chrome.
- `tests/artifacts/`: ảnh sinh ra khi kiểm thử, không đưa vào Git.
- `docs/`: ghi chú bảo trì và nhật ký dọn dẹp.

## Kiểm tra

Yêu cầu Node.js có `node:module.registerHooks` (Node 22.15+ hoặc bản mới hơn).

```sh
node tools/check-project.mjs
node --test tests/unit/*.test.mjs
```

Kiểm thử trình duyệt cần package `playwright` và Chrome đã cài. Chạy bằng `node tests/browser/<tên-file>.cjs`. Bài multiplayer cần mạng đến CDN và signaling PeerJS. Ảnh kết quả nằm trong `tests/artifacts/`.

Khi không truy cập được PeerJS, có thể kiểm tra hai phiên game độc lập bằng transport nội bộ (PowerShell):

```powershell
$env:MULTIPLAYER_LOCAL_TRANSPORT = '1'
node tests/browser/multiplayer-browser.cjs
Remove-Item Env:MULTIPLAYER_LOCAL_TRANSPORT
```

Bài này kiểm tra đồng bộ thế giới, nhặt/vứt súng lặp, cứu người gục/chết, menu Esc và kết thúc trận. Transport nội bộ không thay thế kiểm thử WebRTC qua Internet. Trong multiplayer, chủ phòng quyết định sát thương, vật phẩm và cứu người; mỗi khẩu súng có `instanceId` riêng. Esc mở menu nhưng trận đấu vẫn tiếp tục. Các máy trong phòng cần tải cùng phiên bản game.

`npm run test:multiplayer:timing` chạy ba phiên game với transport nội bộ, kiểm tra cả sáu chiều đồng bộ vị trí/model, vào phòng giữa trận, chủ phòng/khách ngừng nhận animation frame và khởi động lại trận. Nhịp mạng dùng Worker riêng; chủ phòng tiếp tục mô phỏng khi tab ẩn. Trình duyệt hoặc hệ điều hành đóng băng hoàn toàn trang vẫn có thể làm phòng tạm ngừng. Sau cập nhật giao thức multiplayer, tất cả người chơi cần tải lại trang và tạo phòng mới; phòng sẽ báo lỗi nếu hai máy dùng khác phiên bản giao thức.

`npm install` cài công cụ kiểm thử. Có thể dùng `npm run check`, `npm run test:browser` và `npm run test:multiplayer` thay cho các lệnh dài tương ứng. Game không phụ thuộc `node_modules` khi chạy hoặc triển khai.

Các test cũ về đạn hữu hạn, pity drop và một số luật combat đã lỗi trước lần tổ chức thư mục này; xem `docs/maintenance.md`. Không sửa luật game chỉ để làm những test cũ đó xanh.

## Thêm tính năng

Đặt logic vào nhóm tương ứng trong `src/`, dùng import tương đối giữa các module. Chỉ kết nối hệ thống vào vòng lặp ở `src/app/main.js` khi cần. Thêm cấu hình model ở hệ thống sở hữu nó; giữ URL tài nguyên theo gốc trang (`assets/...`). Khi thêm cách tải tài nguyên động mới, bổ sung vào `tools/check-project.mjs`.

Giữ thư viện bên thứ ba trong `vendor/`, không trộn mã game vào đó. Không đưa ZIP nguồn, FBX không dùng, cache hay ảnh kiểm thử vào bản phát hành. Giữ giấy phép của tài nguyên ngay cả khi dọn bản xuất dư thừa.
