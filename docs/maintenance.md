# Ghi chú sau khi tổ chức thư mục (2026-10-02)

## Phạm vi

Di chuyển module theo lĩnh vực, CSS vào `styles/`, thư viện vào `vendor/`, server phát triển vào `tools/` và dịch vụ Python vào `backend/`. Cập nhật import, import map, URL trong HTML, API Vercel và đường dẫn fixture của test. Không thay đổi cơ chế combat hay tỷ lệ rơi đồ trong lần sắp xếp này.

Giữ `index.html` và `api/` ở gốc để tương thích cách phục vụ static và quy ước Vercel. `backend/rooms.py` vẫn có hai điểm gọi là server local và adapter Vercel nên không phải mã chết, dù frontend hiện kết nối PeerJS.

## Dọn tài nguyên

`cleanup-manifest.json` ghi từng tệp nguồn xuất dư thừa, ZIP, asset không tham chiếu và ảnh test đã sinh được bỏ khỏi checkout. `unused-assets.json` ghi các asset bổ sung xác nhận không nằm trong đồ thị tải thực tế. Model tải động được kiểm tra qua cấu hình súng, nhân vật, danh sách model arena/zombie và URI texture bên trong GLB.

Giấy phép từ các bộ nguồn được giữ ở `assets/licenses/`. Bản `vendor/GLTFLoader.js` trùng lặp, không được import và có đường dẫn utility sai đã bị bỏ; bản sử dụng thực tế ở `vendor/loaders/GLTFLoader.js` được giữ.

Trước khi xóa đã tạo bản khôi phục ngoài workspace:

- `C:/Users/admin/AppData/Local/Temp/game-before-restructure-20261002.zip`: snapshot Git trước khi tổ chức.
- `C:/Users/admin/AppData/Local/Temp/game-unused-files-20261002.zip`: bản sao chính xác các tệp dọn dẹp, được kiểm tra SHA256 trước khi xóa.

Các tệp gốc cũng còn trong lịch sử Git. Thư mục Temp có thể được hệ điều hành dọn, vì vậy ưu tiên lịch sử Git để khôi phục lâu dài.

## Kiểm thử cũ cần bảo trì riêng

Trước và sau di chuyển: 42 unit test, 31 qua và 11 lỗi cũ. Các nhóm lỗi cũ:

- `auto-reload`: kỳ vọng đạn dự trữ hữu hạn trong khi game dùng vô hạn.
- `weapon-selection`: số đạn và slot khởi đầu của phiên bản cũ.
- `combat-upgrades`: hệ số damage, slot vũ khí hiếm, drop table 25%, acid/giant và hàng đợi wave cũ.
- `loot-balance`: pity drop đã bỏ và fixture dao cũ.

Giữ các test này để không che giấu nợ kiểm thử. Lệnh `npm test` sẽ còn báo lỗi cho đến khi cập nhật chúng theo thiết kế game được chấp nhận. Lệnh `npm run check` kiểm tra cấu trúc; `npm run test:browser` kiểm tra game với các tài nguyên được giữ lại.
