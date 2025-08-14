# Custom Icons Assets

Thư mục này chứa các custom icons được build sẵn vào app.

## Hệ thống icon theo trạng thái task:

### Quy tắc đặt tên:

- **Icon có đuôi "1"** (vd: `laser1.png`, `bending1.png`) → dành cho trạng thái **"pending"** và **"in_progress"**
- **Icon có đuôi "2"** (vd: `laser2.png`, `bending2.png`) → dành cho trạng thái **"completed"**

### Danh sách icons hiện có:

#### ✅ Đã cấu hình đầy đủ:

- `laser1.png` / `laser2.png` → `laser_cutting` process
- `bending1.png` / `bending2.png` → `bending` process
- `welding1.png` / `welding2.png` → `welding` process
- `grinder1.png` / `grinder2.png` → `grinding` process
- `ndt1.png` / `ndt2.png` → `ndt` process
- `order1.png` / `order2.png` → `order` process
- `polisher1.png` / `polisher2.png` → `polisher` process
- `pressing1.png` / `pressing2.png` → `pressing` process
- `rolling1.png` / `rolling2.png` → `rolling` process
- `paint-bucket_4228960.png` / `paint-bucket_4229235.png` → `painting` và `son` process

#### 🔄 Cần thêm icons cho:

- `material_separation` (Bóc tách vật tư)
- `quotation` (Báo giá)
- `material_purchasing` (Mua vật tư)
- `material_cutting` (Cắt phôi)
- `assembly` (Lắp ráp)
- `shipping` (Vận chuyển)
- `turning` (Tiện)
- `milling` (Phay)
- `drilling` (Khoan)

## Cách thêm custom icons mới:

1. **Tạo 2 file icon** theo quy tắc đặt tên (vd: `turning1.png`, `turning2.png`)
2. **Đặt file vào thư mục này**
3. **Cập nhật `src/utils/buildTimeIcons.js`**:
   - Import 2 icons mới
   - Thêm vào `BUILD_TIME_CUSTOM_ICONS` (icon có đuôi "1")
   - Thêm vào `COMPLETED_STATE_ICONS` (icon có đuôi "2")
4. **Build app**

## Kích thước khuyến nghị:

- 24x24px cho hiển thị bình thường
- 48x48px cho hiển thị HD
- Format: PNG với background trong suốt
